/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
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
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
