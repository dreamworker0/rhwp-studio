import { defineConfig, loadEnv } from 'vite'

export default defineConfig(async ({ command, mode }) => {
  // .env 의 전체 변수를 읽는다('' 접두사 → VITE_ 외 변수도 포함).
  // (Vite 는 VITE_ 접두사만 자동 노출하므로 SENTRY_* 는 직접 로드해야 한다.)
  const env = loadEnv(mode, process.cwd(), '')

  // mkcert는 로컬 dev 서버(HTTPS)에만 필요. build 시에는 로드하지 않는다.
  // (mkcert가 끌어오는 undici가 CI Node 환경에서 로드 시 깨지는 문제 회피)
  const plugins = []
  if (command === 'serve') {
    const mkcert = (await import('vite-plugin-mkcert')).default
    plugins.push(mkcert())
  }

  // 소스맵 업로드 — SENTRY_AUTH_TOKEN 이 있을 때만 활성(빌드/CI 안전).
  // 'hidden' 소스맵: 맵을 생성하되 번들에 //# sourceMappingURL 주석을 남기지
  // 않아 공개 배포본에 소스가 노출되지 않는다(Sentry 업로드 후 dist 에서 삭제).
  const uploadSourcemaps = command === 'build' && !!env.SENTRY_AUTH_TOKEN
  if (uploadSourcemaps) {
    const { sentryVitePlugin } = await import('@sentry/vite-plugin')
    plugins.push(
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        release: { name: env.VITE_SENTRY_RELEASE || undefined },
        sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
        // 업로드 실패(간헐적 TLS/네트워크)가 빌드·배포를 막지 않도록 경고만 남긴다.
        // 맵은 firebase.json 의 ignore('**/*.map')로 배포에서 제외되므로,
        // 업로드가 실패해 dist 에 맵이 남아도 공개 배포되지 않는다.
        errorHandler: (err) => {
          console.warn('[sentry] 소스맵 업로드 실패(무시하고 계속):', err.message)
        },
      }),
    )
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
      // 업로드 시에만 hidden 소스맵 생성(공개 노출 없음), 아니면 끔.
      sourcemap: uploadSourcemaps ? 'hidden' : false,
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
