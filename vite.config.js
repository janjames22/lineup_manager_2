import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readVersionInfo() {
  try {
    return JSON.parse(readFileSync(resolve(__dirname, 'public/version.json'), 'utf8'));
  } catch {
    return {};
  }
}

const VERSION_INFO = readVersionInfo();
const APP_VERSION = process.env.VITE_APP_VERSION || VERSION_INFO.version || 'dev';
const BUILD_VERSION =
  process.env.VITE_SERVICE_WORKER_VERSION ||
  VERSION_INFO.serviceWorkerVersion ||
  VERSION_INFO.version ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  // BUG-001: web-push is Node.js-only (used in api/ serverless functions).
  // Exclude it from Vite's pre-bundling so it is never pulled into the frontend.
  optimizeDeps: {
    exclude: ['web-push'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      manifestFilename: 'manifest.json',
      registerType: 'prompt',
      includeAssets: ['logo.png', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Line Up Manager',
        short_name: 'Line Up',
        description: 'Professional worship lineup and lyrics manager',
        start_url: '/',
        scope: '/',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
});
