# rhwp-studio

> **브라우저에서 HWP를 열고, 편집하고, Google Drive에 저장한다.**

[![Firebase Hosting](https://img.shields.io/badge/Hosting-Firebase-FFCA28?logo=firebase)](https://rhwp-studio.web.app)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

---

## ✨ 소개

**rhwp-studio**는 한글과컴퓨터의 HWP 문서를 **별도의 프로그램 설치 없이** 웹 브라우저에서 열고, 편집하고, Google Drive에 저장할 수 있는 온라인 문서 편집기입니다.

- 핵심 파서/렌더러는 **Rust → WebAssembly**로 컴파일되어 네이티브에 준하는 성능을 제공합니다.
- **Google Drive**와 통합되어 클라우드 문서를 직접 열고 저장합니다.
- **Google Workspace Marketplace** 확장 앱으로 등록되어 있습니다.

> **HWP는 편집/저장**을 지원하며, **HWPX는 미리보기(열람) 전용**입니다.

| | |
|---|---|
| 🌐 **프로덕션** | https://rhwp-studio.web.app |
| ✏️ **에디터** | https://rhwp-studio.web.app/editor/ |
| 🔥 **호스팅** | Firebase Hosting (`rhwp-studio` 프로젝트) |

---

## 🚀 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 서버 시작 (https://localhost:5173)
npm run dev
```

> **주의**: WASM `SharedArrayBuffer` 사용을 위해 HTTPS가 필수입니다.
> `vite-plugin-mkcert`로 로컬 인증서가 자동 생성됩니다.

### 환경 변수

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

| 변수 | 설명 |
|------|------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 클라이언트 ID (클라이언트 번들에 노출되는 공개값) |

### 프로덕션 빌드 및 배포

```bash
# 빌드 → dist/
npm run build

# Firebase 배포
npx firebase deploy --only hosting
```

> `master` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가
> 자동으로 Firebase `live` 채널에 배포합니다.

---

## 🏗️ 기술 스택

| 계층 | 기술 | 역할 |
|------|------|------|
| **핵심 엔진** | Rust → WebAssembly (`@rhwp/core`, `@rhwp/editor`) | HWP 파싱, 조판, 렌더링 |
| **프론트엔드** | TypeScript + Vite | UI, 라우팅, 이벤트 |
| **인증** | Google Identity Services | OAuth 2.0 (`drive.file`, `drive.install`) |
| **스토리지** | Google Drive API v3 | 파일 읽기/쓰기 |
| **배포** | Firebase Hosting + GitHub Actions | CDN, HTTPS, CORS 헤더 |

---

## 📁 디렉토리 구조

```
rhwp-studio/
├── src/
│   ├── pages/          ← 페이지 (Home, Terms, Privacy, DriveOpen 등)
│   ├── components/     ← 공용 UI 컴포넌트
│   └── lib/            ← Drive API, 인증, 에디터/렌더러 유틸
├── public/             ← 정적 파일 (에디터 번들, WASM, 폰트)
│   └── editor/         ← 빌드된 에디터 (/editor 경로로 서빙)
├── scripts/            ← 빌드/업스트림 동기화 스크립트
├── docs/               ← 운영 문서
├── index.html          ← 진입점
├── vite.config.ts      ← Vite 설정
├── firebase.json       ← Firebase Hosting 설정 (CORS 헤더 포함)
└── .github/workflows/  ← CI/CD (Firebase 자동 배포)
```

---

## ⚙️ 주요 기능

### 문서 편집 (HWP)
- HWP 파일 열기 (로컬 또는 Google Drive)
- 텍스트 입력/삭제/복사·붙이기, 실행취소/재실행
- 글자 모양 (글꼴, 크기, 색상, 밑줄, 볼드)
- 문단 모양 (정렬, 들여쓰기, 줄간격, 테두리)
- 표 삽입 및 편집, 그림 삽입/크기 조절
- 수식 편집 (LaTeX 기반), 찾기/바꾸기

### 미리보기 (HWPX)
- HWPX 파일은 열람(미리보기)만 지원하며 편집/저장은 지원하지 않습니다.

### Google Drive 연동
- URL 파라미터(`?fileId=XXX`)로 Drive 파일 직접 열기
- `Ctrl+S` 또는 저장 버튼으로 Drive에 즉시 저장
- 뷰어(읽기 전용) 권한 파일은 저장이 제한되며, 사본 저장으로 안내됩니다

---

## ⌨️ 주요 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl+O` | 파일 열기 |
| `Ctrl+S` | 저장 |
| `Ctrl+Z` / `Ctrl+Y` | 실행취소 / 재실행 |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+X` | 복사 / 붙이기 / 잘라내기 |
| `Ctrl+A` | 전체 선택 |
| `Ctrl+F` / `Ctrl+H` | 찾기 / 바꾸기 |
| `Ctrl+P` | 인쇄 |

---

## 🔒 보안 / CORS 요구 사항

WASM `SharedArrayBuffer`를 사용하기 위해 아래 HTTP 헤더가 **필수**이며, `firebase.json`에 설정되어 있습니다.

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

OAuth는 비민감 스코프(`drive.file`, `drive.install`)만 사용하며, 문서는 서버에 저장되지 않고 **브라우저 내부(WASM)에서만 처리**됩니다.

---

## ⚠️ 알려진 제약 사항

| 항목 | 설명 |
|------|------|
| **HWPX 편집** | 미리보기 전용 (편집/저장 미지원) |
| **읽기 전용 파일** | Drive 뷰어 권한 파일은 원본 저장 불가 (사본 저장으로 안내) |
| **대용량 파일** | 100MB 이상 HWP 처리 시 메모리 부족 가능 |

---

## 📄 라이선스

이 프로젝트는 [MIT License](./LICENSE)로 배포됩니다.

핵심 엔진인 [`@rhwp/core`](https://www.npmjs.com/package/@rhwp/core) / [`@rhwp/editor`](https://www.npmjs.com/package/@rhwp/editor) 역시 MIT 라이선스(© Edward Kim)를 따릅니다.
