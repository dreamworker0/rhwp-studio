/**
 * rhwp-version-diff.mjs — @rhwp/core 두 버전의 글리프 배치를 비교한다
 *
 * 실행:
 *   npm i rhwpnext@npm:@rhwp/core@0.8.3          # 검증할 버전을 별칭으로 설치
 *   node scripts/rhwp-version-diff.mjs public/editor/samples/biz_plan.hwp 1 \
 *        --b=node_modules/rhwpnext
 *
 * 왜 있나: 0.8.x 에서 텍스트 배치가 실제 렌더 폰트와 어긋나는 회귀가 있어
 *   업그레이드를 보류 중이다(docs/rhwp-0.8-regression.md). 업스트림이 고쳤다고
 *   할 때 "정말 고쳐졌나"를 눈이 아니라 숫자로 확인하려고 만들었다.
 *
 * 판정 기준: 같은 문서·같은 페이지를 두 버전으로 renderPageSvg 한 뒤
 *   <text> 글리프를 순서대로 1:1 대응시켜 x 좌표와 advance 를 비교한다.
 *   텍스트 내용이 100% 일치하는데 x 만 어긋나면 = 배치 회귀.
 *
 * ⚠️ 브라우저가 필요하다. 0.7.x core 는 글자폭 계측을 호스트 콜백
 *    globalThis.measureTextWidth(fontSpec, text) 에 위임하므로 canvas 없이는
 *    렌더 자체가 안 된다. (0.8.x 는 이 콜백을 쓰지 않는다 — 그게 회귀의 원인)
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

// ─── 인자 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = Object.fromEntries(
  argv.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')),
);
const positional = argv.filter((a) => !a.startsWith('--'));
const docPath = positional[0];
const pageNum = Number(positional[1] ?? 1);

if (!docPath) {
  fail('사용법: node scripts/rhwp-version-diff.mjs <문서.hwp> [페이지] [--a=<dir>] [--b=<dir>]');
}
if (!existsSync(docPath)) fail(`문서를 찾을 수 없습니다: ${docPath}`);

// a = 현재 프로젝트가 쓰는 버전, b = 검증 대상
const dirA = resolve(flags.a ?? join(ROOT, 'node_modules/@rhwp/core'));
const dirB = flags.b ? resolve(flags.b) : null;

if (!dirB) {
  fail(
    '비교 대상(--b)이 필요합니다.\n' +
    '   예) npm i rhwpnext@npm:@rhwp/core@0.8.3\n' +
    '       node scripts/rhwp-version-diff.mjs <문서.hwp> 1 --b=node_modules/rhwpnext',
  );
}
for (const d of [dirA, dirB]) {
  if (!existsSync(join(d, 'rhwp.js'))) fail(`@rhwp/core 패키지가 아닙니다: ${d}`);
}

// ─── 브라우저 ────────────────────────────────────────────────────────────
function resolveChromePath() {
  const envPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  const candidates = [
    // Windows (로컬 개발 환경)
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // Linux (클라우드 세션 — Playwright 번들 Chromium)
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ];
  const found = candidates.find((c) => c && existsSync(c));
  if (!found) fail('Chrome/Chromium 을 찾을 수 없습니다. CHROME_PATH 환경변수를 지정하세요.');
  return found;
}

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  fail('playwright-core 가 필요합니다:  npm i -D playwright-core');
}

// ─── 정적 서버 (WASM 은 file:// 에서 못 뜬다) ─────────────────────────────
const MIME = {
  '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.html': 'text/html; charset=utf-8',
};
// dirA/dirB 는 프로젝트 밖일 수 있으므로 고정 프리픽스로 매핑해 서빙한다.
const MOUNTS = { '/pkgA': dirA, '/pkgB': dirB };

const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/blank') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    return res.end('<!doctype html><meta charset=utf-8><title>diff</title>');
  }
  let path = null;
  if (url === '/doc') {
    path = resolve(docPath);
  } else {
    const mount = Object.keys(MOUNTS).find((m) => url.startsWith(m + '/'));
    path = mount ? join(MOUNTS[mount], url.slice(mount.length + 1)) : join(ROOT, url);
  }
  if (!path || !existsSync(path)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: resolveChromePath() });

/** 한 버전으로 렌더해 SVG 를 얻는다 (mount = '/pkgA' | '/pkgB') */
async function render(mount) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${base}/blank`);
  try {
    return await page.evaluate(async ({ base, dir, pageNum }) => {
      // 스튜디오와 동일한 계측 콜백 — 0.7.x 가 이걸 요구한다
      let ctx = null, lastFont = null;
      globalThis.measureTextWidth = (fontSpec, text) => {
        ctx ||= document.createElement('canvas').getContext('2d');
        if (fontSpec !== lastFont) { ctx.font = fontSpec; lastFont = fontSpec; }
        return ctx.measureText(text).width;
      };
      const mod = await import(`${base}${dir}/rhwp.js`);
      await mod.default({ module_or_path: `${base}${dir}/rhwp_bg.wasm` });
      mod.init_panic_hook?.();
      const bytes = await (await fetch(`${base}/doc`)).arrayBuffer();
      const doc = new mod.HwpDocument(new Uint8Array(bytes));
      return { version: mod.version(), pageCount: doc.pageCount(), svg: doc.renderPageSvg(pageNum) };
    }, { base, dir: mount, pageNum });
  } catch (e) {
    fail(`렌더 실패 (${MOUNTS[mount]}): ${e.message}${errors.length ? '\n   페이지 에러: ' + errors[0] : ''}`);
  } finally {
    await page.close();
  }
}

const A = await render('/pkgA');
const B = await render('/pkgB');
await browser.close();
server.close();

// ─── 비교 ────────────────────────────────────────────────────────────────
const extract = (svg) => {
  const out = [];
  const re = /<text[^>]*\bx="([-\d.]+)"[^>]*\by="([-\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(svg))) {
    out.push({ x: +m[1], y: +m[2], fs: +m[3], t: m[4].replace(/<[^>]*>/g, '') });
  }
  return out;
};

const a = extract(A.svg), b = extract(B.svg);
console.log(`\n문서: ${docPath}  (page ${pageNum})`);
console.log(`A = ${A.version}  글리프 ${a.length}개`);
console.log(`B = ${B.version}  글리프 ${b.length}개`);

if (a.length !== b.length) {
  console.log(`\n⚠️  글리프 수가 다릅니다 (${a.length} → ${b.length}) — 줄바꿈 위치까지 달라졌습니다.`);
}

const n = Math.min(a.length, b.length);
let mismatch = 0, shifted = 0, maxDx = 0;
const advances = new Map();

for (let i = 0; i < n - 1; i++) {
  if (a[i].t !== b[i].t) { mismatch++; continue; }
  const dx = b[i].x - a[i].x;
  if (Math.abs(dx) > 0.01) shifted++;
  if (Math.abs(dx) > maxDx) maxDx = Math.abs(dx);
  // 같은 줄에서 다음 글리프까지의 증분 = advance
  if (a[i + 1].t === b[i + 1].t && a[i].y === a[i + 1].y && b[i].y === b[i + 1].y) {
    const key = `${JSON.stringify(a[i].t)}@${a[i].fs.toFixed(1)}`;
    if (!advances.has(key)) {
      advances.set(key, [+(a[i + 1].x - a[i].x).toFixed(2), +(b[i + 1].x - b[i].x).toFixed(2)]);
    }
  }
}

const changed = [...advances].filter(([, [x, y]]) => Math.abs(x - y) > 0.05);
const pct = n ? ((shifted / n) * 100).toFixed(1) : '0.0';

console.log(`\n텍스트 불일치 글리프 : ${mismatch}`);
console.log(`x 가 어긋난 글리프   : ${shifted}/${n} (${pct}%)`);
console.log(`최대 Δx              : ${maxDx.toFixed(2)}px`);
console.log(`advance 가 달라진 글자: ${changed.length}종 / 전체 ${advances.size}종`);

if (changed.length) {
  console.log('\n  글자@크기        A        B        차이');
  for (const [k, [x, y]] of changed.slice(0, 20)) {
    const d = y - x;
    console.log(`  ${k.padEnd(14)} ${String(x).padEnd(8)} ${String(y).padEnd(8)} ${d > 0 ? '+' : ''}${d.toFixed(2)}`);
  }
  if (changed.length > 20) console.log(`  … 외 ${changed.length - 20}종`);
}

// ─── 판정 ────────────────────────────────────────────────────────────────
const clean = mismatch === 0 && shifted === 0 && a.length === b.length;
console.log(
  clean
    ? '\n✅ 배치 동일 — 회귀 없음.'
    : '\n❌ 배치가 다릅니다 — docs/rhwp-0.8-regression.md 의 회귀가 남아 있을 수 있습니다.',
);
process.exit(clean ? 0 : 1);
