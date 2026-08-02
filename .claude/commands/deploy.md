---
description: rhwp-studio를 Firebase 라이브에 배포 (빌드 → hosting + functions)
---
rhwp-studio 배포 절차를 수행한다. 라이브 프로덕션(`rhwp-studio.web.app`)이므로 신중히.

1. `npm run build` 실행해 통과 확인(tsc + vite). 실패하면 **중단**하고 원인 보고.
2. `node --check functions/index.js`로 함수 문법 확인.
3. 변경 요약과 함께 **프로덕션 라이브 배포 확인을 사용자에게 명시적으로 받는다.** 승인 전에는 배포하지 않는다. ("진행해" 같은 모호한 답이 아니라 배포 의사가 분명할 때만.)
4. 승인 후 `firebase deploy --only hosting,functions` 실행.
   - **함수 변경이 있으면 반드시 `functions` 포함** (CI는 hosting만 배포하므로 함수는 여기서만 갱신됨).
   - 인증 `Premature close`/`Failed to authenticate` 같은 일시 실패면 1회 재시도.
   - ⚠️ **클라우드 세션(`CLAUDE_CODE_REMOTE=true`)이면 `--only hosting` 까지만 가능하다** — 거기 서비스계정은 Hosting 전용이다. 함수 변경이 섞여 있으면 배포하지 말고 **로컬에서 하라고 사용자에게 알린다.**
5. 배포 후 Hosting URL과 함수 업데이트 결과를 보고. `.env`/시크릿이 번들·로그에 노출되지 않았는지 확인.
