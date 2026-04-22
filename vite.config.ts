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
    // @rhwp/core는 WASM을 포함하므로 pre-bundling 대상에서 제외
    exclude: ['@rhwp/core'],
  },
})
