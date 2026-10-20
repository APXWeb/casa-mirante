// Contato: WhatsApp e/ou e-mail configurados em src/data/property.js (contact).
// Sem canal configurado, o formulário valida e mostra o resumo, sem enviar nada.
export function initContact() {
  const cfg = JSON.parse(document.querySelector('[data-contact]')?.textContent || '{}')
  const form = document.querySelector('[data-form]')
  const status = document.querySelector('[data-status]')
  const wa = document.querySelector('[data-wa]')
  if (!form) return

  const waLink = (text) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`
  if (cfg.whatsapp) {
    wa.href = waLink(cfg.message)
    wa.target = '_blank'
    wa.rel = 'noopener'
    wa.hidden = false
  }

  const phoneOk = (v) => v.replace(/\D/g, '').length >= 10
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(form))
    const errs = []
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'))
    if (!d.name.trim()) errs.push(['name', 'Informe seu nome.'])
    if (!phoneOk(d.phone)) errs.push(['phone', 'Informe um telefone com DDD.'])
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) errs.push(['email', 'Confira o e-mail.'])
    if (errs.length) {
      errs.forEach(([n]) => form.elements[n].setAttribute('aria-invalid', 'true'))
      form.elements[errs[0][0]].focus()
      status.textContent = errs.map((x) => x[1]).join(' ')
      status.dataset.kind = 'error'
      return
    }
    const text = [
      `${cfg.message}`,
      `Imóvel: ${cfg.name}`,
      `Nome: ${d.name}`,
      `Telefone: ${d.phone}`,
      d.email && `E-mail: ${d.email}`,
      `Preferência: ${d.kind}`,
      d.message && `Mensagem: ${d.message}`,
    ]
      .filter(Boolean)
      .join('\n')

    if (cfg.whatsapp) {
      window.open(waLink(text), '_blank', 'noopener')
      status.textContent = 'Abrimos o WhatsApp com a sua mensagem pronta.'
      status.dataset.kind = 'ok'
    } else if (cfg.email) {
      location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(`Visita: ${cfg.name}`)}&body=${encodeURIComponent(text)}`
      status.textContent = 'Abrimos o seu aplicativo de e-mail com a mensagem pronta.'
      status.dataset.kind = 'ok'
    } else {
      status.textContent = `Pedido registrado nesta demonstração, ${d.name.trim().split(' ')[0]}. Como o imóvel é demonstrativo, nenhum dado foi enviado.`
      status.dataset.kind = 'demo'
      form.reset()
    }
  })
}
