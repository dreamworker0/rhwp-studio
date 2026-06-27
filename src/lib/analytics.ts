/**
 * Google Analytics 4 (gtag.js) — 프론트엔드 사용량 측정
 *
 * 원칙(Sentry 와 동일 톤):
 *   - 측정 ID(VITE_GA_MEASUREMENT_ID)가 없으면 아무것도 하지 않는다 → 로컬/CI 안전.
 *   - Firebase 클라이언트 SDK 를 끌어오지 않고 gtag.js 스니펫만 주입(번들 경량).
 *   - GA4 는 기본적으로 IP 를 익명화한다. OAuth 민감값이 URL 에 떠다닐 수 있으므로
 *     page_location 의 쿼리스트링은 보내지 않는다.
 *
 * 경로 기반 풀 페이지 로드 라우팅이므로(main.ts), 페이지뷰는 로드 시 1회
 * gtag('config') 가 자동 전송한다 → SPA 수동 페이지뷰 불필요.
 */

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export function initAnalytics(): void {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
  if (!id) return // 측정 ID 미설정 시 비활성

  // gtag.js 로더 주입
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(s)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', id, {
    // 쿼리스트링(code/state/token 등)을 page_location 에 싣지 않음
    page_location: location.origin + location.pathname,
  })
}
