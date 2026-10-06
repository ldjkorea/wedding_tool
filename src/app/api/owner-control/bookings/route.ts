import { measureRoute } from '@/services/requestTiming';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminHeaders, adminError } from '@/services/adminAuthentication';
import { signedGasCall } from '@/services/gasTransport';
import { isDemoMode } from '@/lib/serverConfig';
import { MockBackendAdapter } from '@/services/mockBackendAdapter';
import { projectOwnerBookings } from '@/services/ownerBookingsResponse';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export const GET = measureRoute(async (req: NextRequest) => {
  try {
    const sessionId = await requireAdmin(req, 'owner', true);
    const cursor = req.nextUrl.searchParams.get('cursor');
    if (cursor && cursor.length > 2000)
      throw new Error('설정 검증: 목록 조회 정보를 확인해 주세요.');
    const result = isDemoMode()
      ? { bookings: await MockBackendAdapter.ownerBookings(sessionId), nextCursor: null }
      : await signedGasCall('owner_bookings', { sessionId, ...(cursor ? { cursor } : {}) });
    return NextResponse.json(projectOwnerBookings(result), { headers: adminHeaders });
  } catch (error) { return adminError(error); }
});
