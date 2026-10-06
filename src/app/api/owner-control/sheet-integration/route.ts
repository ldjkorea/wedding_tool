import { measureRoute } from '@/services/requestTiming';
import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, requireAdmin } from '@/services/adminAuthentication';
import { sheetIntegrationCall as scopedIntegrationCall } from '@/services/sheetIntegrationStore';
import { readJsonRequest } from '@/lib/apiSafety';
// Role is supplied by this server route, never by customer/Owner JSON.
const sheetIntegrationCall: typeof scopedIntegrationCall = (action, session, payload = {}) => scopedIntegrationCall(action, session, { ...payload, role: 'owner' });
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export const GET = measureRoute(async (req: NextRequest) => {
  try {
    const session = await requireAdmin(req, 'owner', true), cursor = req.nextUrl.searchParams.get('cursor');
    if (cursor && cursor.length > 2000) throw new Error('설정 검증: 조회 범위를 확인해 주세요.');
    return NextResponse.json({ success: true, integration: await sheetIntegrationCall('status', session, cursor ? { cursor } : {}) }, { headers: adminHeaders });
  } catch (error) { return adminError(error); }
});
export const PUT = measureRoute(async (req: NextRequest) => {
  try {
    adminOrigin(req); const session = await requireAdmin(req, 'owner', true), body = await readJsonRequest(req, 4096);
    if (Object.keys(body).some(key => !['enabled','expectedRevision'].includes(key)) || typeof body.enabled !== 'boolean' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) throw new Error('설정 검증: 계약목록 사용 설정을 확인해 주세요.');
    return NextResponse.json({ success: true, integration: await sheetIntegrationCall('toggle', session, body) }, { headers: adminHeaders });
  } catch (error) { return adminError(error); }
});
export const POST = measureRoute(async (req: NextRequest) => {
  try {
    adminOrigin(req); const session = await requireAdmin(req, 'owner', true), body = await readJsonRequest(req, 4096);
    if (['read', 'sync'].includes(body.operation) && Object.keys(body).every(key => ['operation','cursor'].includes(key)) && (body.cursor === undefined || (typeof body.cursor === 'string' && body.cursor.length <= 2000))) {
      return NextResponse.json({ success: true, integration: await sheetIntegrationCall(body.operation, session, body.cursor ? {cursor: body.cursor} : {}) }, {headers: adminHeaders});
    }
    if (body.operation === 'create' && Object.keys(body).every(key => ['operation','expectedRevision'].includes(key)) && Number.isSafeInteger(body.expectedRevision) && body.expectedRevision >= 0) {
      return NextResponse.json({ success: true, integration: await sheetIntegrationCall('create', session, { expectedRevision: body.expectedRevision }) }, { headers: adminHeaders });
    }
    if (body.operation === 'retry' && Object.keys(body).every(key => ['operation','contractId'].includes(key)) && typeof body.contractId === 'string' && /^cnt_[a-zA-Z0-9_-]+$/.test(body.contractId)) {
      return NextResponse.json({ success: true, integration: await sheetIntegrationCall('retry', session, { contractId: body.contractId }) }, { headers: adminHeaders });
    }
    throw new Error('설정 검증: 계약목록 작업을 확인해 주세요.');
  } catch (error) { return adminError(error); }
});
