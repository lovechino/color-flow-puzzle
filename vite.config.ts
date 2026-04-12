import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  build: {
    target: 'es2020',
  },
  server: {
    port: 3000,
  },
})
