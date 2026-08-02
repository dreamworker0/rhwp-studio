# rhwp-studio 트러블슈팅 가이드

> 이 문서는 **호스트 앱**(`src/`, `functions/`) 기준이다. 에디터 내부 동작은 업스트림 `@rhwp/editor` 소관이라
> 여기서 다루지 않는다. 구조는 [architecture.md](../architecture.md) 참고.

## WASM 관련

### LinkError / CompileError
**증상**: `LinkError: WebAssembly.instantiate(): Import #0 module="__wbindgen_malloc" error`
**원인**: 에디터 번들의 `rhwp.js` 와 `rhwp_bg.wasm` 이 서로 다른 빌드에서 옴 (JS 만 갱신되고 WASM 은 구버전인 상태)
**해결**: `public/editor/` 를 손으로 고치지 말고 재생성한다.
```bash
npm run sync:wasm      # pkg/ WASM 을 @rhwp/core 버전에 맞춤
npm run upstream:update # 에디터 재생성 (= /editor-update 절차)
npm run build
```
로컬 전용이다(`temp_editor/` 필요). 실제로 0.7.3 → 0.7.17 갱신 때 이 불일치로 저장이 깨졌다.

### 에디터 초기화 대기 후 실패
**증상**: 콘솔에 `[DriveOpen] WASM 초기화 대기 중... (5/5)` → `WASM 초기화 시간 초과 — 에디터를 로드할 수 없습니다.`
**원인**: `loadFile` RPC 가 WASM 초기화 완료 전에 도달해 계속 실패 (`wbindgen` / `not initialized` 계열 에러로 5회 재시도 후 포기)
**해결**:
1. 페이지 새로고침
2. 네트워크에서 `/editor/` 하위 자원이 정상 응답하는지 확인 (특히 `.wasm` 이 HTML 로 응답되지 않는지)
3. 핸드셰이크 진단: 콘솔에서 `localStorage.setItem('rhwp_debug_load','1')` 후 재시도 → `[loadFile]` 타임라인 로그 확인

### WASM RuntimeError (unreachable/memory)
**증상**: 에디터 사용 중 갑자기 크래시
**원인**: WASM 내부 패닉 (Rust panic → unreachable)
**해결**: 페이지 새로고침. 재현 가능하면 해당 문서와 조작 순서를 기록해 둘 것 — 업스트림 이슈 재현에 필요하다.

---

## Google Drive 관련

### redirect_uri_mismatch
**증상**: 로그인 리다이렉트 중 `redirect_uri_mismatch`
**원인**: 서버 OAuth(authorization code) 방식이라 **승인된 리디렉션 URI** 가 정확히 일치해야 한다. (구버전 문서에 있던 "승인된 JavaScript 원본"은 implicit flow 시절 이야기다.)
**해결**: Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID → **승인된 리디렉션 URI** 에 아래가 등록돼 있는지 확인.
```
https://rhwp-studio.web.app/api/auth/callback
```
로컬 개발 서버(`https://localhost:5173`)에는 콜백 엔드포인트가 없다. 로그인 흐름 검증은 프로덕션에서 한다.

### 401 — 로그인이 풀림
**증상**: `/api/drive-token` 이 401. 응답 본문의 `error` 로 원인이 갈린다.

| `error` | 의미 |
|---|---|
| `no_session` / `invalid_session` | 쿠키가 없거나 세션 문서가 사라짐 |
| `session_expired` | 60일 초과 (서버측 만료 검사) |
| `no_refresh_token` | 사용자 문서에 refresh token 없음 |
| `refresh_failed` | refresh token 폐기·만료 → 재동의 필요 |

**자동 처리**: `getAccessToken()` 이 `NotAuthenticatedError` 를 던지면 `attemptReauth()` 가 무음 로그인을 시도하고, 안 되면 동의를 강제한다. **최대 2회**까지만 자동 시도하고(`sessionStorage` 의 `rhwp_auth_attempts`) 이후에는 수동 버튼으로 폴백한다.
**수동 해결**: `/api/auth/logout` 호출 후 다시 로그인. 그래도 안 되면 Google 계정의 앱 권한을 해제하고 재동의해 refresh token 을 새로 받는다.

**쿠키가 함수까지 도달하지 않는 경우**: 세션 쿠키 이름이 `__session` 인지 확인한다. Firebase Hosting 은 CDN 캐싱 때문에 그 이름 외의 쿠키를 함수로 전달하지 않는다.

### Drive 저장 실패
**증상**: 에디터발 저장 실패 시 `구글 드라이브 업로드에 실패했습니다.` 알림 + 상태바 `❌ 저장 실패`. 닫기 전 저장 실패 시에는 `저장에 실패했습니다. 그래도 닫으시겠습니까?` 확인창.
**확인 순서**:
1. 토큰 문제인지 (위 401 항목)
2. 파일 권한 — `capabilities.canEdit` 이 false 면 애초에 뷰어 모드로 열린다
3. Drive 5xx 면 잠시 후 재시도

> [!WARNING]
> **"다운로드" 버튼은 편집 내용을 저장하지 않는다.** 이 버튼은 WASM 재직렬화 결과가 아니라 **Drive 에서 받은 원본 바이트**를 그대로 내려준다(재직렬화 손상 방지). 저장 실패 시 편집 내용을 건지는 수단으로 쓸 수 없다.

---

## Firebase Hosting 관련

### WASM MIME 타입 에러
**증상**: `Incorrect response MIME type. Expected 'application/wasm'`
**원인**: `.wasm` 응답의 `Content-Type` 이 `application/wasm` 이 아님 (SPA fallback 에 걸려 HTML 이 반환되는 경우 포함)
**해결**: `firebase.json` 의 WASM 헤더 규칙 확인.
```json
{
  "source": "**/*.wasm",
  "headers": [{ "key": "Content-Type", "value": "application/wasm" }]
}
```

### COEP/COOP 헤더 누락
**증상**: 에디터 iframe 이 뜨지 않거나 `SharedArrayBuffer is not defined`
**원인**: `Cross-Origin-Embedder-Policy: require-corp` · `Cross-Origin-Opener-Policy: same-origin` 누락
**해결**: `firebase.json` 의 `**/*.wasm` 과 `/editor/**` 헤더에 둘 다 있는지 확인. 배포 후에는 실제 응답 헤더로 확인할 것 — 설정만 보고 판단하지 않는다.

### 배포했는데 API 만 옛 동작
**증상**: 프론트는 새 코드인데 `/api/**` 응답이 그대로
**원인**: **CI 는 Hosting 만 배포한다.** 함수는 수동 배포해야 한다.
**해결**: 로컬에서 `firebase deploy --only functions`. 자세한 내용은 [deployment.md](../deployment.md).

### /api 요청이 index.html 을 받음
**원인**: `firebase.json` 에서 `/api/**` rewrite 가 SPA fallback(`**`)보다 뒤에 있음
**해결**: rewrite 순서를 `/api/**` → `/editor/**` → `**` 로 유지.

---

## 빌드 관련

### TypeScript 빌드 에러
**증상**: `npm run build` → `tsc` 에러
**일반 패턴**:
- `Uint8Array` ↔ `BlobPart` 비호환 → `.buffer as ArrayBuffer` 캐스팅
- `strict` 모드라 `null`/`undefined` 처리가 빠지면 바로 실패한다

테스트·린트 스크립트가 없으므로 **빌드가 유일한 자동 검증 수단**이다.

### Vite 빌드 청크 크기 경고
**증상**: `Some chunks are larger than 500 kB after minification`
**원인**: 에디터·WASM 관련 코드가 큰 단일 청크로 번들링됨
**해결**: 무시해도 된다.
