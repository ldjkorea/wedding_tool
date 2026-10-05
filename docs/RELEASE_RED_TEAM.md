# P10 — Wedding Contract Core V1 최종 Red Team / 출시 판정

## 결론

**코드 출시 기준은 통과, 실제 운영 및 판매 판정은 조건부 가능.** 발견한 P1 결함을 수정하고 두 Client의 전체 검증을 반복한다. 최종 근거는 `P10_RELEASE_EVIDENCE.json` 및 단계별 로그에 기록했다. 최종 전체 실행은 133/133 테스트 그룹 통과, 이 검증 범위에서 미해결 P0/P1은 0건이다. 생성된 계약서 4건의 총 14페이지를 육안 확인했고 인쇄 여백 검사도 통과했다. 실제 Google 서비스·실제 고객·운영 배포는 사용하지 않았다. 물리적 Android/iOS/Kakao 검증과 업체별 staging 운영 점검은 출시 조건으로 남는다.

원본 판매 버전은 보존 체크아웃의 SHA `de595446c10f71f851bd6c0d30cb6905e1ef366d`를 유지한다. 복제본 P10 시작 SHA는 `16403552531c56101e166b053902da4ab5951560`이다. 현재 선택된 Client는 가상 MOMENT STUDIO이며 Dear Memory 운영 전에 선택 및 build를 다시 해야 한다.

## 목차

1. 검토 범위와 방법
2. P0/P1 발견 및 수정
3. 자동 검증 결과와 증거
4. 시나리오별 결과
5. 개인정보·환경·공개 코드 점검
6. 잔여 P2와 운영 조건
7. 출시 질문에 대한 판정
8. 수정 파일 및 재현 명령

## 1. 검토 범위와 방법

| 관점 | 검토 내용 |
|---|---|
| Security Engineer | 승인 token 서명/암호문/만료/업체 scope, GAS HMAC·nonce, CSRF, XSS, env 오류, 로그/URL |
| SaaS Architect | Client 격리, ID·prefix·Snapshot, Config 변경, Client 선택 build, legacy 의존성 |
| QA | 가격 512조합, 4개 timezone, 재시도·double click·refresh, 실제 browser·PDF·첨부 비교 |
| 업체 대표 | 대표 수정, 수동 금액 조정, 이전 탭/revision, 약관, 일부 발송과 복구 |
| 고객 | 잘못된 입력, 접수·발송 실패 화면, 동일 계약 중복 전송 방지, 모바일 viewport |
| 개인정보 보호 | token 최소화, 내부 필드 제외, 저장소·referrer·source map, Drive/메일 권한 |
| 장애 대응 | 25초 backend timeout의 취소 경로, 500/JSON/통신 단절, 잠금·파일·메일 실패 |

실제 API handler와 실제 `Code.gs`를 Node VM에서 실행한다. Google I/O는 메모리 fixture로 대체하며 Chrome은 Production build를 실행한다. PDF는 실제 html2canvas/jsPDF 산출물의 모든 페이지 RGB 픽셀과 캡처를 비교하고, 저장 PDF와 고객/대표 첨부 바이트를 비교한다. API 단위 테스트의 최소 PDF fixture는 시각적 계약서 증거로 사용하지 않는다.

GAS timeout 테스트는 실제 AbortSignal 취소 경로를 사용하되 25초를 20ms로 단축한다. 실제 Google endpoint의 25초 장애 시험으로 주장하지 않는다. Kakao 테스트는 Chrome viewport/UA 시뮬레이션이며 실제 WebView 엔진 시험이 아니다. 레거시 acceptance의 Drive 비활성 표기는 Demo adapter 범위다. Production 저장/발송의 근거는 hardening·red team·browser 테스트다.

## 2. P0/P1 발견 및 수정

P0: 이번 검증에서 재현한 신규 P0 없음. 기존 Production secret/GAS/mock 방어는 다시 검증했다. 아래 P1은 수정 후 회귀 테스트로 확인한다.

| ID / 등급 | 파일·경로 | 발생 조건 / 실제 위험 | 수정 / 회귀 검증 |
|---|---|---|---|
| RT-01 P1 | `ContractDocument.tsx`, `pdfGenerator.ts` | P9 전체 옵션·할인·Cashback에서 첫 페이지 1176px > 1121px. 정상 승인 계약도 PDF 실패로 고객 전달 불가 | 본문 표·간격을 제한적으로 정돈하고 기존 overflow 차단 유지. 육안 검토에서 수동 조정 시 Footer 인쇄 여백 침범도 발견하여 하단 printable bounds 검사와 회귀 검증을 추가. 실제 전체 옵션 PDF 3페이지 생성, 양쪽 첨부 동일 |
| RT-02 P1 | `services/configuration.ts`, `assets/images.ts`, public images | MOMENT build에 Dear legacy import/브랜드 chunk가 남고 원본 로고·직인이 공개 정적 파일로 제공 | legacy 자료·별칭·원본 PNG/생성기를 첫 Client 내부로 보존 이동. 공유 accessor는 선택 Client의 명시적 호환 설정만 사용. Core source 및 MOMENT bundle 잔존 0 |
| RT-03 P1 | `lib/token.ts`, `googleAppsScriptAdapter.ts`, `Code.gs` | 업체 식별이 없는 token/요청/ID와 잘못 연결한 backend에서 소유자 확인 부족 | 신규 token에 studioId, 신규 업체 ID namespace, signed payload/레코드/Snapshot scope 검사. 외부 업체·wrong prefix·missing owner 공격 차단. Dear 기존 ID는 명시적 opt-in |
| RT-04 P1 | `googleAppsScriptAdapter.ts`, `contractWorkflow.ts` | 접수 후 가격/약관/브랜드 Config 변경 또는 기존 정책 해시 누락. 현재 정책으로 다시 계산·승인될 위험 | 접수 Config SHA-256을 저장하고 미발송 계약은 현재 정책과 정확히 일치해야 조회/승인. 누락도 차단. 이미 발송한 Snapshot은 보존. 정책 변경/누락 공격 추가 |
| RT-05 P1 | `contactValidation.ts`, `contractValidation.ts`, `formFields.ts` | `--------` 등 길이만 충족하는 잘못된 전화번호가 유효 | 실제 숫자 8~15개 및 허용 문자 검사 공유. API·폼의 invalid phone 재현, 국가번호 형식 정상 통과 |
| RT-06 P1 | `package.json`, lockfile, `eslint.config.mjs` | lint 명령이 실제 구성 없이 동작하지 않아 출시 검증 불가. 오래된 runtime dependency advisory | ESLint를 실제 구성, 경고도 실패. Next 15.5.27/jsPDF 4.2.1/PostCSS 8.5.28 고정. 타입·lint·실제 PDF·양쪽 build 검증. Production audit 0 |

jsPDF의 Node 경로 읽기 critical advisory가 브라우저 전용 호출에서 실제 악용되었다고 판정하지 않는다. 취약 패키지는 갱신했지만 npm severity와 앱의 실제 공격 경로를 구분한다. 변경 근거: [jsPDF 4.2.1 공식 release](https://github.com/parallax/jsPDF/releases/tag/v4.2.1), [Node 경로 읽기 advisory](https://github.com/advisories/GHSA-f8cm-6447-x5h2), [Next 15 lint 문서](https://nextjs.org/docs/15/app/api-reference/config/eslint).

신규 승인 token에는 고객 data를 넣지 않는다. HMAC 서명과 암호화를 유지하고 base64url canonical encoding도 검증한다. 기존 Dear token은 선택 Client의 명시적 호환 설정과 backend 소유자/정책 검증을 통과해야 한다. 테스트 변조가 원본 첫 글자와 같아지는 무작위 오류는 테스트 자체를 수정했으며 보안 결함으로 부풀리지 않았다.

## 3. 자동 검증 결과와 증거

최종 실행 명령: `npm test` (`scripts/run-release-tests.ts`). 각 Client에서 `typecheck`, `typecheck:tests`, `lint`, Production `build`를 실행하고 원래 Client selector를 복원한다. 테스트 JSON의 성공 수·실패 수·생성 시간을 확인하여 과거 결과나 종료 코드만으로 성공을 인정하지 않는다. 업체를 바꾸는 동안 공유 Core SHA-256 동일성을 확인한다.

| 대상 | 검증 | 최종 통과 수 |
|---|---|---:|
| Dear Memory | 기존 acceptance | 15/15 |
| Dear Memory | Production hardening | 30/30 |
| Dear Memory | 계약 flow 회귀 | 15/15 |
| Dear Memory | 공격 시나리오 | 23/23 |
| Dear Memory | 실제 Chrome/PDF/모바일 UA | 12/12 |
| MOMENT STUDIO | 공격 시나리오 | 23/23 |
| MOMENT STUDIO | Config/가격/Chrome/PDF/모바일 UA | 15/15 |
| 합계 | 테스트 그룹. 가격 조합은 각 그룹 안에 포함 | 133/133 |

가격 조합은 Dear 256 + MOMENT 256 = 512개. 날짜는 UTC/Asia-Seoul/America-Los_Angeles/Pacific-Kiritimati의 새 프로세스 4개에서 Saturday/Sunday와 잘못된 날짜를 검증한다.

대표 수정 후 MOMENT 총액:

| 사례 | contractTotal | deposit | balance | futureCashback | PDF |
|---|---:|---:|---:|---:|---:|
| 기본 상품 변경 / 옵션 없음 | 980,000 | 250,000 | 730,000 | 100,000 | 3페이지 |
| 모든 옵션·즉시 할인 / 상품 변경 | 1,075,000 | 250,000 | 825,000 | 100,000 | 3페이지 |
| 위 사례 + 수동 -50,000 / 요청 100줄 | 1,025,000 | 250,000 | 775,000 | 100,000 | 5페이지 |

Cashback은 위 어느 경우에도 contractTotal을 줄이지 않는다. 실 PDF·Snapshot·고객/대표 Email 첨부는 동일 contractId/number/hash를 사용한다. 잘못된 성공 화면, 예외 은폐, 실제 고객 메일 발송은 테스트하지 않은 상태로 성공 처리하지 않는다.

## 4. 시나리오별 결과

| 시나리오 | 검증한 결과 | 근거 / 한계 |
|---|---|---|
| Double Submit / refresh | 하나의 영속 접수·tokenHash·알림, refresh 후 동일 재제출도 기존 ID | API 동시 요청 + 실제 폼 double click. 독립된 실제 GAS 병렬 실행은 staging 필요 |
| Invalid email/phone/date | 접수/메일 부작용 없이 오류. 폼도 다음 단계 차단 | 서버·브라우저 검증 |
| Mobile/Kakao | 390×844/360×800 폼, 가로 overflow 없음, 재시도·storage 정상 | Chrome viewport/UA, 실제 기기 미검증 |
| 가격·대표 수정 | 전체 조합 정확, 변경 상품만 최종 PDF/Email에 존재. 수동 ±금액 검증 | 512 조합, 실제 -50,000 PDF, server ±50,000/70,000 |
| Config 변경 | 기존 미발송 hash 불일치/누락 차단, immutable Config, sent Snapshot 불변 | 서버 재현 + legacy fixture |
| Token / scanner | tamper/expiry/missing/foreign scope 차단. GET은 상태/메일 변경 없음 | 실제 API와 브라우저 |
| Replay / duplicate POST | 최종 상태 조회 및 중복 발송 차단 | adapter 재생성/응답 유실/이중 click. 실제 Gmail exactly-once 보장은 아님 |
| Backend 장애 | network/500/JSON 불량/object 불량/reject/timeout에서 접수·검토·승인·발송 success 없음 | signed actual Code.gs + injected transport |
| PDF 실패 | encoding/누락/잘못된 binding/overflow에서 Send·Email 없음 | 실제 브라우저와 backend |
| 고객 실패/대표 성공 | 일부 성공은 전체 success 아님, 대표 copy 재전송 없음 | 실제 Code.gs `sendOnce` fixture |
| 고객 성공/대표 실패 | 고객 재전송 없음, pending 대표만 회복 가능, unknown은 자동 재시도 금지 | backend + 실제 화면 |
| 업체 A → B | token/record/snapshot owner·prefix 차단, wrong logo/product foreign Snapshot 렌더링 거부 | Core 및 MOMENT build Dear 잔존 0 |

## 5. 개인정보·환경·공개 코드 점검

- 신규 URL token은 개인정보 없는 짧은 암호화 capability이며 고객 API는 승인 capability를 반환하지 않는다. 기존 승인 URL도 접근 권한이므로 메일함·방문 기록·호스팅 access log에 남을 수 있다.
- 앱 전체 no-referrer/nosniff/frame DENY, Review noindex/nofollow 및 API no-store. 외부 asset 요청에 Review referrer가 없는지 브라우저 테스트에서 검사한다.
- 실제 폼의 localStorage/sessionStorage 및 cookies는 비어 있다. refresh 후 고객 정보는 자동 복원되지 않는다. analytics SDK/계약 데이터 이벤트 호출은 현재 source에서 발견하지 않았다.
- 서버 error는 설정명/제한된 오류만 반환한다. 원문 개인정보·token·provider 진단을 로그/응답에 출력하는 운영 경로를 발견하지 않았다. PDF font warning 및 Demo 조회 warning은 browser console 경로다. 호스팅 로그 설정은 별도 확인해야 한다.
- browser source map 생성은 비활성화한다. `.next/static`의 map 파일 및 이전 업체 브랜드 문자열은 최종 선택 build에서 검색한다. 공유 Core의 실 secret·GAS URL fallback은 없다.
- Git은 `.env.example`만 추적한다. 실제 .env, clasp 자격 증명, build/test artifacts는 제외한다. Client Config의 이름·대표 공개 연락처·로고·정책은 공개 정보이며 secret 저장소가 아니다.
- 현재 별도 저장소에는 remote가 없다. 새 public repository로 push하거나 외부 GitHub secret scanner를 실행한 결과가 아니다. 원본에서 복제한 과거 commit의 endpoint/default secret 흔적은 기록 보존으로 남을 수 있다. 새 업체는 새 secret·전용 GAS를 발급해야 하며 기존 값의 재사용을 금지한다. 원본 Git history를 덮어쓰지 않았다.
- Drive JSON/PDF 및 Gmail에는 개인정보가 저장된다. 앱 외부의 ACL·메일 계정 권한·보관 기간·백업·로그 redaction은 코드 테스트로 증명할 수 없다.

## 6. 잔여 P2와 운영 조건

| ID / P2 | 현재 한계·발생 조건 | 운영 대응 / 다음 검증 |
|---|---|---|
| RT-P2-01 | Gmail 성공 응답과 실제 수신함 도착은 다르며 Gmail/Drive는 원자적 transaction이 아님. 전송 후 timeout은 unknown 가능 | 자동 중복 차단 유지. 계약번호/첨부/hash/발송함을 대조한 수동 복구, 미처리·unknown 모니터링. 실제 Gmail 수신/반송 및 GAS 병렬 시험 |
| RT-P2-02 | 승인 URL이 bearer 권한. 브라우저/메일/인프라 로그 유출 시 승인 권한 노출 | 링크 비공유, 메일 계정 보호, proxy query redaction·권한 제한. 만료/서명/업체 scope만으로 계정 탈취까지 방어한다고 주장하지 않음 |
| RT-P2-03 | 현재 PDF binding은 metadata 표식 검사. 이미 승인 권한을 가진 대표가 임의의 PDF 내용을 올리는 행위를 server rendering으로 증명/차단하지 않음 | 대표를 신뢰하는 단일 업체 운영 범위에서 Preview 확인 필수. 악의적 대표까지 방어하는 문서 생성 보증은 후속 설계 사항. 무권한 사용자의 PDF 업로드는 token/backend에서 차단 |
| RT-P2-04 | 익명 접수 악용 시 Drive/Gmail/GAS 비용·quota 고갈. 앱 내부 rate limiter 없음 | 공개 출시 전 호스팅 요청 제한·모니터링·운영자 오류 대응 설정. 새 CAPTCHA/관리자 기능은 이번 범위에 추가하지 않음 |
| RT-P2-05 | 전체 npm audit에 개발 도구 7 high 경고. braces glob stack exhaustion이며 고객 입력이 lint/build glob으로 전달되는 경로는 없음 | untrusted CI 입력 금지, 개발 전용 격리, upstream patch 추적. production `--omit=dev` 0. 감사 경고를 삭제/무시하는 설정은 추가하지 않음 |
| RT-P2-06 | 실제 mobile/Kakao 엔진·GAS 권한/분산 잠금/할당량/Drive ACL은 로컬 VM·Chrome으로 검증 불가 | 독립 staging과 실제 Android/iOS/Kakao에서 업체별 수락 검증 및 복구 리허설 후 운영 전환 |

개발 도구 advisory 근거: [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). `npm audit`의 전이 패키지 7건을 독립된 고객 공격 7개로 계산하지 않는다. 공격 입력이 build glob에 도달하는 배포/CI라면 위험을 재평가해야 한다.

## 7. 출시 질문에 대한 판정

1. **Dear Memory 실제 운영: 조건부 가능.** Dear Client 선택/build, 새 전용 GAS 동시 배포, 정책/대표 수신자 승인, 과거 미처리 레코드 확인, staging 실메일/실기기 검증 후 전환한다. 지금 운영에 이미 적용됐다는 뜻은 아니다.
2. **다른 업체 Config만 바꿔 판매: 조건부 가능.** 정상 범위 내 두 번째 Client는 Core 변경 없이 전체 경로를 통과했다. Config만으로 계정·도메인·GAS·Drive·실 발신 권한까지 설정되는 것은 아니며 업체별 운영 인수가 필요하다.
3. **새 업체 세팅 시 Core 수정: 현재 지원 범위에서는 불필요.** Client Config·selector·env·별도 GAS 프로젝트/권한·build/deploy가 필요하다. 새로운 할인 알고리즘·실시간 멀티테넌트는 현재 지원 범위 밖이다.
4. **가장 큰 운영 위험: 이메일 전송의 불확실한 일부 성공과 운영자 복구.** 이를 미발송으로 오판해 상태 초기화/새 제출로 재발송하면 중복 계약서를 보낼 수 있다. 저장 상태·실제 Gmail 결과·동일 PDF를 함께 확인해야 한다.
5. **다음 기능 전에 남은 일: 업체별 live staging·실기기·복구 리허설·권한/로그/백업·quota/접수 악용 제한을 완료해야 한다.** 로컬 자동 검증 성공을 운영 수락으로 대체하지 않는다.

## 8. 수정 파일 및 재현 명령

| 변경 묶음 | 파일 |
|---|---|
| 업체/legacy 격리 | `src/types/config.ts`, `src/services/configuration.ts`, `src/config/clients/dear-memory/index.ts`, Client source-assets/generate-assets.cjs, `src/assets/images.ts`, `src/app/layout.tsx` |
| token/정책/통신 | `src/lib/token.ts`, `src/lib/serverConfig.ts`, `src/lib/contractWorkflow.ts`, `src/services/googleAppsScriptAdapter.ts`, `src/services/mockBackendAdapter.ts`, `google-apps-script/Code.gs` |
| 입력/PDF | `src/lib/contactValidation.ts`, `contractValidation.ts`, `formFields.ts`, `src/components/pdf/ContractDocument.tsx`, `src/lib/pdfGenerator.ts`. Catalog/ProductSelect/Review의 업체 상품명 주석만 정돈 |
| build/보안 header | `next.config.ts`, `package.json`, `package-lock.json`, `eslint.config.mjs` |
| 테스트 | `scripts/run-red-team-tests.ts`, `run-release-tests.ts`, 기존 hardening/flow/browser/white-label runner, `test-support/gasHarness.ts`, `test-support/mobileCustomer.ts` |
| 운영 안내 | README, .env.example, GAS README, P9 문서의 최신 보고서 참조, 이 보고서 |
| 과거 수동 스크립트 | scratch의 수동 점검 스크립트 4개의 실 운영 URL 제거, 명시적 loopback 입력만 허용. 과거 내려받은 번들은 첫 Client source-assets/deployed-page.txt로 보존 이동 |

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run typecheck:tests
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd audit --omit=dev
```

`ignoreBuildErrors`/`ignoreDuringBuilds`는 없다. ESLint의 native img 최적화 권고만 PDF/base64 경로에 맞춰 해제하며 타입·정확성 오류는 은폐하지 않는다. 기존 상품가격·옵션·할인·약관을 새 정책으로 바꾸거나 새 UI/판매 기능을 추가하지 않았다.
