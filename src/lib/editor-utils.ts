import { uploadFile } from './drive'

const HWPX_EDIT_TOAST_KEY = 'rhwp_hwpx_edit_toast_dismissed'

// ─── HWPX 편집 안내 토스트 (첫 편집 1회, localStorage로 다시보지않기) ──────
// HWPX 저장은 구조는 보존하나 시각 충실도는 보장되지 않으므로 사본 편집을 권한다.
export function showHwpxEditToastIfNeeded(): void {
  let dismissed = false
  try { dismissed = localStorage.getItem(HWPX_EDIT_TOAST_KEY) === '1' } catch { /* 제한 환경 무시 */ }
  if (dismissed) return

  const toast = document.getElementById('hwpx-edit-toast')
  if (!toast) return
  toast.style.display = 'block'
  toast.style.opacity = '1'

  // '다시 보지 않기'를 누를 때까지 유지 (자동으로 사라지지 않음)
  document.getElementById('hwpx-edit-toast-close')?.addEventListener('click', () => {
    try { localStorage.setItem(HWPX_EDIT_TOAST_KEY, '1') } catch { /* 무시 */ }
    toast.style.opacity = '0'
    setTimeout(() => { toast.style.display = 'none' }, 400)
  })
}

export function showViewerPermToast(): void {
  const toast = document.getElementById('viewer-perm-toast')
  if (!toast) return
  toast.style.display = 'block'
  toast.style.opacity = '1'
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => { toast.style.display = 'none' }, 400)
  }, 4000)
}

// ─── Drive 저장 메시지 리스너 (hwp 전용) ─────────────────────────────────
export function setupSaveListener(
  metaName: string,
  metaMimeType: string,
  fileId: string,
  statusText: HTMLElement | null,
  onSaveSuccess?: () => void,
): () => void {
  const handler = async (e: MessageEvent) => {
    if (e.origin !== location.origin) return

    const msg = e.data
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'rhwp-response' || msg.type === 'rhwp-request') return
    if (msg.type !== 'save' && msg.type !== 'rhwp-save' && msg.action !== 'save') return

    console.log('[DriveOpen] 저장 메시지 수신:', msg)
    const payload = msg.data || {}
    const fileBuffer: ArrayBuffer | Uint8Array | null =
      payload.buffer instanceof ArrayBuffer ? payload.buffer :
      payload.file instanceof ArrayBuffer   ? payload.file   :
      payload instanceof ArrayBuffer        ? payload        :
      null

    const saveName: string = payload.filename || payload.name || metaName
    const saveMime: string = payload.mimeType || metaMimeType || 'application/x-hwp'

    if (!fileBuffer) {
      console.warn('[DriveOpen] 저장 메시지에 buffer가 없습니다:', payload)
      return
    }

    try {
      if (statusText) statusText.textContent = '저장 중...'
      console.log(`[DriveOpen] Google Drive 업로드: ${saveName} (${(fileBuffer as ArrayBuffer).byteLength ?? '?'} bytes)`)
      await uploadFile(saveName, fileBuffer, saveMime, fileId)
      onSaveSuccess?.()
      if (statusText) {
        const now = new Date()
        const hh = now.getHours().toString().padStart(2, '0')
        const mm = now.getMinutes().toString().padStart(2, '0')
        statusText.textContent = `✔ 마지막 저장 ${hh}:${mm}`
      }
      console.log('[DriveOpen] Google Drive 저장 성공')
    } catch (err) {
      console.error('[DriveOpen] Google 드라이브 저장 실패:', err)
      alert('구글 드라이브 업로드에 실패했습니다.')
      if (statusText) statusText.textContent = '❌ 저장 실패'
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

/**
 * @rhwp/editor의 loadFile 메서드를 우회하여 iframe에 직접 postMessage로 파일을 전송합니다.
 */
export async function loadFileDirectly(
  iframe: HTMLIFrameElement,
  data: ArrayBuffer,
  fileName: string,
  statusEl: HTMLElement | null,
): Promise<void> {
  const TIMEOUT_MS = 60_000
  const MAX_RETRIES = 5
  const RETRY_DELAY_MS = 2_000
  const POLL_DELAY_MS = 1_500     // loadFile 전송 후 첫 pageCount 폴링까지 대기
  const POLL_INTERVAL_MS = 2_000  // 이후 pageCount 폴링 주기
  const bytes = new Uint8Array(data)
  // 핸드셰이크 진단이 필요하면 콘솔에서: localStorage.setItem('rhwp_debug_load', '1')
  let debug = false
  try { debug = localStorage.getItem('rhwp_debug_load') === '1' } catch { /* 제한 환경 무시 */ }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const t0 = performance.now()
        const loadId = Date.now() + Math.random()
        const pollIds = new Set<number>()
        let firstPoll: ReturnType<typeof setTimeout> | undefined
        let pollTimer: ReturnType<typeof setInterval> | undefined

        const cleanup = () => {
          window.removeEventListener('message', handler)
          clearTimeout(timer)
          if (firstPoll) clearTimeout(firstPoll)
          if (pollTimer) clearInterval(pollTimer)
        }

        const timer = setTimeout(() => {
          cleanup()
          reject(new Error(`loadFile timeout (${TIMEOUT_MS / 1000}s)`))
        }, TIMEOUT_MS)

        function handler(e: MessageEvent) {
          const d = e.data
          if (!d || typeof d !== 'object' || d.type !== 'rhwp-response') return
          if (e.origin !== location.origin) return
          if (debug) {
            const kind = d.id === loadId ? 'loadFile' : pollIds.has(d.id) ? 'pageCount' : 'other'
            console.log(`[loadFile] +${(performance.now() - t0).toFixed(0)}ms id=${d.id} match=${kind} err=${d.error ?? ''}`)
          }

          if (d.id === loadId) {
            cleanup()
            if (d.error) reject(new Error(d.error))
            else resolve()
          } else if (pollIds.has(d.id) && !d.error && typeof d.result === 'number' && d.result > 0) {
            // loadFile 응답이 유실돼도 문서는 실제로 로드됨 → pageCount 폴백으로 성공 처리
            console.warn('[loadFile] loadFile 응답 미수신 — pageCount 폴백으로 로드 완료 확인')
            cleanup()
            resolve()
          }
        }

        window.addEventListener('message', handler)

        const cw = iframe.contentWindow
        if (!cw) {
          cleanup()
          reject(new Error('에디터 프레임을 찾을 수 없습니다.'))
          return
        }
        cw.postMessage(
          { type: 'rhwp-request', id: loadId, method: 'loadFile', params: { data: bytes, fileName } },
          location.origin,
        )

        // 폴백: loadFile 응답이 도달하지 않는 경우, pageCount로 로딩 완료를 직접 확인
        const sendPoll = () => {
          const pid = Date.now() + Math.random()
          pollIds.add(pid)
          cw.postMessage({ type: 'rhwp-request', id: pid, method: 'pageCount', params: {} }, location.origin)
        }
        firstPoll = setTimeout(() => {
          sendPoll()
          pollTimer = setInterval(sendPoll, POLL_INTERVAL_MS)
        }, POLL_DELAY_MS)
      })

      if (statusEl) statusEl.textContent = ''
      return

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)

      if (errMsg.includes('wbindgen') || errMsg.includes('undefined') || errMsg.includes('not initialized')) {
        console.warn(`[DriveOpen] WASM 초기화 대기 중... (${attempt + 1}/${MAX_RETRIES})`)
        if (statusEl) statusEl.textContent = `에디터 초기화 대기 중... (${attempt + 1}/${MAX_RETRIES})`
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
        continue
      }

      throw err
    }
  }

  throw new Error('WASM 초기화 시간 초과 — 에디터를 로드할 수 없습니다.')
}
