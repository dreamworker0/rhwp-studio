import { getToken, requestAuth } from '../lib/auth'
import { getFileMeta, downloadFile } from '../lib/drive'
import { renderEditorLayout, renderAuthPrompt, renderLoading, renderError } from '../components/ui'
import { showHwpxToastIfNeeded, setupSaveListener, loadFileDirectly } from '../lib/editor-utils'

export async function renderDriveOpen(app: HTMLElement) {
  const params = new URLSearchParams(location.search)
  const fileIds = params.get('fileId')?.split(',')
  const fileId = fileIds?.[0]?.trim()

  if (!fileId) {
    renderError(app, '파일 ID가 없습니다', 'Drive에서 파일을 열어주세요.')
    return
  }

  const existingToken = getToken()
  if (existingToken) {
    await openFileFromDrive(app, fileId)
    return
  }

  renderAuthPrompt(app, async () => {
    try {
      await requestAuth()
      await openFileFromDrive(app, fileId)
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
    renderLoading(app, isHwpx ? '미리보기를 준비하는 중...' : '에디터를 준비하는 중...')
    document.title = `${meta.name} — rhwp Studio${isHwpx ? ' (미리보기)' : ''}`

    // DOM 렌더링
    app.innerHTML = renderEditorLayout(meta.name, isHwpx)

    document.getElementById('btn-back')?.addEventListener('click', () => { history.back() })
    
    document.getElementById('btn-download')?.addEventListener('click', () => {
      const blob = new Blob([data], { type: meta.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = meta.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })

    const statusText = document.getElementById('save-status')

    // hwpx 토스트
    if (isHwpx) showHwpxToastIfNeeded()

    // @rhwp/editor 로딩
    const { createEditor } = await import('@rhwp/editor')
    const container = document.getElementById('editor-container')!

    const studioUrl = isHwpx ? '/editor/index.html?mode=view' : '/editor/index.html'
    const editor = await createEditor(container, { studioUrl })

    // hwp 파일만 저장 핸들러 등록 (hwpx는 미리보기 전용)
    if (!isHwpx) {
      setupSaveListener(meta.name, meta.mimeType, fileId, statusText)
    }

    // 버퍼 데이터를 에디터에 주입
    const iframe = editor.element as HTMLIFrameElement
    await loadFileDirectly(iframe, data, meta.name, statusText)

  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : String(e)
    renderError(app, '파일을 열 수 없습니다', msg)
  }
}
