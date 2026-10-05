# P6 — White-label Config 구조 구현

## 목차

1. 구성
2. 변경 범위
3. 기존 계약 보존
4. 검증 범위
5. 적용 방법

## 1. 구성

Dear Memory를 첫 Client Configuration으로 추출했습니다. src/config/client.ts가 업체 설정을 선택하고 src/services/configuration.ts가 모든 소비자에 중앙 accessor를 제공합니다.

```text
Client selector → Client Configuration → 중앙 accessor
                                      ├─ 카탈로그·고객 입력
                                      ├─ 서버 가격·접수
                                      ├─ 대표 Review
                                      └─ 승인 Snapshot → PDF·이메일·Gmail 발신명
```

## 2. 변경 범위

- studio/products/options/discounts/contractPolicy를 별도 파일로 분리했습니다.
- 안내 문구와 Demo, 로고·직인을 Client 폴더 안에 모았습니다.
- active/displayOrder, 할인 eligibility/type/amount, 계약 번호 Prefix를 연결했습니다.
- 기존 색상을 CSS 변수로 공급했습니다. 레이아웃 변경을 목적으로 한 수정은 없습니다.
- structured policy와 약관의 주요 숫자/이름을 문구 변수로 연결했습니다.
- 기존 Config import 경로는 얇은 호환 export로 유지했습니다.
- P8 기준 REPRESENTATIVE_EMAIL을 공통 수신자 설정명으로 사용합니다. STUDIO_REP_EMAIL / DEAR_MEMORY_REP_EMAIL은 호환 별칭이며, 서로 다른 값의 중복 선언과 Config 수신자 fallback은 허용하지 않습니다.
- 새 라이브러리·관리 화면·새 업무 기능은 추가하지 않았습니다.

## 3. 기존 계약 보존

새 Snapshot에는 당시 studio/content/discounts도 저장됩니다. PDF·이메일·GAS sender는 저장된 값을 사용합니다. 이전 형식에는 고정된 v1 브랜드·문구·할인·이미지를 사용합니다. 기존 Snapshot/PDF를 다시 쓰지 않았습니다.

ID/token/hash/revision/발송 상태 구조는 유지했습니다. GAS의 동일 Snapshot 판정에도 새 업체 메타데이터를 포함합니다.

## 4. 검증 범위

최종 컴파일·빌드 결과와 커밋 SHA는 저장소 밖 outputs 결과 보고서에 기록합니다.

앱 TypeScript, 기존 테스트 소스 TypeScript, production build, GAS 구문을 확인합니다. 테스트 소스 컴파일은 acceptance/회귀 테스트 실행 성공과 다릅니다. 이번 단계는 테스트 실행을 요청받지 않아 기존 테스트 실행·새 테스트 추가를 하지 않았습니다. 브라우저 시각 결과·실제 GAS/Gmail/Drive 운영 결과도 이번 결과에 포함되지 않습니다.

## 5. 적용 방법

docs/COMPANY_SETTINGS.md에 편집 위치와 업체 교체 절차를 정리했습니다. Client 선택 파일과 해당 Config를 교체하고 다시 빌드/배포합니다.

현재 구조는 업체별 독립 배포용 빌드 시점 설정입니다. 새로운 eligibility나 실행 중 다중 업체 전환은 별도 기능입니다. 실제 Drive 위치는 전용 폴더 ID로 연결합니다. 미확정 상품 수량·후기 채널·수정 기준 시점을 임의로 확정하지 않았습니다.
