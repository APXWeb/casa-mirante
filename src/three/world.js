import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { createEngine } from './engine.js'
import { createMaterials } from './materials.js'
import { buildHouse } from './house.js'
import { buildInterior } from './interior.js'
import { buildTerrain, buildLotGround, buildSky, buildVegetation } from './nature.js'
import { Director, LIGHTS } from './director.js'

const SUN_U = 0.605 // posição horizontal do sol no panorama (medida na imagem)

// Monta a cena completa. Resolve quando todos os assets carregaram.
export async function createWorld(canvas, quality, onProgress = () => {}) {
  const base = import.meta.env.BASE_URL
  const engine = createEngine(canvas, quality)
  const { scene, renderer } = engine
  const manager = new THREE.LoadingManager()
  manager.onProgress = (_u, loaded, total) => onProgress(loaded / total)

  const M = createMaterials(manager, base)

  // céu nítido (JPG) + iluminação (HDR)
  const skyTex = new THREE.TextureLoader(manager).load(`${base}assets/sky/${quality.tier === 'high' ? 'sky_4k' : 'sky_2k'}.jpg`)
  skyTex.colorSpace = THREE.SRGBColorSpace
  skyTex.anisotropy = 4
  const sky = buildSky(skyTex, SUN_U)
  sky.material.uniforms.uOffset.value = SUN_U - LIGHTS.golden.az / 360
  scene.add(sky)
  scene.fog = new THREE.FogExp2(0xd2b49a, 0.0021)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const hdrPromise = new HDRLoader(manager).loadAsync(`${base}assets/sky/sky_1k.hdr`).then((hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = pmrem.fromEquirectangular(hdr).texture
    hdr.dispose()
    // gira o ambiente para o sol do HDR coincidir com o sol da cena
    const az = THREE.MathUtils.degToRad(LIGHTS.golden.az)
    const sunDir = new THREE.Vector3(Math.sin(az), 0.05, Math.cos(az))
    let best = 0
    let bestErr = 9
    const m = new THREE.Matrix4()
    for (let i = 0; i < 720; i++) {
      const th = (i / 720) * Math.PI * 2
      const d = sunDir.clone().applyMatrix4(m.makeRotationY(-th))
      const u = Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5
      const err = Math.abs(u - SUN_U)
      if (err < bestErr) {
        bestErr = err
        best = th
      }
    }
    scene.environmentRotation.set(0, best, 0)
  })

  // modelos CC0 (Poly Haven)
  const gltf = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder)
  const names = { lounge: 'mid_century_lounge_chair', arm: 'modern_arm_chair_01', plant: 'potted_plant_02', succulent: 'potted_plant_04', vase: 'ceramic_vase_01' }
  const loaded = {}
  const modelPromise = Promise.all(
    Object.entries(names).map(([k, file]) =>
      gltf
        .loadAsync(`${base}assets/models/${file}.glb`)
        .then((g) => (loaded[k] = g.scene))
        .catch(() => null),
    ),
  )

  const sun = new THREE.DirectionalLight(0xffffff, 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(quality.shadow, quality.shadow)
  const sc = sun.shadow.camera
  sc.left = -34
  sc.right = 34
  sc.top = 30
  sc.bottom = -30
  sc.near = 20
  sc.far = 180
  sun.shadow.bias = -0.0003
  sun.shadow.normalBias = 0.035
  sun.shadow.radius = 2
  sun.target.position.set(2.5, 0, 0)
  scene.add(sun, sun.target)
  const hemi = new THREE.HemisphereLight(0xc4d4e4, 0x5b5145, 0.2)
  scene.add(hemi)

  // casa, terreno, vegetação
  const house = buildHouse(M)
  scene.add(house.root)
  const terrain = buildTerrain(M, quality)
  terrain.position.y = -0.06
  scene.add(terrain)
  scene.add(buildLotGround(M))
  const vegetation = buildVegetation(M, quality)
  scene.add(vegetation.root)

  // luzes internas (acendem ao entardecer)
  const interiorLights = []
  if (quality.lights) {
    const spots = [
      [8.2, 2.3, 0.0, 22], [1.0, 2.2, 1.4, 16], [1.0, 2.2, -2.6, 16], [-4.0, 2.2, -1.0, 9],
      [-6.2, 5.5, 2.0, 10], [-0.6, 5.5, 2.0, 10], [4.9, 5.5, 2.0, 10], [12.3, 5.5, 2.2, 13],
      [14.5, 2.6, 0.0, 14],
    ]
    for (const [x, y, z, b] of spots) {
      const l = new THREE.PointLight(0xffc68c, 0, 16, 2)
      l.position.set(x, y, z)
      l.userData.base = b
      scene.add(l)
      interiorLights.push(l)
    }
  }

  await Promise.all([hdrPromise, modelPromise])
  // fábricas de modelos com altura real
  const fit = (obj, h) => {
    const c = obj.clone(true)
    const box = new THREE.Box3().setFromObject(c)
    const s = h / (box.max.y - box.min.y || 1)
    c.scale.setScalar(s)
    c.position.y = -box.min.y * s
    const g = new THREE.Group()
    g.add(c)
    return g
  }
  const models = {}
  if (loaded.lounge) models.lounge = () => fit(loaded.lounge, 0.92)
  if (loaded.arm) models.arm = () => fit(loaded.arm, 0.8)
  if (loaded.plant) models.plant = (h = 1.4) => fit(loaded.plant, h)
  if (loaded.succulent) models.succulent = (h = 0.8) => fit(loaded.succulent, h)
  if (loaded.vase) models.vase = (h = 0.4) => fit(loaded.vase, h)
  buildInterior(house.builder, M, models)

  const lines = house.lines.build()
  scene.add(lines)

  const director = new Director({ engine, builder: house.builder, vegetation, sky, sun, hemi, lines, interiorLights })
  engine.init(director)
  await new Promise((r) => (manager.onLoad = r, setTimeout(r, 50)))

  // pré-compila shaders nos três estados de luz para evitar travadas na rolagem
  director.update({ hero: 0, obra: 0, casa: 0 }, 0)
  director.apply(director.stateA)
  await renderer.compileAsync(scene, engine.camera)
  return { engine, director, scene, M }
}
