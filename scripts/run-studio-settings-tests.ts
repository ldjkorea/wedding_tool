import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { POST as login, GET as session, DELETE as logout } from '../src/app/api/studio-control/auth/route';
import { GET as read, PUT as save } from '../src/app/api/studio-control/settings/route';
import { POST as restore } from '../src/app/api/studio-control/restore/route';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { GET as review } from '../src/app/api/review-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { getProducts, getOptions, getStudioConfig, getFormSchema, getConfigurationRuntime, getClientContent } from '../src/services/configuration';
import { baseSettings, validateStudioSettings } from '../src/services/settingsValidation';
import { withRuntimeConfiguration, loadRuntimeConfiguration } from '../src/services/serverRuntimeConfiguration';
import { configurationBinding, snapshotBinding } from '../src/lib/contractWorkflow';
import { calculateContractPrice } from '../src/lib/pricing';
import { canonicalForm } from '../src/lib/contractValidation';
import { generateCustomerContractEmail } from '../src/lib/emailTemplates';
import { ContractDocument } from '../src/components/pdf/ContractDocument';
import type { StudioSettings } from '../src/types/studioSettings';

const h = installGasHarness();
h.form.shootRequestNotes = 'Fixture shooting preparation';
h.form.referralSource = getClientContent().referralOptions[0];
const studioId = getStudioConfig().studioId;
const artifacts = path.resolve(process.env.SETTINGS_ARTIFACT_DIR || '.contract-test-output/settings');
fs.mkdirSync(artifacts, { recursive: true });
const password = crypto.randomBytes(24).toString('base64');
const salt = crypto.randomBytes(16);
process.env.STUDIO_ADMIN_PASSWORD_HASH = 'scrypt$16384$8$1$' + salt.toString('hex') + '$' + crypto.scryptSync(password, salt, 64).toString('hex');
process.env.STUDIO_SETTINGS_ENABLED = 'true';
const results: { name: string; status: string; error?: string }[] = [];
let cookie = '';
const request = (url: string, method = 'GET', body?: unknown, authenticated = true, origin = 'https://booking.fixture.com') => new NextRequest(origin + url, {
  method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(authenticated && cookie ? { Cookie: cookie } : {}) },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
const endpoint = '/api/studio-control/';
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'failed', error: String(error) }); throw error; }
}
async function head() { const res = await read(request(endpoint + 'settings')); assert.equal(res.status, 200); return res.json(); }
async function write(settings: StudioSettings, revision: number) {
  return save(request(endpoint + 'settings', 'PUT', { settings, expectedRevision: revision }));
}
async function binding() { return withRuntimeConfiguration(async () => configurationBinding()); }
async function submitForm(email: string, configHash?: string) {
  const form = { ...h.form, productId: getProducts()[0].id, optionIds: [], email, partnerDiscount: false, portfolioConsent: false };
  const req = request('/api/submit-contract', 'POST', form, false);
  req.headers.set('x-contract-configuration', configHash || await binding());
  return submit(req);
}
async function main() {
  await test('Anonymous settings read, write and session access denied', async () => {
    assert.equal((await read(request(endpoint + 'settings', 'GET', undefined, false))).status, 401);
    assert.equal((await save(request(endpoint + 'settings', 'PUT', {}, false))).status, 401);
    assert.equal((await session(request(endpoint + 'auth', 'GET', undefined, false))).status, 401);
  });
  await test('Missing password configuration fails closed without default', async () => {
    const saved = process.env.STUDIO_ADMIN_PASSWORD_HASH; delete process.env.STUDIO_ADMIN_PASSWORD_HASH;
    assert.equal((await login(request(endpoint + 'auth', 'POST', { password }, false))).status, 503);
    process.env.STUDIO_ADMIN_PASSWORD_HASH = saved;
  });
  await test('Wrong password is rejected and never appears in diagnostics', async () => {
    const res = await login(request(endpoint + 'auth', 'POST', { password: 'WRONG_CREDENTIAL_MARKER' }, false));
    assert.equal(res.status, 401); assert.ok(!(await res.text()).includes('WRONG_CREDENTIAL_MARKER'));
  });
  await test('Login issues secure HttpOnly Strict cookie, no secret in response', async () => {
    const res = await login(request(endpoint + 'auth', 'POST', { password }, false));
    assert.equal(res.status, 200);
    const header = res.headers.get('set-cookie')!;
    assert.match(header, /HttpOnly/i); assert.match(header, /Secure/i); assert.match(header, /SameSite=strict/i);
    cookie = header.split(';')[0];
    assert.deepEqual(await res.json(), { success: true });
  });
  await test('CSRF missing/cross origin blocked even with valid session', async () => {
    const req = request(endpoint + 'settings', 'PUT', {}); req.headers.delete('origin');
    assert.notEqual((await save(req)).status, 200);
    const cross = request(endpoint + 'settings', 'PUT', {}); cross.headers.set('origin', 'https://attacker.fixture.com');
    assert.notEqual((await save(cross)).status, 200);
    assert.notEqual((await login(cross)).status, 200);
  });
  await test('Authenticated bootstrap read is uncached; legacy env supplies blank representative email', async () => {
    const res = await read(request(endpoint + 'settings')); assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control')!, /no-store/); assert.match(res.headers.get('x-robots-tag')!, /noindex/);
    const data = await res.json(); assert.equal(data.revision, 0); assert.ok(data.settings.studioConfig.representativeEmail);
  });
  await test('Contract and settings folders cannot share the same resource', async () => {
    const old = h.properties.get('STUDIO_SETTINGS_FOLDER_ID')!;
    h.properties.set('STUDIO_SETTINGS_FOLDER_ID', h.properties.get('CONTRACTS_FOLDER_ID')!);
    assert.equal((await read(request(endpoint + 'settings'))).status, 503);
    h.properties.set('STUDIO_SETTINGS_FOLDER_ID', old);
  });
  const initial = (await head()).settings as StudioSettings;
  await test('Invalid settings corpus rejected on server without durable mutation', async () => {
    const mutations: ((s: any) => void)[] = [
      s => s.productsConfig[0].price = -1, s => s.productsConfig[0].price = 0.5,
      s => s.productsConfig.push({ ...s.productsConfig[0] }), s => s.optionsConfig.push({ ...s.optionsConfig[0] }),
      s => s.productsConfig[0].name = '', s => s.studioConfig.studioName = '',
      s => s.studioConfig.representativeEmail = 'bad-email', s => s.studioConfig.website = 'javascript:alert(1)',
      s => s.studioConfig.logo = 'data:image/svg+xml;base64,PHN2Zz4=', s => s.studioConfig.seal = 'https://tracking.fixture.com/x.png',
      s => s.contractPolicy.deposit.amount = 100000000, s => s.discountsConfig[0].amount = -1,
      s => s.discountsConfig[0].amount = 100000000, s => s.discountsConfig.at(-1).type = 'invalid-timing',
      s => s.productsConfig.forEach((p: any) => p.active = false), s => s.formSchema.weddingHall.enabled = false,
      s => s.contractPolicy.terms = [], s => s.contractPolicy.terms[0].content = '',
      s => s.productsConfig.pop(), s => s.APP_SECRET = 'INJECTED_SECRET',
      s => s.studioConfig.GAS_WEBAPP_URL = 'https://attacker.fixture.com', s => s.studioConfig.studioId = 'other-studio',
      s => s.studioConfig.contractPrefix = 'OTHER', s => s.formSchema.email = { enabled: false },
      s => s.formSchema.groomPhone.enabled = s.formSchema.bridePhone.enabled = false,
      s => s.formSchema.makeupLocation.required = true, s => s.content.pdfShootScope = '{{unknownVariable}}',
      s => s.contractPolicy.delivery = null, s => s.optionsConfig[0].active = 'false', s => delete s.content.metadata, s => delete s.studioConfig.colors.warm[50],
    ];
    // Disabled makeup is a valid optional bootstrap in some clients; force invalid required/disabled pair.
    mutations[25] = s => { s.formSchema.makeupLocation.enabled = false; s.formSchema.makeupLocation.required = true; };
    for (const mutate of mutations) {
      const bad = structuredClone(initial); mutate(bad);
      const res = await write(bad, 0); assert.notEqual(res.status, 200, JSON.stringify(bad).slice(0, 100));
      assert.equal((await head()).revision, 0);
    }
    assert.equal(h.files.size, 0);
  });
  let oldContract: any, pendingToken = '', oldBinding = '';
  await test('Baseline contract completes review, snapshot, PDF and both emails before settings change', async () => {
    oldBinding = await binding();
    const res = await submitForm('settings-old@example.com'); assert.equal(res.status, 200);
    const contract = await res.json(), token = h.reviewToken();
    const reviewed = await review(request('/api/review-contract?token=' + encodeURIComponent(token)));
    const data = await reviewed.json(); assert.equal(data.success, true);
    const prep = await approve(request('/api/approve-and-send', 'POST', { token, phase: 'prepare', expectedRevision: data.revision, updatedData: data.data }));
    const prepared = await prep.json(); assert.equal(prepared.success, true);
    const sent = await approve(request('/api/approve-and-send', 'POST', { token, phase: 'send', snapshotHash: prepared.snapshotHash, pdfBase64: h.pdf(prepared.snapshotHash) }));
    assert.equal(sent.status, 200); const final = await sent.json();
    oldContract = { contract, token, snapshot: final.snapshot, hash: snapshotBinding(final.snapshot), mail: generateCustomerContractEmail(final.snapshot.data, final.snapshot.pricing, final.snapshot.contractNumber, final.snapshot), html: renderToStaticMarkup(React.createElement(ContractDocument, { data: final.snapshot.data, pricing: final.snapshot.pricing, snapshot: final.snapshot })) };
    assert.equal(h.deliveries.filter(mail => mail.to === 'settings-old@example.com').length, 1);
    const pending = await submitForm('settings-pending@example.com'); assert.equal(pending.status, 200); pendingToken = h.reviewToken();
  });
  const changed = structuredClone(initial);
  changed.studioConfig.studioName = '운영 설정 테스트 스튜디오'; changed.studioConfig.displayName = 'SETTINGS STUDIO';
  changed.studioConfig.representativeEmail = 'new-owner@studio.fixture.com';
  changed.productsConfig[0].price += 100000; changed.productsConfig[0].name = '관리자 변경 상품';
  changed.productsConfig[0].shootScope = '관리자 변경 촬영 범위';
  changed.productsConfig.at(-1)!.active = false;
  changed.productsConfig.push({ ...changed.productsConfig[0], id: 'added_product', name: '추가 상품', price: 2000000, displayOrder: 9 });
  changed.optionsConfig[0].price += 20000; changed.optionsConfig.at(-1)!.active = false;
  changed.discountsConfig.find(d => d.eligibility.kind === 'portfolio')!.amount += 10000;
  changed.contractPolicy.deposit.amount += 10000; changed.contractPolicy.version += '-settings';
  changed.contractPolicy.terms[0].content += '\n관리자 테스트 추가 약관';
  changed.formSchema.shootRequestNotes.label = '관리자 촬영 요청'; changed.formSchema.shootRequestNotes.required = true;
  changed.formSchema.instagramId.enabled = false; changed.formSchema.instagramId.required = false;
  changed.content.pdfShootScope = '기본 변경 촬영 범위';
  await test('Atomic whole-document publication creates verified revision and dedicated settings file', async () => {
    const res = await write(changed, 0); assert.equal(res.status, 200, await res.clone().text());
    const data = await res.json(); assert.equal(data.revision, 1);
    const reread = await head(); assert.deepEqual(reread.settings, changed); assert.equal(reread.history.length, 1);
    const files = [...h.files.values()].filter(f => f.name.includes('_settings_')); assert.equal(files.length, 1);
    assert.equal(h.stored(oldContract.contract.contractId).status, 'sent');
  });
  await test('Stale admin revision cannot create second publication', async () => {
    const res = await write(changed, 0); assert.equal(res.status, 409); assert.equal((await head()).revision, 1);
  });
  await test('Runtime catalogue, option, discount, policy and form read persisted settings', async () => {
    await withRuntimeConfiguration(async () => {
      assert.equal(getProducts()[0].basePrice, changed.productsConfig[0].price);
      assert.ok(!getProducts().some(item => item.id === changed.productsConfig.at(-2)!.id));
      assert.ok(getProducts().some(item => item.id === 'added_product'));
      assert.equal(getOptions()[0].price, changed.optionsConfig[0].price);
      assert.equal(getFormSchema().shootRequestNotes.required, true);
      const price = calculateContractPrice({ ...h.form, productId: changed.productsConfig[0].id, optionIds: [changed.optionsConfig[0].id], portfolioConsent: true });
      assert.equal(price.basePrice, changed.productsConfig[0].price); assert.equal(price.depositAmount, changed.contractPolicy.deposit.amount);
      assert.equal(price.optionTotal, changed.optionsConfig[0].price);
      assert.equal(price.futureCashbackTotal, changed.discountsConfig.find(d => d.eligibility.kind === 'review_contract')!.amount);
      const weekday = new Date(h.form.weddingDate + 'T00:00:00Z').getUTCDay();
      const immediate = changed.discountsConfig.filter(rule => rule.active && rule.type === 'immediate' && (rule.eligibility.kind === 'portfolio' || (rule.eligibility.kind === 'weekday' && rule.eligibility.weekday === weekday))).reduce((total, rule) => total + rule.amount, 0);
      assert.equal(price.immediateDiscountTotal, immediate);
      assert.equal(price.contractTotal, changed.productsConfig[0].price + changed.optionsConfig[0].price - immediate);
      assert.equal(price.balanceAmount, price.contractTotal - changed.contractPolicy.deposit.amount);
      assert.throws(() => canonicalForm({ ...h.form, productId: changed.productsConfig.at(-2)!.id, optionIds: [] }));
      assert.throws(() => canonicalForm({ ...h.form, productId: changed.productsConfig[0].id, optionIds: [changed.optionsConfig.at(-1)!.id] }));
    });
  });
  await test('Old customer configuration rejected; current missing required field rejected', async () => {
    assert.equal((await submitForm('settings-stale@example.com', oldBinding)).status, 409);
    const req = request('/api/submit-contract', 'POST', { ...h.form, email: 'required-missing@example.com', productId: changed.productsConfig[0].id, optionIds: [], shootRequestNotes: '' }, false);
    req.headers.set('x-contract-configuration', await binding()); assert.notEqual((await submit(req)).status, 200);
  });
  await test('Pending pre-change contract remains blocked, including old final-send attempts', async () => {
    assert.notEqual((await review(request('/api/review-contract?token=' + encodeURIComponent(pendingToken)))).status, 200);
    assert.notEqual((await approve(request('/api/approve-and-send', 'POST', { token: pendingToken, phase: 'prepare', expectedRevision: 1, updatedData: h.form }))).status, 200);
  });
  await test('New submission captures updated pricing and notification destination', async () => {
    const form = { ...h.form, email: 'settings-new@example.com', productId: changed.productsConfig[0].id, optionIds: [], shootRequestNotes: '관리자 필수 요청', portfolioConsent: false };
    const req = request('/api/submit-contract', 'POST', form, false); req.headers.set('x-contract-configuration', await binding());
    const res = await submit(req); assert.equal(res.status, 200); const result = await res.json();
    const record = h.stored(result.contractId); assert.equal(record.pricing.basePrice, changed.productsConfig[0].price);
    assert.equal(record.pricing.depositAmount, changed.contractPolicy.deposit.amount);
    assert.equal(record.repEmail, changed.studioConfig.representativeEmail);
    const token = h.reviewToken(); const data = await (await review(request('/api/review-contract?token=' + encodeURIComponent(token)))).json();
    const prep = await (await approve(request('/api/approve-and-send', 'POST', { token, phase: 'prepare', expectedRevision: data.revision, updatedData: data.data }))).json();
    assert.equal(prep.success, true); assert.equal(prep.snapshot.termsVersion, changed.contractPolicy.version);
    assert.equal(prep.snapshot.product.shootScope, changed.productsConfig[0].shootScope);
    const sent = await approve(request('/api/approve-and-send', 'POST', { token, phase: 'send', snapshotHash: prep.snapshotHash, pdfBase64: h.pdf(prep.snapshotHash) })); assert.equal(sent.status, 200);
  });
  await test('Old sent Snapshot hash, PDF markup and email remain byte-identical', async () => {
    await withRuntimeConfiguration(async () => {
      const reviewed = await (await review(request('/api/review-contract?token=' + encodeURIComponent(oldContract.token)))).json();
      assert.equal(reviewed.success, true); assert.equal(snapshotBinding(reviewed.snapshot), oldContract.hash);
      assert.deepEqual(generateCustomerContractEmail(reviewed.snapshot.data, reviewed.snapshot.pricing, reviewed.snapshot.contractNumber, reviewed.snapshot), oldContract.mail);
      assert.equal(renderToStaticMarkup(React.createElement(ContractDocument, { data: reviewed.snapshot.data, pricing: reviewed.snapshot.pricing, snapshot: reviewed.snapshot })), oldContract.html);
      assert.deepEqual(reviewed.snapshot, oldContract.snapshot);
    });
  });
  await test('Customer contract API cannot write settings, and unsigned GAS settings write rejected', async () => {
    const req = request('/api/submit-contract', 'POST', { settings: changed, expectedRevision: 1 }, false); req.headers.set('x-contract-configuration', await binding());
    assert.notEqual((await submit(req)).status, 200);
    assert.equal(h.gas({ action: 'settings_save', payloadJson: JSON.stringify({ studioId, settings: changed }) }).success, false);
    assert.equal((await head()).revision, 1);
  });
  await test('GAS settings race rejects pre-change contract writes inside the lock', async () => {
    const result = h.context.assertSettingsCurrent;
    assert.throws(() => result({ studioId, settingsRevision: 0, settingsHash: '' }));
    assert.throws(() => result({ studioId }));
  });
  await test('Failed Drive write leaves active revision intact', async () => {
    const another = structuredClone(changed); another.productsConfig[0].price += 1000;
    h.driveFailure(true); const res = await write(another, 1); h.driveFailure(false);
    assert.notEqual(res.status, 200); assert.equal((await head()).revision, 1);
  });
  await test('Malformed active config fails closed; admin can restore a validated historical revision', async () => {
    const next = structuredClone(changed); next.productsConfig[0].price += 1000; assert.equal((await write(next, 1)).status, 200);
    const pointer = JSON.parse(h.properties.get('studio_settings_' + studioId)!);
    h.files.get(pointer.fileId)!.bytes = Buffer.from('{broken-json');
    await assert.rejects(loadRuntimeConfiguration);
    const recovery = await head(); assert.equal(recovery.recoveryRequired, true); assert.equal(recovery.settings, null); assert.equal(recovery.revision, 2);
    assert.notEqual((await write(changed, 2)).status, 200);
    const res = await restore(request(endpoint + 'restore', 'POST', { revision: 1, expectedRevision: 2 })); assert.equal(res.status, 200);
    assert.equal((await head()).revision, 3); assert.deepEqual((await head()).settings, changed);
    assert.equal((await loadRuntimeConfiguration()).revision, 3);
  });
  await test('Concurrent runtime requests remain isolated with AsyncLocalStorage', async () => {
    const seen = await Promise.all(Array.from({ length: 10 }, (_, index) => withRuntimeConfiguration(async () => {
      const config = getConfigurationRuntime(); await new Promise(resolve => setTimeout(resolve, index));
      assert.equal(getConfigurationRuntime(), config); return config.revision;
    })));
    assert.deepEqual(seen, Array(10).fill(3));
  });
  await test('Lost settings receipt is reported as failure, then read confirms exactly one commit', async () => {
    const next = structuredClone(changed); next.productsConfig[0].price += 2000;
    h.transport('lost-settings-response'); const res = await write(next, 3); h.transport('');
    assert.notEqual(res.status, 200); assert.equal((await head()).revision, 4);
    assert.equal((await write(next, 3)).status, 409); assert.equal((await head()).revision, 4);
  });
  await test('Idle expiry and absolute expiry deny server access', async () => {
    const key = 'studio_settings_' + studioId + '_auth';
    const auth = JSON.parse(h.properties.get(key)!); Object.values(auth.sessions).forEach((s: any) => s.lastSeen = Date.now() - 1800001);
    h.properties.set(key, JSON.stringify(auth)); assert.equal((await session(request(endpoint + 'auth'))).status, 401);
    const res = await login(request(endpoint + 'auth', 'POST', { password }, false)); cookie = res.headers.get('set-cookie')!.split(';')[0];
    const absolute = JSON.parse(h.properties.get(key)!); Object.values(absolute.sessions).forEach((s: any) => s.createdAt = Date.now() - 28800001);
    h.properties.set(key, JSON.stringify(absolute)); assert.equal((await read(request(endpoint + 'settings'))).status, 401);
  });
  await test('Logout revokes copied cookie; APP_SECRET/hash rotation invalidates sessions', async () => {
    const res = await login(request(endpoint + 'auth', 'POST', { password }, false)); cookie = res.headers.get('set-cookie')!.split(';')[0];
    const secret = process.env.APP_SECRET; process.env.APP_SECRET = crypto.randomBytes(32).toString('hex');
    assert.equal((await session(request(endpoint + 'auth'))).status, 401); process.env.APP_SECRET = secret;
    const originalHash = process.env.STUDIO_ADMIN_PASSWORD_HASH!; process.env.STUDIO_ADMIN_PASSWORD_HASH = originalHash.slice(0, -1) + (originalHash.endsWith('a') ? 'b' : 'a');
    assert.equal((await session(request(endpoint + 'auth'))).status, 401); process.env.STUDIO_ADMIN_PASSWORD_HASH = originalHash;
    assert.equal((await logout(request(endpoint + 'auth', 'DELETE', {}))).status, 200);
    assert.equal((await read(request(endpoint + 'settings'))).status, 401);
  });
  await test('Persisted global brute-force limit survives server instances', async () => {
    const key = 'studio_settings_' + studioId + '_auth', state = JSON.parse(h.properties.get(key)!);
    state.attempts = Array(10).fill(Date.now()); h.properties.set(key, JSON.stringify(state));
    assert.equal((await login(request(endpoint + 'auth', 'POST', { password }, false))).status, 429);
  });
  await test('Configuration secrets are absent from persisted document and customer content', () => {
    const text = JSON.stringify(changed) + oldContract.html;
    for (const secret of [password, process.env.APP_SECRET!, process.env.GAS_SHARED_SECRET!, process.env.STUDIO_ADMIN_PASSWORD_HASH!]) assert.ok(!text.includes(secret));
    assert.throws(() => validateStudioSettings({ ...baseSettings(), GAS_SHARED_SECRET: 'injection' }));
    assert.throws(() => canonicalForm({ settings: changed }));
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  h.restore(); delete process.env.STUDIO_SETTINGS_ENABLED; delete process.env.STUDIO_ADMIN_PASSWORD_HASH;
  fs.writeFileSync(path.join(artifacts, 'settings-results.json'), JSON.stringify({ studioId, results, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, liveGoogleIO: false }, null, 2));
});
