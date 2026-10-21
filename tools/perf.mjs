// QA de fluidez: rola a página com a roda do mouse (como uma pessoa) e mede
// intervalos de quadro e o atraso entre o tempo pedido e o exibido em cada vídeo.
// uso: node tools/perf.mjs [url] [largura] [altura]
import { chromium } from '@playwright/test'

const url = process.argv[2] || 'http://localhost:5280/'
const W = Number(process.argv[3] || 1440)
const H = Number(process.argv[4] || 900)
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: H } })
await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => document.documentElement.classList.contains('cm-ready'))
await page.waitForFunction(() => [window.__cm.clips.drone, window.__cm.clips.fachada, ...window.__cm.clips.scenes].every((c) => c.ready), null, { timeout: 90000 })

await page.evaluate(() => {
  const s = (window.__perf = { dts: [], lag: [], seeks: 0 })
  let last = performance.now()
  const all = [window.__cm.clips.drone, window.__cm.clips.fachada, ...window.__cm.clips.scenes]
  all.forEach((c) => c.video.addEventListener('seeked', () => s.seeks++))
  const tick = (now) => {
    s.dts.push(now - last)
    last = now
    for (const c of all) {
      const shown = c.video.closest('.layer.is-on') && !c.video.closest('.scene:not(.is-on)') && Number(getComputedStyle(c.video).opacity) > 0.5
      if (shown) s.lag.push(Math.abs(c.video.currentTime - c.target))
    }
    if (!s.stop) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
await page.mouse.move(W / 2, H / 2)
const end = await page.evaluate(() => {
  const el = document.querySelector('[data-pin="casa"]')
  return el.getBoundingClientRect().top + scrollY + el.offsetHeight
})
const t0 = Date.now()
while ((await page.evaluate(() => scrollY)) < end - H && Date.now() - t0 < 120000) {
  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(16)
}
// e de volta, um trecho para cima
for (let i = 0; i < 120; i++) {
  await page.mouse.wheel(0, -120)
  await page.waitForTimeout(16)
}
const r = await page.evaluate(() => {
  const s = window.__perf
  s.stop = true
  const d = s.dts.slice(5).sort((a, b) => a - b)
  const q = (arr, p) => arr[Math.floor(arr.length * p)] || 0
  const lag = s.lag.sort((a, b) => a - b)
  return {
    frames: d.length,
    p50: q(d, 0.5).toFixed(1),
    p95: q(d, 0.95).toFixed(1),
    p99: q(d, 0.99).toFixed(1),
    over33: d.filter((x) => x > 33.4).length,
    seeks: s.seeks,
    lagP50: q(lag, 0.5).toFixed(3),
    lagP95: q(lag, 0.95).toFixed(3),
  }
})
console.log(JSON.stringify({ viewport: `${W}x${H}`, seconds: ((Date.now() - t0) / 1000).toFixed(1), ...r }))
await browser.close()
