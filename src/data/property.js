// =====================================================================
// CADASTRO DO IMÓVEL: tudo o que aparece no site sai daqui.
// Para apresentar outra casa, duplique este objeto e troque os valores.
// Campos `null` não aparecem na página (ou aparecem como "a informar"
// quando estão em `pendingLabel`). Nada aqui é dado real: a Casa Mirante
// é um imóvel DEMONSTRATIVO, modelado em 3D para esta apresentação.
// =====================================================================
import { houseAreas } from './house.js'

const areas = houseAreas()

export const property = {
  demo: true, // mostra o selo "Imóvel demonstrativo" e os avisos
  name: 'Casa Mirante',
  tagline: 'Do primeiro traço à última luz do dia.',
  reference: 'CM-001 (demonstrativo)',
  status: 'Demonstração', // ex.: "À venda", "Reservado", "Vendido"
  price: {
    value: 8900000, // valor fictício, só para demonstrar a composição
    currency: 'BRL',
    note: 'Valor demonstrativo',
  },

  address: {
    street: null,
    number: null,
    neighborhood: null,
    city: null,
    state: null,
    zip: null,
    // Mostrado enquanto o endereço não for cadastrado:
    placeholder: 'Endereço completo informado no agendamento da visita',
  },

  // Coordenadas EXATAS do imóvel. Enquanto for null, o mapa não é exibido.
  location: { lat: null, lng: null, zoom: 16 },

  // Números conferidos contra o modelo 3D (src/data/house.js).
  facts: {
    lotArea: areas.lot, // m²
    builtArea: areas.built, // m²
    bedrooms: 4,
    suites: 4,
    bathrooms: 5, // 4 banhos das suítes + lavabo
    parking: 2,
    floors: 2,
  },

  // Itens com valor null aparecem como "a informar" (estrutura pronta para preencher).
  additional: [
    { label: 'IPTU anual', value: null },
    { label: 'Condomínio', value: null },
    { label: 'Ano de construção', value: null },
    { label: 'Documentação', value: null },
    { label: 'Área do pavimento térreo', value: `${fmt(areas.ground)} m²` },
    { label: 'Área do pavimento superior', value: `${fmt(areas.upper)} m²` },
    { label: 'Varanda coberta', value: `${fmt(areas.terrace)} m²` },
    { label: 'Piscina', value: '16 m x 3,8 m, borda infinita' },
    { label: 'Pavimentos', value: '2' },
  ],

  description: [
    'A Casa Mirante foi pensada a partir da vista. O térreo é um grande volume de vidro, protegido por um pavimento superior que avança 1,4 metro sobre a fachada e balança 5 metros sobre a varanda leste, criando sombra sem interromper a paisagem.',
    'Estar, jantar e cozinha formam um único ambiente de 3,2 metros de pé-direito, aberto para o deck e para a piscina de borda infinita. O escritório, o lavabo e a garagem ficam no bloco de concreto aparente a oeste, que funciona como contraponto sólido à transparência do restante da casa.',
    'No pavimento superior, quatro suítes se voltam para a frente do terreno. Os brises de madeira pivotantes filtram o sol da tarde e garantem privacidade sem fechar a vista. A suíte principal ocupa toda a extremidade do balanço, com closet e banho próprios.',
    'Imóvel demonstrativo: a casa, os números e o valor foram criados para apresentar esta experiência e não correspondem a uma propriedade real à venda.',
  ],

  // Grupos de características. Só entram grupos que existem neste imóvel.
  features: [
    {
      group: 'Área externa e lazer',
      items: ['Piscina de borda infinita com 16 m', 'Deck em pedra clara', 'Varanda coberta de 50 m² sob o balanço', 'Jardim com palmeiras e gramado', 'Jardim na laje do bloco oeste'],
    },
    {
      group: 'Ambientes integrados',
      items: ['Estar, jantar e cozinha em um só ambiente', 'Pé-direito de 3,2 m no térreo', 'Fachada de vidro piso-teto voltada para a vista', 'Ilha de cozinha em pedra com veios'],
    },
    {
      group: 'Suítes e espaços privativos',
      items: ['4 suítes no pavimento superior', 'Suíte principal com closet e banho', 'Brises de madeira pivotantes em todas as suítes'],
    },
    {
      group: 'Ambientes adicionais',
      items: ['Escritório no térreo', 'Lavabo', 'Garagem fechada para 2 carros'],
    },
    {
      group: 'Arquitetura e materiais',
      items: ['Estrutura em concreto aparente', 'Balanço de 5 m sem pilares', 'Concreto com marca de fôrma de madeira', 'Forro de madeira sob o balanço', 'Esquadrias de alumínio em tom bronze'],
    },
  ],

  // Itens que dependem do imóvel real ficam aqui para não serem inventados.
  pendingFeatures: ['Climatização', 'Automação', 'Segurança', 'Condomínio e infraestrutura'],

  contact: {
    // Preencha para ativar os canais. Enquanto estiverem null, o formulário
    // funciona em modo demonstração (nada é enviado).
    whatsapp: null, // somente dígitos com DDI, ex.: '5511999999999'
    email: null,
    agentName: null,
    agency: null,
    creci: null,
    message: 'Olá! Tenho interesse na Casa Mirante e gostaria de agendar uma visita.',
  },
}

// Etapas da obra (sequência fixa da rolagem).
export const stages = [
  { id: 'blueprint', n: '01', kicker: 'Blueprint', title: 'O projeto', text: 'Antes da primeira pá de terra, cada linha da casa já existe no papel.' },
  { id: 'fundacao', n: '02', kicker: 'Fundação', title: 'O chão firme', text: 'Sapatas, vigas baldrame e a laje do térreo. A piscina é escavada junto.' },
  { id: 'estrutura', n: '03', kicker: 'Estrutura', title: 'O esqueleto', text: 'Pilares, núcleo da escada e as lajes que permitem o balanço de 5 metros.' },
  { id: 'fachada', n: '04', kicker: 'Fachada', title: 'A pele', text: 'Alvenaria, reboco, vidro piso-teto e os brises de madeira.' },
  { id: 'final', n: '05', kicker: 'Concluída', title: 'A casa', text: 'Paisagismo, água na piscina e a luz do fim de tarde.' },
]

// Cenas da apresentação (câmera em src/three/director.js, mesma ordem).
export const scenes = [
  { id: 'residencia', title: 'A residência', text: 'Dois volumes, um sobre o outro. O de cima avança sobre a vista.' },
  { id: 'piscina', title: 'Borda infinita', text: 'Dezesseis metros de água que terminam onde o vale começa.' },
  { id: 'sala', title: 'Sala integrada', text: 'Vidro do piso ao teto. A paisagem entra pela sala inteira.' },
  { id: 'balanco', title: 'O balanço', text: 'Cinco metros sem pilares, com forro de madeira por baixo.' },
  { id: 'noite', title: 'Ao anoitecer', text: 'A casa acende por dentro e a piscina vira luz.' },
]

// Destaques numerados (estilo editorial), cada um com uma imagem renderizada do modelo.
export const highlights = [
  { n: '01', title: 'Acima da vista', text: 'O pavimento superior avança sobre a fachada e enquadra o vale.', image: 'balanco-frente' },
  { n: '02', title: 'Brises de madeira', text: 'Painéis pivotantes que regulam sol, vento e privacidade.', image: 'brises' },
  { n: '03', title: 'Concreto aparente', text: 'A marca da fôrma de madeira fica registrada na parede.', image: 'concreto' },
  { n: '04', title: 'Vidro piso-teto', text: 'Esquadrias finas para que a paisagem seja a parede.', image: 'sala' },
  { n: '05', title: 'Borda infinita', text: 'A água se encontra com o horizonte no fim da tarde.', image: 'piscina' },
]

// Galeria: arquivos em public/img/<id>-1600.webp e <id>-800.webp (gerados por `npm run capture`).
export const gallery = [
  { id: 'fachada', alt: 'Fachada frontal da Casa Mirante ao fim da tarde', group: 'Fachada' },
  { id: 'aerea', alt: 'Vista aérea da casa, do deck e da piscina', group: 'Fachada' },
  { id: 'balanco-frente', alt: 'Pavimento superior em balanço sobre a fachada de vidro', group: 'Fachada' },
  { id: 'piscina', alt: 'Piscina de borda infinita com o vale ao fundo', group: 'Área externa' },
  { id: 'deck', alt: 'Deck em pedra clara entre a casa e a piscina', group: 'Área externa' },
  { id: 'varanda', alt: 'Varanda coberta sob o balanço, com forro de madeira', group: 'Área externa' },
  { id: 'sala', alt: 'Sala integrada com vista para a piscina através do vidro', group: 'Interiores' },
  { id: 'cozinha', alt: 'Cozinha com ilha de pedra e pendentes', group: 'Interiores' },
  { id: 'suite', alt: 'Suíte principal com luz filtrada pelos brises', group: 'Interiores' },
  { id: 'brises', alt: 'Detalhe dos brises de madeira pivotantes', group: 'Detalhes' },
  { id: 'concreto', alt: 'Parede de concreto aparente do bloco oeste', group: 'Detalhes' },
  { id: 'noite', alt: 'A casa iluminada ao anoitecer', group: 'Fachada' },
]

export function fmt(n) {
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function fmtPrice(p) {
  return Number(p.value).toLocaleString('pt-BR', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 })
}
