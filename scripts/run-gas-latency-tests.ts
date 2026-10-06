import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { installGasHarness } from './test-support/gasHarness';
import { getBaseClientConfiguration } from '../src/services/configuration';
import { baseSettings } from '../src/services/settingsValidation';
const h = installGasHarness(), studioId = getBaseClientConfiguration().studioConfig.studioId;
let calls = 0, passed = 0;
const originalFolder = h.context.DriveApp.getFolderById;
h.context.DriveApp.getFolderById = (id: string) => { calls++; return originalFolder(id); };
function gas(action: string, input: Record<string, unknown> = {}) {
  const timestamp = Date.now(), nonce = crypto.randomUUID(), payloadJson = JSON.stringify({ ...input, studioId });
  const signature = crypto.createHmac('sha256', h.secret).update(timestamp + '\n' + nonce + '\n' + action + '\n' + payloadJson).digest('hex');
  return h.gas({ action, timestamp, nonce, payloadJson, signature, trace: true });
}
function test(name: string, work: () => void) { work(); passed++; console.log('PASS ' + name); }
try {
  test('Authentication attempt validates folder configuration without Drive lookup', () => {
    assert.equal(gas('admin_attempt', { role: 'master' }).success, true); assert.equal(calls, 0);
  });
  const sessionId = crypto.randomBytes(32).toString('hex');
  test('Master initial settings reads no folder object or list at revision zero', () => {
    const response = gas('admin_login', { sessionId, role: 'master', initialView: 'settings' });
    assert.equal(response.success, true); assert.equal(response.initial.current, null); assert.equal(calls, 0);
    assert.equal(response.__timing.drive_folder_calls, undefined);
  });
  test('Actual settings publication still accesses Drive and fails without a valid folder', () => {
    h.context.DriveApp.getFolderById = () => { calls++; throw Error('Injected unavailable folder'); };
    const settings = baseSettings(), hash = crypto.createHash('sha256').update(JSON.stringify(settings)).digest('hex');
    assert.equal(gas('settings_save', { sessionId, expectedRevision: 0, settings, hash }).success, false);
    assert.equal(calls, 1); assert.equal(h.properties.has('studio_settings_' + studioId), false);
    h.context.DriveApp.getFolderById = originalFolder;
  });
  test('Missing required folder configuration still rejects authentication', () => {
    const id = h.properties.get('STUDIO_SETTINGS_FOLDER_ID')!; h.properties.delete('STUDIO_SETTINGS_FOLDER_ID');
    assert.equal(gas('admin_attempt', { role: 'master' }).success, false); h.properties.set('STUDIO_SETTINGS_FOLDER_ID', id);
  });
  test('Contract and settings folder separation is checked before authentication', () => {
    const id = h.properties.get('STUDIO_SETTINGS_FOLDER_ID')!; h.properties.set('STUDIO_SETTINGS_FOLDER_ID', h.properties.get('CONTRACTS_FOLDER_ID')!);
    assert.equal(gas('admin_attempt', { role: 'master' }).success, false); h.properties.set('STUDIO_SETTINGS_FOLDER_ID', id);
  });
} catch (error) { console.error(error); process.exitCode = 1; }
finally { h.restore(); console.log(JSON.stringify({ passed, failed: process.exitCode ? 1 : 0 })); }
