/**
 * Sentry (프론트엔드) — 브라우저 에러 추적
 *
 * 원칙(솔로 사용 / 무료 쿼터):
 *   - 에러만 수집한다. 성능(트레이싱)·세션 리플레이는 끈다(쿼터 절약).
 *   - PII 미수집(sendDefaultPii:false): 쿠키·IP·헤더를 보내지 않는다.
 *   - OAuth 민감값(code/state/token)은 URL·브레드크럼에서 제거한 뒤 전송한다.
 *
 * DSN 이 없으면(.env 미설정) 아무것도 하지 않는다 → 로컬/CI 에서 안전.
 */
import * as Sentry from '@sentry/browser'

// OAuth 흐름에서 URL 쿼리로 떠다닐 수 있는 민감 파라미터
const SENSITIVE_PARAMS = [
  'code',
  'state',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
]

/** URL 문자열에서 민감 쿼리 파라미터 값을 [redacted] 로 치환 */
function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url, location.origin)
    let changed = false
    for (const key of SENSITIVE_PARAMS) {
      if (u.searchParams.has(key)) {
        u.searchParams.set(key, '[redacted]')
        changed = true
      }
    }
    return changed ? u.toString() : url
  } catch {
    return url
  }
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return // DSN 미설정 시 비활성

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,

    // 에러만 — 트레이싱/리플레이 비활성(무료 쿼터 절약)
    tracesSampleRate: 0,

    // 쿠키·IP·헤더 등 PII 미수집
    sendDefaultPii: false,

    // 전송 직전 민감값 스크러빙
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url)
      }
      return event
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data?.url) {
        breadcrumb.data.url = scrubUrl(breadcrumb.data.url)
      }
      // 네비게이션 브레드크럼의 from/to 경로도 정리
      if (breadcrumb.category === 'navigation' && breadcrumb.data) {
        breadcrumb.data.from = scrubUrl(breadcrumb.data.from)
        breadcrumb.data.to = scrubUrl(breadcrumb.data.to)
      }
      return breadcrumb
    },
  })
}
