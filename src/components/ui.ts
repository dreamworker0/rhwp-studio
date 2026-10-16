export function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function renderEditorLayout(name: string, viewOnly: boolean): string {
  const escapedName = escapeHtml(name)
  return `
    <div class="editor-container">
      <header class="editor-header">
        <div class="editor-brand">
          <span class="editor-filename">${escapedName}</span>
          ${viewOnly ? '<span class="editor-status" style="margin-left:8px; background:#ffc107; color:#212529;">미리보기</span>' : ''}
        </div>
        <div class="editor-actions">
          <span id="save-status" style="font-size:14px; font-weight:bold; color:#4ade80; margin-right:15px; transition: opacity 0.3s;"></span>
          ${viewOnly ? '<button id="btn-download" class="btn btn-primary" style="background-color: #0d6efd; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: bold;">다운로드</button>' : ''}
        </div>
      </header>
      <div id="editor-container" class="editor-main">
        <div id="editor-loading" class="editor-loading" role="status">
          <div class="spinner" aria-hidden="true"></div>
          <p class="loading-msg">문서를 여는 중...</p>
        </div>
      </div>
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
        <span class="logo-badge" aria-hidden="true">ㅎ</span>
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
    <div class="loading-screen" role="status">
      <div class="brand-logo">
        <span class="logo-badge" aria-hidden="true">ㅎ</span>
        <span class="logo-name">rhwp Studio</span>
      </div>
      <div class="spinner" aria-hidden="true"></div>
      <p class="loading-msg">${escapeHtml(message)}</p>
    </div>
  `
}

export function renderError(app: HTMLElement, title: string, detail: string) {
  app.innerHTML = `
    <div class="error-screen">
      <div class="error-icon" aria-hidden="true">⚠</div>
      <h2 class="error-title">${escapeHtml(title)}</h2>
      <p class="error-detail">${escapeHtml(detail)}</p>
      <button class="btn-retry" id="btn-error-back">← 돌아가기</button>
    </div>
  `
  // 인라인 onclick 대신 리스너로 연결(CSP 안전)
  document.getElementById('btn-error-back')?.addEventListener('click', () => history.back())
}

/**
 * 법률/안내 페이지 공용 레이아웃 (Privacy / Terms / Support 공유).
 * title·meta 는 정적 텍스트로 이스케이프하고, bodyHtml 은 신뢰된 정적 마크업을 그대로 삽입한다.
 */
export function renderLegalPage(title: string, meta: string, bodyHtml: string): string {
  return `
    <div class="legal-page">
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">${escapeHtml(meta)}</p>
      ${bodyHtml}
      <div class="legal-footer">
        <a href="/">&larr; 홈으로 돌아가기 (Back to Home)</a>
      </div>
    </div>
  `
}
