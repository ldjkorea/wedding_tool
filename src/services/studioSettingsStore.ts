import crypto from 'node:crypto';
import { signedGasCall } from './gasTransport';
import { getBaseClientConfiguration } from './configuration';
import { baseSettings, validateStudioSettings } from './settingsValidation';
import type { SettingsRevision, SettingsHead, StudioSettings } from '@/types/studioSettings';

export function settingsEnabled() {
  const flag = process.env.STUDIO_SETTINGS_ENABLED?.trim();
  if (flag && flag !== 'true' && flag !== 'false') throw new Error('서버 설정 오류: STUDIO_SETTINGS_ENABLED는 true 또는 false여야 합니다.');
  return flag === 'true';
}
export function requireSettingsEnabled() {
  if (!settingsEnabled()) throw new Error('서버 설정 오류: 관리자 기능에는 STUDIO_SETTINGS_ENABLED=true가 필요합니다.');
}
export function settingsHash(settings: StudioSettings) { return crypto.createHash('sha256').update(JSON.stringify(settings)).digest('hex'); }
export function verifySettingsRevision(value: unknown): SettingsRevision {
  const revision = value as SettingsRevision;
  if (!revision || revision.schemaVersion !== 1 || revision.studioId !== getBaseClientConfiguration().studioConfig.studioId ||
      !Number.isSafeInteger(revision.revision) || revision.revision < 1 || !Number.isFinite(Date.parse(revision.updatedAt)) ||
      !revision.settings || revision.hash !== settingsHash(revision.settings)) throw new Error('서버 설정 오류: 저장된 설정 무결성 검증 실패. 이전 revision 복구가 필요합니다.');
  try { validateStudioSettings(revision.settings, revision.settings); } catch { throw new Error('서버 설정 오류: 저장된 설정 validation 실패. 이전 revision 복구가 필요합니다.'); }
  return revision;
}
export async function readRuntimeSettings(): Promise<SettingsRevision | null> {
  if (!settingsEnabled()) return null;
  const result = await signedGasCall('settings_runtime', {});
  if (result.current === null) return null;
  const revision = result.current as SettingsRevision & { publicHash?: string };
  if (!/^[a-f0-9]{64}$/.test(revision.hash || '') || !/^[a-f0-9]{64}$/.test(revision.publicHash || '')) throw new Error('서버 설정 오류: 공개 설정 응답 무결성 오류. 앱과 GAS 버전을 확인해 주세요.');
  verifySettingsRevision({ ...revision, hash: revision.publicHash });
  if ('partnerCodes' in revision.settings) throw new Error('서버 설정 오류: 공개 설정에 비공개 항목이 포함되었습니다.');
  return revision;
}
export async function readAdminSettings(sessionId: string): Promise<SettingsHead> {
  requireSettingsEnabled();
  const result = await signedGasCall('settings_read', { sessionId });
  const history = result.history as SettingsHead['history'];
  if (!Array.isArray(history) || history.length > 20 || history.some(item => !Number.isSafeInteger(item.revision) || item.revision < 1 || !Number.isFinite(Date.parse(item.updatedAt)) || !/^[a-f0-9]{64}$/.test(item.hash))) throw new Error('서버 설정 오류: 설정 이력 응답 오류');
  if (!Number.isSafeInteger(result.revision) || Number(result.revision) < 0) throw new Error('서버 설정 오류: 설정 revision 응답 오류');
  try { return { recoveryRequired: result.recoveryRequired === true, revision: result.revision as number, current: result.current === null ? null : verifySettingsRevision(result.current), history }; }
  catch { return { recoveryRequired: true, revision: result.revision as number, current: null, history }; }

}
export async function saveAdminSettings(sessionId: string, input: unknown, expectedRevision: number): Promise<SettingsRevision> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('설정 검증: expectedRevision');
  const head = await readAdminSettings(sessionId);
  if (head.recoveryRequired) throw new Error('설정 충돌: 저장본이 손상되었습니다. 이전 revision 복구를 먼저 진행해 주세요.');
  if ((head.current?.revision || 0) !== expectedRevision) throw new Error('설정 충돌: 다른 창에서 변경되었습니다. 다시 불러오세요.');
  const settings = validateStudioSettings(input, head.current?.settings || baseSettings());
  const result = await signedGasCall('settings_save', { sessionId, expectedRevision, settings, hash: settingsHash(settings) });
  const stored = verifySettingsRevision(result.current);
  if (stored.revision !== expectedRevision + 1 || stored.hash !== settingsHash(settings)) throw new Error('서버 설정 오류: 저장 결과를 확인하지 못했습니다. 다시 조회해 주세요.');
  return stored;
}
export async function restoreAdminSettings(sessionId: string, revision: number, expectedRevision: number): Promise<SettingsRevision> {
  if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('설정 검증: 복구 revision');
  const result = await signedGasCall('settings_revision', { sessionId, revision });
  const old = verifySettingsRevision(result.current);
  // Restoring creates a new revision; the append-only audit history never rolls backwards.
  const settings = validateStudioSettings(old.settings, old.settings);
  const saved = await signedGasCall('settings_restore', { sessionId, revision, expectedRevision, settings, sourceHash: old.hash, hash: settingsHash(settings) });
  return verifySettingsRevision(saved.current);
}
