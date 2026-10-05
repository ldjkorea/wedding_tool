import { withRuntimeConfiguration } from '@/services/serverRuntimeConfiguration';
import { NextRequest, NextResponse } from 'next/server';
import { getBackendAdapter } from '@/services/googleAppsScriptAdapter';
import { apiFailure } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
  try {
    return await withRuntimeConfiguration(async () => {
    const adapter = getBackendAdapter();
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return NextResponse.json({ success: false, error: '대표 검토 링크가 필요합니다.' }, { status: 401 });
    return NextResponse.json(await adapter.reviewContract(token), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    });
  } catch (error) { return apiFailure(error); }
}
