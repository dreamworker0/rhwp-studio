import { renderHome } from './pages/Home'
import { renderDriveOpen } from './pages/DriveOpen'
import { renderDriveNew } from './pages/DriveNew'
import './style.css'

const app = document.getElementById('app')!
const path = location.pathname

if (path.startsWith('/drive/open')) {
  renderDriveOpen(app)
} else if (path.startsWith('/drive/new')) {
  renderDriveNew(app)
} else {
  renderHome(app)
}
