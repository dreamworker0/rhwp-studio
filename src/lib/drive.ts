/**
 * Google Drive API 헬퍼
 */
import { getAccessToken } from './auth'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export interface DriveFileMeta {
  id: string
  name: string
  mimeType: string
  size?: string
  capabilities?: { canEdit: boolean }
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken()
  return { Authorization: `Bearer ${token}` }
}

// 응답 실패 시 본문을 로깅하고 일관된 메시지로 throw (Drive 호출 공통 처리).
async function ensureOk(res: Response, logLabel: string, errLabel: string): Promise<void> {
  if (res.ok) return
  const body = await res.text()
  console.error(logLabel, res.status, body)
  throw new Error(`${errLabel} (${res.status}): ${parseErrorMessage(body)}`)
}

export async function getFileMeta(fileId: string): Promise<DriveFileMeta> {
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=id,name,mimeType,size,capabilities&supportsAllDrives=true`,
    { headers: await authHeaders() },
  )
  await ensureOk(res, 'Drive API getFileMeta error:', 'Drive API 오류')
  return res.json()
}

/**
 * 파일을 다운로드한다.
 * onProgress 가 주어지면 스트림으로 읽으며 진행 상황을 알린다.
 *   total 은 Content-Length(없으면 null — 진행률 % 대신 누적 바이트만 알 수 있음).
 */
export async function downloadFile(
  fileId: string,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: await authHeaders() },
  )
  await ensureOk(res, 'Drive API downloadFile error:', 'Drive API 오류')

  // 진행률이 필요 없거나 스트림을 쓸 수 없으면 단순 경로
  if (!onProgress || !res.body) {
    return res.arrayBuffer()
  }

  const cl = res.headers.get('Content-Length')
  const total = cl ? Number(cl) : null
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      onProgress(loaded, total)
    }
  } finally {
    reader.releaseLock() // 중간에 throw 돼도 스트림 락 해제
  }

  // 청크 결합 → ArrayBuffer
  const out = new Uint8Array(loaded)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out.buffer
}

function parseErrorMessage(body: string): string {
  try {
    const json = JSON.parse(body)
    const err = json.error
    if (err?.message) return err.message
    if (err?.errors?.[0]?.message) return err.errors[0].message
    return body
  } catch {
    return body || '알 수 없는 오류'
  }
}

/**
 * 파일에 걸린 "내용 제한(읽기 전용, contentRestrictions.readOnly=true)"을 해제한다.
 * 해제 권한(canModifyContentRestriction)이 없으면 사용자용 안내 메시지로 throw.
 */
async function clearContentRestriction(fileId: string): Promise<void> {
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentRestrictions: [{ readOnly: false }] }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    console.error('내용 제한 해제 실패:', res.status, body)
    throw new Error(
      '이 파일은 읽기 전용으로 잠겨 있어 저장할 수 없습니다.\n' +
      '잠금을 해제할 권한이 없습니다. 파일 소유자에게 잠금 해제를 요청하거나, ' +
      '"다운로드" 버튼으로 사본을 저장하세요.',
    )
  }
}

export async function uploadFile(
  name: string,
  data: ArrayBuffer | Uint8Array,
  mimeType = 'application/x-hwp',
  fileId?: string,
): Promise<string> {
  // supportsAllDrives=true: 공유 드라이브 파일 포함, 일반 드라이브도 안정성↑
  const url = fileId
    ? `${UPLOAD_API}/files/${fileId}?uploadType=multipart&supportsAllDrives=true`
    : `${UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true`

  // buffer로부터 매번 새 FormData를 만든다(재시도 시 본문 재사용을 위해 함수로 분리).
  const doUpload = async (): Promise<Response> => {
    const headers = await authHeaders()
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify({ name, mimeType })], { type: 'application/json' }))
    // Blob 은 ArrayBuffer/Uint8Array(byteOffset·byteLength 존중)를 그대로 받으므로 추가 복사 불필요.
    // (cast: lib 의 Uint8Array<ArrayBufferLike> 제네릭이 BlobPart 와 안 맞아서일 뿐, 런타임 안전)
    form.append('file', new Blob([data as BlobPart], { type: mimeType }), name)
    return fetch(url, {
      method: fileId ? 'PATCH' : 'POST',
      headers,
      body: form,
    })
  }

  let res = await doUpload()

  // 파일이 읽기 전용(내용 제한)으로 잠겨 있어 거부된 경우: 잠금 해제 후 1회 재시도
  if (!res.ok && res.status === 403 && fileId) {
    const body = await res.text()
    if (body.includes('contentRestriction')) {
      console.warn('[drive] 파일이 읽기 전용으로 잠겨 있어 내용 제한을 해제하고 재시도합니다.')
      await clearContentRestriction(fileId)
      res = await doUpload()
    } else {
      console.error('Drive 업로드 오류 (403):', body)
      throw new Error(`Drive 업로드 오류 (403): ${parseErrorMessage(body)}`)
    }
  }

  await ensureOk(res, 'Drive 업로드 오류:', 'Drive 업로드 오류')

  const json = await res.json()
  return json.id
}
