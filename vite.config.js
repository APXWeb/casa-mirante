import { defineConfig } from 'vite'

// Renderiza as seções a partir dos dados do imóvel direto no index.html
// (no dev e no build). Os módulos são recarregados a cada requisição no dev.
function renderProperty() {
  let server
  return {
    name: 'render-property',
    configureServer(s) {
      server = s
    },
    async transformIndexHtml(html) {
      const mod = server ? await server.ssrLoadModule('/src/ui/render.js') : await import('./src/ui/render.js')
      return mod.renderPage(html)
    },
    handleHotUpdate({ file, server: s }) {
      if (/src[\\/](data|ui)[\\/]/.test(file)) s.ws.send({ type: 'full-reload' })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [renderProperty()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5280 },
})
