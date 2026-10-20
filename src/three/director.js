import * as THREE from 'three'
import { range, lerp, easeInOutCubic, smooth } from './util.js'
import { U } from './materials.js'

// ---------------- luz: estados da "jornada de um dia de obra" ----------------
const C = (hex) => new THREE.Color(hex)
export const LIGHTS = {
  night: { exposure: 1.0, sky: 0.25, night: 1, tint: [0.6, 0.7, 1.0], env: 0.03, sun: 0, sunColor: C(0x9fb8ff), az: 28, el: 35, hemi: 0.03, fog: C(0x070c16), fogD: 0.004, bloom: 0.55, interior: 0, pool: 0, lines: 1 },
  dawn: { exposure: 1.1, sky: 0.8, night: 0.25, tint: [0.9, 0.87, 1.0], env: 0.5, sun: 3.4, sunColor: C(0xffc9a8), az: -55, el: 12, hemi: 0.15, fog: C(0x8b90a0), fogD: 0.0028, bloom: 0.3, interior: 0, pool: 0, lines: 0.32 },
  day: { exposure: 0.95, sky: 1.0, night: 0, tint: [0.95, 0.98, 1.04], env: 0.65, sun: 4.8, sunColor: C(0xfff3e3), az: -35, el: 46, hemi: 0.3, fog: C(0xb7c3cc), fogD: 0.0022, bloom: 0.18, interior: 0, pool: 0, lines: 0.18 },
  afternoon: { exposure: 0.95, sky: 1.0, night: 0, tint: [1.0, 0.98, 0.95], env: 0.6, sun: 5.2, sunColor: C(0xffe3c2), az: -5, el: 26, hemi: 0.25, fog: C(0xc8c5c0), fogD: 0.0022, bloom: 0.2, interior: 0, pool: 0, lines: 0.16 },
  golden: { exposure: 0.95, sky: 1.0, night: 0, tint: [1.06, 0.97, 0.9], env: 0.5, sun: 6.0, sunColor: C(0xffad6e), az: 28, el: 13, hemi: 0.1, fog: C(0xcfae92), fogD: 0.0021, bloom: 0.22, interior: 0.12, pool: 0.0, lines: 0.2 },
  dusk: { exposure: 1.05, sky: 0.42, night: 0.42, tint: [0.78, 0.74, 0.98], env: 0.2, sun: 0.35, sunColor: C(0xff7a4a), az: 28, el: 1.5, hemi: 0.07, fog: C(0x31344a), fogD: 0.0024, bloom: 0.6, interior: 1, pool: 1, lines: 0 },
}

function mixLight(a, b, t) {
  const o = {}
  for (const k in a) {
    const va = a[k]
    const vb = b[k]
    if (va instanceof THREE.Color) o[k] = va.clone().lerp(vb, t)
    else if (Array.isArray(va)) o[k] = va.map((v, i) => lerp(v, vb[i], t))
    else o[k] = lerp(va, vb, t)
  }
  return o
}

// Luz ao longo da obra (P de 0 a 1).
export function buildLight(P) {
  const L = LIGHTS
  if (P < 0.13) return L.night
  if (P < 0.3) return mixLight(L.night, L.dawn, smooth(range(P, 0.13, 0.3)))
  if (P < 0.5) return mixLight(L.dawn, L.day, smooth(range(P, 0.3, 0.5)))
  if (P < 0.75) return mixLight(L.day, L.afternoon, smooth(range(P, 0.5, 0.75)))
  return mixLight(L.afternoon, L.golden, smooth(range(P, 0.75, 1)))
}

// ---------------- câmeras ----------------
const V = (x, y, z) => new THREE.Vector3(x, y, z)
export const SHOTS = {
  hero: { pos: V(-13, 2.1, 40), target: V(4, 4.2, 2), fov: 30, fit: 0.9 },
  construct: { pos: V(28, 10.5, 35), target: V(2.5, 2.4, 0.5), fov: 33, fit: 1 },
  residencia: { pos: V(-8, 1.6, 30), target: V(3, 3.7, 2), fov: 32, fit: 0.6 },
  piscina: { pos: V(18.2, 1.05, 17.2), target: V(2.5, 1.9, 7.5), fov: 38, fit: 0.5 },
  sala: { pos: V(11.3, 1.5, -4.7), target: V(3.5, 1.15, 10), fov: 52, fit: 0.3 },
  balanco: { pos: V(22, 1.35, 9.8), target: V(13.8, 4.7, 0.4), fov: 42, fit: 0.4 },
  noite: { pos: V(-5, 3.2, 34), target: V(3, 3.6, 1), fov: 33, fit: 0.9 },
}
export const SCENE_ORDER = ['residencia', 'piscina', 'sala', 'balanco', 'noite']

function lerpShot(a, b, t) {
  return { pos: a.pos.clone().lerp(b.pos, t), target: a.target.clone().lerp(b.target, t), fov: lerp(a.fov, b.fov, t), fit: lerp(a.fit, b.fit, t) }
}

export class Director {
  constructor({ engine, builder, vegetation, sky, sun, hemi, lines, interiorLights, envRotation }) {
    Object.assign(this, { engine, builder, vegetation, sky, sun, hemi, lines, interiorLights, envRotation })
    this.scene = engine.scene
    this.camera = engine.camera
    this.wipe = 0
    this.stateA = null
    this.stateB = null
    this.lastP = -1
    this.reduced = false
    this.time = 0
    this.view = { hero: 0, obra: 0, casa: 0 }
    this.sunTarget = new THREE.Vector3(2.5, 0, 0)
  }

  // progresso de cada seção (0 a 1), calculado pela página
  update(view, dt) {
    this.time += dt
    U.uTime.value = this.time
    this.view = view
    if (this.frozen) {
      this.wipe = 0
      this.stateA = this.frozen
      this.P = this.frozen.P
      this.light = this.frozen.light
      return
    }
    const { hero, obra, casa } = view
    const drift = this.reduced ? 0 : 1

    const constructShot = (P) => {
      const cs = SHOTS.construct
      const rel = cs.pos.clone().sub(cs.target)
      rel.applyAxisAngle(V(0, 1, 0), (P - 0.5) * 0.12 * drift).multiplyScalar(1.08 - P * 0.08)
      return { ...cs, pos: cs.target.clone().add(rel) }
    }

    if (casa > 0) {
      // ---- apresentação: voo de câmera entre as cenas
      const intro = 0.1
      let shot
      let light = LIGHTS.golden
      if (casa < intro) {
        shot = lerpShot(constructShot(1), SHOTS.residencia, easeInOutCubic(range(casa, 0, intro)))
      } else {
        const n = SCENE_ORDER.length
        const u = Math.min(n - 0.0001, range(casa, intro, 1) * n)
        const i = Math.floor(u)
        const f = u - i
        const hold = 0.52
        const a = SHOTS[SCENE_ORDER[i]]
        const b = SHOTS[SCENE_ORDER[Math.min(n - 1, i + 1)]]
        let t = i === n - 1 ? 0 : easeInOutCubic(range(f, hold, 1))
        if (this.reduced) t = t > 0.5 ? 1 : 0
        shot = lerpShot(a, b, t)
        const push = (i === n - 1 ? f : range(f, 0, hold)) * 0.06 * drift
        shot.pos.lerp(shot.target, push)
        const dusk = i === n - 1 ? 1 : i === n - 2 ? smooth(range(f, hold, 1)) : 0
        light = mixLight(LIGHTS.golden, LIGHTS.dusk, dusk)
      }
      this.wipe = 0
      this.stateA = { P: 1, shot, light }
    } else if (obra > 0) {
      // ---- obra: P acompanha a rolagem
      const P = range(obra, 0.03, 0.97)
      this.wipe = 0
      this.stateA = { P, shot: constructShot(P), light: buildLight(P) }
    } else {
      // ---- abertura: casa pronta → varredura revela o blueprint
      const heroShot = {
        ...SHOTS.hero,
        pos: SHOTS.hero.pos.clone().add(V(Math.sin(this.time * 0.08) * 1.2 * drift + hero * 3, Math.sin(this.time * 0.11) * 0.25 * drift, -hero * 4)),
      }
      let wipe = range(hero, 0.28, 0.92)
      if (this.reduced) wipe = wipe > 0.5 ? 1 : 0
      const shot = lerpShot(heroShot, constructShot(0), easeInOutCubic(wipe))
      this.wipe = wipe
      this.stateA = { P: 1, shot, light: LIGHTS.golden }
      this.stateB = { P: 0, shot, light: LIGHTS.night }
    }
    const cur = this.wipe >= 1 ? this.stateB : this.stateA
    this.P = cur.P
    this.light = cur.light
  }

  apply(s) {
    // obra
    if (s.P !== this.lastP) {
      this.builder.update(s.P)
      this.vegetation.update(s.P)
      this.lastP = s.P
    }
    // câmera (com enquadramento adaptado à proporção da tela)
    const cam = this.camera
    const ref = 16 / 9
    const k = Math.max(1, ref / cam.aspect)
    const fitPush = Math.pow(k, 0.78 * s.shot.fit)
    const fovK = Math.min(1.45, Math.pow(k, 0.5 * (1 - s.shot.fit)))
    const dir = s.shot.pos.clone().sub(s.shot.target)
    cam.position.copy(s.shot.target).add(dir.multiplyScalar(fitPush))
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(s.shot.fov) / 2) * fovK))
    if (Math.abs(cam.fov - fov) > 0.001) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    cam.lookAt(s.shot.target)

    // luz
    const L = s.light
    const r = this.engine.renderer
    r.toneMappingExposure = L.exposure
    const az = THREE.MathUtils.degToRad(L.az)
    const el = THREE.MathUtils.degToRad(L.el)
    const sd = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    this.sun.position.copy(this.sunTarget).addScaledVector(sd, 80)
    this.sun.intensity = L.sun
    this.sun.color.copy(L.sunColor)
    this.hemi.intensity = L.hemi
    this.scene.environmentIntensity = L.env
    const su = this.sky.material.uniforms
    su.uExposure.value = L.sky
    su.uTint.value.setRGB(L.tint[0], L.tint[1], L.tint[2])
    su.uNight.value = L.night
    su.uHorizon.value.copy(L.fog)
    this.scene.fog.color.copy(L.fog)
    this.scene.fog.density = L.fogD
    U.uInterior.value = L.interior
    U.uPoolGlow.value = L.pool
    for (const pl of this.interiorLights) pl.intensity = pl.userData.base * L.interior
    if (this.engine.bloom) this.engine.bloom.strength = L.bloom * (cam.aspect < 1 ? 0.5 : 1)

    // linhas do blueprint
    const lu = this.lines.material.uniforms
    lu.uP.value = s.P
    lu.uDraw.value = 1
    lu.uAlpha.value = L.lines
    lu.uTime.value = this.time
    this.lines.visible = L.lines > 0.01 && s.P < 0.999
  }
}
