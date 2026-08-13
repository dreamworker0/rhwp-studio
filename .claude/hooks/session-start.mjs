#!/usr/bin/env node
/**
 * SessionStart 훅 — 클라우드(Claude Code on the web) 세션 준비
 *
 * 클라우드 컨테이너는 매 세션 새로 뜨므로 node_modules 가 없다.
 * 이 훅이 의존성을 깔아 `npm run build`(= 이 프로젝트의 유일한 검증 수단)가
 * 세션 시작 직후부터 동작하게 만든다.
 *
 * 로컬(Windows) 에서는 아무 일도 하지 않는다 — CLAUDE_CODE_REMOTE 로 분기.
 *
 * 하는 일:
 *   1. 루트 의존성 설치(없을 때만)       → tsc + vite 빌드용
 *   2. functions 의존성 설치(없을 때만)  → firebase deploy 가 트리거를 찾으려면
 *                                          함수 코드를 로컬에서 로드하므로 필요
 *   3. FIREBASE_SERVICE_ACCOUNT 가 환경에 있으면 키 파일로 풀어놓고
 *      GOOGLE_APPLICATION_CREDENTIALS 를 세션 env 에 등록 (배포 인증)
 *
 * ⚠️ 이 레포는 퍼블릭이다. 이 파일에는 어떤 비밀값도 넣지 말 것.
 *    서비스 계정 키는 오직 환경변수(FIREBASE_SERVICE_ACCOUNT)로만 들어오고,
 *    레포 밖(홈 디렉터리)에 0600 으로 기록되며, 내용은 절대 출력하지 않는다.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

// 로컬(Windows 개발 PC)에서는 스킵 — 거기엔 이미 node_modules 가 있다.
if (process.env.CLAUDE_CODE_REMOTE !== 'true') process.exit(0);

const ROOT = process.env.CLAUDE_PROJECT_DIR
  ? resolve(process.env.CLAUDE_PROJECT_DIR)
  : resolve(dirname(new URL(import.meta.url).pathname), '..', '..');

const log = (msg) => console.log(`[session-start] ${msg}`);

/** npm install 을 cwd 에서 실행. 실패해도 세션은 계속 뜨게 한다(경고만). */
function install(cwd, label) {
  if (existsSync(join(cwd, 'node_modules'))) {
    log(`${label}: node_modules 존재 — 건너뜀`);
    return;
  }
  if (!existsSync(join(cwd, 'package.json'))) return;
  log(`${label}: npm install …`);
  try {
    // npm ci 대신 install — 컨테이너 스냅샷 캐시와 궁합이 좋다.
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], {
      cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    log(`${label}: 완료`);
  } catch (err) {
    log(`⚠️ ${label}: 설치 실패 — ${err.message}`);
  }
}

install(ROOT, 'root');
install(join(ROOT, 'functions'), 'functions');

/**
 * 배포 자격증명 준비 (선택).
 * 환경에 FIREBASE_SERVICE_ACCOUNT(JSON 원문)가 있을 때만 동작한다.
 * 없으면 조용히 넘어가고, 클라우드에서는 배포 없이 코드 작업만 하게 된다.
 */
function prepareCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    log('FIREBASE_SERVICE_ACCOUNT 없음 — 배포 인증 미설정(코드 작업만 가능)');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log('⚠️ FIREBASE_SERVICE_ACCOUNT 가 유효한 JSON 이 아님 — 무시');
    return;
  }
  if (parsed.type !== 'service_account' || !parsed.client_email) {
    log('⚠️ FIREBASE_SERVICE_ACCOUNT 형식 오류(service_account 아님) — 무시');
    return;
  }

  // 레포 밖에 기록 — 실수로도 커밋될 수 없는 위치.
  const dir = join(homedir(), '.gcp');
  const keyPath = join(dir, 'rhwp-sa.json');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(keyPath, raw, { mode: 0o600 });

  // 이후 모든 Bash 호출에서 firebase/gcloud 가 이 키로 인증하도록 세션 env 에 등록.
  const envFile = process.env.CLAUDE_ENV_FILE;
  if (envFile) {
    appendFileSync(envFile, `export GOOGLE_APPLICATION_CREDENTIALS=${keyPath}\n`);
  }

  // 이메일만 출력 — 키 내용은 절대 로그에 남기지 않는다.
  log(`배포 자격증명 준비됨: ${parsed.client_email} (project: ${parsed.project_id})`);
}

prepareCredentials();
log('준비 완료');
