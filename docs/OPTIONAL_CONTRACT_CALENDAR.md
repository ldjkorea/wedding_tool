# 선택형 Google Calendar 촬영일정

## 목차

1. 대표 사용법
2. 배포 담당자 설정
3. 저장 구조와 처리 순서
4. 장애 복구
5. 검증 범위

## 대표 사용법

1. PC에서 Owner Console(`/studio-control`)에 로그인합니다.
2. **촬영 일정 → Google Calendar 설정**을 엽니다.
3. **Google Calendar 사용**을 켭니다.
4. **촬영 일정 캘린더 만들기**를 누릅니다. 기존 기본 캘린더에 기록하지 않습니다.
5. 고객 계약을 Review에서 확인·수정하고 명시적으로 승인합니다.
6. 별도 작업자가 승인된 예식일정을 등록하고, 계약서 발송 완료 후 같은 일정의 발송 상태를 갱신합니다.

기본 표시시간은 **3시간**입니다. 확인된 계약 촬영시간을 의미하지 않으며 운영 화면에서 차지할 시간 블록의 기본값입니다. 1·2·3·4·6·8시간으로 바꿀 수 있습니다. 변경은 이후 승인되는 새 계약부터 적용됩니다. 이미 승인된 계약의 표시시간은 재동기화해도 그대로입니다.

Calendar를 끄면 앞으로의 자동 작업을 중지하며 기존 캘린더나 일정을 삭제하지 않습니다. 다시 켜도 과거 계약을 자동으로 가져오지 않습니다. 이전에 등록을 시도한 실패·대기 계약은 개별 **다시 등록**으로 재요청할 수 있습니다.

Google Sheets와 Calendar는 독립적입니다. 두 기능 모두 끄거나 어느 한쪽만 켜도 계약 접수·승인·Snapshot·PDF·Drive·이메일은 작동합니다.

## 배포 담당자 설정

이 작업에서는 실제 Google 권한 승인이 완료되지 않았습니다. 아래 설정은 **STAGING 전용**에서 먼저 검증해야 합니다. 운영 프로젝트에 바로 덮어쓰지 않습니다.

- 최신 `google-apps-script/Code.gs`와 웹앱을 같은 버전으로 준비합니다.
- 해당 STAGING GAS가 사용하는 Cloud 프로젝트에서 Google Calendar API를 활성화합니다.
- 기존 Drive/Gmail/Sheets/설치형 trigger 권한을 유지하고 아래 Calendar 권한을 추가합니다.
- `docs/calendar-appsscript.example.json`은 전체 manifest 예시입니다. 사용하는 GAS의 배포·기존 권한 설정을 확인한 뒤 병합합니다. Secret과 실제 자원 ID는 포함하지 않습니다.
- Google 계정 선택·OAuth 동의·Apps Script 실행 권한 승인은 계정 소유자가 직접 수행해야 합니다. 웹앱 요청이 HTML 로그인/권한 페이지를 반환하면 실제 E2E 검증을 시작하지 않습니다.
- 이 구현은 Calendar REST API를 `UrlFetchApp`으로 호출합니다. Advanced Calendar Service나 새 Node 라이브러리는 필요하지 않습니다.
- 새 Node 환경변수나 고객에게 전달할 Calendar ID는 없습니다. 기존 APP/GAS/Owner/Master 인증과 studioId 범위를 재사용합니다.

| 추가 권한 | 용도 |
|---|---|
| `https://www.googleapis.com/auth/calendar.app.created` | 앱이 만든 전용 캘린더와 그 안의 일정 관리 |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | 생성 응답 유실 시 생성 표식으로 기존 캘린더 찾기 |
| `https://www.googleapis.com/auth/calendar.acls.readonly` | 공개/조직 전체 공유 여부 확인 |
| `https://www.googleapis.com/auth/script.external_request` | GAS에서 Calendar REST API 호출 |

Google 공식 문서: [Calendar 생성](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert), [Event 생성 및 지정 ID](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [Calendar ACL 조회](https://developers.google.com/workspace/calendar/api/v3/reference/acl/list), [Apps Script 명시적 권한](https://developers.google.com/apps-script/concepts/scopes).

Calendar OFF 계약 흐름에서는 Calendar API나 OAuth token 조회를 호출하지 않습니다. Calendar를 사용하지 않는 배포는 추가 Calendar 권한을 요청하지 않아도 됩니다. 사용하는 배포는 ON 전에 위 권한과 API 활성화를 준비해야 합니다.

## 저장 구조와 처리 순서

계약의 공식 원본은 Contract Record·최종 Snapshot·PDF·발송 상태입니다. Calendar는 단방향 운영 일정 사본입니다.

- 운영 설정: GAS Script Properties의 `studio_settings_{studioId}_calendar`.
- `schemaVersion`, 독립 `revision`, `enabled`, `durationMinutes`, `timezone`, 사용 주기 `cycle`.
- 전용 `calendarId`, 표시 이름, 생성 표식·상태·lease, 생성일. 기존 연결 교체 시 이전 ID를 별도 보존합니다.
- 상품/가격/약관의 설정 revision 및 configuration binding에 포함하지 않습니다.
- Contract Record의 `calendarSync`: `status`, `generation`, `calendarId`, `eventId`, `durationMinutes`, `timezone`, `cycle`, `attempts`, `queuedAt`, `lastAttemptAt`, `lastSuccessAt`, 허용된 `errorCode`.
- 상태: `pending`, `working`, `synced`, `failed`, `unknown`. OFF 승인에는 작업 자체를 생성하지 않습니다. UI에서는 `working`을 확인 필요로 표시합니다.

```text
고객 접수 → 대표 Review → 대표 명시적 승인
  → Snapshot + Calendar 대기 상태를 같은 Record에 영속 저장
  → PDF / Drive / 고객메일 / 대표메일 (Calendar 응답을 기다리지 않음)
  → 완료 상태의 Calendar 갱신 작업 기록

별도 contractCalendarWorker (1분 trigger)
  → 짧은 ScriptLock에서 작업 확보
  → 잠금 해제 후 Calendar 조회/생성/갱신
  → 같은 generation일 때만 결과 저장
```

작업자는 1회 파일 15개 범위를 탐색하고 최대 3건을 처리합니다. 파일 수와 Google 지연에 따라 반영 시간이 늘어납니다. 승인 직후 발송까지 빨리 끝난 경우 중간 승인 상태를 따로 표시하지 않고 최신 완료 상태로 최초 등록될 수 있습니다. 승인 전에는 등록되지 않습니다.

시간은 `Asia/Seoul` 하나로 고정합니다. 예식 날짜·시각을 `+09:00` 오프셋이 있는 문자열로 구성하고 종료 시각은 분 단위로 계산합니다. Calendar 자체 시간대가 서울이 아니면 동기화를 멈추고 오류를 표시합니다. 다른 국가 시간대 설정은 이번 범위가 아닙니다.

이벤트에는 계약번호, 신랑·신부, 예식장/홀, Snapshot 상품/옵션, 최종금액, 계약·발송 상태만 포함합니다. 이메일·전화·가족사항·요청사항·approval token·session·전체 JSON·Snapshot hash는 복제하지 않습니다. 고객을 참석자로 추가하지 않습니다. 이벤트는 비공개이며 공유 설정을 자동으로 공개로 변경하지 않습니다.

## 중복 방지와 장애 복구

계약별 기본 Event ID는 SHA-256(`calendar-v1\n{studioId}\n{contractId}`)의 64자리 hex입니다. Google이 허용하는 지정 ID 문자 범위에 들어갑니다. description에는 `WB-CONTRACT: {contractId}`, private extended property에는 studioId와 contractId를 함께 저장합니다.

1. 저장된 Event ID 또는 계약별 고정 ID를 조회합니다.
2. private contract marker로 기존 이벤트를 검색합니다. 날짜 범위를 제한하지 않아 사람이 날짜를 옮긴 일정도 찾을 수 있습니다.
3. 하나면 재사용합니다. 둘 이상이거나 기존 ID와 검색 결과가 충돌하면 생성을 중단합니다.
4. 신규 생성 응답이 유실돼도 같은 고정 ID를 사용합니다. API 409나 불확실한 결과는 성공으로 숨기지 않습니다.
5. 이벤트는 저장됐지만 Record 저장이 실패하면 durable working 상태가 남습니다. 다음 작업이나 재요청에서 고정 ID/marker로 복구합니다.
6. Calendar 생성 응답이 유실되면 미리 저장한 `WB-STUDIO` 생성 표식으로 Calendar 목록을 검색합니다. 결과가 없거나 여러 개면 자동 재생성하지 않습니다.

| 상태 | 처리 |
|---|---|
| 일정 등록 실패/불확실 | 연결을 확인하고 해당 계약 **다시 등록**. 계약서 재발송이나 고객 재제출은 필요 없음 |
| Calendar 삭제 | 삭제/권한 문제 확인. 자동 재생성 금지. Owner가 명시적으로 새 캘린더 생성 가능 |
| 새 Calendar로 교체 | 기존 계약은 이전 Calendar에 고정됨. 자동으로 새 Calendar에 복제하지 않음. Master 수동 진단 필요 |
| Event 삭제/표식 변경 | 자동으로 대체 일정 생성하지 않음. Master가 원본 연결을 확인해야 함 |
| 같은 표식이 여러 Event에 존재 | 중복 오류. 자동 쓰기 중단. Master가 Google에서 잘못 복제된 일정을 확인·정리 후 재시도 |
| Calendar 이름 변경 | ID가 같으면 정상 사용, 화면은 현재 이름 표시 |
| 전체/조직 공개 또는 시간대 변경 | 동기화 차단. Google 공유/시간대를 복구 후 재시도 |
| Worker 없음 | 사용 설정을 다시 저장해 trigger 등록. GAS 계정의 권한/trigger 목록 확인 |

실패는 계약 성공을 되돌리지 않으며 Sheets 작업에도 영향을 주지 않습니다. Google I/O는 Core ScriptLock 밖에서 실행됩니다. 짧은 상태 저장 잠금 경합은 가능하지만 외부 요청 시간만큼 Core를 잠그지 않습니다.

Owner API와 GAS 양쪽 allowlist는 ON/OFF·표시시간·명시적 생성·기존 작업 재요청만 허용합니다. 임의 Calendar ID/Event ID, studioId 변경, 내부 상태 주입은 거부합니다. Master는 일부 마스킹된 연결 ID와 상태 진단을 확인합니다. Calendar ID 전체는 서버에 저장되고 관리자용 열기 링크에만 포함되며 고객 응답/런타임 설정에는 포함되지 않습니다.

## 검증 범위

- `npm run test:calendar`: 실제 Code.gs/API 로직 + Fake Google REST/Drive/Gmail/Sheets.
- `npm run test:owner-browser`: 격리된 Demo 서버의 Owner 화면 ON/생성/표시시간/OFF, 기존 설정 보호.
- `npm test`: 두 Client의 typecheck, test typecheck, lint, release 회귀, Production build 포함.
- 실제 Calendar 생성·권한·trigger 실행·Google 지연/쿼터는 별도 Staging E2E 완료 전까지 검증되지 않은 상태입니다.

과거 계약 전체 backfill, Calendar에서 Core로 역동기화, 작가 배정/휴무/공개 예약은 구현하지 않습니다. 사용량이 커지면 작업 대기시간·Google 쿼터와 Drive 탐색 비용 측정을 후속으로 권장합니다.
