const testAppUrl = new URL(process.env.LEGACY_TEST_APP_URL || '');
if (!['127.0.0.1', 'localhost'].includes(testAppUrl.hostname) || testAppUrl.protocol !== 'http:' || testAppUrl.username || testAppUrl.password) {
  throw new Error('LEGACY_TEST_APP_URL must be an explicit loopback HTTP URL. Use npm test for maintained release checks.');
}
const { spawn } = require('child_process');

async function main() {
  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-allow-origins=*'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const targets = await listRes.json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    const send = (method, params = {}) => ws.send(JSON.stringify({ id: msgId++, method, params }));

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[EXCEPTION]', msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      } else if (msg.method === 'Log.entryAdded') {
        console.log('[LOG]', msg.params.entry.text);
      } else if (msg.id === 999) {
        console.log('[PAGE TEXT]:\n', msg.result?.result?.value);
      }
    };

    send('Runtime.enable');
    send('Page.enable');
    send('Network.enable');
    send('Log.enable');
    send('Page.navigate', { url: testAppUrl.href });

    await new Promise(r => setTimeout(r, 4000));
    ws.send(JSON.stringify({ id: 999, method: 'Runtime.evaluate', params: { expression: 'document.body.innerText' } }));
    await new Promise(r => setTimeout(r, 1500));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chromeProcess.kill();
  }
}
main();
