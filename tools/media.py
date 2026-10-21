"""Baixa e prepara as mídias reais do imóvel (vídeos e quadros) a partir de tools/media.json.

  python tools/media.py            # tudo (baixa o que faltar em .media-cache/)
  python tools/media.py --stills   # só os quadros da galeria

Saídas:
  public/media/<id>-d.mp4   1600x900, para telas horizontais
  public/media/<id>-m.mp4   720x1280, recorte vertical no ponto focal (celular)
  public/img/poster/<id>-{d,m}-{a,b}.webp   primeiro e último quadro de cada clipe
  public/img/<id>-1600.webp / -800.webp     quadros da galeria
  public/img/plate-3200.webp                prancha da revelação (fachada)
  src/data/media.js                         manifesto usado pelo site

Os vídeos são codificados com GOP curto e sem quadros B para que a busca
(currentTime) seja rápida nos dois sentidos durante a rolagem.
O ffmpeg vem da variável FFMPEG ou do pacote Python imageio-ffmpeg.
"""
import json, os, re, subprocess, sys, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CACHE = os.path.join(ROOT, '.media-cache')
PUB = os.path.join(ROOT, 'public')
M = json.load(open(os.path.join(ROOT, 'tools', 'media.json'), encoding='utf-8'))

FPS = 24
PLATE_T = 12.35  # quadro da fachada usado como prancha (fim do clipe 39576524)


def ffmpeg_bin():
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


FF = ffmpeg_bin()


def run(args):
    r = subprocess.run([FF, '-hide_banner', '-v', 'error', '-y', *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr)


def duration(path):
    r = subprocess.run([FF, '-hide_banner', '-i', path], capture_output=True, text=True)
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def source(item):
    """Arquivo de origem em cache (4K quando houver)."""
    os.makedirs(CACHE, exist_ok=True)
    for q in ('uhd', 'fhd'):
        url = item['files'].get(q)
        if not url:
            continue
        dst = os.path.join(CACHE, f"{item['pexels']}_{'2160' if q == 'uhd' else '1080'}.mp4")
        if not os.path.exists(dst):
            print('  baixando', url)
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            try:
                with urllib.request.urlopen(req, timeout=600) as r, open(dst + '.part', 'wb') as f:
                    f.write(r.read())
            except Exception:  # certificados do Python desatualizados: usa o curl do sistema
                subprocess.run(['curl', '-s', '-L', '-o', dst + '.part', url], check=True)
            os.replace(dst + '.part', dst)
        return dst
    sys.exit(f"sem arquivo para {item['id']}")


X264 = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-g', '12', '-keyint_min', '12', '-sc_threshold', '0', '-bf', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']


def portrait_crop(fx):
    # recorte 9:16 em torno do ponto focal, limitado à imagem
    return f"crop=ih*9/16:ih:max(0\\,min(iw-ih*9/16\\,iw*{fx}-ih*9/32)):0"


def clips():
    out = []
    os.makedirs(os.path.join(PUB, 'media'), exist_ok=True)
    os.makedirs(os.path.join(PUB, 'img', 'poster'), exist_ok=True)
    for c in M['clips']:
        print('clipe', c['id'])
        src = source(c)
        a, b = c['range']
        cut = ['-ss', str(a), '-t', str(b - a), '-i', src]
        d = os.path.join(PUB, 'media', f"{c['id']}-d.mp4")
        m = os.path.join(PUB, 'media', f"{c['id']}-m.mp4")
        run([*cut, '-vf', f'scale=1600:900:flags=lanczos,fps={FPS}', '-crf', '26', *X264, d])
        run([*cut, '-vf', f"{portrait_crop(c['focalX'])},scale=720:1280:flags=lanczos,fps={FPS}", '-crf', '27', *X264, m])
        dur = duration(d)
        for k, f in (('d', d), ('m', m)):
            run(['-ss', '0', '-i', f, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', os.path.join(PUB, 'img', 'poster', f"{c['id']}-{k}-a.webp")])
            run(['-sseof', '-0.08', '-i', f, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', os.path.join(PUB, 'img', 'poster', f"{c['id']}-{k}-b.webp")])
        out.append({
            'id': c['id'], 'duration': round(dur, 3), 'focalX': c['focalX'], 'alt': c['alt'],
            'bytes': {'d': os.path.getsize(d), 'm': os.path.getsize(m)}, 'page': c['page'], 'pexels': c['pexels'],
        })
    return out


def stills():
    out = []
    img = os.path.join(PUB, 'img')
    for s in M['stills']:
        src = source(s)
        big, small = ((900, 1600), (450, 800)) if s['portrait'] else ((1600, 900), (800, 450))
        for (w, h), name in ((big, '1600'), (small, '800')):
            run(['-ss', str(s['t']), '-i', src, '-frames:v', '1', '-vf', f'scale={w}:{h}:flags=lanczos', '-c:v', 'libwebp', '-quality', '82', os.path.join(img, f"{s['id']}-{name}.webp")])
        out.append({'id': s['id'], 'alt': s['alt'], 'group': s['group'], 'portrait': s['portrait'], 'page': s['page'], 'pexels': s['pexels']})
    # prancha da revelação (mesmo quadro do fim do clipe da fachada)
    fac = next(c for c in M['clips'] if c['id'] == 'fachada')
    run(['-ss', str(PLATE_T), '-i', source(fac), '-frames:v', '1', '-vf', 'scale=3200:1800:flags=lanczos', '-c:v', 'libwebp', '-quality', '80', os.path.join(img, 'plate-3200.webp')])
    run(['-ss', str(PLATE_T), '-i', source(fac), '-frames:v', '1', '-vf', 'scale=1600:900:flags=lanczos', '-c:v', 'libwebp', '-quality', '80', os.path.join(img, 'plate-1600.webp')])
    return out


def write_manifest(clip_list, still_list):
    data = {
        'author': M['author'], 'license': M['license'], 'session': M['session'], 'fps': FPS, 'plateTime': PLATE_T,
        'clips': {c['id']: c for c in clip_list}, 'stills': still_list,
    }
    path = os.path.join(ROOT, 'src', 'data', 'media.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('// Gerado por tools/media.py a partir de tools/media.json. Não edite à mão.\n')
        f.write('export const media = ' + json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    print('manifesto', path)


if __name__ == '__main__':
    prev = os.path.join(ROOT, 'src', 'data', 'media.js')
    if '--stills' in sys.argv and os.path.exists(prev):
        txt = open(prev, encoding='utf-8').read().split('export const media = ', 1)[1]
        clip_list = list(json.loads(txt)['clips'].values())
    else:
        clip_list = clips()
    write_manifest(clip_list, stills())
