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

// 라우트별 페이지뷰(파일명 없는 고정 제목). document_open 등 세부는 각 페이지에서 이벤트로.
if (path.startsWith('/drive/open')) {
  trackPageView('문서 열기')
  renderDriveOpen(app)
} else if (path.startsWith('/drive/new')) {
  trackPageView('새 문서')
  renderDriveNew(app)
} else if (path.startsWith('/terms')) {
  trackPageView('서비스 약관')
  renderTerms(app)
} else if (path.startsWith('/privacy')) {
  trackPageView('개인정보처리방침')
  renderPrivacy(app)
} else if (path.startsWith('/support')) {
  trackPageView('지원')
  renderSupport(app)
} else {
  trackPageView('홈')
  renderHome(app)
}
