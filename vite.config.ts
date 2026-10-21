import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

function versionBusterPlugin(): Plugin {
  return {
    name: 'version-buster-plugin',
    buildStart() {
      const versionData = {
        version: '1.0.1',
        buildTime: new Date().toISOString(),
      }
      const publicPath = path.resolve(process.cwd(), 'public/version.json')
      fs.writeFileSync(publicPath, JSON.stringify(versionData, null, 2) + '\n')
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: '1.0.1',
          buildTime: new Date().toISOString(),
        }, null, 2) + '\n',
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    versionBusterPlugin(),
  ],
  server: {
    port: 5177,
    strictPort: true,
    host: '0.0.0.0',
  },
})
