# rhwp-studio 운영 문서

이 폴더는 rhwp-studio HWP 웹 에디터의 운영/관리를 위한 문서를 포함합니다.

## 문서 목록

| 파일 | 설명 |
|------|------|
| [SKILL.md](./SKILL.md) | 빌드/배포/디버깅 종합 운영 지침서 |
| [architecture.md](./architecture.md) | 아키텍처 개요, 데이터 흐름, OAuth 설정 |
| [deployment.md](./deployment.md) | Firebase 배포 절차, 체크리스트, 롤백 방법 |
| [troubleshooting/guide.md](./troubleshooting/guide.md) | 에러별 원인 및 해결 가이드 |

## 관련 문서

| 파일 | 위치 | 설명 |
|------|------|------|
| 구현계획서 | [`../../rhwp_구현계획서.md`](../../rhwp_구현계획서.md) | 프로그램 전체 설명 (11개 챕터) |
| Firebase 설정 | [`../../firebase.json`](../../firebase.json) | Hosting 설정 (WASM 헤더, 라우팅) |
| Vite 설정 | [`../../temp_editor/rhwp-studio/vite.config.ts`](../../temp_editor/rhwp-studio/vite.config.ts) | 빌드 설정 |

## 빠른 참조

```bash
# 개발 서버
cd d:\apps\rhwp\temp_editor\rhwp-studio && npm run dev

# 빌드
npm run build

# 배포
cd d:\apps\rhwp && firebase deploy --only hosting

# E2E 테스트
cd d:\apps\rhwp\temp_editor\rhwp-studio && node e2e/scenario-runner.mjs
```
