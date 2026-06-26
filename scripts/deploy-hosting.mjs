// Firebase Hosting 배포 — REST API 직접 호출(native fetch).
//
// firebase-tools 15.x의 인증 의존성 스택(gaxios 7 / google-auth-library 10)이
// GitHub 러너에서 OAuth 토큰 교환 시 'Premature close'로 결정적 실패하므로,
// 인증은 gcloud(검증됨)로 받은 액세스 토큰을 쓰고 HTTP는 native fetch로 직접 호출한다.
//
// 사용: GOOGLE_OAUTH_ACCESS_TOKEN=<token> node scripts/deploy-hosting.mjs
// env:
//   GOOGLE_OAUTH_ACCESS_TOKEN  (필수) gcloud auth print-access-token 결과
//   FIREBASE_SITE              (기본 rhwp-studio)
//   DIST_DIR                   (기본 dist)
//   QUOTA_PROJECT              (기본 = FIREBASE_SITE) x-goog-user-project 헤더용

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const TOKEN = process.env.GOOGLE_OAUTH_ACCESS_TOKEN
const SITE = process.env.FIREBASE_SITE || 'rhwp-studio'
const DIST = process.env.DIST_DIR || 'dist'
// quota project 헤더: user 자격증명(로컬)일 때만 필요. SA(CI)는 자기 프로젝트가 quota이므로
// 헤더를 보내면 serviceusage.services.use 권한을 요구할 수 있어 기본은 미설정으로 둔다.
const QUOTA = process.env.QUOTA_PROJECT
const API = 'https://firebasehosting.googleapis.com/v1beta1'

if (!TOKEN) { console.error('::error::GOOGLE_OAUTH_ACCESS_TOKEN 환경변수가 필요합니다'); process.exit(1) }

const baseHeaders = { Authorization: `Bearer ${TOKEN}`, ...(QUOTA ? { 'x-goog-user-project': QUOTA } : {}) }

async function api(url, { method = 'GET', json, raw, headers } = {}) {
  const opts = { method, headers: { ...baseHeaders, ...headers } }
  if (json !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(json) }
  if (raw !== undefined) { opts.body = raw }
  const r = await fetch(url, opts)
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${url.replace(/\?.*/, '')} -> ${r.status}\n${text.slice(0, 600)}`)
  return text ? JSON.parse(text) : {}
}

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

// 1) 현재 라이브 버전의 config를 복제(라우팅/헤더 보존 — firebase.json 번역 위험 회피)
console.log(`[1/6] 현재 라이브 config 복제 (site=${SITE})`)
const rel = await api(`${API}/sites/${SITE}/releases?pageSize=1`)
const curVerName = rel.releases?.[0]?.version?.name
if (!curVerName) throw new Error('현재 릴리스를 찾을 수 없습니다')
const curVer = await api(`${API}/${curVerName}?fields=config`)
const config = curVer.config || {}
console.log(`      복제 원본: ${curVerName} (rewrites=${(config.rewrites||[]).length}, headers=${(config.headers||[]).length})`)

// 2) dist 파일 gzip + sha256
console.log(`[2/6] ${DIST} 스캔/압축`)
const files = walk(DIST).map(f => {
  const gz = gzipSync(readFileSync(f), { level: 9 })
  const urlPath = '/' + relative(DIST, f).split(sep).join('/')
  return { urlPath, gz, hash: createHash('sha256').update(gz).digest('hex') }
})
console.log(`      파일 ${files.length}개`)

// 3) 새 버전 생성(복제한 config로)
console.log('[3/6] 버전 생성')
const version = await api(`${API}/sites/${SITE}/versions`, { method: 'POST', json: { config } })
const versionName = version.name
console.log(`      ${versionName}`)

// 4) populateFiles → 업로드 필요 목록
console.log('[4/6] populateFiles')
const manifest = {}
for (const f of files) manifest[f.urlPath] = f.hash
const pop = await api(`${API}/${versionName}:populateFiles`, { method: 'POST', json: { files: manifest } })
const required = pop.uploadRequiredHashes || []
const uploadUrl = pop.uploadUrl
console.log(`      업로드 필요 ${required.length}/${files.length}`)

// 5) 필요한 파일 업로드 (동시성 제한 풀로 병렬 업로드)
console.log('[5/6] 업로드')
const byHash = new Map(files.map(f => [f.hash, f]))
const CONCURRENCY = 8
let done = 0
const queue = [...required]
async function uploadWorker() {
  for (let h = queue.pop(); h !== undefined; h = queue.pop()) {
    const f = byHash.get(h)
    if (!f) throw new Error(`해시 ${h}에 해당하는 파일 없음`)
    await api(`${uploadUrl}/${h}`, { method: 'POST', raw: f.gz, headers: { 'Content-Type': 'application/octet-stream' } })
    if (++done % 10 === 0 || done === required.length) console.log(`      ${done}/${required.length}`)
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, required.length) }, uploadWorker))

// 6) finalize + release
console.log('[6/6] finalize + release')
await api(`${API}/${versionName}?update_mask=status`, { method: 'PATCH', json: { status: 'FINALIZED' } })
if (process.env.DRY_RUN) {
  console.log(`🧪 DRY_RUN — release 생략(라이브 미반영). 검증 완료된 버전: ${versionName}`)
  process.exit(0)
}
const release = await api(`${API}/sites/${SITE}/releases?versionName=${encodeURIComponent(versionName)}`, { method: 'POST' })
console.log(`✅ 배포 완료: ${release.name}`)
console.log(`   https://${SITE}.web.app`)
