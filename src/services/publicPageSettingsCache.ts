import crypto from 'node:crypto';
import { getServerConfig, isDemoMode } from '@/lib/serverConfig';
import { getBaseClientConfiguration } from './configuration';
import type { SettingsRevision } from '@/types/studioSettings';

// Only the public page uses this cache. Contract mutations and authentication always read fresh.
export const PUBLIC_PAGE_SETTINGS_TTL_MS = 60_000;
type Entry = { expiresAt: number; value?: SettingsRevision | null; pending?: Promise<SettingsRevision | null> };
// Next route bundles share this process-local store, so settings writes invalidate page reads too.
const processCache = globalThis as typeof globalThis & { __weddingPublicPageSettingsCache?: Map<string, Entry> };
const entries = processCache.__weddingPublicPageSettingsCache ??= new Map<string, Entry>();

function scope() {
  // Validate the environment even on a cache hit; no cached configuration can hide missing secrets.
  const server = getServerConfig(), base = getBaseClientConfiguration();
  return crypto.createHash('sha256').update(JSON.stringify([
    base.studioConfig.studioId, server.gasUrl, server.appUrl, base,
  ])).digest('hex');
}
export function invalidatePublicPageSettings() {
  if (!isDemoMode()) entries.delete(scope());
}
export async function readPublicPageSettings(read: () => Promise<SettingsRevision | null>) {
  if (isDemoMode()) return read();
  const key = scope(), existing = entries.get(key);
  if (existing?.pending) return structuredClone(await existing.pending);
  if (existing && existing.expiresAt > Date.now()) return structuredClone(existing.value!);
  const entry: Entry = { expiresAt: 0 };
  // Bound memory if a process is reused for multiple deployment configurations.
  if (!entries.has(key) && entries.size >= 8) entries.delete(entries.keys().next().value!);
  entries.set(key, entry);
  entry.pending = read().then(value => {
    if (value && 'partnerCodes' in value.settings) throw new Error('공개 설정에 비공개 항목이 포함되었습니다.');
    if (entries.get(key) === entry) {
      entry.value = structuredClone(value); entry.expiresAt = Date.now() + PUBLIC_PAGE_SETTINGS_TTL_MS;
      entry.pending = undefined;
    }
    return value;
  }).catch(error => {
    if (entries.get(key) === entry) entries.delete(key);
    throw error;
  });
  return structuredClone(await entry.pending);
}
