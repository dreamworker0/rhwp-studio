/**
 * Google Analytics 4 (gtag.js) — 프론트엔드 사용량 측정
 *
 * 원칙(Sentry 와 동일 톤):
 *   - 측정 ID(VITE_GA_MEASUREMENT_ID)가 없으면 아무것도 하지 않는다 → 로컬/CI 안전.
 *   - Firebase 클라이언트 SDK 를 끌어오지 않고 gtag.js 스니펫만 주입(번들 경량).
 *   - GA4 는 기본적으로 IP 를 익명화한다. OAuth 민감값이 URL 에 떠다닐 수 있으므로
 *     page_location 의 쿼리스트링은 보내지 않는다.
 *
 * 경로 기반 풀 페이지 로드 라우팅이므로(main.ts), 자동 페이지뷰는 끄고
 * 라우트별로 trackPageView 를 명시 호출한다. 이유:
 *   - 자동 page_view 는 로드 순간 document.title(기본 "rhwp Studio")로 찍혀
 *     모든 조회가 한 제목으로 뭉친다(랜딩 vs 편집기 구분 불가).
 *   - 문서 제목에는 파일명(개인정보)이 들어가므로 title 로 보내면 안 된다 →
 *     라우트별 고정 제목(파일명 없음)만 전송한다.
 */

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

let enabled = false

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
    // 자동 페이지뷰 비활성 → 라우트별 trackPageView 로 정확한 제목 전송
    send_page_view: false,
  })
  enabled = true
}

/**
 * 페이지뷰 명시 전송. pageTitle 은 **파일명·개인정보를 포함하지 않는** 고정 라벨만.
 * page_location 은 쿼리스트링을 제거해 OAuth state/token 유출을 막는다.
 */
export function trackPageView(pageTitle: string): void {
  if (!enabled) return
  window.gtag('event', 'page_view', {
    page_title: pageTitle,
    page_location: location.origin + location.pathname,
  })
}

/**
 * 커스텀 이벤트 전송. params 는 **익명 값만**(포맷 hwp/hwpx, 성공/실패, 개수 등).
 * 파일명·문서 본문·사용자 식별자는 절대 싣지 않는다.
 */
export function trackEvent(
  name: string,
  params: Record<string, string | number | boolean> = {},
): void {
  if (!enabled) return
  window.gtag('event', name, params)
}
