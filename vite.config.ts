import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 600000,        // 프록시 타임아웃 10분 (대용량 파트 업로드)
        configure: (proxy) => {
          // 프록시 에러 핸들링 (ECONNRESET 등)
          proxy.on('error', (err, _req, res) => {
            console.error('[proxy error]', err.message);
            if (res && 'writeHead' in res && !res.headersSent) {
              (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
              (res as import('http').ServerResponse).end(JSON.stringify({ error: 'Proxy error', message: err.message }));
            }
          });
          // 프록시 요청/응답 타임아웃 증가
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setTimeout(600000);  // 10분
          });
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.setTimeout(600000);  // 10분
          });
        },
      },
    },
  },
})
