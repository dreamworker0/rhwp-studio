/**
 * Drive 인증 (서버 기반 — authorization code + refresh token)
 *
 * 로그인/토큰 발급은 백엔드(/api/*)가 담당한다.
 * - 브라우저는 장기 HttpOnly 세션 쿠키 + 단기 액세스 토큰(메모리 캐시)만 다룬다.
 * - refresh_token / client_secret 은 클라이언트에 존재하지 않는다.
 * - 세션 쿠키가 살아 있는 한(최대 60일, refresh_token 유효) 재로그인 없이 토큰이 발급된다.
 */

/** 백엔드에 유효한 세션이 없을 때(로그인 필요). */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('not_authenticated')
    this.name = 'NotAuthenticatedError'
  }
}

let cached: { token: string; expiresAt: number } | null = null

/**
 * 백엔드에서 단기 액세스 토큰을 받아온다(만료 1분 전까지 메모리 캐시 재사용).
 * 세션이 없으면 NotAuthenticatedError 를 던진다.
 */
export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token

  const res = await fetch('/api/drive-token', { credentials: 'include' })
  if (res.status === 401) {
    cached = null
    throw new NotAuthenticatedError()
  }
  if (!res.ok) {
    throw new Error(`토큰 발급 실패 (${res.status})`)
  }
  const { access_token, expires_in } = await res.json()
  cached = {
    token: access_token,
    expiresAt: Date.now() + Math.max((Number(expires_in) - 60) * 1000, 30_000),
  }
  return access_token
}

/** 메모리 토큰 캐시를 비운다(예: Drive 401 응답 후 강제 재발급용). */
export function clearTokenCache() {
  cached = null
}

/** Google 로그인으로 전체 화면 리다이렉트. 콜백 후 returnPath 로 복귀한다. */
export function startLogin(returnPath: string = location.pathname + location.search): void {
  location.href = `/api/auth/login?return=${encodeURIComponent(returnPath)}`
}

/**
 * 토큰을 보장한다. 세션이 없으면 로그인으로 리다이렉트하고
 * 페이지 전환을 기다리며 resolve 하지 않는다.
 */
export async function ensureAuth(): Promise<string> {
  try {
    return await getAccessToken()
  } catch (e) {
    if (e instanceof NotAuthenticatedError) {
      startLogin()
      return new Promise<string>(() => {}) // 리다이렉트 대기 (의도적으로 resolve 안 함)
    }
    throw e
  }
}

/** 로그아웃: 백엔드 세션 폐기 + 메모리 캐시 비움. */
export async function logout(): Promise<void> {
  cached = null
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // 네트워크 오류는 무시 — 캐시는 이미 비웠다.
  }
}
