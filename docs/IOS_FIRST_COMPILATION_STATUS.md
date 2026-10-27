# First iOS compilation request — stopped before upload

## Renewed build approval: Phase 1 restriction found

The renewed request authorizes one private GitHub Actions build with up to $2 compute beyond included allowance, and requires stopping if an applicable agreement explicitly prohibits the proposed hosting. No earlier simulator, Android or catalog diagnostics were repeated.

The revision-16 source README points to `https://median.co/license`; that URL returned HTTP 403 during this check. Its bundled license files describe third-party open-source components, not a grant covering Median source hosting. The exported vendor Renovate workflow refers to a vendor private repository; it does not grant customer hosting rights.

Median's current published Online Terms were read directly. Sections 1.3 and 2.6(b) restrict third-party source disclosure; section 7.3 expressly requires GoNative's prior written consent for source disclosure to any third party. Applying that restriction to uploading source into a private GitHub repository and executing it on GitHub-hosted runners is an interpretation, not a legal determination. The terms allow a separate Median Customer Agreement to govern covered applications, but no applicable agreement or written consent overriding this restriction was found in the available source files.

Stopped at the user's explicit Phase 1 condition, before repository creation/upload. An applicable customer agreement or written Median permission covering private GitHub storage and hosted CI is needed to resolve this restriction. No request for renewed spending approval is necessary within the already authorized single-build/$2 limit once the restriction is resolved.

Renewed request results:

- Private repository and workflow URLs: none created or verified in this attempt.
- Compilation: **NOT RUN (blocked before upload)**; neither PASSED nor FAILED.
- Swift/compiler/linker errors: none available; adapter compilation remains unverified.
- Build duration: not applicable; zero Actions runs dispatched.
- Cost: no CI compute consumed by this attempt. Published standard macOS compute is $0.062/minute; a 30-minute job estimates $1.86 before tax, within the authorized $2 compute limit. Account allowance/billing was not checked after the earlier stopping condition was found.
- Existing manual unsigned simulator workflow, adapter, dependency locks and local preparation remain intact. No native implementation, signing, production configuration or readiness hold changed.
- Next action: resolve the explicit source-disclosure restriction, then verify private repository visibility and billing, upload the reviewed inputs, and dispatch exactly one compilation. A successful compile would still require separately approved iOS runtime testing.

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
