import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  // 👇 여기서부터 추가된 부분입니다 👇
  server: {
    host: '0.0.0.0',
    port: 5176,
    allowedHosts: true // Cloudflare 등의 외부 터널 접속을 모두 허용합니다!
  }
})