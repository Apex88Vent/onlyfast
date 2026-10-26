# Pavement Oval and Road Course icon integration

Prepared locally on branch `codex/pavement-road-icons`, from `main` commit `24cb6898`. No push, merge, deployment or store submission. Existing native, RevenueCat and staging branches/worktrees were preserved.

## Source files changed

- `src/lib/classIcons.ts` — shared version of the existing icon map, extended with approved asset paths and matching existing saved-class aliases. No class definitions were created or renamed.
- `src/components/OnboardingFlow.tsx` — use the shared resolver for blue class cards and the existing white disabled-card rendering; preserve existing fallback behavior for unrelated classes.
- `src/components/HomeLanding.tsx` — use the same resolver's white variant for Current Car / Change Class entry.
- `tests/setupLibrary.test.ts` — resolve the real shared icon module in the existing component harness.
- `tests/onboardingNavigation.mjs` — resolve the real shared icon module in the existing mounted harness.
- `docs/PAVEMENT_ROAD_ICON_INTEGRATION.md` — this report.

## Exact Pavement Oval mapping

Paths below are public URLs; files live at the same path under `public`.

| Existing internal key | Existing display label | Blue | White |
|---|---|---|---|
| `Legends` | Legends | `/onlyfast-class-icons/pavement-oval/legends/legends-blue.png` | `/onlyfast-class-icons/pavement-oval/legends/legends-white.png` |
| `Pavement Late Model` | Pavement Late Model | `/onlyfast-class-icons/pavement-oval/pavement-late-model/pavement-late-model-blue.png` | `/onlyfast-class-icons/pavement-oval/pavement-late-model/pavement-late-model-white.png` |
| `Pavement Modified` | Pavement Modified | `/onlyfast-class-icons/pavement-oval/pavement-modified/pavement-modified-blue.png` | `/onlyfast-class-icons/pavement-oval/pavement-modified/pavement-modified-white.png` |
| `Stock Car / ARCA` | Stock Car / ARCA | `/onlyfast-class-icons/pavement-oval/stock-car-arca/stock-car-arca-blue.png` | `/onlyfast-class-icons/pavement-oval/stock-car-arca/stock-car-arca-white.png` |
| `Street Stock / Sportsman` | Street Stock / Sportsman | `/onlyfast-class-icons/pavement-oval/street-stock-sportsman/street-stock-sportsman-blue.png` | `/onlyfast-class-icons/pavement-oval/street-stock-sportsman/street-stock-sportsman-white.png` |
| `Mini Stock / Compact` | Mini Stock / Compact | `/onlyfast-class-icons/pavement-oval/mini-stock-compact/mini-stock-compact-blue.png` | `/onlyfast-class-icons/pavement-oval/mini-stock-compact/mini-stock-compact-white.png` |

## Exact Road Course mapping

| Existing internal key | Existing display label | Blue | White |
|---|---|---|---|
| `road_spec_miata` | Mazda MX-5 / Spec Miata | `/onlyfast-class-icons/road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata-blue.png` | `/onlyfast-class-icons/road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata-white.png` |
| `road_gt3` | GT3 | `/onlyfast-class-icons/road-course/gt3/gt3-blue.png` | `/onlyfast-class-icons/road-course/gt3/gt3-white.png` |
| `road_gt4` | GT4 | `/onlyfast-class-icons/road-course/gt4/gt4-blue.png` | `/onlyfast-class-icons/road-course/gt4/gt4-white.png` |
| `road_prototypes` | Prototypes | `/onlyfast-class-icons/road-course/prototypes/prototypes-blue.png` | `/onlyfast-class-icons/road-course/prototypes/prototypes-white.png` |
| `road_formula_winged` | Winged Open-Wheel Formula | `/onlyfast-class-icons/road-course/winged-open-wheel-formula/winged-open-wheel-formula-blue.png` | `/onlyfast-class-icons/road-course/winged-open-wheel-formula/winged-open-wheel-formula-white.png` |
| `road_formula_non_winged` | Non-Winged Open-Wheel Formula | `/onlyfast-class-icons/road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula-blue.png` | `/onlyfast-class-icons/road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula-white.png` |
| `road_karts` | Go-Karts | `/onlyfast-class-icons/road-course/go-karts/go-karts-blue.png` | `/onlyfast-class-icons/road-course/go-karts/go-karts-white.png` |
| `road_legends` | Road Course Legends Car | `/onlyfast-class-icons/pavement-oval/legends/legends-blue.png` | `/onlyfast-class-icons/pavement-oval/legends/legends-white.png` |
| `road_tcr` | Touring Car / TCR | `/onlyfast-class-icons/road-course/touring-car-tcr/touring-car-tcr-blue.png` | `/onlyfast-class-icons/road-course/touring-car-tcr/touring-car-tcr-white.png` |
| `road_ta2` | Trans-Am / TA2 | `/onlyfast-class-icons/road-course/trans-am-ta2/trans-am-ta2-blue.png` | `/onlyfast-class-icons/road-course/trans-am-ta2/trans-am-ta2-white.png` |

Road Course Legends uses the **same registry entry and files** as Pavement Oval Legends. Both Road Course Legends files in the ZIP are byte-identical to their Pavement equivalents (SHA-256 comparison); no second design or redundant copy was added.

Matching older saved/class-change keys (GT3, GT4, Prototype, Touring Car, the existing Formula variants, Shifter Kart and Clutch Kart) point to the corresponding approved artwork through this same map. Existing keys and labels remain unchanged. Classes outside the supplied artwork scope retain their previous behavior.

## Every new PNG added (30)

- `public/onlyfast-class-icons/road-course/gt3/gt3-white.png`
- `public/onlyfast-class-icons/road-course/gt3/gt3-blue.png`
- `public/onlyfast-class-icons/road-course/winged-open-wheel-formula/winged-open-wheel-formula-blue.png`
- `public/onlyfast-class-icons/road-course/winged-open-wheel-formula/winged-open-wheel-formula-white.png`
- `public/onlyfast-class-icons/road-course/trans-am-ta2/trans-am-ta2-blue.png`
- `public/onlyfast-class-icons/road-course/trans-am-ta2/trans-am-ta2-white.png`
- `public/onlyfast-class-icons/road-course/go-karts/go-karts-blue.png`
- `public/onlyfast-class-icons/road-course/go-karts/go-karts-white.png`
- `public/onlyfast-class-icons/road-course/prototypes/prototypes-blue.png`
- `public/onlyfast-class-icons/road-course/prototypes/prototypes-white.png`
- `public/onlyfast-class-icons/road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula-blue.png`
- `public/onlyfast-class-icons/road-course/non-winged-open-wheel-formula/non-winged-open-wheel-formula-white.png`
- `public/onlyfast-class-icons/road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata-blue.png`
- `public/onlyfast-class-icons/road-course/mazda-mx5-spec-miata/mazda-mx5-spec-miata-white.png`
- `public/onlyfast-class-icons/road-course/gt4/gt4-white.png`
- `public/onlyfast-class-icons/road-course/gt4/gt4-blue.png`
- `public/onlyfast-class-icons/road-course/touring-car-tcr/touring-car-tcr-blue.png`
- `public/onlyfast-class-icons/road-course/touring-car-tcr/touring-car-tcr-white.png`
- `public/onlyfast-class-icons/pavement-oval/pavement-modified/pavement-modified-white.png`
- `public/onlyfast-class-icons/pavement-oval/pavement-modified/pavement-modified-blue.png`
- `public/onlyfast-class-icons/pavement-oval/pavement-late-model/pavement-late-model-white.png`
- `public/onlyfast-class-icons/pavement-oval/pavement-late-model/pavement-late-model-blue.png`
- `public/onlyfast-class-icons/pavement-oval/mini-stock-compact/mini-stock-compact-blue.png`
- `public/onlyfast-class-icons/pavement-oval/mini-stock-compact/mini-stock-compact-white.png`
- `public/onlyfast-class-icons/pavement-oval/stock-car-arca/stock-car-arca-white.png`
- `public/onlyfast-class-icons/pavement-oval/stock-car-arca/stock-car-arca-blue.png`
- `public/onlyfast-class-icons/pavement-oval/street-stock-sportsman/street-stock-sportsman-white.png`
- `public/onlyfast-class-icons/pavement-oval/street-stock-sportsman/street-stock-sportsman-blue.png`
- `public/onlyfast-class-icons/pavement-oval/legends/legends-blue.png`
- `public/onlyfast-class-icons/pavement-oval/legends/legends-white.png`

All 30 files were streamed directly from `onlyfast-pavement-road-icons-package.zip` and verified against the archive with SHA-256. No resizing, cropping, recoloring, redrawing, image generation or recompression occurred. Original PNG dimensions remain 1024 × 1024.

The Street Stock / Sportsman and Mini Stock / Compact files are the supplied corrected package versions, not older artwork; their side/body details were visually inspected. No side nerf bars were added or restored. Their archive bytes remain unchanged.

## Scope and preservation

- All 11 pre-existing Dirt icon mappings are identical to the original onboarding map, including Pro Stock/Pure Stock and Sport Mod reuse. All existing Dirt PNGs remain untouched.
- Existing image width/height classes, rounded corners, object-contain behavior, responsive classes, card layout, spacing, palette and logo are unchanged. Browser inspection confirmed onboarding class images render at 40 × 40 with object-fit contain and the desktop current-class icon at 32 × 32 with object-fit contain.
- Onboarding and HomeLanding were the only class-art consumers found. Change Class's selector, setup sheets, Saved Setups, base setups, race/schedule, settings/account and subscription views do not render these class PNGs. Their text/select/action/section icons and layouts were left unchanged; no new visual surfaces were introduced.
- Availability, Coming Soon behavior, tester/production gates, onboarding transitions, auth, subscriptions, Rookie/Pro/Teams, setup logic, navigation, timing/OCR, telemetry and OnlyLaps were not edited.
- No backend, schema, migration, environment, dependency or lockfile changes were made. No external customer data was used.

## Verification

| Check | Result |
|---|---|
| Production build | PASS (39.34 seconds); existing >500 kB bundle warning |
| App TypeScript check | PASS; baseline also passed |
| Unit tests | 362 passed, 0 failed |
| Existing mounted onboarding/navigation tests | 45 passed, 0 failed |
| Lint for all three edited production files | PASS |
| Full repository lint | Existing failure: 419 errors, 92 warnings, before and after; normalized messages/severities identical, no new findings |
| Archive SHA-256 copies / production build copies | PASS, byte-exact |
| Both variants for all 16 supplied classes | PASS, 32 class/variant checks, no Dwarf placeholder |
| Case-sensitive filesystem paths | PASS |
| PNG HTTP responses | PASS, all 32 references returned 200 and original PNG bytes |
| Actual component renders | PASS, all 16 onboarding card images and all 16 landing white-image references |
| Browser image decode | PASS, all six Pavement and ten Road images loaded at original dimensions |

The local visual review rendered the actual components with the production CSS and synthetic component state. It used no auth/billing/backend imports or live account operations. Screenshots and detailed hashes are ignored in `tmp/icon-integration/`: pavement-preview.png, road-preview.png, landing-preview.png, asset-verification.json and resolved-icons.json. Temporary preview files are excluded from the application release.
