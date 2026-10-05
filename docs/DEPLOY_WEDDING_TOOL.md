# wedding_tool 배포

## 구성

- GitHub 비공개 저장소: `ldjkorea/wedding_tool`
- Next.js 서버 호스팅: Vercel. GitHub Pages는 서버 API와 인증 세션을 실행할 수 없으므로 사용하지 않는다.
- 배포본은 개발 Core의 검증된 커밋을 새 저장소에 복사한다. 기존 판매 원본의 Git 이력이나 로컬 Preview 변경, `.env`, 테스트 결과, 로컬 Demo 데이터를 업로드하지 않는다.
- 기본 Client는 커밋에 선택된 가상 업체 MOMENT STUDIO이다. 개발자가 임시로 선택한 로컬 Dear Memory Preview는 보존하되 공개 배포에 끼워 넣지 않는다.

## 실제 계약 운영 전 필수 연결

1. 별도의 Google 계정/전용 GAS 프로젝트에 최신 `google-apps-script/Code.gs` 배포와 사람의 권한 승인.
2. Contracts/Settings용 비공개 Drive 폴더를 서로 다른 ID로 생성.
3. GAS Script Properties에 전용 공유 Secret과 두 폴더 ID 설정.
4. Vercel 환경변수에 `.env.example`의 `BACKEND_MODE=gas`, `APP_SECRET`, `GAS_SHARED_SECRET`, `APP_URL`, `GAS_WEBAPP_URL`, `REPRESENTATIVE_EMAIL`, `MASTER_ADMIN_PASSWORD_HASH`, `STUDIO_SETTINGS_ENABLED=true` 설정.
5. 재배포 후 총관리자에서 Owner 6자리 비밀번호와 업체 설정 저장.
6. 실제 STAGING E2E를 확인한 다음 실제 고객에게 안내.

Google 연결이 없으면 사이트 화면의 배포 성공만으로 로그인·접수·발송이 준비된 것으로 판단하지 않는다. Mock으로 전환하거나 성공으로 위장하지 않는다. 기본 비밀번호만으로 실 운영 데이터에 접근할 수 없다.

## 변경 반영

개발 Core에서 필요한 수정만 커밋하고 회귀검증한다. 해당 커밋의 추적 파일을 배포 작업공간에 반영해 변경 목록과 Secret 유입 여부를 확인한 후 `main`에 push한다. Vercel은 연결된 Git 저장소의 변경을 빌드한다. 배포된 Git SHA와 READY 상태, 실제 HTTPS 응답을 각각 확인한다.

비밀번호·Secret은 GitHub나 문서에 입력하지 않는다. Vercel/GAS의 비밀 설정을 사용한다. 운영 Google 자원을 테스트 자원으로 사용하지 않는다.
