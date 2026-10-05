import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { NextRequest } from 'next/server';
import { jsPDF } from 'jspdf';
import type { ContractFormData } from '../../src/types/contract';
import { baseSettings, validateStudioSettings } from '../../src/services/settingsValidation';
import { configurationBinding } from '../../src/lib/contractWorkflow';
import type { PartnerDiscountCode } from '../../src/types/studioSettings';

/** Runs the repository's actual Code.gs; only Google I/O is replaced. Never contacts live services.
 * LockService is serial: this harness does not prove real distributed lock behavior. */
export function installGasHarness(options: { partnerAmount?: number } = {}) {
  const secret = crypto.randomBytes(32).toString('hex');
  Object.assign(process.env, {
    NODE_ENV: 'production', BACKEND_MODE: 'gas', APP_SECRET: crypto.randomBytes(32).toString('hex'),
    GAS_SHARED_SECRET: secret, GAS_WEBAPP_URL: 'https://script.google.com/macros/s/isolated-test/exec',
    NEXT_PUBLIC_APP_URL: 'https://booking.fixture.com', REPRESENTATIVE_EMAIL: 'representative@booking.fixture.com',
  });
  const form: ContractFormData = {
    weddingDate: '2027-04-18', weddingTime: '14:00', weddingVenue: 'Test venue', weddingHall: 'Hall',
    groomName: 'Fixture groom', groomPhone: '010-1111-2222', brideName: 'Fixture bride', bridePhone: '010-3333-4444',
    email: 'customer@example.com', productId: 'album_plus', optionIds: ['second_shooter'],
    partnerDiscount: false, partnerName: '', sundayDiscount: true, portfolioConsent: true,
    reviewContractCashback: true, reviewMainCashback: false, termsAgreed: true, requestNotes: 'Accepted special condition',
  };
  type StoredFile = { id: string; name: string; bytes: Buffer };
  const files = new Map<string, StoredFile>();
  const properties = new Map<string, string>([
    ['STUDIO_SETTINGS_FOLDER_ID', 'isolated-settings'], ['GAS_SHARED_SECRET', secret], ['CONTRACTS_FOLDER_ID', 'isolated-folder'],
  ]);
  const deliveries: { to: string; subject: string; options: any }[] = [];
  const cursors = new Map<string, { ids: string[]; index: number }>();
  let emailFault = '', driveFault = false, lockFault = false, lockHeld = false;
  let writeFault: ((value: any) => boolean) | undefined;
  function blob(bytes: Buffer) {
    return { getBytes: () => Array.from(bytes), getDataAsString: () => bytes.toString('utf8') };
  }
  function wrap(file: StoredFile): any {
    return {
      getId: () => file.id, getName: () => file.name, getBlob: () => blob(file.bytes),
      setContent: (text: string) => {
        if (driveFault || writeFault?.(JSON.parse(text))) throw new Error('Injected write failure');
        file.bytes = Buffer.from(text); return wrap(file);
      },
    };
  }
  function iterator(ids: string[], start = 0): any {
    let index = start;
    return { hasNext: () => index < ids.length, next: () => wrap(files.get(ids[index++])!), getContinuationToken: () => { const token = crypto.randomUUID(); cursors.set(token, { ids, index }); return token; } };
  }
  const folder = {
    getUrl: () => 'https://drive.google.com/isolated-folder',
    getFiles: () => iterator([...files.keys()]),
    getFilesByName: (name: string) => {
      const found = [...files.values()].filter(f => f.name === name);
      let index = 0;
      return { hasNext: () => index < found.length, next: () => wrap(found[index++]) };
    },
    createFile: (first: any, text?: string) => {
      if (driveFault) throw new Error('Injected Drive failure');
      const file = { id: crypto.randomUUID(), name: typeof first === 'string' ? first : first.name, bytes: typeof first === 'string' ? Buffer.from(text!) : Buffer.from(first.bytes) };
      files.set(file.id, file); return wrap(file);
    },
  };
  const context: any = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key: string) => properties.get(key),
      setProperty: (key: string, value: string) => properties.set(key, value),
      deleteProperty: (key: string) => properties.delete(key),
      getProperties: () => Object.fromEntries(properties),
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (lockFault || lockHeld) return false; lockHeld = true; return true; }, releaseLock: () => { lockHeld = false; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      Charset: { UTF_8: 'utf8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_: string, value: string | number[]) => Array.from(crypto.createHash('sha256').update(typeof value === 'string' ? value : Buffer.from(value)).digest()),
      computeHmacSha256Signature: (value: string, key: string) => Array.from(crypto.createHmac('sha256', key).update(value).digest()),
      base64Decode: (value: string) => Array.from(Buffer.from(value, 'base64')),
      newBlob: (bytes: number[], mime: string, name: string) => ({ bytes, mime, name }),
    },
    DriveApp: { getFolderById: () => folder, getFileById: (id: string) => wrap(files.get(id)!), continueFileIterator: (token: string) => { const cursor = cursors.get(token); if (!cursor) throw new Error('Invalid cursor'); return iterator(cursor.ids, cursor.index); } },
    GmailApp: { sendEmail: (to: string, subject: string, _: string, options: any) => {
      deliveries.push({ to, subject, options });
      if (to === emailFault) throw new Error('Injected uncertain delivery');
    } },
    SpreadsheetApp: { openById: () => { throw new Error('Sheets lookup is forbidden in discount-code tests'); } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
    MimeType: { PLAIN_TEXT: 'text/plain' },
  });
  vm.runInContext(fs.readFileSync('google-apps-script/Code.gs', 'utf8'), context);
  const gas = (request: unknown) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(request) } }).text);
  const request = (path: string, value: unknown) => new NextRequest('https://booking.fixture.com' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://booking.fixture.com', 'X-Contract-Configuration': configurationBinding() }, body: JSON.stringify(value) });
  const originalFetch = globalThis.fetch;
  let transportFault: 'network' | 'timeout' | 'http500' | 'malformed' | 'malformed-object' | 'reject' | 'lost-receipt' | 'disconnect-send' | 'lost-settings-response' | 'lost-owner-response' | '' = '';
  globalThis.fetch = async (_input, init) => {
    assert.ok(init?.signal, 'GAS transport requires timeout signal');
    if (transportFault === 'network') throw new Error('Injected network failure');
    if (transportFault === 'timeout') {
      await new Promise<void>((_resolve, reject) => {
        // A real fetch has an active socket. Keep this isolated simulation alive until abort.
        const timer = setTimeout(() => reject(new Error('Timeout simulation did not abort')), 30000);
        const abort = () => { clearTimeout(timer); reject(init!.signal!.reason); };
        if (init!.signal!.aborted) abort();
        else init!.signal!.addEventListener('abort', abort, { once: true });
      });
    }
    if (transportFault === 'http500') return new Response('Provider diagnostics must never leak', { status: 500 });
    if (transportFault === 'malformed-object') return new Response(JSON.stringify({ success: true, record: { formData: { email: 'provider-private-marker' } } }));
    if (transportFault === 'malformed') return new Response('not-json', { status: 200 });
    const envelope = JSON.parse(init!.body as string);
    if (transportFault === 'reject') return new Response(JSON.stringify({ success: false }));
    const result = gas(envelope);
    if (transportFault === 'disconnect-send' && envelope.action === 'approve_and_send') throw new Error('Response lost after send');
    if (transportFault === 'lost-settings-response' && envelope.action === 'settings_save') return new Response('lost settings receipt');
    if (transportFault === 'lost-owner-response' && envelope.action === 'owner_save') return new Response('lost settings receipt');
    if (transportFault === 'lost-receipt' && envelope.action === 'submit_contract') return new Response('lost receipt');
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  function stored(id: string): any {
    return JSON.parse([...files.values()].find(f => f.name === id + '.json')!.bytes.toString('utf8'));
  }
  function reviewToken(index = deliveries.length - 1): string {
    return new URL(deliveries[index].options.htmlBody.match(/href="([^"]+)"/)[1]).searchParams.get('token')!;
  }
  function pdf(hash: string): string {
    const document = new jsPDF();
    document.setProperties({ subject: 'contract-snapshot:' + hash });
    document.text('Isolated regression fixture', 20, 20);
    return document.output('datauristring');
  }

  return { form, files, properties, context, deliveries, request, stored, reviewToken, pdf, gas, secret,
    lockHeld: () => lockHeld,
    seedPartnerCodes(codes: PartnerDiscountCode[] = [{ id: 'fixture_pair', code: 'REGISTERED-PARTNER', amount: options.partnerAmount ?? 50000, active: true }]) {
      const settings = baseSettings(); settings.studioConfig.representativeEmail = process.env.REPRESENTATIVE_EMAIL!; settings.partnerCodes = codes;
      const normalized = validateStudioSettings(settings), studioId = normalized.studioConfig.studioId, sessionId = crypto.randomBytes(32).toString('hex');
      context.settingsAction('admin_login', { studioId, sessionId });
      const result = context.settingsAction('settings_save', { studioId, sessionId, settings: normalized, hash: crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex'), expectedRevision: 0 });
      process.env.STUDIO_SETTINGS_ENABLED = 'true'; return result.current;
    },
    transport(value: typeof transportFault) { transportFault = value; },
    emailFailure(address: string) { emailFault = address; },
    driveFailure(value: boolean) { driveFault = value; },
    lockFailure(value: boolean) { lockFault = value; },
    // Seed a real earlier representative delivery to exercise recovery of legacy partial states.
    representativeFirst(id: string, mail: { subject: string; html: string }) {
      const record = stored(id);
      const file = [...files.values()].find(file => file.name === id + '.json')!;
      context.sendOnce({ file: wrap(file), value: record }, 'representativeState', record.repEmail, mail, blob(Buffer.from(pdf(record.snapshotHash).split(',')[1], 'base64')));
    },
    writeFailure(predicate?: (value: any) => boolean) { writeFault = predicate; },
    restore() { globalThis.fetch = originalFetch; },
  };
}
