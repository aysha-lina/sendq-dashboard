import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Uploaded files (builder images, avatars, thumbnails) are served by the
      // backend at /uploads. Without this proxy they 404 in dev and show as
      // broken/transparent images. nginx handles this in production.
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/track': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
