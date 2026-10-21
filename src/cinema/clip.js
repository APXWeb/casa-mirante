// Vídeo controlado pela rolagem.
// O arquivo inteiro é baixado (fetch -> Blob) antes de ser usado: assim a busca
// de quadros (currentTime) nunca espera rede, nos dois sentidos. Uma busca por
// vez: a próxima só sai quando o navegador confirma a anterior ('seeked').
import { media } from '../data/media.js'

const FRAME = 1 / media.fps

export const variant = () => (innerHeight > innerWidth * 1.08 ? 'm' : 'd')

export class Clip {
  constructor(id, video, poster, kind = variant()) {
    this.id = id
    this.meta = media.clips[id]
    this.duration = this.meta.duration
    this.video = video
    this.poster = poster
    this.kind = kind
    this.src = `media/${id}-${kind}.mp4`
    this.target = 0
    this.ready = false
    this.seeking = false
    this.shown = false
    this.loading = null
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('muted', '')
    video.addEventListener('seeked', () => {
      this.seeking = false
      if (!this.shown) {
        this.shown = true
        video.classList.add('is-ready')
        poster?.classList.add('is-hidden')
      }
    })
  }

  load(onProgress) {
    if (this.loading) return this.loading
    this.loading = (async () => {
      const res = await fetch(this.src)
      if (!res.ok) throw new Error(`${res.status} ${this.src}`)
      const total = Number(res.headers.get('content-length')) || this.meta.bytes?.[this.kind] || 0
      let blob
      if (res.body && total && onProgress) {
        const reader = res.body.getReader()
        const chunks = []
        let got = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          got += value.length
          onProgress(Math.min(1, got / total))
        }
        blob = new Blob(chunks, { type: 'video/mp4' })
      } else blob = await res.blob()
      this.video.src = URL.createObjectURL(blob)
      await new Promise((ok, fail) => {
        this.video.addEventListener('loadeddata', ok, { once: true })
        this.video.addEventListener('error', () => fail(this.video.error), { once: true })
        this.video.load()
      })
      // alguns navegadores (iOS) só pintam quadros depois de um play()
      try {
        await this.video.play()
        this.video.pause()
      } catch {
        /* sem autoplay: a busca abaixo ainda mostra o quadro */
      }
      this.ready = true
      this.seek(true)
    })()
    return this.loading
  }

  // t em segundos; p em [0, 1] via setProgress
  setTime(t) {
    this.target = Math.min(this.duration - FRAME, Math.max(0, t))
  }
  setProgress(p) {
    this.setTime(p * this.duration)
  }

  seek(force) {
    if (!this.ready || this.seeking) return
    const v = this.video
    if (!force && Math.abs(v.currentTime - this.target) < FRAME * 0.6) return
    this.seeking = true
    v.currentTime = this.target
  }

  // por quadro, só para clipes visíveis
  update() {
    this.seek(false)
  }
}

// Fila de carregamento: no máximo dois downloads simultâneos, na ordem da página.
export class Loader {
  constructor(max = 2) {
    this.max = max
    this.queue = []
    this.active = 0
  }
  add(clip, onProgress, front = false) {
    return new Promise((ok) => {
      const job = { clip, onProgress, ok }
      front ? this.queue.unshift(job) : this.queue.push(job)
      this.next()
    })
  }
  next() {
    while (this.active < this.max && this.queue.length) {
      const job = this.queue.shift()
      this.active++
      job.clip
        .load(job.onProgress)
        .catch((err) => console.warn('vídeo indisponível, mantendo o quadro fixo:', job.clip.id, err?.message || err))
        .finally(() => {
          this.active--
          job.ok(job.clip)
          this.next()
        })
    }
  }
  // traz para a frente um clipe que ficou atrás na fila
  bump(clip) {
    const i = this.queue.findIndex((j) => j.clip === clip)
    if (i > 0) this.queue.unshift(...this.queue.splice(i, 1))
  }
}
