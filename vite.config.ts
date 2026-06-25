import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
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
