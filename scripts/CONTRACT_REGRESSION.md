# 웨딩 부킹 프로그램 — 계약 Flow 회귀테스트

## 목차

1. 실행 방법
2. 검증 범위
3. 테스트 격리와 증거의 한계
4. 정책 변경 시 유지보수

## 1. 실행 방법

저장소 루트에서 실행한다. 의존성이 설치되어 있어야 한다.

```powershell
npm run typecheck
npm run typecheck:tests
npm run build
npm run test:regression
```

`test:regression`은 기존 acceptance → production hardening → 추가 Flow → 브라우저 순서로 실행하며, 실패하면 종료 코드가 0이 아니다. 개별 실행은 `test:acceptance`, `test:hardening`, `test:flow`, `test:browser`를 사용한다.

브라우저 테스트는 기존 production build를 실행하므로 **항상 먼저 build**한다. 임의의 로컬 포트를 사용하고 종료 시 본인이 시작한 서버와 브라우저를 닫는다.

브라우저 테스트 도구는 프로젝트에 설치된 `playwright`, `pdf-lib`, `pngjs`를 우선 사용한다. Codex에서는 기존 bundled Node 패키지 경로를 자동으로 읽는다. 다른 환경에서는 설치된 패키지 디렉터리를 `FLOW_TEST_NODE_MODULES`에 지정한다. 기본 브라우저는 시스템 Chrome이며, Edge 환경에서는 `FLOW_BROWSER_CHANNEL=msedge`로 설정한다. 테스트에서 패키지나 브라우저를 자동 설치하지 않는다.

선택 설정:

```powershell
$env:FLOW_TEST_NODE_MODULES = 'C:/test-runtime/node_modules'
$env:FLOW_BROWSER_CHANNEL = 'chrome'
$env:FLOW_ARTIFACT_DIR = 'C:/test-artifacts/contract-flow'
$env:FLOW_RESULTS_PATH = 'C:/test-artifacts/flow-results.json'
npm run test:regression
```

기본 브라우저 산출물은 Git에서 제외한 `.contract-test-output/`에 저장된다. `FLOW_RESULTS_PATH`의 상위 디렉터리는 먼저 생성한다. 테스트 전용 가상 고객 데이터만 사용한다. 토큰과 임시 secret을 출력하지 않는다.

## 2. 검증 범위

| 영역 | 추가 검증 |
|---|---|
| 가격 | 2상품 × 4옵션 조합 × 토/일 × 짝꿍 × 포트폴리오 × 4캐시백 조합 = 256개. 계약총액·계약금·잔금·향후 캐시백과 Snapshot·문서 HTML·이메일 금액 확인 |
| 캐시백 | 두 후기 혜택을 켜도 계약총액·계약금·잔금이 변하지 않음 |
| 날짜 | UTC, 서울, 로스앤젤레스, 키리티마티의 새 Node 프로세스에서 토/일·DST·연도 전환·잘못된 날짜 확인 |
| ID | 접수 응답 → Review → 확정 Snapshot → PDF 메타데이터/계약번호 → 저장본 → 두 메일 첨부의 일치 |
| 중복 | Submit/Final Send 동시 재시도, 승인 응답 유실, 최종 응답 유실, 발송 버튼 더블 클릭, 부분 실패 재시도 |
| 대표 수정 | 고객 화보형 → 대표 실속형. 실제 React 계약 문서와 최종 이메일에 실속형만 있음 |
| PDF | 실제 html2canvas/jsPDF 실행. PDF의 각 페이지 이미지 RGB 전체를 생성 시 캡처 PNG와 비교. 실제 PDF·저장본·두 첨부 바이트 비교 |
| 토큰 | 누락·서명 변조·암호화 payload 변조·정상 형식 토큰의 만료. 만료 직전 허용, 만료 시각부터 거절 |
| GET | 실제 Review URL 반복 진입/새로고침과 Review API GET 모두 무발송·계약 무변경 |
| 실패 | GAS 통신/잘못된 응답/백엔드 거절, PDF 생성/입력 실패, 고객·대표 메일 실패. API의 success와 실제 화면 완료 상태 확인 |

PDF에 별도 `contractId` 문자열을 새로 넣지 않는다. 현재 계약번호의 전체 ID suffix와 Snapshot hash를 검증하고, 그 ID의 저장 기록과 PDF 첨부가 동일함을 확인한다.

## 3. 테스트 격리와 증거의 한계

- API는 저장소의 실제 route handler 및 GAS adapter를 실행한다. `Code.gs`는 Node VM에서 실제 소스로 실행한다.
- Drive/Gmail/Sheets/Properties/Lock만 메모리 대역으로 바꾼다. 실제 고객·운영 GAS·메일·Drive에는 접근하지 않는다.
- 브라우저는 실제 production build와 React UI, 실제 html2canvas/jsPDF를 사용한다. 비즈니스 API 요청은 실제 handler/VM으로 연결하고 외부 브라우저 요청은 차단한다. 새 테스트에서 Demo adapter를 Production 대신 사용하지 않는다.
- 동시 요청 테스트는 프로세스 내 재시도를 검증한다. 실제 GAS 다중 실행의 LockService 동작과 Gmail의 실제 도착/스팸 처리까지 증명하지 않는다.
- Gmail 실패 대역은 호출 후 예외가 나는 불확정 발송 상황을 재현한다. 추가 자동 발송 시도가 없음을 검증하며 실제 수신 여부를 가정하지 않는다.
- 대표 알림 실패 시에도 백엔드 저장이 확인되면 고객 **접수** 성공은 허용된다. 이는 최종 계약서 발송 성공과 다르다. 저장 실패는 접수 성공이 될 수 없다.
- 실제 픽셀 비교는 테스트한 PDF가 해당 문서 캡처와 일치함을 증명한다. 모든 브라우저·글꼴·입력 길이의 시각적 품질을 보증하지 않는다.

## 4. 정책 변경 시 유지보수

가격 oracle은 설정 함수를 재사용하지 않고 승인된 현재 숫자를 직접 적는다. 업체별 상품/가격을 의도적으로 바꾸면 테스트의 `bases`, `options`, 할인·캐시백·계약금 기대값도 승인된 정책에 맞춰 함께 갱신한다. 실패를 없애기 위해 운영 함수의 계산 결과를 그대로 기대값으로 복사하지 않는다.

가상 데이터에는 실제 고객 개인정보, 운영 URL, 운영 secret을 넣지 않는다. 향후 자동화할 때 위 명령을 CI의 배포 전 검증 단계로 사용한다.
