import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, requireAdmin } from '@/services/adminAuthentication';
import { restoreAdminSettings } from '@/services/studioSettingsStore';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function POST(req: NextRequest) {
  try {
    adminOrigin(req); const session = await requireAdmin(req, 'master', true);
    const body = await readJsonRequest(req, 4096);
    const current = await restoreAdminSettings(session, body.revision, body.expectedRevision);
    return NextResponse.json({ success: true, revision: current.revision }, { headers: adminHeaders });
  } catch (error) { return adminError(error, 502); }
}
