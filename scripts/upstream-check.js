/**
 * upstream-check.js
 *
 * edwardkim/rhwp upstream과 로컬 클론의 격차를 "읽기 전용"으로 확인한다.
 *
 * 실행: npm run upstream:check
 *
 * ─── 수행 단계 ──────────────────────────────────────────────────────────
 * 1. temp_editor/rhwp-studio 존재 확인
 * 2. git fetch origin main   (원격 추적 ref만 갱신 — 워킹트리/브랜치 불변)
 * 3. 로컬 main vs origin/main 격차(뒤처진 커밋 수 + 한 줄 요약) 출력
 * 4. 현재 버전(CHANGELOG/태그) 출력
 *
 * ⚠️ 이 스크립트는 어떤 파일도, 어떤 브랜치도 변경하지 않는다.
 *    "지금 업데이트할 게 얼마나 되나"를 확인하는 용도.
 * ──────────────────────────────────────────────────────────────────────
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_ROOT = resolve(__dirname, '..', 'temp_editor');           // 업스트림 클론 루트(.git 위치)
const STUDIO_DIR = resolve(EDITOR_ROOT, 'rhwp-studio');

/** EDITOR_ROOT에서 git 명령 실행 후 stdout 문자열 반환 (실패 시 빈 문자열) */
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: EDITOR_ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

console.log('━'.repeat(60));
console.log('🔍 upstream 격차 점검 (read-only): edwardkim/rhwp');
console.log('━'.repeat(60));

// 1. 클론 존재 확인
if (!existsSync(resolve(EDITOR_ROOT, '.git')) || !existsSync(STUDIO_DIR)) {
  console.error('\n❌ temp_editor 클론을 찾을 수 없습니다.');
  console.error(`   기대 경로: ${EDITOR_ROOT}`);
  console.error('   git clone https://github.com/edwardkim/rhwp.git temp_editor 로 먼저 클론하세요.');
  process.exit(1);
}

// 2. 원격 ref 갱신 (워킹트리 불변)
console.log('\n[1/3] git fetch origin main (원격 추적 ref만 갱신)...');
try {
  execSync('git fetch origin main', { cwd: EDITOR_ROOT, stdio: 'inherit' });
} catch {
  console.error('\n❌ fetch 실패 — 네트워크 또는 원격 설정을 확인하세요.');
  process.exit(1);
}

// 3. 격차 계산
console.log('\n[2/3] 로컬 main ↔ origin/main 격차 계산...');
const behind = git('rev-list --count main..origin/main');
const ahead = git('rev-list --count origin/main..main');

console.log(`\n   현재 브랜치: ${git('branch --show-current') || '(detached)'}`);
console.log(`   로컬 main 이 origin/main 보다 ${behind || '?'} 커밋 뒤처짐` +
            (ahead && ahead !== '0' ? `, ${ahead} 커밋 앞섬` : ''));

if (behind && behind !== '0') {
  console.log('\n   ── 들어올 변경(origin/main 최신순) ──');
  const log = git('log --oneline --no-decorate -30 main..origin/main');
  console.log(log ? log.split('\n').map((l) => `   ${l}`).join('\n') : '   (요약 없음)');
  if (Number(behind) > 30) {
    console.log(`   … 외 ${Number(behind) - 30}개 더`);
  }
} else if (behind === '0') {
  console.log('\n   ✅ 이미 최신 상태입니다 (뒤처진 커밋 없음).');
}

// 4. 버전 정보 (rhwp-studio/package.json의 version 필드)
console.log('\n[3/3] 버전 정보 (rhwp-studio)...');
function studioVersion(ref) {
  const json = git(`show ${ref}:rhwp-studio/package.json`);
  const m = json.match(/"version"\s*:\s*"([^"]+)"/);
  return m ? m[1] : '(알 수 없음)';
}
console.log(`   로컬 HEAD:    v${studioVersion('HEAD')}`);
console.log(`   origin/main:  v${studioVersion('origin/main')}`);

// 워킹트리에 커밋되지 않은 변경이 있으면 경고 (update 시 차단됨)
const dirtyCheck = git('status --porcelain');
if (dirtyCheck) {
  console.log('\n   ⚠️  커밋되지 않은 변경이 있습니다 (upstream:update 전에 커밋/스태시 필요):');
  console.log(dirtyCheck.split('\n').map((l) => `      ${l}`).join('\n'));
}

console.log('\n' + '━'.repeat(60));
if (behind && behind !== '0') {
  console.log('ℹ️  갱신하려면:  npm run upstream:update');
} else {
  console.log('ℹ️  갱신할 내용 없음.');
}
console.log('━'.repeat(60));
