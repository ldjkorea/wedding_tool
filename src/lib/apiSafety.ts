import { NextRequest, NextResponse } from 'next/server';

export function checkJsonRequest(req: NextRequest): void {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new Error('JSON 요청만 허용됩니다.');
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) throw new Error('허용되지 않은 요청 출처입니다.');
}
export async function readJsonRequest(req: NextRequest, maxBytes = 64000) {
  if (!req.body) throw new Error('요청 내용이 없습니다.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('요청 내용이 너무 큽니다.');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function apiFailure(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : '';
  const config = message.startsWith('서버 설정');
  return NextResponse.json({ success: false, error: config ? message : '요청을 처리하지 못했습니다. 입력값 또는 처리 상태를 확인해 주세요.' }, { status: config ? 503 : status, headers: { 'Cache-Control': 'no-store' } });
}
