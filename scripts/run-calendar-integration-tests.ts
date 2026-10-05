import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { installGasHarness } from './test-support/gasHarness';
import { installSheetHarness } from './test-support/sheetHarness';
import { installCalendarHarness } from './test-support/calendarHarness';
import { GET, PUT, POST } from '../src/app/api/owner-control/calendar-integration/route';
import { GET as masterGET } from '../src/app/api/master-control/calendar-integration/route';
import { POST as ownerLogin } from '../src/app/api/owner-control/auth/route';
import { POST as masterLogin } from '../src/app/api/master-control/auth/route';
import { POST as submit } from '../src/app/api/submit-contract/route';
import { GET as review } from '../src/app/api/review-contract/route';
import { POST as approve } from '../src/app/api/approve-and-send/route';
import { withRuntimeConfiguration } from '../src/services/serverRuntimeConfiguration';
import { configurationBinding } from '../src/lib/contractWorkflow';
import { getStudioConfig, getProducts, getClientContent } from '../src/services/configuration';
import { signedGasCall } from '../src/services/gasTransport';

const h = installGasHarness(), sheets = installSheetHarness(h.context), google = installCalendarHarness(h.context, h.lockHeld);
process.env.STUDIO_SETTINGS_ENABLED = 'true';
const ownerPassword = crypto.randomBytes(24).toString('hex'), masterPassword = crypto.randomBytes(24).toString('hex');
function hash(value: string) { const salt = crypto.randomBytes(16); return 'scrypt$16384$8$1$' + salt.toString('hex') + '$' + crypto.scryptSync(value, salt, 64).toString('hex'); }
process.env.STUDIO_OWNER_PASSWORD_HASH = hash(ownerPassword); process.env.MASTER_ADMIN_PASSWORD_HASH = hash(masterPassword);
const root = path.resolve(process.env.CALENDAR_ARTIFACT_DIR || '.contract-test-output/calendar'); fs.mkdirSync(root, { recursive: true });
const results: { name: string; status: string; error?: string }[] = [];
let cookie = '', masterCookie = '', serial = 0, id = '', token = '', prepared: any;
const req = (method = 'GET', body?: unknown, auth = cookie) => new NextRequest('https://booking.fixture.com/api/owner-control/calendar-integration', { method, headers: { Origin: 'https://booking.fixture.com', 'Content-Type': 'application/json', Cookie: auth }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function status() { const response = await GET(req()); assert.equal(response.status, 200); return (await response.json()).integration; }
async function toggle(enabled: boolean, durationMinutes = 180) { const current = await status(); const response = await PUT(req('PUT', { enabled, durationMinutes, expectedRevision: current.revision })); assert.equal(response.status, 200); return (await response.json()).integration; }
async function create() { return POST(req('POST', { operation: 'create', expectedRevision: (await status()).revision })); }
async function application() {
  const data = { ...h.form, productId: getProducts().at(-1)!.id, optionIds: [], shootRequestNotes: 'STAGING fixture', referralSource: getClientContent().referralOptions[0], email: 'calendar' + (++serial) + '@example.com' };
  const request = h.request('/api/submit-contract', data); request.headers.set('X-Contract-Configuration', await withRuntimeConfiguration(async () => configurationBinding()));
  const response = await submit(request); assert.equal(response.status, 200); return { id: (await response.json()).contractId, token: h.reviewToken(), data };
}
async function prepare(t: string, data?: any) { const response = await approve(h.request('/api/approve-and-send', { token: t, phase: 'prepare', expectedRevision: 1, ...(data ? { updatedData: data } : {}) })); assert.equal(response.status, 200); return response.json(); }
async function send(t: string, value: any) { return approve(h.request('/api/approve-and-send', { token: t, phase: 'send', snapshotHash: value.snapshotHash, pdfBase64: h.pdf(value.snapshotHash) })); }
function persist(record: any) { [...h.files.values()].find(file => file.name === record.contractId + '.json')!.bytes = Buffer.from(JSON.stringify(record)); }
async function retry(target = id) { const response = await POST(req('POST', { operation: 'retry', contractId: target })); assert.equal(response.status, 200); }
function queue(target = id) { const value = h.stored(target); h.context.queueContractCalendar(value, false); persist(value); }
function event(target = id) { const mapping = h.stored(target).calendarSync; return google.calendars.get(mapping.calendarId)!.events.get(mapping.eventId); }
async function test(name: string, task: () => void | Promise<void>) { try { await task(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); } catch (error) { results.push({ name, status: 'failed', error: String(error) }); throw error; } }
async function main() {
  await test('Anonymous, wrong-role and cross-site Calendar APIs are blocked', async () => {
    assert.equal((await GET(req('GET', undefined, ''))).status, 401);
    for (const [login, password, role] of [[ownerLogin, ownerPassword, 'owner'], [masterLogin, masterPassword, 'master']] as const) {
      const response = await login(req('POST', { password }, '')); assert.equal(response.status, 200); const value = response.headers.get('set-cookie')!.split(';')[0]; if (role === 'owner') cookie = value; else masterCookie = value;
    }
    assert.equal((await masterGET(req())).status, 401); assert.equal((await GET(req('GET', undefined, masterCookie))).status, 401);
    const bad = req('PUT', { enabled: true, durationMinutes: 180, expectedRevision: 0 }); bad.headers.set('Origin', 'https://evil.example'); assert.notEqual((await PUT(bad)).status, 200);
  });
  await test('OFF: full approval/PDF/Drive/mail flow and worker make zero Calendar calls', async () => {
    assert.equal((await status()).enabled, false); const item = await application(); const value = await prepare(item.token); assert.equal((await send(item.token, value)).status, 200); h.context.contractCalendarWorker(); assert.equal(google.calls.length, 0); assert.ok(!h.stored(item.id).calendarSync); assert.ok(h.stored(item.id).pdfFileId);
  });
  await test('ON and duration changes do not change business binding; one independent worker', async () => {
    const binding = await withRuntimeConfiguration(async () => configurationBinding()); assert.equal((await toggle(true)).connection, 'disconnected'); assert.equal(await withRuntimeConfiguration(async () => configurationBinding()), binding); assert.equal(sheets.triggers.filter(trigger => trigger.getHandlerFunction() === 'contractCalendarWorker').length, 1);
  });
  await test('Submission and scanner Review GET create no event; approval queues only after durable Snapshot', async () => {
    const item = await application(); id = item.id; token = item.token; assert.ok(!h.stored(id).calendarSync);
    const before = google.calls.length, mails = h.deliveries.length; await review(new NextRequest('https://booking.fixture.com/api/review-contract?token=' + encodeURIComponent(token))); h.context.contractCalendarWorker(); assert.equal(google.calls.length, before); assert.equal(h.deliveries.length, mails);
    prepared = await prepare(token, { ...item.data, weddingTime: '13:30', weddingVenue: 'STAGING 수정웨딩홀', productId: getProducts()[0].id, optionIds: [] }); assert.equal(h.stored(id).calendarSync.status, 'pending'); assert.equal(google.calls.length, before); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.errorCode, 'CONNECTION_MISSING');
  });
  await test('Lost Calendar creation response recovers one dedicated private Calendar, no primary writes', async () => {
    google.fault('create-after'); assert.notEqual((await create()).status, 200); assert.equal(google.calendars.size, 1); google.fault(''); assert.equal((await create()).status, 200); assert.equal((await create()).status, 200); assert.equal(google.calendars.size, 1); assert.equal(google.calendar().timeZone, 'Asia/Seoul'); assert.equal(google.calendar().public, false); assert.ok(!google.calls.some(call => call.includes('/primary')));
  });
  await test('Approved Snapshot creates event with correct edited time, location, product and private data projection', async () => {
    await retry(); h.context.contractCalendarWorker(); const value = event(); assert.equal(h.stored(id).calendarSync.status, 'synced'); assert.equal(value.start.dateTime, prepared.snapshot.data.weddingDate + 'T13:30:00+09:00'); assert.equal(Date.parse(value.end.dateTime) - Date.parse(value.start.dateTime), 180 * 60000); assert.match(value.summary, /STAGING 수정웨딩홀/); assert.match(value.description, new RegExp(prepared.snapshot.product.name)); assert.ok(value.description.includes('WB-CONTRACT: ' + id)); assert.equal(value.visibility, 'private');
    const text = JSON.stringify(value); for (const secret of [h.secret, process.env.APP_SECRET!, token, prepared.snapshot.data.email, prepared.snapshot.data.groomPhone, 'tokenHash', 'snapshotHash', 'sessionId']) if (secret) assert.ok(!text.includes(secret));
  });
  await test('Final sending updates the same event and keeps PDF/mail successful', async () => {
    const previous = h.stored(id).calendarSync.eventId; assert.equal((await send(token, prepared)).status, 200); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.eventId, previous); assert.equal(google.calendar().events.size, 1); assert.match(event().description, /계약 완료/); assert.match(event().description, /발송 완료/); assert.equal(h.stored(id).customerState, 'sent'); assert.equal(h.stored(id).representativeState, 'sent');
  });
  await test('Duplicate approval/send/worker requests never add events or emails', async () => {
    const count = h.deliveries.length; await send(token, prepared); await review(new NextRequest('https://booking.fixture.com/api/review-contract?token=' + encodeURIComponent(token))); queue(); h.context.contractCalendarWorker(); h.context.contractCalendarWorker(); assert.equal(google.calendar().events.size, 1); assert.equal(h.deliveries.length, count);
  });
  await test('Owner cannot inject Calendar ID, event mapping, security state or duration outside allowlist', async () => {
    for (const key of ['calendarId','eventId','studioId','calendarSync','timezone','GAS_SHARED_SECRET','cycle']) assert.equal((await PUT(req('PUT', { enabled: true, durationMinutes: 180, expectedRevision: (await status()).revision, [key]: 'injected' }))).status, 400);
    assert.equal((await PUT(req('PUT', { enabled: true, durationMinutes: -1, expectedRevision: (await status()).revision }))).status, 400); assert.equal((await PUT(req('PUT', { enabled: true, durationMinutes: 180, expectedRevision: 0 }))).status, 409);
    assert.equal((await POST(req('POST', { operation: 'retry', contractId: id, eventId: 'injected' }))).status, 400);
  });
  await test('Master diagnostics are read-only and absent from Owner/customer runtime', async () => {
    const value = await status(); assert.equal(value.diagnostics, undefined); const result = await masterGET(req('GET', undefined, masterCookie)); assert.equal(result.status, 200); assert.ok((await result.json()).integration.diagnostics.calendarIdHint);
    const runtime = JSON.stringify(await signedGasCall('settings_runtime', {})); assert.ok(!runtime.includes(google.calendar().id)); assert.ok(!runtime.includes('calendarSync'));
  });
  await test('09:00 / noon / 13:30 / 18:00 / date boundary are independent of server timezone', () => {
    const previous = process.env.TZ;
    try { for (const zone of ['UTC','America/Los_Angeles','Asia/Seoul']) { process.env.TZ = zone; for (const time of ['09:00','12:00','13:30','18:00','23:30']) {
      const record = h.stored(id); record.snapshot.data.weddingDate = '2026-12-31'; record.snapshot.data.weddingTime = time; const value = h.context.calendarEventProjection(record); assert.equal(value.start.dateTime, '2026-12-31T' + time + ':00+09:00'); assert.equal(Date.parse(value.end.dateTime) - Date.parse(value.start.dateTime), 10800000);
    } } } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
    for (const date of ['2026-02-30','invalid']) { const record = h.stored(id); record.snapshot.data.weddingDate = date; assert.throws(() => h.context.calendarEventProjection(record)); }
  });
  await test('Response loss after event insert recovers deterministic ID and exactly one event', async () => {
    const item = await application(); await prepare(item.token); const count = google.calendar().events.size; google.fault('insert-after'); h.context.contractCalendarWorker(); assert.equal(h.stored(item.id).calendarSync.status, 'unknown'); assert.equal(google.calendar().events.size, count + 1); google.fault(''); await retry(item.id); h.context.contractCalendarWorker(); assert.equal(h.stored(item.id).calendarSync.status, 'synced'); assert.equal(google.calendar().events.size, count + 1);
  });
  await test('Marker recovery finds an existing non-deterministic event; multiple matches conflict', async () => {
    const item = await application(); await prepare(item.token); h.context.contractCalendarWorker(); const record = h.stored(item.id), prior = event(item.id), calendar = google.calendar(); calendar.events.delete(record.calendarSync.eventId); prior.id = 'manualfixtureid'; calendar.events.set(prior.id, prior); delete record.calendarSync.eventId; persist(record); queue(item.id); h.context.contractCalendarWorker(); assert.equal(h.stored(item.id).calendarSync.eventId, prior.id);
    calendar.events.set('duplicatefixtureid', { ...prior, id: 'duplicatefixtureid' }); queue(item.id); h.context.contractCalendarWorker(); assert.equal(h.stored(item.id).calendarSync.errorCode, 'DUPLICATE_EVENT'); calendar.events.delete('duplicatefixtureid'); await retry(item.id); h.context.contractCalendarWorker();
  });
  await test('Lost durable mapping write safely recovers working state after restart', async () => {
    queue(); h.writeFailure(record => record.contractId === id && record.calendarSync?.status === 'synced'); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.status, 'working'); h.writeFailure(); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.status, 'synced');
  });
  await test('Rename preserves identity; deleted Calendar is reported and never silently recreated', async () => {
    const calendar = google.calendar(); calendar.summary = 'STAGING renamed'; assert.equal((await status()).name, calendar.summary); calendar.deleted = true; const count = google.calendars.size; queue(); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.errorCode, 'CALENDAR_MISSING'); assert.equal((await status()).connection, 'missing'); assert.equal(google.calendars.size, count); calendar.deleted = false; await retry(); h.context.contractCalendarWorker();
  });
  await test('Access/public/timezone/network/500/malformed failures never change sent Snapshot or Core', async () => {
    const frozen = JSON.stringify(h.stored(id).snapshot), calendar = google.calendar();
    for (const fault of ['permission','public','timezone','network','500','malformed','patch-after']) {
      google.fault(['public','timezone'].includes(fault) ? '' : fault); calendar.public = fault === 'public'; calendar.timeZone = fault === 'timezone' ? 'UTC' : 'Asia/Seoul'; queue(); h.context.contractCalendarWorker(); assert.notEqual(h.stored(id).calendarSync.status, 'synced'); assert.equal(JSON.stringify(h.stored(id).snapshot), frozen); assert.equal(h.stored(id).status, 'sent'); assert.ok(h.stored(id).pdfFileId);
    }
    google.fault(''); calendar.public = false; calendar.timeZone = 'Asia/Seoul'; await retry(); h.context.contractCalendarWorker();
  });
  await test('Duration changes affect new approvals only and never reprice old Snapshot/event', async () => {
    const frozen = JSON.stringify(h.stored(id).snapshot); await toggle(true, 240); queue(); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.durationMinutes, 180); assert.equal(Date.parse(event().end.dateTime) - Date.parse(event().start.dateTime), 10800000); assert.equal(JSON.stringify(h.stored(id).snapshot), frozen);
    const item = await application(); await prepare(item.token); h.context.contractCalendarWorker(); assert.equal(h.stored(item.id).calendarSync.durationMinutes, 240);
  });
  await test('OFF preserves existing events; re-ON does not backfill old pending jobs', async () => {
    const item = await application(); await prepare(item.token); await toggle(false); const calls = google.calls.length, count = google.calendar().events.size; h.context.contractCalendarWorker(); assert.equal(google.calls.length, calls); const off = await application(); const value = await prepare(off.token); assert.equal((await send(off.token, value)).status, 200); assert.ok(!h.stored(off.id).calendarSync); assert.equal(google.calls.length, calls);
    await toggle(true); h.context.contractCalendarWorker(); assert.equal(h.stored(item.id).calendarSync.status, 'pending'); assert.equal(google.calendar().events.size, count); await retry(item.id); h.context.contractCalendarWorker(); assert.equal(h.stored(item.id).calendarSync.status, 'synced');
  });
  await test('Sheets ON + Calendar ON; either provider failure leaves other mirror and Core successful', async () => {
    const studio = getStudioConfig().studioId; h.context.writeSheetConfig({ schemaVersion: 1, studioId: studio, revision: 1, enabled: true });
    // Owner signed session required for direct backend creation.
    const authKey = [...h.properties.keys()].find(key => key.endsWith('_auth')); assert.ok(authKey);
    const state = JSON.parse(h.properties.get(authKey!)!); const sessionId = Object.keys(state.sessions).find(key => state.sessions[key].role === 'owner')!;
    h.context.sheetAdminAction('sheet_create', { studioId: studio, sessionId, expectedRevision: 1, displayName: 'STAGING' });
    const item = await application(), value = await prepare(item.token); google.fault('permission'); assert.equal((await send(item.token, value)).status, 200); h.context.contractCalendarWorker(); h.context.contractSheetWorker(); assert.notEqual(h.stored(item.id).calendarSync.status, 'synced'); assert.equal(h.stored(item.id).sheetSync.status, 'synced');
    google.fault(''); await retry(item.id); sheets.fault('permission'); const record = h.stored(item.id); h.context.queueContractSheet(record); persist(record); h.context.contractCalendarWorker(); h.context.contractSheetWorker(); assert.equal(h.stored(item.id).calendarSync.status, 'synced'); assert.equal(h.stored(item.id).sheetSync.status, 'failed'); assert.equal(h.stored(item.id).status, 'sent'); sheets.fault('');
    await toggle(false); const off = await application(), preparedOff = await prepare(off.token); assert.equal((await send(off.token, preparedOff)).status, 200); const calls = google.calls.length; h.context.contractSheetWorker(); h.context.contractCalendarWorker(); assert.equal(google.calls.length, calls); assert.equal(h.stored(off.id).sheetSync.status, 'synced'); await toggle(true);
  });
  await test('Network operations release Core lock; newer generation is not acknowledged by old worker', async () => {
    queue(); await retry(); h.properties.delete('contract_calendar_scan_cursor'); let checked = false;
    google.duringRequest(() => { assert.equal(h.lockHeld(), false); if (checked) return; checked = true; queue(); });
    h.context.contractCalendarWorker(); google.duringRequest(); assert.ok(checked); assert.equal(h.stored(id).calendarSync.status, 'pending'); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.status, 'synced');
  });
  await test('Deleted event or altered marker is never silently replaced', async () => {
    const record = h.stored(id), calendar = google.calendar(), saved = event(); calendar.events.delete(record.calendarSync.eventId); queue(); h.properties.delete('contract_calendar_scan_cursor'); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.errorCode, 'EVENT_MISSING');
    calendar.events.set(saved.id, saved); saved.extendedProperties.private.wbContract = 'tampered'; await retry(); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.errorCode, 'EVENT_IDENTITY_CHANGED'); saved.extendedProperties.private.wbContract = record.studio.studioId + ':' + id; await retry(); h.context.contractCalendarWorker();
  });
  await test('Concurrent settings revision and direct GAS Owner allowlist reject silent overwrite', async () => {
    const current = await status(); const body = { enabled: true, durationMinutes: 180, expectedRevision: current.revision }; const responses = await Promise.all([PUT(req('PUT', body)), PUT(req('PUT', body))]); assert.deepEqual(responses.map(value => value.status).sort(), [200,409]);
    const state = h.context.readAdminState({ studioId: getStudioConfig().studioId }); const sessionId = Object.keys(state.sessions).find(key => state.sessions[key].role === 'owner')!;
    assert.throws(() => h.context.calendarAdminAction('calendar_toggle', { studioId: getStudioConfig().studioId, sessionId, ...body, calendarId: 'injected' }));
    assert.throws(() => h.context.calendarAdminAction('calendar_retry', { studioId: getStudioConfig().studioId, sessionId, contractId: id, eventId: 'injected' }));
  });
  await test('Snapshot persistence failure cannot create an event', async () => {
    const item = await application(), before = google.calendar().events.size; h.writeFailure(record => record.contractId === item.id && record.status === 'approved');
    const response = await approve(h.request('/api/approve-and-send', { token: item.token, phase: 'prepare', expectedRevision: 1 })); assert.notEqual(response.status, 200); h.writeFailure(); h.properties.delete('contract_calendar_scan_cursor'); h.context.contractCalendarWorker(); assert.equal(google.calendar().events.size, before); assert.ok(!h.stored(item.id).snapshot);
  });
  await test('Google empty list with omitted items is accepted without a mock-only response assumption', async () => {
    const item = await application(); await prepare(item.token); google.fault('empty-items'); h.properties.delete('contract_calendar_scan_cursor'); h.context.contractCalendarWorker(); h.context.contractCalendarWorker(); google.fault(''); assert.equal(h.stored(item.id).calendarSync.status, 'synced');
  });
  await test('Explicit replacement of deleted calendar cannot silently rebind old contracts', async () => {
    const calendar = google.calendar(); calendar.deleted = true; h.properties.delete('contract_calendar_scan_cursor'); assert.equal((await create()).status, 200); assert.equal(google.calendars.size, 2); queue(); h.context.contractCalendarWorker(); assert.equal(h.stored(id).calendarSync.errorCode, 'CONNECTION_CHANGED'); assert.notEqual((await POST(req('POST', { operation: 'retry', contractId: id }))).status, 200);
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { h.restore(); fs.writeFileSync(path.join(root, 'calendar-results.json'), JSON.stringify({ passed: results.filter(item => item.status === 'passed').length, failed: results.filter(item => item.status === 'failed').length, verification: 'Local/Fake Google; actual Code.gs executed', realGoogle: false, results }, null, 2)); });
