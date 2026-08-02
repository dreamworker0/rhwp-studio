# rhwp-studio 배포 가이드

실제 배포는 `/deploy` 커맨드(`.claude/commands/deploy.md`)로 수행한다. 이 문서는 그 절차의 배경과 세부 사항을 설명한다.

## 배포 환경

| 항목 | 값 |
|------|-----|
| 프로젝트 ID | `rhwp-studio` |
| 프로덕션 URL | https://rhwp-studio.web.app |
| Hosting | Firebase Hosting (`dist/` 배포) |
| Functions | Firebase Functions 2세대, 리전 `asia-northeast3`, 단일 `api` 함수 |
| API 경로 | `/api/**` → `api` 함수 (Hosting rewrite) |
| 에디터 경로 | `/editor/` (`public/editor/` 산출물이 그대로 복사됨) |
| 로컬 작업 경로 | `D:\apps\rhwp` (레포 루트) |
| Hosting 콘솔 | https://console.firebase.google.com/project/rhwp-studio/hosting |
| Functions 콘솔 | https://console.firebase.google.com/project/rhwp-studio/functions |

## ⚠️ 배포 경로는 두 갈래다

| | 누가 배포하나 | 트리거 |
|---|---|---|
| **Hosting** | GitHub Actions | `master` 푸시 (자동) |
| **Functions** | 사람 (로컬) | `firebase deploy --only functions` (수동) |

**CI는 Hosting만 배포한다.** `functions/` 를 고쳤다면 푸시만으로는 라이브에 반영되지 않으므로 **반드시 수동 배포**해야 한다. 이걸 놓치면 프론트는 새 코드, 백엔드는 옛 코드인 상태가 된다.

## 배포 절차

### 1) Hosting — 기본 경로 (자동)

`master` 에 푸시하면 `.github/workflows/deploy.yml` 이 빌드 후 Hosting REST API로 배포한다.

인증은 gcloud 로 액세스 토큰을 받고, 배포는 `scripts/deploy-hosting.mjs` 가 native fetch 로 직접 호출한다. firebase-tools 15.x 의 인증 스택(gaxios 7 / google-auth-library 10)이 러너에서 `Premature close` 로 결정적 실패하는 문제를 우회한 구조다.

`VITE_GOOGLE_CLIENT_ID` / `VITE_GA_MEASUREMENT_ID` / `VITE_SENTRY_DSN` 은 워크플로에 인라인으로 박혀 있다(모두 클라이언트 번들에 노출되는 공개 식별자). `.env` 는 gitignore 라 CI 에 없으므로, 여기 없으면 빌드에서 누락된다.

### 2) Hosting — 수동 배포

CI 를 거치지 않고 즉시 반영해야 할 때만.

```bash
npm run build                      # tsc + vite → dist/
firebase deploy --only hosting
```

⚠️ 루트 `.env` 가 없는 환경에서 빌드하면 GA·Sentry 가 **비활성 상태로 번들된다**(빌드는 통과). 수동 배포는 `.env` 가 갖춰진 로컬에서 하는 것이 안전하다.

### 3) Functions — 수동 배포 (로컬 전용)

```bash
node --check functions/index.js    # 문법 확인
firebase deploy --only functions
```

필요 조건:

- `firebase login` 된 계정 (프로젝트 배포 권한)
- Node 22 (`functions/package.json` 의 `engines.node`)
- **`functions/.env` 존재** — 아래 "시크릿·환경변수" 참고

특정 PC 에 묶인 것은 아니다. 위 조건만 갖추면 어느 컴퓨터에서든 된다. 다만 **클라우드 세션에서는 불가능**하다(아래 환경 표).

### 4) 에디터 산출물 갱신

`public/editor/` 는 빌드 산출물이므로 **직접 수정 금지**. `/editor-update` 절차(`temp_editor/` 에서 `npm run upstream:update`)로만 재생성한다. WASM 은 `npm run sync:wasm` 이 `@rhwp/core` 버전에 맞춰 동기화한다 — JS 만 갱신하면 "JS 신버전 / WASM 구버전" 불일치로 저장이 깨진 전례가 있다.

## 배포 전 체크리스트

- [ ] `npm run build` 성공 (tsc + vite). **테스트·린트 스크립트가 없으므로 빌드가 유일한 자동 검증 수단**
- [ ] 함수 수정 시 `node --check functions/index.js` 통과
- [ ] `npm run smoke` 통과 (에디터 스모크 — 로컬 전용, `temp_editor/` 의 puppeteer-core 와 Chrome/Edge 필요)
- [ ] `dist/editor/` 에 `rhwp.js`, `rhwp_bg.wasm`, `fonts/` 존재
- [ ] `firebase.json` 의 WASM Content-Type · COEP/COOP 헤더 규칙 유지
- [ ] **함수 배포 시**: `functions/.env` 존재 확인(`SENTRY_DSN`). gitignore 라 새 환경엔 없고, 없어도 배포는 성공하지만 런타임 env 가 덮어써져 **함수 Sentry 가 조용히 꺼진다** → `functions/.env.example` 참고
- [ ] 함수 변경이 있는데 Hosting 만 배포하고 끝내지 않았는지 확인
- [ ] **프로덕션 라이브이므로 사용자의 명시적 배포 승인을 받았는지** (`/deploy` 3단계)

## 환경별 가능/불가

작업 환경이 로컬(Windows)과 클라우드(Claude Code on the web) 두 가지다. `CLAUDE_CODE_REMOTE=true` 면 클라우드.

| | 로컬 | 클라우드 | 비고 |
|---|---|---|---|
| `npm run build` | ✅ | ✅ | |
| `node --check functions/index.js` | ✅ | ✅ | |
| `firebase deploy --only hosting` | ✅ | ⚠️ 조건부 | 클라우드는 `FIREBASE_SERVICE_ACCOUNT` 주입 필요 |
| `firebase deploy --only functions` | ✅ | ❌ | 클라우드 SA 는 **Hosting 전용** |
| `npm run smoke` | ✅ | ❌ | `temp_editor/` 없음 |
| `/editor-update` | ✅ | ❌ | `temp_editor/` 없음 |

클라우드 서비스계정 권한은 **의도적으로 Hosting 으로만 좁혀 놨다.** 함수 배포에 필요한 권한 세트(`cloudfunctions.developer` + Cloud Build + Artifact Registry + `iam.serviceAccountUser` …)는 더 좁혀지지 않아 사실상 백엔드 전권이 되기 때문이다.

또한 클라우드에서는 아웃바운드 프록시 정책으로 `rhwp-studio.web.app` 이 차단(403 CONNECT)돼 **배포 후 라이브 확인을 할 수 없다** → 사용자에게 확인을 요청한다.

## 시크릿·환경변수

| 위치 | 값 | 비고 |
|---|---|---|
| Secret Manager | `GOOGLE_CLIENT_SECRET` | `firebase functions:secrets:set GOOGLE_CLIENT_SECRET` |
| `functions/.env` | `SENTRY_DSN` | gitignore. **함수 배포 시 필요** → `functions/.env.example` |
| 루트 `.env` | `VITE_GOOGLE_CLIENT_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` 등 | gitignore. Hosting 빌드용 → `.env.example` |
| GitHub Secrets | `FIREBASE_SERVICE_ACCOUNT` | CI Hosting 배포용 |

`.env` 계열은 절대 커밋하지 않는다(`.env.example` 만 예외). 커밋 전 `.claude/hooks/secret-scan.mjs` 훅이 스테이징된 `.env` 와 시크릿 패턴을 차단한다.

소스맵은 `SENTRY_AUTH_TOKEN` 이 있을 때만 hidden 모드로 생성·업로드되고, `firebase.json` 의 `ignore` 에서 `**/*.map` 이 제외되므로 공개 배포본에는 포함되지 않는다.

## 롤백

**Hosting** — Firebase Console → Hosting → Release history → 이전 버전의 "…" → Rollback. 또는:

```bash
firebase hosting:clone rhwp-studio:<previous-version-id> rhwp-studio:live
```

**Functions** — 원클릭 롤백이 없다. 직전 정상 커밋을 체크아웃해 `firebase deploy --only functions` 로 재배포한다. Hosting 만 롤백하면 백엔드는 그대로이므로, 프론트/백엔드 계약이 바뀐 배포를 되돌릴 때는 **양쪽을 함께** 되돌려야 한다.

## firebase.json 핵심 설정

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "**/*.map"],
    "rewrites": [
      { "source": "/api/**", "function": "api" },
      { "source": "/editor/**", "destination": "/editor/index.html" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.wasm",
        "headers": [
          { "key": "Content-Type", "value": "application/wasm" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
        ]
      },
      {
        "source": "/editor/**",
        "headers": [
          { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
          { "key": "Cache-Control", "value": "public, max-age=3600" }
        ]
      }
    ]
  }
}
```

`/api/**` rewrite 가 나머지 SPA fallback(`**`)보다 **앞에** 있어야 API 요청이 `index.html` 로 흡수되지 않는다.

## 버전

- `@rhwp/core` · `@rhwp/editor` 는 **`0.7.3` 고정.** 0.8.x 는 텍스트 배치 회귀(마침표 advance +147%)로 보류 중이니 올리지 말 것. 근거와 재검증 방법은 [`../rhwp-0.8-regression.md`](../rhwp-0.8-regression.md).
- 루트 `package.json` 의 `version` 은 `0.1.0` 이며 빌드·배포 어디에서도 참조하지 않는다(릴리스 태깅 미사용).
