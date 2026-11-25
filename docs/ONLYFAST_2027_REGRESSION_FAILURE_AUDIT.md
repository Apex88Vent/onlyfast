# OnlyFast 2027 regression failure audit

November 25, 2026 (America/Los_Angeles). Diagnostic work in the primary checkout on `develop/onlyfast-2027`, HEAD `17b48fad`. Reference: [Track Trace BETA review](ONLYFAST_2027_TRACK_TRACE_BETA_REVIEW.md).

**The five failures are reproducible and predate the latest Track Trace BETA changes.** Their immediate causes are three stale mounted-test module loaders and two Windows checkout byte-format mismatches. The archive mismatch also blocks the actual offline packaging helper, so it is more than a cosmetic test failure. No confirmed critical/high application runtime defect was established by these failures. However, three important Setup Assist/What If/ad-safety tests never reach their behavioral assertions. Their coverage remains blocked, and release acceptance must not treat them as passed.

**Fresh full regression: 912 passed, 5 failed, 0 skipped. The suite remains failed.** No fixes, assertion changes, mocks, source normalization or test removal were implemented. Existing uncommitted Track Trace work was preserved. No production/testing remote database calls, RevenueCat changes, subscriber migration changes, standalone OnlyLaps changes, archive edits, Git commits/pushes, merges or deployments were made in this investigation.

## Summary of all five failures

The exact names below are the Node test names, not informal categories. F1–F5 identify the detailed evidence that follows.

| ID / exact test name | Root cause | Preexisting or new | Reproducibility | Release impact | Recommended correction |
| --- | --- | --- | --- | --- | --- |
| F1 — reviewed archive artifact installs after BOTH live Track Trace migrations without rewriting history | Raw SHA-256 of CRLF checkout differs from pinned LF source bytes; packager hashes before its later normalization | Preexisting; same failure in November 24 reports; sources identical to `17b48fad` and `f943f81f` after LF normalization | Every isolated attempt and both latest full runs | **MEDIUM** — real Windows offline packaging blocker and blocked archive/history installation acceptance; no demonstrated runtime data corruption | Enforce exact reviewed LF bytes for narrowly identified artifacts; keep original pins and all retention/security assertions |
| F2 — Phase3B artifacts: reviewed fingerprints, testing-only guard, read-only catalog verification and retention SQL | Manifest hashes LF bytes; first artifact is checked out as CRLF; other manifest files have the same mismatch | Preexisting; same November 24 failure; Git blobs still match all pins | Every isolated attempt and both latest full runs | **TEST INFRASTRUCTURE ONLY** for this observed assertion; billing artifact validation is blocked before SQL checks | Enforce reviewed LF bytes for all four pinned manifest artifacts; preserve hashes and installation/deployment holds |
| F3 — real Assist answers remain readable before dismissal; generation, failures, usage limits and changed owners cannot produce ads | Test compiler rejects `HandlingFeedback`'s existing `./DeferredFeature` import | Preexisting; import added by `0b0448f4` on November 21; loader was not updated | Every isolated attempt and both latest full runs | **TEST INFRASTRUCTURE ONLY**; completed-answer visibility, quota, ad dismissal/cooldown and replacement-owner coverage blocked | Teach this test loader the existing named export using the real helper; keep every behavior assertion |
| F4 — both What If CTAs use one panel without automatic requests; failures hide bottom CTA | Same missing named dependency in the separate Setup Assist test compiler | Preexisting; source/loader unchanged since before BETA | Every isolated attempt and both latest full runs | **TEST INFRASTRUCTURE ONLY**; What If request/CTA/result/error behavior coverage blocked | Add the named dependency to this test compiler using the real helper; retain request counts and failure-state assertions |
| F5 — real map selections feed matching speed/phase keys into Setup Assist and What If | Same compile failure before real map-to-Assist harness mounts | Preexisting; source/loader unchanged since before BETA | Every isolated attempt and both latest full runs | **TEST INFRASTRUCTURE ONLY**; real map feedback payload integration coverage blocked | Same minimal compiler dependency correction as F4, then run this case independently |

“Test infrastructure only” classifies the observed failure, not the safety of all behavior behind the blocked assertion. All five should be resolved and the unchanged behavior assertions rerun before claiming a clean release regression gate. No production activation is implied or recommended.

## Reproduction method and complete results

The original complete report and its complete `unit.tap`, `mounted.tap` and `database.tap` were read. Original report:

`tmp/qa-automation/2026-11-25T18-02-12.267Z-eb374d00-24d2-4768-af38-069d06dccd64/report.json`

Fresh investigation run, started **10:40:40 AM PST**, finished **10:41:58 AM PST**:

`tmp/qa-automation/2026-11-25T18-40-40.445Z-c03af41d-7106-450d-a101-7a2b3c2acca0/report.json`

| Suite | Passed | Failed | Skipped | Total | Exit code |
| --- | ---: | ---: | ---: | ---: | ---: |
| Unit | 798 | 2 | 0 | 800 | 1 |
| Mounted | 91 | 3 | 0 | 94 | 1 |
| Database | 23 | 0 | 0 | 23 | 0 |
| **All** | **912** | **5** | **0** | **917** | **1 overall** |

Each failure was selected by its anchored exact test name and run in its own fresh Node process, twice per diagnostic-driver invocation. The driver was invoked twice, giving four failing isolated executions per named case; the latest two TAP files per case and the first invocation's console log are retained. Each selected process reports one test, zero passes, one failure, zero skips and exit code 1. Isolation does not change the error or offending source line. No intermittent success, order dependency or timing-based cause was observed.

Runtime: Node `v24.18.0`, Windows. The existing installed React 18 renderer was resolved from `node_modules/react-test-renderer/index.js`, just as the full runner does. The diagnostic child environment removed the same remote-QA/database/provider/token variables as `runNodeTests`; no secret values were printed. PGlite databases are disposable in-memory engines, not hosted projects. These tests do not require real authentication or external provider/network traffic. The mounted tests use explicit mock sessions and mocked function calls; the archive test seeds deterministic UUIDs locally.

### Exact commands executed

Shell-level test commands:

```powershell
node --experimental-strip-types qa/automation/runner.mjs regression
node tmp/regression-failure-audit/reproduce.mjs
# The reproduction driver was invoked a second time with the same command.
node tmp/regression-failure-audit/reproduce.mjs
```

The driver launches these exact child commands, each twice per invocation; it sets `REACT_TEST_RENDERER_MODULE` to `require.resolve('react-test-renderer')` before spawning:

```powershell
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="^reviewed archive artifact installs after BOTH live Track Trace migrations without rewriting history$" tests/archive2027InstalledOrder.test.ts
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="^Phase3B artifacts: reviewed fingerprints, testing-only guard, read-only catalog verification and retention SQL$" tests/billing2027Artifacts.test.ts
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="^real Assist answers remain readable before dismissal; generation, failures, usage limits and changed owners cannot produce ads$" tests/nativeAdSettings.mjs
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="^both What If CTAs use one panel without automatic requests; failures hide bottom CTA$" tests/setupAssistTrackUpdates.mjs
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="^real map selections feed matching speed/phase keys into Setup Assist and What If$" tests/setupAssistTrackUpdates.mjs
```

Read-only diagnostic commands included `node tmp/regression-failure-audit/evidence.mjs`, `git show`/`git log` for the cited revisions, `git ls-files --eol`, `git check-attr -a` and `git config --show-origin --get-regexp 'core\.(autocrlf|eol|safecrlf)'`. Raw byte hashes, Git-blob hashes and LF-normalized hashes were calculated in memory only. No alternative mock, patched filesystem view or modified expectation was used to make any failing test pass.

Individual command arguments and outcomes: `tmp/regression-failure-audit/individual-results.json`; raw logs: `archive-{1,2}.tap`, `billing-{1,2}.tap`, `ad-assist-{1,2}.tap`, `what-if-{1,2}.tap`, `map-assist-{1,2}.tap` in the same directory. Complete error messages and stack traces are also embedded at the end of this report.

## F1 — archive artifact installation

**Test:** `tests/archive2027InstalledOrder.test.ts:14`.

**Failed assertion:** `scripts/prepare-2027-phase2-archives.mjs:18` checks `assert.equal(sha256(bytes), fingerprint, 'Reviewed SQL fingerprint changed: ' + file)`. It is called from the test's line 37 while evaluating the right-hand side of `assert.equal(sql, (await preparePhase2ArchiveInstall()).sql, ...)`. The outer artifact equality and all subsequent row-retention/ownership/entitlement assertions are not reached.

- Expected: `F1374C37D76728469C3ACF5EC5CE352E44442B8862499682C4429A2C75393598`.
- Actual: `0E361192A2812D984BCAB17FCB211F1C666BCF226848822B08FF5DB126B22A4F`.
- Error: `AssertionError [ERR_ASSERTION]: Reviewed SQL fingerprint changed: phase2-archives.sql`.

`phase2-archives.sql` has 478 CRLF terminators in this checkout, while the Git blob uses LF. Normalizing only CRLF to LF in memory yields the exact original pinned hash and exact Git content. `git ls-files --eol` reports `i/lf w/crlf`, the system Git config has `core.autocrlf=true`, and no applicable `text`/`eol` attributes override it. There is no evidence of SQL statement drift. The helper's existing `.replaceAll('\r\n','\n')` occurs **after** the raw fingerprint assertion, so it cannot prevent this failure.

The second pinned source, `track-trace-history-access.sql`, has the same problem: actual `06B1AF59403407CD9043932946B6CE459301B4A0D92F4817EA443141ABE0F8B0`, expected/Git/LF `6751213223C5AF524BE57D1DA578AE77C405E7152517FB9F7E8CBE197692386A` (148 CRLF terminators). Fixing only the first file's formatting would expose this next check. The generated install artifact must also retain its reviewed LF representation because the outer assertion compares full strings exactly.

**Classification:** environment-dependent artifact-byte contract, consistently failing in this Windows checkout. The pins correctly detect different raw bytes. The missing repository line-ending constraint makes reviewed artifacts nonportable. This is neither an intermittent SQL engine failure nor evidence of an archive RLS/product defect. It does block `preparePhase2ArchiveInstall()` itself, an actual operator packaging path. Do not run its CLI as a diagnostic workaround: that CLI writes artifacts.

**Smallest proposed correction:** after separate authorization for artifact-format maintenance, narrowly enforce `text eol=lf` for the reviewed archive sources and install artifact, re-materialize only verified unchanged files to their exact reviewed Git bytes, and retain existing hashes. Do not update the pins to match CRLF or weaken the exact-byte assertion. Candidate file addition: root `.gitattributes`; formatting-only affected paths: `supabase/testing-2027/phase2-archives.sql`, `track-trace-history-access.sql`, `phase2-archives-install.sql`. Review any manifest byte metadata before staging. No SQL/body/authorization changes are needed based on this evidence.

**Risk / release:** low runtime risk for a properly reviewed formatting-only correction, but careless broad normalization could churn unrelated archive work or invalidate exact artifacts. Fix before using this packaging path or accepting its full install/retention test for release. This investigation did not change archive files.

## F2 — subscription artifact fingerprints

**Test:** `tests/billing2027Artifacts.test.ts:11`; failed assertion at line 16.

The test first confirms both installation/deployment authorization flags remain false, then compares the raw SHA-256 of each manifest file with its existing pin. The first file, `phase3b-subscriptions-install.sql`, fails:

- Expected: `C6A57B6B217141DB0640C60191F5D2FF446E44F2A5B4A1DC5BDB909FC356FE9C`.
- Actual: `9C8AB51D0033705D08DDBC49C5BD7C038D118E8C3C4BC63D429C9EB6AB4E111B`.
- Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal`.

That file contains 422 CRLF terminators. All **four** manifest entries were independently checked; each checkout differs only in newline bytes, and each LF-normalized value equals both its expected pin and its blobs at `17b48fad` and `f943f81f`:

| Artifact | Checkout SHA-256 | Expected = Git blob = LF-normalized SHA-256 |
| --- | --- | --- |
| `phase3b-subscriptions-install.sql` | `9C8AB51D0033705D08DDBC49C5BD7C038D118E8C3C4BC63D429C9EB6AB4E111B` | `C6A57B6B217141DB0640C60191F5D2FF446E44F2A5B4A1DC5BDB909FC356FE9C` |
| `phase3b-subscriptions-retention.sql` | `49B8741944A8DFAF08274A2C438B63F74EDB751D06B03D0E79CED47C4AD4A79B` | `05BA4C829BD5E368948978FB12B4438CFECD9EA8B31F705E5468B26D3D6BCB5D` |
| `phase3b-subscriptions-verify.sql` | `9FB954B10C7929B0791032A0F77A32495E564288DA22C47A4EDAC7AC12D0C425` | `71E1C2B4C20D050933F057D10F39C4A32CA3361477421CA9D698EAF70CEB418B` |
| `phase3b-products.plan.json` | `6EEDFD3E2A74E008DD3BA8EEF3662F815DB33F78BC216846F8AEED246AE8E703` | `E0AD65EC31948E8DDDCC14B8BA021B0DFD448A14BF38A36DE33CA8468E857680` |

The test never reaches its testing-only SQL ordering, read-only catalog checks, 16 retention results or wrong-environment assertion. It never reaches `billingDatabase()` in this case. Other database tests pass, but they do not substitute for these blocked assertions.

**Classification:** TEST INFRASTRUCTURE ONLY for the observed failure: source byte-format validation, not a RevenueCat service call, active subscriber migration or entitlement calculation. Both authorization flags remain false. The manifest/SQL content has not legitimately changed and expected hashes should not be replaced.

**Smallest proposed correction:** use the same narrowly reviewed LF checkout policy for the four exact manifest entries, with original hashes and byte metadata unchanged once files equal their original Git bytes. Files potentially affected: new root `.gitattributes` plus formatting-only four listed artifacts. `tests/billing2027Artifacts.test.ts` and `phase3b-subscriptions.manifest.json` should retain their assertions/pins/false authorization flags. No live product or subscriber change is required.

**Risk / release:** low runtime risk if strictly formatting-only; broad artifact regeneration or changed authorization would be outside this correction. Restore this test before calling the full release suite green and before any separately approved billing installation. Nothing here authorizes activating Phase 3B.

## F3 — Setup Assist results and native-ad safety

**Test:** `tests/nativeAdSettings.mjs:315`; compile invocation at line 342; throw at line 28 in its custom `require` callback.

**Failed assertion:** none of this case's intended product assertions is reached. Actual result is an exception while evaluating the transpiled `HandlingFeedback.tsx` imports: `Unstubbed Settings dependency: ./DeferredFeature`. Expected test setup is a usable `HandlingFeedback` component, after which the case would check completed-answer visibility, zero ads during generation, dismissal-only ad eligibility, cooldown, empty/quota failures and replacement-owner suppression.

The application module exists at `src/components/DeferredFeature.tsx`. Its named export `deferredFeatureExport` adds a label to the same component and returns it; it is not a missing package or an undefined application export. `HandlingFeedback.tsx` imports it at line 2 and calls it for its default export. The custom test loader recognizes only selected module IDs and throws for the rest. Its supplied module dictionary omits `./DeferredFeature`.

Git commit `0b0448f4` (November 21, 9:20:08 AM PST) added that import and changed the default export from `HandlingFeedback` to `deferredFeatureExport(HandlingFeedback, 'Setup Assist')`. The test file's last source change was `448c1610` (November 17); no corresponding module map update was made. Both test and application files are unchanged in the current BETA diff and identical to baseline `17b48fad` and prior `f943f81f` after normalizing checkout newlines. The existing seven `deferredFeature.test.ts` tests pass in the fresh full run, including grouped namespace export selection and load/retry behavior.

**Smallest proposed correction:** in `tests/nativeAdSettings.mjs`, expose the existing named `deferredFeatureExport` through the module map, preferably by compiling/loading the real helper with its startup-logging dependency mocked as the existing `tests/deferredFeature.test.ts` does. Do not stub the entire `HandlingFeedback` component or remove the owner/quota/ad assertions. No application or native-ad permission change is indicated.

**Teardown issue discovered:** the test replaces `globalThis.window` and creates/starts its native controller before the failing compile, while its `try/finally` begins afterward. This exception therefore bypasses the restoration/unmount/controller-stop block. A narrowly scoped follow-up should include setup/compile inside the existing cleanup boundary. This can contaminate later tests within that file; it is not the cause of the present failure, which also reproduces alone.

**Risk / release:** TEST INFRASTRUCTURE ONLY immediate cause; low application risk for a loader-only fix. The unexecuted assertions include important owner/ad-safety behavior, so restore and run them before release acceptance. Current advertising holds must remain. Passing independent ad tests does not prove this blocked integrated scenario.

## F4 — two What If entry points and error behavior

**Test:** `tests/setupAssistTrackUpdates.mjs:264`; compile at line 270; loader throw at line 42.

**Failed assertion:** no intended behavioral assertion reached. Actual: `Unstubbed dependency ./DeferredFeature`; expected: successfully compiled `HandlingFeedback` followed by one initial CTA, no automatic request, two CTAs after a successful suggestion, one shared panel, consistent formatted response sections, explicit request IDs/session scope, and hiding the lower CTA when authentication/request fails.

This file has its own TypeScript-to-CommonJS compiler and allowlisted module resolver. React, analytics, membership, link events, native ads and `LockedFeatureNotice` are recognized; `./DeferredFeature` is not. The application import and history are the same as F3. No real provider request, authentication call, debounce, timer or database read has occurred when it throws. The mock `functions.invoke` request list is never exercised by this case.

**Smallest proposed correction:** update only this test compiler's dependency mapping to provide the real named helper, retaining its current default-export handling and all exact request-count/CTA/error assertions. A future implementation may share the same small loading approach with F3, but general harness refactoring is unnecessary. Relevant paths: `tests/setupAssistTrackUpdates.mjs`, read-only helper contract `src/components/DeferredFeature.tsx`, example `tests/deferredFeature.test.ts`.

This test also assigns `globalThis.window` before compilation and only enters `try/finally` afterward; move that setup under its cleanup boundary in the targeted follow-up. Risk is test-state leakage, not the root of the isolated failure.

**Risk / release:** TEST INFRASTRUCTURE ONLY immediate cause; low application risk for the loader correction. Fix before accepting Setup Assist/What If behavior for release; subsequent assertions could reveal another problem and have not been certified by this audit.

## F5 — real map selections into Assist and What If

**Test:** `tests/setupAssistTrackUpdates.mjs:323`; compile at line 327; same throw at line 42.

**Failed assertion:** no real map/payload behavior assertion reached. Actual: `Unstubbed dependency ./DeferredFeature`; expected: the real road map cycles six speed/phase fields into state, Setup Assist receives that exact `currentSetup`, clearing high-speed entry changes only that field, and What If receives the same updated setup and its explicit question.

The failure occurs before `Harness` mounts and before any map click or mocked AI invocation. It does not report a wrong payload, missing field, incorrect permission or stale user result. Attribution to a product integration bug would be unsupported by this error. It also does not establish that the payload assertions would pass after loading is repaired.

**Smallest proposed correction:** the same dependency-map correction as F4 in `tests/setupAssistTrackUpdates.mjs`; preserve the use of the real `RoadCourseTrack` component and every deep equality on payloads. Include its setup in `try/finally` for the same cleanup issue. No changes to `RoadCourseTrack.tsx`, `roadTrackFeedback.ts`, `HandlingFeedback.tsx`, AI service or Track Trace are indicated.

**Risk / release:** TEST INFRASTRUCTURE ONLY immediate cause; low runtime risk for a harness-only correction, with a release coverage gap for a real input-to-Assist integration. Fix and rerun before calling that integration verified.

## Evidence that these failures predate BETA

Historical reports were compared by **test name and actual error/hash**, not the number five alone. Report metadata does not embed a source commit, so report dates are corroborating evidence; direct file/Git comparisons establish source continuity.

| Local report time | Complete outcome | What it establishes |
| --- | --- | --- |
| November 23, 9:11 PM PST (`2026-11-24T05-11-43.945Z-f0f0eb48-4d74-4d87-858d-4ce6adf1a051`) | 797 passed / 4 failed | Same three behavioral test names, but **different** missing dependency (`@/lib/setupAssistSchemas`), plus staging. Not proof of today's exact DeferredFeature error |
| November 24, 6:28 PM PST (`2026-11-25T02-28-06.276Z-74fbee4b-e939-4dc3-b76e-1b46b0334fe0`) | 883 / 5 | Earliest retained report with all five current names **and the same current errors/hashes** |
| November 24, 7:07 PM PST (`2026-11-25T03-07-36.691Z-e09fd252-b2a4-44d4-ba65-26765e8d29f0`) | 889 / 5 | All five current failures reproduced before BETA |
| November 24, 7:18 PM PST (`2026-11-25T03-18-29.076Z-a33a50fc-47d4-44be-9fc3-eff6179e8bb6`) | 891 / 5 | Report cited by the preceding corrective audit; same five current failures |
| November 24, 10:42–11:18 PM PST (four reports with 663–666 passes) | Five failures in each | **Different inventories** include onboarding/staging failures in place of artifact checks; these counts are not evidence that all five are identical |
| November 25, 9:20 / 9:43 / 9:49 AM PST | 903 / 5, 904 / 5, 906 / 5 | All five current failures persist while BETA tests are added |
| November 25, 10:02 AM PST | 912 / 5 | Referenced BETA result; same exact errors/hashes |
| November 25, 10:40 AM PST | 912 / 5 | Fresh unchanged-source audit run; same exact errors/hashes |

The two pinned archive source files originate in `9b5bcdbc` (November 14), and Phase 3B artifacts/tests in `2999e6e3` (November 14). Raw hashes of the Git blobs at `f943f81f` and `17b48fad` equal the original reviewed pins; current normalized text is identical. The three mounted failures are explained by the November 21 export-label addition and stale November 17 module loaders. None of these relevant source/test files is in the latest Track Trace BETA diff.

Evidence: `tmp/regression-failure-audit/history.json`, `hash-evidence.json`, `source-continuity.json`. Older reports with superficially matching names but different errors were not treated as exact reproductions. Git history proves the import change; without executing every historical commit, its first failing CI execution date cannot be asserted.

## Product and release impact across requested areas

| Area | Assessment from these failures |
| --- | --- |
| Authentication | No observed runtime authentication error. F4's unauthenticated error-state assertion is blocked; no live Auth acceptance performed |
| Subscription entitlements; Sportsman / Pro / Factory | No observed entitlement miscalculation. F1's later downgrade/history checks are blocked in this case; other local authorization tests pass. F2 is artifact hashing, not a tier grant |
| RevenueCat | No API/product issue observed; F2 blocks validation of unapproved static subscription artifacts. Installation/deployment false flags and purchasing holds remain |
| Setup loading, saving and existing saved setups | No failing read/write assertion identified. F1's preservation-after-install assertions remain unexecuted here; existing local setup/database tests pass |
| Race schedules | No schedule failure or causal source change identified in the fresh suite |
| Track Trace recording and review | No recording/review failure among these five. F1 covers archive installation against existing Track Trace/history and must not be dismissed as irrelevant; its full retained-data/security acceptance remains blocked |
| Telemetry linking | No failing link assertion observed. F1's later link/read-only checks are blocked; independent link tests pass |
| Setup Assist | F3–F5 are stale harness errors; key integrated behavior remains unverified by these three tests |
| Overall Assist | Separate Track Trace driving analysis; no failure in its current tests. Passing them does not replace mechanical Setup Assist coverage |
| Onboarding and mobile navigation | No failure in these domains in the fresh current-branch report. Historical different-inventory onboarding failures are not relabelled as these five |
| Existing production behavior | No production runtime defect established; no production access or hosted acceptance was performed. A local test audit cannot certify live behavior |

No critical/high runtime issue was confirmed. **The release concern is incomplete acceptance coverage and a reproducible packaging blocker, not an identified data-loss/authentication bypass.** Resolve the harness/format problems and run the original assertions before OnlyFast 1.2 release sign-off. Do not suppress tests or relabel a failed suite as clean.

## Proposed correction order — recommendations only

1. Repair the named `DeferredFeature` dependency in the two mounted loaders, keeping the real tested components and all owner/quota/ad/request/payload assertions. Extend existing cleanup boundaries to include setup/compile. Run F3, F4 and F5 individually and then their complete files; address any newly exposed failure on its own evidence.
2. Review a narrow repository LF policy for the six hash-pinned source/manifest artifacts and the archive install artifact. Preserve every reviewed pin, SQL body, authorization hold and manifest contract. Re-materialize only verified unchanged reviewed bytes; do not mass-normalize unrelated work. Run F1/F2, both complete files and the read-only hash comparison again. No installer/retention SQL should be applied remotely as part of that correction.
3. Rerun the unchanged full regression suite and relevant Track Trace/security checks. If all original behavior assertions pass, update the release evidence with its actual results; otherwise investigate new failures. Only then consider further release acceptance. No deployment or billing activation follows automatically.

Potential modifications in that later authorized correction are limited to `tests/nativeAdSettings.mjs`, `tests/setupAssistTrackUpdates.mjs`, a narrow `.gitattributes`, and verified formatting-only reviewed artifacts. Runtime application changes are not justified by the current five errors. No change was made to any of these files during this audit.

## Files investigated, preservation and remaining uncertainty

Investigated the four failing test files; `scripts/prepare-2027-phase2-archives.mjs`; the archive source/history/install artifacts and manifest; Phase 3B install/verify/retention/product-plan artifacts and manifest; `tests/helpers/archive2027.mjs`, `trackTracePhase2b.mjs`, `billing2027.mjs`; `src/components/HandlingFeedback.tsx`, `DeferredFeature.tsx`, `RoadCourseTrack.tsx`; `src/lib/roadTrackFeedback.ts`; `tests/deferredFeature.test.ts`, `dashboardStartupRecovery.test.ts`; `qa/automation/runner.mjs`, `coverage.mjs`; Git line-ending configuration/attributes; both Track Trace reports; and the complete referenced/fresh/historical TAP/report files. Relevant helper/application/test continuity is recorded in `source-continuity.json`.

Only this requested audit is added to tracked-source documentation. Temporary diagnostic scripts/logs are under ignored `tmp/regression-failure-audit/`, and the existing runner creates its normal ignored report directory. No current preview process or preexisting artifact was removed. Byte-preservation verification is recorded in `tmp/regression-failure-audit/preservation-report.json`.

Remaining uncertainty is explicit: these tests stop early, so later assertions may reveal further issues after the proposed fixes. No edited-source experiment, historical branch checkout, remote backend mutation, physical-device check, real purchase/ad/provider request or production acceptance was performed. The recommendation is based on exact observed errors, raw/Git-byte equality, source history and isolated reproduction, not an assumption that all product behavior must be correct.

## Complete observed failure messages and stacks

The following excerpts are copied verbatim from the fresh full regression TAP files, preserving all emitted stack frames and original assertion expected/actual values. Full TAP files include surrounding passing tests and final suite counts at the report paths above.

### F1 raw TAP error

```tap
# Subtest: reviewed archive artifact installs after BOTH live Track Trace migrations without rewriting history
not ok 28 - reviewed archive artifact installs after BOTH live Track Trace migrations without rewriting history
  ---
  duration_ms: 7458.3163
  type: 'test'
  location: 'C:\\Users\\c_mar\\OneDrive\\Desktop\\Apex88\\OnlyFast\\App\\racing-setup-dirt (1)\\onlyfast\\tests\\archive2027InstalledOrder.test.ts:14:1'
  failureType: 'testCodeFailure'
  error: |-
    Reviewed SQL fingerprint changed: phase2-archives.sql
    + actual - expected
    
    + '0E361192A2812D984BCAB17FCB211F1C666BCF226848822B08FF5DB126B22A4F'
    - 'F1374C37D76728469C3ACF5EC5CE352E44442B8862499682C4429A2C75393598'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'F1374C37D76728469C3ACF5EC5CE352E44442B8862499682C4429A2C75393598'
  actual: '0E361192A2812D984BCAB17FCB211F1C666BCF226848822B08FF5DB126B22A4F'
  operator: 'strictEqual'
  stack: |-
    preparePhase2ArchiveInstall (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/scripts/prepare-2027-phase2-archives.mjs:18:12)
    async TestContext.<anonymous> (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/archive2027InstalledOrder.test.ts:37:24)
    async Test.run (node:internal/test_runner/test:1332:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:385:3)
  ...
```

### F2 raw TAP error

```tap
# Subtest: Phase3B artifacts: reviewed fingerprints, testing-only guard, read-only catalog verification and retention SQL
not ok 44 - Phase3B artifacts: reviewed fingerprints, testing-only guard, read-only catalog verification and retention SQL
  ---
  duration_ms: 62.7064
  type: 'test'
  location: 'C:\\Users\\c_mar\\OneDrive\\Desktop\\Apex88\\OnlyFast\\App\\racing-setup-dirt (1)\\onlyfast\\tests\\billing2027Artifacts.test.ts:11:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + '9C8AB51D0033705D08DDBC49C5BD7C038D118E8C3C4BC63D429C9EB6AB4E111B'
    - 'C6A57B6B217141DB0640C60191F5D2FF446E44F2A5B4A1DC5BDB909FC356FE9C'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'C6A57B6B217141DB0640C60191F5D2FF446E44F2A5B4A1DC5BDB909FC356FE9C'
  actual: '9C8AB51D0033705D08DDBC49C5BD7C038D118E8C3C4BC63D429C9EB6AB4E111B'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/billing2027Artifacts.test.ts:16:12)
    async Test.run (node:internal/test_runner/test:1332:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:911:7)
  ...
```

### F3 raw TAP error

```tap
# Subtest: real Assist answers remain readable before dismissal; generation, failures, usage limits and changed owners cannot produce ads
not ok 5 - real Assist answers remain readable before dismissal; generation, failures, usage limits and changed owners cannot produce ads
  ---
  duration_ms: 117.3486
  type: 'test'
  location: 'C:\\Users\\c_mar\\OneDrive\\Desktop\\Apex88\\OnlyFast\\App\\racing-setup-dirt (1)\\onlyfast\\tests\\nativeAdSettings.mjs:315:1'
  failureType: 'testCodeFailure'
  error: 'Unstubbed Settings dependency: ./DeferredFeature'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/nativeAdSettings.mjs:28:11
    eval (eval at compile (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/nativeAdSettings.mjs:22:3), <anonymous>:43:27)
    compile (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/nativeAdSettings.mjs:22:53)
    TestContext.<anonymous> (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/nativeAdSettings.mjs:342:20)
    async Test.run (node:internal/test_runner/test:1332:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:911:7)
  ...
```

### F4 raw TAP error

```tap
# Subtest: both What If CTAs use one panel without automatic requests; failures hide bottom CTA
not ok 93 - both What If CTAs use one panel without automatic requests; failures hide bottom CTA
  ---
  duration_ms: 95.9911
  type: 'test'
  location: 'C:\\Users\\c_mar\\OneDrive\\Desktop\\Apex88\\OnlyFast\\App\\racing-setup-dirt (1)\\onlyfast\\tests\\setupAssistTrackUpdates.mjs:264:1'
  failureType: 'testCodeFailure'
  error: 'Unstubbed dependency ./DeferredFeature'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/setupAssistTrackUpdates.mjs:42:11
    eval (eval at compile (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/setupAssistTrackUpdates.mjs:26:3), <anonymous>:43:27)
    compile (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/setupAssistTrackUpdates.mjs:26:53)
    TestContext.<anonymous> (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/setupAssistTrackUpdates.mjs:270:20)
    Test.runInAsyncScope (node:async_hooks:227:14)
    Test.run (node:internal/test_runner/test:1325:25)
    Test.processPendingSubtests (node:internal/test_runner/test:911:18)
    Test.postRun (node:internal/test_runner/test:1465:19)
    Test.run (node:internal/test_runner/test:1390:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:911:7)
  ...
```

### F5 raw TAP error

```tap
# Subtest: real map selections feed matching speed/phase keys into Setup Assist and What If
not ok 94 - real map selections feed matching speed/phase keys into Setup Assist and What If
  ---
  duration_ms: 85.0963
  type: 'test'
  location: 'C:\\Users\\c_mar\\OneDrive\\Desktop\\Apex88\\OnlyFast\\App\\racing-setup-dirt (1)\\onlyfast\\tests\\setupAssistTrackUpdates.mjs:323:1'
  failureType: 'testCodeFailure'
  error: 'Unstubbed dependency ./DeferredFeature'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/setupAssistTrackUpdates.mjs:42:11
    eval (eval at compile (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/setupAssistTrackUpdates.mjs:26:3), <anonymous>:43:27)
    compile (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/setupAssistTrackUpdates.mjs:26:53)
    TestContext.<anonymous> (file:///C:/Users/c_mar/OneDrive/Desktop/Apex88/OnlyFast/App/racing-setup-dirt%20(1)/onlyfast/tests/setupAssistTrackUpdates.mjs:327:20)
    Test.runInAsyncScope (node:async_hooks:227:14)
    Test.run (node:internal/test_runner/test:1325:25)
    Test.processPendingSubtests (node:internal/test_runner/test:911:18)
    Test.postRun (node:internal/test_runner/test:1465:19)
    Test.run (node:internal/test_runner/test:1390:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:911:7)
  ...
```
