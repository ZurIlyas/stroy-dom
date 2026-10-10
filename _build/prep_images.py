#!/usr/bin/env python3
"""Готовит фото и кадры первого экрана из снимков с сайта компании.

    python prep_images.py <папка со скачанными фото>

Кадры первого экрана — четыре фото объектов, которые плавно сменяют друг друга при прокрутке."""
import sys
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent
A = OUT / 'assets' / 'stroydom'
A.mkdir(parents=True, exist_ok=True)

# фото для блоков: имя → (исходник, ширина, высота)
PHOTOS = {
    'svc': ('p01', 1200, 800),
    'theme-1': ('p09', 1200, 800),
    'theme-2': ('p30', 1200, 800),
    'theme-3': ('p08', 1200, 800),
    'gal-1': ('p07', 900, 900),
    'gal-2': ('p10', 900, 600),
    'gal-3': ('p16', 900, 900),
    'gal-4': ('p02', 900, 600),
    'gal-5': ('p12', 900, 900),
    'gal-6': ('p28', 900, 600),
}
for name, (src, w, h) in PHOTOS.items():
    im = ImageOps.fit(Image.open(SRC / f'{src}.jpg').convert('RGB'), (w, h), Image.LANCZOS)
    im.save(A / f'{name}.jpg', quality=82, optimize=True, progressive=True)
    im.save(A / f'{name}.webp', quality=80)

# кадры: 121 штука, четыре фото под четыре подписи (зоны 0–0.26, 0.28–0.5, 0.52–0.74, 0.76–1)
HERO = ['p07', 'p16', 'p06', 'p05']
BOUNDS = [0, 33, 62, 91, 121]   # с какого кадра начинается каждое фото
FADE = 6
N = 121


def tile(src, size, zoom):
    im = Image.open(SRC / f'{src}.jpg').convert('RGB')
    side = int(min(im.size) / zoom)
    im = ImageOps.fit(im, (side, side), Image.LANCZOS, centering=(0.5, 0.5))
    inner = int(size * 0.86)
    im = im.resize((inner, inner), Image.LANCZOS)
    mask = Image.new('L', (inner, inner), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner - 1, inner - 1), radius=int(inner * 0.045), fill=255)
    canvas = Image.new('RGB', (size, size), 'white')
    off = (size - inner) // 2
    canvas.paste(im, (off, off + int(size * 0.03)), mask)
    return canvas


for size, folder, q in ((1080, 'frames', 80), (720, 'frames-sm', 76)):
    d = OUT / folder
    d.mkdir(exist_ok=True)
    for i in range(N):
        k = max(j for j in range(4) if BOUNDS[j] <= i)
        t = (i - BOUNDS[k]) / (BOUNDS[k + 1] - BOUNDS[k])
        fr = tile(HERO[k], size, 1 + 0.08 * t)
        left = BOUNDS[k + 1] - i
        if k < 3 and left <= FADE:
            nxt = tile(HERO[k + 1], size, 1.0)
            fr = Image.blend(fr, nxt, 1 - left / (FADE + 1))
        fr.save(d / f'frame_{i + 1:04d}.jpg', quality=q, optimize=True)
    print(folder, 'готово')
