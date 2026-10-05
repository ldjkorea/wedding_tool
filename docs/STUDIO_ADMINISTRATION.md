# 총관리자 상세 설정 운영 안내

## 목차

현재 관리자 화면의 입력 도움말·고급 설정·저장 전 변경 요약과 할인코드 운영 절차는 [관리자 UX 및 할인코드 안내](STUDIO_SETTINGS_UX_AND_CODES.md)를 함께 참고한다. 할인코드 목록은 공개 Config에 포함하지 않는 관리자 전용 데이터다.

선택형 운영 계약목록은 **외부 연동**에서 설정한다. [Google Sheets 계약목록 안내](OPTIONAL_CONTRACT_SHEETS.md)의 ON/OFF·생성·개별 재동기화 절차를 따른다. Business Config revision과 분리된 설정이며 기본 OFF다. 계약/PDF/이메일의 공식 원본을 바꾸지 않는다.

1. 운영 범위와 관리자 URL
2. 인증과 세션
3. 최초 설정과 활성화
4. 저장 구조와 설정 우선순위
5. 변경 가능한 항목과 보호 항목
6. 계약과 Snapshot 보호
7. 저장 실패·손상·복구
8. 테스트와 출시 점검
9. 후속 작업

## 1. 운영 범위와 관리자 URL

관리자는 `/master-control`에서 설정을 관리한다. 고객 navigation에는 링크·메뉴가 없다. 1,024px 미만 화면에는 PC 이용 안내만 제공한다. 화면 크기 제한은 UX 정책이며 API 권한 검증은 별도다.

Single-tenant 배포 하나에 Client 하나를 유지한다. CRM·계약 목록·직원 계정·권한 등급·구독·멀티테넌트는 추가하지 않았다. 고객 계약 화면의 디자인과 입력→검토→확정→PDF→발송 단계는 유지한다.

관리자 페이지 shell에는 로그인 UI만 있으며 저장된 설정 조회·수정·복구 API는 모두 인증이 필요하다. 고객 페이지에는 계약 작성에 필요한 **적용된 공개 업체 정보·상품·약관·폼**이 전달된다. 공개 계약 정보를 숨기는 것은 보안 목표가 아니다. 관리자 세션·revision 이력·변경 기능·인프라 secret은 고객에 전달하지 않는다.

## 2. 인증과 세션

- 별도 계정 DB 없이 업체 관리자 비밀번호 하나를 사용한다. 평문 비밀번호 대신 환경변수 `STUDIO_ADMIN_PASSWORD_HASH`의 scrypt 해시를 서버에서 검증한다. Node 내장 crypto를 사용하며 신규 라이브러리는 없다.
- 16-byte 랜덤 salt, 64-byte 결과, N=16384/r=8/p=1. 해시와 비밀번호는 Client props·응답·URL·localStorage에 넣지 않는다.
- 32-byte 랜덤 세션을 HttpOnly·SameSite=Strict·host-only 쿠키에 넣는다. Production에서는 Secure가 필수다. Demo 개발의 loopback HTTP에서는 Secure를 사용하지 않는다.
- GAS에는 APP_SECRET과 비밀번호 해시로 바인딩한 세션 HMAC만 저장한다. 비밀번호·쿠키 원문은 저장하지 않는다.
- 마지막 인증된 요청 이후 30분 미사용, 로그인 이후 최대 8시간. 브라우저가 사용 중일 때만 heartbeat하며, 타이머만으로 무사용 세션을 연장하지 않는다.
- 로그아웃은 GAS 세션을 삭제해 복사된 쿠키도 차단한다. APP_SECRET 또는 비밀번호 해시 교체도 기존 세션을 무효화한다.
- 업체 전체 15분 동안 로그인 시도 10회까지, 성공 포함. 최대 5세션이며 초과 시 가장 오래된 세션을 제거한다. 제한은 GAS Script Properties에 저장해 앱 인스턴스 재시작으로 우회되지 않는다. 429 응답을 제공한다.
- 설정 변경·로그인·로그아웃·복구는 설정한 APP_URL과 동일 Origin 및 JSON을 요구한다. 외부 Origin 및 누락 Origin을 차단한다. 세션·설정 응답과 페이지는 no-store/private, noindex/nofollow다.

이 방식은 신뢰하는 업체 대표 한 명이 운영하는 환경에 맞춘 선택이다. 공유 비밀번호는 직원별 책임 추적이나 세부 권한 분리를 제공하지 않는다. 대량 로그인 요청 자체의 GAS 호출 비용과 잠금 경합을 줄이는 호스팅 요청 제한은 별도로 설정한다.

## 3. 최초 설정과 활성화

1. 기존 APP_SECRET·GAS_SHARED_SECRET·APP_URL·GAS_WEBAPP_URL·REPRESENTATIVE_EMAIL 설정은 계속 필수다. 관리자 화면에서 인프라를 변경할 수 없다.
2. 계약 파일 폴더와 다른 **전용 비공개 Drive 폴더**를 만든다. GAS 실행 계정에 접근권한을 주고 Script Properties에 `STUDIO_SETTINGS_FOLDER_ID`를 넣는다. 두 폴더 ID가 같으면 차단한다.
3. 수정된 Code.gs를 전용 GAS 프로젝트에 배포한다. 기존 HMAC·nonce·timestamp 검증을 유지한다. 기존 계약 폴더를 이 설정 폴더로 지정하지 않는다.
4. 12자 이상 고유 비밀번호의 scrypt 해시를 만든다. 암호는 shell 명령줄 인수에 쓰지 않는다. PowerShell 예:

```powershell
$adminSecureInput = Read-Host '관리자 비밀번호 (12자 이상)' -AsSecureString
$adminCredential = [System.Net.NetworkCredential]::new('', $adminSecureInput)
$adminCredential.Password | node scripts/create-admin-password-hash.cjs
# 표시된 해시만 서버 Secret 설정에 넣는다. 평문을 출력하지 않는다.
$adminCredential = $null
$adminSecureInput = $null
```

5. 서버에 `STUDIO_ADMIN_PASSWORD_HASH`를 설정한다. dotenv 파일이면 전체 해시를 작은따옴표로 감싸 `$`의 확장을 피한다. 호스팅 Secret UI에는 따옴표 없이 실제 해시 값을 넣는다. 저장된 Secret 파일은 Git에 넣지 않는다.
6. `STUDIO_SETTINGS_ENABLED=true`를 명시하고 앱을 build/deploy한다. 이 플래그는 새 모듈의 도입 스위치다. false/미지정이면 v1의 Base 설정만 사용하며 관리자 API는 503으로 차단한다. 활성 저장본이 있는 GAS에서 플래그를 끄면 contract 쓰기가 revision 보호에 의해 차단될 수 있다. 장애 회피용으로 플래그를 끄지 않는다.
7. `/master-control`에 접속해 로그인한다. Base의 빈 대표 이메일은 최초 관리자 조회에서 운영 환경변수로 채운다. 저장 전 모든 항목을 검토하고 전체 문서를 저장한다.

로컬 Demo는 `NODE_ENV=development/test`, `BACKEND_MODE=demo`, 명시적 모듈 활성화와 비밀번호 해시를 사용한다. `.studio-settings-demo/<studioId>.json`에 설정/세션을 보존한다. 이 파일은 Git 제외이며 Production에서는 사용하지 않는다. Demo의 파일 rename/프로세스 큐는 로컬 단일 프로세스용이다. 여러 서버/서버리스 운영 저장소로 사용할 수 없다. 브라우저 테스트는 서버 전용 STUDIO_DEMO_SETTINGS_TEST_DIRECTORY로 격리된 테스트 폴더를 지정하며 기존 Demo 설정을 건드리지 않는다.

## 4. 저장 구조와 우선순위

설정 후보인 별도 Settings Sheet를 검토했다. 로고·직인과 중첩 Config의 JSON까지 포함하므로 셀 크기·여러 행 부분 저장보다 현재 시스템에 이미 있는 Drive JSON 저장 방식을 선택했다.

| 위치 | 저장 내용 |
|---|---|
| ClientConfiguration .ts | 업체별 Bootstrap, compatibility, Demo 값 |
| 전용 설정 Drive 폴더 | 변경마다 새로운 schemaVersion=1 revision JSON, 설정 전체·revision·updatedAt·SHA-256 |
| GAS Script Properties | 업체별 활성 revision의 fileId/hash, 최근 20개 이력 포인터 |
| GAS Script Properties 인증 영역 | 로그인 시도 시각과 최대 5개 세션 HMAC/createdAt/lastSeen |
| 기존 계약 Drive 폴더 | 기존 계약 레코드·Snapshot·PDF만 유지 |

`Base Client Configuration + Persisted Studio Settings`로 런타임 설정을 합성한다. 실제 편집 가능 영역 전체가 저장되므로 일부 필드만 적용되는 중간 상태를 공개하지 않는다. compatibility·Demo·보안 영역은 Base와 서버 환경에서만 가져온다.

저장은 expectedRevision을 확인하고 새 불변 파일을 쓰고 다시 읽어 확인한 뒤, ScriptLock 안에서 **단일 활성 포인터**를 갱신한다. 포인터 publication과 JSON 저장의 하나의 분산 transaction은 아니다. 포인터 전환 전 오류는 기존 설정을 유지한다. 포인터 전환 후 응답이 유실되면 저장 결과는 불확실하므로 재조회한다. orphan 파일이 생길 수 있지만 자동으로 활성화하거나 삭제하지 않는다. 이력 파일은 보존하며 UI는 최근 20개만 표시한다.

설정은 요청마다 no-store로 조회한다. 장기 process cache가 없어 설정 변경 직후 오래된 서버 설정을 사용하는 것을 피한다. 서버 accessor는 AsyncLocalStorage로 요청별로 격리된다. 브라우저는 한 배포/문서의 공개 설정을 적용한 뒤 기존 고객 컴포넌트를 렌더링한다. 이 모듈이 활성화되면 로딩 안내 후 고객 화면을 표시한다.

## 5. 관리 항목과 보호 항목

| 관리 화면 | 편집 범위 |
|---|---|
| 업체정보 | 이름/표시명/대표/전화/이메일/사업자정보/홈페이지/문구/로고/직인/메일 표시명/브랜드 색상 |
| 상품 | 자동 생성 읽기 전용 ID, 이름/짧은 이름/가격/설명/촬영 범위/원본 안내/보정 수/앨범/포함 항목/활성/순서/추가 구성 |
| 옵션 | 자동 생성 읽기 전용 ID, 이름/가격/설명/활성/순서 |
| 할인/혜택 | 기존 조건별 금액·설명·적용 여부·유형·요일·채널별 표시; 후기 유형은 cashback만 허용; 짝꿍은 비공개 코드별 즉시 할인금액·활성 관리 |
| 계약정책 | 계약금/잔금 납기/취소/환불/납품/보관/저작권/포트폴리오/약관/개인정보 안내 |
| 고객 입력폼 | 현 configurable field의 enabled/required/label/placeholder |
| 계약서/안내 문구 | 기존 content의 촬영 범위·상품 소개·후기 안내·유입경로·metadata 등 |

이미 저장된 상품·옵션·할인 ID는 이름 변경과 비활성화를 지원하되 물리적 삭제하지 않는다. 새 상품/옵션은 비활성으로 시작한다. 할인 eligibility kind는 기존 Pricing Engine이 지원하는 조건을 유지한다. 새로운 할인 로직/동적 Form Builder는 제공하지 않는다.

상품명과 짧은 이름, 할인명과 가격 내역 이름/화면별 label은 별개 표시 필드다. 변경 시 필요한 표시 문구를 함께 검토한다. 정책 version은 업무상 이름이며 자동 revision 숫자와 별개다.

사업자정보는 이번 단계에서 저장 가능한 업체 메타데이터다. 기존 PDF 디자인에 별도 사업자정보 표시 영역을 추가하지 않았다. 로컬 Demo의 관리자 설정은 파일에 보존되지만 가상 계약·메일함은 기존처럼 메모리 기반이어서 개발 서버 재시작/Hot Reload 때 초기화될 수 있다.

**보호 항목:** studioId·contractPrefix·Drive 표시명, APP_SECRET·GAS_SHARED_SECRET·GAS URL·backend mode·승인 token·contractId 생성·Snapshot hash·내부 API·workflow state·compatibility·Demo 값. customer 신랑/신부/예식일/예식시간/예식장/수신 이메일/상품/약관 동의는 formSchema의 제거 항목이 아니다. 상세 weddingHall은 enabled를 고정하고 Dear의 기존 필수 상태를 유지한다. 최소 한 연락처 필드는 사용해야 한다.

로고/직인은 실제 PNG/JPEG/WebP의 base64만 받으며 각 업로드 300KB 이하, 서버 형식 검증을 수행한다. SVG 및 외부 이미지 URL은 저장을 거부한다. 음수/소수/상한 초과 금액, 중복 ID, 빈 이름/필수 정보/약관, 잘못된 이메일/HTTPS URL, 전 상품 비활성, 최대 즉시할인 적용 후 계약금 미달, 후기의 즉시할인 전환, 잘못된 폼 조합, 허용하지 않은 key/type/template 변수를 차단한다.

## 6. 기존 계약 보호

- 아직 저장본이 없는 Base revision 0은 v1의 Config binding과 호환한다.
- 저장 후 Config binding은 적용된 업체·상품·옵션·할인·정책·폼·문구와 revision을 포함한다. 신규 Snapshot에는 settingsRevision/settingsHash도 함께 보존한다.
- 고객 화면이 읽은 binding을 제출 헤더로 보낸다. 저장 후 오래된 화면의 제출은 409로 차단해 새 금액/약관 확인을 요구한다. 헤더는 인증 credential이 아니라 오래된 화면 감지용이다. 서버가 금액/규칙을 재계산한다.
- GAS는 submit/prepare/send를 실행하는 Lock 안에서도 현재 settings revision/hash를 비교한다. 서버 조회 이후 변경이 발생한 race를 차단한다.
- 미처리 계약의 기존 configurationHash가 다르면 Review/prepare/send를 차단한다. 되돌린 내용이 같아도 새로운 revision이므로 과거 계약을 자동 재승인하지 않는다.
- 발송된 계약은 당시의 저장 Snapshot/가격/상품/옵션/폼/약관/브랜드를 사용한다. 설정 변경·복구는 이를 다시 쓰지 않는다.
- 기존 contractId 생성법과 canonical payload는 유지했다. 동일 입력 재시도는 기존 접수로 식별된다. 설정 변경 후 동일한 과거 입력을 새 계약으로 강제로 만들거나 기존 미처리 접수를 자동 마이그레이션하는 기능은 없다. 정책 변경 전에 미처리 계약을 처리하는 운영 절차가 필요하다.

대표 수신 이메일은 최초 환경 설정이 계속 필수이고, 저장본 revision이 있으면 저장된 업체 이메일을 **신규 접수**의 대표 수신자로 사용한다. 기존 계약의 수신자는 계약 레코드/Snapshot에 보존된다. email sender name 변경은 Gmail 인증 발신 계정을 변경하지 않는다.

## 7. 저장 실패와 복구

1. 저장 성공은 GAS 저장·포인터 확인·서버 응답 검증·관리자 재조회 이후 표시한다.
2. 타임아웃/응답 유실/저장 실패 시 `다시 불러오기`로 현재 revision과 값을 확인한다. 이전 expectedRevision으로 재저장하지 않는다. 중복 publication/덮어쓰기는 conflict로 차단한다.
3. JSON 손상 또는 hash/validation 오류는 Base로 자동 fallback하지 않고 고객 처리를 차단한다. 인증된 관리자는 정상 이력을 선택해 복구한다.
4. 복구는 선택한 과거 JSON을 서버 validation하고 **새 revision**으로 publication한다. 과거 Snapshot과 이력은 유지한다. rollback은 이전 revision 당시 목록/활성 상태로 돌아가므로 복구 전에 추가된 상품과 미처리 계약을 검토한다.
5. 활성 포인터 자체가 손상되거나 최근 20개 모두 손상/접근 불가한 경우에는 운영자가 비공개 백업과 Drive revision 파일을 대조해야 한다. 관리자 UI가 모든 저장소 장애를 자동 복구하지 않는다.

## 8. 테스트와 출시 점검

```text
npm run test:settings
npm run test:discount-codes
npm run test:settings-browser
npm run typecheck
npm run typecheck:tests
npm run lint
npm test
```

설정 서버 테스트는 실제 Code.gs를 격리 VM에서 실행한다. Google I/O만 대체하고 Production 모드의 인증/쿠키/GAS HMAC/세션/저장/계약을 검증한다. 관리자 브라우저 테스트는 실제 Next dev/Demo의 UI·API·영구 파일 저장을 검증한다. 이는 Production Google 권한·분산 Lock·Gmail 수신 확인의 증거가 아니다.

출시 전 전용 staging에서 실제 GAS 폴더 분리/ACL/Script Properties 용량과 권한, 동시 저장/계약 제출 충돌, 세션 만료/로그아웃/429, 설정 저장 및 복구, 이전 계약/메일/PDF 보존, 새 계약 실제 수신을 확인한다. 고객 URL/로그의 bearer token과 비공개 Drive 자료 접근도 보호한다. 본 작업에서는 원격 Push·GAS 배포·Production 반영을 하지 않는다.

## 9. 후속 작업

- 저장 전 전체 계약서/PDF Preview. 이번에는 client/server validation만 제공한다. 장문 약관/상품 문구는 입력상 유효해도 A4 레이아웃에 맞지 않을 수 있다. 기존 PDF overflow 검사는 발송을 차단하므로 저장 직후 staging Preview 점검이 필요하다.
- 미처리 계약 전환/재검토 도구. 현재는 보호 차단을 유지하며 자동 migration하지 않는다.
- 운영자 비공개 백업, 오류 알림, hosting rate limit, 실제 Google 지연/할당량 점검.
- 이력 보관/오래된 orphan 파일 정리는 운영 정책 확정 후 별도로 진행한다.
- 직원 계정이 필요해지면 공유 비밀번호 대신 별도 인증/권한 모델을 검토한다.

설계 근거: [Node crypto scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [GAS Lock](https://developers.google.com/apps-script/reference/lock/lock), [GAS Properties](https://developers.google.com/apps-script/reference/properties/properties).

## Owner / Master 역할 분리

이 상세 관리자 화면은 이제 /master-control입니다. 기존 /api/studio-control/*는 Master 전용 호환 경로이며 Owner는 /api/owner-control/*로 제한된 운영값만 변경합니다. 기존 hash는 Master로 유지합니다. 새 배포·이전은 [Owner / Master 안내](OWNER_MASTER_ADMINISTRATION.md)를 따르세요.
