/**
 * upstream-update.js
 *
 * edwardkim/rhwp upstream 갱신 워크플로우 자동화
 *
 * 실행: npm run upstream:update
 *
 * ─── 수행 단계 ──────────────────────────────────────────────────────────
 * 1. temp_editor/rhwp-studio → main 브랜치로 체크아웃
 * 2. git pull origin main (upstream 최신 코드)
 * 3. custom/drive-viewer 브랜치로 체크아웃
 * 4. git rebase main (커스터마이즈를 최신 위에 재적용)
 * 5. npm install (의존성 변경 반영)
 * 6. npm run build (에디터 재빌드 → public/editor/에 복사)
 * 7. node scripts/post-build.js (HTML 커스터마이즈 주입)
 *
 * ⚠️ rebase 중 충돌이 발생하면 스크립트가 중단됩니다.
 *    충돌 해결 후 직접 `git rebase --continue` 하고,
 *    `npm run build:editor`를 실행하세요.
 * ──────────────────────────────────────────────────────────────────────
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_DIR = resolve(__dirname, '..', 'temp_editor', 'rhwp-studio');

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  try {
    const out = execSync(cmd, {
      cwd: EDITOR_DIR,
      stdio: 'inherit',
      ...opts,
    });
    return out;
  } catch (e) {
    throw e;
  }
}

function runRoot(cmd) {
  const ROOT = resolve(__dirname, '..');
  console.log(`\n$ ${cmd}  [root]`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

// ─── 메인 ──────────────────────────────────────────────────────────────
console.log('━'.repeat(60));
console.log('🔄 upstream 갱신 시작: edwardkim/rhwp → main');
console.log('━'.repeat(60));

try {
  // 현재 브랜치 확인
  const currentBranch = execSync('git branch --show-current', {
    cwd: EDITOR_DIR,
    encoding: 'utf-8',
  }).trim();
  console.log(`\n현재 브랜치: ${currentBranch}`);

  // 1. main 브랜치로 이동
  console.log('\n[1/7] main 브랜치로 전환...');
  run('git checkout main');

  // 2. upstream pull
  console.log('\n[2/7] upstream 최신 코드 가져오기...');
  run('git pull origin main');

  // 3. custom 브랜치로 복귀
  console.log('\n[3/7] custom/drive-viewer 브랜치로 전환...');
  run('git checkout custom/drive-viewer');

  // 4. rebase
  console.log('\n[4/7] rebase: 커스터마이즈를 최신 upstream 위에 재적용...');
  console.log('      ⚠️  충돌 발생 시 스크립트가 중단됩니다.');
  console.log('         → 충돌 해결 후: git rebase --continue');
  console.log('         → 그 후: npm run build:editor\n');
  run('git rebase main');

  // 5. npm install
  console.log('\n[5/7] 의존성 설치 (npm install)...');
  run('npm install');

  // 6. 에디터 빌드
  console.log('\n[6/7] 에디터 빌드 (npm run build)...');
  run('npm run build');

  // 7. post-build (HTML 커스터마이즈 주입)
  console.log('\n[7/7] post-build: HTML 커스터마이즈 주입...');
  runRoot('node scripts/post-build.js');

  console.log('\n' + '━'.repeat(60));
  console.log('✅ upstream 갱신 완료!');
  console.log('   다음 명령으로 Firebase에 배포하세요:');
  console.log('   npm run build && firebase deploy');
  console.log('━'.repeat(60));

} catch (e) {
  console.error('\n' + '━'.repeat(60));
  console.error('❌ upstream 갱신 중 오류 발생');
  console.error('   rebase 충돌이라면:');
  console.error('   1. 충돌 파일 수동 해결');
  console.error('   2. git add <파일>');
  console.error('   3. git rebase --continue');
  console.error('   4. npm run build:editor');
  console.error('━'.repeat(60));
  process.exit(1);
}
