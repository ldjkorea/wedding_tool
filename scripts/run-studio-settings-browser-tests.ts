import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { testTool } from './test-support/rasterPdf';
import { getStudioConfig, getProducts, getFormSchema, getClientContent } from '../src/services/configuration';

// Actual Next.js pages/APIs + local persistent Demo storage; no real Google writes.
const artifacts = path.resolve(process.env.SETTINGS_BROWSER_ARTIFACT_DIR || '.contract-test-output/settings-browser');
fs.mkdirSync(artifacts, { recursive: true });
const demoDirectory = path.join(artifacts, 'isolated-demo-store-' + crypto.randomUUID());
const file = path.join(demoDirectory, getStudioConfig().studioId + '.json');
let server: ChildProcess | undefined, browser: any, context: any, page: any, port = 0;
let output = '';
const errors: string[] = [], results: { name: string; status: string; error?: string }[] = [];
const password = crypto.randomBytes(24).toString('base64'), salt = crypto.randomBytes(16);
const privateUnusedCode = 'PRIVATE-' + crypto.randomBytes(16).toString('hex').toUpperCase();
const passwordHash = 'scrypt$16384$8$1$' + salt.toString('hex') + '$' + crypto.scryptSync(password, salt, 64).toString('hex');
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'failed', error: String(error) }); throw error; }
}
async function signIn() {
  await page.getByLabel('관리자 비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).waitFor();
}
async function saveSettings() {
  await page.getByRole('button', { name: '전체 변경 저장', exact: true }).click();
  await page.getByRole('dialog', { name: '저장할 변경사항 확인' }).waitFor();
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '설정 저장 및 재조회가 완료되었습니다.' }).waitFor();
}
async function main() {
  const socket = http.createServer(); await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
  port = (socket.address() as { port: number }).port; await new Promise<void>(resolve => socket.close(() => resolve()));
  // Next.js reconstructs its development request URL with localhost; match that origin.
  const origin = 'http://localhost:' + port;
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development', BACKEND_MODE: 'demo', STUDIO_SETTINGS_ENABLED: 'true',
    APP_URL: origin, REPRESENTATIVE_EMAIL: 'admin-browser@example.com', APP_SECRET: crypto.randomBytes(32).toString('hex'),
    STUDIO_ADMIN_PASSWORD_HASH: passwordHash, STUDIO_DEMO_SETTINGS_TEST_DIRECTORY: demoDirectory, NEXT_TELEMETRY_DISABLED: '1' };
  for (const name of ['NEXT_PUBLIC_APP_URL', 'STUDIO_REP_EMAIL', 'DEAR_MEMORY_REP_EMAIL']) delete env[name];
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-H', 'localhost', '-p', String(port)], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout?.on('data', chunk => { output += String(chunk); }); server.stderr?.on('data', chunk => { output += String(chunk); });
  const started = Date.now();
  while (true) {
    try {
      const res = await fetch(origin + '/master-control', { signal: AbortSignal.timeout(4000) }); if (res.status === 200) break;
    } catch {}
    if (Date.now() - started > 60000 || server.exitCode !== null) throw new Error('Admin browser server did not start: ' + output);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  browser = await testTool('playwright').chromium.launch({ channel: process.env.FLOW_BROWSER_CHANNEL || 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1366, height: 950 }, locale: 'ko-KR' });
  page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', (error: Error) => errors.push(String(error)));
  await context.route('**/*', async (route: any) => {
    if (new URL(route.request().url()).origin !== origin) await route.abort(); else await route.continue();
  });
  await test('Actual admin route has noindex/no-store, login shell contains no persisted settings', async () => {
    const response = await page.goto(origin + '/master-control');
    assert.match(response.headers()['x-robots-tag'], /noindex/); assert.match(response.headers()['cache-control'], /no-store/);
    await page.getByLabel('관리자 비밀번호', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '전체 변경 저장', exact: true }).count(), 0);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
    await page.screenshot({ path: path.join(artifacts, 'admin-login.png'), fullPage: true });
  });
  await test('Wrong login stays blocked, real login loads authenticated settings', async () => {
    await page.getByLabel('관리자 비밀번호').fill('wrong-password-fixture'); await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('status').waitFor(); assert.equal(await page.getByRole('button', { name: '로그아웃', exact: true }).count(), 0);
    await signIn(); assert.equal(await page.getByLabel('업체명', { exact: true }).inputValue(), getStudioConfig().studioName);
  });
  await test('Master changes six-digit Owner PIN without changing business revision', async () => {
    await page.getByRole('button', { name: '사장님 비밀번호', exact: true }).click();
    await page.getByText('미설정 · 초기 비밀번호 000000', { exact: true }).waitFor();
    const before = JSON.parse(fs.readFileSync(file, 'utf8')).current?.revision || 0;
    await page.getByLabel('새 비밀번호', { exact: true }).fill('152638');
    await page.getByLabel('새 비밀번호 확인', { exact: true }).fill('152638');
    await page.getByRole('button', { name: '사장님 비밀번호 변경', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '사장님 비밀번호를 변경했습니다.' }).waitFor();
    assert.equal(await page.getByLabel('새 비밀번호', { exact: true }).inputValue(), '');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).current?.revision || 0, before);
    await page.screenshot({ path: path.join(artifacts, 'owner-password-settings.png'), fullPage: true });
    const login = await context.request.post(origin + '/api/owner-control/pin', { headers: { Origin: origin }, data: { password: '152638' } });
    assert.equal(login.status(), 200);
    await page.getByRole('button', { name: '업체정보', exact: true }).click();
  });
  await test('Every menu explains purpose and locations; fields have help; advanced settings collapsed', async () => {
    for (const name of ['업체정보', '상품', '옵션', '할인 / 혜택', '계약정책', '고객 입력폼', '계약서 / 안내 문구']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByText('반영 위치:', { exact: true }).waitFor();
      const missing = await page.locator('input:not(:disabled),textarea,select').evaluateAll((fields: HTMLElement[]) => fields.filter(field => field.getAttribute('aria-label') !== '복구 revision' && !field.getAttribute('aria-describedby')).map(field => field.getAttribute('aria-label')));
      assert.deepEqual(missing, []);
      assert.equal(await page.locator('details[open]').count(), 0);
    }
    await page.getByRole('button', { name: '업체정보', exact: true }).click();
  });
  await test('Save confirmation explains actual changes; cancellation never writes revision', async () => {
    await page.getByLabel('표시명', { exact: true }).fill('저장 전 확인 예시');
    await page.getByRole('button', { name: '전체 변경 저장', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '저장할 변경사항 확인' }); await confirmation.waitFor();
    assert.match(await confirmation.innerText(), /표시명.*→ 저장 전 확인 예시/);
    await page.screenshot({ path: path.join(artifacts, 'admin-change-summary.png') });
    await page.getByRole('button', { name: '돌아가서 수정', exact: true }).click(); assert.equal(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).current?.revision || 0 : 0, 0);
    await page.getByLabel('표시명', { exact: true }).fill(getStudioConfig().displayName);
  });
  await test('Named weekday selector and native color picker update readable draft without saving', async () => {
    await page.getByRole('button', { name: '할인 / 혜택', exact: true }).click();
    const weekday = page.getByLabel('할인을 적용할 예식 요일', { exact: true });
    await weekday.selectOption('6'); assert.match(await page.getByRole('complementary', { name: '저장할 변경 요약' }).innerText(), /일요일 → 토요일/); await weekday.selectOption('0');
    await page.getByRole('button', { name: '업체정보', exact: true }).click();
    const color = page.getByLabel('기본 색상', { exact: true }); assert.equal(await color.getAttribute('type'), 'color');
    for (const value of ['#345678']) {
      await color.evaluate((input: HTMLInputElement, value: string) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, value);
      await page.getByText('선택한 색상: ' + value.toLowerCase(), { exact: true }).waitFor();
    }
    page.once('dialog', (dialog: any) => dialog.accept()); await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).find(button => button.textContent === '다시 불러오기')?.disabled === false);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).find(button => button.textContent === '전체 변경 저장')?.disabled);
    assert.equal(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).current?.revision || 0 : 0, 0);
  });
  await test('Brand edit persists after page reload without code changes', async () => {
    await page.getByLabel('업체명', { exact: true }).fill('운영자 브라우저 스튜디오');
    await page.getByLabel('표시명', { exact: true }).fill('BROWSER STUDIO');
    await page.getByLabel('사업자정보', { exact: true }).fill('테스트 사업자정보');
    await page.getByLabel('대표 이메일', { exact: true }).fill('saved-owner@example.com');
    await saveSettings(); await page.reload(); await page.getByLabel('업체명', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('업체명', { exact: true }).inputValue(), '운영자 브라우저 스튜디오');
    await page.screenshot({ path: path.join(artifacts, 'admin-studio.png'), fullPage: true });
  });
  await test('Product prices can be edited; invalid price never saved', async () => {
    await page.getByRole('button', { name: '상품', exact: true }).click();
    await page.getByLabel('가격 (원)', { exact: true }).first().fill('-1');
    await page.getByRole('button', { name: '전체 변경 저장', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '설정 검증' }).waitFor();
    await page.getByLabel('가격 (원)', { exact: true }).first().fill(String(getProducts()[0].basePrice + 100000));
    assert.ok((await page.getByRole('region', { name: '상품 목록' }).innerText()).includes((getProducts()[0].basePrice + 100000).toLocaleString('ko-KR') + '원'));
    const advanced = page.locator('details').first(); await advanced.locator('summary').click(); assert.equal(await advanced.getByLabel('ID', { exact: true }).getAttribute('readonly'), ''); await advanced.locator('summary').click();
    await page.getByLabel('상품명', { exact: true }).first().fill('브라우저 변경 상품');
    await saveSettings(); await page.screenshot({ path: path.join(artifacts, 'admin-products.png'), fullPage: true });
  });
  await test('Optional/required/hidden fields are saved through actual form controls', async () => {
    await page.getByRole('button', { name: '고객 입력폼', exact: true }).click();
    const notes = page.locator('fieldset').filter({ has: page.locator('legend').filter({ hasText: /^촬영 요청$/ }) }).last();
    await notes.getByLabel('필수', { exact: true }).check();
    await notes.getByLabel('표시 문구', { exact: true }).fill('브라우저 필수 촬영 요청');
    await saveSettings(); await page.screenshot({ path: path.join(artifacts, 'admin-form-schema.png'), fullPage: true });
  });
  await test('Administrator registers private code amounts and enabled state using actual controls', async () => {
    await page.getByRole('button', { name: '할인 / 혜택', exact: true }).click();
    await page.getByRole('button', { name: '할인코드 추가', exact: true }).click();
    await page.getByLabel('할인코드', { exact: true }).nth(0).fill('  browser-pair  ');
    await page.getByLabel('코드 할인금액 (원)', { exact: true }).nth(0).fill('75000');
    await page.getByRole('region', { name: '짝꿍 할인코드', exact: true }).getByLabel('활성', { exact: true }).nth(0).check();
    await page.getByRole('button', { name: '할인코드 추가', exact: true }).click();
    await page.getByLabel('할인코드', { exact: true }).nth(1).fill(privateUnusedCode);
    await page.getByRole('region', { name: '짝꿍 할인코드', exact: true }).getByLabel('활성', { exact: true }).nth(1).check();
    await saveSettings(); assert.equal(await page.getByLabel('할인코드', { exact: true }).nth(0).inputValue(), 'BROWSER-PAIR');
    await page.screenshot({ path: path.join(artifacts, 'admin-discount-codes.png'), fullPage: true });
  });
  await test('New product starts inactive with generated readonly ID and saves from basic controls', async () => {
    await page.getByRole('button', { name: '상품', exact: true }).click();
    await page.getByRole('button', { name: '상품 추가', exact: true }).click();
    await page.getByLabel('상품명', { exact: true }).last().fill('새 비활성 상품 테스트');
    assert.equal(await page.getByLabel('활성', { exact: true }).last().isChecked(), false);
    await saveSettings(); const stored = JSON.parse(fs.readFileSync(file, 'utf8')); const product = stored.current.settings.productsConfig.at(-1);
    assert.match(product.id, /^item_/); assert.equal(product.active, false); assert.equal(product.name, '새 비활성 상품 테스트');
  });
  await test('New term receives stable generated ID; saved policy contains entered body', async () => {
    await page.getByRole('button', { name: '계약정책', exact: true }).click();
    await page.getByRole('button', { name: '약관 추가', exact: true }).click();
    await page.getByLabel('제목', { exact: true }).last().fill('테스트 추가 약관');
    await page.getByLabel('본문', { exact: true }).last().fill('브라우저 테스트용 약관입니다. 실제 운영 정책이 아닙니다.');
    await saveSettings(); const term = JSON.parse(fs.readFileSync(file, 'utf8')).current.settings.contractPolicy.terms.at(-1); assert.match(term.id, /^item_/); assert.match(term.content, /브라우저 테스트용/);
  });
  await test('Optional Sheets menu explains OFF and creates one explicit local Demo mirror without business revision changes', async () => {
    await page.getByRole('button', { name: '외부 연동', exact: true }).click();
    await page.getByRole('region', { name: 'Google Sheets 계약목록', exact: true }).getByText('사용 안 함', { exact: true }).waitFor();
    assert.equal(await page.getByText('Spreadsheet ID', { exact: true }).count(), 0);
    page.on('dialog', (dialog: any) => dialog.accept());
    await page.getByLabel('Google Sheets 계약목록 사용', { exact: true }).click();
    await page.getByText('사용함 / 연결 안 됨', { exact: true }).waitFor();
    await page.getByRole('button', { name: '새 계약관리 Sheet 만들기', exact: true }).click();
    await page.getByText('사용함 / 정상 연결', { exact: true }).waitFor();
    await page.getByText('BROWSER STUDIO 계약관리', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Google Sheets에서 열기' }).count(), 0);
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).current.revision, 6);
    await page.screenshot({ path: path.join(artifacts,'admin-sheet-integration.png'), fullPage:true });
  });
  await test('Master Calendar diagnostics and operational controls preserve business history', async () => {
    const calendar = page.getByRole('region', { name: 'Google Calendar 촬영일정', exact: true }); await calendar.getByText('사용 안 함', { exact: true }).waitFor();
    await calendar.getByRole('checkbox', { name: 'Google Calendar 사용', exact: true }).click(); await calendar.getByRole('button', { name: '촬영 일정 캘린더 만들기', exact: true }).click(); await calendar.getByText('정상 연결됨', { exact: true }).waitFor();
    await calendar.locator('summary').filter({ hasText: '고급 연결 진단' }).click(); await calendar.getByText('Calendar ID 일부: LOCAL DEMO', { exact: true }).waitFor(); assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).current.revision,6);
    await page.screenshot({ path: path.join(artifacts,'master-calendar-diagnostics.png'), fullPage:true });
    await calendar.getByRole('checkbox', { name: 'Google Calendar 사용', exact: true }).click(); await calendar.getByText('사용 안 함', { exact: true }).waitFor();
  });
  await test('Duplicate create request reuses local mirror; business settings/history remain unchanged', async () => {
    const cookies = await context.cookies(), cookie = cookies.find((item: any) => item.name === 'studio_admin_session');
    const headers = {Cookie:cookie.name+'='+cookie.value,Origin:origin,'Content-Type':'application/json'};
    const initial = await (await fetch(origin+'/api/studio-control/sheet-integration',{headers})).json();
    const response = await fetch(origin+'/api/studio-control/sheet-integration',{method:'POST',headers,body:JSON.stringify({operation:'create',expectedRevision:initial.integration.revision})});
    assert.equal(response.status,200);assert.equal((await response.json()).integration.revision,initial.integration.revision);
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).current.revision,6);
  });
  await test('Customer uses saved branding/catalogue/form; no admin links or menus', async () => {
    // Compile the Demo mailbox before submission so dev hot reload cannot reset its in-memory mail.
    assert.equal((await fetch(origin + '/api/demo/mailbox')).status, 200);
    const customer = await context.newPage(); customer.setDefaultTimeout(20000);
    await customer.goto(origin); await customer.getByRole('heading', { name: 'BROWSER STUDIO', exact: true }).waitFor();
    const customerHtml = await customer.content();
    if (customerHtml.includes(privateUnusedCode)) fs.writeFileSync(path.join(artifacts, 'failed-private-flight.html'), customerHtml);
    assert.ok(!customerHtml.includes(privateUnusedCode));
    for (const src of await customer.locator('script[src]').evaluateAll((nodes: HTMLScriptElement[]) => nodes.map(node => node.src))) assert.ok(!(await (await fetch(src)).text()).includes(privateUnusedCode));
    assert.equal(await customer.locator('a[href*="studio-control"]').count(), 0); assert.ok(!(await customer.locator('body').innerText()).includes('업체 설정 관리'));
    await customer.getByRole('button', { name: /전체 펼쳐보기/ }).click();
    await customer.locator('.overflow-y-auto').evaluate((node: HTMLElement) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll', { bubbles: true })); });
    await customer.getByText('본식스냅 계약 약관 및 운영 정책의 내용을 모두 확인하였으며 이에 동의합니다.', { exact: false }).click();
    await customer.getByRole('button', { name: '동의하고 계약정보 작성 시작하기', exact: true }).click();
    await customer.getByText('브라우저 변경 상품', { exact: true }).waitFor();
    await customer.getByLabel(/브라우저 필수 촬영 요청/).waitFor();
    assert.ok((await customer.locator('body').innerText()).includes((getProducts()[0].basePrice + 100000).toLocaleString('ko-KR')));
    await customer.screenshot({ path: path.join(artifacts, 'customer-persisted-settings.png'), fullPage: true });
    await customer.getByRole('button', { name: /날짜를 눌러 달력에서/ }).click();
    await customer.locator('select').nth(0).selectOption('2027');
    await customer.locator('select').nth(1).selectOption('3');
    await customer.getByRole('button', { name: '17', exact: true }).click();
    await customer.getByPlaceholder('예: 더채플앳청담, 엘타워, 빌라드지디').fill('설정 회귀테스트 예식장');
    await customer.getByPlaceholder('예: 김민우').fill('설정테스트 신랑');
    await customer.getByPlaceholder('예: 이서연').fill('설정테스트 신부');
    for (const field of ['groomPhone', 'bridePhone', 'weddingHall'] as const) {
      if (getFormSchema()[field].enabled) await customer.locator('#contract-field-' + field).fill(field === 'weddingHall' ? '테스트 홀' : '010-1234-5678');
    }
    await customer.locator('#shoot-request-notes').fill('저장된 설정을 사용한 촬영 요청');
    if (getFormSchema().referralSource.enabled && getFormSchema().referralSource.required) {
      await customer.getByRole('button', { name: getClientContent().referralOptions[0], exact: true }).click();
    }
    await customer.locator('input[type="email"]').fill('settings-customer@example.com');
    await customer.getByLabel('짝꿍 할인코드', { exact: true }).fill('NOT-REGISTERED');
    await customer.getByRole('status').filter({ hasText: '등록되지 않았거나 사용 중지된 코드' }).waitFor();
    await customer.getByLabel('짝꿍 할인코드', { exact: true }).fill('  BrOwSeR-PaIr  ');
    await customer.getByRole('status').filter({ hasText: '75,000원 할인이 적용되었습니다.' }).waitFor();
    await customer.screenshot({ path: path.join(artifacts, 'customer-verified-code.png'), fullPage: true });
    await customer.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
    const submitted = customer.waitForResponse((response: any) => response.url().endsWith('/api/submit-contract') && response.request().method() === 'POST');
    await customer.getByRole('button', { name: '계약정보 제출하기', exact: true }).click();
    const submissionResponse = await submitted;
    assert.equal(submissionResponse.status(), 200, await submissionResponse.text());
    await customer.getByText('계약 신청이 정상 접수되었습니다', { exact: false }).waitFor();
    await customer.close();
  });
  await test('Actual Demo submission notification uses saved representative email and brand', async () => {
    const response = await fetch(origin + '/api/demo/mailbox'); assert.equal(response.status, 200);
    const body = await response.json();
    const notification = body.mailbox.find((mail: any) => mail.type === 'rep_notification');
    assert.ok(notification); assert.equal(notification.to, 'saved-owner@example.com');
    assert.match(notification.subject, /BROWSER STUDIO/);
    assert.match(notification.html, /브라우저 변경 상품/);
    assert.match(notification.html, /BROWSER-PAIR/); assert.match(notification.html, /75,000/);
  });
  await test('Customer submission mirrors only operational columns and OFF preserves the existing local list', async () => {
    const mirrorFile = path.join(demoDirectory,getStudioConfig().studioId+'-sheet-mirror.json');
    const mirror = JSON.parse(fs.readFileSync(mirrorFile,'utf8')), rows = Object.values(mirror.rows) as any[];
    assert.equal(rows.length,1);assert.equal(rows[0].email,'settings-customer@example.com');assert.equal(rows[0].code,'BROWSER-PAIR');
    assert.ok(!('requestNotes' in rows[0]));assert.ok(!('snapshot' in rows[0]));
    await page.getByRole('button',{name:'동기화 상태 확인',exact:true}).click();
    await page.getByText(/완료 1건/).waitFor();
    await page.getByLabel('Google Sheets 계약목록 사용',{exact:true}).click();
    await page.getByRole('region', { name: 'Google Sheets 계약목록', exact: true }).getByText('사용 안 함', { exact: true }).waitFor();
    const after=JSON.parse(fs.readFileSync(mirrorFile,'utf8'));assert.equal(after.enabled,false);assert.deepEqual(after.rows,mirror.rows);
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).current.revision,6);
  });
  await test('Paginated sync status retains earlier errors when a later page is healthy', async () => {
    const fixture={revision:2,enabled:true,connection:'error',name:'페이지 테스트 계약관리',url:'',createdAt:'',errorCode:'',counts:{pending:0,failed:1,unknown:0,synced:0},jobs:[{contractId:'cnt_page_fixture',contractNumber:'TEST-20270417-0001',status:'failed',errorCode:'SYNC_UNAVAILABLE',queuedAt:'',lastAttemptAt:''}],nextCursor:'next-page',demo:true,workerReady:true};
    await page.route('**/api/master-control/sheet-integration*',async(route:any)=>{
      const next=route.request().url().includes('cursor=');await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,integration:next?{...fixture,connection:'connected',counts:{pending:0,failed:0,unknown:0,synced:1},jobs:[],nextCursor:null}:fixture})});
    });
    await page.getByRole('button',{name:'동기화 상태 확인',exact:true}).click();
    await page.getByRole('button',{name:'다음 계약 상태 확인',exact:true}).click();
    await page.getByText('동기화 오류 / 확인 필요',{exact:true}).waitFor();
    await page.getByText(/동기화 오류 1건 · 대기 0건 · 완료 1건/).waitFor();
    await page.unroute('**/api/master-control/sheet-integration*');
    await page.getByRole('button',{name:'동기화 상태 확인',exact:true}).click();await page.getByRole('region', { name: 'Google Sheets 계약목록', exact: true }).getByText('사용 안 함', { exact: true }).waitFor();
  });
  await test('Mobile sees guidance only and performs no settings requests', async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const mobilePage = await mobile.newPage(), requests: string[] = [];
    mobilePage.on('request', (req: any) => { if (req.url().includes('/api/master-control/')) requests.push(req.url()); });
    await mobilePage.goto(origin + '/master-control'); await mobilePage.getByText('관리자 설정은 PC에서 이용해 주세요.', { exact: true }).waitFor();
    assert.equal(await mobilePage.locator('input').count(), 0); assert.deepEqual(requests, []);
    await mobilePage.screenshot({ path: path.join(artifacts, 'admin-mobile-guidance.png'), fullPage: true }); await mobile.close();
  });
  await test('Logout removes settings UI; copied browser cookie is revoked at backend', async () => {
    const cookies = await context.cookies(); const cookie = cookies.find((item: any) => item.name === 'studio_admin_session'); assert.ok(cookie?.httpOnly);
    await page.getByRole('button', { name: '로그아웃', exact: true }).click(); await page.getByLabel('관리자 비밀번호').waitFor();
    const res = await fetch(origin + '/api/studio-control/settings', { headers: { Cookie: cookie.name + '=' + cookie.value } }); assert.equal(res.status, 401);
    assert.equal(await page.getByRole('button', { name: '전체 변경 저장', exact: true }).count(), 0);
  });
  await test('No credentials in browser storage or delivered JavaScript', async () => {
    const state = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })); assert.deepEqual(state, { local: [], session: [] });
    for (const src of await page.locator('script[src]').evaluateAll((nodes: HTMLScriptElement[]) => nodes.map(node => node.src))) {
      const text = await (await fetch(src)).text(); for (const secret of [password, passwordHash, env.APP_SECRET!]) assert.ok(!text.includes(secret));
    }
    assert.deepEqual(errors, []);
  });
  await test('Core field policy retained and persisted file contains only local Demo data', async () => {
    const stored = JSON.parse(fs.readFileSync(file, 'utf8')); assert.equal(stored.current.revision, 6);
    assert.equal(stored.current.settings.formSchema.weddingHall.enabled, getFormSchema().weddingHall.enabled);
    assert.ok(!JSON.stringify(stored.current).includes(passwordHash));
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await context?.close(); await browser?.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise<void>(resolve => { server!.once('exit', () => resolve()); setTimeout(resolve, 5000); }); }
  if (fs.existsSync(file)) fs.renameSync(file, path.join(artifacts, 'generated-demo-store.json'));
  fs.writeFileSync(path.join(artifacts, 'browser-server.log'), output);
  fs.writeFileSync(path.join(artifacts, 'settings-browser-results.json'), JSON.stringify({ results, passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length, errors, liveGoogleIO: false, productionSessionCookieVerifiedInServerTests: true }, null, 2));
});
