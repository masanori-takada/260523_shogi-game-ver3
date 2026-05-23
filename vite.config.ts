import { defineConfig } from 'vite'

export default defineConfig({
  // テスト設定
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  // ビルド設定
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
})
