import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    // 청크 크기 경고 기준 (KB)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // 무거운 라이브러리를 별도 청크로 분리 → 게임 화면 진입 시에만 로드
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) return 'vendor-three'
          if (id.includes('node_modules/cannon-es')) return 'vendor-physics'
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) return 'vendor-socket'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react'
          if (id.includes('node_modules/@sentry')) return 'vendor-sentry'
        },
      },
    },
  },
})
