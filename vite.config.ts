import { defineConfig } from 'vite'

export default defineConfig({
  base: '/260523_shogi-game-ver3/',
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
