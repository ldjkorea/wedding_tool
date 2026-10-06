import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readPublicPageSettings, invalidatePublicPageSettings, PUBLIC_PAGE_SETTINGS_TTL_MS } from '../src/services/publicPageSettingsCache';
import { baseSettings } from '../src/services/settingsValidation';
import { getBaseClientConfiguration } from '../src/services/configuration';
import type { SettingsRevision } from '../src/types/studioSettings';

Object.assign(process.env, { NODE_ENV: 'production', BACKEND_MODE: 'gas', APP_SECRET: crypto.randomBytes(32).toString('hex'),
  GAS_SHARED_SECRET: crypto.randomBytes(32).toString('hex'), GAS_WEBAPP_URL: 'https://script.google.com/macros/s/cache-test/exec',
  APP_URL: 'https://cache.fixture.com', REPRESENTATIVE_EMAIL: 'admin@cache.fixture.com' });
delete process.env.NEXT_PUBLIC_APP_URL;
let calls = 0, clock = Date.now();
const originalNow = Date.now;
Date.now = () => clock;
const settings = baseSettings(); delete settings.partnerCodes;
const value: SettingsRevision = { schemaVersion: 1, studioId: getBaseClientConfiguration().studioConfig.studioId,
  revision: 1, hash: 'a'.repeat(64), updatedAt: new Date(clock).toISOString(), actor: 'master', settings };
const read = async () => { calls++; return structuredClone(value); };
let passed = 0;
async function test(name: string, work: () => Promise<void>) { await work(); passed++; console.log('PASS ' + name); }
async function main() {
  await test('Concurrent page/metadata reads and warm requests share one public read', async () => {
    await Promise.all([readPublicPageSettings(read), readPublicPageSettings(read)]); await readPublicPageSettings(read); assert.equal(calls, 1);
  });
  await test('Cached values are isolated from caller mutation', async () => {
    (await readPublicPageSettings(read))!.settings.productsConfig[0].price = 1;
    assert.equal((await readPublicPageSettings(read))!.settings.productsConfig[0].price, value.settings.productsConfig[0].price);
  });
  await test('Hard expiry never serves stale data or hides a Google failure', async () => {
    clock += PUBLIC_PAGE_SETTINGS_TTL_MS;
    await assert.rejects(readPublicPageSettings(async () => { throw Error('Provider unavailable'); }));
    await readPublicPageSettings(read); assert.equal(calls, 2);
  });
  await test('Successful settings mutation invalidates the local scope', async () => {
    invalidatePublicPageSettings(); await readPublicPageSettings(read); assert.equal(calls, 3);
  });
  await test('Invalidation while a read is in flight prevents stale repopulation', async () => {
    invalidatePublicPageSettings(); let resolve!: (v: SettingsRevision) => void;
    const pending = readPublicPageSettings(() => new Promise<SettingsRevision>(done => { resolve = done; }));
    invalidatePublicPageSettings(); resolve(value); await pending; await readPublicPageSettings(read); assert.equal(calls, 4);
  });
  await test('Deployment/tenant endpoint scopes never share a cached revision', async () => {
    process.env.GAS_WEBAPP_URL = 'https://script.google.com/macros/s/other-tenant/exec';
    await readPublicPageSettings(read); assert.equal(calls, 5);
    process.env.APP_URL = 'https://other.fixture.com'; await readPublicPageSettings(read); assert.equal(calls, 6);
  });
  await test('Missing production secret fails even on an existing cache hit', async () => {
    const secret = process.env.APP_SECRET; delete process.env.APP_SECRET;
    await assert.rejects(readPublicPageSettings(read), /APP_SECRET/); process.env.APP_SECRET = secret;
  });
  await test('Private discount codes cannot enter the page cache', async () => {
    invalidatePublicPageSettings(); await assert.rejects(readPublicPageSettings(async () => ({ ...value, settings: { ...settings, partnerCodes: [] } })));
    await readPublicPageSettings(read); assert.equal(calls, 7);
  });
  await test('Demo reads bypass the production cache', async () => {
    Object.assign(process.env, { NODE_ENV: 'test', BACKEND_MODE: 'demo' });
    await readPublicPageSettings(read); await readPublicPageSettings(read); assert.equal(calls, 9);
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Date.now = originalNow; console.log(JSON.stringify({ passed, failed: process.exitCode ? 1 : 0 })); });
