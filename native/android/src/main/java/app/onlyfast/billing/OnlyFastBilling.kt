package app.onlyfast.billing

import android.app.Activity
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.revenuecat.purchases.*
import com.revenuecat.purchases.interfaces.*
import com.revenuecat.purchases.models.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/** Release source-set extension. No debug page, local operator permit or fixture authorization. */
object OnlyFastBilling {
    // Independent native hold. A separate reviewed build is required to change it.
    private const val TRANSACTIONS_ENABLED = false
    private const val OFFERING = "onlyfast_monthly_v1"
    private const val SDK_KEY = "goog_xbUbrojeeBtzAsVKDewoXbclzAS" // Public client key only.
    private const val AUTH_URL = "https://thpyjvwtfvfxiufchrxn.supabase.co/auth/v1/user"
    private const val PUBLISHABLE_KEY = "sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv"
    private val origins = setOf("https://onlyfast.app", "https://www.onlyfast.app")
    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private val epoch = AtomicLong(0)
    private val attached = java.util.WeakHashMap<WebView, Boolean>()
    @Volatile private var ownsSdk = false
    @Volatile private var cached: Catalog? = null
    private data class Catalog(val token: String, val user: String, val generation: Long, val expires: Long,
        val packages: Map<String, com.revenuecat.purchases.Package>, val json: JSONObject)

    /** Call on UI thread after Median WebView setup and BEFORE restoreState/loadUrl. */
    @JvmStatic fun attach(activity: Activity, webView: WebView): Boolean {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return false
        if (attached.put(webView, true) != null) return true
        WebViewCompat.addWebMessageListener(webView, "onlyFastBilling", origins) { _, message, origin, mainFrame, reply ->
            if (!mainFrame || origin.toString() !in origins || !allowedPage(webView)) return@addWebMessageListener
            val request = try { JSONObject(message.data ?: "") } catch (_: Exception) { return@addWebMessageListener }
            val id = request.optString("requestId")
            if (!id.matches(Regex("[a-zA-Z0-9-]{1,80}"))) return@addWebMessageListener
            fun send(result: JSONObject) = activity.runOnUiThread {
                if (!activity.isDestroyed && allowedPage(webView)) reply.postMessage(JSONObject().put("requestId", id).put("result", result).toString())
            }
            if (request.optInt("protocolVersion") != 1) { send(failure("PROTOCOL", "Update the OnlyFast billing client.")); return@addWebMessageListener }
            val operation = request.optString("operation")
            if (operation == "capabilities") {
                send(result("ok").put("platform", "android").put("transactionsEnabled", TRANSACTIONS_ENABLED)); return@addWebMessageListener
            }
            if (operation == "invalidate") {
                epoch.incrementAndGet(); cached = null
                send(result("ok")); return@addWebMessageListener
            }
            if (operation !in setOf("identify", "catalog", "purchase", "restore", "clear")) {
                send(failure("OPERATION", "Unsupported billing operation.")); return@addWebMessageListener
            }
            // Refuse before Auth, SDK or Play Billing calls while held.
            if (operation in setOf("purchase", "restore") && !TRANSACTIONS_ENABLED) {
                send(failure("NOT_RELEASED", "Native transactions are not enabled in this binary.")); return@addWebMessageListener
            }
            if (!busy.compareAndSet(false, true)) { send(failure("BUSY", "A native billing request is already running.")); return@addWebMessageListener }
            val generation = epoch.get()
            val completed = AtomicBoolean(false)
            fun finish(value: JSONObject) {
                if (!completed.compareAndSet(false, true)) return
                busy.set(false)
                send(if (epoch.get() == generation) value else failure("ACCOUNT_CHANGED", "Your account changed. Refresh from the purchasing account."))
            }
            fun current(): Boolean = epoch.get() == generation && !activity.isDestroyed && allowedPage(webView)
            fun sdkError(error: PurchasesError, cancelled: Boolean = false) {
                val status = if (cancelled || error.code == PurchasesErrorCode.PurchaseCancelledError) "cancelled"
                    else if (error.code == PurchasesErrorCode.PaymentPendingError) "pending" else "error"
                finish(result(status).put("code", error.code.name).put("message", error.message))
            }
            if (operation == "clear") {
                cached = null
                if (!ownsSdk || !Purchases.isConfigured || Purchases.sharedInstance.isAnonymous) { finish(result("ok")); return@addWebMessageListener }
                try { Purchases.sharedInstance.logOut(object : ReceiveCustomerInfoCallback {
                    override fun onReceived(customerInfo: CustomerInfo) = finish(result("ok"))
                    override fun onError(error: PurchasesError) = sdkError(error)
                }) } catch (_: Exception) { finish(failure("IDENTITY", "Native identity could not be cleared. Close and reopen OnlyFast.")) }
                return@addWebMessageListener
            }
            worker.execute {
                try {
                    val user = authenticate(request)
                    activity.runOnUiThread {
                        if (!current()) { finish(failure("ACCOUNT_CHANGED", "Your account changed.")); return@runOnUiThread }
                        ensureIdentity(activity, user, { error -> sdkError(error) }, { message -> finish(failure("IDENTITY", message)) }) {
                            if (!current() || Purchases.sharedInstance.isAnonymous || Purchases.sharedInstance.appUserID != user) {
                                finish(failure("IDENTITY", "Native identity does not match your session.")); return@ensureIdentity
                            }
                            if (operation == "identify") { finish(result("ok", user)); return@ensureIdentity }
                            if (request.optString("offeringIdentifier") != OFFERING) { finish(failure("OFFERING", "Only the named OnlyFast offering is supported.")); return@ensureIdentity }
                            if (operation == "catalog") {
                                Purchases.sharedInstance.getOfferings(object : ReceiveOfferingsCallback {
                                    override fun onReceived(offerings: Offerings) {
                                        try {
                                            check(current() && Purchases.sharedInstance.appUserID == user && !Purchases.sharedInstance.isAnonymous) { "Account changed" }
                                            val offering = offerings.getOffering(OFFERING) ?: error("The named offering is unavailable in this store.")
                                            val selected = linkedMapOf<String, com.revenuecat.purchases.Package>()
                                            for ((plan, packageId) in mapOf("pro" to "\$rc_monthly", "teams" to "\$rc_custom_teams_monthly")) {
                                                val pack = offering.availablePackages.singleOrNull { it.identifier == packageId } ?: error("The $plan package is unavailable.")
                                                val product = pack.product as? GoogleStoreProduct ?: error("Google Play subscription required.")
                                                check(product.productId == plan && product.basePlanId == plan) { "Unexpected $plan product/base plan." }
                                                check(product.defaultOption != null) { "No eligible subscription option returned." }
                                                selected[plan] = pack
                                            }
                                            val token = UUID.randomUUID().toString()
                                            val expires = System.currentTimeMillis() + 300_000
                                            val payload = JSONObject().put("offeringIdentifier", OFFERING).put("catalogToken", token).put("expiresAt", expires)
                                                .put("packages", JSONArray(selected.map { (plan, pack) -> product(plan, pack) }))
                                            cached = Catalog(token, user, generation, expires, selected, payload)
                                            finish(result("ok", user).put("catalog", payload))
                                        } catch (_: Exception) { finish(failure("CATALOG", "The named Pro/Teams store catalog is incomplete or identity changed.")) }
                                    }
                                    override fun onError(error: PurchasesError) = sdkError(error)
                                })
                            } else {
                                // Revalidate the real Auth session immediately before a transaction.
                                worker.execute {
                                    try {
                                        check(authenticate(request) == user) { "Account changed" }
                                        activity.runOnUiThread {
                                            if (!current() || Purchases.sharedInstance.appUserID != user || Purchases.sharedInstance.isAnonymous) {
                                                finish(failure("ACCOUNT_CHANGED", "Your account changed.")); return@runOnUiThread
                                            }
                                            if (operation == "restore") {
                                                try { Purchases.sharedInstance.restorePurchases(object : ReceiveCustomerInfoCallback {
                                                    override fun onReceived(customerInfo: CustomerInfo) = finish(result("restored", user))
                                                    override fun onError(error: PurchasesError) = sdkError(error)
                                                }) } catch (_: Exception) { finish(failure("RESTORE", "The native store could not start restoration. Close and reopen OnlyFast.")) }
                                            } else {
                                                try {
                                                    val catalog = cached ?: error("Refresh store plans.")
                                                    check(catalog.user == user && catalog.generation == generation && catalog.expires > System.currentTimeMillis() &&
                                                        catalog.token == request.optString("catalogToken")) { "Catalog expired or changed account." }
                                                    val plan = request.optString("plan")
                                                    val pack = catalog.packages[plan] ?: error("Select Pro or Teams.")
                                                    check(pack.identifier == request.optString("packageIdentifier") && pack.product.id == request.optString("productIdentifier")) { "Selected package changed." }
                                                    val option = pack.product.defaultOption ?: error("Subscription option unavailable.")
                                                    // Purchase the exact store-returned option whose phases were shown,
                                                    // retaining the Package's RevenueCat offering attribution.
                                                    val params = PurchaseParams.Builder(activity, option).presentedOfferingContext(pack.presentedOfferingContext).build()
                                                    cached = null // One transaction per catalog; no implicit retry.
                                                    Purchases.sharedInstance.purchase(params, object : PurchaseCallback {
                                                        override fun onCompleted(storeTransaction: StoreTransaction, customerInfo: CustomerInfo) = finish(result("purchased", user))
                                                        override fun onError(error: PurchasesError, userCancelled: Boolean) = sdkError(error, userCancelled)
                                                    })
                                                } catch (_: Exception) { finish(failure("SELECTION", "Store selection expired or mismatched. Refresh plans before trying again.")) }
                                            }
                                        }
                                    } catch (_: Exception) { finish(failure("AUTH", "Sign in again before a store transaction.")) }
                                }
                            }
                        }
                    }
                } catch (_: Exception) { finish(failure("AUTH", "A verified OnlyFast session is required. Check your connection and sign in again.")) }
            }
        }
        return true
    }

    private fun allowedPage(webView: WebView): Boolean = try {
        val uri = android.net.Uri.parse(webView.url ?: "")
        "${uri.scheme}://${uri.authority}" in origins
    } catch (_: Exception) { false }
    private fun result(status: String, user: String? = null) = JSONObject().put("protocolVersion", 1).put("status", status).apply { if (user != null) put("appUserId", user) }
    private fun failure(code: String, message: String) = result("error").put("code", code).put("message", message)
    private fun authenticate(request: JSONObject): String {
        val expected = request.getString("expectedUserId")
        require(expected.matches(Regex("[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}")))
        val token = request.getString("accessToken")
        require(token.isNotBlank() && token.length <= 16384)
        val connection = URL(AUTH_URL).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false; connection.connectTimeout = 8000; connection.readTimeout = 8000
        connection.setRequestProperty("apikey", PUBLISHABLE_KEY)
        connection.setRequestProperty("Authorization", "Bearer $token")
        try {
            check(connection.responseCode == 200)
            val response = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            check(response.getString("id") == expected)
            return expected
        } finally { connection.disconnect() }
    }
    private fun ensureIdentity(activity: Activity, user: String, onError: (PurchasesError) -> Unit, failure: (String) -> Unit, ready: () -> Unit) {
        fun safeReady() { try { ready() } catch (_: Exception) { failure("The native SDK could not start this request. Close and reopen OnlyFast.") } }
        try {
        if (!Purchases.isConfigured) {
            Purchases.configure(PurchasesConfiguration.Builder(activity.applicationContext, SDK_KEY).appUserID(user).build())
            ownsSdk = true; safeReady(); return
        }
        // Do not adopt an anonymously/independently configured Median SDK.
        if (!ownsSdk) { failure("Disable duplicate RevenueCat auto-configuration; the OnlyFast extension must own initialization."); return }
        val sdk = Purchases.sharedInstance
        if (!sdk.isAnonymous && sdk.appUserID == user) { safeReady(); return }
        cached = null
        fun login() = sdk.logIn(user, object : LogInCallback {
            override fun onReceived(customerInfo: CustomerInfo, created: Boolean) = safeReady()
            override fun onError(error: PurchasesError) = onError(error)
        })
        if (sdk.isAnonymous) login() else sdk.logOut(object : ReceiveCustomerInfoCallback {
            override fun onReceived(customerInfo: CustomerInfo) { try { login() } catch (_: Exception) { failure("Native identity could not be updated. Close and reopen OnlyFast.") } }
            override fun onError(error: PurchasesError) = onError(error)
        })
        } catch (_: Exception) { failure("The native SDK could not initialize. Close and reopen OnlyFast.") }
    }
    private fun product(plan: String, pack: com.revenuecat.purchases.Package): JSONObject {
        val product = pack.product
        val option = product.defaultOption ?: error("Store option unavailable")
        return JSONObject().put("plan", plan).put("packageIdentifier", pack.identifier).put("productIdentifier", product.id)
            .put("formattedPrice", product.price.formatted).put("currencyCode", product.price.currencyCode)
            .put("billingPeriod", product.period?.iso8601 ?: error("Subscription period unavailable"))
            .put("optionIdentifier", option.id).put("trialEligibility", "unknown")
            .put("eligibilityNote", "Only Google Play-returned offer phases are shown. Final eligibility and terms are confirmed by Google Play before purchase.")
            .put("pricingPhases", JSONArray(option.pricingPhases.map { phase ->
                JSONObject().put("billingPeriod", phase.billingPeriod.iso8601).put("billingCycleCount", phase.billingCycleCount ?: JSONObject.NULL)
                    .put("recurrenceMode", phase.recurrenceMode.name).put("price", JSONObject().put("formatted", phase.price.formatted)
                        .put("amountMicros", phase.price.amountMicros).put("currencyCode", phase.price.currencyCode))
            }))
    }
}
