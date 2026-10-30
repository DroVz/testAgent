/// <reference types="vitest/config" />
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { buildPrivacyPage } from './src/lib/privacyText';

const PRIVACY_PAGE = 'confidentialite.html';

/**
 * Lot 4 (§4.8) : `public/confidentialite.html` est un modèle ; le texte de la politique vient de
 * `src/lib/privacyText.ts` (source unique, aussi affichée dans l'app) et y est injecté au build
 * (avant le précache du service worker) et à la volée en développement.
 */
function privacyPage(): Plugin {
  let outDir = 'dist';
  let publicDir = 'public';
  return {
    name: 'muscutrack:privacy-page',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      publicDir = config.publicDir;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split('?')[0].endsWith(`/${PRIVACY_PAGE}`)) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(buildPrivacyPage(readFileSync(resolve(publicDir, PRIVACY_PAGE), 'utf8')));
      });
    },
    writeBundle() {
      const file = resolve(outDir, PRIVACY_PAGE);
      writeFileSync(file, buildPrivacyPage(readFileSync(file, 'utf8')));
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    privacyPage(),
    VitePWA({
      // Build natif (`npm run build:native`, lot 4) : pas de service worker ni de manifeste, les
      // fichiers sont déjà dans le paquet de l'app.
      disable: mode === 'native',
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        // Polices Inter et Space Grotesk (woff2) précachées : l'app garde sa typo hors ligne.
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
      manifest: {
        name: 'MuscuTrack',
        short_name: 'MuscuTrack',
        description: 'Suivi de musculation : séances types, séance en cours et progression.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#F5F5FA',
        background_color: '#F5F5FA',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // Tests Playwright (npm run e2e) : hors Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**', 'ios/**'],
  },
}));
