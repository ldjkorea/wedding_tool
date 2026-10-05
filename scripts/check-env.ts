// @next/env is already shipped with the installed Next.js dependency.
import { loadEnvConfig } from '@next/env';
import { settingsEnabled } from '../src/services/studioSettingsStore';
import { validateAdminPasswordHash } from '../src/services/adminAuthentication';
import { getBackendMode, getServerConfig, getDemoServerConfig } from '../src/lib/serverConfig';

try {
  const environment = process.argv[2] || 'production';
  if (!['production', 'development', 'test'].includes(environment) || process.argv.length > 3) {
    throw new Error('서버 설정 오류: 사용법 npm run check:env -- production|development|test');
  }
  if (process.env.NODE_ENV && process.env.NODE_ENV !== environment) {
    throw new Error('서버 설정 충돌: NODE_ENV와 check:env의 환경 인자가 다릅니다.');
  }
  Object.assign(process.env, { NODE_ENV: environment });
  loadEnvConfig(process.cwd(), environment === 'development', {
    info: () => {},
    error: () => { throw new Error('서버 설정 오류: .env 파일을 읽지 못했습니다.'); },
  });
  const mode = getBackendMode();
  if (mode === 'demo') getDemoServerConfig();
  else getServerConfig();
  if (settingsEnabled()) {
    validateAdminPasswordHash('master');
    if (process.env.STUDIO_OWNER_PASSWORD_HASH?.trim()) validateAdminPasswordHash('owner');
  }
  console.log('환경 설정 확인 완료: ' + environment + ' / ' + mode + '. 외부 GAS·메일·Drive는 호출하지 않았습니다.');
} catch (error) {
  const message = error instanceof Error && error.message.startsWith('서버 설정')
    ? error.message : '서버 설정 확인 실패';
  console.error(message);
  process.exitCode = 1;
}
