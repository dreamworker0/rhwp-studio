# rhwp-studio 운영 문서

rhwp-studio 는 한글 문서(.hwp/.hwpx)를 Google Drive 와 연동해 열람·편집하는 웹앱이다.
이 폴더는 그 운영·관리 문서를 모아둔다.

## 문서 목록

| 파일 | 설명 | 상태 |
|------|------|------|
| [SKILL.md](./SKILL.md) | 운영 지침서 — 프로젝트 구조, 인증 흐름, iframe 브릿지, 워크플로 | 최신 |
| [deployment.md](./deployment.md) | 배포 절차, 체크리스트, 환경별 가능/불가, 롤백 | 최신 |
| [architecture.md](./architecture.md) | 아키텍처 개요, 데이터 흐름 | ⚠️ 낡음 |
| [troubleshooting/guide.md](./troubleshooting/guide.md) | 에러별 원인·해결 가이드 | ⚠️ 낡음 |

> ⚠️ 표시된 두 문서에는 이 레포가 **에디터 포크**였던 시절(`temp_editor/rhwp-studio` 가 곧 앱이던 구조)의
> 내용이 남아 있다. 경로·모듈 구성·인증 방식이 지금과 다르므로 그대로 따르지 말 것.
> 현재 기준 정보는 [SKILL.md](./SKILL.md) 와 루트 `CLAUDE.md` 에 있다.

## 관련 문서

| 문서 | 위치 | 설명 |
|------|------|------|
| 프로젝트 규칙 | [`../../CLAUDE.md`](../../CLAUDE.md) | 스택·구조·날카로운 모서리 요약 (가장 먼저 볼 것) |
| 배포 커맨드 | [`../../.claude/commands/deploy.md`](../../.claude/commands/deploy.md) | 배포 절차 정본 (`/deploy`) |
| 에디터 갱신 커맨드 | [`../../.claude/commands/editor-update.md`](../../.claude/commands/editor-update.md) | 에디터 재생성 절차 정본 (`/editor-update`) |
| 0.8 회귀 분석 | [`../rhwp-0.8-regression.md`](../rhwp-0.8-regression.md) | `@rhwp` 0.8.x 보류 근거·실측·재검증 방법 |
| 구현계획서 | [`../../rhwp_구현계획서.md`](../../rhwp_구현계획서.md) | 프로그램 전체 설명 |
| 기여 가이드 | [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) | |
| Firebase 설정 | [`../../firebase.json`](../../firebase.json) | Hosting 라우팅·WASM/COEP 헤더 |
| Vite 설정 | [`../../vite.config.ts`](../../vite.config.ts) | 빌드 설정, Sentry 소스맵 |

## 빠른 참조

모든 명령은 **레포 루트**에서 실행한다(로컬 `D:\apps\rhwp`).

```bash
npm run dev              # 개발 서버 → https://localhost:5173
npm run build            # tsc + vite → dist/  (유일한 자동 검증 수단)
npm run smoke            # 에디터 스모크 테스트 (로컬 전용)
node --check functions/index.js

# 배포 — Hosting 은 master 푸시 시 CI 가 자동 배포한다.
# 함수는 CI 가 배포하지 않으므로 로컬에서 수동으로:
firebase deploy --only functions
```
