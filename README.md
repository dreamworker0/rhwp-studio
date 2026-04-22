# rhwp-studio

> **브라우저에서 HWP를 열고, 편집하고, Google Drive에 저장한다.**

[![Firebase Hosting](https://img.shields.io/badge/Hosting-Firebase-FFCA28?logo=firebase)](https://rhwp-studio.web.app)
[![License](https://img.shields.io/badge/License-Private-red)](#)
[![Version](https://img.shields.io/badge/Version-0.7.3-blue)](#)

---

## ✨ 소개

**rhwp-studio**는 한글과컴퓨터의 HWP/HWPX 문서를 **별도의 프로그램 설치 없이** 웹 브라우저에서 열고, 편집하고, 저장할 수 있는 온라인 문서 편집기입니다.

- 핵심 파서/렌더러는 **Rust → WebAssembly**로 컴파일되어 네이티브에 준하는 성능을 제공합니다.
- **Google Drive**와 통합되어 클라우드 문서를 직접 열고 저장하며 5분마다 자동 저장합니다.
- **Google Workspace Marketplace** 확장 앱으로 등록 심사 진행 중입니다.

| | |
|---|---|
| 🌐 **프로덕션** | https://rhwp-studio.web.app |
| ✏️ **에디터** | https://rhwp-studio.web.app/editor/ |
| 📦 **버전** | 0.7.3 |
| 🔥 **호스팅** | Firebase Hosting (`rhwp-studio` 프로젝트) |

---

## 🚀 빠른 시작

### 로컬 개발 서버 실행

```bash
# 에디터 소스 디렉토리로 이동
cd temp_editor/rhwp-studio

# 의존성 설치
npm install

# 개발 서버 시작 (https://localhost:5173)
npm run dev
```

> **주의**: WASM `SharedArrayBuffer` 사용을 위해 HTTPS가 필수입니다.  
> `vite-plugin-mkcert`로 자동 로컬 인증서가 생성됩니다.

### 프로덕션 빌드 및 배포

```bash
# 1. 에디터 빌드
cd temp_editor/rhwp-studio
npm run build
# → 빌드 결과: ../../dist/editor/

# 2. Firebase 배포
cd ../../          # d:\apps\rhwp 루트로 이동
firebase deploy --only hosting
```

---

## 🏗️ 기술 스택

| 계층 | 기술 | 역할 |
|------|------|------|
| **핵심 엔진** | Rust → WebAssembly | HWP 파싱, 조판, 렌더링 |
| **프론트엔드** | TypeScript + Vite | UI, 커맨드, 이벤트 |
| **인증** | Google Identity Services | OAuth 2.0 Implicit Flow |
| **스토리지** | Google Drive API v3 | 파일 읽기/쓰기 |
| **배포** | Firebase Hosting | CDN, HTTPS, CORS 헤더 |
| **폰트** | Pretendard (WOFF2) | 문서 렌더링 기본 폰트 |
| **테스트** | Puppeteer (CDP) | E2E 자동화 테스트 (27개) |

---

## 📁 디렉토리 구조

```
d:\apps\rhwp\
├── temp_editor\
│   ├── rhwp-studio\          ← 에디터 소스코드 (TypeScript)
│   │   ├── src\
│   │   │   ├── main.ts       ← 진입점
│   │   │   ├── core\         ← WASM 브릿지, Drive API, 자동저장
│   │   │   ├── command\      ← 커맨드 시스템 (8개 카테고리)
│   │   │   ├── engine\       ← 편집 엔진 (입력, 커서, 히스토리)
│   │   │   ├── ui\           ← UI 컴포넌트 (38개)
│   │   │   └── view\         ← 캔버스 뷰, 가상 스크롤, 눈금자
│   │   ├── public\           ← 정적 파일 (WASM, 폰트, 샘플)
│   │   └── e2e\              ← E2E 테스트
│   └── pkg\                  ← WASM 패키지 원본 (Rust 빌드 결과)
├── dist\
│   └── editor\               ← 빌드 출력물 (firebase deploy 대상)
├── firebase.json             ← Firebase Hosting 설정
└── .firebaserc               ← Firebase 프로젝트 매핑
```

---

## ⚙️ 주요 기능

### 문서 편집
- HWP / HWPX 파일 열기 (로컬 또는 Google Drive)
- 텍스트 입력, 삭제, 복사/붙이기, 실행취소/재실행
- 글자 모양 (글꼴, 크기, 색상, 밑줄, 볼드)
- 문단 모양 (정렬, 들여쓰기, 줄간격, 테두리)
- 표 삽입 및 편집 (행/열 추가삭제, 셀 합치기/나누기)
- 그림 삽입 및 크기 조절
- 수식 편집 (LaTeX 기반)
- 찾기 / 바꾸기
- 미리보기 모드 (Read-only, 커서 숨김)

### Google Drive 연동
- URL 파라미터(`?fileId=XXX`)로 Drive 파일 직접 열기
- `Ctrl+S` 또는 저장 버튼으로 Drive에 즉시 저장
- **5분 간격 자동 저장** (오프라인 시 자동 스킵)
- 저장 실패 시 로컬 다운로드 fallback

### 렌더링 성능
- 가상 스크롤: 뷰포트에 보이는 페이지만 렌더링
- 캔버스 풀링: Canvas 재사용으로 메모리 최적화

---

## ⌨️ 주요 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl+O` | 파일 열기 |
| `Ctrl+S` | 저장 |
| `Ctrl+Z` / `Ctrl+Y` | 실행취소 / 재실행 |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+X` | 복사 / 붙이기 / 잘라내기 |
| `Ctrl+A` | 전체 선택 |
| `Ctrl+F` | 찾기 |
| `Ctrl+H` | 바꾸기 |
| `Ctrl+P` | 인쇄 |
| `Ctrl+Shift+P` | 명령 팔레트 |

---

## 🧪 테스트

E2E 테스트는 Puppeteer/CDP 기반으로 작성되어 있습니다.

```bash
cd temp_editor/rhwp-studio

# 개별 테스트 실행
node e2e/text-flow.test.mjs
node e2e/drive-save-flow.test.mjs

# 전체 시나리오 실행
node e2e/scenario-runner.mjs
```

> **사전 조건**: Chrome을 `--remote-debugging-port=9222` 옵션으로 실행한 뒤  
> `CHROME_CDP` 환경 변수에 CDP 엔드포인트 주소를 설정해야 합니다.

---

## 🔒 보안 / CORS 요구 사항

WASM `SharedArrayBuffer`를 사용하기 위해 아래 HTTP 헤더가 **필수**입니다.  
`firebase.json`에 이미 설정되어 있습니다.

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

---

## ⚠️ 알려진 제약 사항

| 항목 | 설명 |
|------|------|
| **HWPX 저장** | 현재 베타 단계로 저장 비활성화 (`#197` 완전 변환기 완료 후 활성화 예정) |
| **WASM 파일 동기화** | `public/`과 `pkg/`의 WASM 파일은 수동 복사 필요 |
| **토큰 저장** | `sessionStorage` 사용 (탭 종료 시 소멸, XSS 취약점 검토 중) |
| **대용량 파일** | 100MB 이상 HWP 처리 시 메모리 부족 가능 |

---

## 🗺️ 향후 계획

| 우선순위 | 항목 |
|----------|------|
| 🔴 높음 | HWPX 완전 저장 (`#197`) |
| 🟡 중간 | 오프라인 모드 (Service Worker + IndexedDB) |
| 🟡 중간 | 실시간 협업 (WebSocket/WebRTC) |
| 🟢 낮음 | PDF 내보내기 |
| 🟢 낮음 | 모바일 최적화 (터치 입력) |

---

## 🔗 관련 링크

| | |
|---|---|
| Firebase Console | https://console.firebase.google.com/project/rhwp-studio |
| Google Cloud Console | https://console.cloud.google.com |
| 구현계획서 | [rhwp_구현계획서.md](./rhwp_구현계획서.md) |

---

*최종 업데이트: 2026-04-22 (v0.7.3)*
