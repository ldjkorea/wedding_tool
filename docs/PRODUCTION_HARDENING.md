# P0/P1 수정 기록

## 목차
1. 작업 범위
2. 감사 이슈 대응
3. 변경 파일
4. 검증
5. 운영 적용 조건

## 1. 작업 범위

2026-10-04 전체 감사 보고서의 P0/P1을 기준으로 수정했습니다. 원본 운영 저장소/시스템에 쓰기를 수행하지 않았습니다. 이 별도 작업공간에서 수정과 로컬 검증, 커밋만 수행합니다.

추가 사용자 지시에 따라 상품·옵션·할인·약관은 설정 파일에서 직접 편집하도록 유지하고, 표시 수량·금액을 공통 값에 연결했습니다. 새 관리 UI·상품 기능·외부 라이브러리는 추가하지 않았습니다.

## 2. 감사 이슈 대응

| 감사 ID | 코드 대응 |
|---|---|
| P0-01 | Next 토큰 검증 + GAS HMAC/nonce/timestamp + 저장 토큰 hash·만료 검증 |
| P0-02 | 고객 접수 응답에서 approvalToken/Review URL 제거; 대표 알림만 전달 |
| P0-03 | Production 기본 secret 제거; 누락/예시/짧은 secret은 명확한 요청 실패 |
| P1-01 | 명시적 BACKEND_MODE, 환경 GAS URL만 사용, Production Mock 금지 |
| P1-02 | after 제거; 영속 접수 확인을 기다려 success 반환 |
| P1-03 | Adapter에서 canonical 데이터의 계약 ID·토큰 생성; Route 재생성 제거; 중복은 저장 레코드 사용 |
| P1-04 | ScriptLock + 영속 단계 상태 + 불확실한 메일 자동 재전송 차단 |
| P1-05 | 서버 허용 필드·필수값·날짜·이메일·옵션·동의·금액·크기 검증 |
| P1-06 | 실제 제출/대표 확정에서 짝꿍 목록 조회·할인 정책 금액 검증 |
| P1-07 | TS/GAS 실패 fallback·샘플 자동 생성 제거 |
| P1-08 | 전체 Snapshot 영속 저장·재조회·expectedRevision 충돌 처리 |
| P1-09 | 계약번호 접수 때 고정·이후 재사용·PDF에 표시 |
| P1-10 | PDF 생성/검증 실패 시 발송 중단 |
| P1-11 | 대표 완료 이메일 구현; 두 호출/상태 확인 후 최종 success |
| P1-12 | PDF 저장·해시 확인을 메일보다 먼저 수행; 실패 시 success 없음 |
| P1-13 | 서버 Snapshot을 렌더·메일·저장에 사용; 입력 잠금·PDF 표식/해시 검증 |
| P1-14 | 25초 transport timeout·응답 schema·저장 상태로 응답 유실 대응 |
| P1-15 | canonical 데이터 HMAC ID와 GAS의 기존 접수 확인으로 중복 제출 차단 |
| P1-16 | 모든 입력 문자열/특약 HTML escape; 내부 가족/SNS 데이터는 고객 문서 제외 |
| P1-17 | Production Demo API 404 및 Mock 직접 사용 차단 |
| P1-18 | 두 build 오류 무시 옵션 제거; TypeScript 오류 수정 |
| P1-19 | 편집 가능한 상품 설정과 안내/계약서 수량 연결; 초기값은 기존 표시 기준 |
| P1-20 | 계약 요청·특약 PDF 별첨/메일 보존; 내부 메모는 Snapshot/대표 메일 보존 |
| P1-21 | 서버 도메인·대표 주소·GAS 설정 검증; 대표 수신자 실제 payload 반영 |

하나의 **저장된 승인 토큰 hash와 canonical 접수**가 계약의 권한/데이터 기준입니다. 동시 제출에서 먼저 저장된 접수만 대표에게 통지하며 나머지는 그 접수를 사용합니다. Gmail 호출의 성공은 수신함 도착 보장이 아닙니다.

## 3. 변경 파일

- 서버 설정·검증: .env.example, src/lib/serverConfig.ts, apiSafety.ts, contractValidation.ts, token.ts
- 계약 확정/가격: src/lib/contractWorkflow.ts, pricing.ts, src/types/{backend,contract,config}.ts
- Backend: src/services/{backendAdapter,googleAppsScriptAdapter,mockBackendAdapter}.ts, google-apps-script/Code.gs
- API: submit-contract, approve-and-send, review-contract, demo/mailbox
- Review/PDF/메일: review/page.tsx, RepresentativeReviewView.tsx, ContractDocument.tsx, pdfGenerator.ts, emailTemplates.ts
- 설정 표시 연결: products.ts, discounts.ts, ProductCatalogView.tsx, FinalConfirmStep.tsx, DiscountBenefitSection.tsx, CalendarModal.tsx
- Build/검증: next.config.ts, package.json, 기존 acceptance 스크립트의 Demo 지정, 신규 hardening 테스트
- 문서: README.md, GAS README, 이 문서, COMPANY_SETTINGS.md

## 4. 검증

실행 명령:
- npm run typecheck
- npm run build
- npm run test:acceptance
- npm run test:hardening

기존 acceptance의 15개 assertion은 유지하고 실행 환경만 명시적 Demo로 지정했습니다. 신규 hardening suite는 실제 API/Adapter/Code.gs와 jsPDF 인코딩을 사용하되 외부 서비스를 가짜 구현으로 대체합니다.

정상 build의 타입 검사는 활성화했습니다. 별도 ESLint 규칙/config/dependency는 원래 저장소에 없으며 이번에 새로 도입하지 않았습니다.

최종 종료코드·테스트 개수·커밋 SHA는 저장소 바깥 outputs의 P0/P1 수정 결과 보고서에 기록합니다. 브라우저의 실제 한글 PDF 시각 결과, Google 계정 권한·메일 도착·Drive ACL은 이 테스트로 증명하지 않습니다.

## 5. 운영 적용 조건

새 앱과 새 GAS 코드를 전용 staging에서 함께 적용해야 합니다. 이전 GAS와의 프로토콜 호환은 제공하지 않으며 잘못 연결하면 실패합니다.

P8 기준 Production 필수 환경값: NODE_ENV=production, BACKEND_MODE=gas, APP_SECRET, GAS_SHARED_SECRET, GAS_WEBAPP_URL, APP_URL, REPRESENTATIVE_EMAIL. NEXT_PUBLIC_APP_URL 및 STUDIO_REP_EMAIL/DEAR_MEMORY_REP_EMAIL은 이전 배포 호환 별칭이며, 상충하면 오류입니다. Config 대표 수신자 fallback은 제거했습니다. APP_SECRET과 GAS_SHARED_SECRET은 서로 다른 값이어야 합니다. 전체 적용 절차와 check:env는 README.md를 참고합니다.
GAS 필수 Script Properties: GAS_SHARED_SECRET, CONTRACTS_FOLDER_ID. 관리자 설정·짝꿍 할인코드 사용 시 별도 STUDIO_SETTINGS_FOLDER_ID가 필요합니다. 코드 조회는 관리자 설정 revision을 사용하며 Sheets 의존성은 제거되었습니다.

배포 runtime은 Route의 maxDuration=90과 각 GAS 요청 25초를 지원해야 합니다. 운영 폴더/계정은 전용 비공개 자원으로 구성합니다. P8에서 과거 .clasp scriptId를 제거했습니다. 전용 프로젝트를 별도 로컬 메타데이터로 연결하고 대상을 확인한 뒤에만 배포 도구를 사용합니다.

P2/P3 전체 해결, 전체 브랜드 업체화, 실제 외부 시스템 배포와 검증은 이 작업의 완료 주장에 포함하지 않습니다.
