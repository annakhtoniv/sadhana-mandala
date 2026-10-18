import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
// The app version (date of the build) goes with error reports
const buildVersion = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  base: process.env.VITE_BASE || './',
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries change rarely: their own file stays cached on phones across app updates
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // src/lib/appUpdate.ts registers the service worker and reloads the page on an update
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sadhana Mandala',
        short_name: 'Sadhana',
        description: 'Daily practice, programmes, events and follow-ups for your meditation community',
        theme_color: '#1c1917',
        background_color: '#fafaf9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app is one page: a QR link like /?code=JOIN opens it from the cache too
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // A new version takes over at once, instead of waiting until every tab of the site is closed
        skipWaiting: true,
        clientsClaim: true,
        // Shows the daily practice reminders (Phase 18)
        importScripts: ['push-handler.js'],
      },
    })
  ],
});
