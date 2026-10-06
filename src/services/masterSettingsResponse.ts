import { baseSettings } from './settingsValidation';
import { getServerConfig, getDemoServerConfig, isDemoMode } from '@/lib/serverConfig';
import type { SettingsHead } from '@/types/studioSettings';
import packageManifest from '../../package.json';

/** The existing Master settings projection, shared by GET and the authenticated login response. */
export function masterSettingsResponse(head: SettingsHead) {
  const bootstrap = baseSettings();
  if (!head.current && !head.recoveryRequired && !bootstrap.studioConfig.representativeEmail) bootstrap.studioConfig.representativeEmail = isDemoMode() ? getDemoServerConfig().repEmail : getServerConfig().repEmail;
  return { success: true, settings: head.recoveryRequired ? null : head.current?.settings || bootstrap,
    revision: head.revision || head.current?.revision || 0, recoveryRequired: head.recoveryRequired || false,
    updatedAt: head.current?.updatedAt || null, history: head.history,
    system: { version: packageManifest.version, mode: isDemoMode() ? 'demo' : 'gas', storage: isDemoMode() ? '테스트 전용 저장소' : 'Google Drive' } };
}
