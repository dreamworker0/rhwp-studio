import { renderHome } from './pages/Home'
import { renderDriveOpen } from './pages/DriveOpen'
import { renderDriveNew } from './pages/DriveNew'
import { renderTerms } from './pages/Terms'
import { renderPrivacy } from './pages/Privacy'
import { renderSupport } from './pages/Support'
import { enableSessionKeepAlive } from './lib/auth'
import './style.css'

// 탭 복귀/포커스 시 만료된 토큰을 무음 재발급해 로그인 유지력을 높인다.
enableSessionKeepAlive()

const app = document.getElementById('app')!
const path = location.pathname

if (path.startsWith('/drive/open')) {
  renderDriveOpen(app)
} else if (path.startsWith('/drive/new')) {
  renderDriveNew(app)
} else if (path.startsWith('/terms')) {
  renderTerms(app)
} else if (path.startsWith('/privacy')) {
  renderPrivacy(app)
} else if (path.startsWith('/support')) {
  renderSupport(app)
} else {
  renderHome(app)
}
