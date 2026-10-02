# Pavement Oval setup refinement

Completed locally on October 1, 2026. The six existing development classes now use four focused schema definitions and the existing native setup form. No classes were added. No live account, database, authorization or deployment changes were made in this pass.

## 1. Exact files changed

Application files:

- `src/lib/pavementSetupSchemas.ts` — new field definitions and four schema bases.
- `src/lib/pavementSetupValues.ts` — one shared corner-weight calculator and legacy signed-toe normalization.
- `src/lib/setupLibrary.ts` — maps the existing six pavement IDs to those bases.
- `src/lib/setupLibraryStorage.ts` — applies pavement calculation/toe handling within the existing JSON serializer and hydrator.
- `src/lib/classConfigs.ts` — optional section layout and compound-input metadata; production definitions unchanged.
- `src/components/ChassisSetupForm.tsx` — reuses native CornerCard and toe controls; displays derived weights for pavement.

Verification files:

- `tests/pavementSetup.test.ts` — new exact field inventories, formulas, metadata, identity separation and old-snapshot compatibility tests.
- `tests/setupLibrary.test.ts` — wires the real form's new dependency into the existing form/serializer tests.
- `tests/onboardingNavigation.mjs` — six pavement landing-navigation tests and six mounted native-form persistence tests.
- `tests/setupLibraryDatabase.mjs` — pavement round trips and access denial against the actual migrations in isolated PostgreSQL.
- `docs/pavement-preview-desktop.png` — native desktop screenshot.
- `docs/pavement-preview-mobile.png` — native mobile corner-card screenshot.
- `docs/PAVEMENT_SETUP_REFINEMENT_REPORT.md` — this report.

The isolated preview also adds `pavement-preview.html` and `pavement-preview.tsx` outside the repository, under:

`C:/Users/c_mar/.codex/visualizations/2026/10/01/01a0f5f5-ecd1-7670-92ca-6296a57977b1/onlyfast-preview/`

Those two files are local verification fixtures, not application changes. Previously existing untracked preview files and sign-in screenshots were left untouched.

## 2–4. Exact classes, dedicated schemas and shared schemas

Class labels are also the existing canonical/internal class IDs and saved `race_class` strings. All six remain Development/Test Only.

| Canonical class ID | Schema base | Relationship | Declared field IDs |
| --- | --- | --- | ---: |
| Legends | pavementLegendsSchema | Dedicated | 47 |
| Pavement Late Model | pavementLateModelSchema | Shared with Stock Car / ARCA | 106 |
| Stock Car / ARCA | pavementLateModelSchema | Shared with Pavement Late Model | 106 |
| Pavement Modified | pavementModifiedSchema | Shared with Street Stock / Sportsman | 72 |
| Street Stock / Sportsman | pavementModifiedSchema | Shared with Pavement Modified | 72 |
| Mini Stock / Compact | pavementCompactSchema | Dedicated | 48 |

Counts include the separate machine-readable `front_toe_direction` companion for the one visible Toe control. Standard Notes are outside these schema inventories. Every requested field is represented; none was omitted. Tests compare exact IDs to independently transcribed requirements and also reject extra fields.

Shared bases are assembled into separate per-class configurations, field-group arrays and field metadata objects. Future class-specific additions, removals or overrides can use their own field groups without merging class IDs.

The registry still contains 11 production entries and 38 development entries, 49 overall. This task adds no setup schema families beyond the four intended pavement bases.

## 5. Sections for every schema

All four bases use this same native organization, followed by the existing shared Notes section:

1. General Chassis
2. Four Corners — Left Front (LF), Right Front (RF), Left Rear (LR), Right Rear (RR)
3. Front
4. Rear-End & Drivetrain
5. Notes

Legends General Chassis contains weights, peak RPM and stagger; corners contain the seven requested properties per corner; Front contains alignment and steering ratio; Rear contains panhard mounts, axle squareness and gearing.

Late Model / ARCA General Chassis contains weights/bite, front/rear brake bias, pad compound, final drive and tape; corners contain tire measurements/temperatures, springs, four damper channels, gas pressure and bump stops; Front contains alignment, sway bar, control-arm settings, Ackermann and spindle height; Rear contains track bar mounts, trailing arms/holes, third link, pinion angle and rear steer.

Modified / Sportsman General Chassis contains weights, brake bias, final drive and stagger; corners contain tires/temperatures, ride heights, weights, springs and compression/rebound valving; Front contains alignment, sway bar and upper-arm mounts; Rear contains panhard/J-bar mounts, lower-arm holes, pull bar/torque arm and pinion angle.

Compact General Chassis contains weights/front bias, transmission gear and final drive; corners contain tires, ride heights, weights, springs and strut/shock valving; Front contains alignment and front sway bar; Rear contains rear camber/toe, rear sway bar and spacers. Rear toe remains in degrees as requested, distinct from front toe in inches.

## 6. Flexible fields and representations

- Shock clicks/valving and strut valving use the existing text input convention so numeric clicks, codes and descriptions all fit.
- Bump-stop rate/color and brake pad compound are text values; no manufacturer-specific catalog is assumed.
- Sway-bar preload accepts text with turns/in unit metadata so either measurement can be stored.
- Control-arm angle/hole settings and upper-arm mount height/hole settings accept text with explicit deg/hole or in/hole metadata.
- Trailing-arm chassis/axle holes and third-link pinion hole are text, allowing a number, position or description.
- Ackermann accepts text with in/deg metadata because the requested representation permits either unit.
- Pull-bar spring rate/bushing durometer accepts text with lb/in/durometer metadata, supporting both suspension designs.
- Transmission gear is text, so `3rd`, `4th` or another actual gear can be saved.
- Front toe reuses Dwarf Cars' amount and In/Out selectors, including the existing fractional inch choices. Old signed decimal pavement values retain their precision and infer negative = In, positive = Out. An existing value outside the preset options remains available when reopened.

Other numeric-intent inputs follow the existing native decimal-input convention; values continue to serialize as strings. Definitions carry stable IDs, labels, sections, units where appropriate, value types, applicable class and category. Four-corner IDs retain the existing convention, such as `lf_cold_pressure` and `rf_corner_weight`.

## 7. Weight calculations

Inspection found manual weight fields in the active Dwarf Car and other setup sheets, but no existing corner-weight calculator to reuse. One new utility is shared by pavement display and save; existing classes' formulas and behavior are unchanged.

Let T = LF + RF + LR + RR:

| Field | Formula |
| --- | --- |
| Total weight | T |
| Cross weight, lb | RF + LR |
| Cross weight, % | 100 × (RF + LR) / T |
| Left side weight, % | 100 × (LF + LR) / T |
| Rear weight, % | 100 × (LR + RR) / T |
| Front weight bias, % | 100 × (LF + RF) / T |
| Rear bite, lb | LR − RR |

Only the summary fields requested for that schema are displayed and serialized. Front bias is in Compact; rear bite is in Late Model / ARCA. Results use up to two decimal places. All four corners must contain finite non-negative weights and a finite sum. Incomplete/invalid weights leave manual summary inputs available and preserve their values. A zero total calculates zero pounds/bite but leaves percentages manual, avoiding division by zero. Negative rear bite is valid. Derived values are read-only while measurable and save with the same values shown in the form.

No existing brake-bias derivation was found. Late Model / ARCA therefore retain the requested separate front and rear percentage inputs, without an invented complement calculation.

## 8. Native Dwarf Car formatting

The existing Dwarf Car `ChassisSetupForm` was inspected as the primary reference. Pavement reuses its actual `CornerCard`, fieldsets/legends, four-corner grid, cards, headers, typography, spacing, colors, input classes and compound Toe control. Corner cards are one column on mobile and two columns from the native desktop breakpoint. Other sections retain the established config-driven responsive grid. Sections remain ordinary cards, matching the current form's behavior.

There is no second pavement form engine. A baseline comparison confirmed all 43 non-pavement forms render identical static markup to the prior commit, including Dwarf Cars, with representative corner/toe data. A separate configuration comparison confirmed all 11 production definitions and all 32 non-pavement development definitions are unchanged.

Browser verification at 390 × 844 confirmed all six pavement forms stack corner cards and have no horizontal overflow. Desktop layout was inspected at 1280 × 900; screenshots preserve the native form. Browser console inspection reported no errors or warnings.

## 9. Persistence and compatibility

For each of the six classes, the real mounted form was exercised through representative entries from every section, save, unmount/leave, reopen, value verification, edit, resave, copy/rename and race creation from a base. These tests call the existing Base Setup and Setup Dashboard serializer/hydrator functions.

The isolated PostgreSQL test applies the repository's actual migrations, then inserts, reads, copies, renames and edits setup rows using those serializers. It verifies all snapshot fields, computed totals and class identities for the pavement sheets, alongside the other development classes and legacy row/access checks.

The browser independently exercised save → leave → reopen → edit → save → copy → rename → leave → reopen → create race from base for all six classes using the real native form and library serializer. The browser fixture uses an in-memory row store with a backend import that throws on access; these are local UI round trips, not live Supabase saves. Its preview action buttons are verification controls, not a redesign of the application workflow.

Storage remains `custom_fields.onlyfast_setup_library_v1`, version 1, with string values. No new database columns or migrations are needed. Unknown/retired fields from earlier snapshots survive edit/copy/serialization, even when no longer displayed by the refined schema. Tests cover older signed toe values, tire pressures, removed generic fields and future unknown fields. Reading does not rewrite old stored records.

## 10. Separate saved class identities

Both shared pairs retain their exact existing `race_class` identities in the setup row and JSON snapshot through base creation, copy, rename and race creation. Loading a Pavement Late Model snapshot as Stock Car / ARCA, or Modified as Sportsman, fails closed. A shared layout never converts a saved class ID into its partner.

## 11. Access and navigation

No authentication, subscription, test-account authorization, Rookie/Pro/Team rules, class cooldowns, production availability, onboarding navigation or class-change navigation code was changed. Existing experimental/test gating stays in place.

Tests verify normal Rookie, Pro, Team and admin accounts, personal beta accounts, missing flags and disabled test access remain blocked. The actual database guards reject pavement initialization, class changes and inserts for normal accounts. Existing cooldown and legacy setup row checks also pass.

For every pavement class, the actual navigation tests verify Discipline → Class → successful initialization → Landing Page, with no automatic setup creation or editor opening.

No Dirt Track, Road Course, Motorcycle, RC or Kart sheet definitions were modified. Ads, timing scan, schedules, OnlyLaps, telemetry, Setup Assist recommendation logic and race-weekend logic are untouched.

## 12. Build and verification results

- `npm test`: 301 passed, zero failures.
- Mounted/navigation suite `tests/onboardingNavigation.mjs`: 31 passed, zero failures.
- Isolated PostgreSQL suite `tests/setupLibraryDatabase.mjs`: passed; tests every development class and existing migration guards.
- Targeted ESLint across all six changed application files: passed with zero errors and zero warnings.
- TypeScript check with `--lib ES2021,DOM,DOM.Iterable`: passed. The library override accommodates the repository's pre-existing `String.replaceAll` usage; compiler configuration was not changed.
- `npm run build`: passed, 1,840 modules. The existing bundle-size advisory remains; no build errors.
- All six browser workflows: passed. All six mobile overflow/corner-layout checks: passed.
- Non-pavement baseline comparison: 43 forms identical; 43 configuration definitions unchanged.

Build artifacts: `dist/assets/main-DRUIpmMs.js` and `dist/assets/main-8UQMqduO.css`. The local preview is open at `http://127.0.0.1:8081/pavement-preview.html`. Frontend production deployment remains pending the user's manual GitHub push/deployment process.
