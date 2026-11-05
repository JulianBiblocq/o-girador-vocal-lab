import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

function versionBusterPlugin(): Plugin {
  let serializedVersion = ''
  const pkgPath = path.resolve(process.cwd(), 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string }
  const appVersion = pkg.version || '1.1.0'

  return {
    name: 'version-buster-plugin',
    buildStart() {
      const versionData = {
        version: appVersion,
        buildTime: new Date().toISOString(),
      }
      serializedVersion = JSON.stringify(versionData, null, 2) + '\n'
      const publicPath = path.resolve(process.cwd(), 'public/version.json')
      fs.writeFileSync(publicPath, serializedVersion)
    },
    generateBundle() {
      if (!serializedVersion) {
        serializedVersion = JSON.stringify({
          version: appVersion,
          buildTime: new Date().toISOString(),
        }, null, 2) + '\n'
      }
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: serializedVersion,
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
