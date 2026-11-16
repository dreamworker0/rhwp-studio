import { initSentry } from './lib/sentry'
import { initAnalytics, trackPageView } from './lib/analytics'
import { renderHome } from './pages/Home'
import { renderDriveOpen } from './pages/DriveOpen'
import { renderDriveNew } from './pages/DriveNew'
import { renderTerms } from './pages/Terms'
import { renderPrivacy } from './pages/Privacy'
import { renderSupport } from './pages/Support'
import './style.css'

initSentry()
initAnalytics()

const app = document.getElementById('app')!
const path = location.pathname

// Hosting의 `**` → index.html 리라이트 때문에 모든 경로가 같은 HTML을 받는다.
// 경로마다 대표 URL을 명시해 Search Console "표준이 없는 중복 페이지"를 막는다.
// (index.html에 고정값으로 넣으면 모든 페이지가 '/'를 가리키게 되므로 여기서 넣는다.)
const SITE_ORIGIN = 'https://rhwp-studio.web.app'
function setCanonical(canonicalPath: string): void {
  const link = document.createElement('link')
  link.rel = 'canonical'
  link.href = SITE_ORIGIN + canonicalPath
  document.head.appendChild(link)
}

// 라우트별 페이지뷰(파일명 없는 고정 제목). document_open 등 세부는 각 페이지에서 이벤트로.
if (path.startsWith('/drive/open')) {
  trackPageView('문서 열기')
  renderDriveOpen(app)
} else if (path.startsWith('/drive/new')) {
  trackPageView('새 문서')
  renderDriveNew(app)
} else if (path.startsWith('/terms')) {
  setCanonical('/terms')
  trackPageView('서비스 약관')
  renderTerms(app)
} else if (path.startsWith('/privacy')) {
  setCanonical('/privacy')
  trackPageView('개인정보처리방침')
  renderPrivacy(app)
} else if (path.startsWith('/support')) {
  setCanonical('/support')
  trackPageView('지원')
  renderSupport(app)
} else {
  setCanonical('/')
  trackPageView('홈')
  renderHome(app)
}
