/**
 * Google OAuth 2.0 - Google Identity Services (implicit flow)
 *
 * - 토큰을 localStorage에 저장 (탭 닫아도 유지)
 * - 무음 재인증(silent auth): prompt:'none'으로 토큰 만료 시 자동 갱신 시도
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

const SCOPE = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
].join(' ')
const TOKEN_KEY = 'rhwp_drive_token'
const TOKEN_EXPIRY_KEY = 'rhwp_drive_token_expiry'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            prompt?: string
            login_hint?: string
            callback: (response: { access_token: string; error?: string; expires_in?: number }) => void
            error_callback?: (error: { type?: string; message?: string }) => void
          }): { requestAccessToken(opts?: { prompt?: string }): void }
        }
      }
    }
  }
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  if (!token || !expiry) return null
  if (Date.now() > Number(expiry)) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    return null
  }
  return token
}

function saveToken(token: string, expiresIn = 3600) {
  // 만료 5분 전에 갱신하도록 여유를 둠
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (expiresIn - 300) * 1000))
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

async function waitForGIS(timeout = 5000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        resolve()
      } else if (Date.now() - start > timeout) {
        reject(new Error('Google Identity Services 로드 실패'))
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

/**
 * 토큰 1회 획득. `prompt`에 따라 동작이 다르다.
 *
 * - `'none'`  : 화면을 절대 띄우지 않는 "조용한 인증". Marketplace 설치 시 동의를 마쳤고
 *               사용자가 구글에 로그인된 상태면 창 없이 토큰을 반환한다. 그렇지 않으면
 *               즉시 reject(상호작용 필요) → 호출부에서 대화형으로 폴백한다.
 * - `'consent'`: 동의/계정 선택 화면을 띄우는 대화형 인증.
 *
 * ⚠️ 동의 화면이 다시 뜨지 않으려면, 여기서 요청하는 SCOPE가 OAuth 동의 화면 /
 *    Marketplace SDK / Drive SDK에 설정된 스코프와 "정확히" 일치해야 한다.
 */
async function acquireToken(prompt: 'none' | 'consent'): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error(
      'Google OAuth Client ID가 설정되지 않았습니다.\n' +
      '.env 파일에 VITE_GOOGLE_CLIENT_ID를 설정해주세요.'
    )
  }

  await waitForGIS()

  const gis = window.google?.accounts?.oauth2
  if (!gis) {
    throw new Error('Google Identity Services를 로드할 수 없습니다.')
  }

  return new Promise((resolve, reject) => {
    const client = gis.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      prompt,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`OAuth 오류: ${response.error}`))
          return
        }
        saveToken(response.access_token, response.expires_in)
        resolve(response.access_token)
      },
      // prompt:'none' 실패(상호작용 필요 등)는 보통 여기로 전달된다.
      error_callback: (err) => {
        reject(new Error(err?.type || err?.message || 'auth_error'))
      },
    })
    client.requestAccessToken()
  })
}

/**
 * 화면 없이 토큰을 시도한다. 설치+로그인된 사용자는 창 없이 통과.
 * 상호작용이 필요하면 reject 하므로, 호출부에서 catch 후 requestAuth()로 폴백한다.
 */
export function requestAuthSilent(): Promise<string> {
  return acquireToken('none')
}

/**
 * 동의/계정 선택 화면을 띄우는 대화형 인증. 사용자 버튼 클릭 후 호출.
 */
export function requestAuth(): Promise<string> {
  return acquireToken('consent')
}

export async function ensureAuth(): Promise<string> {
  const existing = getToken()
  if (existing) return existing
  // 먼저 조용히 시도하고, 안 되면 대화형으로 폴백
  try {
    return await requestAuthSilent()
  } catch {
    return requestAuth()
  }
}
