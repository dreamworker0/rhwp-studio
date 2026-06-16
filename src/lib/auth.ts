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
            callback: (response: { access_token: string; error?: string; expires_in?: number }) => void
          }): { requestAccessToken(opts?: { prompt?: string }): void }
        }
      }
    }
  }
}

let tokenClientInstance: { requestAccessToken(opts?: { prompt?: string }): void } | null = null

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
 * 사용자 버튼 클릭 후 호출.
 *
 * Marketplace 설치 시 부여된 동의를 재사용하기 위해 `prompt: ''`(조용한 재사용)을
 * 먼저 시도하고, 기존 동의가 없을 때만 대화형 동의 화면(`prompt: 'consent'`)으로
 * 폴백한다. 이렇게 하면 이미 동의한 사용자에게 두 번째 동의 화면이 뜨지 않는다.
 *
 * ⚠️ 동의 화면이 다시 뜨지 않으려면, 여기서 요청하는 SCOPE가 OAuth 동의 화면 /
 *    Marketplace SDK / Drive SDK에 설정된 스코프와 "정확히" 일치해야 한다.
 */
export async function requestAuth(): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error(
      'Google OAuth Client ID가 설정되지 않았습니다.\n' +
      '.env 파일에 VITE_GOOGLE_CLIENT_ID를 설정해주세요.'
    )
  }

  await waitForGIS()

  return new Promise((resolve, reject) => {
    const gis = window.google?.accounts?.oauth2
    if (!gis) {
      reject(new Error('Google Identity Services를 로드할 수 없습니다.'))
      return
    }

    let triedInteractive = false

    tokenClientInstance = gis.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          // 조용한 재사용이 실패한 경우(기존 동의 없음 등): 한 번만 대화형으로 폴백
          if (!triedInteractive) {
            triedInteractive = true
            tokenClientInstance!.requestAccessToken({ prompt: 'consent' })
            return
          }
          reject(new Error(`OAuth 오류: ${response.error}`))
        } else {
          saveToken(response.access_token, response.expires_in)
          resolve(response.access_token)
        }
      },
    })

    // 1차: 기존 동의 재사용 시도(화면 없음). 실패 시 callback에서 대화형 폴백.
    tokenClientInstance.requestAccessToken({ prompt: '' })
  })
}

export async function ensureAuth(): Promise<string> {
  const existing = getToken()
  if (existing) return existing
  return requestAuth()
}
