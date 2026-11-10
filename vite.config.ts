import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const buildId = env.VITE_BUILD_ID
    ?.replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 16);

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    build: buildId
      ? {
          rollupOptions: {
            output: {
              entryFileNames: `assets/[name]-[hash]-${buildId}.js`,
              chunkFileNames: `assets/[name]-[hash]-${buildId}.js`,
              assetFileNames: `assets/[name]-[hash]-${buildId}[extname]`,
            },
          },
        }
      : undefined,
    worker: {
      format: 'es',
    },
  };
});
