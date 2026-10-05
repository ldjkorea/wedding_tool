# 웨딩 부킹 프로그램 — GAS 연동

선택형 Google Sheets 계약목록은 기본 OFF이며 관리자 외부 연동에서 생성/연결합니다. 별도 1분 `contractSheetWorker` trigger가 계약 Record의 대기 상태를 읽고 Sheet를 갱신합니다. 계약 요청 중에는 Sheets I/O를 수행하지 않으며 Sheet 오류로 접수·메일 성공을 되돌리지 않습니다. 운영 전 새 Spreadsheet/설치형 trigger 권한을 승인하고 비공개 ACL 및 실제 trigger 실행을 확인해야 합니다. [계약목록 운영·복구 안내](../docs/OPTIONAL_CONTRACT_SHEETS.md)를 참고합니다. 짝꿍 코드 조회는 이 연동과 분리됩니다.

## 목차
1. 전용 프로젝트와 설정
2. 접수·확정·발송 상태
3. 실패 복구
4. 검증과 배포

## 1. 전용 프로젝트와 설정

이 코드는 새 서명 프로토콜을 사용합니다. 이전 GAS 코드와 호환되지 않습니다.

V1 출시 버전은 서명 payload의 studioId와 저장 레코드/Snapshot의 업체 소유자를 함께 검사합니다. 앱과 GAS를 함께 갱신해야 합니다. studioId가 다른 요청은 같은 secret을 사용해도 다른 업체 계약에 접근하지 못합니다. 이러한 검사는 계정·폴더·secret 분리를 대신하는 멀티테넌트 인증 기능이 아닙니다.

- 웨딩 부킹 프로그램용 **별도 GAS 프로젝트**, 별도 비공개 Drive 폴더를 사용합니다.
- 복제본 `.clasp.json`의 과거 scriptId 바인딩은 제거했습니다. 새 전용 프로젝트 연결은 Git에서 제외한 `.clasp.local.json`에 보관하거나 Apps Script 편집기로 적용합니다. 대상 확인 전 CLI push를 실행하지 않습니다.
- `Code.gs`를 전용 프로젝트에 적용하고 Script Properties를 설정합니다.

| Script Property | 값 |
|---|---|
| GAS_SHARED_SECRET | 앱 서버와 동일한 임의의 32자 이상 값 |
| CONTRACTS_FOLDER_ID | 해당 GAS 실행 계정이 쓰기 가능한 전용 비공개 Drive 폴더 ID |
| STUDIO_SETTINGS_FOLDER_ID | 관리자 설정 revision을 저장할 별도 비공개 Drive 폴더 ID |

짝꿍 할인코드는 관리자 설정 revision의 비공개 `partnerCodes`에서 조회합니다. 코드마다 양의 정수 할인금액과 활성 여부를 저장합니다. 전체 목록은 고객 응답에 포함하지 않습니다. 비교 시 앞뒤 공백 제거 → NFC 정규화 → 대문자 변환을 적용하며 내부 공백은 금지합니다. 등록되지 않거나 비활성인 코드는 0원입니다. 짝꿍 혜택 자체가 비활성이면 모든 코드가 적용되지 않습니다. 설정 저장·검증·계약 접수·확정은 같은 revision 보호를 사용합니다. Sheets 조회와 코드 fixture 자동 생성은 없습니다. 기존 코드 목록은 운영자가 직접 등록해야 합니다.

앱 서버에는 `.env.example`의 모든 실 연동 값을 설정합니다. `APP_SECRET`과 `GAS_SHARED_SECRET`은 서로 다른 임의의 값을 사용하고 Client 환경변수에 넣지 않습니다. Production에서는 `BACKEND_MODE=gas`만 허용됩니다. 앱의 새 변수명은 `APP_URL`, `REPRESENTATIVE_EMAIL`이며 Config 수신자 fallback은 없습니다. 앱 secret과 GAS 공유 secret은 서로 다른 값이어야 합니다. 배포 전 `npm run check:env -- production`으로 서버 설정을 확인합니다.

studioConfig.driveFolderName은 논리적 업체 폴더 이름으로 접수/Snapshot에 보존됩니다. 실제 저장 폴더는 CONTRACTS_FOLDER_ID로 지정하며 폴더 생성/이름 변경을 자동 수행하지 않습니다. Gmail 발신 표시명은 Snapshot의 emailSenderName(접수 알림은 접수 당시 studio)을 사용합니다.

GAS Web App이 배포자 권한으로 실행되므로 모든 POST는 timestamp/nonce/HMAC 서명 검증을 통과해야 합니다. 익명 GET은 업무 처리를 수행하지 않습니다. 공유 폴더 ACL·Gmail 실행 계정·할당량은 배포 전에 실제 계정에서 별도로 확인합니다.

## 2. 접수·확정·발송 상태

전용 폴더에 계약 ID별 JSON과 PDF를 저장합니다.

- 동일한 정규화 제출 데이터는 동일한 contractId로 조회합니다.
- 하나의 접수 레코드가 승인 tokenHash, 최초 고객 데이터, 가격, 계약번호, 대표 수신자를 보존합니다.
- 고객 응답은 접수 ID만 반환합니다. 대표 토큰은 대표 알림 메일에만 전달합니다.
- 대표 알림 전에 접수 레코드를 쓰고 다시 읽어 저장을 확인합니다.
- 대표 알림이 실패/불확실해도 접수 데이터와 알림 내용은 저장되어 있습니다. 고객 success는 **영속 접수 확인**을 의미하며 메일 도착을 보장하지 않습니다.
- 승인 시 최종 data·가격·상품·옵션·약관 전문과 버전 및 당시 업체 정보·안내 문구·할인 정의·Form Schema를 Snapshot으로 저장합니다.
- expectedRevision으로 오래된 편집의 덮어쓰기를 막습니다.
- PDF는 Snapshot hash 표식을 확인하고, 파일 저장·해시 재확인 뒤 두 이메일에 동일한 첨부를 사용합니다.
- 고객·대표 모두 Gmail 호출이 성공하고 최종 상태가 저장된 경우에만 발송 success를 반환합니다.

실 연동 계약번호는 업체 Config의 contractPrefix, 날짜와 전체 계약 ID를 사용해 고정합니다. 기존 Demo 번호 생성기의 4자리 형식과 다릅니다. JPG 내보내기 인터페이스는 유지하지만 실제 보관·발송의 기준 문서는 PDF입니다.

## 3. 실패 복구

각 알림/메일은 pending → sending → sent 상태를 저장합니다. Gmail 오류는 unknown으로 기록합니다. sending/unknown을 자동으로 다시 보내지 않습니다.

- PDF 저장 전 실패: 이메일 부작용 없이 같은 계약으로 재시도할 수 있습니다.
- 고객 메일 sent, 대표 메일 pending: 저장된 PDF로 남은 대표 메일만 처리합니다.
- sending/unknown: Gmail 발송함과 해당 계약번호·수신자·첨부를 운영자가 대조해야 합니다. 실제 전송 여부를 확인하지 않고 상태를 pending으로 바꾸거나 새 계약을 만들어 재발송하지 않습니다.
- 양쪽 sent지만 응답 유실: 같은 Review 링크가 저장 상태를 조회하고 재발송을 차단합니다.
- 업체 소유 정보 또는 접수 당시 정책 해시를 확인할 수 없는 미발송 자료: 자동 승인하지 않습니다. 운영자가 원본 업체와 가격·상품·약관을 대조해야 합니다. 원본 레코드의 백업과 승인 근거 없이 새 업체 소유자/해시로 덮어쓰지 않습니다.
- 접수 알림 unknown: 저장 JSON의 notification과 Review 링크로 대표가 업무를 이어갈 수 있습니다. 운영자는 접수 레코드의 미처리 알림 상태를 확인해야 합니다.

Gmail과 Drive는 하나의 트랜잭션이 아닙니다. 메일 수신함 도착·반송까지 보장하는 exactly-once 전송이라고 주장하지 않습니다. 이번 수정은 상태를 보존하고 불확실한 전송의 자동 중복을 차단합니다.

복구 시 계약번호·revision·Snapshot hash·PDF 파일과 Gmail 발송 기록을 함께 대조합니다. unknown이 실제로 미발송인지 확인하기 전 상태를 초기화하지 않습니다. 발송함과 고객 수신 확인이 모순되면 자동 재시도를 중단하고 운영자가 해결합니다. 저장 JSON에는 개인정보 및 승인 URL이 있으므로 폴더 공개 공유와 로그 복사를 금지하고 최소 권한·보관 기간·비공개 백업 정책을 적용합니다.

## 4. 검증과 배포

`npm run test:hardening`과 `npm run test:discount-codes`는 실제 Code.gs를 Node VM에서 실행하되 Gmail/Drive를 가짜 구현으로 대체합니다. Sheets 호출은 테스트에서 금지합니다. 실제 GAS 권한·메일 도착·Drive ACL을 검증한 결과는 아닙니다.

배포 전 전용 staging에서 전체 흐름과 실패 복구, 실제 PDF의 한글·긴 요청/약관·페이지 구성을 확인합니다. 이번 수정 작업에서는 원본 시스템이나 실제 GAS를 배포/호출하지 않았습니다.
# 업체 관리자 설정 저장

업체 관리자 기능을 활성화할 때 추가 Script Property `STUDIO_SETTINGS_FOLDER_ID`를 설정한다. 반드시 기존 CONTRACTS_FOLDER_ID와 다른 비공개 폴더를 사용한다. 앱과 수정된 Code.gs를 함께 전용 staging에 배포한 뒤 관리자 설정 모듈을 활성화한다.

새로운 `admin_*`, `settings_*` action도 기존 HMAC/timestamp/nonce 인증과 ScriptLock 안에서만 실행한다. 관리자는 별도 세션 검증을 거치며 설정 runtime 읽기는 앱 서버의 서명 요청만 허용한다. doGet과 익명 설정 write는 지원하지 않는다.

불변 revision JSON을 쓰고 읽어 확인한 뒤 하나의 Script Property 포인터를 전환한다. 최근 20개 이력 포인터를 UI에 제공하고 파일 자체는 보존한다. 실패/응답 유실 시 저장 상태를 재조회하며 동일 expectedRevision으로 덮어쓰지 않는다. 폴더 권한, LockService 실제 동시 동작, PropertiesService 크기/할당량, Drive 실패/포인터 복구는 실제 GAS staging 점검 대상이다.

상세 운영 지침은 ../docs/STUDIO_ADMINISTRATION.md를 따른다. Production 배포와 Google 실서비스 시험은 이번 코드 변경에 포함되지 않는다.

## Owner / Master 역할

업그레이드한 앱과 함께 이 GAS 버전을 staging에서 확인하세요. 영속 관리자 세션에 역할을 저장하고 owner_read/owner_save는 Owner, settings_read/settings_save/settings_restore는 Master로 제한합니다. Sheets 운영은 두 역할이 사용할 수 있으며 ID 직접 변경은 허용하지 않습니다. 기존 revision은 그대로 유지하고 새 revision에는 변경 역할을 기록합니다. [안전한 인증 이전 절차](../docs/OWNER_MASTER_ADMINISTRATION.md)를 따르세요.
