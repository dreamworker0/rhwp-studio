---
description: upstream 에디터를 temp_editor에서 재생성 (public/editor/ 갱신)
---
에디터 서브모듈 갱신 절차. **`public/editor/`는 산출물이라 직접 수정 금지** — 반드시 이 절차로만 재생성한다.

1. `npm run upstream:check`로 upstream 변경 여부 확인.
2. `temp_editor/`는 **별도 git repo**이며 custom 브랜치(예: custom/drive-viewer)에 우리 커스터마이즈가 있다. **재생성 전 `temp_editor`에 미커밋 변경이 있으면 먼저 거기서 커밋**하라 — 안 하면 rebase 시 유실됨.
3. `npm run upstream:update` 실행(upstream rebase + 에디터 빌드 + `public/editor` 재생성).
4. `npm run verify:custom`으로 커스텀 패치가 유지됐는지 확인.
5. `npm run build`로 통합 빌드 통과 확인.
6. 변경된 `public/editor` 산출물을 커밋. 배포는 `/deploy`로.

문제가 생기면 어느 단계에서 멈췄는지와 출력 그대로 보고하고, 임의로 `public/editor`를 직접 손대지 말 것.
