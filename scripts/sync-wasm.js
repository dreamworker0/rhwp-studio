/**
 * sync-wasm.js
 *
 * temp_editor/pkg/ 의 WASM을 npm @rhwp/core@<rhwp-studio 버전>으로 맞춘다.
 *
 * 실행: npm run sync:wasm   (upstream:update 중 빌드 직전에 자동 호출)
 *
 * ─── 배경 ────────────────────────────────────────────────────────────────
 * 에디터는 WASM을 temp_editor/pkg/ 에서 가져온다(@wasm alias). pkg/는 gitignore된
 * Rust 빌드 산출물이라 upstream:update(JS 갱신)만으로는 갱신되지 않는다. 그 결과
 * "JS는 신버전 / WASM은 구버전" 불일치가 생겨 getShowParagraphMarks 같은 신규
 * WASM 함수 호출이 깨진다(실제 0.7.3→0.7.17 갱신 때 저장이 깨졌다).
 *
 * Rust→WASM(Docker) 빌드 없이, npm에 배포된 @rhwp/core 의 prebuilt WASM을 받아
 * pkg/ 에 덮어써서 JS와 버전을 항상 일치시킨다.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { execSync } from 'child_process';
import {
  readFileSync, copyFileSync, existsSync, mkdtempSync, rmSync,
} from 'fs';
import { resolve, dirname, join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EDITOR_ROOT = resolve(ROOT, 'temp_editor');
const STUDIO_PKG_JSON = resolve(EDITOR_ROOT, 'rhwp-studio', 'package.json');
const PKG_DIR = resolve(EDITOR_ROOT, 'pkg'); // @wasm alias 대상

// wasm-bindgen 산출물 4종 (에디터가 @wasm/rhwp.js 로 import)
const WASM_FILES = ['rhwp.js', 'rhwp.d.ts', 'rhwp_bg.wasm', 'rhwp_bg.wasm.d.ts'];

console.log('━'.repeat(60));
console.log('🧩 WASM 동기화: pkg/ ↔ npm @rhwp/core');
console.log('━'.repeat(60));

if (!existsSync(STUDIO_PKG_JSON)) {
  console.error(`\n❌ ${STUDIO_PKG_JSON} 를 찾을 수 없습니다 (temp_editor 클론 필요).`);
  process.exit(1);
}
if (!existsSync(PKG_DIR)) {
  console.error(`\n❌ pkg 디렉터리를 찾을 수 없습니다: ${PKG_DIR}`);
  process.exit(1);
}

// 1. 대상 버전 = rhwp-studio 버전 (@rhwp/core 와 동일 버전으로 함께 릴리즈됨)
const studioVersion = JSON.parse(readFileSync(STUDIO_PKG_JSON, 'utf-8')).version;
console.log(`\n   rhwp-studio 버전: ${studioVersion}`);

const tmp = mkdtempSync(join(tmpdir(), 'rhwp-wasm-'));
try {
  // 2. npm pack 으로 prebuilt WASM 패키지 받기 (정확 버전 → 실패 시 latest 폴백)
  function pack(spec) {
    const out = execSync(`npm pack ${spec} --pack-destination "${tmp}"`, {
      encoding: 'utf-8', cwd: tmp,
    }).trim();
    return out.split('\n').pop().trim(); // 마지막 줄 = tarball 파일명
  }

  let spec = `@rhwp/core@${studioVersion}`;
  let tarball;
  try {
    console.log(`   ${spec} 다운로드...`);
    tarball = pack(spec);
  } catch {
    console.warn(`   ⚠️  ${spec} 를 찾을 수 없어 @rhwp/core@latest 로 폴백합니다.`);
    spec = '@rhwp/core@latest';
    tarball = pack(spec);
  }

  // 3. 압축 해제 (→ tmp/package/)
  //    cwd=tmp + 상대 파일명으로 실행 → Windows 경로의 "C:" 를 tar가 원격 호스트로
  //    오해하는 문제 회피 (절대경로 사용 시 "Cannot connect to C:" 에러 발생).
  execSync(`tar -xzf "${tarball}"`, { cwd: tmp, stdio: 'inherit' });
  const extracted = resolve(tmp, 'package');

  // 4. pkg/ 로 덮어쓰기
  console.log('\n   pkg/ 에 복사:');
  let copied = 0;
  for (const f of WASM_FILES) {
    const src = join(extracted, f);
    if (existsSync(src)) {
      copyFileSync(src, join(PKG_DIR, f));
      console.log(`     ✓ ${f}`);
      copied++;
    } else {
      console.warn(`     ⚠️  ${f} 가 패키지에 없음 (건너뜀)`);
    }
  }
  if (copied === 0) throw new Error('복사된 WASM 파일이 없습니다.');

  console.log('\n' + '━'.repeat(60));
  console.log(`✅ WASM 동기화 완료 (${spec})`);
  console.log('━'.repeat(60));
} catch (e) {
  console.error('\n❌ WASM 동기화 실패:', e.message || e);
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
