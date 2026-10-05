import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDemoMode } from '@/lib/serverConfig';
import { demoSettingsCall } from './demoStudioSettings';
import type { DemoSheetRecord } from './demoSheetIntegration';
import type { CalendarIntegrationStatus } from '@/types/calendarIntegration';

type Entry = { record: DemoSheetRecord; durationMinutes: number; cycle: number; eventId?: string; status: 'failed' | 'synced' };
type State = { revision: number; enabled: boolean; durationMinutes: number; cycle: number; name: string; createdAt: string; entries: Record<string, Entry> };
let queue: Promise<unknown> = Promise.resolve();
function transaction<T>(studioId: string, task: (value: State) => T) {
  if (!isDemoMode() || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(studioId)) throw new Error('Explicit Demo required');
  const file = path.resolve(process.env.STUDIO_DEMO_SETTINGS_TEST_DIRECTORY || '.studio-settings-demo', studioId + '-calendar-mirror.json');
  const result = queue.then(async () => {
    let state: State;
    try { state = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; state = { revision: 0, enabled: false, durationMinutes: 180, cycle: 0, name: '', createdAt: '', entries: {} }; }
    const response = task(state); await fs.mkdir(path.dirname(file), { recursive: true }); const temp = file + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temp, JSON.stringify(state), { mode: 0o600 }); await fs.rename(temp, file); return response;
  }); queue = result.catch(() => {}); return result;
}
function status(state: State, master: boolean): CalendarIntegrationStatus {
  const entries = Object.values(state.entries), failed = entries.filter(entry => entry.status === 'failed');
  return { revision: state.revision, enabled: state.enabled, durationMinutes: state.durationMinutes, timezone: 'Asia/Seoul', connection: !state.enabled ? 'disabled' : state.name ? 'connected' : 'disconnected', name: state.name, url: '', createdAt: state.createdAt, errorCode: '', demo: true, workerReady: true,
    counts: { pending: 0, failed: failed.length, unknown: 0, synced: entries.length - failed.length }, nextCursor: null,
    jobs: failed.slice(0,30).map(entry => ({ contractId: entry.record.contractId, contractNumber: entry.record.contractNumber, status: 'failed', errorCode: 'CONNECTION_MISSING', queuedAt: '', lastAttemptAt: '' })),
    ...(master ? { diagnostics: { calendarIdHint: 'LOCAL DEMO', cycle: state.cycle, creationState: state.name ? 'ready' : 'none' } } : {}) };
}
export async function demoCalendarCall(action: string, payload: Record<string, unknown>) {
  const auth = await demoSettingsCall('admin_session', payload);
  const head = await demoSettingsCall(auth.role === 'owner' ? 'owner_read' : 'settings_read', payload);
  const displayName = (head.current as import('@/types/studioSettings').SettingsRevision | null)?.settings.studioConfig.displayName || payload.displayName;
  return transaction(String(payload.studioId), state => {
    if (action === 'calendar_toggle') {
      if (payload.expectedRevision !== state.revision) throw Object.assign(new Error('Conflict'), { code: 'SETTINGS_CONFLICT' });
      if (typeof payload.enabled !== 'boolean' || ![60,120,180,240,360,480].includes(Number(payload.durationMinutes))) throw new Error('Invalid integration input');
      if (payload.enabled && !state.enabled) state.cycle++;
      state.enabled = payload.enabled; state.durationMinutes = Number(payload.durationMinutes); state.revision++;
    } else if (action === 'calendar_create') {
      if (!state.enabled) throw new Error('Integration disabled');
      if (!state.name) { if (payload.expectedRevision !== state.revision) throw Object.assign(new Error('Conflict'), { code: 'SETTINGS_CONFLICT' }); state.name = String(displayName) + ' 촬영 일정'; state.createdAt = new Date().toISOString(); state.revision++; }
    } else if (action === 'calendar_retry') {
      const entry = state.entries[String(payload.contractId)];
      if (!state.enabled || !state.name || !entry || entry.status === 'synced') throw new Error('No retryable job');
      entry.status = 'synced'; entry.cycle = state.cycle; entry.eventId ||= crypto.createHash('sha256').update(entry.record.contractId).digest('hex');
    } else if (action !== 'calendar_status') throw new Error('Unknown action');
    return { success: true, integration: status(state, auth.role === 'master') };
  });
}
/** Demo persistence only; this never calls Google or sends invitations. */
export async function mirrorDemoCalendar(record: DemoSheetRecord, approval: boolean) {
  try { await transaction(record.studioId, state => {
    if (!record.snapshot || !state.enabled) return;
    const old = state.entries[record.contractId]; if ((!old && !approval) || (old && old.cycle !== state.cycle)) return;
    state.entries[record.contractId] = { record, durationMinutes: old?.durationMinutes || state.durationMinutes, cycle: old?.cycle || state.cycle,
      status: state.name ? 'synced' : 'failed', ...(state.name ? { eventId: old?.eventId || crypto.createHash('sha256').update(record.contractId).digest('hex') } : {}) };
  }); } catch { /* Optional mirror never changes Demo contract outcome. */ }
}
export async function demoCalendarBookingStates(studioId: string) {
  return transaction(studioId, state => Object.fromEntries(Object.entries(state.entries).map(([id, entry]) => [id, entry.status])));
}
