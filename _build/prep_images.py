#!/usr/bin/env python3
"""Готовит фото для сайта из снимков с ak-stroydom.ru/portfolio.

    python prep_images.py <папка со скачанными фото p01.jpg … p33.jpg, podkl.jpg>"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

SRC = Path(sys.argv[1])
A = Path(__file__).resolve().parent.parent / 'assets' / 'stroydom'
A.mkdir(parents=True, exist_ok=True)

# имя → (исходник, ширина, высота)
PHOTOS = {
    'hero-1': ('p01', 1600, 1000), 'hero-2': ('p08', 1600, 1000), 'hero-3': ('p06', 1600, 1000), 'hero-4': ('p13', 1600, 1000),
    'about-sm': ('p12', 700, 700), 'about-lg': ('p10', 1400, 900), 'dark': ('p09', 1600, 1000),
    'dir-1': ('p07', 1200, 900), 'dir-2': ('podkl', 1200, 900), 'dir-3': ('p06', 1200, 900), 'dir-4': ('p13', 1200, 900),
    'gal-1': ('p07', 900, 900), 'gal-2': ('p10', 900, 600), 'gal-3': ('p16', 900, 900),
    'gal-4': ('p02', 900, 600), 'gal-5': ('p30', 900, 900), 'gal-6': ('p28', 900, 600),
}
for name, (src, w, h) in PHOTOS.items():
    im = ImageOps.fit(Image.open(SRC / f'{src}.jpg').convert('RGB'), (w, h), Image.LANCZOS)
    im.save(A / f'{name}.jpg', quality=80, optimize=True, progressive=True)
    im.save(A / f'{name}.webp', quality=78)
print('готово:', len(PHOTOS), 'фото')
