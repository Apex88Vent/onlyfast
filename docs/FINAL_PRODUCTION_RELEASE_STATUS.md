# OnlyFast production release checkpoint — October 30, 2026 (Pacific)

## Current production launch — final authorization executed

The owner explicitly authorized public release and deployment on October 30, superseding
the general hold below. **Vercel DEPLOYED**: [onlyfast.app](https://onlyfast.app), code
commit `f83e685f7421de07d3127a27dde61dbd00553dac`, deployment
`dpl_8US34EM21Xyg7WhT9bJQSQDJngZW` (READY). The canonical alias was independently
read back to this deployment and its served bundle inspected.

- Android stock purchase/restore flow enabled in production; Google native release
  **1.0.2 (61)** still requires manual Play upload/declarations/submission. A concise
  upload request was sent to the owner; no upload or rollout is claimed.
- RevenueCat **ACTIVE**, based on the owner's independently verified current offering
  `onlyfast_monthly_v1`; no offering write or repeated configuration audit was performed.
- iOS public purchase gate remains off pending Apple submission/reviewer readiness.
  Build **1.0.2 (59)** and draft are prepared; real screenshot, reviewer access,
  agreement/tax status, build association and joint app/product submission remain.
  Do not submit the production-URL app while the reviewer is still gated from its paywall.
- AdMob master **false** until mandatory consent/privacy readiness. Rookie house
  promotions remain enabled independently; Pro/Teams remain ad-free. iOS's last
  confirmed AdMob state is limited/requires verification, not resolved.
- Existing Stripe, server verification/sandbox policy, memberships and customer purchases
  were not changed. No store transaction, native rebuild, Chrome automation or new QA
  infrastructure was performed. The existing isolated QA entry remains origin/account/
  backend/action gated and excluded from production, independently of the public rollout.

Production flags read back: `VITE_REVENUECAT_ENABLED=true`,
`VITE_REVENUECAT_ANDROID_ENABLED=true`, `VITE_REVENUECAT_IOS_ENABLED=false`,
`VITE_MEDIAN_ADMOB_ENABLED=false`, diagnostics still false. Existing SDK key assignments
were retained. Live bundle gates match. Homepage, Privacy, Terms and app-ads.txt HTTP 200;
no forbidden QA endpoints/identities in the served bundle. SHA-256 main JS:
`736cd05663da6e447ff6d8d532656c56901c44ae8f7914911df74eee25b6d517`.
Verification evidence: `tmp/final-production-release/live-f83e685f/verification.json`.

Targeted activation checks: **39 unit/contract + 9 mounted subscription-control tests
passed**, TypeScript/scoped ESLint passed, local production-output validation passed
(64 files), Vercel build READY. The mounted-test runtime was restored in its existing
external temporary dependency directory after it had been cleaned; no application
dependency or lockfile changed. Earlier accepted purchase/picker results were reused.

## Earlier preparation records — superseded by the launch update above

**Android artifact update — October 30:** newest download `app-bundle (3).aab`
is **1.0.2 (61)**, package `app.onlyfast`. Existing validator passed bundletool,
signature and non-debuggable checks. Certificate matches the prior candidate;
production URL, stock Median RevenueCat and production AdMob configuration passed
archive inspection; no QA/ngrok/localhost application URLs found. Preserved at
`tmp/final-production-release/native/OnlyFast-android-1.0.2-61.aab`, SHA-256
`B9B9105E110163591D63AB55506D31E582D85775158FB7512D82BA60B2A02D41`.
This supersedes the Android 58 / 1.0.0 build-preparation blocker below. Comparison
against **the highest version code uploaded across all Play tracks** remains
unverified; that integer must be below 61. No upload, rebuild or public activation
occurred. **Photo picker: PREVIOUSLY VALIDATED — NO RETEST REQUIRED.** The owner
confirms repeated successful physical-device testing on previous production builds.
Compared with the October 26 working APK, all six native code entries are byte-for-byte
identical; Android permissions, SDK levels and picker-related configuration are unchanged.
The web picker inputs/handlers are unchanged; its containing section only gains a
banner-safety attribute. The earlier emulator crash was not established as an OnlyFast
defect and is not a release blocker. Evidence: `native/photo-picker-comparison.json`
under `tmp/final-production-release/`. No new physical test is claimed or required.

**Release held; no deployment, public purchasing activation, broad live advertising,
public store release, new purchase or customer membership edit.** No push was made.
The earlier October 29 record below is historical and is superseded where noted here.
Completed Vercel/RevenueCat configuration checks were not repeated.

Full store materials, exact links, privacy worksheet and short device instructions:
[Native submission packet](NATIVE_RELEASE_SUBMISSION_PACKET.md).

Browser-free follow-up: no Chrome automation retried. The local Android 1.0.2
validator is prepared (PowerShell syntax passed), awaiting the manually generated
new AAB and confirmed highest uploaded Play code. No new native artifact was
generated or marked validated. Public activation holds remain unchanged.

### Completed store preparation

- Apple subscription group saved and visually verified: **Teams level 1 / Pro level 2**.
- US monthly prices remain Pro $5 / Teams $8; en-US names/descriptions and a one-week
  introductory trial across all returned territories verified from Apple store state.
- Review notes saved for both products. Both remain **Prepare for Submission**, not
  submitted or approved. Their existing review screenshots are blank placeholders;
  a real native paywall screenshot is required.
- [iOS 1.0.2 draft](https://appstoreconnect.apple.com/apps/6792149373/distribution/ios/version/inflight)
  created, release notes saved, missing Marketing URL set to `https://onlyfast.app`,
  and **manual public release** selected, saved and verified. Build not attached.
- First subscriptions require the app version, group and products in one submission.
  Required remaining evidence: real screenshot, validated reviewer access, current
  Business agreements/tax status, accurate privacy declarations and processed build.
  The production URL still has the public purchase hold, so review access must be
  resolved within an approved deployment/access plan before submitting.

### Native builds

- Android current AAB **58 / 1.0.0** validates with official bundletool. Production
  URL, stock RevenueCat, actual AdMob IDs, signing and disabled automatic banners
  inspected. Next target version name is **1.0.2**, per the owner's instruction;
  a correctly versioned new build is still needed. Public Play baseline observed
  as **34 / 1.0.2**; highest uploaded internal code still needs confirmation.
- iOS production IPA **1.0.2 (59)** generated and downloaded from the original
  licensed Median project. Embedded production URL, stock RevenueCat, real iOS IDs,
  ATT purpose/manual consent configuration, photo/camera purpose strings and privacy
  manifests inspected. No QA tunnel configuration or custom billing bridge selected.
  Signature files/provisioning profile are present; Apple processing acceptance is
  not established by archive inspection. Median's lingering OUTDATED label was not
  treated as a reason for repeated builds. No new upload or submission was made.
- Artifact paths/hashes and evidence are in the submission packet and
  `tmp/final-production-release/native/`. Android picker acceptance is carried forward
  as previously validated, with no retest required. Remaining iPhone acceptance is
  **unverified**. No successful Pro purchase was repeated.

### Advertising and privacy

- Android AdMob UI: **Ready / ad serving enabled**. Native consent/release acceptance
  still pending; this is not broad-ad launch readiness.
- iOS: **Requires review / limited ad serving / verify app**. Correct app association
  and publisher IDs verified previously in this preparation. Production app-ads.txt
  currently returns direct HTTPS 200, plain text, correct publisher line; robots.txt
  allows crawling. No website file fix is needed.
- Apple's missing Marketing URL was a confirmed association defect. Its correction
  exists only in the held 1.0.2 draft; the public listing and Google recrawl/readiness
  review must follow. **iOS verification and limited serving are not resolved.**
- European consent message is missing. Published US-state message includes Android
  and excludes iOS. Native UMP load/preload gating, persistence and privacy-options
  revocation still require verification. A completed JS consent request is not proof
  of ad authorization. Existing ad controller/cooldown/paid exclusions are unchanged.
- Store “no data collected” declarations need correction for actual account/content,
  subscriptions and SDK processing. IPA includes Google Mobile Ads, UMP and Meta
  mediation frameworks/manifests; active Meta collection needs confirmation before
  certifying the final answers. Local Privacy Policy changes remain undeployed.

### Current local verification and packaging

- `npm run release:check` passed October 30: **64 files**, QA/custom bridge exclusion
  enforced. Main `assets/main-DqlHKRgZ.js`, SHA-256
  `7e81fbf04519fcb4f9d44364216894e09b8626bb1535c840bc0b85bbb564701f`.
- New held archive `tmp/final-production-release/onlyfast-web-held-20261030.zip`,
  SHA-256 `8E89BEE65B33DD3A980689715292503FB9AB83B31B1379ECAE32CC4BA6035E65`.
  Earlier archive retained. Current inventory: `web-build-manifest.json`.
- Six focused existing QA policy/local-sync tests passed. Earlier 482 unit / 75
  mounted/PostgreSQL tests remain valid evidence; no repeat full suite for text-only
  Privacy Policy changes. TypeScript/scoped lint passed after that edit; diff check
  passes. No advertising or purchase architecture was changed in this follow-up.
- Existing QA page responds only on loopback `127.0.0.1:8086` with its QA entry;
  policy fixes its backend to local Supabase. No ngrok/cloudflared process found.
  No QA service/tunnel or production membership data was changed.

### Exact remaining operational blocker

Computer Use stopped during the attempted Play tab switch because it could not
reliably determine Chrome's destination URL for policy enforcement. No further UI
or alternate browser-control route was attempted. This prevents Android rebuilding,
Apple Business inspection/build attachment/submission and remaining consent/privacy
console work this turn. Independent local release materials and verification were
completed. Preserve the single final public activation approval checkpoint.

---

# Historical preparation record — October 29, 2026 (Pacific)

**Release implementation prepared locally; Android and iOS monetization release BLOCKED.**
This is not a launch approval request. The remaining evidence below must be completed
before the single final public billing/advertising approval. No new purchase, restore,
offering switch, deployment, store upload/submission, production schema change or
customer subscription change was performed in this task.

## Code and validation

Primary checkout, `main`, base `bb0053db42b7932eac638398daf64e76d5921776`.
Fetch confirmed `origin/main` matches. The simplification branch
`codex/median-paywall-simplification` is already an ancestor of main; its stock
controller/cancellation/identity fixes need no second merge. Existing uncommitted
advertising work is preserved. The candidate is uncommitted, not a new release SHA.

- Native Pro/Teams cards and house ads now defer prices to the store. Web $5/$8
  plan display and existing Stripe checkout/portal remain unchanged. Actual Google
  US prices are $4.99/$7.99; Apple US prices are $5/$8. No store prices were changed.
- The stock `NativePurchaseController` remains the sole active native purchase
  implementation. Native purchase completion still requires authenticated server
  synchronization and authoritative membership reload. Native flows do not use Stripe.
- Rookie remains free/selectable. Existing one-car, one-base, two-weekend, 48-hour,
  two-monthly-timing and one-Assist-per-weekend limits remain. Pro and Teams retain
  their existing rules; Teams wins when both entitlements are present.
- Preserved advertising changes provide one scrolling Rookie house promotion,
  shared native banner ownership, overlay/keyboard/safe-layout suppression and the
  shared 600-second manual-save/Assist-dismissal cooldown. Paid/admin/ad-free users
  remain excluded. Device rendering and native consent behavior are separate gates.
- Advertising tester controls/logging are unavailable in production advertising mode.
  Native transaction QA and React preview modules are excluded from production chunks.
  Three static preview HTML files were moved intact from `public/` to `qa/previews/`.
  Historical custom native sources remain available but absent from the built graph.
- `.vercelignore` excludes local QA, temporary files, native history, tests, docs,
  environment files and logs from source deployments. Nothing was uploaded.
- `npm run release:check` builds and verifies the actual module graph and all 64
  output files. It rejects custom purchase adapters, QA endpoints/tester IDs,
  previews/source maps, local/other backend targets, diagnostic logging, wrong-store
  enabled SDK keys and live-ad mode without production deployment provenance.

Validation: **482 unit tests passed**, **75 mounted React/disposable PostgreSQL tests
passed**, no failures or skips. Final focused checks: **57 passed**. Application and
tooling TypeScript, scoped ESLint and `git diff --check` passed. The build retains the
existing large-chunk warning; broad lint cleanup was not attempted. No successful
sandbox purchase was repeated. Automated native mocks do not prove device behavior.

Local web artifact: `dist/`; its complete SHA-256 inventory is
`tmp/final-production-release/web-build-manifest.json`. Main chunk:
`assets/main-DUFrBeWP.js`, SHA-256
`63b39ad94c0b1c77b8fb782fe79e9c63ea1414c2abfde3a724cc12d63c2b4fa0`.
This build has purchases disabled, ads disabled, diagnostics disabled, the production
Supabase fallback, local build provenance and ordinary web Stripe behavior. It is a
held web candidate, not a native AAB/IPA or an activated deployment.
An archive is saved at `tmp/final-production-release/onlyfast-web-held-20261029.zip`,
SHA-256 `570C2FE387509534F413B1CA6F5E5D2E40146AEECD606C2F937233EF6F435A2D`.

## RevenueCat and subscription evidence

Live project: `proj79983fe3`. Both store apps are `app.onlyfast`, with their respective
store credentials configured. Production public SDK keys exist for the correct apps
(`appl_` for iOS; `goog_` for Android). After the owner completed Vercel team authorization,
both production Vercel SDK key assignments were compared directly against RevenueCat's
respective production public keys and **match exactly**. No key was changed or printed.

[Offering onlyfast_monthly_v1](https://app.revenuecat.com/projects/79983fe3/product-catalog/offerings/ofrng35794ca3b5)
has the correct Pro/Teams packages and both store products. Its
[paywall](https://app.revenuecat.com/projects/79983fe3/paywalls/pw3a65004212ef4af8/builder)
is published (published October 18; returned revision 12). The global current offering
is still `default`; the named offering is **not current**. No active targeting rules
or running experiments were returned. Neither configuration was changed.

| Store product | Current live store state | US monthly price | Trial |
| --- | --- | --- | --- |
| Apple `app.onlyfast.pro.monthly` | `READY_TO_SUBMIT`, not approved | $5.00 | One week configured |
| Apple `app.onlyfast.teams.monthly` | `READY_TO_SUBMIT`, not approved | $8.00 | One week configured |
| Play `pro:pro` | Base plan `pro` ACTIVE | $4.99 | Active US acquisition offer, seven days |
| Play `teams:teams` | Base plan `teams` ACTIVE | $7.99 | Active US acquisition offer, seven days |

Prices, territory availability and trials were read from live store state, not catalog
metadata. Apple review screenshots exist for both products. Eligibility remains a
store decision. RevenueCat returned an Apple-territory equalization warning for the
two **Play** records; that warning is inconsistent with the returned store type and
does not justify changing Google prices or applying an Apple equalization operation.

iOS tester `5ea2a2af-876a-42bb-84cc-4e4319a90a7e`:

- User-reported TestFlight Pro purchase and Teams change accepted; RevenueCat confirms
  sandbox Pro trial with access and a pending change to Teams.
- Read-only **local QA Supabase** check confirms `pro / active / revenuecat / app_store`,
  product `app.onlyfast.pro.monthly`. Expiration is October 30, 2026, **9:17 PM Pacific**
  (`2026-10-31T04:17:03Z`), matching RevenueCat's current period.
- Teams has not taken effect in the returned subscription. Its entitlement and actual
  Teams UI unlock remain pending. Do not buy again or force a grant to manufacture proof.
- Physical iPhone restore, restart persistence, account-switch isolation, cancellation
  and eventual expiry-to-Rookie are **deferred at the owner's direction**, not passed.
  The owner confirmed performing the purchases and chose to proceed on the assumption
  that the remaining subscription behavior works, addressing issues if encountered.
  Do not request repeated purchases or block implementation/store preparation on these
  deferred checks. The regression suites cover application/server behavior but do not
  establish physical-device results. Store approval, production configuration and native
  advertising/privacy readiness remain separate release requirements.

Android tester `998ee471-0dab-412c-b196-4731c0c46278`: reuse the completed purchase/restore
acceptance. Local QA now shows the expired Play subscription resolved to free, consistent
with expiration. No new Android transaction or restore was requested.

## Production Supabase

Project `thpyjvwtfvfxiufchrxn` is ACTIVE_HEALTHY. `revenuecat-webhook` and
`sync-revenuecat-subscription` are ACTIVE at version 6. The deployed sync code verifies
the bearer token through Auth and obtains subscriber state server-side. Its shared mapper
rejects sandbox receipts unless an explicit server-only setting enables them; no setting
was changed. Production must keep `REVENUECAT_ALLOW_SANDBOX=false`; the effective deployed
secret value was not independently readable in this audit.

The [production webhook](https://app.revenuecat.com/projects/79983fe3/integrations/webhooks)
targets the correct production function and filters to production events. The expiration
cron `onlyfast-expire-revenuecat` is active every minute. Production has zero recorded
RevenueCat webhook events so far: configured delivery is not proven live delivery. Both
sandbox UUIDs have no production subscription row. Three Stripe subscriptions remain
paid (two active, one trialing); no customer records were modified.

## Android build and Play release

**BLOCKED for this monetization release; the existing app is already publicly listed.**

Read-only local artifact inspection:

| File | Verified facts | Release use |
| --- | --- | --- |
| Downloads `app-release (4).apk` | `app.onlyfast`, versionCode **47**, versionName **1.0.0**, target SDK 36; stock RevenueCat and AdMob assets; production startup URL; correct real Android units; automatic banner false | Existing working APK evidence, not a Play AAB |
| Downloads `app-bundle (1).aab` | October 15 artifact, stock RevenueCat, production URL, **no AdMob configuration** | Do not upload as the final advertising release |

APK SHA-256: `F65E0F6018463D0D89B0D398E1D1BE928BD4E7059C4FD5C17C17350CDA852E7E`.
AAB SHA-256: `B6CDB84C70E71A9F2C6640832255C9BA19F67DA5480C76DBBDC8F5E6B39F66C5`.
Android fields inside an APK do not establish the installed iOS configuration.

No phone is attached over ADB. No fresh native build was generated. Inspect the latest
existing Median AAB and Play track first; reuse it if it has the verified configuration.
Otherwise build from the original licensed project. Choose an unused version code above
the highest uploaded code and 47 (48 only if confirmed unused), retain signing and the
working photo picker, then validate/upload through the existing Play release workflow.
The public Play listing currently reports its last update as August 13; this does not
identify internal-track uploads or the latest Console version code.

## iOS build and App Store release

**BLOCKED; no new production submission was made.** The public app already exists at
[App Store ID 6792149373](https://apps.apple.com/us/app/onlyfast/id6792149373).

Existing historical evidence confirms the original licensed Median configuration was
restored after QA; the October 28 AdMob report describes a signed production-URL 1.0.2
IPA and an unresolved Median OUTDATED label. No IPA is available locally to independently
verify its embedded configuration or build number in this task. The TestFlight QA binary
with an ngrok startup URL must never be selected for production.

Verify the original project's latest configuration, signed IPA, production URL, stock
RevenueCat, real iOS AdMob IDs, manual consent and signing; compare against App Store
Connect before assigning an unused production version/build. Resolve Median's status
discrepancy or use a verified new build. Attach the first auto-renewable subscriptions,
subscription group and production app version to the same submission as required by
[Apple's submission procedure](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/).
TestFlight approval is not subscription or public App Store approval. Keep manual public
release control until the final launch checkpoint is approved.

## Advertising and store disclosures

| Native setting | Android | iOS |
| --- | --- | --- |
| AdMob app ID | `ca-app-pub-9431443509195212~9777574822` | `ca-app-pub-9431443509195212~1722134918` |
| Banner | `ca-app-pub-9431443509195212/7957756928` | `ca-app-pub-9431443509195212/7067841263` |
| Interstitial | `ca-app-pub-9431443509195212/8022851471` | `ca-app-pub-9431443509195212/5469808233` |
| Evidence | IDs verified in latest local APK; owner confirmed Test Ad banner/manual-save interstitial | Real IDs recorded in prior original-project review; no physical iPhone ad verification |

No sample units were introduced. Android remains ready only for its existing restricted
test rollout. iOS is not advertising-ready: register a test device, verify banners and
interstitials with Test Ad labels, resolve AdMob readiness/app-ads.txt review, and verify
native UMP loading/preload order plus the required privacy-options/revocation flow.
Website dispatch cannot prove an impression or native consent compliance. Do not generate
unregistered live impressions to test readiness.

The live `/app-ads.txt` returns HTTP 200 with the correct Google publisher line. Terms
and Privacy return HTTP 200. This does not establish AdMob crawler acceptance. Previous
AdMob evidence reports iOS limited serving/app-ads.txt mismatch; current console status
could not be rechecked. Android unrestricted serving/policy status also needs confirmation.

Both public store listings currently claim no data collection (Google also no sharing).
These must be reviewed against actual account, upload, subscription and native advertising
practices before the monetization release. Do not submit guessed privacy declarations.
Sources: [Apple listing](https://apps.apple.com/us/app/onlyfast/id6792149373),
[Google listing](https://play.google.com/store/apps/details?id=app.onlyfast).

## One consolidated final launch approval — still pending prerequisites

Do not execute this table yet. Complete the store/build, native advertising/privacy
and production configuration checks above, carry forward the owner's deferred iPhone
subscription checks as an explicit limitation, then present the final versions/statuses
together for the owner's single approval.

| Setting/action | Current verified state | Reviewed launch action |
| --- | --- | --- |
| RevenueCat current offering | `default` (`ofrng9c4268b9bb`) | Set existing `onlyfast_monthly_v1` (`ofrng35794ca3b5`) current; preserve mappings and subscriptions |
| `NATIVE_PURCHASES_READY` | **false** in source | Reviewed **true** change only when required store products are available and activation is approved |
| `VITE_REVENUECAT_ENABLED` | Absent from production Vercel configuration; local candidate false | Production **true** with the correct existing public platform keys |
| `VITE_REVENUECAT_ANDROID_API_KEY` / `VITE_REVENUECAT_IOS_API_KEY` | Both production Vercel values match their respective RevenueCat production SDK keys exactly | Retain these verified assignments; never use Test Store or REST keys |
| `VITE_MEDIAN_ADMOB_ENABLED` | Production **true** for the existing restricted test rollout; local candidate false | Retain master switch only with the reviewed ad mode and native privacy readiness |
| `VITE_MEDIAN_ADMOB_MODE` | Absent in production configuration; candidate defaults to restricted **test** | **production** only in the approved production deployment |
| `VITE_MEDIAN_ADMOB_DIAGNOSTICS` | Production changed from **true** to **false** and read back successfully; local candidate false | Retain **false** for the release build; existing deployed JavaScript changes only after a new deployment |
| `VERCEL_ENV` | Local build `local` provenance | Vercel-supplied **production**, canonical origin `https://onlyfast.app` |
| `REVENUECAT_ALLOW_SANDBOX` | No change; server defaults false; effective secret unverified | Keep **false**, never enable for production |
| Native startup URLs | Android artifact verified; iOS candidate verification pending | Both `https://onlyfast.app?nativeApp=true`, no QA/tunnel URL |
| Store releases | No new submission | Release verified, approved native builds in the agreed order; do not expose unavailable checkout |

Risk to existing users: new production ads affect eligible Rookie users; paid, admin and
ad-free grants must remain excluded. Stripe users retain their existing billing and are
blocked from duplicate native purchases. Changing the global offering affects all SDK
users without a customer override. Do not edit subscription rows or transfer/restore
policies. Save current deployment/offering identities and use flags/previous web artifact
for rollback; never roll back customer data or completed store transactions.

## Access blockers, submissions and cleanup

Computer Use halted because it could not determine Chrome's URL reliably enough to
enforce policy. No browser automation continued. Median/Play/App Store/AdMob lack a
sufficient connected interface here for the remaining native builds and submissions.
Vercel team authorization is now complete and the previous 403 is resolved. Read-only
inspection confirms project `prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR` in team
`team_smopqnOs6cFIL3nxEZ7O9O7Z`. The canonical `onlyfast.app` alias still targets READY
production deployment `dpl_7ciuL157WXDmuUUJuPAVZ9Qh8feA`, commit
`fec41a9cf26befed779a360ccd1cb7f7552cdff3`, in `Apex88Vent/onlyfast` on `main`.
The prepared candidate has not been deployed. The returned production environment
inventory has zero hidden entries; billing enable and broad live-ad mode are absent,
the existing test-ad master is true, and both SDK keys match RevenueCat. Diagnostic
logging was found true and changed to false for future production builds, then verified
by a separate read. This is the only remote setting changed; no deployment, alias,
purchase enablement or broad live-ad activation occurred. Project settings
describe future builds; they do not by themselves prove the contents of an existing
deployment's bundle.

Verified [current deployment](https://vercel.com/apex88vents-projects/onlyfast/7ciuL157WXDmuUUJuPAVZ9Qh8feA).
The fresh authorization resolves Vercel inspection access only; the final public
billing/live-ad approval remains outstanding.

**No new submission URLs exist.** Review destinations, not submission confirmations:
[original licensed Median project](https://median.co/app/dcxfmcnr5b5jv3fh0zcj3cqj5c),
[App Store Connect app](https://appstoreconnect.apple.com/apps/6792149373),
[RevenueCat products](https://app.revenuecat.com/projects/79983fe3/product-catalog/offerings/ofrng35794ca3b5).
The exact Play Console app/submission URL was unavailable and is not invented.

Historical branches/worktrees/backups, private QA evidence and remaining iPhone QA
services/credentials were preserved. Revoke temporary credentials and retire tunnels
only after the remaining device acceptance and both public releases are verified, as
requested. QA/custom bridge material is excluded from this web release output. Native
binary exclusion, both final startup URLs and post-release cleanup still require final
artifact/device evidence.
