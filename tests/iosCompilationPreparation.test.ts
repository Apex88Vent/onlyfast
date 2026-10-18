import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIosCompileWorkspace } from '../scripts/prepare-ios-compilation-workspace.mjs';
import { validateCompileInput } from '../native/ios/ci/validate-input.mjs';

test('CI workspace rejects an unverified archive before creating output', async () => {
  const root = fileURLToPath(new URL('../tmp/', import.meta.url)); await mkdir(root, { recursive: true });
  const folder = await mkdtemp(path.join(root, 'ios-ci-negative-'));
  const archive = path.join(folder, 'wrong.tar.gz'), output = path.join(folder, 'output');
  await writeFile(archive, 'not the verified licensed export');
  await assert.rejects(prepareIosCompileWorkspace(archive, output), /verified revision-16 archive/);
  await assert.rejects(access(output), { code: 'ENOENT' });
});

test('CI input validator refuses incomplete source instead of claiming a compile', async () => {
  const root = fileURLToPath(new URL('../tmp/', import.meta.url));
  const folder = await mkdtemp(path.join(root, 'ios-ci-missing-'));
  await assert.rejects(validateCompileInput(folder, path.join(folder, 'locks.json')));
  await assert.rejects(access(path.join(folder, 'locks.json')), { code: 'ENOENT' });
});

test('draft workflow stays manual/private, unsigned, simulator-only and outside active workflows', async () => {
  const workflow = await readFile(new URL('../native/ios/ci/unsigned-simulator.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.event\.repository\.private == true && inputs\.approve_compile == true/);
  assert.match(workflow, /timeout-minutes: 45/);
  assert.match(workflow, /CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO/);
  assert.match(workflow, /generic\/platform=iOS Simulator/);
  assert.match(workflow, /OnlyFastBilling\.o/);
  assert.doesNotMatch(workflow, /^\s+(?:push|pull_request|schedule):/m);
  assert.doesNotMatch(workflow, /uses:.*(?:upload|deploy)|-allowProvisioningUpdates|secrets\.|xcrun simctl|xcodebuild archive/);
  await assert.rejects(access(new URL('../.github/workflows/ios-unsigned-compile.yml', import.meta.url)), { code: 'ENOENT' });
});
