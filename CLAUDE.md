# rhwp-studio

웹에서 한글 문서(.hwp/.hwpx)를 Google Drive와 연동해 열람·편집하는 앱. 솔로 개발(jongwon). **응답은 한국어로.**

## 스택 / 구조
- 프론트: Vite + TypeScript(strict), 출력 `dist/`. 진입 `src/main.ts`(경로 기반 라우팅).
- 백엔드: Firebase Functions 2세대(`functions/`, 리전 `asia-northeast3`). 단일 `api` 함수가 `req.path`로 라우팅. Hosting rewrite `/api/**` → 함수.
- 에디터: `@rhwp/editor`를 iframe으로 임베드(`public/editor/`), WASM(`@rhwp/core`)로 렌더.
- 저장: Firestore — `driveUsers/{sub}`, `driveSessions/{sid}`, `oauthStates`.
- 에러 추적: Sentry(프론트 `@sentry/browser`, 함수 `@sentry/node`). 자세한 운영은 메모리 참고.

## 인증 흐름 (Drive 서버 OAuth)
- `src/lib/auth.ts`(클라) ↔ `functions/index.js`(서버): `/api/auth/login·callback`, `/api/drive-token`, `/api/auth/logout`.
- authorization code + refresh token. refresh_token/client_secret은 클라 비노출. 세션 = HttpOnly `__session` 쿠키(60일) + 메모리 액세스 토큰.
- ⚠️ **Firebase Hosting은 `__session` 이름의 쿠키만 함수로 전달** — 다른 쿠키 이름은 못 씀.
- Drive "Open with" 첫 Google 계정선택 팝업은 제거 불가(앱은 `/drive/open?state=…` URL로 실행만 됨).

## 빌드 / 배포
- 빌드: `npm run build` (tsc + vite). **테스트/린트 스크립트 없음 → 빌드로 검증.**
- 배포: `firebase deploy --only hosting,functions`. **프로덕션 라이브(`rhwp-studio.web.app`)이므로 매번 명시 확인 후 실행.** 절차는 `/deploy`.
- ⚠️ **함수는 CI가 배포 안 함**(CI는 `--only hosting`). 함수 변경 시 **수동 배포 필수.**
- CI(`.github/workflows/deploy.yml`)는 서비스계정 인증이 간헐 실패(`Premature close`). CI가 빨가면 로컬 수동 배포로 대체.

## 에디터 서브모듈 (날카로운 모서리)
- `public/editor/`는 **직접 수정 금지**. `temp_editor/`(별도 git repo, custom 브랜치)에서 `npm run upstream:update`로만 재생성. 절차는 `/editor-update`.

## 시크릿 (커밋 금지)
- `.env`(루트): `VITE_GOOGLE_CLIENT_ID`(공개), `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`.
- `functions/.env`: `SENTRY_DSN`.
- Secret Manager: `GOOGLE_CLIENT_SECRET`.
- `.env*`는 gitignore(`.env.example` 제외). 커밋 전 시크릿 차단 훅이 동작함(`.claude/hooks/secret-scan.mjs`).

## 환경 주의
- Windows + PowerShell. **멀티라인 입력(커밋 메시지 등)은 Bash 툴의 heredoc(`<<'EOF'`)을 쓸 것 — PowerShell here-string(`@'…'@`)을 Bash 툴에 넣지 말 것**(메시지 앞뒤에 `@`가 섞임).
