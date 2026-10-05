import crypto from 'crypto';
import { ContractFormData } from '@/types/contract';
import { getAppSecret } from './serverConfig';
import { getStudioConfig, getClientCompatibility } from '@/services/configuration';

const key = () => crypto.createHash('sha256').update(getAppSecret()).digest();
export interface DecodedApprovalPayload {
  contractId: string;
  studioId?: string;
  data?: ContractFormData; // Only old signed tokens contain customer data.
  iat: number;
  exp: number;
}
export function createApprovalToken(contractId: string, _data: ContractFormData, expiresInMs = 14 * 24 * 60 * 60 * 1000): string {
  const now = Date.now();
  const payload: DecodedApprovalPayload = { contractId, studioId: getStudioConfig().studioId, iat: now, exp: now + expiresInMs };
  const iv = crypto.randomBytes(16);
  const secret = key();
  const cipher = crypto.createCipheriv('aes-256-cbc', secret, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const encoded = Buffer.concat([iv, encrypted]).toString('base64url');
  return encoded + '.' + crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
}
export function verifyApprovalToken(token: string): DecodedApprovalPayload {
  const secret = key(); // Missing Production configuration must fail even for malformed input.
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token) || token.length > 50000) throw new Error('유효하지 않은 승인 토큰입니다.');
  const [encoded, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest();
  const supplied = Buffer.from(sig, 'base64url');
  if (supplied.toString('base64url') !== sig || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new Error('유효하지 않은 승인 토큰입니다.');
  try {
    const blob = Buffer.from(encoded, 'base64url');
    if (blob.toString('base64url') !== encoded) throw new Error();
    if (blob.length < 32 || (blob.length - 16) % 16 !== 0) throw new Error();
    const decipher = crypto.createDecipheriv('aes-256-cbc', secret, blob.subarray(0, 16));
    const payload = JSON.parse(Buffer.concat([decipher.update(blob.subarray(16)), decipher.final()]).toString('utf8')) as DecodedApprovalPayload;
    const ownerValid = payload.studioId === getStudioConfig().studioId ||
      (payload.studioId === undefined && !!payload.data && getClientCompatibility()?.legacyApprovalTokens === true);
    if (!ownerValid || !/^cnt_[a-zA-Z0-9_-]+$/.test(payload.contractId) || !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) || payload.exp <= payload.iat || payload.iat > Date.now() + 60000 || Date.now() >= payload.exp) throw new Error();
    return payload;
  } catch {
    throw new Error('승인 토큰이 유효하지 않거나 만료되었습니다.');
  }
}
