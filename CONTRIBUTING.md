# 기여 가이드 (Contributing)

rhwp-studio에 관심 가져주셔서 감사합니다! 버그 제보, 기능 제안, 코드 기여 모두 환영합니다.

## 시작하기

```bash
# 1. 저장소 포크 후 클론
git clone https://github.com/<your-username>/rhwp-studio.git
cd rhwp-studio

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env   # VITE_GOOGLE_CLIENT_ID 값 채우기

# 4. 개발 서버 (https://localhost:5173)
npm run dev
```

> WASM `SharedArrayBuffer` 사용을 위해 HTTPS가 필수입니다. `vite-plugin-mkcert`가
> 로컬 인증서를 자동 생성합니다.

## 버그 제보 / 기능 제안

- 먼저 [기존 이슈](https://github.com/dreamworker0/rhwp-studio/issues)에 중복이 없는지 확인해주세요.
- 새 이슈는 제공되는 템플릿(버그 리포트 / 기능 제안)에 맞춰 작성해주세요.
- 버그는 **재현 방법**과 **환경(브라우저/OS)**, 가능하면 **샘플 파일**을 함께 남겨주시면 큰 도움이 됩니다.

## Pull Request

1. `master`에서 작업 브랜치를 만듭니다. (예: `fix/save-403`, `feat/export-pdf`)
2. 변경 전 반드시 빌드가 통과하는지 확인합니다.
   ```bash
   npm run build
   ```
3. 커밋 메시지는 아래 컨벤션을 따릅니다.
   - `feat:` 새 기능
   - `fix:` 버그 수정
   - `docs:` 문서
   - `refactor:` 리팩터링
   - `chore:` 빌드/설정 등 기타
4. PR 설명에 **무엇을, 왜** 바꿨는지와 관련 이슈 번호(`#123`)를 적어주세요.
5. UI 변경은 가능하면 스크린샷을 첨부해주세요.

## 코드 스타일

- TypeScript 기준이며, 주변 코드의 네이밍/들여쓰기/주석 밀도를 따라주세요.
- 기존에 있는 유틸/컴포넌트를 우선 재사용하고, 불필요한 의존성 추가는 지양합니다.

## 라이선스

기여하신 코드는 이 프로젝트의 [MIT License](./LICENSE)를 따릅니다.
PR을 제출하면 해당 라이선스로 배포되는 데 동의하는 것으로 간주합니다.
