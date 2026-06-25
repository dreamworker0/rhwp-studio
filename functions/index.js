/**
 * Drive OAuth 백엔드 — authorization code flow + refresh token
 *
 * 목적: 브라우저 implicit flow(1시간 토큰, refresh 없음)의 한계를 넘어
 *       "오래 유지되는 로그인"을 제공한다.
 *
 * 흐름:
 *   1) /api/auth/login    → Google 동의 화면으로 리다이렉트(code flow, offline)
 *   2) /api/auth/callback → code를 access/refresh token으로 교환,
 *                           refresh_token을 Firestore에 사용자별 저장,
 *                           불투명 세션 ID를 HttpOnly 쿠키로 발급
 *   3) /api/drive-token   → 세션 쿠키 → refresh_token으로 단기 액세스 토큰 발급/반환
 *   4) /api/auth/logout   → 세션/리프레시 토큰 폐기
 *
 * 보안 원칙:
 *   - client_secret, refresh_token 은 절대 클라이언트로 나가지 않는다.
 *   - 브라우저에는 (a) 불투명 HttpOnly 세션 쿠키, (b) 단기 액세스 토큰만 노출.
 *   - Firestore 는 Admin SDK 로만 접근(규칙상 클라이언트 접근 전면 차단).
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// client_secret 은 Secret Manager 에 보관(레포/환경변수에 평문 저장 안 함).
//   설정: firebase functions:secrets:set GOOGLE_CLIENT_SECRET
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_CLIENT_SECRET');

// 공개 값 — 클라이언트 번들에도 노출되는 값이라 비밀 아님.
const CLIENT_ID =
  '292079787292-qmjcruc73ogvoffnf63f28nj7ov30csn.apps.googleusercontent.com';
const APP_ORIGIN = 'https://rhwp-studio.web.app';
const REDIRECT_URI = `${APP_ORIGIN}/api/auth/callback`;
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
].join(' ');

// ⚠️ Firebase Hosting 은 '__session' 이름의 쿠키만 함수로 전달/설정하도록 허용한다.
//    (나머지 쿠키는 CDN 캐싱을 위해 제거됨) → 세션 쿠키 이름은 반드시 '__session'.
const SESSION_COOKIE = '__session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60일
const STATE_TTL_MS = 10 * 60 * 1000; // OAuth state 유효 10분

// ─── 쿠키 유틸 ──────────────────────────────────────────────────────────
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(res, name, value, { maxAge, clear } = {}) {
  const parts = [
    `${name}=${clear ? '' : encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  if (clear) parts.push('Max-Age=0');
  else if (maxAge) parts.push(`Max-Age=${maxAge}`);
  res.append('Set-Cookie', parts.join('; '));
}

// 오픈 리다이렉트 방지: 동일 출처 내부 경로만 허용
function safeReturnPath(p) {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

function decodeJwtSub(idToken) {
  try {
    const payload = JSON.parse(
      Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'),
    );
    return payload.sub || null;
  } catch {
    return null;
  }
}

async function exchangeToken(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  return res;
}

// ─── 핸들러 ─────────────────────────────────────────────────────────────
async function handleLogin(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  const ret = safeReturnPath(req.query.return);
  // state(CSRF) + 복귀 경로를 Firestore 에 단기 저장.
  // (Hosting 이 '__session' 외 쿠키를 제거하므로 state 를 쿠키로 못 쓴다.)
  await db.collection('oauthStates').doc(state).set({
    ret,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('access_type', 'offline'); // refresh_token 요청
  url.searchParams.set('prompt', 'consent'); // refresh_token 확실히 받기
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  res.redirect(302, url.toString());
}

async function handleCallback(req, res) {
  const state = String(req.query.state || '');
  if (!req.query.code || !state) {
    res.status(400).send('잘못된 OAuth 요청');
    return;
  }
  // Firestore 에 저장해 둔 state 확인(존재 + 만료 검사) 후 1회용으로 삭제.
  const stateRef = db.collection('oauthStates').doc(state);
  const stateSnap = await stateRef.get();
  await stateRef.delete().catch(() => {});
  if (!stateSnap.exists) {
    res.status(400).send('잘못된 OAuth 요청(state 불일치)');
    return;
  }
  const stateData = stateSnap.data();
  const createdMs = stateData.createdAt ? stateData.createdAt.toMillis() : 0;
  if (!createdMs || Date.now() - createdMs > STATE_TTL_MS) {
    res.status(400).send('로그인 요청이 만료되었습니다. 다시 시도해 주세요.');
    return;
  }
  const ret = safeReturnPath(stateData.ret);

  const tokenRes = await exchangeToken({
    code: req.query.code,
    client_id: CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET.value(),
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  if (!tokenRes.ok) {
    console.error('[callback] token exchange 실패', await tokenRes.text());
    res.status(502).send('토큰 교환에 실패했습니다.');
    return;
  }
  const tok = await tokenRes.json();
  const sub = decodeJwtSub(tok.id_token);
  if (!sub) {
    res.status(502).send('사용자 식별 실패');
    return;
  }

  // refresh_token 은 최초 동의 때만 내려온다. 있으면 저장(merge).
  if (tok.refresh_token) {
    await db.collection('driveUsers').doc(sub).set(
      {
        refreshToken: tok.refresh_token,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  const sid = crypto.randomBytes(24).toString('hex');
  await db.collection('driveSessions').doc(sid).set({
    sub,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  setCookie(res, SESSION_COOKIE, sid, { maxAge: SESSION_MAX_AGE });
  res.redirect(302, APP_ORIGIN + safeReturnPath(ret));
}

async function handleDriveToken(req, res) {
  const cookies = parseCookies(req);
  const sid = cookies[SESSION_COOKIE];
  if (!sid) {
    res.status(401).json({ error: 'no_session' });
    return;
  }
  const sess = await db.collection('driveSessions').doc(sid).get();
  if (!sess.exists) {
    res.status(401).json({ error: 'invalid_session' });
    return;
  }
  const { sub } = sess.data();
  const userDoc = await db.collection('driveUsers').doc(sub).get();
  const refreshToken = userDoc.exists ? userDoc.data().refreshToken : null;
  if (!refreshToken) {
    res.status(401).json({ error: 'no_refresh_token' });
    return;
  }

  const r = await exchangeToken({
    client_id: CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET.value(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  if (!r.ok) {
    // refresh_token 폐기/만료 → 재로그인 필요
    console.warn('[drive-token] refresh 실패', await r.text());
    res.status(401).json({ error: 'refresh_failed' });
    return;
  }
  const tok = await r.json();
  res.set('Cache-Control', 'no-store');
  res.json({ access_token: tok.access_token, expires_in: tok.expires_in });
}

async function handleLogout(req, res) {
  const cookies = parseCookies(req);
  const sid = cookies[SESSION_COOKIE];
  if (sid) {
    await db.collection('driveSessions').doc(sid).delete().catch(() => {});
  }
  setCookie(res, SESSION_COOKIE, '', { clear: true });
  res.json({ ok: true });
}

// ─── 라우터 ─────────────────────────────────────────────────────────────
// Hosting rewrite(/api/**)로 들어오므로 req.path 는 "/api/..." 형태다.
exports.api = onRequest(
  { secrets: [GOOGLE_CLIENT_SECRET], region: 'asia-northeast3' },
  async (req, res) => {
    const path = req.path.replace(/^\/api/, '') || '/';
    try {
      if (path === '/auth/login') return await handleLogin(req, res);
      if (path === '/auth/callback') return await handleCallback(req, res);
      if (path === '/drive-token') return await handleDriveToken(req, res);
      if (path === '/auth/logout') return await handleLogout(req, res);
      res.status(404).send('Not found');
    } catch (e) {
      console.error('[api] 처리 오류', e);
      res.status(500).send('Internal error');
    }
  },
);
