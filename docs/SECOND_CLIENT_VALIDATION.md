# P9 — MOMENT STUDIO 두 번째 Client 검증

> 이 문서는 P9 시점의 실패 기록을 보존합니다. 해당 실패의 수정과 최신 재검증은 [P10 최종 Red Team](RELEASE_RED_TEAM.md)을 확인하십시오.

## 결론

**엄격한 범용화 판정: 실패.** Config 교체로 MOMENT STUDIO 화면·가격·Review·Snapshot·실제 PDF·양쪽 이메일이 적용되는 정상 경로는 확인했습니다. 그러나 모든 옵션/혜택 조합의 PDF 발송, 이전 업체 종속성 제거 기준은 충족하지 못했습니다. 전용 테스트는 **12개 중 9개 통과, 3개 실패**, 실패를 숨기지 않고 종료 코드 1을 반환합니다.

## 목차

1. 변경 범위와 가상 업체 설정
2. 실행 방법
3. 확인한 결과
4. 실패와 재현
5. 전체 문자열 검색
6. 검증 한계와 다음 수정 범위

## 1. 변경 범위와 가상 업체 설정

추가한 Client는 `src/config/clients/moment-studio/`이며 `src/config/client.ts`가 이를 선택합니다. Core Component·가격 엔진·API·PDF 엔진·GAS 코드는 변경하지 않았습니다. 새 라이브러리를 추가하지 않았습니다. 기존 Dear Memory Client와 원본 보존 체크아웃은 유지했습니다.

| 항목 | MOMENT STUDIO 가상 설정 |
|---|---|
| 업체/대표/Prefix | MOMENT STUDIO / 윤하늘 / MS |
| Logo/직인 | Client 내부 PNG placeholder / MS DEMO |
| 상품 | 모먼트 에센셜 980,000원 / 모먼트 시그니처 1,680,000원 |
| 옵션 | 모먼트 보조 작가 180,000원 / 모먼트 애프터파티 90,000원 |
| 즉시 할인 | 토요일 80,000원 / 커플 소개 35,000원 / 공개 동의 60,000원 |
| 후기 Cashback | 예약 후기 30,000원 / 촬영 후기 70,000원 |
| 계약금/잔금 | 250,000원 / 예식 14일 전 |
| 환불/보관 | 가상 약관 96시간 / 6개월 |
| 필드 | 신랑 연락처·세부 홀 선택, 촬영 요청·유입경로 필수, 신부 연락처·메이크업·가족·Instagram 숨김 |

상품·옵션 ID도 기존 Client와 다릅니다. 토요일 프로모션은 실제 요일로 계산하며 일요일에는 적용되지 않습니다. Cashback은 contractTotal/balance를 줄이지 않습니다. 모든 이름·고객·연락처·약관은 가상 데이터이며 실제 업체 정책으로 승인한 값이 아닙니다.

## 2. 실행 방법

현재 선택된 Client를 빌드한 뒤 테스트합니다. Chrome과 기존 테스트 지원 런타임이 필요합니다.

```powershell
npm run typecheck
npm run typecheck:tests
npm run build
npm run test:white-label
```

결과는 `.contract-test-output/moment-studio/`에 저장됩니다. `WHITE_LABEL_ARTIFACT_DIR`로 다른 경로를 지정할 수 있습니다. API 및 실제 `Code.gs`를 실행하되 Google I/O는 메모리 harness로 격리합니다. 외부 네트워크 요청은 브라우저에서 차단합니다. Demo 확인은 명시적인 `BACKEND_MODE=demo`, `NODE_ENV=test`로만 수행합니다.

첫 Client 검사는 selector를 Dear Memory로 바꾼 뒤 다시 빌드해 실행해야 합니다. 첫 Client 전용 테스트 fixture를 MOMENT 정책의 기대값으로 해석하면 안 됩니다.

## 3. 확인한 결과

| 검사 | 결과 |
|---|---|
| 앱/테스트 TypeScript, MOMENT production build | 통과 |
| 기존 Dear Memory acceptance / hardening / Flow / browser | 15 / 30 / 15 / 10 모두 통과 |
| MOMENT 전용 검사 | 9/12 통과, 3 실패 |
| 두 상품 × 옵션 4조합 × 토/일 × 소개 × 공개 동의 × 후기 2개 | 256조합 모두 통과 |
| Home/Header/Catalog SSR + 실제 Form/Terms 브라우저 | 업체명·색상·가격·문구·필드 적용 확인 |
| 제출 재시도, Review GET | 동일 ID/token 유지, GET 메일 전송 없음 |
| 옵션 없는 대표 상품 수정 → PDF → 양쪽 이메일 | 정상 경로 통과 |
| 실제 PDF 3쪽 | 모든 페이지 육안 확인, PDF 래스터 픽셀과 캡처 일치 |
| 저장 PDF·고객 첨부·대표 첨부 | 바이트 동일, 고객 1회/대표 1회 |
| 최종 발송 재시도 | 추가 고객 메일 없음 |

성공한 수정 계약은 시그니처 → 에센셜, 옵션/즉시 할인 없음, 최종 980,000원·계약금 250,000원·잔금 730,000원·추후 Cashback 100,000원입니다. Review/Snapshot/PDF/메일에 하나의 MS 계약번호와 ID를 사용하며 최종 자료에는 시그니처가 남지 않습니다.

Home은 실제 Header/Home Component SSR을 실제 빌드 CSS와 함께 브라우저에서 확인했습니다. 기존 앱 첫 진입은 Terms 단계이므로 Home 진입 내비게이션을 구현하거나 변경한 결과는 아닙니다.

기존 hardening 테스트 4곳은 P6/P8 이후의 Mock 생성자 차단·불변 catalog·중앙 accessor·호환 copy 동작에 맞게 테스트만 보정했습니다. MOMENT 날짜 버튼의 할인 배지와 기존 접수 완료 문구도 실제 UI에 맞춰 선택자를 보정했습니다.

## 4. 실패와 재현

### F1. PDF 본문 페이지 초과 — 발송 불가

- 관련 Core: `src/components/pdf/ContractDocument.tsx`, `src/lib/pdfGenerator.ts`.
- 재현: 토요일 시그니처, 두 옵션, 소개/공개 동의, 두 후기 혜택으로 접수 → 대표가 에센셜로 수정 → 최종 발송.
- 가격 계산은 1,075,000원 / 계약금 250,000원 / 잔금 825,000원 / Cashback 100,000원으로 맞습니다.
- A4 본문: clientHeight 1,121px, scrollHeight 1,176px, **55px 초과**. 약관/특약 페이지는 초과하지 않았습니다. 촬영 요청은 15자여서 긴 사용자 요청이 원인은 아닙니다.
- `prepare` 후 상태는 approved였지만 `send`가 발생하지 않았습니다. 최종 첨부 메일 0개, 고객에게 최종 발송 완료 표시 0개입니다. 발송 차단은 작동하나 정상적인 옵션 계약을 완료하지 못합니다.
- 회귀 테스트는 이 조합의 PDF/메일 성공을 요구하므로 실패합니다. 옵션 없는 추가 성공 검사는 이 실패를 대체하지 않습니다.
- 후속 수정: 금액/옵션 행 증가에 따른 본문 분할 또는 레이아웃 처리. 실패 차단과 동일 Snapshot 바인딩을 유지해야 합니다.

### F2. Production Core에 이전 Client 참조 5개

| 파일/행 | 남은 종속성 |
|---|---|
| `src/assets/images.ts:2` | DEAR_MEMORY_LOGO_BASE64 / HANMINGYU_SEAL_BASE64 export |
| `src/lib/serverConfig.ts:102,113` | DEAR_MEMORY_REP_EMAIL 호환 별칭 |
| `src/services/configuration.ts:3,5` | Dear Memory legacy form/snapshot metadata import |

후속 수정은 기존 계약 보존 요구와 함께 검토해야 합니다. 과거 계약을 MOMENT 브랜드로 잘못 바꾸거나 기존 환경 설정을 무조건 삭제하면 안 됩니다.

### F3. MOMENT browser bundle에 이전 업체 문자열

`.next/static/chunks/991-a35a4797f3154ee7.js`에서 DEAR MEMORY·디어메모리·한민규·dearmemory.co.kr·DM Prefix를 확인했습니다. 이는 선택된 MOMENT 정상 화면에서 노출되지는 않았지만 브라우저 전달 코드의 무종속 기준을 위반합니다. 중앙 accessor의 기존 Snapshot 호환 데이터 연결과 관계가 있습니다. 선택된 Client의 정상 경로 통과만으로 문자열 제거 성공을 주장하지 않습니다.

## 5. 전체 문자열 검색

`src`/GAS 전체 runtime source, repository text 및 파일명, 실제 `.next/static` JS를 각각 검색했습니다. 테스트 fixture와 첫 Client Config는 별도 분류했으며 전체 검색에서 생략하지 않았습니다. Core 무종속 검사의 Config 폴더 제외는 P6에서 첫 Client 유지가 요구된 구조적 구분입니다.

- Production Core brand 참조: 위 3개 파일 5개 위치.
- 상품명 실속형/화보형: Core 3개 Component의 주석 8개 위치. 현재 화면의 고정 상품 출력은 아니지만 정리 대상입니다.
- `scripts/generate-assets.js`는 이전 업체 이미지 경로/상수명을 고정한 asset 생성 도구입니다. 이 작업에서 실행하지 않았습니다.
- `public/images/dear-memory-logo.png`, `public/images/hanmingyu-seal.png`도 유지되어 있습니다. MOMENT 정상 출력은 새 Client의 placeholder를 사용하지만 public 폴더의 기존 파일은 배포 시 제공 가능한 경로로 남습니다.
- 첫 Client Config, 과거 보고서, 호환 설정 안내 및 테스트에는 이전 업체 문자열이 있습니다. 고객사 Config와 Core 종속성을 동일한 것으로 판정하지 않았습니다.

## 6. 검증 한계와 다음 수정 범위

실제 Google 배포/Gmail 전달/Drive/Sheets 기록은 실행하지 않았습니다. 테스트 이메일은 실제 Core 템플릿·GAS 이메일 호출 결과를 메모리에서 검증한 자료입니다. 가격 256조합의 통과는 256종 PDF 발송 성공을 의미하지 않습니다.

P9에서는 사용자 지시대로 Core 수정 없이 실패 증거를 남겼습니다. 다음 수정 순서는 PDF 본문 초과 처리 → legacy metadata/공용 asset 분리 → 호환 env 이름의 업체 독립화입니다. 이후 이 테스트의 실패 3개를 모두 해소한 뒤 완전한 범용화로 판정해야 합니다.
