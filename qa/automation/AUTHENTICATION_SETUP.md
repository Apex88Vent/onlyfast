# Existing OnlyFast QA authentication setup

Configuration follow-up: November 5, 2026. Uses the existing runner and Supabase Auth account; no application/authentication implementation was changed.

## Simple setup: save the existing password once

1. Open **`C:\Users\c_mar\.onlyfast-qa\qa.env`** in a private local text editor. This protected file already exists outside the repository. Do not paste its contents into chat or a shared screen.
2. Keep the existing `ONLYFAST_QA_URL`, `ONLYFAST_QA_PUBLIC_KEY` and `ONLYFAST_QA_USER_ID` values. Change only the blank `ONLYFAST_QA_PASSWORD=` line to contain the **existing `test@test.com` password**, enclosed in single quotes. Do not change the account password. If the password contains a single quote, use double quotes around it instead; if it contains both quote types, use the private terminal prompt option below instead of guessing the file format.
3. Leave `ONLYFAST_QA_REFRESH_TOKEN=` blank and save the file. Do not add approval flags to this file. The password then stays in the protected external file for later runs; you do not need to enter it again for each Codex session.

The required file variable names are:

```dotenv
ONLYFAST_QA_URL=
ONLYFAST_QA_PUBLIC_KEY=
ONLYFAST_QA_USER_ID=
ONLYFAST_QA_PASSWORD=
ONLYFAST_QA_REFRESH_TOKEN=
```

This is a names-only reference, **not a replacement for your already populated file**. Use the password field for this setup; the refresh-token field is an optional alternative and stays blank.

## Run configuration verification and authenticated QA

Open PowerShell in the primary checkout and run:

```powershell
Set-Location -LiteralPath 'C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\onlyfast'
$env:ONLYFAST_QA_SECRET_FILE = 'C:\Users\c_mar\.onlyfast-qa\qa.env'
$env:ONLYFAST_QA_PRODUCTION_READS_APPROVED = 'true'
Remove-Item Env:ONLYFAST_QA_PASSWORD, Env:ONLYFAST_QA_REFRESH_TOKEN,
  Env:ONLYFAST_QA_PRODUCTION_MUTATIONS_APPROVED, Env:ONLYFAST_QA_RESET_APPROVED,
  Env:ONLYFAST_QA_EDGE_READS_APPROVED -ErrorAction SilentlyContinue
npm run qa:check -- --env production
```

This validates the saved configuration; **it does not sign in**. If it passes, verify normal authentication and run the existing read-only QA checks with:

```powershell
npm run qa:smoke -- --env production
```

That command performs both login verification and authenticated smoke testing; there is no separate authentication-only command. A successful report must show `authentication.status: authenticated_and_verified`, `authentication.logout: local_session_disposed`, and a passed overall status. The optional OnlyLaps Edge check is skipped with these settings. A successful login alone does not mean every smoke check passed. If a command fails, stop and read its redacted report; do not reset the account or enable mutation flags.

Afterward, close the terminal or remove the temporary run settings:

```powershell
Remove-Item Env:ONLYFAST_QA_SECRET_FILE, Env:ONLYFAST_QA_PRODUCTION_READS_APPROVED -ErrorAction SilentlyContinue
```

For future Codex testing, say: **“Use the existing external QA file at `C:\Users\c_mar\.onlyfast-qa\qa.env`; run the existing configuration check and production read-only smoke tests for `test@test.com`. Preserve fixtures; no reset, mutations, providers or deployment.”** Codex can set the same process variables and reuse the stored credential without asking you to paste it. The read approval remains specific to each requested run.

## Current status

External configuration prepared at `C:\Users\c_mar\.onlyfast-qa\qa.env`. The directory has inheritance disabled and grants access only to the current Windows account; the file inherits that access. It is outside the repository and contains no password, access token, refresh token, privileged API key or runtime approval flag.

| Setting | Status |
|---|---|
| `ONLYFAST_QA_URL` | Set to confirmed production API `https://thpyjvwtfvfxiufchrxn.supabase.co` |
| `ONLYFAST_QA_PUBLIC_KEY` | Set to the existing enabled publishable key, obtained read-only from Supabase; value intentionally omitted here |
| `ONLYFAST_QA_USER_ID` | Set to approved identity `4b9864ff-2195-4be0-83a4-39308446577e` |
| `ONLYFAST_QA_PASSWORD` | Blank; existing account password must come from the operator's approved credential source |
| `ONLYFAST_QA_REFRESH_TOKEN` | Blank; an approved dedicated QA session can be used instead of a password |
| `ONLYFAST_QA_SECRET_FILE` | Runtime pointer to the external file; not persisted in user/machine environment |
| `ONLYFAST_QA_PRODUCTION_READS_APPROVED` | Runtime `true` for the specifically authorized read-only run; not persisted |

The email is pinned by existing code to `test@test.com`; no email setting, new account or tier override is needed. A fresh server `getUser` must match both email and UUID; stored experimental tester/master flags are then checked. Wrong identity or revoked tester permission aborts the run.

No usable credential was discovered in process/user/machine QA environment variables, the expected external QA configuration locations, matching Windows Credential Manager entries, or installed PowerShell/CLI secret-store integrations. Existing native-sandbox configuration contains frontend settings, not a QA password/session. Browser tokens, Supabase management/OAuth tokens, privileged keys and repository-contained historical artifacts are not substitutes for an approved QA credential.

Read-only connector inspection confirmed that the existing Auth account is present, not deleted/banned and has a configured password. All four existing tester flags remain enabled. This is administrative record inspection, **not a successful normal account login**.

## One-time remaining setup

Supply **one** existing approved credential through the existing interface:

1. Preferred for repeatable automation: map the account's existing password from an approved local/CI secret store to `ONLYFAST_QA_PASSWORD`. Alternatively, populate that variable in the already protected external `qa.env` using a private local editor. Follow Node environment-file quoting rules for the password's actual characters. Leave `ONLYFAST_QA_REFRESH_TOKEN` blank when using a password.
2. Session alternative: supply an approved dedicated `test@test.com` refresh token as `ONLYFAST_QA_REFRESH_TOKEN`, leaving the password blank. Normal refresh rotates it; the runner's local logout revokes that automation session, so it must not be someone else's reused browser session. This is not a permanent reusable bearer token.

Never send either credential in chat, command arguments, logs, Git, app `VITE_*` settings or a public control. Do not generate/reset the existing password. The account's configured password cannot be recovered through the Supabase account-inspection query. If it is unavailable, the credential owner must supply an existing approved credential; stop until that is available.

The following option prompts privately and keeps the password in this PowerShell process only. It requires no credential to be written to disk and calls only existing commands. Run it yourself in a private local terminal from the primary checkout; do not run it through a chat/tool input field. The prompt accepts the **existing** account password, not a replacement.

```powershell
$qaNames = @('ONLYFAST_QA_SECRET_FILE', 'ONLYFAST_QA_PASSWORD',
  'ONLYFAST_QA_REFRESH_TOKEN', 'ONLYFAST_QA_PRODUCTION_READS_APPROVED',
  'ONLYFAST_QA_PRODUCTION_MUTATIONS_APPROVED', 'ONLYFAST_QA_RESET_APPROVED',
  'ONLYFAST_QA_EDGE_READS_APPROVED')
$qaPrevious = @{}
foreach ($qaName in $qaNames) {
  $qaPrevious[$qaName] = [Environment]::GetEnvironmentVariable($qaName, 'Process')
}
$qaSecret = $null
$qaBuffer = [IntPtr]::Zero
try {
  $env:ONLYFAST_QA_SECRET_FILE = Join-Path $env:USERPROFILE '.onlyfast-qa\qa.env'
  $env:ONLYFAST_QA_PRODUCTION_READS_APPROVED = 'true'
  $env:ONLYFAST_QA_REFRESH_TOKEN = ''
  Remove-Item Env:ONLYFAST_QA_PRODUCTION_MUTATIONS_APPROVED,
    Env:ONLYFAST_QA_RESET_APPROVED, Env:ONLYFAST_QA_EDGE_READS_APPROVED `
    -ErrorAction SilentlyContinue
  $qaSecret = Read-Host 'Existing password for test@test.com' -AsSecureString
  $qaBuffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($qaSecret)
  $env:ONLYFAST_QA_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($qaBuffer)
  npm run qa:check -- --env production
  if ($LASTEXITCODE -ne 0) { throw 'QA configuration failed; inspect its redacted report.' }
  npm run qa:smoke -- --env production
  if ($LASTEXITCODE -ne 0) { throw 'QA smoke failed; inspect its redacted report.' }
} finally {
  if ($qaBuffer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($qaBuffer)
  }
  if ($qaSecret) { $qaSecret.Dispose() }
  foreach ($qaName in $qaNames) {
    [Environment]::SetEnvironmentVariable($qaName, $qaPrevious[$qaName], 'Process')
  }
  $qaPrevious.Clear()
}
```

If the approved credential is already supplied by an external store/file, set the file pointer and production read approval in that process, clear the mutation/reset/edge flags, and run the same two commands. Do not append `--mutations`, run fixture seed/reset, or enable any provider flag for this task.

## What verification will do

`qa:check -- --env production` validates configuration only. It does not prove the password works.

`qa:smoke -- --env production` then uses normal Supabase authentication, verifies the dedicated identity/tester designation, reads only owned setup/schedule/share metadata, reads trusted membership, tests an invalid sharing code, refreshes the token and signs out only its own automation session. No fixture cleanup or reset is needed in this mode. The ordinary browser app is not launched; its deployed login/logout reset callbacks are not involved. Provider/OnlyLaps Edge calls remain disabled. No purchase/ad/UI action is triggered. See [normal password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword) and [local sign-out scope](https://supabase.com/docs/reference/javascript/auth-signout).

Reports appear under ignored `tmp/qa-automation/<timestamp>-<run UUID>/report.json`. Read `authentication.status`, individual checks and the process exit code. A configuration failure is not an attempted or failed password login.

## Verification actually performed

| Check | Actual result |
|---|---|
| Initial existing configuration check | Stopped before Auth: `QA_URL_REQUIRED` |
| Check with prepared external public configuration | Stopped before Auth: `QA_AUTH_CONFIGURATION_REQUIRED` |
| Existing production read-only smoke command | Stopped at the same configuration guard; no sign-in or authenticated smoke checks executed |
| Normal QA authentication | **Not attempted**; approved password/session unavailable |
| Fresh authenticated identity verification | **Not performed**; administrative Auth record check only |
| Fixture preservation | No insert/update/delete/reset; existing inventory remains 15 setups, two shares, zero schedule rows |
| Account permissions | Existing experimental designation/master access and four flags retained |

Before/after aggregate setup fingerprints matched. Hash verification also confirmed 24 protected existing source/release/configuration files remained unchanged; only the main QA report was intentionally updated, and this setup guide was added. The private-prompt PowerShell example passed syntax parsing without execution. No secret was entered or written by that verification.

Redacted reports:

- Initial check: `tmp/qa-automation/2026-11-05T17-05-36.334Z-3fd68335-ca89-47f6-befe-a6978e827ffb/report.json`.
- Prepared-config check: `tmp/qa-automation/2026-11-05T17-07-34.097Z-3c1e0382-e892-4642-a05b-834ee6f3f5c2/report.json`.
- Guarded smoke invocation: `tmp/qa-automation/2026-11-05T17-07-35.125Z-bef7012c-05a0-439b-80fb-dfead8e32d1c/report.json`.

Only the missing approved account credential blocks normal authentication and subsequent read-only smoke. No reset endpoint, M2/M3 deployment, isolated restore, provider credentials, billing change or new QA system is required to resolve that configuration gate. A later authenticated run can still reveal access/network issues; no such result is assumed in advance. The seven older local regression failures documented in the main QA report were not rerun or changed by this configuration task.

## Scope preserved

No changes to `qa/automation` JavaScript, Auth implementation, fixtures, application UI, billing/subscription/ad/racing behavior, migrations or deployed services. No Phase 1 release restart, M2/M3 application, purchase, ad/provider call, frontend/Edge deployment, commit or push. The older release document's proposed personal-account session gate belongs to that separate release; the current QA task explicitly selects `test@test.com` and does not resume the release.
