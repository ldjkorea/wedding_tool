import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { installSheetHarness } from './test-support/sheetHarness';
import { POST as pinLogin } from '../src/app/api/owner-control/pin/route';
import { POST as masterLogin } from '../src/app/api/master-control/auth/route';
import { DELETE as logout } from '../src/app/api/owner-control/auth/route';
import { GET as bookings } from '../src/app/api/owner-control/bookings/route';
import { GET as view, POST as processContract } from '../src/app/api/owner-control/contract/route';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { GET as tokenReview } from '../src/app/api/review-contract/route';
import { withRuntimeConfiguration } from '../src/services/serverRuntimeConfiguration';
import { configurationBinding } from '../src/lib/contractWorkflow';
import { getProducts, getClientContent, getStudioConfig } from '../src/services/configuration';
const h = installGasHarness();
installSheetHarness(h.context);
const hash = (value: string) => {
  const salt = crypto.randomBytes(16);
  return (
    'scrypt$16384$8$1$' +
    salt.toString('hex') +
    '$' +
    crypto.scryptSync(value, salt, 64).toString('hex')
  );
};
const pin = String(crypto.randomInt(100000, 1000000)),
  master = crypto.randomBytes(24).toString('hex');
Object.assign(process.env, {
  STUDIO_SETTINGS_ENABLED: 'true',
  STUDIO_OWNER_PASSWORD_HASH: hash(pin),
  MASTER_ADMIN_PASSWORD_HASH: hash(master),
});
let cookie = '',
  masterCookie = '',
  contractId = '',
  token = '',
  prepared: any;
const results: { name: string; status: string; error?: string }[] = [];
const artifacts = path.resolve(
  process.env.BOOKING_ARTIFACT_DIR || '.contract-test-output/bookings',
);
fs.mkdirSync(artifacts, { recursive: true });
const request = (url: string, method = 'GET', body?: unknown, auth = cookie) =>
  new NextRequest('https://booking.fixture.com' + url, {
    method,
    headers: {
      Origin: 'https://booking.fixture.com',
      'Content-Type': 'application/json',
      Cookie: auth,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
async function test(name: string, task: () => Promise<void> | void) {
  try {
    await task();
    results.push({ name, status: 'passed' });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, status: 'failed', error: String(error) });
    throw error;
  }
}
async function main() {
  await test('Anonymous list/detail/approval blocked without private data', async () => {
    assert.equal((await bookings(request('/api/owner-control/bookings'))).status, 401);
    assert.equal((await view(request('/api/owner-control/contract?id=cnt_test'))).status, 401);
    assert.equal(
      (
        await processContract(
          request('/api/owner-control/contract', 'POST', {
            contractId: 'cnt_test',
            phase: 'prepare',
            expectedRevision: 1,
          }),
        )
      ).status,
      401,
    );
  });
  await test('PIN rejects nonnumeric, five and seven digits; six digits authenticate with private cookie', async () => {
    for (const value of ['abc123', '12345', '1234567'])
      assert.equal(
        (await pinLogin(request('/api/owner-control/pin', 'POST', { password: value }))).status,
        401,
      );
    const response = await pinLogin(request('/api/owner-control/pin', 'POST', { password: pin }));
    assert.equal(response.status, 200);
    cookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.match(response.headers.get('set-cookie')!, /HttpOnly/i);
    assert.match(response.headers.get('set-cookie')!, /Secure/i);
    assert.match(response.headers.get('set-cookie')!, /SameSite=strict/i);
  });
  await test('Master cannot use Owner list/detail or PIN login', async () => {
    const response = await masterLogin(
      request('/api/master-control/auth', 'POST', { password: master }),
    );
    assert.equal(response.status, 200);
    masterCookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.equal(
      (await bookings(request('/api/owner-control/bookings', 'GET', undefined, masterCookie)))
        .status,
      401,
    );
    assert.equal(
      (
        await view(
          request('/api/owner-control/contract?id=cnt_test', 'GET', undefined, masterCookie),
        )
      ).status,
      401,
    );
    assert.equal(
      (await pinLogin(request('/api/owner-control/pin', 'POST', { password: master }))).status,
      401,
    );
  });
  const data = {
    ...h.form,
    productId: getProducts()[0].id,
    optionIds: [],
    partnerDiscount: false,
    portfolioConsent: false,
    shootRequestNotes: 'TEST booking preparation',
    referralSource: getClientContent().referralOptions[0],
  };
  await test('Customer receipt appears once in private booking projection with no Calendar dependency', async () => {
    const req = h.request('/api/submit-contract', data);
    req.headers.set(
      'X-Contract-Configuration',
      await withRuntimeConfiguration(async () => configurationBinding()),
    );
    const response = await submit(req);
    assert.equal(response.status, 200, await response.clone().text());
    contractId = (await response.json()).contractId;
    token = h.reviewToken();
    const response2 = await bookings(request('/api/owner-control/bookings'));
    assert.equal(response2.status, 200);
    const list = await response2.json();
    assert.equal(list.bookings.length, 1);
    assert.equal(list.bookings[0].contractId, contractId);
    assert.equal(list.bookings[0].status, 'submitted');
    assert.equal(list.bookings[0].calendarStatus, 'disabled');
    for (const key of ['email', 'groomPhone', 'token', 'tokenHash', 'sessionId', 'formData'])
      assert.ok(!JSON.stringify(list).includes('"' + key + '"'));
    assert.match(response2.headers.get('cache-control')!, /no-store/);
  });
  await test('Repeated Owner GET leaves token, Record, Snapshot and deliveries unchanged', async () => {
    const before = JSON.stringify(h.stored(contractId)),
      sent = h.deliveries.length;
    for (let i = 0; i < 3; i++) {
      const response = await view(request('/api/owner-control/contract?id=' + contractId));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).contractId, contractId);
    }
    assert.equal(JSON.stringify(h.stored(contractId)), before);
    assert.equal(h.deliveries.length, sent);
    assert.equal(
      (await tokenReview(request('/api/review-contract?token=' + encodeURIComponent(token))))
        .status,
      200,
    );
  });
  await test('CSRF and unknown request properties cannot prepare a contract', async () => {
    const req = request('/api/owner-control/contract', 'POST', {
      contractId,
      phase: 'prepare',
      expectedRevision: 1,
    });
    req.headers.set('Origin', 'https://hostile.invalid');
    assert.notEqual((await processContract(req)).status, 200);
    assert.equal(
      (
        await processContract(
          request('/api/owner-control/contract', 'POST', {
            contractId,
            phase: 'prepare',
            expectedRevision: 1,
            ownerSessionId: 'forged',
          }),
        )
      ).status,
      400,
    );
    assert.equal(h.stored(contractId).status, 'submitted');
  });
  await test('Owner explicit approval freezes modified time/product in booking list without rotating token', async () => {
    const old = h.stored(contractId).tokenHash;
    const response = await processContract(
      request('/api/owner-control/contract', 'POST', {
        contractId,
        phase: 'prepare',
        expectedRevision: 1,
        updatedData: { ...data, weddingTime: '13:30', weddingVenue: 'TEST corrected venue' },
      }),
    );
    assert.equal(response.status, 200, await response.clone().text());
    prepared = await response.json();
    const row = (await (await bookings(request('/api/owner-control/bookings'))).json()).bookings[0];
    assert.equal(row.status, 'approved');
    assert.equal(row.weddingTime, '13:30');
    assert.equal(row.weddingVenue, 'TEST corrected venue');
    assert.equal(row.contractTotal, prepared.snapshot.pricing.contractTotal);
    assert.equal(h.stored(contractId).tokenHash, old);
    assert.equal(h.deliveries.length, 1);
  });
  await test('Missing PDF cannot send; explicit Owner send uses same snapshot and duplicate retry sends nothing', async () => {
    assert.notEqual(
      (
        await processContract(
          request('/api/owner-control/contract', 'POST', {
            contractId,
            phase: 'send',
            snapshotHash: prepared.snapshotHash,
          }),
        )
      ).status,
      200,
    );
    const body = {
      contractId,
      phase: 'send',
      snapshotHash: prepared.snapshotHash,
      pdfBase64: h.pdf(prepared.snapshotHash),
    };
    assert.equal(
      (await processContract(request('/api/owner-control/contract', 'POST', body))).status,
      200,
    );
    const count = h.deliveries.length;
    assert.notEqual(
      (await processContract(request('/api/owner-control/contract', 'POST', body))).status,
      200,
    );
    assert.equal(h.deliveries.length, count);
    assert.equal(
      (await (await bookings(request('/api/owner-control/bookings'))).json()).bookings[0].status,
      'sent',
    );
  });
  await test('Calendar metadata projects status only and snapshot price remains frozen', async () => {
    const file = [...h.files.values()].find((file) => file.name === contractId + '.json')!,
      record = h.stored(contractId);
    record.calendarSync = {
      status: 'failed',
      eventId: 'PRIVATE_EVENT',
      calendarId: 'PRIVATE_CALENDAR',
    };
    record.formData.weddingTime = '01:00';
    record.pricing.contractTotal = 1;
    file.bytes = Buffer.from(JSON.stringify(record));
    const row = (await (await bookings(request('/api/owner-control/bookings'))).json()).bookings[0];
    assert.equal(row.calendarStatus, 'failed');
    assert.equal(row.weddingTime, '13:30');
    assert.equal(row.contractTotal, prepared.snapshot.pricing.contractTotal);
    assert.ok(!JSON.stringify(row).includes('PRIVATE_'));
  });
  await test('Foreign studio records excluded and direct Owner detail access denied', async () => {
    const original = h.stored(contractId),
      foreign = {
        ...original,
        contractId: 'cnt_foreign',
        studio: { ...original.studio, studioId: 'foreign-studio' },
        snapshot: undefined,
      };
    h.files.set('foreign', {
      id: 'foreign',
      name: 'cnt_foreign.json',
      bytes: Buffer.from(JSON.stringify(foreign)),
    });
    assert.equal(
      (await (await bookings(request('/api/owner-control/bookings'))).json()).bookings.length,
      1,
    );
    assert.notEqual(
      (await view(request('/api/owner-control/contract?id=cnt_foreign'))).status,
      200,
    );
  });
  await test('Pagination exposes all contracts without duplicates and malformed cursor fails', async () => {
    for (let i = 0; i < 40; i++) {
      const record = { ...h.stored(contractId), contractId: 'cnt_page' + i };
      h.files.set('page' + i, {
        id: 'page' + i,
        name: record.contractId + '.json',
        bytes: Buffer.from(JSON.stringify(record)),
      });
    }
    const ids = new Set<string>();
    let cursor = '';
    do {
      const response = await bookings(
        request(
          '/api/owner-control/bookings' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
        ),
      );
      assert.equal(response.status, 200);
      const page = await response.json();
      for (const row of page.bookings) {
        assert.ok(!ids.has(row.contractId));
        ids.add(row.contractId);
      }
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(ids.size, 41);
    assert.equal(
      (await bookings(request('/api/owner-control/bookings?cursor=' + 'x'.repeat(2001)))).status,
      400,
    );
  });
  await test('Backend outage is an error rather than empty successful calendar', async () => {
    h.transport('http500');
    try {
      assert.equal((await bookings(request('/api/owner-control/bookings'))).status, 502);
    } finally {
      h.transport('');
    }
  });
  await test('Logout revokes captured Owner cookie and private APIs', async () => {
    assert.equal((await logout(request('/api/owner-control/auth', 'DELETE', {}))).status, 200);
    assert.equal((await bookings(request('/api/owner-control/bookings'))).status, 401);
    assert.equal((await view(request('/api/owner-control/contract?id=' + contractId))).status, 401);
  });
  await test('Six-digit brute-force uses durable 15-minute budget', async () => {
    const authKey = 'studio_settings_' + getStudioConfig().studioId + '_auth';
    h.properties.delete(authKey);
    let limited = false;
    for (let i = 0; i < 12; i++) {
      const response = await pinLogin(
        request('/api/owner-control/pin', 'POST', { password: 'wrong' }),
      );
      if (response.status === 429) {
        limited = true;
        break;
      }
      assert.equal(response.status, 401);
    }
    assert.equal(limited, true);
    assert.equal(
      (await pinLogin(request('/api/owner-control/pin', 'POST', { password: pin }))).status,
      429,
    );
  });
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    h.restore();
    fs.writeFileSync(
      path.join(artifacts, 'booking-results.json'),
      JSON.stringify(
        {
          passed: results.filter((x) => x.status === 'passed').length,
          failed: results.filter((x) => x.status === 'failed').length,
          results,
          realGoogleIO: false,
        },
        null,
        2,
      ),
    );
  });
