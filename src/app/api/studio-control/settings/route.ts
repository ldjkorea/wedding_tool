import { measureRoute } from '@/services/requestTiming';
import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, requireAdmin } from '@/services/adminAuthentication';
import { readAdminSettings, saveAdminSettings } from '@/services/studioSettingsStore';
import { baseSettings } from '@/services/settingsValidation';
import { getServerConfig, getDemoServerConfig, isDemoMode } from '@/lib/serverConfig';
import packageManifest from '../../../../../package.json';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export const GET = measureRoute(async (req: NextRequest) => {
  try {
    const head = await readAdminSettings(await requireAdmin(req, 'master', true));
    const bootstrap = baseSettings();
    if (!head.current && !head.recoveryRequired && !bootstrap.studioConfig.representativeEmail) bootstrap.studioConfig.representativeEmail = isDemoMode() ? getDemoServerConfig().repEmail : getServerConfig().repEmail;
    return NextResponse.json({ success: true, settings: head.recoveryRequired ? null : head.current?.settings || bootstrap, revision: head.revision || head.current?.revision || 0, recoveryRequired: head.recoveryRequired || false,
      updatedAt: head.current?.updatedAt || null, history: head.history, system: { version: packageManifest.version, mode: isDemoMode() ? 'demo' : 'gas', storage: isDemoMode() ? '테스트 전용 저장소' : 'Google Drive' } }, { headers: adminHeaders });
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
