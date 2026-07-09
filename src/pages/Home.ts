export function renderHome(app: HTMLElement) {
  app.innerHTML = `
    <div class="home-screen">
      <header class="home-header">
        <div class="home-brand">
          <span class="logo-badge" aria-hidden="true">ㅎ</span>
          <span class="logo-name">rhwp Studio</span>
        </div>
      </header>

      <main class="home-main">
        <h1 class="home-title">
          Google Drive에서<br/>
          <span class="gradient-text">HWP(X) 파일을 바로 편집, 저장</span>
        </h1>
        <p class="home-subtitle">
          한글(HWP·HWPX) 파일을 설치 없이 웹에서 편집하세요.<br/>
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
          <div class="step-card">
            <div class="step-num">4</div>
            <div class="step-content">
              <h3>바로 저장</h3>
              <p>구글 드라이브에 바로 저장할 수 있습니다</p>
            </div>
          </div>
        </div>

        <div class="home-badge-row">
          <span class="badge">HWP</span>
          <span class="badge">HWPX</span>
          <span class="badge badge-outline">Open Source</span>
          <span class="badge badge-outline">WebAssembly</span>
        </div>
        <p class="home-note">※ 중요한 문서는 편집 전 Google Drive에서 사본을 만들어 두시길 권장합니다.</p>
      </main>

      <footer class="home-footer" style="margin-top: 60px;">
        <div style="max-width: 600px; margin: 0 auto 32px auto; padding: 16px 20px; background-color: rgba(30, 41, 59, 0.5); border-radius: 12px; border: 1px solid rgba(51, 65, 85, 0.8); text-align: left;">
          <p style="margin: 0; font-size: 0.85rem; color: #94a3b8; line-height: 1.6;">
            <strong style="color: #cbd5e1; display: block; margin-bottom: 6px;">[오픈소스 출처 (Acknowledgements)]</strong>
            본 애플리케이션은 HWP 문서 파싱 및 렌더링 엔진으로 오픈소스 프로젝트인 <a href="https://github.com/edwardkim/rhwp" target="_blank" rel="noopener noreferrer" style="color: #818cf8; text-decoration: none;">'rhwp'</a>를 기반으로 구축되었습니다.
          </p>
        </div>
        <p style="color: #64748b; font-size: 0.9rem;">© 2026 rhwp Studio</p>
        <p style="margin-top: 12px; font-size: 0.85rem; color: #64748b;">
          <a href="/terms" style="color: inherit; text-decoration: none;">서비스 약관</a> &nbsp;&middot;&nbsp; 
          <a href="/privacy" style="color: inherit; text-decoration: none;">개인정보처리방침</a> &nbsp;&middot;&nbsp; 
          <a href="/support" style="color: inherit; text-decoration: none;">고객 지원</a>
        </p>
      </footer>
    </div>
  `
}
