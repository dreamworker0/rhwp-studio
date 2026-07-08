/**
 * smoke-editor.mjs — 배포 전 에디터 스모크 테스트
 *
 * 실행: npm run build && npm run smoke   (dist/ 산출물을 검증)
 *
 * 검증 항목:
 *  1. 에디터가 iframe 임베드(프로덕션과 동일한 경로)로 부팅되고 'ready' 응답
 *  2. loadFile 핸드셰이크 — 표 문서 로드 후 **loadFile ack가 직접 도착**하는지
 *     (pageCount 폴링 폴백 없이. 과거 모달 순환대기로 60s timeout 나던 경로)
 *  3. pageCount > 0 (문서가 실제로 파싱·렌더 준비됨)
 *  4. 웹폰트 무결성 — fonts/*.woff2 요청이 HTML로 응답되거나(OTS 에러) 404가 아님
 *
 * 요구사항: Chrome 또는 Edge 설치 (CHROME_PATH 환경변수로 재정의 가능).
 * puppeteer-core는 temp_editor/rhwp-studio의 것을 재사용한다(별도 설치 불필요).
 */

import { createServer } from 'http';
import { createRequire } from 'module';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const SAMPLE_URL = '/editor/samples/issue1949_giant_cell_nested_tables_perf.hwp';
const ACK_TIMEOUT_MS = 60_000;

// puppeteer-core는 에디터 서브모듈 e2e 의존성을 재사용
const require_ = createRequire(resolve(ROOT, 'temp_editor', 'rhwp-studio', 'package.json'));
const puppeteer = require_('puppeteer-core');

function fail(msg) {
  console.error(`\n❌ 스모크 실패: ${msg}`);
  process.exit(1);
}

function resolveChromePath() {
  const envPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const found = candidates.find((c) => c && existsSync(c));
  if (!found) fail('Chrome/Edge를 찾을 수 없습니다. CHROME_PATH 환경변수를 지정하세요.');
  return found;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.hwp': 'application/x-hwp',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

// 프로덕션과 동일한 임베드 구조를 재현하는 하네스 페이지 (dist에는 포함하지 않음)
const SMOKE_HTML = `<!doctype html><meta charset="utf-8"><title>smoke</title>
<iframe id="ed" src="/editor/index.html" style="width:1000px;height:700px"></iframe>
<script>
window.__smoke = { phase: 'boot' };
const iframe = document.getElementById('ed');
const origin = location.origin;

function request(method, params, timeoutMs) {
  return new Promise((resolveP, rejectP) => {
    const id = Date.now() + Math.random();
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      rejectP(new Error(method + ' timeout (' + timeoutMs + 'ms)'));
    }, timeoutMs);
    function handler(e) {
      if (e.origin !== origin) return;
      const d = e.data;
      if (!d || d.type !== 'rhwp-response' || d.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      d.error ? rejectP(new Error(d.error)) : resolveP(d.result);
    }
    window.addEventListener('message', handler);
    iframe.contentWindow.postMessage({ type: 'rhwp-request', id, method, params }, origin);
  });
}

(async () => {
  try {
    // 1) ready — wasm 초기화까지 재시도
    window.__smoke.phase = 'ready-wait';
    const t0 = performance.now();
    let ready = false;
    for (let i = 0; i < 120 && !ready; i++) {
      try { ready = (await request('ready', {}, 1000)) === true; }
      catch { await new Promise(r => setTimeout(r, 500)); }
    }
    if (!ready) throw new Error('에디터 ready 응답 없음');
    window.__smoke.readyMs = Math.round(performance.now() - t0);

    // 2) 샘플 다운로드 → loadFile ack 직접 수신 (폴링 폴백 없음)
    window.__smoke.phase = 'loading';
    const buf = await (await fetch('${SAMPLE_URL}')).arrayBuffer();
    const t1 = performance.now();
    const result = await request('loadFile',
      { data: new Uint8Array(buf), fileName: 'smoke.hwp' }, ${ACK_TIMEOUT_MS});
    window.__smoke = {
      phase: 'done', ok: true,
      readyMs: window.__smoke.readyMs,
      loadMs: Math.round(performance.now() - t1),
      pageCount: result && result.pageCount,
    };
  } catch (e) {
    window.__smoke = { phase: 'done', ok: false, error: String(e && e.message || e) };
  }
})();
</script>`;

// ─── 정적 서버 (dist/) ──────────────────────────────────────────────────
const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/__smoke.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(SMOKE_HTML);
    return;
  }
  const filePath = join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(DIST) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

console.log('━'.repeat(60));
console.log('🚬 에디터 스모크 테스트 (dist/ 산출물)');
console.log('━'.repeat(60));

if (!existsSync(join(DIST, 'editor', 'index.html'))) {
  fail('dist/editor/index.html 없음 — 먼저 npm run build를 실행하세요.');
}
if (!existsSync(join(DIST, SAMPLE_URL.replace(/\//g, '\\').slice(1)))) {
  fail(`샘플 없음: dist${SAMPLE_URL}`);
}

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
console.log(`   서버: http://127.0.0.1:${port} (dist/)`);

const chromePath = resolveChromePath();
console.log(`   브라우저: ${chromePath}`);
const browser = await puppeteer.launch({
  headless: true,
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-gpu'],
});

let exitCode = 1;
try {
  const page = await browser.newPage();

  // 콘솔·네트워크 감시: OTS(폰트) 에러와 폰트 404를 잡는다
  const fontProblems = [];
  const consoleErrors = [];
  page.on('console', (m) => {
    const text = m.text();
    if (/OTS parsing error|Failed to decode downloaded font/i.test(text)) fontProblems.push(text);
    else if (m.type() === 'error') consoleErrors.push(text);
  });
  page.on('response', (r) => {
    const url = r.url();
    if (/\/fonts\/.+\.woff2/.test(url)) {
      const ct = r.headers()['content-type'] || '';
      if (r.status() !== 200 || ct.includes('text/html')) {
        fontProblems.push(`폰트 응답 이상: ${r.status()} ${ct} ${url}`);
      }
    }
  });

  await page.goto(`http://127.0.0.1:${port}/__smoke.html`, { waitUntil: 'load', timeout: 60_000 });

  console.log('\n   [1/3] 에디터 부팅 + loadFile ack 대기...');
  await page.waitForFunction('window.__smoke && window.__smoke.phase === "done"', {
    timeout: ACK_TIMEOUT_MS + 90_000, polling: 500,
  });
  const smoke = await page.evaluate('window.__smoke');

  if (!smoke.ok) fail(`loadFile 핸드셰이크 실패 — ${smoke.error}`);
  console.log(`         ✓ ready ${smoke.readyMs}ms, loadFile ack ${smoke.loadMs}ms`);

  console.log('   [2/3] pageCount 확인...');
  if (!(smoke.pageCount > 0)) fail(`pageCount가 0 또는 없음: ${JSON.stringify(smoke.pageCount)}`);
  console.log(`         ✓ pageCount = ${smoke.pageCount}`);

  console.log('   [3/3] 웹폰트/콘솔 점검...');
  if (fontProblems.length) fail(`폰트 문제 ${fontProblems.length}건:\n     ${fontProblems.slice(0, 5).join('\n     ')}`);
  console.log(`         ✓ OTS/폰트 에러 없음 (콘솔 error ${consoleErrors.length}건은 참고용)`);
  if (consoleErrors.length) {
    console.log('         (참고) 콘솔 에러:');
    consoleErrors.slice(0, 5).forEach((t) => console.log(`           - ${t.slice(0, 160)}`));
  }

  console.log('\n' + '━'.repeat(60));
  console.log('✅ 스모크 통과 — 배포 가능');
  console.log('━'.repeat(60));
  exitCode = 0;
} catch (e) {
  console.error('\n❌ 스모크 실패:', e.message || e);
} finally {
  await browser.close().catch(() => {});
  server.close();
  process.exit(exitCode);
}
