# rhwp-studio 프로젝트 룰

이 프로젝트에서 작업할 때 반드시 따라야 하는 규칙입니다.

---

## 1. WASM 파일 동기화 규칙

- `public/rhwp.js`와 `public/rhwp_bg.wasm`은 **항상** `../pkg/`의 파일과 동일해야 합니다.
- WASM 파일을 수정하면 **반드시** 양쪽 모두 업데이트합니다.
- 불일치 시 `LinkError`가 발생하므로, 빌드 전 동기화 여부를 확인합니다.

## 2. 빌드 규칙

- 코드 수정 후에는 **반드시** `npm run build` (`tsc && vite build`)를 실행하여 타입 에러가 없는지 확인합니다.
- 빌드 출력은 `dist/editor/`로 생성됩니다. 이 경로를 변경하지 마세요.
- WASM 파일은 인라인하지 않습니다 (`assetsInlineLimit: 0`).

## 3. 배포 규칙

- 배포 전 체크리스트:
  1. `npm run build` 성공
  2. `dist/editor/` 내 WASM 파일 존재 확인
  3. `firebase.json` CORS 헤더(COEP/COOP) 유지 확인
- 배포 명령: `cd d:\apps\rhwp && firebase deploy --only hosting`
- 긴급 롤백: Firebase Console → Hosting → Release history → Rollback

## 4. Google Drive 연동 규칙

- OAuth Client ID를 코드에 하드코딩하지 않습니다 (현재 `drive-auth.ts`에 상수로 관리).
- 토큰은 `sessionStorage`에만 저장합니다. `localStorage`를 사용하지 마세요.
- Drive API 호출 시 **반드시** `fetchWithRetry()`를 사용합니다 (401/5xx 자동 재시도).

## 5. 에러 핸들링 규칙

- 사용자에게 `alert()`을 사용하지 않습니다. **반드시** `showToast()`를 사용합니다.
- WASM 관련 에러는 `[WasmBridge]` 프리픽스로 콘솔 로그를 남깁니다.
- 저장 실패 시 **반드시** 로컬 다운로드 fallback을 제공합니다.
- 전역 에러 핸들러(`window.onerror`)를 제거하거나 비활성화하지 마세요.

## 6. UI 규칙

- 새 다이얼로그를 만들 때는 `ui/dialog.ts`의 기본 다이얼로그 클래스를 확장합니다.
- CSS는 `src/styles/` 폴더에 모듈별로 분리하고, `style.css`에서 import합니다.
- 로딩이 필요한 비동기 작업은 `LoadingOverlay`를 표시합니다.

## 7. 테스트 규칙

- 새 기능 추가 시 관련 E2E 테스트를 `e2e/` 폴더에 작성합니다.
- 테스트는 `helpers.mjs`의 유틸리티를 사용합니다.
- 배포 전 최소 `node e2e/text-flow.test.mjs`를 실행합니다.

## 8. 코드 스타일 규칙

- 콘솔 로그에는 모듈명 프리픽스를 붙입니다: `[ModuleName] message`
- 비동기 함수는 `async/await`를 사용합니다 (`.then()` 체인 사용 금지).
- 타입은 `core/types.ts`에 정의하고 재사용합니다.

## 9. HWPX 제약 규칙

- HWPX 출처 문서의 저장은 비활성화 상태입니다 (#197 완료 시까지).
- HWPX 관련 코드를 수정할 때는 `notifyHwpxBetaIfNeeded()` 함수를 유지합니다.
- HWPX 저장을 활성화하려면 반드시 #197 이슈를 먼저 해결하세요.
