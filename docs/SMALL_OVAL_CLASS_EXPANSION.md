# Current-version small oval class expansion

> Release update, November 19, 2026: Micro Sprint is now production-enabled; Quarter Midget, Junior Sprint and Mini Dwarf remain test-only. See [the production release report](MICRO_SPRINT_PRODUCTION_RELEASE.md) for deployed migrations, live verification and current status. The original preparation notes below describe the initial test-only snapshot.

Implemented locally on the primary checkout's main branch, based on origin/main at 46f7552a. The initially checked-out develop/onlyfast-2027 branch and its unpushed commit were preserved. No 2027 code was implemented. No commit, push, deployment, live migration or production release was performed.

## Canonical identity, disciplines and release state

| Label | Canonical race_class ID | Schema ID | Disciplines | Prepared availability |
| --- | --- | --- | --- | --- |
| Micro Sprint | micro_sprint | micro_sprint_v1 | Dirt Track Oval | Test-only |
| Quarter Midget | quarter_midget | quarter_midget_v1 | Dirt Track Oval and Pavement Oval | Test-only |
| Junior Sprint | junior_sprint | junior_sprint_v1 | Dirt Track Oval | Test-only |
| Mini Dwarf | mini_dwarf | mini_dwarf_v1 | Dirt Track Oval | Test-only |

All four are new identities on current main. They are absent from the unchanged mature CAR_CLASSES registry and are registered in the existing expanded setup library. No new class is production-visible or fully disabled. Until the frontend and migration are installed, these additions do not exist in the running production platform.

The earlier expanded classes were already released in current main; that state is preserved. New test-only access reuses the existing experimental tester designation plus test_account_full_access feature flag. Email, Rookie/Pro/Team tier and admin status do not grant this access. Disabled status is also supported and denies everyone.

SMALL_OVAL_RELEASE_STATUS has a separate entry for every class. The migration's onlyfast_small_oval_release_status function mirrors those entries. A later reviewed Micro Sprint activation changes only micro_sprint to production in both places, through a forward migration and compatible frontend release. It does not enable Quarter Midget, Junior Sprint, Mini Dwarf or change the older library's permissions. A disposable PostgreSQL test verifies this independent activation.

## Quarter Midget in two disciplines

One registry/config object has category dirt_oval as its fallback and categories [dirt_oval, pavement_oval]. Both selectors return quarter_midget. The setup-level surface field stores dirt or pavement independently per setup. Switching discipline entry points does not generate another class, storage key or saved-setup family.

The new onlyfast_class_supports_discipline helper accepts both memberships. Onboarding progress and completion use that membership check instead of requiring one exact primary discipline. Active onboarding discipline is retained by the existing account flow. Legacy single-discipline behavior is unchanged. The existing class-change API still uses a class's primary discipline as its fallback; the setup surface remains the authoritative record for dirt/pavement setup differences.

## Micro Sprint configuration and wing data

Every saved Micro Sprint setup must have micro_configuration = winged or non_winged. The form starts with an explicit choice; the serializer and database reject an absent/invalid mode. This is setup data, never a permanent account/class choice.

The wing section declares activeWhen { key: micro_configuration, value: winged }. In Non-Winged mode, exactly wing_angle is disabled, visibly gray, and retained on screen. An unselected configuration also leaves the wing controls inactive until Winged is selected. No speculative top-wing position, sideboard, nose-wing or slider fields were added to Micro Sprint.

No configuration-change effect deletes or resets wing data. The existing library snapshot serializes wing_angle in both modes. Switching back to Winged reactivates its previous value. Mounted React, native browser, serializer and PostgreSQL checks verify 24 degrees survives switching, save/reopen and copy. Future Setup Assist consumers can use the stable mode values and section applicability metadata; recommendation logic was not modified.

Micro Sprint and Lightning Sprints share the exact same class icon registry object, including the original blue and white asset paths. No images were created or duplicated and Lightning Sprint paths did not change.

## Shared architecture and calculations

The sheets use existing FieldDef, ClassConfig and ClassSection metadata, getClassConfig, expanded-library assembly, native CornerCard, responsive four-corner layout, changed-value highlighting, notes, base/race serializers and onlyfast_setup_library_v1 storage. Mature Dwarf Car and Lightning Sprint field definitions remain unchanged.

Reusable groups within smallOvalSetupSchemas.ts cover session context, weight percentages, measured weights, corner weights, stagger, ride heights, shock settings, cold/hot pressures, I/M/O temperatures, tire size/circumference, front alignment, spring rate and chain-drive sprockets/ratio. Each class receives distinct field metadata. No full-size Dwarf sheet is substituted for Mini Dwarf.

The existing calculatePavementWeights formula is reused only through an explicit Calculate weights action for the new sheets. Totals and percentages remain manually editable and save exactly as entered. The explicit Calculate gear ratio action uses rear sprocket / drive sprocket for Quarter Midget, Junior Sprint and Mini Dwarf. No mature class formulas or automatic save calculations were changed. Micro Sprint gearing remains flexible text because its source does not prescribe two sprocket inputs.

## Generalization and existing race/session systems

- Circumference / rollout uses one tire_circumference value in inches, following oval conventions; there is no duplicate tire-diameter value or automatic conversion.
- Coil spring rate is lb/in; mixed spring/bar specification stays free text so a bar diameter can be recorded with its unit. Axle diameter, toe fractions, block alignment, brand, engine, fuel map, governor status and clutch details remain flexible.
- Existing library session_track and session_name conventions are reused. session_date, track_condition and driver_name record the setup sheet's context, including a base sheet. These values do not create or replace scheduled-race identity, race dates, timing or results. The normal race header and session/result systems continue to operate independently.
- Cold/hot pressures and I/M/O temperatures are separate numeric channels. Quarter Midget shock bump/rebound remain optional text to allow clicks or valving descriptions. Junior nose-wing angle and mounting notch are separate values.
- Mini Dwarf records optional shock/spring equipment and a dedicated 212cc engine/clutch schema, with unrestricted engine/brand descriptions. Additional corner weights enable the optional weight calculator without forcing measured totals to change.
- Starts, finishes, car counts, laps, session results and paper-sheet bookkeeping were not duplicated in setup fields. Existing race/session/result features remain responsible for those records.
- Quarter Midget dirt/pavement differences are recorded in its setup-level surface field and flexible track condition, with one sheet and one identity.

## Saving and additive migration

The existing JSONB snapshot envelope remains version 1 with race_class and string-valued values. Schema IDs live in the class definitions; no separate incompatible serializer or new table columns were introduced. Existing unknown snapshot fields remain preserved by the existing serializer, and snapshots never hydrate into a different class.

The new migration was created with the Supabase CLI and tested twice for idempotency in disposable PostgreSQL. It adds the four IDs to the canonical/snapshot-class validation helpers, adds narrow per-class release checks and restrictive RLS, validates Micro configuration, protects direct active-class writes and filters SECURITY DEFINER setup summaries. It extends onboarding discipline membership without changing entitlement/cooldown calculations. No customer data or subscription/billing columns are rewritten. The staging manifest includes this migration after its prerequisites.

No hosted database was contacted or changed. Apply the migration with the matching frontend during the normal reviewed release process. Existing advertising/purchasing holds, stock Median paywall plan, pricing, entitlements, auth provider, OnlyLaps, Track Trace, telemetry, scan, schedule and Setup Assist recommendations remain unchanged.

## Verification

- Full application suite: 578 tests passed (includes the new independent field-inventory regression).
- Mounted navigation suite: 51 passed, including Micro, Junior, Mini and Quarter from both disciplines ending on landing after successful initialization. Explicit New Setup/Open Setup behavior remains covered by the same suite.
- Separate historical setup-library and current onboarding PostgreSQL suites: 2 passed. Their pre-small-oval fixtures explicitly leave the new migration to its dedicated PostgreSQL test.
- Dedicated small-oval PostgreSQL test covers all four base create/save/reopen/edit/copy/rename/race-from-base flows; both Quarter onboarding entry points; absent Micro configuration; configuration/wing persistence; legacy-row preservation; normal/Pro/Team/admin/personal tester denial; anonymous denial; ownership/sharing; test-access revocation; summaries; and independent Micro release.
- Existing serializer regressions cover every field for all four sheets through actual base/race save/load functions, JSON round trips and renamed copies; source rows stay unchanged. Cross-class snapshots remain isolated.
- Browser QA: all four real forms at 390px and 1440px have no horizontal overflow or page exceptions. Actual native disabled state, retained 24-degree wing value, reload/reopen and reactivation pass. Browser persistence uses local QA snapshots; hosted API/data behavior is covered separately by disposable PostgreSQL and actual serializers, not a live production account.
- TypeScript app check passed. Focused ESLint passed for new schema, access, storage and changed React components. React component review covered hook ordering, native disabled semantics, labels, state persistence and the existing responsive layout.
- Production build passed; Vite reports its existing large-chunk advisory.
- git diff --check passed. No push or deployment was triggered.

Browser evidence is generated under ignored tmp/small-oval; logs are local tmp-small-oval-*.log files. Run the browser script against a local Vite origin only. If Playwright is installed externally, supply ONLYFAST_PLAYWRIGHT_MODULE as in the existing QA conventions.

## Exact files changed

- src/lib/smallOvalSetupSchemas.ts
- src/lib/classConfigs.ts
- src/lib/setupLibrary.ts
- src/lib/setupLibraryAccess.ts
- src/lib/setupLibraryStorage.ts
- src/lib/classIcons.ts
- src/components/ChassisSetupForm.tsx
- src/components/ClassChangeModal.tsx
- supabase/migrations/20261119175239_add_small_oval_setup_classes.sql
- supabase/staging/plan.json
- qa/automation/small-oval-layout.mjs
- tests/smallOval.test.ts
- tests/smallOvalDatabase.test.ts
- tests/setupLibrary.test.ts
- tests/setupLibraryHarness.ts
- tests/setupLibraryDatabase.mjs
- tests/racingOnboardingDatabase.mjs
- tests/onboardingNavigation.mjs
- docs/SMALL_OVAL_CLASS_EXPANSION.md

## 2027 CARRY-FORWARD

Carry the current-version implementation forward later; no separate 2027 implementation was built here.

- src/lib/smallOvalSetupSchemas.ts: the four canonical IDs, schema IDs, dedicated groups, multi-discipline membership, setup-level configuration and surface, applicability metadata, and independent release entries.
- src/lib/classConfigs.ts: additive metadata (categories, schemaId, releaseStatus, required and activeWhen).
- src/lib/setupLibrary.ts: group/config registration and display labels.
- src/lib/setupLibraryAccess.ts: per-class production/test/disabled filtering and multi-discipline selectors, while preserving existing class availability.
- src/lib/setupLibraryStorage.ts: required Micro configuration validation. Preserve the existing version-1 class-bound snapshot envelope and disabled wing values.
- src/lib/classIcons.ts: shared Lightning/Micro blue and white icon mapping; use the existing image files.
- src/components/ChassisSetupForm.tsx: native disabled/gray wing section, explicit weight/ratio calculation actions and required configuration selector. Continue using CornerCard.
- src/components/ClassChangeModal.tsx: apply per-class release gating to the supplemental class list too.
- supabase/migrations/20261119175239_add_small_oval_setup_classes.sql: carry the canonical registrations, two-discipline membership checks, matching independent release states, RLS/trigger protections and filtered summaries. Reconcile with the 2027 migration sequence; do not blindly overwrite newer 2027 onboarding/security helpers.
- supabase/migrations/20261119182714_release_micro_sprint_production.sql: carry the independent Micro-only activation after the registration migration; preserve the destination’s existing subscription and library gates.
- supabase/staging/plan.json: retain equivalent migration sequencing in the destination's own reviewed staging plan.
- tests/smallOval.test.ts, tests/smallOvalDatabase.test.ts, tests/setupLibrary.test.ts, tests/setupLibraryHarness.ts, tests/setupLibraryDatabase.mjs, tests/racingOnboardingDatabase.mjs and tests/onboardingNavigation.mjs: carry regression coverage and reconcile historical fixtures against the destination migration history.
- qa/automation/small-oval-layout.mjs and this document: browser reproduction and release/carry-forward guidance.

## Micro Sprint sections and complete field inventory

Schema: micro_sprint_v1. Field keys are relative to values in the existing class-bound snapshot.

### General Chassis

Section ID: micro-general.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| micro_configuration | Configuration | select (required) | — |
| session_track | Track | text | — |
| track_condition | Track condition / surface | text | — |
| session_name | Event / session | text | — |
| session_date | Date | text | — |
| driver_name | Driver | text | — |
| total_weight | Total weight with driver (lb) | number | lb |
| left_side_pct | Left weight (%) | number | % |
| rear_weight_pct | Rear weight (%) | number | % |
| cross_weight | Cross weight (%) | number | % |
| front_stagger | Front stagger (in) | number | in |
| rear_stagger | Rear stagger (in) | number | in |

### Four Corners

Section ID: micro-corners; layout: four-corners.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| lf_spring_bar_rate | LF Spring / bar rate (lb/in / diameter (specify)) | text | lb/in / diameter (specify) |
| lf_block_height | LF Block height (in) | number | in |
| lf_ride_height | LF Frame rail ride height (in) | number | in |
| lf_corner_weight | LF Corner weight (lb) | number | lb |
| lf_shock_setting | LF Shock | text | — |
| lf_wheel_offset | LF Wheel offset (in) | number | in |
| lf_cold_pressure | LF Tire pressure — cold (psi) | number | psi |
| lf_hot_pressure | LF Tire pressure — hot (psi) | number | psi |
| lf_tire_compound | LF Tire compound | text | — |
| lf_tire_circumference | LF Tire circumference / rollout (in) | number | in |
| rf_spring_bar_rate | RF Spring / bar rate (lb/in / diameter (specify)) | text | lb/in / diameter (specify) |
| rf_block_height | RF Block height (in) | number | in |
| rf_ride_height | RF Frame rail ride height (in) | number | in |
| rf_corner_weight | RF Corner weight (lb) | number | lb |
| rf_shock_setting | RF Shock | text | — |
| rf_wheel_offset | RF Wheel offset (in) | number | in |
| rf_cold_pressure | RF Tire pressure — cold (psi) | number | psi |
| rf_hot_pressure | RF Tire pressure — hot (psi) | number | psi |
| rf_tire_compound | RF Tire compound | text | — |
| rf_tire_circumference | RF Tire circumference / rollout (in) | number | in |
| lr_spring_bar_rate | LR Spring / bar rate (lb/in / diameter (specify)) | text | lb/in / diameter (specify) |
| lr_block_height | LR Block height (in) | number | in |
| lr_ride_height | LR Frame rail ride height (in) | number | in |
| lr_corner_weight | LR Corner weight (lb) | number | lb |
| lr_shock_setting | LR Shock | text | — |
| lr_wheel_offset | LR Wheel offset (in) | number | in |
| lr_cold_pressure | LR Tire pressure — cold (psi) | number | psi |
| lr_hot_pressure | LR Tire pressure — hot (psi) | number | psi |
| lr_tire_compound | LR Tire compound | text | — |
| lr_tire_circumference | LR Tire circumference / rollout (in) | number | in |
| rr_spring_bar_rate | RR Spring / bar rate (lb/in / diameter (specify)) | text | lb/in / diameter (specify) |
| rr_block_height | RR Block height (in) | number | in |
| rr_ride_height | RR Frame rail ride height (in) | number | in |
| rr_corner_weight | RR Corner weight (lb) | number | lb |
| rr_shock_setting | RR Shock | text | — |
| rr_wheel_offset | RR Wheel offset (in) | number | in |
| rr_cold_pressure | RR Tire pressure — cold (psi) | number | psi |
| rr_hot_pressure | RR Tire pressure — hot (psi) | number | psi |
| rr_tire_compound | RR Tire compound | text | — |
| rr_tire_circumference | RR Tire circumference / rollout (in) | number | in |

### Front / Steering

Section ID: micro-front.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| front_panhard_height | Front panhard bar height (in) | number | in |
| lf_king_pin_angle | LF King pin angle (deg) | number | deg |
| lf_toe | LF Toe (+ out / − in) (in / fraction) | text | in / fraction |
| rf_king_pin_angle | RF King pin angle (deg) | number | deg |
| rf_toe | RF Toe (+ out / − in) (in / fraction) | text | in / fraction |

### Rear

Section ID: micro-rear.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| rear_panhard_height | Rear panhard bar height (in) | number | in |
| jacobs_ladder_height | Jacob’s ladder height (in) | number | in |

### Engine / Drivetrain

Section ID: micro-engine.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| engine_configuration | Engine | text | — |
| gearing | Gearing | text | — |
| exhaust_configuration | Exhaust | text | — |
| injection | Injection | text | — |
| fuel_pressure | Fuel pressure (psi) | number | psi |
| fuel_map | Fuel map | text | — |

### Wing

Section ID: micro-wing.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| wing_angle | Wing angle (deg) | number | deg |

## Quarter Midget sections and complete field inventory

Schema: quarter_midget_v1. Field keys are relative to values in the existing class-bound snapshot.

### General Chassis

Section ID: quarter-general.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| surface | Surface | select | — |
| session_track | Track | text | — |
| track_condition | Track condition / surface | text | — |
| session_name | Event / session | text | — |
| session_date | Date | text | — |
| driver_name | Driver | text | — |
| engine_configuration | Class / engine | text | — |
| ballast_weight | Ballast added (lb) | number | lb |
| total_weight | Total weight with driver (lb) | number | lb |
| left_side_pct | Left weight (%) | number | % |
| rear_weight_pct | Rear weight (%) | number | % |
| cross_weight | Cross weight (%) | number | % |
| left_weight | Left weight (lb) | number | lb |
| rear_weight | Rear weight (lb) | number | lb |
| front_stagger | Front stagger (in) | number | in |
| rear_stagger | Rear stagger (in) | number | in |
| toe_out | Toe-out (in / fraction) | text | in / fraction |

### Four Corners

Section ID: quarter-corners; layout: four-corners.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| lf_torsion_bar | LF Shock / torsion bar diameter / rate | text | — |
| lf_shock_setting | LF Shock brand / valving | text | — |
| lf_compression | LF Shock bump (clicks / setting) | text | clicks / setting |
| lf_rebound | LF Shock rebound (clicks / setting) | text | clicks / setting |
| lf_spring_rate | LF Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| lf_ride_height | LF Frame rail ride height (in) | number | in |
| lf_corner_weight | LF Corner weight (lb) | number | lb |
| lf_tire_size | LF Tire size / brand | text | — |
| lf_tire_compound | LF Tire compound / tread | text | — |
| lf_tire_circumference | LF Tire circumference / rollout (in) | number | in |
| lf_cold_pressure | LF Tire pressure — cold (psi) | number | psi |
| lf_hot_pressure | LF Tire pressure — hot (psi) | number | psi |
| lf_temperature_inner | LF Tire temperature — inside (°F) | number | °F |
| lf_temperature_middle | LF Tire temperature — middle (°F) | number | °F |
| lf_temperature_outer | LF Tire temperature — outside (°F) | number | °F |
| lf_wheel_offset | LF Spindle / wheel spacer / offset (in) | number | in |
| lf_radius_rod_chassis_hole | LF Radius rod chassis mounting hole | text | — |
| lf_radius_rod_axle_hole | LF Radius rod axle mounting hole | text | — |
| rf_torsion_bar | RF Shock / torsion bar diameter / rate | text | — |
| rf_shock_setting | RF Shock brand / valving | text | — |
| rf_compression | RF Shock bump (clicks / setting) | text | clicks / setting |
| rf_rebound | RF Shock rebound (clicks / setting) | text | clicks / setting |
| rf_spring_rate | RF Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| rf_ride_height | RF Frame rail ride height (in) | number | in |
| rf_corner_weight | RF Corner weight (lb) | number | lb |
| rf_tire_size | RF Tire size / brand | text | — |
| rf_tire_compound | RF Tire compound / tread | text | — |
| rf_tire_circumference | RF Tire circumference / rollout (in) | number | in |
| rf_cold_pressure | RF Tire pressure — cold (psi) | number | psi |
| rf_hot_pressure | RF Tire pressure — hot (psi) | number | psi |
| rf_temperature_inner | RF Tire temperature — inside (°F) | number | °F |
| rf_temperature_middle | RF Tire temperature — middle (°F) | number | °F |
| rf_temperature_outer | RF Tire temperature — outside (°F) | number | °F |
| rf_wheel_offset | RF Spindle / wheel spacer / offset (in) | number | in |
| rf_radius_rod_chassis_hole | RF Radius rod chassis mounting hole | text | — |
| rf_radius_rod_axle_hole | RF Radius rod axle mounting hole | text | — |
| lr_torsion_bar | LR Shock / torsion bar diameter / rate | text | — |
| lr_shock_setting | LR Shock brand / valving | text | — |
| lr_compression | LR Shock bump (clicks / setting) | text | clicks / setting |
| lr_rebound | LR Shock rebound (clicks / setting) | text | clicks / setting |
| lr_spring_rate | LR Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| lr_ride_height | LR Frame rail ride height (in) | number | in |
| lr_corner_weight | LR Corner weight (lb) | number | lb |
| lr_tire_size | LR Tire size / brand | text | — |
| lr_tire_compound | LR Tire compound / tread | text | — |
| lr_tire_circumference | LR Tire circumference / rollout (in) | number | in |
| lr_cold_pressure | LR Tire pressure — cold (psi) | number | psi |
| lr_hot_pressure | LR Tire pressure — hot (psi) | number | psi |
| lr_temperature_inner | LR Tire temperature — inside (°F) | number | °F |
| lr_temperature_middle | LR Tire temperature — middle (°F) | number | °F |
| lr_temperature_outer | LR Tire temperature — outside (°F) | number | °F |
| lr_wheel_offset | LR Spindle / wheel spacer / offset (in) | number | in |
| lr_radius_rod_chassis_hole | LR Radius rod chassis mounting hole | text | — |
| lr_radius_rod_axle_hole | LR Radius rod axle mounting hole | text | — |
| rr_torsion_bar | RR Shock / torsion bar diameter / rate | text | — |
| rr_shock_setting | RR Shock brand / valving | text | — |
| rr_compression | RR Shock bump (clicks / setting) | text | clicks / setting |
| rr_rebound | RR Shock rebound (clicks / setting) | text | clicks / setting |
| rr_spring_rate | RR Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| rr_ride_height | RR Frame rail ride height (in) | number | in |
| rr_corner_weight | RR Corner weight (lb) | number | lb |
| rr_tire_size | RR Tire size / brand | text | — |
| rr_tire_compound | RR Tire compound / tread | text | — |
| rr_tire_circumference | RR Tire circumference / rollout (in) | number | in |
| rr_cold_pressure | RR Tire pressure — cold (psi) | number | psi |
| rr_hot_pressure | RR Tire pressure — hot (psi) | number | psi |
| rr_temperature_inner | RR Tire temperature — inside (°F) | number | °F |
| rr_temperature_middle | RR Tire temperature — middle (°F) | number | °F |
| rr_temperature_outer | RR Tire temperature — outside (°F) | number | °F |
| rr_wheel_offset | RR Spindle / wheel spacer / offset (in) | number | in |
| rr_radius_rod_chassis_hole | RR Radius rod chassis mounting hole | text | — |
| rr_radius_rod_axle_hole | RR Radius rod axle mounting hole | text | — |
| lf_camber | LF Camber (deg) | number | deg |
| lf_caster | LF Caster (deg) | number | deg |
| rf_camber | RF Camber (deg) | number | deg |
| rf_caster | RF Caster (deg) | number | deg |
| lr_axle_lead_lag | LR axle lead / lag relative to RF (in) | number | in |
| rr_axle_position | RR axle position / block alignment | text | — |

### Engine / Drive

Section ID: quarter-drive.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| clutch_type | Clutch type / brand | text | — |
| clutch_engagement_rpm | Clutch engagement (rpm) | number | rpm |
| front_sprocket | Engine / clutch drive sprocket (teeth) | number | teeth |
| rear_sprocket | Rear axle sprocket (teeth) | number | teeth |
| final_drive | Final drive ratio | number | — |
| chain_slack | Chain tension / slack (in / fraction) | text | in / fraction |
| fuel_type | Fuel type | text | — |

## Junior Sprint sections and complete field inventory

Schema: junior_sprint_v1. Field keys are relative to values in the existing class-bound snapshot.

### General Chassis

Section ID: junior-general.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| session_track | Track | text | — |
| track_condition | Track condition / surface | text | — |
| session_name | Event / session | text | — |
| session_date | Date | text | — |
| driver_name | Driver | text | — |
| ambient_temperature | Ambient temperature (°F) | number | °F |
| humidity | Humidity (%) | number | % |
| total_weight | Total weight with driver (lb) | number | lb |
| left_side_pct | Left weight (%) | number | % |
| rear_weight_pct | Rear weight (%) | number | % |
| cross_weight | Cross weight (%) | number | % |
| left_weight | Left weight (lb) | number | lb |
| rear_weight | Rear weight (lb) | number | lb |
| front_ride_height | Front ride height (in) | number | in |
| rear_ride_height | Rear ride height (in) | number | in |
| front_stagger | Front stagger (in) | number | in |
| rear_stagger | Rear stagger (in) | number | in |

### Four Corners

Section ID: junior-corners; layout: four-corners.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| lf_shock_setting | LF Shock brand / valving | text | — |
| lf_compression | LF Shock bump (clicks / setting) | text | clicks / setting |
| lf_rebound | LF Shock rebound (clicks / setting) | text | clicks / setting |
| lf_spring_rate | LF Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| lf_corner_weight | LF Corner weight (lb) | number | lb |
| lf_cold_pressure | LF Tire pressure — cold (psi) | number | psi |
| lf_hot_pressure | LF Tire pressure — hot (psi) | number | psi |
| lf_tire_circumference | LF Tire circumference / rollout (in) | number | in |
| lf_temperature_inner | LF Tire temperature — inside (°F) | number | °F |
| lf_temperature_middle | LF Tire temperature — middle (°F) | number | °F |
| lf_temperature_outer | LF Tire temperature — outside (°F) | number | °F |
| rf_shock_setting | RF Shock brand / valving | text | — |
| rf_compression | RF Shock bump (clicks / setting) | text | clicks / setting |
| rf_rebound | RF Shock rebound (clicks / setting) | text | clicks / setting |
| rf_spring_rate | RF Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| rf_corner_weight | RF Corner weight (lb) | number | lb |
| rf_cold_pressure | RF Tire pressure — cold (psi) | number | psi |
| rf_hot_pressure | RF Tire pressure — hot (psi) | number | psi |
| rf_tire_circumference | RF Tire circumference / rollout (in) | number | in |
| rf_temperature_inner | RF Tire temperature — inside (°F) | number | °F |
| rf_temperature_middle | RF Tire temperature — middle (°F) | number | °F |
| rf_temperature_outer | RF Tire temperature — outside (°F) | number | °F |
| lr_shock_setting | LR Shock brand / valving | text | — |
| lr_compression | LR Shock bump (clicks / setting) | text | clicks / setting |
| lr_rebound | LR Shock rebound (clicks / setting) | text | clicks / setting |
| lr_spring_rate | LR Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| lr_corner_weight | LR Corner weight (lb) | number | lb |
| lr_cold_pressure | LR Tire pressure — cold (psi) | number | psi |
| lr_hot_pressure | LR Tire pressure — hot (psi) | number | psi |
| lr_tire_circumference | LR Tire circumference / rollout (in) | number | in |
| lr_temperature_inner | LR Tire temperature — inside (°F) | number | °F |
| lr_temperature_middle | LR Tire temperature — middle (°F) | number | °F |
| lr_temperature_outer | LR Tire temperature — outside (°F) | number | °F |
| rr_shock_setting | RR Shock brand / valving | text | — |
| rr_compression | RR Shock bump (clicks / setting) | text | clicks / setting |
| rr_rebound | RR Shock rebound (clicks / setting) | text | clicks / setting |
| rr_spring_rate | RR Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| rr_corner_weight | RR Corner weight (lb) | number | lb |
| rr_cold_pressure | RR Tire pressure — cold (psi) | number | psi |
| rr_hot_pressure | RR Tire pressure — hot (psi) | number | psi |
| rr_tire_circumference | RR Tire circumference / rollout (in) | number | in |
| rr_temperature_inner | RR Tire temperature — inside (°F) | number | °F |
| rr_temperature_middle | RR Tire temperature — middle (°F) | number | °F |
| rr_temperature_outer | RR Tire temperature — outside (°F) | number | °F |
| lf_camber | LF Camber (deg) | number | deg |
| lf_caster | LF Caster (deg) | number | deg |
| lf_radius_rod_top_angle | LF Top radius rod angle (deg) | number | deg |
| lf_radius_rod_bottom_angle | LF Bottom radius rod angle (deg) | number | deg |
| rf_camber | RF Camber (deg) | number | deg |
| rf_caster | RF Caster (deg) | number | deg |
| rf_radius_rod_top_angle | RF Top radius rod angle (deg) | number | deg |
| rf_radius_rod_bottom_angle | RF Bottom radius rod angle (deg) | number | deg |
| lr_torsion_stop | LR Torsion bar stop setting (turns) | text | turns |
| lr_axle_spacer | LR Axle spacer thickness (in) | number | in |
| lr_birdcage_upper_hole | LR Upper birdcage mounting hole | text | — |
| lr_birdcage_lower_hole | LR Lower birdcage mounting hole | text | — |
| rr_torsion_stop | RR Torsion bar stop setting (turns) | text | turns |
| rr_axle_spacer | RR Axle spacer thickness (in) | number | in |
| rr_birdcage_upper_hole | RR Upper birdcage mounting hole | text | — |
| rr_birdcage_lower_hole | RR Lower birdcage mounting hole | text | — |

### Wing

Section ID: junior-wing.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| top_wing_angle | Top wing angle (deg) | number | deg |
| top_wing_position | Top wing position from rear post (in) | number | in |
| nose_wing_angle | Nose wing angle (deg) | number | deg |
| nose_wing_notch | Nose wing mounting notch | text | — |

### Suspension Geometry / Panhard

Section ID: junior-geometry.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| front_axle_width | Front axle width (in) | number | in |
| front_axle_offset | Front axle offset (in) | number | in |
| front_panhard_chassis_height | Front panhard chassis height (in) | number | in |
| front_panhard_axle_height | Front panhard axle height (in) | number | in |
| rear_panhard_chassis_height | Rear panhard chassis height (in) | number | in |
| rear_panhard_axle_height | Rear panhard axle height (in) | number | in |
| ackermann | Steering rack center / Ackermann setting | text | — |

### Drivetrain / Engine

Section ID: junior-drive.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| engine_configuration | Engine type | text | — |
| clutch_type | Clutch / torque converter type | text | — |
| clutch_setting | Clutch springs / weights | text | — |
| front_sprocket | Engine / clutch drive sprocket (teeth) | number | teeth |
| rear_sprocket | Rear axle sprocket (teeth) | number | teeth |
| final_drive | Final drive ratio | number | — |
| chain_size | Chain size | text | — |
| rear_brake_bias | Rear brake bias (%) | number | % |

## Mini Dwarf sections and complete field inventory

Schema: mini_dwarf_v1. Field keys are relative to values in the existing class-bound snapshot.

### General Chassis

Section ID: mini-general.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| session_track | Track | text | — |
| track_condition | Track condition / surface | text | — |
| session_name | Event / session | text | — |
| session_date | Date | text | — |
| driver_name | Driver | text | — |
| total_weight | Total weight with driver (lb) | number | lb |
| left_side_pct | Left weight (%) | number | % |
| rear_weight_pct | Rear weight (%) | number | % |
| cross_weight | Cross weight (%) | number | % |
| left_weight | Left weight (lb) | number | lb |
| rear_weight | Rear weight (lb) | number | lb |
| minimum_class_weight | Minimum class weight limit (lb) | number | lb |
| front_weight | Front weight (lb) | number | lb |
| front_weight_pct | Front weight (%) | number | % |
| right_weight | Right weight (lb) | number | lb |
| right_weight_pct | Right weight (%) | number | % |
| nose_height | Frame nose height (in) | number | in |
| tail_height | Frame tail height (in) | number | in |
| front_stagger | Front stagger (in) | number | in |
| rear_stagger | Rear stagger (in) | number | in |
| toe_out | Toe-out (in / fraction) | text | in / fraction |

### Four Corners

Section ID: mini-corners; layout: four-corners.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| lf_shock_setting | LF Shock (if equipped) | text | — |
| lf_spring_rate | LF Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| lf_corner_weight | LF Corner weight (lb) | number | lb |
| lf_tire_size | LF Tire size / brand | text | — |
| lf_tire_compound | LF Tire compound / tread | text | — |
| lf_tire_circumference | LF Tire circumference / rollout (in) | number | in |
| lf_cold_pressure | LF Tire pressure — cold (psi) | number | psi |
| lf_hot_pressure | LF Tire pressure — hot (psi) | number | psi |
| lf_temperature_inner | LF Tire temperature — inside (°F) | number | °F |
| lf_temperature_middle | LF Tire temperature — middle (°F) | number | °F |
| lf_temperature_outer | LF Tire temperature — outside (°F) | number | °F |
| rf_shock_setting | RF Shock (if equipped) | text | — |
| rf_spring_rate | RF Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| rf_corner_weight | RF Corner weight (lb) | number | lb |
| rf_tire_size | RF Tire size / brand | text | — |
| rf_tire_compound | RF Tire compound / tread | text | — |
| rf_tire_circumference | RF Tire circumference / rollout (in) | number | in |
| rf_cold_pressure | RF Tire pressure — cold (psi) | number | psi |
| rf_hot_pressure | RF Tire pressure — hot (psi) | number | psi |
| rf_temperature_inner | RF Tire temperature — inside (°F) | number | °F |
| rf_temperature_middle | RF Tire temperature — middle (°F) | number | °F |
| rf_temperature_outer | RF Tire temperature — outside (°F) | number | °F |
| lr_shock_setting | LR Shock (if equipped) | text | — |
| lr_spring_rate | LR Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| lr_corner_weight | LR Corner weight (lb) | number | lb |
| lr_tire_size | LR Tire size / brand | text | — |
| lr_tire_compound | LR Tire compound / tread | text | — |
| lr_tire_circumference | LR Tire circumference / rollout (in) | number | in |
| lr_cold_pressure | LR Tire pressure — cold (psi) | number | psi |
| lr_hot_pressure | LR Tire pressure — hot (psi) | number | psi |
| lr_temperature_inner | LR Tire temperature — inside (°F) | number | °F |
| lr_temperature_middle | LR Tire temperature — middle (°F) | number | °F |
| lr_temperature_outer | LR Tire temperature — outside (°F) | number | °F |
| rr_shock_setting | RR Shock (if equipped) | text | — |
| rr_spring_rate | RR Spring rate (if coil-over / equipped) (lb/in) | number | lb/in |
| rr_corner_weight | RR Corner weight (lb) | number | lb |
| rr_tire_size | RR Tire size / brand | text | — |
| rr_tire_compound | RR Tire compound / tread | text | — |
| rr_tire_circumference | RR Tire circumference / rollout (in) | number | in |
| rr_cold_pressure | RR Tire pressure — cold (psi) | number | psi |
| rr_hot_pressure | RR Tire pressure — hot (psi) | number | psi |
| rr_temperature_inner | RR Tire temperature — inside (°F) | number | °F |
| rr_temperature_middle | RR Tire temperature — middle (°F) | number | °F |
| rr_temperature_outer | RR Tire temperature — outside (°F) | number | °F |

### Front Suspension / Steering

Section ID: mini-front.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| lf_camber | LF Camber (deg) | number | deg |
| lf_caster | LF Caster (deg) | number | deg |
| rf_camber | RF Camber (deg) | number | deg |
| rf_caster | RF Caster (deg) | number | deg |
| front_track_width | Front track width (in) | number | in |
| steering_arm_hole | Steering arm attachment hole / Ackermann | text | — |

### Rear Suspension / Axle

Section ID: mini-rear.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| rear_axle_diameter | Rear axle diameter (in / fraction) | text | in / fraction |
| rear_track_width | Rear track width (in) | number | in |
| rear_axle_squareness | Rear axle squareness to frame (in / reference) | text | in / reference |
| cassette_position | Cassette bearing lock / frame hole position | text | — |

### 212cc Engine / Clutch Drive

Section ID: mini-drive.

| Internal ID | Display label | Value type | Unit |
| --- | --- | --- | --- |
| engine_configuration | Engine model | text | — |
| governor_status | Governor status | text | — |
| main_jet | Main jet size | text | — |
| pilot_jet | Pilot jet size | text | — |
| air_filter | Air filter / velocity stack | text | — |
| exhaust_configuration | Exhaust pipe | text | — |
| clutch_type | Centrifugal clutch brand | text | — |
| front_sprocket | Engine / clutch drive sprocket (teeth) | number | teeth |
| rear_sprocket | Rear axle sprocket (teeth) | number | teeth |
| final_drive | Final drive ratio | number | — |
| clutch_setting | Clutch engagement springs / color / lockup RPM | text | — |

