# Sportsman archive design for the next phase

Phase 1B preparation only. No archive columns, archive RPC, interface or quota
relaxation is installed by this phase. The five regular slots currently contain
all retained regular weekends, including those locked after 48 hours.

Archive at the immutable `onlyfast_private.setup_weekends` level, not individual
session rows. A weekend owns its original creation clock, all base/heat/main/extra
session rows, notes, timing results, usage counters and identity aliases.

The next reviewed schema should add a server-owned `archived_at` timestamp and
an archive actor/audit record. A single authenticated owner-only archive RPC must
hold the existing per-user advisory lock, mark the whole weekend terminally
archived and retain every session row. Sportsman cannot clear or rewrite the
archive timestamp, detach sessions, reset the creation clock, restore a weekend,
or recreate it under one of its retained aliases. No automatic deletion occurs.

Sportsman's regular-slot query will then count only distinct owned weekends
whose archive timestamp is null. Locked-but-unarchived weekends still count.
Keep the limit in the existing server trigger and use a supporting index on
user ID/archive state. Base-template allowance remains separate. Do not replace
quota identity with setup names, user-entered dates or client-supplied counts.

For reads, Sportsman should receive safe archived-summary metadata sufficient
for a gray card and lock icon, without mechanical values, notes, session results
or telemetry. Pro and Factory can access their archived data after upgrade.
Upgrading grants access through effective server membership; it does not silently
restore archive state or change billing records. Restoring under another tier
requires a separately specified policy.

Audit all table RLS, share-redemption RPCs, summaries, setup loading, copy/export,
usage reservation and future telemetry context paths. Security-definer and Edge
service-role reads must enforce archive access explicitly. A hidden client card
alone is insufficient. Sportsman must not recover archived content through an
old share code, session ID, replay queue, copy operation or guessed URL.

Retain `setup_weekend_aliases` and `timing_weekend_usage` when archiving or deleting
individual session rows. Their foreign keys and lack of browser privileges
preserve quota and clock continuity. Phase 1B records aliases across recognized
session renames/date changes and recreations. Server identity does not attempt
to infer that wholly unrelated, newly invented event details describe the same
real-world race; stronger event verification would require a trusted event source.

Required acceptance tests: archive all sessions atomically; free exactly one
active slot; retain values unchanged; deny Sportsman restore and direct reads;
allow Pro/Factory owned archive reads; reject foreign reads and writes; preserve
48-hour clock and scan/Assist consumption; reject recreation through old aliases;
and preserve billing, class-switch rules, base limits and all historical records.
