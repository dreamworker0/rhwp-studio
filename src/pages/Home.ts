export function renderHome(app: HTMLElement) {
  app.innerHTML = `
    <div class="home-screen">
      <header class="home-header">
        <div class="home-brand">
          <span class="logo-badge">알</span>
          <span class="logo-name">rhwp Studio</span>
        </div>
      </header>

      <main class="home-main">
        <h1 class="home-title">
          Google Drive에서<br/>
          <span class="gradient-text">HWP 파일을 바로 편집</span>
        </h1>
        <p class="home-subtitle">
          한글(HWP/HWPX) 파일을 설치 없이 웹에서 편집하세요.<br/>
          Open source · Rust + WebAssembly
        </p>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-num">1</div>
            <div class="step-content">
              <h3>파일 찾기</h3>
              <p>Google Drive에서 HWP 또는 HWPX 파일을 우클릭합니다</p>
            </div>
          </div>
          <div class="step-card">
            <div class="step-num">2</div>
            <div class="step-content">
              <h3>앱 선택</h3>
              <p>"연결 앱" → "rhwp Studio"를 선택합니다</p>
            </div>
          </div>
          <div class="step-card">
            <div class="step-num">3</div>
            <div class="step-content">
              <h3>편집 시작</h3>
              <p>브라우저에서 파일이 바로 열려 편집할 수 있습니다</p>
            </div>
          </div>
        </div>

        <div class="home-badge-row">
          <span class="badge">HWP</span>
          <span class="badge">HWPX</span>
          <span class="badge badge-outline">Open Source</span>
          <span class="badge badge-outline">WebAssembly</span>
        </div>
      </main>

      <footer class="home-footer">
        <p>© 2026 rhwp Studio · <a href="https://github.com/edwardkim/rhwp" target="_blank">GitHub</a></p>
      </footer>
    </div>
  `
}
