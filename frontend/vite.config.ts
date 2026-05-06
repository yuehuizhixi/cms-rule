import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      // 将 /api/rule-engine/proxy/* 转发到 Spring Boot 后端 (:8080)
      '/api/rule-engine/proxy': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // 将 /api/rule-engine/*（除 proxy 外）也转发到后端
      '/api/rule-engine': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
