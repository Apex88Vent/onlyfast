# OnlyFast release billing protocol 1

This is an OnlyFast source extension, **not a documented Median API**. The web client requires `window.onlyFastBilling.postMessage(string)` and its `onmessage` callback. Android installs it with AndroidX WebKit before the initial page load. The iOS source adapter installs the same contract with a main-frame document-start WKUserScript and WKScriptMessageHandler; iOS compilation/runtime remain unverified. No fallback to `median.revenueCat.presentPaywall`, the current offering, or `onlyFastCatalog` is allowed.

Every request is JSON with a unique `requestId`, `protocolVersion: 1`, and `operation`. Every response is `{requestId, result: {protocolVersion: 1, status, ...}}`. Ignore malformed/unmatched messages. Tokens must never be logged or persisted by the bridge. The client serializes operations, rejects stale account results, and requires a process restart after a timed-out operation rather than retrying a potentially completed purchase.

| Operation | Input beyond envelope | Result / requirement |
| --- | --- | --- |
| capabilities | none | `status: ok`, `platform: android/ios`, `transactionsEnabled` |
| identify | `expectedUserId`, `accessToken` | Native verifies real Auth session, configures/logs in with that exact UUID, returns `appUserId`. Never configure anonymously. |
| catalog | Same auth, `offeringIdentifier` | Exact named catalog and `appUserId`; never substitute current offering. |
| purchase | Same auth/offering, `plan`, `packageIdentifier`, `productIdentifier`, `catalogToken` | Explicit displayed selection; returns `purchased`, `cancelled`, `pending`, or `error`. |
| restore | Same auth/offering | Explicit user action only; returns `restored` or error. No restore during login. |
| invalidate | none | Immediately invalidates old catalog/callback generation, even during another operation. |
| clear | none | Clear catalog and log out owned SDK identity. Does not restore or transfer purchases. |

Catalog: `offeringIdentifier`, native-generated opaque `catalogToken`, millisecond `expiresAt`, and two `packages`. Each package contains `plan` (`pro` or `teams`), `packageIdentifier`, `productIdentifier`, `formattedPrice`, `currencyCode`, ISO `billingPeriod`, nullable `optionIdentifier`, `pricingPhases`, `trialEligibility`, and `eligibilityNote`.

The iOS adapter also returns actual localized `title` and nullable `introductoryOffer` (payment mode, billing period, number of periods, price, raw eligibility). Only eligible introductory terms enter applicable pricing phases; unknown eligibility stays unknown. Upfront/free introductory periods are aggregated once, while pay-as-you-go retains its cycle count. These extra fields do not change protocol version 1.

Each phase contains ISO `billingPeriod`, nullable `billingCycleCount`, `recurrenceMode`, and `price: {formatted, amountMicros, currencyCode}`. Preserve actual store responses. Do not fabricate a free trial or infer eligibility from the plan description. A missing price/catalog disables selection. The Android purchase must use the same SDK subscription option whose phases were displayed, with the package's offering attribution.

| Plan | Package | Android product/base plan | iOS product |
| --- | --- | --- | --- |
| Pro | `$rc_monthly` | `pro:pro` | `app.onlyfast.pro.monthly` |
| Teams | `$rc_custom_teams_monthly` | `teams:teams` | `app.onlyfast.teams.monthly` |

Native policy: trusted main-frame HTTPS origins only; fixed public platform SDK key and fixed Auth endpoint/public key; verify Auth UUID again immediately before a transaction; one SDK owner; no arbitrary offering/product/URL/API-key arguments; reject anonymous or mismatched identity. Origin access is not experimental tester authorization. Restricted sandbox builds must independently retain the existing trusted synthetic tester gate.

Android caches selections for five minutes, binds them to the user and identity generation, and consumes a selection when submitting a purchase. Invalidation cannot cancel an already-open Google/Apple transaction; its completion must not grant access to a different signed-in account. Never automatically retry pending, cancelled, failed, or timed-out transactions.

`purchased` / `restored` is a transaction result, **not membership authorization**. The client invokes the existing authenticated `sync-revenuecat-subscription` function, then reloads server-authoritative membership. An HTTP success containing an application error is still a failure. Offline, pending, or expired access must not be replaced with client entitlement claims.

Web `NATIVE_PURCHASES_READY`, Android `TRANSACTIONS_ENABLED`, and iOS `transactionsEnabled` remain false. The existing generic Median plugin remains installed for compatibility, but OnlyFast does not call its configure/paywall/purchase/restore APIs. The iOS adapter refuses an already configured SDK it does not own, observes customerInfoStream without replacing Median's delegate, and emits only a payload-free subscription-updated event. This protocol's native hold covers this extension; it does not remove vendor APIs from the binary.
