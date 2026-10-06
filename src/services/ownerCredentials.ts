import crypto from 'node:crypto';
import { isDemoMode } from '@/lib/serverConfig';
import { signedGasCall } from './gasTransport';

export const PASSWORD_HASH_PATTERN = /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/;
export type OwnerCredential = { hash: string; revision: number; source: 'master' | 'environment' | 'initial' };
export function hashPassword(password: string, salt = crypto.randomBytes(16)): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(`scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`);
    });
  });
}

/** Authentication storage is private and independent of restorable business settings. */
export async function readOwnerCredential(): Promise<OwnerCredential> {
  const result = await signedGasCall('admin_owner_credential_read', {});
  return ownerCredentialFromResult(result);
}

/** Decode only a server-to-server response; never send a credential to the browser. */
export async function ownerCredentialFromResult(result: Record<string, unknown>): Promise<OwnerCredential> {
  if (!Number.isSafeInteger(result.revision) || Number(result.revision) < 0)
    throw new Error('서버 설정 오류: 대표 비밀번호 저장 상태를 확인해 주세요.');
  const revision = Number(result.revision);
  if (result.hash !== null) {
    if (typeof result.hash !== 'string' || !PASSWORD_HASH_PATTERN.test(result.hash) || revision < 1)
      throw new Error('서버 설정 오류: 대표 비밀번호 저장 상태를 확인해 주세요.');
    return { hash: result.hash, revision, source: 'master' };
  }
  if (revision !== 0) throw new Error('서버 설정 오류: 대표 비밀번호 저장 상태를 확인해 주세요.');
  const configured = process.env.STUDIO_OWNER_PASSWORD_HASH?.trim();
  if (configured) {
    if (!PASSWORD_HASH_PATTERN.test(configured)) throw new Error('서버 설정 오류: STUDIO_OWNER_PASSWORD_HASH 형식을 확인해 주세요.');
    return { hash: configured, revision, source: 'environment' };
  }
  // Publicly documented initial PIN; only non-production Demo can use it for data access.
  const hash = await hashPassword('000000', Buffer.alloc(16));
  return { hash, revision, source: 'initial' };
}

export function ensureOwnerCredentialReady(credential: OwnerCredential) {
  if (credential.source === 'initial' && !isDemoMode())
    throw new Error('서버 설정 오류: 초기 비밀번호입니다. 총관리자가 사장님 비밀번호를 설정한 후 이용해 주세요.');
}
