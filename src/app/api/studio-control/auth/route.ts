import { measureRoute } from '@/services/requestTiming';
import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, loginAdminWithInitialData, logoutAdmin, requireAdmin, setAdminCookie } from '@/services/adminAuthentication';
import { decodeAdminSettings } from '@/services/studioSettingsStore';
import { masterSettingsResponse } from '@/services/masterSettingsResponse';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export const POST = measureRoute(async (req: NextRequest) => {
  try {
    adminOrigin(req);
    const body = await readJsonRequest(req, 4096);
    if (body.initialView !== undefined && body.initialView !== 'settings') throw new Error('설정 검증: 로그인 정보를 확인해 주세요.');
    const result = await loginAdminWithInitialData(body.password, 'master', body.initialView as 'settings' | undefined);
    const initial = result.initial ? masterSettingsResponse(decodeAdminSettings(result.initial as Record<string, unknown>)) : undefined;
    return setAdminCookie(NextResponse.json({ success: true, ...(initial ? { initial } : {}) }, { headers: adminHeaders }), result.cookie);
  } catch (error) { return adminError(error); }
});
export const GET = measureRoute(async (req: NextRequest) => {
  try { await requireAdmin(req); return NextResponse.json({ success: true }, { headers: adminHeaders }); }
  catch (error) { return adminError(error); }
});
export const DELETE = measureRoute(async (req: NextRequest) => {
  try {
    adminOrigin(req); await logoutAdmin(req);
    return setAdminCookie(NextResponse.json({ success: true }, { headers: adminHeaders }), '', true);
  } catch (error) { return setAdminCookie(adminError(error), '', true); }
});
