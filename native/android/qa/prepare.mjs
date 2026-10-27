// Internal runtime QA only. Never edit the vendor download or release inputs.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
const argument = flag => { assert.ok(args.includes(flag), `${flag} is required`); return path.resolve(args[args.indexOf(flag) + 1]); };
const source = argument('--source');
const workspace = argument('--workspace');
const tester = argument('--tester');
const output = argument('--output');
assert.ok(output.startsWith(path.join(root, 'tmp') + path.sep), 'QA output must be inside this worktree tmp directory.');
const config = await readFile(path.join(workspace, 'supabase/config.toml'), 'utf8');
assert.match(config, /^project_id = "onlyfast-disposable-staging"$/m);
assert.doesNotMatch(config, /\[remotes/);
await assert.rejects(access(path.join(workspace, 'supabase/.temp/project-ref')), { code: 'ENOENT' });
const settings = JSON.parse(await readFile(path.join(workspace, 'local-status.json'), 'utf8'));
assert.equal(settings.API_URL, 'http://127.0.0.1:54321');
assert.equal(new URL(settings.DB_URL).hostname, '127.0.0.1');
assert.equal(JSON.parse(Buffer.from(settings.ANON_KEY.split('.')[1], 'base64url')).role, 'anon');
const login = JSON.parse(await readFile(tester, 'utf8'));
assert.equal(login.localOnly, true);
assert.ok(login.email.endsWith('@example.invalid'));
const prepared = spawnSync(process.execPath, [path.join(root, 'scripts/prepare-median-release-source.mjs'), '--source', source, '--output', output], { encoding: 'utf8' });
assert.equal(prepared.status, 0, prepared.stderr);

const billingPath = path.join(output, 'app/src/main/java/app/onlyfast/billing/OnlyFastBilling.kt');
const original = await readFile(billingPath, 'utf8');
assert.match(original, /TRANSACTIONS_ENABLED = false/);
let qa = original.replace('https://thpyjvwtfvfxiufchrxn.supabase.co/auth/v1/user', 'http://127.0.0.1:54321/auth/v1/user')
  .replace('sb_publishable_ybLt4_i5kyRQxjRv4YbRsg_kcEqzTxv', settings.ANON_KEY)
  .replace('setOf("https://onlyfast.app", "https://www.onlyfast.app")', 'setOf("http://127.0.0.1:8086")')
  .replace('check(response.getString("id") == expected)', 'check(response.getString("id") == expected)\n            requireQaTester(expected, token, response)');
// Additional QA restriction, never a replacement for release Auth verification.
const testerGate = `
    private fun requireQaTester(id: String, token: String, user: JSONObject) {
        check(user.optString("email").endsWith("@example.invalid")) { "Synthetic local tester required" }
        fun read(path: String): JSONArray {
            val connection = URL("http://127.0.0.1:54321" + path).openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false; connection.connectTimeout = 8000; connection.readTimeout = 8000
            connection.setRequestProperty("apikey", PUBLISHABLE_KEY)
            connection.setRequestProperty("Authorization", "Bearer " + token)
            try { check(connection.responseCode == 200); return JSONArray(connection.inputStream.bufferedReader().use { it.readText() }) }
            finally { connection.disconnect() }
        }
        val accounts = read("/rest/v1/beta_tester_accounts?user_id=eq.$id&select=is_test_account,beta_features_enabled,tester_kind")
        check(accounts.length() == 1)
        val account = accounts.getJSONObject(0)
        check(account.optBoolean("is_test_account") && account.optBoolean("beta_features_enabled") && account.optString("tester_kind") == "experimental")
        val flags = read("/rest/v1/user_feature_flags?user_id=eq.$id&select=feature_key,enabled")
        var enabled = false
        for (i in 0 until flags.length()) {
            val flag = flags.getJSONObject(i)
            if (flag.optBoolean("enabled")) {
                check(flag.optString("feature_key") != "test_account_full_access")
                if (flag.optString("feature_key") == "native_subscription_testing") enabled = true
            }
        }
        check(enabled)
    }
`;
qa = qa.replace('    private fun ensureIdentity(', testerGate + '\n    private fun ensureIdentity(');
assert.doesNotMatch(qa, /thpyjvwtfvfxiufchrxn/);
await writeFile(billingPath, qa);
const assets = path.join(output, 'app/src/debug/assets');
await mkdir(assets, { recursive: true });
const appConfig = JSON.parse(await readFile(path.join(output, 'app/src/main/assets/appConfig.json'), 'utf8'));
appConfig.general.initialUrl = 'http://127.0.0.1:8086/';
appConfig.general.appName = 'OnlyFast Release Bridge QA';
await writeFile(path.join(assets, 'appConfig.json'), JSON.stringify(appConfig, null, 2));
await mkdir(path.join(output, 'app/src/debug/res/xml'), { recursive: true });
await writeFile(path.join(output, 'app/src/debug/res/xml/onlyfast_qa_network.xml'), '<?xml version="1.0" encoding="utf-8"?><network-security-config><base-config cleartextTrafficPermitted="false"/><domain-config cleartextTrafficPermitted="true"><domain includeSubdomains="false">127.0.0.1</domain></domain-config></network-security-config>');
await writeFile(path.join(output, 'app/src/debug/AndroidManifest.xml'), '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"><application android:networkSecurityConfig="@xml/onlyfast_qa_network" android:label="OnlyFast Release Bridge QA" tools:replace="android:networkSecurityConfig,android:label" /></manifest>');
// Registered ID is necessary to read the real Play catalog. Emulator only;
// install is separately guarded against replacing a production-signed app.
await writeFile(path.join(output, 'qa.init.gradle'), "allprojects { plugins.withId('com.android.application') { androidComponents.finalizeDsl { extension -> extension.buildTypes.getByName('debug').applicationIdSuffix = '' } } }\n");
const state = { output, workspace, tester, localOnly: true, sourceSha256: createHash('sha256').update(original).digest('hex'),
  transactionsEnabled: false, releaseClassInMainSourceSet: true, qaChanges: ['local origin and Auth/public key', 'additional server-managed synthetic tester gate', 'debug asset/network/label and registered package overlay'] };
await writeFile(path.join(output, 'ONLYFAST_QA_PREPARATION.json'), JSON.stringify(state, null, 2));
console.log(JSON.stringify({ output, localOnly: true, transactionsEnabled: false, releaseClassInMainSourceSet: true }));
