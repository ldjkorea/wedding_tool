import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { NextRequest } from 'next/server';
import { jsPDF } from 'jspdf';
import { getBackendAdapter, GoogleAppsScriptAdapter } from '../src/services/googleAppsScriptAdapter';
import { MockBackendAdapter } from '../src/services/mockBackendAdapter';
import { createApprovalToken, verifyApprovalToken } from '../src/lib/token';
import { snapshotBinding, validatePdf } from '../src/lib/contractWorkflow';
import { canonicalForm } from '../src/lib/contractValidation';
import { PRODUCTS_CONFIG } from '../src/config/products';
import { getStudioConfig } from '../src/services/configuration';
import { DISCOUNTS_CONFIG } from '../src/config/discounts';
import { calculateContractPrice } from '../src/lib/pricing';
import { assertPageFits, assertPrintableBounds } from '../src/lib/pdfGenerator';
import { generateCustomerContractEmail, generateRepresentativeNotificationEmail } from '../src/lib/emailTemplates';
import { ContractFormData } from '../src/types/contract';
import { POST as submitRoute } from '../src/app/api/submit-contract/route';
import { POST as approveRoute } from '../src/app/api/approve-and-send/route';
import { GET as reviewRoute } from '../src/app/api/review-contract/route';
import { GET as mailboxRoute, POST as resetRoute } from '../src/app/api/demo/mailbox/route';

const secret = crypto.randomBytes(32).toString('hex');
Object.assign(process.env, {
  NODE_ENV: 'production', BACKEND_MODE: 'gas', APP_SECRET: crypto.randomBytes(32).toString('hex'),
  GAS_SHARED_SECRET: secret, GAS_WEBAPP_URL: 'https://script.google.com/macros/s/isolated-test/exec',
  NEXT_PUBLIC_APP_URL: 'https://booking.fixture.com', REPRESENTATIVE_EMAIL: 'representative@booking.fixture.com',
});
const form: ContractFormData = {
  weddingDate: '2027-04-18', weddingTime: '14:00', weddingVenue: 'Test venue', weddingHall: 'Hall',
  groomName: 'Fixture groom', groomPhone: '010-1111-2222', brideName: 'Fixture bride', bridePhone: '010-3333-4444',
  email: 'customer@example.com', productId: 'album_plus', optionIds: ['second_shooter'],
  partnerDiscount: false, partnerName: '', sundayDiscount: true, portfolioConsent: true,
  reviewContractCashback: true, reviewMainCashback: false, termsAgreed: true, requestNotes: 'Accepted special condition',
};
let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn(); passed++; console.log('PASS ' + name);
}
type StoredFile = { id: string; name: string; bytes: Buffer };
const files = new Map<string, StoredFile>();
const properties = new Map<string, string>([
  ['GAS_SHARED_SECRET', secret], ['CONTRACTS_FOLDER_ID', 'isolated-folder'],
]);
const deliveries: { to: string; subject: string; options: any }[] = [];
let emailFault = '', driveFault = false;
let writeFault: ((value: any) => boolean) | undefined;
function blob(bytes: Buffer) {
  return { getBytes: () => Array.from(bytes), getDataAsString: () => bytes.toString('utf8') };
}
function wrap(file: StoredFile): any {
  return {
    getId: () => file.id, getName: () => file.name, getBlob: () => blob(file.bytes),
    setContent: (text: string) => {
      if (driveFault || writeFault?.(JSON.parse(text))) throw new Error('Injected write failure');
      file.bytes = Buffer.from(text); return wrap(file);
    },
  };
}
const folder = {
  getUrl: () => 'https://drive.google.com/isolated-folder',
  getFilesByName: (name: string) => {
    const found = [...files.values()].filter(f => f.name === name);
    let index = 0;
    return { hasNext: () => index < found.length, next: () => wrap(found[index++]) };
  },
  createFile: (first: any, text?: string) => {
    if (driveFault) throw new Error('Injected Drive failure');
    const file = { id: crypto.randomUUID(), name: typeof first === 'string' ? first : first.name, bytes: typeof first === 'string' ? Buffer.from(text!) : Buffer.from(first.bytes) };
    files.set(file.id, file); return wrap(file);
  },
};
const context: any = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({
    getProperty: (key: string) => properties.get(key),
    setProperty: (key: string, value: string) => properties.set(key, value),
    deleteProperty: (key: string) => properties.delete(key),
    getProperties: () => Object.fromEntries(properties),
  }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  Utilities: {
    Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { SHA_256: 'sha256' },
    computeDigest: (_: string, value: string | number[]) => Array.from(crypto.createHash('sha256').update(typeof value === 'string' ? value : Buffer.from(value)).digest()),
    computeHmacSha256Signature: (value: string, key: string) => Array.from(crypto.createHmac('sha256', key).update(value).digest()),
    base64Decode: (value: string) => Array.from(Buffer.from(value, 'base64')),
    newBlob: (bytes: number[], mime: string, name: string) => ({ bytes, mime, name }),
  },
  DriveApp: { getFolderById: () => folder, getFileById: (id: string) => wrap(files.get(id)!) },
  GmailApp: { sendEmail: (to: string, subject: string, _: string, options: any) => {
    deliveries.push({ to, subject, options });
    if (to === emailFault) throw new Error('Injected uncertain delivery');
  } },
  SpreadsheetApp: { openById: () => {
    throw new Error('Sheets lookup is forbidden');
  } },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
  MimeType: { PLAIN_TEXT: 'text/plain' },
});
vm.runInContext(fs.readFileSync('google-apps-script/Code.gs', 'utf8'), context);
const gas = (request: unknown) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(request) } }).text);
const request = (path: string, value: unknown) => new NextRequest('https://booking.fixture.com' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://booking.fixture.com' }, body: JSON.stringify(value) });
const originalFetch = globalThis.fetch;
let transportFault: 'network' | 'malformed' | 'reject' | 'lost-receipt' | '' = '';
globalThis.fetch = async (_input, init) => {
  assert.ok(init?.signal, 'GAS transport requires timeout signal');
  if (transportFault === 'network') throw new Error('Injected network failure');
  if (transportFault === 'malformed') return new Response('not-json', { status: 200 });
  const envelope = JSON.parse(init!.body as string);
  if (transportFault === 'reject') return new Response(JSON.stringify({ success: false }));
  const result = gas(envelope);
  if (transportFault === 'lost-receipt' && envelope.action === 'submit_contract') return new Response('lost receipt');
  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
function stored(id: string): any {
  return JSON.parse([...files.values()].find(f => f.name === id + '.json')!.bytes.toString('utf8'));
}
function reviewToken(index = deliveries.length - 1): string {
  return new URL(deliveries[index].options.htmlBody.match(/href="([^"]+)"/)[1]).searchParams.get('token')!;
}
function pdf(hash: string): string {
  const document = new jsPDF();
  document.setProperties({ subject: 'contract-snapshot:' + hash });
  document.text('Isolated regression fixture', 20, 20);
  return document.output('datauristring');
}
async function main() {
  await test('Production missing APP_SECRET fails clearly', async () => {
    const saved = process.env.APP_SECRET; delete process.env.APP_SECRET;
    assert.throws(() => getBackendAdapter(), /APP_SECRET/);
    const response = await submitRoute(request('/api/submit-contract', form));
    assert.equal(response.status, 503); assert.ok((await response.json()).error.includes('APP_SECRET'));
    process.env.APP_SECRET = saved;
  });
  await test('Production missing GAS URL never becomes Mock', () => {
    const saved = process.env.GAS_WEBAPP_URL; delete process.env.GAS_WEBAPP_URL;
    assert.throws(() => getBackendAdapter(), /GAS_WEBAPP_URL/); process.env.GAS_WEBAPP_URL = saved;
  });
  await test('Production cannot select Demo or invoke Mock directly', async () => {
    process.env.BACKEND_MODE = 'demo';
    assert.throws(() => getBackendAdapter(), /BACKEND_MODE/);
    // P8 rejects the Mock at construction, before any method can be invoked.
    assert.throws(() => new MockBackendAdapter(), /BACKEND_MODE/);
    process.env.BACKEND_MODE = 'gas';
    assert.equal((await mailboxRoute()).status, 404);
    assert.equal((await resetRoute(request('/api/demo/mailbox', {}))).status, 404);
  });
  await test('Anonymous GAS POST and GET have zero external side effects', () => {
    assert.equal(gas({ action: 'approve_and_send', payload: { updatedData: form } }).success, false);
    assert.equal(JSON.parse(context.doGet().text).success, false);
    assert.equal(deliveries.length, 0); assert.equal(files.size, 0);
  });
  await test('Server rejects customer adjustment, malformed date/options/email/consent', () => {
    for (const changed of [{ manualAdjustment: { amount: -50000, reason: 'forged' } }, { weddingDate: '2027-02-30' }, { optionIds: ['second_shooter', 'second_shooter'] }, { optionIds: ['makeup_scene'] }, { productId: 'unknown' }, { email: 'a@example.com,b@example.com' }, { termsAgreed: false }]) {
      assert.throws(() => canonicalForm({ ...form, ...changed }));
    }
  });
  await test('Transport/malformed/backend failure cannot produce customer receipt success', async () => {
    for (const fault of ['network', 'malformed', 'reject'] as const) {
      transportFault = fault;
      const response = await submitRoute(request('/api/submit-contract', form));
      assert.notEqual(response.status, 200); assert.equal((await response.json()).success, false);
    }
    transportFault = '';
    assert.equal(files.size, 0);
  });
  let id = '', token = '';
  await test('Single canonical receipt; customer response contains no approval capability', async () => {
    const response = await submitRoute(request('/api/submit-contract', form));
    const result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.success, true);
    assert.equal('approvalToken' in result, false); assert.equal('reviewUrl' in result, false);
    id = result.contractId; token = reviewToken();
    assert.equal(verifyApprovalToken(token).contractId, id);
    assert.deepEqual(stored(id).formData, canonicalForm(form));
    assert.equal(stored(id).tokenHash, crypto.createHash('sha256').update(token).digest('hex'));
    assert.equal(deliveries.length, 1);
  });
  await test('Duplicate submission reuses stored contract and notification exactly once', async () => {
    const result = await (await submitRoute(request('/api/submit-contract', form))).json();
    assert.equal(result.contractId, id); assert.equal(deliveries.length, 1);
    assert.equal(stored(id).tokenHash, crypto.createHash('sha256').update(token).digest('hex'));
  });
  await test('Forged/expired/extra-segment approval tokens cannot cause sends', async () => {
    const adapter = getBackendAdapter();
    for (const invalid of ['forged', token + '.extra', createApprovalToken(id, form, -1)]) {
      await assert.rejects(adapter.approveAndSendContract({ token: invalid, phase: 'prepare', updatedData: form }));
    }
    const response = await approveRoute(request('/api/approve-and-send', { token: 'forged', phase: 'send' }));
    assert.notEqual(response.status, 200); assert.equal(deliveries.length, 1);
  });
  await test('Review GET requires token and cannot send mail; stable contract number', async () => {
    assert.equal((await reviewRoute(new NextRequest('https://booking.fixture.com/api/review-contract'))).status, 401);
    const adapter = getBackendAdapter();
    const first = await adapter.reviewContract(token), second = await adapter.reviewContract(token);
    assert.equal(first.contractNumber, second.contractNumber); assert.equal(deliveries.length, 1);
  });
  await test('Partner network failure or absent settings registry never accepts fixture codes', async () => {
    const adapter = getBackendAdapter();
    transportFault = 'network';
    assert.equal((await adapter.validatePartnerCode('테스트짝꿍')).valid, false);
    transportFault = '';
    assert.equal((await adapter.validatePartnerCode('테스트짝꿍')).valid, false);
    assert.equal((await adapter.validatePartnerCode('registered-partner')).valid, false);
    await assert.rejects(adapter.submitContract({ formData: { ...form, partnerDiscount: true, partnerName: '테스트짝꿍' } }));
  });
  let prepared: any;
  await test('Oversized submission is rejected before backend side effects', async () => {
    const response = await submitRoute(request('/api/submit-contract', { ...form, requestNotes: 'x'.repeat(70000) }));
    assert.notEqual(response.status, 200); assert.equal(deliveries.length, 1);
  });
  await test('Representative edit freezes data, pricing, full terms and product once', async () => {
    prepared = await getBackendAdapter().approveAndSendContract({ token, phase: 'prepare', updatedData: { ...form, productId: 'standard', requestNotes: 'Representative special condition', manualAdjustment: { amount: -50000, reason: 'Approved adjustment' } } });
    assert.equal(prepared.snapshot.data.productId, 'standard');
    assert.equal(prepared.snapshot.pricing.contractTotal, 1250000);
    assert.equal(prepared.snapshot.terms.sections.length, 13);
    assert.equal(prepared.snapshotHash, snapshotBinding(prepared.snapshot));
    const again = await getBackendAdapter().approveAndSendContract({ token, phase: 'prepare', updatedData: prepared.snapshot.data });
    assert.equal(again.snapshotHash, prepared.snapshotHash);
  });
  await test('Old Review tab cannot overwrite a newer representative snapshot', async () => {
    const response = await approveRoute(request('/api/approve-and-send', { token, phase: 'prepare', expectedRevision: 1, updatedData: { ...form, requestNotes: 'Stale tab overwrite' } }));
    assert.notEqual(response.status, 200);
    assert.equal(stored(id).snapshot.data.requestNotes, 'Representative special condition');
  });
  await test('Immutable catalog cannot be edited; existing snapshot remains detached and stable', async () => {
    const product = PRODUCTS_CONFIG.find(item => item.id === 'standard')!;
    const saved = product.name;
    assert.equal(Object.isFrozen(product), true);
    assert.equal(Reflect.set(product, 'name', 'Edited catalog name'), false);
    const reviewed = await getBackendAdapter().reviewContract(token);
    assert.equal(reviewed.snapshot!.product!.name, prepared.snapshot.product.name);
    assert.equal(product.name, saved);
    assert.notEqual(reviewed.snapshot!.product, product);
    const catalog = fs.readFileSync('src/components/catalog/ProductCatalogView.tsx', 'utf8');
    assert.ok(catalog.includes('{product.originalCount}'));
    assert.ok(catalog.includes('product.additionalRetouchedCount'));
  });
  await test('Missing/malformed/unbound PDF fails before mail or file side effects', async () => {
    const before = files.size;
    for (const document of [undefined, 'broken', pdf('wrong-binding')]) {
      await assert.rejects(getBackendAdapter().approveAndSendContract({ token, phase: 'send', snapshotHash: prepared.snapshotHash, pdfBase64: document }));
    }
    assert.equal(deliveries.length, 1); assert.equal(files.size, before);
    validatePdf(pdf(prepared.snapshotHash), prepared.snapshotHash);
  });
  await test('Overflowing document dimensions fail before capture/send', () => {
    assertPageFits({ scrollHeight: 1123, clientHeight: 1123, scrollWidth: 793, clientWidth: 793 });
    assert.throws(() => assertPageFits({ scrollHeight: 1600, clientHeight: 1123, scrollWidth: 793, clientWidth: 793 }));
    assertPrintableBounds(1080, 1081);
    // Total A4 dimensions can pass while flex content enters the bottom print margin.
    assert.throws(() => assertPrintableBounds(1118, 1081));
    assert.throws(() => assertPrintableBounds(559, 540.5, 0.5));
  });
  await test('Stale snapshot or changed final payload cannot send', async () => {
    await assert.rejects(getBackendAdapter().approveAndSendContract({ token, phase: 'send', snapshotHash: 'wrong', pdfBase64: pdf(prepared.snapshotHash) }));
    await assert.rejects(getBackendAdapter().approveAndSendContract({ token, phase: 'send', snapshotHash: prepared.snapshotHash, updatedData: form, pdfBase64: pdf(prepared.snapshotHash) }));
    assert.equal(deliveries.length, 1);
  });
  await test('Drive failure blocks email and cannot claim saved document', async () => {
    driveFault = true;
    await assert.rejects(getBackendAdapter().approveAndSendContract({ token, phase: 'send', snapshotHash: prepared.snapshotHash, pdfBase64: pdf(prepared.snapshotHash) }));
    driveFault = false; assert.equal(deliveries.length, 1);
  });
  await test('Successful send attaches identical saved PDF to both parties and persists snapshot', async () => {
    const result = await getBackendAdapter().approveAndSendContract({ token, phase: 'send', snapshotHash: prepared.snapshotHash, pdfBase64: pdf(prepared.snapshotHash) });
    assert.equal(result.success, true); assert.equal(result.customerEmailSent, true); assert.equal(result.representativeEmailSent, true); assert.equal(result.driveSaved, true);
    assert.equal(deliveries.length, 3);
    assert.deepEqual(deliveries[1].options.attachments[0].getBytes(), deliveries[2].options.attachments[0].getBytes());
    assert.equal(stored(id).status, 'sent'); assert.equal(stored(id).snapshot.data.requestNotes, 'Representative special condition');
    assert.equal((await getBackendAdapter().reviewContract(token)).isAlreadySent, true);
  });
  await test('Replay after restart/new adapter sends zero extra mail', async () => {
    await assert.rejects(new GoogleAppsScriptAdapter(process.env.GAS_WEBAPP_URL!).approveAndSendContract({ token, phase: 'send', snapshotHash: prepared.snapshotHash, pdfBase64: pdf(prepared.snapshotHash) }));
    assert.equal(deliveries.length, 3);
  });
  await test('Lost submission acknowledgment recovers one receipt without duplicate notification', async () => {
    const another = { ...form, email: 'retry@example.com' };
    transportFault = 'lost-receipt';
    const failed = await submitRoute(request('/api/submit-contract', another));
    assert.notEqual(failed.status, 200);
    transportFault = '';
    const result = await (await submitRoute(request('/api/submit-contract', another))).json();
    assert.equal(result.success, true); assert.equal(deliveries.filter(mail => mail.options.htmlBody.includes('retry@example.com')).length, 1);
  });
  await test('Unknown customer delivery never becomes success or automatic duplicate retry', async () => {
    const another = { ...form, email: 'uncertain@example.com' };
    await getBackendAdapter().submitContract({ formData: another });
    const anotherToken = reviewToken();
    const preparedOther = await getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'prepare', updatedData: another });
    assert.ok(preparedOther.snapshotHash, 'Prepared contract requires a snapshot binding');
    emailFault = another.email;
    await assert.rejects(getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'send', snapshotHash: preparedOther.snapshotHash, pdfBase64: pdf(preparedOther.snapshotHash) }));
    emailFault = '';
    const afterFirst = deliveries.length;
    const again = await getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'prepare', updatedData: another });
    assert.equal(again.documentStored, true);
    await assert.rejects(getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'send', snapshotHash: again.snapshotHash }));
    assert.equal(deliveries.length, afterFirst);
  });
  await test('Known customer success + unsent representative resumes only remaining mail', async () => {
    const another = { ...form, email: 'partial@example.com' };
    await getBackendAdapter().submitContract({ formData: another });
    const anotherToken = reviewToken();
    const approved = await getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'prepare', updatedData: another });
    writeFault = value => value.representativeState === 'sending' && value.formData.email === another.email;
    await assert.rejects(getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64: pdf(approved.snapshotHash!) }));
    writeFault = undefined;
    const result = await getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'send', snapshotHash: approved.snapshotHash });
    assert.equal(result.success, true);
    assert.equal(deliveries.filter(mail => mail.to === another.email).length, 1);
  });
  await test('Email HTML injection is escaped and PDF includes accepted request details', async () => {
    const another = { ...form, groomName: '<img src=x onerror=alert(1)>', email: 'escape@example.com', requestNotes: '<script>alert(1)</script>' };
    await getBackendAdapter().submitContract({ formData: another });
    const mail = deliveries[deliveries.length - 1].options.htmlBody;
    assert.equal(mail.includes('<img src=x'), false); assert.equal(mail.includes('<script>'), false);
    assert.equal(mail.includes('&lt;script&gt;'), true);
    const source = fs.readFileSync('src/components/pdf/ContractDocument.tsx', 'utf8');
    assert.ok(source.includes('data.requestNotes')); assert.ok(source.includes('getContractPolicy(snapshot)')); assert.ok(source.includes('계약번호: {contractNumber}'));
  });
  await test('Signed GAS request replay is rejected', () => {
    const timestamp = Date.now(), nonce = crypto.randomUUID(), action = 'find_contract', payloadJson = JSON.stringify({ contractId: id, studioId: getStudioConfig().studioId });
    const signature = crypto.createHmac('sha256', secret).update(timestamp + '\n' + nonce + '\n' + action + '\n' + payloadJson).digest('hex');
    const envelope = { timestamp, nonce, action, payloadJson, signature };
    assert.equal(gas(envelope).success, true); assert.equal(gas(envelope).success, false);
    assert.equal(gas({ ...envelope, nonce: crypto.randomUUID(), payloadJson: '{}' }).success, false);
  });
  await test('Changing a compatibility discount copy cannot alter canonical pricing or mail', () => {
    const item = DISCOUNTS_CONFIG.find(value => value.id === 'sunday')!;
    const saved = item.amount; item.amount = 70000;
    const price = calculateContractPrice(form);
    const mail = generateRepresentativeNotificationEmail(form, price, 'https://booking.fixture.com/review');
    assert.ok(mail.html.includes('-100,000원')); assert.ok(!mail.html.includes('-70,000원'));
    item.amount = saved;
  });
  await test('Internal family/SNS notes stay out of customer PDF/mail', () => {
    const customer = generateCustomerContractEmail({ ...form, groomFamilyMembers: 'INTERNAL_FAMILY_MARKER', instagramId: 'INTERNAL_SNS_MARKER' }, calculateContractPrice(form), 'DM-TEST');
    assert.ok(!customer.html.includes('INTERNAL_FAMILY_MARKER')); assert.ok(!customer.html.includes('INTERNAL_SNS_MARKER'));
    const doc = fs.readFileSync('src/components/pdf/ContractDocument.tsx', 'utf8');
    assert.ok(!doc.includes("['신랑 가족'")); assert.ok(!doc.includes("['인스타그램'"));
  });
  await test('Unknown representative delivery does not resend the successful customer mail', async () => {
    const another = { ...form, email: 'rep-uncertain@example.com' };
    await getBackendAdapter().submitContract({ formData: another });
    const anotherToken = reviewToken();
    const approved = await getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'prepare', updatedData: another });
    emailFault = process.env.REPRESENTATIVE_EMAIL!;
    await assert.rejects(getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64: pdf(approved.snapshotHash!) }));
    emailFault = '';
    await assert.rejects(getBackendAdapter().approveAndSendContract({ token: anotherToken, phase: 'send', snapshotHash: approved.snapshotHash }));
    assert.equal(deliveries.filter(mail => mail.to === another.email).length, 1);
  });
  await test('Cross-origin submission is rejected', async () => {
    const foreign = new NextRequest('https://booking.fixture.com/api/submit-contract', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.example' }, body: JSON.stringify(form) });
    assert.notEqual((await submitRoute(foreign)).status, 200);
  });
  console.log('Production hardening: ' + passed + '/' + passed + ' passed; live network/Gmail/Drive/Sheets calls: 0');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { globalThis.fetch = originalFetch; });
