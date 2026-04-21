# rhwp-studio 배포 가이드

## 배포 환경

| 항목 | 값 |
|------|-----|
| 호스팅 | Firebase Hosting |
| 프로젝트 ID | `rhwp-studio` |
| 프로덕션 URL | https://rhwp-studio.web.app |
| 에디터 경로 | `/editor/` |
| 콘솔 URL | https://console.firebase.google.com/project/rhwp-studio/hosting |

## 배포 절차

### 표준 배포

```bash
# 1. 빌드 (TypeScript → Vite → dist/editor/)
cd d:\apps\rhwp\temp_editor\rhwp-studio
npm run build

# 2. 빌드 결과 확인
ls d:\apps\rhwp\dist\editor\
# → index.html, assets/(*.js, *.css, *.wasm), rhwp.js, rhwp_bg.wasm, fonts/, images/, samples/

# 3. Firebase 배포
cd d:\apps\rhwp
firebase deploy --only hosting

# 4. 배포 확인
# → https://rhwp-studio.web.app/editor/ 접속
```

### WASM 업데이트 포함 배포

```bash
# 1. 새 WASM 파일 복사
cp d:\apps\rhwp\temp_editor\pkg\rhwp.js d:\apps\rhwp\temp_editor\rhwp-studio\public\
cp d:\apps\rhwp\temp_editor\pkg\rhwp_bg.wasm d:\apps\rhwp\temp_editor\rhwp-studio\public\

# 2~4. 위와 동일
```

### 긴급 롤백

Firebase Console에서:
1. Hosting → Release history
2. 이전 정상 버전의 "..." 메뉴 → "Rollback"

또는 CLI:
```bash
firebase hosting:clone rhwp-studio:<previous-version-id> rhwp-studio:live
```

## 배포 전 체크리스트

- [ ] `npm run build` 성공 (TypeScript + Vite 에러 없음)
- [ ] `dist/editor/` 폴더에 WASM 파일 존재 확인
- [ ] `firebase.json` WASM 헤더 규칙 유지 확인
- [ ] 로컬 테스트 (`npm run dev`) 정상 동작
- [ ] E2E 테스트 실행 (최소 `text-flow.test.mjs`)

## firebase.json 핵심 설정

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
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

## 버전 관리

- `package.json`의 `version` 필드로 관리 (현재: `0.7.3`)
- 빌드 시 `__APP_VERSION__` 전역 상수로 주입
- 에디터 정보 대화상자(About)에서 표시
