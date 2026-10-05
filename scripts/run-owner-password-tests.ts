import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { POST as masterLogin } from '../src/app/api/master-control/auth/route';
import { POST as ownerLogin } from '../src/app/api/owner-control/pin/route';
import { GET as ownerAuth } from '../src/app/api/owner-control/auth/route';
import { GET, PUT } from '../src/app/api/master-control/owner-password/route';
import { hashPassword, readOwnerCredential } from '../src/services/ownerCredentials';
import { signedGasCall } from '../src/services/gasTransport';
import { getStudioConfig } from '../src/services/configuration';
const h = installGasHarness();
const results: { name: string; status: string }[] = [];
const dir = path.resolve(process.env.PASSWORD_ARTIFACT_DIR || '.contract-test-output/owner-password');
fs.mkdirSync(dir, { recursive: true });
const master = crypto.randomBytes(24).toString('hex');
const pinA = '152638', pinB = '274859'; // Synthetic test inputs only.
let masterCookie = '', ownerCookie = '';
function req(method = 'GET', body?: unknown, cookie = masterCookie, origin = 'https://booking.fixture.com') {
  return new NextRequest('https://booking.fixture.com/api/master-control/owner-password', { method, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function test(name: string, run: () => Promise<void>) {
  await run(); results.push({ name, status: 'passed' }); console.log('PASS ' + name);
}
async function main() {
  Object.assign(process.env, { STUDIO_SETTINGS_ENABLED: 'true', MASTER_ADMIN_PASSWORD_HASH: await hashPassword(master) });
  delete process.env.STUDIO_OWNER_PASSWORD_HASH;
  await test('Anonymous credential reads and changes denied', async () => {
    assert.equal((await GET(req())).status, 401);
    assert.equal((await PUT(req('PUT', { password: pinA, expectedRevision: 0 }))).status, 401);
  });
  await test('Initial PIN is 000000; production creates no Owner session', async () => {
    assert.equal((await readOwnerCredential()).source, 'initial');
    const response = await ownerLogin(req('POST', { password: '000000' }));
    assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await ownerLogin(req('POST', { password: pinA }))).status, 401);
  });
  await test('Master reads status only without credential hash or PIN', async () => {
    const login = await masterLogin(req('POST', { password: master })); assert.equal(login.status, 200);
    masterCookie = login.headers.get('set-cookie')!.split(';')[0];
    const value = await (await GET(req())).json(); assert.equal(value.source, 'initial');
    assert.equal(value.revision, 0); assert.ok(!JSON.stringify(value).includes('scrypt')); assert.equal(value.hash, undefined);
  });
  await test('CSRF, extra studio scope, initial PIN and bad formats denied', async () => {
    assert.notEqual((await PUT(req('PUT', { password: pinA, expectedRevision: 0 }, masterCookie, 'https://evil.invalid'))).status, 200);
    for (const password of ['000000', '12345', '1234567', 'abcdef']) assert.equal((await PUT(req('PUT', { password, expectedRevision: 0 }))).status, 400);
    assert.equal((await PUT(req('PUT', { password: pinA, expectedRevision: 0, studioId: 'foreign' }))).status, 400);
  });
  await test('Master sets independent private credential; business revision unchanged', async () => {
    const before = JSON.stringify(await signedGasCall('settings_runtime', {}));
    const response = await PUT(req('PUT', { password: pinA, expectedRevision: 0 }));
    assert.equal(response.status, 200); assert.equal((await response.json()).revision, 1);
    assert.equal(JSON.stringify(await signedGasCall('settings_runtime', {})), before);
    const credential = await readOwnerCredential(); assert.equal(credential.source, 'master');
    assert.ok(credential.hash.startsWith('scrypt$')); assert.ok(!credential.hash.includes(pinA));
    const login = await ownerLogin(req('POST', { password: pinA })); assert.equal(login.status, 200);
    ownerCookie = login.headers.get('set-cookie')!.split(';')[0];
  });
  await test('Owner cannot read or modify credential, including renamed cookie and direct signed action', async () => {
    for (const cookie of [ownerCookie, ownerCookie.replace('studio_owner_session=', 'studio_admin_session=')]) {
      assert.equal((await GET(req('GET', undefined, cookie))).status, 401);
      assert.equal((await PUT(req('PUT', { password: pinB, expectedRevision: 1 }, cookie))).status, 401);
    }
    await assert.rejects(signedGasCall('admin_owner_credential_set', { sessionId: 'a'.repeat(64), hash: await hashPassword(pinB), expectedRevision: 1 }));
  });
  await test('Rotation revokes previous sessions and password; old environment hash cannot override', async () => {
    process.env.STUDIO_OWNER_PASSWORD_HASH = await hashPassword(pinA);
    assert.equal((await PUT(req('PUT', { password: pinB, expectedRevision: 1 }))).status, 200);
    assert.equal((await ownerAuth(req('GET', undefined, ownerCookie))).status, 401);
    assert.equal((await ownerLogin(req('POST', { password: pinA }))).status, 401);
    assert.equal((await ownerLogin(req('POST', { password: pinB }))).status, 200);
  });
  await test('Stale update conflicts; sessions issued against stale credential are rejected', async () => {
    assert.equal((await PUT(req('PUT', { password: pinA, expectedRevision: 1 }))).status, 409);
    await assert.rejects(signedGasCall('admin_login', { role: 'owner', sessionId: 'b'.repeat(64), credentialRevision: 1 }));
    assert.equal((await readOwnerCredential()).revision, 2);
  });
  await test('Credentials persist per studio; provider failure never falls back to initial PIN', async () => {
    assert.equal(h.context.readOwnerCredentialState({ studioId: 'foreign-studio' }).hash, null);
    assert.equal(h.context.readOwnerCredentialState({ studioId: getStudioConfig().studioId }).revision, 2);
    h.transport('http500'); await assert.rejects(readOwnerCredential()); h.transport('');
  });
  await test('Explicit local Demo accepts initial PIN and persists Master replacement', async () => {
    Object.assign(process.env, { NODE_ENV: 'test', BACKEND_MODE: 'demo', STUDIO_DEMO_SETTINGS_TEST_DIRECTORY: path.join(dir, 'private-demo-' + crypto.randomUUID()) });
    delete process.env.STUDIO_OWNER_PASSWORD_HASH;
    assert.equal((await ownerLogin(req('POST', { password: '000000' }))).status, 200);
    const login = await masterLogin(req('POST', { password: master })); assert.equal(login.status, 200);
    masterCookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await PUT(req('PUT', { password: pinA, expectedRevision: 0 }))).status, 200);
    assert.equal((await ownerLogin(req('POST', { password: '000000' }))).status, 401);
    assert.equal((await ownerLogin(req('POST', { password: pinA }))).status, 200);
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  h.restore(); fs.writeFileSync(path.join(dir, 'password-results.json'), JSON.stringify({ passed: results.length, failed: process.exitCode ? 1 : 0, liveGoogleIO: false, tests: results }, null, 2));
});
