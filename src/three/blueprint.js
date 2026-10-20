import * as THREE from 'three'

// Linhas do "blueprint": cada segmento sabe a janela de obra do elemento que
// representa (aWin). Enquanto o elemento não existe, a linha brilha; quando ele
// é construído, a linha some. O traço surge na ordem aSeq (uDraw).
export class LineCollector {
  constructor() {
    this.pos = []
    this.win = []
    this.kind = [] // 0 = arquitetura, 1 = planta no chão, 2 = cota
  }

  seg(a, b, win, kind = 0) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2])
    this.win.push(win[0], win[1], win[0], win[1])
    this.kind.push(kind, kind)
  }

  box(b, win, kind = 0) {
    const { x0, x1, y0, y1, z0, z1 } = b
    const c = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ]
    const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    for (const [i, j] of e) this.seg(c[i], c[j], win, kind)
  }

  rect(x0, z0, x1, z1, y, win, kind = 1) {
    this.seg([x0, y, z0], [x1, y, z0], win, kind)
    this.seg([x1, y, z0], [x1, y, z1], win, kind)
    this.seg([x1, y, z1], [x0, y, z1], win, kind)
    this.seg([x0, y, z1], [x0, y, z0], win, kind)
  }

  // Linha de cota com marcas nas pontas.
  dim(a, b, win, tick = 0.5) {
    this.seg(a, b, win, 2)
    const dx = b[0] - a[0]
    const dz = b[2] - a[2]
    const L = Math.hypot(dx, dz) || 1
    const nx = (-dz / L) * tick
    const nz = (dx / L) * tick
    for (const p of [a, b]) this.seg([p[0] - nx, p[1], p[2] - nz], [p[0] + nx, p[1], p[2] + nz], win, 2)
  }

  build() {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(this.pos)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aWin', new THREE.BufferAttribute(new Float32Array(this.win), 2))
    g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(this.kind), 1))
    // ordem do traço: planta primeiro, depois da esquerda para a direita, de baixo para cima
    const n = pos.length / 6
    const seq = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      const mx = (pos[i * 6] + pos[i * 6 + 3]) / 2
      const my = (pos[i * 6 + 1] + pos[i * 6 + 4]) / 2
      const k = this.kind[i * 2]
      const s = k === 1 ? 0.02 + ((mx + 22) / 44) * 0.3 : k === 2 ? 0.55 + ((mx + 22) / 44) * 0.2 : 0.25 + ((mx + 13) / 31) * 0.5 + (my / 7.2) * 0.22
      seq[i * 2] = seq[i * 2 + 1] = Math.min(0.97, s)
    }
    g.setAttribute('aSeq', new THREE.BufferAttribute(seq, 1))

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uP: { value: 0 },
        uDraw: { value: 0 },
        uAlpha: { value: 1 },
        uColor: { value: new THREE.Color(0.32, 0.55, 0.85) },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uP; uniform float uDraw; uniform float uTime;
        attribute vec2 aWin; attribute float aSeq; attribute float aKind;
        varying float vA; varying float vHot;
        void main() {
          float drawn = smoothstep(aSeq, aSeq + 0.05, uDraw);
          float built = 1.0 - smoothstep(aWin.x, aWin.y, uP);
          // destaque: a peça que está sendo construída agora brilha mais
          vHot = smoothstep(aWin.x - 0.04, aWin.x, uP) * built;
          vA = drawn * built * (aKind > 1.5 ? 0.55 : aKind > 0.5 ? 0.7 : 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uAlpha;
        varying float vA; varying float vHot;
        void main() {
          vec3 c = mix(uColor, vec3(1.0, 0.8, 0.5), vHot) * (1.0 + vHot * 1.6);
          gl_FragColor = vec4(c * vA * uAlpha, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const lines = new THREE.LineSegments(g, this.material)
    lines.frustumCulled = false
    lines.renderOrder = 10
    return lines
  }
}
