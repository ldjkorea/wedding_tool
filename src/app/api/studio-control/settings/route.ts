import { measureRoute } from '@/services/requestTiming';
import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, requireAdmin } from '@/services/adminAuthentication';
import { readAdminSettings, saveAdminSettings } from '@/services/studioSettingsStore';
import { masterSettingsResponse } from '@/services/masterSettingsResponse';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export const GET = measureRoute(async (req: NextRequest) => {
  try {
    const head = await readAdminSettings(await requireAdmin(req, 'master', true));
    return NextResponse.json(masterSettingsResponse(head), { headers: adminHeaders });
  } catch (error) { return adminError(error); }
});
export const PUT = measureRoute(async (req: NextRequest) => {
  try {
    adminOrigin(req); const session = await requireAdmin(req, 'master', true);
    const body = await readJsonRequest(req, 2000000);
    if (Object.keys(body).some(key => !['settings', 'expectedRevision'].includes(key))) throw new Error('설정 검증: 허용되지 않은 요청 항목');
    const current = await saveAdminSettings(session, body.settings, body.expectedRevision);
    return NextResponse.json({ success: true, revision: current.revision, updatedAt: current.updatedAt }, { headers: adminHeaders });
  } catch (error) { return adminError(error, 502); }
});
