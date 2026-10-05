import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { installGasHarness } from './test-support/gasHarness';
import { expiredToken } from './test-support/expiredToken';
import { getStudioConfig, getDefaultProductId, getDiscountAmount, getContractPolicy, getClientContent, getFormSchema } from '../src/services/configuration';
import { canonicalForm } from '../src/lib/contractValidation';
import { createSnapshot, snapshotBinding } from '../src/lib/contractWorkflow';
import { createApprovalToken, verifyApprovalToken } from '../src/lib/token';
import { getConfiguredFieldErrors } from '../src/lib/formFields';
import { generateCustomerContractEmail, generateRepresentativeSentConfirmationEmail } from '../src/lib/emailTemplates';
import { ContractDocument } from '../src/components/pdf/ContractDocument';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { GET as review } from '../src/app/api/review-contract/route';
import type { ContractFormData } from '../src/types/contract';

const h = installGasHarness({ partnerAmount: getDiscountAmount('partner') });
Object.assign(process.env, { APP_URL: 'https://booking.fixture.com' });
const studio = getStudioConfig();
const base: ContractFormData = { ...h.form, productId: getDefaultProductId(), optionIds: [],
  partnerDiscount: false, portfolioConsent: false, reviewContractCashback: false, reviewMainCashback: false,
  shootRequestNotes: 'Red team shoot note', retouchRequestNotes: '', referralSource: getClientContent().referralOptions[0] };
const results: { name: string; status: 'passed' | 'failed'; error?: string }[] = [];
const artifacts = path.resolve(process.env.RED_TEAM_ARTIFACT_DIR || '.contract-test-output/red-team');
fs.mkdirSync(artifacts, { recursive: true });
const get = (token?: string) => review(new NextRequest('https://booking.fixture.com/api/review-contract' + (token ? '?token=' + encodeURIComponent(token) : '')));
async function reject(response: Response) { assert.notEqual(response.status, 200); assert.equal((await response.json()).success, false); }
async function test(name: string, work: () => unknown | Promise<unknown>) {
  try { await work(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'failed', error: String(error) }); console.error('FAIL ' + name + ': ' + String(error)); }
  finally { h.transport(''); h.emailFailure(''); h.driveFailure(false); h.lockFailure(false); }
}
async function receipt(email: string) {
  const response = await submit(h.request('/api/submit-contract', { ...base, email }));
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result));
  const token = h.reviewToken(); return { id: result.contractId as string, token };
}
async function prepare(contract: { token: string }) {
  const response = await approve(h.request('/api/approve-and-send', { token: contract.token, phase: 'prepare', expectedRevision: 1 }));
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
}
const attachmentCount = (email: string) => h.deliveries.filter(mail => mail.to === email && mail.options.attachments).length;
function mutate(id: string, edit: (record: any) => void) {
  const file = [...h.files.values()].find(file => file.name === id + '.json')!;
  const record = JSON.parse(file.bytes.toString('utf8')); edit(record); file.bytes = Buffer.from(JSON.stringify(record));
}
function signedToken(payload: Record<string, unknown>) {
  const key = crypto.createHash('sha256').update(process.env.APP_SECRET!).digest();
  const iv = crypto.randomBytes(16), cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encoded = Buffer.concat([iv, cipher.update(JSON.stringify(payload)), cipher.final()]).toString('base64url');
  return encoded + '.' + crypto.createHmac('sha256', key).update(encoded).digest('base64url');
}
async function main() {
  await test('Customer malformed email/phone/date/time and body shape cause no durable receipt/mail', async () => {
    const before = h.deliveries.length;
    for (const patch of [{ email: 'not-email' }, { email: 'x@example.com\r\nBcc: attacker@example.com' },
      { groomPhone: '--------' }, { groomPhone: '1234567' }, { groomPhone: 'abc01012345678' },
      { weddingDate: '2027-02-30' }, { weddingDate: '2027-13-01' }, { weddingDate: '2027-2-1' },
      { weddingTime: '24:00' }, { optionIds: ['foreign-option'] }, { productId: 'foreign-product' }]) {
      await reject(await submit(h.request('/api/submit-contract', { ...base, ...patch })));
    }
    for (const body of [null, [], 'text']) await reject(await submit(h.request('/api/submit-contract', body)));
    assert.equal(h.deliveries.length, before);
    assert.ok(getConfiguredFieldErrors({ ...base, groomPhone: '--------' }).groomPhone);
    assert.equal(canonicalForm({ ...base, groomPhone: '+82 (10) 1234-5678' }).groomPhone, '+82 (10) 1234-5678');
  });
  await test('Double Submit + retry uses one durable ID/canonical payload/token hash/notification', async () => {
    const email = 'red-double@example.com'; const before = h.deliveries.length;
    const requests = await Promise.all([submit(h.request('/api/submit-contract', { ...base, email })), submit(h.request('/api/submit-contract', { ...base, email }))]);
    const values = await Promise.all(requests.map(response => response.json()));
    assert.equal(values[0].success, true); assert.equal(values[1].success, true); assert.equal(values[0].contractId, values[1].contractId);
    assert.equal(h.deliveries.length, before + 1);
    const record = h.stored(values[0].contractId); assert.equal(record.studio.studioId, studio.studioId);
    const again = await submit(h.request('/api/submit-contract', { ...base, email })); assert.equal((await again.json()).contractId, record.contractId);
    assert.equal(h.deliveries.length, before + 1); assert.deepEqual(h.stored(record.contractId), record);
  });
  await test('Small authenticated token contains no customer data even with longest accepted notes', () => {
    const token = createApprovalToken('cnt_token_privacy', { ...base, requestNotes: '고객'.repeat(1000) });
    assert.ok(token.length < 512); const decoded = verifyApprovalToken(token);
    assert.equal(decoded.data, undefined); assert.equal(decoded.studioId, studio.studioId);
    assert.ok(!token.includes(base.email)); assert.ok(!JSON.stringify(decoded).includes(base.groomName));
  });
  await test('Tampered signature/modified encrypted payload/expired/missing/foreign-studio tokens blocked', async () => {
    const contract = await receipt('red-token@example.com'); const before = h.deliveries.length;
    const now = Date.now();
    const tokens = [undefined, contract.token.slice(0, -1) + (contract.token.endsWith('A') ? 'B' : 'A'),
      (contract.token.startsWith('X') ? 'Y' : 'X') + contract.token.slice(1), expiredToken(contract.id, base),
      signedToken({ contractId: contract.id, studioId: 'another-studio', iat: now, exp: now + 10000 })];
    for (const token of tokens) { await reject(await get(token)); await reject(await approve(h.request('/api/approve-and-send', { token, phase: 'prepare' }))); }
    assert.equal(h.deliveries.length, before);
  });
  await test('Scanner GET repeatedly opens Review without state transition or mail', async () => {
    const contract = await receipt('red-scanner@example.com'); const before = JSON.stringify(h.stored(contract.id));
    const count = h.deliveries.length;
    for (let i = 0; i < 3; i++) {
      const response = await get(contract.token); assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    }
    assert.equal(JSON.stringify(h.stored(contract.id)), before); assert.equal(h.deliveries.length, count);
  });
  await test('Foreign snapshot/logo/product and missing owner metadata cannot render another studio', () => {
    const snapshot = createSnapshot('cnt_foreign', studio.contractPrefix + '-20270418-TEST', canonicalForm(base));
    const foreign = structuredClone(snapshot); foreign.studio!.studioId = 'another-studio'; foreign.studio!.logo = 'https://foreign.example/logo.png';
    assert.throws(() => getStudioConfig(foreign), /다른 업체/);
    assert.throws(() => renderToStaticMarkup(React.createElement(ContractDocument, { data: foreign.data, pricing: foreign.pricing, snapshot: foreign })), /다른 업체/);
    assert.throws(() => generateCustomerContractEmail(foreign.data, foreign.pricing, foreign.contractNumber, foreign), /다른 업체/);
    if (studio.contractPrefix === 'MS') {
      const old = { ...snapshot, studio: undefined, terms: undefined, content: undefined, formSchema: undefined, discounts: undefined };
      assert.throws(() => getStudioConfig(old), /다른 업체/);
    }
  });
  await test('Stored foreign studio/wrong prefix/changed policy rejects access or final preparation', async () => {
    for (const [label, edit] of [
      ['owner', (r: any) => { r.studio.studioId = 'another-studio'; }],
      ['prefix', (r: any) => { r.contractNumber = 'FOREIGN-20270418-TEST'; }],
      ['policy', (r: any) => { r.configurationHash = 'changed-policy'; }],
      ['missing-policy', (r: any) => { delete r.configurationHash; }],
    ] as const) {
      const contract = await receipt('red-' + label + '@example.com'); mutate(contract.id, edit);
      const response = await get(contract.token); await reject(response);
      await reject(await approve(h.request('/api/approve-and-send', { token: contract.token, phase: 'prepare' })));
      assert.equal(attachmentCount('red-' + label + '@example.com'), 0);
    }
  });
  await test('Manual adjustment allowed only for representative; signed totals/deposit/balance remain exact', async () => {
    for (const amount of [-50000, 70000]) {
      const data = canonicalForm({ ...base, manualAdjustment: { amount, reason: 'Red team agreed adjustment' } }, true);
      const snap = createSnapshot('cnt_adjust_' + Math.abs(amount), studio.contractPrefix + '-20270418-TEST', data);
      const original = createSnapshot('cnt_base', studio.contractPrefix + '-20270418-TEST', canonicalForm(base));
      assert.equal(snap.pricing.contractTotal, original.pricing.contractTotal + amount);
      assert.equal(snap.pricing.balanceAmount, snap.pricing.contractTotal - getContractPolicy().deposit.amount);
      assert.equal(snap.pricing.futureCashbackTotal, 0);
      await reject(await submit(h.request('/api/submit-contract', { ...base, manualAdjustment: { amount, reason: 'forged customer adjustment' } })));
    }
    assert.throws(() => canonicalForm({ ...base, manualAdjustment: { amount: -10000000, reason: 'below deposit' } }, true));
  });
  for (const fault of ['network', 'http500', 'malformed', 'malformed-object', 'reject', 'timeout'] as const) {
    await test('Backend ' + fault + ': Submit/Review/Prepare/Send cannot display success or use mock partner code', async () => {
      const contract = await receipt('red-backend-' + fault + '@example.com'); const prep = await prepare(contract);
      const before = h.deliveries.length; h.transport(fault);
      const originalTimeout = AbortSignal.timeout;
      if (fault === 'timeout') AbortSignal.timeout = (duration: number) => { assert.equal(duration, 25000); return originalTimeout(20); };
      try {
        await reject(await submit(h.request('/api/submit-contract', { ...base, email: 'red-failure-' + fault + '@example.com' })));
        await reject(await get(contract.token));
        await reject(await approve(h.request('/api/approve-and-send', { token: contract.token, phase: 'prepare' })));
        await reject(await approve(h.request('/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: prep.snapshotHash, pdfBase64: h.pdf(prep.snapshotHash) })));
        await reject(await submit(h.request('/api/submit-contract', { ...base, email: 'red-partner-' + fault + '@example.com', partnerDiscount: true, partnerName: '테스트짝꿍' })));
      } finally { AbortSignal.timeout = originalTimeout; }
      assert.equal(h.deliveries.length, before);
    });
  }
  await test('Lock contention/Drive write failure cannot commit receipt or trigger mail', async () => {
    const before = h.deliveries.length;
    h.lockFailure(true); await reject(await submit(h.request('/api/submit-contract', { ...base, email: 'red-busy@example.com' })));
    h.lockFailure(false); h.driveFailure(true); await reject(await submit(h.request('/api/submit-contract', { ...base, email: 'red-drive@example.com' })));
    assert.equal(h.deliveries.length, before);
  });
  await test('Duplicate Final POST and response loss after actual send do not resend either party', async () => {
    const email = 'red-send-disconnect@example.com'; const contract = await receipt(email); const prep = await prepare(contract);
    const request = { token: contract.token, phase: 'send', snapshotHash: prep.snapshotHash, pdfBase64: h.pdf(prep.snapshotHash) };
    h.transport('disconnect-send'); await reject(await approve(h.request('/api/approve-and-send', request)));
    assert.equal(h.stored(contract.id).status, 'sent'); assert.equal(attachmentCount(email), 1);
    h.transport(''); const before = h.deliveries.length;
    for (const response of await Promise.all([approve(h.request('/api/approve-and-send', request)), approve(h.request('/api/approve-and-send', request))])) await reject(response);
    assert.equal(h.deliveries.length, before); assert.equal((await (await get(contract.token)).json()).isAlreadySent, true);
  });
  for (const recipient of ['customer', 'representative'] as const) {
    await test('Uncertain ' + recipient + ' email: no final success and no duplicate successful customer delivery', async () => {
      const email = 'red-mail-' + recipient + '@example.com'; const contract = await receipt(email); const prep = await prepare(contract);
      h.emailFailure(recipient === 'customer' ? email : process.env.REPRESENTATIVE_EMAIL!);
      const request = { token: contract.token, phase: 'send', snapshotHash: prep.snapshotHash, pdfBase64: h.pdf(prep.snapshotHash) };
      await reject(await approve(h.request('/api/approve-and-send', request)));
      const count = h.deliveries.length; await reject(await approve(h.request('/api/approve-and-send', request)));
      assert.equal(h.deliveries.length, count); assert.notEqual(h.stored(contract.id).status, 'sent');
      assert.equal(attachmentCount(email), 1);
      assert.equal(h.stored(contract.id).customerState, recipient === 'customer' ? 'unknown' : 'sent');
    });
  }
  await test('Previously successful representative copy + customer failure: partial state never reports full success/replays copy', async () => {
    const email = 'red-representative-first@example.com'; const contract = await receipt(email); const prep = await prepare(contract);
    h.representativeFirst(contract.id, generateRepresentativeSentConfirmationEmail(prep.snapshot.data, prep.snapshot.pricing, prep.snapshot.contractNumber, prep.snapshot));
    assert.equal(h.stored(contract.id).representativeState, 'sent'); h.emailFailure(email);
    const request = { token: contract.token, phase: 'send', snapshotHash: prep.snapshotHash, pdfBase64: h.pdf(prep.snapshotHash) };
    await reject(await approve(h.request('/api/approve-and-send', request))); const count = h.deliveries.length;
    await reject(await approve(h.request('/api/approve-and-send', request))); assert.equal(h.deliveries.length, count);
    assert.equal(h.stored(contract.id).representativeState, 'sent'); assert.equal(h.stored(contract.id).customerState, 'unknown');
  });
  await test('Missing/malformed/stale-bound PDF cannot cause email or false final success', async () => {
    const contract = await receipt('red-pdf@example.com'); const prep = await prepare(contract); const before = h.deliveries.length;
    for (const pdfBase64 of [undefined, 'not-pdf', h.pdf('other-snapshot')]) {
      await reject(await approve(h.request('/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: prep.snapshotHash, pdfBase64 })));
    }
    assert.equal(h.deliveries.length, before);
  });
  await test('Cross-site/oversized body/secret missing/runtime demo requests fail closed', async () => {
    await reject(await submit(new NextRequest('https://booking.fixture.com/api/submit-contract', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.invalid' }, body: JSON.stringify(base) })));
    await reject(await submit(h.request('/api/submit-contract', { ...base, requestNotes: 'X'.repeat(70000) })));
    for (const key of ['APP_SECRET', 'GAS_WEBAPP_URL', 'GAS_SHARED_SECRET', 'REPRESENTATIVE_EMAIL']) {
      const value = process.env[key]; delete process.env[key];
      try { const response = await submit(h.request('/api/submit-contract', base)); assert.equal(response.status, 503); await reject(response); }
      finally { process.env[key] = value; }
    }
    process.env.BACKEND_MODE = 'demo';
    try { const response = await submit(h.request('/api/submit-contract', base)); assert.equal(response.status, 503); await reject(response); }
    finally { process.env.BACKEND_MODE = 'gas'; }
  });
  await test('XSS/email injection escaped; private preparation notes stay out of customer email', () => {
    const data = canonicalForm({ ...base, groomName: '<img src=x onerror=alert(1)>', shootRequestNotes: '<script>alert(2)</script>',
      groomFamilyMembers: 'PRIVATE-FAMILY-MARKER', instagramId: 'PRIVATE-SOCIAL-MARKER' });
    const snap = createSnapshot('cnt_xss', studio.contractPrefix + '-20270418-TEST', data);
    const html = generateCustomerContractEmail(data, snap.pricing, snap.contractNumber, snap).html;
    assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img src=x')); assert.ok(html.includes('&lt;'));
    assert.ok(!html.includes('PRIVATE-FAMILY-MARKER')); assert.ok(!html.includes('PRIVATE-SOCIAL-MARKER'));
    const dom = renderToStaticMarkup(React.createElement(ContractDocument, { data, pricing: snap.pricing, snapshot: snap }));
    assert.ok(!dom.includes('<script>')); assert.ok(dom.includes('&lt;script&gt;'));
  });
  await test('Long accepted notes preserve all multiline content through bounded PDF detail pages', () => {
    const note = Array.from({ length: 100 }, (_, i) => '촬영 요청 ' + i).join('\n');
    const data = canonicalForm({ ...base, shootRequestNotes: note });
    const snap = createSnapshot('cnt_long_notes', studio.contractPrefix + '-20270418-TEST', data);
    const dom = renderToStaticMarkup(React.createElement(ContractDocument, { data, pricing: snap.pricing, snapshot: snap }));
    assert.ok(dom.includes('촬영 요청 99')); assert.ok((dom.match(/data-pdf-page=/g) || []).length >= 5);
    assert.equal(snapshotBinding(snap), snapshotBinding(structuredClone(snap)));
  });
}
main().catch(error => { results.push({ name: 'suite setup', status: 'failed', error: String(error) }); console.error(error); }).finally(() => {
  h.restore(); const passed = results.filter(result => result.status === 'passed').length;
  fs.writeFileSync(path.join(artifacts, 'red-team-results.json'), JSON.stringify({ studio: studio.studioId, results, passed, failed: results.length - passed,
    realGoogleIO: false, timeoutTest: 'Actual AbortSignal cancellation accelerated to 20ms; configured deadline asserted at 25000ms',
    concurrency: 'Concurrent route handlers and serial in-memory GAS I/O; real distributed lock behavior needs deployment verification' }, null, 2));
  console.log('Red team: ' + passed + '/' + results.length + ' passed'); if (passed !== results.length) process.exitCode = 1;
});
