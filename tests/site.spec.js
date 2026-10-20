import { test, expect } from '@playwright/test'
import { houseAreas } from '../src/data/house.js'
import { property, gallery, stages } from '../src/data/property.js'

// rola até uma fração de uma seção fixada (ou até o topo de uma seção comum)
async function scrollTo(page, name, p = 0) {
  await page.evaluate(
    ([name, p]) => {
      const el = document.querySelector(`[data-pin="${name}"]`) || document.getElementById(name)
      const top = el.getBoundingClientRect().top + window.scrollY
      const len = el.dataset.pin ? el.offsetHeight - innerHeight : 0
      window.scrollTo(0, top + len * p)
    },
    [name, p],
  )
  await page.waitForTimeout(350)
}

const ready = (page) => page.waitForFunction(() => document.documentElement.matches('.gl-ready, .no-gl'), null, { timeout: 60_000 })
const buildP = (page) => page.evaluate(() => window.__cm.world.director.P)

function collectErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`))
  return errors
}

test('carrega sem erros e o 3D fica pronto', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await ready(page)
  await expect(page.locator('html')).toHaveClass(/gl-ready/)
  await expect(page.locator('h1')).toHaveText(property.name)
  expect(errors).toEqual([])
})

test('a obra acompanha a rolagem para frente e para trás', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await scrollTo(page, 'obra', 0.03)
  expect(await buildP(page)).toBeLessThan(0.02)
  await expect(page.locator('.stage-cap.is-on .eyebrow')).toContainText(stages[0].kicker)

  const samples = []
  for (const p of [0.2, 0.4, 0.6, 0.8, 0.97]) {
    await scrollTo(page, 'obra', p)
    samples.push(await buildP(page))
  }
  for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThan(samples[i - 1])
  expect(samples.at(-1)).toBeGreaterThan(0.99)
  await expect(page.locator('[data-pct]')).toHaveText('100')
  await expect(page.locator('.stage-cap[data-stage="4"]')).toHaveClass(/is-on/)

  // volta: a casa "desconstrói" e a etapa volta
  await scrollTo(page, 'obra', 0.25)
  const back = await buildP(page)
  expect(back).toBeGreaterThan(0.2)
  expect(back).toBeLessThan(0.26)
  await expect(page.locator('.stage-cap[data-stage="1"]')).toHaveClass(/is-on/)
})

test('abertura faz a varredura para o blueprint e a apresentação troca de cena', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await scrollTo(page, 'abertura', 0.6)
  const wipe = await page.evaluate(() => window.__cm.world.director.wipe)
  expect(wipe).toBeGreaterThan(0)
  expect(wipe).toBeLessThan(1)
  await scrollTo(page, 'casa', 0.3)
  await expect(page.locator('.scene-cap.is-on')).toHaveAttribute('data-scene', '1')
  await scrollTo(page, 'casa', 0.97)
  await expect(page.locator('.scene-cap.is-on')).toHaveAttribute('data-scene', '4')
})

test('ficha completa depois do cinema, com dados conferidos contra o modelo', async ({ page }) => {
  const a = houseAreas()
  expect(property.facts.builtArea).toBe(a.built)
  expect(property.facts.lotArea).toBe(a.lot)
  await page.goto('/#ficha')
  await page.waitForTimeout(800)
  const ficha = page.locator('#ficha')
  await expect(ficha).toBeInViewport()
  await expect(ficha.locator('.price-v')).toContainText('8.900.000')
  await expect(ficha.locator('.facts li')).toHaveCount(6)
  await expect(ficha.locator('.facts')).toContainText('488')
  await expect(ficha.locator('.feat')).toHaveCount(property.features.length)
  await expect(ficha.locator('.add-row.is-pending')).toHaveCount(4)
  await expect(ficha.locator('.demo-note')).toBeVisible()
  // a ficha vem depois das seções cinematográficas
  const order = await page.evaluate(() => ['obra', 'casa', 'ficha'].map((id) => document.getElementById(id).getBoundingClientRect().top))
  expect(order[0]).toBeLessThan(order[1])
  expect(order[1]).toBeLessThan(order[2])
})

test('galeria abre, navega, filtra e fecha', async ({ page }) => {
  await page.goto('/#galeria')
  await page.waitForTimeout(600)
  const items = page.locator('.g-item')
  await expect(items).toHaveCount(gallery.length)
  await items.first().locator('button').click()
  const dlg = page.locator('[data-lightbox]')
  await expect(dlg).toBeVisible()
  await expect(dlg.locator('[data-lb-count]')).toHaveText(`1 / ${gallery.length}`)
  await dlg.locator('[data-lb-next]').click()
  await expect(dlg.locator('[data-lb-count]')).toHaveText(`2 / ${gallery.length}`)
  await page.keyboard.press('ArrowLeft')
  await expect(dlg.locator('[data-lb-count]')).toHaveText(`1 / ${gallery.length}`)
  const ok = await dlg.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)
  expect(ok).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dlg).toBeHidden()
  await page.locator('[data-filter="Interiores"]').click()
  await expect(page.locator('.g-item:not([hidden])')).toHaveCount(gallery.filter((g) => g.group === 'Interiores').length)
})

test('todas as imagens da página carregam', async ({ page }) => {
  await page.goto('/')
  const broken = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('main img, .stage img')]
    await Promise.all(
      imgs.map((img) => {
        img.loading = 'eager'
        return img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r)))
      }),
    )
    return imgs.filter((i) => !i.naturalWidth).map((i) => i.currentSrc || i.src)
  })
  expect(broken).toEqual([])
})

test('planta alterna pavimentos e localização não inventa mapa', async ({ page }) => {
  await page.goto('/#planta')
  await page.waitForTimeout(600)
  await expect(page.locator('#plan-ground svg')).toBeVisible()
  await page.locator('#tab-upper').click()
  await expect(page.locator('#plan-upper svg')).toBeVisible()
  await expect(page.locator('#plan-ground')).toBeHidden()
  await expect(page.locator('#plan-upper')).toContainText('Suíte principal')
  await expect(page.locator('iframe.map')).toHaveCount(0)
  await expect(page.locator('.map-empty')).toContainText('coordenadas')
})

test('contato valida e funciona em modo demonstração', async ({ page }) => {
  await page.goto('/#contato')
  await page.waitForTimeout(600)
  await expect(page.locator('[data-wa]')).toBeHidden()
  await page.getByRole('button', { name: 'Solicitar visita' }).click()
  await expect(page.locator('[data-status]')).toContainText('Informe seu nome')
  await expect(page.locator('#f-name')).toHaveAttribute('aria-invalid', 'true')
  await page.fill('#f-name', 'Maria Souza')
  await page.fill('#f-phone', '(11) 98888-7777')
  await page.getByRole('button', { name: 'Solicitar visita' }).click()
  await expect(page.locator('[data-status]')).toContainText('demonstração')
})

test('links do menu levam às seções', async ({ page, isMobile }) => {
  test.skip(isMobile, 'menu de seções fica oculto no celular')
  await page.goto('/')
  await ready(page)
  await page.locator('.nav a[href="#ficha"]').click()
  await page.waitForTimeout(2200)
  await expect(page.locator('#ficha .ficha-name')).toBeInViewport()
  await page.locator('.top-cta').click()
  await page.waitForTimeout(2200)
  await expect(page.locator('#contact-title')).toBeInViewport()
})

test('sem WebGL a progressão usa quadros renderizados', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/?no3d')
  await ready(page)
  await expect(page.locator('html')).toHaveClass(/no-gl/)
  await scrollTo(page, 'obra', 0.5)
  const visible = await page.evaluate(() => [...document.querySelectorAll('[data-fallback] img')].filter((i) => Number(i.style.opacity) > 0.5).map((i) => i.src))
  expect(visible.length).toBeGreaterThan(0)
  expect(visible.join()).toMatch(/obra-0[56]/)
  expect(errors).toEqual([])
})

test('movimento reduzido mantém a página navegável', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await ready(page)
  await scrollTo(page, 'obra', 0.6)
  expect(await buildP(page)).toBeGreaterThan(0.55)
  await scrollTo(page, 'ficha')
  await expect(page.locator('.facts li').first()).toBeVisible()
})

test('sem rolagem horizontal', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  for (const id of ['numeros', 'destaques', 'ficha', 'galeria', 'planta', 'contato']) {
    await scrollTo(page, id)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(over, id).toBeLessThanOrEqual(0)
  }
})
