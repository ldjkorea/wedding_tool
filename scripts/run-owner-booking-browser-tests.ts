import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { testTool } from './test-support/rasterPdf';
import { getProducts, getClientContent } from '../src/services/configuration';
import { configurationBinding } from '../src/lib/contractWorkflow';
const artifacts = path.resolve(
  process.env.BOOKING_BROWSER_ARTIFACT_DIR || '.contract-test-output/booking-browser',
);
fs.mkdirSync(artifacts, { recursive: true });
const hash = (value: string) => {
  const salt = crypto.randomBytes(16);
  return (
    'scrypt$16384$8$1$' +
    salt.toString('hex') +
    '$' +
    crypto.scryptSync(value, salt, 64).toString('hex')
  );
};
const pin = String(crypto.randomInt(100000, 1000000));
let server: ChildProcess | undefined,
  browser: any,
  page: any,
  context: any,
  origin = '',
  output = '';
const results: { name: string; status: string; error?: string }[] = [],
  errors: string[] = [];
async function test(name: string, task: () => Promise<void>) {
  try {
    await task();
    results.push({ name, status: 'passed' });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, status: 'failed', error: String(error) });
    await page?.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true });
    throw error;
  }
}
async function main() {
  const socket = http.createServer();
  await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  origin = 'http://localhost:' + port;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    BACKEND_MODE: 'demo',
    STUDIO_SETTINGS_ENABLED: 'true',
    APP_URL: origin,
    APP_SECRET: crypto.randomBytes(32).toString('hex'),
    REPRESENTATIVE_EMAIL: 'booking-test@example.com',
    STUDIO_OWNER_PASSWORD_HASH: hash(pin),
    MASTER_ADMIN_PASSWORD_HASH: hash(crypto.randomBytes(24).toString('hex')),
    STUDIO_DEMO_SETTINGS_TEST_DIRECTORY: path.join(
      artifacts,
      'private-store-' + crypto.randomUUID(),
    ),
    NEXT_TELEMETRY_DISABLED: '1',
  };
  for (const key of [
    'NEXT_PUBLIC_APP_URL',
    'STUDIO_REP_EMAIL',
    'DEAR_MEMORY_REP_EMAIL',
    'GAS_WEBAPP_URL',
    'GAS_SHARED_SECRET',
    'STUDIO_ADMIN_PASSWORD_HASH',
  ])
    delete env[key];
  server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '-H', 'localhost', '-p', String(port)],
    { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  server.stdout?.on('data', (value) => (output += String(value)));
  server.stderr?.on('data', (value) => (output += String(value)));
  const start = Date.now();
  while (true) {
    try {
      if ((await fetch(origin, { signal: AbortSignal.timeout(3000) })).status === 200) break;
    } catch {}
    if (Date.now() - start > 90000) throw new Error('Demo server start failed');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  for (const route of [
    '/owner',
    '/review',
    '/api/owner-control/auth',
    '/api/owner-control/bookings',
    '/api/owner-control/contract',
    '/api/owner-control/pin',
    '/api/submit-contract',
  ])
    await fetch(origin + route);
  browser = await testTool('playwright').chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ko-KR',
    timezoneId: 'America/Los_Angeles',
    isMobile: true,
  });
  page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', (error: Error) => errors.push(String(error)));
  await context.route('**/*', (route: any) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await test('Customer has no reservation list; four logo taps do not navigate and fifth opens login', async () => {
    await page.goto(origin);
    const logo = page.getByRole('button', { name: '브랜드 로고', exact: true }).first();
    for (let i = 0; i < 4; i++) await logo.click();
    assert.equal(new URL(page.url()).pathname, '/');
    await logo.click();
    await page.getByRole('heading', { name: '사장님 로그인', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/owner');
    assert.equal(await page.getByRole('region', { name: '예약 목록', exact: true }).count(), 0);
    const response = await context.request.get(origin + '/api/owner-control/bookings');
    assert.equal(response.status(), 401);
  });
  await test('Mobile six-digit input masks digits, rejects wrong PIN and opens authenticated empty calendar', async () => {
    const input = page.getByLabel('비밀번호 6자리');
    assert.equal(await input.getAttribute('inputmode'), 'numeric');
    assert.equal(await input.getAttribute('type'), 'password');
    await input.fill(pin === '999999' ? '999998' : '999999');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('alert').waitFor();
    await input.fill(pin);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('heading', { name: '예약현황', exact: true }).waitFor();
    await page.getByText('표시할 예약이 없습니다.', { exact: true }).waitFor();
  });
  const today = new Date(),
    date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 24))
      .toISOString()
      .slice(0, 10);
  let id = '';
  await test('Actual Demo receipt appears across server routes with no leaked contact or token data', async () => {
    const data = {
      weddingDate: date,
      weddingTime: '13:30',
      weddingVenue: 'TEST 예약웨딩홀',
      weddingHall: '테스트홀',
      groomName: '테스트신랑',
      brideName: '테스트신부',
      groomPhone: '010-1111-2222',
      bridePhone: '010-3333-4444',
      email: 'booking-mobile@example.com',
      productId: getProducts()[0].id,
      optionIds: [],
      partnerDiscount: false,
      partnerName: '',
      sundayDiscount: false,
      portfolioConsent: false,
      reviewContractCashback: false,
      reviewMainCashback: false,
      termsAgreed: true,
      requestNotes: '',
      referralSource: getClientContent().referralOptions[0],
    };
    const response = await context.request.post(origin + '/api/submit-contract', {
      headers: { Origin: origin, 'X-Contract-Configuration': configurationBinding() },
      data,
    });
    assert.equal(response.status(), 200, await response.text());
    id = (await response.json()).contractId;
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await page.getByRole('button', { name: '대표 확인 대기 1건', exact: true }).waitFor();
    const list = await (await context.request.get(origin + '/api/owner-control/bookings')).json();
    assert.equal(list.bookings[0].contractId, id);
    assert.ok(!JSON.stringify(list).includes('booking-mobile@example.com'));
  });
  await test('Month/date selection and pending filter show correct names time venue and review link', async () => {
    await page.getByRole('button', { name: '다음 달', exact: true }).click();
    await page.getByRole('button', { name: date + ' 예약 1건', exact: true }).click();
    await page.getByRole('heading', { name: '테스트신랑 · 테스트신부', exact: true }).waitFor();
    assert.match(
      await page.getByRole('region', { name: '예약 목록', exact: true }).innerText(),
      /13:30/,
    );
    await page.getByRole('button', { name: '대표 확인 대기 1건', exact: true }).click();
    assert.equal(
      await page.getByRole('link', { name: '내용 확인하기', exact: true }).getAttribute('href'),
      '/review?ownerContract=' + id,
    );
  });
  await test('Mobile and desktop have no overflow with stacked/side-by-side calendar layout', async () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => {
        const a = document.querySelector('.booking-calendar')!.getBoundingClientRect(),
          b = document.querySelector('.booking-list')!.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          aligned: Math.abs(a.top - b.top) < 1,
          stacked: b.top >= a.bottom,
        };
      });
      assert.equal(layout.overflow, false);
      assert.equal(width > 900 ? layout.aligned : layout.stacked, true);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: path.join(artifacts, 'bookings-' + width + '.png'),
          fullPage: true,
        });
    }
  });
  await test('Authenticated Review uses same contract without token URL and GET does not send', async () => {
    const before = await (await context.request.get(origin + '/api/demo/mailbox')).json();
    await page.getByRole('link', { name: '내용 확인하기', exact: true }).click();
    await page.getByText('TEST 예약웨딩홀', { exact: false }).first().waitFor();
    assert.ok(!page.url().includes('token='));
    const after = await (await context.request.get(origin + '/api/demo/mailbox')).json();
    assert.equal(JSON.stringify(before), JSON.stringify(after));
    assert.equal(
      (await context.request.get(origin + '/api/owner-control/contract?id=' + id)).status(),
      200,
    );
  });
  await test('Logout removes calendar and captured cookie cannot reopen private data', async () => {
    await page.goto(origin + '/owner');
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await page.getByRole('heading', { name: '사장님 로그인', exact: true }).waitFor();
    assert.equal((await context.request.get(origin + '/api/owner-control/bookings')).status(), 401);
    assert.equal(await page.getByRole('region', { name: '예약 목록', exact: true }).count(), 0);
  });
  assert.deepEqual(errors, []);
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    if (server && server.exitCode === null) {
      const child = server,
        stopped = new Promise<void>((resolve) => child.once('exit', () => resolve()));
      child.kill();
      await stopped;
    }
    fs.writeFileSync(
      path.join(artifacts, 'booking-browser-results.json'),
      JSON.stringify(
        {
          passed: results.filter((x) => x.status === 'passed').length,
          failed: results.filter((x) => x.status === 'failed').length,
          results,
          errors,
          realGoogleIO: false,
          physicalMobile: false,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(artifacts, 'server.log'), output);
  });
