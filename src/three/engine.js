import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

// Correção de cor final (depois do tone mapping): contraste suave, cor quente
// nas altas luzes, sombras levemente frias, vinheta e um grão quase invisível.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uGrain: { value: 0.022 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uGrain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // curva em S suave
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.28);
      // split toning
      c += mix(vec3(-0.006, 0.0, 0.014), vec3(0.018, 0.006, -0.012), smoothstep(0.15, 0.75, l));
      // saturação
      c = mix(vec3(l), c, 1.08);
      // vinheta
      vec2 q = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.15, 1.0)));
      c += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
}

// Perfil de qualidade conforme o aparelho (o celular recebe a mesma cena, mais leve).
export function detectQuality() {
  const coarse = matchMedia('(pointer: coarse)').matches
  const small = Math.min(innerWidth, innerHeight) < 700
  const mem = navigator.deviceMemory || 8
  const params = new URLSearchParams(location.search)
  const forced = params.get('q')
  let tier = coarse || small ? 'medium' : 'high'
  if (mem <= 3) tier = 'low'
  if (forced) tier = forced
  const dprOverride = Number(params.get('dpr')) || 0
  const T = {
    high: { tier, dpr: 1.5, samples: 4, shadow: 4096, terrainSeg: 220, cards: 150, forest: 700, bloom: 1, lights: true },
    medium: { tier, dpr: 1.5, samples: 2, shadow: 2048, terrainSeg: 130, cards: 90, forest: 320, bloom: 0.5, lights: true },
    low: { tier, dpr: 1, samples: 0, shadow: 1024, terrainSeg: 90, cards: 60, forest: 160, bloom: 0, lights: false },
  }
  const q = { ...(T[tier] || T.high) }
  if (dprOverride) q.dpr = dprOverride
  return q
}

// Passo de cena com "varredura": durante a abertura renderiza dois estados
// (casa pronta e blueprint) e os mistura por uma linha de luz que atravessa a tela.
class StagePass extends Pass {
  constructor(renderer, scene, camera, director, samples) {
    super()
    this.scene = scene
    this.camera = camera
    this.director = director
    this.needsSwap = false
    const s = renderer.getDrawingBufferSize(new THREE.Vector2())
    this.rtB = new THREE.WebGLRenderTarget(s.x, s.y, { type: THREE.HalfFloatType, samples })
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { tA: { value: null }, tB: { value: null }, uWipe: { value: 0 }, uAspect: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform sampler2D tA; uniform sampler2D tB; uniform float uWipe; uniform float uAspect;
          varying vec2 vUv;
          void main() {
            vec4 a = texture2D(tA, vUv);
            vec4 b = texture2D(tB, vUv);
            float edge = mix(-0.25, 1.25, uWipe);
            float x = vUv.x + (vUv.y - 0.5) * 0.22;
            float d = x - edge;
            float m = smoothstep(-0.004, 0.004, d);
            vec4 c = mix(b, a, m);
            // feixe de varredura: núcleo nítido e halo largo
            float glow = exp(-abs(d) * 260.0) * 1.1 + exp(-abs(d) * 30.0) * 0.12;
            c.rgb += vec3(0.55, 0.8, 1.0) * glow * smoothstep(0.0, 0.05, uWipe) * (1.0 - smoothstep(0.95, 1.0, uWipe));
            gl_FragColor = c;
          }`,
        depthTest: false,
        depthWrite: false,
      }),
    )
  }

  setSize(w, h) {
    this.rtB.setSize(w, h)
  }

  render(renderer, writeBuffer, readBuffer) {
    const d = this.director
    const wipe = d.wipe
    if (wipe <= 0 || wipe >= 1) {
      d.apply(wipe >= 1 ? d.stateB : d.stateA)
      renderer.setRenderTarget(readBuffer)
      renderer.clear()
      renderer.render(this.scene, this.camera)
      this.needsSwap = false
      return
    }
    d.apply(d.stateA)
    renderer.setRenderTarget(readBuffer)
    renderer.clear()
    renderer.render(this.scene, this.camera)
    d.apply(d.stateB)
    renderer.setRenderTarget(this.rtB)
    renderer.clear()
    renderer.render(this.scene, this.camera)
    const u = this.quad.material.uniforms
    u.tA.value = readBuffer.texture
    u.tB.value = this.rtB.texture
    u.uWipe.value = wipe
    renderer.setRenderTarget(writeBuffer)
    this.quad.render(renderer)
    this.needsSwap = true
  }
}

export function createEngine(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.dpr))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 2000)

  return {
    renderer,
    scene,
    camera,
    composer: null,
    bloom: null,
    stage: null,
    init(director) {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2())
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality.samples })
      const composer = new EffectComposer(renderer, rt)
      this.stage = new StagePass(renderer, scene, camera, director, quality.samples)
      composer.addPass(this.stage)
      if (quality.bloom) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * quality.bloom * 0.5, size.y * quality.bloom * 0.5), 0.3, 0.6, 1.25)
        composer.addPass(this.bloom)
      }
      composer.addPass(new OutputPass())
      this.grade = new ShaderPass(GradeShader)
      composer.addPass(this.grade)
      this.composer = composer
      this.resize()
    },
    resize() {
      const w = canvas.clientWidth || innerWidth
      const h = canvas.clientHeight || innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (this.composer) {
        this.composer.setPixelRatio(renderer.getPixelRatio())
        this.composer.setSize(w, h)
      }
    },
    render() {
      if (this.grade) this.grade.uniforms.uTime.value = (performance.now() % 10000) / 1000
      this.composer.render()
    },
  }
}
