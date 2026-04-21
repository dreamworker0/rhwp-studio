# rhwp-studio 구현계획서

> **WASM 기반 HWP 웹 에디터 — 브라우저에서 한글 문서를 열고 편집하고 저장한다.**

---

## 1. 프로젝트 개요

### 1.1 목적

rhwp-studio는 한글과컴퓨터의 HWP/HWPX 문서를 **별도의 프로그램 설치 없이 웹 브라우저에서** 열고, 편집하고, 저장할 수 있는 온라인 문서 편집기입니다.

핵심 파서와 렌더링 엔진은 **Rust**로 작성되어 **WebAssembly(WASM)**로 컴파일되며, 프론트엔드는 **TypeScript + Vite**로 구축됩니다. Google Drive와 연동하여 클라우드 문서를 직접 열고 저장할 수 있습니다.

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **접근성** | 설치 없이 브라우저만으로 HWP 파일 편집 |
| **클라우드 연동** | Google Drive에서 직접 열기/저장/자동 저장 |
| **네이티브 성능** | Rust → WASM으로 네이티브에 준하는 파싱/렌더링 속도 |
| **크로스 플랫폼** | Windows, macOS, Linux, ChromeOS 어디서나 동작 |

### 1.3 서비스 정보

| 항목 | 값 |
|------|-----|
| 프로젝트명 | rhwp-studio |
| 현재 버전 | 0.7.3 |
| 프로덕션 URL | https://rhwp-studio.web.app |
| 에디터 URL | https://rhwp-studio.web.app/editor/ |
| 호스팅 | Firebase Hosting |
| Firebase 프로젝트 | `rhwp-studio` |

---

## 2. 기술 스택

### 2.1 전체 기술 구조

```
┌──────────────────────────────────────────────────┐
│                   브라우저                          │
│  ┌────────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ TypeScript │  │   WASM    │  │  Google API  │ │
│  │  (Vite 8)  │←→│ (Rust→WA) │  │  (Drive v3)  │ │
│  │            │  │           │  │  (GIS OAuth)  │ │
│  │  UI/UX     │  │  HWP 파서 │  │              │ │
│  │  커맨드     │  │  렌더러   │  │              │ │
│  │  이벤트     │  │  편집기   │  │              │ │
│  └────────────┘  └───────────┘  └──────────────┘ │
└──────────────────────────────────────────────────┘
                        │
                        ▼
              Firebase Hosting (CDN)
```

### 2.2 기술 스택 상세

| 계층 | 기술 | 역할 |
|------|------|------|
| **빌드 도구** | Vite 8 | 개발 서버, 번들링, HMR |
| **언어** | TypeScript 6 | 프론트엔드 전체 |
| **핵심 엔진** | Rust → WebAssembly | HWP 파싱, 조판, 렌더링 |
| **인증** | Google Identity Services | OAuth 2.0 Implicit Flow |
| **스토리지** | Google Drive API v3 | 파일 읽기/쓰기/메타데이터 |
| **배포** | Firebase Hosting | 정적 파일 서빙, CDN, HTTPS |
| **폰트** | Pretendard (WOFF2) | 기본 UI/문서 렌더링 폰트 |
| **E2E 테스트** | Puppeteer Core | CDP 기반 자동화 테스트 |

---

## 3. 시스템 아키텍처

### 3.1 디렉토리 구조

```
d:\apps\rhwp\
├── temp_editor\
│   ├── rhwp-studio\                 ← 에디터 소스코드
│   │   ├── src\
│   │   │   ├── main.ts              ← 진입점 (초기화, 이벤트 바인딩)
│   │   │   ├── core\                ← 핵심 모듈
│   │   │   │   ├── wasm-bridge.ts   ← WASM 브릿지 (70KB, 핵심)
│   │   │   │   ├── drive-auth.ts    ← Google OAuth 인증
│   │   │   │   ├── drive-api.ts     ← Drive API 호출
│   │   │   │   ├── auto-save.ts     ← 자동 저장 (5분)
│   │   │   │   ├── event-bus.ts     ← 이벤트 버스
│   │   │   │   ├── font-loader.ts   ← 웹폰트 로더
│   │   │   │   ├── font-substitution.ts ← 폰트 대체 규칙
│   │   │   │   ├── hwp-constants.ts ← HWP 상수 정의
│   │   │   │   ├── types.ts         ← 타입 정의
│   │   │   │   └── user-settings.ts ← 사용자 설정
│   │   │   ├── command\             ← 커맨드 시스템
│   │   │   │   ├── registry.ts      ← 커맨드 등록부
│   │   │   │   ├── dispatcher.ts    ← 커맨드 실행기
│   │   │   │   ├── shortcut-map.ts  ← 단축키 매핑
│   │   │   │   └── commands\        ← 커맨드 구현 (8개 카테고리)
│   │   │   │       ├── file.ts      ← 파일 열기/저장/인쇄
│   │   │   │       ├── edit.ts      ← 편집 (복사/붙이기/실행취소)
│   │   │   │       ├── view.ts      ← 보기 (줌/눈금자)
│   │   │   │       ├── format.ts    ← 서식 (글자/문단 모양)
│   │   │   │       ├── insert.ts    ← 삽입 (표/그림/특수문자)
│   │   │   │       ├── table.ts     ← 표 편집
│   │   │   │       ├── page.ts      ← 쪽 설정
│   │   │   │       └── tool.ts      ← 도구
│   │   │   ├── engine\              ← 편집 엔진 (16개 모듈)
│   │   │   │   ├── input-handler.ts ← 입력 핸들러 총괄 (105KB)
│   │   │   │   ├── input-handler-keyboard.ts ← 키보드 이벤트
│   │   │   │   ├── input-handler-mouse.ts    ← 마우스 이벤트
│   │   │   │   ├── input-handler-text.ts     ← 텍스트 입력
│   │   │   │   ├── input-handler-picture.ts  ← 그림 조작
│   │   │   │   ├── input-handler-table.ts    ← 표 조작
│   │   │   │   ├── cursor.ts        ← 커서 관리 (49KB)
│   │   │   │   ├── history.ts       ← 실행취소/재실행
│   │   │   │   ├── command.ts       ← 편집 커맨드 (32KB)
│   │   │   │   ├── caret-renderer.ts         ← 캐럿 렌더링
│   │   │   │   ├── selection-renderer.ts     ← 선택 영역 렌더링
│   │   │   │   ├── cell-selection-renderer.ts ← 셀 선택 렌더링
│   │   │   │   ├── table-object-renderer.ts  ← 표 객체 렌더링
│   │   │   │   ├── table-resize-renderer.ts  ← 표 크기 조절
│   │   │   │   └── field-marker-renderer.ts  ← 필드 마커 렌더링
│   │   │   ├── ui\                  ← UI 컴포넌트 (38개)
│   │   │   │   ├── toolbar.ts       ← 메인 툴바
│   │   │   │   ├── menu-bar.ts      ← 메뉴바
│   │   │   │   ├── toast.ts         ← 토스트 알림
│   │   │   │   ├── loading-overlay.ts ← 로딩 오버레이
│   │   │   │   ├── offline-banner.ts  ← 오프라인 배너
│   │   │   │   ├── command-palette.ts ← 명령 팔레트
│   │   │   │   ├── context-menu.ts    ← 컨텍스트 메뉴
│   │   │   │   ├── char-shape-dialog.ts   ← 글자 모양 (48KB)
│   │   │   │   ├── para-shape-dialog.ts   ← 문단 모양 (40KB)
│   │   │   │   ├── picture-props-dialog.ts ← 그림 속성 (108KB)
│   │   │   │   ├── table-cell-props-dialog.ts ← 표/셀 속성 (65KB)
│   │   │   │   ├── page-setup-dialog.ts   ← 쪽 설정
│   │   │   │   └── (기타 26개 다이얼로그)
│   │   │   ├── view\                ← 뷰 레이어 (7개 모듈)
│   │   │   │   ├── canvas-view.ts   ← 메인 캔버스 뷰
│   │   │   │   ├── canvas-pool.ts   ← 캔버스 풀링
│   │   │   │   ├── page-renderer.ts ← 페이지 렌더러
│   │   │   │   ├── ruler.ts         ← 눈금자
│   │   │   │   ├── virtual-scroll.ts ← 가상 스크롤
│   │   │   │   ├── viewport-manager.ts ← 뷰포트 관리
│   │   │   │   └── coordinate-system.ts ← 좌표계 변환
│   │   │   ├── hwpctl\              ← HWP 컨트롤 API
│   │   │   │   └── index.ts         ← 외부 연동 API
│   │   │   └── styles\              ← CSS 모듈
│   │   ├── public\                  ← 정적 파일
│   │   │   ├── rhwp.js              ← WASM 글루 코드 (229KB)
│   │   │   ├── rhwp_bg.wasm         ← WASM 바이너리 (3.6MB)
│   │   │   ├── fonts/               ← Pretendard 폰트
│   │   │   ├── images/              ← 아이콘/이미지
│   │   │   └── samples/             ← 샘플 HWP 파일
│   │   ├── e2e\                     ← E2E 테스트 (27개)
│   │   ├── vite.config.ts           ← Vite 설정
│   │   ├── tsconfig.json            ← TypeScript 설정
│   │   └── package.json             ← 의존성 (v0.7.3)
│   └── pkg\                         ← WASM 패키지 원본
│       ├── rhwp.js                  ← WASM 글루 코드
│       ├── rhwp_bg.wasm             ← WASM 바이너리
│       └── rhwp.d.ts                ← TypeScript 타입 정의
├── dist\
│   └── editor\                      ← 빌드 출력물 (배포 대상)
├── firebase.json                    ← Firebase Hosting 설정
└── .firebaserc                      ← Firebase 프로젝트 매핑

총 소스 파일 수: ~90개 (TypeScript)
총 E2E 테스트: 27개
```

### 3.2 모듈 의존성 다이어그램

```
main.ts (진입점)
  │
  ├─→ core/wasm-bridge.ts ──→ @wasm/rhwp (WASM)
  │     └── 문서 파싱, 조판, 렌더링, 내보내기
  │
  ├─→ core/drive-auth.ts ──→ Google Identity Services
  │     └── OAuth 2.0 토큰 발급/갱신
  │
  ├─→ core/drive-api.ts ──→ Google Drive API v3
  │     └── 파일 메타 조회, 다운로드, 업로드
  │
  ├─→ core/auto-save.ts
  │     └── 5분 간격 자동 저장 (Drive 모드)
  │
  ├─→ core/event-bus.ts
  │     └── 컴포넌트 간 이벤트 통신
  │
  ├─→ command/ (커맨드 시스템)
  │     ├── registry → dispatcher → commands/*
  │     └── 8개 카테고리: file, edit, view, format, insert, table, page, tool
  │
  ├─→ engine/ (편집 엔진)
  │     ├── input-handler (키보드/마우스/텍스트/그림/표)
  │     ├── cursor (커서 위치/이동/선택)
  │     ├── history (실행취소/재실행)
  │     └── renderers (캐럿/선택/표/필드 렌더링)
  │
  ├─→ view/ (뷰 레이어)
  │     ├── canvas-view (메인 캔버스)
  │     ├── virtual-scroll (가상 스크롤)
  │     ├── page-renderer (페이지 렌더러)
  │     └── ruler (눈금자)
  │
  └─→ ui/ (UI 컴포넌트)
        ├── toolbar, menu-bar (상단 UI)
        ├── toast, loading-overlay, offline-banner (상태 알림)
        ├── command-palette, context-menu (검색/메뉴)
        └── 각종 다이얼로그 (서식, 표, 그림, 쪽 설정 등)
```

---

## 4. 핵심 기능

### 4.1 문서 편집

| 기능 | 설명 | 구현 모듈 |
|------|------|-----------|
| HWP/HWPX 열기 | 로컬 파일 또는 Google Drive에서 열기 | `file.ts`, `wasm-bridge.ts` |
| 텍스트 편집 | 입력, 삭제, 복사/붙이기, 실행취소 | `input-handler-text.ts`, `history.ts` |
| 글자 모양 | 글꼴, 크기, 색상, 밑줄, 볼드 등 | `char-shape-dialog.ts`, `format.ts` |
| 문단 모양 | 정렬, 들여쓰기, 줄간격, 테두리 등 | `para-shape-dialog.ts`, `format.ts` |
| 표 편집 | 삽입, 행/열 추가삭제, 셀 합치기/나누기, 크기 조절 | `table.ts`, `input-handler-table.ts` |
| 그림 편집 | 삽입, 이동, 크기 조절, 속성 변경 | `insert.ts`, `input-handler-picture.ts` |
| 특수문자 | 특수문자표에서 선택 입력 | `symbols-dialog.ts` |
| 수식 편집 | LaTeX 기반 수식 입력 | `equation-editor-dialog.ts` |
| 쪽 설정 | 용지 종류, 여백, 머리말/꼬리말 | `page-setup-dialog.ts`, `page.ts` |
| 찾기/바꾸기 | 텍스트 검색 및 치환 | `find-dialog.ts` |
| 스타일 | 문서 스타일 관리 | `style-dialog.ts` |
| 번호 매기기 | 자동 번호 및 글머리표 | `numbering-dialog.ts` |
| 책갈피 | 책갈피 삽입/이동 | `bookmark-dialog.ts` |
| 명령 팔레트 | Ctrl+Shift+P 빠른 명령 검색 | `command-palette.ts` |
| 미리보기 모드 | 편집 제한 및 커서 숨김 (Read-only) | `cursor.ts`, `caret-renderer.ts` |

### 4.2 Google Drive 연동

| 기능 | 설명 |
|------|------|
| Drive에서 열기 | URL 파라미터(`?fileId=XXX`)로 Drive 파일 직접 로드 |
| Drive에 저장 | 기존 파일 덮어쓰기 (PATCH) |
| 자동 저장 | 5분 간격, 변경 감지 기반, 오프라인 시 스킵 |
| 새 파일 업로드 | 다른 이름으로 저장 시 새 파일 생성 (POST) |
| OAuth 인증 | Google Identity Services 팝업 로그인 |
| 토큰 자동 갱신 | 만료 5분 전 선제 갱신 |
| Workspace 연동 | Marketplace 확장 앱 등록 및 "연결 앱(Open with)" 통합 설계 완료 |

### 4.3 렌더링 엔진

| 기능 | 설명 |
|------|------|
| 페이지 렌더링 | WASM 엔진이 HWP 문서를 페이지 단위로 렌더링 |
| 가상 스크롤 | 현재 뷰포트에 보이는 페이지만 렌더링 (성능 최적화) |
| 캔버스 풀링 | Canvas 재사용으로 메모리 절약 |
| 눈금자 | 상단/좌측 눈금자로 여백/들여쓰기 시각 표시 |
| 커서/선택 렌더링 | 깜빡이는 커서, 텍스트 선택 하이라이트 |
| 표 리사이징 | 드래그로 표 열/행 크기 조절 |

### 4.4 안정성 및 에러 처리

| 기능 | 설명 |
|------|------|
| WASM 초기화 재시도 | 최대 2회 자동 재시도 (1초, 2초 간격) |
| API 자동 재시도 | 401→토큰 재발급, 5xx→2초 후 재시도 |
| 오프라인 감지 | 네트워크 끊김 시 상단 배너 표시, 복구 시 자동 제거 |
| 전역 에러 핸들러 | WASM 크래시(RuntimeError) 감지 → 새로고침 유도 |
| 저장 실패 fallback | Drive 저장 실패 시 로컬 다운로드 제안 |
| 중복 저장 방지 | saveLock으로 연속 클릭 차단 |
| 로딩 오버레이 | WASM/파일 로딩 시 풀스크린 스피너 표시 |

---

## 5. 데이터 흐름

### 5.1 문서 열기 흐름 (Google Drive)

```
[사용자] ──→ URL 접속 (?fileId=XXX)
              │
              ▼
        ┌─ initialize() ─┐
        │  웹폰트 로드     │ ← loading-overlay 표시
        │  WASM 초기화     │ ← 실패 시 최대 2회 재시도
        └────────┬────────┘
                 ▼
        ┌─ loadDriveFile() ─┐
        │  ensureAuth()      │ ← OAuth 토큰 확인/발급
        │  getFileMeta()     │ ← 파일 이름/크기 조회
        │  downloadFile()    │ ← 바이너리 다운로드
        └────────┬──────────┘
                 ▼
        ┌─ wasm.loadFromBuffer() ─┐
        │  HWP/HWPX 파싱          │ ← WASM 엔진
        │  조판(레이아웃) 계산      │
        │  페이지 생성              │
        └────────┬────────────────┘
                 ▼
        ┌─ initializeDocument() ──┐
        │  canvas-view 초기화       │
        │  input-handler 바인딩     │
        │  toolbar 상태 갱신         │
        │  startAutoSave() 시작     │
        └──────────────────────────┘
```

### 5.2 문서 저장 흐름

```
[사용자] ──→ Ctrl+S 또는 저장 버튼
              │
              ▼
         saveLock 확인 ── 이미 저장 중 → 무시
              │
              ▼
    [iframe 에디터] ─── 문서 버퍼(Blob) 추출 후 부모 컨텍스트로 postMessage 전송
              │
              ▼
    [부모 앱 (DriveOpen.ts 뷰)]
        Drive 모드? ─── 아니오 → 로컬 File System Access API (showSaveFilePicker)
              │                 (네이티브 파일 다운로드 이벤트와 충돌 방지 처리 완료)
              예 (Drive 연동)
              ▼
        ┌─ ensureAuth() ───────┐
        │  토큰 유효? → 사용     │
        │  만료 임박? → 재발급   │
        └────────┬─────────────┘
                 ▼
        ┌─ wasm.exportHwp() ───┐
        │  WASM → 바이너리 생성  │
        │  Blob 변환             │
        └────────┬─────────────┘
                 ▼
        ┌─ uploadFile() ───────┐
        │  FormData (multipart) │
        │  PATCH /files/{id}    │
        │  fetchWithRetry       │
        └────────┬─────────────┘
                 │
           성공 → clearDirty(), 상태바 "✔ 저장 완료"
           실패 → showConfirm("로컬 다운로드?") → Blob URL 다운로드
```

### 5.3 자동 저장 흐름

```
Drive 파일 로드 ──→ startAutoSave()
                      │
                      ▼
              setInterval (5분)
                      │
                      ▼
         dirty? ── 아니오 → 스킵
              │
              예
              ▼
         online? ── 아니오 → 스킵 (콘솔 로그)
              │
              예
              ▼
         performAutoSave()
              │
              ▼
         exportHwp → uploadFile → clearDirty
              │
        성공 → 상태바 "자동 저장 HH:MM"
        실패 → showToast 알림 (alert 없음)
```

---

## 6. 인증 및 보안

### 6.1 OAuth 2.0 구성

| 항목 | 값 |
|------|-----|
| 인증 방식 | Google Identity Services (Implicit Flow) |
| Client ID | `292079787292-qmjcruc73ogvoffnf63f28nj7ov30csn` |
| Scope | `https://www.googleapis.com/auth/drive` (전체 Drive 접근) |
| 토큰 타입 | Access Token (Bearer) |
| 유효 기간 | 1시간 (3600초) |
| 저장 위치 | `sessionStorage` |

### 6.2 토큰 관리

```
토큰 라이프사이클:

[발급] → sessionStorage 저장 (rhwp_drive_token + rhwp_drive_token_expiry)
  │
  │ 55분 경과 (=만료 5분 전)
  │
  ▼
[자동 갱신] → isTokenExpiringSoon() → ensureAuth() → 새 토큰 발급
  │
  │ 401/403 수신 시
  │
  ▼
[강제 재발급] → clearToken() → ensureAuth() → fetchWithRetry
```

### 6.3 보안 고려사항

| 항목 | 현재 상태 | 향후 개선 |
|------|-----------|-----------|
| 토큰 저장 | sessionStorage (탭 수준) | Secure Cookie 또는 Service Worker |
| XSS 방어 | DOM 직접 조작 (innerHTML 미사용) | CSP 헤더 강화 |
| CORS | firebase.json 헤더 설정 | Origin 검증 추가 |
| COEP/COOP | 활성화 (WASM 필수) | 유지 |

---

## 7. 배포 환경

### 7.1 Firebase Hosting 구성

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      { "source": "/editor/**", "destination": "/editor/index.html" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      { "source": "**/*.wasm", "headers": [WASM MIME + COEP + COOP] },
      { "source": "/editor/**", "headers": [COEP + COOP + Cache-Control] }
    ]
  }
}
```

### 7.2 빌드 파이프라인

```
소스 (TypeScript)
  │
  ▼
tsc (타입 체크)
  │
  ▼
vite build (번들링)
  │
  ├── index.html (55KB)
  ├── assets/index-*.js (693KB → gzip 149KB)
  ├── assets/index-*.css (60KB → gzip 11KB)
  ├── assets/rhwp_bg-*.wasm (3.6MB → gzip 1.4MB)
  ├── rhwp.js (229KB, 정적 복사)
  ├── rhwp_bg.wasm (3.6MB, 정적 복사)
  ├── fonts/ (Pretendard WOFF2)
  ├── images/ (아이콘)
  └── samples/ (샘플 HWP)
```

### 7.3 배포 명령

```bash
# 빌드
cd d:\apps\rhwp\temp_editor\rhwp-studio
npm run build               # tsc → vite build → dist/editor/

# 배포
cd d:\apps\rhwp
firebase deploy --only hosting   # → https://rhwp-studio.web.app
```

---

## 8. 테스트 전략

### 8.1 E2E 테스트 (27개)

| 카테고리 | 테스트 파일 | 검증 내용 |
|----------|-----------|-----------|
| **텍스트** | text-flow.test.mjs | 텍스트 흐름/조판 |
| **편집** | edit-pipeline.test.mjs | 편집 파이프라인 전체 |
| **복사/붙이기** | copy-paste.test.mjs | 클립보드 동작 |
| **표** | tac-inline-*.test.mjs | 표 생성/편집/검증 |
| **그림** | shape-inline.test.mjs | 도형/인라인 객체 |
| **페이지** | page-break.test.mjs | 페이지 나누기 |
| **줄간격** | line-spacing.test.mjs | 줄간격 계산 |
| **각주** | footnote-*.test.mjs | 각주 삽입/위치 |
| **서식** | typesetting.test.mjs | 조판 정확도 |
| **수식** | formula-dialog | 수식 입력 |
| **반응형** | responsive.test.mjs | 화면 크기 대응 |
| **단축키** | global-shortcut.test.mjs | 글로벌 단축키 |
| **커맨드** | command-palette.test.mjs | 명령 팔레트 |
| **HwpCtl** | hwpctl-basic.test.mjs | 외부 API |
| **Drive** | drive-save-flow.test.mjs | Drive 저장/에러 처리 |
| **블로그** | blogform.test.mjs | 블로그 폼 |

### 8.2 E2E 인프라

| 파일 | 역할 |
|------|------|
| `helpers.mjs` | 브라우저 세션 관리, 유틸리티 |
| `scenario-runner.mjs` | 시나리오 자동 실행기 |
| `report-generator.mjs` | HTML 리포트 생성 |
| `gen-screenshot.mjs` | 스크린샷 도구 |

### 8.3 실행 방법

```bash
cd d:\apps\rhwp\temp_editor\rhwp-studio

# 개별 테스트
node e2e/text-flow.test.mjs
node e2e/drive-save-flow.test.mjs

# 전체 시나리오
node e2e/scenario-runner.mjs
```

> **사전 조건**: `CHROME_CDP` 환경 변수로 Chrome DevTools Protocol 엔드포인트 설정 필요.

---

## 9. 운영 및 모니터링

### 9.1 로깅 체계

| 프리픽스 | 출처 | 설명 |
|----------|------|------|
| `[WasmBridge]` | wasm-bridge.ts | WASM 초기화/문서 로드/내보내기 |
| `[auto-save]` | auto-save.ts | 자동 저장 시작/완료/스킵/실패 |
| `[file:save]` | file.ts | 수동 저장 실행/완료/실패 |
| `[drive-api]` | drive-api.ts | API 호출 재시도/에러 |
| `[offline-banner]` | offline-banner.ts | 네트워크 상태 변경 |
| `[global]` | main.ts | 전역 에러/미처리 Promise |
| `[loadDriveFile]` | main.ts | Drive 파일 로드 과정 |

### 9.2 에러 핸들링 매트릭스

| 에러 유형 | 자동 처리 | 사용자 알림 | 복구 방법 |
|-----------|-----------|-------------|-----------|
| WASM 초기화 실패 | 2회 재시도 | 토스트 + 새로고침 버튼 | 새로고침 |
| OAuth 토큰 만료 | 5분 전 갱신 | (자동, 무알림) | 자동 |
| API 401/403 | 토큰 재발급 + 재시도 | 실패 시 로그인 안내 | 재로그인 |
| API 5xx | 2초 후 1회 재시도 | 실패 시 토스트 | 재시도 |
| Drive 저장 실패 | — | confirm + fallback | 로컬 다운로드 |
| 네트워크 끊김 | — | 오프라인 배너 | 연결 복구 대기 |
| WASM 크래시 | — | 토스트 + 새로고침 | 새로고침 |
| 중복 저장 | saveLock 차단 | 콘솔 경고 | (자동) |

### 9.3 상태바 정보

| 요소 ID | 표시 내용 |
|---------|-----------|
| `#sb-message` | 현재 상태 (파일명, 저장 상태) |
| `#sb-auto-save` | 마지막 자동 저장 시각 |
| `#sb-zoom-val` | 현재 줌 배율 (%) |

---

## 10. 알려진 제약 사항 및 향후 계획

### 10.1 현재 제약

| 항목 | 설명 | 관련 이슈 |
|------|------|-----------|
| HWPX 저장 | 베타 단계 — 저장 비활성화 | #197 (완전 변환기) |
| WASM 파일 동기화 | `public/`과 `pkg/` 수동 동기화 필요 | — |
| 토큰 보안 | sessionStorage 의존 (XSS 취약) | — |
| 대용량 문서 | 100MB 이상 HWP 처리 시 메모리 부족 가능 | — |

### 10.2 향후 개선 계획

| 우선순위 | 항목 | 설명 |
|----------|------|------|
| 높음 | HWPX 완전 저장 | #197 변환기 완료 후 활성화 |
| 완료/심사중 | Google Workspace Marketplace | 에셋/정보 등록 완료 및 리뷰 제출 상태 |
| 중간 | 오프라인 모드 | Service Worker + IndexedDB 로컬 캐시 |
| 중간 | 실시간 협업 | WebSocket/WebRTC 기반 동시 편집 |
| 낮음 | PDF 내보내기 | WASM → PDF 변환 |
| 낮음 | 모바일 최적화 | 터치 입력, 반응형 UI |

---

## 11. 부록

### 11.1 주요 단축키

| 단축키 | 기능 |
|--------|------|
| Ctrl+O | 파일 열기 |
| Ctrl+S | 저장 |
| Ctrl+Z | 실행취소 |
| Ctrl+Y | 재실행 |
| Ctrl+C/V/X | 복사/붙이기/잘라내기 |
| Ctrl+A | 전체 선택 |
| Ctrl+F | 찾기 |
| Ctrl+H | 바꾸기 |
| Ctrl+Shift+P | 명령 팔레트 |
| Ctrl+P | 인쇄 |

### 11.2 지원 도구 URL

| 도구 | URL |
|------|-----|
| Firebase Console | https://console.firebase.google.com/project/rhwp-studio |
| Google Cloud Console | https://console.cloud.google.com |
| OAuth 설정 | Google Cloud Console → API & Services → Credentials |

---

*최종 업데이트: 2026-04-21 (v0.7.3)*
