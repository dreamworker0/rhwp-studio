/**
 * Google Drive API 헬퍼
 */
import { getToken } from './auth'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export interface DriveFileMeta {
  id: string
  name: string
  mimeType: string
  size?: string
}

function authHeaders(): HeadersInit {
  const token = getToken()
  if (!token) {
    throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.')
  }
  return { Authorization: `Bearer ${token}` }
}

export async function getFileMeta(fileId: string): Promise<DriveFileMeta> {
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`,
    { headers: authHeaders() },
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
    { headers: authHeaders() },
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

  const meta = { name, mimeType }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', new Blob([buffer as ArrayBuffer], { type: mimeType }), name)

  // supportsAllDrives=true: 공유 드라이브 파일 포함, 일반 드라이브도 안정성↑
  const url = fileId
    ? `${UPLOAD_API}/files/${fileId}?uploadType=multipart&supportsAllDrives=true`
    : `${UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true`

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: authHeaders(),
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Drive 업로드 오류 (${res.status}):`, body)
    throw new Error(`Drive 업로드 오류 (${res.status}): ${parseErrorMessage(body)}`)
  }

  const json = await res.json()
  return json.id
}
