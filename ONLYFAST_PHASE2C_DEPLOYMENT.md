# OnlyFast Phase 2C production deployment — complete

**Phase 2C is live at [onlyfast.app](https://onlyfast.app)** on **dpl_Ac1pkzoBUMfQe97P8GW7sfEjYhwz**, READY. Recorded 2026-11-06T04:32:42.055Z (November 5, 2026 PST). No Phase 2D work was started. No application-source change was made during this deployment task; it publishes the previously reviewed three-file performance implementation.

Public initial JavaScript is **29.31% smaller raw / 26.50% smaller gzip**. In the fresh controlled production-equivalent slow-network comparison, median public readiness is **4669 → 4216 ms**, a **453 ms improvement**, compared with the prior local 433 ms result. This is not a real-device or full live-backend speed claim.

**Actual published size is 17,665,982 bytes across 74 files.** This includes two unchanged older JS files retained for existing clients. The active new build is 16,432,437 bytes, with a five-chunk runtime graph; the origin serves seven JS files including compatibility copies. These totals are deliberately distinguished below.

## 1. Deployment identifiers and rollback

| Item | Result |
|---|---|
| New production | **dpl_Ac1pkzoBUMfQe97P8GW7sfEjYhwz — READY**, production |
| Production deployment URL | https://onlyfast-ccnp0oru2-apex88vents-projects.vercel.app |
| Assigned domains | onlyfast.app, www.onlyfast.app, onlyfast.vercel.app, onlyfast-apex88vents-projects.vercel.app |
| Previous production / rollback target | **dpl_Hg3P4X38RwebY6hZURdKeLfoyV3R — READY, retained** |
| Previous deployment URL | https://onlyfast-o548cw2ui-apex88vents-projects.vercel.app |
| Verified staging | dpl_EZmXgCayQqkCm7uosgwjt1cbmw7H — READY |
| Existing Vercel project | prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR / onlyfast |
| Existing team | team_smopqnOs6cFIL3nxEZ7O9O7Z |
| Git | Existing primary main; no commit, push, branch or worktree created |

The previous deployment was rechecked READY after release. The retained old runtime URLs also remain available in the new package. No rollback was needed or executed. If a confirmed critical failure occurs, Vercel's rollback operation can target the previous deployment using the same project/team; this does not require a database migration or restore. Rollback execution itself was not tested against production.

## 2. Exact approved source and packaging

Read ONLYFAST_PHASE2C_PERFORMANCE.md, ONLYFAST_GRAPHICS_DEPLOYMENT.md and ONLYFAST_PHASE1_PRODUCTION_RELEASE.md. The existing 54 graphics edits, Phase 2C edits, QA harness and reports were preserved. The primary checkout was not used as the release source.

The baseline is the retained source underlying the graphics deployment. A fresh readback verified **all 69 old production files** against their original hashes. A fresh isolated Vite production build matched **every byte of the previously reviewed candidate-dist-eZXhw3 artifact**. The production-source comparison contains only:

| Application source | Approved change |
|---|---|
| src/components/AppLayout.tsx | Deferred dashboard and code-only preload after existing account/onboarding gates |
| src/components/SetupDashboard.tsx | Deferred Assist/scanner imports; Parts/Schedule remain eager within dashboard |
| src/components/DeferredFeature.tsx | Stable loading boundary, completed-preload path, explicit safe retry without page reload |

No setup fields, saving behavior, authorization, subscription, ad, billing, OnlyLaps, native lifecycle or database logic was edited. Tests, reports, QA automation, experimental source and historical snapshots were not uploaded.

Uploaded the exact precompiled static files through the connected Vercel API: **75 source objects / 74 public files**, including the existing deployment-only vercel.json. Staging and production source trees each matched **75/75 SHA-1s**. All nine staging runtime responses (HTML/CSS/new and retained JS) matched their expected bytes and content types through authenticated access. Production readback matched **74/74 SHA-256s**, including actual image MIME types and all old/new chunk paths.

The two compatibility copies are assets/main-BGO7x460.js and assets/RookieHouseAdContent-dotU1z-W.js. Both are unchanged from the approved previous production runtime. Retaining both lets older open clients resolve the old lazy creative and its imports. They are absent from the new entry's import graph and add no initial download to the new entry.

The same existing static-package deployment configuration was used: no remote install/application compilation, outputDirectory public, existing SPA rewrite and Git rules retained. This is the same per-deployment packaging method as the previous graphics release. Project-wide Vite framework, Node 24.x, domains, protection and other reviewed project settings remain unchanged. Metadata for **all 23 environment variables** matched before/after; no decrypted values were requested or exposed, and no environment variable was written.

## 3. Graphics, styling and security preservation

- All **59 approved graphics** retain their exact production hashes: 48 icons, 6 lossless PNG creatives and 5 approved WebPs. The five WebPs return actual image content. No originals/backups were rewritten, resized or recompressed.
- The existing logo, placeholder and other non-runtime static files retain their bytes.
- CSS remains assets/main-BxxoOEC8.css: **132,279 bytes**, gzip9 20,502 / Brotli11 15,817. SHA-256 **c5059c9351befec97a34e1ee132cec8519e6821eab2d9795bc45717cfe09afe1**, exact before/after. Current labels/layout/source outside the approved import boundaries remain intact.
- Phase 1 owner-scoped queues, secure sharing redemption, membership authority, RLS, quotas and 48-hour restrictions were not modified. No Supabase migrations, policies or Edge Functions were deployed or changed.
- RevenueCat, Median, pricing, advertising controller/eligibility/timing, native purchase/ad holds and OnlyLaps contracts/configuration were not changed or activated.

## 4. Pre-deployment verification

| Check | Result |
|---|---|
| App TypeScript | Passed |
| Node TypeScript | Passed |
| Fresh isolated production build | Passed; exact prior approved candidate bytes |
| Relevant/full existing local regression | **565 passed, 7 failed**, same seven failure names as Phase 2C baseline |
| Local QA smoke | **69 passed, 0 failed** |
| Disposable database suites within regression | **22 passed, 0 failed**, local engines only |
| Loading boundary tests within regression | **5 passed**; preload/state/account keys/retry/untrusted-URL cases |
| Compiled fixture navigation | Passed: chunk failure recovery without reload/draft loss; navigation/revisit; new-setup cancel; A→B isolation; Settings; logout |
| Authenticated guarded browser before traffic switch | **11 passed**, including real owned setup load, scanner/Assist availability and reload |
| Existing production QA before cutover | Configuration **1/1**, normal authenticated smoke **7/7** |
| Stage source/runtime integrity | **75 source hashes / 9 runtime responses** matched |

The local regression includes navigation, setup save/reload, owner-bound offline queues, Rookie/Pro/Team membership, advertising state machines, native picker/back/lifecycle and database fixtures. No failing historical assertion was relaxed and no application behavior was changed to make tests pass. No live production save, reset, purchase or AI/OCR generation was performed.

## 5. Production QA and data integrity

Used the approved **test@test.com** account with the existing external credential interface at C:/Users/c_mar/.onlyfast-qa/qa.env. Normal Supabase authentication verified the pinned account UUID and existing experimental tester permissions. No password/token was printed or stored in the release. Only the automation sessions were disposed; no account/password/permission/subscription change was made.

Commands executed before and after release:

```text
npm run qa:check -- --env production
npm run qa:smoke -- --env production
```

Runtime approvals allowed production reads and provider-free OnlyLaps status only. No --mutations/fixture reset/seed option was used.

| Production verification | Result |
|---|---|
| Configuration after release | **1 passed / 0 failed** |
| Normal QA smoke after release | **7 passed / 0 failed / 0 skipped** |
| Authenticated live browser | **12 passed**, 0 skipped |
| Normal Auth/identity refresh | Passed; expected tester and Team authority retained |
| Protected landing and subscription visibility | Passed; existing Team label visible |
| Existing saved setup list, explicit race-session open and reload | Passed |
| Assist / scanner | Both new chunks loaded; surfaces visible; no paid/provider request |
| Schedule / Parts / sharing viewer | Passed |
| OnlyLaps | Existing normal QA status-only call passed; reviewed read-only list action allowed in browser |
| Invalid secure share code | Passed in normal QA smoke |
| Existing valid share viewer | Passed: an existing owned code redeemed into the read-only viewer |
| Missing/failed JS chunks | **0** |
| Browser page errors | **0** |
| Active runtime / HTML / CSS / graphic readback | **74/74 exact** |
| QA setup/share/schedule/subscription fingerprints | **Identical before and after** |

Unchanged dedicated QA inventory: **15 setups, 2 shares, 0 schedule rows, 1 subscription row**. Row fingerprints covered full records, not only counts, before the production switch and afterward. Customer rows were not modified.

The older production frontend's no-argument reset caller remains part of its reviewed baseline. Browser automation blocked reset-test-account and all unapproved mutation/provider requests before transmission. This is a test-context network guard, not an application or permission change. Browser sessions were restored from normally authenticated, verified in-memory QA sessions; no interactive test-account login/logout cycle was used to trigger a reset. OnlyLaps link/unlink, fixture changes and paid generation/purchases remained prohibited.

Initial browser selector failures were investigated: the production header exposes an Account type label, and a base template can share a title with a race record. The harness was corrected to use the actual production header and a non-template race-session chip. The screenshot confirmed an ordinary template editor, not a blank/missing-chunk failure. No application fix or rollback was needed. Final browser checks pass and data hashes match.

## 6. Before/after JavaScript and published sizes

| Measurement | Previous | New | Meaning |
|---|---:|---:|---|
| Initial public JS, raw | 1,206,853 | **853,103** | **−29.31%** |
| Initial gzip9 JS | 327,876 | **240,995** | −26.50% local compression estimate |
| Initial Brotli11 JS | 264,488 | **201,836** | −23.69% local compression estimate |
| Authenticated Team home raw JS | 1,206,853 | **1,151,440** | −4.59%; entry + dashboard |
| Active runtime JS, all chunks | 1,233,545 | **1,235,327** | +0.14% |
| Active JS gzip9, sum per file | 334,084 | **339,077** | +1.49% |
| Active JS Brotli11, sum per file | 269,926 | **281,777** | +4.39% |
| Active graph chunks | 2 | **5** | Dashboard, scanner, Assist and existing creative boundaries |
| Actual served JS files | 2 | **7** | Includes 2 unchanged compatibility files |
| Actual published JS bytes | 1,233,545 | **2,468,872** | Compatibility copies included; not an initial-load metric |
| Active build bytes | 16,430,655 | **16,432,437** | +1,782 bytes |
| Actual published file count | 69 | **74** | Includes legacy paths |
| Actual published bytes | 16,430,655 | **17,665,982** | **+7.52%**, including 1,233,545 retained bytes |

The 0.14% figure describes the active runtime graph. It does not describe all JS files stored at the origin after compatibility retention. The initial entry reduction is confirmed by the actual served bytes/hashes. Images and CSS were not reduced further in this phase.

## 7. Fresh production-equivalent measurements

Downloaded all 74 live public files and verified them against the staged manifest. The after-build benchmark serves those downloaded bytes, with the current new entry and unchanged images. The before-build benchmark serves the byte-verified prior production baseline. Runs were sequential, without concurrent builds or browser QA.

Same Phase 2C conditions: Chrome 150.0.7871.47 on Windows; desktop 1440×1000/DPR1; mobile 390×844/DPR3; separate 1.6 Mbit/s/150 ms network and 4× CPU profiles; three fresh contexts per condition, each cold load then warm reload. Gzip9 HTTP responses, ETags and public,max-age=0,must-revalidate caching. Backend responses are synthetic/account-isolated; external CloudFront artwork and Google Fonts are blocked consistently. This isolates code loading/execution. It is **production-equivalent readback testing, not actual mobile hardware, production Auth latency, TLS/CDN or full external-media timing**.

FCP is browser first-contentful-paint. Ready is the visible React welcome heading or authenticated home action; it is an interaction-readiness proxy, not standardized TTI. The two-second intro remains unchanged. Script CPU is the CDP ScriptDuration delta. Navigation is click-to-visible Parts form. Values below are medians [min–max], three runs each.


### Signed out

| Condition | Cache | FCP before → after (ms) | Ready before → after (ms) | Script CPU before → after (ms) | Parts navigation before → after (ms) |
|---|---|---:|---:|---:|---:|
| desktop | cold | 252 [232–360] → 212 [188–340] | 2604 [2583–2678] → 2557 [2556–2611] | 111 [99–116] → 85 [83–91] | — |
| desktop | warm | 88 [88–96] → 92 [88–96] | 2470 [2464–2470] → 2461 [2459–2475] | 31 [30–32] → 28 [28–29] | — |
| mobile | cold | 232 [228–252] → 192 [180–208] | 2594 [2586–2609] → 2568 [2537–2572] | 103 [102–111] → 89 [82–90] | — |
| mobile | warm | 92 [88–96] → 84 [84–88] | 2464 [2462–2465] → 2450 [2446–2468] | 31 [29–31] → 27 [26–30] | — |
| mobile-slow-network | cold | 2300 [2300–2324] → 1860 [1832–1880] | 4669 [4653–4676] → 4216 [4177–4231] | 113 [108–118] → 100 [97–100] | — |
| mobile-slow-network | warm | 428 [428–436] → 428 [424–456] | 2808 [2791–2814] → 2829 [2808–2830] | 29 [26–30] → 29 [28–30] | — |
| mobile-slow-cpu | cold | 852 [828–860] → 708 [700–720] | 3092 [3077–3096] → 2918 [2918–2936] | 680 [655–691] → 551 [545–553] | — |
| mobile-slow-cpu | warm | 352 [352–352] → 340 [340–344] | 2355 [2348–2379] → 2354 [2335–2368] | 148 [146–148] → 156 [153–157] | — |

### Authenticated Team fixture

| Condition | Cache | FCP before → after (ms) | Ready before → after (ms) | Script CPU before → after (ms) | Parts navigation before → after (ms) |
|---|---|---:|---:|---:|---:|
| desktop | cold | 240 [224–360] → 200 [196–340] | 2628 [2604–2688] → 2573 [2565–2627] | 135 [127–145] → 118 [115–119] | 128 [108–137] → 116 [112–119] |
| desktop | warm | 112 [108–112] → 104 [96–108] | 2494 [2480–2496] → 2482 [2479–2485] | 44 [42–49] → 47 [44–47] | 95 [91–97] → 93 [88–97] |
| mobile | cold | 236 [232–236] → 192 [192–204] | 2622 [2617–2623] → 2572 [2552–2580] | 129 [127–133] → 116 [111–118] | 58 [56–62] → 61 [61–68] |
| mobile | warm | 100 [96–112] → 108 [100–108] | 2474 [2471–2484] → 2476 [2472–2491] | 44 [42–50] → 46 [41–48] | 43 [40–46] → 40 [40–43] |
| mobile-slow-network | cold | 2332 [2316–2336] → 1848 [1832–1856] | 4702 [4682–4708] → 4221 [4213–4226] | 142 [138–153] → 121 [120–123] | 64 [59–66] → 59 [55–65] |
| mobile-slow-network | warm | 460 [452–476] → 456 [444–472] | 2829 [2827–2832] → 2834 [2824–2846] | 46 [45–49] → 48 [47–51] | 41 [36–41] → 40 [40–41] |
| mobile-slow-cpu | cold | 852 [852–888] → 720 [716–828] | 3247 [3227–3296] → 3110 [3099–3209] | 836 [814–845] → 735 [718–806] | 310 [310–318] → 313 [305–327] |
| mobile-slow-cpu | warm | 448 [432–460] → 416 [416–452] | 2549 [2532–2555] → 2554 [2501–2560] | 239 [226–265] → 250 [241–265] | 152 [149–152] → 149 [143–152] |


Cold slow-network public ready: **4669 → 4216 ms**, 453 ms faster (9.71%). Prior local result: **433 ms**. Warm slow-network ready: **2808 → 2829 ms**. Authenticated slow-CPU ready: **3247 → 3110 ms**. Smaller payloads do not produce a universal speedup; warm and navigation variations/negative observations remain in the table.

Actual loopback JS transfer reported by Resource Timing includes response overhead. Public cold is **328,176 → 241,295 bytes**. Authenticated startup uses two JS requests instead of one; retained old JS is not requested by the new entry. Raw request inventories, long-task data, cache/warm transfer and CPU deltas are retained in the JSON results. There were no unexpected runtime errors in the benchmark. Intentionally blocked external images/fonts are not missing JavaScript chunks.

## 8. Known failures and compatibility limits

The seven existing regression failures remain actual failures, unchanged in name and count: historical custom Swift bridge security/readiness assertion; Assist ad-lifecycle count (4 vs 3); onboarding harness missing HouseAdPlacement; inline house-ad footprint fixture missing that dependency; original inline upgrade fixture missing it; What If CTA expectation; road-map fixture missing discipline. **The full suite is not green.** Local smoke, type checks, builds and the focused release paths passed. No new confirmed functional regression was found.

First use of an unopened deferred panel requires its chunk. Existing loaded component state and owner-bound offline queues remain intact; the browser fixture verified failed fetch/retry without draft loss or page reload. No service worker or cold-offline feature guarantee was added. Safari/WKWebView retry behavior, physical Android/iOS, native picker/background/back/deep-link flows, native purchases and live advertising were not device-tested. Existing native mock/regression evidence and untouched eager lifecycle code are the available coverage. No live purchases, provider scans/Assist generation or ad presentations were used as tests.

The API rejected an initial target=preview request before a deployment was created; the supported staging target was used. Production received the identical verified static manifest. No deployment protection, environment or database workaround was introduced.

## 9. Retained evidence and stopping point

Local evidence: **C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/phase2c-deployment**. It contains source/build/asset manifests, production/staging state, environment metadata (no values), before/after QA reports/log references, guarded browser results and fingerprints, live readback, full benchmark JSON/tables and regression comparison. The retained static package is C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase2c-deploy-5KnbFa; live verified bytes are C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase2c-deploy-5KnbFa/live-IxixXf.

Application appearance/assets, Phase 1, customer data, subscriptions, billing, advertising and OnlyLaps configuration were preserved. Existing unrelated working-tree files remain uncommitted. The previous production deployment and recovery artifacts remain intact. **Deployment, focused verification and reporting are complete. No Phase 2D work was begun.**
