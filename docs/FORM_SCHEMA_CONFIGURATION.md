# 웨딩 부킹 프로그램 — 업체별 Form Schema 설정

## 목차

1. 편집 위치와 범위
2. 숨김·선택·필수 설정
3. Dear Memory 기본 상태
4. 보호되는 핵심 필드
5. 검증·제출·Snapshot
6. 적용 순서와 제한

## 1. 편집 위치와 범위

업체별 파일 `src/config/clients/dear-memory/formSchema.ts`에서 기존 입력 필드 12개의 상태와 문구를 편집합니다. 해당 Client의 `index.ts`가 `formSchema`를 묶고, `src/config/client.ts`가 사용할 Client를 선택합니다.

고객 폼과 대표 수정 화면은 중앙 accessor `getFormField / isFormFieldEnabled / isFormFieldRequired`를 사용합니다. 필드 생성·정렬·사용자 정의 입력 유형을 제공하는 Form Builder는 아닙니다.

| 속성 | 형식 | 의미 |
|---|---|---|
| enabled | boolean | 입력 UI 표시 여부 |
| required | boolean | 빈 값 제출 허용 여부 |
| label | 비어 있지 않은 string | 입력 항목 표시명 |
| placeholder | string | 입력 예시. 빈 문자열 허용 |

## 2. 숨김·선택·필수 설정

| 상태 | enabled | required | 동작 |
|---|---|---|---|
| 숨김 | false | false | 입력란과 필수 검증 제외, 제출 값은 빈 문자열로 정규화 |
| 선택 | true | false | 빈 값 허용, 입력한 값의 형식·길이는 검증 |
| 필수 | true | true | 필수 표시, 빈 값 제출 차단 |
| 설정 오류 | false | true | 숨긴 필수 필드 모순으로 설정 로딩 실패 |

```ts
// 해당 키의 기존 설정을 아래처럼 변경합니다.
makeupLocation: {
  enabled: false,
  required: false,
  label: '메이크업 장소 / in, out 시간',
  placeholder: '',
},
groomPhone: {
  enabled: true,
  required: false,
  label: '신랑 연락처',
  placeholder: '010-0000-0000',
},
shootRequestNotes: {
  enabled: true,
  required: true,
  label: '촬영 요청사항',
  placeholder: '특별 요청이 없으면 없음으로 입력해 주세요.',
},
```

준비정보의 접힌 영역에 필수 항목 또는 오류가 있으면 해당 영역을 펼쳐 표시하고 필수 입력을 숨기지 않습니다. 모든 자식 필드가 비활성인 영역은 표시하지 않습니다.

유입경로는 기존 버튼 선택 UI를 유지합니다. placeholder는 ‘기타 경로’의 직접 입력란과 대표 수정 입력란에 적용됩니다. 필수 유입경로는 하나의 경로를 선택하면 충족되며, ‘기타 경로’의 추가 설명 자체를 별도 필수 필드로 만들지 않습니다.

## 3. Dear Memory 기본 상태

모든 설정 대상 필드는 enabled:true입니다. 현재 필수·선택 상태를 유지했습니다.

| 키 | 용도 | 기본 상태 |
|---|---|---|
| groomPhone | 신랑 연락처 | 필수 |
| bridePhone | 신부 연락처 | 필수 |
| weddingHall | 홀 명칭 / 층수 | 필수 |
| makeupLocation | 메이크업 장소 / in, out 시간 | 선택 |
| groomFamilyMembers | 신랑 가족 구성 | 선택 |
| brideFamilyMembers | 신부 가족 구성 | 선택 |
| shootRequestNotes | 촬영 요청사항 | 선택 |
| retouchRequestNotes | 후보정 요청사항 | 선택 |
| requestNotes | 기타 요청사항 / 특약 | 선택 |
| referralSource | 유입경로 | 선택 |
| instagramId | 인스타그램 아이디 | 선택 |
| blogUrl | 블로그 주소 | 선택 |

familyMembers는 기존 데이터 구조에 맞춰 신랑·신부 두 필드로 각각 설정합니다. 기본 고객 폼의 label과 placeholder를 초기값으로 유지했습니다. 대표 수정 화면도 같은 중앙 설정을 사용합니다.

## 4. 보호되는 핵심 필드

다음 키는 Form Schema 설정 대상이 아니며 서버에서도 계속 필수로 검사합니다.

- groomName, brideName: 신랑·신부 성명
- weddingDate, weddingTime: 예식일·시간
- weddingVenue: 실제 예식장
- email: 계약서 수신 이메일
- productId: 유효한 활성 상품
- termsAgreed: 약관 동의 true

**weddingVenue와 weddingHall은 다릅니다.** 실제 예식장은 제거할 수 없습니다. 홀 명칭·층수인 weddingHall만 업체별로 숨김·선택·필수 설정이 가능합니다.

12개 대상 키를 삭제하거나 다른 키를 추가하면 설정 오류로 실패합니다. 핵심 필드 설정을 임의로 추가해 제거할 수 없습니다.

## 5. 검증·제출·Snapshot

- 고객 확인 단계와 최종 제출, 대표의 최종 확정 준비 단계에서 같은 Form Schema로 필수값·연락처 형식·길이·문자를 검사합니다.
- 서버 canonicalForm은 UI 검사와 별도로 핵심 필드 및 업체별 필수값을 확인합니다.
- hidden 필드의 기존 값이나 임의로 보낸 값은 서버 정규화에서 빈 문자열로 처리합니다. 새 canonical payload와 승인 Snapshot에 숨긴 값이 다시 들어가지 않습니다.
- 요청사항 계열은 최대 2,000자, 다른 설정 대상 필드는 최대 300자입니다. 연락처를 선택 입력으로 바꿔도 제공된 연락처는 기존 형식을 검증합니다.
- 승인 Snapshot에 당시 formSchema를 저장하고 GAS 확정본 동등성 비교에도 포함합니다.
- formSchema가 없는 이전 Snapshot을 읽는 accessor는 고정 legacy-formSchema를 사용합니다. 기존 발송된 Snapshot과 hash를 소급 변경하지 않습니다.
- 미발송 계약의 편집·재확정은 현재 업체 설정으로 검증합니다. 설정 변경 후 기존 확정본이 현 검증과 다르면 발송 요청이 실패할 수 있으므로 대표가 재검토·재확정합니다.
- label은 Form UI 문구입니다. 법적 약관 및 PDF·이메일의 고정 항목 제목을 자동으로 바꾸는 정책 설정은 아닙니다.

## 6. 적용 순서와 제한

1. 해당 Client의 formSchema.ts를 편집합니다. 기존 12개 키는 유지합니다.
2. index.ts의 ClientConfiguration 및 client.ts의 선택을 확인합니다.
3. TypeScript 검사와 build를 수행하고 해당 업체 배포에 적용합니다.
4. 고객 입력 → 대표 수정 → 확정 → PDF·이메일을 staging에서 확인합니다.

실행 중 업체 전환·관리자 편집 화면·새 필드 추가·사용자 정의 검증 규칙은 이번 범위에 포함하지 않습니다. 기존 레이아웃과 입력 유형을 유지합니다. 서버 비밀값 및 GAS 환경변수는 Form Schema에 넣지 않습니다.

legacy-formSchema.ts는 이전 계약 호환용 고정 기록이며 업체 설정 변경 시 편집하지 않습니다.
