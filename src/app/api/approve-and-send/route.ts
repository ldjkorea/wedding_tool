import { withRuntimeConfiguration } from '@/services/serverRuntimeConfiguration';
import { NextRequest, NextResponse } from 'next/server';
import { getBackendAdapter } from '@/services/googleAppsScriptAdapter';
import { verifyApprovalToken } from '@/lib/token';
import { apiFailure, checkJsonRequest, readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function POST(req: NextRequest) {
  try {
    return await withRuntimeConfiguration(async () => {
    checkJsonRequest(req);
    const adapter = getBackendAdapter();
    const body = await readJsonRequest(req, 15000000);
    verifyApprovalToken(body.token);
    if (body.phase !== 'prepare' && body.phase !== 'send') throw new Error('승인 단계가 올바르지 않습니다.');
    if (body.phase === 'prepare' && !Number.isSafeInteger(body.expectedRevision)) throw new Error('검토 버전이 필요합니다.');
    const result = await adapter.approveAndSendContract({ token: body.token, phase: body.phase, expectedRevision: body.expectedRevision, updatedData: body.updatedData, pdfBase64: body.pdfBase64, snapshotHash: body.snapshotHash });
    return NextResponse.json(result, { status: result.success ? 200 : 409, headers: { 'Cache-Control': 'no-store' } });
    });
  } catch (error) { return apiFailure(error); }
}
