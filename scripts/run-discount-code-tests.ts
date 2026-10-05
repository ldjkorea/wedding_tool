import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { POST as login } from '../src/app/api/studio-control/auth/route';
import { GET as read, PUT as save } from '../src/app/api/studio-control/settings/route';
import { POST as restore } from '../src/app/api/studio-control/restore/route';
import { POST as validateCode } from '../src/app/api/validate-partner-code/route';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { GET as review } from '../src/app/api/review-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { baseSettings, composeConfiguration } from '../src/services/settingsValidation';
import { settingsHash } from '../src/services/studioSettingsStore';
import { signedGasCall } from '../src/services/gasTransport';
import { getBackendAdapter } from '../src/services/googleAppsScriptAdapter';
import { withRuntimeConfiguration } from '../src/services/serverRuntimeConfiguration';
import { getProducts, getOptions, getDiscounts, getContractPolicy, getClientContent, getStudioConfig } from '../src/services/configuration';
import { configurationBinding, snapshotBinding } from '../src/lib/contractWorkflow';
import { calculateContractPrice } from '../src/lib/pricing';
import { generateCustomerContractEmail } from '../src/lib/emailTemplates';
import { ContractDocument } from '../src/components/pdf/ContractDocument';
import { normalizePartnerCode, isPartnerCodeFormat } from '../src/lib/partnerCode';
import { describeChanges } from '../src/components/admin/settingsPresentation';
import type { StudioSettings } from '../src/types/studioSettings';

const h = installGasHarness(); process.env.STUDIO_SETTINGS_ENABLED = 'true';
const password = crypto.randomBytes(24).toString('base64'), salt = crypto.randomBytes(16);
process.env.STUDIO_ADMIN_PASSWORD_HASH = 'scrypt$16384$8$1$' + salt.toString('hex') + '$' + crypto.scryptSync(password, salt, 64).toString('hex');
const artifacts = path.resolve(process.env.CODES_ARTIFACT_DIR || '.contract-test-output/discount-codes'); fs.mkdirSync(artifacts, { recursive: true });
const results: { name: string; status: string; error?: string }[] = []; let cookie = '', matrixCount = 0;
const origin = 'https://booking.fixture.com';
const req = (route: string, method = 'GET', body?: unknown, auth = true) => new NextRequest(origin + route, { method,
  headers: { Origin: origin, 'Content-Type': 'application/json', ...(auth ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function test(name: string, task: () => void | Promise<void>) { try { await task(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); } catch (error) { results.push({ name, status: 'failed', error: String(error) }); throw error; } }
async function head() { const response = await read(req('/api/studio-control/settings')); assert.equal(response.status, 200); return response.json(); }
async function write(settings: StudioSettings, revision: number) { return save(req('/api/studio-control/settings', 'PUT', { settings, expectedRevision: revision })); }
async function publicRequest(route: string, body: unknown, binding?: string) { const request = req(route, 'POST', body, false); request.headers.set('X-Contract-Configuration', binding || await withRuntimeConfiguration(async () => configurationBinding())); return request; }
async function code(value: string) { return validateCode(await publicRequest('/api/validate-partner-code', { code: value })); }
const form = { ...h.form, productId: getProducts()[0].id, optionIds: [], weddingDate: '2027-04-17', sundayDiscount: false,
  portfolioConsent: false, reviewContractCashback: true, reviewMainCashback: true, shootRequestNotes: 'Code regression fixture', referralSource: getClientContent().referralOptions[0] };
let frozen: any, token = '', pendingToken = '', oldBinding = '', beforeHtml = '', beforeMail = '', snapshotHash = '', oldDeliveries = 0;
async function main() {
  await test('Partner validation contains no Sheets lookup or deployed code fixture list', () => {
    const source = fs.readFileSync('google-apps-script/Code.gs', 'utf8'); assert.ok(!/PARTNER_SPREADSHEET_ID|PARTNER_SHEET_NAME/.test(source));
    assert.ok(!source.slice(source.indexOf('function validatePartner('), source.indexOf('function assertPartnerPayload(')).includes('SpreadsheetApp'));
    assert.ok(!('partnerCodes' in getStudioConfig()));
    for (const client of ['dear-memory', 'moment-studio']) assert.ok(!fs.readFileSync('src/config/clients/' + client + '/index.ts', 'utf8').includes('partnerCodes'));
  });
  await test('Normalization is NFC, trimmed, case-insensitive; internal spaces invalid', () => {
    assert.equal(normalizePartnerCode('  pAiR-30  '), 'PAIR-30'); assert.equal(normalizePartnerCode('\u1100\u1161'), '가');
    for (const invalid of ['A', 'A B', 'A\tB', '<CODE>', 'X'.repeat(65)]) assert.equal(isPartnerCodeFormat(normalizePartnerCode(invalid)), false);
  });
  await test('No registered settings means no implicit or test-code discount', async () => {
    for (const name of ['registered-partner', '테스트짝꿍', 'PAIR-30']) { const response = await code(name); assert.equal(response.status, 200); assert.equal((await response.json()).discountAmount, 0); }
    assert.equal((await save(req('/api/studio-control/settings', 'PUT', {}, false))).status, 401);
  });
  await test('Authenticated administrator alone can save; login retains secure cookie', async () => {
    const response = await login(req('/api/studio-control/auth', 'POST', { password }, false)); assert.equal(response.status, 200);
    for (const attribute of [/HttpOnly/i, /Secure/i, /SameSite=strict/i]) assert.match(response.headers.get('set-cookie')!, attribute); cookie = response.headers.get('set-cookie')!.split(';')[0];
  });
  await test('Legacy seven-section revision restores without breaking source hash integrity', async () => {
    const legacy = baseSettings(); delete legacy.partnerCodes; legacy.studioConfig.representativeEmail = 'codes-owner@example.com';
    const studioId = legacy.studioConfig.studioId, sessionId = crypto.randomBytes(32).toString('hex');
    h.context.settingsAction('admin_login', { studioId, sessionId });
    h.context.settingsAction('settings_save', { studioId, sessionId, settings: legacy, expectedRevision: 0, hash: settingsHash(legacy) });
    assert.equal((await head()).revision, 1);
    const response = await restore(req('/api/studio-control/restore', 'POST', { revision: 1, expectedRevision: 1 })); assert.equal(response.status, 200);
    const current = await head(); assert.equal(current.revision, 2); assert.deepEqual(current.settings.partnerCodes, []);
  });
  await test('Codes and individual amounts persist inside immutable settings revision', async () => {
    const current = await head(), settings = current.settings as StudioSettings;
    settings.partnerCodes = [{ id: 'pair30', code: '  pair-30 ', amount: 30000, active: true }, { id: 'vip75', code: 'VIP-75', amount: 75000, active: true }, { id: 'inactive50', code: 'INACTIVE-50', amount: 50000, active: false }, { id: 'privateunused', code: 'UNUSED-PRIVATE-ONLY', amount: 20000, active: true }];
    assert.equal((await write(settings, current.revision)).status, 200);
    const saved = await head(); assert.equal(saved.revision, 3); assert.equal(saved.settings.partnerCodes[0].code, 'PAIR-30');
  });
  await test('Invalid/duplicate codes, money, deletion and injected infrastructure never save', async () => {
    const current = await head(), mutations: ((value: any) => void)[] = [s => s.partnerCodes[1].code = 'pair-30', s => s.partnerCodes[0].code = 'TWO WORDS', s => s.partnerCodes[0].amount = 0, s => s.partnerCodes[0].amount = 1.5, s => s.partnerCodes[0].amount = -1, s => s.partnerCodes[0].amount = 100000000, s => s.partnerCodes[0].active = 'true', s => s.partnerCodes.pop(), s => s.partnerCodes[0].id = 'x y', s => s.partnerCodes[0].GAS_WEBAPP_URL = 'injected', s => s.discountsConfig.find((r: any) => r.eligibility.kind === 'partner').type = 'cashback'];
    for (const mutate of mutations) { const invalid = structuredClone(current.settings); mutate(invalid); assert.notEqual((await write(invalid, current.revision)).status, 200); assert.equal((await head()).revision, current.revision); }
  });
  await test('Public configuration excludes every registry entry; validation returns only entered code', async () => {
    const settings = (await head()).settings as StudioSettings, serialized = JSON.stringify(composeConfiguration(settings));
    for (const marker of ['partnerCodes', 'PAIR-30', 'VIP-75', 'INACTIVE-50', 'UNUSED-PRIVATE-ONLY']) assert.ok(!serialized.includes(marker));
    const response = await code(' pair-30 '); assert.match(response.headers.get('cache-control')!, /no-store/);
    assert.deepEqual(await response.json(), { success: true, valid: true, code: 'PAIR-30', discountAmount: 30000 });
    const empty = await code(''); assert.match(empty.headers.get('cache-control')!, /no-store/); assert.equal((await empty.json()).discountAmount, 0);
  });
  await test('Runtime HTTP projection exposes no private code/history/session data and preserves full revision guard', async () => {
    const current = await head(), result = await signedGasCall('settings_runtime', {}), body = JSON.stringify(result);
    for (const marker of ['partnerCodes', 'PAIR-30', 'VIP-75', 'UNUSED-PRIVATE-ONLY', 'sessions', 'attempts']) assert.ok(!body.includes(marker));
    const projection = result.current as any; assert.equal(projection.hash, settingsHash(current.settings)); assert.equal(projection.publicHash, settingsHash(projection.settings)); assert.ok(!('history' in projection));
  });
  await test('Unknown, inactive and malformed codes return zero', async () => {
    for (const input of ['UNKNOWN', 'INACTIVE-50', 'PAIR 30', 'X']) { const res = await code(input), body = await res.json(); assert.equal(body.valid, false); assert.equal(body.discountAmount, 0); }
  });
  await test('Pricing matrix uses per-code money; cashback never reduces contractTotal', async () => withRuntimeConfiguration(async () => {
    const rules = getDiscounts(), rule = (kind: string) => rules.find(d => d.eligibility.kind === kind), options = getOptions().filter(o => o.active);
    for (const product of getProducts()) for (let mask = 0; mask < 1 << options.length; mask++) for (const date of ['2027-04-17', '2027-04-18']) for (const amount of [0, 30000, 75000]) for (const portfolio of [false, true]) for (let cashback = 0; cashback < 4; cashback++) for (const adjustment of [0, -10000]) {
      const optionIds = options.filter((_, index) => mask & 1 << index).map(o => o.id), weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      const params = { ...form, productId: product.id, optionIds, weddingDate: date, partnerDiscount: !!amount, partnerName: amount ? 'PAIR-30' : '', partnerDiscountAmount: amount, portfolioConsent: portfolio, reviewContractCashback: !!(cashback & 1), reviewMainCashback: !!(cashback & 2), manualAdjustment: { amount: adjustment, reason: 'Fixture' } };
      const pricing = calculateContractPrice(params), expected = product.basePrice + options.filter(o => optionIds.includes(o.id)).reduce((sum, o) => sum + o.price, 0) - (weekday === rule('weekday')?.eligibility.weekday ? rule('weekday')!.amount : 0) - amount - (portfolio ? rule('portfolio')!.amount : 0) + adjustment;
      assert.equal(pricing.contractTotal, expected); assert.equal(pricing.depositAmount, getContractPolicy().deposit.amount); assert.equal(pricing.balanceAmount, expected - pricing.depositAmount);
      assert.equal(pricing.futureCashbackTotal, (cashback & 1 ? rule('review_contract')!.amount : 0) + (cashback & 2 ? rule('review_main')!.amount : 0));
      assert.equal(calculateContractPrice({ ...params, reviewContractCashback: false, reviewMainCashback: false }).contractTotal, expected); matrixCount++;
    }
  }));
  await test('Forged client money ignored; normalized retries keep one contract ID and notification', async () => {
    const first = await submit(await publicRequest('/api/submit-contract', { ...form, email: 'codes-customer@example.com', partnerDiscount: true, partnerName: ' pair-30 ', partnerDiscountAmount: 999999 })); assert.equal(first.status, 200);
    const body = await first.json(), stored = h.stored(body.contractId); assert.equal(stored.formData.partnerDiscountAmount, 30000); assert.equal(stored.formData.partnerName, 'PAIR-30'); token = h.reviewToken();
    const count = h.deliveries.length, again = await submit(await publicRequest('/api/submit-contract', { ...form, email: 'codes-customer@example.com', partnerDiscount: true, partnerName: 'PaIr-30', partnerDiscountAmount: 1 })); assert.equal(again.status, 200); assert.equal((await again.json()).contractId, body.contractId); assert.equal(h.deliveries.length, count);
  });
  await test('Invalid selected code fails submission without durable record or success', async () => {
    const count = h.files.size, mails = h.deliveries.length;
    for (const input of ['INACTIVE-50', 'UNKNOWN', 'PAIR 30']) { const response = await submit(await publicRequest('/api/submit-contract', { ...form, partnerDiscount: true, partnerName: input, partnerDiscountAmount: 100000 })); assert.notEqual(response.status, 200); assert.equal((await response.json()).success, false); }
    assert.equal(h.files.size, count); assert.equal(h.deliveries.length, mails);
  });
  await test('GET review never sends; representative edits product and code; final Snapshot/PDF/emails agree', async () => {
    const mails = h.deliveries.length, response = await review(req('/api/review-contract?token=' + encodeURIComponent(token))), body = await response.json(); assert.equal(response.status, 200); assert.equal(h.deliveries.length, mails);
    const edited = { ...body.data, productId: getProducts()[1].id, partnerName: ' vip-75 ', partnerDiscount: true, partnerDiscountAmount: 1 };
    const preparedResponse = await approve(req('/api/approve-and-send', 'POST', { token, phase: 'prepare', expectedRevision: body.revision, updatedData: edited }, false)); assert.equal(preparedResponse.status, 200);
    const prepared = await preparedResponse.json(); assert.equal(prepared.snapshot.data.partnerName, 'VIP-75'); assert.equal(prepared.snapshot.data.partnerDiscountAmount, 75000);
    assert.equal(prepared.snapshot.pricing.contractTotal, await withRuntimeConfiguration(async () => calculateContractPrice({ ...edited, partnerDiscountAmount: 75000 }).contractTotal));
    const final = await approve(req('/api/approve-and-send', 'POST', { token, phase: 'send', snapshotHash: prepared.snapshotHash, pdfBase64: h.pdf(prepared.snapshotHash) }, false)); assert.equal(final.status, 200); frozen = (await final.json()).snapshot; snapshotHash = snapshotBinding(frozen);
    beforeHtml = renderToStaticMarkup(React.createElement(ContractDocument, { data: frozen.data, pricing: frozen.pricing, snapshot: frozen })); beforeMail = JSON.stringify(generateCustomerContractEmail(frozen.data, frozen.pricing, frozen.contractNumber, frozen));
    assert.match(beforeHtml, /VIP-75/); assert.match(beforeHtml, /75,000/); assert.ok(!JSON.stringify(frozen).includes('UNUSED-PRIVATE-ONLY')); assert.ok(!JSON.stringify(frozen).includes('partnerCodes'));
    assert.equal(frozen.id, prepared.contractId || body.contractId); assert.equal(h.stored(frozen.id).snapshot.id, frozen.id);
    for (const mail of h.deliveries.filter(m => m.options.attachments)) { assert.match(mail.options.htmlBody, /VIP-75/); assert.match(mail.options.htmlBody, /75,000/); const attachment = mail.options.attachments[0]; const bytes = Buffer.from(attachment.getBytes ? attachment.getBytes() : attachment.bytes).toString('latin1'); assert.ok(bytes.includes(snapshotHash)); }
    oldDeliveries = h.deliveries.length;
  });
  await test('Concurrent final-send replay cannot duplicate customer or representative emails', async () => {
    const responses = await Promise.all([1, 2].map(() => approve(req('/api/approve-and-send', 'POST', { token, phase: 'send', snapshotHash }, false))));
    assert.ok(responses.every(res => res.status !== 200)); assert.equal(h.deliveries.length, oldDeliveries); assert.equal(h.deliveries.filter(m => m.to === 'codes-customer@example.com').length, 1);
  });
  await test('Code amount/edit/deactivation creates revision; old Snapshot, PDF and both mails remain frozen', async () => {
    oldBinding = await withRuntimeConfiguration(async () => configurationBinding());
    const pending = await submit(await publicRequest('/api/submit-contract', { ...form, email: 'pending-code@example.com', partnerDiscount: true, partnerName: 'PAIR-30' })); assert.equal(pending.status, 200); pendingToken = h.reviewToken();
    const current = await head(); current.settings.partnerCodes[1].amount = 100000; current.settings.partnerCodes[1].active = false;
    assert.equal((await write(current.settings, current.revision)).status, 200); assert.equal((await code('VIP-75')).status, 200); assert.equal((await (await code('VIP-75')).json()).discountAmount, 0);
    const reviewed = await review(req('/api/review-contract?token=' + encodeURIComponent(token))); assert.equal(reviewed.status, 200); const old = (await reviewed.json()).snapshot;
    assert.equal(snapshotBinding(old), snapshotHash); assert.equal(old.data.partnerDiscountAmount, 75000);
    assert.equal(renderToStaticMarkup(React.createElement(ContractDocument, { data: old.data, pricing: old.pricing, snapshot: old })), beforeHtml); assert.equal(JSON.stringify(generateCustomerContractEmail(old.data, old.pricing, old.contractNumber, old)), beforeMail);
    const count = h.deliveries.length; const resend = await approve(req('/api/approve-and-send', 'POST', { token, phase: 'send', snapshotHash }, false)); assert.notEqual(resend.status, 200); assert.equal(h.deliveries.length, count);
  });
  await test('Changed revision blocks stale code validation, submission and pending review', async () => {
    assert.equal((await validateCode(await publicRequest('/api/validate-partner-code', { code: 'PAIR-30' }, oldBinding))).status, 409);
    assert.equal((await submit(await publicRequest('/api/submit-contract', form, oldBinding))).status, 409);
    assert.notEqual((await review(req('/api/review-contract?token=' + encodeURIComponent(pendingToken)))).status, 200);
  });
  await test('Network, HTTP500 and malformed GAS responses fail closed; no fixture fallback', async () => {
    for (const failure of ['network', 'http500', 'malformed', 'reject'] as const) { h.transport(failure); const response = await validateCode(req('/api/validate-partner-code', 'POST', { code: 'PAIR-30' }, false)); assert.notEqual(response.status, 200); assert.equal((await response.json()).success, false); }
    h.transport('');
  });
  await test('Global partner switch disables all codes and preserves existing confirmed contract', async () => {
    const current = await head(); current.settings.discountsConfig.find((r: any) => r.eligibility.kind === 'partner').active = false; assert.equal((await write(current.settings, current.revision)).status, 200);
    assert.equal((await (await code('PAIR-30')).json()).discountAmount, 0); assert.equal(h.stored(frozen.id).snapshot.data.partnerDiscountAmount, 75000);
  });
  await test('Human change summary describes money and activation without internal IDs or asset data', async () => {
    const a = (await head()).settings as StudioSettings, b = structuredClone(a); b.productsConfig[0].price += 100000; b.partnerCodes![0].active = false;
    const rows = describeChanges(a, b).join('\n'); assert.match(rows, /가격/); assert.match(rows, /원 → .*원/); assert.match(rows, /PAIR-30.*사용함 → 사용 안 함/); assert.ok(!rows.includes('pair30'));
  });
  await test('Signed GAS also rejects a forged applied code amount independently of UI validation', async () => {
    // Direct call to the real handler inside the harness, beyond the TypeScript boundary.
    assert.throws(() => h.context.assertPartnerPayload({ partnerDiscount: true, partnerName: 'PAIR-30', partnerDiscountAmount: 99999 }, { breakdown: [] }, getStudioConfig().studioId));
  });
  await test('GAS validation rejects a settings race after the application runtime was loaded', async () => withRuntimeConfiguration(async () => {
    const current = await head(); current.settings.partnerCodes[0].amount = 35000;
    assert.equal((await write(current.settings, current.revision)).status, 200);
    const result = await getBackendAdapter().validatePartnerCode('PAIR-30'); assert.equal(result.success, false); assert.equal(result.valid, false); assert.equal(result.discountAmount, 0);
  }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  h.restore(); fs.writeFileSync(path.join(artifacts, 'discount-code-results.json'), JSON.stringify({ results, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, matrixCount, realCodeGs: true, liveGoogleIO: false }, null, 2));
});
