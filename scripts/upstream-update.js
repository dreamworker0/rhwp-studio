/**
 * upstream-update.js
 *
 * edwardkim/rhwp upstream 갱신 워크플로우 자동화
 *
 * 실행: npm run upstream:update
 *
 * ─── 수행 단계 ──────────────────────────────────────────────────────────
 * 0. 사전 점검: 클론 존재 / 워킹트리 clean / 브랜치 확인
 * 1. git fetch + 격차 보고 (이번에 들어올 변경 미리보기)
 * 2. main 브랜치 체크아웃 → git pull --ff-only origin main
 * 3. custom/drive-viewer 체크아웃 → git rebase main (커스터마이즈 재적용)
 * 4. npm install (의존성 변경 반영)
 * 5. npm run build (에디터 재빌드 → public/editor/ 로 직접 출력)
 * 6. node scripts/post-build.js (HTML 커스터마이즈 주입)
 *
 * ⚠️ rebase 중 충돌이 발생하면 충돌 파일을 출력하고 중단됩니다.
 *    충돌 해결 후: git add <파일> → git rebase --continue → npm run build:editor
 *
 * 📦 배포는 자동으로 하지 않습니다. 확인 후 직접:
 *    npm run build && firebase deploy
 * ──────────────────────────────────────────────────────────────────────
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EDITOR_ROOT = resolve(ROOT, 'temp_editor');           // 업스트림 클론 루트(.git 위치)
const EDITOR_DIR = resolve(EDITOR_ROOT, 'rhwp-studio');     // rhwp-studio 빌드 디렉터리
const CUSTOM_BRANCH = 'custom/drive-viewer';

/** EDITOR_DIR에서 명령 실행 (출력 그대로 전달) */
function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd, { cwd: EDITOR_DIR, stdio: 'inherit', ...opts });
}

/** 루트에서 명령 실행 */
function runRoot(cmd) {
  console.log(`\n$ ${cmd}  [root]`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

/** git 결과를 문자열로 캡처 (실패 시 빈 문자열) */
function gitOut(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: EDITOR_DIR, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

// ─── 메인 ──────────────────────────────────────────────────────────────
console.log('━'.repeat(60));
console.log('🔄 upstream 갱신 시작: edwardkim/rhwp → main');
console.log('━'.repeat(60));

try {
  // ── [0/6] 사전 점검 ───────────────────────────────────────────────
  console.log('\n[0/6] 사전 점검...');

  if (!existsSync(resolve(EDITOR_ROOT, '.git')) || !existsSync(EDITOR_DIR)) {
    throw new Error(
      `temp_editor 클론을 찾을 수 없습니다 (${EDITOR_ROOT}).\n` +
      '   git clone https://github.com/edwardkim/rhwp.git temp_editor 로 먼저 클론하세요.'
    );
  }

  const dirty = gitOut('status --porcelain');
  if (dirty) {
    console.error('\n   변경되지 않은 워킹트리가 필요합니다. 현재 변경 사항:');
    console.error(dirty.split('\n').map((l) => `     ${l}`).join('\n'));
    throw new Error(
      '워킹트리가 깨끗하지 않습니다. 변경분을 커밋/스태시한 뒤 다시 실행하세요.'
    );
  }

  const currentBranch = gitOut('branch --show-current');
  console.log(`   현재 브랜치: ${currentBranch || '(detached)'}`);
  console.log('   워킹트리: clean ✓');

  // ── [1/6] fetch + 격차 보고 ───────────────────────────────────────
  console.log('\n[1/6] git fetch + 격차 보고...');
  run('git fetch origin main');

  const behind = gitOut('rev-list --count main..origin/main');
  if (behind === '0') {
    console.log('\n   ✅ origin/main 기준 이미 최신입니다 (들어올 변경 없음).');
    console.log('      커스터마이즈 재적용 + 재빌드만 진행합니다.');
  } else {
    console.log(`\n   ── 이번에 들어올 변경 (${behind || '?'}커밋, 최신순) ──`);
    const log = gitOut('log --oneline --no-decorate -30 main..origin/main');
    console.log(log ? log.split('\n').map((l) => `   ${l}`).join('\n') : '   (요약 없음)');
    if (Number(behind) > 30) console.log(`   … 외 ${Number(behind) - 30}개 더`);
  }

  // ── [2/6] main 갱신 ───────────────────────────────────────────────
  console.log('\n[2/6] main 브랜치 갱신 (--ff-only)...');
  run('git checkout main');
  run('git pull --ff-only origin main');

  // ── [3/6] custom 브랜치 rebase ────────────────────────────────────
  console.log(`\n[3/6] ${CUSTOM_BRANCH} 브랜치로 전환 후 rebase...`);
  console.log('      ⚠️  충돌 발생 시 스크립트가 중단됩니다.\n');
  run(`git checkout ${CUSTOM_BRANCH}`);

  try {
    run('git rebase main');
  } catch (rebaseErr) {
    // 충돌 파일 목록 출력 후 안내하며 중단 (rebase 진행 상태 유지)
    const conflicts = gitOut('diff --name-only --diff-filter=U');
    console.error('\n' + '━'.repeat(60));
    console.error('⚠️  rebase 충돌 발생 — 사람이 해결해야 합니다.');
    if (conflicts) {
      console.error('\n   충돌 파일:');
      console.error(conflicts.split('\n').map((f) => `     - ${f}`).join('\n'));
    }
    console.error('\n   해결 절차:');
    console.error(`     1. (cd ${EDITOR_DIR}) 충돌 파일 수동 해결`);
    console.error('     2. git add <파일>');
    console.error('     3. git rebase --continue   (또는 중단: git rebase --abort)');
    console.error('     4. npm run build:editor    (빌드 + 커스터마이즈 주입)');
    console.error('━'.repeat(60));
    process.exit(1);
  }

  // ── [4/6] 의존성 설치 ─────────────────────────────────────────────
  console.log('\n[4/6] 의존성 설치 (npm install)...');
  run('npm install');

  // ── [5/6] 에디터 빌드 (→ public/editor/) ──────────────────────────
  console.log('\n[5/6] 에디터 빌드 (npm run build → public/editor/)...');
  run('npm run build');

  // ── [6/7] post-build (HTML 커스터마이즈 주입) ─────────────────────
  console.log('\n[6/7] post-build: HTML 커스터마이즈 주입...');
  runRoot('node scripts/post-build.js');

  // ── [7/7] 커스텀 연동 검증 (저장→Drive 등이 살아있는지) ────────────
  console.log('\n[7/7] 커스텀 연동 검증 (verify:custom)...');
  console.log('      ⚠️  실패 시 저장 연동이 깨진 것이므로 배포하지 말 것.');
  runRoot('node scripts/verify-custom.js');

  console.log('\n' + '━'.repeat(60));
  console.log('✅ upstream 갱신 완료!');
  console.log('   📦 배포는 수동입니다. 확인 후 다음 명령으로 배포하세요:');
  console.log('      npm run build && firebase deploy');
  console.log('━'.repeat(60));

} catch (e) {
  console.error('\n' + '━'.repeat(60));
  console.error('❌ upstream 갱신 중 오류 발생');
  console.error(`   ${e.message || e}`);
  console.error('━'.repeat(60));
  process.exit(1);
}
