// Build a new LOCAL, self-contained review folder. Never creates a GitHub repo,
// initializes/pushes Git, executes CI, resolves dependencies or runs Xcode.
import assert from 'node:assert/strict';
import { readFile, writeFile, cp, access, realpath, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const archiveHash = '91431fbdc8761910f1cef4ea8e167e0eb9c2810296c83e1321418ca0fea11628';
export async function prepareIosCompileWorkspace(archivePath, outputPath) {
  const archive = await realpath(path.resolve(archivePath));
  assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), archiveHash, 'Use only the verified revision-16 archive.');
  const requested = path.resolve(outputPath);
  const output = path.join(await realpath(path.dirname(requested)), path.basename(requested));
  assert.ok(archive.toLowerCase() !== output.toLowerCase() && !archive.toLowerCase().startsWith(output.toLowerCase() + path.sep));
  await assert.rejects(access(output), { code: 'ENOENT' });
  const entries = execFileSync('tar', ['-tf', archive], { encoding: 'utf8', maxBuffer: 10_000_000 }).trim().split(/\r?\n/);
  assert.ok(entries.every(entry => entry.startsWith('ios/') && !entry.split('/').includes('..') && !entry.includes('\\')), 'Unexpected archive path.');
  assert.ok(entries.every(entry => !/(?:^|\/)(?:\.env(?:\.|$)|\.netrc$)|\.(?:p8|p12|mobileprovision|keystore|jks)$/i.test(entry)), 'Signing/credential material must not enter CI.');
  const files = ['scripts/inspect-median-ios-source.mjs', 'scripts/prepare-median-ios-release-source.mjs',
    'native/ios/OnlyFastBilling.swift', 'native/ios/ci/validate-input.mjs'];
  await mkdir(output);
  for (const file of files) {
    await mkdir(path.dirname(path.join(output, file)), { recursive: true });
    await cp(path.join(root, file), path.join(output, file));
  }
  await mkdir(path.join(output, 'source'));
  await cp(archive, path.join(output, 'source/ios_source.tar.gz'));
  await writeFile(path.join(output, 'source/ios_source.sha256'), `${archiveHash}  source/ios_source.tar.gz\n`);
  await mkdir(path.join(output, '.github/workflows'), { recursive: true });
  await cp(path.join(root, 'native/ios/ci/unsigned-simulator.yml'), path.join(output, '.github/workflows/ios-unsigned-compile.yml'));
  await writeFile(path.join(output, '.gitignore'), 'build/\nDerivedData/\nSourcePackages/\n**/xcuserdata/\n**/._*\n.DS_Store\n*.ipa\n*.p8\n*.p12\n*.mobileprovision\n.env*\n');
  await writeFile(path.join(output, 'README.md'), '# Private OnlyFast iOS compile review\n\nContains licensed Median source: keep PRIVATE. No Git remote/repository was created.\n\nAfter explicit approval, upload this folder to a separate private repository with Actions enabled. Keep the workflow on its default branch, review the included source and cost budget, then dispatch exactly one approved unsigned compile. No Apple/signing/RevenueCat private credentials are required by this workflow. It builds only, never launches the app.\n');
  const manifest = { archiveSha256: archiveHash, sourceRevision: 16, sdk: '5.96.0', publicRepositoryAllowed: false,
    manualDispatchOnly: true, workflowExecuted: false, compiled: false, signing: false, uploadsPerformed: false };
  await writeFile(path.join(output, 'LOCAL_COMPILATION_PREPARATION.json'), JSON.stringify(manifest, null, 2));
  return { output, ...manifest };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.equal(args.length, 4, 'Usage: --archive <verified-revision16.tar.gz> --output <NEW-local-directory>');
  assert.equal(args[0], '--archive'); assert.equal(args[2], '--output');
  console.log(JSON.stringify(await prepareIosCompileWorkspace(args[1], args[3]), null, 2));
}
