import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  base: '/',
  server: {
    https: true,
    port: 5173
  },
  plugins: [
    mkcert()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,  // WASM 에디터 특성상 청크 크기가 큼
  },
  optimizeDeps: {
    // 의존성 스캐너가 실제 진입점(index.html)만 보도록 고정.
    // (미지정 시 temp_editor/rhwp-studio/index.html 등 프로젝트 내 모든 *.html을
    //  크롤링 → 내부 전용 alias @wasm/rhwp.js 해석 실패 → @rhwp/editor 504)
    entries: ['index.html'],
    // @rhwp/core는 WASM을 포함하므로 pre-bundling 대상에서 제외
    exclude: ['@rhwp/core'],
  },
})
