import crypto from 'crypto';
import { getDemoConfig, getClientCompatibility } from '@/services/configuration';

type RuntimeEnvironment = 'production' | 'development' | 'test';
type BackendMode = 'gas' | 'demo';

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const environment = process.env.NODE_ENV;
  if (environment !== 'production' && environment !== 'development' && environment !== 'test') {
    throw new Error('서버 설정 오류: NODE_ENV는 production, development 또는 test여야 합니다.');
  }
  return environment;
}

export function isDemoMode(): boolean {
  return process.env.BACKEND_MODE?.trim() === 'demo' &&
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');
}

export function getBackendMode(): BackendMode {
  const environment = getRuntimeEnvironment();
  const mode = process.env.BACKEND_MODE?.trim();
  if (mode === 'demo') {
    if (environment === 'production') throw new Error('서버 설정 오류: Production에서 BACKEND_MODE=demo는 허용되지 않습니다.');
    return 'demo';
  }
  if (mode !== 'gas') throw new Error('서버 설정 오류: BACKEND_MODE에 gas 또는 명시적 demo가 필요합니다.');
  return 'gas';
}

export function requireSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('서버 설정 누락: ' + name);
  return value;
}

/** Old deployments remain readable; conflicting aliases fail instead of silently choosing a target. */
function aliasedSetting(name: string, aliases: string[], required: boolean, normalize = (value: string) => value): string {
  const entries = [name, ...aliases]
    .map(key => ({ key, value: process.env[key]?.trim() || '' }))
    .filter(entry => entry.value);
  if (!entries.length) {
    if (required) throw new Error('서버 설정 누락: ' + name);
    return '';
  }
  if (entries.some(entry => normalize(entry.value) !== normalize(entries[0].value))) {
    throw new Error('서버 설정 충돌: ' + entries.map(entry => entry.key).join(', '));
  }
  return entries[0].value;
}

function secretSetting(name: string, value: string): string {
  if (value.length < 32 || /^(replace-|your-|change-)/i.test(value)) {
    throw new Error('서버 설정 오류: ' + name + '은 고유한 32자 이상 값이어야 합니다.');
  }
  return value;
}

let demoSecret: string | undefined;
export function getAppSecret(): string {
  getRuntimeEnvironment();
  const value = process.env.APP_SECRET?.trim();
  if (value) return secretSetting('APP_SECRET', value);
  if (isDemoMode()) return demoSecret ??= crypto.randomBytes(32).toString('hex');
  throw new Error('서버 설정 누락: APP_SECRET');
}

function parsedUrl(value: string, name: string): URL {
  try { return new URL(value); } catch { throw new Error('서버 설정 오류: ' + name + ' URL 형식을 확인해 주세요.'); }
}
function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}
function appOrigin(value: string, allowLocalHttp: boolean): string {
  const url = parsedUrl(value, 'APP_URL');
  const local = isLoopback(url.hostname);
  if ((url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:')) ||
      (!allowLocalHttp && local) || /(^|\.)(example|invalid|test)$|^example\.(com|org|net)$|^your-domain\./i.test(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('서버 설정 오류: APP_URL은 실제 앱의 origin이어야 합니다. Production은 공개 HTTPS 주소가 필요합니다.');
  }
  return url.origin;
}
function representativeEmail(value: string, real: boolean): string {
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value) ||
      (real && /@(?:example\.(?:com|org|net)|[^@]+\.(?:example|invalid|test))$/i.test(value))) {
    throw new Error('서버 설정 오류: REPRESENTATIVE_EMAIL에 유효한 대표 수신 이메일이 필요합니다.');
  }
  return value;
}

export function getServerConfig() {
  if (getBackendMode() !== 'gas') throw new Error('서버 설정 오류: 실 연동에는 BACKEND_MODE=gas가 필요합니다.');
  const appSecret = getAppSecret();
  const gasUrl = requireSetting('GAS_WEBAPP_URL');
  const url = parsedUrl(gasUrl, 'GAS_WEBAPP_URL');
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) || url.username || url.password || url.search || url.hash) {
    throw new Error('서버 설정 오류: GAS_WEBAPP_URL은 HTTPS Apps Script /exec 배포 주소여야 합니다.');
  }
  const appUrl = appOrigin(aliasedSetting('APP_URL', ['NEXT_PUBLIC_APP_URL'], true, value => value.replace(/\/$/, '')), getRuntimeEnvironment() !== 'production');
  const repEmail = representativeEmail(aliasedSetting('REPRESENTATIVE_EMAIL', ['STUDIO_REP_EMAIL', ...(getClientCompatibility()?.representativeEmailAliases || [])], true, value => value.toLowerCase()), true);
  const gasSecret = secretSetting('GAS_SHARED_SECRET', requireSetting('GAS_SHARED_SECRET'));
  if (gasSecret === appSecret) throw new Error('서버 설정 오류: APP_SECRET과 GAS_SHARED_SECRET은 서로 다른 값이어야 합니다.');
  return { gasUrl: url.href, appUrl, repEmail, gasSecret };
}

/** The only local URL and generated secret defaults are behind an explicit non-production Demo flag. */
export function getDemoServerConfig() {
  if (getBackendMode() !== 'demo') throw new Error('서버 설정 오류: Demo는 명시적 BACKEND_MODE=demo에서만 사용할 수 있습니다.');
  getAppSecret();
  const appUrl = appOrigin(aliasedSetting('APP_URL', ['NEXT_PUBLIC_APP_URL'], false, value => value.replace(/\/$/, '')) || 'http://localhost:3000', true);
  const repEmail = representativeEmail(aliasedSetting('REPRESENTATIVE_EMAIL', ['STUDIO_REP_EMAIL', ...(getClientCompatibility()?.representativeEmailAliases || [])], false, value => value.toLowerCase()) || getDemoConfig().representativeEmail, false);
  return { appUrl, repEmail };
}
