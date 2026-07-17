import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/admin/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: '../public/admin',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5050',
      '/markers.json': 'http://localhost:5050',
      '/embed': 'http://localhost:5050',
      '/uploads': 'http://localhost:5050',
      '/maps': 'http://localhost:5050'
    }
  }
})
