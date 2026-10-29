import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareAdmobTestDeployment, ADMOB_TEST_PROJECT } from '../scripts/prepare-admob-test-deployment.mjs';

test('test deployment packs only compiled test assets and refuses ordinary or existing output', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'onlyfast-admob-output-'));
  await mkdir(path.join(root, 'dist-admob-test/assets'), { recursive: true });
  await writeFile(path.join(root, 'dist-admob-test/index.html'), '<div id="root"></div>');
  await writeFile(path.join(root, 'dist-admob-test/assets/main-test.js'), 'ordinary production bundle');
  await assert.rejects(prepareAdmobTestDeployment(root), /Refuse/);
  await writeFile(path.join(root, 'dist-admob-test/assets/main-test.js'), 'https://onlyfast-admob-test-apex88vents-projects.vercel.app');
  await writeFile(path.join(root, 'operator-credentials.local.json'), 'synthetic-do-not-upload');
  const output = await prepareAdmobTestDeployment(root);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'config.json'), 'utf8')), { version: 3,
    routes: [{ handle: 'filesystem' }, { src: '/.*', dest: '/index.html' }] });
  await assert.rejects(access(path.join(output, 'static/operator-credentials.local.json')));
  await assert.rejects(prepareAdmobTestDeployment(root), { code: 'EEXIST' });
  assert.notEqual(ADMOB_TEST_PROJECT, 'prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR');
});
