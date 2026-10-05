import { withRuntimeConfiguration } from '@/services/serverRuntimeConfiguration';
import { NextRequest, NextResponse } from 'next/server';
import { getBackendAdapter } from '@/services/googleAppsScriptAdapter';
import { configurationBinding } from '@/lib/contractWorkflow';
import { settingsEnabled } from '@/services/studioSettingsStore';
import { canonicalForm } from '@/lib/contractValidation';
import { apiFailure, checkJsonRequest, readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function POST(req: NextRequest) {
  try {
    return await withRuntimeConfiguration(async () => {
    checkJsonRequest(req);
    const adapter = getBackendAdapter();
    if (settingsEnabled() && req.headers.get('x-contract-configuration') !== configurationBinding()) {
      return NextResponse.json({ success: false, error: '업체 설정이 변경되었습니다. 새로고침 후 금액과 약관을 다시 확인해 주세요.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    const data = canonicalForm(await readJsonRequest(req));
    const result = await adapter.submitContract({ formData: data });
    if (!result.success || !result.contractId) return NextResponse.json({ success: false, error: result.error || '접수를 확인하지 못했습니다.' }, { status: 502 });
    return NextResponse.json({ success: true, contractId: result.contractId, message: result.message }, { headers: { 'Cache-Control': 'no-store' } });
    });
  } catch (error) { return apiFailure(error); }
}
