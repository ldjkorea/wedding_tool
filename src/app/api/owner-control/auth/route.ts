import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, loginAdmin, logoutAdmin, requireAdmin, setAdminCookie } from '@/services/adminAuthentication';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function POST(req: NextRequest) {
  try {
    adminOrigin(req); const body = await readJsonRequest(req, 4096);
    if (Object.keys(body).some(key => key !== 'password')) throw new Error('설정 검증: 로그인 정보를 확인해 주세요.');
    return setAdminCookie(NextResponse.json({ success: true }, { headers: adminHeaders }), await loginAdmin(body.password, 'owner'), false, 'owner');
  } catch (error) { return adminError(error); }
}
export async function GET(req: NextRequest) {
  try { await requireAdmin(req, 'owner'); return NextResponse.json({ success: true }, { headers: adminHeaders }); }
  catch (error) { return adminError(error); }
}
export async function DELETE(req: NextRequest) {
  try { adminOrigin(req); await logoutAdmin(req, 'owner'); return setAdminCookie(NextResponse.json({ success: true }, { headers: adminHeaders }), '', true, 'owner'); }
  catch (error) { return setAdminCookie(adminError(error), '', true, 'owner'); }
}
