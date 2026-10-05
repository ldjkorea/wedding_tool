const testAppUrl = new URL(process.env.LEGACY_TEST_APP_URL || '');
if (!['127.0.0.1', 'localhost'].includes(testAppUrl.hostname) || testAppUrl.protocol !== 'http:' || testAppUrl.username || testAppUrl.password) {
  throw new Error('LEGACY_TEST_APP_URL must be an explicit loopback HTTP URL. Use npm test for maintained release checks.');
}
async function check() {
  const res = await fetch(testAppUrl.href);
  const html = await res.text();
  const buildIdMatch = html.match(/<!--(.*?)-->/);
  console.log('Build ID comment:', buildIdMatch ? buildIdMatch[1] : 'none');
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  console.log('Found scripts:', scripts);
  for (const s of scripts) {
    const sRes = await fetch(s.startsWith('http') ? s : new URL(s, testAppUrl).href);
    console.log('Script status:', s, sRes.status);
  }
}
check().catch(console.error);
