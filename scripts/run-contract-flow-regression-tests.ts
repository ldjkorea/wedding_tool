import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { PRODUCTS_CONFIG } from '../src/config/products';
import { OPTIONS_CONFIG } from '../src/config/options';
import { DISCOUNTS_CONFIG } from '../src/config/discounts';
import { calculateContractPrice } from '../src/lib/pricing';
import { canonicalForm } from '../src/lib/contractValidation';
import { expiredToken } from './test-support/expiredToken';
import { snapshotBinding, createSnapshot } from '../src/lib/contractWorkflow';
import { generateCustomerContractEmail, generateRepresentativeSentConfirmationEmail } from '../src/lib/emailTemplates';
import { ContractDocument } from '../src/components/pdf/ContractDocument';
import { ProductSelectSection } from '../src/components/contract-form/ProductSelectSection';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { GET as review } from '../src/app/api/review-contract/route';
import type { ContractFormData } from '../src/types/contract';

const h = installGasHarness();
const results: { name: string; status: 'passed' | 'failed'; error?: string }[] = [];
let matrixCount = 0;
async function test(name: string, work: () => unknown | Promise<unknown>) {
  try { await work(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); }
  catch (error) {
    results.push({ name, status: 'failed', error: String(error) });
    console.error('FAIL ' + name, error);
  }
}
const base: ContractFormData = { ...h.form, productId: 'standard', optionIds: [],
  weddingDate: '2027-04-17', sundayDiscount: false, portfolioConsent: false,
  reviewContractCashback: false, reviewMainCashback: false };
const post = (handler: typeof submit | typeof approve, path: string, data: unknown) => handler(h.request(path, data));
const get = (token?: string) => review(new NextRequest('https://booking.fixture.com/api/review-contract' + (token === undefined ? '' : '?token=' + encodeURIComponent(token))));
async function accepted(data: ContractFormData) {
  const response = await post(submit, '/api/submit-contract', data);
  const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.success, true);
  const record = h.stored(result.contractId);
  const notification = h.deliveries.find(mail => mail.options.htmlBody.includes(data.email) && !mail.options.attachments);
  assert.ok(notification);
  const token = new URL(notification.options.htmlBody.match(/href="([^"]+)"/)[1]).searchParams.get('token')!;
  return { id: result.contractId as string, token, record };
}
async function prepared(token: string, data: ContractFormData, expectedRevision = 1) {
  const response = await post(approve, '/api/approve-and-send', { token, phase: 'prepare', expectedRevision, updatedData: data });
  const result = await response.json();
  assert.equal(response.status, 200, result.error); assert.equal(result.success, true);
  return result;
}
async function rejected(response: Response) {
  assert.notEqual(response.status, 200);
  const result = await response.json();
  assert.equal(result.success, false);
  return result;
}
const finalMail = (email: string) => h.deliveries.filter(mail => mail.to === email && mail.options.attachments);

async function main() {
  await test('Current policy: exact product/option/discount amounts; removed makeup option rejected', () => {
    assert.deepEqual(PRODUCTS_CONFIG.filter(item => item.active).map(item => [item.id, item.basePrice]), [['standard', 1250000], ['album_plus', 1450000]]);
    assert.deepEqual(OPTIONS_CONFIG.filter(item => item.active).map(item => [item.id, item.price]), [['second_shooter', 250000], ['pyebaek', 100000]]);
    assert.deepEqual(DISCOUNTS_CONFIG.map(item => [item.id, item.amount, item.isImmediate]), [
      ['sunday', 100000, true], ['partner', 50000, true], ['portfolio', 100000, true],
      ['review_contract', 50000, false], ['review_main', 50000, false],
    ]);
    assert.throws(() => canonicalForm({ ...base, optionIds: ['makeup_scene'] }), /옵션/);
    const product = PRODUCTS_CONFIG.find(item => item.id === 'album_plus')!;
    const original = { couple: product.coupleAlbumSummary, parent: product.parentAlbumSummary };
    try {
      product.coupleAlbumSummary = 'Fixture couple album from catalog';
      product.parentAlbumSummary = 'Fixture parent albums from catalog';
      const html = renderToStaticMarkup(React.createElement(ProductSelectSection, { selectedProductId: product.id, onSelect: () => {} }));
      assert.ok(html.includes(product.coupleAlbumSummary)); assert.ok(html.includes(product.parentAlbumSummary));
    } finally { product.coupleAlbumSummary = original.couple; product.parentAlbumSummary = original.parent; }
  });
  await test('Minimal contract API: omitted preparation/marketing accepted, core identity/consent still required', async () => {
    const omitted = Object.fromEntries(Object.entries({ ...base, email: 'minimal-api-policy@example.com' }).filter(([key]) => ![
      'makeupLocation', 'groomFamilyMembers', 'brideFamilyMembers', 'shootRequestNotes', 'retouchRequestNotes',
      'requestNotes', 'referralSource', 'instagramId', 'blogUrl',
    ].includes(key)));
    const response = await post(submit, '/api/submit-contract', omitted), result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.success, true);
    const record = h.stored(result.contractId);
    assert.equal(record.pricing.contractTotal, 1250000);
    assert.equal(record.formData.makeupLocation, ''); assert.equal(record.formData.shootRequestNotes, '');
    for (const field of ['weddingDate', 'weddingTime', 'weddingVenue', 'weddingHall', 'groomName', 'groomPhone', 'brideName', 'bridePhone', 'email', 'productId']) {
      assert.throws(() => canonicalForm({ ...omitted, [field]: '' }), /필수/);
    }
    assert.throws(() => canonicalForm({ ...omitted, termsAgreed: false }), /약관/);
  });
  await test('Pricing: all 256 combinations assert total/deposit/balance/cashback independently', () => {
    // Deliberately fixed approval baseline, independent of production config helpers.
    // A deliberate company policy change must also update this reviewed expectation.
    const bases = { standard: 1250000, album_plus: 1450000 };
    const options = { second_shooter: 250000, pyebaek: 100000 };
    for (const productId of ['standard', 'album_plus'] as const)
    for (const optionIds of [[], ['second_shooter'], ['pyebaek'], ['second_shooter', 'pyebaek']])
    for (const sunday of [false, true])
    for (const partnerDiscount of [false, true])
    for (const portfolioConsent of [false, true])
    for (const reviewContractCashback of [false, true])
    for (const reviewMainCashback of [false, true]) {
      const data = { ...base, productId, optionIds, weddingDate: sunday ? '2027-04-18' : '2027-04-17',
        partnerDiscount, partnerName: partnerDiscount ? 'registered-partner' : '', portfolioConsent,
        reviewContractCashback, reviewMainCashback };
      const canonical = canonicalForm(data);
      const actual = calculateContractPrice(canonical);
      const total = bases[productId] + optionIds.reduce((sum, id) => sum + options[id as keyof typeof options], 0)
        - (sunday ? 100000 : 0) - (partnerDiscount ? 50000 : 0) - (portfolioConsent ? 100000 : 0);
      const label = JSON.stringify(data);
      assert.equal(actual.contractTotal, total, label);
      assert.equal(actual.depositAmount, 300000, label);
      assert.equal(actual.balanceAmount, total - 300000, label);
      assert.equal(actual.futureCashbackTotal, (Number(reviewContractCashback) + Number(reviewMainCashback)) * 50000, label);
      const withoutCashback = calculateContractPrice({ ...canonical, reviewContractCashback: false, reviewMainCashback: false });
      assert.equal(actual.contractTotal, withoutCashback.contractTotal, 'Cashback must never reduce contract total: ' + label);
      assert.equal(actual.depositAmount, withoutCashback.depositAmount);
      assert.equal(actual.balanceAmount, withoutCashback.balanceAmount);
      const snapshot = createSnapshot('cnt_pricing_' + matrixCount, 'FLOW-PRICING-' + matrixCount, canonical);
      assert.deepEqual(snapshot.pricing, actual, 'Saved snapshot must preserve all four price values');
      const document = renderToStaticMarkup(React.createElement(ContractDocument, {
        data: snapshot.data, pricing: snapshot.pricing, contractNumber: snapshot.contractNumber, snapshot,
      }));
      const customer = generateCustomerContractEmail(snapshot.data, snapshot.pricing, snapshot.contractNumber, snapshot).html;
      const representative = generateRepresentativeSentConfirmationEmail(snapshot.data, snapshot.pricing, snapshot.contractNumber, snapshot).html;
      for (const html of [document, customer, representative]) {
        assert.ok(html.includes(total.toLocaleString('ko-KR')), 'Document/email contract total: ' + label);
        assert.ok(html.includes(snapshot.product!.name), 'Document/email product: ' + label);
      }
      assert.ok(!document.includes('잔금에서 차감 또는'), 'PDF must describe cashback as a future benefit');
      assert.ok(!/<\/tr>\s*0\s*<tr/.test(document), 'No manual adjustment must not render a stray zero in the pricing table');
      for (const html of [document, customer]) {
        assert.ok(html.includes('300,000'), 'Document/email deposit: ' + label);
        assert.ok(html.includes((total - 300000).toLocaleString('ko-KR')), 'Document/email balance: ' + label);
      }
      matrixCount++;
    }
    assert.equal(matrixCount, 256);
  });
  await test('Date: Saturday/Sunday remain correct in four fresh timezone processes', () => {
    for (const TZ of ['UTC', 'Asia/Seoul', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      const child = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/test-support/timezoneProbe.ts'], {
        env: { ...process.env, TZ, FLOW_DATE_FIXTURE: JSON.stringify(base) }, encoding: 'utf8', timeout: 30000, windowsHide: true,
      });
      assert.equal(child.status, 0, child.stdout + child.stderr);
      console.log(child.stdout.trim());
    }
  });
  await test('API: concurrent identical Submit retries preserve one ID/token/payload/notification', async () => {
    const data = { ...base, email: 'duplicate-submit@example.com', productId: 'album_plus', optionIds: ['pyebaek', 'second_shooter'] };
    const replies = await Promise.all(Array.from({ length: 4 }, () => post(submit, '/api/submit-contract', data)));
    const values = await Promise.all(replies.map(response => response.json()));
    assert.ok(replies.every(response => response.status === 200));
    assert.ok(values.every(value => value.success && value.contractId === values[0].contractId));
    assert.equal([...h.files.values()].filter(file => file.name === values[0].contractId + '.json').length, 1);
    const record = h.stored(values[0].contractId);
    const tokenHash = record.tokenHash;
    const again = await post(submit, '/api/submit-contract', { ...data, optionIds: [...data.optionIds].reverse() });
    assert.equal((await again.json()).contractId, values[0].contractId);
    assert.equal(h.stored(values[0].contractId).tokenHash, tokenHash);
    assert.deepEqual(record.formData, canonicalForm(data));
    assert.equal(h.deliveries.filter(mail => mail.options.htmlBody.includes(data.email)).length, 1);
    assert.equal(finalMail(data.email).length, 0);
  });
  await test('Review API GET: repeated scanner-style reads are side-effect free', async () => {
    const contract = await accepted({ ...base, email: 'get-safe@example.com' });
    const beforeMail = h.deliveries.length;
    const beforeRecord = JSON.stringify(h.stored(contract.id));
    for (let i = 0; i < 5; i++) {
      const response = await get(contract.token);
      const result = await response.json();
      assert.equal(response.status, 200); assert.equal(result.contractId, contract.id);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(result.isAlreadySent, false);
    }
    assert.equal(h.deliveries.length, beforeMail);
    assert.equal(JSON.stringify(h.stored(contract.id)), beforeRecord);
  });
  await test('Token: missing, invalid signature, modified encrypted payload and expired block both APIs', async () => {
    const contract = await accepted({ ...base, email: 'token-safe@example.com' });
    const [payload, signature] = contract.token.split('.');
    const flip = (value: string) => (value[0] === 'A' ? 'B' : 'A') + value.slice(1);
    const tokens = [undefined, payload + '.' + flip(signature), flip(payload) + '.' + signature,
      expiredToken(contract.id, base)];
    const beforeMail = h.deliveries.length;
    const beforeRecord = JSON.stringify(h.stored(contract.id));
    for (const token of tokens) {
      await rejected(await get(token));
      await rejected(await post(approve, '/api/approve-and-send', { token, phase: 'prepare', expectedRevision: 1, updatedData: base }));
      await rejected(await post(approve, '/api/approve-and-send', { token, phase: 'send', snapshotHash: 'invalid', pdfBase64: h.pdf('invalid') }));
    }
    assert.equal(h.deliveries.length, beforeMail);
    assert.equal(JSON.stringify(h.stored(contract.id)), beforeRecord);
  });
  await test('Review edit: actual ContractDocument HTML and final emails use only standard snapshot', async () => {
    const submitted = { ...base, email: 'edit-standard@example.com', productId: 'album_plus',
      optionIds: ['second_shooter', 'pyebaek'], reviewContractCashback: true, reviewMainCashback: true };
    const contract = await accepted(submitted);
    const initial = await (await get(contract.token)).json();
    assert.equal(initial.data.productId, 'album_plus');
    const edited = { ...submitted, productId: 'standard', requestNotes: 'Approved standard only' };
    const approved = await prepared(contract.token, edited);
    assert.equal(approved.snapshot.id, contract.id);
    assert.equal(approved.snapshot.contractNumber, initial.contractNumber);
    assert.equal(approved.snapshotHash, snapshotBinding(approved.snapshot));
    assert.deepEqual(approved.snapshot.data, canonicalForm(edited, true));
    const price = approved.snapshot.pricing;
    assert.equal(price.contractTotal, 1600000); assert.equal(price.depositAmount, 300000);
    assert.equal(price.balanceAmount, 1300000); assert.equal(price.futureCashbackTotal, 100000);
    const html = renderToStaticMarkup(React.createElement(ContractDocument, { data: approved.snapshot.data, pricing: price,
      contractNumber: approved.contractNumber, snapshot: approved.snapshot }));
    assert.ok(html.includes('실속형')); assert.ok(!html.includes('화보형'));
    assert.ok(html.includes(approved.contractNumber)); assert.ok(html.includes('Approved standard only'));
    const generated = h.pdf(approved.snapshotHash); // Transport fixture; real raster PDF tested separately in browser suite.
    const sentResponse = await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64: generated });
    const sent = await sentResponse.json();
    assert.equal(sentResponse.status, 200); assert.equal(sent.success, true);
    assert.equal(sent.snapshot.id, contract.id); assert.equal(sent.contractNumber, initial.contractNumber);
    assert.equal(sent.snapshotHash ?? snapshotBinding(sent.snapshot), approved.snapshotHash);
    assert.deepEqual(sent.snapshot.data, approved.snapshot.data);
    assert.deepEqual(sent.snapshot.pricing, price);
    const customer = finalMail(submitted.email);
    assert.equal(customer.length, 1);
    const finalMessages = h.deliveries.filter(mail => mail.options.attachments && mail.options.htmlBody.includes(sent.contractNumber));
    assert.equal(finalMessages.length, 2);
    for (const mail of finalMessages) {
      assert.ok(mail.options.htmlBody.includes('실속형'));
      assert.ok(!mail.options.htmlBody.includes('화보형'));
      assert.ok(mail.options.htmlBody.includes('1,600,000'));
      assert.deepEqual(mail.options.attachments[0].getBytes(), Buffer.from(generated.split(',')[1], 'base64').toJSON().data);
    }
    const saved = [...h.files.values()].find(file => file.id === h.stored(contract.id).pdfFileId)!;
    assert.deepEqual(saved.bytes, Buffer.from(generated.split(',')[1], 'base64'));
    const after = h.deliveries.length;
    for (let i = 0; i < 3; i++) {
      await rejected(await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64: generated }));
    }
    assert.equal(h.deliveries.length, after);
    assert.equal((await (await get(contract.token)).json()).snapshot.id, contract.id);
  });
  await test('Concurrent Final Send retries deliver one customer/representative PDF pair', async () => {
    const data = { ...base, email: 'concurrent-final-flow@example.com' };
    const contract = await accepted(data), approved = await prepared(contract.token, data);
    const body = { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64: h.pdf(approved.snapshotHash) };
    const responses = await Promise.all(Array.from({ length: 4 }, () => post(approve, '/api/approve-and-send', body)));
    assert.equal(responses.filter(response => response.status === 200).length, 1);
    const values = await Promise.all(responses.map(response => response.json()));
    assert.equal(values.filter(value => value.success === true).length, 1);
    assert.equal(finalMail(data.email).length, 1);
    assert.equal(h.deliveries.filter(mail => mail.options.attachments && mail.options.htmlBody.includes(approved.contractNumber)).length, 2);
    assert.equal(h.stored(contract.id).status, 'sent');
  });
  await test('Lost Submit acknowledgment: failed API response, retry returns stored receipt with one notification', async () => {
    const data = { ...base, email: 'lost-submit-flow@example.com' };
    h.transport('lost-receipt');
    try { await rejected(await post(submit, '/api/submit-contract', data)); } finally { h.transport(''); }
    const contract = await accepted(data);
    assert.equal(h.stored(contract.id).formData.email, data.email);
    assert.equal(h.deliveries.filter(mail => mail.options.htmlBody.includes(data.email)).length, 1);
  });
  await test('Lost Final Send acknowledgment: response fails, retry never duplicates delivered PDF', async () => {
    const data = { ...base, email: 'lost-final-flow@example.com' };
    const contract = await accepted(data), approved = await prepared(contract.token, data);
    // The backend commits the send but transport loses its response.
    const bridge = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const response = await bridge(input, init);
      return JSON.parse(String(init?.body)).action === 'approve_and_send' ? new Response('lost final acknowledgment') : response;
    };
    try { await rejected(await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64: h.pdf(approved.snapshotHash) })); }
    finally { globalThis.fetch = bridge; }
    assert.equal(h.stored(contract.id).status, 'sent');
    await rejected(await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash }));
    assert.equal(finalMail(data.email).length, 1);
    const reviewed = await (await get(contract.token)).json();
    assert.equal(reviewed.isAlreadySent, true);
  });
  await test('GAS failure at Submit/Prepare/Send never yields API success or mail', async () => {
    const contract = await accepted({ ...base, email: 'gas-failure-flow@example.com' });
    const approved = await prepared(contract.token, { ...base, email: 'gas-failure-flow@example.com' });
    const before = h.deliveries.length;
    for (const fault of ['network', 'malformed', 'reject'] as const) {
      h.transport(fault);
      try {
        await rejected(await post(submit, '/api/submit-contract', { ...base, email: 'new-gas-failure@example.com' }));
        await rejected(await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'prepare', expectedRevision: 1, updatedData: base }));
        await rejected(await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64: h.pdf(approved.snapshotHash) }));
      } finally { h.transport(''); }
    }
    assert.equal(h.deliveries.length, before);
    assert.notEqual(h.stored(contract.id).status, 'sent');
  });
  await test('PDF missing/malformed/stale binding failure never reports success or sends mail', async () => {
    const data = { ...base, email: 'pdf-failure-flow@example.com' };
    const contract = await accepted(data), approved = await prepared(contract.token, data);
    const before = h.deliveries.length, filesBefore = h.files.size;
    for (const pdfBase64 of [undefined, 'broken', h.pdf('old-snapshot')]) {
      await rejected(await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64 }));
    }
    assert.equal(h.files.size, filesBefore); assert.equal(h.deliveries.length, before);
    assert.notEqual(h.stored(contract.id).status, 'sent');
  });
  await test('Customer/representative email uncertain failure never returns final success or resends customer', async () => {
    for (const recipient of ['customer', 'representative']) {
      const data = { ...base, email: recipient + '-email-failure-flow@example.com' };
      const contract = await accepted(data), approved = await prepared(contract.token, data);
      h.emailFailure(recipient === 'customer' ? data.email : process.env.REPRESENTATIVE_EMAIL!);
      try { await rejected(await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash, pdfBase64: h.pdf(approved.snapshotHash) })); }
      finally { h.emailFailure(''); }
      const before = h.deliveries.length;
      assert.notEqual(h.stored(contract.id).status, 'sent');
      assert.equal(h.stored(contract.id)[recipient === 'customer' ? 'customerState' : 'representativeState'], 'unknown');
      await rejected(await post(approve, '/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: approved.snapshotHash }));
      assert.equal(h.deliveries.length, before); assert.equal(finalMail(data.email).length, 1);
      assert.equal((await (await get(contract.token)).json()).isAlreadySent, false);
    }
  });
  await test('Representative notification email failure still requires durable receipt before Submit acceptance', async () => {
    const data = { ...base, email: 'durable-receipt-flow@example.com' };
    h.emailFailure(process.env.REPRESENTATIVE_EMAIL!);
    let contract;
    try { contract = await accepted(data); } finally { h.emailFailure(''); }
    assert.equal(h.stored(contract.id).notificationState, 'unknown');
    assert.equal(h.stored(contract.id).status, 'submitted');
    assert.equal(finalMail(data.email).length, 0);
    // Acceptance means durable backend receipt, never final contract/email delivery.
    h.driveFailure(true);
    try { await rejected(await post(submit, '/api/submit-contract', { ...base, email: 'unsaved-receipt-flow@example.com' })); }
    finally { h.driveFailure(false); }
  });
}

main().finally(() => {
  h.restore();
  if (process.env.FLOW_RESULTS_PATH) fs.writeFileSync(process.env.FLOW_RESULTS_PATH, JSON.stringify({
    matrixCombinations: matrixCount, timezoneProcesses: 4, results,
    passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length,
  }, null, 2));
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
  console.log('Flow regression: ' + results.filter(r => r.status === 'passed').length + '/' + results.length + ' passed');
}).catch(error => { console.error(error); process.exitCode = 1; });
