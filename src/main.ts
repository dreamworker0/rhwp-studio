import { renderHome } from './pages/Home'
import { renderDriveOpen } from './pages/DriveOpen'
import { renderDriveNew } from './pages/DriveNew'
import { renderTerms } from './pages/Terms'
import { renderPrivacy } from './pages/Privacy'
import { renderSupport } from './pages/Support'
import './style.css'

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
