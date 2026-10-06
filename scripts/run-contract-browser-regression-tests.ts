import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { testTool, assertRasterPdf, type RasterCapture } from './test-support/rasterPdf';
import { exerciseMobileCustomer, mobileProfiles } from './test-support/mobileCustomer';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { GET as review } from '../src/app/api/review-contract/route';
import { snapshotBinding, validatePdf } from '../src/lib/contractWorkflow';
import { expiredToken } from './test-support/expiredToken';
import type { ContractFormData } from '../src/types/contract';

const h = installGasHarness();
const base: ContractFormData = { ...h.form, weddingDate: '2027-04-17', sundayDiscount: false,
  productId: 'album_plus', optionIds: [], portfolioConsent: false, reviewContractCashback: true,
  reviewMainCashback: true, groomName: '회귀테스트 신랑', brideName: '회귀테스트 신부', requestNotes: '실속형 승인 요청사항' };
const artifacts = process.env.FLOW_ARTIFACT_DIR || path.resolve('.contract-test-output');
fs.mkdirSync(artifacts, { recursive: true });
const results: { name: string; status: string; error?: string }[] = [];
let browser: any, server: ChildProcess, serverOutput = '', pdfPages = 0;
let port: number;
let browserContext: any, page: any;
let actions: string[] = [], prepared: any, sentPdf: string | undefined;
let dialogs: string[] = [];
const pageErrors: string[] = [];
async function test(name: string, work: () => Promise<void>) {
  try { await work(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); }
  catch (error) {
    results.push({ name, status: 'failed', error: String(error) });
    console.error('FAIL ' + name, error);
    await page?.screenshot({ path: path.join(artifacts, 'failure-' + results.length + '.png'), fullPage: true }).catch(() => {});
  } finally {
    h.transport(''); h.emailFailure(''); h.driveFailure(false);
    await browserContext?.close(); browserContext = undefined; page = undefined;
  }
}
async function receipt(email: string) {
  const data = { ...base, email };
  const response = await submit(h.request('/api/submit-contract', data)), result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.success, true);
  const token = h.reviewToken();
  return { id: result.contractId as string, token, data };
}
async function newPage(options: Record<string, unknown> = {}) {
  browserContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR', ...options });
  page = await browserContext.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error: Error) => pageErrors.push(String(error)));
  dialogs = [];
  page.on('dialog', async (dialog: any) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  actions = []; prepared = undefined; sentPdf = undefined;
  await page.addInitScript(() => {
    const state = window as unknown as { flowCaptures: RasterCapture[]; flowPdfFault?: boolean };
    state.flowCaptures = [];
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
      if (state.flowPdfFault && type === 'image/png' && this.width > 2000 && this.height > 3000) throw new Error('Injected PDF encoding failure');
      const result = original.call(this, type, quality);
      if (type === 'image/png' && this.width > 2000 && this.height > 3000) {
        state.flowCaptures.push({ png: result, text: document.getElementById('review-contract-doc-preview')?.textContent || '',
          width: this.width, height: this.height });
      }
      return result;
    };
  });
  await browserContext.route('**/*', async (route: any) => {
    const incoming = route.request(), url = new URL(incoming.url());
    // Isolate all external network. Every business API uses real handlers plus real Code.gs in memory.
    if (url.hostname !== '127.0.0.1') {
      assert.equal(incoming.headers().referer, undefined, 'External assets must not receive the approval URL');
      await route.abort(); return;
    }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    let response: Response;
    if (url.pathname === '/api/review-contract') {
      response = await review(new NextRequest('https://booking.fixture.com/api/review-contract' + url.search));
    } else if (url.pathname === '/api/approve-and-send') {
      const value = incoming.postDataJSON();
      actions.push(value.phase); if (value.phase === 'send') sentPdf = value.pdfBase64;
      response = await approve(h.request('/api/approve-and-send', value));
    } else if (url.pathname === '/api/submit-contract') {
      actions.push('submit'); response = await submit(h.request('/api/submit-contract', incoming.postDataJSON()));
    } else { throw new Error('Unexpected API call: ' + url.pathname); }
    const body = await response.text();
    if (url.pathname === '/api/approve-and-send' && incoming.postDataJSON().phase === 'prepare' && response.ok) prepared = JSON.parse(body);
    await route.fulfill({ status: response.status, contentType: 'application/json', body });
  });
}
async function openReview(token?: string) {
  await newPage();
  await page.goto('http://127.0.0.1:' + port + '/review' + (token ? '?token=' + encodeURIComponent(token) : ''));
  await page.getByText('계약서 발송 확인 및 검토', { exact: true }).waitFor();
}
async function send() {
  await page.getByRole('button', { name: '최종 계약서 발송하기', exact: true }).click();
}
async function failureVisible(message?: string) {
  if (message) await page.getByText(message, { exact: false }).first().waitFor();
  await page.getByRole('button', { name: '최종 계약서 발송하기', exact: true }).waitFor();
  // Button reappears only after finally; this guards against checking success before async work finishes.
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '최종 계약서 발송하기');
    return button && !button.disabled && !!document.querySelector('.bg-red-50');
  }, { timeout: 90000 });
  assert.equal(await page.getByText('최종 계약서 발송 완료', { exact: true }).count(), 0);
}
async function fillCoreCustomer(email: string) {
  await newPage();
  await page.goto('http://127.0.0.1:' + port + '/');
  await page.getByRole('button', { name: /전체 펼쳐보기/ }).click();
  await page.locator('.overflow-y-auto').evaluate((element: HTMLElement) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll', { bubbles: true })); });
  await page.getByText('본식스냅 계약 약관 및 운영 정책의 내용을 모두 확인하였으며 이에 동의합니다.', { exact: false }).click();
  await page.getByRole('button', { name: '동의하고 계약정보 작성 시작하기', exact: true }).click();
  await page.getByRole('button', { name: /날짜를 눌러 달력에서/ }).click();
  await page.locator('select').nth(0).selectOption('2027');
  await page.locator('select').nth(1).selectOption('3');
  await page.getByRole('button', { name: '17', exact: true }).click();
  await page.getByPlaceholder('예: 더채플앳청담, 엘타워, 빌라드지디').fill('회귀테스트 예식장');
  await page.getByPlaceholder('예: 6층 커스티홀, 그랜드볼룸').fill('회귀테스트 홀');
  await page.getByPlaceholder('예: 김민우').fill('회귀테스트 신랑');
  await page.getByPlaceholder('예: 이서연').fill('회귀테스트 신부');
  await page.locator('input[type="tel"]').nth(0).fill('010-1111-2222');
  await page.locator('input[type="tel"]').nth(1).fill('010-3333-4444');
  await page.locator('input[type="email"]').fill(email);
}
async function confirmAndSubmit() {
  await page.getByRole('button', { name: /^(계약 내용 최종 확인하기|최종 확인하기)/ }).first().click();
  await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).click();
}
function submittedRecord(email: string) {
  const file = [...h.files.values()].find(file => file.name.endsWith('.json') && JSON.parse(file.bytes.toString()).formData.email === email);
  assert.ok(file);
  return JSON.parse(file.bytes.toString());
}

async function main() {
  const reservation = http.createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', chunk => { serverOutput += String(chunk); });
  server.stderr?.on('data', chunk => { serverOutput += String(chunk); });
  const started = Date.now();
  while (true) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get('http://127.0.0.1:' + port + '/review', res => {
          res.resume(); res.statusCode === 200 ? resolve() : reject(new Error('HTTP ' + res.statusCode));
        });
        req.setTimeout(2000, () => req.destroy(new Error('Server readiness timeout'))); req.on('error', reject);
      });
      break;
    } catch {
      if (Date.now() - started > 30000 || server.exitCode !== null) throw new Error('Built server failed to start: ' + serverOutput);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  // Existing system Chrome is used; no browser download or new runtime installation.
  browser = await testTool('playwright').chromium.launch({ channel: process.env.FLOW_BROWSER_CHANNEL || 'chrome', headless: true });

  await test('Browser GET: actual Review URL/reloads never send email or modify contract', async () => {
    const contract = await receipt('browser-get@example.com');
    const before = h.deliveries.length, record = JSON.stringify(h.stored(contract.id));
    await openReview(contract.token);
    for (let i = 0; i < 2; i++) {
      await page.reload();
      await page.getByText('계약서 발송 확인 및 검토', { exact: true }).waitFor();
    }
    assert.equal(h.deliveries.length, before); assert.equal(JSON.stringify(h.stored(contract.id)), record);
    assert.equal(actions.length, 0);
    assert.ok((await page.locator('body').innerText()).length > 100);
    assert.equal(await page.locator('[data-nextjs-dialog], .vite-error-overlay').count(), 0);
    await page.screenshot({ path: path.join(artifacts, 'review-get-safe.png'), fullPage: true });
  });
  await test('Browser edit/ID: album to standard, real raster PDF equals stored/customer/representative attachments', async () => {
    const contract = await receipt('browser-edit@example.com');
    await openReview(contract.token);
    const initialNumber = h.stored(contract.id).contractNumber;
    await page.getByRole('button', { name: '내용 수정', exact: true }).click();
    await page.getByRole('button', { name: /실속형/ }).click();
    await page.getByRole('button', { name: '수정 완료', exact: true }).click();
    // Double click the same DOM node synchronously to exercise the ref guard, without Playwright waiting for re-enable.
    await page.getByRole('button', { name: '최종 계약서 발송하기', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await page.getByText('최종 계약서 발송 완료', { exact: true }).waitFor({ timeout: 90000 });
    assert.deepEqual(actions, ['prepare', 'send']);
    const record = h.stored(contract.id);
    assert.equal(record.contractId, contract.id); assert.equal(record.snapshot.id, contract.id);
    assert.equal(record.contractNumber, initialNumber); assert.equal(record.snapshot.contractNumber, initialNumber);
    assert.ok(initialNumber.endsWith(contract.id.slice(4).toUpperCase()), 'PDF/email contract number must encode this submission ID');
    assert.equal(prepared.snapshot.id, contract.id); assert.equal(record.snapshot.data.productId, 'standard');
    assert.equal(record.snapshotHash, snapshotBinding(record.snapshot));
    assert.deepEqual(record.snapshot.data, prepared.snapshot.data);
    assert.equal(record.snapshot.pricing.contractTotal, 1250000);
    assert.equal(record.snapshot.pricing.depositAmount, 300000);
    assert.equal(record.snapshot.pricing.balanceAmount, 950000);
    assert.equal(record.snapshot.pricing.futureCashbackTotal, 100000);
    assert.ok(sentPdf);
    const bytes = Buffer.from(validatePdf(sentPdf, record.snapshotHash), 'base64');
    const captures: RasterCapture[] = await page.evaluate(() => (window as any).flowCaptures);
    for (const capture of captures) {
      assert.ok(capture.text.includes('실속형')); assert.ok(!capture.text.includes('화보형'));
      assert.ok(capture.text.includes(initialNumber)); assert.ok(capture.text.includes('1,250,000'));
    }
    pdfPages = await assertRasterPdf(bytes, captures, initialNumber, record.snapshotHash);
    const saved = [...h.files.values()].find(file => file.id === record.pdfFileId)!;
    assert.deepEqual(saved.bytes, bytes);
    const mails = h.deliveries.filter(mail => mail.options.attachments && mail.options.htmlBody.includes(initialNumber));
    assert.equal(mails.length, 2);
    assert.equal(mails.filter(mail => mail.to === contract.data.email).length, 1);
    for (const mail of mails) {
      assert.ok(mail.options.htmlBody.includes('실속형')); assert.ok(!mail.options.htmlBody.includes('화보형'));
      assert.ok(mail.options.htmlBody.includes('1,250,000'));
      assert.deepEqual(Buffer.from(mail.options.attachments[0].getBytes()), bytes);
    }
    const repeated = await approve(h.request('/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: record.snapshotHash, pdfBase64: sentPdf }));
    assert.notEqual(repeated.status, 200); assert.equal((await repeated.json()).success, false);
    assert.equal(h.deliveries.filter(mail => mail.to === contract.data.email && mail.options.attachments).length, 1);
    const reviewed = await (await review(new NextRequest('https://booking.fixture.com/api/review-contract?token=' + encodeURIComponent(contract.token)))).json();
    assert.equal(reviewed.contractId, contract.id); assert.equal(reviewed.snapshot.id, contract.id); assert.equal(reviewed.data.productId, 'standard');
    fs.writeFileSync(path.join(artifacts, 'standard-final-contract.pdf'), bytes);
    captures.forEach((capture, index) => fs.writeFileSync(path.join(artifacts, 'standard-page-' + (index + 1) + '.png'), Buffer.from(capture.png.split(',')[1], 'base64')));
    await page.screenshot({ path: path.join(artifacts, 'final-send-success.png'), fullPage: true });
  });
  await test('Browser GAS failure: prepare error displays failure and sends no PDF/mail', async () => {
    const contract = await receipt('browser-gas-fail@example.com');
    await openReview(contract.token);
    const before = h.deliveries.length;
    h.transport('network'); await send(); await failureVisible();
    assert.deepEqual(actions, ['prepare']); assert.equal(h.deliveries.length, before);
    assert.notEqual(h.stored(contract.id).status, 'sent');
  });
  await test('Browser PDF encoding failure: error displays failure, no Send API or mail', async () => {
    const contract = await receipt('browser-pdf-fail@example.com');
    await openReview(contract.token);
    const before = h.deliveries.length;
    await page.evaluate(() => { (window as any).flowPdfFault = true; });
    await send(); await failureVisible('Injected PDF encoding failure');
    assert.deepEqual(actions, ['prepare']); assert.equal(h.deliveries.length, before);
    assert.notEqual(h.stored(contract.id).status, 'sent');
  });
  for (const recipient of ['customer', 'representative']) {
    await test('Browser ' + recipient + ' email failure: no success UI and retry never duplicates customer', async () => {
      const contract = await receipt('browser-' + recipient + '-mail-fail@example.com');
      await openReview(contract.token);
      h.emailFailure(recipient === 'customer' ? contract.data.email : process.env.REPRESENTATIVE_EMAIL!);
      await send(); await failureVisible();
      h.emailFailure('');
      const before = h.deliveries.length;
      assert.notEqual(h.stored(contract.id).status, 'sent');
      await send(); await failureVisible();
      assert.equal(h.deliveries.length, before);
      assert.equal(h.deliveries.filter(mail => mail.to === contract.data.email && mail.options.attachments).length, 1);
      assert.deepEqual(actions, ['prepare', 'send', 'prepare', 'send']);
    });
  }
  await test('Browser tokens: missing, invalid signature, modified payload, expired show access error only', async () => {
    const contract = await receipt('browser-token@example.com');
    const [payload, signature] = contract.token.split('.');
    const flip = (value: string) => (value[0] === 'A' ? 'B' : 'A') + value.slice(1);
    const before = h.deliveries.length;
    await newPage();
    for (const token of [undefined, payload + '.' + flip(signature), flip(payload) + '.' + signature,
      expiredToken(contract.id, base)]) {
      await page.goto('http://127.0.0.1:' + port + '/review' + (token ? '?token=' + encodeURIComponent(token) : ''));
      await page.getByText('확인 링크 접근 오류', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '최종 계약서 발송하기', exact: true }).count(), 0);
    }
    assert.equal(h.deliveries.length, before); assert.equal(actions.length, 0);
  });
  await test('Browser customer Submit GAS failure: actual form keeps failure state instead of receipt success', async () => {
    await fillCoreCustomer('browser-submit-fail@example.com');
    await page.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
    await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).waitFor();
    const before = h.deliveries.length;
    h.transport('network');
    await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).click();
    await page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '계약정보 제출하기');
      return button && !button.disabled;
    });
    assert.equal(dialogs.length, 0);
    await page.getByRole('alert').filter({ hasText: /실패|오류|확인|완료하지/ }).waitFor();
    assert.equal(await page.getByText('계약 신청이 정상 접수되었습니다', { exact: true }).count(), 0);
    assert.deepEqual(actions, ['submit']); assert.equal(h.deliveries.length, before);
  });
  await test('Browser minimal form: required contract fields alone submit; preparation/marketing stay optional', async () => {
    const email = 'browser-minimal-policy@example.com';
    await fillCoreCustomer(email);
    const details = page.locator('details');
    assert.equal(await details.count(), 5);
    for (let i = 0; i < 5; i++) assert.equal(await details.nth(i).getAttribute('open'), null);
    assert.equal(await page.locator('#makeup-location').isVisible(), false);
    assert.equal(await page.locator('#groom-family').isVisible(), false);
    assert.equal(await page.locator('#shoot-request-notes').isVisible(), false);
    await page.screenshot({ path: path.join(artifacts, 'minimal-contract-form.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
    await page.screenshot({ path: path.join(artifacts, 'minimal-contract-form-mobile.png'), fullPage: true });
    await confirmAndSubmit();
    await page.getByText('계약 신청이 정상 접수되었습니다', { exact: true }).waitFor();
    const record = submittedRecord(email);
    for (const field of ['makeupLocation', 'groomFamilyMembers', 'brideFamilyMembers', 'shootRequestNotes', 'retouchRequestNotes',
      'requestNotes', 'referralSource', 'instagramId', 'blogUrl']) assert.equal(record.formData[field], '');
    assert.equal(record.pricing.contractTotal, 1250000);
    assert.equal(record.pricing.depositAmount, 300000); assert.equal(record.pricing.balanceAmount, 950000);
    assert.equal(record.pricing.futureCashbackTotal, 0);
    assert.equal(h.deliveries.filter(mail => mail.options.htmlBody.includes(email)).length, 1);
    assert.equal(h.deliveries.filter(mail => mail.to === email).length, 0);
  });
  await test('Browser optional data: collapse/reopen/back preserves preparation, notes and referral; deselection allowed', async () => {
    const email = 'browser-preserved-policy@example.com';
    await fillCoreCustomer(email);
    for (const text of ['메이크업 준비 정보', '신랑 가족사진 준비 정보', '신부 가족사진 준비 정보',
      '촬영·후보정 준비 정보', '유입경로·후기 확인 정보']) await page.locator('summary').filter({ hasText: text }).click();
    const values = {
      'makeup-location': '준비정보 샵 / out 10:00',
      'groom-family': '신랑 부모님', 'bride-family': '신부 부모님',
      'shoot-request-notes': '선택 촬영 요청 보존', 'retouch-request-notes': '선택 보정 요청 보존',
      'contract-request-notes': '계약 특약 보존',
    };
    for (const [id, value] of Object.entries(values)) await page.locator('#' + id).fill(value);
    await page.getByRole('button', { name: '지인소개', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '지인소개', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: '지인소개', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '지인소개', exact: true }).getAttribute('aria-pressed'), 'false');
    await page.getByRole('button', { name: '지인소개', exact: true }).click();
    await page.getByPlaceholder('@instagram_id').fill('@preserved_fixture');
    await page.getByPlaceholder('blog.naver.com/id').fill('blog.example.com/fixture');
    await page.locator('summary').filter({ hasText: '촬영·후보정 준비 정보' }).click();
    await page.locator('summary').filter({ hasText: '촬영·후보정 준비 정보' }).click();
    assert.equal(await page.locator('#shoot-request-notes').inputValue(), values['shoot-request-notes']);
    await page.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
    await page.getByRole('button', { name: '수정하기', exact: true }).click();
    // Returning unmounts sections; values must be restored from the parent form.
    await page.locator('summary').filter({ hasText: '촬영·후보정 준비 정보' }).click();
    assert.equal(await page.locator('#shoot-request-notes').inputValue(), values['shoot-request-notes']);
    await confirmAndSubmit();
    await page.getByText('계약 신청이 정상 접수되었습니다', { exact: true }).waitFor();
    const record = submittedRecord(email);
    assert.equal(record.formData.makeupLocation, values['makeup-location']);
    assert.equal(record.formData.groomFamilyMembers, values['groom-family']);
    assert.equal(record.formData.brideFamilyMembers, values['bride-family']);
    assert.equal(record.formData.shootRequestNotes, values['shoot-request-notes']);
    assert.equal(record.formData.retouchRequestNotes, values['retouch-request-notes']);
    assert.equal(record.formData.requestNotes, values['contract-request-notes']);
    assert.equal(record.formData.referralSource, '지인소개');
    assert.equal(record.formData.instagramId, '@preserved_fixture');
    assert.equal(record.formData.blogUrl, 'blog.example.com/fixture');
    assert.equal(record.pricing.contractTotal, 1250000);
  });
  for (const { name, ...profile } of mobileProfiles) {
    await test('Customer ' + name + ': invalid input, double submit, refresh and storage privacy', async () => {
      await newPage(profile);
      await exerciseMobileCustomer(page, h, 'http://127.0.0.1:' + port + '/', path.join(artifacts, name + '.png'), 'first-client-' + name + '@example.com');
      assert.deepEqual(await browserContext.cookies(), []);
    });
  }
  assert.deepEqual(pageErrors, [], 'Unexpected uncaught browser exceptions');
}

main().catch(error => {
  results.push({ name: 'browser suite setup/runtime', status: 'failed', error: String(error) });
  console.error(error); process.exitCode = 1;
}).finally(async () => {
  await browserContext?.close(); await browser?.close();
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise<void>(resolve => { server.once('exit', () => resolve()); setTimeout(resolve, 3000).unref(); });
  }
  h.restore();
  fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify({ results, pdfPages, pageErrors,
    passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length,
    evidence: 'Built Next app + real React document + html2canvas/jsPDF + actual API/Code.gs; Google I/O isolated in memory',
  }, null, 2));
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
  console.log('Browser flow regression: ' + results.filter(r => r.status === 'passed').length + '/' + results.length + ' passed');
});
