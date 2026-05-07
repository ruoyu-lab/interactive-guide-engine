import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  build: {
    outDir: 'dist/package',
    emptyOutDir: true,
    lib: {
      entry: {
        engine: fileURLToPath(new URL('./packages/engine/src/index.ts', import.meta.url)),
        'dom-adapter': fileURLToPath(new URL('./packages/dom-adapter/src/index.ts', import.meta.url)),
        'dom-renderer': fileURLToPath(new URL('./packages/dom-renderer/src/index.ts', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: 'dom-renderer',
    },
  },
})
