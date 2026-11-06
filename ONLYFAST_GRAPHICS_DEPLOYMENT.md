# OnlyFast graphics-only production deployment — complete

**The approved 59-image release is live at [onlyfast.app](https://onlyfast.app).** Production is READY on **`dpl_Hg3P4X38RwebY6hZURdKeLfoyV3R`**. Its HTML, both JavaScript bundles, CSS, logo and other retained files are byte-for-byte identical to the reviewed prior production deployment. The only published application-file differences are **54 image replacements and 5 approved WebP additions**.

Recorded 2026-11-06T00:29:04.039Z (Thursday, November 5, 2026 at 4:29:04 PM PST). This result supersedes the earlier blocked report, retained at [prior release-attempt record](<C:/Users/c_mar/AppData/Local/Temp/onlyfast-graphics-release-xy4frK/graphics-deployment-report-before-resume.md>). No Phase 2C work was started.

## Deployment and rollback identifiers

| Item | Verified result |
| --- | --- |
| Production URL | https://onlyfast.app |
| Production deployment | **dpl_Hg3P4X38RwebY6hZURdKeLfoyV3R — READY, production** |
| Production deployment URL | https://onlyfast-o548cw2ui-apex88vents-projects.vercel.app |
| Verified staging deployment | dpl_6aAbvrLA3ZqYBV5BuKXoEjnFoedr — READY |
| Rollback deployment | **dpl_r6cXZXEWkCGxvwWsbWFLQfhV8xRo — READY and retained** |
| Existing project | prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR / onlyfast |
| Existing team | team_smopqnOs6cFIL3nxEZ7O9O7Z |
| Global project settings | Vite framework and Node 24.x retained; protection settings unchanged |
| Git | Primary `main`, HEAD `3e5440947c8f20d13800f690c8f1aeb0249ac6a8`; no commit, push, branch or Git worktree created |

The previous deployment remains available at https://onlyfast-apo4cl82c-apex88vents-projects.vercel.app. No rollback or database restore was performed.

## JavaScript investigation and safe release method

The original deployment's **260 source file hashes** matched the retained Phase 1 export. The installed Vite 5.4.21, Rollup 4.62.2, TypeScript 5.9.3 and React SWC plugin 3.11.0 versions matched its production lockfile. Source drift and those dependency versions did not explain the remaining JavaScript difference.

An early local build resolved Tailwind's relative content globs from the combined checkout. Building from the isolated production source restored the exact production CSS. The remaining JavaScript differences came from **production build-environment inputs omitted locally**: two public native billing SDK configuration identifiers and native billing master/platform rollout flags. Production's compiled native purchase predicate retains platform gating; the unconfigured local build folded that gating differently. Generated main/lazy chunk hashes and the HTML references then changed as a consequence.

These findings came from parsing the actual served production bundle, comparing literal/compiled expressions and inspecting the corresponding unchanged source. The public identifiers' values are not printed here. No production environment value or billing flag was edited. The trial JavaScript builds were **not deployed**.

The final release uses the owner's preferred method: **reuse the verified current production runtime directly**. Its original HTML, JavaScript and CSS were copied from the measured production artifact without transformation. The approved graphics were replaced/added around those exact files. Therefore this release has **zero JavaScript, CSS or HTML byte differences**, regardless of differences in discarded rebuild hashes.

Vercel received a precompiled static package: **69 published files plus one deployment-only `vercel.json` manifest**. The manifest selects static serving, skips dependency installation and application compilation, and points to the packaged public directory. Its existing SPA rewrite and Git deployment rules were retained exactly. These are per-deployment packaging settings; the project's global Vite/Node settings and environment variables remain unchanged. No QA harness, preview HTML, temporary artifact, database migration, Edge source, historical source tree, secret file or optimization report was uploaded.

The package was staged and authenticated preview checks confirmed identical CSS and both JavaScript responses. The original HTML document was exact; Vercel appended only its standard preview-only toolbar script. Production readback confirms that the ordinary custom-domain HTML has its original exact hash and no such addition. All 70 uploaded source-object hashes were independently verified on both staged and production deployments.

Vercel's preview promotion endpoint rejected the promotion request without changing production. The same verified static-file manifest was then published as a new production-target deployment. No application rebuild occurred in either deployment. No extra application changes were introduced to work around the API response.

## Runtime equality in production

All **10 retained files outside the approved image-change set** match the previous production SHA-256 hashes. This includes the OnlyFast logo, placeholder artwork, robots/advertising text files and track-logo README as well as the runtime files below.

| Unchanged runtime file | Bytes | Identical before/after SHA-256 |
| --- | ---: | --- |
| assets/main-BGO7x460.js | 1,206,853 | `6e2212f17acbf2180fca1b7e033c0f7614b591de353ce5768398b284fa1b685e` |
| assets/main-BxxoOEC8.css | 132,279 | `c5059c9351befec97a34e1ee132cec8519e6821eab2d9795bc45717cfe09afe1` |
| assets/RookieHouseAdContent-dotU1z-W.js | 26,692 | `456d38fa18924987f2cc69b482dde8aed7ac060ed4e0e57132f4a66448ff7a95` |
| index.html | 1,107 | `a6c0583f93590f2ca684356f45c490bf896ceaa13f844c33074537255295d4b9` |

This preserves the reviewed Phase 1 frontend security, class mappings, account/setup behavior, subscriptions, billing, advertising eligibility/controller/cooldown, pricing/copy, OnlyLaps integration, UI layout and styling. No native bridge, purchasing or advertising activation setting was changed. Adding the five approved WebP files does not activate a new interstitial design or controller.

## Original backups and asset quality

The completed checksum verification was reused as instructed; **original backups were not recopied or rehashed during this resume**. No discrepancy in reviewed current assets was found.

- [Full-resolution class-icon originals](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/icons/original-full-resolution-20261105-213500>) — previously verified **48/48** against its manifest; retained unchanged.
- [Advertising originals](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/icons/advertising-originals-20261105-214700>) — previously verified **11/11** against its manifest; retained unchanged.
- All **59 current asset hashes** were checked against the approved Phase 2A/2B records before upload and against the live production responses after release.
- The 48 class icons remain **128×128 PNGs**, with original public filenames, variants and mappings.
- The six advertising PNGs retain their original full-resolution dimensions and the previously verified lossless RGBA equality. They were not resized or recompressed during deployment.
- The five WebPs were added **without modification**, matching their approved original hashes and dimensions.

The original appearance/quality review remains documented in `ONLYFAST_ICON_OPTIMIZATION.md` and `ONLYFAST_AD_GRAPHICS_OPTIMIZATION.md`. Neither report nor its approved graphics was overwritten by unrelated development work.

## Live image and reference verification

Ordinary, non-cache-busted requests to **all 59 approved image URLs** returned HTTP 200, correct image formats and exactly the approved SHA-256 bytes. Decoding verified expected dimensions. PNG signatures and WebP RIFF/WEBP signatures were checked; none of the five WebP URLs returns the old HTML fallback.

| Newly available public WebP | HTTP | Content type | Bytes | Approved hash |
| --- | ---: | --- | ---: | --- |
| /rookie-ads/interstitials/gt3.webp | 200 | image/webp | 58,632 | Match |
| /rookie-ads/interstitials/late-model.webp | 200 | image/webp | 44,856 | Match |
| /rookie-ads/interstitials/sprint-hero.webp | 200 | image/webp | 299,158 | Match |
| /rookie-ads/interstitials/sprint-stylized-light.webp | 200 | image/webp | 202,028 | Match |
| /rookie-ads/interstitials/winged-sprint.webp | 200 | image/webp | 109,508 | Match |

The image responses retain `Cache-Control: public, max-age=0, must-revalidate`. The normal live URLs served the optimized bytes during verification. This is CDN/origin readback evidence; an individual offline or custom-cached native client was not inspected.

All **69 published files** were downloaded and verified against the exact release artifact. HTML references still resolve to the original JavaScript/CSS filenames. Existing class-icon URLs and the five production background mappings were preserved; the additional approved artwork URLs now resolve. No imports, class mappings or fallback rules were edited. SPA entry checks for `/pricing`, `/upgrade`, `/support` and `/reset-password` returned the unchanged HTML document.

## Actual production sizes and savings

These totals sum the actual uncompressed published file bodies measured from production, including code and static assets. They exclude Vercel deployment metadata and HTTP/archive compression, and do not represent universal startup transfer savings.

| Measurement | Previous production | New production |
| --- | ---: | ---: |
| Published file count | 64 | 69 |
| Exact published bytes | **53,043,818** | **16,430,655** |
| Decimal MB | 53.043818 | 16.430655 |
| Class icons | 35,955,778 bytes / 48 files | **602,021 bytes / 48 files** |
| Advertising collection | 15,270,516 bytes / 6 PNGs | **14,011,110 bytes / 6 PNGs + 5 WebPs** |

**Net production saving: 36,613,163 bytes (36.613163 MB), a 69.02% reduction.** This includes the 714,182 bytes added for the five newly published WebPs. The gross icon/PNG replacement saving is 37,327,345 bytes; subtracting those additions gives the actual net saving above.

The earlier 53.77/18.41/16.44 MB local figures described a combined working-tree build. This release uses the actual deployed Phase 1 runtime baseline and measured deployed bytes instead. A user's transfer depends on which images are requested, eligibility, navigation and caching; no live startup-transfer percentage is claimed.

## Production read-only QA

The existing approved external QA configuration and **test@test.com** automation account were used. No credentials, bearer tokens or privileged keys were printed, committed or included in the deployment. Normal Supabase authentication verified the pinned identity; token refresh succeeded and only the automation session was disposed afterward. No account reset or fixture mutation mode was enabled.

| Run | Passed | Failed | Skipped | Authentication |
| --- | ---: | ---: | ---: | --- |
| Before cutover | 7 | 0 | 0 | authenticated_and_verified; local_session_disposed |
| After release | 7 | 0 | 0 | authenticated_and_verified; local_session_disposed |

The checks cover normal authentication, existing owned setup reads, authoritative membership, schedule/share ownership, invalid secure-share-code rejection, provider-free OnlyLaps status, and identity-preserving refresh. Before/after QA inventory is unchanged: **15 saved setups**, all 15 older than 48 hours, **Team entitlement**, **2 shares**, and **0 schedule entries**. No setup was created, edited, deleted, relabeled or reset.

| Other verification | Result |
| --- | --- |
| Existing production QA configuration check | 1 passed, 0 failed |
| Relevant icon/setup and advertising tests | 124 passed, 0 failed |
| Existing local QA smoke | 69 passed, 0 failed, 0 skipped |
| TypeScript app and Node checks | Both passed |
| Static release integrity | 69/69 live files and 70/70 uploaded package objects match |
| Approved images | 59/59 live hashes, signatures, content types and dimensions match |
| Production JavaScript/CSS/HTML | Exact prior production bytes retained |
| SPA routes | 4/4 unchanged entry documents |
| Desktop/mobile asset rendering | Passed: desktop 1440×1000 at DPR 1 and mobile 390×844 at DPR 3; zero broken images |
| Live public welcome page | Passed in both viewports after the splash completed; zero page errors or broken images; no forms submitted |

The live inspection gallery rendered 107 image elements per viewport, covering all 59 assets with repeated icon sizes. Icon displays measured 40/32 CSS pixels on desktop and 40/24 on mobile. Images are fetched from live production; the gallery itself is an ignored local inspection artifact, not an application page. Public welcome-page checks are recorded separately. These are Chromium viewport/density simulations, not native Android/iOS WebView or physical-device tests.

Read-only backend availability checks confirm **Assist v29** and **OCR v24** remain ACTIVE with JWT verification and the same source hashes. Their OPTIONS endpoints returned HTTP 200. These are availability checks, not paid AI/OCR provider executions. Supabase, RLS policies, migrations, Edge Functions, subscription data, RevenueCat and Median were not modified. No live advertising, purchase, paid AI/OCR, customer-data mutation or account reset was triggered.

## Exact 59 image files released

The table is the complete published application-file change list. Every other published application file retained its prior bytes.

| File | Release action | Published bytes |
| --- | --- | ---: |
| public/onlyfast-class-icons/dirt-late-model/dirt-late-model-blue.png | Replaced with approved optimized PNG | 7,772 |
| public/onlyfast-class-icons/dirt-late-model/dirt-late-model-white.png | Replaced with approved optimized PNG | 9,607 |
| public/onlyfast-class-icons/dwarf/dwarf-blue.png | Replaced with approved optimized PNG | 10,360 |
| public/onlyfast-class-icons/dwarf/dwarf-white.png | Replaced with approved optimized PNG | 11,304 |
| public/onlyfast-class-icons/lightning-sprint/lightning-sprint-blue.png | Replaced with approved optimized PNG | 13,058 |
| public/onlyfast-class-icons/lightning-sprint/lightning-sprint-white.png | Replaced with approved optimized PNG | 13,727 |
| public/onlyfast-class-icons/midget/midget-blue.png | Replaced with approved optimized PNG | 10,507 |
| public/onlyfast-class-icons/midget/midget-white.png | Replaced with approved optimized PNG | 11,533 |
| public/onlyfast-class-icons/modified/modified-blue.png | Replaced with approved optimized PNG | 9,911 |
| public/onlyfast-class-icons/modified/modified-white.png | Replaced with approved optimized PNG | 10,748 |
| public/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-blue.png | Replaced with approved optimized PNG | 10,701 |
| public/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-white.png | Replaced with approved optimized PNG | 11,458 |
| public/onlyfast-class-icons/pavement-oval/legends/legends-blue.png | Replaced with approved optimized PNG | 17,827 |
| public/onlyfast-class-icons/pavement-oval/legends/legends-white.png | Replaced with approved optimized PNG | 13,263 |
| public/onlyfast-class-icons/pavement-oval/mini-stock-compact/mini-stock-compact-blue.png | Replaced with approved optimized PNG | 15,694 |
| public/onlyfast-class-icons/pavement-oval/mini-stock-compact/mini-stock-compact-white.png | Replaced with approved optimized PNG | 11,424 |
| public/onlyfast-class-icons/pavement-oval/pavement-late-model/pavement-late-model-blue.png | Replaced with approved optimized PNG | 15,331 |
| public/onlyfast-class-icons/pavement-oval/pavement-late-model/pavement-late-model-white.png | Replaced with approved optimized PNG | 10,872 |
| public/onlyfast-class-icons/pavement-oval/pavement-modified/pavement-modified-blue.png | Replaced with approved optimized PNG | 16,474 |
| public/onlyfast-class-icons/pavement-oval/pavement-modified/pavement-modified-white.png | Replaced with approved optimized PNG | 12,562 |
| public/onlyfast-class-icons/pavement-oval/stock-car-arca/stock-car-arca-blue.png | Replaced with approved optimized PNG | 14,519 |
| public/onlyfast-class-icons/pavement-oval/stock-car-arca/stock-car-arca-white.png | Replaced with approved optimized PNG | 10,653 |
| public/onlyfast-class-icons/pavement-oval/street-stock-sportsman/street-stock-sportsman-blue.png | Replaced with approved optimized PNG | 15,029 |
| public/onlyfast-class-icons/pavement-oval/street-stock-sportsman/street-stock-sportsman-white.png | Replaced with approved optimized PNG | 10,681 |
| public/onlyfast-class-icons/pure-stock/pure-stock-blue.png | Replaced with approved optimized PNG | 9,095 |
| public/onlyfast-class-icons/pure-stock/pure-stock-white.png | Replaced with approved optimized PNG | 10,522 |
| public/onlyfast-class-icons/road-course/go-karts/go-karts-blue.png | Replaced with approved optimized PNG | 15,894 |
| public/onlyfast-class-icons/road-course/go-karts/go-karts-white.png | Replaced with approved optimized PNG | 11,419 |
| public/onlyfast-class-icons/road-course/gt3/gt3-blue.png | Replaced with approved optimized PNG | 15,361 |
| public/onlyfast-class-icons/road-course/gt3/gt3-white.png | Replaced with approved optimized PNG | 12,457 |
| public/onlyfast-class-icons/road-course/gt4/gt4-blue.png | Replaced with approved optimized PNG | 15,611 |
| public/onlyfast-class-icons/road-course/gt4/gt4-white.png | Replaced with approved optimized PNG | 11,742 |
| public/onlyfast-class-icons/road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata-blue.png | Replaced with approved optimized PNG | 15,141 |
| public/onlyfast-class-icons/road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata-white.png | Replaced with approved optimized PNG | 11,657 |
| public/onlyfast-class-icons/road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula-blue.png | Replaced with approved optimized PNG | 13,070 |
| public/onlyfast-class-icons/road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula-white.png | Replaced with approved optimized PNG | 10,191 |
| public/onlyfast-class-icons/road-course/prototypes/prototypes-blue.png | Replaced with approved optimized PNG | 14,416 |
| public/onlyfast-class-icons/road-course/prototypes/prototypes-white.png | Replaced with approved optimized PNG | 11,468 |
| public/onlyfast-class-icons/road-course/touring-car-tcr/touring-car-tcr-blue.png | Replaced with approved optimized PNG | 15,570 |
| public/onlyfast-class-icons/road-course/touring-car-tcr/touring-car-tcr-white.png | Replaced with approved optimized PNG | 12,613 |
| public/onlyfast-class-icons/road-course/trans-am-ta2/trans-am-ta2-blue.png | Replaced with approved optimized PNG | 14,226 |
| public/onlyfast-class-icons/road-course/trans-am-ta2/trans-am-ta2-white.png | Replaced with approved optimized PNG | 11,281 |
| public/onlyfast-class-icons/road-course/winged-open-wheel-formula/winged-open-wheel-formula-blue.png | Replaced with approved optimized PNG | 14,109 |
| public/onlyfast-class-icons/road-course/winged-open-wheel-formula/winged-open-wheel-formula-white.png | Replaced with approved optimized PNG | 10,965 |
| public/onlyfast-class-icons/sport-compact/sport-compact-blue.png | Replaced with approved optimized PNG | 11,524 |
| public/onlyfast-class-icons/sport-compact/sport-compact-white.png | Replaced with approved optimized PNG | 11,889 |
| public/onlyfast-class-icons/winged-sprint/winged-sprint-blue.png | Replaced with approved optimized PNG | 13,058 |
| public/onlyfast-class-icons/winged-sprint/winged-sprint-white.png | Replaced with approved optimized PNG | 13,727 |
| public/rookie-ads/dirt-late-model-bg.png | Replaced with approved optimized PNG | 2,419,616 |
| public/rookie-ads/dwarf-car-bg.png | Replaced with approved optimized PNG | 2,091,414 |
| public/rookie-ads/indycar-bg.png | Replaced with approved optimized PNG | 1,942,282 |
| public/rookie-ads/pavement-stock-bg.png | Replaced with approved optimized PNG | 1,762,097 |
| public/rookie-ads/winged-sprint-bg.png | Replaced with approved optimized PNG | 2,501,342 |
| public/rookie-ads/winged-sprint-centered-bg.png | Replaced with approved optimized PNG | 2,580,177 |
| public/rookie-ads/interstitials/gt3.webp | Added unchanged approved WebP | 58,632 |
| public/rookie-ads/interstitials/late-model.webp | Added unchanged approved WebP | 44,856 |
| public/rookie-ads/interstitials/sprint-hero.webp | Added unchanged approved WebP | 299,158 |
| public/rookie-ads/interstitials/sprint-stylized-light.webp | Added unchanged approved WebP | 202,028 |
| public/rookie-ads/interstitials/winged-sprint.webp | Added unchanged approved WebP | 109,508 |

## Rollback procedure and remaining limits

The prior READY deployment **`dpl_r6cXZXEWkCGxvwWsbWFLQfhV8xRo`** is the rollback target. If rollback is needed, use Vercel's existing-project rollback operation targeting that deployment and then recheck `onlyfast.app` and the runtime/asset hashes. No database rollback, migration reversal, Supabase restore or Edge redeployment is appropriate for this graphics release. The previous deployment and all original graphics backups were retained.

No unresolved release-blocking image, runtime-difference or production QA failure remains. Physical-device/native WebView rendering, paid AI/OCR, purchases, live-ad transactions and interactive setup-save/class-switch writes were not tested. Authenticated browser flows that could alter account/test data were not exercised; normal Auth and existing owner-data access were tested through the existing read-only QA runner. The unchanged runtime hashes provide direct evidence that application code, UI rules and entitlements logic were preserved.

Production is now a precompiled static release of the verified runtime. Future source-based releases should use the retained production source/configuration inputs and separately review unrelated work in the main checkout. This release did not merge that work or create a Git commit.

Evidence: [live file/hash verification](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/live-verification.json>), [exact static release manifest](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/static-release.json>), [final deployment and rollback state](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/final-deployment-state.json>), [before/after QA comparison](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/production-qa-comparison.json>), [live asset rendering](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/live-render.json>), [desktop public page](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/live-public-desktop.png>), [mobile public page](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/live-public-mobile-3x.png>), [desktop live asset gallery](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/live-gallery-desktop.png>), [mobile live asset gallery](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/graphics-deployment/live-gallery-mobile-3x.png>). The private QA configuration remains outside the repository and is not part of these artifacts.

**Stopped after the authorized graphics deployment and verification. No Phase 2C, additional optimization, cleanup, commit or push was performed.**
