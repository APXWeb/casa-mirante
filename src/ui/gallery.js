// Galeria: filtros por grupo + visualização ampliada (teclado, toque, setas).
export function initGallery() {
  const data = JSON.parse(document.querySelector('[data-gallery]')?.textContent || '[]')
  const grid = document.querySelector('[data-grid]')
  const dlg = document.querySelector('[data-lightbox]')
  if (!grid || !dlg) return
  const fig = dlg.querySelector('[data-lb-fig]')
  const cap = dlg.querySelector('[data-lb-cap]')
  const count = dlg.querySelector('[data-lb-count]')
  const img = document.createElement('img')
  img.decoding = 'async'
  fig.prepend(img)
  let list = data.map((_, i) => i)
  let pos = 0
  let opener = null

  function show(k) {
    pos = (k + list.length) % list.length
    const g = data[list[pos]]
    img.src = `img/${g.id}-1600.webp`
    img.alt = g.alt
    cap.textContent = g.alt
    count.textContent = `${pos + 1} / ${list.length}`
    // pré-carrega a vizinha
    const nx = data[list[(pos + 1) % list.length]]
    if (nx) new Image().src = `img/${nx.id}-1600.webp`
  }

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-index]')
    if (!b) return
    opener = b
    const idx = Number(b.dataset.index)
    pos = Math.max(0, list.indexOf(idx))
    show(pos)
    dlg.showModal()
    document.documentElement.classList.add('lb-open')
  })
  dlg.querySelector('[data-lb-prev]').addEventListener('click', () => show(pos - 1))
  dlg.querySelector('[data-lb-next]').addEventListener('click', () => show(pos + 1))
  dlg.querySelector('[data-lb-close]').addEventListener('click', () => dlg.close())
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('lb-open')
    opener?.focus({ preventScroll: true })
  })
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close()
  })
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(pos + 1)
    if (e.key === 'ArrowLeft') show(pos - 1)
  })
  let x0 = null
  dlg.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true })
  dlg.addEventListener('touchend', (e) => {
    if (x0 == null) return
    const dx = e.changedTouches[0].clientX - x0
    if (Math.abs(dx) > 45) show(pos + (dx < 0 ? 1 : -1))
    x0 = null
  })

  // filtros
  const chips = [...document.querySelectorAll('[data-filter]')]
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      const f = c.dataset.filter
      chips.forEach((o) => {
        o.classList.toggle('is-on', o === c)
        o.setAttribute('aria-pressed', o === c)
      })
      const items = [...grid.children]
      list = []
      items.forEach((li, i) => {
        const on = f === '*' || li.dataset.group === f
        li.hidden = !on
        if (on) list.push(i)
      })
    }),
  )
}
