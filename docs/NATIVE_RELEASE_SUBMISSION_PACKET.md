# OnlyFast native submission packet — October 30, 2026 (Pacific)

**Launch update:** the owner authorized public release October 30. The prepared web
candidate plus Android stock billing activation is now deployed at onlyfast.app
(code `f83e685f`, deployment `dpl_8US34EM21Xyg7WhT9bJQSQDJngZW`). iOS public billing
and third-party AdMob remain gated for unresolved Apple/privacy readiness; house
promotions remain available. No store submission, customer membership edit, new
purchase or production database change occurred. The earlier hold/approval wording
below is historical and does not require renewed approval of authorized release work.
Use the original licensed [Median project](https://median.co/app/dcxfmcnr5b5jv3fh0zcj3cqj5c).
Keep stock RevenueCat and the existing advertising controller. Historical native
bridges and development backups remain untouched.

## Apple submission

[iOS 1.0.2 draft](https://appstoreconnect.apple.com/apps/6792149373/distribution/ios/version/inflight)
was created. Release notes and Marketing URL `https://onlyfast.app` were saved.
**Manually release this version** was selected, saved and visually verified.
This is a draft, not an Apple submission or approval. Build 59 has not been uploaded
or selected in this draft during this task.

[Subscription group](https://appstoreconnect.apple.com/apps/6792149373/distribution/subscription-groups/22485557)
now has **Teams level 1; Pro level 2**, saved and verified in the group table.

| Product | Apple ID | US/month | Localization | Introductory offer | Status |
| --- | --- | --- | --- | --- | --- |
| `app.onlyfast.pro.monthly` | 6823703673 | $5.00 | en-US, OnlyFast Pro; “Unlimited setups, timing and premium racing tools” | One week; all returned territory flags true | Prepare for Submission |
| `app.onlyfast.teams.monthly` | 6823703691 | $8.00 | en-US, OnlyFast Teams; “All Pro tools plus unlimited cars and classes” | One week; all returned territory flags true | Prepare for Submission |

Both are in OnlyFast Memberships, group 22485557. Prices, availability and offers
were read from the store; no pricing, trial, availability or family-sharing change
was made. Tax category is “Match to parent app”; that does not establish paid-app
agreement or tax-form readiness. Business agreement/tax status still needs inspection.

Review notes were saved on both products. They identify the product, monthly term,
tier benefits, corrected levels, native store pricing and eligibility, stock Median
paywall, restore entry point and server verification. They require sign-in/access
instructions to accompany the app-version submission. Existing app-review credentials
were inherited from the prior app version, but have not been validated for this release.
Do not print or copy these credentials into a public report.

**Confirmed screenshot blocker:** both stored review images are identical 13,815-byte
`SOURCE` files. The live review-information panels show a blank white portrait
placeholder. Their presence does not satisfy meaningful review evidence. Replace
with a genuine iPhone screenshot of the existing native paywall showing Pro and Teams,
store prices/terms, and restore. Do not buy, create a mock paywall, or reuse unrelated
marketing screenshots as purchase-flow evidence.

Minimum owner action: open the existing iPhone TestFlight paywall without purchasing,
capture it, and provide that image for the two subscription review screenshots.
If the isolated QA startup URL is unavailable, restore the existing approved QA
forwarding before the phone test; never replace the production project's startup URL.

Apple explicitly requires this first auto-renewable subscription group to accompany
a new app version. Once the remaining requirements are complete, add **1.0.2 + group
22485557 + both products** to the same draft submission, then submit together while
retaining manual public release. No submission has been sent.

**Review access blocker:** the production URL still serves the existing held release,
and `NATIVE_PURCHASES_READY=false` remains in the candidate. A reviewer must have a
working native purchase path in the submitted app. Uploading a wrapper alone does
not provide that path. Do not submit with instructions that promise an inaccessible
paywall, substitute the QA tunnel binary for the production artifact, or enable
public purchases to manufacture review access. Resolve review access within an
approved deployment/access plan before the final submission.

Release notes saved in the draft:

> Native App Store membership options and purchase management. Updated Rookie
> advertising layouts and privacy information. Existing setup, timing, and racing
> tools are preserved.

Apple procedure: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase

## Native artifacts

Both inspected artifacts contain `app.onlyfast`, production startup URL
`https://onlyfast.app?nativeApp=true`, stock RevenueCat, real platform-specific AdMob
IDs, automatic banners disabled, and web console logging disabled. No QA tunnel or
custom purchase bridge is selected by their inspected configuration.

| Artifact under `tmp/final-production-release/native/` | Result |
| --- | --- |
| `OnlyFast-android-candidate.aab` | versionCode 58, versionName 1.0.0; bundletool validation passed; signed bundle. **Not the final version-name candidate.** |
| `OnlyFast-ios-1.0.2-59.ipa` | bundle version 59, short version 1.0.2; signature files and provisioning profile present; production configuration inspected. Apple signature/processing acceptance is not established by Windows archive inspection. |

SHA-256 Android: `2F891FDAB0C2FE4B2BCA54B2551810EE838B53ADDE01141B914E3D56446E4E35`.
SHA-256 iOS: `9C6CAFAC2D66A8D1B359EAD3E96F026606A99C90D579D09AFFE2BE15A8DC6282`.
Inspection evidence: `android-manifest.xml`, `android-bundle-validation.log`,
`ios-artifact-inspection.json` in the same ignored directory.

Android next version: **1.0.2**, per the owner's established release target. Play
production was observed as code 34 (1.0.2). The final code must exceed the highest
uploaded code across Play tracks, not only production. Median/Play UI access stopped
before that maximum could be checked and before changing the Median version name.
Do not patch the already signed AAB to change its version.

Minimum manual step: original Median project → Android Version Name `1.0.2` → save
and build Android only. Compare its new version code with Play's highest uploaded
code, then validate the new AAB. Do not publish a Play production release.

Browser-free handoff: Play Console → OnlyFast → Test and release → Latest releases
and bundles → record the highest uploaded version code across tracks. In Median,
Build & Download → App Identifiers → Android Version Name `1.0.2` → Save, then the
Android build card → Rebuild → download AAB. Keep package `app.onlyfast`, original
signing and production startup URL unchanged.

Local automatic validation is prepared in
`tmp/final-production-release/Validate-Android-1.0.2.ps1`. Codex runs it with the
new AAB path and the owner's confirmed highest uploaded Play code. It checks package,
version name, strictly greater version code, non-debuggable manifest, official
bundletool validation and JAR signature, then saves a SHA-256 evidence record.
PowerShell syntax validation passed. It has **not** passed a new final AAB: that
artifact still needs the manual Median build. It cannot upload or publish.

### Android photo picker — PREVIOUSLY VALIDATED — NO RETEST REQUIRED

The owner confirms repeated successful physical-device testing on previous production
builds. Acceptance is carried forward to 1.0.2 (61): all six native code entries match
the October 26 working APK byte-for-byte, and Android permissions, min/target SDK levels
and picker-related native configuration are unchanged. The web picker inputs, accepted
image types, camera capture settings and event handlers are unchanged; only the containing
section's banner-safety attribute changed. The earlier emulator crash was not confirmed
as an OnlyFast application defect. It does not create a new acceptance requirement.

Photo picker is removed from outstanding release blockers. No new physical test was
performed or claimed. Evidence: `tmp/final-production-release/native/photo-picker-comparison.json`.

## AdMob verification and identifiers

| Field | Android | iOS |
| --- | --- | --- |
| App ID | `ca-app-pub-9431443509195212~9777574822` | `ca-app-pub-9431443509195212~1722134918` |
| Banner | `ca-app-pub-9431443509195212/7957756928` | `ca-app-pub-9431443509195212/7067841263` |
| Interstitial | `ca-app-pub-9431443509195212/8022851471` | `ca-app-pub-9431443509195212/5469808233` |
| Last verified AdMob UI | Ready / ad serving enabled | Requires review / limited ad serving; verify app |

iOS association is App Store ID **6792149373**. Publisher is **pub-9431443509195212**.
The production HTTPS `/app-ads.txt` returns **200 directly, without a redirect**,
`text/plain`, and exactly the correct Google publisher line:

```text
google.com, pub-9431443509195212, DIRECT, f08c47fec0942fa0
```

Production robots.txt allows all crawlers. No website patch is needed for this file.
Apple's public listing lacks a Developer Website link; the inherited Marketing URL
was blank. It has been corrected in the new iOS draft to `https://onlyfast.app`.
Google uses this store website association to find app-ads.txt. The correction is
**prepared, not public**: the updated listing must become visible before Google can
recrawl/verify it. Then use AdMob Verify app/Check for updates and wait for Google's
readiness review. Do not claim that a saved Apple draft or HTTP 200 clears limited
serving. No second restriction beyond the observed verification/review state has
been established.

Google procedure: https://support.google.com/admob/answer/9363762?hl=en

## Consent and store privacy worksheet

**Not ready for broad ads or certified store disclosures.** Existing web ad logic is
preserved: trusted Rookie only; paid memberships/ad-free grants excluded; safe banner
ownership; house promotions; shared 600-second interstitial cooldown. The frontend
awaits the documented native consent flow, with separate ATT on iOS. Its completion
is intentionally labelled unverified and never interpreted as UMP authorization.

Remaining AdMob console configuration: European regulations message for **both**
apps; existing US-state published message currently assigned to Android only, so
add iOS and verify applicable-region settings. Native ATT is enabled/manual with
a purpose string in the IPA. An optional custom IDFA explainer is not a substitute
for ATT or UMP.

These settings were inspected, not changed. The browser URL-enforcement stop now
prevents further console actions this turn. Owner action: AdMob →
Privacy & messaging → create the European message for both apps with the privacy
policy URL and refusal/manage choices; include iOS in the US-state message. Review
and publish the messages. This does not by itself authorize broad ad activation.

Native acceptance must establish consent update on launch, correct stored choices,
UMP `canRequestAds` gating **before native preload/load**, required privacy-options
entry point and revocation, and appropriate behavior after ATT denial. Median's
published JS bridge documents `request.consent`, but no `canRequestAds` getter or
guaranteed privacy-options presenter. Re-requesting consent from Settings is not
proof of reopening saved choices. Native plugin behavior remains unverified; do
not invent an SDK authorization field or rewrite the ad architecture to hide this.

| Data practice | Store worksheet selection to review | Evidence / remaining decision |
| --- | --- | --- |
| Account email and authenticated UUID | Contact information/email; user identifiers; app functionality/account management; linked to account | Auth/application code |
| Setup notes, driver feedback, timing uploads/images | User content, including photos where uploaded; app functionality; linked to account | Supabase storage/data and OpenAI processing through backend; classify retention/ephemeral handling per actual flow |
| Store purchase/receipt/subscription data and UUID | Purchase history and user identifiers; app functionality; account linkage | Server-authoritative RevenueCat integration; no full payment-card collection by OnlyFast |
| AdMob IP/coarse location, device identifiers, interactions and diagnostics | Appropriate location, device IDs, usage/advertising and diagnostics categories; third-party advertising/analytics/fraud prevention | Google SDK disclosures plus bundled manifests; verify exact SDK/version behavior and linkage before attesting |
| Bundled iOS Meta Audience Network/MetaAdapter | Check active mediation and SDK initialization/collection; include applicable data/tracking declarations | Frameworks and tracking manifest are present; linkage alone does not prove actual collection or permit ignoring the SDK |

Both stores' existing “no data collected” declarations are inconsistent with the
account/upload/subscription application. Complete and save accurate declarations;
do not just mark advertising IDs while omitting the app's own data. Sharing,
required/optional, retention, linkage and tracking questions must follow actual
processing and store definitions. Do not blindly copy every SDK manifest flag into
an assertion about every user. Apple App Privacy / Google Data Safety have not been
updated in this task. The local Privacy Policy revision is prepared but undeployed.

Sources:
- https://developers.google.com/admob/android/privacy/play-data-disclosure
- https://developers.google.com/admob/ios/privacy/data-disclosure
- https://developers.google.com/admob/android/privacy
- https://developers.google.com/admob/ios/privacy
- https://developer.apple.com/app-store/app-privacy-details/

## Remaining iPhone acceptance — no new purchase

Use the existing sandbox Apple ID and designated synthetic OnlyFast account in the
existing QA/TestFlight app, not a production customer or the production-URL wrapper.
No repeat Pro purchase is required or authorized.

1. Sign in to the same QA account, open the native paywall, tap **Restore Purchases**.
   Report success/error and membership after server refresh.
2. Close the app fully, reopen, sign in if required, and report the persisted tier.
3. When the already pending Teams change actually takes effect, use **Refresh
   subscription**. Report Teams membership and access to multiple classes. Do not
   buy again to force activation. Previously recorded effective time: October 30,
   2026, 9:17 PM Pacific; actual store state, not the clock, determines activation.
4. Sign out and use an existing designated Rookie QA account. Confirm it does not
   inherit the paid tier; switch back and refresh the original account.
5. On that Rookie account, open then close the paywall without confirming a purchase.
   Confirm it remains Rookie. No new payment-sheet transaction is needed.

Restore, Teams activation/sync, restart, account isolation and cancellation remain
**unverified**. The earlier Pro purchase/QA synchronization evidence is reused.

QA isolation checks: six existing policy/local-sync tests passed October 30; the QA
server targets only loopback Supabase, denies production origins/private credentials,
requires the exact server-authorized synthetic user, and exposes a small allowlist.
The existing QA page responds on `127.0.0.1:8086`; no production entry is served there.
No ngrok/cloudflared process was found during this check. No tunnel, service or
authentication setting was started or changed. Existing TestFlight remote access
may therefore need the previously approved forwarding restored before phone tests.

## Public launch checkpoint — unchanged

Complete the above build/device/privacy/review requirements first. Then the single
final approval must cover the exact candidate, approved Apple products/app, Play
release, RevenueCat current offering change, purchase hold/enablement, advertising
mode and deployment. Keep sandbox acceptance disabled in production, existing
customer memberships and Stripe billing intact. Do not push: a push can deploy.

Computer Use stopped on the attempted Play tab switch because it could not reliably
determine Chrome's destination URL. No subsequent UI action or alternate UI-control
route was attempted. This prevented the Android rebuild, Apple Business inspection,
build association/submission, and remaining console changes this turn. Independent
local release packaging, public-file inspection and QA policy verification continued.
