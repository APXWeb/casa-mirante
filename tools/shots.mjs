// QA visual: captura a página em pontos da rolagem.
// uso: node tools/shots.mjs [url] [saída] [largura] [altura] [lista "hero:0,obra:0.5,..."]
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const url = process.argv[2] || 'http://localhost:5280/'
const out = process.argv[3] || 'shots'
const W = Number(process.argv[4] || 1440)
const H = Number(process.argv[5] || 900)
const list = (
  process.argv[6] ||
  'hero:0,hero:0.4,hero:0.7,hero:0.93,obra:0.03,obra:0.15,obra:0.29,obra:0.4,obra:0.48,obra:0.58,obra:0.68,obra:0.76,obra:0.86,obra:0.99,casa:0.02,casa:0.04,casa:0.09,casa:0.13,casa:0.2,casa:0.29,casa:0.42,casa:0.55,casa:0.68,casa:0.8,casa:0.93'
)
  .split(',')
  .map((s) => s.split(':'))

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => document.documentElement.classList.contains('cm-ready'))
// espera os vídeos principais (ou desiste em 60 s e segue com os pôsteres)
await page
  .waitForFunction(() => window.__cm.stillsOnly || [window.__cm.clips.drone, window.__cm.clips.fachada, ...window.__cm.clips.scenes].every((c) => c.ready), null, { timeout: 60000 })
  .catch(() => errors.push('aviso: nem todos os vídeos ficaram prontos'))
for (const [name, p] of list) {
  await page.evaluate(
    ([name, p]) => {
      const el = name === 'top' ? document.body : document.querySelector(`[data-pin="${name}"]`) || document.getElementById(name)
      const top = el.getBoundingClientRect().top + window.scrollY
      // seção fixada: p é fração da rolagem; seção comum: p é deslocamento em px
      window.scrollTo(0, el.dataset.pin ? top + (el.offsetHeight - innerHeight) * Number(p) : top + Number(p))
    },
    [name, p],
  )
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/${name}-${p}.jpg`, quality: 78, type: 'jpeg' })
}
console.log(errors.length ? errors.join('\n') : 'sem erros no console')
await browser.close()
