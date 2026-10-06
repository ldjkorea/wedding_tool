import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { installSheetHarness } from './test-support/sheetHarness';
import * as ownerAuth from '../src/app/api/owner-control/auth/route';
import * as masterAuth from '../src/app/api/master-control/auth/route';
import * as owner from '../src/app/api/owner-control/settings/route';
import * as master from '../src/app/api/master-control/settings/route';
import { POST as restore } from '../src/app/api/master-control/restore/route';
import * as sheetsApi from '../src/app/api/owner-control/sheet-integration/route';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { withRuntimeConfiguration } from '../src/services/serverRuntimeConfiguration';
import { configurationBinding, snapshotBinding } from '../src/lib/contractWorkflow';
import { getStudioConfig, getProducts, getClientContent, getConfigurationRuntime, getDiscountById } from '../src/services/configuration';
import { calculateContractPrice } from '../src/lib/pricing';
import { generateCustomerContractEmail } from '../src/lib/emailTemplates';
import { ContractDocument } from '../src/components/pdf/ContractDocument';
import { signedGasCall } from '../src/services/gasTransport';
import { requireAdmin } from '../src/services/adminAuthentication';
import { settingsHash } from '../src/services/studioSettingsStore';

const h = installGasHarness(), sheets = installSheetHarness(h.context);
const artifacts = path.resolve(process.env.OWNER_ARTIFACT_DIR || '.contract-test-output/owner'); fs.mkdirSync(artifacts, { recursive: true });
const passwords = { owner: crypto.randomBytes(24).toString('base64'), master: crypto.randomBytes(24).toString('base64') };
const hash = (password: string) => { const salt = crypto.randomBytes(16); return 'scrypt$16384$8$1$' + salt.toString('hex') + '$' + crypto.scryptSync(password, salt, 64).toString('hex'); };
process.env.STUDIO_SETTINGS_ENABLED = 'true'; process.env.STUDIO_ADMIN_PASSWORD_HASH = hash(passwords.master); process.env.STUDIO_OWNER_PASSWORD_HASH = hash(passwords.owner); delete process.env.MASTER_ADMIN_PASSWORD_HASH;
const cookies = { owner: '', master: '' }, studioId = getStudioConfig().studioId, authKey = 'studio_settings_' + studioId + '_auth';
const results: { name: string; status: string; error?: string }[] = [];
const req = (url: string, method = 'GET', body?: unknown, cookie = '') => new NextRequest('https://booking.fixture.com' + url, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://booking.fixture.com', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const oreq = (method = 'GET', body?: unknown) => req('/api/owner-control/settings', method, body, cookies.owner);
const mreq = (method = 'GET', body?: unknown) => req('/api/master-control/settings', method, body, cookies.master);
async function login(role: 'owner' | 'master') { const response = await (role === 'owner' ? ownerAuth : masterAuth).POST(req('/api/' + role + '-control/auth', 'POST', { password: passwords[role] })); assert.equal(response.status, 200, await response.clone().text()); cookies[role] = response.headers.get('set-cookie')!.split(';')[0]; return response; }
async function ohead() { const res = await owner.GET(oreq()); assert.equal(res.status, 200); return res.json(); }
async function mhead() { const res = await master.GET(mreq()); assert.equal(res.status, 200); return res.json(); }
async function owrite(changes: unknown, version: number) { return owner.PUT(oreq('PUT', { changes, version })); }
async function test(name: string, run: () => void | Promise<void>) { try { await run(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); } catch (error) { results.push({ name, status: 'failed', error: String(error) }); throw error; } }
async function send(email: string) { const request = h.request('/api/submit-contract', { ...h.form, productId: getProducts()[0].id, optionIds: [], email, partnerDiscount: false, portfolioConsent: false, shootRequestNotes: 'Role fixture', referralSource: getClientContent().referralOptions[0] }); request.headers.set('X-Contract-Configuration', await withRuntimeConfiguration(async () => configurationBinding())); return submit(request); }
async function main() {
  await test('Anonymous Owner and Master APIs deny read/write/session/restore', async () => {
    for (const response of [await owner.GET(oreq()), await owner.PUT(oreq('PUT', {})), await master.GET(mreq()), await ownerAuth.GET(oreq()), await restore(req('/api/master-control/restore', 'POST', {}))]) assert.equal(response.status, 401);
  });
  await test('Legacy administrator hash remains Master login; Owner has independent credential', async () => {
    const response = await login('master'); assert.match(response.headers.get('set-cookie')!, /studio_admin_session=.*Secure.*HttpOnly.*SameSite=strict/i); assert.equal((await mhead()).revision, 0);
    const ownerResponse = await login('owner'); assert.match(ownerResponse.headers.get('set-cookie')!, /studio_owner_session=.*Secure.*HttpOnly.*SameSite=strict/i);
  });
  await test('Unconfigured production Owner initial PIN is blocked while Master remains accessible', async () => {
    const value = process.env.STUDIO_OWNER_PASSWORD_HASH; delete process.env.STUDIO_OWNER_PASSWORD_HASH;
    assert.equal((await ownerAuth.POST(req('/api/owner-control/auth', 'POST', { password: '000000' }))).status, 503);
    assert.equal((await master.GET(mreq())).status, 200); process.env.STUDIO_OWNER_PASSWORD_HASH = value;
  });
  await test('Role credentials cannot authenticate the other role; identical salted-password setup denied', async () => {
    assert.equal((await ownerAuth.POST(req('/api/owner-control/auth', 'POST', { password: passwords.master }))).status, 401);
    assert.equal((await masterAuth.POST(req('/api/master-control/auth', 'POST', { password: passwords.owner }))).status, 401);
    const previous = process.env.STUDIO_OWNER_PASSWORD_HASH; process.env.STUDIO_OWNER_PASSWORD_HASH = hash(passwords.master);
    assert.equal((await ownerAuth.POST(req('/api/owner-control/auth', 'POST', { password: passwords.master }))).status, 503); process.env.STUDIO_OWNER_PASSWORD_HASH = previous;
  });
  await test('Owner cookie cannot read Master config/history or restore, including renamed cookie', async () => {
    for (const cookie of [cookies.owner, cookies.owner.replace('studio_owner_session=', 'studio_admin_session=')]) {
      assert.equal((await master.GET(req('/api/master-control/settings', 'GET', undefined, cookie))).status, 401);
      assert.equal((await master.PUT(req('/api/master-control/settings', 'PUT', {}, cookie))).status, 401);
      assert.equal((await restore(req('/api/master-control/restore', 'POST', { revision: 1, expectedRevision: 0 }, cookie))).status, 401);
    }
    assert.equal((await owner.GET(req('/api/owner-control/settings', 'GET', undefined, cookies.master.replace('studio_admin_session=', 'studio_owner_session=')))).status, 401);
  });
  await test('Owner view contains only operational projection, no Master configuration/history/hash', async () => {
    const data = await ohead(); assert.deepEqual(Object.keys(data.settings).sort(), ['codes','discounts','options','products']);
    const text = JSON.stringify(data); for (const key of ['studioConfig','contractPrefix','formSchema','contractPolicy','history','hash','compatibility','GAS_SHARED_SECRET']) assert.ok(!text.includes(key), key);
    assert.match((await owner.GET(oreq())).headers.get('cache-control')!, /no-store/);
  });
  const sentResponse = await send('owner-old@example.com'); assert.equal(sentResponse.status, 200); const sentContract = await sentResponse.json(), oldToken = h.reviewToken();
  const prep = await approve(h.request('/api/approve-and-send', { token: oldToken, phase: 'prepare', expectedRevision: 1 })); assert.equal(prep.status, 200); const prepared = await prep.json();
  assert.equal((await approve(h.request('/api/approve-and-send', { token: oldToken, phase: 'send', snapshotHash: prepared.snapshotHash, pdfBase64: h.pdf(prepared.snapshotHash) }))).status, 200);
  const frozen = h.stored(sentContract.contractId), frozenSnapshot = JSON.stringify(frozen.snapshot), frozenFiles = new Map([...h.files].filter(([, file]) => file.name.startsWith(sentContract.contractId)).map(([id, file]) => [id, file.bytes.toString('base64')]));
  const frozenMail = generateCustomerContractEmail(frozen.snapshot.data, frozen.snapshot.pricing, frozen.snapshot.contractNumber, frozen.snapshot);
  const frozenMarkup = renderToStaticMarkup(React.createElement(ContractDocument, { data: frozen.snapshot.data, pricing: frozen.snapshot.pricing, snapshot: frozen.snapshot }));
  assert.equal((await send('owner-pending@example.com')).status, 200); const pendingToken = h.reviewToken();
  await test('Owner cannot inject brand, logo, seal, IDs, terms, form, integration or security fields', async () => {
    const data = await ohead(); const initial = JSON.stringify((await mhead()).settings), before = h.files.size;
    for (const key of ['studioConfig','logo','seal','studioId','contractPrefix','contractPolicy','formSchema','integration','APP_SECRET','GAS_SHARED_SECRET','compatibility','history','__proto__']) {
      const changed = structuredClone(data.settings); Object.defineProperty(changed, key, { value: { studioId: 'attacker' }, enumerable: true }); assert.equal((await owrite(changed, 0)).status, 400, key);
    }
    for (const key of ['id','shootScope','plusBenefits','colors']) { const changed = structuredClone(data.settings); changed.products[0][key] = 'attacker'; assert.equal((await owrite(changed, 0)).status, 400, key); }
    assert.equal(JSON.stringify((await mhead()).settings), initial); assert.equal(h.files.size, before);
  });
  await test('Owner price/name/code save creates owner-audited revision and preserves every Master field', async () => {
    const data = await ohead(), before = (await mhead()).settings; data.settings.products[0].price += 100000; data.settings.products[0].name = '대표 수정 상품'; data.settings.codes.push({ code: ' friend50 ', amount: 50000, active: true });
    assert.equal((await owrite(data.settings, data.version)).status, 200);
    const next = await mhead(); assert.equal(next.history.at(-1).actor, 'owner'); assert.equal(next.settings.productsConfig[0].shortName, '대표 수정 상품');
    for (const key of ['studioConfig','contractPolicy','formSchema','content']) assert.deepEqual(next.settings[key], before[key]); assert.equal(next.settings.partnerCodes[0].code, 'FRIEND50');
  });
  await test('Owner option/discount edits preserve eligibility and update customer-facing names consistently', async () => {
    const data = await ohead(), before = (await mhead()).settings; data.settings.options[0].price += 10000; data.settings.options[0].name = '대표 옵션'; data.settings.discounts[0].name = '대표 할인'; data.settings.discounts[0].amount += 1000;
    assert.equal((await owrite(data.settings, data.version)).status, 200); const next = (await mhead()).settings;
    assert.deepEqual(next.discountsConfig[0].eligibility, before.discountsConfig[0].eligibility); assert.equal(next.discountsConfig[0].type, before.discountsConfig[0].type); assert.ok(Object.values(next.discountsConfig[0].labels).every(value => value === '대표 할인'));
  });
  await test('New products/options/codes receive server IDs; removal and client chosen IDs denied', async () => {
    const data = await ohead(); data.settings.products.push({ name: '추가 상품', price: 1800000, description: '추가 제공', includedItems: ['원본 제공'], active: true, displayOrder: 9 }); data.settings.options.push({ name: '추가 옵션', price: 30000, description: '추가', active: true });
    assert.equal((await owrite(data.settings, data.version)).status, 200); const after = await ohead(); assert.match(after.settings.products.at(-1).id, /^product_[a-f0-9-]{36}$/); assert.match(after.settings.options.at(-1).id, /^option_[a-f0-9-]{36}$/);
    for (const section of ['products','options','codes','discounts']) { const changed = structuredClone(after.settings); changed[section].pop(); assert.equal((await owrite(changed, after.version)).status, 400); }
  });
  await test('Owner rejects invalid discount eligibility/type and raw structural labels', async () => {
    const data = await ohead(); for (const key of ['eligibility','type','labels','pricingName']) { const changed = structuredClone(data.settings); changed.discounts[0][key] = 'attacker'; assert.equal((await owrite(changed, data.version)).status, 400); }
  });
  await test('Owner replaces a retired benefit, chooses timing, and never changes the frozen contract', async () => {
    const before = await ohead(), changes = structuredClone(before.settings);
    const prior = changes.discounts.find((rule: {eligibility: {kind: string}}) => rule.eligibility.kind === 'portfolio');
    prior.active = false;
    changes.discounts.push({name:'새 사진사용 혜택',amount:10000,type:'immediate',eligibility:{kind:'portfolio'},description:'TEST',active:true});
    assert.equal((await owrite(changes,before.version)).status,200);
    const immediate = await withRuntimeConfiguration(async () => calculateContractPrice({productId:getProducts()[0].id,portfolioConsent:true}));
    const head = await ohead(); head.settings.discounts.at(-1).type = 'cashback';
    assert.equal((await owrite(head.settings,head.version)).status,200);
    const cashback = await withRuntimeConfiguration(async () => calculateContractPrice({productId:getProducts()[0].id,portfolioConsent:true}));
    assert.equal(cashback.contractTotal,immediate.contractTotal+10000); assert.equal(cashback.futureCashbackTotal,10000);
    await withRuntimeConfiguration(async () => { assert.equal(getDiscountById('portfolio',{...frozen.snapshot,discounts:getConfigurationRuntime().discounts})?.name,'새 사진사용 혜택'); });
    assert.equal(JSON.stringify(h.stored(sentContract.contractId).snapshot),frozenSnapshot);
    const restoreHead=await ohead(); restoreHead.settings.discounts.at(-1).active=false;
    const old=restoreHead.settings.discounts.find((rule: {id:string})=>rule.id===prior.id); old.active=before.settings.discounts.find((rule:{id:string})=>rule.id===prior.id).active;
    assert.equal((await owrite(restoreHead.settings,restoreHead.version)).status,200);
  });
  await test('Bad money, duplicate codes and unsafe deposits fail without new revision', async () => {
    const data = await ohead(); for (const amount of [-1, 0.5, 100000001, null]) { const changed = structuredClone(data.settings); changed.products[0].price = amount; assert.equal((await owrite(changed, data.version)).status, 400); }
    const changed = structuredClone(data.settings); changed.codes.push({ code: 'friend50', amount: 30000, active: true }); assert.equal((await owrite(changed, data.version)).status, 400); assert.equal((await ohead()).version, data.version);
  });
  await test('Master edits full allowed brand/terms/form settings; Owner stale write cannot overwrite', async () => {
    const oldOwner = await ohead(), head = await mhead(); head.settings.studioConfig.displayName = 'MASTER STUDIO'; head.settings.formSchema.instagramId.label = '총관리자 SNS'; head.settings.contractPolicy.version += '-master';
    assert.equal((await master.PUT(mreq('PUT', { settings: head.settings, expectedRevision: head.revision }))).status, 200);
    assert.equal((await owrite(oldOwner.settings, oldOwner.version)).status, 409); assert.equal((await mhead()).history.at(-1).actor, 'master');
  });
  await test('Owner edits and Master stale write conflict in reverse direction', async () => {
    const masterHead = await mhead(), head = await ohead(); head.settings.products[0].price += 2000;
    assert.equal((await owrite(head.settings, head.version)).status, 200);
    assert.equal((await master.PUT(mreq('PUT', { settings: masterHead.settings, expectedRevision: masterHead.revision }))).status, 409);
  });
  await test('Master restores Owner revision by appending history; Owner cannot restore', async () => {
    const before = await mhead(); assert.equal((await restore(req('/api/master-control/restore', 'POST', { revision: 1, expectedRevision: before.revision }, cookies.owner))).status, 401);
    assert.equal((await restore(req('/api/master-control/restore', 'POST', { revision: 1, expectedRevision: before.revision }, cookies.master))).status, 200); const after = await mhead(); assert.equal(after.revision, before.revision + 1); assert.equal(after.history.at(-1).actor, 'master'); assert.equal(after.settings.productsConfig[0].name, '대표 수정 상품');
  });
  await test('Signed GAS layer denies role promotion, full Master actions and protected transition', async () => {
    const sessionId = await requireAdmin(oreq(), 'owner');
    await assert.rejects(() => signedGasCall('admin_session', { sessionId, role: 'master' }));
    for (const action of ['settings_read','settings_revision','settings_restore','settings_save']) await assert.rejects(() => signedGasCall(action, { sessionId }));
    const head = await mhead(); const settings = structuredClone(head.settings); settings.studioConfig.displayName = 'ATTACKER';
    await assert.rejects(() => signedGasCall('owner_save', { sessionId, settings, expectedRevision: head.revision, hash: settingsHash(settings) })); assert.equal((await mhead()).revision, head.revision);
  });
  await test('Owner Sheets ON/create/OFF keeps separate revision; identifier injection denied', async () => {
    const request = (method = 'GET', body?: unknown) => req('/api/owner-control/sheet-integration', method, body, cookies.owner);
    const before = await ohead(), binding = await withRuntimeConfiguration(async () => configurationBinding());
    assert.equal((await sheetsApi.PUT(request('PUT', { enabled: true, expectedRevision: 0 }))).status, 200);
    assert.equal((await sheetsApi.POST(request('POST', { operation: 'create', expectedRevision: 1 }))).status, 200); assert.equal(sheets.books.size, 1);
    assert.equal((await sheetsApi.PUT(request('PUT', { enabled: false, expectedRevision: 2, spreadsheetId: 'attacker' }))).status, 400);
    const mails = h.deliveries.length;
    const sync = await sheetsApi.POST(request('POST',{operation:'sync'})); assert.equal(sync.status,200,await sync.clone().text());
    h.context.contractSheetWorker();
    const preview = await sheetsApi.POST(request('POST',{operation:'read'})); assert.equal(preview.status,200);
    const savedRows = (await preview.json()).integration.previewRows; assert.ok(savedRows.length >= 1); assert.equal(savedRows[0].length,7);
    const rowCount = sheets.book().cells.length; sheets.book().cells[1][14] = 1;
    assert.equal((await sheetsApi.POST(request('POST',{operation:'sync'}))).status,200); h.context.contractSheetWorker();
    assert.equal(sheets.book().cells.length,rowCount); assert.notEqual(sheets.book().cells[1][14],1);
    assert.equal(h.deliveries.length,mails); assert.equal(JSON.stringify(h.stored(sentContract.contractId).snapshot),frozenSnapshot);
    const state = (await (await sheetsApi.GET(request())).json()).integration;
    assert.equal((await sheetsApi.PUT(request('PUT', { enabled: false, expectedRevision: state.revision }))).status, 200); assert.equal((await ohead()).version, before.version); assert.equal(await withRuntimeConfiguration(async () => configurationBinding()), binding); assert.equal(sheets.books.size, 1);
  });
  await test('Changed config reaches new submission but pending old approval remains protected', async () => {
    const res = await send('owner-new@example.com'); assert.equal(res.status, 200); const data = await res.json(); const record = h.stored(data.contractId);
    assert.equal(record.formData.productId, (await ohead()).settings.products[0].id); assert.equal(record.pricing.basePrice, (await ohead()).settings.products[0].price); assert.equal(record.status, 'submitted');
    assert.notEqual((await approve(h.request('/api/approve-and-send', { token: pendingToken, phase: 'prepare', expectedRevision: 1 }))).status, 200);
  });
  await test('Old sent Snapshot, PDF file bytes and email remain identical after both roles and restore', async () => {
    assert.equal(JSON.stringify(h.stored(sentContract.contractId).snapshot), frozenSnapshot);
    for (const [id, bytes] of frozenFiles) {
      const file = h.files.get(id)!;
      if (file.name.endsWith('.json')) { const before=JSON.parse(Buffer.from(bytes,'base64').toString('utf8')), after=JSON.parse(file.bytes.toString('utf8')); delete before.sheetSync; delete after.sheetSync; assert.ok(JSON.stringify(after)===JSON.stringify(before),'Only Sheet integration metadata may change'); }
      else assert.ok(file.bytes.toString('base64')===bytes,'Frozen document bytes remain unchanged');
    }
    await withRuntimeConfiguration(async () => {
      assert.equal(snapshotBinding(frozen.snapshot), frozen.snapshotHash);
      assert.deepEqual(generateCustomerContractEmail(frozen.snapshot.data, frozen.snapshot.pricing, frozen.snapshot.contractNumber, frozen.snapshot), frozenMail);
      assert.equal(renderToStaticMarkup(React.createElement(ContractDocument, { data: frozen.snapshot.data, pricing: frozen.snapshot.pricing, snapshot: frozen.snapshot })), frozenMarkup);
    });
    assert.equal(h.deliveries.filter(mail => mail.to === 'owner-old@example.com').length, 1);
  });
  await test('Cashback still never reduces total under current operational settings', async () => {
    await withRuntimeConfiguration(async () => { const productId = getProducts()[0].id, data = { ...h.form, productId, optionIds: [], sundayDiscount: false, portfolioConsent: false, reviewContractCashback: false, reviewMainCashback: false }; const a = calculateContractPrice(data), b = calculateContractPrice({ ...data, reviewContractCashback: true, reviewMainCashback: true }); assert.equal(a.contractTotal, b.contractTotal); assert.equal(a.balanceAmount, b.balanceAmount); assert.equal(getConfigurationRuntime().revision, (await ohead()).version); });
  });
  await test('Failed Owner persistence keeps revision unchanged and reports failure', async () => {
    const data = await ohead(); data.settings.products[0].price += 3000; h.driveFailure(true);
    assert.notEqual((await owrite(data.settings, data.version)).status, 200); h.driveFailure(false); assert.equal((await ohead()).version, data.version);
  });
  await test('Lost Owner save response remains uncertain; read confirms one publication, retry conflicts', async () => {
    const data = await ohead(); data.settings.products[0].price += 3000; h.transport('lost-owner-response');
    assert.notEqual((await owrite(data.settings, data.version)).status, 200); h.transport(''); assert.equal((await ohead()).version, data.version + 1); assert.equal((await owrite(data.settings, data.version)).status, 409);
  });
  await test('Owner idle expiry is enforced in persisted GAS session without expiring Master', async () => {
    const id = await requireAdmin(oreq(), 'owner'), state = JSON.parse(h.properties.get(authKey)!); state.sessions[id].lastSeen = Date.now() - 1800001; h.properties.set(authKey, JSON.stringify(state));
    assert.equal((await owner.GET(oreq())).status, 401); assert.equal((await master.GET(mreq())).status, 200); await login('owner');
  });
  await test('Owner CSRF is denied; logout revokes only Owner session and Master remains valid', async () => {
    const bad = oreq('PUT', {}); bad.headers.delete('origin'); assert.notEqual((await owner.PUT(bad)).status, 200);
    const rotated = process.env.STUDIO_OWNER_PASSWORD_HASH; process.env.STUDIO_OWNER_PASSWORD_HASH = hash(passwords.owner); assert.equal((await owner.GET(oreq())).status, 401); process.env.STUDIO_OWNER_PASSWORD_HASH = rotated;
    assert.equal((await ownerAuth.DELETE(req('/api/owner-control/auth', 'DELETE', {}, cookies.owner))).status, 200); assert.equal((await owner.GET(oreq())).status, 401); assert.equal((await master.GET(mreq())).status, 200);
  });
  await test('Explicit new Master hash takes precedence and invalidates legacy session safely', async () => {
    process.env.MASTER_ADMIN_PASSWORD_HASH = hash(passwords.master); assert.equal((await master.GET(mreq())).status, 401); await login('master'); assert.equal((await master.GET(mreq())).status, 200);
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { h.restore(); fs.writeFileSync(path.join(artifacts, 'owner-role-results.json'), JSON.stringify({ studioId, passed: results.filter(item => item.status === 'passed').length, failed: results.filter(item => item.status === 'failed').length, results, liveGoogleIO: false, physicalUserUsability: false }, null, 2)); });
