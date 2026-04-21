import { getToken, requestAuth } from '../lib/auth'
import { getFileMeta, downloadFile, uploadFile } from '../lib/drive'
export async function renderDriveOpen(app: HTMLElement) {
  const params = new URLSearchParams(location.search)
  const fileIds = params.get('fileId')?.split(',')
  const fileId = fileIds?.[0]?.trim()

  if (!fileId) {
    renderError(app, '파일 ID가 없습니다', 'Drive에서 파일을 열어주세요.')
    return
  }

  const existingToken = getToken()
  if (existingToken) {
    await openFileFromDrive(app, fileId)
    return
  }

  renderAuthPrompt(app, fileId)
}

async function openFileFromDrive(app: HTMLElement, fileId: string) {
  renderLoading(app, 'Drive에서 파일을 불러오는 중...')

  try {
    const [meta, data] = await Promise.all([
      getFileMeta(fileId),
      downloadFile(fileId),
    ])

    const ext = meta.name.split('.').pop()?.toLowerCase()
    if (!['hwp', 'hwpx'].includes(ext ?? '')) {
      renderError(app, '지원하지 않는 파일 형식', `${meta.name}은(는) HWP/HWPX 파일이 아닙니다.`)
      return
    }

    const isHwpx = ext === 'hwpx'

    renderLoading(app, isHwpx ? '미리보기를 준비하는 중...' : '에디터를 준비하는 중...')
    document.title = `${meta.name} — rhwp Studio${isHwpx ? ' (미리보기)' : ''}`

    // 뷰어 DOM 및 외부 에디터 삽입을 위한 컨테이너 렌더링
    app.innerHTML = `
      <div class="editor-layout" style="width: 100vw; height: 100vh; overflow: hidden; display: flex; flex-direction: column;">
        <header class="editor-header-bar" style="display:flex; justify-content:space-between; align-items:center; padding: 10px 16px; background-color: #212529; color: white; flex-shrink: 0;">
          <div>
            <button id="btn-back" class="btn btn-secondary" style="margin-right:10px;">← 뒤로가기</button>
            <span class="editor-title">${escapeHtml(meta.name)}</span>
            ${isHwpx ? '<span style="margin-left:8px; padding:2px 8px; background:#ffc107; color:#212529; border-radius:4px; font-size:12px; font-weight:bold;">미리보기</span>' : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span id="save-status" style="font-size:13px; color:#adb5bd;"></span>
            <button id="btn-download" class="btn btn-primary" style="padding:4px 12px; font-size:13px; background-color:#339af0; color:white; border:none; border-radius:4px; cursor:pointer;" title="${escapeHtml(meta.name)} 다운로드">다운로드</button>
          </div>
        </header>
        <div id="editor-container" style="flex: 1; width: 100%; border:none;"></div>
      </div>
      <div id="hwpx-toast" style="display:none; position:fixed; bottom:32px; left:50%; transform:translateX(-50%); background:rgba(33,37,41,0.92); color:#fff; padding:14px 28px; border-radius:10px; font-size:15px; z-index:9999; box-shadow:0 4px 16px rgba(0,0,0,0.3); transition:opacity 0.4s;">
        아직, hwpx 파일일 때는 미리보기만 가능합니다.
      </div>
    `;
    
    document.getElementById('btn-back')?.addEventListener('click', () => { window.location.hash = ''; });
    const statusText = document.getElementById('save-status');

    document.getElementById('btn-download')?.addEventListener('click', () => {
      const mimeType = isHwpx ? 'application/hwp+zip' : 'application/x-hwp';
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = meta.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    // hwpx 토스트 메시지 3초 표시
    if (isHwpx) {
      const toast = document.getElementById('hwpx-toast')!;
      toast.style.display = 'block';
      toast.style.opacity = '1';
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 400);
      }, 3000);
    }

    // @rhwp/editor 로딩
    const { createEditor } = await import('@rhwp/editor');
    const container = document.getElementById('editor-container')!;
    
    const studioUrl = isHwpx ? '/editor/index.html?mode=view' : '/editor/index.html';
    const editor = await createEditor(container, { studioUrl });

    // hwp 파일만 저장 핸들러 등록 (hwpx는 미리보기 전용이므로 생략)
    if (!isHwpx) {
      // 에디터 내부의 저장 이벤트(Ctrl+S / 저장 버튼)를 수신하여 구글 드라이브에 업로드
      window.addEventListener('message', async (e) => {
        const msg = e.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'rhwp-response' || msg.type === 'rhwp-request') return;

        if (msg.type === 'save' || msg.type === 'rhwp-save' || msg.action === 'save') {
          console.log('[DriveOpen] 저장 메시지 수신:', msg);
          const payload = msg.data || {};
          const fileBuffer: ArrayBuffer | Uint8Array | null =
            payload.buffer instanceof ArrayBuffer ? payload.buffer :
            payload.file instanceof ArrayBuffer   ? payload.file   :
            payload instanceof ArrayBuffer        ? payload        :
            null;
          const saveName: string = payload.filename || payload.name || meta.name;
          const saveMime: string = payload.mimeType || meta.mimeType || 'application/x-hwp';

          if (!fileBuffer) {
            console.warn('[DriveOpen] 저장 메시지에 buffer가 없습니다:', payload);
            return;
          }

          try {
            if (statusText) statusText.textContent = '■ 드라이브에 저장 중...';
            console.log(`[DriveOpen] Google Drive 업로드: ${saveName} (${(fileBuffer as ArrayBuffer).byteLength ?? '?'} bytes)`);
            await uploadFile(saveName, fileBuffer, saveMime, fileId);
            if (statusText) {
              statusText.textContent = '✔ 드라이브 저장 완료';
              setTimeout(() => { if (statusText.textContent?.includes('저장 완료')) statusText.textContent = ''; }, 3000);
            }
            console.log('[DriveOpen] Google Drive 저장 성공');
          } catch (err) {
            console.error('[DriveOpen] Google 드라이브 저장 실패:', err);
            alert('구글 드라이브 업로드에 실패했습니다.');
            if (statusText) statusText.textContent = '❌ 저장 실패';
          }
        }
      });
    }

    // 버퍼 데이터를 에디터에 주입
    const iframe = editor.element as HTMLIFrameElement;
    await loadFileDirectly(iframe, data, meta.name, statusText);

  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e)
    renderError(app, '파일을 열 수 없습니다', msg)
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function renderAuthPrompt(app: HTMLElement, fileId: string) {
  app.innerHTML = `
    <div class="loading-screen">
      <div class="brand-logo">
        <span class="logo-badge">알</span>
        <span class="logo-name">rhwp Studio</span>
      </div>
      <p class="loading-msg">Google Drive 파일에 접근하려면<br/>Google 계정 인증이 필요합니다.</p>
      <button id="btn-google-auth" class="btn-google-auth">
        Google 계정으로 인증하기
      </button>
    </div>
  `

  const btn = document.getElementById('btn-google-auth')!
  btn.addEventListener('click', async () => {
    btn.setAttribute('disabled', 'true')
    btn.textContent = '인증 중...'
    try {
      await requestAuth()
      await openFileFromDrive(app, fileId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      renderError(app, '인증에 실패했습니다', msg)
    }
  })
}

function renderLoading(app: HTMLElement, message: string) {
  app.innerHTML = `
    <div class="loading-screen">
      <div class="brand-logo">
        <span class="logo-badge">알</span>
        <span class="logo-name">rhwp Studio</span>
      </div>
      <div class="spinner"></div>
      <p class="loading-msg">${message}</p>
    </div>
  `
}

function renderError(app: HTMLElement, title: string, detail: string) {
  app.innerHTML = `
    <div class="error-screen">
      <div class="error-icon">⚠</div>
      <h2 class="error-title">${title}</h2>
      <p class="error-detail">${detail}</p>
      <button class="btn-retry" onclick="history.back()">← 돌아가기</button>
    </div>
  `
}

/**
 * @rhwp/editor의 loadFile 메서드를 우회하여 iframe에 직접 postMessage로 파일을 전송합니다.
 * - @rhwp/editor의 _request 타임아웃이 10초로 고정되어 있어, 다수 페이지 렌더링 시 초과됨
 * - 이 함수는 60초 타임아웃을 적용하고, WASM 미초기화 시 재시도합니다.
 */
async function loadFileDirectly(
  iframe: HTMLIFrameElement,
  data: ArrayBuffer,
  fileName: string,
  statusEl: HTMLElement | null,
): Promise<void> {
  const TIMEOUT_MS = 60_000;
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 2_000;
  const bytes = Array.from(new Uint8Array(data));

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const msgId = Date.now() + Math.random();

        const timer = setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error(`loadFile timeout (${TIMEOUT_MS / 1000}s)`));
        }, TIMEOUT_MS);

        function handler(e: MessageEvent) {
          const d = e.data;
          if (d?.type === 'rhwp-response' && d.id === msgId) {
            clearTimeout(timer);
            window.removeEventListener('message', handler);
            if (d.error) {
              reject(new Error(d.error));
            } else {
              resolve();
            }
          }
        }

        window.addEventListener('message', handler);
        iframe.contentWindow!.postMessage(
          { type: 'rhwp-request', id: msgId, method: 'loadFile', params: { data: bytes, fileName } },
          '*',
        );
      });

      // 성공 — 루프 탈출
      if (statusEl) statusEl.textContent = '';
      console.log('[DriveOpen] 파일 로드 성공');
      return;

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // WASM 미초기화 에러인 경우 재시도
      if (errMsg.includes('wbindgen') || errMsg.includes('undefined') || errMsg.includes('not initialized')) {
        console.warn(`[DriveOpen] WASM 초기화 대기 중... (${attempt + 1}/${MAX_RETRIES})`);
        if (statusEl) statusEl.textContent = `에디터 초기화 대기 중... (${attempt + 1}/${MAX_RETRIES})`;
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      // 그 외 에러는 즉시 throw
      throw err;
    }
  }

  throw new Error('WASM 초기화 시간 초과 — 에디터를 로드할 수 없습니다.');
}
