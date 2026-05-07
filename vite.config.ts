import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: 'examples/vue-demo',
  plugins: [vue()],
  resolve: {
    alias: {
      '@guide/engine': fileURLToPath(new URL('./packages/engine/src', import.meta.url)),
      '@guide/dom-adapter': fileURLToPath(new URL('./packages/dom-adapter/src', import.meta.url)),
      '@guide/dom-renderer': fileURLToPath(new URL('./packages/dom-renderer/src', import.meta.url)),
    },
  },
  build: {
    outDir: '../../dist/demo',
    emptyOutDir: true,
  },
})
