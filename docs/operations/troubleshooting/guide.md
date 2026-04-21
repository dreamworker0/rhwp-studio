# rhwp-studio 트러블슈팅 가이드

## WASM 관련

### LinkError / CompileError
**증상**: `LinkError: WebAssembly.instantiate(): Import #0 module="__wbindgen_malloc" error`
**원인**: `public/rhwp.js`와 `public/rhwp_bg.wasm`이 서로 다른 빌드에서 옴
**해결**:
```bash
# pkg/ 폴더에서 최신 파일을 public/으로 복사
cp d:\apps\rhwp\temp_editor\pkg\rhwp.js d:\apps\rhwp\temp_editor\rhwp-studio\public\
cp d:\apps\rhwp\temp_editor\pkg\rhwp_bg.wasm d:\apps\rhwp\temp_editor\rhwp-studio\public\
npm run build
```

### WASM 초기화 재시도 후에도 실패
**증상**: 콘솔에 `[WasmBridge] WASM 초기화 실패 (시도 3/3)` → 새로고침 토스트 표시
**원인**: 네트워크 차단, 브라우저 WASM 미지원, 또는 WASM 파일 손상
**해결**:
1. 네트워크 연결 확인
2. 브라우저 호환성 확인 (Chrome 89+, Firefox 79+, Safari 15+)
3. public/ 폴더의 WASM 파일 재배치

### WASM RuntimeError (unreachable/memory)
**증상**: 에디터 사용 중 갑자기 크래시 → 새로고침 토스트
**원인**: WASM 내부 패닉 (Rust panic → unreachable)
**해결**: 페이지 새로고침. 재현 가능하면 해당 HWP 파일과 조작 순서를 기록.

---

## Google Drive 관련

### redirect_uri_mismatch
**증상**: OAuth 팝업에서 `redirect_uri_mismatch` 에러
**원인**: 현재 도메인이 Google Cloud Console의 승인된 JavaScript 원본에 등록되지 않음
**해결**:
1. Google Cloud Console → API & Services → Credentials
2. OAuth 2.0 Client ID 선택
3. "승인된 JavaScript 원본"에 현재 도메인 추가
   - 로컬: `http://localhost:7700`
   - 프로덕션: `https://rhwp-studio.web.app`

### 401 Unauthorized (토큰 만료)
**증상**: Drive 작업 시 401 에러 → 자동 재시도
**처리**: `fetchWithRetry()`가 자동으로:
1. `clearToken()` → 세션 토큰 제거
2. `ensureAuth()` → 재인증
3. 새 토큰으로 재시도
**수동 해결**: sessionStorage에서 `rhwp_drive_token*` 삭제 후 새로고침

### Drive 저장 실패 → 로컬 다운로드
**증상**: Drive PATCH 실패 시 confirm 다이얼로그 표시
**처리**: 사용자가 "확인" 선택 시 로컬 Blob URL 다운로드 실행
**주의**: 로컬 다운로드는 편집 내용을 보존하는 최후의 수단

---

## Firebase Hosting 관련

### WASM MIME 타입 에러
**증상**: `Refused to compile or instantiate WebAssembly module because neither 'wasm-eval' nor 'wasm-unsafe-eval' is an allowed source`
**원인**: `Content-Type` 헤더가 `application/wasm`이 아님
**해결**: `firebase.json`에 WASM 헤더 규칙 확인:
```json
{
  "source": "**/*.wasm",
  "headers": [{ "key": "Content-Type", "value": "application/wasm" }]
}
```

### SharedArrayBuffer 사용 불가
**증상**: `SharedArrayBuffer is not defined` 또는 WASM 스레딩 관련 에러
**원인**: `COEP`/`COOP` 헤더 누락
**해결**: firebase.json `/editor/**` 헤더에 COEP/COOP 존재 확인

---

## 빌드 관련

### TypeScript 빌드 에러
**증상**: `npm run build` → `tsc` 에러
**일반 패턴**:
- `Uint8Array` ↔ `BlobPart` 비호환 → `.buffer as ArrayBuffer` 캐스팅
- import 경로 오류 → `@/` 별칭이 `src/` 매핑 확인 (`vite.config.ts`)
- WASM 타입 누락 → `../pkg/rhwp.d.ts` 존재 확인

### Vite 빌드 청크 크기 경고
**증상**: `Some chunks are larger than 500 kB after minification`
**원인**: WASM 브릿지 코드가 큰 단일 청크로 번들링됨
**해결**: 현재는 무시해도 됨 (WASM 에디터 특성상 코드 분할이 의미 없음)

---

## 네트워크 관련

### 오프라인 배너가 사라지지 않음
**증상**: 네트워크 복구 후에도 빨간 배너 유지
**원인**: `online` 이벤트가 발생하지 않는 환경 (일부 프록시/VPN)
**해결**: 페이지 새로고침

### 자동 저장 스킵 (오프라인)
**증상**: 콘솔에 `[auto-save] 오프라인 — 스킵`
**정상 동작**: 오프라인 시 자동 저장을 건너뜀. 온라인 복구 후 다음 주기에 저장 시도.
