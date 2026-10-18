# First iOS compilation request — stopped before upload

Date: October 17, 2026 (Pacific). Starting branch/commit: `codex/native-revenuecat-release` / `b514c9f8`. **No GitHub repository was created, native source uploaded, workflow dispatched, or Xcode job run.** The user's licensing verification condition could not be satisfied.

## Blocking license check

[Median's published terms](https://median.co/terms), updated October 13, 2026, permit internal source building/modification in section 2.2(a), restrict source disclosure to third parties in sections 1.3/2.6(b), and require prior written consent for third-party source disclosure in section 7.3. The available OnlyFast evidence confirms a PLUS license and source access, but no agreement specifically covering private GitHub storage/hosted CI was found. The generic source-build guide and Enterprise download API documentation do not establish that permission for this account. This is an unresolved permission check, not a determination that private CI is prohibited. Per the user's explicit instruction, uploading was stopped.

Required input: an applicable Median license/customer agreement permitting private repository hosting and hosted compilation, or Median's written confirmation covering that use. No message was sent to Median, no paid plan was purchased, and no license terms were accepted on the user's behalf.

## Requested results

| Item | Actual result |
| --- | --- |
| Private repository URL | None created/verified. Read-only lookup of suggested `Apex88Vent/onlyfast-native-ios` returned HTTP 404; this means absent or inaccessible to this connection, not proof it does not exist. |
| Source privacy | No native source uploaded to any repository; public `Apex88Vent/onlyfast` untouched. Privacy of suggested private repository could not be confirmed. |
| Actions workflow URL | None; workflow exists locally only. |
| Xcode compilation | Not run; neither pass nor compiler failure claimed. |
| Compiler/linker/native registration output | None; no dependency resolution or native compilation ran. |
| Actual build duration | Not applicable; zero workflows dispatched. |
| Actual Actions usage/cost | No job was started by this task. Account-wide allowance, current charges and configured billing limits remain unverified. |
| Runtime next steps | Resolve license permission, establish/verify dedicated private repository, check allowance/budget, dispatch one approved unsigned compile, inspect actual compiler/linker findings, then separately prepare isolated iOS runtime testing. |

## Local preparation retained

The inactive manual workflow now has **30-minute timeout**, matching the user's limit. It remains private-repository guarded, standard `macos-26` / Xcode 26.6, unsigned simulator only, manual approval boolean, no automatic push/PR triggers, no app launch, signing, IPA, cache/artifact upload or deployment.

At the currently published standard macOS [rate of $0.062/minute](https://docs.github.com/en/billing/reference/actions-runner-pricing), 30 minutes corresponds to approximately **$1.86 compute** beyond included allowance, before applicable taxes/other account activity. This is a rate-based estimate, not verified account billing or a guarantee of total account charges. The allowance and spending-control checks must still pass before dispatch; no paid job was used to obtain them.

Fresh LOCAL review workspace: `C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\ios-first-compilation-review`. Prior review folders were preserved. The verified revision-16 archive hash matched, with no signing/credential file paths detected by the preparer. Existing source inspection and adapter preparation retain `app.onlyfast`, SDK 5.96.0, Median plugin 1.1.2, native bridge registration, single-owner initialization policy and unchanged dependencies. No SDK/native implementation changed in this request.

Validation: three focused preparation tests and focused ESLint passed after reducing the timeout. Historical build preparation and Android tests were not repeated. Only workflow limit/test, this report and follow-up documentation changed locally. Public `NATIVE_PURCHASES_READY=false` and native transaction holds remain false. No production, billing, store, offering, customer data, branch deletion or deployment change occurred.
