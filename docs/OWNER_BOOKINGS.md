# 사장님 예약현황 V1

## 사용 순서

1. 고객 계약 화면의 상단 브랜드명 또는 하단 로고를 3초 안에 5회 클릭/터치합니다.
2. `/owner`에서 6자리 숫자 비밀번호로 로그인합니다.
3. 달력의 날짜를 선택하면 예약 목록이 해당 날짜로 좁혀집니다.
4. `대표 확인 대기`를 누르면 조회한 계약 중 대기 건을 날짜순으로 볼 수 있습니다.
5. `내용 확인하기` 또는 `계약 보기`로 기존 대표 Review에 연결됩니다.

PC는 달력 왼쪽·목록 오른쪽, 900px 이하 화면은 달력 위·목록 아래입니다. 상품/설정 편집의 기존 PC 전용 정책은 유지합니다.

## 비밀번호 설정

- `STUDIO_SETTINGS_ENABLED=true`, 서로 다른 Owner/Master hash, 별도 Settings Drive가 필요합니다.
- `node scripts/create-admin-password-hash.cjs --owner-pin`의 **표준입력**으로 6자리 숫자를 전달하고 생성한 hash만 `STUDIO_OWNER_PASSWORD_HASH`에 설정합니다.
- 실제 PIN은 Git, 소스코드, NEXT_PUBLIC 변수, 보고서에 저장하지 않습니다.
- Master 비밀번호는 기존 12자 이상 규칙을 유지합니다.
- 기존 긴 Owner 비밀번호는 기존 운영 설정 로그인에서 계속 사용 가능하지만 새 `/owner` 로그인에는 정확히 6자리 PIN을 설정해야 합니다.
- Owner 로그인은 기존 서버의 영속적인 15분/10회 시도 제한, HttpOnly/SameSite 세션, 30분 유휴 만료·8시간 절대 만료를 재사용합니다. 로고 5회 터치는 인증 수단이 아닙니다.

## 저장과 동기화 기준

- 예약의 원본은 Contracts Drive의 Contract Record입니다. Calendar나 Sheets에서 예약을 역수입하지 않습니다.
- 승인 전에는 Record의 접수값, 승인 후에는 최종 Snapshot의 날짜/시간/장소/상품/금액을 표시합니다.
- `submitted`: 대표 확인 대기, `approved`: 승인 후 발송 확인, `sent`: 계약 완료.
- Calendar는 기존 `calendarSync.status`만 표시합니다. ID·token·진단 payload는 목록에 포함하지 않습니다.
- Calendar/Sheets가 OFF여도 목록을 조회할 수 있습니다. 조회가 계약 승인이나 이메일 발송을 실행하지 않습니다.
- GAS는 요청당 최대 30개 파일을 검사합니다. 다음 페이지가 있으면 일부 조회임을 표시하고 `예약 더 불러오기`를 제공합니다. 건수는 현재 조회한 계약 기준입니다.
- Demo는 프로세스 내 가상 계약을 사용합니다. 개발 라우트 재컴파일은 견디지만 서버 재시작 후 계약은 보존하지 않습니다. 운영 계약 저장과 다릅니다.

## 접근 보호

- 목록/계약 API는 Owner 세션을 서버에서 확인합니다. Master 세션은 Owner로 자동 승격하지 않습니다.
- Review URL에는 계약 ID만 사용합니다. 계약 ID를 알아도 Owner 세션 없이는 조회/승인할 수 없습니다.
- 기존 이메일 승인 토큰은 변경하지 않습니다. Owner 경로는 인증된 서버 요청 문맥과 서명된 GAS 요청으로 별도 권한을 전달합니다.
- GAS에서 Owner 세션과 studioId를 다시 검증합니다. 승인·발송 POST는 Origin과 요청 필드를 검증하고 기존 revision/Snapshot/PDF/중복 발송 보호를 그대로 사용합니다.
- 신규 Owner API를 쓰려면 최신 `google-apps-script/Code.gs`를 전용 STAGING에 반영하고 실제 Google 검증을 완료해야 합니다. 기존 운영 GAS는 자동 변경하지 않습니다.

## 이번 범위 밖

입금 관리, 준비 체크리스트, 작가 배정, 검색, Calendar 역동기화, 새로운 예약 입력, 예약 자동 차단은 추가하지 않았습니다.
