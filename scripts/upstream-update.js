/**
 * upstream-update.js
 *
 * edwardkim/rhwp upstream 갱신 워크플로우 자동화
 *
 * 실행: npm run upstream:update
 *
 * ─── 수행 단계 ──────────────────────────────────────────────────────────
 * 0. 사전 점검: 클론 존재 / 워킹트리 clean / 진행 중인 머지·rebase 없음
 * 1. git fetch + 격차 보고 (이번에 들어올 변경 미리보기)
 * 2. main 브랜치 체크아웃 → git pull --ff-only origin main
 * 3. custom/drive-viewer 체크아웃 → git merge main (커스터마이즈 위에 upstream 병합)
 * 4. npm install (의존성 변경 반영)
 * 5. sync-wasm (pkg/ ↔ npm @rhwp/core 버전 일치)
 * 6. npm run build (에디터 재빌드 → public/editor/ 로 직접 출력)
 * 7. node scripts/post-build.js (HTML 커스터마이즈 주입)
 * 8. node scripts/verify-custom.js (커스텀 연동 검증)
 *
 * ─── 왜 rebase 가 아니라 merge 인가 ─────────────────────────────────────
 * custom 브랜치의 실제 관행은 머지다(0.7.18·0.8.2·0.8.4·0.8.6·0.8.7 전부 git merge).
 * rebase 는 2026-04 최초 커스텀 커밋부터 다시 재생해 그간 머지 커밋에서 해둔 충돌
 * 재조정을 전부 버린다 — 0.8.6 때 rebase 는 첫 커밋에서만 14헝크(+남은 5커밋),
 * 머지는 7파일 1헝크씩이었다.
 *
 * ⚠️ 머지 충돌이 나면 충돌 파일을 출력하고 중단합니다(머지 진행 상태 유지).
 *    충돌 해결 후: git add <파일> → git commit → npm run upstream:update 재실행
 *    (재실행하면 "Already up to date" 로 머지를 건너뛰고 빌드 단계부터 이어간다)
 *
 * ⚠️ 에디터 빌드의 tsc 는 게이트가 아니다(TypeScript 7/tsgo 가 타입 오류에도 exit 0).
 *    머지 잔재는 런타임에서만 드러나므로 끝나면 반드시 npm run smoke 를 돌릴 것.
 *
 * 📦 배포는 자동으로 하지 않습니다. 확인 후 /deploy 로.
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

// temp_editor 는 다른 Windows 계정 소유로 클론돼 git 이 "dubious ownership" 으로 거부한다.
// 전역 safe.directory 를 건드리지 않고 이 스크립트의 git 호출에만 예외를 준다.
const GIT = `git -c safe.directory="${EDITOR_ROOT.replace(/\\/g, '/')}" -c merge.renameLimit=20000`;

/** EDITOR_DIR에서 명령 실행 (출력 그대로 전달) */
function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd.replace(/^git /, `${GIT} `), { cwd: EDITOR_DIR, stdio: 'inherit', ...opts });
}

/** 루트에서 명령 실행 */
function runRoot(cmd) {
  console.log(`\n$ ${cmd}  [root]`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

/** git 결과를 문자열로 캡처 (실패 시 빈 문자열 — 판정에 쓰지 말 것) */
function gitOut(cmd) {
  try {
    return gitStrict(cmd);
  } catch {
    return '';
  }
}

/** git 결과를 문자열로 캡처 (실패 시 예외) — 사전 점검처럼 실패를 "정상"으로 오인하면 안 되는 곳에 */
function gitStrict(cmd) {
  return execSync(`${GIT} ${cmd}`, { cwd: EDITOR_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** 브랜치의 rhwp-studio 버전 (머지 메시지·보고용) */
function studioVersion(ref) {
  try {
    return JSON.parse(gitStrict(`show ${ref}:rhwp-studio/package.json`)).version;
  } catch {
    return '?';
  }
}

// ─── 메인 ──────────────────────────────────────────────────────────────
console.log('━'.repeat(60));
console.log(`🔄 upstream 갱신 시작: edwardkim/rhwp main → ${CUSTOM_BRANCH} (merge)`);
console.log('━'.repeat(60));

try {
  // ── [0/8] 사전 점검 ───────────────────────────────────────────────
  console.log('\n[0/8] 사전 점검...');

  if (!existsSync(resolve(EDITOR_ROOT, '.git')) || !existsSync(EDITOR_DIR)) {
    throw new Error(
      `temp_editor 클론을 찾을 수 없습니다 (${EDITOR_ROOT}).\n` +
      '   git clone https://github.com/edwardkim/rhwp.git temp_editor 로 먼저 클론하세요.'
    );
  }

  // gitOut 은 실패를 빈 문자열로 삼켜 "clean" 으로 오인한다 → 여기서는 strict.
  const gitDir = gitStrict('rev-parse --absolute-git-dir');
  if (existsSync(resolve(gitDir, 'MERGE_HEAD'))) {
    throw new Error(
      '진행 중인 머지가 있습니다. 충돌을 해결해 git commit 하거나 git merge --abort 한 뒤 다시 실행하세요.'
    );
  }
  if (existsSync(resolve(gitDir, 'rebase-merge')) || existsSync(resolve(gitDir, 'rebase-apply'))) {
    throw new Error('진행 중인 rebase 가 있습니다. git rebase --abort 로 정리한 뒤 다시 실행하세요.');
  }

  const dirty = gitStrict('status --porcelain');
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

  // ── [1/8] fetch + 격차 보고 ───────────────────────────────────────
  console.log('\n[1/8] git fetch + 격차 보고...');
  run('git fetch --tags origin main');

  const behind = gitOut('rev-list --count main..origin/main');
  if (behind === '0') {
    console.log('\n   ✅ origin/main 기준 이미 최신입니다 (들어올 변경 없음).');
  } else {
    console.log(`\n   ── 이번에 들어올 변경 (${behind || '?'}커밋, 최신순) ──`);
    const log = gitOut('log --oneline --no-decorate -30 main..origin/main');
    console.log(log ? log.split('\n').map((l) => `   ${l}`).join('\n') : '   (요약 없음)');
    if (Number(behind) > 30) console.log(`   … 외 ${Number(behind) - 30}개 더`);
  }

  // ── [2/8] main 갱신 ───────────────────────────────────────────────
  console.log('\n[2/8] main 브랜치 갱신 (--ff-only)...');
  run('git checkout main');
  run('git pull --ff-only origin main');

  // ── [3/8] custom 브랜치에 main 머지 ───────────────────────────────
  console.log(`\n[3/8] ${CUSTOM_BRANCH} 브랜치로 전환 후 main 머지...`);
  console.log('      ⚠️  충돌 발생 시 스크립트가 중단됩니다.\n');
  run(`git checkout ${CUSTOM_BRANCH}`);

  const fromVer = studioVersion('HEAD');
  const toVer = studioVersion('main');
  const pending = gitOut(`rev-list --count HEAD..main`);
  if (pending === '0') {
    console.log(`   ✅ main 이 이미 병합돼 있습니다 (${toVer}). 빌드 단계로 넘어갑니다.`);
  } else {
    const msg = `Merge main (${toVer}) — upstream 갱신 + 커스텀 재부착 (${fromVer}→${toVer})`;
    try {
      run(`git merge --no-ff --no-edit -m "${msg}" main`);
    } catch (mergeErr) {
      // 충돌 파일 목록 출력 후 안내하며 중단 (머지 진행 상태 유지)
      const conflicts = gitOut('diff --name-only --diff-filter=U');
      console.error('\n' + '━'.repeat(60));
      console.error('⚠️  머지 충돌 발생 — 사람이 해결해야 합니다.');
      if (conflicts) {
        console.error('\n   충돌 파일:');
        console.error(conflicts.split('\n').map((f) => `     - ${f}`).join('\n'));
      }
      console.error('\n   해결 절차:');
      console.error(`     1. (cd ${EDITOR_ROOT}) 충돌 파일 수동 해결`);
      console.error('        ⚠️ 커스텀 라벨에 upstream data-i18n 이 붙으면 initI18n() 이 덮어쓴다 → 속성 제거');
      console.error('     2. git add <파일>');
      console.error('     3. git commit              (또는 중단: git merge --abort)');
      console.error('     4. npm run upstream:update (머지는 건너뛰고 빌드부터 이어감)');
      console.error('━'.repeat(60));
      process.exit(1);
    }
  }

  // ── [4/8] 의존성 설치 ─────────────────────────────────────────────
  console.log('\n[4/8] 의존성 설치 (npm install)...');
  run('npm install');

  // ── [5/8] WASM 동기화 (pkg/ ↔ npm @rhwp/core, 버전 불일치 방지) ────
  console.log('\n[5/8] WASM 동기화 (sync:wasm — pkg/를 신버전 WASM으로)...');
  runRoot('node scripts/sync-wasm.js');

  // ── [6/8] 에디터 빌드 (→ public/editor/) ──────────────────────────
  console.log('\n[6/8] 에디터 빌드 (npm run build → public/editor/)...');
  run('npm run build');

  // ── [7/8] post-build (HTML 커스터마이즈 주입) ─────────────────────
  console.log('\n[7/8] post-build: HTML 커스터마이즈 주입...');
  runRoot('node scripts/post-build.js');

  // ── [8/8] 커스텀 연동 검증 (저장→Drive 등이 살아있는지) ────────────
  console.log('\n[8/8] 커스텀 연동 검증 (verify:custom)...');
  console.log('      ⚠️  실패 시 저장 연동이 깨진 것이므로 배포하지 말 것.');
  runRoot('node scripts/verify-custom.js');

  console.log('\n' + '━'.repeat(60));
  console.log(`✅ upstream 갱신 완료! (${fromVer} → ${toVer})`);
  console.log('   다음 단계 (배포는 수동):');
  console.log('      npm run build    # 통합 빌드');
  console.log('      npm run smoke    # 런타임 검증 — 에디터 tsc 는 게이트가 아니다');
  console.log('      npm run render:compare  # 렌더 회귀 (CLAUDE.md 절차)');
  console.log('      /deploy');
  console.log('━'.repeat(60));

} catch (e) {
  console.error('\n' + '━'.repeat(60));
  console.error('❌ upstream 갱신 중 오류 발생');
  console.error(`   ${e.message || e}`);
  console.error('━'.repeat(60));
  process.exit(1);
}
