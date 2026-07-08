/**
 * post-build.js
 *
 * upstream(edwardkim/rhwp)의 rhwp-studio를 빌드한 후,
 * public/editor/index.html에 커스터마이즈 코드를 자동 주입합니다.
 *
 * 실행: node scripts/post-build.js
 * (또는 npm run build:editor 에서 자동 호출)
 *
 * ─── 주입 목록 ───────────────────────────────────────────────────────────
 * 1. 미리보기 모드(?mode=view) UI 숨김 스크립트
 *    → #menu-bar, #icon-toolbar, #style-bar 를 CSS로 즉시 숨김
 * 2. fonts 실복사 — upstream의 rhwp-studio/public/fonts는 심볼릭링크라
 *    Windows(core.symlinks=false)에서 15바이트 텍스트 파일로 체크아웃되고,
 *    그대로 산출물에 복사돼 웹폰트 전체 404(OTS 에러)가 됨.
 *    → temp_editor/web/fonts 를 public/editor/fonts 로 실제 복사한다.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync, statSync, rmSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EDITOR_HTML = resolve(ROOT, 'public', 'editor', 'index.html');
const FONTS_SRC = resolve(ROOT, 'temp_editor', 'web', 'fonts');
const FONTS_DEST = resolve(ROOT, 'public', 'editor', 'fonts');

/** fonts가 깨진 심볼릭링크(일반 파일)면 지우고, web/fonts에서 실제 파일로 복사 */
function syncFonts() {
  if (!existsSync(FONTS_SRC)) {
    console.log('  - fonts 동기화: 소스 없음 (temp_editor/web/fonts) — 건너뜀');
    return;
  }
  if (existsSync(FONTS_DEST) && !statSync(FONTS_DEST).isDirectory()) {
    rmSync(FONTS_DEST); // 심볼릭링크가 텍스트 파일로 체크아웃된 잔재 제거
  }
  mkdirSync(FONTS_DEST, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(FONTS_SRC)) {
    const src = resolve(FONTS_SRC, name);
    if (!statSync(src).isFile()) continue;
    const dest = resolve(FONTS_DEST, name);
    if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
    copyFileSync(src, dest);
    copied++;
  }
  const total = readdirSync(FONTS_DEST).length;
  console.log(`  ✓ fonts 동기화: ${copied}개 복사 (총 ${total}개 파일)`);
}

// ─── 주입할 커스터마이즈 블록 ──────────────────────────────────────────
const INJECT_BEFORE_HEAD_CLOSE = `
  <!-- [custom] 미리보기 모드(?mode=view): 편집 UI 숨김 + 본문 읽기전용 -->
  <script>
    if (new URLSearchParams(location.search).get('mode') === 'view') {
      var s = document.createElement('style');
      s.textContent =
        '#menu-bar, #icon-toolbar, #style-bar { display: none !important; }' +
        '.caret, .caret-composition { display: none !important; }';  // 미리보기: 깜빡이는 커서 숨김
      document.head.appendChild(s);

      // 본문 편집 차단(읽기전용): 엔진(input-handler)을 수정하지 않고, 편집 의도
      // 이벤트를 캡처 단계에서 가로채 막는다. (마우스 클릭으로 active=true가 되어도
      // 편집 이벤트 자체가 핸들러에 도달하지 못하므로 수정 불가) — 내비게이션/복사/
      // 찾기/인쇄, 마우스 선택은 그대로 허용한다.
      var stop = function (e) { e.stopImmediatePropagation(); e.preventDefault(); };
      window.addEventListener('beforeinput', stop, true);  // 타이핑/IME/붙여넣기 삽입
      window.addEventListener('paste', stop, true);
      window.addEventListener('cut', stop, true);
      window.addEventListener('drop', stop, true);
      window.addEventListener('keydown', function (e) {
        var k = e.key;
        var nav = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End',
                   'PageUp','PageDown','Escape','Tab','Shift','Control','Alt','Meta'];
        if (nav.indexOf(k) !== -1) return;                 // 내비게이션 허용
        if (e.ctrlKey || e.metaKey) {
          if (['c','a','f','p'].indexOf(String(k).toLowerCase()) !== -1) return; // 복사/전체선택/찾기/인쇄 허용
          return stop(e);                                  // 그 외 Ctrl 조합(붙여넣기/잘라내기/실행취소 등) 차단
        }
        if (k && k.length === 1) return stop(e);           // 인쇄 가능한 문자 입력 차단
        if (['Enter','Backspace','Delete'].indexOf(k) !== -1) return stop(e); // 줄바꿈/삭제 차단
      }, true);
    }
  </script>`;
// ───────────────────────────────────────────────────────────────────────

function injectCustomizations(html) {
  let result = html;
  let patchCount = 0;

  // 1. 미리보기 모드 UI 숨김 — </head> 바로 앞에 삽입
  if (!result.includes('[custom] 미리보기 모드')) {
    result = result.replace('</head>', `${INJECT_BEFORE_HEAD_CLOSE}\n</head>`);
    patchCount++;
    console.log('  ✓ 미리보기 모드 UI 숨김 스크립트 주입');
  } else {
    console.log('  - 미리보기 모드 스크립트: 이미 존재 (건너뜀)');
  }

  return { result, patchCount };
}

// ─── 메인 ──────────────────────────────────────────────────────────────
console.log('\n🔧 post-build: public/editor/index.html 커스터마이즈 주입 시작');
console.log(`   대상: ${EDITOR_HTML}\n`);

try {
  syncFonts();

  const original = readFileSync(EDITOR_HTML, 'utf-8');
  const { result, patchCount } = injectCustomizations(original);

  if (patchCount > 0) {
    writeFileSync(EDITOR_HTML, result, 'utf-8');
    console.log(`\n✅ post-build 완료: ${patchCount}개 패치 적용됨`);
  } else {
    console.log('\n✅ post-build 완료: 새로 적용된 패치 없음 (모두 이미 존재)');
  }
} catch (e) {
  console.error('\n❌ post-build 실패:', e.message);
  console.error('   public/editor/index.html 파일이 존재하는지 확인하세요.');
  process.exit(1);
}
