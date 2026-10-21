// Revelação suave das seções depois do cinema.
export function initReveal(reduced) {
  const els = [...document.querySelectorAll('.after .sec-head, .feat, .facts li, .g-item, .manifesto-copy, .contact-copy, .form, .ficha-head, .map-empty')]
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
