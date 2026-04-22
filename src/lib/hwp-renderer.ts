/**
 * hwp-renderer.ts
 * @rhwp/core WASM을 직접 로드하여 HWP/HWPX 파일을 SVG로 렌더링하는 모듈
 */

// @rhwp/core를 static import로 가져와 단일 모듈 인스턴스 보장
import init, { HwpDocument } from '@rhwp/core';

// WASM 초기화 여부
let wasmReady = false;
let initPromise: Promise<void> | null = null;

/**
 * globalThis.measureTextWidth 콜백 등록
 * WASM이 텍스트 레이아웃 시 글자 폭을 측정하기 위해 호출하는 함수
 */
function registerMeasureTextWidth() {
  if (typeof (globalThis as any).measureTextWidth === 'function') return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  let lastFont = '';

  // 공식 API: measureTextWidth(font, text) 순서
  (globalThis as any).measureTextWidth = (font: string, text: string): number => {
    try {
      if (font !== lastFont) {
        ctx.font = font;
        lastFont = font;
      }
      return ctx.measureText(text).width;
    } catch (e) {
      console.error('[measureTextWidth] error:', e, 'font:', font, 'text:', text);
      return text.length * Number(font.match(/\d+/) || 10); // 기본 추정치 폴백
    }
  };
}

/**
 * WASM 초기화
 * public/rhwp_bg.wasm 파일을 비동기 스트리밍 컴파일(instantiateStreaming)로 로드한다.
 * 동시 호출 방지를 위해 Promise를 캐싱한다.
 */
export async function initWasm(): Promise<void> {
  if (wasmReady) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // measureTextWidth 콜백을 먼저 등록해야 WASM import가 성공함
      registerMeasureTextWidth();

      console.log('[hwp-renderer] Initializing WASM asynchronously...');
      const wasmUrl = '/rhwp_bg.wasm';
      
      // init() 기본 함수는 fetch(wasmUrl) 후 instantiateStreaming을 통해 비동기 컴파일을 수행함
      await init(wasmUrl);

      console.log('[hwp-renderer] WASM initialized successfully');
      wasmReady = true;
    } catch (e) {
      initPromise = null;  // 실패 시 재시도 가능하도록
      console.error('[hwp-renderer] WASM init failed:', e);
      throw e;
    }
  })();

  return initPromise;
}

/**
 * HWP/HWPX 바이트 데이터를 SVG 문자열 배열로 렌더링
 * @param data  HWP/HWPX 파일의 바이트 데이터 (ArrayBuffer)
 * @returns     페이지별 SVG 문자열 배열
 */
export async function renderHwpToSvg(data: ArrayBuffer): Promise<string[]> {
  await initWasm();

  console.log('[hwp-renderer] Parsing HWP document...');
  const doc = new HwpDocument(new Uint8Array(data));
  const totalPages = doc.pageCount();
  console.log(`[hwp-renderer] Document has ${totalPages} pages`);

  const svgPages: string[] = [];

  for (let i = 0; i < totalPages; i++) {
    const svg = doc.renderPageSvg(i);
    svgPages.push(svg);
  }

  // HwpDocument는 free()를 호출해 WASM 메모리 해제
  doc.free();

  return svgPages;
}

// HwpDocument를 re-export하여 DriveNew에서 사용 가능
export { HwpDocument };
