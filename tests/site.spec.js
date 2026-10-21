import { test, expect } from '@playwright/test'
import { property, gallery, stages, scenes } from '../src/data/property.js'
import { media } from '../src/data/media.js'

// rola até uma fração de uma seção fixada (ou até o topo de uma seção comum)
async function scrollTo(page, name, p = 0, wait = 450) {
  await page.evaluate(
    ([name, p]) => {
      const el = document.querySelector(`[data-pin="${name}"]`) || document.getElementById(name)
      const top = el.getBoundingClientRect().top + window.scrollY
      const len = el.dataset.pin ? el.offsetHeight - innerHeight : 0
      window.scrollTo(0, top + len * p)
    },
    [name, p],
  )
  await page.waitForTimeout(wait)
}

const ready = (page) => page.waitForFunction(() => document.documentElement.classList.contains('cm-ready'), null, { timeout: 30_000 })
const clipsReady = (page, ids) =>
  page.waitForFunction(
    (ids) => {
      const c = window.__cm.clips
      const all = { drone: c.drone, fachada: c.fachada, ...Object.fromEntries(c.scenes.map((s) => [s.id, s])) }
      return ids.every((id) => all[id].ready)
    },
    ids,
    { timeout: 60_000 },
  )
const videoTime = (page, sel) => page.evaluate((sel) => document.querySelector(sel).currentTime, sel)

function collectErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`))
  return errors
}

test('todas as mídias são da mesma casa e têm origem e licença registradas', () => {
  const ids = [...Object.values(media.clips).map((c) => c.pexels), ...media.stills.map((s) => s.pexels)]
  // um único lote de filmagem do autor (setembro de 2026)
  for (const id of ids) expect(id, String(id)).toBeGreaterThanOrEqual(39576501)
  for (const id of ids) expect(id, String(id)).toBeLessThanOrEqual(39576534)
  for (const c of Object.values(media.clips)) expect(c.page).toMatch(/^https:\/\/www\.pexels\.com\/video\//)
  expect(media.license.url).toBe('https://www.pexels.com/license/')
  expect(media.author.name).toBe('Alef Morais')
})

test('carrega sem erros, com o vídeo real da abertura', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await ready(page)
  await expect(page.locator('h1')).toHaveText(property.name)
  await clipsReady(page, ['drone'])
  await expect(page.locator('.l-hero video')).toHaveClass(/is-ready/)
  await expect(page.locator('#creditos a[href="https://www.pexels.com/license/"]')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('o voo da abertura acompanha a rolagem nos dois sentidos', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await clipsReady(page, ['drone'])
  const t = []
  for (const p of [0.15, 0.45, 0.8]) {
    await scrollTo(page, 'hero', p, 700)
    t.push(await videoTime(page, '.l-hero video'))
  }
  expect(t[1]).toBeGreaterThan(t[0] + 2)
  expect(t[2]).toBeGreaterThan(t[1] + 2)
  await scrollTo(page, 'hero', 0.3, 700)
  const back = await videoTime(page, '.l-hero video')
  expect(back).toBeLessThan(t[1])
  expect(back).toBeGreaterThan(t[0])
})

test('revelação da fachada: desenho, volumes, materiais e casa pronta, reversível', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await clipsReady(page, ['fachada'])
  const state = () =>
    page.evaluate(() => ({
      line: parseFloat(getComputedStyle(document.querySelector('.ln[data-group="volume"]')).strokeDashoffset),
      fill: Number(getComputedStyle(document.querySelector('[data-fill="7"]')).opacity),
      wood: Number(document.querySelector('[data-mat="madeira"]').style.getPropertyValue('--m') || 0),
      env: Number(document.querySelector('[data-env]').style.getPropertyValue('--r') || 0),
      clip: document.querySelector('[data-sheet]').style.clipPath,
      video: Number(getComputedStyle(document.querySelector('.plate-video')).opacity),
      time: document.querySelector('.plate-video').currentTime,
    }))
  await scrollTo(page, 'obra', 0.2)
  let s = await state()
  expect(s.line).toBeLessThan(0.05)
  expect(s.fill).toBe(0)
  await expect(page.locator('.stage-cap.is-on')).toHaveAttribute('data-stage', '0')

  await scrollTo(page, 'obra', 0.46)
  s = await state()
  expect(s.fill).toBeGreaterThan(0.9)
  expect(s.wood).toBe(0)
  await expect(page.locator('.stage-cap.is-on')).toHaveAttribute('data-stage', '1')

  await scrollTo(page, 'obra', 0.66)
  s = await state()
  expect(s.wood).toBe(1)
  await expect(page.locator('.stage-cap.is-on')).toHaveAttribute('data-stage', '2')

  await scrollTo(page, 'obra', 0.99, 900)
  s = await state()
  expect(s.env).toBe(1)
  expect(s.clip).toMatch(/^inset\(0px( 0px 0px 0px)?( round 0px)?\)$/)
  expect(s.video).toBe(1)
  expect(s.time).toBeLessThan(media.plateTime - 1)
  await expect(page.locator('.stage-cap.is-on')).toHaveAttribute('data-stage', String(stages.length - 1))

  // volta: o desenho reaparece e os volumes somem
  await scrollTo(page, 'obra', 0.2)
  s = await state()
  expect(s.fill).toBe(0)
  expect(s.wood).toBe(0)
  await expect(page.locator('.stage-cap.is-on')).toHaveAttribute('data-stage', '0')
})

test('ambientes: cada cena é um vídeo real guiado pela rolagem', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await clipsReady(page, scenes.map((s) => s.clip))
  const n = scenes.length
  for (const k of [2, 5]) {
    await scrollTo(page, 'casa', (k + 0.45) / n, 700)
    await expect(page.locator('.scene-cap.is-on')).toHaveAttribute('data-scene', String(k))
    await expect(page.locator(`.l-scenes .scene[data-scene="${k}"]`)).toHaveClass(/is-on/)
    const a = await videoTime(page, `.l-scenes .scene[data-scene="${k}"] video`)
    await scrollTo(page, 'casa', (k + 0.8) / n, 700)
    const b = await videoTime(page, `.l-scenes .scene[data-scene="${k}"] video`)
    expect(b).toBeGreaterThan(a + 0.5)
  }
  await scrollTo(page, 'casa', 0.97, 700)
  await expect(page.locator('.scene-cap.is-on')).toHaveAttribute('data-scene', String(n - 1))
})

test('ficha completa, com dados ilustrativos marcados', async ({ page }) => {
  await page.goto('/#ficha')
  await page.waitForTimeout(900)
  const ficha = page.locator('#ficha')
  await expect(ficha).toBeInViewport()
  await expect(ficha.locator('.price-v')).toContainText('6.900.000')
  await expect(ficha.locator('.price-note .tag-illus')).toBeVisible()
  await expect(ficha.locator('.facts li')).toHaveCount(property.facts.length)
  await expect(ficha.locator('.facts .tag-illus')).toHaveCount(property.facts.filter((f) => f.illustrative).length)
  await expect(ficha.locator('.feat')).toHaveCount(property.features.length)
  await expect(ficha.locator('.add-row.is-pending')).toHaveCount(property.additional.filter((a) => a.value == null).length)
  await expect(ficha.locator('.disclaimer')).toContainText('ilustrativos')
  await expect(ficha.locator('iframe.map')).toHaveCount(0)
  await expect(ficha.locator('.map-empty')).toContainText(property.address.region)
  await expect(ficha.locator('.ficha-actions a[href="#galeria"]')).toContainText(String(gallery.length))
})

test('galeria abre, navega, filtra e fecha', async ({ page }) => {
  await page.goto('/#galeria')
  await page.waitForTimeout(700)
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
  await expect.poll(() => dlg.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dlg).toBeHidden()
  await page.locator('[data-filter="Interiores"]').click()
  await expect(page.locator('.g-item:not([hidden])')).toHaveCount(gallery.filter((g) => g.group === 'Interiores').length)
})

test('todas as imagens da página carregam', async ({ page }) => {
  await page.goto('/')
  const broken = await page.evaluate(async () => {
    // a imagem da lightbox só recebe src ao abrir
    const imgs = [...document.querySelectorAll('img[src]')]
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

test('contato valida e funciona em modo demonstração', async ({ page }) => {
  await page.goto('/#contato')
  await page.waitForTimeout(700)
  await expect(page.locator('[data-wa]')).toBeHidden()
  await page.getByRole('button', { name: 'Solicitar visita' }).click()
  await expect(page.locator('[data-status]')).toContainText('Informe seu nome')
  await expect(page.locator('#f-name')).toHaveAttribute('aria-invalid', 'true')
  await page.fill('#f-name', 'Maria Souza')
  await page.fill('#f-phone', '(71) 98888-7777')
  await page.getByRole('button', { name: 'Solicitar visita' }).click()
  await expect(page.locator('[data-status]')).toContainText('demonstração')
})

test('links do menu levam às seções', async ({ page, isMobile }) => {
  test.skip(isMobile, 'menu de seções fica oculto no celular')
  await page.goto('/')
  await ready(page)
  await page.locator('.nav a[href="#ficha"]').click()
  await page.waitForTimeout(2600)
  await expect(page.locator('#ficha .ficha-name')).toBeInViewport()
  await page.locator('.top-cta').click()
  await page.waitForTimeout(2600)
  await expect(page.locator('#contact-title')).toBeInViewport()
})

test('modo de quadros fixos (?stills) não baixa vídeos e mantém a revelação', async ({ page }) => {
  const errors = collectErrors(page)
  const videos = []
  page.on('request', (r) => r.url().endsWith('.mp4') && videos.push(r.url()))
  await page.goto('/?stills')
  await ready(page)
  await scrollTo(page, 'obra', 0.99)
  expect(await page.evaluate(() => Number(document.querySelector('[data-env]').style.getPropertyValue('--r')))).toBe(1)
  await scrollTo(page, 'casa', 0.4)
  const k = Math.floor(0.4 * scenes.length)
  const poster = page.locator(`.l-scenes .scene[data-scene="${k}"] .poster img`)
  await expect(poster).toBeVisible()
  expect(await poster.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true)
  expect(videos).toEqual([])
  expect(errors).toEqual([])
})

test('movimento reduzido mantém a página navegável', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await ready(page)
  expect(await page.evaluate(() => window.__cm.stillsOnly)).toBe(true)
  await scrollTo(page, 'obra', 0.6)
  await expect(page.locator('.stage-cap.is-on')).toHaveAttribute('data-stage', '2')
  await scrollTo(page, 'ficha')
  await expect(page.locator('.facts li').first()).toBeVisible()
})

test('sem rolagem horizontal', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  for (const [id, p] of [
    ['hero', 0.5],
    ['obra', 0.3],
    ['obra', 0.95],
    ['casa', 0.5],
    ['galeria', 0],
    ['ficha', 0],
    ['contato', 0],
  ]) {
    await scrollTo(page, id, p)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(over, `${id} ${p}`).toBeLessThanOrEqual(0)
  }
})
