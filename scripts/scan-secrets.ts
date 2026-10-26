import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseEnv } from 'node:util';

// Report locations and secret types only. Never print matching values or lines.
const git = (...args: string[]) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const known: { name: string; value: Buffer }[] = [];
if (existsSync('.env')) {
  const env = parseEnv(readFileSync('.env', 'utf8'));
  for (const name of ['OPENAI_API_KEY', 'TLDR_LOCAL_TOKEN']) {
    const value = env[name];
    if (value && value.length >= 16) known.push({ name, value: Buffer.from(value) });
  }
}
const patterns: [string, RegExp][] = [
  ['OpenAI-like key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/u],
  ['GitHub-like token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/u],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
];
let files = 0, blobs = 0, findings = 0;
function scan(location: string, data: Buffer) {
  const types = known.filter(secret => data.includes(secret.value)).map(secret => secret.name);
  const text = data.toString('utf8');
  types.push(...patterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name));
  if (types.length) { findings++; console.error(JSON.stringify({ location, types: [...new Set(types)] })); }
}
const paths = new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean));
for (const path of paths) {
  if (!existsSync(path)) continue;
  scan(path, readFileSync(path)); files++;
  if (/(^|\/)\.env(?:\..*)?$/u.test(path) && !path.endsWith('.env.example')) {
    findings++; console.error(JSON.stringify({ location: path, types: ['credential file included in source'] }));
  }
}
for (const line of git('rev-list', '--objects', '--all', '--reflog').toString().trim().split('\n')) {
  const [oid, ...names] = line.split(' ');
  if (!oid || git('cat-file', '-t', oid).toString().trim() !== 'blob') continue;
  scan(`history:${oid.slice(0, 12)}:${names.join(' ')}`, git('cat-file', 'blob', oid)); blobs++;
}
function artifacts(directory: string) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) artifacts(path);
    else if (entry.isFile()) { scan(relative('.', path), readFileSync(path)); files++; }
  }
}
artifacts('dist/extension'); artifacts('dist/server');
console.log(`Secret scan: ${files} source/build files, ${blobs} history blobs, ${findings} findings. Patterns and current .env values only; screenshots require separate review.`);
process.exitCode = findings ? 1 : 0;
