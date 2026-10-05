import { NextRequest, NextResponse } from 'next/server';
import {
  adminOrigin,
  adminHeaders,
  adminError,
  loginAdmin,
  setAdminCookie,
} from '@/services/adminAuthentication';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    adminOrigin(req);
    const body = await readJsonRequest(req, 4096);
    if (Object.keys(body).some((key) => key !== 'password'))
      throw new Error('설정 검증: 로그인 정보를 확인해 주세요.');
    // Invalid format still consumes the existing durable attempt budget.
    const password =
      typeof body.password === 'string' && /^\d{6}$/.test(body.password) ? body.password : '';
    return setAdminCookie(
      NextResponse.json({ success: true }, { headers: adminHeaders }),
      await loginAdmin(password, 'owner'),
      false,
      'owner',
    );
  } catch (error) {
    return adminError(error);
  }
}
