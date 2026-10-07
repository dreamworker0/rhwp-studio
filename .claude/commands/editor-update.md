---
description: upstream 에디터를 temp_editor에서 재생성 (public/editor/ 갱신)
---
에디터 서브모듈 갱신 절차. **`public/editor/`는 산출물이라 직접 수정 금지** — 반드시 이 절차로만 재생성한다.

1. `npm run upstream:check`로 upstream 변경 여부 확인.
2. `temp_editor/`는 **별도 git repo**이며 custom 브랜치(예: custom/drive-viewer)에 우리 커스터마이즈가 있다. **재생성 전 `temp_editor`에 미커밋 변경이 있으면 먼저 거기서 커밋**하라 — 스크립트가 dirty 워킹트리에서는 중단한다.
3. `npm run upstream:update` 실행(main에 upstream ff → custom 브랜치에 **`git merge main`** → 에디터 빌드 + `public/editor` 재생성 + verify:custom).
   - 머지 충돌로 멈추면: `temp_editor`에서 충돌 해결 → `git add` → `git commit` → **같은 명령 재실행**(머지는 건너뛰고 빌드부터 이어감).
   - ⚠️ 커스텀 라벨에 upstream `data-i18n`이 붙으면 `initI18n()`이 덮어쓴다 → 속성 제거.
4. `npm run verify:custom`으로 커스텀 패치가 유지됐는지 확인.
5. `npm run build`로 통합 빌드 통과 확인, 이어서 **`npm run smoke`** (에디터 tsc는 게이트가 아니라 머지 잔재는 런타임에서만 잡힌다). 버전이 올랐으면 `render:compare`로 렌더 회귀 확인(CLAUDE.md).
6. 변경된 `public/editor` 산출물을 커밋. 배포는 `/deploy`로.

문제가 생기면 어느 단계에서 멈췄는지와 출력 그대로 보고하고, 임의로 `public/editor`를 직접 손대지 말 것.
