import { execFileSync } from 'node:child_process';
import { readdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// Package only the freshly built extension, never the project or installed service.
const directory = resolve('dist/extension');
const output = resolve('dist/tldr-chrome.zip');
const temporary = resolve('dist/tldr-chrome.next.zip');
const files = ['manifest.json', 'content.js', 'worker.js', 'options.html', 'OFL.txt', 'LICENSE.txt', 'THIRD_PARTY_LICENSES.txt'];
for (const name of await readdir(resolve(directory, 'assets'))) {
  if (!/^options-[\w-]+\.(?:js|css)$/u.test(name)) throw new Error('Unexpected extension asset; review before packaging.');
  files.push(`assets/${name}`);
}
await rm(temporary, { force: true });
try {
  execFileSync('zip', ['-q', '-X', temporary, ...files], { cwd: directory, stdio: 'pipe' });
  await rename(temporary, output);
  console.log('Packaged dist/tldr-chrome.zip from the current extension build (no backend or credentials).');
} catch {
  await rm(temporary, { force: true });
  throw new Error('Extension packaging failed. Install the zip command and run npm run package:extension again.');
}
