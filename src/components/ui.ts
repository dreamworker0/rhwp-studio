export function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function renderEditorLayout(name: string, isHwpx: boolean): string {
  const escapedName = escapeHtml(name)
  return `
    <div class="editor-container">
      <header class="editor-header">
        <div class="editor-brand">
          <button id="btn-back" class="btn btn-secondary" style="margin-right:10px;">← 뒤로가기</button>
          <span class="editor-filename">${escapedName}</span>
          ${isHwpx ? '<span class="editor-status" style="margin-left:8px; background:#ffc107; color:#212529;">미리보기</span>' : ''}
        </div>
        <div class="editor-actions">
          <span id="save-status" style="font-size:14px; font-weight:bold; color:#4ade80; margin-right:15px; transition: opacity 0.3s;"></span>
          ${isHwpx ? '<button id="btn-download" class="btn btn-primary" style="background-color: #0d6efd; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: bold;">다운로드</button>' : ''}
        </div>
      </header>
      <div id="editor-container" class="editor-main"></div>
    </div>
    <div id="hwpx-toast" style="display:none; position:fixed; bottom:32px; left:50%; transform:translateX(-50%); background:rgba(33,37,41,0.92); color:#fff; padding:14px 28px; border-radius:10px; font-size:15px; z-index:9999; box-shadow:0 4px 16px rgba(0,0,0,0.3); transition:opacity 0.4s;">
      아직, hwpx 파일일 때는 미리보기만 가능합니다.
      <button id="hwpx-toast-close" style="margin-left:12px; background:none; border:1px solid rgba(255,255,255,0.5); color:#fff; padding:2px 8px; border-radius:4px; cursor:pointer; font-size:13px;">다시 보지 않기</button>
    </div>
    <div id="viewer-perm-toast" style="display:none; position:fixed; bottom:32px; left:50%; transform:translateX(-50%); background:rgba(13,110,253,0.92); color:#fff; padding:14px 28px; border-radius:10px; font-size:15px; z-index:9999; box-shadow:0 4px 16px rgba(0,0,0,0.3); transition:opacity 0.4s;">
      뷰어 권한으로 공유된 파일입니다. 읽기 전용으로 열립니다.
    </div>
  `
}

export function renderAuthPrompt(app: HTMLElement, onAuthClick: () => void) {
  app.innerHTML = `
    <div class="loading-screen">
      <div class="brand-logo">
        <span class="logo-badge">ㅎ</span>
        <span class="logo-name">rhwp Studio</span>
      </div>
      <p class="loading-msg">Google Drive 파일에 접근하려면<br/>Google 계정 인증이 필요합니다.</p>
      <button id="btn-google-auth" class="btn-google-auth">
        Google 계정으로 인증하기
      </button>
    </div>
  `

  const btn = document.getElementById('btn-google-auth')!
  btn.addEventListener('click', () => {
    btn.setAttribute('disabled', 'true')
    btn.textContent = '인증 중...'
    onAuthClick()
  })
}

export function renderLoading(app: HTMLElement, message: string) {
  app.innerHTML = `
    <div class="loading-screen">
      <div class="brand-logo">
        <span class="logo-badge">ㅎ</span>
        <span class="logo-name">rhwp Studio</span>
      </div>
      <div class="spinner"></div>
      <p class="loading-msg">${escapeHtml(message)}</p>
    </div>
  `
}

export function renderError(app: HTMLElement, title: string, detail: string) {
  app.innerHTML = `
    <div class="error-screen">
      <div class="error-icon">⚠</div>
      <h2 class="error-title">${escapeHtml(title)}</h2>
      <p class="error-detail">${escapeHtml(detail)}</p>
      <button class="btn-retry" onclick="history.back()">← 돌아가기</button>
    </div>
  `
}
