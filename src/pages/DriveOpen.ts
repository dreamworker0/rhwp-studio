import { getToken, requestAuth, requestAuthSilent, clearToken } from '../lib/auth'
import { getFileMeta, downloadFile, uploadFile } from '../lib/drive'
import { renderEditorLayout, renderAuthPrompt, renderLoading, renderError } from '../components/ui'
import { showHwpxToastIfNeeded, showViewerPermToast, setupSaveListener, loadFileDirectly } from '../lib/editor-utils'

export async function renderDriveOpen(app: HTMLElement) {
  const params = new URLSearchParams(location.search)

  // Google Workspace Marketplace: ?state={"ids":["..."],"action":"open"}
  // 자체 앱 링크: ?fileId=...
  let fileId: string | undefined
  const stateParam = params.get('state')
  if (stateParam) {
    try {
      const state = JSON.parse(stateParam)
      fileId = Array.isArray(state.ids) ? state.ids[0] : undefined
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

  // 저장된 토큰 있으면 바로 열기 (localStorage 덕에 탭 닫았다 열어도 유효)
  if (getToken()) {
    await openFileFromDrive(app, fileId)
    return
  }

  // 토큰이 없어도, Marketplace 설치 + 구글 로그인 상태면 화면 없이 조용히 인증 시도.
  // 성공하면 로그인 창 없이 바로 파일을 연다.
  renderLoading(app, '인증 확인 중...')
  try {
    await requestAuthSilent()
    await openFileFromDrive(app, fileId)
    return
  } catch {
    // 조용한 인증 실패(미로그인/미동의 등) → 아래에서 버튼 표시 후 대화형 인증
  }

  // 조용한 인증이 안 되면 사용자 버튼 클릭 필요
  renderAuthPrompt(app, async () => {
    try {
      await requestAuth()
      await openFileFromDrive(app, fileId!)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      renderError(app, '인증에 실패했습니다', msg)
    }
  })
}

async function openFileFromDrive(app: HTMLElement, fileId: string) {
  renderLoading(app, 'Drive에서 파일을 불러오는 중...')

  try {
    const [meta, data] = await Promise.all([
      getFileMeta(fileId),
      downloadFile(fileId),
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
        // 디버그: data 상태 확인
        console.log(`[Download] data type: ${Object.prototype.toString.call(data)}`)
        console.log(`[Download] data.byteLength: ${(data as ArrayBuffer).byteLength}`)
        const debugView = new Uint8Array(data as ArrayBuffer, 0, Math.min(16, (data as ArrayBuffer).byteLength))
        console.log(`[Download] 첫 16바이트:`, Array.from(debugView).map(b => b.toString(16).padStart(2, '0')).join(' '))
        console.log(`[Download] meta.mimeType: ${meta.mimeType}, fileName: ${fileName}`)

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

            // 검증: 저장된 파일을 다시 읽어서 확인
            const savedFile = await handle.getFile()
            const savedBuffer = await savedFile.arrayBuffer()
            const savedView = new Uint8Array(savedBuffer, 0, Math.min(8, savedBuffer.byteLength))
            console.log(`[Download] 저장 완료: ${fileName}`)
            console.log(`[Download] 원본 크기: ${(data as ArrayBuffer).byteLength}, 저장 크기: ${savedBuffer.byteLength}`)
            console.log(`[Download] 저장 파일 첫 8바이트:`, Array.from(savedView).map(b => b.toString(16).padStart(2, '0')).join(' '))
            return
          } catch (pickerErr: any) {
            if (pickerErr?.name === 'AbortError') {
              console.log('[Download] 사용자가 저장을 취소했습니다.')
              return
            }
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

      // 탭 닫기(X) 시 저장 경고
      const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        if (isDirty) {
          e.preventDefault()
        }
      }
      window.addEventListener('beforeunload', beforeUnloadHandler)
    }

    // 버퍼 데이터를 에디터에 주입
    const iframe = editor.element as HTMLIFrameElement
    await loadFileDirectly(iframe, data, meta.name, statusText)

  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : String(e)
    
    // 401 권한 오류 시 자동 로그아웃 및 재인증 유도
    if (msg.includes('401') || msg.includes('UNAUTHENTICATED') || msg.toLowerCase().includes('invalid credentials')) {
      clearToken()
      app.innerHTML = ''
      renderAuthPrompt(app, async () => {
        try {
          await requestAuth()
          await openFileFromDrive(app, fileId)
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          renderError(app, '인증에 실패했습니다', errMsg)
        }
      })
      return
    }

    renderError(app, '파일을 열 수 없습니다', msg)
  }
}
