# Firebase Analytics integration

Updated November 15, 2026 for develop/onlyfast-2027. See [January carryover and release requirements](FIREBASE_ANALYTICS_2027_CARRYOVER.md) for current build isolation, launch steps and verification results.

The earlier implementation was recovered selectively from the preserved main stash. No stash, existing branch, backup or unrelated advertising work was removed. No commit, push, deployment or remote service configuration change was performed by this task.

## Architecture and startup

- src/main.tsx starts the central service before choosing the ordinary application, the 2027 permission preview, or the isolated testing app.
- src/App.tsx mounts AnalyticsLifecycle to observe existing Supabase auth and major routes. It does not replace Supabase or initialize Firebase Authentication.
- src/lib/analytics.ts is the sole component entry point for consent, identity, properties, events and platform routing. Trusted membership notifications update the current tier.
- analyticsController.ts holds the SDK-independent master/consent gate, allowlisted events/fields, bounded pending events (30), recent operation keys (256), and screen deduplication.
- analyticsWeb.ts lazy-loads Firebase app/analytics only after complete configuration, explicit permission and a supported browser. isSupported() is checked before initialization, and consent/native evidence is checked again after async work. The named Firebase app and one initialization attempt prevent duplicate setup. Server rendering never initializes Analytics.
- analyticsNative.ts waits for the existing chained median_library_ready() callback, validates deviceInfo() app identity/platform, then uses Median's documented Firebase plugin. A missing native plugin never falls back to web Firebase. No Gradle, iOS initialization or native SDK sources are changed.
- useAnalyticsVisibility observes existing house creatives and the Assist section without changing ad eligibility, placement, navigation or timing.

All analytics calls return immediately; SDK failures cannot block saves, timing scans, navigation or checkout. Events before consent are dropped. Pending events are bounded and discarded on denied consent or account changes; there is no polling or unbounded retry queue.

## Configuration and privacy

This is a Vite/React checkout. The supplied Firebase public identifiers are in the root .env.example as VITE_FIREBASE_* fields; NEXT_PUBLIC_* does not expose them in this build. Existing local and remote environment values were not overwritten.

VITE_ANALYTICS_ENABLED=true is required for an authorized release, along with explicit analytics consent and every config field. Isolated 2027 Preview builds deny collection even if the enable flag is inherited. They retain their restrictive CSP and separate consent storage. Production and Preview settings must not be treated as interchangeable.

The cookie notice has a separate Allow Analytics action. Accept Essential and Decline Optional decline analytics. AnalyticsPrivacyControl in Settings, the public Privacy Policy and the privacy modal allows later withdrawal. Login, signup, essential-cookie choices and advertising choices never imply analytics permission. Advertising storage, user data and personalization consent remain denied independently.

Web identity uses the current Supabase UUID and setUserId(null) on logout. Known class/discipline and trusted current tier properties are updated and cleared across accounts. Native UUID identification is withheld because Median documents no supported identity reset: this integration never calls native setUser. Signed-out native collection is disabled after a signed-in session, and later account properties are refreshed before collection resumes. Verify no older custom script assigns native IDs before enabling collection.

## Event trigger inventory

All entries below are gated by the master switch and analytics consent. Optional
context comes from the current trusted tier (`rookie`, `sportsman`, `pro`, `team`, `factory`, `unsubscribed`), known class
registry, and discipline (`dirt_oval`, `pavement_oval`, `road_course`, or existing
registry identifiers). Custom car descriptions and arbitrary class names are not
sent. No setup values, notes, names, emails, tokens, prompts, AI answers, GPS,
screenshots, lap values, schedule locations, or payment fields are sent.

| Event | Exact trigger location and condition |
| --- | --- |
| `onboarding_started` | `OnboardingFlow.tsx` mount effect; once per mounted attempt |
| `onboarding_step_completed` | `OnboardingFlow.advance`: successful forward progress save for steps 2/3; `AppLayout.handleCarSelect`: confirmed completion for step 4 |
| `racing_discipline_selected` | `OnboardingFlow.advance`: successful discipline-to-car transition, registry discipline key |
| `car_class_selected` | `OnboardingFlow.advance`: successful car-to-plan transition, actual class key |
| `subscription_plan_selected` | `PlanSelection.handleContinue` for Rookie; paid web `onSelect`; native `useNativeSubscription.run` after purchase guards pass |
| `onboarding_complete` | `AppLayout.handleCarSelect`: after `completeRacingOnboarding` succeeds and current account still matches |
| `onboarding_abandoned` | `OnboardingFlow`: pagehide or real unmount while incomplete; per-attempt deduplication and StrictMode cleanup guard |
| `race_setup_saved` | `SetupDashboard.performSave`: persisted rows with no queued failures; `CreateBaseSetupView.handleSave`: successful `dbWrite` |
| `race_setup_created` | Same successful save points when the saved workspace/template has no previous IDs |
| `race_setup_updated` | Same successful save points when editing an existing saved workspace/template |
| `race_setup_opened` | `SetupDashboard.handleLoadSetup`: after hydration; `CreateBaseSetupView.handleEdit`: after template hydration |
| `race_setup_shared` | `ShareSetupModal.handleCopyCode`: successful clipboard write or confirmed fallback copy; generating a code alone does not count |
| `setup_assist_opened` | `HandlingFeedback` visibility observer: existing Assist section at least 50% visible in foreground |
| `setup_assist_requested` | `HandlingFeedback.getSuggestions` and `askWhatIf`: after existing gate/auth checks, immediately before invocation |
| `setup_assist_completed` | Same handlers: nonempty successful suggestion, deduplicated by existing request ID (ID stays local) |
| `setup_assist_failed` | Same handlers: service error, empty response, or thrown request failure |
| `setup_assist_limit_reached` | Same handlers: server 429 quota response; no quota/gating behavior changed |
| `timing_scan_opened` | `ScanTimingScreen` mount effect, protected against duplicate effect execution |
| `timing_scan_started` | `ScanTimingScreen.processBatchImage`: one actual image-processing attempt, including retries |
| `timing_scan_completed` | Same function: successful parsed result |
| `timing_scan_failed` | Same function: validation/compression/OCR/request failure |
| `race_schedule_opened` | `SetupDashboard` existing `activeView` effect when entering `schedule` |
| `race_schedule_added` | `RaceSchedule.handleSave`: successful insert |
| `race_schedule_updated` | `RaceSchedule.handleSave`: successful update |
| `race_schedule_exported` | `RaceScheduleExport.handleDownload`: download handed to browser; `handleShare`: native share Promise resolves |
| `upgrade_viewed` | `Upgrade` mount effect, protected against duplicate effect execution |
| `upgrade_started` | `useNativeSubscription.run`: immediately before existing native purchase call after auth, tier, and purchase-hold checks |
| `upgrade_cancelled` | Same hook: current-generation `NativePurchaseError.cancelled` only |
| `house_upgrade_ad_viewed` | `RookieHouseAdContent` visibility observer on existing creative, once per mount |
| `house_upgrade_ad_clicked` | `RookieHouseAdContent.handleUpgrade`, before existing navigation |

Timing counts are **per image/request**, with `number_of_images: 1` and the existing
session type (`base`, `heat`, `main`, `extra1`, `extra2`, `extra3`). Multi-image
batching, merging and retry behavior remain unchanged. Setup-save events exclude
offline-queued/partial/failed saves and background queue replay. Download events
confirm browser handoff, not a filesystem write. Copy events do not prove a
recipient opened a share. Browser termination can lose abandonment events; use
started-without-complete funnels as well, with an appropriate analysis window.

Web Stripe Buy Buttons encapsulate checkout and do not expose a reviewed start or
cancel callback here, so `upgrade_started`/`upgrade_cancelled` cover native
checkout only. Neither effective paid access nor a returned checkout page is
treated as a new activation. Advertising/purchasing holds remain unchanged.


## Screen tracking

React Router paths and the existing dashboard activeView drive Dashboard, Setup Notebook, Race Schedule, Parts Reference, Subscription, Settings, Onboarding and Timing Scan. Setup Assist is observed when its existing section becomes visible. The new /track-trace route records only the Track Trace screen name, never GPS or trace contents.

Consecutive identical screen names are suppressed, and temporary Settings/Timing Scan/Assist screens restore the preceding screen if navigation has not already moved elsewhere. Web automatic initial page_view is disabled and page location/referrer/title use safe app constants. Review Enhanced Measurement's history/page/form tracking in Firebase/GA4 before launch. Native manual screens remain off until automatic screen reporting has been checked for duplicates.

## Intentional holds

- Native user ID: no supported reset is documented, so native UUID assignment stays withheld.
- subscription_activated: effective paid access is not proof of a new purchase. Connect a reviewed authoritative, deduplicatable RevenueCat entitlement-transition source before enabling activation events.
- ad_impression: a display command is not a confirmed impression. No custom impression event is emitted without a supported callback; AdMob/Firebase SDK reporting stays separate.
- VITE_ANALYTICS_NATIVE_MANUAL_SCREENS remains false until physical-device review.
- Advertising/purchasing activation flags and current 2027 production-deployment guards are unchanged.

## Validation and January release

Run npm test and npm run analytics:check. The additional --release checker requires VITE_ANALYTICS_ENABLED=true and complete Firebase configuration, without sending network requests or deploying anything. See FIREBASE_ANALYTICS_2027_CARRYOVER.md for all launch prerequisites and current test/build results.

After an authorized release configuration, grant consent through the UI and verify browser event names/parameters in Firebase DebugView with development debug mode enabled. Test denied/withdrawn consent, blocked SDK/storage, missing configuration, login/logout/account switching and tier changes. Repeat feature flows with successful/failed/queued saves, Assist quota failures and multi-image OCR retries. Verify one screen visit does not duplicate.

Rebuild through Median with the uploaded service files and the Firebase plugin enabled. Set default consent to Deny before the native SDK starts; runtime JavaScript cannot stop events before bridge readiness. On a physical Android test device enable DebugView with adb shell setprop debug.firebase.analytics.app app.onlyfast (confirm the actual package ID), and disable afterward with .none. For iOS use an authorized Median debug build with -FIRDebugEnabled, then -FIRDebugDisabled. Do not add SDK installation or initialization code.

Native SDK delivery and Firebase Console reports remain unverified until tested on the actual built apps. After DebugView checks, disable debug reporting and inspect ordinary Realtime reports with the correct stream/device filters. Register coarse custom dimensions and review retention/Google Signals/advertising links before release.

References: [Median Firebase Analytics](https://docs.median.co/docs/firebase-analytics), [Firebase Analytics reference](https://firebase.google.com/docs/reference/js/analytics), [DebugView](https://firebase.google.com/docs/analytics/debugview).
