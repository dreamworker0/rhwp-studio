# rhwp-studio 운영 지침서

> 이 문서는 참고용 운영 문서다. Claude Code 스킬로 등록돼 있지는 않다(스킬은 `.claude/skills/` 에 둬야 한다).
> 실행 절차는 `/deploy`(`.claude/commands/deploy.md`)와 `/editor-update`(`.claude/commands/editor-update.md`)가 정본이고,
> 프로젝트 규칙 요약은 루트 `CLAUDE.md` 에 있다.

## 이 레포가 무엇인가

rhwp-studio 는 **한글 문서(.hwp/.hwpx)를 Google Drive 와 연동해 열람·편집하는 웹앱**이다.

중요한 구분:

- **이 레포 = 호스트 앱** — 랜딩 페이지, Drive 연동, 인증, 에디터를 감싸는 셸(`src/`).
- **에디터 = 외부 산출물** — 업스트림 `@rhwp/editor` 를 빌드한 결과가 `public/editor/` 에 들어 있고, 호스트 앱이 **iframe 으로 임베드**한다. 에디터 소스는 이 레포에 없다(`temp_editor/`, gitignore, 로컬 전용).

`public/editor/` 를 직접 수정하지 않는다. 갱신은 `/editor-update` 절차로만.

## 프로젝트 구조

```
src/                     ← 호스트 앱 (Vite + TypeScript strict)
  main.ts                ← 진입점. location.pathname 기반 라우팅
  pages/                 ← Home, DriveOpen, DriveNew, Terms, Privacy, Support
  lib/
    auth.ts              ← Drive 인증 클라이언트 (/api/* 호출)
    drive.ts             ← Drive API v3 헬퍼
    editor-utils.ts      ← 에디터 iframe 브릿지 (postMessage)
    hwp-renderer.ts      ← @rhwp/core 직접 로드 → SVG (⚠️ 현재 미사용)
    sentry.ts            ← 에러 추적(민감 파라미터 스크럽)
    analytics.ts         ← GA4
  components/ui.ts
functions/index.js       ← 백엔드. 단일 `api` 함수가 req.path 로 라우팅
public/editor/           ← 에디터 빌드 산출물 (직접 수정 금지)
public/rhwp_bg.wasm      ← 호스트 앱 미리보기용 WASM
scripts/                 ← 빌드·배포·업스트림 갱신 도구
dist/                    ← 빌드 출력 (public/ 이 그대로 복사됨 → dist/editor/)
```

로컬 작업 경로는 레포 루트 `D:\apps\rhwp` 다. 모든 npm 명령은 루트에서 실행한다.

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프론트 | Vite + TypeScript(strict), 빌드 출력 `dist/` |
| 에디터 | `@rhwp/editor` **0.7.3 고정** — iframe 임베드 |
| 핵심 엔진 | `@rhwp/core` **0.7.3 고정** (Rust → WASM) |
| 인증 | **서버 기반 OAuth — authorization code + refresh token** |
| 스토리지 | Google Drive API v3 |
| 백엔드 | Firebase Functions 2세대, 리전 `asia-northeast3` |
| 배포 | Hosting(CI 자동) + Functions(수동) — [deployment.md](./deployment.md) |
| 검증 | `npm run build` (테스트·린트 스크립트 없음), `npm run smoke`(로컬) |
| 에러 추적 | Sentry (프론트 `@sentry/browser`, 함수 `@sentry/node`) |

⚠️ `@rhwp` 0.8.x 는 텍스트 배치 회귀로 **보류 중**이니 올리지 말 것 → [`../rhwp-0.8-regression.md`](../rhwp-0.8-regression.md)

## 인증 흐름

브라우저 implicit flow 가 아니다. **토큰 발급은 전적으로 백엔드가 한다.**

```
1) /api/auth/login     → Google 동의 화면으로 리다이렉트 (code flow, offline)
2) /api/auth/callback  → code ⇄ access/refresh token 교환,
                         refresh_token 을 Firestore 에 사용자별 저장,
                         불투명 세션 ID 를 HttpOnly 쿠키로 발급
3) /api/drive-token    → 세션 쿠키 → 단기 액세스 토큰 발급/반환
4) /api/auth/logout    → 세션·refresh_token 폐기
```

- 브라우저에 있는 것은 **HttpOnly `__session` 쿠키(60일)** 와 **메모리에 캐시된 단기 액세스 토큰**뿐이다(`src/lib/auth.ts` 의 `cached`, 만료 1분 전까지 재사용). `sessionStorage` 에 토큰을 두지 않는다.
- `refresh_token` · `client_secret` 은 클라이언트로 절대 나가지 않는다. `client_secret` 은 Secret Manager 에 있다.
- ⚠️ **Firebase Hosting 은 `__session` 이름의 쿠키만 함수로 전달한다.** 다른 이름은 CDN 캐싱 때문에 제거되므로 쓸 수 없다.
- Firestore(`driveUsers/{sub}`, `driveSessions/{sid}`, `oauthStates`)는 Admin SDK 로만 접근한다. 규칙상 클라이언트 직접 접근은 전면 차단(`allow read, write: if false`).
- Drive "Open with" 실행 시 뜨는 첫 Google 계정선택 팝업은 제거할 수 없다(앱은 `/drive/open?state=…` URL 로 실행만 됨).

## 에디터 iframe 브릿지

호스트 앱과 에디터는 `postMessage` **RPC** 로 통신한다(`src/lib/editor-utils.ts`, `src/pages/DriveOpen.ts`).

```js
// 호스트 → 에디터
{ type: 'rhwp-request',  id: <고유값>, method: 'loadFile'|'exportFile'|'pageCount', params: {…} }
// 에디터 → 호스트
{ type: 'rhwp-response', id: <같은 값>, result?: any, error?: string }
```

에디터가 먼저 보내는 메시지도 있다 — 저장 요청(`save` / `rhwp-save` / `action:'save'`)과 변경 알림(`document-dirty`). 모든 메시지는 `location.origin` 으로만 보내고 수신 시 `e.origin` 을 검사한다.

`loadFile` 에는 재시도 5회·`pageCount` 폴링 폴백이 붙어 있다(WASM 초기화 지연과 응답 유실 대응). 자세한 값은 [architecture.md](./architecture.md#에디터-iframe-rpc-프로토콜) 참고.

읽기 전용 권한이면 `/editor/index.html?mode=view` 로 띄운다(메뉴바·툴바 숨김 — `scripts/post-build.js` 가 주입한 스크립트가 처리).

## 핵심 명령어

모두 **레포 루트**에서 실행한다.

```bash
npm run dev              # 개발 서버 → https://localhost:5173 (mkcert HTTPS)
npm run build            # tsc + vite → dist/
npm run smoke            # 에디터 스모크 테스트 (로컬 전용)
node --check functions/index.js

npm run upstream:check   # 업스트림 에디터 변경 확인   ┐
npm run upstream:update  # 에디터 재생성               ├ 로컬 전용
npm run verify:custom    # 커스텀 패치 유지 확인       │ (/editor-update)
npm run sync:wasm        # pkg/ WASM 을 @rhwp/core 버전에 맞춤 ┘
```

`npm run smoke` 는 `temp_editor/` 의 puppeteer-core 와 Chrome/Edge 를 쓰므로 **클라우드 세션에서는 돌지 않는다**. 검증 항목은 에디터 부팅·`loadFile` ack·pageCount·HWPX 왕복·웹폰트 무결성이다.

## 운영 워크플로우

### 기능 추가·수정

```
1) npm run dev 로 개발 서버 실행 → 브라우저에서 수동 확인
2) npm run build 통과 확인 (유일한 자동 검증 수단)
3) 함수를 고쳤으면 node --check functions/index.js
4) npm run smoke (에디터 동작에 영향이 있는 변경일 때)
5) 커밋 → master 푸시 시 CI 가 Hosting 자동 배포
6) 함수를 고쳤으면 로컬에서 firebase deploy --only functions (CI 가 안 함)
```

### 에디터·WASM 갱신

`/editor-update` 절차를 따른다. 요점: `temp_editor/` 는 별도 git repo이므로 **재생성 전에 거기 미커밋 변경을 먼저 커밋**해야 rebase 때 유실되지 않는다. `sync:wasm` 이 JS 와 WASM 버전을 맞춘다 — JS 만 갱신하면 "JS 신버전 / WASM 구버전" 불일치로 저장이 깨진 전례가 있다(0.7.3→0.7.17).

### 롤백

[deployment.md 의 롤백 절](./deployment.md#롤백) 참고. Hosting 은 Console 에서 원클릭이지만 **함수는 원클릭 롤백이 없다** — 이전 커밋에서 재배포해야 한다.

### Drive 연동 디버깅

```
1) 로그인 자체가 안 됨
   - redirect_uri_mismatch → GCP Console 에 /api/auth/callback 등록 확인
   - 콜백에서 500 → 함수 로그 확인. GOOGLE_CLIENT_SECRET 접근 권한 의심
2) 로그인은 되는데 파일 접근 실패
   - /api/drive-token 401 → 세션 만료·폐기. 재로그인 필요(NotAuthenticatedError)
   - 쿠키가 함수까지 안 옴 → 쿠키 이름이 __session 인지 확인
   - Drive 404 → fileId 유효성 / 공유 권한
3) 배포 후 API 만 깨짐
   - firebase.json 에서 /api/** rewrite 가 SPA fallback(**)보다 앞인지 확인
   - 함수만 옛 코드일 가능성 — CI 는 Hosting 만 배포한다
```

## 주의 사항

> [!CAUTION]
> **COEP/COOP 헤더**: WASM 과 `/editor/**` 에 `Cross-Origin-Embedder-Policy: require-corp` · `Cross-Origin-Opener-Policy: same-origin` 이 필수다. `firebase.json` 수정 시 깨뜨리지 말 것.

> [!IMPORTANT]
> **`public/editor/` 직접 수정 금지.** 빌드 산출물이라 다음 `upstream:update` 에서 덮어써진다.

> [!IMPORTANT]
> **`@rhwp/core` · `@rhwp/editor` 는 0.7.3 고정.** 올리기 전에 `node scripts/rhwp-version-diff.mjs <문서.hwp> 1 --b=<새버전dir>` 로 숫자 확인 필수.

> [!WARNING]
> **HWPX 편집**: 지원하지만 재직렬화 시 구조는 보존해도 시각 충실도는 보장되지 않는다. 첫 편집 시 사본 편집을 권하는 안내 토스트가 1회 뜬다(`showHwpxEditToastIfNeeded()`).

> [!WARNING]
> **이 레포는 퍼블릭이다.** 이슈·PR 코멘트 등 외부인이 쓸 수 있는 텍스트를 배포·시크릿·권한 변경의 근거로 삼지 않는다. 배포는 사용자의 직접 지시 + 명시적 승인으로만.

## 모니터링

**콘솔 로그 프리픽스** — 프론트 `[drive]`, `[hwp-renderer]` / 함수 `[api]`.

**Sentry** — 에러만 수집한다(트레이싱·리플레이 off, 무료 쿼터 절약). PII 미수집(`sendDefaultPii: false`)이라 쿠키·IP·헤더를 보내지 않고, OAuth 민감 파라미터(`code`, `state`, `token`, `access_token`, `refresh_token`, `id_token`)는 URL·브레드크럼에서 `[redacted]` 로 치환한 뒤 전송한다. DSN 미설정이면 전체 비활성이므로 로컬·CI 에서 안전하다. 함수 쪽은 서버리스 종료 전 `Sentry.flush(2000)` 로 전송을 보장한다.

**콘솔**
- Hosting: https://console.firebase.google.com/project/rhwp-studio/hosting
- Functions(로그): https://console.firebase.google.com/project/rhwp-studio/functions
