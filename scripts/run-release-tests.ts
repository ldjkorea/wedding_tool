import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

/** Test both client builds. Always restore the user's selected client; never call live business services. */
const root = process.cwd();
const artifacts = path.resolve(process.env.RELEASE_ARTIFACT_DIR || '.contract-test-output/release');
fs.mkdirSync(artifacts, { recursive: true });
const selector = path.join(root, 'src/config/client.ts');
const original = fs.readFileSync(selector, 'utf8');
const startedAt = Date.now();
const stages: { client: string; command: string; exitCode: number; log: string }[] = [];
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
function coreDigest() {
  const names = [...files('src'), ...files('google-apps-script')].filter(file => !file.replace(/\\/g, '/').startsWith('src/config/clients/') && file.replace(/\\/g, '/') !== 'src/config/client.ts').sort();
  return crypto.createHash('sha256').update(names.map(file => file + ':' + crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')).join('\n')).digest('hex');
}
const initialCoreDigest = coreDigest();
async function run(client: string, script: string, env: Record<string, string> = {}) {
  console.log('Release stage: ' + client + ' / npm run ' + script);
  const log = path.join(artifacts, client + '-' + script.replace(/:/g, '-') + '.log');
  const destination = fs.createWriteStream(log);
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run ' + script] : ['run', script];
  const child = spawn(process.platform === 'win32' ? 'cmd.exe' : 'npm', args, {
    cwd: root, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout!, child.stderr!]) stream.on('data', chunk => { destination.write(chunk); process.stdout.write(chunk); });
  const exitCode = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  await new Promise<void>(resolve => destination.end(resolve));
  stages.push({ client, command: 'npm run ' + script, exitCode, log });
  assert.equal(exitCode, 0, 'Release gate failed: ' + client + '/' + script);
}
function suite(relative: string, minimum: number) {
  assert.ok(fs.statSync(path.join(artifacts, relative)).mtimeMs >= startedAt, 'Test result must be fresh for this release run');
  const result = JSON.parse(fs.readFileSync(path.join(artifacts, relative), 'utf8'));
  assert.equal(result.failed, 0); assert.ok(result.passed >= minimum, 'A process exit is not proof of completed tests');
  return result;
}
async function main() {
  for (const client of ['dear-memory', 'moment-studio']) {
    const name = client === 'dear-memory' ? 'dearMemoryConfiguration' : 'momentStudioConfiguration';
    fs.writeFileSync(selector, "import { " + name + " } from './clients/" + client + "';\nexport const clientConfiguration = " + name + ";\n");
    assert.equal(coreDigest(), initialCoreDigest);
    await run(client, 'typecheck'); await run(client, 'typecheck:tests'); await run(client, 'lint');
    if (client === 'dear-memory') {
      await run(client, 'test:acceptance'); await run(client, 'test:hardening');
      await run(client, 'test:flow', { FLOW_RESULTS_PATH: path.join(artifacts, 'dear-flow.json') });
      suite('dear-flow.json', 15);
    }
    await run(client, 'test:settings', { SETTINGS_ARTIFACT_DIR: path.join(artifacts, client + '-settings') });
    suite(client + '-settings/settings-results.json', 26);
    await run(client, 'test:discount-codes', { CODES_ARTIFACT_DIR: path.join(artifacts, client + '-codes') });
    suite(client + '-codes/discount-code-results.json', 22);
    await run(client, 'test:sheets', { SHEETS_ARTIFACT_DIR: path.join(artifacts, client + '-sheets') });
    suite(client + '-sheets/sheet-results.json', 21);
    await run(client, 'test:calendar', { CALENDAR_ARTIFACT_DIR: path.join(artifacts, client + '-calendar') });
    suite(client + '-calendar/calendar-results.json', 25);
    await run(client, 'test:owner-roles', { OWNER_ARTIFACT_DIR: path.join(artifacts, client + '-owner') });
    suite(client + '-owner/owner-role-results.json', 25);
    await run(client, 'test:owner-password', { PASSWORD_ARTIFACT_DIR: path.join(artifacts, client + '-password') });
    suite(client + '-password/password-results.json', 10);
    await run(client, 'test:bookings', { BOOKING_ARTIFACT_DIR: path.join(artifacts, client + '-bookings') });
    suite(client + '-bookings/booking-results.json', 14);
    await run(client, 'test:red-team', { RED_TEAM_ARTIFACT_DIR: path.join(artifacts, client + '-red-team') });
    suite(client + '-red-team/red-team-results.json', 23);
    if (client === 'dear-memory') {
      await run(client, 'test:settings-browser', { SETTINGS_BROWSER_ARTIFACT_DIR: path.join(artifacts, 'master-browser') });
      suite('master-browser/settings-browser-results.json', 22);
      await run(client, 'test:owner-browser', { OWNER_BROWSER_ARTIFACT_DIR: path.join(artifacts, 'owner-browser') });
      suite('owner-browser/owner-browser-results.json', 18);
      await run(client, 'test:bookings-browser', { BOOKING_BROWSER_ARTIFACT_DIR: path.join(artifacts, 'booking-browser') });
      suite('booking-browser/booking-browser-results.json', 7);
    }
    await run(client, 'build');
    if (client === 'dear-memory') {
      await run(client, 'test:browser', { FLOW_ARTIFACT_DIR: path.join(artifacts, 'dear-browser') });
      suite('dear-browser/browser-results.json', 12);
    } else {
      await run(client, 'test:white-label', { WHITE_LABEL_ARTIFACT_DIR: path.join(artifacts, 'moment-browser') });
      suite('moment-browser/white-label-results.json', 15);
    }
  }
  assert.equal(coreDigest(), initialCoreDigest, 'Client switch changed shared Core');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(selector, original);
  // The build artifact must also match the restored selection, including after a failed gate.
  const selectedMoment = original.includes('momentStudioConfiguration');
  if (!selectedMoment || process.exitCode) {
    try { await run('restored-selection', 'build'); } catch { process.exitCode = 1; }
  }
  fs.writeFileSync(path.join(artifacts, 'release-results.json'), JSON.stringify({ passed: !process.exitCode,
    stages, coreDigestBefore: initialCoreDigest, coreDigestAfter: coreDigest(), selectorRestored: fs.readFileSync(selector, 'utf8') === original,
    liveBusinessIO: false, physicalMobileOrKakao: false }, null, 2));
  console.log('Release gates ' + (process.exitCode ? 'FAILED' : 'PASSED'));
});
