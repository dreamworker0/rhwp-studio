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
  },
  optimizeDeps: {
    // @rhwp/core는 WASM을 포함하므로 pre-bundling 대상에서 제외
    exclude: ['@rhwp/core'],
  },
})
