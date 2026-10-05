# 웨딩 부킹 프로그램

사장님 초기 비밀번호와 총관리자 변경: [운영 안내](docs/OWNER_PASSWORD.md).

업체별 Client Configuration과 독립 GAS를 연결하는 웨딩스냅 계약 자동화 Core입니다. 고객 정보 접수 → 대표 검토·수정 → 승인 Snapshot → PDF → 고객·대표 이메일 흐름을 제공합니다.

## 목차

1. 개발 기준
2. 새 업체 Config 생성
3. Production 환경변수
4. Production / Development / Demo·Test
5. GAS 설정
6. Email 설정
7. 환경 확인과 build
8. deploy
9. 변경·실패 복구와 참고 자료

## 1. 개발 기준

개발은 별도 Wedding_Contract_Core 작업공간에서 진행합니다. 최초 Client Configuration은 Dear Memory이며, 판매된 원본 저장소와 운영 자원을 변경하지 않습니다. 업체마다 Config·도메인·secret·GAS·비공개 Drive 폴더를 분리합니다.

설정은 빌드 시 선택합니다. 실행 중 여러 업체를 전환하는 시스템은 제공하지 않습니다.

## 2. 새 업체 Config 생성

1. src/config/clients/moment-studio의 독립 설정을 새 업체 폴더로 복사합니다. 신규 업체에는 Dear Memory의 compatibility 설정이나 과거 Snapshot 자료를 복사하지 않습니다.
2. studio.ts: 업체 ID·명칭·대표·연락처·홈페이지·로고·직인·색상·계약번호 prefix·발신 표시명을 수정합니다.
3. products.ts / options.ts / discounts.ts: 업체가 승인한 가격·구성·할인·Cashback을 입력합니다.
4. contractPolicy.ts: 계약금·입금·납품·취소/환불·보관·저작권·약관을 검토하고 version을 정합니다.
5. formSchema.ts: 기존 12개 입력의 enabled / required / label / placeholder를 설정합니다.
6. index.ts에서 ClientConfiguration을 묶어 export하고 src/config/client.ts의 선택을 새 Client로 바꿉니다.
7. 고정 legacy-v1.ts / legacy-assets.ts / legacy-formSchema.ts는 이전 계약 호환 기록입니다. 업체 값으로 덮어쓰지 않습니다.

```ts
// src/config/client.ts
import { sampleStudioConfiguration } from './clients/sample-studio';
export const clientConfiguration = sampleStudioConfiguration;
```

핵심 성명·예식일/시간·실제 예식장·수신 이메일·상품·약관 동의는 필수입니다. 후기 Cashback은 계약 총액에서 차감하지 않습니다. 세부 편집 안내는 docs/COMPANY_SETTINGS.md와 docs/FORM_SCHEMA_CONFIGURATION.md에 있습니다.

## 3. Production 환경변수

.env.example에는 실제 URL·수신 이메일·secret 없이 변수만 제공합니다.

```powershell
npm.cmd ci
Copy-Item -LiteralPath .env.example -Destination .env.production.local
```

복사한 파일 또는 호스팅의 서버 환경변수에 해당 업체 값을 입력합니다. 실제 값이 들어간 .env*는 Git에서 제외하며 .env.example만 추적합니다.

| 변수 | Production 기준 |
|---|---|
| NODE_ENV | production. next build/start가 지정하므로 일반 .env 파일에 별도 선언하지 않습니다 |
| BACKEND_MODE | gas 필수. 누락·오타·demo는 오류 |
| APP_SECRET | 업체별 무작위 32자 이상 서버 secret. 승인 token 및 계약 ID에 사용 |
| GAS_SHARED_SECRET | APP_SECRET과 다른 무작위 32자 이상 값. GAS와 HMAC 서명 공유 |
| APP_URL | 실제 앱의 HTTPS origin. 경로·query·hash·사용자 인증정보 제외 |
| GAS_WEBAPP_URL | 전용 Apps Script HTTPS /exec 배포 URL. /dev 및 query/hash/인증정보 불허 |
| REPRESENTATIVE_EMAIL | 실제 접수 알림·대표 완료 메일 수신 이메일. Config fallback 없음 |

APP_SECRET과 GAS_SHARED_SECRET은 각각 독립적으로 생성합니다. 다음 명령은 저장할 때 실행할 예시이며 출력값을 서버 비밀 저장소에 보관합니다.

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

secret을 NEXT_PUBLIC_*나 Client Configuration, next.config의 env 옵션에 넣지 않습니다. APP_URL은 서버에서 Review Link를 만들 때 읽습니다. 실제 GAS URL과 대표 수신자도 서버 환경에서만 읽습니다.

### 이전 배포 호환

| 신규 변수 | 허용되는 이전 별칭 |
|---|---|
| APP_URL | NEXT_PUBLIC_APP_URL |
| REPRESENTATIVE_EMAIL | STUDIO_REP_EMAIL. DEAR_MEMORY_REP_EMAIL은 Dear Memory Client에서만 허용 |

이전 별칭만 있는 배포도 읽을 수 있습니다. 값이 다른 신규/이전 변수가 동시에 있으면 **설정 충돌**로 실패합니다. 앱 주소의 끝 슬래시와 이메일 대소문자는 비교 시 정규화합니다. 신규 업체는 신규 변수만 설정합니다.

studioConfig.representativeEmail은 공개 업체 메타데이터입니다. 운영 메일 수신자 누락을 이 값으로 대신 채우지 않습니다.

## 4. Production / Development / Demo·Test

| NODE_ENV / BACKEND_MODE | 동작 |
|---|---|
| production / gas | 실제 GAS·메일·Drive. 모든 실 연동 설정 필요 |
| production / demo | 명확한 설정 오류. Mock 활성화 불가 |
| development / gas | 명시적 실 연동. 별도 staging GAS/Drive/수신자 사용. APP_URL은 localhost HTTP 허용 |
| development / demo | 명시적 로컬 Demo. 실제 GAS·Gmail·Drive 호출 없음 |
| test / demo | 테스트용 인메모리 Demo |
| test / gas | 테스트 runner가 명시적으로 분리한 GAS fixture 또는 연동 대상 사용. 자동 Mock 전환 없음 |
| 미설정/미지원 NODE_ENV 또는 BACKEND_MODE | 설정 오류. 자동 모드 선택 없음 |

Development라고 해서 Mock이 자동 활성화되지 않습니다. 서버를 development로 실행하면서 gas를 선택하면 실제 외부 자원을 호출할 수 있습니다.

### 로컬 Demo

.env.development.local을 다음처럼 작성합니다.

```dotenv
BACKEND_MODE=demo
APP_URL=http://localhost:3000
```

```powershell
npm.cmd run check:env -- development
npm.cmd run dev
```

Demo에서 APP_SECRET을 생략하면 프로세스별 무작위 키를 사용하며 서버 재시작 시 Demo Review token은 무효화됩니다. 명시한 secret이 잘못된 값이면 Demo에서도 오류입니다. APP_URL 생략 시 Demo에 한해 localhost:3000을 사용합니다. 대표 수신자 생략 시 가상 메일함의 Demo fixture를 사용합니다.

Test는 runner에서 NODE_ENV=test를 명시합니다. .env.test.local / .env.test를 사용할 수 있고 Next.js 방식에 따라 test에서는 .env.local을 읽지 않습니다. NODE_ENV=demo나 staging은 사용하지 않습니다.

## 5. GAS 설정

1. 해당 업체 소유 계정으로 **새 Apps Script 프로젝트**와 **별도 비공개 Drive 폴더**를 만듭니다.
2. google-apps-script/Code.gs를 새 프로젝트에 적용합니다.
3. 프로젝트 설정의 Script Properties에 아래 값을 입력합니다.
4. 필요한 Gmail·Drive 권한을 해당 계정으로 승인합니다. 짝꿍 코드 조회에는 Sheets 권한을 사용하지 않습니다.
5. 새 Web App 배포를 만들고 배포자로 실행하도록 설정합니다. 앱 서버는 Google 로그인 세션 없이 signed POST를 보내므로 해당 접근이 허용되는 설정이 필요합니다. 조직 정책이 이를 제한하면 이 연동은 그대로 사용할 수 없습니다.
6. 발급된 /exec URL을 앱의 GAS_WEBAPP_URL에 입력합니다. 편집자 전용 /dev URL은 사용하지 않습니다.
7. Code.gs를 수정할 때에는 운영 배포의 버전도 갱신합니다.

| Script Property | 용도 |
|---|---|
| GAS_SHARED_SECRET | 앱 서버와 동일한 공유 secret |
| CONTRACTS_FOLDER_ID | 실행 계정이 쓸 수 있는 업체 전용 비공개 Drive 폴더 |
| STUDIO_SETTINGS_FOLDER_ID | 관리자 설정용 별도 비공개 Drive 폴더. 계약 폴더와 다른 ID |

짝꿍 할인코드는 **업체 관리자 설정 → 할인 / 혜택 → 짝꿍 할인코드**에서 등록합니다. 코드마다 할인금액과 사용 여부를 지정하며 설정 revision에 비공개로 저장됩니다. `STUDIO_SETTINGS_ENABLED=true`와 관리자 해시를 설정한 후 사용하세요. 등록 코드가 없으면 할인을 적용하지 않습니다. 기존 Sheets 코드 목록을 자동으로 가져오거나 테스트 코드로 대체하지 않습니다. 운영자가 기존 코드를 확인해 직접 등록해야 합니다. 자세한 전환·사용 절차는 [할인코드 운영 안내](docs/STUDIO_SETTINGS_UX_AND_CODES.md)에 있습니다.

복제본 .clasp.json의 과거 scriptId 바인딩은 제거했습니다. CLI를 사용할 경우 새 업체 프로젝트에 연결하는 별도 .clasp.local.json을 로컬에 보관합니다. 연결 대상 확인 전 push하지 않습니다. Apps Script 편집기로 코드를 적용할 수도 있습니다.

GAS는 HMAC/timestamp/nonce를 검사하고 GET에서 업무 처리를 하지 않습니다. 필수 Script Property가 없으면 허용된 설정명만 오류로 반환하며 secret 값이나 원문 진단은 노출하지 않습니다. 자세한 상태·복구 절차는 google-apps-script/README.md에 있습니다.

배포 방식은 [Google Web Apps 공식 안내](https://developers.google.com/apps-script/guides/web)를 기준으로 작성했습니다.

## 6. Email 설정

- 실제 메일은 **GAS 배포 실행 계정의 GmailApp**으로 발송합니다. SMTP나 별도 이메일 API key는 현재 코드에 없습니다.
- REPRESENTATIVE_EMAIL은 대표 알림 및 완료 메일의 **수신자**입니다. Gmail 실제 발신 계정을 바꾸는 값이 아닙니다.
- studioConfig.emailSenderName은 발신 **표시명**입니다. 주소·도메인의 발신 권한을 설정하지 않습니다.
- 고객 수신자는 최종 승인 Snapshot의 email입니다.
- 접수 당시 대표 수신자를 접수 레코드에 저장합니다. env 변경만으로 기존 접수의 수신자를 소급 변경하지 않습니다.
- 대표 알림 실패 시에도 영속 접수가 확인되면 고객에게 접수를 반환할 수 있습니다. 이것은 메일 도착 확인이 아닙니다.
- 최종 발송은 고객·대표 Gmail 호출과 PDF/상태 저장이 완료되어야 success입니다. 수신함 도착·반송까지 보장하지 않습니다.

Gmail 권한·계정 제한·할당량 및 실제 수신은 해당 업체 staging에서 확인합니다.

## 7. 환경 확인과 build

```powershell
npm.cmd run check:env -- production
npm.cmd run typecheck
npm.cmd run typecheck:tests
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

check:env는 기존 Next.js의 @next/env 로더와 같은 중앙 검증을 사용합니다. 설정 값은 출력하지 않고 환경/모드 또는 누락·오류 변수명만 표시합니다. GAS·Gmail·Drive 호출은 없습니다. 잘못된 환경에서는 종료 코드 1입니다.

읽기 우선순위는 process.env → .env.[환경].local → .env.local(test 제외) → .env.[환경] → .env입니다. NODE_ENV를 명령 인자와 다르게 설정하면 충돌 오류입니다. .env.example은 자동으로 읽지 않습니다. 환경변수 로딩과 NEXT_PUBLIC_* 처리 기준은 [Next.js 15 공식 문서](https://nextjs.org/docs/15/app/guides/environment-variables)를 따릅니다.

build는 코드 컴파일을 확인하는 단계입니다. 실제 운영 설정의 유효성은 check:env로 별도 확인하고, 서버도 업무 요청 시 같은 설정을 검사하여 오류를 503으로 반환합니다. Production 설정 오류를 build 성공으로 숨기지 않습니다.

check:env는 기존 개발 의존성 tsx를 사용하므로 npm ci로 개발 의존성을 포함한 설정/빌드 단계에서 실행합니다. 최종 runtime에서 devDependencies를 제거했다면 tsx 명령을 실행하지 않아도 업무 요청의 서버 검증은 유지됩니다.

## 8. deploy

### Next.js 호스팅

1. 새 업체 Config를 선택한 독립 저장소/배포 프로젝트를 연결합니다.
2. 서버 환경에 Production 변수 전체를 등록합니다. 공용 앱과 서로 다른 secret·GAS·Drive를 사용합니다.
3. 설치·설정 확인·타입 검사·build를 수행합니다.
4. API Route를 지원하는 Next.js/Node.js 배포로 실행합니다. 이 시스템은 정적 HTML export만으로 동작하지 않습니다.
5. 실제 HTTPS 주소를 APP_URL과 맞추고 staging에서 고객 접수 → 대표 수정 → 승인 → Snapshot PDF → 고객·대표 메일을 확인합니다.
6. 해당 업체 운영 도메인에 적용합니다. 환경 변경 후 서버를 재시작하거나 재배포합니다.

### 직접 Node.js 호스팅

같은 서버 환경과 Production 값을 주입한 상태에서 다음 명령으로 실행합니다.

```powershell
npm.cmd run start
```

앞서 npm ci, check:env, typecheck, build를 완료해야 합니다. HTTPS·도메인·프로세스 재시작과 필요한 요청 timeout은 호스팅에서 설정합니다. GAS 호출에는 25초 timeout이 있고 접수/승인 API의 maxDuration은 90초이므로 플랫폼 제한도 확인합니다.

Next.js 호스팅 방식은 [공식 Self-Hosting 안내](https://nextjs.org/docs/15/app/guides/self-hosting)를 참고합니다. 이 안내 작성 과정에서 실제 배포를 수행한 것은 아닙니다.

## 9. 변경·실패 복구와 참고 자료

APP_SECRET 변경은 기존 승인 token을 무효화하고 같은 입력의 계약 ID도 바꿉니다. 미처리 계약을 확인하지 않고 secret을 교체하거나 계약을 새로 제출해 복구하지 않습니다. GAS_SHARED_SECRET은 앱 서버와 GAS를 함께 갱신해야 합니다.

이메일 sending/unknown 상태는 자동 재발송하지 않습니다. Gmail 발송함·수신자·계약번호·첨부를 운영자가 대조한 뒤 복구합니다.

### V1 출시 검사와 운영 조건

`npm test`는 Dear Memory와 MOMENT STUDIO를 차례로 선택하여 타입·lint·공격 테스트·Production build·실제 Chrome/PDF 검증을 실행합니다. 공유 Core의 SHA-256이 바뀌지 않는지 확인하고 원래 Client 선택을 복원합니다. 현재 기본 선택은 가상 업체 MOMENT STUDIO입니다. Dear Memory 배포 전 해당 Client 선택과 **별도 build**가 필요합니다. 이 테스트는 실제 고객이나 Google 서비스에 메시지를 보내지 않습니다.

- 앱과 새 Code.gs를 함께 배포해야 합니다. 모든 서명 요청·레코드·새 승인 token은 studioId를 검증합니다. 업체마다 고유 ID와 별도 GAS·Drive 폴더·secret·도메인을 사용합니다. 하나의 배포에서 여러 업체를 전환하는 SaaS 기능은 없습니다.
- 과거 레코드에 studio 소유 정보가 없으면 접근을 차단합니다. 미발송 계약에 접수 당시 정책 해시가 없어도 승인을 차단합니다. 이전 운영 자료를 새 업체 폴더에 복사하거나 소유자를 자동으로 덮어쓰지 않습니다. 운영자가 원본 업체·계약·승인 상태를 대조한 뒤 전용 staging에서 호환성을 확인해야 합니다.
- 미발송 접수는 접수 당시 Config 해시와 현재 정책이 다르면 승인을 차단합니다. 가격·약관·폼·브랜드 설정 변경 전에 미처리 계약을 완료하거나 운영자가 개별 재검토해야 합니다. 이미 최종 발송한 Snapshot은 당시 내용으로 유지됩니다.
- 메일 unknown/sending은 실제 Gmail 결과를 확인하기 전 pending으로 되돌리지 않습니다. 저장 계약번호·Snapshot hash·revision·PDF와 발송함/수신자를 대조하고 근거를 남깁니다. 고객 sent/대표 pending인 경우에만 남은 대표 메일 재시도를 허용합니다.
- 승인 URL은 bearer credential입니다. 앱은 no-referrer/no-store를 사용하고 신규 token에는 개인정보를 넣지 않지만 메일함·브라우저 방문 기록·호스팅 로그 접근은 운영자가 보호해야 합니다. 프록시 로그에서 token/query를 제거하고 계약 JSON/PDF 폴더 공개 공유를 금지합니다.
- PDF hash 표식은 정상 앱의 Snapshot 연결과 오래된 파일 혼용을 검사합니다. 승인 권한을 가진 사람이 임의 PDF를 제작하지 못하게 증명하는 서버 렌더링은 없습니다. 대표는 발송 전 Preview를 확인하고 승인 링크를 공유하지 않습니다.
- 익명 접수의 대량 악용과 GAS/Gmail 할당량에 대비하여 호스팅 요청 제한·오류 알림·미처리/unknown 점검·비공개 백업을 운영 환경에서 설정합니다.
- 실제 Android/iOS 및 Kakao 인앱의 PDF/다운로드, 실제 GAS 동시 요청과 권한·할당량, Gmail 수신·반송은 업체별 staging 출시 점검 사항입니다. UA/viewport 시뮬레이션을 실제 기기 검증으로 간주하지 않습니다.

최종 공격 검토와 근거는 docs/RELEASE_RED_TEAM.md를 확인합니다. scratch의 과거 수동 점검 스크립트는 LEGACY_TEST_APP_URL의 명시적 loopback 주소만 허용하며 정식 인수 검증에는 사용하지 않습니다.

- docs/COMPANY_SETTINGS.md: 업체 Config
- docs/FORM_SCHEMA_CONFIGURATION.md: 폼 입력 상태
- docs/WHITE_LABEL_CONFIGURATION.md: Config 구조와 Snapshot 호환
- docs/PRODUCTION_HARDENING.md: 기존 P0/P1 보완
- google-apps-script/README.md: GAS 상태와 실패 복구

### 보호된 업체 설정 관리

`/studio-control`에서 Desktop 업체정보·상품·옵션·할인·정책·폼 설정을 관리한다. 고객 화면에는 관리자 navigation을 제공하지 않는다. `STUDIO_SETTINGS_ENABLED=true`로 모듈을 명시적으로 활성화하고 `STUDIO_ADMIN_PASSWORD_HASH`, 전용 GAS의 `STUDIO_SETTINGS_FOLDER_ID`를 설정해야 한다. 저장본은 계약 폴더와 분리되며 불변 revision/활성 포인터로 관리한다. 상세 최초 설정·비밀번호 해시 생성·기존 계약 보호·복구·staging 점검은 [관리자 운영 안내](docs/STUDIO_ADMINISTRATION.md)를 따른다.

`npm test`는 기존 릴리스 테스트에 두 Client의 관리자 서버 테스트를 추가한다. 실제 관리자 UI/Demo 영구 저장 검증은 `npm run test:settings-browser`로 별도 실행한다. 브라우저 테스트는 현재 Client 선택을 유지하며 기존 로컬 Demo 설정과 분리된 테스트 전용 폴더만 사용한다.

### 선택형 Google Sheets 계약목록

관리자 **외부 연동**에서 기본 OFF인 계약목록을 켜고 새 비공개 Sheet를 생성할 수 있습니다. 연결 ID를 직접 입력하지 않습니다. 계약 접수·확정·발송은 영속 Record에 대기 상태만 기록하고 별도 GAS 시간 기반 작업이 같은 계약 행을 갱신합니다. Sheets 오류는 계약/PDF/메일 성공을 되돌리지 않습니다. 연동 설정은 상품·약관 revision과 분리되며 할인코드 DB로 사용하지 않습니다. 원본은 계속 계약 Record·Snapshot·PDF·발송 상태입니다.

`npm run test:sheets`는 실제 Code.gs/API와 모의 Google I/O로 검증하며 `npm test`에서 두 Client 모두 실행합니다. 생성·권한·trigger·실제 행 동작은 별도 staging 확인이 필요합니다. 운영 방법과 컬럼·복구·검증 범위는 [선택형 계약목록 안내](docs/OPTIONAL_CONTRACT_SHEETS.md)를 따릅니다.

## 업체대표와 총관리자

대표용 운영 화면은 /studio-control, 전체 도입 설정은 /master-control입니다. 역할별 비밀번호와 서버 권한을 분리합니다. 기존 관리자 인증은 총관리자로 유지합니다. [역할·환경 설정·이전 절차](docs/OWNER_MASTER_ADMINISTRATION.md)를 확인하세요.

### 사장님 예약현황

고객 화면의 브랜드명/로고를 3초 안에 5회 누르면 `/owner`의 숨겨진 로그인으로 이동합니다. 6자리 Owner PIN으로 로그인하면 월간 달력, 날짜별 예약 목록, 대표 확인 대기, 계약 Review, Calendar 등록 상태를 확인할 수 있습니다. PC는 좌우, 모바일은 상하로 배치합니다. 조회와 승인을 분리하며 기존 이메일 승인 토큰과 확정 Snapshot을 유지합니다. [PIN 설정·운영·보안 안내](docs/OWNER_BOOKINGS.md)를 확인하세요.

`npm run test:bookings`와 `npm run test:bookings-browser`는 예약 권한과 실제 브라우저 흐름을 검증합니다. 운영에서는 최신 GAS 반영과 별도 Staging 검증이 필요하며, 로컬 Demo의 가상 예약은 서버 재시작 시 보존되지 않습니다.

### 선택형 Google Calendar 촬영일정

대표 **촬영 일정** 메뉴에서 기본 OFF인 Calendar를 켜고 업체 전용 캘린더를 생성할 수 있습니다. 고객 접수 시에는 일정이 만들어지지 않습니다. 대표 승인으로 Snapshot이 영속 저장된 뒤 별도 작업자가 등록하며, 최종 이메일 완료 후 같은 일정을 갱신합니다. Calendar 오류는 계약/PDF/이메일/Sheets 성공을 되돌리지 않습니다. 기본 표시시간 3시간은 운영 화면 표시값이며 계약조건이 아닙니다. 기존 계약과 상품/약관 설정 revision을 변경하지 않습니다.

`npm run test:calendar`는 실제 Code.gs를 Fake Google 서비스로 검증합니다. 실제 Google 인증·Calendar API 권한·trigger는 Staging에서 따로 확인해야 합니다. [사용법·권한·중복 방지·복구 안내](docs/OPTIONAL_CONTRACT_CALENDAR.md)와 [권한 manifest 예시](docs/calendar-appsscript.example.json)를 확인하세요.
