#!/usr/bin/env node
/**
 * PreToolUse(Bash) 훅 — git commit/push 전에 스테이징된 시크릿/.env 를 차단한다.
 * exit 0 = 통과, exit 2 = 도구 호출 차단(메시지는 stderr 로 Claude 에 전달).
 * 오탐이면 사용자가 직접 명령을 실행해 우회할 수 있다.
 */
import { execSync } from 'node:child_process'

let input = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) input += chunk

let cmd = ''
try {
  cmd = JSON.parse(input).tool_input?.command || ''
} catch {
  process.exit(0) // 입력 파싱 실패 시 막지 않음
}

// git commit/push 가 아니면 통과
if (!/\bgit\b/.test(cmd) || !/\b(commit|push)\b/.test(cmd)) process.exit(0)

let names = ''
let diff = ''
try {
  names = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  diff = execSync('git diff --cached --unified=0', { encoding: 'utf8' })
} catch {
  process.exit(0) // git 호출 실패(스테이징 없음 등) 시 막지 않음
}

const problems = []

// 1) .env 파일 스테이징 차단 (.env.example 은 허용)
for (const f of names.split('\n').map((s) => s.trim()).filter(Boolean)) {
  if (/(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f)) {
    problems.push(`.env 파일이 스테이징됨: ${f}`)
  }
}

// 2) 추가(+)된 라인에서 시크릿 패턴 탐지 (DSN ingest URL 은 공개값이라 제외)
const patterns = [
  [/sntrys_[A-Za-z0-9+/=._-]{10,}/, 'Sentry auth token (sntrys_)'],
  [/client_secret\s*[:=]\s*['"]?[A-Za-z0-9._-]{12,}/i, 'client_secret 값'],
  [/refresh_token\s*[:=]\s*['"]?[A-Za-z0-9._\-/+]{24,}/i, 'refresh_token 값'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key (AIza...)'],
]
for (const line of diff.split('\n')) {
  if (!line.startsWith('+') || line.startsWith('+++')) continue
  for (const [re, label] of patterns) {
    if (re.test(line)) problems.push(`시크릿 의심(${label}): ${line.trim().slice(0, 80)}`)
  }
}

if (problems.length) {
  console.error(
    '🚫 커밋/푸시 차단 — 시크릿 노출 의심:\n' +
      problems.map((p) => '  - ' + p).join('\n') +
      '\n스테이징에서 제거하거나(.env 는 gitignore 대상), 오탐이면 사용자가 직접 명령을 실행하세요.',
  )
  process.exit(2)
}
process.exit(0)
