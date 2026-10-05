import { NextRequest, NextResponse } from 'next/server';
import { getBackendAdapter } from '@/services/googleAppsScriptAdapter';
import { MockBackendAdapter } from '@/services/mockBackendAdapter';
import { clearSentRegistry } from '@/lib/idempotency';
import { isDemoMode } from '@/lib/serverConfig';
import { apiFailure, checkJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!isDemoMode()) return NextResponse.json({ success: false }, { status: 404 });
  return NextResponse.json({ success: true, mailbox: await getBackendAdapter().getMockMailbox!() }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: NextRequest) {
  if (!isDemoMode()) return NextResponse.json({ success: false }, { status: 404 });
  try {
    checkJsonRequest(req);
    MockBackendAdapter.clearMailbox();
    clearSentRegistry();
    return NextResponse.json({ success: true });
  } catch (error) { return apiFailure(error); }
}
