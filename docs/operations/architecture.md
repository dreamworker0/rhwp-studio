# rhwp-studio 아키텍처 개요

## 프로젝트 정체성

rhwp-studio 는 한글 문서(.hwp/.hwpx)를 **Google Drive 와 연동해 브라우저에서 열람·편집**하는 웹앱이다.

핵심 구분 하나를 먼저 잡아야 한다.

- **이 레포 = 호스트 앱.** 랜딩 페이지, Drive 연동, 인증, 저장을 담당하는 얇은 셸(`src/`, 약 1,400줄).
- **에디터 = 외부 산출물.** 업스트림 `@rhwp/editor` 빌드 결과가 `public/editor/` 에 들어 있고, 호스트 앱이 **iframe 으로 임베드**한다. HWP 파싱·렌더링·편집은 전부 그 안(WASM)에서 일어난다.

즉 이 레포는 "HWP 에디터"가 아니라 **"HWP 에디터를 Drive 에 붙이는 앱"** 이다.

| 항목 | 값 |
|------|-----|
| 프로젝트 ID | `rhwp-studio` |
| 프로덕션 URL | https://rhwp-studio.web.app |
| 에디터 경로 | `/editor/` (iframe 으로만 사용) |
| Google Cloud 프로젝트 번호 | `292079787292` |
| 함수 리전 | `asia-northeast3` |

## 런타임 구성

```
브라우저
├── 호스트 앱 (dist/ — Hosting)
│   └── iframe: /editor/index.html  ← @rhwp/editor + WASM
│        ▲ postMessage RPC
└── fetch
     ├── /api/**  → Hosting rewrite → Cloud Functions `api` (asia-northeast3)
     │                                  ├── Firestore (Admin SDK)
     │                                  ├── Secret Manager (GOOGLE_CLIENT_SECRET)
     │                                  └── oauth2.googleapis.com (토큰 교환)
     └── www.googleapis.com/drive/v3   ← 단기 액세스 토큰으로 직접 호출
```

Drive API 는 **브라우저가 직접** 호출한다. 백엔드는 토큰 발급만 담당하고 파일 바이트를 중계하지 않는다.

## 디렉터리 구조

```
src/                     ← 호스트 앱
  main.ts                ← 진입점. location.pathname 기반 라우팅
  pages/
    Home.ts              ← 랜딩
    DriveOpen.ts         ← 문서 열기·편집·저장 (핵심, 약 340줄)
    DriveNew.ts          ← 새 문서
    Terms.ts / Privacy.ts / Support.ts
  lib/
    auth.ts              ← 세션 기반 토큰 획득 (/api/drive-token)
    drive.ts             ← Drive API v3 (getFileMeta / downloadFile / uploadFile)
    editor-utils.ts      ← iframe RPC, 저장 리스너, 안내 토스트
    hwp-renderer.ts      ← @rhwp/core 직접 로드 → SVG (⚠️ 현재 미사용, 아래 참고)
    sentry.ts / analytics.ts
  components/ui.ts       ← 레이아웃·로딩·에러 화면 렌더
functions/index.js       ← 백엔드 전체 (단일 `api` 함수)
public/editor/           ← 에디터 빌드 산출물 (직접 수정 금지)
public/rhwp_bg.wasm      ← 호스트용 WASM (hwp-renderer 전용 → 현재 미사용)
firestore.rules          ← 클라이언트 접근 전면 차단
scripts/                 ← 빌드·배포·업스트림 갱신 도구
dist/                    ← 빌드 출력 (public/ 이 그대로 복사됨)
```

로컬 작업 경로는 레포 루트 `D:\apps\rhwp`. 에디터 소스(`temp_editor/`)는 gitignore 된 별도 클론이라 이 레포에 없다.

## 핵심 데이터 흐름

### 1. 인증 (서버 OAuth — authorization code + refresh token)

```
/api/auth/login
  → state(16B hex) 생성 → oauthStates/{state} 에 {ret, expireAt(10분)} 저장
  → accounts.google.com 으로 302
     access_type=offline, include_granted_scopes=true
     force=1 일 때만 prompt=consent select_account (기본은 무음)
     login_hint = Drive state.userId (계정 선택 건너뛰기)

/api/auth/callback
  → state 존재·10분 만료 검사 후 1회용 삭제
  → code ⇄ token 교환 (client_secret 은 Secret Manager)
  → id_token 의 sub 로 사용자 식별
  → refresh_token 이 왔으면 driveUsers/{sub} 에 merge 저장
  → sid(24B hex) 생성 → driveSessions/{sid} 저장 (60일)
  → __session 쿠키 발급 (HttpOnly, Secure, SameSite=Lax) → 원래 경로로 302

/api/drive-token
  → 쿠키 sid 형식 검증 → 세션 조회 → 서버측 60일 만료 재검사
  → driveUsers/{sub}.refreshToken 으로 액세스 토큰 발급
  → {access_token, expires_in} 반환 (Cache-Control: no-store)

/api/auth/logout
  → driveSessions/{sid} 삭제 + 쿠키 폐기
```

브라우저가 보유하는 것은 **HttpOnly `__session` 쿠키**와 **메모리에 캐시된 단기 액세스 토큰**뿐이다(`src/lib/auth.ts`, 만료 1분 전까지 재사용). `refresh_token` · `client_secret` 은 클라이언트에 존재하지 않는다.

⚠️ Firebase Hosting 은 `__session` 이름의 쿠키만 함수로 전달한다. 그래서 OAuth state 를 쿠키에 담지 못하고 **Firestore 에 저장**한다.

### 2. 문서 열기

```
/drive/open?state={"ids":["…"],"userId":"…"}   (Drive "Open with")
/drive/open?fileId=…                            (자체 링크)
  → getAccessToken()
       └ 401 → attemptReauth(): 무음 로그인 → 실패 시 동의 강제 → 2회 실패 시 수동 버튼
  → getFileMeta(fileId) ∥ downloadFile(fileId, onProgress)   ← 병렬
  → 확장자 검사 (hwp/hwpx 만)
  → capabilities.canEdit=false → 뷰어 모드(?mode=view, 저장 비활성)
  → createEditor(container, {studioUrl}) → iframe 생성
  → loadFileDirectly(iframe, bytes, name)  ← RPC, 아래 참고
  → GA: document_open {format, view_only}
```

자동 로그인 리다이렉트는 `sessionStorage` 의 `rhwp_auth_attempts` 로 **최대 2회**까지만 시도한다(무한 루프 방지).

### 3. 문서 저장 — 경로가 둘이다

**(a) 에디터발 저장** (에디터 안의 Ctrl+S·자동저장)

```
iframe → window: {type:'save'|'rhwp-save'|{action:'save'}, data:{buffer, filename, mimeType}}
  → setupSaveListener 가 수신 (origin 검사)
  → uploadFile(name, bytes, mime, fileId) → Drive PATCH
  → 상태바 "✔ 마지막 저장 HH:MM" / GA: document_save {trigger:'editor'}
```

**(b) 닫기 전 저장** (호스트의 "뒤로" 버튼)

```
confirm("변경 사항을 저장하시겠습니까?")
  → iframe 에 exportFile RPC (30초 타임아웃)
  → number[] → Uint8Array → uploadFile → Drive PATCH
  → 실패 시 confirm("그래도 닫으시겠습니까?")
```

**다운로드 버튼**은 WASM 재직렬화 결과가 아니라 **Drive 에서 받은 원본 바이트**를 그대로 내려준다(손상 방지). `showSaveFilePicker` 가 있으면 그걸 쓰고, 없으면 Blob URL 폴백.

호스트 앱에는 자동 저장 타이머가 없다. 주기 저장은 에디터 내부 기능이며 호스트에는 `save` 메시지로만 나타난다(메시지에 구분 정보가 없어 GA 에서는 Ctrl+S 와 함께 `trigger:'editor'` 로 집계된다).

## 에디터 iframe RPC 프로토콜

요청/응답 쌍으로 동작한다. 모든 메시지는 `location.origin` 으로만 보내고, 수신 시 `e.origin` 을 검사한다.

```js
// 호스트 → 에디터
{ type: 'rhwp-request', id: <고유값>, method: 'loadFile'|'exportFile'|'pageCount', params: {…} }
// 에디터 → 호스트
{ type: 'rhwp-response', id: <같은 값>, result?: any, error?: string }
```

에디터가 먼저 보내는 메시지도 있다 — 저장 요청(`save` / `rhwp-save` / `action:'save'`)과 변경 알림(`document-dirty`).

**`loadFileDirectly()` 의 방어 로직**(`src/lib/editor-utils.ts`) — 실제로 겪은 실패들을 흡수한다.

| 장치 | 값 | 이유 |
|---|---|---|
| 타임아웃 | 60초 | |
| 재시도 | 5회 (2초 간격) | WASM 초기화 전 요청이 `wbindgen`/`not initialized` 로 실패 |
| `pageCount` 폴링 폴백 | 1.5초 후 시작, 2초 주기 | `loadFile` **응답이 유실**돼도 문서는 실제로 로드된 경우가 있음 → 페이지 수로 성공을 확인 |

핸드셰이크를 진단하려면 콘솔에서 `localStorage.setItem('rhwp_debug_load','1')`.

## 데이터 저장소 (Firestore)

| 컬렉션 | 문서 ID | 필드 | 수명 |
|---|---|---|---|
| `oauthStates` | state (32자 hex) | `ret`, `createdAt`, `expireAt` | 10분, 사용 즉시 삭제 |
| `driveSessions` | sid (48자 hex) | `sub`, `createdAt`, `expireAt` | 60일 |
| `driveUsers` | OAuth `sub` | `refreshToken`, `updatedAt` | 로그아웃·폐기 전까지 |

만료 문서는 `expireAt` 기반 Firestore TTL 정책으로 자동 정리된다. 문서 ID 는 사용 전에 hex 길이·문자셋을 검증해 잘못된 경로 접근과 500 을 막는다.

`firestore.rules` 는 `allow read, write: if false` — **클라이언트 직접 접근 전면 차단**. 접근 경로는 Admin SDK(함수)뿐이다.

## OAuth 설정

| 항목 | 값 |
|------|-----|
| Client ID | `292079787292-qmjcruc73ogvoffnf63f28nj7ov30csn.apps.googleusercontent.com` (공개 값) |
| Client Secret | Secret Manager `GOOGLE_CLIENT_SECRET` |
| Redirect URI | `https://rhwp-studio.web.app/api/auth/callback` |
| Flow | Authorization code + refresh token (`access_type=offline`) |
| Scope | `openid`, `email`, `drive.file`, `drive.install` |
| 세션 | HttpOnly `__session` 쿠키 60일 + 서버측 만료 재검사 |
| 액세스 토큰 | 응답 즉시 메모리 캐시(만료 1분 전까지). 영속 저장 없음 |

`drive.file` 스코프라 **사용자가 이 앱으로 연 파일에만** 접근한다. 드라이브 전체 열람 권한은 요청하지 않는다.

## 관측·계측

- **Sentry** — 에러만. PII 미수집(`sendDefaultPii:false`), OAuth 민감 파라미터(`code`/`state`/`token`/…)는 `[redacted]` 로 치환. 함수 쪽은 라우트 경로만 태그로 남기고 종료 전 `flush(2000)`.
- **GA4** — 익명 이벤트만: `document_open`, `document_save`, `document_close`, `document_open_error`. **파일명·식별자는 절대 싣지 않는다.** 오류 사유도 `timeout`/`invalid_format`/`other` 로 뭉뚱그린다.
- 콘솔 프리픽스: 프론트 `[DriveOpen]`, `[Download]`, `[loadFile]`, `[drive]` / 함수 `[api]`, `[callback]`, `[drive-token]`.

## 알려진 제약

1. **`@rhwp/core`·`@rhwp/editor` 0.7.3 고정** — 0.8.x 는 텍스트 배치 회귀로 보류. [`../rhwp-0.8-regression.md`](../rhwp-0.8-regression.md)
2. **COEP/COOP 헤더 필수** — WASM 과 `/editor/**` 에 `require-corp` · `same-origin` 이 없으면 에디터가 뜨지 않는다.
3. **`/api/**` rewrite 순서** — `firebase.json` 에서 SPA fallback(`**`)보다 앞에 있어야 한다.
4. **함수는 CI 가 배포하지 않는다** — 수동 배포 필수. [deployment.md](./deployment.md)
5. **Drive "Open with" 첫 계정선택 팝업은 제거 불가** — 앱은 `/drive/open?state=…` 로 실행만 된다.
6. **HWPX 편집** — 지원하지만 재직렬화 시 구조는 보존해도 시각 충실도는 보장되지 않는다. 첫 편집 시 사본 편집을 권하는 안내 토스트가 1회 뜬다.
7. **`hwp-renderer.ts` 는 현재 어디서도 import 되지 않는다.** `@rhwp/core` 를 직접 로드해 SVG 로 렌더하는 모듈인데(호스트 자체 미리보기용으로 보인다), 지금 미리보기는 뷰어 모드 iframe(`?mode=view`)이 담당한다. `public/rhwp_bg.wasm` 도 이 모듈 전용이다. 되살릴 계획이 없다면 정리 후보.
