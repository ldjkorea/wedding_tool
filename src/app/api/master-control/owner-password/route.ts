import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, requireAdmin, validateAdminPasswordHash } from '@/services/adminAuthentication';
import { hashPassword, readOwnerCredential } from '@/services/ownerCredentials';
import { signedGasCall } from '@/services/gasTransport';
import { readJsonRequest } from '@/lib/apiSafety';
import { getStudioConfig } from '@/services/configuration';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, 'master');
    const credential = await readOwnerCredential();
    return NextResponse.json({ success: true, studioName: getStudioConfig().displayName, revision: credential.revision, source: credential.source }, { headers: adminHeaders });
  } catch (error) { return adminError(error); }
}
export async function PUT(req: NextRequest) {
  try {
    adminOrigin(req);
    const sessionId = await requireAdmin(req, 'master');
    const body = await readJsonRequest(req, 4096);
    if (Object.keys(body).some(key => !['password', 'expectedRevision'].includes(key)) ||
        typeof body.password !== 'string' || !/^\d{6}$/.test(body.password) || body.password === '000000')
      throw new Error('설정 검증: 초기 비밀번호 000000과 다른 숫자 6자리를 입력해 주세요.');
    if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0)
      throw new Error('설정 검증: 비밀번호 상태를 다시 불러와 주세요.');
    const masterHash = validateAdminPasswordHash('master');
    if (await hashPassword(body.password, Buffer.from(masterHash.split('$')[4], 'hex')) === masterHash)
      throw new Error('설정 검증: 총관리자와 다른 비밀번호를 입력해 주세요.');
    const result = await signedGasCall('admin_owner_credential_set', { sessionId, hash: await hashPassword(body.password), expectedRevision: body.expectedRevision });
    if (result.revision !== Number(body.expectedRevision) + 1) throw new Error('비밀번호 저장 확인 실패');
    return NextResponse.json({ success: true, revision: result.revision }, { headers: adminHeaders });
  } catch (error) { return adminError(error); }
}
