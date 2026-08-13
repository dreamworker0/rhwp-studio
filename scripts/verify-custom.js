/**
 * verify-custom.js
 *
 * 빌드된 에디터 번들(public/editor)에 "우리 커스텀 연동"이 살아있는지 검증한다.
 *
 * 실행: npm run verify:custom
 * (upstream:update / build:editor 끝에서 자동 호출됨)
 *
 * ─── 배경 ────────────────────────────────────────────────────────────────
 * 우리 커스텀(Drive 저장/미리보기/자동저장)은 upstream(edwardkim/rhwp)이 계속
 * 고치는 파일(file.ts·main.ts) 안에 들어있다. upstream 갱신 시 rebase가 이 패치를
 * "충돌 없이" upstream 버전으로 덮어써도 경고가 없어, 저장 버튼이 조용히 깨질 수 있다.
 * (실제로 0.7.3→0.7.17 갱신 때 저장 버튼이 로컬 저장으로 바뀐 사고가 있었다.)
 *
 * 이 스크립트는 그 사고를 "사용자가 발견"이 아니라 "배포 전 자동 발견"으로 바꾼다.
 * 실제 배포 산출물(public/editor)에서 식별 문자열을 찾으므로 minify에도 견딘다.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EDITOR_OUT = resolve(ROOT, 'public', 'editor');
const ASSETS_DIR = resolve(EDITOR_OUT, 'assets');
const INDEX_HTML = resolve(EDITOR_OUT, 'index.html');

/** assets/*.js 전체를 하나의 문자열로 합쳐 반환 (없으면 빈 문자열) */
function readAllBundleJs() {
  if (!existsSync(ASSETS_DIR)) return '';
  return readdirSync(ASSETS_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => {
      try {
        return readFileSync(join(ASSETS_DIR, f), 'utf-8');
      } catch {
        return '';
      }
    })
    .join('\n');
}

const indexHtml = existsSync(INDEX_HTML) ? readFileSync(INDEX_HTML, 'utf-8') : '';
const bundleJs = readAllBundleJs();

// ─── 검사 항목 ──────────────────────────────────────────────────────────
// needle: 빌드 산출물에 반드시 존재해야 하는 식별 문자열 (minify에도 보존되는 것)
const checks = [
  {
    name: '저장 버튼 → Drive (file:save 임베디드 전송)',
    haystack: bundleJs,
    needle: '부모 창(Drive)으로 전송',
    hint:
      'saveCurrentDocument()의 "임베디드면 부모창으로 type:save 전송" 패치가 사라졌습니다.\n' +
      '      upstream 로컬저장(File System Access)으로 덮였을 가능성 → 저장 버튼이 Drive에 저장 안 됨.\n' +
      '      복구: temp_editor/rhwp-studio/src/command/commands/file.ts 의 saveCurrentDocument 에\n' +
      '            isEmbedded → window.parent.postMessage({type:\'save\', ...}) 분기를 다시 넣고 재빌드.',
  },
  {
    name: '닫기 전 저장용 export RPC (부모가 exportHwpx로 pull)',
    haystack: bundleJs,
    needle: 'exportHwpx',
    hint:
      "임베드 런타임에 exportHwpx 핸들러가 없습니다 → 부모(DriveOpen)의 '닫기 전 저장' pull 불가.\n" +
      '      0.8.0부터 닫기-저장은 커스텀 exportFile 대신 upstream exportHwp/exportHwpx RPC를 쓴다.',
  },
  {
    name: '임베디드 자동 저장 → Drive',
    haystack: bundleJs,
    needle: '부모 창으로 자동 저장',
    hint:
      'auto-save 경로(부모창 type:save 전송)가 사라졌거나 startAutoSave 호출이 빠졌습니다.',
  },
  {
    name: '미리보기 모드 UI 숨김 주입(post-build)',
    haystack: indexHtml,
    needle: '[custom] 미리보기 모드',
    hint:
      'post-build 주입이 적용되지 않았습니다 → ?mode=view 미리보기에서 편집 UI가 노출됨.\n' +
      '      복구: node scripts/post-build.js 실행 여부 확인.',
  },
];

// 네거티브 검사: 빌드 산출물에 "있으면 안 되는" 문자열 (upstream 기능이 되살아났는지 감지)
const negativeChecks = [
  {
    name: 'HWPX 변환저장 안내 배너 비활성화 유지',
    haystack: bundleJs,
    needle: 'HWPX 변환 저장 모드',
    hint:
      'upstream #888 HWPX→HWP 변환저장 안내 배너가 되살아났습니다 (미리보기 전용 정책과 충돌).\n' +
      '      복구: temp_editor/rhwp-studio/src/main.ts 의 notifyHwpxSaveModeIfNeeded()를 다시 no-op으로.',
  },
];

// ─── 실행 ──────────────────────────────────────────────────────────────
console.log('━'.repeat(60));
console.log('🔎 커스텀 연동 검증: public/editor 빌드 산출물');
console.log('━'.repeat(60));

if (!existsSync(EDITOR_OUT) || (!bundleJs && !indexHtml)) {
  console.error('\n❌ public/editor 빌드 산출물을 찾을 수 없습니다.');
  console.error(`   기대 경로: ${EDITOR_OUT}`);
  console.error('   먼저 에디터를 빌드하세요 (npm run build:editor).');
  process.exit(1);
}

let failed = 0;
for (const c of checks) {
  const ok = c.haystack.includes(c.needle);
  console.log(`\n${ok ? '✅' : '❌'} ${c.name}`);
  console.log(`     있어야 할 문자열: "${c.needle}"`);
  if (!ok) {
    failed++;
    console.log(`     ⚠️  ${c.hint}`);
  }
}

for (const c of negativeChecks) {
  const present = c.haystack.includes(c.needle);
  console.log(`\n${present ? '❌' : '✅'} ${c.name}`);
  console.log(`     없어야 할 문자열: "${c.needle}"`);
  if (present) {
    failed++;
    console.log(`     ⚠️  ${c.hint}`);
  }
}

console.log('\n' + '━'.repeat(60));
if (failed > 0) {
  console.error(`❌ 검증 실패: ${failed}/${checks.length} 항목이 빌드 산출물에서 사라졌습니다.`);
  console.error('   배포하지 마세요. 위 안내대로 커스텀 패치를 복구한 뒤 재빌드하세요.');
  console.log('━'.repeat(60));
  process.exit(1);
}
console.log(`✅ 검증 통과: ${checks.length}개 커스텀 연동 모두 정상.`);
console.log('━'.repeat(60));
