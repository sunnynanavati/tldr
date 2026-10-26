import { build } from 'esbuild';
import { chmod, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createConnection } from 'node:net';
import { SERVICE_LABEL, servicePlist } from './service-config';
import { localTokenIssue } from '../src/shared/connection';

const exec = promisify(execFile);
const project = fileURLToPath(new URL('../', import.meta.url));
const directory = join(homedir(), 'Library/Application Support/TLDR/backend');
const plist = join(homedir(), 'Library/LaunchAgents', `${SERVICE_LABEL}.plist`);
const domain = `gui/${process.getuid!()}`, target = `${domain}/${SERVICE_LABEL}`;
const command = process.argv[2] ?? 'status';
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function loaded() { try { await exec('/bin/launchctl', ['print', target]); return true; } catch { return false; } }
async function health() {
  try {
    const env = parseEnv(await readFile(join(directory, '.env'), 'utf8'));
    const response = await fetch('http://127.0.0.1:4317/health', {
      headers: { Authorization: `Bearer ${env.TLDR_LOCAL_TOKEN}`, 'X-TLDR-Extension-Id': env.TLDR_EXTENSION_ID ?? '' }, signal: AbortSignal.timeout(1500),
    });
    return response.ok && (await response.json() as { ready?: boolean }).ready === true;
  } catch { return false; }
}
async function portOccupied(): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port: 4317 });
    const done = (value: boolean) => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.setTimeout(1000, () => done(true));
  });
}
async function install() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24 to install the TLDR service.');
  const environment = await readFile(resolve(project, '.env'), 'utf8');
  const env = parseEnv(environment);
  if (!env.OPENAI_API_KEY || localTokenIssue(env.TLDR_LOCAL_TOKEN ?? '') || !/^[a-p]{32}$/.test(env.TLDR_EXTENSION_ID ?? '')) {
    throw new Error('Complete OPENAI_API_KEY, TLDR_LOCAL_TOKEN, and TLDR_EXTENSION_ID in the project .env first.');
  }
  // Package dependencies and a Node runtime outside Documents so launchd does not
  // depend on a terminal, dev checkout permissions, PATH, or a shell profile.
  const bundle = await build({ entryPoints: [resolve(project, 'src/server/main.ts')], bundle: true, write: false, platform: 'node', target: 'node24', format: 'esm',
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, logLevel: 'silent' });
  await mkdir(directory, { recursive: true, mode: 0o700 }); await chmod(directory, 0o700);
  await mkdir(join(homedir(), 'Library/LaunchAgents'), { recursive: true });
  await writeFile(join(directory, 'server.mjs.next'), bundle.outputFiles![0]!.contents, { mode: 0o600 });
  await copyFile(process.execPath, join(directory, 'node.next')); await chmod(join(directory, 'node.next'), 0o700);
  await writeFile(join(directory, '.env.next'), environment, { mode: 0o600 }); await chmod(join(directory, '.env.next'), 0o600);
  if (await loaded()) await exec('/bin/launchctl', ['bootout', target]);
  for (let i = 0; i < 20 && await portOccupied(); i++) await pause(100);
  if (await portOccupied()) throw new Error('Port 4317 is occupied by another process. Stop the manually started backend, then install again.');
  for (const name of ['node', 'server.mjs', '.env']) await rename(join(directory, `${name}.next`), join(directory, name));
  await writeFile(plist, servicePlist(directory), { mode: 0o600 });
  await exec('/usr/bin/plutil', ['-lint', plist]);
  await exec('/bin/launchctl', ['enable', target]);
  await exec('/bin/launchctl', ['bootstrap', domain, plist]);
  for (let i = 0; i < 30; i++) { if (await health()) { console.log('TLDR background service is running and authenticated; OpenAI is configured. Starts at login and restarts automatically.'); return; } await pause(500); }
  throw new Error(`The service was installed but did not become ready. Inspect ${join(directory, 'service-error.log')}.`);
}
try {
  if (process.platform !== 'darwin') throw new Error('The background service commands currently support macOS only.');
  if (command === 'install' || command === 'restart') await install();
  else if (command === 'status') {
    const running = await loaded(), ready = await health();
    console.log(`Login service: ${running ? 'loaded' : 'not loaded'} · authenticated backend: ${ready ? 'ready' : 'unavailable'}`);
    if (!running || !ready) process.exitCode = 1;
  } else if (command === 'uninstall') {
    if (await loaded()) await exec('/bin/launchctl', ['bootout', target]);
    await rm(plist, { force: true });
    // Remove only files owned by this installer, including the copied credentials.
    for (const name of ['node', 'server.mjs', '.env', 'node.next', 'server.mjs.next', '.env.next', 'service-error.log']) await rm(join(directory, name), { force: true });
    console.log('TLDR login service removed. Project files and the original .env are unchanged.');
  } else throw new Error('Use install, restart, status, or uninstall.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Service setup failed.'); process.exitCode = 1;
}
