/**
 * editor-render-compare.mjs — 문서를 에디터 빌드로 렌더해 스크린샷을 찍고, 빌드 간 픽셀 대조한다.
 *
 * 렌더 (라벨별로 스크린샷 저장):
 *   node scripts/editor-render-compare.mjs --editor=dist --label=0.8.4 <문서.hwpx> [<문서2> …]
 *   node scripts/editor-render-compare.mjs --editor=.tmp/old/public --label=0.7.18 <문서.hwpx>
 *
 * 대조 (저장된 두 라벨 비교):
 *   node scripts/editor-render-compare.mjs --diff=0.7.18,0.8.4
 *
 * 옵션:
 *   --editor=<dir>   `/editor/...` 를 담은 디렉터리 (dist 또는 public 상위)
 *   --label=<name>   스크린샷 파일명에 붙일 라벨
 *   --out=<dir>      출력 디렉터리 (기본 .tmp/render-shots)
 *   --crop=<px>      대조 시 위에서 잘라낼 높이 — UI 크롬 제외 (기본 560, DPR 2 기준)
 *   --chrome=<경로>  브라우저 실행 파일
 *
 * ─── 왜 있나 ──────────────────────────────────────────────────────────────
 * 에디터 버전을 올릴 때 렌더가 실제로 나아졌는지/회귀가 없는지를 눈이 아니라 픽셀로
 * 본다. 0.7.18 → 0.8.4 때 이걸로 "쪽수·줄바꿈 불변, 차이는 글자 폭 수준(0.008~0.87%)"
 * 을 확인했다. 과거 빌드는 git 에서 복원하면 된다:
 *   git archive <커밋> public/editor | tar -x -C .tmp/old
 * 경위: docs/rhwp-0.8-regression.md
 *
 * ⚠️ temp_editor 의 puppeteer-core 와 브라우저가 필요하다 → 로컬 전용.
 * ⚠️ 세대가 다른 빌드끼리 대조할 때는 UI 크롬 높이가 달라 문서가 세로로 밀린다
 *    (0.7.x 는 한 줄 툴바, 0.8.x 는 리본). 같은 세대끼리는 그대로 쓰고, 세대가
 *    다르면 `--crop` 을 키우거나 스크린샷을 눈으로 비교하라 — 픽셀 수치만 보면
 *    실제보다 크게 나온다.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const req_ = (() => {
  for (const base of [join(ROOT, 'temp_editor', 'rhwp-studio', 'package.json'), join(ROOT, 'package.json')]) {
    try { const r = createRequire(base); r('puppeteer-core'); return r; } catch { /* 다음 */ }
  }
  return null;
})();
if (!req_) { console.error('puppeteer-core 를 찾을 수 없습니다 — temp_editor 가 필요합니다(로컬 전용).'); process.exit(2); }
const puppeteer = req_('puppeteer-core');

const argv = process.argv.slice(2);
const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true];
}));
const docs = argv.filter((a) => !a.startsWith('--'));
const OUT = resolve(flags.out ?? join(ROOT, '.tmp', 'render-shots'));
const CROP = Number(flags.crop ?? 560);
mkdirSync(OUT, { recursive: true });

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
const safe = (s) => s.replace(/\.[^.]+$/, '').replace(/[^\w가-힣]+/g, '_');

// ─── 대조 모드 ───────────────────────────────────────────────────────────
if (flags.diff) {
  const [A, B] = String(flags.diff).split(',');
  if (!A || !B) { console.error('사용법: --diff=<라벨A>,<라벨B>'); process.exit(2); }
  const { PNG } = req_('pngjs');
  const pixelmatch = (() => { const m = req_('pixelmatch'); return m.default ?? m; })();
  const bases = [...new Set(readdirSync(OUT).filter((f) => f.endsWith(`__${A}.png`)).map((f) => f.slice(0, -(`__${A}.png`).length)))];
  if (!bases.length) { console.error(`${OUT} 에 __${A}.png 가 없습니다. 먼저 --label=${A} 로 렌더하세요.`); process.exit(2); }
  console.log(`문서영역 픽셀차이 (${A} vs ${B}), 위 ${CROP}px 제외 — 큰 순:\n`);
  const rows = [];
  for (const b of bases.sort()) {
    const pa = join(OUT, `${b}__${A}.png`), pb = join(OUT, `${b}__${B}.png`);
    if (!existsSync(pb)) { rows.push([b, '(상대 없음)', '']); continue; }
    const ia = PNG.sync.read(readFileSync(pa)), ib = PNG.sync.read(readFileSync(pb));
    if (ia.width !== ib.width || ia.height !== ib.height) { rows.push([b, '(크기 불일치)', '']); continue; }
    const h = ia.height - CROP;
    const crop = (img) => {
      const o = new PNG({ width: img.width, height: h });
      for (let y = 0; y < h; y++) {
        img.data.copy(o.data, y * img.width * 4, (y + CROP) * img.width * 4, (y + CROP + 1) * img.width * 4);
      }
      return o;
    };
    const ca = crop(ia), cb = crop(ib), diff = new PNG({ width: ia.width, height: h });
    const n = pixelmatch(ca.data, cb.data, diff.data, ia.width, h, { threshold: 0.15 });
    if (n > 0) writeFileSync(join(OUT, `${b}__DIFF_${A}_${B}.png`), PNG.sync.write(diff));
    rows.push([b, n, ((n / (ia.width * h)) * 100).toFixed(3) + '%']);
  }
  rows.sort((x, y) => (Number(y[1]) || 0) - (Number(x[1]) || 0));
  for (const [b, n, pct] of rows) console.log(`  ${String(n).padStart(9)}  ${String(pct).padStart(8)}  ${b}`);
  console.log(`\n  차이 이미지: ${OUT}\\<문서>__DIFF_${A}_${B}.png`);
  process.exit(0);
}

// ─── 렌더 모드 ───────────────────────────────────────────────────────────
const EDITOR = resolve(flags.editor ?? join(ROOT, 'dist'));
const LABEL = flags.label;
if (!LABEL || typeof LABEL !== 'string') { console.error('--label=<이름> 이 필요합니다.'); process.exit(2); }
if (!docs.length) { console.error('렌더할 문서를 인자로 주세요.'); process.exit(2); }
if (!existsSync(join(EDITOR, 'editor', 'index.html'))) {
  console.error(`${EDITOR}/editor/index.html 없음 — --editor=<dir> 확인 (dist 또는 public 상위).`);
  process.exit(2);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};
let currentDoc = null;
const HARNESS = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style>
<iframe id="ed" src="/editor/index.html" style="width:1280px;height:900px;border:0"></iframe>
<script>
window.__s = { phase: 'boot' };
const iframe = document.getElementById('ed'), origin = location.origin;
function request(method, params, timeoutMs) {
  return new Promise((res, rej) => {
    const id = Date.now() + Math.random();
    const t = setTimeout(() => { window.removeEventListener('message', h); rej(new Error(method + ' timeout')); }, timeoutMs);
    function h(e) {
      if (e.origin !== origin) return;
      const d = e.data;
      if (!d || d.type !== 'rhwp-response' || d.id !== id) return;
      clearTimeout(t); window.removeEventListener('message', h);
      d.error ? rej(new Error(d.error)) : res(d.result);
    }
    window.addEventListener('message', h);
    iframe.contentWindow.postMessage({ type: 'rhwp-request', id, method, params }, origin);
  });
}
(async () => {
  try {
    let ready = false;
    for (let i = 0; i < 120 && !ready; i++) {
      try { ready = (await request('ready', {}, 1000)) === true; } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    if (!ready) throw new Error('ready 없음');
    const buf = await (await fetch('/__doc')).arrayBuffer();
    const r = await request('loadFile', { data: new Uint8Array(buf), fileName: window.__docName, skipUnsavedGuard: true }, 60000);
    window.__s = { phase: 'done', ok: true, pageCount: r && r.pageCount };
  } catch (e) { window.__s = { phase: 'done', ok: false, error: String(e && e.message || e) }; }
})();
</script>`;

const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__h.html') { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end(HARNESS); }
  if (url === '/__doc') { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return res.end(readFileSync(currentDoc)); }
  const p = join(EDITOR, url);
  if (!existsSync(p) || !statSync(p).isFile()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await puppeteer.launch({
  headless: true, executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-gpu'],
});
/**
 * 에디터 iframe 안의 "로컬 글꼴 감지" 모달을 '대체 글꼴로 보기'로 닫는다.
 * 모달이 없으면 아무것도 하지 않고 false 를 돌려준다.
 */
async function dismissFontModal(page) {
  for (const frame of page.frames()) {
    try {
      const hit = await frame.evaluate(() => {
        const wanted = ['대체 글꼴로 보기', '대체 글꼴'];
        const nodes = Array.from(document.querySelectorAll('button, [role="button"], .btn'));
        const target = nodes.find((el) => wanted.some((w) => (el.textContent || '').includes(w)));
        if (!target) return false;
        target.click();
        return true;
      });
      if (hit) return true;
    } catch { /* cross-origin 등 — 다음 프레임 */ }
  }
  return false;
}

try {
  for (const d of docs) {
    currentDoc = resolve(d);
    if (!existsSync(currentDoc)) { console.log(`✗ ${d} — 파일 없음`); continue; }
    const page = await browser.newPage();
    await page.setViewport({ width: 1300, height: 920, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument(`window.__docName = ${JSON.stringify(basename(currentDoc))}`);
    await page.goto(`http://127.0.0.1:${port}/__h.html`, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction('window.__s && window.__s.phase === "done"', { timeout: 180_000, polling: 500 });
    const s = await page.evaluate('window.__s');
    // 빌드 간 상태 정규화 — "로컬 글꼴 감지" 모달을 닫는다.
    //   0.8.4는 로드 직후 이 모달을 띄우고 0.8.6은 띄우지 않는다. 그대로 찍으면
    //   한쪽은 문서가 모달에 가린 채 대체 글꼴로, 다른 쪽은 정상 렌더로 캡처돼
    //   픽셀 대조가 통째로 무효가 된다(실제로 80% 차이로 나왔다).
    //   헤드리스에서는 Local Font Access 권한을 줄 수 없으므로 '대체 글꼴로 보기'로 통일.
    const dismissed = await dismissFontModal(page);
    if (dismissed) await new Promise((r) => setTimeout(r, 800));
    await new Promise((r) => setTimeout(r, 2500)); // 렌더 안정화
    const name = `${safe(basename(currentDoc))}__${LABEL}.png`;
    await (await page.$('#ed')).screenshot({ path: join(OUT, name) });
    console.log(`${s.ok ? '✓' : '✗'} ${basename(currentDoc)} [${LABEL}] ${s.ok ? `pageCount=${s.pageCount}` : s.error} → ${name}`);
    await page.close();
  }
} finally {
  await browser.close().catch(() => {});
  server.close();
}
console.log(`\n스크린샷: ${OUT}`);
console.log(`대조: node scripts/editor-render-compare.mjs --diff=<다른라벨>,${LABEL}`);
