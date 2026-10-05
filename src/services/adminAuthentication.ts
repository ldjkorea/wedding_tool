import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAppSecret, getServerConfig, getDemoServerConfig, isDemoMode, requireSetting } from '@/lib/serverConfig';
import { signedGasCall, GasRequestError } from './gasTransport';
import { requireSettingsEnabled } from './studioSettingsStore';
import { readOwnerCredential, ensureOwnerCredentialReady } from './ownerCredentials';

class AdminUnauthorized extends Error {}
export type AdminRole = 'owner' | 'master';
function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}
export const ADMIN_COOKIE = 'studio_admin_session';
export const OWNER_COOKIE = 'studio_owner_session';
export const ADMIN_IDLE_SECONDS = 1800;
export function validateAdminPasswordHash(role: AdminRole = 'master'): string {
  const key = role === 'owner' ? 'STUDIO_OWNER_PASSWORD_HASH' : process.env.MASTER_ADMIN_PASSWORD_HASH?.trim() ? 'MASTER_ADMIN_PASSWORD_HASH' : 'STUDIO_ADMIN_PASSWORD_HASH';
  const value = requireSetting(key);
  if (!/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value)) throw new Error('서버 설정 오류: ' + key + ' 형식을 확인해 주세요.');
  if (role === 'owner' && value === validateAdminPasswordHash('master')) throw new Error('서버 설정 오류: 대표와 총관리자는 서로 다른 비밀번호를 사용해야 합니다.');
  getAppSecret();
  return value;
}
function sessionId(raw: string, role: AdminRole, hash: string) {
  return crypto.createHmac('sha256', getAppSecret()).update((role === 'owner' ? 'studio-owner-session\n' : 'studio-admin-session\n') + hash + '\n' + raw).digest('hex');
}
export function adminOrigin(req: NextRequest) {
  const origin = isDemoMode() ? getDemoServerConfig().appUrl : getServerConfig().appUrl;
  if (req.headers.get('origin') !== origin || req.headers.get('sec-fetch-site') === 'cross-site') throw new Error('관리자 요청 출처를 확인할 수 없습니다.');
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new Error('JSON 요청만 허용합니다.');
}
export async function loginAdmin(password: unknown, role: AdminRole = 'master'): Promise<string> {
  requireSettingsEnabled();
  await signedGasCall('admin_attempt', { role });
  const credential = role === 'owner' ? await readOwnerCredential() : null;
  const hash = credential?.hash || validateAdminPasswordHash(role);
  if (typeof password !== 'string' || (role === 'owner' ? !/^\d{6}$/.test(password) && password.length < 12 : password.length < 12) || password.length > 1024) throw new AdminUnauthorized('인증 정보를 확인해 주세요.');
  const parts = hash.split('$');
  const derived = await derivePassword(password, Buffer.from(parts[4], 'hex'));
  if (!crypto.timingSafeEqual(derived, Buffer.from(parts[5], 'hex'))) throw new AdminUnauthorized('인증 정보를 확인해 주세요.');
  if (role === 'owner') {
    const master = validateAdminPasswordHash('master').split('$');
    if (crypto.timingSafeEqual(await derivePassword(password, Buffer.from(master[4], 'hex')), Buffer.from(master[5], 'hex'))) throw new Error('서버 설정 오류: 대표와 총관리자는 서로 다른 비밀번호를 사용해야 합니다.');
  }
  if (credential) ensureOwnerCredentialReady(credential);
  const raw = crypto.randomBytes(32).toString('hex');
  await signedGasCall('admin_login', { sessionId: sessionId(raw, role, hash), role, ...(credential ? { credentialRevision: credential.revision } : {}) });
  return raw;
}
export async function requireAdmin(req: NextRequest, role: AdminRole = 'master'): Promise<string> {
  requireSettingsEnabled();
  const raw = req.cookies.get(role === 'owner' ? OWNER_COOKIE : ADMIN_COOKIE)?.value;
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw new AdminUnauthorized('관리자 인증이 필요합니다.');
  const credential = role === 'owner' ? await readOwnerCredential() : null;
  if (credential) ensureOwnerCredentialReady(credential);
  const id = sessionId(raw, role, credential?.hash || validateAdminPasswordHash(role));
  await signedGasCall('admin_session', { sessionId: id, role });
  return id;
}
export async function logoutAdmin(req: NextRequest, role: AdminRole = 'master') {
  const id = await requireAdmin(req, role);
  await signedGasCall('admin_logout', { sessionId: id, role });
}
export function setAdminCookie(response: NextResponse, raw: string, clear = false, role: AdminRole = 'master') {
  response.cookies.set(role === 'owner' ? OWNER_COOKIE : ADMIN_COOKIE, clear ? '' : raw, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/', maxAge: clear ? 0 : 8 * 3600,
  });
  return response;
}
export const adminHeaders = { 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
export function adminError(error: unknown, status = 502) {
  const code = error instanceof GasRequestError ? error.code : '';
  const message = error instanceof Error ? error.message : '';
  const config = message.startsWith('서버 설정');
  const validation = message.startsWith('설정 검증:') || message.startsWith('업체 설정 오류:');
  const conflict = message.startsWith('설정 충돌:');
  return NextResponse.json({ success: false, error: code === 'SETTINGS_CONFLICT' ? '설정 충돌: 다시 불러온 뒤 변경을 확인해 주세요.' : code === 'ADMIN_RATE_LIMIT' ? '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.' : config || validation || conflict ? message : '요청을 완료하지 못했습니다. 인증 또는 저장 상태를 다시 조회해 주세요.' },
    { status: code === 'ADMIN_UNAUTHORIZED' || error instanceof AdminUnauthorized ? 401 : code === 'ADMIN_RATE_LIMIT' ? 429 : code === 'SETTINGS_CONFLICT' ? 409 : config ? 503 : validation ? 400 : conflict ? 409 : status, headers: adminHeaders });
}
