import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { rng, range, easeOutBack, smooth } from './util.js'
import { windify } from './materials.js'
import { T } from './house.js'

// ---------- terreno: platô do lote, vale à frente e morros ao fundo ----------
function noise2(x, z) {
  // value noise simples e determinístico
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const h = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return s - Math.floor(s)
  }
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix, iz), h(ix + 1, iz), ux), THREE.MathUtils.lerp(h(ix, iz + 1), h(ix + 1, iz + 1), ux), uz)
}
const fbm = (x, z) => noise2(x, z) * 0.55 + noise2(x * 2.1, z * 2.1) * 0.3 + noise2(x * 4.3, z * 4.3) * 0.15
const ss = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function heightAt(x, z) {
  let h = -0.25
  h -= 34 * ss(27, 95, z) // encosta descendo para o vale
  h += 95 * ss(170, 520, z) // morros do outro lado
  h += 9 * ss(32, 110, Math.abs(x)) * (1 - ss(40, 120, z)) // laterais sobem
  h += 10 * ss(-24, -110, z) // fundos sobem
  const far = ss(30, 90, Math.hypot(x, z - 2))
  h += (fbm(x * 0.012 + 3, z * 0.012) - 0.5) * 26 * far
  h += (fbm(x * 0.05, z * 0.05) - 0.5) * 3 * far
  return h
}

export function buildTerrain(M, quality) {
  const seg = quality.terrainSeg
  const g = new THREE.PlaneGeometry(1400, 1400, seg, seg)
  g.rotateX(-Math.PI / 2)
  g.translate(0, 0, 330)
  const p = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    p.setY(i, heightAt(x, z))
    uv.setXY(i, x / 3.2, z / 3.2)
  }
  g.computeVertexNormals()
  const mesh = new THREE.Mesh(g, M.terrain)
  mesh.receiveShadow = true
  return mesh
}

// Malha densa só no lote (sombras nítidas e recorte da piscina corretos).
export function buildLotGround(M) {
  const g = new THREE.PlaneGeometry(80, 70, 160, 140)
  g.rotateX(-Math.PI / 2)
  g.translate(0, 0, 4)
  const p = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, p.getX(i) / 3.2, p.getZ(i) / 3.2)
    p.setY(i, heightAt(p.getX(i), p.getZ(i)) + 0.004)
  }
  g.computeVertexNormals()
  const mesh = new THREE.Mesh(g, M.terrain)
  mesh.receiveShadow = true
  return mesh
}

// ---------- céu: domo com o panorama, tingido conforme a hora do dia ----------
export function buildSky(texture, sunU) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tSky: { value: texture },
      uOffset: { value: 0 },
      uExposure: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uNight: { value: 0 },
      uNightTop: { value: new THREE.Color(0x02040a) },
      uNightHorizon: { value: new THREE.Color(0x0b1626) },
      uHorizon: { value: new THREE.Color(0xb8c4cc) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSky; uniform float uOffset; uniform float uExposure; uniform vec3 uTint;
      uniform float uNight; uniform vec3 uNightTop; uniform vec3 uNightHorizon; uniform vec3 uHorizon;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float az = atan(d.x, d.z) / 6.28318530718;
        float el = asin(clamp(d.y, -1.0, 1.0));
        vec2 uv = vec2(fract(az + uOffset), 0.5 + el / 3.14159265);
        // abaixo do horizonte a imagem é água: repetimos a faixa do horizonte
        uv.y = max(uv.y, 0.505);
        vec3 c = texture2D(tSky, uv).rgb;
        c = c * uExposure * uTint;
        float hz = 1.0 - smoothstep(0.0, 0.16, el);
        c = mix(c, uHorizon, hz * 0.55);
        vec3 night = mix(uNightHorizon, uNightTop, smoothstep(-0.05, 0.6, el));
        c = mix(c, night, uNight);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: true,
    fog: false,
  })
  // o JPG é sRGB: o shader recebe linear pois a textura é marcada como sRGB
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  mesh.userData.sunU = sunU
  return mesh
}

// ---------- vegetação procedural ----------

// Copa feita de "cartões" de folhagem com normais esféricas (sombreamento macio).
function canopyGeometry(seed, { r = 2.4, h = 2.0, cards = 140, size = 1.5, y = 5, clumps = 1 }) {
  const R = rng(seed)
  const pos = []
  const nor = []
  const uvs = []
  const idx = []
  const c = new THREE.Vector3(0, y, 0)
  // copa irregular: vários tufos em volta do centro
  const centers = [c.clone()]
  for (let k = 1; k < clumps; k++) {
    const a = (k / clumps) * Math.PI * 2 + R() * 0.8
    centers.push(new THREE.Vector3(Math.cos(a) * r * (0.45 + R() * 0.3), y + (R() - 0.35) * h * 0.9, Math.sin(a) * r * (0.45 + R() * 0.3)))
  }
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  for (let i = 0; i < cards; i++) {
    // ponto dentro de um elipsoide achatado, mais denso na casca
    const th = R() * Math.PI * 2
    const ph = Math.acos(2 * R() - 1)
    const rr = Math.pow(R(), 0.35)
    const cc = centers[Math.floor(R() * centers.length)]
    const cr = clumps > 1 ? 0.62 : 1
    v.set(Math.sin(ph) * Math.cos(th) * r * rr * cr, Math.cos(ph) * h * rr * cr, Math.sin(ph) * Math.sin(th) * r * rr * cr).add(cc)
    n.copy(v).sub(cc).normalize().multiplyScalar(0.6).add(v.clone().sub(c).normalize().multiplyScalar(0.4))
    n.y += 0.3
    n.normalize()
    // orientação aleatória do cartão
    a.set(R() - 0.5, R() - 0.5, R() - 0.5).normalize()
    b.crossVectors(a, n).normalize()
    a.crossVectors(n, b).normalize()
    const s = size * (0.7 + R() * 0.6)
    const base = pos.length / 3
    for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(v.x + (a.x * u + b.x * w) * s * 0.5, v.y + (a.y * u + b.y * w) * s * 0.5, v.z + (a.z * u + b.z * w) * s * 0.5)
      nor.push(n.x, n.y, n.z)
      uvs.push((u + 1) / 2, (w + 1) / 2)
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  return g
}

function trunkGeometry(seed, height, radius) {
  const R = rng(seed)
  const pts = []
  for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3((R() - 0.5) * 0.25 * i * 0.3, (i / 6) * height, (R() - 0.5) * 0.25 * i * 0.3))
  const curve = new THREE.CatmullRomCurve3(pts)
  const g = new THREE.TubeGeometry(curve, 8, radius, 6, false)
  // afina para o topo
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / height
    const cp = curve.getPoint(Math.min(1, Math.max(0, t)))
    const k = 1 - t * 0.45
    p.setX(i, cp.x + (p.getX(i) - cp.x) * k)
    p.setZ(i, cp.z + (p.getZ(i) - cp.z) * k)
  }
  // galhos simples até a copa
  const parts = [g]
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + R()
    const start = new THREE.Vector3(0, height * (0.75 + R() * 0.1), 0)
    const end = start.clone().add(new THREE.Vector3(Math.cos(ang) * 1.4, 1.3 + R(), Math.sin(ang) * 1.4))
    const bg = new THREE.CylinderGeometry(radius * 0.25, radius * 0.45, start.distanceTo(end), 5)
    bg.translate(0, start.distanceTo(end) / 2, 0)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())
    bg.applyQuaternion(q)
    bg.translate(start.x, start.y, start.z)
    parts.push(bg.toNonIndexed())
  }
  return mergeGeometries(parts.map((x) => (x.index ? x.toNonIndexed() : x)))
}

// Jerivá: tronco anelado levemente curvo + coroa de folhas pinadas.
function palmGeometries(seed, height = 9) {
  const R = rng(seed)
  const lean = new THREE.Vector3((R() - 0.5) * 1.2, 0, (R() - 0.5) * 1.2)
  const pts = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    pts.push(new THREE.Vector3(lean.x * t * t, t * height, lean.z * t * t))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const trunk = new THREE.TubeGeometry(curve, 24, 0.17, 8, false)
  const p = trunk.attributes.position
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / height
    const cp = curve.getPoint(Math.min(1, Math.max(0, t)))
    const ring = 1 + Math.sin(t * height * 9) * 0.04
    const k = (1 - t * 0.25) * ring
    p.setX(i, cp.x + (p.getX(i) - cp.x) * k)
    p.setZ(i, cp.z + (p.getZ(i) - cp.z) * k)
  }
  trunk.computeVertexNormals()

  const top = curve.getPoint(1)
  const pos = []
  const nor = []
  const col = []
  const fronds = 17
  for (let f = 0; f < fronds; f++) {
    const az = (f / fronds) * Math.PI * 2 + R() * 0.3
    const up = 0.1 + R() * 0.85 // ângulo de saída
    const len = 2.8 + R() * 1.1
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az))
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
    const seg = 24
    const tone = new THREE.Color().setHSL(0.22 + R() * 0.05, 0.38 + R() * 0.18, 0.2 + R() * 0.1)
    if (up < 0.25) tone.offsetHSL(-0.06, -0.1, 0.06) // folhas baixas mais secas
    let prev = null
    for (let s = 0; s <= seg; s++) {
      const t = s / seg
      // ráquis curva: sobe e depois cai
      const x = t * len
      const y = Math.sin(up) * x - 0.55 * x * x * (0.35 + (1 - up) * 0.25)
      const pt = top.clone().add(dir.clone().multiplyScalar(x * Math.cos(up * 0.5))).add(new THREE.Vector3(0, y + 0.1, 0))
      if (prev && s > 1) {
        const leaf = (0.95 - Math.abs(t - 0.42)) * 0.85
        for (const sg of [-1, 1]) {
          const droop = 0.45 + R() * 0.35
          const tip = pt.clone().add(side.clone().multiplyScalar(sg * leaf * (0.85 + R() * 0.3))).add(new THREE.Vector3(0, -leaf * droop, 0)).add(dir.clone().multiplyScalar(0.22))
          pos.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z, tip.x, tip.y, tip.z)
          const n = new THREE.Vector3().subVectors(pt, prev).cross(new THREE.Vector3().subVectors(tip, prev)).normalize()
          if (n.y < 0) n.negate()
          n.y += 0.6
          n.normalize()
          for (let k = 0; k < 3; k++) nor.push(n.x, n.y, n.z)
          const lt = 0.85 + R() * 0.3
          col.push(tone.r * lt, tone.g * lt, tone.b * lt, tone.r * lt, tone.g * lt, tone.b * lt, tone.r * lt * 1.1, tone.g * lt * 1.1, tone.b * lt)
        }
      }
      prev = pt
    }
  }
  const crown = new THREE.BufferGeometry()
  crown.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  crown.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  crown.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return { trunk, crown }
}

// Plantas do lote (crescem no paisagismo) e floresta de fundo (sempre lá).
export function buildVegetation(M, quality) {
  const root = new THREE.Group()
  root.name = 'vegetation'
  const updates = []
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s3 = new THREE.Vector3()
  const p3 = new THREE.Vector3()
  const yAxis = new THREE.Vector3(0, 1, 0)

  const trunkMat = M.bark
  const palmTrunkMat = M.trunk.clone()
  windify(palmTrunkMat, 0.08)

  // árvores de copa no lote (fundos e laterais)
  const lotTrees = [
    [-17, -12, 1.1], [-9, -13, 1.25], [0, -15, 1.35], [8, -12.5, 1.15], [16, -14, 1.3], [24, -9, 1.2], [-24, -5, 1.15], [27, 3, 1.0], [-27, 8, 1.05], [21, -18, 1.1],
  ].map(([x, z, s], i) => ({ x, z, s, r: i * 1.7, order: Math.hypot(x - 2, z) }))
  const canopyGeo = canopyGeometry(5, { r: 3.4, h: 2.2, cards: quality.cards * 2, size: 1.25, y: 6.4, clumps: 6 })
  const tGeo = trunkGeometry(3, 6.2, 0.22)
  const canopies = new THREE.InstancedMesh(canopyGeo, M.leaves, lotTrees.length)
  const trunks = new THREE.InstancedMesh(tGeo, trunkMat, lotTrees.length)
  canopies.castShadow = trunks.castShadow = true
  root.add(canopies, trunks)

  // jerivás
  const palmSpots = [
    [-19, 12, 1.0], [-21.5, 16.5, 1.12], [-17.5, 20.5, 0.9], [-20, 3, 0.95], [-22.5, 7.5, 1.05], [27, 2.5, 1.05], [29, 7.5, 0.92], [25.5, -3.5, 1.12],
  ].map(([x, z, s], i) => ({ x, z, s, r: i * 2.3, order: Math.hypot(x - 2, z) }))
  const palm = palmGeometries(17, 9.5)
  const palmTrunks = new THREE.InstancedMesh(palm.trunk, palmTrunkMat, palmSpots.length)
  const palmCrowns = new THREE.InstancedMesh(palm.crown, M.palm, palmSpots.length)
  palmTrunks.castShadow = palmCrowns.castShadow = true
  root.add(palmTrunks, palmCrowns)

  // arbustos (bordas do lote, canteiro da laje e frente do bloco oeste)
  const shrubSpots = []
  const R = rng(99)
  for (let x = -23; x <= 29; x += 2.2) shrubSpots.push([x + R() * 0.6, -13 + R() * 0.8, 0.9 + R() * 0.5, -0.25])
  for (let z = -10; z <= 20; z += 2.4) {
    shrubSpots.push([-23 + R() * 0.6, z, 0.9 + R() * 0.4, -0.25])
    shrubSpots.push([29.2 + R() * 0.6, z, 0.9 + R() * 0.4, -0.25])
  }
  for (let z = -4.8; z <= 4.8; z += 1.3) shrubSpots.push([-10.6 + R() * 0.4, z, 0.55 + R() * 0.25, 3.85])
  for (let x = -14.6; x <= -12.4; x += 1.1) for (let z = 5; z <= 8; z += 1.2) shrubSpots.push([x, z, 0.6 + R() * 0.3, -0.25])
  const shrubGeo = canopyGeometry(9, { r: 1.0, h: 0.65, cards: 40, size: 0.7, y: 0.5, clumps: 3 })
  const shrubs = new THREE.InstancedMesh(shrubGeo, M.hedge, shrubSpots.length)
  shrubs.castShadow = true
  root.add(shrubs)

  let last = -1
  updates.push((P) => {
    const t = range(P, T.plants[0], T.plants[1])
    const vis = t > 0
    canopies.visible = trunks.visible = palmTrunks.visible = palmCrowns.visible = shrubs.visible = vis
    if (!vis || t === last) return
    last = t
    const grow = (o, maxOrder) => {
      const k = Math.min(1, Math.max(0, (t - (o / maxOrder) * 0.55) / 0.45))
      return Math.max(0.0001, easeOutBack(smooth(k)))
    }
    lotTrees.forEach((tr, i) => {
      const s = grow(tr.order, 32) * tr.s
      q.setFromAxisAngle(yAxis, tr.r)
      m4.compose(p3.set(tr.x, heightAt(tr.x, tr.z), tr.z), q, s3.set(s, s, s))
      canopies.setMatrixAt(i, m4)
      trunks.setMatrixAt(i, m4)
    })
    palmSpots.forEach((pl, i) => {
      const s = grow(pl.order, 32) * pl.s
      q.setFromAxisAngle(yAxis, pl.r)
      m4.compose(p3.set(pl.x, heightAt(pl.x, pl.z), pl.z), q, s3.set(s, s, s))
      palmTrunks.setMatrixAt(i, m4)
      palmCrowns.setMatrixAt(i, m4)
    })
    shrubSpots.forEach(([x, z, sc, y], i) => {
      const s = grow(Math.hypot(x - 2, z) * 0.6, 32) * sc
      q.setFromAxisAngle(yAxis, i * 0.7)
      m4.compose(p3.set(x, y, z), q, s3.set(s, s, s))
      shrubs.setMatrixAt(i, m4)
    })
    for (const im of [canopies, trunks, palmTrunks, palmCrowns, shrubs]) im.instanceMatrix.needsUpdate = true
  })

  // floresta de fundo: morros à frente e laterais
  const forestN = quality.forest
  const fGeo = canopyGeometry(21, { r: 3.4, h: 2.6, cards: 46, size: 2.6, y: 5, clumps: 4 })
  const forest = new THREE.InstancedMesh(fGeo, M.leaves, forestN)
  const FR = rng(1234)
  let placed = 0
  for (let tries = 0; placed < forestN && tries < forestN * 20; tries++) {
    const x = (FR() - 0.5) * 900
    const z = -120 + FR() * 700
    if (Math.hypot(x, z) < 75) continue
    if (z < 60 && Math.abs(x) < 45) continue
    const dens = fbm(x * 0.01, z * 0.01)
    if (dens < 0.45) continue
    const s = 0.8 + FR() * 0.8
    m4.compose(p3.set(x, heightAt(x, z) - 1, z), q.setFromAxisAngle(yAxis, FR() * 6), s3.set(s, s * (0.8 + FR() * 0.5), s))
    forest.setMatrixAt(placed++, m4)
  }
  forest.count = placed
  root.add(forest)

  return { root, update: (P) => updates.forEach((u) => u(P)) }
}
