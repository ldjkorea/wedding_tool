import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { testTool } from './test-support/rasterPdf';
import { getStudioConfig, getProducts } from '../src/services/configuration';

const artifacts = path.resolve(process.env.OWNER_BROWSER_ARTIFACT_DIR || '.contract-test-output/owner-browser'); fs.mkdirSync(artifacts, { recursive: true });
const directory = path.join(artifacts, 'private-demo-store-' + crypto.randomUUID()), file = path.join(directory, getStudioConfig().studioId + '.json');
const password = crypto.randomBytes(24).toString('base64'), masterPassword = crypto.randomBytes(24).toString('base64');
function hash(value: string) { const salt = crypto.randomBytes(16); return 'scrypt$16384$8$1$' + salt.toString('hex') + '$' + crypto.scryptSync(value, salt, 64).toString('hex'); }
const results: { name: string; status: string; error?: string }[] = [], errors: string[] = [];
let server: ChildProcess | undefined, browser: any, page: any, context: any, output = '', origin = '';
const startedAt = Date.now();
async function test(name: string, run: () => Promise<void>) { try { await run(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); } catch (error) { results.push({ name, status: 'failed', error: String(error) }); await page?.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); throw error; } }
const state = () => JSON.parse(fs.readFileSync(file, 'utf8'));
async function save() { await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await page.getByRole('dialog', { name: '변경사항 확인' }).waitFor(); await page.getByRole('button', { name: '저장', exact: true }).click(); await page.getByRole('status').filter({ hasText: '변경사항을 저장했습니다.' }).waitFor(); }
async function menu(name: string) { await page.getByRole('button', { name: '운영 메뉴', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); }
async function main() {
  const socket = http.createServer(); await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve)); const port = (socket.address() as { port: number }).port; await new Promise<void>(resolve => socket.close(() => resolve())); origin = 'http://localhost:' + port;
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development', BACKEND_MODE: 'demo', STUDIO_SETTINGS_ENABLED: 'true', APP_URL: origin, REPRESENTATIVE_EMAIL: 'role-browser@example.com', APP_SECRET: crypto.randomBytes(32).toString('hex'), STUDIO_ADMIN_PASSWORD_HASH: hash(masterPassword), STUDIO_OWNER_PASSWORD_HASH: hash(password), STUDIO_DEMO_SETTINGS_TEST_DIRECTORY: directory, NEXT_TELEMETRY_DISABLED: '1' };
  for (const key of ['NEXT_PUBLIC_APP_URL','STUDIO_REP_EMAIL','DEAR_MEMORY_REP_EMAIL','MASTER_ADMIN_PASSWORD_HASH']) delete (env as NodeJS.ProcessEnv)[key];
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','-H','localhost','-p',String(port)], { env, windowsHide: true, stdio: ['ignore','pipe','pipe'] }); server.stdout?.on('data', value => { output += String(value); }); server.stderr?.on('data', value => { output += String(value); });
  const start = Date.now(); while (true) { try { if ((await fetch(origin + '/studio-control', { signal: AbortSignal.timeout(4000) })).status === 200) break; } catch {} if (Date.now() - start > 60000 || server.exitCode !== null) throw new Error('Isolated browser server did not start'); await new Promise(resolve => setTimeout(resolve, 300)); }
  // Compile shared Demo/server modules before interactions. Next dev compilation can
  // reload the mounted client, which is separate from a delayed settings response.
  for (const route of ['/master-control','/api/owner-control/settings','/api/owner-control/auth','/api/owner-control/sheet-integration','/api/owner-control/calendar-integration','/api/master-control/settings','/api/master-control/auth','/api/demo/mailbox','/']) await fetch(origin + route);
  browser = await testTool('playwright').chromium.launch({ channel: process.env.FLOW_BROWSER_CHANNEL || 'chrome', headless: true }); context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' }); page = await context.newPage(); page.setDefaultTimeout(25000); page.on('pageerror', (error: Error) => errors.push(String(error)));
  await context.route('**/*', async (route: any) => { if (new URL(route.request().url()).origin !== origin) await route.abort(); else await route.continue(); });
  await test('Distinct no-store/noindex Owner and Master login shells contain no settings', async () => {
    for (const [url, label] of [['/master-control','관리자 비밀번호'],['/studio-control','대표 비밀번호']]) { const response = await page.goto(origin + url); assert.match(response.headers()['cache-control'], /no-store/); assert.match(response.headers()['x-robots-tag'], /noindex/); await page.getByLabel(label).waitFor(); assert.equal(await page.getByRole('button', { name: '상품 관리', exact: true }).count(), 0); }
  });
  await test('Owner login shows six operational cards with no Master route, IDs, hash or schema vocabulary', async () => {
    await page.getByLabel('대표 비밀번호').fill(password); await page.getByRole('button', { name: '로그인', exact: true }).click(); await page.getByRole('button', { name: '상품 관리', exact: true }).waitFor();
    for (const name of ['상품 관리','옵션 관리','할인 관리','할인코드 관리','Google Sheets 설정','Google Calendar 설정']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1);
    const text = await page.locator('main').innerText(); assert.ok(!/studioId|internal ID|contractPrefix|revision|Snapshot|schema|HMAC|GAS|API|master-control/i.test(text)); assert.equal(await page.locator('a[href*="master-control"]').count(), 0); await page.screenshot({ path: path.join(artifacts, 'owner-home.png'), fullPage: true });
  });
  await test('Operational cards align by row at four desktop widths and keyboard focus is visible', async () => {
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, cards: Array.from(document.querySelectorAll('.admin-menu-card')).map(card => {
        const rect = card.getBoundingClientRect(), button = card.querySelector('button')!.getBoundingClientRect();
        return { top: rect.top, height: rect.height, buttonBottom: button.bottom, buttonHeight: button.height };
      }) }));
      assert.equal(layout.overflow, false); assert.equal(layout.cards.length, 6);
      for (const card of layout.cards) {
        assert.ok(card.buttonHeight >= 44);
        for (const peer of layout.cards.filter((item: { top: number }) => Math.abs(item.top - card.top) < 1)) {
          assert.ok(Math.abs(card.height - peer.height) <= 1); assert.ok(Math.abs(card.buttonBottom - peer.buttonBottom) <= 1);
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: '상품 관리', exact: true }).focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => { const style = getComputedStyle(document.activeElement!); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2; }), true);
  });
  await test('Integration headings, control alignment and collapsed guidance stay readable', async () => {
    for (const name of ['Google Calendar 설정', 'Google Sheets 설정']) {
      await menu(name); await page.locator('.integration-grid').waitFor();
      for (const width of [1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.locator('.integration-heading h2').count(), 1);
        assert.equal(await page.locator('.integration-more[open]').count(), 0);
        const layout = await page.evaluate(() => {
          const panels = Array.from(document.querySelectorAll('.integration-grid > *')).map(node => node.getBoundingClientRect());
          return { overflow: document.documentElement.scrollWidth > innerWidth, aligned: Math.abs(panels[0].top - panels[1].top) < 1,
            smallTargets: Array.from(document.querySelectorAll('.integration-screen button, .integration-screen select, .integration-toggle')).filter(node => node.getBoundingClientRect().height < 44).length };
        });
        assert.equal(layout.overflow, false); assert.equal(layout.aligned, true); assert.equal(layout.smallTargets, 0);
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await test('Long Calendar names and failure messages wrap without hiding recovery actions', async () => {
    await page.route('**/api/owner-control/calendar-integration', async (route: any) => {
      const response = await route.fetch(), body = await response.json();
      body.integration = { ...body.integration, enabled: true, connection: 'connected', name: 'TEST 긴 촬영업체 이름과 지점 안내 '.repeat(12),
        counts: { pending: 0, failed: 1, unknown: 0, synced: 0 }, jobs: [{ contractId: 'TEST_LAYOUT', contractNumber: 'TEST-' + 'LONG'.repeat(40), status: 'failed', errorCode: 'CALENDAR_MISSING', lastAttemptAt: '' }] };
      await route.fulfill({ response, json: body });
    });
    await menu('Google Calendar 설정'); await page.getByRole('button', { name: '다시 등록', exact: true }).waitFor();
    await page.setViewportSize({ width: 1024, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.getByRole('button', { name: '다시 등록', exact: true }).isEnabled(), true);
    await page.screenshot({ path: path.join(artifacts, 'owner-long-error-layout.png'), fullPage: true });
    await page.unroute('**/api/owner-control/calendar-integration'); await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await test('Initial session load shows progress instead of flashing a second login form', async () => {
    let first = true, heldRoute: any, heldResponse: any, release: () => void = () => {};
    const captured = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/owner-control/settings', async (route: any) => {
      if (first && route.request().method() === 'GET') { first = false; heldRoute = route; heldResponse = await route.fetch(); release(); } else await route.continue();
    });
    await page.goto(origin + '/studio-control'); await captured;
    assert.equal(await page.getByLabel('대표 비밀번호').count(),0);
    await page.getByRole('status').filter({hasText:'로그인 상태와 운영 설정'}).waitFor();
    await heldRoute.fulfill({response:heldResponse});
    await page.getByRole('button',{name:'상품 관리',exact:true}).waitFor(); await menu('상품 관리');
    await page.getByLabel('상품 가격',{exact:true}).fill(String(getProducts()[0].basePrice+200000));
    assert.equal(Number(await page.getByLabel('상품 가격',{exact:true}).inputValue()),getProducts()[0].basePrice+200000);
    await page.unroute('**/api/owner-control/settings'); await page.getByLabel('상품 가격', { exact: true }).fill(String(getProducts()[0].basePrice));
  });
  await test('Price input has immediate formatted preview and invalid integer warning', async () => {
    await menu('상품 관리'); await page.getByLabel('상품 가격', { exact: true }).fill('1350000'); await page.getByText('고객에게 표시: 1,350,000원', { exact: true }).waitFor();
    await page.getByLabel('상품 가격', { exact: true }).fill('-1'); await page.locator('main').getByRole('alert').waitFor(); await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByLabel('상품 가격', { exact: true }).fill(String(getProducts()[0].basePrice + 100000));
    assert.equal(await page.locator('input[readonly]').count(), 0); await page.screenshot({ path: path.join(artifacts, 'owner-product-editor.png'), fullPage: true });
  });
  await test('Readable price summary, cancel without mutation, final save and customer price agree', async () => {
    const before = state().current?.revision || 0; await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '변경사항 확인' }); await dialog.waitFor(); assert.match(await dialog.innerText(), /가격: .*원 → .*원/); assert.ok(!/revision|hash|Snapshot/i.test(await dialog.innerText())); await page.getByRole('button', { name: '취소', exact: true }).click(); assert.equal(state().current?.revision || 0, before);
    await save(); assert.equal(state().current.actor, 'owner'); assert.equal(state().current.settings.productsConfig[0].price, getProducts()[0].basePrice + 100000);
    const customer = await context.newPage(); await customer.goto(origin + '/');
    await customer.getByRole('button', { name: /전체 펼쳐보기/ }).click();
    await customer.locator('.overflow-y-auto').evaluate((node: HTMLElement) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll', { bubbles: true })); });
    await customer.getByText('본식스냅 계약 약관 및 운영 정책의 내용을 모두 확인하였으며 이에 동의합니다.', { exact: false }).click();
    await customer.getByRole('button', { name: '동의하고 계약정보 작성 시작하기', exact: true }).click();
    await customer.getByText(getProducts()[0].name, { exact: true }).first().waitFor(); assert.match(await customer.locator('body').innerText(), new RegExp((getProducts()[0].basePrice + 100000).toLocaleString('ko-KR'))); await customer.close();
  });
  await test('Discount code add/edit/deactivate without technical ID fields; stored code is normalized', async () => {
    await menu('할인코드 관리'); await page.getByRole('button', { name: '+ 할인코드 추가', exact: true }).click(); await page.getByLabel('할인코드', { exact: true }).fill(' friend50 '); await page.getByLabel('할인 / 혜택 금액', { exact: true }).fill('50000'); await page.getByLabel('사용 여부').check(); await save(); assert.equal(state().current.settings.partnerCodes[0].code, 'FRIEND50'); assert.equal(state().current.settings.partnerCodes[0].amount, 50000);
    await page.screenshot({ path: path.join(artifacts, 'owner-discount-codes.png'), fullPage: true }); await page.getByLabel('사용 여부').uncheck(); await save(); assert.equal(state().current.settings.partnerCodes[0].active, false);
  });
  await test('Options and benefits expose safe condition and timing controls', async () => {
    await menu('옵션 관리'); await page.getByLabel('옵션 가격', { exact: true }).fill('150000'); await save(); assert.equal(state().current.settings.optionsConfig[0].price, 150000);
    await menu('할인 관리'); await page.getByLabel('할인 / 혜택 금액', { exact: true }).fill('60000'); await save(); assert.equal(state().current.settings.discountsConfig[0].amount, 60000); assert.equal(await page.getByLabel('적용 방식', {exact:true}).count(), 1); assert.equal(await page.getByRole('button',{name:'+ 혜택 추가',exact:true}).count(),1); assert.equal(await page.getByRole('button',{name:'이 항목 제거',exact:true}).count(),1);
  });
  await test('Owner Calendar ON/create/duration/OFF persists separately with readable preview', async () => {
    await menu('Google Calendar 설정'); const toggle = page.getByRole('checkbox', { name: 'Google Calendar 사용', exact: true }); await toggle.waitFor(); const revision = state().current.revision;
    page.once('dialog', (dialog: any) => dialog.accept()); await toggle.click(); await page.getByRole('button', { name: '촬영 일정 캘린더 만들기', exact: true }).waitFor(); await page.getByRole('button', { name: '촬영 일정 캘린더 만들기', exact: true }).click(); await page.getByText('정상 연결됨', { exact: true }).waitFor();
    page.once('dialog', (dialog: any) => dialog.accept()); await page.getByLabel('캘린더 표시시간', { exact: true }).selectOption('240'); await page.getByText('2026.10.24 · 13:00 ~ 17:00 (서울)', { exact: true }).waitFor();
    assert.equal(state().current.revision, revision); const calendarFile = path.join(directory, getStudioConfig().studioId + '-calendar-mirror.json'); assert.equal(JSON.parse(fs.readFileSync(calendarFile,'utf8')).durationMinutes, 240);
    assert.match(await page.locator('main').innerText(), /실제 Google Calendar나 일정은 생성하지 않습니다/); assert.ok(!/calendarId|eventId|revision|Snapshot|GAS|API/.test(await page.locator('main').innerText()));
    await page.screenshot({ path: path.join(artifacts, 'owner-google-calendar.png'), fullPage: true });
    page.once('dialog', (dialog: any) => dialog.accept()); await toggle.click(); await page.getByText('사용 안 함', { exact: true }).waitFor(); assert.equal(state().current.revision, revision); assert.ok(JSON.parse(fs.readFileSync(calendarFile,'utf8')).name);
  });
  await test('Owner Sheets ON/create/OFF remains independent and clearly identifies local simulation', async () => {
    await menu('Google Sheets 설정'); const toggle = page.getByRole('checkbox', { name: '자동 동기화 사용 (기본 OFF)' }); await toggle.waitFor(); const revision = state().current.revision;
    page.once('dialog', (dialog: any) => dialog.accept()); await toggle.click(); await page.getByRole('button', { name: '새 계약관리 Sheet 만들기' }).waitFor(); await page.getByRole('button', { name: '새 계약관리 Sheet 만들기' }).click(); await page.getByText('사용함 / 정상 연결', { exact: true }).waitFor(); assert.equal(state().current.revision, revision);
    assert.match(await page.locator('main').innerText(), /실제 Google 파일은 만들지 않습니다/); assert.ok(!/revision|Snapshot|Record|Spreadsheet ID|GAS|Folder ID|Sync ID/i.test(await page.locator('main').innerText())); await page.screenshot({ path: path.join(artifacts, 'owner-google-sheets.png'), fullPage: true });
    page.once('dialog', (dialog: any) => dialog.accept()); await toggle.click(); await page.getByText('사용 안 함', { exact: true }).waitFor(); assert.equal(state().current.revision, revision);
  });
  await test('Owner cookie cannot open authenticated Master UI or call its API', async () => {
    const response = await context.request.get(origin + '/api/master-control/settings'); assert.equal(response.status(), 401); await page.goto(origin + '/master-control'); await page.getByLabel('관리자 비밀번호').waitFor(); assert.equal(await page.getByRole('button', { name: '전체 변경 저장', exact: true }).count(), 0);
  });
  await test('Master login preserves full editor/history and sees Owner results', async () => {
    await page.getByLabel('관리자 비밀번호').fill(masterPassword); await page.getByRole('button', { name: '로그인', exact: true }).click(); await page.getByRole('heading', { name: '이전 설정 복구' }).waitFor(); await page.getByRole('button', { name: '상품', exact: true }).click(); assert.equal(Number(await page.getByLabel('가격 (원)', { exact: true }).first().inputValue()), getProducts()[0].basePrice + 100000); assert.match(await page.getByLabel('복구 revision').innerText(), /업체대표/);
  });
  await test('Owner stale edit reports readable conflict and cannot overwrite Master change', async () => {
    await page.goto(origin + '/studio-control'); await page.getByRole('button', { name: '상품 관리', exact: true }).waitFor(); await menu('상품 관리'); await page.getByLabel('상품 가격', { exact: true }).fill('1600000');
    const head = await (await context.request.get(origin + '/api/master-control/settings')).json(); head.settings.studioConfig.displayName = 'CONCURRENT MASTER'; assert.equal((await context.request.put(origin + '/api/master-control/settings', { headers: { Origin: origin }, data: { settings: head.settings, expectedRevision: head.revision } })).status(), 200);
    await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await page.getByRole('button', { name: '저장', exact: true }).click(); await page.getByRole('status').filter({ hasText: '다른 곳에서 설정이 변경되었습니다.' }).waitFor(); assert.equal(state().current.settings.productsConfig[0].price, getProducts()[0].basePrice + 100000); await page.getByRole('button', { name: '취소', exact: true }).click(); page.once('dialog', (dialog: any) => dialog.accept()); await page.getByRole('button', { name: '최신 내용 불러오기', exact: true }).click(); await page.getByRole('button', { name: '변경사항 저장', exact: true }).waitFor({ state: 'detached' });
  });
  await test('Network loss shows uncertain save guidance without raw error or success', async () => {
    await page.getByLabel('상품 가격', { exact: true }).fill('1650000'); const revision = state().current.revision;
    await page.route('**/api/owner-control/settings', async (route: any) => route.request().method() === 'PUT' ? route.abort() : route.continue()); await page.getByRole('button', { name: '변경사항 저장', exact: true }).click(); await page.getByRole('button', { name: '저장', exact: true }).click(); await page.getByRole('status').filter({ hasText: '저장 결과를 확인하지 못했습니다.' }).waitFor(); assert.equal(state().current.revision, revision); assert.ok(!/Failed to fetch|TypeError|stack|success/i.test(await page.getByRole('status').innerText())); await page.unroute('**/api/owner-control/settings'); await page.getByRole('button', { name: '취소', exact: true }).click();
  });
  await test('Owner logout clears private draft and leaves separate Master login usable', async () => {
    await page.getByRole('button', { name: '로그아웃', exact: true }).click(); await page.getByLabel('대표 비밀번호').waitFor(); assert.equal(await page.getByLabel('상품 가격', { exact: true }).count(), 0); assert.equal((await context.request.get(origin + '/api/master-control/settings')).status(), 200);
  });
  await test('Desktop-first policy preserved on mobile without broadening administrative editing', async () => {
    for (const width of [320, 390, 768, 1023]) {
      await page.setViewportSize({ width, height: 844 }); await page.goto(origin + '/studio-control'); await page.getByRole('heading', { name: '운영 설정은 PC에서 이용해 주세요.' }).waitFor(); assert.equal(await page.getByLabel('대표 비밀번호').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(artifacts, 'owner-mobile-policy.png'), fullPage: true });
  });
  assert.deepEqual(errors, []);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); if (server && server.exitCode === null) { const child = server; const stopped = new Promise<void>(resolve => child.once('exit', () => resolve())); child.kill(); await stopped; }
  fs.writeFileSync(path.join(artifacts, 'owner-browser-results.json'), JSON.stringify({ passed: results.filter(item => item.status === 'passed').length, failed: results.filter(item => item.status === 'failed').length, results, errors, durationSeconds: (Date.now() - startedAt) / 1000, realGoogleIO: false, physicalOwnerUsability: false }, null, 2)); fs.writeFileSync(path.join(artifacts, 'server.log'), output);
});
