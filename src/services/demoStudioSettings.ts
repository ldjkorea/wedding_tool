import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDemoMode } from '@/lib/serverConfig';
import type { SettingsRevision } from '@/types/studioSettings';
import { publicSettingsRevision } from './publicSettingsRevision';
import { normalizePartnerCode, isPartnerCodeFormat } from '@/lib/partnerCode';
import { enforceOwnerTransition } from './ownerSettingsGuard';
import type { StudioSettings } from '@/types/studioSettings';

type State = { ownerCredential?: { hash: string; revision: number }; current: SettingsRevision | null; history: SettingsRevision[]; attempts: number[]; sessions: Record<string, { createdAt: number; lastSeen: number; role?: "owner" | "master" }> };
let queue: Promise<unknown> = Promise.resolve();
/** Local, single-process Demo only. Production storage always goes through signed GAS. */
export async function demoSettingsCall(action: string, payload: Record<string, unknown>) {
  if (!isDemoMode() || !(/^(admin_|settings_|owner_)/.test(action) || action === 'validate_partner_code')) throw new Error('Explicit local Demo required');
  const studioId = String(payload.studioId);
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(studioId)) throw new Error('Invalid studio');
  const directory = process.env.STUDIO_DEMO_SETTINGS_TEST_DIRECTORY || '.studio-settings-demo';
  const file = path.resolve(directory, studioId + '.json');
  const operation = queue.then(async () => {
    let state: State;
    // Next development Flight serializes async filesystem IO results, including raw private
    // state. This bounded local Demo read stays synchronous; Production uses public projection.
    try { state = JSON.parse(readFileSync(file, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; state = { current: null, history: [], attempts: [], sessions: {} }; }
    if (state.current && crypto.createHash('sha256').update(JSON.stringify(state.current.settings)).digest('hex') !== state.current.hash) throw new Error('Demo settings integrity failure');
    const now = Date.now(), id = String(payload.sessionId || '');
    state.attempts = state.attempts.filter(time => time > now - 900000);
    Object.keys(state.sessions).forEach(key => {
      const session = state.sessions[key];
      if (session.lastSeen + 1800000 <= now || session.createdAt + 28800000 <= now) delete state.sessions[key];
    });
    if (action === 'admin_owner_credential_read') {
      if (Object.keys(payload).some(key => key !== 'studioId')) throw Object.assign(new Error('Unauthorized admin'), { code: 'ADMIN_UNAUTHORIZED' });
      return { success: true, hash: state.ownerCredential?.hash ?? null, revision: state.ownerCredential?.revision ?? 0 };
    }
    if (action === 'admin_attempt') {
      if (state.attempts.length >= 10) throw Object.assign(new Error('Too many attempts'), { code: 'ADMIN_RATE_LIMIT' });
      state.attempts.push(now);
    } else if (action === 'admin_login') {
      if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid session');
      const keys = Object.keys(state.sessions).sort((a, b) => state.sessions[a].createdAt - state.sessions[b].createdAt);
      while (keys.length >= 5) delete state.sessions[keys.shift()!];
      if (payload.role && !["owner", "master"].includes(String(payload.role))) throw Object.assign(new Error("Unauthorized admin"), { code: "ADMIN_UNAUTHORIZED" });
      if (payload.role === 'owner' && (payload.credentialRevision || 0) !== (state.ownerCredential?.revision || 0)) throw Object.assign(new Error('Unauthorized admin'), { code: 'ADMIN_UNAUTHORIZED' });
      state.sessions[id] = { createdAt: now, lastSeen: now, role: (payload.role || "master") as "owner" | "master" };
    } else if (action !== 'settings_runtime' && action !== 'validate_partner_code') {
      if (!state.sessions[id]) throw Object.assign(new Error('Unauthorized admin'), { code: 'ADMIN_UNAUTHORIZED' });
      const role = state.sessions[id].role || "master";
      if ((payload.role && payload.role !== role) || (action.startsWith("settings_") && role !== "master") || (action.startsWith("owner_") && role !== "owner")) throw Object.assign(new Error("Unauthorized admin"), { code: "ADMIN_UNAUTHORIZED" });
      state.sessions[id].lastSeen = now;
    }
    let result: Record<string, unknown> = { success: true };
    if (action === 'admin_owner_credential_set') {
      if (state.sessions[id]?.role !== 'master' || Object.keys(payload).some(key => !['studioId', 'sessionId', 'hash', 'expectedRevision'].includes(key)) ||
          typeof payload.hash !== 'string' || !/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(payload.hash)) throw Object.assign(new Error('Unauthorized admin'), { code: 'ADMIN_UNAUTHORIZED' });
      if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision !== (state.ownerCredential?.revision || 0)) throw Object.assign(new Error('Revision conflict'), { code: 'SETTINGS_CONFLICT' });
      state.ownerCredential = { hash: payload.hash, revision: Number(payload.expectedRevision) + 1 };
      Object.keys(state.sessions).forEach(key => { if (state.sessions[key].role === 'owner') delete state.sessions[key]; });
      result.revision = state.ownerCredential.revision;
    }
    if (action === 'admin_session') result.role = state.sessions[id].role || 'master';
    if (action === 'admin_logout') delete state.sessions[id];
    else if (action === 'settings_runtime') return { success: true, current: state.current ? publicSettingsRevision(state.current) : null };
    else if (action === 'validate_partner_code') {
      if ((payload.settingsRevision || 0) !== (state.current?.revision || 0) || (payload.settingsHash || '') !== (state.current?.hash || '')) throw new Error('Settings changed; reload required');
      const code = normalizePartnerCode(typeof payload.code === 'string' ? payload.code : '');
      const rule = state.current?.settings.discountsConfig.find(item => item.eligibility.kind === 'partner');
      const match = isPartnerCodeFormat(code) && rule?.active && rule.type === 'immediate' ? state.current?.settings.partnerCodes?.find(item => item.active && item.code === code) : undefined;
      const valid = !!match && Number.isSafeInteger(match.amount) && match.amount > 0;
      return { success: true, valid, code, discountAmount: valid ? match!.amount : 0 };
    }
    else if ((action === 'settings_read' || action === 'owner_read')) result = { success: true, current: state.current, revision: state.current?.revision || 0, history: state.history.slice(-20).map(({ revision, updatedAt, hash, actor }) => ({ revision, updatedAt, hash, actor: actor || "legacy" })) };
    else if (action === 'settings_revision') result.current = state.history.find(item => item.revision === payload.revision);
    else if (action === 'settings_save' || action === 'settings_restore' || action === 'owner_save') {
      if ((state.current?.revision || 0) !== payload.expectedRevision) throw Object.assign(new Error('Revision conflict'), { code: 'SETTINGS_CONFLICT' });
      if (action === 'settings_restore' && state.history.find(item => item.revision === payload.revision)?.hash !== (payload.sourceHash || payload.hash)) throw new Error('Invalid restore');
      if (action === 'owner_save') enforceOwnerTransition(state.current?.settings || payload.bootstrap as StudioSettings, payload.settings as StudioSettings);
      const current = { schemaVersion: 1, studioId, revision: Number(payload.expectedRevision) + 1, updatedAt: new Date(now).toISOString(), hash: String(payload.hash), actor: state.sessions[id].role || "master", settings: payload.settings } as SettingsRevision;
      state.current = current; state.history.push(current); result.current = current;
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = file + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await fs.rename(temporary, file);
    return result as { success: boolean; [key: string]: unknown };
  });
  queue = operation.catch(() => {});
  return operation;
}
