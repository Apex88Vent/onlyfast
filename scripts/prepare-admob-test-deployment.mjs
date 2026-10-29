// Package only the compiled, origin-restricted Google demo-ad bundle for Vercel.
// Never reads secrets, uploads source/QA files, links a project, or deploys.
import assert from 'node:assert/strict';
import { access, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ADMOB_TEST_PROJECT = 'prj_WXGvVgSNRZl7ytIFK8s4do4wpWA1';
export async function prepareAdmobTestDeployment(root) {
  const source = path.join(root, 'dist-admob-test');
  await access(path.join(source, 'index.html'));
  const assets = await readdir(path.join(source, 'assets'));
  const main = assets.find(name => /^main-.*\.js$/.test(name));
  assert.ok(main, 'Build the admob-test bundle first.');
  const js = await readFile(path.join(source, 'assets', main), 'utf8');
  assert.ok(js.includes('https://onlyfast-admob-test.vercel.app'), 'Refuse an ordinary or unrecognized bundle.');
  const output = path.join(root, '.vercel', 'output');
  // Refuse to replace unrelated/pre-existing build output.
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output);
  await cp(source, path.join(output, 'static'), { recursive: true, errorOnExist: true, force: false });
  await writeFile(path.join(output, 'config.json'), JSON.stringify({ version: 3,
    routes: [{ handle: 'filesystem' }, { src: '/.*', dest: '/index.html' }] }, null, 2));
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log(await prepareAdmobTestDeployment(root));
  console.log(`Prepared demo-ad output only. Deploy exclusively to ${ADMOB_TEST_PROJECT}; never to the OnlyFast production project.`);
}
