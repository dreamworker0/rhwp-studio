# `@rhwp/*` 0.8.x 업그레이드 보류 — 텍스트 배치 회귀

**결론: `@rhwp/core`·`@rhwp/editor` 는 `0.7.3` 에 고정한다. 업스트림이 고치기 전까지 올리지 않는다.**

업스트림 이슈: 제출 예정 ([edwardkim/rhwp](https://github.com/edwardkim/rhwp/issues) — 번호 확정 시 이 줄을 갱신할 것)

---

## 증상

문단 앞부분(번호·마침표 등 라틴/구두점 구간)에서 **공백 한 칸이 삽입된 것처럼** 이후 텍스트가 오른쪽으로 밀린다. 점선 리더(`·`)가 이어지는 줄은 편차가 누적돼 줄 끝에서 최대 **약 30px** 까지 벌어진다.

우리 앱과 업스트림 데모 양쪽에서 동일하게 재현된다. 즉 **우리 통합 문제가 아니라 업스트림 회귀**다.

## 실측

`public/editor/samples/biz_plan.hwp` 1페이지를 두 버전으로 `renderPageSvg(1)` 한 뒤, `<text>` 글리프를 순서대로 1:1 대응시켜 비교했다.

글리프 642개, **텍스트 내용은 100% 일치**(문서 모델은 동일). 그런데 **631개(98.4%)** 의 x 좌표가 어긋난다.

| 글자 | font-size | 0.7.3 | 0.8.2 | 차이 |
|---|---|---|---|---|
| `.` | 18.7 | 5.97 | **14.76** | **+8.79 (+147%)** |
| `-` | 26.7 | 28.00 | 35.55 | +7.55 (+27%) |
| `1`~`7` | 18.7 | 10.27 | 10.88 | +0.61 (+6%) |
| `·` | 18.7 | 5.97 | 6.21 | +0.24 (+4%) |
| `사`,`업`,`목`,`기`,`간` … | 18.7 | 18.11 | 18.11 | **0 (동일)** |

**CJK 는 정확히 일치하고 라틴·구두점만 어긋난다.** 마침표 하나가 공백 한 칸 폭만큼 넓어지는 것이 "한 칸 밀림" 의 정체다.

`1.사업명·····…` 줄:

```
글리프   x(0.7.3)   x(0.8.2)   Δx
"1"      68.03      68.03      0.00
"."      78.29      78.91     +0.61
"사"      84.27      93.67     +9.40   ← 마침표 뒤에서 한 칸만큼 밀림
"업"     111.71     121.11     +9.40
"명"     139.15     148.55     +9.40
"·"     157.25     166.65     +9.40
"·"     163.23     172.87     +9.64   ← 리더마다 +0.24 누적
 …                             …
(줄 끝)                        +29.80
```

`footnote-01.hwp` 1페이지는 더 심하다. 배치 차이가 줄바꿈 위치까지 바꿔서 **글리프 수 자체가 500 → 522** 로 달라지고, 최대 Δx 는 **33.85px**. 여기서는 CJK 도 일부 어긋난다(`에`,`른`,`는`,`적`,`와` @21.3: 26.67 → 32.00, +20%).

## 원인

`rhwp.js` 의 wasm-bindgen import 를 비교하면 **글자폭 계측 방식이 바뀌었다.**

**0.7.3 — 호스트에 계측을 위임**

```js
__wbg_measureTextWidth_0962d94b80b2a16a: function(arg0, arg1, arg2, arg3) {
  const ret = globalThis.measureTextWidth(
    getStringFromWasm0(arg0, arg1),   // fontSpec
    getStringFromWasm0(arg2, arg3),   // text
  );
  ...
}
```

스튜디오는 이 콜백을 `ctx.font = <SVG 에 넣을 폰트 스택>; ctx.measureText(text).width` 로 구현한다. **계측에 쓴 폰트와 렌더링할 폰트가 같은 문자열**이므로 배치가 항상 자기 일관적이다.

**0.8.2 — 내부 메트릭으로만 계산**

`measureTextWidth` 참조가 **0개**. Chromium 에서 `renderPageSvg()` 실행 중 `CanvasRenderingContext2D` 와 `OffscreenCanvasRenderingContext2D` 양쪽의 `font` setter 및 `measureText` 를 후킹해 계수한 결과:

```
ctx.font 설정 횟수 : 0
measureText 호출   : 0
```

렌더 경로에서 **브라우저 폰트 계측을 전혀 하지 않는다.** 배치는 WASM 내장 메트릭으로만 계산된다(`rhwp_bg.wasm` 3.68 MB → 7.19 MB).

그런데 출력 SVG 에는 여전히 브라우저가 해석할 폰트 스택이 찍히고, 0.8.2 에서 이게 크게 확장됐다:

```
0.7.3: 함초롬바탕,'Batang','바탕','AppleMyungjo','Noto Serif KR',serif
0.8.2: 함초롬바탕,'Batang','바탕','Nanum Myeongjo','AppleMyungjo','Noto Serif KR',
       'Noto Serif CJK KR','HCR Batang Ext-B','함초롬바탕 확장B','HCR Batang Ext',
       '함초롬바탕 확장','HCR Batang','함초롬바탕','Source Han Serif K Old Hangul',serif
```

**배치는 내부 메트릭, 렌더는 브라우저가 고른 폰트** — 둘이 다르면 글리프가 어긋난다. 시스템마다 폰트 해석 결과가 달라지므로 데모 사이트와 임베드 앱 양쪽에서 재현되는 것과도 일치한다. CJK 는 em 정사각 폭이라 대체로 맞고, 폭이 제각각인 라틴·구두점에서 오차가 두드러진다.

## 우회 불가

`renderer: 'canvas2d'` 옵션으로도 안 된다. 계측 자체가 WASM 내부로 들어간 구조라 호스트가 개입할 지점이 없다.

## 업스트림이 고쳤을 때 — 검증 방법

`scripts/rhwp-version-diff.mjs` 로 눈이 아니라 숫자로 확인한다.

```bash
npm i rhwpnext@npm:@rhwp/core@0.8.3           # 검증할 버전을 별칭으로 설치
npm i -D playwright-core                       # 최초 1회
node scripts/rhwp-version-diff.mjs public/editor/samples/biz_plan.hwp 1 --b=node_modules/rhwpnext
node scripts/rhwp-version-diff.mjs public/editor/samples/footnote-01.hwp 1 --b=node_modules/rhwpnext
```

`✅ 배치 동일 — 회귀 없음.` (exit 0) 이 나오면 통과. 그때 비로소 업그레이드를 진행한다.

업그레이드 시에는 **npm 패키지만 올리면 안 된다.** `public/editor/` 도 같은 세대로 재생성해야 한다 — 0.8 의 `@rhwp/editor` 는 iframe 과 capability 협상(v1 handshake, `handshakeTimeoutMs` 기본 1000ms)을 하고, 스튜디오가 `renderer-diagnostics-v1` / `notify-saved-v1` 을 광고하지 않으면 legacy 로 강등된다. 절차는 `/editor-update` (로컬 전용).

## 참고 — 함께 확인한 사실

- `@rhwp/editor` 0.8 의 API 변화는 **순수 추가형**이다(`exportHwp/Hwpx/Hml`, `getHmlSaveState`, `exportHwpVerify`, `notifySaved`, `getRendererDiagnostics`, `loadFile(..., options)`). `RhwpEditor` 가 `private constructor` 가 됐지만 우리는 `createEditor()` 만 쓰므로 무관하다.
- 같은 API 추가분은 대부분 이미 `0.7.19` 에도 들어와 있다. 0.7 라인 내 업그레이드(`0.7.3` → `0.7.19`)는 별개 선택지지만, 그 사이에 같은 회귀가 들어왔는지 미검증이다. 올리려면 위 스크립트로 먼저 확인할 것.
- `renderPageSvg()` 의 페이지 인덱스는 0.7.3 과 0.8.2 가 다르게 동작한다(0.7.3 은 일부 인덱스에서 `measureTextWidth` 부재 시 throw). 비교 시 같은 페이지 번호를 명시할 것.
