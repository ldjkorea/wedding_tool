import { NextRequest, NextResponse } from 'next/server';
import { adminError, adminHeaders, adminOrigin, requireAdmin } from '@/services/adminAuthentication';
import { ownerSettingsHead, projectOwnerSettings, saveOwnerSettings } from '@/services/ownerSettingsStore';
import { readJsonRequest } from '@/lib/apiSafety';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
  try {
    const head = await ownerSettingsHead(await requireAdmin(req, 'owner', true));
    return NextResponse.json({ success: true, settings: projectOwnerSettings(head.settings), version: head.revision,
      benefits: head.settings.discountsConfig.map(rule => ({ id: rule.id, timing: rule.type === 'cashback' ? '추후 캐시백' : '즉시 할인', condition: rule.eligibility.kind === 'weekday' ? ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][rule.eligibility.weekday || 0] + ' 예식' : rule.eligibility.kind === 'partner' ? '유효한 할인코드를 입력한 고객' : rule.eligibility.kind === 'portfolio' ? '사진 사용에 동의한 고객' : '후기를 작성한 고객' })) }, { headers: adminHeaders });
  } catch (error) { return adminError(error); }
}
export async function PUT(req: NextRequest) {
  try {
    adminOrigin(req); const sessionId = await requireAdmin(req, 'owner', true), body = await readJsonRequest(req, 200000);
    if (Object.keys(body).some(key => !['changes','version'].includes(key))) throw new Error('설정 검증: 변경할 수 없는 항목입니다.');
    const saved = await saveOwnerSettings(sessionId, body.changes, body.version);
    return NextResponse.json({ success: true, version: saved.revision }, { headers: adminHeaders });
  } catch (error) { return adminError(error); }
}
