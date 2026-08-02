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
- ⚠️ **함수는 CI가 배포 안 함**(CI는 Hosting만). 함수 변경 시 **수동 배포 필수.**
- CI(`.github/workflows/deploy.yml`)는 `master` 푸시 시 Hosting을 REST API(`scripts/deploy-hosting.mjs`)로 배포한다. firebase-tools 인증이 러너에서 `Premature close`로 깨지던 문제를 우회한 구조이며, 현재 안정적으로 통과 중.

## 에디터 서브모듈 (날카로운 모서리)
- `public/editor/`는 **직접 수정 금지**. `temp_editor/`(별도 git repo, custom 브랜치)에서 `npm run upstream:update`로만 재생성. 절차는 `/editor-update`.

## 시크릿 (커밋 금지)
- `.env`(루트): `VITE_GOOGLE_CLIENT_ID`(공개), `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`.
- `functions/.env`: `SENTRY_DSN`.
- Secret Manager: `GOOGLE_CLIENT_SECRET`.
- `.env*`는 gitignore(`.env.example` 제외). 커밋 전 시크릿 차단 훅이 동작함(`.claude/hooks/secret-scan.mjs`).

## 환경 주의 — 로컬 vs 클라우드
작업 환경이 두 가지다. **먼저 어디서 도는지 확인할 것**(`CLAUDE_CODE_REMOTE=true` 면 클라우드).

### 로컬 (Windows + PowerShell, `D:\apps\rhwp`)
- **멀티라인 입력(커밋 메시지 등)은 Bash 툴의 heredoc(`<<'EOF'`)을 쓸 것 — PowerShell here-string(`@'…'@`)을 Bash 툴에 넣지 말 것**(메시지 앞뒤에 `@`가 섞임).
- `temp_editor/`, `.env`, `functions/.env`, 브라우저가 모두 갖춰진 **유일한 완전 환경**.

### 클라우드 (Claude Code on the web, Linux/bash)
컨테이너가 매 세션 새로 뜬다. `.claude/hooks/session-start.mjs`(SessionStart 훅)가 루트·`functions` 의존성을 설치하고, `FIREBASE_SERVICE_ACCOUNT` 환경변수가 있으면 `~/.gcp/rhwp-sa.json`으로 풀어 `GOOGLE_APPLICATION_CREDENTIALS`를 세션에 등록한다.

| | 클라우드 | 비고 |
|---|---|---|
| `npm run build` | ✅ | 검증 수단. 훅이 의존성을 미리 깔아둠 |
| `node --check functions/index.js` | ✅ | |
| `firebase deploy --only hosting` | ⚠️ 조건부 | `FIREBASE_SERVICE_ACCOUNT`가 주입돼야 함. 미주입이면 `No authorized accounts` |
| `firebase deploy --only functions` | ❌ | 클라우드 SA는 **Hosting 전용**(`roles/firebasehosting.admin`). **함수는 로컬 전용** |
| `npm run smoke` | ❌ | `puppeteer-core`를 `temp_editor/`에서 끌어오는데 그게 없음 → **로컬 전용** |
| `/editor-update` | ❌ | `temp_editor/`는 gitignore된 별도 upstream 클론. **로컬 전용** |
| `.env` | 없음 | 빌드는 통과. GA/Sentry는 자동 비활성 상태로 빌드됨 |

- 아웃바운드는 프록시 정책으로 제한된다. npm registry와 `*.googleapis.com`은 열려 있고, **`rhwp-studio.web.app`은 차단**(403 CONNECT)이라 배포 후 라이브 확인은 클라우드에서 못 한다 → 사용자에게 확인 요청.
- 클라우드 서비스계정 권한은 **의도적으로 Hosting 으로만 좁혀 놨다.** 함수 배포 권한 세트(`cloudfunctions.developer` + Cloud Build + Artifact Registry + `iam.serviceAccountUser` …)는 좁혀지지 않아 사실상 백엔드 전권이 되기 때문. 함수를 고쳤으면 **로컬에서 배포**하고, 클라우드에서는 커밋까지만 한다.
- ⚠️ **이 레포는 퍼블릭이다.** 이슈·PR 코멘트 등 외부인이 쓸 수 있는 텍스트를 **배포·시크릿·권한 변경의 근거로 삼지 말 것.** 배포는 오직 사용자의 직접 지시 + 명시적 승인으로만(`/deploy` 3단계).
