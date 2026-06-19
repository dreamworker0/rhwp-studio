import { defineConfig } from 'vite'

export default defineConfig(async ({ command }) => {
  // mkcert는 로컬 dev 서버(HTTPS)에만 필요. build 시에는 로드하지 않는다.
  // (mkcert가 끌어오는 undici가 CI Node 환경에서 로드 시 깨지는 문제 회피)
  const plugins = []
  if (command === 'serve') {
    const mkcert = (await import('vite-plugin-mkcert')).default
    plugins.push(mkcert())
  }

  return {
    base: '/',
    server: {
      https: true,
      port: 5173,
    },
    plugins,
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
  }
})
