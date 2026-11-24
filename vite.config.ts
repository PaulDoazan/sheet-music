/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Cloudflare Pages sert l'app à la racine ; GitHub Pages (transitoire) la sert sous /sheet-music/ via VITE_BASE
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    server: { deps: { inline: ['vuetify'] } },
  },
})
