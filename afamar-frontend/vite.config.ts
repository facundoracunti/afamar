import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const API_PORT = process.env.API_PORT || '8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  server: {
    port: 3090,
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
