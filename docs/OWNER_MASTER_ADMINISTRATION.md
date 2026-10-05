# 업체대표 운영 콘솔과 총관리자 설정

## 역할과 접속 주소

| 역할 | 주소 | 용도 |
|---|---|---|
| Owner / 업체대표 | `/studio-control` | 상품·가격·옵션·할인·할인코드·선택형 Google Sheets |
| Master / 총관리자 | `/master-control` | 업체 도입 설정·브랜드·이미지·약관·입력폼·전체 설정 이력·복구 |

한 업체 배포에 두 역할만 있다. 회원 DB·직원 계정·멀티테넌트가 아니다. 고객 메뉴와 Owner 화면에는 Master 주소를 연결하지 않는다. 주소를 알아도 별도 Master 인증이 없으면 설정을 읽거나 변경할 수 없다. 두 페이지/API는 noindex/nofollow/no-store이며 모바일 편집을 넓히지 않는다. 화면 너비 1,024px 이상 PC에서 사용한다.

## 비밀번호와 안전한 이전

서버 환경변수:

- `STUDIO_OWNER_PASSWORD_HASH`: 업체대표 전용.
- `MASTER_ADMIN_PASSWORD_HASH`: 총관리자 전용.
- `STUDIO_ADMIN_PASSWORD_HASH`: 이전 버전 호환용. 새 Master hash가 없을 때에만 Master로 사용한다. Owner로 자동 전환하지 않는다.

각 비밀번호는 서로 다르게 설정한다. Master는 12자 이상, 새로운 모바일 예약현황의 Owner 로그인은 정확히 6자리 숫자를 사용한다. 기존 긴 Owner 비밀번호는 기존 운영 설정 로그인에서 호환된다. `scripts/create-admin-password-hash.cjs`에 표준입력으로 전달해 scrypt hash를 생성하며, Owner PIN에는 `--owner-pin` 옵션을 사용한다. plaintext나 NEXT_PUBLIC 변수로 저장하지 않는다. dotenv에서는 hash를 작은따옴표로 감싼다. APP_SECRET/GAS_SHARED_SECRET은 그대로 별도 서버 환경에 둔다. UI로 Secret을 조회/변경하지 않는다. 자세한 설정과 제한은 [사장님 예약현황](OWNER_BOOKINGS.md)을 따른다.

### 기존 배포 전환 순서

1. 현재 배포 환경과 비공개 설정/계약 폴더를 보존한다. 기존 hash를 제거하지 않는다.
2. staging에서 이번 GAS/앱의 역할 동작을 검증한다. 새 앱의 Owner 역할을 이해하지 못하는 이전 GAS와 혼용하지 않는다.
3. 기존 hash를 유지한 상태로 `/master-control`에서 Master 로그인·이력·복구를 확인한다.
4. 별도 `STUDIO_OWNER_PASSWORD_HASH`를 설정하고 `/studio-control`에서 Owner 로그인·운영값 저장·Master 접근 거부를 확인한다.
5. 새 `MASTER_ADMIN_PASSWORD_HASH`를 넣으려면 설정 후 새 비밀번호로 Master 로그인부터 확인한다. 새 hash가 우선하며 기존 Master 세션은 다시 로그인해야 한다.
6. 새 Master 접근이 확인된 뒤에만 legacy hash를 환경에서 제거한다. 저장된 기존 revision을 변환하거나 삭제하지 않는다.

Owner hash를 아직 설정하지 않은 기존 배포에서는 Owner 인증 요청이 명확히 실패하고 Master 접근은 계속 유지된다. `check:env`는 Master 설정을 필수 검증하고, Owner hash가 제공되면 형식과 독립성을 검증한다. 동일 hash 또는 같은 비밀번호로 두 역할을 운영하려 하면 Owner 로그인이 거부된다.

쿠키는 `studio_owner_session`과 기존 `studio_admin_session`으로 분리한다. HttpOnly·SameSite=Strict·Production Secure를 유지한다. 세션 키는 역할별 목적과 해당 hash에 결합된다. GAS에도 세션 역할을 저장하고 검증한다. 활동 없음 30분/최대 8시간·서버 영속 로그인 시도 제한·로그아웃 취소·비밀번호/APP_SECRET 회전 보호를 유지한다. 비밀번호, 실제 쿠키, 세션 키는 기록/보고서에 넣지 않는다.

## Owner가 관리하는 값

| 메뉴 | 변경 가능한 값 | 보호되는 값 |
|---|---|---|
| 상품 및 가격 | 이름, 가격, 설명, 한 줄 안내, 주요 제공내용, 보정본/추가 보정본, 원본 안내, 앨범 안내, 사용, 표시 순서 | ID, 상세 디자인/배지/템플릿 구조 |
| 추가 옵션 | 이름, 가격, 설명, 사용, 표시 순서 | ID, 고급 표시 구조 |
| 할인 및 혜택 | 고객 표시명, 금액, 설명, 사용 | 적용 조건, 요일 구조, immediate/cashback 구분 |
| 할인코드 | 코드, 금액, 사용 | ID, 전체 코드 공개 금지 |
| 계약목록 | 사용, 신규 파일 생성, 상태 확인, 개별 재동기화 | Sheet/탭 ID 직접 변경, Drive/GAS 설정 |

새 상품/옵션/코드는 서버가 ID를 생성한다. 기존 항목의 물리 삭제 대신 사용 안 함을 선택한다. 새 할인 조건을 임의로 생성하는 기능은 제공하지 않는다. 할인코드 비교는 기존 서버 규칙대로 대소문자를 구분하지 않고 앞뒤 공백을 제거하며 내부 공백은 금지한다.

상품 설명·주요 제공내용·앨범 요약은 기존 서로 다른 표시 필드다. 수량을 바꾸면 함께 표시되는 안내 문구도 일치하는지 확인한다. Master의 고급 프리미엄 문구/배지/디자인 구조를 Owner 편집으로 자동 덮어쓰지 않는다. 미니 예시는 실제 상품 데이터 필드와 원화 표시 함수를 사용하며 전체 고객 페이지의 모든 레이아웃을 재현하지 않는다.

## 서버 저장과 권한

Owner API `/api/owner-control/settings`는 `{changes, version}`만 받는다. changes는 `products/options/discounts/codes` 네 목록과 허용 필드만 허용한다. 전체 ClientConfiguration, 브랜드/약관/입력폼/연동 ID/Secret/새 내부 ID/중복 ID를 끼워 넣으면 거부한다.

서버는 현재 전체 설정을 읽고 허용된 값만 병합한 뒤 기존 전체 validation을 실행한다. 화면에 보이지 않는 Master 값을 보존한다. 상품/옵션 이름 변경 시 짧은 이름, 혜택명 변경 시 고객 표시명도 일관되게 갱신한다. 저장은 기존 expectedRevision과 영속 publication을 유지한다. GAS는 Owner 세션의 Master 액션을 차단하고 Owner 변경에서 보호 값이 유지됐는지 다시 검사한다. Demo도 같은 책임의 역할/변경 검사를 적용한다.

Owner 응답에는 운영 projection과 충돌 확인용 version만 제공한다. 전체 설정·raw history·hash·Master 값은 보내지 않는다. version/ID는 화면에 표시하지 않는다. 기존 `/api/studio-control/*`는 호환용 **Master 전용**으로 유지하며 새 Master 화면은 `/api/master-control/*`를 사용한다.

## 이력, 충돌, 저장 실패

Owner/Master 모두 같은 Business Config revision을 새로 만든다. 새 revision/history에는 `actor: owner|master`를 기록한다. 이전 metadata가 없는 revision은 legacy로 읽으며 settings hash를 변경하지 않는다. Master 복구는 이전 설정으로 새 revision을 추가한다. Owner는 raw history/전체 복구에 접근할 수 없다.

서로 최신 설정을 읽고 수정했더라도 먼저 저장한 쪽만 현재 version으로 저장할 수 있다. 뒤늦은 저장은 409로 거부한다. 대표에게는 “다른 곳에서 설정이 변경되었습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.”를 보여준다.

Owner 저장 전에 이름·원화 금액·사용 여부 등 변경 요약을 보여준다. 검증 실패와 연결 실패는 일반 문장으로 설명한다. 응답 유실은 저장 여부가 불명확하므로 “기존 설정이 변경되지 않았다”고 단정하지 않는다. 최신 내용을 불러와 적용 여부를 확인한다. 변경 취소로 값이 조용히 덮어쓰이는 기능은 만들지 않는다.

## 계약·Sheet 보호

새 설정은 신규 계약에 반영된다. 기존 미처리 계약의 revision 보호와 대표 승인 Gate를 유지한다. 고객 신청을 자동 확정하지 않는다. 이미 확정/발송된 계약은 당시 Snapshot을 사용하며 PDF·메일·금액을 현재 설정으로 다시 계산하지 않는다. Owner 화면에서는 기술 용어 대신 진행 중인 계약 확인이나 관리자 문의를 안내한다.

Google Sheets 설정은 기존 독립 연동 revision이다. Owner/Master 둘 다 사용 여부와 개별 재시도를 관리할 수 있으나 연동 ID를 직접 조작하는 API는 없다. OFF에서도 Core 흐름이 동작하고 Sheets 장애가 계약 성공을 취소하지 않는다. 실제 Google 승인/공유/trigger/할당량 검증은 별도 staging 작업이다.

## 검증과 실제 사용자 확인

`npm test`는 두 업체의 typecheck/typecheck:tests/lint/build와 계약·보안·가격·할인코드·Sheets·새 역할 테스트를 실행한다. Dear Memory 검증 단계에서 기존 Master 브라우저와 새 Owner 브라우저도 실행한다. 원래 업체 선택 파일과 마지막 build를 복원한다.

자동 브라우저 검증은 일반 대표가 5분 내 사용할 수 있다는 인간 사용성 증거가 아니다. 실제 업체 대표에게 설명 없이 가격 하나와 코드 하나를 변경하게 하고 소요시간/잘못된 입력/저장 이해도를 확인한다. 미처리 계약 안내, 캐시백 구분, 상품 구성 안내 문구의 일치, Sheets 오류 설명을 별도로 확인한다. 모바일은 현재 PC 이용 안내를 유지했으며 상태 조회 전용 모바일 기능은 후속 검토 사항이다.

### 대표에게 기존 관리자 비밀번호를 알려줬던 경우

대표에게 Owner 주소를 전달하기 전에 새 총관리자 비밀번호를 발급하고 MASTER_ADMIN_PASSWORD_HASH로 교체하세요. 새 Master 로그인과 이전 비밀번호의 접근 차단을 확인한 뒤 전달합니다. 기존 비밀번호를 계속 공유하면 화면을 나눠도 사람의 Master 접근 권한은 제한되지 않습니다.
