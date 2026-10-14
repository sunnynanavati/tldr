import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { template } from '../src/ui/template';

const output = await build({ configFile: false, publicDir: false, logLevel: 'error', build: {
  write: false, target: 'chrome120', minify: true,
  lib: { entry: resolve('src/dev/studio-runtime.ts'), name: 'TLDRStudio', formats: ['iife'] },
} });
const builds = Array.isArray(output) ? output : [output];
const bundle = builds.flatMap(result => 'output' in result ? result.output : []).find(chunk => chunk.type === 'chunk');
if (!bundle || bundle.type !== 'chunk') throw new Error('Studio bundle missing.');
const path = 'prototypes/tldr.html';
let html = await readFile(path, 'utf8');
const replace = (start: string, end: string, contents: string) => {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Studio marker missing: ${start}`);
  html = html.slice(0, from + start.length) + '\n' + contents + '\n' + html.slice(to);
};
replace('<!-- STUDIO_RUNTIME_START -->', '<!-- STUDIO_RUNTIME_END -->', `<script>${bundle.code.replace(/<\/script/gi, '<\\/script')}</script>`);
replace('/* STUDIO_GLASS_START */', '/* STUDIO_GLASS_END */', await readFile('src/ui/glass.css', 'utf8'));
replace('<dialog open class="glass" id="dialog" aria-labelledby="dialog-title">', '</dialog>', template.trim());
await writeFile(path, html);
console.log('Studio synced: live preset, dialog CSS/markup, word reveal, counter, slider, and fixtures.');
