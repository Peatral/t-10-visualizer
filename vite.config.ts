import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import babel from '@rolldown/plugin-babel';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    react(),
    babel({
      presets: [reactCompilerPreset()]
    }),
    nitro({
      modules: [
        (nitro) => {
          nitro.hooks.hook('compiled', async (nitroInstance) => {
            const fs = await import('node:fs/promises')
            const path = await import('node:path')
            const dbPath = path.resolve(nitroInstance.options.rootDir, 'sqlite.db')
            
            // Destination for node-server builds:
            const serverDir = path.resolve(nitroInstance.options.output.dir, 'server')
            // Destination for Vercel builds:
            const vercelFuncDir = path.resolve(nitroInstance.options.output.dir, 'functions/__server.func')
            
            try {
              await fs.access(serverDir)
              await fs.copyFile(dbPath, path.join(serverDir, 'sqlite.db'))
              console.log(`[nitro] Copied sqlite.db to ${serverDir}`)
            } catch {}
            
            try {
              await fs.access(vercelFuncDir)
              await fs.copyFile(dbPath, path.join(vercelFuncDir, 'sqlite.db'))
              console.log(`[nitro] Copied sqlite.db to ${vercelFuncDir}`)
            } catch {}
          })
        }
      ]
    }),
  ],
  server: {
    port: 3000,
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
