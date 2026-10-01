# OnlyFast development setup library

**October 1 live update:** the Custom Car prerequisite, development-library migration and designated-account repair are now applied to the verified production Supabase project. All 36 live server class checks passed, six real-account QA setups persisted, and normal accounts remain blocked. See [the current deployment report](LIVE_SETUP_LIBRARY_DEPLOYMENT_REPORT.md). The frontend is ready for a manual GitHub push; production browser verification is still pending. The implementation record below describes the earlier local pass.

Implemented September 30, 2026. **36 new setup sheets**, using the existing experimental-account gate. These are development definitions with blank values.

## Verification and deployment status

- Production build passes.
- 287 project tests pass, including 42 setup-library tests.
- An additional real PostgreSQL test passes using PGlite, the repository migrations, and the actual application serializers/loaders. All 36 sheets were created, saved, reopened, copied, renamed, edited, and used for base/race/heat setups in the isolated database.
- Automated UI and authorization tests deny normal Rookie, Pro, Team, admin, personal-beta, missing-flag, disabled-flag and disabled-master-switch access.
- Database tests deny normal-account creation/read and public-share access, block direct development active-class writes, and preserve production cooldowns. The experimental account keeps the existing bypass.
- Existing dirt forms render in regression tests; the isolated migration leaves a legacy saved row unchanged; Custom Car regression tests pass.
- The local browser's already signed-in account passes the existing test gate and displays all 36 additions in its class selector.
- A live Legends class-change attempt returned “That class is not available.” **The live backend still needs the new migration.** Its active class remained Dwarf Cars.
- The existing live Dwarf Cars base setup “Dry slick” reopened with its saved values: cross weight 50, front height 5 1/2 inches, rear height 5 5/8 inches, and populated four-corner settings. No live setup edits were made.
- Live create/save/reopen of NEW classes remains pending migration application and a signed-in Supabase project session. Local PostgreSQL verification is not live deployment.
- The default TypeScript command encounters the pre-existing `HandlingFeedback.tsx:91` replaceAll/ES2020 library error. Type checking with `--lib ES2021,DOM,DOM.Iterable` passes. No unrelated compiler settings or handling-feedback code were changed.

## Audit: categories and classes

The running app uses `src/main.tsx`, `src/components` and `src/lib`. Root-level TSX copies and `supabase/src` contain older parallel copies; they are not the Vite application entry and were not refactored. The audit searched those copies, public class icons, SQL bootstrap/configuration, migrations and setup/save/share/comparison/assist paths.

No separate database category/class catalog is defined in the repository. The class allowlist is a SQL function. A live database taxonomy outside the repository's SQL definitions was not introspected.

| Category key | Existing UI name | Previous status |
|---|---|---|
| dirt_oval | Dirt Track Oval | Production discipline |
| pavement_oval | Pavement Oval | Coming Soon; experimental bypass |
| road_course | Road Course | Coming Soon; experimental bypass |
| motorcycle | Motorcycle | Coming Soon; experimental bypass; description includes flat track, motocross and road racing |
| rc | RC | Coming Soon; experimental bypass |

Open Wheel Road Racing uses the `open_wheel` family under Road Course, retaining the existing five disciplines.

Every existing class:

| Class | Previous setup definition | Production selectable at task start |
|---|---|---|
| Custom Car | User-defined six-section sheet; pre-existing unfinished work preserved | Yes |
| Dwarf Cars | Named class configuration, preserved | Yes |
| Late Model | Named class configuration, preserved | No; existing Coming Soon / test bypass |
| Lightning Sprints | Named class configuration, preserved | Yes |
| Midgets | Named class configuration, preserved | No; existing Coming Soon / test bypass |
| Modified | Purpose-built modified sheet, shared by Modified / Sport Mod | Yes |
| Non-Wing Sprint Cars | Named class configuration, preserved | No; existing Coming Soon / test bypass |
| Pro Stock | Purpose-built stock sheet, shared by Pro Stock / Pure Stock | Yes |
| Pure Stock | Purpose-built stock sheet, shared by Pro Stock / Pure Stock | Yes |
| Sport Compact | Named class configuration, preserved | No; existing Coming Soon / test bypass |
| Sport Mod | Purpose-built modified sheet, shared by Modified / Sport Mod | Yes |

Winged Sprint Cars also existed in the icon registry, but had no selectable class identity or configuration. It now has a development-only sheet.

Late Model, Midgets, Non-Wing Sprint Cars and Sport Compact already had named configurations despite being locked in production. They were not duplicated or replaced. Other dirt configurations also reuse some standard groups; this task preserves them.

**Missing:** all six pavement, seven sports-car road, nine open-wheel road, seven motorcycle and six RC definitions listed below. Winged Sprint Cars was an icon-only reference without a sheet. Previously, test-account non-dirt onboarding displayed dirt classes; unresolved class names used the Dwarf Cars fallback.

No repository-defined kart, drag, rally, rallycross, UTV, trophy truck, drift, hill-climb or autocross categories were found. None were implemented. There were no additional SQL-defined categories that were hidden from the UI.

## Every new sheet and its reusable sections

Each row lists exact reusable group IDs. The next section expands every group into its section name, important fields, machine IDs, types and units. Every class has a separate ClassConfig and cloned field metadata for future overrides.

| Class | Category / family | Reusable sections and components |
|---|---|---|
| Legends | Pavement Oval / oval | `session`, `ovalWeights`, `fourCornerTires`, `ovalTires`, `ovalCorners`, `ovalAlignment`, `legendsChassis`, `rearSuspensionOval`, `ovalDifferential`, `gearing`, `brakes` |
| Pavement Late Model | Pavement Oval / oval | `session`, `ovalWeights`, `fourCornerTires`, `ovalTires`, `ovalCorners`, `ovalAlignment`, `ovalChassis`, `bumpStops`, `rearSuspensionOval`, `ovalDifferential`, `gearing`, `brakes`, `ovalAero` |
| Pavement Modified | Pavement Oval / oval | `session`, `ovalWeights`, `fourCornerTires`, `ovalTires`, `ovalCorners`, `ovalAlignment`, `ovalChassis`, `rearSuspensionOval`, `ovalDifferential`, `gearing`, `brakes` |
| Stock Car / ARCA | Pavement Oval / oval | `session`, `ovalWeights`, `fourCornerTires`, `ovalTires`, `ovalCorners`, `ovalAlignment`, `ovalChassis`, `bumpStops`, `rearSuspensionOval`, `ovalDifferential`, `gearing`, `brakes`, `ovalAero` |
| Street Stock / Sportsman | Pavement Oval / oval | `session`, `ovalWeights`, `fourCornerTires`, `ovalTires`, `ovalCorners`, `ovalAlignment`, `ovalChassis`, `rearSuspensionOval`, `ovalDifferential`, `gearing`, `brakes` |
| Mini Stock / Compact | Pavement Oval / oval | `session`, `ovalWeights`, `fourCornerTires`, `ovalTires`, `ovalCorners`, `ovalAlignment`, `ovalChassis`, `compactRearAlignment`, `differential`, `gearing`, `brakes` |
| GT3 | Road Course / sports_car | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerDampers`, `antiRollBars`, `aero`, `differential`, `brakes`, `electronics`, `gearing` |
| GT4 | Road Course / sports_car | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `aero`, `differential`, `brakes`, `electronics`, `gearing` |
| Prototype | Road Course / sports_car | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerDampers`, `antiRollBars`, `aero`, `prototypePlatform`, `differential`, `brakes`, `prototypeElectronics`, `gearing` |
| Radical / Sports Racer | Road Course / sports_car | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `aero`, `sportsRacerPlatform`, `differential`, `brakes`, `gearing` |
| Touring Car | Road Course / sports_car | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `aero`, `differential`, `brakes`, `gearing` |
| Production Track Car | Road Course / sports_car | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `differential`, `brakes`, `gearing` |
| Time Attack | Road Course / sports_car | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerDampers`, `antiRollBars`, `aero`, `differential`, `brakes`, `electronics`, `gearing` |
| Formula Ford 1600 / FF1600 | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `gearing`, `brakes` |
| Formula Ford 2000 / FF2000 | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `gearing`, `brakes`, `formulaAero` |
| Formula Continental | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `gearing`, `brakes`, `formulaAero` |
| F2000 | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `gearing`, `brakes`, `formulaAero` |
| Formula Mazda | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `gearing`, `brakes`, `formulaAero` |
| Formula Vee | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `veeFront`, `veeRear`, `gearing`, `brakes` |
| Formula Atlantic | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerDampers`, `antiRollBars`, `gearing`, `brakes`, `formulaAero`, `prototypePlatform`, `differential` |
| Formula 4 | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `gearing`, `brakes`, `formulaAero` |
| Junior Formula | Road Course / open_wheel | `session`, `roadWeights`, `fourCornerTires`, `roadRaceAlignment`, `roadRideHeight`, `fourCornerSprings`, `fourCornerShocks`, `antiRollBars`, `gearing`, `brakes` |
| Road Racing / Superbike | Motorcycle / motorcycle | `motorcycleSession`, `motorcycleFront`, `motorcycleRear`, `motorcycleGeometry`, `motorcycleTires`, `motorcycleGearing`, `motorcycleBrakes`, `motorcycleElectronics` |
| Supersport | Motorcycle / motorcycle | `motorcycleSession`, `motorcycleFront`, `motorcycleRear`, `motorcycleGeometry`, `motorcycleTires`, `motorcycleGearing`, `motorcycleBrakes`, `motorcycleElectronics` |
| Track Day Motorcycle | Motorcycle / motorcycle | `motorcycleSession`, `motorcycleFront`, `motorcycleRear`, `motorcycleGeometry`, `motorcycleTires`, `motorcycleGearing`, `motorcycleBrakes`, `motorcycleElectronics` |
| Supermoto | Motorcycle / motorcycle | `motorcycleSession`, `motorcycleFront`, `motorcycleRear`, `motorcycleGeometry`, `motorcycleTires`, `motorcycleGearing`, `motorcycleBrakes`, `offroadFork` |
| Flat Track | Motorcycle / motorcycle | `motorcycleSession`, `motorcycleFront`, `motorcycleRear`, `motorcycleGeometry`, `motorcycleTires`, `motorcycleGearing`, `flatTrack` |
| Mini Moto | Motorcycle / motorcycle | `motorcycleSession`, `motorcycleFront`, `motorcycleRear`, `motorcycleGeometry`, `motorcycleTires`, `motorcycleGearing`, `motorcycleBrakes` |
| Motocross | Motorcycle / motorcycle | `motorcycleSession`, `motorcycleFront`, `motorcycleRear`, `motorcycleGeometry`, `motorcycleTires`, `motorcycleGearing`, `motorcycleBrakes`, `offroadFork` |
| RC 1/8 Buggy | RC / rc | `rcSession`, `rcGeometry`, `rcShocks`, `rcTires`, `antiRollBars`, `rcGearing`, `rcWeight`, `rcDiff4wd`, `rcWing` |
| RC 1/10 Buggy | RC / rc | `rcSession`, `rcGeometry`, `rcShocks`, `rcTires`, `antiRollBars`, `rcGearing`, `rcWeight`, `rcDiff2wd`, `rcWing` |
| RC 1/10 4WD Buggy | RC / rc | `rcSession`, `rcGeometry`, `rcShocks`, `rcTires`, `antiRollBars`, `rcGearing`, `rcWeight`, `rcDiff4wd`, `rcWing` |
| RC Short Course | RC / rc | `rcSession`, `rcGeometry`, `rcShocks`, `rcTires`, `antiRollBars`, `rcGearing`, `rcWeight`, `rcDiff4wd` |
| RC Touring Car | RC / rc | `rcSession`, `rcGeometry`, `rcShocks`, `rcTires`, `antiRollBars`, `rcGearing`, `rcWeight`, `rcTouringDiff`, `rcAdditive`, `rcWing` |
| RC Oval | RC / rc | `rcSession`, `rcGeometry`, `rcShocks`, `rcTires`, `rcGearing`, `rcWeight`, `rcDiff2wd`, `rcOval` |
| Winged Sprint Cars | Dirt Track Oval / oval | `session`, `ovalWeights`, `sprintChassis`, `sprintCorners`, `sprintWing`, `gearing`, `brakes` |

## Reusable sections: fields and metadata

Four-corner groups use LF/RF/LR/RR to match OnlyFast's existing machine prefixes. Road cars retain those keys rather than introducing incompatible FL/FR/RL/RR storage. Signed toe uses positive out / negative in. Numeric fields retain the app's string input/storage convention; the field type supplies numeric input mode.

### session: Session & Conditions

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| session_track | Track | text | Setting / text |
| session_name | Session | text | Setting / text |
| session_weather | Weather | text | Setting / text |
| ambient_temperature | Ambient temperature (°F) | number | °F |
| track_temperature | Track temperature (°F) | number | °F |
| fuel_load | Fuel load (gal) | number | gal |
| driver_weight | Driver weight (lb) | number | lb |

### ovalWeights: Weights & Balance

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_corner_weight | LF Corner weight (lb) | number | lb |
| rf_corner_weight | RF Corner weight (lb) | number | lb |
| lr_corner_weight | LR Corner weight (lb) | number | lb |
| rr_corner_weight | RR Corner weight (lb) | number | lb |
| total_weight | Total weight (lb) | number | lb |
| front_weight_pct | Front weight (%) | number | % |
| rear_weight_pct | Rear weight (%) | number | % |
| left_side_pct | Left side weight (%) | number | % |
| cross_weight | Cross weight (%) | number | % |

### roadWeights: Weights & Balance

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_corner_weight | LF Corner weight (lb) | number | lb |
| rf_corner_weight | RF Corner weight (lb) | number | lb |
| lr_corner_weight | LR Corner weight (lb) | number | lb |
| rr_corner_weight | RR Corner weight (lb) | number | lb |
| total_weight | Total weight (lb) | number | lb |
| front_weight_pct | Front weight (%) | number | % |
| rear_weight_pct | Rear weight (%) | number | % |
| cross_weight | Cross weight (%) | number | % |

### fourCornerTires: Tires & Temperatures

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_cold_pressure | LF Cold pressure (psi) | number | psi |
| lf_hot_pressure | LF Hot pressure (psi) | number | psi |
| lf_temperature_inner | LF Inner temperature (°F) | number | °F |
| lf_temperature_middle | LF Middle temperature (°F) | number | °F |
| lf_temperature_outer | LF Outer temperature (°F) | number | °F |
| lf_tire_compound | LF Tire / compound | text | Setting / text |
| rf_cold_pressure | RF Cold pressure (psi) | number | psi |
| rf_hot_pressure | RF Hot pressure (psi) | number | psi |
| rf_temperature_inner | RF Inner temperature (°F) | number | °F |
| rf_temperature_middle | RF Middle temperature (°F) | number | °F |
| rf_temperature_outer | RF Outer temperature (°F) | number | °F |
| rf_tire_compound | RF Tire / compound | text | Setting / text |
| lr_cold_pressure | LR Cold pressure (psi) | number | psi |
| lr_hot_pressure | LR Hot pressure (psi) | number | psi |
| lr_temperature_inner | LR Inner temperature (°F) | number | °F |
| lr_temperature_middle | LR Middle temperature (°F) | number | °F |
| lr_temperature_outer | LR Outer temperature (°F) | number | °F |
| lr_tire_compound | LR Tire / compound | text | Setting / text |
| rr_cold_pressure | RR Cold pressure (psi) | number | psi |
| rr_hot_pressure | RR Hot pressure (psi) | number | psi |
| rr_temperature_inner | RR Inner temperature (°F) | number | °F |
| rr_temperature_middle | RR Middle temperature (°F) | number | °F |
| rr_temperature_outer | RR Outer temperature (°F) | number | °F |
| rr_tire_compound | RR Tire / compound | text | Setting / text |

### ovalTires: Tire Size & Stagger

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_tire_size | LF Tire size | text | Setting / text |
| lf_tire_circumference | LF Tire circumference (in) | number | in |
| rf_tire_size | RF Tire size | text | Setting / text |
| rf_tire_circumference | RF Tire circumference (in) | number | in |
| lr_tire_size | LR Tire size | text | Setting / text |
| lr_tire_circumference | LR Tire circumference (in) | number | in |
| rr_tire_size | RR Tire size | text | Setting / text |
| rr_tire_circumference | RR Tire circumference (in) | number | in |
| front_stagger | Front stagger (in) | number | in |
| rear_stagger | Rear stagger (in) | number | in |

### ovalCorners: Ride Heights, Springs & Shocks

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_ride_height | LF Ride height (in) | number | in |
| lf_spring_rate | LF Spring rate (lb/in) | number | lb/in |
| lf_shock_setting | LF Shock setting | text | Setting / text |
| lf_compression | LF Compression (clicks / setting) | text | clicks / setting |
| lf_rebound | LF Rebound (clicks / setting) | text | clicks / setting |
| rf_ride_height | RF Ride height (in) | number | in |
| rf_spring_rate | RF Spring rate (lb/in) | number | lb/in |
| rf_shock_setting | RF Shock setting | text | Setting / text |
| rf_compression | RF Compression (clicks / setting) | text | clicks / setting |
| rf_rebound | RF Rebound (clicks / setting) | text | clicks / setting |
| lr_ride_height | LR Ride height (in) | number | in |
| lr_spring_rate | LR Spring rate (lb/in) | number | lb/in |
| lr_shock_setting | LR Shock setting | text | Setting / text |
| lr_compression | LR Compression (clicks / setting) | text | clicks / setting |
| lr_rebound | LR Rebound (clicks / setting) | text | clicks / setting |
| rr_ride_height | RR Ride height (in) | number | in |
| rr_spring_rate | RR Spring rate (lb/in) | number | lb/in |
| rr_shock_setting | RR Shock setting | text | Setting / text |
| rr_compression | RR Compression (clicks / setting) | text | clicks / setting |
| rr_rebound | RR Rebound (clicks / setting) | text | clicks / setting |

### ovalAlignment: Alignment

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_camber | LF Camber (deg) | number | deg |
| lf_caster | LF Caster (deg) | number | deg |
| rf_camber | RF Camber (deg) | number | deg |
| rf_caster | RF Caster (deg) | number | deg |
| front_toe | Front total toe (+ out / − in) (in) | number | in |

### compactRearAlignment: Rear Alignment (where adjustable)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lr_camber | LR camber (deg) | number | deg |
| rr_camber | RR camber (deg) | number | deg |
| rear_toe | Rear total toe (+ out / − in) (in) | number | in |

### ovalChassis: Chassis & Front Sway Bar

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_arb | Front sway bar / setting | text | Setting / text |
| front_arb_preload | Sway bar preload | text | Setting / text |
| front_track_width | Front track width (in) | number | in |
| rear_track_width | Rear track width (in) | number | in |
| wheelbase | Wheelbase (in) | number | in |

### legendsChassis: Chassis Dimensions

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_track_width | Front track width (in) | number | in |
| rear_track_width | Rear track width (in) | number | in |
| wheelbase | Wheelbase (in) | number | in |

### rearSuspensionOval: Rear Suspension

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| panhard_left_height | Track bar left height (in) | number | in |
| panhard_right_height | Track bar right height (in) | number | in |
| panhard_angle | Track bar angle (deg) | number | deg |
| lr_trailing_arm_angle | LR trailing arm angle (deg) | number | deg |
| rr_trailing_arm_angle | RR trailing arm angle (deg) | number | deg |
| third_link_setting | Third link / upper link (where fitted) | text | Setting / text |
| rear_end_offset | Rear end offset (in) | number | in |
| rear_steer | Rear steer | text | Setting / text |

### ovalAero: Aero

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| spoiler_angle | Spoiler angle (deg) | number | deg |
| spoiler_height | Spoiler height (in) | number | in |
| splitter_clearance | Splitter clearance (in) | number | in |
| chassis_rake | Rake (rear − front) (in) | number | in |

### bumpStops: Bump Stops & Packers (where fitted)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_bump_stop | LF Bump stop specification | text | Setting / text |
| lf_packer_height | LF Packer height (in) | number | in |
| lf_bump_gap | LF Bump gap (in) | number | in |
| rf_bump_stop | RF Bump stop specification | text | Setting / text |
| rf_packer_height | RF Packer height (in) | number | in |
| rf_bump_gap | RF Bump gap (in) | number | in |
| lr_bump_stop | LR Bump stop specification | text | Setting / text |
| lr_packer_height | LR Packer height (in) | number | in |
| lr_bump_gap | LR Bump gap (in) | number | in |
| rr_bump_stop | RR Bump stop specification | text | Setting / text |
| rr_packer_height | RR Packer height (in) | number | in |
| rr_bump_gap | RR Bump gap (in) | number | in |

### gearing: Gearing

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| final_drive | Final drive ratio | number | Setting / text |
| gear_stack | Gear ratios / stack (where adjustable) | text | Setting / text |

### ovalDifferential: Rear Axle & Differential

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| diff_configuration | Differential / spool configuration | text | Setting / text |
| diff_preload | Preload (where adjustable) (N·m) | number | N·m |

### brakes: Brakes

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| brake_bias | Front brake bias (%) | number | % |
| brake_pressure | Brake pressure setting | text | Setting / text |
| brake_ducting | Brake ducting | text | Setting / text |

### roadRaceAlignment: Alignment

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_camber | LF Camber (deg) | number | deg |
| lf_toe | LF Toe (+ out / − in) (deg) | number | deg |
| rf_camber | RF Camber (deg) | number | deg |
| rf_toe | RF Toe (+ out / − in) (deg) | number | deg |
| lr_camber | LR Camber (deg) | number | deg |
| lr_toe | LR Toe (+ out / − in) (deg) | number | deg |
| rr_camber | RR Camber (deg) | number | deg |
| rr_toe | RR Toe (+ out / − in) (deg) | number | deg |
| lf_caster | LF Caster (deg) | number | deg |
| rf_caster | RF Caster (deg) | number | deg |

### roadRideHeight: Ride Heights & Rake

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_ride_height | LF Ride height (mm) | number | mm |
| rf_ride_height | RF Ride height (mm) | number | mm |
| lr_ride_height | LR Ride height (mm) | number | mm |
| rr_ride_height | RR Ride height (mm) | number | mm |
| front_ride_height_reference | Front ride height reference (mm) | number | mm |
| rear_ride_height_reference | Rear ride height reference (mm) | number | mm |
| chassis_rake | Rake (rear − front) (mm) | number | mm |

### fourCornerSprings: Springs

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_spring_rate | LF Spring rate (N/mm) | number | N/mm |
| rf_spring_rate | RF Spring rate (N/mm) | number | N/mm |
| lr_spring_rate | LR Spring rate (N/mm) | number | N/mm |
| rr_spring_rate | RR Spring rate (N/mm) | number | N/mm |

### fourCornerShocks: Dampers

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_shock_setting | LF Shock setting | text | Setting / text |
| lf_compression | LF Compression (clicks / setting) | text | clicks / setting |
| lf_rebound | LF Rebound (clicks / setting) | text | clicks / setting |
| rf_shock_setting | RF Shock setting | text | Setting / text |
| rf_compression | RF Compression (clicks / setting) | text | clicks / setting |
| rf_rebound | RF Rebound (clicks / setting) | text | clicks / setting |
| lr_shock_setting | LR Shock setting | text | Setting / text |
| lr_compression | LR Compression (clicks / setting) | text | clicks / setting |
| lr_rebound | LR Rebound (clicks / setting) | text | clicks / setting |
| rr_shock_setting | RR Shock setting | text | Setting / text |
| rr_compression | RR Compression (clicks / setting) | text | clicks / setting |
| rr_rebound | RR Rebound (clicks / setting) | text | clicks / setting |

### fourCornerDampers: Dampers (use available channels)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_shock_setting | LF Combined shock setting | text | Setting / text |
| lf_compression_low_speed | LF Low speed compression (clicks / setting) | text | clicks / setting |
| lf_compression_high_speed | LF High speed compression (clicks / setting) | text | clicks / setting |
| lf_rebound_low_speed | LF Low speed rebound (clicks / setting) | text | clicks / setting |
| lf_rebound_high_speed | LF High speed rebound (clicks / setting) | text | clicks / setting |
| rf_shock_setting | RF Combined shock setting | text | Setting / text |
| rf_compression_low_speed | RF Low speed compression (clicks / setting) | text | clicks / setting |
| rf_compression_high_speed | RF High speed compression (clicks / setting) | text | clicks / setting |
| rf_rebound_low_speed | RF Low speed rebound (clicks / setting) | text | clicks / setting |
| rf_rebound_high_speed | RF High speed rebound (clicks / setting) | text | clicks / setting |
| lr_shock_setting | LR Combined shock setting | text | Setting / text |
| lr_compression_low_speed | LR Low speed compression (clicks / setting) | text | clicks / setting |
| lr_compression_high_speed | LR High speed compression (clicks / setting) | text | clicks / setting |
| lr_rebound_low_speed | LR Low speed rebound (clicks / setting) | text | clicks / setting |
| lr_rebound_high_speed | LR High speed rebound (clicks / setting) | text | clicks / setting |
| rr_shock_setting | RR Combined shock setting | text | Setting / text |
| rr_compression_low_speed | RR Low speed compression (clicks / setting) | text | clicks / setting |
| rr_compression_high_speed | RR High speed compression (clicks / setting) | text | clicks / setting |
| rr_rebound_low_speed | RR Low speed rebound (clicks / setting) | text | clicks / setting |
| rr_rebound_high_speed | RR High speed rebound (clicks / setting) | text | clicks / setting |

### antiRollBars: Anti-Roll Bars

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_arb | Front anti-roll bar / position | text | Setting / text |
| rear_arb | Rear anti-roll bar / position | text | Setting / text |

### aero: Aero

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_aero_setting | Front splitter / aero setting | text | Setting / text |
| rear_wing_angle | Rear wing angle (deg) | number | deg |
| aero_balance | Front aero balance (if known) (%) | number | % |

### formulaAero: Wings

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_wing_setting | Front wing / flap setting | text | Setting / text |
| rear_wing_angle | Rear wing angle (deg) | number | deg |
| aero_balance | Front aero balance (if known) (%) | number | % |

### prototypePlatform: Aero Platform (where fitted)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_heave_spring | Front heave spring rate (N/mm) | number | N/mm |
| rear_heave_spring | Rear heave spring rate (N/mm) | number | N/mm |
| heave_damper_setting | Heave damper setting | text | Setting / text |
| front_packer_gap | Front packer gap (mm) | number | mm |
| rear_packer_gap | Rear packer gap (mm) | number | mm |
| diffuser_setting | Diffuser / aero platform notes | text | Setting / text |

### sportsRacerPlatform: Aero Platform

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_bump_clearance | Front bump clearance (mm) | number | mm |
| rear_bump_clearance | Rear bump clearance (mm) | number | mm |
| platform_notes | Ride height / platform notes | text | Setting / text |

### differential: Differential (where adjustable)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| diff_configuration | Differential configuration | text | Setting / text |
| diff_preload | Preload (N·m) | number | N·m |
| diff_power | Power / accel setting | text | Setting / text |
| diff_coast | Coast / decel setting | text | Setting / text |

### electronics: Electronics (where supported)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| traction_control | Traction control level | text | Setting / text |
| abs_level | ABS level | text | Setting / text |
| engine_map | Engine / power map | text | Setting / text |

### prototypeElectronics: Electronics (where supported)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| traction_control | Traction control level | text | Setting / text |
| engine_map | Engine / power map | text | Setting / text |

### veeFront: Front Torsion Beam

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_torsion_setting | Front torsion spring / adjuster | text | Setting / text |
| front_ride_height | Front ride height (mm) | number | mm |
| front_camber | Front camber (deg) | number | deg |
| front_toe | Front total toe (+ out / − in) (deg) | number | deg |
| front_caster | Front caster (deg) | number | deg |
| front_shock_setting | Front shock setting | text | Setting / text |
| front_arb | Front anti-roll bar (where fitted) | text | Setting / text |

### veeRear: Rear Swing Axle & Spring

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| rear_ride_height | Rear ride height (mm) | number | mm |
| rear_camber | Rear camber (deg) | number | deg |
| rear_toe | Rear total toe (+ out / − in) (deg) | number | deg |
| rear_spring_rate | Rear spring rate (N/mm) | number | N/mm |
| rear_shock_setting | Rear shock setting | text | Setting / text |
| rear_droop_limit | Rear droop limiter | text | Setting / text |
| rear_arb | Rear anti-roll / zero-roll configuration | text | Setting / text |

### motorcycleSession: Session & Rider

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| session_track | Track | text | Setting / text |
| session_name | Session | text | Setting / text |
| session_weather | Weather / surface | text | Setting / text |
| ambient_temperature | Ambient temperature (°F) | number | °F |
| track_temperature | Track temperature (°F) | number | °F |
| fuel_load | Fuel load (gal) | number | gal |
| rider_weight | Rider weight with gear (lb) | number | lb |

### motorcycleFront: Front Fork

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| fork_height | Fork protrusion above top clamp (mm) | number | mm |
| fork_preload | Preload (mm) | number | mm |
| fork_compression | Compression (clicks / setting) | text | clicks / setting |
| fork_rebound | Rebound (clicks / setting) | text | clicks / setting |
| fork_spring_rate | Spring rate (N/mm) | number | N/mm |
| fork_oil_level | Fork oil level / air gap (mm) | number | mm |

### motorcycleRear: Rear Shock

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| shock_length | Shock length (mm) | number | mm |
| rear_ride_height | Rear ride height reference (mm) | number | mm |
| shock_preload | Preload (mm) | number | mm |
| shock_compression | Compression (clicks / setting) | text | clicks / setting |
| shock_rebound | Rebound (clicks / setting) | text | clicks / setting |
| shock_spring_rate | Spring rate (N/mm) | number | N/mm |

### motorcycleGeometry: Sag & Geometry

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_static_sag | Front Static sag (mm) | number | mm |
| front_rider_sag | Front Rider sag (mm) | number | mm |
| rear_static_sag | Rear Static sag (mm) | number | mm |
| rear_rider_sag | Rear Rider sag (mm) | number | mm |
| wheelbase | Wheelbase (mm) | number | mm |
| steering_head_angle | Steering head angle (deg) | number | deg |
| triple_clamp_offset | Triple clamp offset (where adjustable) (mm) | number | mm |

### motorcycleTires: Tires

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_tire_compound | Front Tire / compound | text | Setting / text |
| front_cold_pressure | Front Cold pressure (psi) | number | psi |
| front_hot_pressure | Front Hot pressure (psi) | number | psi |
| front_tire_temperature | Front Tire temperature (°F) | number | °F |
| rear_tire_compound | Rear Tire / compound | text | Setting / text |
| rear_cold_pressure | Rear Cold pressure (psi) | number | psi |
| rear_hot_pressure | Rear Hot pressure (psi) | number | psi |
| rear_tire_temperature | Rear Tire temperature (°F) | number | °F |

### motorcycleGearing: Sprockets & Gearing

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_sprocket | Front sprocket (teeth) | number | teeth |
| rear_sprocket | Rear sprocket (teeth) | number | teeth |
| final_drive | Final drive ratio | number | Setting / text |
| chain_slack | Chain slack (mm) | number | mm |

### motorcycleBrakes: Brakes & Controls

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_brake_pad | Front brake pad | text | Setting / text |
| rear_brake_pad | Rear brake pad | text | Setting / text |
| lever_position | Lever position | text | Setting / text |
| foot_control_position | Foot control position | text | Setting / text |

### motorcycleElectronics: Electronics (where fitted)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| traction_control | Traction control | text | Setting / text |
| abs_level | ABS | text | Setting / text |
| engine_braking | Engine braking | text | Setting / text |
| power_map | Power map | text | Setting / text |
| wheelie_control | Wheelie control | text | Setting / text |

### offroadFork: Off-Road Suspension

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| fork_oil_viscosity | Fork oil viscosity | text | Setting / text |
| shock_compression_high_speed | High speed compression (turns / setting) | text | turns / setting |
| shock_compression_low_speed | Low speed compression (clicks / setting) | text | clicks / setting |

### flatTrack: Flat Track Chassis & Tires

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| tire_cut | Tire cut / pattern | text | Setting / text |
| rear_wheel_offset | Rear wheel offset (where adjustable) (mm) | number | mm |
| swingarm_setting | Swingarm / axle position | text | Setting / text |
| rear_brake_setting | Rear brake setting | text | Setting / text |

### rcSession: Track & Vehicle

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| session_track | Track | text | Setting / text |
| surface | Surface | text | Setting / text |
| traction_level | Traction level | text | Setting / text |
| chassis_model | Chassis / model | text | Setting / text |
| power_type | Electric / nitro | text | Setting / text |
| track_temperature | Track temperature (°F) | number | °F |

### rcGeometry: Ride Height & Alignment

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_ride_height | Front Ride height (mm) | number | mm |
| front_camber | Front Camber (deg) | number | deg |
| front_toe | Front Total toe (+ out / − in) (deg) | number | deg |
| front_droop | Front Droop (mm) | number | mm |
| front_roll_center | Front Roll center / link position | text | Setting / text |
| rear_ride_height | Rear Ride height (mm) | number | mm |
| rear_camber | Rear Camber (deg) | number | deg |
| rear_toe | Rear Total toe (+ out / − in) (deg) | number | deg |
| rear_droop | Rear Droop (mm) | number | mm |
| rear_roll_center | Rear Roll center / link position | text | Setting / text |
| front_caster | Front caster (deg) | number | deg |
| wheelbase | Wheelbase (mm) | number | mm |

### rcShocks: Shocks & Springs

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_shock_oil | Front Shock oil (cSt / wt (specify scale)) | text | cSt / wt (specify scale) |
| front_shock_piston | Front Shock piston holes / size | text | Setting / text |
| front_spring | Front Spring / rate | text | Setting / text |
| front_shock_upper_position | Front Upper shock position | text | Setting / text |
| front_shock_lower_position | Front Lower shock position | text | Setting / text |
| front_shock_length | Front Shock length (mm) | number | mm |
| rear_shock_oil | Rear Shock oil (cSt / wt (specify scale)) | text | cSt / wt (specify scale) |
| rear_shock_piston | Rear Shock piston holes / size | text | Setting / text |
| rear_spring | Rear Spring / rate | text | Setting / text |
| rear_shock_upper_position | Rear Upper shock position | text | Setting / text |
| rear_shock_lower_position | Rear Lower shock position | text | Setting / text |
| rear_shock_length | Rear Shock length (mm) | number | mm |

### rcTires: Tires & Inserts

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_tire | Front Tire / compound | text | Setting / text |
| front_insert | Front Insert | text | Setting / text |
| front_wheel_hex_offset | Front Wheel hex offset (mm) | number | mm |
| rear_tire | Rear Tire / compound | text | Setting / text |
| rear_insert | Rear Insert | text | Setting / text |
| rear_wheel_hex_offset | Rear Wheel hex offset (mm) | number | mm |

### rcAdditive: Tire Preparation (where allowed)

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| tire_additive | Tire additive | text | Setting / text |
| additive_time | Application time (min) | number | min |
| tire_preparation | Tire preparation | text | Setting / text |

### rcDiff2wd: Rear Differential

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| rear_diff_configuration | Rear ball / gear differential | text | Setting / text |
| rear_diff_oil | Rear diff oil (gear diff) (cSt) | text | cSt |
| ball_diff_setting | Ball diff setting | text | Setting / text |
| slipper_setting | Slipper clutch setting | text | Setting / text |

### rcDiff4wd: Differentials & Slipper

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_diff_configuration | Front differential configuration | text | Setting / text |
| front_diff_oil | Front diff oil (cSt) | text | cSt |
| center_drive_configuration | Center diff / slipper / spool | text | Setting / text |
| center_diff_oil | Center diff oil (where fitted) (cSt) | text | cSt |
| rear_diff_configuration | Rear differential configuration | text | Setting / text |
| rear_diff_oil | Rear diff oil (cSt) | text | cSt |
| slipper_setting | Slipper (where fitted) | text | Setting / text |

### rcTouringDiff: Touring Drivetrain

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| front_diff_configuration | Front spool / diff configuration | text | Setting / text |
| front_diff_oil | Front diff oil (where fitted) (cSt) | text | cSt |
| rear_diff_configuration | Rear diff configuration | text | Setting / text |
| rear_diff_oil | Rear diff oil (cSt) | text | cSt |
| belt_tension | Belt / drivetrain tension | text | Setting / text |

### rcGearing: Gearing & Power

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| pinion | Pinion / clutch bell (teeth) | number | teeth |
| spur | Spur (teeth) | number | teeth |
| final_drive | Final drive ratio | number | Setting / text |
| motor_setting | Motor / engine setting | text | Setting / text |
| esc_setting | ESC setting (electric) | text | Setting / text |

### rcWeight: Battery & Weight Placement

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| battery_placement | Battery placement (electric) | text | Setting / text |
| weight_placement | Weight placement | text | Setting / text |
| total_weight | Total weight (g) | number | g |

### rcWing: Wing

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| wing_position | Wing position | text | Setting / text |
| wing_angle | Wing angle (deg) | number | deg |

### rcOval: Oval Balance

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_spring | LF Spring / rate | text | Setting / text |
| lf_corner_weight | LF Corner weight (g) | number | g |
| rf_spring | RF Spring / rate | text | Setting / text |
| rf_corner_weight | RF Corner weight (g) | number | g |
| lr_spring | LR Spring / rate | text | Setting / text |
| lr_corner_weight | LR Corner weight (g) | number | g |
| rr_spring | RR Spring / rate | text | Setting / text |
| rr_corner_weight | RR Corner weight (g) | number | g |
| cross_weight | Cross weight (%) | number | % |
| left_side_pct | Left side weight (%) | number | % |
| front_stagger | Front stagger (mm) | number | mm |
| rear_stagger | Rear stagger (mm) | number | mm |
| rear_pod_setting | Rear pod / solid axle setting (where fitted) | text | Setting / text |

### sprintChassis: Sprint Chassis

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| wheelbase | Wheelbase (in) | number | in |
| front_stagger | Front stagger (in) | number | in |
| rear_stagger | Rear stagger (in) | number | in |
| front_axle | Front axle specification | text | Setting / text |
| front_panhard | Front panhard setting | text | Setting / text |
| jacobs_ladder | Jacobs ladder setting | text | Setting / text |
| rear_axle_location | Rear axle location | text | Setting / text |

### sprintCorners: Four Corners

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| lf_torsion_bar | LF Torsion bar diameter / rate | text | Setting / text |
| lf_block_size | LF Block size (in) | number | in |
| lf_turns_off_block | LF Turns off block | text | Setting / text |
| lf_shock_setting | LF Shock setting | text | Setting / text |
| lf_cold_pressure | LF Cold tire pressure (psi) | number | psi |
| lf_tire_size | LF Tire size | text | Setting / text |
| lf_wheel_offset | LF Wheel offset (in) | number | in |
| rf_torsion_bar | RF Torsion bar diameter / rate | text | Setting / text |
| rf_block_size | RF Block size (in) | number | in |
| rf_turns_off_block | RF Turns off block | text | Setting / text |
| rf_shock_setting | RF Shock setting | text | Setting / text |
| rf_cold_pressure | RF Cold tire pressure (psi) | number | psi |
| rf_tire_size | RF Tire size | text | Setting / text |
| rf_wheel_offset | RF Wheel offset (in) | number | in |
| lr_torsion_bar | LR Torsion bar diameter / rate | text | Setting / text |
| lr_block_size | LR Block size (in) | number | in |
| lr_turns_off_block | LR Turns off block | text | Setting / text |
| lr_shock_setting | LR Shock setting | text | Setting / text |
| lr_cold_pressure | LR Cold tire pressure (psi) | number | psi |
| lr_tire_size | LR Tire size | text | Setting / text |
| lr_wheel_offset | LR Wheel offset (in) | number | in |
| rr_torsion_bar | RR Torsion bar diameter / rate | text | Setting / text |
| rr_block_size | RR Block size (in) | number | in |
| rr_turns_off_block | RR Turns off block | text | Setting / text |
| rr_shock_setting | RR Shock setting | text | Setting / text |
| rr_cold_pressure | RR Cold tire pressure (psi) | number | psi |
| rr_tire_size | RR Tire size | text | Setting / text |
| rr_wheel_offset | RR Wheel offset (in) | number | in |

### sprintWing: Wings

| Machine field ID | Display label | Value type | Unit |
|---|---|---|---|
| top_wing_angle | Top wing angle (deg) | number | deg |
| top_wing_position | Top wing position (in) | number | in |
| nose_wing_angle | Nose wing angle (deg) | number | deg |

## Shared schemas and architecture choices

- FF2000, Formula Continental and F2000 share the winged two-litre group composition. Separate names, configs, section field objects and applicableClass metadata remain. This follows the common FC/FF2000 architecture, rather than appearance.
- Formula Mazda and Formula 4 start with reusable winged mechanical groups while retaining separate identities and future overrides.
- FF1600 and generic non-winged Junior Formula use mechanical groups without wings. Formula Vee has dedicated torsion-beam front and swing-axle rear groups.
- GT3 and Time Attack reuse comprehensive dampers, aero, differential and optional electronics groups. They remain distinct configs. GT4 uses simpler shocks. Touring Car and Production Track Car do not assume GT3 electronics.
- Prototype adds heave springs, packer gaps, aero platform and available TC/map settings. Radical / Sports Racer emphasizes clearance and ride-height sensitivity without assuming prototype heave springs.
- Pavement Late Model and Stock Car / ARCA share traditional live-axle, bump-stop and aero groups. They are independent class identities. This stock-car foundation does not claim to model NASCAR Next Gen independent-rear/transaxle cars.
- Pavement Modified and Street Stock / Sportsman start with a common coil-spring live-axle foundation without assumed aero. Legends omits the generic sway-bar group. Mini Stock omits live-axle link adjustments and adds adjustable rear alignment.
- Superbike, Supersport and Track Day share front/rear suspension, sag, tires, gearing and optional electronics. Supermoto/Motocross add off-road damper channels. Flat Track omits assumed front-brake/electronic controls and adds tire-cut and rear chassis settings. Motorcycles have no cross weight or car four-corner sections.
- RC 1/8 Buggy and RC 1/10 4WD Buggy reuse 4WD groups. RC 1/10 Buggy represents common 2WD. Short Course represents 4WD without an assumed buggy wing. Touring Car adds spool/belt/tire-preparation fields. Oval represents common electric 2WD with stagger, weight balance and corner springs.
- Existing dirt sharing (Modified/Sport Mod and Pro Stock/Pure Stock) is unchanged.

These are broad base definitions, with settings marked where fitted/adjustable. They do not enforce model-specific adjustability or sanctioning-body legality. No setup recommendations, default adjustment values or guessed ranges are supplied. Class-specific field, label, unit, range and section overrides can be added independently.

## Database, saving, comparison and Setup Assist

Existing `race_setups` columns and values remain intact. New fields use the existing `custom_fields` JSONB column:

```json
{
  "onlyfast_setup_library_v1": {
    "version": 1,
    "race_class": "GT3",
    "values": {
      "lf_camber": "-3.0",
      "rear_wing_angle": "9",
      "diff_preload": "80"
    }
  }
}
```

The example illustrates storage only; it is not a recommended setup.

- Both base/race payload builders write snapshots; both loaders hydrate them. Existing copy/session propagation spreads retain them. Name-only updates preserve the JSON.
- Metadata lives in the schema registry: key, label, section, unit, type, applicableClass and applicableCategory. Values use stable IDs, not UI labels.
- Blank values, zero, signed decimals and descriptive shock/gear settings round-trip correctly.
- Unknown future fields survive through a carried snapshot, but cannot shadow identity/session columns on hydration. Malformed and cross-class snapshots fail closed.
- Templates and past-setup copies require an exact class match when either class is a development sheet. Existing production template behavior remains. Expanded comparisons also stay within compatible classes to avoid unit mismatches.
- If a backend lacks `custom_fields`, a new-sheet save errors rather than silently dropping its data. The migration adds that existing JSONB column if absent; no per-class columns or data backfill is introduced.
- Schema-driven comparisons, shared read-only views and PDF output hydrate the new fields and display their labels. Reserved JSON blobs are not printed as custom text.
- Setup Assist was not rewritten. Stable field IDs and metadata provide the future integration foundation.

The existing app has explicit-unit fields, without a global metric/imperial selector. Pressure/weather retain psi/°F; oval dimensions use inches/lb/in, road suspension uses mm/N/mm, motorcycle uses mm/N/mm, and RC uses mm/g/cSt. No unit preference system or automatic conversion was introduced.

## Test-account restriction

Frontend access reuses the current BetaFeaturesProvider snapshot/cache:

1. `isBetaTester` is true.
2. `betaFeaturesEnabled` is true.
3. `testerKind` is `experimental`.
4. `test_account_full_access` is explicitly enabled.

This is the existing `isCurrentUserTestAccount` gate. Email, paid tier, admin status, localStorage and `import.meta.env.DEV` do not grant access. Reactive selector hooks update with the provider. Entry, form rendering, draft hydration, saves, loaded/shared views, template choices and PDF output guard the new classes.

Production `CAR_CLASSES`, `AVAILABLE_CAR_CLASSES` and every existing dirt field definition remain unchanged. Normal users retain their existing classes, Coming Soon cards and subscription behavior.

## Migration and release requirement

File: `supabase/migrations/20260930_add_development_setup_library.sql`.

Apply after the existing active-class, beta-account and Custom Car migrations. It was executed twice in the isolated PostgreSQL test for idempotency. **It has not been applied to live Supabase.**

The migration:

- Registers the 36 canonical class identities only for the existing flagged experimental account.
- Adds a restrictive `race_setups` policy, ANDed with existing ownership/class/share policies. Team/admin permissions cannot override it.
- Blocks unauthorized writes, including renamed normal classes carrying the reserved development snapshot.
- Validates snapshot version, class identity, values object and string values.
- Blocks direct development `active_race_class` writes that would bypass the class RPC.
- Filters the existing SECURITY DEFINER summary RPC, which otherwise bypasses row policies.
- Reuses the existing experimental full-access-to-Team behavior for the cooldown bypass. No subscription/tier function or normal cooldown logic is changed.
- Leaves all existing saved rows unchanged.

Deploy the migration before deploying the frontend, then verify live save/reopen/copy for Legends, GT3, FF1600, Superbike and RC 1/8 Buggy with the designated account. No additional authentication or separate test-mode architecture was created.

## Exact files changed by this task

New files:

- `src/lib/setupLibrary.ts`
- `src/lib/setupLibraryAccess.ts`
- `src/lib/setupLibraryStorage.ts`
- `supabase/migrations/20260930_add_development_setup_library.sql`
- `tests/setupLibraryHarness.ts`
- `tests/setupLibrary.test.ts`
- `tests/setupLibraryDatabase.mjs`
- `docs/SETUP_LIBRARY_REPORT.md`

Modified files:

- `src/lib/classConfigs.ts`
- `src/lib/setupPdf.ts`
- `src/components/AppLayout.tsx`
- `src/components/OnboardingFlow.tsx`
- `src/components/ClassChangeModal.tsx`
- `src/components/ChassisSetupForm.tsx`
- `src/components/CreateBaseSetupView.tsx`
- `src/components/SetupDashboard.tsx`
- `src/components/BaseTemplatePicker.tsx`
- `src/components/SavedSetups.tsx`
- `src/components/SetupComparison.tsx`
- `src/components/ViewSharedSetupModal.tsx`

Pre-existing uncommitted Custom Car changes/files, its 20260929 migration, preview HTML and docs/tests were preserved. They are not new work attributable to this task. No pricing, subscription, ad, telemetry, OnlyLaps, schedule, timing scan or race-weekend behavior was refactored.

## Reproduce verification

```text
npm run build
npm run test
npx tsc -p tsconfig.app.json --noEmit --lib ES2021,DOM,DOM.Iterable
```

For PostgreSQL integration, install `@electric-sql/pglite` in an external temporary directory, set `PGLITE_MODULE` to its `dist/index.js`, then run:

```text
node --experimental-strip-types --test tests/setupLibraryDatabase.mjs
```

No project dependency changes are required.

## Primary design references

Architecture checks used [US Legend Cars](https://www.uslegendcars.com/start-racing/legend-cars/) for the Legends coilover basis; [SCCA FC/F preparation rules](https://cdn.connectsites.net/user_files/scca/downloads/000/078/070/DEC-2025.pdf?1764611807=) and [SCCA CFC rules](https://ncrscca.com/club-formula-continental-cfc-rules/) for the FC/FF2000 relationship; [Öhlins NIX technology](https://www.ohlins.com/en-us/technology/nix-technology) for fork preload/compression/rebound controls; [Associated Electrics setup sheets](https://www.associatedelectrics.com/teamassociated/manuals_and_setup_sheets/) as RC reference material; and [Porsche GT3 R](https://newsroom.porsche.com/en_US/motorsport/us-media-guide/race-cars/porsche-911-gt3-r.html) for representative GT brake/ABS architecture. These inform base design, rather than certify compliance with current rulebooks.

## RECOMMENDED NEXT SETUP SHEETS

Not implemented in this task:

- Bandolero and Quarter Midget.
- Leaf-spring pavement Street Stock / Sportsman.
- NASCAR Next Gen stock car with independent rear suspension and transaxle.
- Spec Miata / MX-5 and Spec Racer Ford.
- RC 2WD Short Course, RC pan-car oval and RC Drag.
- Vintage road racing, Autocross and Karting after agreeing on category placement.
- Rally / Rallycross, Drift, Drag, Off-Road / UTV / Trophy Truck and Hill Climb if the discipline structure expands.
