import { demoCalendarCall } from './demoCalendarIntegration';
import crypto from 'node:crypto';
import { getStudioConfig } from './configuration';
import { demoSettingsCall } from './demoStudioSettings';
import { demoSheetCall } from './demoSheetIntegration';
import { getServerConfig, isDemoMode } from '@/lib/serverConfig';
export class GasRequestError extends Error { constructor(public code: string) { super('백엔드 요청이 거부되었습니다.'); } }
export type GasResult = Record<string, unknown> & { success: boolean; error?: string; code?: string };
export async function signedGasCall(action: string, payload: Record<string, unknown>, webAppUrl?: string): Promise<GasResult> {
    if (isDemoMode()) {
      try { return await (action.startsWith('calendar_') ? demoCalendarCall : action.startsWith('sheet_') ? demoSheetCall : demoSettingsCall)(action, { ...payload, studioId: getStudioConfig().studioId }); }
      catch (error) { const code = (error as { code?: string }).code; if (code) throw new GasRequestError(code); throw error; }
    }
    const config = getServerConfig();
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const payloadJson = JSON.stringify({ ...(payload as Record<string, unknown>), studioId: getStudioConfig().studioId });
    const signature = crypto.createHmac('sha256', config.gasSecret).update(`${timestamp}\n${nonce}\n${action}\n${payloadJson}`).digest('hex');
    let response: Response;
    try {
      response = await fetch(webAppUrl || config.gasUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ action, payloadJson, timestamp, nonce, signature }),
      });
    } catch {
      throw new Error('백엔드 응답을 확인하지 못했습니다. 같은 계약으로 상태를 확인해 주세요.');
    }
    if (!response.ok) throw new Error('백엔드 HTTP 오류');
    let result: GasResult;
    try { result = await response.json(); } catch { throw new Error('백엔드 응답 형식 오류'); }
    if (!result || typeof result.success !== 'boolean') throw new Error('백엔드 응답 형식 오류');
    if (!result.success) {
      if (['ADMIN_UNAUTHORIZED', 'ADMIN_RATE_LIMIT', 'SETTINGS_CONFLICT'].includes(result.code || '')) throw new GasRequestError(result.code!);
      if (typeof result.error === 'string' && /^Configuration (missing|invalid): (GAS_SHARED_SECRET|CONTRACTS_FOLDER_ID|STUDIO_SETTINGS_FOLDER_ID)$/.test(result.error)) {
        throw new Error('서버 설정 오류: GAS Script Properties — ' + result.error);
      }
      throw new Error('백엔드가 처리를 완료하지 못했습니다. 상태 확인이 필요합니다.');
    }
    return result;
}
