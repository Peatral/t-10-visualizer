import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  // Rolldown build configurations for babel compiler integration
  build: {
    rolldownOptions: {
      plugins: [
        // @ts-ignore --- Rolldown Babel preset handles compiler compilation mode dynamically
        reactCompilerPreset({
          target: '19' // Target React 19 compiler runtime
        })
      ]
    }
  }
})
