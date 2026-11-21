import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use archived build outputs from this repository and the same deployment
// environment. Keep the entire hashed asset directory, including dependencies
// of an old deferred module and assets it may request later.
export async function retainWebAssets(candidate, previousBuilds) {
  const destination = join(candidate, 'assets');
  if (!(await lstat(join(candidate, 'index.html'))).isFile()) throw new Error('Candidate is missing its HTML entry');
  await mkdir(destination, { recursive: true });
  if (!(await lstat(destination)).isDirectory()) throw new Error('Candidate assets must be a directory');

  const retained = [];
  for (const previousBuild of previousBuilds) {
    const previous = join(previousBuild, 'assets');
    if (!(await lstat(previous)).isDirectory()) throw new Error('Archived assets must be a directory');
    for (const file of await readdir(previous, { withFileTypes: true })) {
      if (!file.isFile() || !/^[\w.-]+-[\w-]{8}\.[a-z0-9]+$/i.test(file.name)) {
        throw new Error(`Unexpected archived asset: ${file.name}`);
      }
      const source = join(previous, file.name);
      const target = join(destination, file.name);
      try {
        await copyFile(source, target, constants.COPYFILE_EXCL);
        retained.push(file.name);
      } catch (error) {
        if (error.code !== 'EEXIST' || !(await lstat(target)).isFile()
            || !(await readFile(target)).equals(await readFile(source))) throw error;
      }
    }
  }
  return retained;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [candidate, ...previousBuilds] = process.argv.slice(2);
  if (!candidate || !previousBuilds.length) {
    throw new Error('Usage: node scripts/retain-web-assets.mjs <candidate-dist> <previous-dist> [previous-dist...]');
  }
  const retained = await retainWebAssets(candidate, previousBuilds);
  console.log(`Retained ${retained.length} prior hashed assets`);
}
