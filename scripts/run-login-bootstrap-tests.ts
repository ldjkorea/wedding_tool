import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { POST as ownerLogin } from '../src/app/api/owner-control/pin/route';
import { POST as masterLogin } from '../src/app/api/master-control/auth/route';
import { GET as bookings } from '../src/app/api/owner-control/bookings/route';
import { GET as settings } from '../src/app/api/master-control/settings/route';
import { DELETE as ownerLogout } from '../src/app/api/owner-control/auth/route';
import { measureRoute, recordGasTiming } from '../src/services/requestTiming';

const h = installGasHarness();
process.env.STUDIO_SETTINGS_ENABLED = 'true';
const ownerPassword = '582614', masterPassword = crypto.randomBytes(24).toString('base64');
function hash(password: string) { const salt = crypto.randomBytes(16); return 'scrypt$16384$8$1$' + salt.toString('hex') + '$' + crypto.scryptSync(password, salt, 64).toString('hex'); }
process.env.STUDIO_OWNER_PASSWORD_HASH = hash(ownerPassword); process.env.MASTER_ADMIN_PASSWORD_HASH = hash(masterPassword);
function request(route: string, body?: unknown, cookie?: string) { return new NextRequest('https://booking.fixture.com' + route, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'https://booking.fixture.com', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
let passed = 0, ownerCookie = '', masterCookie = '';
async function test(name: string, work: () => Promise<void>) { await work(); passed++; console.log('PASS ' + name); }
async function main() {
  await test('Owner login returns only authorized first-page projection in two GAS calls', async () => {
    const response = await ownerLogin(request('/api/owner-control/pin', { password: ownerPassword, initialView: 'bookings' }));
    assert.equal(response.status, 200); assert.match(response.headers.get('server-timing')!, /gas_calls;desc="2"/);
    ownerCookie = response.headers.get('set-cookie')!.split(';')[0]; const data = await response.json();
    assert.deepEqual(data.initial, await (await bookings(request('/api/owner-control/bookings', undefined, ownerCookie))).json());
    assert.equal(data.initial.bookings.length, 0); assert.equal('__timing' in data, false);
  });
  await test('Master login shares the exact validated GET settings projection', async () => {
    const response = await masterLogin(request('/api/master-control/auth', { password: masterPassword, initialView: 'settings' }));
    assert.equal(response.status, 200); assert.match(response.headers.get('server-timing')!, /gas_calls;desc="2"/);
    masterCookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.deepEqual((await response.json()).initial, await (await settings(request('/api/master-control/settings', undefined, masterCookie))).json());
  });
  await test('Cross-role and anonymous API access remains rejected', async () => {
    assert.equal((await settings(request('/api/master-control/settings', undefined, ownerCookie))).status, 401);
    assert.equal((await bookings(request('/api/owner-control/bookings', undefined, masterCookie))).status, 401);
    assert.equal((await bookings(request('/api/owner-control/bookings'))).status, 401);
  });
  await test('Wrong password has no initial data or session cookie', async () => {
    const response = await ownerLogin(request('/api/owner-control/pin', { password: '543219', initialView: 'bookings' }));
    assert.equal(response.status, 401); assert.equal(response.headers.get('set-cookie'), null); assert.equal('initial' in await response.json(), false);
  });
  await test('Owner cannot request Master bootstrap or add arbitrary studio scope', async () => {
    assert.equal((await ownerLogin(request('/api/owner-control/pin', { password: ownerPassword, initialView: 'settings' }))).status, 400);
    assert.equal((await ownerLogin(request('/api/owner-control/pin', { password: ownerPassword, studioId: 'other' }))).status, 400);
  });
  await test('Legacy login response stays compatible', async () => {
    const response = await masterLogin(request('/api/master-control/auth', { password: masterPassword }));
    assert.deepEqual(await response.json(), { success: true });
  });
  await test('Failed optional initial read falls back to an ordinary authenticated GET', async () => {
    const original = h.context.ownerBookings; h.context.ownerBookings = () => { throw Error('Injected initial read failure'); };
    const response = await ownerLogin(request('/api/owner-control/pin', { password: ownerPassword, initialView: 'bookings' }));
    h.context.ownerBookings = original;
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true });
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await bookings(request('/api/owner-control/bookings', undefined, cookie))).status, 200);
  });
  await test('Logout still revokes the bootstrap-issued session at the provider', async () => {
    const req = request('/api/owner-control/auth', {}, ownerCookie);
    assert.equal((await ownerLogout(req)).status, 200);
    assert.equal((await bookings(request('/api/owner-control/bookings', undefined, ownerCookie))).status, 401);
  });
  await test('Timing headers accept numeric allowlisted fields only', async () => {
    const response = await measureRoute(async () => {
      recordGasTiming(performance.now(), 'admin_login', { total_ms: 20, properties_ms: 'SECRET', secret_ms: 123, lock_ms: Infinity });
      return new Response('ok');
    })(new Request('https://booking.fixture.com'));
    const timing = response.headers.get('server-timing')!;
    assert.match(timing, /provider_total;dur=20.0/); assert.ok(!/SECRET|secret|Infinity/.test(timing));
  });
  await test('Unauthenticated trace cannot expose provider diagnostics', async () => {
    const response = h.gas({ trace: true, action: 'settings_runtime', payloadJson: '{}', timestamp: Date.now(), nonce: crypto.randomUUID(), signature: 'forged' });
    assert.equal(response.success, false); assert.equal('__timing' in response, false);
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { h.restore(); console.log(JSON.stringify({ passed, failed: process.exitCode ? 1 : 0 })); });
