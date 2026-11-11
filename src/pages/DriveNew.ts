import { escapeHtml, renderError, renderLoading } from '../components/ui'
import { getAccessToken, NotAuthenticatedError } from '../lib/auth'
import { setupSaveListener } from '../lib/editor-utils'
import { attemptReauth, AUTH_ATTEMPT_KEY } from './DriveOpen'

// 에디터가 새 문서에 붙이는 이름. 첫 저장 전 메시지에 파일명이 없을 때의 기본값.
const NEW_DOC_NAME = '새 문서.hwp'

export async function renderDriveNew(app: HTMLElement) {
  // Drive "새로 만들기": ?state={"action":"create","folderId":"...","userId":"..."}
  let folderId: string | undefined
  let loginHint: string | undefined
  const stateParam = new URLSearchParams(location.search).get('state')
  if (stateParam) {
    try {
      const state = JSON.parse(stateParam)
      if (typeof state.folderId === 'string' && state.folderId) folderId = state.folderId
      if (typeof state.userId === 'string' && state.userId) loginHint = state.userId
    } catch {
      // state 파싱 실패 시 내 드라이브 루트에 저장
    }
  }

  // 저장하려면 Drive 토큰이 필요하므로 편집 전에 세션부터 확보한다.
  renderLoading(app, '인증 확인 중...')
  try {
    await getAccessToken()
  } catch (e: unknown) {
    if (e instanceof NotAuthenticatedError) {
      attemptReauth(app, location.pathname + location.search, { loginHint, force: false })
    } else {
      renderError(app, '인증 확인에 실패했습니다', e instanceof Error ? e.message : String(e))
    }
    return
  }
  sessionStorage.removeItem(AUTH_ATTEMPT_KEY)

  app.innerHTML = `
    <div class="editor-layout">
      <header class="editor-header-bar" style="padding-left: 12px;">
        <span class="editor-title">새 문서 — rhwp Studio</span>
        <span id="save-status" style="font-size:14px; font-weight:bold; color:#4ade80; margin-left:15px;"></span>
      </header>
      <div id="editor-container" style="width: 100vw; height: calc(100vh - 50px);"></div>
    </div>
  `

  const container = document.getElementById('editor-container')
  if (!container) return

  // 첫 저장에서 Drive 에 파일이 생기면, 새로고침 시 그 파일이 열리도록 주소를 바꾼다.
  let createdId: string | undefined
  setupSaveListener(
    NEW_DOC_NAME,
    'application/x-hwp',
    undefined,
    document.getElementById('save-status'),
    (id) => {
      if (createdId) return
      createdId = id
      const openState = JSON.stringify({ ids: [id], action: 'open', ...(loginHint ? { userId: loginHint } : {}) })
      history.replaceState(null, '', `/drive/open?state=${encodeURIComponent(openState)}`)
    },
    folderId ? [folderId] : undefined,
  )

  try {
    const { createEditor } = await import('@rhwp/editor');
    // [cache-bust] 엣지 고착 우회용 버전 쿼리 (DriveOpen 과 동일 태그 유지)
    await createEditor(container, { studioUrl: '/editor/index.html?v20261111' });

  } catch (e: unknown) {
    console.error('Editor Error', e)
    container.innerHTML = `<div style="padding: 2rem; color: red;">뷰어 엔진을 불러오지 못했습니다: ${escapeHtml(String(e))}</div>`
  }
}
