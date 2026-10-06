# 공개 접속 주소

앱 주소: https://wedding-tool-red.vercel.app/

기존 주소 https://ldjkorea.github.io/wedding_tool/ 는 `docs/index.html`을 통해 앱으로 이동합니다. JavaScript 이동은 query와 hash를 유지하며, JavaScript를 사용할 수 없을 때에는 HTML 자동 이동 및 링크를 제공합니다.

GitHub Pages 설정은 `main` 브랜치의 `/docs`입니다. 이 디렉터리는 접속 안내와 문서만 제공합니다. 실제 앱은 서버 API를 사용하는 Next.js 프로젝트이므로 Vercel에서 실행합니다. Pages 빌드 성공은 Next.js 앱 빌드 성공을 의미하지 않습니다.

앱 도메인이 변경되면 `docs/index.html`의 JavaScript, meta refresh, 링크를 함께 갱신합니다. 운영 GAS 연결 및 관리자 기능은 README의 Production 환경변수 설정을 별도로 완료해야 합니다.
