import { withRuntimeConfiguration } from '@/services/serverRuntimeConfiguration';
import { NextRequest, NextResponse } from 'next/server';
import { getBackendAdapter } from '@/services/googleAppsScriptAdapter';
import { apiFailure, checkJsonRequest, readJsonRequest } from '@/lib/apiSafety';
import { configurationBinding } from '@/lib/contractWorkflow';
import { settingsEnabled } from '@/services/studioSettingsStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    return await withRuntimeConfiguration(async () => {
    checkJsonRequest(req);
    if (settingsEnabled() && req.headers.get('x-contract-configuration') !== configurationBinding()) return NextResponse.json({ success: false, valid: false, discountAmount: 0, error: '업체 설정이 변경되었습니다. 새로고침 후 다시 확인해 주세요.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    const adapter = getBackendAdapter();
    const body = await readJsonRequest(req, 4096);
    if (!body || typeof body.code !== 'string' || body.code.length > 100) throw new Error('할인코드 형식을 확인해 주세요.');
    const code = body.code.trim();

    if (!code) {
      return NextResponse.json({
        success: true,
        valid: false,
        code: '',
        discountAmount: 0,
        message: '짝꿍 코드를 입력해 주세요.',
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const result = await adapter.validatePartnerCode(code);

    return NextResponse.json(result, { status: result.success ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
    });
  } catch (error) { return apiFailure(error, 500); }
}
