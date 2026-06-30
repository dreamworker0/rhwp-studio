import { getAccessToken, startLogin, clearTokenCache, NotAuthenticatedError } from '../lib/auth'
import { getFileMeta, downloadFile, uploadFile } from '../lib/drive'
import { renderEditorLayout, renderAuthPrompt, renderLoading, renderError } from '../components/ui'
import { showHwpxToastIfNeeded, showViewerPermToast, setupSaveListener, loadFileDirectly } from '../lib/editor-utils'

// 자동 로그인 리다이렉트 시도 횟수 가드(탭 단위, 탭 닫으면 소멸). 무한 루프 방지용.
const AUTH_ATTEMPT_KEY = 'rhwp_auth_attempts'
const MAX_AUTO_ATTEMPTS = 2

/**
 * 세션이 없을 때의 재인증 처리. 중간 버튼 없이 곧장 Google 로그인으로 이동한다.
 * - 1차: 무음 리다이렉트(이미 동의한 사용자는 화면 없이 매끄럽게 복귀).
 * - 2차: 무음 로그인으로도 세션이 안 잡히면 동의/계정선택을 강제해 자동 리다이렉트
 *   (refresh_token 미발급 등 복구).
 * - 그 이후(2회 모두 실패): 무한 루프 방지를 위해 수동 버튼으로만 폴백.
 */
function attemptReauth(
  app: HTMLElement,
  returnPath: string,
  opts: { loginHint?: string; force?: boolean },
) {
  const attempts = Number(sessionStorage.getItem(AUTH_ATTEMPT_KEY) || '0')
  if (attempts >= MAX_AUTO_ATTEMPTS) {
    // 자동 시도가 모두 실패 → 더 이상 자동 이동하지 않고 수동 버튼으로 폴백.
    sessionStorage.removeItem(AUTH_ATTEMPT_KEY)
    renderAuthPrompt(app, () => startLogin(returnPath, { loginHint: opts.loginHint, force: true }))
    return
  }
  sessionStorage.setItem(AUTH_ATTEMPT_KEY, String(attempts + 1))
  // 2차 시도부터는 동의/계정선택 강제(무음 로그인이 세션을 못 만든 경우 복구).
  const force = opts.force || attempts >= 1
  renderLoading(app, 'Google 로그인으로 이동 중...')
  startLogin(returnPath, { loginHint: opts.loginHint, force })
}

export async function renderDriveOpen(app: HTMLElement) {
  const params = new URLSearchParams(location.search)

  // Google Workspace Marketplace: ?state={"ids":["..."],"action":"open","userId":"..."}
  // 자체 앱 링크: ?fileId=...
  let fileId: string | undefined
  let loginHint: string | undefined
  const stateParam = params.get('state')
  if (stateParam) {
    try {
      const state = JSON.parse(stateParam)
      fileId = Array.isArray(state.ids) ? state.ids[0] : undefined
      // Drive 가 넘기는 userId(=OAuth sub)를 login_hint 로 사용 → 계정 선택 건너뛰기
      if (typeof state.userId === 'string' && state.userId) loginHint = state.userId
    } catch {
      // state 파싱 실패 시 무시
    }
  }
  if (!fileId) {
    fileId = params.get('fileId')?.split(',')[0]?.trim()
  }

  if (!fileId) {
    renderError(app, '파일 ID가 없습니다', 'Drive에서 파일을 열어주세요.')
    return
  }

  const returnPath = location.pathname + location.search

  // 백엔드 세션으로 토큰 확보 시도. 세션 쿠키가 살아 있으면(최대 60일) 창 없이 바로 연다.
  renderLoading(app, '인증 확인 중...')
  try {
    await getAccessToken()
    // 세션 유효 → 이전 자동 리다이렉트 가드 해제(다음 만료 시 깨끗한 시도 보장)
    sessionStorage.removeItem(AUTH_ATTEMPT_KEY)
    await openFileFromDrive(app, fileId, loginHint)
    return
  } catch (e: unknown) {
    if (!(e instanceof NotAuthenticatedError)) {
      renderError(app, '인증 확인에 실패했습니다', e instanceof Error ? e.message : String(e))
      return
    }
    // 세션 없음 → 자동으로 로그인 이동(완료 후 이 파일로 복귀).
  }
  attemptReauth(app, returnPath, { loginHint, force: false })
}

async function openFileFromDrive(app: HTMLElement, fileId: string, loginHint?: string) {
  renderLoading(app, 'Drive에서 파일을 불러오는 중...')
  // 스피너 DOM 재생성 없이 메시지/막대만 갱신(깜빡임 방지)
  const loadingMsg = app.querySelector('.loading-msg')
  // 진행률 막대 — 다운로드 크기를 알 때만 표시(기본 숨김)
  const loadingScreen = app.querySelector('.loading-screen')
  const progressBar = document.createElement('div')
  progressBar.className = 'progress-bar'
  progressBar.style.display = 'none'
  progressBar.innerHTML = '<div class="progress-fill"></div>'
  const progressFill = progressBar.firstElementChild as HTMLElement
  if (loadingScreen && loadingMsg) loadingScreen.insertBefore(progressBar, loadingMsg)

  try {
    const [meta, data] = await Promise.all([
      getFileMeta(fileId),
      downloadFile(fileId, (loaded, total) => {
        if (total) {
          const pct = Math.floor((loaded / total) * 100)
          progressBar.style.display = ''
          progressFill.style.width = `${pct}%`
          if (loadingMsg) loadingMsg.textContent = `Drive에서 불러오는 중... ${pct}%`
        } else if (loadingMsg) {
          const mb = (loaded / (1024 * 1024)).toFixed(1)
          loadingMsg.textContent = `Drive에서 불러오는 중... ${mb}MB`
        }
      }),
    ])

    const ext = meta.name.split('.').pop()?.toLowerCase()
    if (!['hwp', 'hwpx'].includes(ext ?? '')) {
      renderError(app, '지원하지 않는 파일 형식', `${meta.name}은(는) HWP/HWPX 파일이 아닙니다.`)
      return
    }

    const isHwpx = ext === 'hwpx'
    const canEdit = meta.capabilities?.canEdit ?? true
    const viewOnly = isHwpx || !canEdit
    renderLoading(app, viewOnly ? '미리보기를 준비하는 중...' : '에디터를 준비하는 중...')
    document.title = `${meta.name} — rhwp Studio${viewOnly ? ' (미리보기)' : ''}`

    // DOM 렌더링
    app.innerHTML = renderEditorLayout(meta.name, viewOnly)

    document.getElementById('btn-back')?.addEventListener('click', async () => {
      // 뷰어 모드(hwpx 또는 canEdit=false)는 저장 확인 없이 바로 뒤로가기
      if (viewOnly) {
        history.back()
        return
      }

      // HWP 파일: 저장 확인 다이얼로그
      const result = confirm('변경 사항을 Google Drive에 저장하시겠습니까?')
      if (result) {
        // iframe에서 현재 문서 바이너리를 요청
        const iframe = document.querySelector('#editor-container iframe') as HTMLIFrameElement | null
        if (!iframe?.contentWindow) {
          alert('에디터를 찾을 수 없습니다.')
          history.back()
          return
        }

        const statusText = document.getElementById('save-status')
        if (statusText) statusText.textContent = '■ 드라이브에 저장 중...'

        try {
          // iframe에 exportFile 요청
          const exportData = await new Promise<{ buffer: number[], fileName: string, mimeType: string }>((resolve, reject) => {
            const msgId = Date.now() + Math.random()
            const timeout = setTimeout(() => {
              window.removeEventListener('message', handler)
              reject(new Error('문서 내보내기 시간 초과'))
            }, 30000)

            function handler(e: MessageEvent) {
              if (e.origin !== location.origin) return
              const d = e.data
              if (d?.type === 'rhwp-response' && d.id === msgId) {
                clearTimeout(timeout)
                window.removeEventListener('message', handler)
                if (d.error) {
                  reject(new Error(d.error))
                } else {
                  resolve(d.result)
                }
              }
            }

            window.addEventListener('message', handler)
            iframe.contentWindow!.postMessage(
              { type: 'rhwp-request', id: msgId, method: 'exportFile', params: {} },
              location.origin,
            )
          })

          // number[] → Uint8Array 변환 후 업로드
          const fileBytes = new Uint8Array(exportData.buffer)
          await uploadFile(
            exportData.fileName || meta.name,
            fileBytes,
            exportData.mimeType || meta.mimeType || 'application/x-hwp',
            fileId,
          )

          if (statusText) statusText.textContent = '✔ 저장 완료'
          console.log('[DriveOpen] 닫기 전 저장 완료')

          // 저장 완료 후 짧은 딜레이 후 뒤로가기
          setTimeout(() => { history.back() }, 500)
        } catch (err) {
          console.error('[DriveOpen] 닫기 전 저장 실패:', err)
          if (statusText) statusText.textContent = '❌ 저장 실패'
          const forceClose = confirm('저장에 실패했습니다. 그래도 닫으시겠습니까?')
          if (forceClose) history.back()
        }
      } else {
        // "아니오" → 저장 없이 뒤로가기
        history.back()
      }
    })
    
    document.getElementById('btn-download')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-download') as HTMLButtonElement | null
      if (btn) { btn.disabled = true; btn.textContent = '다운로드 중...' }

      try {
        const fileName = meta.name

        // 원본 Drive 데이터를 그대로 사용 (WASM export는 손상 가능성이 있으므로 사용하지 않음)
        const blob = new Blob([data], { type: meta.mimeType || 'application/x-hwp' })

        // 방법 1: File System Access API (Chrome 86+) — 저장 다이얼로그로 파일명 확실히 지정
        if ('showSaveFilePicker' in window) {
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: fileName,
            })
            const writable = await handle.createWritable()
            // ArrayBuffer를 직접 기록 (Blob 변환 없이)
            await writable.write(data)
            await writable.close()
            return
          } catch (pickerErr: any) {
            if (pickerErr?.name === 'AbortError') return
            console.warn('[Download] showSaveFilePicker 실패, fallback 사용:', pickerErr)
          }
        }

        // 방법 2: Blob URL fallback (showSaveFilePicker 미지원 시)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 3000)
      } catch (err) {
        console.error('[Download] 다운로드 실패:', err)
        alert('다운로드에 실패했습니다.')
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '다운로드' }
      }
    })

    const statusText = document.getElementById('save-status')

    // 뷰어 모드 토스트
    if (isHwpx) showHwpxToastIfNeeded()
    else if (!canEdit) showViewerPermToast()

    // @rhwp/editor 로딩
    const { createEditor } = await import('@rhwp/editor')
    const container = document.getElementById('editor-container')!

    const studioUrl = viewOnly ? '/editor/index.html?mode=view' : '/editor/index.html'
    const editor = await createEditor(container, { studioUrl })

    // 편집 가능한 hwp 파일만 저장 핸들러 등록 + 탭 닫기 경고
    if (!viewOnly) {
      let isDirty = false

      // 에디터에서 변경 발생 시 dirty 표시
      const dirtyHandler = (e: MessageEvent) => {
        if (e.origin !== location.origin) return
        if (e.data?.type === 'document-dirty') isDirty = true
      }
      window.addEventListener('message', dirtyHandler)

      // 저장 성공 시 dirty 해제
      setupSaveListener(meta.name, meta.mimeType, fileId, statusText, () => { isDirty = false })

      // 탭 닫기(X) 시 저장 경고 — 일부 브라우저는 returnValue 설정이 있어야 경고가 뜬다.
      const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        if (isDirty) {
          e.preventDefault()
          e.returnValue = ''
        }
      }
      window.addEventListener('beforeunload', beforeUnloadHandler)
    }

    // 버퍼 데이터를 에디터에 주입
    const iframe = editor.element as HTMLIFrameElement
    try {
      await loadFileDirectly(iframe, data, meta.name, statusText)
    } finally {
      // 문서 로드가 끝나면(성공/실패 모두) 에디터 영역 로딩 오버레이 제거
      document.getElementById('editor-loading')?.remove()
    }

  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : String(e)

    // 401 권한 오류 시 토큰 캐시를 비우고 재로그인 유도(동의 강제로 refresh_token 재발급)
    if (msg.includes('401') || msg.includes('UNAUTHENTICATED') || msg.toLowerCase().includes('invalid credentials')) {
      clearTokenCache()
      app.innerHTML = ''
      attemptReauth(app, location.pathname + location.search, { loginHint, force: true })
      return
    }

    renderError(app, '파일을 열 수 없습니다', msg)
  }
}
