# OnlyFast Phase 2B — advertising graphics optimization

Completed locally on November 5, 2026. Six PNGs were optimized with **lossless compression at their original full resolution**. Five existing WebPs were deliberately left unchanged. No image was resized, cropped, regenerated, recolored, renamed or deleted. No application source, CSS, advertising logic or asset reference changed. No commit, push or deployment was performed.

## Baseline and preserved work

Checkout: `C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\onlyfast`; branch `main`; HEAD `3e5440947c8f20d13800f690c8f1aeb0249ac6a8`. The remote is `Apex88Vent/onlyfast`; fetching origin showed no ahead/behind divergence. No worktree or branch was created.

The starting working tree contained the 48 Phase 2A optimized class icons and the untracked `ONLYFAST_ICON_OPTIMIZATION.md`. Their contents were preserved. The 48 icons, Phase 2A report and OnlyFast logo all match their starting SHA-256 checksums (**50 protected files**). Phase 1 security, database migrations/functions, OnlyLaps, subscriptions, RevenueCat, Median, advertising holds, billing and racing functionality were not changed.

The new baseline build was measured directly from this Phase 2A working tree: **18,413,476 bytes**, rather than reusing historical audit totals.

## Original backup and integrity

Backup: [Advertising originals](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/icons/advertising-originals-20261105-214700>).

[Backup manifest](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/icons/advertising-originals-20261105-214700/manifest.json>) records all 11 original paths, backup destinations, dimensions, formats, original byte counts and SHA-256 checksums. Manifest SHA-256: `7f10c11863ae0d34499fa41f715bcdd2d079bc3f11fafb8e1df7822cc427965f`.

**11/11 backup copies matched their originals before any optimization candidate was generated.** Source and backup hashes were rechecked before application replacement, and backup hashes were checked again afterward. The original `public/rookie-ads/...` structure, filenames, raw bytes and formats were preserved outside the repository in a new timestamped directory. No existing backup was overwritten or deleted. The logo was excluded from optimization and retained unchanged.

For file recovery, copy the corresponding backed-up `public/rookie-ads/...` file to its identical checkout path. No application logic or database rollback is needed.

## Display requirements and resolution decisions

Inspected `RookieHouseAdContent`, `RookieHouseAdPage`, `HouseAdPlacement`, `RookieAdSlot`, dashboard/landing containers, and the existing development house-ad/design previews. No other advertising bitmap directory was found. The bottom house banner uses unchanged HTML text and the existing OnlyFast logo; no separate banner image exists.

Inline banners are 160 CSS pixels high and expand with their host. Dashboard content is capped at `max-w-7xl` (1280 CSS pixels before internal padding); landing content also has a `max-w-5xl` limit. Banner backgrounds and inset photographs use centered `background-size: cover`. The approved saved-setup interstitial is a responsive card with a maximum 512-pixel inner section inside the existing dialog; its centered cover background also fills tall mobile cards. Full-screen development design A/C art uses `object-fit: contain`, responsive hero/fleet elements and a 72rem design cap.

Measured CSS sizes in the real components, with original and candidate images:

| Browser configuration | Viewport / DPR | Inline image-bearing banner | Approved interstitial section | Before/after scene comparison |
| --- | --- | --- | --- | --- |
| narrow-phone | 320×740 / 3× | 288×160 | 272 wide; 709.47–763.36 high | 8/9 pixel-identical |
| ios-size | 390×844 / 3× | 358×160 | 342 wide; 632.81–660.81 high | 9/9 pixel-identical |
| android-size | 430×932 / 3× | 398×160 | 382 wide; 646.2–674.2 high | 9/9 pixel-identical |
| desktop | 1440×1000 / 2× | 1248×160 | 512 wide; 664.38–675.23 high | 9/9 pixel-identical |

The original background widths (1983–2172 pixels) were preserved, including values above the suggested 1920 guideline. Large desktop banners at high density and tall mobile cover crops justify retaining every available source pixel. Arbitrary 512/1024 targets would discard detail. The original short background height can already limit native 3× sharpness when a wide image is cover-scaled into a tall card; that existing source limitation was not worsened, hidden by upscaling, or compensated for with UI changes. Existing transparent vehicle art also retained all original pixels. No claim of new resolution beyond the originals is made.

| Asset | Current usage |
| --- | --- |
| dirt-late-model-bg.png | No current source reference found; public URL preserved. |
| dwarf-car-bg.png | home_middle; setup_dashboard_bottom. Full banner and inset photo. |
| indycar-bg.png | schedule_bottom; timing_scan_bottom. Full banner and inset photo. |
| gt3.webp | Development full-screen design C fleet. |
| late-model.webp | Development full-screen design C fleet. |
| sprint-hero.webp | No current source reference found; public URL preserved. |
| sprint-stylized-light.webp | Development full-screen design A hero. |
| winged-sprint.webp | Development full-screen design C fleet. |
| pavement-stock-bg.png | home_bottom; setup_session_bottom; parts_reference_bottom. Full banner and inset photo. |
| winged-sprint-bg.png | Approved after_save_interstitial background. |
| winged-sprint-centered-bg.png | setup_track_conditions; todo_bottom. Full banner and inset photo. |

## Candidate selection and critical visual quality

Every image received a full-resolution WebP quality-95 candidate and a lossless WebP candidate. The six PNGs also received lossless PNG candidates. No source copy was replaced during candidate generation or review. The chosen PNGs are smaller than both the originals and the initial Sharp PNG candidates.

The six accepted files use **Oxipng 10.2.1, optimization level 4, `--strip safe`**. No lossy alpha optimization was enabled. The tool archive came from the official project release and matched its published SHA-256 `7e940f83ee46874b73f53031f96a15834cb70b220af27391fb06fe7b4dd798e1`. [Oxipng documentation](https://github.com/oxipng/oxipng) describes its lossless optimizer and safe metadata stripping. Existing temporary Sharp 0.34.5 tooling supplied candidate encoding, decoded-pixel checks and comparison images. All tools and intermediate files remain in ignored `tmp`; application dependencies and lockfiles were not changed.

**Every accepted PNG decodes to exactly the same full-resolution RGBA pixels as its backed-up original.** Alpha values, fine vehicle details, small markings, gradients, texture, colors and visual margins therefore have zero decoded-pixel differences. Color/rendering metadata was preserved where required by safe stripping. The centered sprint PNG retains its alpha channel, with every decoded alpha value matching the original. No palette quantization or chroma subsampling was used in the accepted files.

Lossy WebP was not chosen for the PNGs: existing public PNG URLs must remain compatible with cached/older clients, and keeping both versions would add deployable bytes. Lossless PNG provided verified savings with exact image preservation. None of the five existing WebPs was re-encoded: the tested quality-95 files were larger and introduced generation loss, while lossless re-encodes were also larger.

## Images deliberately unchanged

All five are retained byte-for-byte, at original dimensions, to preserve their current quality and avoid larger or lossy replacements:

| Retained image | Original bytes | Tested WebP quality 95 bytes | Tested lossless WebP bytes |
| --- | ---: | ---: | ---: |
| public/rookie-ads/interstitials/gt3.webp | 58,632 | 67,362 | 195,194 |
| public/rookie-ads/interstitials/late-model.webp | 44,856 | 52,198 | 144,232 |
| public/rookie-ads/interstitials/sprint-hero.webp | 299,158 | 339,130 | 846,836 |
| public/rookie-ads/interstitials/sprint-stylized-light.webp | 202,028 | 222,672 | 543,520 |
| public/rookie-ads/interstitials/winged-sprint.webp | 109,508 | 126,182 | 325,394 |

## Visual verification

Original, selected and quality-95 alternative comparison sheets were generated for all 11 assets and visually inspected. Selected artwork preserves fine vehicle outlines, tire/suspension details, body markings, background streaks, gradients and texture without added compression artifacts. Asset sheets are [retained locally](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals>); each `asset-0.png` through `asset-10.png` identifies its original path and candidate.

The **existing local house-ad preview** rendered the actual approved interstitial, bottom placement, and development design A/C. An ignored temporary preview mounted the actual `RookieAdSlot` component for all nine inline placements. No production route, user account, customer fixture or QA configuration was modified. Paid/native ad SDKs and checkout were not activated. External requests were restricted to the application's existing Google Fonts resources; no production/Supabase/ad-provider request was allowed or observed in these preview runs.

There were **36 original/candidate scene comparisons** across narrow 320-pixel, iOS-size 390-pixel, Android-size 430-pixel and desktop 1440-pixel viewports. Phones used DPR 3 and desktop DPR 2. All three inline and approved-interstitial slide tones were checked, along with bottom placement and the two design previews. The comparisons include 108 inline placement/slide presentations and 12 approved interstitial presentations, plus bottom/design scenes. Each comparison held document, viewport, fonts, clock, text, CSS and SVGs constant while switching only the image request to the selected bitmap. Animations were frozen only in the preview capture, not changed in application files.

**35/36 final screenshot pairs had identical decoded pixels**, with matching measured dimensions, zero broken images and no browser page errors. The other 1 pairs had only sparse whole-scene renderer differences (maximum 1/255 in a color channel; at most 49 pixels in screenshots containing millions of pixels). These negligible compositing/antialias differences are recorded explicitly; the underlying bitmap RGBA pixels are exactly equal. They were visually reviewed and are not a claim of whole-scene pixel identity. Comparison sheets and before/after screenshots were also inspected for text readability, logo edges, vehicle proportions, cropping, contrast, gradients and texture. No visible quality reduction was observed. Early cross-document comparisons showed tiny rasterization differences in unchanged SVG design-preview edges; same-document bitmap comparisons reduced that test-renderer variability without changing application code or bitmap pixels. A native-pixel detail comparison is retained as [native-detail-proof.png](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/native-detail-proof.png>).

Representative original/candidate pairs:

- [Mobile approved interstitial — original](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/ios-size-approved-0-original.png>) / [optimized](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/ios-size-approved-0-candidate.png>)
- [Desktop inline placements — original](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/desktop-inline-0-original.png>) / [optimized](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/desktop-inline-0-candidate.png>)
- [High-density design A — original](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/android-size-A-0-original.png>) / [retained artwork](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/android-size-A-0-candidate.png>)
- [High-density design C — original](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/android-size-C-0-original.png>) / [retained artwork](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/visuals/android-size-C-0-candidate.png>)

[Full browser results](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/browser-review.json>) records measurements, image URLs and screenshot pixel hashes. These are installed Chrome/Chromium simulations, **not physical-device, native Android WebView or iOS WebKit/WKWebView tests**. Native device verification remains unperformed. Existing formats, dimensions, public URLs and all application source remain unchanged.

## Actual size comparison

MB below uses 1,000,000 bytes. Production build figures are the sum of all deployable file bytes before HTTP/archive compression; they exclude Vercel metadata and do not describe a deployed release.

| Collection | Before | After | Bytes saved | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Advertising images — 11 total, 6 optimized, 5 retained | 15,984,698 | 14,011,110 | 1,973,588 | 12.35% |
| Local production web build — 69 files | 18,413,476 | 16,439,888 | 1,973,588 | 10.72% |

The build falls from **18.413 MB to 16.440 MB**, saving **1,973,588 bytes (1.974 MB)**. Only six PNG file hashes differ across the two builds; **63 build files are byte-for-byte unchanged**, including all 48 Phase 2A icons, JavaScript, CSS, HTML, logo, existing WebPs and other static files. Both builds used the same working tree/environment/dependencies except the six accepted PNGs. Fresh output directories under `tmp/ad-graphics` preserved existing builds and `dist`.

These are **total static/deployable savings, not universal startup-download savings**. House-ad code is lazy and gated; an actual client requests only images used by eligible displayed placements, with cache/network behavior affecting transfer. For a cold eligible placement, per-file image savings are listed below; Pro/Team/logged-out users do not gain an ad-image request saving when they were already suppressed. Development-only and unreferenced assets are copied into the static build but are not all requested at startup. No live startup/network benchmark or production download reduction is claimed.

## Per-image dimensions and sizes

| Original/public file | Before dimensions | After dimensions | Before bytes | After bytes | Bytes saved | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| public/rookie-ads/dirt-late-model-bg.png | 1983×793 | 1983×793 | 2,514,958 | 2,419,616 | 95,342 | Lossless PNG |
| public/rookie-ads/dwarf-car-bg.png | 2172×724 | 2172×724 | 2,200,954 | 2,091,414 | 109,540 | Lossless PNG |
| public/rookie-ads/indycar-bg.png | 2172×724 | 2172×724 | 2,069,535 | 1,942,282 | 127,253 | Lossless PNG |
| public/rookie-ads/interstitials/gt3.webp | 900×298 | 900×298 | 58,632 | 58,632 | 0 | Retained original WebP |
| public/rookie-ads/interstitials/late-model.webp | 900×276 | 900×276 | 44,856 | 44,856 | 0 | Retained original WebP |
| public/rookie-ads/interstitials/sprint-hero.webp | 1048×920 | 1048×920 | 299,158 | 299,158 | 0 | Retained original WebP |
| public/rookie-ads/interstitials/sprint-stylized-light.webp | 1120×803 | 1120×803 | 202,028 | 202,028 | 0 | Retained original WebP |
| public/rookie-ads/interstitials/winged-sprint.webp | 900×615 | 900×615 | 109,508 | 109,508 | 0 | Retained original WebP |
| public/rookie-ads/pavement-stock-bg.png | 2167×725 | 2167×725 | 1,917,640 | 1,762,097 | 155,543 | Lossless PNG |
| public/rookie-ads/winged-sprint-bg.png | 2172×724 | 2172×724 | 2,583,761 | 2,501,342 | 82,419 | Lossless PNG |
| public/rookie-ads/winged-sprint-centered-bg.png | 2172×724 | 2172×724 | 3,983,668 | 2,580,177 | 1,403,491 | Lossless PNG |

## References, duplication and compatibility

All 11 original public paths remain in the production build, with their original formats and dimensions. Five production background mappings and four dynamically constructed design-preview URLs were verified, including the class-specific fleet. No URL or fallback changed; no PNG-to-WebP filename conversion, new static duplicate or reference edit was needed. Relevant previews and tests retain their existing references.

No byte-identical duplicate pair was found among the 11 originals. Sprint artwork has related vehicles but distinct framing, background and transparency; these are not interchangeable or deleted.

Two files have no current application/development source reference: `public/rookie-ads/dirt-late-model-bg.png` and `public/rookie-ads/interstitials/sprint-hero.webp`. Both were preserved because published URLs or older clients may still use them. Their current combined **2,718,774 bytes** are a potential future static-build saving only after compatibility is established and removal is separately authorized; no startup saving is inferred.

Full-resolution **lossless WebP** candidates for the six PNGs total 10,013,424 bytes versus 13,296,928 accepted PNG bytes: a further potential **3,283,504 bytes** if PNG paths could safely be retired or supported by a separately reviewed compatibility mechanism. That is not realized here. Keeping the PNGs and adding those WebPs would increase the static build, so no duplicate format was added. Lossy quality-95 candidates are also retained only in temporary review files, not the application output.

## Ten largest remaining deployable assets

This ranks actual files in the optimized production build, including scripts and unchanged artwork.

| Rank | Build-relative path | Bytes |
| --- | --- | ---: |
| 1 | rookie-ads/winged-sprint-centered-bg.png | 2,580,177 |
| 2 | rookie-ads/winged-sprint-bg.png | 2,501,342 |
| 3 | rookie-ads/dirt-late-model-bg.png | 2,419,616 |
| 4 | rookie-ads/dwarf-car-bg.png | 2,091,414 |
| 5 | rookie-ads/indycar-bg.png | 1,942,282 |
| 6 | rookie-ads/pavement-stock-bg.png | 1,762,097 |
| 7 | assets/main-CtEEDKDn.js | 1,213,699 |
| 8 | onlyfast-logo.png | 449,563 |
| 9 | rookie-ads/interstitials/sprint-hero.webp | 299,158 |
| 10 | rookie-ads/interstitials/sprint-stylized-light.webp | 202,028 |

The six photographic PNGs intentionally remain large to preserve full-resolution detail and compatible URLs. The unreferenced files above are retained pending compatibility evidence, not accidentally omitted from optimization review.

## Automated verification

| Check | Result |
| --- | --- |
| Original backup verification | Passed: 11/11 before candidates, before replacement and after optimization |
| Full-resolution RGBA equality | Passed: all 6 accepted PNGs; retained WebPs unchanged |
| Dimensions, formats, alpha appearance and build image hashes | Passed: all 11 |
| Production literal and dynamic preview asset references | Passed: 5 production PNG mappings + 4 constructed preview WebP URLs |
| Phase 2A icons, report and OnlyFast logo integrity | Passed: 50/50 protected file hashes |
| `tests/nativeAds.test.ts`, `nativeAdsMode.test.ts`, `rookieAdPages.test.ts`, `houseAdMidpoint.test.ts` | **62 passed, 0 failed** |
| `npm run qa:smoke` — existing default local/non-production mode | **69 passed, 0 failed, 0 skipped** |
| `tsc -p tsconfig.app.json --noEmit` | Passed |
| `tsc -p tsconfig.node.json --noEmit` | Passed |
| Fresh production Vite build before and after, existing release environment/output guards | Passed; existing >500 KB chunk advisory remains |
| Browser comparisons using actual components | Passed: 36 scene pairs; 35 pixel-identical; no broken images |
| Git/source and build-diff checks | Only 6 ad PNGs added to the existing Phase 2A changes; all 63 other build files unchanged |

Advertising tests cover Rookie eligibility, Pro/Team suppression, house fallbacks, midpoint presentation, and the shared 600,000 ms interstitial cooldown. No ad timing, rotation, click behavior, copy, native privacy/provider behavior or gating code was edited. No production mutation, migration, paid AI/OCR, purchase, live advertising transaction, account reset or fixture change occurred.

Raw records: [verification and top-ten sizes](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/verification.json>), [per-image original/optimized hashes](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/results.json>), [advertising tests](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/advertising-tests.log>), [local QA smoke](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/ad-graphics/qa-smoke.log>). Reusable temporary tooling and comparison files are ignored under `tmp/ad-graphics`; application dependencies and the existing QA system were not changed.

## Exact Phase 2B files modified

- `public/rookie-ads/dirt-late-model-bg.png`
- `public/rookie-ads/dwarf-car-bg.png`
- `public/rookie-ads/indycar-bg.png`
- `public/rookie-ads/pavement-stock-bg.png`
- `public/rookie-ads/winged-sprint-bg.png`
- `public/rookie-ads/winged-sprint-centered-bg.png`
- `ONLYFAST_AD_GRAPHICS_OPTIMIZATION.md` (this new report)

No source, asset-reference, CSS, configuration or test file was modified. Pre-existing Phase 2A changes remain uncommitted and untouched. No files were deleted. No commit, push or deployment was performed. Phase 2B stops after these local results; no further phase was started.

## Remaining limitations

Actual native WebView/physical-device checks and live-provider testing were not performed. Historical/external URL usage cannot be proven from this checkout, so all old public paths remain available. The retained WebPs and full-resolution backgrounds are deliberate quality/compatibility decisions. There is no unresolved missing-image or known quality regression in the completed local checks.
