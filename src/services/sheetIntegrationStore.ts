import { signedGasCall } from './gasTransport';
import { getBaseClientConfiguration } from './configuration';
import type { SheetIntegrationStatus } from '@/types/sheetIntegration';

/** This private integration document never enters business settings or configurationBinding. */
export async function sheetIntegrationCall(action: 'status' | 'toggle' | 'create' | 'retry', sessionId: string, payload: Record<string, unknown> = {}) {
  const result = await signedGasCall('sheet_' + action, { ...payload, sessionId, ...(action === 'create' ? { displayName: getBaseClientConfiguration().studioConfig.displayName } : {}) });
  const value = result.integration as SheetIntegrationStatus;
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.enabled !== 'boolean' ||
      !['disabled', 'disconnected', 'connected', 'error'].includes(value.connection) || typeof value.name !== 'string' || typeof value.url !== 'string' ||
      (value.url && !/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+\/edit$/.test(value.url)) ||
      typeof value.demo !== 'boolean' || typeof value.workerReady !== 'boolean' || !value.counts || !Array.isArray(value.jobs) || value.jobs.length > 30 ||
      Object.values(value.counts).some(count => !Number.isSafeInteger(count) || count < 0) ||
      value.jobs.some(job => !/^cnt_[a-zA-Z0-9_-]+$/.test(job.contractId) || typeof job.contractNumber !== 'string' || !['pending','failed','unknown'].includes(job.status)) ||
      (value.nextCursor !== null && (typeof value.nextCursor !== 'string' || value.nextCursor.length > 2000))) throw new Error('서버 설정 오류: 계약목록 연동 응답을 확인할 수 없습니다.');
  return value;
}
