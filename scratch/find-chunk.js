const testAppUrl = new URL(process.env.LEGACY_TEST_APP_URL || '');
if (!['127.0.0.1', 'localhost'].includes(testAppUrl.hostname) || testAppUrl.protocol !== 'http:' || testAppUrl.username || testAppUrl.password) {
  throw new Error('LEGACY_TEST_APP_URL must be an explicit loopback HTTP URL. Use npm test for maintained release checks.');
}
async function findChunkWithText() {
  const html = await (await fetch(testAppUrl.href)).text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  for (const s of scripts) {
    const text = await (await fetch(new URL(s, testAppUrl).href)).text();
    if (text.includes('예식일') || text.includes('CalendarModal') || text.includes('formatKoreanDate')) {
      console.log('Found in', s);
      const idx = text.indexOf('formatKoreanDate') !== -1 ? text.indexOf('formatKoreanDate') : text.indexOf('예식일');
      console.log(text.slice(Math.max(0, idx - 100), idx + 200));
    }
  }
}
findChunkWithText().catch(console.error);
