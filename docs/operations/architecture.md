# rhwp-studio 아키텍처 개요

## 프로젝트 정체성

rhwp-studio는 Rust로 작성된 HWP 파서/렌더러를 WASM으로 컴파일하여 브라우저에서 HWP 파일을 편집할 수 있는 웹 에디터입니다.

- **프로젝트 ID**: `rhwp-studio`
- **프로덕션 URL**: https://rhwp-studio.web.app
- **에디터 URL**: https://rhwp-studio.web.app/editor/
- **Google Cloud 프로젝트**: `292079787292` (OAuth Client ID 기준)

## 디렉토리 구조

```
d:\apps\rhwp\
├── temp_editor\
│   ├── rhwp-studio\        ← 에디터 소스 (이 프로젝트)
│   │   ├── src\
│   │   │   ├── main.ts       ← 진입점
│   │   │   ├── core\         ← 핵심 모듈 (WASM, Drive, 자동저장)
│   │   │   ├── command\      ← 커맨드 시스템
│   │   │   ├── ui\           ← UI 컴포넌트 (38개)
│   │   │   ├── engine\       ← 렌더링 엔진
│   │   │   └── view\         ← 캔버스 뷰, 룰러
│   │   ├── public\           ← 정적 파일 (WASM, 폰트, 샘플)
│   │   ├── e2e\              ← E2E 테스트 (27개)
│   │   └── vite.config.ts
│   └── pkg\                 ← WASM 패키지 원본
│       ├── rhwp.js
│       ├── rhwp_bg.wasm
│       └── rhwp.d.ts
├── dist\
│   └── editor\              ← 빌드 출력물 (firebase deploy 대상)
├── firebase.json
└── .firebaserc
```

## 핵심 데이터 흐름

### 문서 열기 (Google Drive)
```
URL 파라미터 ?fileId=XXX
  → ensureAuth() → OAuth 토큰 획득
  → getFileMeta(fileId) → 파일 메타 조회
  → downloadFile(fileId) → 바이너리 다운로드
  → wasm.loadFromBuffer(bytes) → WASM 문서 파싱
  → initializeDocument() → 캔버스 렌더링
  → startAutoSave() → 자동 저장 시작
```

### 문서 저장 (Google Drive)
```
Ctrl+S 또는 저장 버튼
  → saveLock 확인 (중복 방지)
  → wasm.exportHwp() 또는 wasm.exportHwpx() → 바이너리 생성
  → ensureAuth() → 토큰 확인/갱신
  → uploadFile(name, bytes, mime, driveFileId) → Drive PATCH
  → 실패 시 → showConfirm() → 로컬 다운로드 fallback
```

### 자동 저장
```
Drive 파일 로드 후 → startAutoSave(wasm, eventBus)
  → 5분 간격 setInterval
  → dirty flag 확인 (document-modified 이벤트)
  → 오프라인 시 스킵
  → performAutoSave() → Drive PATCH
```

## OAuth 설정

| 항목 | 값 |
|------|-----|
| Client ID | `292079787292-qmjcruc73ogvoffnf63f28nj7ov30csn.apps.googleusercontent.com` |
| Scope | `https://www.googleapis.com/auth/drive.file` + `https://www.googleapis.com/auth/drive.install` |
| Flow | Implicit (GIS `initTokenClient`) |
| 토큰 저장 | `sessionStorage` (`rhwp_drive_token`, `rhwp_drive_token_expiry`) |
| 만료 갱신 | 5분 전 자동 (`TOKEN_REFRESH_BUFFER_MS`) |

## 알려진 제약 사항

1. **HWPX 저장 비활성화** — `#197` 완전 변환기 완료 시까지
2. **WASM 파일 동기화 필수** — `public/`과 `pkg/`의 WASM 파일 불일치 시 `LinkError`
3. **토큰 보안** — `sessionStorage` 의존 (XSS 취약, 향후 개선 검토)
4. **CORS 헤더 필수** — `COEP: require-corp`, `COOP: same-origin` 없으면 WASM SharedArrayBuffer 사용 불가
