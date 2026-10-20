// Modelo arquitetônico da Casa Mirante (imóvel DEMONSTRATIVO).
// Fonte única da geometria: o 3D (src/three/house.js) e a planta baixa
// (src/ui/plan-svg.js) são gerados a partir destes números. Unidades em metros.
// Eixos: x = largura (oeste → leste), z = profundidade (fundos → frente/vista), y = altura.

export const LEVELS = {
  ground: 0, // piso do térreo
  ceilingGround: 3.2, // fundo da laje L1
  upper: 3.5, // piso do pavimento superior
  ceilingUpper: 6.6, // fundo da laje de cobertura
  roofTop: 6.92,
}

// Volumes principais (planta). O superior balança 5 m para leste e 1,4 m sobre a frente.
export const VOLUMES = {
  ground: { x0: -12, x1: 12, z0: -5.5, z1: 4.0 },
  upper: { x0: -9, x1: 17, z0: -4.6, z1: 5.4 },
}

export const LOT = { x0: -24, x1: 30, z0: -14, z1: 24 } // 54 m x 38 m
export const POOL = { x0: -1, x1: 15, z0: 8.6, z1: 12.4, depth: 1.4 }
export const TERRACE = { x0: 12, x1: 17, z0: -4.6, z1: 5.4 } // área coberta sob o balanço

// Ambientes (planta baixa). `area` é calculada; `label` aparece na planta.
export const ROOMS = {
  ground: [
    { id: 'garagem', label: 'Garagem', x0: -12, x1: -6, z0: -5.5, z1: -0.5 },
    { id: 'estudio', label: 'Escritório', x0: -12, x1: -6, z0: -0.5, z1: 4.0 },
    { id: 'hall', label: 'Hall e escada', x0: -6, x1: -2, z0: -5.5, z1: 1.6 },
    { id: 'lavabo', label: 'Lavabo', x0: -6, x1: -2, z0: 1.6, z1: 4.0 },
    { id: 'cozinha', label: 'Cozinha', x0: -2, x1: 4, z0: -5.5, z1: -1.0 },
    { id: 'jantar', label: 'Jantar', x0: -2, x1: 4, z0: -1.0, z1: 4.0 },
    { id: 'estar', label: 'Estar', x0: 4, x1: 12, z0: -5.5, z1: 4.0 },
  ],
  upper: [
    { id: 'circulacao', label: 'Circulação', x0: -9, x1: 7.6, z0: -4.6, z1: -3.2 },
    { id: 'banho1', label: 'Banho', x0: -9, x1: -3.4, z0: -3.2, z1: -0.6 },
    { id: 'suite1', label: 'Suíte 1', x0: -9, x1: -3.4, z0: -0.6, z1: 5.4 },
    { id: 'banho2', label: 'Banho', x0: -3.4, x1: 2.2, z0: -3.2, z1: -0.6 },
    { id: 'suite2', label: 'Suíte 2', x0: -3.4, x1: 2.2, z0: -0.6, z1: 5.4 },
    { id: 'banho3', label: 'Banho', x0: 2.2, x1: 7.6, z0: -3.2, z1: -0.6 },
    { id: 'suite3', label: 'Suíte 3', x0: 2.2, x1: 7.6, z0: -0.6, z1: 5.4 },
    { id: 'banhoM', label: 'Banho', x0: 7.6, x1: 11.6, z0: -4.6, z1: 0.2 },
    { id: 'closet', label: 'Closet', x0: 11.6, x1: 17, z0: -4.6, z1: 0.2 },
    { id: 'master', label: 'Suíte principal', x0: 7.6, x1: 17, z0: 0.2, z1: 5.4 },
  ],
  outside: [
    { id: 'varanda', label: 'Varanda coberta', ...TERRACE },
    { id: 'piscina', label: 'Piscina', ...POOL },
  ],
}

// Pilares (estrutura). O balanço leste não tem pilar: é sustentado pelas vigas do superior.
export const COLUMNS = {
  ground: [-9, -3, 3, 9, 12].flatMap((x) => [-5.1, 3.6].map((z) => ({ x, z }))),
  upper: [-9, -3.4, 2.2, 7.6, 12, 17].flatMap((x) => [-4.4, 5.2].map((z) => ({ x, z }))),
}

export const STAIR = { x0: -5.8, x1: -2.4, z0: -4.6, z1: -3.4, steps: 18 }

const area = (r) => (r.x1 - r.x0) * (r.z1 - r.z0)

export function houseAreas() {
  const g = VOLUMES.ground
  const u = VOLUMES.upper
  const ground = area(g)
  const upper = area(u)
  return {
    ground,
    upper,
    built: ground + upper,
    terrace: area(TERRACE),
    lot: area(LOT),
    pool: area(POOL),
    rooms: Object.fromEntries(
      Object.entries(ROOMS).map(([k, list]) => [k, list.map((r) => ({ ...r, area: area(r) }))]),
    ),
  }
}
