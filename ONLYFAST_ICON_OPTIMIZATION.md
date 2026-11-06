# OnlyFast Phase 2A — class icon optimization

Completed locally on November 5, 2026. No commit, push, application deployment, database operation, or Edge Function change was performed. Scope: 48 approved PNG assets and this report.

## Protected starting state

Primary checkout: `C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\onlyfast`. Current branch: `main`; starting HEAD: `3e5440947c8f20d13800f690c8f1aeb0249ac6a8`. Working tree was clean; remote `https://github.com/Apex88Vent/onlyfast.git` was fetched and `main...origin/main` had no ahead/behind divergence. No branch or worktree was created.

The existing production release was identified read-only as READY deployment `dpl_r6cXZXEWkCGxvwWsbWFLQfhV8xRo` (`onlyfast.app`). It was not changed. Phase 1 security, Supabase, OnlyLaps, subscriptions, Median/RevenueCat billing, advertising holds, UI, CSS, logo, advertising backgrounds, promotional artwork, dependencies and lockfile remain unchanged.

## Backup and recovery

Backup directory: [Original full-resolution artwork](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/icons/original-full-resolution-20261105-213500>).

[Backup manifest](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/icons/original-full-resolution-20261105-213500/manifest.json>) records each relative source path, absolute backup destination, dimensions, PNG format, original byte count and SHA-256. Manifest SHA-256: `6bd6e5735cb2b4f612f07e11cd09b9277046cd83283d256c08a66eb292c9ab07`.

All **48/48 raw copies matched their original SHA-256 before the first resize**. The entire source and backup collection was checked again immediately before optimization, and backup hashes were rechecked after optimization. Backups preserve the full `public/onlyfast-class-icons/...` relative directory structure. A new timestamped directory was created; no existing backup was overwritten. Full-resolution originals are 1024×1024 or 1254×1254 PNGs.

Recovery is file-only: copy any backed-up PNG from its `public/onlyfast-class-icons/...` path to the identical path in this checkout. No database recovery is involved. Keep the verified backup and manifest.

## Measurements

Sizes below are actual bytes, not the earlier audit estimate. MB uses 1,000,000 bytes; build sizes sum all deployable files without HTTP/archive compression or Vercel metadata.

| Measurement | Original | Optimized | Saved |
| --- | ---: | ---: | ---: |
| Class icons (48 PNGs) | 35,955,778 B (35.956 MB) | 602,021 B (0.602 MB) | 35,353,757 B (**98.33%**) |
| Local production web build (69 files) | 53,767,233 B (53.767 MB) | 18,413,476 B (18.413 MB) | 35,353,757 B (**65.75%**) |

**Total deployable bytes saved: 35,353,757 (35.354 MB).** Both fresh production-mode builds used the same checkout, dependencies and existing environment; only icon bytes differed. All **21 non-icon build files are byte-for-byte identical**, including JavaScript, CSS, HTML and other public artwork. Existing `dist` was not overwritten; build directories and file-level hash manifests are under `tmp/icon-tools/`.

## Dimensions, artwork and usage audit

All 48 assets are now **128×128 PNGs**. The production registry has 42 class keys/aliases, 84 variant references and 48 distinct URLs; every URL is represented in the backup and optimized output. No additional approved class image outside this directory was found in active registry references. Dirt oval, pavement oval, road racing and kart racing are covered, including all blue/white variants. Existing alias mappings and Lightning Sprint/Winged Sprint duplicate content and separate URLs were preserved and checked by hash.

Active image rendering is in `src/components/OnboardingFlow.tsx` and `src/components/HomeLanding.tsx`. Onboarding/class-selection images are 40×40 CSS pixels (the surrounding 64-pixel tile is not the image size). Landing/current-vehicle images are 24×24 on small screens and 32×32 at the desktop breakpoint. At the maximum 40 CSS pixels, DPR 3 requires 120 source pixels, within the 128-pixel target. No 256-pixel exception or upscaling was needed. Class changing uses text selection; setup screens have no independent larger class-PNG renderer. Legacy root-level onboarding references also use these existing URLs. No UI or registry changes were necessary.

Resampling used Sharp 0.34.5/libvips Lanczos3 with `fit: inside`, `withoutEnlargement: true`, full original canvas and no trimming, cropping, stretching, padding, sharpening, recoloring, background replacement or artwork generation. Output uses lossless truecolor PNG compression level 9 with adaptive filtering and no palette quantization. [Sharp resize documentation](https://sharp.pixelplumbing.com/api-resize/) and [PNG output documentation](https://sharp.pixelplumbing.com/api-output/) describe these options. Temporary standalone tooling was installed only under ignored `tmp/icon-tools`; application dependencies and lockfile were not changed.

Source images had no embedded ICC profiles. Unnecessary metadata was stripped; output was checked for absence of ICC/EXIF/XMP. All 9 source images with alpha retained alpha, and the other 39 remained opaque. All four corner alpha values were retained for every icon. Near-white texture in existing opaque source corners averages by at most 3/255 per color channel during resizing; no corner was painted or made opaque. Existing blue/white backgrounds, rounded tile artwork and visual margins remain intact. Resized pixels are not claimed to be bit-identical to full-resolution originals.

## Visual and asset verification

All 48 original/optimized pairs were visually inspected in three comparison sheets, at 40 CSS pixels at DPR 1 and at 120 device pixels representing 40 CSS pixels at DPR 3:

- [Comparison sheet 1](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/comparison-1.png>)
- [Comparison sheet 2](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/comparison-2.png>)
- [Comparison sheet 3](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/comparison-3.png>)

No visible change to class identity, vehicle proportions, composition, padding, backgrounds, rounded corners or legibility was observed at normal rendered sizes. No new white corners, gray borders, cropping, stretching or visible pixelation was observed.

A local-only comparison page was rendered using installed Chrome through temporary Playwright tooling. It served optimized images from the actual production build, never a live application session. For each configuration, all 48 icons were decoded at 24, 32 and 40 CSS pixels: **144 pairs / 288 image elements per configuration**, **432 pairs total**. Zero broken images, incorrect element dimensions, HTTP errors or browser page errors occurred.

| Configuration | Viewport / DPR | Result |
| --- | --- | --- |
| Desktop Chromium | 1440×1000 / 1 | Passed; [screenshot](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/desktop-chromium.png>) |
| Android-size Chromium layout simulation | 412×915 / 3, touch/mobile enabled | Passed; [screenshot](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/android-layout-simulation.png>) |
| iOS-size Chromium layout simulation | 390×844 / 3, touch/mobile enabled | Passed; [screenshot](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/ios-layout-simulation.png>) |

These are browser layout/density simulations and raster comparisons, **not physical-device, native Android WebView or iOS WebKit/WKWebView tests**. Native runtime verification remains unperformed. PNG format, URLs and CSS are unchanged. Browser canvas comparisons recorded worst mean RGBA channel differences of 2.623/255 at DPR 1 and 2.984/255 at DPR 3 across the compared icons/sizes; these quantify resampling differences, not exact pixel identity or a substitute for visual inspection.

[Detailed automated verification](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/verification.json>) includes all 48 corner/alpha checks and browser results. [Per-icon original/optimized hashes](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/results.json>) preserves both checksums for each icon. [Local comparison HTML](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tmp/icon-tools/comparison.html>) is retained as a preview template; its image routes require the temporary server in `verify.mjs`.

## Build and tests

| Check | Result |
| --- | --- |
| Every registry class/variant resolves to the original URL and correct built PNG hash | Passed: 42 keys, 84 references, 48 URLs |
| Full decode, 128×128 dimensions, aspect ratio, PNG format, alpha/metadata checks | Passed: 48/48 |
| Backup/source integrity and intentional duplicate preservation | Passed |
| All deployable paths and unchanged non-icon hashes | Passed: 69 files; exactly 48 icon files changed |
| `node --experimental-strip-types --test tests/setupLibrary.test.ts tests/racingVehicleAccess.test.ts` | **62 passed, 0 failed** |
| `npm run qa:smoke` (default local, mocked/isolated, non-production) | **69 passed, 0 failed, 0 skipped** |
| `tsc -p tsconfig.app.json --noEmit` | Passed |
| `tsc -p tsconfig.node.json --noEmit` | Passed |
| Fresh production-mode Vite builds, before and after, with existing release environment/output checks | Passed; existing chunk-size advisory (>500 KB) remains |
| Existing mounted onboarding suite `tests/onboardingNavigation.mjs` | **Blocked by existing harness error:** `Unstubbed dependency ./HouseAdPlacement` |

The mounted suite was first invoked without its required `REACT_TEST_RENDERER_MODULE`; after supplying the installed renderer path it reached the existing missing-stub error during component compilation, before test cases/image loading. The harness and all application source match the starting HEAD. It was not modified to hide the failure. Relevant registry/setup tests and the existing local QA smoke suite pass independently. Test output is retained in `tmp/icon-tools/{registry-tests.log,icon-tests-configured.log,qa-smoke.log,typescript-app.log,typescript-node.log}`.

No production authentication, paid AI/OCR, purchase, advertising, account reset, customer mutation, subscription change or provider call was triggered by these checks.

## Exact application files modified and per-icon comparison

The following 48 PNGs are the complete application-file change list. The only additional reviewable file is `ONLYFAST_ICON_OPTIMIZATION.md`. Public paths and filenames are unchanged. Each table row gives actual bytes, excluding filesystem allocation overhead.

| File | Original dimensions | Optimized dimensions | Original bytes | Optimized bytes | Bytes saved |
| --- | ---: | ---: | ---: | ---: | ---: |
| public/onlyfast-class-icons/dirt-late-model/dirt-late-model-blue.png | 1254×1254 | 128×128 | 313,462 | 7,772 | 305,690 |
| public/onlyfast-class-icons/dirt-late-model/dirt-late-model-white.png | 1254×1254 | 128×128 | 869,463 | 9,607 | 859,856 |
| public/onlyfast-class-icons/dwarf/dwarf-blue.png | 1254×1254 | 128×128 | 399,911 | 10,360 | 389,551 |
| public/onlyfast-class-icons/dwarf/dwarf-white.png | 1254×1254 | 128×128 | 903,352 | 11,304 | 892,048 |
| public/onlyfast-class-icons/lightning-sprint/lightning-sprint-blue.png | 1254×1254 | 128×128 | 626,861 | 13,058 | 613,803 |
| public/onlyfast-class-icons/lightning-sprint/lightning-sprint-white.png | 1254×1254 | 128×128 | 968,509 | 13,727 | 954,782 |
| public/onlyfast-class-icons/midget/midget-blue.png | 1254×1254 | 128×128 | 438,674 | 10,507 | 428,167 |
| public/onlyfast-class-icons/midget/midget-white.png | 1254×1254 | 128×128 | 923,070 | 11,533 | 911,537 |
| public/onlyfast-class-icons/modified/modified-blue.png | 1254×1254 | 128×128 | 444,790 | 9,911 | 434,879 |
| public/onlyfast-class-icons/modified/modified-white.png | 1254×1254 | 128×128 | 958,987 | 10,748 | 948,239 |
| public/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-blue.png | 1254×1254 | 128×128 | 531,554 | 10,701 | 520,853 |
| public/onlyfast-class-icons/non-wing-sprint/non-wing-sprint-white.png | 1254×1254 | 128×128 | 1,012,026 | 11,458 | 1,000,568 |
| public/onlyfast-class-icons/pavement-oval/legends/legends-blue.png | 1024×1024 | 128×128 | 858,120 | 17,827 | 840,293 |
| public/onlyfast-class-icons/pavement-oval/legends/legends-white.png | 1024×1024 | 128×128 | 781,257 | 13,263 | 767,994 |
| public/onlyfast-class-icons/pavement-oval/mini-stock-compact/mini-stock-compact-blue.png | 1024×1024 | 128×128 | 795,686 | 15,694 | 779,992 |
| public/onlyfast-class-icons/pavement-oval/mini-stock-compact/mini-stock-compact-white.png | 1024×1024 | 128×128 | 697,495 | 11,424 | 686,071 |
| public/onlyfast-class-icons/pavement-oval/pavement-late-model/pavement-late-model-blue.png | 1024×1024 | 128×128 | 799,822 | 15,331 | 784,491 |
| public/onlyfast-class-icons/pavement-oval/pavement-late-model/pavement-late-model-white.png | 1024×1024 | 128×128 | 684,037 | 10,872 | 673,165 |
| public/onlyfast-class-icons/pavement-oval/pavement-modified/pavement-modified-blue.png | 1024×1024 | 128×128 | 831,751 | 16,474 | 815,277 |
| public/onlyfast-class-icons/pavement-oval/pavement-modified/pavement-modified-white.png | 1024×1024 | 128×128 | 774,120 | 12,562 | 761,558 |
| public/onlyfast-class-icons/pavement-oval/stock-car-arca/stock-car-arca-blue.png | 1024×1024 | 128×128 | 844,474 | 14,519 | 829,955 |
| public/onlyfast-class-icons/pavement-oval/stock-car-arca/stock-car-arca-white.png | 1024×1024 | 128×128 | 920,693 | 10,653 | 910,040 |
| public/onlyfast-class-icons/pavement-oval/street-stock-sportsman/street-stock-sportsman-blue.png | 1024×1024 | 128×128 | 784,809 | 15,029 | 769,780 |
| public/onlyfast-class-icons/pavement-oval/street-stock-sportsman/street-stock-sportsman-white.png | 1024×1024 | 128×128 | 669,136 | 10,681 | 658,455 |
| public/onlyfast-class-icons/pure-stock/pure-stock-blue.png | 1254×1254 | 128×128 | 359,311 | 9,095 | 350,216 |
| public/onlyfast-class-icons/pure-stock/pure-stock-white.png | 1254×1254 | 128×128 | 887,183 | 10,522 | 876,661 |
| public/onlyfast-class-icons/road-course/go-karts/go-karts-blue.png | 1024×1024 | 128×128 | 802,486 | 15,894 | 786,592 |
| public/onlyfast-class-icons/road-course/go-karts/go-karts-white.png | 1024×1024 | 128×128 | 699,314 | 11,419 | 687,895 |
| public/onlyfast-class-icons/road-course/gt3/gt3-blue.png | 1024×1024 | 128×128 | 807,143 | 15,361 | 791,782 |
| public/onlyfast-class-icons/road-course/gt3/gt3-white.png | 1024×1024 | 128×128 | 756,911 | 12,457 | 744,454 |
| public/onlyfast-class-icons/road-course/gt4/gt4-blue.png | 1024×1024 | 128×128 | 848,772 | 15,611 | 833,161 |
| public/onlyfast-class-icons/road-course/gt4/gt4-white.png | 1024×1024 | 128×128 | 756,026 | 11,742 | 744,284 |
| public/onlyfast-class-icons/road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata-blue.png | 1024×1024 | 128×128 | 813,696 | 15,141 | 798,555 |
| public/onlyfast-class-icons/road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata-white.png | 1024×1024 | 128×128 | 714,757 | 11,657 | 703,100 |
| public/onlyfast-class-icons/road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula-blue.png | 1024×1024 | 128×128 | 760,837 | 13,070 | 747,767 |
| public/onlyfast-class-icons/road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula-white.png | 1024×1024 | 128×128 | 679,713 | 10,191 | 669,522 |
| public/onlyfast-class-icons/road-course/prototypes/prototypes-blue.png | 1024×1024 | 128×128 | 764,334 | 14,416 | 749,918 |
| public/onlyfast-class-icons/road-course/prototypes/prototypes-white.png | 1024×1024 | 128×128 | 725,578 | 11,468 | 714,110 |
| public/onlyfast-class-icons/road-course/touring-car-tcr/touring-car-tcr-blue.png | 1024×1024 | 128×128 | 824,227 | 15,570 | 808,657 |
| public/onlyfast-class-icons/road-course/touring-car-tcr/touring-car-tcr-white.png | 1024×1024 | 128×128 | 768,123 | 12,613 | 755,510 |
| public/onlyfast-class-icons/road-course/trans-am-ta2/trans-am-ta2-blue.png | 1024×1024 | 128×128 | 803,559 | 14,226 | 789,333 |
| public/onlyfast-class-icons/road-course/trans-am-ta2/trans-am-ta2-white.png | 1024×1024 | 128×128 | 736,774 | 11,281 | 725,493 |
| public/onlyfast-class-icons/road-course/winged-open-wheel-formula/winged-open-wheel-formula-blue.png | 1024×1024 | 128×128 | 776,113 | 14,109 | 762,004 |
| public/onlyfast-class-icons/road-course/winged-open-wheel-formula/winged-open-wheel-formula-white.png | 1024×1024 | 128×128 | 724,029 | 10,965 | 713,064 |
| public/onlyfast-class-icons/sport-compact/sport-compact-blue.png | 1254×1254 | 128×128 | 546,685 | 11,524 | 535,161 |
| public/onlyfast-class-icons/sport-compact/sport-compact-white.png | 1254×1254 | 128×128 | 972,778 | 11,889 | 960,889 |
| public/onlyfast-class-icons/winged-sprint/winged-sprint-blue.png | 1254×1254 | 128×128 | 626,861 | 13,058 | 613,803 |
| public/onlyfast-class-icons/winged-sprint/winged-sprint-white.png | 1254×1254 | 128×128 | 968,509 | 13,727 | 954,782 |

## Remaining issues and stopping point

No oversized icons remain: **0 above 30,000 bytes**; the largest is **17,827 bytes**. All 48 approved assets remain present.

The existing mounted onboarding harness failure and unperformed native-device/WebView checks are the verification limitations described above. No unrelated repair was attempted. No application behavior, UI styling, security policy, advertising or billing change was made. No commit, push or deployment was performed. Phase 2A stops here.
