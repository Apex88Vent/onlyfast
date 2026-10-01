# Custom Car implementation

Implemented in the local working tree. The development preview is available at
http://127.0.0.1:8081/custom-car-preview.html while Vite is running. This standalone
preview uses the real editor components with local guest storage and does not
write race setups to Supabase. It is not a production route or build entry.

## Files changed

- `src/lib/classConfigs.ts`: adds Custom Car to the class list, available class list, and its own empty class configuration. Existing class field definitions and availability remain unchanged.
- `src/components/OnboardingFlow.tsx`: enables Custom Car only for Dirt Track Oval; disables it in every other discipline even for experimental accounts. Existing unavailable discipline cards also visibly list Custom Car as Coming Soon, without enabling those disciplines.
- `src/components/AppLayout.tsx`: mounts the Custom Car template gate around the existing dashboard. Other classes continue directly into the dashboard.
- `src/components/SetupDashboard.tsx`: seeds independent session snapshots, saves/loads them through existing JSONB, renders the Custom Car editor, and distinguishes blank template structure from actual session values. Prevents loading an incompatible predefined-class draft into Custom Car, or the reverse.
- `src/components/CreateBaseSetupView.tsx`: reuses the existing base-setup save, copy, rename, permission, and load architecture with Custom Car snapshots. Filters compatible sheets in the UI while preserving the full base-setup count used by existing subscription checks.
- `src/components/BaseTemplatePicker.tsx`: keeps Custom Car and predefined base sheets separate when applying a baseline.
- `src/components/ViewSharedSetupModal.tsx`: displays Custom Car snapshots using their saved labels and values.

## New files

- `src/lib/customCar.ts`: flexible data types, six empty default sections, validation, snapshot creation, opposite-corner copy, stored-row hydration, and availability for all five disciplines.
- `src/components/CustomCarSheet.tsx`: account template loading/persistence, first-time creation, field editing, field reordering, overwrite confirmation, and read-only snapshot rendering.
- `supabase/migrations/20260929_add_custom_car_class.sql`: exact, rerunnable SQL migration to add Custom Car to the server's class allowlist.
- `tests/customCar.test.ts`: nine tests for availability, defaults, all four copy directions, independent snapshots, template persistence representation, and legacy compatibility.
- `custom-car-preview.html`: standalone development preview entry.
- `src/dev/CustomCarPreview.tsx`: local preview shell with a reset control.
- `docs/CUSTOM_CAR_IMPLEMENTATION.md`: this completion report.

## Storage and behavior

The signed-in user's reusable definition is stored in the existing Supabase Auth
user metadata JSON under `onlyfast_custom_car_v1`. The existing
`supabase.auth.updateUser({ data: ... })` API merges this metadata property.
No authentication or authorization rules are changed. Guest definitions use
localStorage under `onlyfast_custom_car_v1_guest`; guests and signed-in accounts
have separate template storage.

Each sheet is `{ version: 1, sections: [...] }`. A section contains
`section_id`, `section_name`, and `fields`. Each field contains a stable `id`,
arbitrary `label`, string `value`, and numeric `order`. Reusable definitions clear
event values when saved. Values entered during first-time creation seed the first
setup; they do not become values for every future event.

Race setups and base setups store their full, independent structure and values
in the existing `race_setups.custom_fields` JSONB column under
`onlyfast_custom_car_v1`. The in-memory draft stores a JSON string under the same
key to fit the existing string-valued form state. Existing save, offline payload,
session, title, date, track, schedule, and permission paths are reused.

Edit Sheet exposes label editing, deletion, and Move up/Move down. Add Value is
also available directly in empty or populated sections. Editing a setup affects
that setup's snapshot. Save Setup Sheet for Future Setups separately updates the
reusable definition. Existing stored race/base rows are never rewritten when the
reusable template changes. Stored rows hydrate their own snapshots, including
an empty snapshot for any legacy Custom Car row without one.

Copy to Opposite Corner pairs LF/RF and LR/RR in both directions. It replaces the
destination with copied labels, ordering, and current values, generating separate
field IDs. The source and destination are not linked. A destination with any
fields triggers an accessible Cancel/Copy confirmation first.

## Database migration

Apply `supabase/migrations/20260929_add_custom_car_class.sql` after the existing
`20260720_enforce_active_race_class.sql` migration and before using Custom Car with
server-enforced class selection. It only replaces the existing canonical-class
function, preserving every existing entry and adding Custom Car. It adds no
tables or columns, changes no RLS or subscription policies, and updates/deletes
no saved rows. It is safe to rerun. **It has not been applied to Supabase.**

```sql
begin;

create or replace function public.onlyfast_canonical_race_class(p_class text)
returns text
language sql
immutable
set search_path = public
as $$
  select class_name
  from unnest(array[
    'Dwarf Cars',
    'Late Model',
    'Lightning Sprints',
    'Midgets',
    'Modified',
    'Non-Wing Sprint Cars',
    'Pro Stock',
    'Pure Stock',
    'Sport Compact',
    'Sport Mod',
    'Custom Car'
  ]::text[]) as classes(class_name)
  where lower(class_name) = lower(trim(coalesce(p_class, '')))
  limit 1;
$$;

commit;
```

## Validation and remaining deployment checks

- `npm test`: 245 tests pass, including nine Custom Car tests and the existing regression suite.
- `npm run build`: passes; Vite reports the existing large-chunk advisory.
- Type checking with ES2021 libraries passes. The project's unchanged default TypeScript configuration reports a pre-existing `String.replaceAll` compatibility error in `src/components/HandlingFeedback.tsx:91`.
- Browser checks: Custom Car is selectable in the existing class selector; first-time selection displays Create Setup Sheet and all six empty sections; add, rename, delete, and reorder work; LF-to-RF copy retains labels and values; subsequent edits are independent; occupied corners prompt before replacement and Cancel preserves the destination.
- Browser checks in the local editor preview: saving a sheet transitions to the regular Custom Car editor with initial values; refresh reloads the template with event values blank; Edit Sheet and reordered template persistence work. Test fields were reset afterward.
- All four copy directions, JSON round trips, independent race/base copies, historical snapshot protection, and unchanged existing class availability are covered by automated tests.
- The predefined `ChassisSetupForm.tsx` and existing predefined field structures were not modified. No existing saved setups or production database data were changed.
- Signed-in template persistence through logout/login, real Supabase race/base create/copy/rename/load operations, and production class-lock enforcement have **not** been exercised against an authenticated test account. Those checks remain after applying the migration. No claim of a fully completed production end-to-end test is made.
