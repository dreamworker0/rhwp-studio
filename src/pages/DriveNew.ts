
export async function renderDriveNew(app: HTMLElement) {
  app.innerHTML = `
    <div class="editor-layout">
      <header class="editor-header-bar">
        <button id="btn-back" class="btn btn-secondary">뒤로가기</button>
        <span class="editor-title">새 문서 — rhwp Studio</span>
      </header>
      <div id="editor-container" style="width: 100vw; height: calc(100vh - 50px);"></div>
    </div>
  `

  const btnBack = document.getElementById('btn-back')
  btnBack?.addEventListener('click', () => { window.location.hash = '' })

  const container = document.getElementById('editor-container')
  if (!container) return

  try {
    const { createEditor } = await import('@rhwp/editor');
    const editor = await createEditor(container, { studioUrl: '/editor/index.html' });
    
    // 에디터 로드 대기
    await new Promise(r => setTimeout(r, 2000));

  } catch (e: unknown) {
    console.error('Editor Error', e)
    container.innerHTML = `<div style="padding: 2rem; color: red;">뷰어 엔진을 불러오지 못했습니다: ${String(e)}</div>`
  }
}
