import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, requireAdmin } from '@/services/adminAuthentication';
import { readAdminSettings, saveAdminSettings } from '@/services/studioSettingsStore';
import { baseSettings } from '@/services/settingsValidation';
import { getServerConfig, getDemoServerConfig, isDemoMode } from '@/lib/serverConfig';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
  try {
    const head = await readAdminSettings(await requireAdmin(req));
    const bootstrap = baseSettings();
    if (!head.current && !head.recoveryRequired && !bootstrap.studioConfig.representativeEmail) bootstrap.studioConfig.representativeEmail = isDemoMode() ? getDemoServerConfig().repEmail : getServerConfig().repEmail;
    return NextResponse.json({ success: true, settings: head.recoveryRequired ? null : head.current?.settings || bootstrap, revision: head.revision || head.current?.revision || 0, recoveryRequired: head.recoveryRequired || false,
      updatedAt: head.current?.updatedAt || null, history: head.history }, { headers: adminHeaders });
  } catch (error) { return adminError(error); }
}
export async function PUT(req: NextRequest) {
  try {
    adminOrigin(req); const session = await requireAdmin(req);
    const body = await readJsonRequest(req, 2000000);
    if (Object.keys(body).some(key => !['settings', 'expectedRevision'].includes(key))) throw new Error('설정 검증: 허용되지 않은 요청 항목');
    const current = await saveAdminSettings(session, body.settings, body.expectedRevision);
    return NextResponse.json({ success: true, revision: current.revision, updatedAt: current.updatedAt }, { headers: adminHeaders });
  } catch (error) { return adminError(error, 502); }
}
