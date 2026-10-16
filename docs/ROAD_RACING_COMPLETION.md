# Road Racing completion report

Implemented in the local workspace. Existing uncommitted work was preserved. Production has not been deployed or migrated.

1. **Exact files changed by this task** (23 files, including this report):

- [docs/ROAD_RACING_COMPLETION.md](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/docs/ROAD_RACING_COMPLETION.md>)
- [src/components/BaseTemplatePicker.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/BaseTemplatePicker.tsx>)
- [src/components/ChassisSetupForm.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/ChassisSetupForm.tsx>)
- [src/components/ClassChangeModal.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/ClassChangeModal.tsx>)
- [src/components/CreateBaseSetupView.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/CreateBaseSetupView.tsx>)
- [src/components/Header.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/Header.tsx>)
- [src/components/HomeLanding.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/HomeLanding.tsx>)
- [src/components/OnboardingFlow.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/OnboardingFlow.tsx>)
- [src/components/SavedSetups.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/SavedSetups.tsx>)
- [src/components/SetupComparison.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/SetupComparison.tsx>)
- [src/components/SetupDashboard.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/SetupDashboard.tsx>)
- [src/components/SetupPreviewLanding.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/SetupPreviewLanding.tsx>)
- [src/components/ShareSetupModal.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/ShareSetupModal.tsx>)
- [src/components/ViewSharedSetupModal.tsx](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/components/ViewSharedSetupModal.tsx>)
- [src/lib/classConfigs.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/lib/classConfigs.ts>)
- [src/lib/roadRacingSetupSchemas.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/lib/roadRacingSetupSchemas.ts>)
- [src/lib/setupLibrary.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/lib/setupLibrary.ts>)
- [src/lib/setupLibraryAccess.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/lib/setupLibraryAccess.ts>)
- [src/lib/setupPdf.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/lib/setupPdf.ts>)
- [supabase/migrations/20261013183621_enable_road_racing.sql](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/supabase/migrations/20261013183621_enable_road_racing.sql>)
- [tests/onboardingNavigation.mjs](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tests/onboardingNavigation.mjs>)
- [tests/racingOnboardingDatabase.mjs](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tests/racingOnboardingDatabase.mjs>)
- [tests/setupLibrary.test.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/tests/setupLibrary.test.ts>)

Other files already changed when this task began, or changed by concurrent work, are not included.

2. **Discipline identifier:** `road_course`. Its display name is now Road Racing.

3. **Stable class identifiers:**

| Class | Internal identifier | Fields |
|---|---|---:|
| Mazda MX-5 / Spec Miata | `road_spec_miata` | 76 |
| GT3 | `road_gt3` | 84 |
| GT4 | `road_gt4` | 57 |
| Prototypes | `road_prototypes` | 51 |
| Winged Open-Wheel Formula | `road_formula_winged` | 44 |
| Non-Winged Open-Wheel Formula | `road_formula_non_winged` | 48 |
| Go-Karts | `road_karts` | 31 |
| Road Course Legends Car | `road_legends` | 52 |
| Touring Car / TCR | `road_tcr` | 45 |
| Trans-Am / TA2 | `road_ta2` | 47 |

4. **Definitions:** [src/lib/roadRacingSetupSchemas.ts](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/src/lib/roadRacingSetupSchemas.ts>). The ten sheets enter the existing class registry in setupLibrary.ts and reuse ChassisSetupForm, existing sections/corner cards, base/race serializers, and custom_fields JSONB storage under onlyfast_setup_library_v1. All 535 labels, units, section order and subsection titles were compared to the supplied request and match exactly. Entries start blank; finite choices have an empty first option. Legacy Road Course IDs and their saved schemas remain readable; the Road Racing selector presents exactly the ten requested classes.

5. **Database migration:** Required only to register the ten new class IDs and discipline mapping in existing SQL validation helpers. No columns, tables, policies, subscription rules, historical records or setup JSON layouts are changed. The migration guards its prerequisites, preserves helper privileges and existing class IDs, and was applied twice successfully in an isolated PostgreSQL database.

6. **Complete migration SQL:** [supabase/migrations/20261013183621_enable_road_racing.sql](<C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt (1)/onlyfast/supabase/migrations/20261013183621_enable_road_racing.sql>); the full text is also included below. Apply the workspace's existing restore_racing_onboarding migration before this migration. A read-only inspection found that onboarding migration was not yet applied to the connected production database. Neither migration was deployed in this task.

7. **Road Racing selectable:** Confirmed in normal-account rendered selectors and mounted onboarding flows. Road Racing has no Coming Soon/disabled overlay or custom-car Coming Soon caption.

8. **Road Racing BETA badge:** Present on its onboarding card and selected discipline label in Change Discipline / Vehicle; native dropdown options also include BETA.

9. **Pavement Oval BETA badge:** Uses the same badge and dropdown notation. Its functionality is unchanged by this task.

10. **Dirt Track:** No BETA tag; existing setup definitions were compared against Git and remain unchanged. Only a shared optional corner-title type property was added to classConfigs.ts. Pricing, entitlements, timing/OCR, telemetry, OnlyLaps, Setup Assist, schedule and wrapper navigation logic were not changed by this task.

11. **Templates:** All ten requested sheets added, 535 fields total, with separate class snapshots and preserved TCR drive-axle subsection titles. Go-Karts uses its supplied frame/geometry/engine sections.

12. **Save/reopen:** Confirmed for every new class through actual base/race serializers and authenticated PostgreSQL JSONB round trips. Tested editing, rename, duplicate, delete, user ownership, class isolation, and Hot Laps/Heat/Main sessions. Existing subscription and vehicle lock checks remain in the same paths.

13. **Build:** npm run build passes. Vite reports its existing large-bundle advisory. The configured TypeScript check still reports the pre-existing replaceAll/ES2020 library mismatch in unchanged HandlingFeedback.tsx:91. TypeScript passes with --lib ES2021,DOM,DOM.Iterable; no configuration was changed.

14. **Tests and limits:**

- npm test: 316 passed, 0 failed. Includes setup lifecycle/schema coverage, Dirt/Pavement selectors, saved/base setups, race weekend/session resolution, schedule behavior, OnlyLaps/timing regressions, subscription/account restrictions, and Median/iOS checks.
- Mounted navigation plus isolated PostgreSQL integration: 36 passed, 0 failed. New-user Road Racing paths explicitly cover Spec Miata, GT3, Go-Karts and TA2; database onboarding and existing Teams class changes cover all ten.
- Supplied-sheet audit: all 535 labels and section/subsection ordering match; 11 existing Dirt class definitions unchanged.
- Responsive form markup reuses the existing single-column mobile / two-column desktop corner layout; no design changes.
- Browser visual/end-to-end validation was unavailable: the sole connected in-app browser timed out reaching localhost; Chrome is not connected. Mounted component and database tests ran independently of the live backend. Native-device testing and live production purchase/save flows were not performed.

```sql
-- Register stable Road Racing class IDs in existing validation helpers.
-- Reuses custom_fields JSONB; retains every historical class and all privileges.
-- Apply restore_racing_onboarding first for the full onboarding/class-change flow.
begin;

do $$
begin
  if to_regprocedure('public.onlyfast_canonical_race_class(text)') is null
    or to_regprocedure('public.onlyfast_is_development_setup_class(text)') is null
    or to_regprocedure('public.onlyfast_can_use_setup_library()') is null
    or to_regprocedure('public.onlyfast_race_discipline(text)') is null then
    raise exception 'Apply setup library and restore_racing_onboarding migrations before enable_road_racing';
  end if;
end;
$$;

create or replace function public.onlyfast_is_development_setup_class(p_class text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(trim(coalesce(p_class, ''))) = any(array[
    'legends',
    'pavement late model',
    'pavement modified',
    'stock car / arca',
    'street stock / sportsman',
    'mini stock / compact',
    'gt3',
    'gt4',
    'prototype',
    'radical / sports racer',
    'touring car',
    'production track car',
    'time attack',
    'formula ford 1600 / ff1600',
    'formula ford 2000 / ff2000',
    'formula continental',
    'f2000',
    'formula mazda',
    'formula vee',
    'formula atlantic',
    'formula 4',
    'junior formula',
    'road racing / superbike',
    'supersport',
    'track day motorcycle',
    'supermoto',
    'flat track',
    'mini moto',
    'motocross',
    'rc 1/8 buggy',
    'rc 1/10 buggy',
    'rc 1/10 4wd buggy',
    'rc short course',
    'rc touring car',
    'rc oval',
    'winged sprint cars',
    'shifter kart',
    'clutch kart',
    'road_spec_miata',
    'road_gt3',
    'road_gt4',
    'road_prototypes',
    'road_formula_winged',
    'road_formula_non_winged',
    'road_karts',
    'road_legends',
    'road_tcr',
    'road_ta2'
  ]::text[]);
$$;

create or replace function public.onlyfast_canonical_race_class(p_class text)
returns text language sql stable security definer set search_path = '' as $$
  select class_name from unnest(array[
    'Custom Car', 'Dwarf Cars', 'Late Model', 'Lightning Sprints', 'Midgets',
    'Modified', 'Non-Wing Sprint Cars', 'Pro Stock', 'Pure Stock', 'Sport Compact', 'Sport Mod',
    'Legends',
    'Pavement Late Model',
    'Pavement Modified',
    'Stock Car / ARCA',
    'Street Stock / Sportsman',
    'Mini Stock / Compact',
    'GT3',
    'GT4',
    'Prototype',
    'Radical / Sports Racer',
    'Touring Car',
    'Production Track Car',
    'Time Attack',
    'Formula Ford 1600 / FF1600',
    'Formula Ford 2000 / FF2000',
    'Formula Continental',
    'F2000',
    'Formula Mazda',
    'Formula Vee',
    'Formula Atlantic',
    'Formula 4',
    'Junior Formula',
    'Road Racing / Superbike',
    'Supersport',
    'Track Day Motorcycle',
    'Supermoto',
    'Flat Track',
    'Mini Moto',
    'Motocross',
    'RC 1/8 Buggy',
    'RC 1/10 Buggy',
    'RC 1/10 4WD Buggy',
    'RC Short Course',
    'RC Touring Car',
    'RC Oval',
    'Winged Sprint Cars',
    'Shifter Kart',
    'Clutch Kart',
    'road_spec_miata',
    'road_gt3',
    'road_gt4',
    'road_prototypes',
    'road_formula_winged',
    'road_formula_non_winged',
    'road_karts',
    'road_legends',
    'road_tcr',
    'road_ta2'
  ]::text[]) classes(class_name)
  where lower(class_name) = lower(trim(coalesce(p_class, '')))
    and (not public.onlyfast_is_development_setup_class(class_name)
      or public.onlyfast_can_use_setup_library())
  limit 1;
$$;

create or replace function public.onlyfast_race_discipline(p_class text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_class = any(array['Legends','Pavement Late Model','Pavement Modified','Stock Car / ARCA','Street Stock / Sportsman','Mini Stock / Compact']) then 'pavement_oval'
    when p_class = any(array['road_spec_miata','road_gt3','road_gt4','road_prototypes','road_formula_winged','road_formula_non_winged','road_karts','road_legends','road_tcr','road_ta2','GT3','GT4','Prototype','Radical / Sports Racer','Touring Car','Production Track Car','Time Attack','Formula Ford 1600 / FF1600','Formula Ford 2000 / FF2000','Formula Continental','F2000','Formula Mazda','Formula Vee','Formula Atlantic','Formula 4','Junior Formula','Shifter Kart','Clutch Kart']) then 'road_course'
    when p_class = any(array['Road Racing / Superbike','Supersport','Track Day Motorcycle','Supermoto','Flat Track','Mini Moto','Motocross']) then 'motorcycle'
    when p_class = any(array['RC 1/8 Buggy','RC 1/10 Buggy','RC 1/10 4WD Buggy','RC Short Course','RC Touring Car','RC Oval']) then 'rc'
    when p_class is not null then 'dirt_oval'
    else null
  end;
$$;

notify pgrst, 'reload schema';
commit;
```
