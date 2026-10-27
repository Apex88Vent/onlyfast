import Foundation
import UIKit
import WebKit
import RevenueCat

// Protocol 1 source extension. Median's plugin/delegate remain installed.
// Compile and exercise with Xcode before claiming native iOS compatibility.
@MainActor @objc(OnlyFastBilling)
public final class OnlyFastBilling: NSObject, WKScriptMessageHandler {
    private static let shared = OnlyFastBilling()
    private static let transactionsEnabled = false
    private static let offeringID = "onlyfast_monthly_v1"
    private static let sdkKey = "appl_ScuxViARpeZHZQyTtVQQpSooVFz" // Public client key.
    private static let authURL = URL(string: "https://thpyjvwtfvfxiufchrxn.supabase.co/auth/v1/user")!
    private static let publicKey = "sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv"
    private static let hosts: Set<String> = ["onlyfast.app", "www.onlyfast.app"]
    private static let products = ["pro": "app.onlyfast.pro.monthly", "teams": "app.onlyfast.teams.monthly"]
    private static let packages = ["pro": "$rc_monthly", "teams": "$rc_custom_teams_monthly"]
    private typealias JSON = [String: Any]
    private struct Catalog {
        let token: String
        let user: String
        let generation: UInt64
        let expires: Double
        let packages: [String: RevenueCat.Package]
    }
    private struct Failure: Error { let code: String; let message: String }
    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private let webViews = NSHashTable<WKWebView>.weakObjects()
    private var generation: UInt64 = 0
    private var busy = false
    private var ownsSDK = false
    private var identifiedUser: String?
    private var cached: Catalog?
    private var observation: Task<Void, Never>?
    private var lastNotification = Date.distantPast
    private let http: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        return URLSession(configuration: configuration, delegate: NoRedirects(), delegateQueue: nil)
    }()

    @objc(attachToWebView:)
    public static func attach(to webView: WKWebView) {
        let adapter = shared
        adapter.webViews.add(webView)
        let controller = webView.configuration.userContentController
        guard !adapter.controllers.contains(controller) else { return }
        adapter.controllers.add(controller)
        // Do not remove/replace Median handlers, scripts or navigation delegates.
        controller.add(adapter, name: "onlyFastBillingNative")
        controller.addUserScript(WKUserScript(source: bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    private override init() {
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(resumed), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(backgrounded), name: UIApplication.didEnterBackgroundNotification, object: nil)
    }

    @objc private func backgrounded() { cached = nil }
    @objc private func resumed() {
        cached = nil
        // Never restore, purchase or change identity on resume. Existing web
        // membership lifecycle performs authenticated server refresh.
        notifyMembershipChanged()
    }

    private static func approved(_ url: URL?) -> Bool {
        guard let url = url else { return false }
        return url.scheme == "https" && hosts.contains(url.host ?? "") &&
            (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "onlyFastBillingNative", message.frameInfo.isMainFrame,
              let view = message.webView, Self.approved(view.url),
              message.frameInfo.securityOrigin.protocol == "https",
              Self.hosts.contains(message.frameInfo.securityOrigin.host),
              [0, 443].contains(message.frameInfo.securityOrigin.port),
              let body = message.body as? JSON, let documentID = body["documentId"] as? String,
              documentID.range(of: "^[a-zA-Z0-9-]{1,80}$", options: .regularExpression) != nil,
              let payload = body["payload"] as? String, payload.utf8.count <= 65_536,
              let data = payload.data(using: .utf8), let request = (try? JSONSerialization.jsonObject(with: data)) as? JSON,
              let requestID = request["requestId"] as? String,
              requestID.range(of: "^[a-zA-Z0-9-]{1,80}$", options: .regularExpression) != nil else { return }
        let respond: (JSON) -> Void = { [weak view] value in
            guard let view = view, Self.approved(view.url) else { return }
            let envelope: JSON = ["requestId": requestID, "result": value]
            guard let json = try? JSONSerialization.data(withJSONObject: envelope),
                  let text = String(data: json, encoding: .utf8),
                  let arguments = try? JSONSerialization.data(withJSONObject: [documentID, text]),
                  let encoded = String(data: arguments, encoding: .utf8) else { return }
            // Receiver checks a per-document nonce: an old completion cannot
            // reach a new document after WebView navigation/reuse.
            view.evaluateJavaScript("window.onlyFastBilling && window.onlyFastBilling._receive.apply(null, \(encoded));", completionHandler: nil)
        }
        guard request["protocolVersion"] as? Int == 1 else { respond(Self.failure("PROTOCOL", "Update the OnlyFast billing client.")); return }
        let operation = request["operation"] as? String ?? ""
        if operation == "capabilities" {
            var reply = Self.result("ok"); reply["platform"] = "ios"; reply["transactionsEnabled"] = Self.transactionsEnabled
            respond(reply); return
        }
        if operation == "invalidate" {
            invalidate(); respond(Self.result("ok")); return
        }
        guard ["identify", "catalog", "purchase", "restore", "clear"].contains(operation) else {
            respond(Self.failure("OPERATION", "Unsupported billing operation.")); return
        }
        if ["purchase", "restore"].contains(operation) && !Self.transactionsEnabled {
            respond(Self.failure("NOT_RELEASED", "Native transactions are not enabled in this binary.")); return
        }
        guard !busy else { respond(Self.failure("BUSY", "A native billing request is already running.")); return }
        busy = true
        let epoch = generation
        Task {
            let reply: JSON
            do { reply = try await execute(operation, request, view, epoch) }
            catch let failure as Failure { reply = Self.failure(failure.code, failure.message) }
            catch { reply = Self.storeError(error) }
            busy = false
            respond(epoch == generation ? reply : Self.failure("ACCOUNT_CHANGED", "Your account changed. Refresh from the purchasing account."))
        }
    }

    private func invalidate() {
        generation &+= 1; cached = nil; identifiedUser = nil
        observation?.cancel(); observation = nil
    }
    private func current(_ view: WKWebView, _ epoch: UInt64) throws {
        guard epoch == generation, Self.approved(view.url) else {
            throw Failure(code: "ACCOUNT_CHANGED", message: "Your account or page changed.")
        }
    }
    private func verify(_ request: JSON) async throws -> String {
        guard let id = request["expectedUserId"] as? String, UUID(uuidString: id) != nil,
              let token = request["accessToken"] as? String, !token.isEmpty, token.utf8.count <= 32_768 else {
            throw Failure(code: "AUTH", message: "Sign in to the purchasing account.")
        }
        var auth = URLRequest(url: Self.authURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        auth.setValue(Self.publicKey, forHTTPHeaderField: "apikey")
        auth.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        let data: Data; let response: URLResponse
        do { (data, response) = try await http.data(for: auth) }
        catch { throw Failure(code: "AUTH", message: "Cannot verify your session. Check your connection.") }
        guard let response = response as? HTTPURLResponse, response.statusCode == 200, response.url == Self.authURL,
              data.count <= 1_048_576, let user = (try? JSONSerialization.jsonObject(with: data)) as? JSON,
              user["id"] as? String == id else {
            throw Failure(code: "AUTH", message: "The authenticated UUID does not match this account.")
        }
        return id // Never authorize using user-editable metadata or client entitlements.
    }
    private func ensureIdentity(_ id: String, _ view: WKWebView, _ epoch: UInt64) async throws {
        try current(view, epoch)
        if !ownsSDK {
            // Median remains installed. A foreign/anonymous configured SDK is
            // not silently adopted, reset or reconfigured by this adapter.
            guard !Purchases.isConfigured else {
                throw Failure(code: "SDK_OWNER", message: "RevenueCat was configured by another integration. Restart with OnlyFast as the SDK owner.")
            }
            Purchases.configure(withAPIKey: Self.sdkKey, appUserID: id)
            ownsSDK = true
        } else if Purchases.shared.appUserID != id || Purchases.shared.isAnonymous {
            cached = nil; identifiedUser = nil; observation?.cancel(); observation = nil
            if !Purchases.shared.isAnonymous { _ = try await Purchases.shared.logOut() }
            try current(view, epoch)
            _ = try await Purchases.shared.logIn(id)
        }
        try current(view, epoch)
        guard Purchases.isConfigured, !Purchases.shared.isAnonymous, Purchases.shared.appUserID == id else {
            throw Failure(code: "IDENTITY", message: "RevenueCat identity does not match the authenticated UUID.")
        }
        identifiedUser = id
        observeCustomerInfo(id, epoch)
    }
    private func requireIdentity(_ id: String, _ view: WKWebView, _ epoch: UInt64) throws {
        try current(view, epoch)
        guard ownsSDK, Purchases.isConfigured, identifiedUser == id,
              !Purchases.shared.isAnonymous, Purchases.shared.appUserID == id else {
            throw Failure(code: "IDENTITY", message: "Identify the authenticated account before loading billing data.")
        }
    }

    private func execute(_ operation: String, _ request: JSON, _ view: WKWebView, _ epoch: UInt64) async throws -> JSON {
        if operation == "clear" {
            cached = nil; identifiedUser = nil; observation?.cancel(); observation = nil
            if ownsSDK && Purchases.isConfigured && !Purchases.shared.isAnonymous { _ = try await Purchases.shared.logOut() }
            try current(view, epoch)
            return Self.result("ok")
        }
        let id = try await verify(request)
        try current(view, epoch)
        if operation == "identify" {
            try await ensureIdentity(id, view, epoch)
            return Self.result("ok", id)
        }
        try requireIdentity(id, view, epoch)
        guard request["offeringIdentifier"] as? String == Self.offeringID else {
            throw Failure(code: "OFFERING", message: "OnlyFast's named offering is required.")
        }
        if operation == "catalog" {
            let offerings = try await Purchases.shared.offerings()
            try requireIdentity(id, view, epoch)
            guard let offering = offerings.all[Self.offeringID] else {
                throw Failure(code: "CATALOG", message: "The named OnlyFast offering is unavailable.")
            }
            var selected: [String: RevenueCat.Package] = [:]
            for plan in ["pro", "teams"] {
                let matches = offering.availablePackages.filter { $0.identifier == Self.packages[plan] }
                guard matches.count == 1, let package = matches.first,
                      package.storeProduct.productIdentifier == Self.products[plan] else {
                    throw Failure(code: "CATALOG", message: "The named offering did not return the expected Pro and Teams products.")
                }
                selected[plan] = package
            }
            let eligibility = await Purchases.shared.checkTrialOrIntroDiscountEligibility(productIdentifiers: Array(Self.products.values))
            try requireIdentity(id, view, epoch)
            let token = UUID().uuidString, expires = Date().timeIntervalSince1970 * 1000 + 300_000
            let items = try ["pro", "teams"].map { plan -> JSON in
                guard let package = selected[plan] else { throw Failure(code: "CATALOG", message: "Missing package.") }
                return try Self.product(plan, package, eligibility[package.storeProduct.productIdentifier]?.status ?? .unknown)
            }
            cached = Catalog(token: token, user: id, generation: epoch, expires: expires, packages: selected)
            var reply = Self.result("ok", id)
            reply["catalog"] = ["offeringIdentifier": Self.offeringID, "catalogToken": token, "expiresAt": expires, "packages": items]
            return reply
        }
        // Reverify directly before a transaction; no captured account/session
        // from a previous screen is accepted. Web and native holds stay false.
        guard try await verify(request) == id else { throw Failure(code: "AUTH", message: "Account changed.") }
        try requireIdentity(id, view, epoch)
        if operation == "purchase" {
            guard let plan = request["plan"] as? String, let catalog = cached,
                  catalog.user == id, catalog.generation == epoch, catalog.expires > Date().timeIntervalSince1970 * 1000,
                  catalog.token == request["catalogToken"] as? String, let package = catalog.packages[plan],
                  package.identifier == request["packageIdentifier"] as? String,
                  package.storeProduct.productIdentifier == request["productIdentifier"] as? String else {
                throw Failure(code: "SELECTION", message: "The displayed store selection expired. Refresh plans.")
            }
            cached = nil // Consume once. Never retry a possibly completed transaction.
            let outcome = try await Purchases.shared.purchase(package: package)
            try requireIdentity(id, view, epoch)
            if outcome.userCancelled { return Self.result("cancelled", id) }
            notifyMembershipChanged()
            return Self.result("purchased", id) // Web caller must sync Supabase; grants no access.
        }
        if operation == "restore" {
            cached = nil
            _ = try await Purchases.shared.restorePurchases()
            try requireIdentity(id, view, epoch)
            notifyMembershipChanged()
            return Self.result("restored", id)
        }
        throw Failure(code: "OPERATION", message: "Unsupported billing operation.")
    }

    private func observeCustomerInfo(_ id: String, _ epoch: UInt64) {
        guard observation == nil else { return }
        // Use the public stream, not Purchases.delegate (owned by Median).
        observation = Task { [weak self] in
            for await _ in Purchases.shared.customerInfoStream {
                guard !Task.isCancelled, let self = self, self.generation == epoch,
                      self.identifiedUser == id, Purchases.shared.appUserID == id, !Purchases.shared.isAnonymous else { return }
                self.notifyMembershipChanged()
            }
        }
    }
    private func notifyMembershipChanged() {
        guard ownsSDK, Purchases.isConfigured, let id = identifiedUser,
              Purchases.shared.appUserID == id, !Purchases.shared.isAnonymous,
              Date().timeIntervalSince(lastNotification) >= 1 else { return }
        lastNotification = Date()
        for view in webViews.allObjects where Self.approved(view.url) {
            // No identity, receipt or membership payload. Each page refreshes
            // using its own current authenticated session and trusted server.
            view.evaluateJavaScript("window.dispatchEvent(new Event('subscription-updated'));", completionHandler: nil)
        }
    }

    private static func period(_ value: SubscriptionPeriod, multiplying count: Int = 1) throws -> String {
        let (total, overflow) = value.value.multipliedReportingOverflow(by: count)
        guard value.value > 0, count > 0, !overflow else { throw Failure(code: "TERMS", message: "Invalid store billing period.") }
        switch value.unit {
        case .day: return "P\(total)D"
        case .week: return "P\(total)W"
        case .month: return "P\(total)M"
        case .year: return "P\(total)Y"
        @unknown default: throw Failure(code: "TERMS", message: "Unsupported store billing period.")
        }
    }
    private static func price(_ amount: Decimal, _ formatted: String, _ currency: String) throws -> JSON {
        var scaled = amount * Decimal(1_000_000), integral = Decimal()
        NSDecimalRound(&integral, &scaled, 0, .plain)
        guard !scaled.isNaN, integral == scaled, scaled >= 0, scaled <= Decimal(9_007_199_254_740_991),
              !formatted.isEmpty, !currency.isEmpty else { throw Failure(code: "TERMS", message: "Invalid store price.") }
        return ["formatted": formatted, "amountMicros": NSDecimalNumber(decimal: integral).int64Value, "currencyCode": currency]
    }
    private static func product(_ plan: String, _ package: RevenueCat.Package, _ eligibility: IntroEligibilityStatus) throws -> JSON {
        let product = package.storeProduct
        guard let periodValue = product.subscriptionPeriod, let currency = product.currencyCode else {
            throw Failure(code: "TERMS", message: "Store subscription price/currency/period unavailable.")
        }
        let billingPeriod = try period(periodValue)
        let regular: JSON = ["billingPeriod": billingPeriod, "billingCycleCount": NSNull(), "recurrenceMode": "INFINITE_RECURRING",
                             "price": try price(product.price, product.localizedPriceString, currency)]
        var phases: [JSON] = [], intro: Any = NSNull()
        if let discount = product.introductoryDiscount {
            let mode: String
            switch discount.paymentMode {
            case .freeTrial: mode = "FREE_TRIAL"
            case .payAsYouGo: mode = "PAY_AS_YOU_GO"
            case .payUpFront: mode = "PAY_UP_FRONT"
            @unknown default: throw Failure(code: "TERMS", message: "Unsupported introductory payment mode.")
            }
            guard discount.numberOfPeriods > 0 else { throw Failure(code: "TERMS", message: "Invalid introductory period count.") }
            let discountPrice = try price(discount.price, discount.localizedPriceString, discount.currencyCode ?? currency)
            let discountPeriod = try period(discount.subscriptionPeriod)
            intro = ["paymentMode": mode, "billingPeriod": discountPeriod, "numberOfPeriods": discount.numberOfPeriods,
                     "price": discountPrice, "eligibility": eligibility.rawValue]
            if eligibility == .eligible {
                let recurring = discount.paymentMode == .payAsYouGo
                // Upfront/free terms cover the whole discount duration once;
                // do not imply that an upfront price is charged every period.
                phases.append(["billingPeriod": try period(discount.subscriptionPeriod, multiplying: recurring ? 1 : discount.numberOfPeriods),
                               "billingCycleCount": recurring ? discount.numberOfPeriods : 1,
                               "recurrenceMode": recurring ? "FINITE_RECURRING" : "NON_RECURRING", "price": discountPrice])
            }
        }
        phases.append(regular)
        let status = eligibility == .eligible ? "eligible" : (eligibility == .ineligible || eligibility == .noIntroOfferExists ? "ineligible" : "unknown")
        return ["plan": plan, "packageIdentifier": package.identifier, "productIdentifier": product.productIdentifier,
                "title": product.localizedTitle, "formattedPrice": product.localizedPriceString, "currencyCode": currency,
                "billingPeriod": billingPeriod, "optionIdentifier": NSNull(), "pricingPhases": phases,
                "introductoryOffer": intro, "trialEligibility": status,
                "eligibilityNote": "Eligibility is RevenueCat's best-effort store result, not a guarantee. The Apple purchase sheet confirms final terms; introductory terms are applicable only when eligible."]
    }
    private static func result(_ status: String, _ id: String? = nil) -> JSON {
        var value: JSON = ["protocolVersion": 1, "status": status]
        if let id = id { value["appUserId"] = id }; return value
    }
    private static func failure(_ code: String, _ message: String) -> JSON {
        var value = result("error"); value["code"] = code; value["message"] = message; return value
    }
    private static func storeError(_ error: Error) -> JSON {
        let error = error as NSError
        let isRevenueCat = error.domain == ErrorCode.errorDomain
        let status = isRevenueCat && error.code == ErrorCode.purchaseCancelledError.rawValue ? "cancelled" :
            (isRevenueCat && error.code == ErrorCode.paymentPendingError.rawValue ? "pending" : "error")
        var value = result(status); value["code"] = "STORE_\(error.code)"
        value["message"] = error.localizedDescription
        return value
    }

    // Kept in this source for deterministic, tested document-start injection.
    private static let bootstrap = #"""
    (() => {
      if (window.top !== window || !['https://onlyfast.app', 'https://www.onlyfast.app'].includes(location.origin)) return;
      if (Object.prototype.hasOwnProperty.call(window, 'onlyFastBilling')) return;
      const documentId = crypto.randomUUID();
      const channel = {
        onmessage: null,
        postMessage(payload) {
          if (typeof payload !== 'string' || payload.length > 65536) throw new Error('Invalid billing message');
          window.webkit.messageHandlers.onlyFastBillingNative.postMessage({documentId, payload});
        },
        _receive(id, data) { if (id === documentId && typeof channel.onmessage === 'function') channel.onmessage({data}); }
      };
      Object.defineProperty(window, 'onlyFastBilling', {value: channel, writable: false, configurable: false});
    })();
    """#
}

// Auth never follows redirects, stores cookies, or logs bearer tokens.
private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
