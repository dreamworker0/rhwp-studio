/**
 * svg-advance-probe.mjs — `renderPageSvg` 출력에서 특정 글자의 배치 증분을 뽑는다.
 *
 * 실행:
 *   node scripts/svg-advance-probe.mjs public/editor/samples/biz_plan.hwp
 *   node scripts/svg-advance-probe.mjs <문서> --pages=1,2 --chars=.,·,1
 *   node scripts/svg-advance-probe.mjs <문서> --core=node_modules/rhwpnext
 *
 * 옵션:
 *   --pages=1,2      검사할 페이지 (기본 1)
 *   --chars=.,·      검사할 글자 (기본 `.` 와 `·`)
 *   --core=<dir>     @rhwp/core 디렉터리 (기본 node_modules/@rhwp/core)
 *   --chrome=<경로>  브라우저 실행 파일
 *
 * ─── 왜 있나 ──────────────────────────────────────────────────────────────
 * upstream #4701: 가운뎃점 `·` advance 가 실제 폰트(0.3200)보다 +4.1% 넓은 0.3329 라
 * 목차 점선 리더가 줄당 85개 누적돼 줄 끝이 약 21px 밀린다. upstream 교정 후
 * **`·→·` 증분이 0.3200 으로 내려오는지** 이 스크립트로 확인한다.
 *
 * ⚠️ 출력값은 advance 가 아니라 **구간 폭**이다. `x[i+1] - x[i]` 는 사이의 공백·
 *    문단 자동번호 여백을 포함한다(SVG 는 그 자리에 <text> 를 내보내지 않는다).
 *    같은 글자가 여러 값으로 갈리면 그건 폰트 폭이 아니라 여백이 섞인 것이다 —
 *    #4701 에서 이걸 advance 로 오독해 오진했다. 순수 advance 는
 *    scripts/font-metric-cross-check.mjs 로 재라.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let puppeteer;
for (const base of [join(ROOT, 'temp_editor', 'rhwp-studio', 'package.json'), join(ROOT, 'package.json'), import.meta.url]) {
  try { puppeteer = createRequire(base)('puppeteer-core'); break; } catch { /* 다음 */ }
}
if (!puppeteer) { console.error('puppeteer-core 를 찾을 수 없습니다 — temp_editor 가 필요합니다(로컬 전용).'); process.exit(2); }

const argv = process.argv.slice(2);
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true];
}));
const DOC = resolve(argv.find((a) => !a.startsWith('--')) ?? join(ROOT, 'public', 'editor', 'samples', 'biz_plan.hwp'));
const PAGES = String(flags.pages ?? '1').split(',').map(Number).filter(Boolean);
const CHARS = String(flags.chars ?? '.,\u00B7').split(',').filter((s) => s.length);
const CORE = resolve(flags.core ?? join(ROOT, 'node_modules', '@rhwp', 'core'));

if (!existsSync(DOC)) { console.error(`문서 없음: ${DOC}`); process.exit(2); }
if (!existsSync(join(CORE, 'rhwp.js'))) { console.error(`@rhwp/core 아님: ${CORE}`); process.exit(2); }

function resolveChrome() {
  for (const p of [flags.chrome, process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH]) {
    if (typeof p === 'string' && existsSync(p)) return p;
  }
  const cands = {
    win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium'],
  }[platform()] ?? [];
  const f = cands.find((c) => existsSync(c));
  if (!f) { console.error('Chrome/Edge 없음. --chrome=<경로>'); process.exit(2); }
  return f;
}

const MIME = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html; charset=utf-8' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/blank') { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end('<!doctype html><meta charset=utf-8>'); }
  const path = url === '/doc' ? DOC : join(CORE, url.replace(/^\/pkg\//, ''));
  if (!existsSync(path)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ headless: true, executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-gpu'] });
let out;
try {
  const page = await browser.newPage();
  await page.goto(`${base}/blank`);
  out = await page.evaluate(async ({ base, pages }) => {
    // 0.7.x core 는 이 콜백을 요구한다 (0.8.x 는 쓰지 않음)
    globalThis.measureTextWidth = (spec, text) => {
      const ctx = (globalThis.__c ||= document.createElement('canvas').getContext('2d'));
      ctx.font = spec; return ctx.measureText(text).width;
    };
    const mod = await import(`${base}/pkg/rhwp.js`);
    await mod.default({ module_or_path: `${base}/pkg/rhwp_bg.wasm` });
    mod.init_panic_hook?.();
    const bytes = await (await fetch(`${base}/doc`)).arrayBuffer();
    const doc = new mod.HwpDocument(new Uint8Array(bytes));
    return { version: mod.version(), pageCount: doc.pageCount(), svgs: pages.map((p) => doc.renderPageSvg(p)) };
  }, { base, pages: PAGES });
} finally {
  await browser.close().catch(() => {});
  server.close();
}

const extract = (svg) => {
  const re = /<text[^>]*\bx="([-\d.]+)"[^>]*\by="([-\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  const g = []; let m;
  while ((m = re.exec(svg))) g.push({ x: +m[1], y: +m[2], fs: +m[3], t: m[4].replace(/<[^>]*>/g, '') });
  return g;
};

console.log('━'.repeat(64));
console.log(`📐 SVG 배치 증분 — @rhwp/core ${out.version}`);
console.log('━'.repeat(64));
console.log(`\n   문서 : ${DOC}  (총 ${out.pageCount}p)`);
console.log(`   코어 : ${CORE}\n`);

for (let i = 0; i < PAGES.length; i++) {
  const g = extract(out.svgs[i]);
  console.log(`   ── page ${PAGES[i]} — 글리프 ${g.length}개 ──`);
  for (const ch of CHARS) {
    const seen = new Map();
    let sameRun = 0;
    for (let j = 0; j < g.length - 1; j++) {
      if (g[j].t !== ch || g[j].y !== g[j + 1].y) continue;
      const d = +(g[j + 1].x - g[j].x).toFixed(3);
      const em = +((g[j + 1].x - g[j].x) / g[j].fs).toFixed(4);
      const k = `${d}|${g[j + 1].t}`;
      if (!seen.has(k)) seen.set(k, { d, em, next: g[j + 1].t, n: 0 });
      seen.get(k).n++;
      if (g[j + 1].t === ch) sameRun++;
    }
    if (!seen.size) { console.log(`      "${ch}" : 없음`); continue; }
    const vals = [...seen.values()].sort((a, b) => a.d - b.d);
    console.log(`      "${ch}" : ${vals.length}가지 구간 폭`);
    for (const v of vals) console.log(`         → "${v.next}"  ${String(v.d).padEnd(8)} ${v.em} em  ×${v.n}`);
    if (sameRun > 1) {
      const runs = vals.filter((v) => v.next === ch);
      const avg = runs.reduce((s, v) => s + v.em * v.n, 0) / runs.reduce((s, v) => s + v.n, 0);
      const perLine = new Map();
      for (const q of g) if (q.t === ch) perLine.set(q.y, (perLine.get(q.y) ?? 0) + 1);
      const maxPerLine = Math.max(...perLine.values());
      console.log(`         연속 "${ch}${ch}" 평균 ${avg.toFixed(4)} em — 한 줄 최대 ${maxPerLine}개`);
    }
  }
  console.log('');
}
console.log('   ⚠️ 위 값은 advance 가 아니라 구간 폭이다(공백·자동번호 여백 포함).');
console.log('      순수 advance 는 scripts/font-metric-cross-check.mjs 로 잰다.');
