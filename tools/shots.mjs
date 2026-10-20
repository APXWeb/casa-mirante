// QA visual: captura a página em pontos da rolagem.
// uso: node tools/shots.mjs [url] [saída] [largura] [altura] [lista "hero:0,obra:0.5,..."]
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const url = process.argv[2] || 'http://localhost:5280/'
const out = process.argv[3] || 'shots'
const W = Number(process.argv[4] || 1440)
const H = Number(process.argv[5] || 900)
const list = (process.argv[6] || 'hero:0,hero:0.5,hero:0.7,obra:0.02,obra:0.25,obra:0.4,obra:0.55,obra:0.7,obra:0.85,obra:0.99,casa:0.05,casa:0.2,casa:0.38,casa:0.56,casa:0.74,casa:0.95')
  .split(',')
  .map((s) => s.split(':'))

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => window.__cm || document.documentElement.classList.contains('no-gl'), null, { timeout: 90000 })
await page.waitForTimeout(800)
for (const [name, p] of list) {
  await page.evaluate(
    ([name, p]) => {
      const el = name === 'top' ? document.body : document.querySelector(`[data-pin="${name}"]`) || document.getElementById(name)
      const top = el.getBoundingClientRect().top + window.scrollY
      const len = el.dataset.pin ? el.offsetHeight - innerHeight : 0
      window.scrollTo(0, top + len * Number(p))
    },
    [name, p],
  )
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/${name}-${p}.jpg`, quality: 80, type: 'jpeg' })
}
console.log(errors.length ? errors.join('\n') : 'sem erros no console')
await browser.close()
