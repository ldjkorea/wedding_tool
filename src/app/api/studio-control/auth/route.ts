import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, loginAdmin, logoutAdmin, requireAdmin, setAdminCookie } from '@/services/adminAuthentication';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function POST(req: NextRequest) {
  try {
    adminOrigin(req);
    const body = await readJsonRequest(req, 4096);
    const raw = await loginAdmin(body.password);
    return setAdminCookie(NextResponse.json({ success: true }, { headers: adminHeaders }), raw);
  } catch (error) { return adminError(error); }
}
export async function GET(req: NextRequest) {
  try { await requireAdmin(req); return NextResponse.json({ success: true }, { headers: adminHeaders }); }
  catch (error) { return adminError(error); }
}
export async function DELETE(req: NextRequest) {
  try {
    adminOrigin(req); await logoutAdmin(req);
    return setAdminCookie(NextResponse.json({ success: true }, { headers: adminHeaders }), '', true);
  } catch (error) { return setAdminCookie(adminError(error), '', true); }
}
