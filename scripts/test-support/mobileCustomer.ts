import assert from 'node:assert/strict';
import { getFormSchema, getClientContent } from '../../src/services/configuration';
import type { installGasHarness } from './gasHarness';

/** Chrome mobile viewport/UA simulation. This is not physical Android/iOS/Kakao evidence. */
export async function exerciseMobileCustomer(page: any, h: ReturnType<typeof installGasHarness>, baseUrl: string, screenshot: string, email: string) {
  const schema = getFormSchema();
  async function fill(invalidChecks: boolean) {
    await page.goto(baseUrl);
    await page.getByRole('button', { name: /전체 펼쳐보기/ }).click();
    await page.locator('.overflow-y-auto').evaluate((element: HTMLElement) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll', { bubbles: true })); });
    await page.getByText('본식스냅 계약 약관 및 운영 정책의 내용을 모두 확인하였으며 이에 동의합니다.', { exact: false }).click();
    await page.getByRole('button', { name: '동의하고 계약정보 작성 시작하기', exact: true }).click();
    await page.getByRole('button', { name: /날짜를 눌러 달력에서/ }).click();
    await page.locator('select').nth(0).selectOption('2027'); await page.locator('select').nth(1).selectOption('3');
    await page.getByRole('button', { name: /^17(?:\s+할인)?$/ }).click();
    await page.getByPlaceholder('예: 더채플앳청담, 엘타워, 빌라드지디').fill('모바일 테스트 예식장');
    await page.getByPlaceholder('예: 김민우').fill('모바일 신랑'); await page.getByPlaceholder('예: 이서연').fill('모바일 신부');
    for (const key of ['groomPhone', 'bridePhone', 'weddingHall'] as const) {
      if (schema[key].enabled && (schema[key].required || key === 'groomPhone')) {
        await page.locator('input[id="contract-field-' + key + '"]').fill(h.form[key]);
      }
    }
    for (const key of ['shootRequestNotes', 'retouchRequestNotes', 'requestNotes'] as const) {
      if (schema[key].enabled && schema[key].required) await page.getByPlaceholder(schema[key].placeholder, { exact: true }).fill('모바일 필수 입력');
    }
    if (schema.referralSource.enabled && schema.referralSource.required) await page.getByRole('button', { name: getClientContent().referralOptions[0], exact: true }).click();
    if (invalidChecks) {
      await page.locator('input[type="email"]').fill('bad-email');
      await page.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
      assert.equal(await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).count(), 0);
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[id="contract-field-groomPhone"]').fill('--------');
      await page.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
      assert.equal(await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).count(), 0);
      await page.locator('input[id="contract-field-groomPhone"]').fill(h.form.groomPhone);
    }
    await page.locator('input[type="email"]').fill(email);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile form must not require horizontal scrolling');
  }
  await fill(true); await page.screenshot({ path: screenshot, fullPage: true });
  await page.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
  await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await page.getByText('계약 신청이 정상 접수되었습니다', { exact: true }).waitFor();
  const records = () => [...h.files.values()].filter(file => file.name.endsWith('.json')).map(file => JSON.parse(file.bytes.toString('utf8'))).filter(record => record.formData?.email === email);
  assert.equal(records().length, 1); const id = records()[0].contractId, before = h.deliveries.length;
  const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
  assert.deepEqual(storage, { local: [], session: [] });
  await page.reload(); assert.equal(await page.getByText('계약 신청이 정상 접수되었습니다', { exact: true }).count(), 0);
  assert.ok(!(await page.locator('body').innerText()).includes(email)); assert.equal(h.deliveries.length, before);
  await fill(false); await page.getByRole('button', { name: /^계약 내용 최종 확인하기/ }).click();
  await page.getByRole('button', { name: '계약정보 제출하기', exact: true }).click();
  await page.getByText('계약 신청이 정상 접수되었습니다', { exact: true }).waitFor();
  assert.equal(records().length, 1); assert.equal(records()[0].contractId, id); assert.equal(h.deliveries.length, before);
  return { oneReceipt: true, oneNotification: true, duplicateAfterRefresh: true, storage, physicalDevice: false };
}

export const mobileProfiles = [
  { name: 'mobile-chrome', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'kakao-ua-simulation', viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 KAKAOTALK/11.2.1' },
];
