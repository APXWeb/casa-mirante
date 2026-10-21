"""Desenho técnico da fachada, traçado sobre o quadro final do vídeo 39576524.

Gera src/data/facade.json (linhas do blueprint, rótulos e máscaras dos
materiais em coordenadas 1920x1080 da prancha) e, com --preview <plate.png>,
uma sobreposição para conferir o alinhamento com a fotografia.
Retas em perspectiva: cada horizontal é y = y0 + k * (x - x0), medida na foto.
"""
import json, sys, os

W, H = 1920, 1080


def ln(y0, x0, k):
    return lambda x: y0 + k * (x - x0)


# horizontais medidas (perfil de bordas em tools/ de rascunho)
parapet_top = ln(203, 500, 0.0475)
fascia_top = ln(221, 500, 0.0475)
fascia_bot = ln(256, 500, 0.0475)
upper_head = ln(279, 560, 0.043)
slab_top = ln(463, 560, 0.0273)
slab_bot = ln(503, 560, 0.0227)
g_head = ln(528, 620, 0.0227)
g_foot = ln(732, 440, -0.004)
plinth = ln(758, 440, -0.006)


def P(*pts):
    return 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts)


def hline(f, x0, x1):
    return P((x0, f(x0)), (x1, f(x1)))


def vline(x, f0, f1, lean=0.0):
    # lean: deslocamento em x por pixel subido (fuga vertical leve)
    y0, y1 = f0(x) if callable(f0) else f0, f1(x) if callable(f1) else f1
    return P((x + lean * (y1 - y0) * 0, y0), (x + lean * (y0 - y1), y1))


L = 405  # ponta esquerda da laje de cobertura
R = 1483  # ponta direita
UL, UR = 480, 1474  # volume superior (faces externas)
GL, GR = 420, 1492  # vidro do térreo

groups = []


def group(gid, paths):
    groups.append({'id': gid, 'paths': paths})


# 1. chão e base
group('base', [
    hline(plinth, 300, 1560),
    hline(g_foot, GL, GR),
    P((1463, 743), (1920, 938)),  # muro da rampa da garagem
    P((1463, 745), (1527, 1004)),
])
# 2. volume superior: cobertura, laje, faces
group('volume', [
    hline(parapet_top, 470, 1430), hline(fascia_top, L, R), hline(fascia_bot, L, R),
    P((L, fascia_top(L)), (L, fascia_bot(L))), P((R, fascia_top(R)), (R, fascia_bot(R))),
    P((470, parapet_top(470)), (470, fascia_top(470))), P((1430, parapet_top(1430)), (1430, fascia_top(1430))),
    hline(slab_top, 494, R), hline(slab_bot, 494, R),
    P((494, slab_top(494)), (494, slab_bot(494))), P((R, slab_top(R)), (R, slab_bot(R))),
    P((UL, fascia_bot(UL)), (UL, slab_top(UL))), P((UR, fascia_bot(UR)), (UR, slab_top(UR))),
    P((510, fascia_bot(510)), (510, slab_top(510))), P((1440, fascia_bot(1440)), (1440, slab_top(1440))),
])
# níveis (sem cotas numéricas: o projeto original não é público)
group('niveis', [
    'M250 %.0f L398 %.0f' % (fascia_top(250), fascia_top(398)),
    'M250 %.0f L488 %.0f' % (slab_top(250), slab_top(488)),
    'M250 %.0f L414 %.0f' % (g_foot(250), g_foot(414)),
    'M915 150 L915 1050',
])
# 3. térreo: pilares, pedra, porta
group('terreo', [
    hline(g_head, GL, GR),
    P((GL, g_head(GL)), (GL, g_foot(GL))), P((GR, g_head(GR)), (GR, g_foot(GR))),
    P((786, g_head(786)), (786, g_foot(786))), P((834, g_head(834)), (834, g_foot(834))),
    P((990, g_head(990)), (990, g_foot(990))), P((1106, g_head(1106)), (1106, g_foot(1106))),
])
# 4. esquadrias e painel
group('aberturas', [
    P((718, g_head(718)), (718, g_foot(718))), P((585, g_head(585)), (585, g_foot(585))),
    P((1225, g_head(1225)), (1225, g_foot(1225))), P((1345, g_head(1345)), (1345, g_foot(1345))), P((1452, g_head(1452)), (1452, g_foot(1452))),
    # porta pivotante e puxador
    P((975, 560), (975, 700)),
    # painel de madeira (ripado) e faixa escura
    P((728, 290), (1076, 304), (1076, 396), (728, 384), (728, 290)),
    # vidros do pavimento superior
    P((565, upper_head(565)), (565, slab_top(565))), P((620, upper_head(620)), (620, slab_top(620))),
    P((712, upper_head(712)), (712, slab_top(712))),
    P((1207, 318), (1207, slab_top(1207))), P((1312, 320), (1312, slab_top(1312))), P((1402, 322), (1402, slab_top(1402))),
    hline(upper_head, 565, 728), P((1207, 318), (1402, 322)),
    # guarda-corpos de vidro
    P((400, 380), (728, 392)), P((1207, 410), (1474, 416)),
])
# 5. escada flutuante (7 lâminas)
steps = [
    [(805, 741), (1010, 741), (1013, 757), (803, 757)],
    [(757, 760), (990, 760), (992, 777), (752, 777)],
    [(785, 780), (1047, 780), (1052, 803), (782, 803)],
    [(745, 806), (1012, 806), (1018, 838), (740, 838)],
    [(762, 839), (1100, 839), (1102, 880), (757, 882)],
    [(642, 886), (1060, 886), (1068, 940), (625, 941)],
    [(712, 941), (1140, 934), (1212, 1006), (1210, 1026), (676, 1027), (675, 992)],
]
group('escada', [P(*st, st[0]) for st in steps])

labels = [
    {'t': 'Cobertura', 'x': 250, 'y': 209, 'g': 'niveis', 'level': True},
    {'t': 'Pavimento superior', 'x': 250, 'y': 455, 'g': 'niveis', 'level': True},
    {'t': 'Térreo', 'x': 250, 'y': 733, 'g': 'niveis', 'level': True},
    {'t': 'Cobertura plana com platibanda', 'x': 560, 'y': 206, 'dx': 0, 'dy': -86, 'g': 'volume'},
    {'t': 'Painel ripado de madeira', 'x': 1010, 'y': 350, 'dx': 210, 'dy': -230, 'g': 'aberturas'},
    {'t': 'Pele de vidro', 'x': 560, 'y': 640, 'dx': -250, 'dy': -40, 'g': 'aberturas'},
    {'t': 'Porta pivotante', 'x': 912, 'y': 640, 'dx': 0, 'dy': 0, 'g': 'terreo', 'inline': True},
    {'t': 'Pedra clara', 'x': 1060, 'y': 650, 'dx': 600, 'dy': -60, 'g': 'terreo'},
    {'t': 'Escada de lâminas flutuantes', 'x': 700, 'y': 915, 'dx': -290, 'dy': 85, 'g': 'escada'},
    {'t': 'Rampa da garagem', 'x': 1720, 'y': 900, 'dx': -120, 'dy': 140, 'g': 'base'},
]



# ---------- volumes (estudo de massas) e materiais ----------
def quad(x0, x1, f_top, f_bot):
    t0 = f_top(x0) if callable(f_top) else f_top
    t1 = f_top(x1) if callable(f_top) else f_top
    b0 = f_bot(x0) if callable(f_bot) else f_bot
    b1 = f_bot(x1) if callable(f_bot) else f_bot
    return [(x0, t0), (x1, t1), (x1, b1), (x0, b0)]


def Z(*polys):
    return ' '.join(P(*p) + ' Z' for p in polys)


roof = [quad(470, 1430, parapet_top, fascia_top), quad(L, R, fascia_top, fascia_bot)]
upper = [quad(UL, UR, fascia_bot, slab_top)]
slab = [quad(494, R, slab_top, slab_bot)]
soffit = [quad(GL, GR, slab_bot, g_head)]
glass_up = [quad(510, 728, upper_head, slab_top), [(1207, 318), (1440, 323), (1440, slab_top(1440)), (1207, slab_top(1207))]]
rail = [[(400, 380), (510, 384), (510, slab_top(510)), (400, slab_top(400))]]
wood = [[(728, 290), (1076, 304), (1076, 396), (728, 384)]]
dark = [[(728, upper_head(728)), (1207, 318), (1207, slab_top(1207)), (728, slab_top(728))]]
glass_g = [quad(GL, 786, g_head, g_foot), quad(1106, GR, g_head, g_foot)]
stone = [quad(786, 834, slab_bot, g_foot), quad(990, 1106, slab_bot, g_foot)]
door = [quad(837, 988, g_head, g_foot)]
plinth_p = [quad(GL, GR, g_foot, plinth)]
stairs = steps
ramp = [[(1463, 743), (1920, 938), (1920, 1015), (1527, 1004)]]
fence = [[(1462, 655), (1665, 655), (1665, 732), (1462, 732)]]

# preenchimentos do estudo de volumes, na ordem em que aparecem (de baixo para cima)
fills = [
    {'id': 'base', 'cls': 'f-base', 'd': Z(*plinth_p, *ramp)},
    {'id': 'escada', 'cls': 'f-solid', 'd': Z(*stairs)},
    {'id': 'pedra', 'cls': 'f-stone', 'd': Z(*stone)},
    {'id': 'porta', 'cls': 'f-wood', 'd': Z(*door)},
    {'id': 'vidro-t', 'cls': 'f-glass', 'd': Z(*glass_g)},
    {'id': 'sombra', 'cls': 'f-shadow', 'd': Z(*soffit)},
    {'id': 'laje', 'cls': 'f-solid', 'd': Z(*slab)},
    {'id': 'volume', 'cls': 'f-mid', 'd': Z(*upper)},
    {'id': 'parede', 'cls': 'f-dark', 'd': Z(*dark)},
    {'id': 'ripado', 'cls': 'f-wood', 'd': Z(*wood)},
    {'id': 'vidro-s', 'cls': 'f-glass', 'd': Z(*glass_up, *rail)},
    {'id': 'cobertura', 'cls': 'f-solid', 'd': Z(*roof)},
]
# reflexos diagonais nos vidros (convenção de elevação)
refl = []
for x0, x1, yt, yb in ((440, 560, 560, 720), (600, 700, 570, 700), (1130, 1210, 575, 720), (1250, 1330, 580, 700), (1380, 1440, 590, 700), (540, 620, 300, 440), (1230, 1300, 340, 470)):
    refl.append(P((x0, yb), (x1, yt)))
    refl.append(P((x0 + 26, yb), (x1 + 26, yt)))
hatch = []  # fiadas da pedra
for x0, x1 in ((786, 834), (990, 1106)):
    for i, y in enumerate(range(560, 730, 22)):
        hatch.append(P((x0, y), (x1, y + 1)))
        xm = x0 + (x1 - x0) * (0.35 if i % 2 else 0.7)
        hatch.append(P((xm, y), (xm, y + 22)))
slats = [P((728, 290 + i * 8.2), (1076, 304 + i * 8.2)) for i in range(1, 11)]
grooves = [P((850 + i * 14, g_head(850)), (850 + i * 14, g_foot(850))) for i in range(10)]

# materiais revelados na fotografia (cada um é um recorte da mesma imagem)
materials = [
    {'id': 'madeira', 'label': 'Madeira', 'd': Z(*wood, *door, *fence), 'from': 'bottom'},
    {'id': 'pedra', 'label': 'Pedra clara', 'd': Z(*stone, *stairs), 'from': 'bottom'},
    {'id': 'vidro', 'label': 'Vidro', 'd': Z(*glass_g, *glass_up, *rail), 'from': 'left'},
    {'id': 'estrutura', 'label': 'Estrutura branca', 'd': Z(*roof, *upper, *slab, *soffit, *plinth_p, *ramp), 'from': 'top'},
]

out = {
    'w': W, 'h': H, 'groups': groups, 'labels': labels, 'fills': fills, 'materials': materials,
    'details': {'refl': refl, 'hatch': hatch, 'slats': slats, 'grooves': grooves},
    'door': {'x': 912, 'y': 640},  # centro da porta (aproximação da câmera)
    'house': {'x0': 405, 'x1': 1492, 'cx': 950},
}
here = os.path.dirname(os.path.abspath(__file__))
dst = os.path.join(here, '..', 'src', 'data', 'facade.js')
with open(dst, 'w', encoding='utf-8') as f:
    f.write('// Gerado por tools/facade-trace.py (desenho sobre o quadro final do vídeo 39576524). Não edite à mão.\n')
    f.write('export const facade = ' + json.dumps(out, ensure_ascii=False, indent=1) + '\n')
print('ok', dst, sum(len(g['paths']) for g in groups), 'paths')

if '--preview' in sys.argv:
    from PIL import Image, ImageDraw
    src = sys.argv[sys.argv.index('--preview') + 1]
    dst_img = sys.argv[sys.argv.index('--preview') + 2]
    im = Image.open(src).convert('RGB').resize((W, H))
    d = ImageDraw.Draw(im)
    cols = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ff2d55', '#bf5af2']
    for gi, g in enumerate(groups):
        for p in g['paths']:
            pts = [tuple(map(float, s.strip().split())) for s in p[1:].split(' L')]
            d.line(pts, fill=cols[gi % len(cols)], width=2)
    if '--fills' in sys.argv:
        for fl in fills:
            for sub in fl['d'].split(' Z'):
                sub = sub.strip()
                if not sub:
                    continue
                pts = [tuple(map(float, t.strip().split())) for t in sub[1:].split(' L')]
                d.polygon(pts, outline='#ffffff')
    for l in labels:
        d.ellipse([l['x'] - 5, l['y'] - 5, l['x'] + 5, l['y'] + 5], outline='#fff', width=2)
    im.save(dst_img, quality=90)
