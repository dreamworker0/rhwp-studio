/**
 * Google OAuth 2.0 - Google Identity Services (implicit flow)
 */

// OAuth Client ID
// GCP Console → API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID에서 확인
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_KEY = 'rhwp_drive_token'
const TOKEN_EXPIRY_KEY = 'rhwp_drive_token_expiry'

// @types/google.accounts is not in node_modules, so we declare minimal types
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: { access_token: string; error?: string; expires_in?: number }) => void
          }): { requestAccessToken(): void }
        }
      }
    }
  }
}

let tokenClientInstance: { requestAccessToken(): void } | null = null

export function getToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY)
  if (!token || !expiry) return null
  if (Date.now() > Number(expiry)) {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
    return null
  }
  return token
}

function saveToken(token: string, expiresIn = 3600) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000))
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

export async function requestAuth(): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error(
      'Google OAuth Client ID가 설정되지 않았습니다.\n' +
      '.env 파일에 VITE_GOOGLE_CLIENT_ID를 설정해주세요.'
    )
  }

  await waitForGIS()

  return new Promise((resolve, reject) => {
    if (!tokenClientInstance) {
      tokenClientInstance = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (response) => {
          if (response.error) {
            reject(new Error(`OAuth 오류: ${response.error}`))
          } else {
            saveToken(response.access_token, response.expires_in)
            resolve(response.access_token)
          }
        },
      })
    }
    tokenClientInstance.requestAccessToken()
  })
}

export async function ensureAuth(): Promise<string> {
  const existing = getToken()
  if (existing) return existing
  return requestAuth()
}
