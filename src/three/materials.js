import * as THREE from 'three'
import { rng } from './util.js'

// Uniforms compartilhados por toda a cena (atualizados pelo diretor a cada quadro).
export const U = {
  uTime: { value: 0 },
  uGlass: { value: 0 }, // 0 = sem vidro, 1 = vidro instalado
  uPoolDug: { value: 0 }, // 1 = terreno recortado na escavação da piscina
  uLawn: { value: 0 }, // raio (m) da grama crescendo a partir da casa
  uPoolGlow: { value: 0 },
  uInterior: { value: 0 }, // luzes internas (0 a 1)
  uWind: { value: 1 },
}

export function createMaterials(manager, base) {
  const loader = new THREE.TextureLoader(manager)
  const tex = (name, srgb = false) => {
    const t = loader.load(`${base}assets/tex/${name}.webp`)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const pbr = (id, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({
      map: tex(`${id}_diff`, true),
      normalMap: tex(`${id}_nor`),
      roughnessMap: tex(`${id}_arm`),
      metalness: 0,
      roughness: 1,
      ...opts,
    })
    return m
  }

  const M = {}
  M.concreteBoard = pbr('concrete_board', { color: 0xd8d4cc, normalScale: new THREE.Vector2(0.9, 0.9) })
  M.concrete = pbr('concrete_smooth', { color: 0xcfcac2 })
  M.plaster = pbr('plaster', { color: 0xf3efe8, normalScale: new THREE.Vector2(0.35, 0.35) })
  M.interiorWhite = new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: 0.92 })
  M.oak = pbr('oak', { color: 0xb59a82, normalScale: new THREE.Vector2(0.4, 0.4) })
  M.walnut = pbr('walnut', { color: 0x8a6448 })
  M.stone = pbr('stone', { color: 0xfff6e8, normalScale: new THREE.Vector2(0.5, 0.5) })
  M.stoneFloor = pbr('stone', { color: 0xd9d0c2, roughness: 0.75, normalScale: new THREE.Vector2(0.25, 0.25) })
  M.dirt = pbr('dirt', { color: 0xa88d72 })
  M.dirtPit = pbr('dirt', { color: 0x8a7058, side: THREE.BackSide })
  M.blocks = new THREE.MeshStandardMaterial({ map: blocksTexture(), roughness: 0.95, color: 0xffffff })
  M.frame = new THREE.MeshStandardMaterial({ color: 0x2c2723, metalness: 0.55, roughness: 0.42 })
  M.steel = new THREE.MeshStandardMaterial({ color: 0x3b3936, metalness: 0.7, roughness: 0.5 })
  M.rebar = new THREE.MeshStandardMaterial({ color: 0x5a3a28, metalness: 0.4, roughness: 0.7 })
  M.shoring = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.85 })
  M.marble = new THREE.MeshStandardMaterial({ map: marbleTexture(), color: 0xe9e5df, roughness: 0.2, metalness: 0 })
  M.fabric = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.95 })
  M.fabricDark = new THREE.MeshStandardMaterial({ color: 0x6f665c, roughness: 0.95 })
  M.linen = new THREE.MeshStandardMaterial({ color: 0xd9d0c2, roughness: 0.95 })
  M.rug = new THREE.MeshStandardMaterial({ color: 0xbfb19c, roughness: 1 })
  M.black = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.5, metalness: 0.3 })
  M.brass = new THREE.MeshStandardMaterial({ color: 0xc19a5b, roughness: 0.35, metalness: 0.9 })

  // Luminárias: emissivas, acendem com uInterior.
  M.lamp = new THREE.MeshStandardMaterial({ color: 0xfff1dc, emissive: 0xffc98a, emissiveIntensity: 0, roughness: 0.6 })
  M.lamp.onBeforeCompile = (s) => {
    s.uniforms.uInterior = U.uInterior
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uInterior;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = emissive * (0.04 + uInterior * uInterior * 3.2);')
  }

  M.glass = glassMaterial()
  M.water = waterMaterial()
  M.terrain = terrainMaterial(pbrMaps('grass'), pbrMaps('dirt'))
  M.leaves = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 })
  windify(M.leaves, 0.12)
  M.palm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 })
  windify(M.palm, 0.08)
  M.trunk = new THREE.MeshStandardMaterial({ color: 0x8c8075, roughness: 0.95 })
  M.bark = new THREE.MeshStandardMaterial({ color: 0x4e4036, roughness: 1 })
  M.hedge = new THREE.MeshStandardMaterial({ map: leafTexture(0x2f4a24), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 })

  function pbrMaps(id) {
    return { map: tex(`${id}_diff`, true), normalMap: tex(`${id}_nor`), roughnessMap: tex(`${id}_arm`) }
  }
  return M
}

// Vidro barato e convincente: transparente de frente, refletivo em ângulo (Fresnel).
function glassMaterial() {
  const m = new THREE.MeshStandardMaterial({
    color: 0x8fa3a6,
    metalness: 0.0,
    roughness: 0.04,
    transparent: true,
    opacity: 0.16,
    envMapIntensity: 2.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (s) => {
    s.uniforms.uGlass = U.uGlass
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlass;')
      .replace(
        '#include <opaque_fragment>',
        `float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 4.0);
        diffuseColor.a = mix(diffuseColor.a, 0.92, fres);
        #include <opaque_fragment>
        gl_FragColor.a *= uGlass;`,
      )
  }
  return m
}

function waterMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x2b7f8c, roughness: 0.04, metalness: 0.05, envMapIntensity: 1.5 })
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.uTime
    s.uniforms.uPoolGlow = U.uPoolGlow
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uPoolGlow;\nvarying vec3 vWPos;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 p = vWPos.xz;
          float t = uTime;
          vec2 g = vec2(
            cos(p.x * 1.7 + t * 0.9) * 0.6 + cos(p.x * 3.1 - p.y * 1.3 + t * 1.4) * 0.3 + cos(dot(p, vec2(5.3, 4.1)) + t * 2.1) * 0.12,
            cos(p.y * 1.9 - t * 0.8) * 0.6 + cos(p.y * 2.7 + p.x * 1.1 + t * 1.2) * 0.3 + cos(dot(p, vec2(-4.7, 5.9)) + t * 1.9) * 0.12
          ) * 0.045;
          vec3 wn = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float caust = 0.5 + 0.5 * sin(vWPos.x * 2.3 + uTime * 1.3) * sin(vWPos.z * 2.9 - uTime);
        totalEmissiveRadiance += vec3(0.05, 0.55, 0.65) * uPoolGlow * (1.1 + caust * 0.5);`,
      )
  }
  return m
}

// Terreno: grama no entorno; dentro do lote é terra até o paisagismo, que
// cresce em círculo a partir da casa (uLawn). Recorte da piscina por uPoolDug.
function terrainMaterial(grass, dirt) {
  const m = new THREE.MeshStandardMaterial({ ...grass, color: 0x9bb06c, roughness: 1, metalness: 0 })
  m.onBeforeCompile = (s) => {
    s.uniforms.uLawn = U.uLawn
    s.uniforms.uPoolDug = U.uPoolDug
    s.uniforms.dirtMap = { value: dirt.map }
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uLawn; uniform float uPoolDug; uniform sampler2D dirtMap; varying vec3 vWPos;
        float boxMask(vec2 p, vec4 r, float soft) {
          vec2 a = smoothstep(r.xy - soft, r.xy + soft, p);
          vec2 b = 1.0 - smoothstep(r.zw - soft, r.zw + soft, p);
          return a.x * a.y * b.x * b.y;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        if (uPoolDug > 0.5 && vWPos.x > -1.3 && vWPos.x < 15.3 && vWPos.z > 8.3 && vWPos.z < 12.7) discard;
        float lot = boxMask(vWPos.xz, vec4(-24.0, -14.0, 30.0, 24.0), 1.5);
        float r = length((vWPos.xz - vec2(2.5, 2.0)) * vec2(0.8, 1.0));
        float lawn = 1.0 - smoothstep(uLawn - 3.0, uLawn, r);
        float dirtAmt = lot * (1.0 - lawn);
        vec4 dcol = texture2D(dirtMap, vMapUv * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, dcol.rgb * vec3(1.05, 0.95, 0.85), dirtAmt);
        // variação de tom na grama (evita repetição visível)
        float v = sin(vWPos.x * 0.11) * sin(vWPos.z * 0.13) + sin(vWPos.x * 0.031 + vWPos.z * 0.027);
        diffuseColor.rgb *= mix(1.0, 0.88 + 0.12 * v, 1.0 - dirtAmt);`,
      )
  }
  return m
}

// Vento leve em folhas e palmeiras (vértices mais altos balançam mais).
export function windify(mat, amp) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.uTime
    s.uniforms.uWind = U.uWind
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp0 = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          #endif
          float h = max(transformed.y, 0.0);
          float sway = sin(uTime * 1.3 + wp0.x * 0.35 + wp0.z * 0.2) * 0.6 + sin(uTime * 2.7 + wp0.x) * 0.25;
          transformed.x += sway * ${amp.toFixed(3)} * h * 0.15 * uWind;
          transformed.z += cos(uTime * 1.1 + wp0.z * 0.3) * ${amp.toFixed(3)} * h * 0.08 * uWind;
        }`,
      )
  }
}

// ---------- texturas procedurais (canvas) ----------

function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// Blocos de concreto (39 x 19 cm) da alvenaria crua; 1 repetição = 2 m.
function blocksTexture() {
  return canvasTex(512, (g, S) => {
    const r = rng(7)
    g.fillStyle = '#8f8a84'
    g.fillRect(0, 0, S, S)
    const bw = S / 5.13
    const bh = S / 10.5
    for (let row = 0; row * bh < S + bh; row++) {
      const off = row % 2 ? bw / 2 : 0
      for (let x = -bw; x < S + bw; x += bw) {
        const l = 120 + r() * 26
        g.fillStyle = `rgb(${l},${l - 3},${l - 8})`
        g.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4)
      }
    }
  })
}

function marbleTexture() {
  return canvasTex(1024, (g, S) => {
    const r = rng(11)
    g.fillStyle = '#f2efea'
    g.fillRect(0, 0, S, S)
    for (let i = 0; i < 46; i++) {
      g.beginPath()
      let x = r() * S
      let y = 0
      g.moveTo(x, y)
      const drift = (r() - 0.5) * 2.2
      while (y < S) {
        y += 8 + r() * 10
        x += drift * 6 + (r() - 0.5) * 14
        g.lineTo(x, y)
      }
      const a = 0.18 + r() * 0.45
      g.strokeStyle = `rgba(${110 + r() * 40},${105 + r() * 35},${100 + r() * 30},${a})`
      g.lineWidth = 0.8 + r() * (i % 4 === 0 ? 6 : 2)
      g.stroke()
    }
  })
}

// Aglomerado de folhas com transparência para copas e cercas vivas.
function leafTexture(tint = 0x3d5a2a) {
  const base = new THREE.Color(tint)
  return canvasTex(512, (g, S) => {
    const r = rng(tint & 0xffff)
    g.clearRect(0, 0, S, S)
    for (let i = 0; i < 2200; i++) {
      const under = i < 700
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * S * (under ? 0.4 : 0.47)
      const x = S / 2 + Math.cos(a) * d
      const y = S / 2 + Math.sin(a) * d
      const c = base.clone().offsetHSL((r() - 0.5) * 0.06, (r() - 0.5) * 0.18, under ? -0.12 : (r() - 0.4) * 0.2)
      g.fillStyle = `#${c.getHexString()}`
      g.save()
      g.translate(x, y)
      g.rotate(r() * Math.PI * 2)
      g.beginPath()
      g.ellipse(0, 0, 5 + r() * 6, 2.2 + r() * 2.2, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
  })
}
