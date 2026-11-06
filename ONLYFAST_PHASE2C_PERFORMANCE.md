# OnlyFast Phase 2C — local JavaScript performance review

Completed locally on November 5, 2026 (PST); recorded 2026-11-06T03:46:32.651Z. **No deployment, commit, push, database migration, Edge Function change, billing activation, advertising activation or Phase 2D work.** Production remains deployment **dpl_Hg3P4X38RwebY6hZURdKeLfoyV3R**.

The retained candidate reduces public initial JavaScript by **29.31% raw / 26.50% gzip**. Cold constrained-network startup improves measurably. Warm startup is mostly unchanged, and some navigation/CPU measurements are slower. Total shipped/compressed JavaScript increases slightly. This is a scoped local candidate for review, not a production release approval.

## 1. Verified baseline and preserved work

Read the audit, graphics deployment and Phase 1 production release records. Worked on the primary checkout's existing main at 3e5440947c8f20d13800f690c8f1aeb0249ac6a8, with origin Apex88Vent/onlyfast. Fetch/reconciliation found HEAD and origin/main aligned (0/0). The existing 54 modified graphics and three graphics reports were preserved. No Git worktree or branch was created.

Used a new non-Git export at **C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase2c-6XrPZG**. Its baseline and candidate are independent copies of the retained verified production source, with the 59 approved graphics. The original Phase 1/graphics exports, existing worktrees and recovery backups were not modified. The combined primary HEAD contains other previously reviewed development differences; it was not substituted for production behavior.

The baseline production-mode rebuild matches **all 69 published files byte for byte**, including original HTML, both JS chunks and CSS. The main JS SHA-256 is 6e2212f17acbf2180fca1b7e033c0f7614b591de353ce5768398b284fa1b685e. Building from the isolated source's working directory avoids Tailwind scanning the combined checkout. Vite 5.4.21, Rollup 4.62.2, TypeScript 5.9.3, React 18.3.1 and SWC plugin 3.11.0 were retained. Existing production build inputs, including VERCEL_ENV=production and the already-deployed public native configuration, were reproduced in process only. No environment file, dependency version, production setting or activation flag was changed; identifier values are omitted.

Scope verification found exactly three changed application files in the production export. All 59 approved graphics, the logo and placeholder retain their hashes. The primary checkout's 60 PNG/WebP files also retain their pre-task hashes. Production HTML was read back unchanged after the work. Phase 1 security, setup data, customer subscriptions and all backend state remain untouched.

## 2. Confirmed inefficiencies and dependency review

The public welcome screen eagerly imported the dashboard and secondary screens. Baseline entry: 280 modules in its entry graph and one existing lazy house-ad creative; candidate entry: 232 modules. The full Rollup graph is retained in the build manifests. No rendered module ID appears in multiple candidate chunks; no additional duplicate React installation was found in the reachable graph.

Large baseline modules include GoTrueClient (253,170 rendered bytes), SetupDashboard (148,279), PostgREST (134,981), React DOM (133,571), Supabase Storage (101,677), tailwind-merge (72,001), the scanner (65,435), Phoenix (54,182), Settings (37,627) and road schemas (37,264). These are pre-minification Rollup rendered lengths, not network sizes. Supabase's client construction retains substantial Auth/Storage/Realtime code. Moving its authorization initialization would be high risk. Named Lucide imports are tree-shaken. Installed highlight.js, zod and recharts do not justify an optimization: the heavy entry points are absent from the shipping graph. No eagerly shipped PDF library was identified to remove or replace.

### Startup database reads

The authenticated fixture issues two beta_tester_accounts reads, two user_feature_flags reads, two get_active_race_class_state calls, two subscription reads, one verified Auth user read, one setup read and one schedule read. Baseline and final candidate retain the same 11 logical backend requests. OPTIONS preflights are counted separately. The beta provider's session/auth initialization overlaps; class restoration and membership allowance revalidation overlap; subscription and dashboard status consumers have separate freshness responsibilities. Schedule detail/editor and template compatibility queries also overlap later in navigation.

No query cache, request consolidation or freshness change was implemented. Safely deduplicating these calls needs its own auth-change, mutation invalidation and lifecycle coverage. Neither server authority nor account-scoped state was replaced by an optimization cache.

## 3. Optimizations retained and rejected

1. Defer SetupDashboard until the existing authenticated/onboarded/class gates permit it. Preload code after the existing account/class state is ready, overlapping the unchanged splash/profile flow. Providers, authentication, membership authority, onboarding, CustomCarGate, native listeners and routing stay eager.
2. Defer Setup Assist and the timing scanner at their existing setup-screen render locations. The parent continues to own drafts, sessions, saving, account scoping and offline replay. Existing component props, conditional lifetimes and user/account keys remain intact.
3. Add one module-scope loading boundary with an accessible bounded placeholder, explicit retry and no full-page reload. In-flight/successful **code** is shared; no customer data is cached. Mounted component identities remain stable. A completed preload renders directly, avoiding an unnecessary first-mount Suspense delay. Rejected lazy identities are replaced for subsequent visits. Chromium retry can request only a validated same-origin /assets/ hashed JS path with a fresh query; arbitrary, credentialed and foreign URLs are rejected. Engines without a failed URL retain the ordinary loader and safe fallback.

The four-panel trial also deferred Parts Reference and Race Schedule. It was rejected: about 3 KB gzip for Parts added roughly 190 ms to first navigation on the 150 ms-latency connection, including warm document reloads under the existing revalidation policy. **Parts and Schedule remain eager within the deferred dashboard.** The trial's slow-CPU authenticated startup also exposed a 290 ms Suspense delay; the completed-preload path corrected it. Trial evidence is retained, but final tables below describe only the selected implementation.

The loading/state choices follow [React lazy](https://react.dev/reference/react/lazy), [Suspense](https://react.dev/reference/react/Suspense) and [dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import) semantics, verified against the installed React 18 runtime.

## 4. Exact changed files

| File | Change |
|---|---|
| src/components/AppLayout.tsx | Dashboard import boundary and code preload effect only |
| src/components/SetupDashboard.tsx | Assist/scanner import boundaries only; Parts/Schedule remain direct imports |
| src/components/DeferredFeature.tsx | Shared loading, completed-preload, state-preserving retry helper |
| tests/deferredFeature.test.ts | Five mounted loading/retry/preload/state/isolation cases |
| tests/onboardingNavigation.mjs | Teach the existing dashboard stub the new boundary interface; existing HouseAdPlacement failure remains |
| ONLYFAST_PHASE2C_PERFORMANCE.md | This report |

Ignored benchmark scripts/logs are under tmp/phase2c. The same narrow source changes are present in the primary checkout and production-based candidate. No unrelated tracked source was copied into the release export. No dependency, lockfile, application CSS, advertising controller, subscription, racing form, native, Supabase or Edge source was edited.

## 5. Bundle measurements

| Measurement (bytes) | Production baseline | Candidate | Change |
|---|---:|---:|---:|
| Public initial JavaScript, raw | 1,206,853 | 853,103 | -29.31% |
| Public initial JavaScript, gzip 9 | 327,876 | 240,995 | -26.50% |
| Public initial JavaScript, Brotli 11 | 264,488 | 201,836 | -23.69% |
| Authenticated Team home JavaScript, raw | 1,206,853 | 1,151,440 | -4.59% |
| Authenticated Team home JavaScript, gzip 9 | 327,876 | 315,894 | -3.65% |
| Authenticated Team home JavaScript, Brotli 11 | 264,488 | 261,274 | -1.22% |
| All shipped JavaScript, raw | 1,233,545 | 1,235,327 | +0.14% |
| All JS, sum of per-file gzip 9 | 334,084 | 339,077 | +1.49% |
| All JS, sum of per-file Brotli 11 | 269,926 | 281,777 | +4.39% |
| All published file bodies | 16,430,655 | 16,432,437 | +0.01% |

JS chunks: **2 → 5**. Published files: **69 → 72**. CSS stays **132,279 raw / 20,502 gzip / 15,817 Brotli bytes**, with exact production SHA-256 c5059c9351befec97a34e1ee132cec8519e6821eab2d9795bc45717cfe09afe1.

Authenticated totals describe the Team home fixture; an eligible Rookie can additionally request the existing ad creative.

The candidate's separate dashboard is 298,337 raw / 74,899 gzip bytes. Scanner adds 37,261 raw / 10,720 gzip bytes on first setup entry; Assist adds 19,885 / 6,232. The pre-existing lazy ad creative remains separate. These features share already-loaded modules; byte counts do not imply provider calls. The two setup panels can load in parallel. There is no arbitrary vendor chunk split.

Compression columns are deterministic local estimates (gzip level 9, Brotli quality 11), summed per served file. They are not universal production transfer measurements. Splitting reduces cross-file compression efficiency: users who eventually load every feature receive more compressed JS, despite the much smaller public entry.

## 6. Benchmark protocol and actual results

Chrome **150.0.7871.47**, headless on the same Windows host. Desktop: 1440×1000/DPR1. Mobile-sized: 390×844/DPR3. Slow network: 200,000 bytes/s download (1.6 Mbit/s), 93,750 upload and 150 ms injected latency. Slow CPU: CDP 4× slowdown at the mobile viewport. Network and CPU profiles were separate scenarios, not combined. Three fresh contexts per condition; each has a cold navigation followed by warm reload. Final baseline/candidate measurements were sequential with no concurrent builds/regression runs. Each row is the median and [min–max] of three runs; this is a small controlled sample, not statistical significance or a device forecast.

Served the exact builds over loopback HTTP with actual gzip responses, ETags and the production-style public,max-age=0,must-revalidate policy. CDP interception, rather than Playwright routing, retains the browser cache. Every backend request is fulfilled by an in-memory synthetic Team account; all other external traffic is blocked. **CloudFront splash artwork and Google Fonts are excluded identically.** Local graphics are unchanged. The results isolate bundle loading/application work and do not measure complete production LCP, real Auth latency, TLS/CDN latency, real fonts or external-image download.

FCP is the browser's first-contentful-paint entry. Ready means the public welcome heading or authenticated home Parts button is visible and React-mounted; it is an interaction-readiness proxy, **not standardized TTI**. Original splash timing is unchanged. Script CPU is a delta of CDP ScriptDuration through readiness + 300 ms; it excludes network waiting. Parts navigation measures click-to-visible form. No OCR/AI generation, file submission, purchase, ad presentation, live account login or customer write occurs.


### Signed out

| Condition | Cache | FCP before → after (ms) | Ready before → after (ms) | Script CPU before → after (ms) | Parts navigation before → after (ms) |
|---|---|---:|---:|---:|---:|
| desktop | cold | 256 [232–436] → 212 [208–336] | 2606 [2597–2681] → 2565 [2541–2637] | 110 [109–116] → 95 [86–104] | — |
| desktop | warm | 84 [80–88] → 84 [76–92] | 2456 [2445–2456] → 2448 [2432–2457] | 25 [23–27] → 23 [20–28] | — |
| mobile | cold | 236 [216–248] → 196 [192–200] | 2588 [2588–2617] → 2571 [2543–2580] | 107 [96–116] → 92 [85–94] | — |
| mobile | warm | 80 [76–88] → 88 [88–92] | 2452 [2449–2462] → 2459 [2452–2463] | 27 [25–28] → 29 [28–29] | — |
| mobile-slow-network | cold | 2284 [2284–2300] → 1852 [1840–1860] | 4648 [4645–4651] → 4215 [4198–4219] | 104 [103–104] → 93 [90–106] | — |
| mobile-slow-network | warm | 440 [428–464] → 428 [428–440] | 2790 [2789–2802] → 2798 [2791–2819] | 28 [25–29] → 28 [25–30] | — |
| mobile-slow-cpu | cold | 824 [812–844] → 764 [752–772] | 2973 [2963–3013] → 2950 [2942–2961] | 634 [596–653] → 595 [587–595] | — |
| mobile-slow-cpu | warm | 344 [324–360] → 348 [348–352] | 2326 [2312–2347] → 2343 [2332–2347] | 148 [148–163] → 149 [147–153] | — |

### Authenticated Team fixture

| Condition | Cache | FCP before → after (ms) | Ready before → after (ms) | Script CPU before → after (ms) | Parts navigation before → after (ms) |
|---|---|---:|---:|---:|---:|
| desktop | cold | 248 [216–392] → 200 [200–344] | 2629 [2603–2699] → 2572 [2559–2642] | 142 [124–156] → 122 [112–130] | 122 [115–129] → 105 [102–136] |
| desktop | warm | 100 [88–104] → 100 [92–104] | 2474 [2471–2477] → 2476 [2475–2478] | 38 [37–39] → 42 [39–43] | 89 [88–94] → 90 [89–101] |
| mobile | cold | 240 [228–240] → 216 [212–220] | 2625 [2605–2629] → 2592 [2592–2605] | 130 [125–133] → 127 [121–135] | 57 [50–58] → 58 [56–60] |
| mobile | warm | 108 [92–112] → 96 [92–100] | 2475 [2471–2493] → 2485 [2476–2486] | 43 [42–44] → 43 [42–44] | 39 [29–42] → 38 [35–46] |
| mobile-slow-network | cold | 2312 [2300–2352] → 1844 [1840–1868] | 4680 [4665–4717] → 4217 [4201–4242] | 130 [130–137] → 119 [110–119] | 53 [51–56] → 53 [51–53] |
| mobile-slow-network | warm | 452 [444–464] → 452 [436–456] | 2826 [2800–2829] → 2818 [2795–2832] | 38 [37–45] → 43 [42–44] | 38 [35–39] → 37 [31–50] |
| mobile-slow-cpu | cold | 856 [824–872] → 760 [740–780] | 3179 [3107–3194] → 3082 [3065–3108] | 787 [761–828] → 721 [721–738] | 247 [241–257] → 270 [262–276] |
| mobile-slow-cpu | warm | 456 [448–460] → 424 [412–436] | 2496 [2496–2515] → 2481 [2476–2535] | 238 [232–245] → 238 [224–243] | 136 [119–150] → 148 [137–165] |


Cold slow-network public FCP improves **2284 → 1852 ms (18.91%)**, ready **4648 → 4215 ms (9.32%)**. Authenticated ready improves **4680 → 4217 ms (9.89%)**. Slow-CPU authenticated ready improves **3179 → 3082 ms (3.05%)** after the preload correction. Warm readiness remains dominated by the unchanged intro and small timing variation. Parts has no new chunk request in the retained candidate; on slow CPU its measured cold navigation is **247 → 270 ms** and warm **136 → 148 ms**. Those negative observations remain disclosed; no universal navigation speedup is claimed.

Actual cold JS transfer (Resource Timing, including reported response overhead): public **328,176 → 241,295 bytes**, authenticated **328,176 → 316,494**. Warm JS transfer: public **300 → 300**, authenticated **300 → 600**, with cached bodies and revalidation overhead. Initial JS requests: public **1 → 1**, authenticated **1 → 2**. CSS requests and bodies are unchanged. Completed resource snapshots at ready + 300 ms can omit still-pending logo requests on the constrained network; the separate settled request audit below captures request starts as well.

Settled authenticated slow-network audit (one additional cold/warm pair per build; not substituted for the three-run timing table):

| Build | Cache | Completed requests + document, including blocked externals | JS | Backend |
|---|---|---:|---:|---:|
| baseline | cold | 19 | 1 | 11 |
| baseline | warm | 19 | 1 | 11 |
| candidate | cold | 20 | 2 | 11 |
| candidate | warm | 20 | 2 | 11 |

The settled counts exclude OPTIONS and avoid counting outgoing-document requests during warm reload. Raw CDP request starts/preflights are retained separately. No database-request reduction is claimed.

First observed React text (cold median ms, a MutationObserver proxy before paint): baseline/desktop: 203; baseline/mobile: 187; baseline/mobile-slow-network: 2241; baseline/mobile-slow-cpu: 708; candidate/desktop: 157; candidate/mobile: 151; candidate/mobile-slow-network: 1806; candidate/mobile-slow-cpu: 664. Long-task entries, startup excess over 50 ms, task durations, resource names/sizes and backend request inventories remain in the raw results; these are not presented as Lighthouse TBT or production TTI.

## 7. Regression and visual verification

| Check | Result |
|---|---|
| Production-based baseline rebuild | All 69 files match production exactly |
| Candidate production-mode build | Passed; existing >500 KB warning remains |
| Primary checkout production-mode build | Passed, retained separately; not the production-based release artifact |
| App and Node TypeScript checks | Both passed |
| New mounted boundary cases | **5/5 passed**: demand loading/in-flight sharing, state and account keys, completed preload, retry/reopen, untrusted URL rejection |
| Existing regression before edits | **560 passed / 7 failed** |
| Existing regression after final implementation | **565 passed / 7 failed**; exact failure names match baseline |
| Existing disposable database tests within regression | **22/22 passed**; no production connection |
| Existing local QA smoke | **69/69 passed** |
| Compiled browser fixture checks | Scanner network failure/retry with draft retained; revisit; Parts/Schedule navigation; new-setup cancellation; account A logout and normal mocked Supabase password login as B; empty B workspace; Settings; B logout/protected UI cleared |
| Provider/billing/customer mutations | None; external requests intercepted and no paid action invoked |
| Graphics/CSS integrity | All approved assets unchanged; exact CSS equality |
| Whitespace | git diff --check passed |

The seven baseline failures remain actual failures: historical Swift security/readiness assertion; Assist ad-lifecycle count (4 vs 3); onboarding mounted harness missing HouseAdPlacement; two other house-ad fixtures missing that dependency; the What If CTA expectation; and the road-map fixture's missing discipline. The harness was extended only for the new dashboard boundary, without relaxing an existing assertion or changing working business code. The full suite is **not green**. Unit: 524 pass/1 fail; mounted: 19/6; database: 22/0.

Browser screenshots were inspected. Authenticated Parts at desktop and mobile, and public mobile, are pixel-identical between builds. Desktop public differs in 6952 of 1,440,000 pixels, maximum 3/255 per channel, within the existing animated welcome graphic; no lettering, position, color or layout change was observed. Remote fonts were blocked consistently, so this is controlled local parity, not a claim of complete native or production visual coverage. Settled CSS and source graphics are exact.

No live production smoke or physical native/store test was attempted in this local-only task. Existing QA fixtures, account permissions and credentials were preserved. Only synthetic local data and disposable engines were exercised.

## 8. Remaining tradeoffs and compatibility limits

- Total raw JS/build grows 1,782 bytes; the sum of gzip grows 4,993 bytes and Brotli 11,851. Authenticated startup has one additional JS request and warm validation overhead. Warm startup does not materially improve. The observed slow-CPU Parts navigation penalty remains in the table.
- A never-loaded deferred panel needs its chunk from the network. Loaded modules remain available in the current document; ordinary setup forms, parent drafts and durable offline replay were not changed. There is no new service worker or promise that an unopened feature will work on a cold offline restart. The error UI preserves the parent and permits explicit retry; it never reloads the page.
- Cached failed-download recovery was exercised in Chromium. Safari/WKWebView may omit the failed URL, so safe fallback/normal retry remains but the fresh-query branch is not device-proven. No physical Android/iOS Median app, real background/picker-return, hardware back, store paywall, native ad, native deep-link or offline restart certification is claimed. Eager native lifecycle code is unchanged; existing mock regression coverage and account-key isolation remain.
- Three-run timing ranges and blocked third-party dependencies limit inference. Production caching, external images/fonts, customer data volume and native devices can dominate end-to-end performance. No quota, subscription, provider, OnlyLaps contract or RLS behavior was retested by making live paid/customer calls.

## 9. Features intentionally unchanged and remaining opportunities

App.tsx routes, public onboarding/authentication, class authorization, HomeLanding rendering, settings/subscription management, saving/loading/base templates/comparison/sharing, account deletion, offline queue keys/replay, racing forms, 48-hour locking, Rookie/Pro/Team rules, OnlyLaps, AI/OCR payloads and server authorization remain unchanged. Existing creative loading, house/native ad controller, placements, holds, cooldown and billing configuration remain intact. No unused/historical source or package was deleted.

Potential future work requires separate evidence: account-bound startup read deduplication with mutation/resume invalidation; safely deferring settings/public routes; investigating the substantial Supabase SDK graph; hashed-chunk caching and old-chunk retention; rendering/storage profiling on real devices; resolving existing mounted/historical QA failures. Parts/Schedule splits should not be reintroduced without a better measured navigation/caching result. These opportunities were not started as Phase 2D.

## 10. Recommendation and retained artifacts

Recommend **reviewing this exact production-based candidate in an approved preview next**, with the disclosed first-use/offline and native tests and the seven existing test failures resolved or explicitly assessed before a production release. Preserve the previous deployment and old hashed chunks in any future reviewed release procedure. Do not deploy the combined primary build: it includes pre-existing differences outside this task. No deployment was performed or queued; owner approval is still required for a future production release.

Retained production-based baseline: C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase2c-6XrPZG/baseline-dist.

Retained final candidate: **C:/Users/c_mar/AppData/Local/Temp/onlyfast-phase2c-6XrPZG/candidate-dist-eZXhw3** (72 files; 16,432,437 bytes).

Evidence in C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/phase2c: baseline-build.json, candidate-build.json, primary-build.json, final-summary.json, performance-tables.md, both baseline/candidate guest/auth bench JSON files, network-audit JSON files, regression-comparison.json, lifecycle-final.log, scope-verification.json, visual-comparison.json, TypeScript/build/QA logs and screenshots. Trial four-panel evidence is retained separately. These local scripts/fixtures/reports are not bundled or deployed.
