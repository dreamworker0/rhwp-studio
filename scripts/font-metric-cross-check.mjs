/**
 * font-metric-cross-check.mjs — 설치된 실제 폰트의 advance(브라우저 측정)와
 * upstream `text_measurement.rs` 의 `HAANSOFT_BATANG_ASCII` 표를 문자별로 대조한다.
 *
 * 실행:
 *   node scripts/font-metric-cross-check.mjs
 *   node scripts/font-metric-cross-check.mjs --font="HCR Batang" --bold
 *   node scripts/font-metric-cross-check.mjs --md > table.md
 *
 * 옵션:
 *   --font=<이름>       측정 폰트 (기본: 함초롬바탕)
 *   --bold              Bold 로 측정 (k·q 가 Regular 와 다르다 — upstream #4701)
 *   --src=<경로>        text_measurement.rs (기본: temp_editor/src/renderer/layout/…)
 *   --size=<px>         측정 크기 (기본 1000 — upm 정수 advance 를 그대로 얻기 위해 크게)
 *   --tolerance=<비율>  초과 편차가 있으면 exit 1 (기본 0.02)
 *   --md                마크다운 표 출력
 *   --chrome=<경로>     브라우저 실행 파일
 *
 * ─── 왜 있나 ──────────────────────────────────────────────────────────────
 * 0.8.4 의 함초롬바탕 ASCII 폭 표는 한글 PDF origin 델타로 만들어졌는데, 그 절차가
 * 한글 advance 0.970em 을 1.0 으로 놓고 정규화해 **전 ASCII 가 1/0.970 배 부풀어** 있다
 * (+ 추출 잡음 ~1.1%). 가운뎃점 `·` 이 +4.1% 라 목차 점선 리더가 줄당 85개 누적돼
 * 줄 끝이 약 21px 밀린다. upstream 이 `haansoft_latin_override` 를 걷어내면
 * **이 스크립트로 교정을 확인한다** — exit 0 이면 표가 실제 폰트와 일치.
 * 경위: docs/rhwp-0.8-regression.md, upstream edwardkim/rhwp#4701
 *
 * ⚠️ 측정할 폰트가 OS 에 설치돼 있어야 한다(한컴 오피스). 미설치면 대체 폰트를 재게
 *    되므로 스크립트가 감지해 exit 2 로 중단한다.
 * ⚠️ upstream 소스가 필요하다 → temp_editor 가 있는 로컬 전용.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// puppeteer-core 는 에디터 서브모듈 것을 재사용한다 (smoke-editor.mjs 와 같은 방식)
let puppeteer;
for (const base of [
  join(ROOT, 'temp_editor', 'rhwp-studio', 'package.json'),
  join(process.cwd(), 'package.json'),
  import.meta.url,
]) {
  try { puppeteer = createRequire(base)('puppeteer-core'); break; } catch { /* 다음 후보 */ }
}
if (!puppeteer) {
  console.error('puppeteer-core 를 찾을 수 없습니다 — temp_editor 가 필요합니다(로컬 전용).');
  process.exit(2);
}

const flags = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
const FONT = flags.font ?? '함초롬바탕';
const BOLD = !!flags.bold;
const SIZE = Number(flags.size ?? 1000);
const TOL = Number(flags.tolerance ?? 0.02);
const AS_MD = !!flags.md;
const SRC = resolve(flags.src ?? join(ROOT, 'temp_editor', 'src', 'renderer', 'layout', 'text_measurement.rs'));

// ─── 표 파싱 (하드코딩하지 않는다 — upstream 이 고치면 결과가 따라간다) ────
if (!existsSync(SRC)) {
  console.error(`text_measurement.rs 없음: ${SRC}\n  temp_editor 클론이 필요합니다. --src=<경로> 로 지정할 수도 있습니다.`);
  process.exit(2);
}
const src = readFileSync(SRC, 'utf-8');
const tableMatch = src.match(/const\s+HAANSOFT_BATANG_ASCII\s*:\s*\[f64;\s*\d+\]\s*=\s*\[([\s\S]*?)\];/);
const TABLE = tableMatch ? (tableMatch[1].replace(/\/\/[^\n]*/g, '').match(/-?\d+\.\d+/g) ?? []).map(Number) : [];
if (TABLE.length !== 95) {
  console.error(`HAANSOFT_BATANG_ASCII 파싱 실패 (길이 ${TABLE.length}). upstream 구조가 바뀐 것일 수 있습니다.`);
  process.exit(2);
}
const midMatch = src.match(/c\s*==\s*'\\u\{00B7\}'\s*\{\s*return\s+Some\(([\d.]+)\)/);
const TABLE_MIDDOT = midMatch ? Number(midMatch[1]) : null;
// index = cp - 0x20 (0x20 공백은 별도 0.5em 경로라 표에서 쓰지 않는다)
const tableOf = (ch) => (ch === '\u00B7' ? TABLE_MIDDOT : TABLE[ch.codePointAt(0) - 0x20]);

// ─── 브라우저 ────────────────────────────────────────────────────────────
function resolveChrome() {
  for (const p of [flags.chrome, process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH]) {
    if (typeof p === 'string' && existsSync(p)) return p;
  }
  const home = homedir();
  const cands = {
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      `${home}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  }[platform()] ?? [];
  const found = cands.find((c) => c && existsSync(c));
  if (!found) {
    console.error('Chrome/Edge 를 찾을 수 없습니다. --chrome=<경로> 또는 CHROME_PATH.');
    process.exit(2);
  }
  return found;
}

const browser = await puppeteer.launch({
  headless: true, executablePath: resolveChrome(), args: ['--no-sandbox', '--disable-gpu'],
});
let m;
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><body>');
  m = await page.evaluate(({ font, size, bold }) => {
    const ctx = document.createElement('canvas').getContext('2d');
    const weight = bold ? 'bold ' : '';
    const w = (family, ch) => {
      ctx.font = `${weight}${size}px ${family}`;
      return ctx.measureText(ch).width / size;
    };
    const chars = [];
    for (let cp = 0x21; cp <= 0x7e; cp++) chars.push(String.fromCharCode(cp));
    chars.push('\u00B7');
    // 폰트 해석 여부: 없는 패밀리와 폭 서명이 같으면 미설치
    const probe = 'MWimlj10.\u00B7\uAC00';
    const bogus = [...probe].map((c) => w("'__rhwp_no_such_font__'", c)).join(',');
    const real = [...probe].map((c) => w(`'${font}'`, c)).join(',');
    return {
      resolved: bogus !== real,
      cjk: +w(`'${font}'`, '\uAC00').toFixed(4),
      space: +w(`'${font}'`, ' ').toFixed(4),
      adv: Object.fromEntries(chars.map((c) => [c, +w(`'${font}'`, c).toFixed(4)])),
      chars,
    };
  }, { font: FONT, size: SIZE, bold: BOLD });
} finally {
  await browser.close().catch(() => {});
}
if (!m.resolved) {
  console.error(`'${FONT}' 미설치 — 대체 폰트를 재게 되므로 중단합니다(한컴 오피스 필요).`);
  process.exit(2);
}

// ─── 대조 ────────────────────────────────────────────────────────────────
const rows = m.chars
  .map((ch) => { const a = m.adv[ch], t = tableOf(ch); return { ch, a, t, ratio: t / a, dev: t / a - 1 }; })
  .filter((r) => Number.isFinite(r.ratio));
const ratios = rows.map((r) => r.ratio).sort((x, y) => x - y);
const q = (p) => ratios[Math.floor(ratios.length * p)];
const bad = rows.filter((r) => Math.abs(r.dev) > TOL);
const inv = 1 / m.cjk;
const f = (n, d = 4) => n.toFixed(d);
const disp = (ch) => (ch === '\u00B7' ? '· U+00B7' : ch === '|' ? '\\|' : '`' + ch + '`');

// 폰트가 같은 advance 를 주는데 표가 갈라놓은 글자군 = 추출 잡음의 직접 증거
const groups = new Map();
for (const r of rows) {
  const k = r.a.toFixed(4);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const split = [...groups.entries()]
  .map(([a, rs]) => ({ a, n: rs.length, ts: [...new Set(rs.map((r) => r.t.toFixed(4)))], chars: rs.map((r) => r.ch).join('') }))
  .filter((g) => g.n > 1 && g.ts.length > 1)
  .sort((x, y) => y.n - x.n);

if (AS_MD) {
  console.log(`### \`${FONT}\`${BOLD ? ' (Bold)' : ''} 실측 vs \`HAANSOFT_BATANG_ASCII\`\n`);
  console.log(`가 = ${f(m.cjk)}, space = ${f(m.space)}, 측정 ${SIZE}px\n`);
  console.log('| char | cp | 실측 em | 표 | 비율 | 편차 |\n|---|---|---|---|---|---|');
  for (const r of rows) {
    const cp = r.ch === '\u00B7' ? 'U+00B7' : 'U+00' + r.ch.codePointAt(0).toString(16).toUpperCase().padStart(2, '0');
    console.log(`| ${disp(r.ch)} | ${cp} | ${f(r.a)} | ${f(r.t)} | ${f(r.ratio)} | ${r.dev >= 0 ? '+' : ''}${(r.dev * 100).toFixed(1)}% |`);
  }
} else {
  console.log('━'.repeat(64));
  console.log(`🔎 폰트 메트릭 교차 검증 — ${FONT}${BOLD ? ' (Bold)' : ''}`);
  console.log('━'.repeat(64));
  console.log(`\n   표 출처 : ${SRC}`);
  console.log(`   실측    : 가 = ${f(m.cjk)}, space = ${f(m.space)}, ${rows.length}자 (U+0021~U+007E + U+00B7)\n`);
  console.log(`   표 > 실측   : ${rows.filter((r) => r.dev > 0).length}/${rows.length}자`);
  console.log(`   비율        : 중앙값 ${f(q(0.5))}  1Q ${f(q(0.25))}  3Q ${f(q(0.75))}`);
  console.log(`   최소 / 최대 : ${f(ratios[0])} / ${f(ratios[ratios.length - 1])}`);
  console.log(`   1/가        : ${f(inv)}  ← 전각 정규화 나눗셈이 남아 있으면 비율이 여기 몰린다`);
  console.log(`                 ±0.005 구간: ${rows.filter((r) => Math.abs(r.ratio - inv) <= 0.005).length}/${rows.length}자`);
  if (split.length) {
    console.log('\n   폰트는 동일 advance 인데 표가 갈라놓은 글자군 (추출 잡음):');
    for (const g of split.slice(0, 8)) console.log(`     ${g.a} : "${g.chars}" → 표 ${g.ts.join(' / ')}`);
  }
  console.log('\n' + '━'.repeat(64));
  if (bad.length) {
    console.log(`❌ 허용오차 ${(TOL * 100).toFixed(1)}% 초과: ${bad.length}/${rows.length}자`);
    console.log('━'.repeat(64));
    for (const r of bad.sort((x, y) => Math.abs(y.dev) - Math.abs(x.dev)).slice(0, 12)) {
      console.log(`   ${disp(r.ch).padEnd(11)} 실측 ${f(r.a)}  표 ${f(r.t)}  ${r.dev >= 0 ? '+' : ''}${(r.dev * 100).toFixed(1)}%`);
    }
    if (bad.length > 12) console.log(`   … 외 ${bad.length - 12}자`);
  } else {
    console.log(`✅ 전 문자 허용오차 ${(TOL * 100).toFixed(1)}% 이내 — 표가 실제 폰트와 일치합니다.`);
    console.log('━'.repeat(64));
  }
}
process.exit(bad.length ? 1 : 0);
