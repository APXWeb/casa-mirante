// Baixa os assets CC0 do Poly Haven (polyhaven.com, licença CC0) e gera as
// versões otimizadas em public/. Rodar uma vez: `npm run assets`.
// Nada aqui é pago: HDRI, texturas e modelos são de domínio público (CC0).
import { mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.asset-cache')
const PUB = path.join(ROOT, 'public', 'assets')

const HDRI = 'kloppenheim_06_puresky'
// id local -> asset do Poly Haven (texturas PBR 1k)
const TEXTURES = {
  concrete_board: 'concrete_layers_02', // concreto aparente com marca de fôrma
  concrete_smooth: 'concrete_wall_008',
  plaster: 'painted_plaster_wall',
  oak: 'oak_veneer_01',
  walnut: 'natural_walnut_veneer',
  grass: 'leafy_grass',
  dirt: 'raked_dirt',
  stone: 'granular_concrete', // piso externo claro
}
const MODELS = ['mid_century_lounge_chair', 'modern_arm_chair_01', 'potted_plant_02', 'potted_plant_04', 'ceramic_vase_01']

const api = (p) => fetch(`https://api.polyhaven.com/${p}`).then((r) => r.json())

async function download(url, dest) {
  if (existsSync(dest)) return dest
  await mkdir(path.dirname(dest), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
  return dest
}

async function hdri() {
  const files = await api(`files/${HDRI}`)
  const hdr = await download(files.hdri['1k'].hdr.url, path.join(CACHE, `${HDRI}_1k.hdr`))
  await mkdir(path.join(PUB, 'sky'), { recursive: true })
  await writeFile(path.join(PUB, 'sky', 'sky_1k.hdr'), await readFile(hdr))
  // fundo nítido: o JPG tonemapped em 4096x2048 (a luz vem do .hdr)
  const jpg = await download(files.tonemapped.url, path.join(CACHE, `${HDRI}_tonemapped.jpg`))
  await sharp(jpg).resize(4096, 2048).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(PUB, 'sky', 'sky_4k.jpg'))
  await sharp(jpg).resize(2048, 1024).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(PUB, 'sky', 'sky_2k.jpg'))
}

async function textures() {
  for (const [id, asset] of Object.entries(TEXTURES)) {
    const files = await api(`files/${asset}`)
    const maps = { diff: files.Diffuse, nor: files.nor_gl, arm: files.arm }
    for (const [kind, entry] of Object.entries(maps)) {
      const src = await download(entry['1k'].jpg.url, path.join(CACHE, 'tex', `${asset}_${kind}_1k.jpg`))
      const out = path.join(PUB, 'tex', `${id}_${kind}.webp`)
      await mkdir(path.dirname(out), { recursive: true })
      await sharp(src).resize(1024, 1024).webp({ quality: kind === 'diff' ? 82 : 78 }).toFile(out)
    }
    console.log('textura', id)
  }
}

async function models() {
  const cli = path.join(ROOT, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js')
  for (const id of MODELS) {
    const out = path.join(PUB, 'models', `${id}.glb`)
    if (existsSync(out)) continue
    const files = await api(`files/${id}`)
    const entry = files.gltf['1k'].gltf
    const dir = path.join(CACHE, 'models', id)
    const gltf = await download(entry.url, path.join(dir, path.basename(new URL(entry.url).pathname)))
    for (const [rel, inc] of Object.entries(entry.include || {})) await download(inc.url, path.join(dir, rel))
    await mkdir(path.dirname(out), { recursive: true })
    execFileSync(process.execPath, [cli, 'optimize', gltf, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '512'], { stdio: 'inherit' })
    console.log('modelo', id, ((await stat(out)).size / 1e6).toFixed(2), 'MB')
  }
}

await mkdir(CACHE, { recursive: true })
await hdri()
await textures()
await models()
console.log('ok')
if (process.argv.includes('--clean')) await rm(CACHE, { recursive: true, force: true })
