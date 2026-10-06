import { measureRoute } from '@/services/requestTiming';
import { NextRequest, NextResponse } from 'next/server';
import {
  adminOrigin,
  adminHeaders,
  adminError,
  loginAdminWithInitialData,
  setAdminCookie,
} from '@/services/adminAuthentication';
import { readJsonRequest } from '@/lib/apiSafety';
import { projectOwnerBookings } from '@/services/ownerBookingsResponse';
export const dynamic = 'force-dynamic';
export const POST = measureRoute(async (req: NextRequest) => {
  try {
    adminOrigin(req);
    const body = await readJsonRequest(req, 4096);
    if (Object.keys(body).some((key) => !['password', 'initialView'].includes(key)) || (body.initialView !== undefined && body.initialView !== 'bookings'))
      throw new Error('설정 검증: 로그인 정보를 확인해 주세요.');
    // Invalid format still consumes the existing durable attempt budget.
    const password =
      typeof body.password === 'string' && /^\d{6}$/.test(body.password) ? body.password : '';
    const result = await loginAdminWithInitialData(password, 'owner', body.initialView as 'bookings' | undefined);
    const initial = result.initial ? projectOwnerBookings(result.initial as Record<string, unknown>) : undefined;
    return setAdminCookie(
      NextResponse.json({ success: true, ...(initial ? { initial } : {}) }, { headers: adminHeaders }),
      result.cookie,
      false,
      'owner',
    );
  } catch (error) {
    return adminError(error);
  }
});
