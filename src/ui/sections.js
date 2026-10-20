// Abas da planta (com setas do teclado), contadores e revelação suave das seções.
export function initPlanTabs() {
  const tabs = [...document.querySelectorAll('.plan-tabs [role="tab"]')]
  const select = (t) => {
    tabs.forEach((o) => {
      const on = o === t
      o.setAttribute('aria-selected', on)
      o.tabIndex = on ? 0 : -1
      o.classList.toggle('is-on', on)
      document.getElementById(o.getAttribute('aria-controls')).hidden = !on
    })
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t))
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
      select(n)
      n.focus()
    })
  })
}

export function initCounters(reduced) {
  const els = [...document.querySelectorAll('[data-count]')]
  if (reduced || !('IntersectionObserver' in window)) return
  const fmt = (n) => Math.round(n).toLocaleString('pt-BR')
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        io.unobserve(e.target)
        const el = e.target
        const end = Number(el.dataset.count)
        const t0 = performance.now()
        const tick = (now) => {
          const t = Math.min(1, (now - t0) / 1400)
          el.textContent = fmt(end * (1 - Math.pow(1 - t, 3)))
          if (t < 1) requestAnimationFrame(tick)
          else el.textContent = end.toLocaleString('pt-BR')
        }
        requestAnimationFrame(tick)
      }
    },
    { threshold: 0.6 },
  )
  els.forEach((el) => io.observe(el))
}

export function initReveal(reduced) {
  const els = [...document.querySelectorAll('.after .sec-head, .after .num-list li, .hl, .feat, .facts li, .g-item, .manifesto-copy, .contact-copy, .form')]
  if (reduced || !('IntersectionObserver' in window)) return
  document.documentElement.classList.add('reveal-on')
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  )
  els.forEach((el) => io.observe(el))
}
