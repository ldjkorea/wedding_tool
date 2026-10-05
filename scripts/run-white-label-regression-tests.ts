import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { testTool, assertRasterPdf, type RasterCapture } from './test-support/rasterPdf';
import { exerciseMobileCustomer, mobileProfiles } from './test-support/mobileCustomer';
import { getStudioConfig, getProducts, getOptions, getDiscounts, getContractPolicy, getThemeStyle } from '../src/services/configuration';
import { calculateContractPrice } from '../src/lib/pricing';
import { canonicalForm } from '../src/lib/contractValidation';
import { getConfiguredFieldErrors } from '../src/lib/formFields';
import { generateContractNumber } from '../src/lib/contractNumber';
import { getBackendAdapter } from '../src/services/googleAppsScriptAdapter';
import { snapshotBinding, validatePdf } from '../src/lib/contractWorkflow';
import { Header } from '../src/components/ui/Header';
import { HomeLandingView } from '../src/components/home/HomeLandingView';
import { ProductCatalogView } from '../src/components/catalog/ProductCatalogView';
import { CustomerInfoSection } from '../src/components/contract-form/CustomerInfoSection';
import { WeddingInfoSection } from '../src/components/contract-form/WeddingInfoSection';
import { RequestNotesSection } from '../src/components/contract-form/RequestNotesSection';
import { ContractDocument } from '../src/components/pdf/ContractDocument';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { POST as validateCode } from '../src/app/api/validate-partner-code/route';
import { withRuntimeConfiguration } from '../src/services/serverRuntimeConfiguration';
import { GET as review } from '../src/app/api/review-contract/route';
import type { ContractFormData } from '../src/types/contract';

const forbidden = /dear[\s_-]*memory|dearmemory|디어메모리|한민규|\bDM\b|HANMINGYU/i;
const h = installGasHarness({ partnerAmount: 35000 });
Object.assign(process.env, { APP_URL: 'https://moment.booking.fixture.com', REPRESENTATIVE_EMAIL: 'owner@moment.booking.fixture.com' });
for (const name of ['NEXT_PUBLIC_APP_URL', 'STUDIO_REP_EMAIL', 'DEAR_MEMORY_REP_EMAIL']) delete process.env[name];
const artifacts = path.resolve(process.env.WHITE_LABEL_ARTIFACT_DIR || '.contract-test-output/moment-studio');
fs.mkdirSync(artifacts, { recursive: true });
const results: { name: string; status: 'passed' | 'failed'; error?: string }[] = [];
const studio = getStudioConfig();
const base: ContractFormData = {
  ...h.form, weddingDate: '2027-04-17', weddingHall: '', groomName: '김시온', brideName: '박다은',
  groomPhone: '', bridePhone: 'HIDDEN_BRIDE_MARKER', makeupLocation: 'HIDDEN_MAKEUP_MARKER',
  groomFamilyMembers: 'HIDDEN_FAMILY_MARKER', instagramId: 'HIDDEN_SOCIAL_MARKER',
  weddingVenue: '모먼트 테스트 예식장', email: 'moment-customer@example.com',
  productId: 'moment_signature', optionIds: ['moment_assistant', 'moment_after_party'],
  partnerDiscount: true, partnerName: 'registered-partner', portfolioConsent: true,
  reviewContractCashback: true, reviewMainCashback: true,
  shootRequestNotes: '모먼트 자연스러운 촬영 요청', referralSource: '모먼트 홈페이지', requestNotes: '모먼트 최종 특약',
};
let matrixCount = 0, pdfPages = 0, port = 0;
let browser: any, context: any, page: any, server: ChildProcess | undefined;
let prepared: any, sentPdf: string | undefined;
const pageErrors: string[] = [], actions: string[] = [];
let functionalContract: { id: string; token: string; number: string } | undefined;
let sourceHits: { file: string; line: number; sample: string }[] = [];
let bundleHits: { file: string; markers: string[] }[] = [];
async function test(name: string, work: () => unknown | Promise<unknown>) {
  try { await work(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); }
  catch (error) {
    results.push({ name, status: 'failed', error: String(error) });
    console.error('FAIL ' + name + ': ' + String(error));
    await page?.screenshot({ path: path.join(artifacts, 'failure-' + results.length + '.png'), fullPage: true }).catch(() => {});
  }
}
function clean(text: string, stage: string) {
  assert.equal(forbidden.test(text), false, 'Previous client branding in ' + stage);
}
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}
function html(component: React.ReactElement) { return renderToStaticMarkup(component); }
const noop = () => {};
async function submitData(data: ContractFormData) {
  const response = await submit(h.request('/api/submit-contract', data)), result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result)); assert.equal(result.success, true);
  const record = h.stored(result.contractId);
  const notification = h.deliveries.find(mail => !mail.options.attachments && mail.options.htmlBody.includes(data.email))!;
  assert.ok(notification);
  const token = new URL(notification.options.htmlBody.match(/href="([^"]+)"/)[1]).searchParams.get('token')!;
  return { id: result.contractId as string, token, number: record.contractNumber as string };
}
async function getReview(token: string) {
  const response = await review(new NextRequest('https://moment.booking.fixture.com/api/review-contract?token=' + encodeURIComponent(token)));
  assert.equal(response.status, 200); return response.json();
}
async function startBrowser() {
  const reservation = http.createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  port = (reservation.address() as { port: number }).port;
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    env: { ...process.env, NODE_ENV: 'production', STUDIO_SETTINGS_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout?.on('data', value => { output += String(value); });
  server.stderr?.on('data', value => { output += String(value); });
  const started = Date.now();
  while (true) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get('http://127.0.0.1:' + port + '/', response => {
          response.resume(); response.statusCode === 200 ? resolve() : reject(new Error('HTTP ' + response.statusCode));
        });
        req.on('error', reject); req.setTimeout(2000, () => req.destroy(new Error('Readiness timeout')));
      });
      break;
    } catch {
      if (Date.now() - started > 30000 || server.exitCode !== null) throw new Error('Built Moment server did not start: ' + output);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  browser = await testTool('playwright').chromium.launch({ channel: process.env.FLOW_BROWSER_CHANNEL || 'chrome', headless: true });
}
async function newPage(options: Record<string, unknown> = {}) {
  await context?.close();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR', ...options });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', (error: Error) => pageErrors.push(String(error)));
  page.on('dialog', async (dialog: any) => { await dialog.dismiss(); });
  await page.addInitScript(() => {
    const state = window as unknown as { momentCaptures: RasterCapture[] };
    state.momentCaptures = [];
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
      const result = original.call(this, type, quality);
      if (type === 'image/png' && this.width > 2000 && this.height > 3000) {
        state.momentCaptures.push({ png: result, text: document.getElementById('review-contract-doc-preview')?.textContent || '',
          width: this.width, height: this.height });
      }
      return result;
    };
  });
  await context.route('**/*', async (route: any) => {
    const incoming = route.request(), url = new URL(incoming.url());
    if (url.hostname !== '127.0.0.1') {
      assert.equal(incoming.headers().referer, undefined, 'External asset request must not leak a review URL');
      await route.abort(); return;
    }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    let response: Response;
    if (url.pathname === '/api/review-contract') {
      response = await review(new NextRequest('https://moment.booking.fixture.com/api/review-contract' + url.search));
    } else if (url.pathname === '/api/approve-and-send') {
      const value = incoming.postDataJSON(); actions.push(value.phase);
      if (value.phase === 'send') sentPdf = value.pdfBase64;
      response = await approve(h.request('/api/approve-and-send', value));
      if (response.ok && value.phase === 'prepare') prepared = await response.clone().json();
    } else if (url.pathname === '/api/submit-contract') {
      actions.push('submit'); response = await submit(h.request('/api/submit-contract', incoming.postDataJSON()));
    } else if (url.pathname === '/api/validate-partner-code') response = await validateCode(h.request(url.pathname, incoming.postDataJSON()));
    else throw new Error('Unexpected API: ' + url.pathname);
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
}
async function reviewSend(contract: { id: string; token: string; number: string }, expectedTotal: number, expectedEmail: string, manualAmount = 0, lastNote?: string) {
    const artifactPrefix = manualAmount ? 'moment-adjusted-long' : expectedTotal === 1075000 ? 'moment-full' : 'moment';
    await newPage(); await page.goto('http://127.0.0.1:' + port + '/review?token=' + encodeURIComponent(contract.token));
    await page.getByText('계약서 발송 확인 및 검토', { exact: true }).waitFor();
    clean(await page.locator('body').innerText(), 'Review browser');
    await page.getByRole('button', { name: '내용 수정', exact: true }).click();
    if (h.stored(contract.id).formData.partnerDiscount) await page.getByRole('status').filter({ hasText: '35,000원 할인이 적용되었습니다.' }).waitFor();
    await page.getByRole('button', { name: /모먼트 에센셜/ }).click();
    if (manualAmount) {
      await page.getByPlaceholder('예: -50000, -100000', { exact: true }).fill(String(manualAmount));
      await page.getByPlaceholder('예: 지인 특별 할인, 대체공휴일 등', { exact: true }).fill('승인된 추가 조정');
    }
    await page.getByRole('button', { name: '수정 완료', exact: true }).click();
    await page.screenshot({ path: path.join(artifacts, artifactPrefix + '-review.png'), fullPage: true });
    await page.getByRole('button', { name: '최종 계약서 발송하기', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await Promise.race([
      page.getByText('최종 계약서 발송 완료', { exact: true }).waitFor({ timeout: 90000 }),
      page.getByText('계약서 내용이 페이지 영역을 초과했습니다.', { exact: false }).waitFor({ timeout: 90000 }).then(async () => {
        const dimensions = await page.locator('[data-pdf-page]').evaluateAll((pages: HTMLElement[]) => pages.map(element => ({
          page: element.dataset.pdfPage, height: element.clientHeight, contentHeight: element.scrollHeight,
          width: element.clientWidth, contentWidth: element.scrollWidth,
          printableBottom: element.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(element).paddingBottom) + parseFloat(getComputedStyle(element).borderBottomWidth)) * element.getBoundingClientRect().height / element.offsetHeight,
          childBottoms: Array.from(element.children).filter(child => child instanceof HTMLElement && child.offsetHeight).map(child => child.getBoundingClientRect().bottom),
        })));
        const record = h.stored(contract.id);
        const state = { dimensions, finalAttachments: h.deliveries.filter(mail => mail.options.attachments && mail.options.htmlBody.includes(contract.number)).length,
          actions: [...actions], successVisible: await page.getByText('최종 계약서 발송 완료', { exact: true }).count(),
          status: record.status, customerLength: base.shootRequestNotes?.length || 0 };
        fs.writeFileSync(path.join(artifacts, 'pdf-overflow.json'), JSON.stringify(state, null, 2));
        assert.equal(state.finalAttachments, 0); assert.equal(state.successVisible, 0);
        throw new Error('Actual PDF overflow; send blocked: ' + JSON.stringify(state));
      }),
    ]);
    const record = h.stored(contract.id);
    assert.equal(record.snapshot.id, contract.id); assert.equal(record.snapshot.contractNumber, contract.number);
    assert.equal(record.snapshot.data.productId, 'moment_essential');
    assert.equal(record.snapshot.studio.displayName, 'MOMENT STUDIO'); assert.equal(record.snapshot.studio.logo, studio.logo);
    assert.equal(record.snapshot.formSchema.shootRequestNotes.required, true);
    assert.equal(record.snapshot.pricing.contractTotal, expectedTotal); assert.equal(record.snapshot.pricing.depositAmount, 250000);
    assert.equal(record.snapshot.pricing.balanceAmount, expectedTotal - 250000); assert.equal(record.snapshot.pricing.futureCashbackTotal, 100000);
    assert.equal(record.snapshot.pricing.manualAdjustmentAmount, manualAmount);
    if (lastNote) assert.ok(record.snapshot.data.shootRequestNotes.includes(lastNote));
    assert.equal(record.snapshotHash, snapshotBinding(record.snapshot)); assert.deepEqual(record.snapshot.data, prepared.snapshot.data);
    clean(JSON.stringify(record.snapshot), 'snapshot'); assert.ok(sentPdf);
    const bytes = Buffer.from(validatePdf(sentPdf, record.snapshotHash), 'base64');
    const captures: RasterCapture[] = await page.evaluate(() => (window as any).momentCaptures);
    for (const [index, capture] of captures.entries()) {
      clean(capture.text, 'PDF captured document'); assert.ok(capture.text.includes('모먼트 에센셜'));
      assert.ok(!capture.text.includes('모먼트 시그니처')); assert.ok(capture.text.includes('윤하늘'));
      assert.ok(capture.text.includes('MS-DELIVERY-DEMO')); assert.ok(capture.text.includes(contract.number));
      if (lastNote) assert.ok(capture.text.includes(lastNote), 'Accepted last note must survive the rendered document');
      fs.writeFileSync(path.join(artifacts, artifactPrefix + '-pdf-page-' + (index + 1) + '.png'), Buffer.from(capture.png.split(',')[1], 'base64'));
    }
    pdfPages = await assertRasterPdf(bytes, captures, contract.number, record.snapshotHash);
    if (lastNote) assert.ok(pdfPages > 3); else assert.equal(pdfPages, 3);
    fs.writeFileSync(path.join(artifacts, artifactPrefix + '-final-contract.pdf'), bytes);
    const pdfFile = [...h.files.values()].find(file => file.id === record.pdfFileId)!; assert.ok(pdfFile); assert.deepEqual(pdfFile.bytes, bytes);
    const finalMails = h.deliveries.filter(mail => mail.options.attachments && mail.options.htmlBody.includes(contract.number));
    assert.equal(finalMails.length, 2);
    for (const mail of finalMails) {
      clean(mail.subject + mail.options.htmlBody, 'final email'); assert.ok(mail.subject.includes('MOMENT STUDIO'));
      assert.ok(mail.options.htmlBody.includes('모먼트 에센셜')); assert.ok(!mail.options.htmlBody.includes('모먼트 시그니처'));
      assert.ok(mail.options.htmlBody.includes(expectedTotal.toLocaleString('en-US') + '원')); assert.ok(mail.options.htmlBody.includes(contract.number));
      assert.deepEqual(Buffer.from(mail.options.attachments[0].getBytes()), bytes);
      fs.writeFileSync(path.join(artifacts, artifactPrefix + (mail.to === expectedEmail ? '-customer-email.html' : '-representative-email.html')), mail.options.htmlBody);
    }
    assert.equal(finalMails.filter(mail => mail.to === expectedEmail).length, 1);
    assert.equal(finalMails.filter(mail => mail.to === process.env.REPRESENTATIVE_EMAIL).length, 1);
    assert.equal((await getReview(contract.token)).snapshot.id, contract.id);
    const retry = await approve(h.request('/api/approve-and-send', { token: contract.token, phase: 'send', snapshotHash: record.snapshotHash, pdfBase64: sentPdf }));
    assert.notEqual(retry.status, 200); assert.equal(h.deliveries.filter(mail => mail.options.attachments && mail.options.htmlBody.includes(contract.number)).length, 2);
    assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
    fs.writeFileSync(path.join(artifacts, artifactPrefix + '-snapshot.json'), JSON.stringify(record.snapshot, null, 2));
    fs.writeFileSync(path.join(artifacts, 'moment-pdf-dom-text.txt'), captures[0].text);
}
async function main() {
  await test('Config-only switch: independent studio, logo, prefix, product/option IDs and policy', () => {
    assert.equal(studio.displayName, 'MOMENT STUDIO'); assert.equal(studio.contractPrefix, 'MS'); assert.equal(studio.representativeName, '윤하늘');
    assert.ok(studio.logo.startsWith('data:image/png;base64,')); assert.notEqual(studio.logo, studio.seal);
    assert.deepEqual(getProducts().map(item => [item.id, item.basePrice]), [['moment_essential', 980000], ['moment_signature', 1680000]]);
    assert.deepEqual(getOptions().map(item => item.price), [180000, 90000]);
    assert.deepEqual(getDiscounts().map(item => item.amount), [80000, 35000, 60000, 30000, 70000]);
    const policy = getContractPolicy();
    assert.equal(policy.version, 'MS-DEMO-2026.10.v1'); assert.equal(policy.deposit.amount, 250000);
    assert.equal(policy.retention.months, 6); assert.equal(policy.refund.fullRefundWindowHours, 96);
    clean(JSON.stringify({ studio, products: getProducts(), options: getOptions(), discounts: getDiscounts(), policy }), 'active configuration');
    assert.match(generateContractNumber('2027-04-17'), /^MS-20270417-[A-Z0-9]{4}$/);
    if (process.env.WHITE_LABEL_CONFIG_ONLY_BASE) {
      const changed = execFileSync('git', ['diff', '--name-only', process.env.WHITE_LABEL_CONFIG_ONLY_BASE, '--', 'src', 'google-apps-script'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(Boolean);
      assert.ok(changed.every(file => file === 'src/config/client.ts' || file.startsWith('src/config/clients/moment-studio/')), 'Core source was changed: ' + changed.join(', '));
    }
  });
  await test('Actual Home/Catalog/Form components render new labels and no previous client', () => {
    const header = html(React.createElement(Header));
    const home = html(React.createElement(HomeLandingView, { onSelectCatalog: noop, onSelectApply: noop }));
    const catalog = html(React.createElement(ProductCatalogView, { onBackToHome: noop, onSelectProductAndApply: noop }));
    const form = [
      html(React.createElement(CustomerInfoSection, { ...base, onChange: noop })),
      html(React.createElement(WeddingInfoSection, { ...base, onChange: noop })),
      html(React.createElement(RequestNotesSection, { ...base, onChange: noop, onOpenTermsModal: noop })),
    ].join('\n');
    [header, home, catalog, form].forEach(value => clean(value, 'Core component markup'));
    assert.ok(header.includes('MOMENT STUDIO')); assert.ok(home.includes('모먼트 에센셜') && home.includes('98만'));
    assert.ok(catalog.includes('모먼트 시그니처') && catalog.includes('1,680,000원'));
    assert.ok(form.includes('모먼트 촬영 요청')); assert.ok(!form.includes('type="tel"') || !form.includes('신부 연락처'));
    const css = walk('.next/static').filter(file => file.endsWith('.css')).map(file => fs.readFileSync(file, 'utf8')).join('\n');
    const theme = Object.entries(getThemeStyle()).map(([key, value]) => key + ':' + value).join(';');
    fs.writeFileSync(path.join(artifacts, 'moment-home.html'), '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body style="' + theme + '">' + header + home + '</body></html>');
    fs.writeFileSync(path.join(artifacts, 'moment-catalog.html'), catalog);
    fs.writeFileSync(path.join(artifacts, 'moment-form.html'), form);
  });
  await test('Required/optional/hidden schema and protected core are enforced by server and client', () => {
    assert.deepEqual(getConfiguredFieldErrors(base), {});
    const data = canonicalForm(base);
    assert.equal(data.groomPhone, ''); assert.equal(data.bridePhone, ''); assert.equal(data.makeupLocation, '');
    assert.equal(data.groomFamilyMembers, ''); assert.equal(data.instagramId, '');
    assert.throws(() => canonicalForm({ ...base, shootRequestNotes: '' }), /shootRequestNotes/);
    assert.throws(() => canonicalForm({ ...base, referralSource: '' }), /referralSource/);
    assert.ok(getConfiguredFieldErrors({ ...base, shootRequestNotes: '' }).shootRequestNotes);
    for (const key of ['groomName', 'brideName', 'weddingDate', 'weddingTime', 'weddingVenue', 'email', 'productId']) {
      assert.throws(() => canonicalForm({ ...base, [key]: '' }), new RegExp(key));
    }
  });
  await test('Pricing 256 combinations: distinct Saturday promotion, totals, deposit, balance, both cashbacks', () => {
    for (const productId of ['moment_essential', 'moment_signature'])
    for (let options = 0; options < 4; options++)
    for (const saturday of [false, true])
    for (const partner of [false, true])
    for (const portfolio of [false, true])
    for (const first of [false, true])
    for (const second of [false, true]) {
      const optionIds = [options & 1 ? 'moment_assistant' : '', options & 2 ? 'moment_after_party' : ''].filter(Boolean);
      const data = { ...base, productId, optionIds, weddingDate: saturday ? '2027-04-17' : '2027-04-18',
        partnerDiscount: partner, portfolioConsent: portfolio, reviewContractCashback: first, reviewMainCashback: second };
      const expected = (productId === 'moment_essential' ? 980000 : 1680000) + (options & 1 ? 180000 : 0) + (options & 2 ? 90000 : 0)
        - (saturday ? 80000 : 0) - (partner ? 35000 : 0) - (portfolio ? 60000 : 0);
      const price = calculateContractPrice(data);
      assert.equal(price.contractTotal, expected); assert.equal(price.depositAmount, 250000); assert.equal(price.balanceAmount, expected - 250000);
      assert.equal(price.futureCashbackTotal, (first ? 30000 : 0) + (second ? 70000 : 0));
      assert.equal(price.dateDiscountEligible, saturday); assert.equal(price.isSunday, !saturday);
      assert.equal(calculateContractPrice(canonicalForm(data)).contractTotal, expected); matrixCount++;
    }
    assert.equal(matrixCount, 256);
  });
  await test('Production API: one MS contract ID/number/token, configured discount, safe Review GET', async () => {
    functionalContract = await submitData(base);
    const duplicate = await submitData(base); assert.equal(duplicate.id, functionalContract.id); assert.equal(duplicate.token, functionalContract.token);
    assert.match(functionalContract.number, /^MS-20270417-[A-Z0-9]{32}$/);
    assert.equal(h.deliveries.length, 1);
    const before = JSON.stringify(h.stored(functionalContract.id));
    const view = await getReview(functionalContract.token);
    assert.equal(view.contractId, functionalContract.id); assert.equal(view.contractNumber, functionalContract.number);
    assert.equal(view.pricing.contractTotal, 1775000); assert.equal(view.pricing.futureCashbackTotal, 100000);
    assert.equal(JSON.stringify(h.stored(functionalContract.id)), before); assert.equal(h.deliveries.length, 1);
    clean(JSON.stringify(view), 'Review API'); clean(h.deliveries[0].subject + h.deliveries[0].options.htmlBody, 'representative notification');
    assert.equal(h.deliveries[0].to, process.env.REPRESENTATIVE_EMAIL);
    assert.ok(h.deliveries[0].options.htmlBody.includes('35,000원'));
    fs.writeFileSync(path.join(artifacts, 'moment-representative-notification.html'), h.deliveries[0].options.htmlBody);
  });
  await test('Moment production build starts and SSR Home renders in real browser', async () => {
    await startBrowser(); await newPage();
    await page.setContent(fs.readFileSync(path.join(artifacts, 'moment-home.html'), 'utf8'));
    const body = await page.locator('body').innerText(); clean(body, 'Home browser');
    assert.ok(body.includes('MOMENT STUDIO') && body.includes('에센셜 98만') && body.includes('토요일'));
    await page.screenshot({ path: path.join(artifacts, 'moment-home.png'), fullPage: true });
  });
  await test('Real Terms/Form: new required fields block, hidden fields absent, optional phones/hall submit', async () => {
    await newPage(); await page.goto('http://127.0.0.1:' + port + '/');
    assert.equal(await page.title(), 'MOMENT STUDIO | Demo Booking');
    await page.getByRole('button', { name: /전체 펼쳐보기/ }).click();
    clean(await page.locator('body').innerText(), 'Terms browser');
    assert.ok((await page.locator('body').innerText()).includes('MS-DEMO-POLICY'));
    await page.locator('.overflow-y-auto').evaluate((element: HTMLElement) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll', { bubbles: true })); });
    await page.getByText('본식스냅 계약 약관 및 운영 정책의 내용을 모두 확인하였으며 이에 동의합니다.', { exact: false }).click();
    await page.getByRole('button', { name: '동의하고 계약정보 작성 시작하기', exact: true }).click();
    assert.equal(await page.getByLabel('모먼트 촬영 요청', { exact: false }).getAttribute('required'), '');
    assert.equal(await page.locator('input[type="tel"]').count(), 1);
    assert.equal(await page.locator('input[type="tel"]').getAttribute('required'), null);
    for (const key of ['makeupLocation', 'groomFamilyMembers', 'brideFamilyMembers', 'instagramId', 'bridePhone']) {
      assert.equal(await page.locator('[id="contract-field-' + key + '"]').count(), 0);
    }
    await page.getByRole('button', { name: /날짜를 눌러 달력에서/ }).click();
    await page.locator('select').nth(0).selectOption('2027'); await page.locator('select').nth(1).selectOption('3');
    await page.getByRole('button', { name: /^17(?:\s+할인)?$/ }).click();
    await page.getByPlaceholder('예: 더채플앳청담, 엘타워, 빌라드지디').fill('모먼트 브라우저 예식장');
    await page.getByPlaceholder('예: 김민우').fill('김시온'); await page.getByPlaceholder('예: 이서연').fill('박다은');
    await page.locator('input[type="email"]').fill('moment-browser@example.com');
    await page.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
    assert.equal(await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).count(), 0);
    await page.getByLabel('모먼트 촬영 요청', { exact: false }).fill('모먼트 브라우저 필수 요청');
    await page.getByRole('button', { name: '친구 추천', exact: true }).click();
    clean(await page.locator('body').innerText(), 'Form browser');
    await page.screenshot({ path: path.join(artifacts, 'moment-form.png'), fullPage: true });
    await page.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
    await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).click();
    await page.getByText('계약 신청이 정상 접수되었습니다', { exact: true }).waitFor();
    const record = [...h.files.values()].filter(file => file.name.endsWith('.json')).map(file => JSON.parse(file.bytes.toString('utf8')))
      .find(record => record.formData?.email === 'moment-browser@example.com');
    assert.ok(record); assert.equal(record.formData.groomPhone, ''); assert.equal(record.formData.bridePhone, '');
    assert.equal(record.pricing.contractTotal, 900000); assert.match(record.contractNumber, /^MS-/);
  });
  for (const { name, ...profile } of mobileProfiles) {
    await test('Customer ' + name + ': invalid input, double submit, refresh, same receipt and no browser storage', async () => {
      await newPage(profile);
      await exerciseMobileCustomer(page, h, 'http://127.0.0.1:' + port + '/', path.join(artifacts, name + '.png'), 'moment-' + name + '@example.com');
      assert.deepEqual(await context.cookies(), []);
    });
  }
  await test('Full-options Review edit must produce PDF and both emails (overflow is a failure)', async () => {
    assert.ok(functionalContract);
    await reviewSend(functionalContract, 1075000, base.email);
  });
  await test('No-options Review edit: actual PDF pixels and both emails use one MS snapshot', async () => {
    const email = 'moment-no-options@example.com';
    const contract = await submitData({ ...base, email, optionIds: [], weddingDate: '2027-04-18', partnerDiscount: false, portfolioConsent: false });
    await reviewSend(contract, 980000, email);
  });
  await test('Manual adjustment + 100-line notes: final PDF and both emails preserve approved totals and last line', async () => {
    const email = 'moment-manual-long@example.com';
    const notes = Array.from({ length: 100 }, (_, index) => '요청사항 ' + String(index + 1).padStart(3, '0') + ' 승인 내용').join('\n');
    const contract = await submitData({ ...base, email, shootRequestNotes: notes });
    await reviewSend(contract, 1025000, email, -50000, '요청사항 100');
  });
  await test('Explicit Demo also uses Moment prices, labels and MS prefix without calling GAS', async () => {
    Object.assign(process.env, { NODE_ENV: 'test', BACKEND_MODE: 'demo' });
    try {
      const before = h.deliveries.length;
      const result = await getBackendAdapter().submitContract({ formData: { ...base, partnerDiscount: false, email: 'moment-demo-customer@example.com' } });
      assert.equal(result.success, true); assert.ok(result.reviewUrl);
      const inspected = await getBackendAdapter().reviewContract(result.approvalToken);
      assert.match(inspected.contractNumber, /^MS-/); assert.equal(inspected.pricing.contractTotal, 1810000);
      clean(JSON.stringify(inspected), 'explicit Demo'); assert.equal(h.deliveries.length, before);
    } finally { Object.assign(process.env, { NODE_ENV: 'production', BACKEND_MODE: 'gas' }); }
  });
  await test('STRICT: production Core source has zero client-specific references outside Client Config/tests', () => {
    const productionFiles = [...walk('src'), ...walk('google-apps-script')].filter(file => /\.(tsx?|gs|js|json)$/.test(file));
    for (const file of productionFiles) {
      const normalized = file.replace(/\\/g, '/');
      if (normalized.startsWith('src/config/clients/') || normalized === 'src/config/client.ts') continue;
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        const match = forbidden.exec(line);
        if (match) sourceHits.push({ file: normalized, line: index + 1, sample: line.slice(Math.max(0, match.index - 35), match.index + 130) });
      });
    }
    fs.writeFileSync(path.join(artifacts, 'core-brand-residue.json'), JSON.stringify(sourceHits, null, 2));
    assert.equal(sourceHits.length, 0, JSON.stringify(sourceHits));
  });
  await test('STRICT: selected Moment production browser bundles have zero previous client branding', () => {
    for (const file of walk('.next/static').filter(file => file.endsWith('.js'))) {
      const text = fs.readFileSync(file, 'utf8');
      const markers = ['DEAR MEMORY', '디어메모리', '한민규', 'dearmemory.co.kr', '"DM"'].filter(marker => text.includes(marker));
      if (markers.length) bundleHits.push({ file: file.replace(/\\/g, '/'), markers });
    }
    fs.writeFileSync(path.join(artifacts, 'bundle-brand-residue.json'), JSON.stringify(bundleHits, null, 2));
    assert.equal(bundleHits.length, 0, JSON.stringify(bundleHits));
  });
}
h.seedPartnerCodes();
withRuntimeConfiguration(main).catch(error => {
  results.push({ name: 'suite setup/runtime', status: 'failed', error: String(error) }); console.error(error);
}).finally(async () => {
  await context?.close(); await browser?.close();
  if (server && server.exitCode === null) {
    server.kill(); await new Promise<void>(resolve => { server!.once('exit', () => resolve()); setTimeout(resolve, 3000).unref(); });
  }
  h.restore();
  const passed = results.filter(result => result.status === 'passed').length, failed = results.length - passed;
  fs.writeFileSync(path.join(artifacts, 'white-label-results.json'), JSON.stringify({
    results, passed, failed, matrixCount, pdfPages, pageErrors, sourceHits, bundleHits, selectedStudio: studio.displayName,
    configOnlyBase: process.env.WHITE_LABEL_CONFIG_ONLY_BASE || null, externalBusinessIO: 'Isolated actual API/Code.gs with in-memory Google I/O',
    homeEvidence: 'Actual Header/Home SSR rendered in browser; root app starts at Terms by existing design',
  }, null, 2));
  console.log('White-label regression: ' + passed + '/' + results.length + ' passed; ' + failed + ' failed');
  if (failed) process.exitCode = 1;
});
