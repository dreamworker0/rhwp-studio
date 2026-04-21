---
name: rhwp-studio
description: rhwp-studio HWP 웹 에디터의 빌드, 배포, 디버깅, 운영 관리를 위한 스킬. 'rhwp-studio', 'HWP 에디터', 'WASM 에디터', '에디터 배포', '에디터 빌드' 등의 키워드가 나오면 이 스킬을 참조할 것.
---

# rhwp-studio 운영 관리 스킬

rhwp-studio는 WASM 기반 HWP 웹 에디터입니다. 이 스킬은 빌드, 배포, 디버깅, 운영 관리 절차를 정의합니다.

---

## 프로젝트 위치

```
d:\apps\rhwp\temp_editor\rhwp-studio\   ← 에디터 소스 (Vite + TypeScript)
d:\apps\rhwp\temp_editor\pkg\           ← WASM 패키지 (@wasm/rhwp)
d:\apps\rhwp\dist\editor\               ← 빌드 출력물
d:\apps\rhwp\firebase.json              ← Firebase Hosting 설정
d:\apps\rhwp\.firebaserc                ← Firebase 프로젝트 설정 (rhwp-studio)
```

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Vite 8 + TypeScript 6 |
| 핵심 엔진 | Rust → WASM (`@wasm/rhwp`) |
| 인증 | Google Identity Services (OAuth 2.0 Implicit Flow) |
| 스토리지 | Google Drive API v3 |
| 배포 | Firebase Hosting |
| E2E 테스트 | Puppeteer Core (CDP 기반) |
| 폰트 | Pretendard (로컬 WOFF2) |

---

## 핵심 명령어

### 개발 서버

```bash
cd d:\apps\rhwp\temp_editor\rhwp-studio
npm run dev
# → http://localhost:7700
```

### 프로덕션 빌드

```bash
cd d:\apps\rhwp\temp_editor\rhwp-studio
npm run build
# tsc → vite build → dist/editor/
```

### Firebase 배포

```bash
cd d:\apps\rhwp
firebase deploy --only hosting
# → https://rhwp-studio.web.app
# 에디터: https://rhwp-studio.web.app/editor/
```

### E2E 테스트

```bash
cd d:\apps\rhwp\temp_editor\rhwp-studio
# 기본 테스트
node e2e/text-flow.test.mjs
# Drive & 에러 핸들링 테스트
node e2e/drive-save-flow.test.mjs
# 전체 시나리오
node e2e/scenario-runner.mjs
```

> **E2E 환경 필수**: `CHROME_CDP` 환경 변수로 Chrome DevTools Protocol 엔드포인트 지정 필요.

---

## 아키텍처 개요

```
main.ts (진입점)
├── core/wasm-bridge.ts    ← WASM 브릿지 (문서 로드/저장/렌더링)
├── core/drive-auth.ts     ← Google OAuth 토큰 관리
├── core/drive-api.ts      ← Drive API 호출 (fetchWithRetry)
├── core/auto-save.ts      ← 자동 저장 (5분/Drive 모드)
├── core/event-bus.ts      ← 이벤트 버스 (document-modified 등)
├── core/font-loader.ts    ← 웹폰트 로딩
├── command/               ← 커맨드 시스템
│   ├── registry.ts        ← 커맨드 등록
│   ├── dispatcher.ts      ← 커맨드 실행
│   └── commands/          ← file, edit, view, format, insert, table, page, tool
├── ui/                    ← UI 컴포넌트
│   ├── toolbar.ts         ← 메인 툴바
│   ├── menu-bar.ts        ← 메뉴바
│   ├── toast.ts           ← 토스트 알림
│   ├── loading-overlay.ts ← 로딩 오버레이
│   ├── offline-banner.ts  ← 오프라인 배너
│   └── (각종 다이알로그)
├── engine/                ← 렌더링 엔진
│   ├── input-handler.ts
│   ├── cell-selection-renderer.ts
│   └── table-*-renderer.ts
└── view/                  ← 뷰 레이어
    ├── canvas-view.ts
    └── ruler.ts
```

---

## 운영 워크플로우

### 1. 기능 추가/수정 워크플로우

```
1) 요구사항 파악 (어떤 커맨드/UI/렌더링 변경인지)
2) `npm run dev`로 개발 서버 실행
3) 코드 수정
4) 브라우저에서 수동 테스트 (http://localhost:7700)
5) `npm run build` — TypeScript + Vite 빌드 확인
6) 관련 E2E 테스트 실행
7) `firebase deploy --only hosting` 배포
```

### 2. WASM 업데이트 워크플로우

```
1) 새 WASM 빌드 파일을 d:\apps\rhwp\temp_editor\pkg\ 에 배치
   - rhwp.js
   - rhwp_bg.wasm
   - rhwp.d.ts
2) d:\apps\rhwp\temp_editor\rhwp-studio\public\ 에도 복사
   - rhwp.js
   - rhwp_bg.wasm
3) npm run build — 빌드 성공 확인
4) npm run dev — 로컬 테스트
5) WASM 초기화 성공 여부 콘솔 로그 확인:
   "[WasmBridge] WASM 초기화 완료 (rhwp X.X.X)"
6) firebase deploy --only hosting
```

### 3. 긴급 롤백 워크플로우

```
1) Firebase Console → Hosting → 이전 버전 선택 → Rollback
   또는
   firebase hosting:clone rhwp-studio:<previous-version> rhwp-studio:live
2) 원인 분석 후 수정 → 재배포
```

### 4. Google Drive 연동 디버깅

```
1) OAuth 에러 확인:
   - redirect_uri_mismatch → Google Cloud Console에서 URI 등록
   - 401/403 → 토큰 만료 (자동 재발급 동작 확인)
2) Drive API 에러 확인:
   - 404 → fileId 유효성
   - 5xx → Google 서버 이슈 (자동 재시도 대기)
3) 토큰 관리:
   - sessionStorage에 rhwp_drive_token / rhwp_drive_token_expiry 저장
   - 만료 5분 전 자동 갱신 트리거
```

---

## 주의 사항 및 제약

> [!WARNING]
> **HWPX 저장 제한**: HWPX 출처 문서는 현재 저장이 비활성화되어 있음 (#197 완전 변환기 완료 시까지). `notifyHwpxBetaIfNeeded()` 함수 참조.

> [!IMPORTANT]
> **WASM 파일 동기화**: `public/` 폴더의 `rhwp.js`, `rhwp_bg.wasm`과 `../pkg/` 의 파일이 일치해야 함. 불일치 시 `LinkError` 발생.

> [!CAUTION]
> **CORS 헤더**: Firebase Hosting에서 WASM 파일은 `Cross-Origin-Embedder-Policy: require-corp` 및 `Cross-Origin-Opener-Policy: same-origin` 헤더가 필수. `firebase.json` 수정 시 주의.

---

## 에러 핸들링 체계

| 에러 유형 | 자동 처리 | 사용자 안내 |
|-----------|-----------|-------------|
| WASM 초기화 실패 | 최대 2회 재시도 | 새로고침 유도 토스트 |
| OAuth 토큰 만료 | 5분 전 자동 갱신 | 재인증 팝업 |
| Drive API 401/403 | 토큰 재발급 + 1회 재시도 | 로그인 안내 |
| Drive API 5xx | 2초 후 1회 재시도 | 에러 토스트 |
| Drive 저장 실패 | — | 로컬 다운로드 fallback 제안 |
| 네트워크 끊김 | — | 오프라인 배너 표시 |
| WASM 런타임 크래시 | — | 새로고침 유도 토스트 |
| 저장 중복 클릭 | saveLock으로 차단 | 콘솔 경고 |

---

## 모니터링 포인트

1. **콘솔 로그 프리픽스**:
   - `[WasmBridge]` — WASM 관련
   - `[auto-save]` — 자동 저장
   - `[file:save]` — 수동 저장
   - `[drive-api]` — Drive API 호출
   - `[offline-banner]` — 네트워크 상태
   - `[global]` — 전역 에러

2. **상태바 메시지**:
   - `#sb-message` — 현재 상태 (파일명, 저장 상태 등)
   - `#sb-auto-save` — 마지막 자동 저장 시각

3. **Firebase Hosting 모니터링**:
   - Console: https://console.firebase.google.com/project/rhwp-studio/hosting
