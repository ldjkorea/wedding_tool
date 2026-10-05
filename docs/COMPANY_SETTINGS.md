# 웨딩 부킹 프로그램 — 업체 Config 편집 안내

## 목차

1. 파일 구조
2. 업체 교체
3. 상품·옵션·할인
4. 계약 정책
5. Snapshot 호환
6. Infrastructure와 적용 범위

## 1. 파일 구조

첫 Client Configuration은 Dear Memory입니다. 컴포넌트·가격 계산·Review·PDF·이메일은 중앙 accessor를 사용합니다.

```text
src/config/
  client.ts                     # 사용할 Client 선택
  clients/dear-memory/
    index.ts                    # 전체 설정 + 안내 문구(content) + Demo
    studio.ts                   # 업체·대표·연락처·색상·발신자·폴더 표시명
    products.ts                 # 상품
    options.ts                  # 옵션
    discounts.ts                # 할인/Cashback
    contractPolicy.ts           # 계약 정책·약관
    formSchema.ts               # 기존 12개 입력의 표시·필수·label·placeholder
    legacy-formSchema.ts        # 변경 금지: 이전 Snapshot의 폼 기본값
    assets.ts                   # 현재 로고·직인
    legacy-v1.ts                # 변경 금지: 이전 Snapshot 호환 데이터
    legacy-assets.ts            # 변경 금지: 이전 Snapshot 이미지
src/services/configuration.ts   # 검증·정규화·조회·문구 변수·CSS 테마
src/types/config.ts             # 설정 타입
```

| Config | 주요 항목 |
|---|---|
| studioConfig | studioId, studioName, displayName, representativeName/Email/Phone, website, logo, seal, contractPrefix, brandTagline, colors, emailSenderName, driveFolderName |
| productsConfig | id, name, price, description, includedItems, active, displayOrder |
| optionsConfig | id, name, price, description, active; displayOrder는 선택 |
| discountsConfig | id, name, amount, type, eligibility, active; 순서·채널별 표시명은 선택 |
| contractPolicy | version, deposit, payment, cancellation, refund, delivery, retention, copyright, portfolio, terms |
| formSchema | 기존 12개 필드의 enabled, required, label, placeholder. 핵심 필드 제외. docs/FORM_SCHEMA_CONFIGURATION.md 참고 |
| content / demo | 소개·후기·유입경로·촬영 안내·메타데이터 / Demo 이메일·코드·미리보기 이름 |

이전 src/config/products.ts, options.ts, discounts.ts, contractPolicy.ts와 src/assets/images.ts는 import 호환용입니다. 업체 값은 Client 폴더에서 편집합니다.

## 2. 업체 교체

1. 현재 설정 파일들을 새 Client 폴더에 복사하고 업체 승인 내용으로 수정합니다. legacy-v1.ts와 legacy-assets.ts는 이전 Dear Memory 계약의 기록이며 새 업체 값으로 편집하지 않습니다.
2. 새 index.ts에서 ClientConfiguration을 묶어 export합니다.
3. src/config/client.ts의 import/export를 새 Client로 바꿉니다.
4. 업체 전용 도메인·서버 secret·GAS·비공개 Drive/Sheets를 연결합니다.
5. 다시 빌드하고 해당 업체 배포에 적용합니다.

```ts
import { sampleStudioConfiguration } from './clients/sample-studio';
export const clientConfiguration = sampleStudioConfiguration;
```

Core 로직과 UI Component는 업체별로 수정하지 않습니다. 설정은 빌드/배포로 적용하며 실행 중 업체 전환이나 관리자 편집 화면은 제공하지 않습니다.

## 3. 상품·옵션·할인

### 상품과 옵션

price가 상품 가격의 기준이며 accessor가 기존 내부/저장 형식 basePrice로 연결합니다. 활성 상품·옵션만 선택 화면에 표시하고 순서가 가장 앞선 활성 상품을 초기 선택합니다. 상품/옵션 ID는 자유롭게 지정할 수 있습니다.

앨범 사양·보정/원본 수량·프리미엄 소개는 선택 필드입니다. 기본 상품은 필수 필드만으로 정의할 수 있습니다. 포함 구성은 includedItems, 프리미엄 모바일 목록은 mobilePlusItems에서 편집합니다.

현재 Dear Memory 초기값은 유지했습니다.

- 실속형 1,250,000원 / 화보형 1,450,000원
- 2인 촬영 250,000원 / 폐백 100,000원
- 일요일 100,000원 / 짝꿍 50,000원 / 포트폴리오 100,000원 즉시 할인
- 계약 후기·본식 후기 각각 50,000원 추후 Cashback
- 계약금 300,000원

P4의 화보형 보정 70장+10장·원본 2,500장 이상은 편집 가능한 초기값입니다. 업체 승인 정책으로 새롭게 확정한 값이 아닙니다. 수량을 바꾸면 includedItems/mobilePlusItems/plusBenefits/앨범 요약 등 같은 정책을 설명하는 자유 문구도 맞춥니다. 자유 문장을 자동 해석하지 않습니다.

### 할인

type은 immediate 또는 cashback입니다. Cashback은 futureCashbackTotal에만 합산하고 계약금액·잔금에서 차감하지 않습니다. 후기 두 종류는 Cashback만 허용합니다.

| eligibility.kind | 기존 입력 흐름에 연결되는 조건 |
|---|---|
| weekday | 예식일 요일. weekday 0=일요일 ~ 6=토요일 |
| partner | 짝꿍 혜택 선택. 실 연동에서는 GAS 목록 검증 필요 |
| portfolio | 포트폴리오 동의 |
| review_contract | 계약 후기 혜택 선택 |
| review_main | 본식 후기 혜택 선택 |

같은 kind를 중복 정의할 수 없습니다. active:false인 혜택은 카드·선택·계산에서 제외됩니다. displayOrder/catalogOrder/labels로 화면별 순서·문구를 유지할 수 있으며 기본 표시명은 name입니다.

예약된 의미 ID(sunday, partner, portfolio, review_contract, review_main)를 다른 kind에 재사용하면 설정 오류입니다. 기존 다섯 판정 방식의 금액·이름·유형·활성 여부·요일을 설정할 수 있습니다. 새로운 입력 방식·판정 규칙 추가는 별도 기능입니다.

짝꿍 금액을 변경하면 GAS Sheets B열도 맞춥니다. demo.partnerCodes는 로컬 Demo에서만 사용하고 Production 통신 실패를 대신하지 않습니다.

## 4. 계약 정책

계약금·입금 기한·환불 시간·납품 규격·보관 기간·위약금 비율을 구조화했습니다. 정책 변경 시 version도 갱신합니다. terms는 [{id,title,content}]이며 기존 13개 조항을 유지했습니다.

| 문구 변수 | 기준 |
|---|---|
| {{studioName}}, {{displayName}}, {{friendlyName}}, {{websiteHost}} | 업체 정보 |
| {{depositLabel}}, {{depositDueHours}}, {{refundHours}}, {{balanceDeadline}} | 계약금·입금·환불 |
| {{dateChangeFeeLabel}}, {{disasterFeeLabel}}, {{cancellationTiers}} | 취소/변경 |
| {{retentionMonths}}, {{backupCopies}} | 보관 |
| {{deliveryFormat}}, {{deliveryFormatLower}}, {{deliveryChannel}}, {{longEdgePixels}}, {{longEdgePixelsLabel}}, {{revisionWindow}} | 납품 |
| {{copyrightNotice}}, {{portfolioNotice}} | 저작권·포트폴리오 |

알 수 없는 변수·잘못된 색상·중복 ID·잘못된 금액·활성 상품 없음·미지원 할인 조건·잘못된 후기 유형은 명시적 설정 오류입니다.

cancellation.summary와 자유 안내문은 직접 편집합니다. 위약금 tier 변경 시 요약도 맞춥니다. 수정 요청 기준 시점(앨범 수령/최종 보정본 전달), 후기 허용 채널, 실제 제공 수량은 업체 승인이 필요한 기존 정책 항목이며 임의로 확정하지 않았습니다.

## 5. Snapshot 호환

승인 시 상품·옵션·가격·약관과 함께 당시 업체 정보·문구·할인 정의·Form Schema도 저장합니다. PDF·최종 이메일·Gmail 발신 표시명은 Snapshot을 사용합니다. 이후 Config 변경을 이미 확정된 계약에 소급 적용하지 않습니다.

업체 메타데이터가 없던 이전 형식에는 고정된 Dear Memory v1 데이터를 사용합니다. 호환 파일과 이미지를 최신 업체 값으로 수정하지 않습니다. 기존 Snapshot hash나 저장 PDF를 바꾸는 마이그레이션은 하지 않습니다.

## 6. Infrastructure와 적용 범위

Public Config에 비밀값을 넣지 않습니다.

| 위치 | 설정 |
|---|---|
| 서버 환경 | APP_SECRET, GAS_SHARED_SECRET, GAS_WEBAPP_URL, APP_URL, BACKEND_MODE; NODE_ENV는 Next.js 실행 환경 |
| 대표 수신자 | REPRESENTATIVE_EMAIL 필수. 이전 STUDIO_REP_EMAIL / DEAR_MEMORY_REP_EMAIL은 호환 별칭이며 Config fallback 없음 |
| GAS Script Properties | GAS_SHARED_SECRET, CONTRACTS_FOLDER_ID, 관리자 활성 시 별도 STUDIO_SETTINGS_FOLDER_ID |

현재 Dear Memory 대표 이메일은 소스에 없던 실제 주소를 추정하지 않고 비워 두었습니다. Production에서 유효한 대표 수신자·필수 설정이 없으면 요청 단계에서 실패합니다.

driveFolderName은 Config와 접수/Snapshot에 보존하는 논리적 폴더 이름입니다. 실제 저장 위치는 CONTRACTS_FOLDER_ID로 지정합니다. Config 변경으로 Drive 폴더를 자동 생성·이름 변경하지 않습니다.

이 구조는 **업체별 독립 배포를 위한 빌드 시점 Config**입니다. 독립 secret·GAS·Drive/Sheets 자원을 연결합니다. google-apps-script/.clasp.json의 과거 바인딩은 제거했습니다. 새 업체 전용 프로젝트를 별도 로컬 메타데이터로 연결합니다.

기존 고객 입력·승인·가격·token·GAS 서명·중복 발송 방지·PDF Snapshot 결합 흐름을 유지합니다. 새 관리 UI·온라인 결제·다중 업체 서버 기능은 추가하지 않았습니다. Production env·GAS·Email·build·deploy 절차는 README.md를 따릅니다. APP_URL의 이전 NEXT_PUBLIC_APP_URL 별칭도 읽지만 서로 다른 값의 중복 선언은 설정 오류입니다. 실제 고객 적용 전 업체 정책과 전용 환경의 Flow/PDF/메일을 확인합니다.
