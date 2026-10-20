// Renderiza as imagens do site a partir do próprio modelo 3D:
// galeria, destaques, pôster da abertura e os quadros do modo sem WebGL.
// uso: npm run capture  (com `npm run dev` rodando)   ou   node tools/capture.mjs [url] [nomes...]
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const url = process.argv[2] || 'http://localhost:5280/'
const only = process.argv.slice(3)
const OUT = path.join(ROOT, 'public', 'img')

// câmeras dos stills (pos, alvo, fov, luz)
const STILLS = {
  poster: { pos: [-13, 2.1, 40], target: [4, 4.2, 2], fov: 30 },
  fachada: { pos: [-8, 1.6, 30], target: [3, 3.7, 2], fov: 32 },
  aerea: { pos: [34, 27, 38], target: [3, 0, 3], fov: 34 },
  'balanco-frente': { pos: [1.5, 1.35, 14.5], target: [6.5, 4.6, 3], fov: 46 },
  piscina: { pos: [18.2, 1.05, 17.2], target: [2.5, 1.9, 7.5], fov: 38 },
  deck: { pos: [-10.5, 1.55, 7.2], target: [6, 0.7, 8.8], fov: 42 },
  varanda: { pos: [20.5, 1.5, -7], target: [13.2, 1.7, 2], fov: 52 },
  sala: { pos: [11.3, 1.5, -4.7], target: [3.5, 1.15, 10], fov: 52 },
  cozinha: { pos: [6.2, 1.65, 2.2], target: [0.6, 1.0, -3.6], fov: 50 },
  suite: { pos: [16.4, 5.25, 0.6], target: [10.5, 4.3, 4.6], fov: 58 },
  brises: { pos: [5, 2.0, 10.5], target: [2.5, 5.2, 5.2], fov: 34 },
  concreto: { pos: [-6.5, 1.4, 9.5], target: [-10, 1.9, 4], fov: 40 },
  noite: { pos: [-5, 3.2, 34], target: [3, 3.6, 1], fov: 33, light: 'dusk' },
}

const page0 = await (async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(`${url}?q=high&dpr=2`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__cm, null, { timeout: 120000 })
  await page.evaluate(() => document.documentElement.classList.add('capture'))
  return { browser, page }
})()
const { browser, page } = page0

async function shoot(name, opts, dir = OUT) {
  await page.evaluate((o) => window.__cm.still(o), opts)
  await page.waitForTimeout(450)
  const png = await page.locator('[data-gl]').screenshot({ type: 'png' })
  await mkdir(dir, { recursive: true })
  const base = sharp(png).resize(1600, 900)
  await base.clone().webp({ quality: 84 }).toFile(path.join(dir, `${name}-1600.webp`))
  await sharp(png).resize(800, 450).webp({ quality: 80 }).toFile(path.join(dir, `${name}-800.webp`))
  console.log('ok', name)
}

const want = (n) => !only.length || only.includes(n) || only.some((o) => n.startsWith(o))

for (const [name, s] of Object.entries(STILLS)) {
  if (want(name)) await shoot(name, { P: 1, pos: s.pos, target: s.target, fov: s.fov, light: s.light || 'golden' })
}

// quadros do modo sem WebGL: obra (13 quadros) e cenas
const shots = await page.evaluate(() => {
  const o = {}
  for (const [k, v] of Object.entries(window.__cm.shots)) o[k] = { pos: v.pos.toArray(), target: v.target.toArray(), fov: v.fov }
  return o
})
const SEQ = 13
for (let i = 0; i < SEQ; i++) {
  const name = `obra-${String(i).padStart(2, '0')}`
  if (!want(name)) continue
  const P = i / (SEQ - 1)
  const c = shots.construct
  await shoot(name, { P, pos: c.pos, target: c.target, fov: c.fov, lightP: P }, path.join(OUT, 'seq'))
}
for (const id of ['residencia', 'piscina', 'sala', 'balanco', 'noite']) {
  const name = `cena-${id}`
  if (!want(name)) continue
  const s = shots[id]
  await shoot(name, { P: 1, pos: s.pos, target: s.target, fov: s.fov, light: id === 'noite' ? 'dusk' : 'golden' }, path.join(OUT, 'seq'))
}
await browser.close()
