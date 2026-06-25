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

export async function getFileMeta(fileId: string): Promise<DriveFileMeta> {
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=id,name,mimeType,size,capabilities&supportsAllDrives=true`,
    { headers: await authHeaders() },
  )
  if (!res.ok) {
    const body = await res.text()
    console.error('Drive API getFileMeta error:', res.status, body)
    throw new Error(`Drive API 오류 (${res.status}): ${parseErrorMessage(body)}`)
  }
  return res.json()
}

export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: await authHeaders() },
  )
  if (!res.ok) {
    const body = await res.text()
    console.error('Drive API downloadFile error:', res.status, body)
    throw new Error(`Drive API 오류 (${res.status}): ${parseErrorMessage(body)}`)
  }
  return res.arrayBuffer()
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
  // ArrayBuffer 또는 Uint8Array 둘 다 허용
  // Uint8Array.slice()로 생성된 경우 .buffer가 원본 전체를 참조할 수 있으므로
  // byteOffset/byteLength 기준으로 정확한 범위만 추출
  const buffer = data instanceof Uint8Array
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : data

  // supportsAllDrives=true: 공유 드라이브 파일 포함, 일반 드라이브도 안정성↑
  const url = fileId
    ? `${UPLOAD_API}/files/${fileId}?uploadType=multipart&supportsAllDrives=true`
    : `${UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true`

  // buffer로부터 매번 새 FormData를 만든다(재시도 시 본문 재사용을 위해 함수로 분리).
  const doUpload = async (): Promise<Response> => {
    const headers = await authHeaders()
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify({ name, mimeType })], { type: 'application/json' }))
    form.append('file', new Blob([buffer as ArrayBuffer], { type: mimeType }), name)
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

  if (!res.ok) {
    const body = await res.text()
    console.error(`Drive 업로드 오류 (${res.status}):`, body)
    throw new Error(`Drive 업로드 오류 (${res.status}): ${parseErrorMessage(body)}`)
  }

  const json = await res.json()
  return json.id
}
