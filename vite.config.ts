import { defineConfig } from 'vite'

export default defineConfig({
  base: '/260523_shogi-game-ver3/',
  resolve: {
    // モバイルブラウザで Node 版 @google/genai が選ばれ API 即失敗するのを防ぐ
    alias: {
      '@google/genai': '@google/genai/web',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
})
