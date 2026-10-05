import { NextRequest, NextResponse } from 'next/server';
import {
  requireAdmin,
  adminOrigin,
  adminHeaders,
  adminError,
} from '@/services/adminAuthentication';
import { withOwnerReview } from '@/services/ownerReviewContext';
import { withRuntimeConfiguration } from '@/services/serverRuntimeConfiguration';
import { getBackendAdapter } from '@/services/googleAppsScriptAdapter';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
  try {
    const sessionId = await requireAdmin(req, 'owner'),
      id = req.nextUrl.searchParams.get('id') || '';
    return await withRuntimeConfiguration(() =>
      withOwnerReview(sessionId, id, async () =>
        NextResponse.json(await getBackendAdapter().reviewContract(''), { headers: adminHeaders }),
      ),
    );
  } catch (error) {
    return adminError(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    adminOrigin(req);
    const sessionId = await requireAdmin(req, 'owner');
    const body = await readJsonRequest(req, 15000000);
    if (
      Object.keys(body).some(
        (key) =>
          ![
            'contractId',
            'phase',
            'expectedRevision',
            'updatedData',
            'pdfBase64',
            'snapshotHash',
          ].includes(key),
      ) ||
      !['prepare', 'send'].includes(body.phase) ||
      (body.phase === 'prepare' && !Number.isSafeInteger(body.expectedRevision))
    )
      throw new Error('설정 검증: 계약 승인 요청을 확인해 주세요.');
    return await withRuntimeConfiguration(() =>
      withOwnerReview(sessionId, body.contractId, async () => {
        const result = await getBackendAdapter().approveAndSendContract({
          token: '',
          phase: body.phase,
          expectedRevision: body.expectedRevision,
          updatedData: body.updatedData,
          pdfBase64: body.pdfBase64,
          snapshotHash: body.snapshotHash,
        });
        return NextResponse.json(result, {
          status: result.success ? 200 : 409,
          headers: adminHeaders,
        });
      }),
    );
  } catch (error) {
    return adminError(error);
  }
}
