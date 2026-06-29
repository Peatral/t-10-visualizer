import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
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
