// =====================================================================
// CADASTRO DO IMÓVEL: tudo o que aparece no site sai daqui.
//
// As imagens são REAIS: vídeos de uma única residência no litoral da
// Bahia, publicados por Alef Morais no Pexels (Licença Pexels, ver
// src/data/media.js). A casa NÃO está sendo anunciada por este site.
// Por isso há dois tipos de informação:
//   - observada: o que se vê nas imagens (materiais, ambientes, vistas);
//   - `illustrative: true`: números de venda criados só para demonstrar a
//     ficha. Aparecem sempre com o selo "ilustrativo".
// Para usar com um imóvel autorizado, troque os valores e marque
// `demo: false` e `illustrative: false` nos campos confirmados.
// =====================================================================
import { media } from './media.js'

export const property = {
  demo: true,
  name: 'Casa Mirante',
  nameNote: 'Nome criado para esta apresentação',
  tagline: 'Entre o mar e a lagoa.',
  reference: 'CM-02',
  status: 'Apresentação demonstrativa',
  price: {
    value: 6900000,
    currency: 'BRL',
    illustrative: true,
    note: 'Valor ilustrativo, não é uma oferta',
  },

  address: {
    region: 'Litoral da Bahia, Brasil',
    // fonte: perfil do autor das imagens e títulos dos vídeos ("Bahia", "Brazil")
    regionSource: 'Região indicada pelo autor das imagens',
    street: null,
    placeholder: 'Endereço não divulgado',
  },

  // Coordenadas EXATAS do imóvel. Enquanto forem null, o mapa não aparece.
  location: { lat: null, lng: null, zoom: 16 },

  // Números da ficha. A área e a divisão real da casa não são públicas.
  facts: [
    { k: 'Área construída', v: 420, u: 'm²', illustrative: true },
    { k: 'Terreno', v: 900, u: 'm²', illustrative: true },
    { k: 'Suítes', v: 4, illustrative: true },
    { k: 'Banheiros', v: 5, illustrative: true },
    { k: 'Vagas', v: 3, illustrative: true },
    { k: 'Pavimentos', v: 2, note: '+ garagem', illustrative: false },
  ],

  additional: [
    { label: 'IPTU', value: null },
    { label: 'Condomínio', value: null },
    { label: 'Ano de construção', value: null },
    { label: 'Documentação', value: null, note: 'Não se aplica a esta apresentação' },
    { label: 'Planta baixa', value: null, note: 'Não divulgada; não foi recriada para não inventar ambientes' },
    { label: 'Pavimentos', value: '2 + garagem em nível inferior', observed: true },
    { label: 'Vista', value: 'Lagoa e, de um dos quartos, o mar', observed: true },
    { label: 'Climatização', value: 'Ar-condicionado tipo cassete', observed: true },
  ],

  description: [
    'Uma residência contemporânea filmada entre a orla e uma lagoa, no litoral da Bahia. Esta página a apresenta como um imóvel à venda para demonstrar a experiência; as imagens são reais e mostram uma única casa.',
    'A fachada combina estrutura branca, painel ripado de madeira, pedra clara e grandes panos de vidro. Uma escada de lâminas flutuantes, com luz embutida, leva à porta pivotante de madeira. Ao lado, uma rampa desce para a garagem em nível inferior.',
    'No térreo, estar e jantar integrados se abrem para a piscina em raia e para o deck de madeira sob o pergolado, voltado para a lagoa. A escada interna, de pedra e guarda-corpo de vidro, nasce de um pequeno jardim. No pavimento superior, as suítes têm cabeceiras em painel de madeira e janelas para a água.',
  ],
  disclaimer:
    'Valor, áreas e quantidade de cômodos são ilustrativos. A casa das imagens não está sendo anunciada por este site e aparece apenas como referência visual, em vídeos publicados sob a Licença Pexels. O nome Casa Mirante foi criado para esta apresentação.',

  // Características que aparecem nas imagens (nenhuma foi suposta).
  features: [
    {
      group: 'Fachada e acesso',
      items: ['Escada de lâminas flutuantes com luz embutida', 'Porta pivotante de madeira com puxador vertical', 'Pedra clara no térreo', 'Painel ripado de madeira no pavimento superior', 'Rampa para a garagem em nível inferior'],
    },
    {
      group: 'Áreas externas',
      items: ['Piscina em raia junto à fachada', 'Deck de madeira sob pergolado', 'Varanda com guarda-corpo de vidro', 'Jardim com palmeiras', 'Vista para a lagoa'],
    },
    {
      group: 'Interiores',
      items: ['Estar e jantar integrados', 'Cortinas do piso ao teto', 'Pendentes de fibra natural', 'Cozinha com bancada e banquetas', 'Escada de pedra com guarda-corpo de vidro', 'Jardim interno sob a escada'],
    },
    {
      group: 'Suítes',
      items: ['Cabeceiras em painel de madeira', 'Janelas voltadas para a lagoa', 'Vista para o mar a partir de um dos quartos'],
    },
  ],
  // O que não dá para confirmar pelas imagens fica listado, sem valor inventado.
  pendingFeatures: ['Áreas reais', 'Número exato de suítes e banheiros', 'IPTU e condomínio', 'Segurança e automação', 'Infraestrutura do condomínio'],

  contact: {
    // Preencha para ativar os canais. Enquanto forem null, o formulário
    // funciona em modo demonstração (nada é enviado).
    whatsapp: null, // somente dígitos com DDI, ex.: '5571999999999'
    email: null,
    agentName: null,
    agency: null,
    creci: null,
    message: 'Olá! Tenho interesse na Casa Mirante e gostaria de agendar uma visita.',
  },
}

// Revelação da fachada (seção #obra). `at` = início da etapa, em fração da rolagem da seção.
export const stages = [
  { id: 'blueprint', n: '01', kicker: 'Desenho', title: 'O traço', text: 'Linhas traçadas sobre a fachada real: cobertura, lajes, vãos e a escada de lâminas.', at: 0 },
  { id: 'volumes', n: '02', kicker: 'Volumes', title: 'As massas', text: 'Dois pavimentos sobre um nível de garagem. A laje superior avança sobre o térreo de vidro.', at: 0.3 },
  { id: 'materiais', n: '03', kicker: 'Materiais', title: 'A matéria', text: 'Madeira, pedra clara, vidro e estrutura branca, revelados na fotografia da própria casa.', at: 0.5 },
  { id: 'casa', n: '04', kicker: 'A casa', title: 'Pronta', text: 'Entre palmeiras, exatamente como foi filmada.', at: 0.9 },
]

// Ambientes da seção #casa (cada um é um vídeo real controlado pela rolagem).
export const scenes = [
  { clip: 'entrada', title: 'Entrada', text: 'A porta pivotante de madeira, entre painéis de pedra clara.' },
  { clip: 'escada', title: 'A escada', text: 'Degraus de pedra, guarda-corpo de vidro e um jardim interno.' },
  { clip: 'estar', title: 'Estar', text: 'Luz filtrada pelas cortinas, madeira e tecidos claros.' },
  { clip: 'jantar', title: 'Jantar', text: 'Mesa longa sob pendentes de fibra, integrada ao estar.' },
  { clip: 'suite', title: 'Suíte', text: 'Cabeceira em madeira e a lagoa na janela.' },
  { clip: 'varanda', title: 'Varanda', text: 'Do pavimento superior, a piscina e a lagoa no mesmo quadro.' },
  { clip: 'pergolado', title: 'Pergolado', text: 'O deck de madeira voltado para a água.' },
  { clip: 'piscina', title: 'Piscina', text: 'A raia acompanha a fachada envidraçada até o jardim.' },
]

// Galeria: quadros dos vídeos (public/img/<id>-1600.webp e -800.webp, gerados por tools/media.py).
export const gallery = media.stills

export function fmt(n) {
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function fmtPrice(p) {
  return Number(p.value).toLocaleString('pt-BR', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 })
}
