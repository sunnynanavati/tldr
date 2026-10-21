import { build } from 'vite';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outDir = resolve('dist/extension');
await build({ configFile: false, publicDir: false, build: {
  outDir, emptyOutDir: true, target: 'chrome120', assetsInlineLimit: () => true, minify: false,
  lib: { entry: resolve('src/extension/content.ts'), name: 'TLDRContent', formats: ['iife'], fileName: () => 'content.js' },
} });
await build({ configFile: false, publicDir: false, build: {
  outDir, emptyOutDir: false, target: 'chrome120', minify: false,
  lib: { entry: resolve('src/extension/worker.ts'), formats: ['es'], fileName: () => 'worker.js' },
} });
await build({ configFile: false, publicDir: false, root: resolve('src/extension'), base: './', build: {
  outDir, emptyOutDir: false, target: 'chrome120', minify: false, rollupOptions: { input: resolve('src/extension/options.html') },
} });
const manifest = {
  manifest_version: 3, name: 'TLDR', version: '0.1.0', minimum_chrome_version: '120',
  description: 'A quiet summary of the passage you select.',
  permissions: ['contextMenus', 'activeTab', 'scripting', 'storage'],
  host_permissions: ['http://127.0.0.1/*'],
  background: { service_worker: 'worker.js', type: 'module' },
  action: { default_title: 'TLDR · Connection settings' },
  options_ui: { page: 'options.html', open_in_tab: true },
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'" },
};
await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await copyFile('src/ui/assets/OFL.txt', resolve(outDir, 'OFL.txt'));
await copyFile('LICENSE', resolve(outDir, 'LICENSE.txt'));
await writeFile(resolve(outDir, 'THIRD_PARTY_LICENSES.txt'), [
  'Bundled code retains its own license; TLDR’s all-rights-reserved notice does not override these terms.',
  'Zod\n' + await readFile('node_modules/zod/LICENSE', 'utf8'),
  'Vite (bundled runtime helpers)\n' + await readFile('node_modules/vite/LICENSE.md', 'utf8'),
  'Inter: see OFL.txt included in this distribution.',
].join('\n\n'));
await build({ configFile: false, publicDir: false, build: {
  outDir: resolve('dist/server'), emptyOutDir: true, target: 'node24', ssr: resolve('src/server/main.ts'), minify: false,
  rollupOptions: { output: { entryFileNames: 'main.js' } },
} });
await mkdir('dist', { recursive: true });
console.log('Load dist/extension in chrome://extensions. Start the backend with npm start.');
