import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // High-performance "Fast" build prevents legacy generation
  const isFastBuild = mode === 'fast';

  const plugins = [react()];

  if (!isFastBuild) {
    plugins.push(
      legacy({
        targets: ['chrome >= 50', 'safari >= 11', 'ios >= 11', 'android >= 5'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      })
    );
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: false,
      proxy: {
        '/api': {
          target: 'http://localhost:8766',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:8765',
          ws: true,
          rewrite: (path) => path.replace(/^\/ws/, '')
        }
      }
    },
    plugins,
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild', // Reset to default fast minification
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000
    }
  };
});
