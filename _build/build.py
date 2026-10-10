#!/usr/bin/env python3
"""Собирает сайт «Строй Дом» (Махачкала) из шаблона krovlya-kit.

    python build.py    → ../index.html

Образец — страница КРТ (в ней калькулятор уже умеет менять текст заявки).
Тексты и цифры лежат в stroydom.json. Кадры первого экрана и фото готовит prep_images.py."""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / 'krovlya-kit' / 'site-template'))
import make_site

make_site.SKELETON = ROOT / 'krt-krovlya' / 'index.html'
# третья и четвёртая плашки первого экрана: бытовка и ангар вместо эвакуатора и погрузчика
make_site.CHIP_ICONS[1] = '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'
make_site.CHIP_ICONS[2] = '<rect x="3" y="7" width="18" height="12" rx="1"/><path d="M7 11h3v4H7zM14 11h3v8h-3z"/>'
make_site.CHIP_ICONS[3] = '<path d="M3 20v-8a9 9 0 0 1 18 0v8"/><path d="M9 20v-6h6v6"/><path d="M3 20h18"/>'


def once(old, new, s):
    assert s.count(old) == 1, 'не найдено или найдено несколько раз: ' + old[:60]
    return s.replace(old, new)


GALLERY = [
    ('gal-1', 900, 900, 'Каркасный дом с террасой'),
    ('gal-2', 900, 600, 'Модульный дом с крыльцом'),
    ('gal-3', 900, 900, 'Модуль с панорамными окнами'),
    ('gal-4', 900, 600, 'Дом с тёплой отделкой входа'),
    ('gal-5', 900, 900, 'Фасад: металл и дерево'),
    ('gal-6', 900, 600, 'Каркас на стройке'),
]
PORTFOLIO = '''<section id="portfolio" class="section">
  <div class="section-inner">
    <div class="section-head">
      <div>
        <span class="section-eyebrow">Объекты</span>
        <h2 class="section-title">Что мы уже <em>построили</em></h2>
        <p class="section-lede">Шесть фото из&nbsp;портфолио компании. Остальные&nbsp;— <a href="https://ak-stroydom.ru/portfolio/" target="_blank" rel="noopener">на&nbsp;сайте компании</a>.</p>
      </div>
    </div>
    <div class="sd-gallery">
%s
    </div>
  </div>
</section>

''' % '\n'.join(f'''      <figure class="sd-shot">
        <picture>
          <source srcset="assets/stroydom/{n}.webp" type="image/webp">
          <img src="assets/stroydom/{n}.jpg" alt="{cap} — объект компании «Строй Дом»" loading="lazy" decoding="async" width="{w}" height="{h}">
        </picture>
        <figcaption><span>({i + 1:02d})</span>{cap}</figcaption>
      </figure>''' for i, (n, w, h, cap) in enumerate(GALLERY))

GALLERY_CSS = '''<style>
/* «Строй Дом»: галерея объектов */
.sd-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.sd-shot { margin: 0; position: relative; border-radius: 18px; overflow: hidden; aspect-ratio: 4 / 3; background: #e9edf3; }
.sd-shot img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s ease; }
.sd-shot:hover img { transform: scale(1.04); }
.sd-shot figcaption { position: absolute; left: 0; right: 0; bottom: 0; padding: 36px 18px 14px; color: #fff; font: 600 15px/1.3 Manrope, system-ui, sans-serif; background: linear-gradient(transparent, rgba(4, 10, 24, .78)); }
.sd-shot figcaption span { opacity: .7; margin-right: 8px; font-weight: 500; }
@media (max-width: 900px) { .sd-gallery { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
@media (max-width: 520px) { .sd-gallery { grid-template-columns: 1fr; } }
</style>
</head>'''

c = json.loads((HERE / 'stroydom.json').read_text(encoding='utf-8'))
s = make_site.build(c)

# у карточек-ссылок звёзды не нужны: это ссылки, а не оценки
s, n = re.subn(r'(<a class="v3-testi"[^>]*>)<div class="v3-testi-stars">★★★★★</div>', r'', s)
assert n == 2, 'не найдены карточки-ссылки'
s = once('</head>', GALLERY_CSS, s)
s = once('<section id="why" class="section">', PORTFOLIO + '<section id="why" class="section">', s)
s = once('Демо-версия сайта. Фото и цены стоят для примера: заменим на ваши.',
         'Демо-версия сайта. Фото, цены и отзывы взяты с сайта компании ak-stroydom.ru.', s)

s = once('Шаг 1 из 3 · Площадь кровли', 'Шаг 1 из 3 · Площадь', s)
s = once('Шаг 2 из 3 · Тип кровли', 'Шаг 2 из 3 · Что строим', s)
s = once('aria-label="Площадь кровли в квадратных метрах"', 'aria-label="Площадь в квадратных метрах"', s)
s = once('<div class="v3-calc-inline" data-calc-inline>',
         '<div class="v3-calc-inline" data-calc-inline data-wa-intro="Здравствуйте! Хочу рассчитать стройку." data-wa-type="Что строим" data-no-price="Посчитаем<br>по вашему проекту">', s)
s = once('покадровая анимация крыши', 'кадры: объекты компании', s)
# в кадрах шаблона закрашивался водяной знак; на фото объектов закрашивать нечего
s = once('ctx.fillRect(visibleRight - maskW - padR, visibleBottom - maskH - padB, maskW, maskH);', '', s)

(HERE.parent / 'index.html').write_text(s, encoding='utf-8')
(HERE.parent / '.nojekyll').write_text('')
print('готово:', HERE.parent / 'index.html')
for l in re.findall(r'[^\n]*(?:кровельн|КРТ|Воронеж|assets/krt|для примера)[^\n]*', s):
    print('ОСТАЛОСЬ:', l.strip()[:160])
missing = [p for p in sorted(set(re.findall(r'assets/[\w/.-]+\.(?:jpg|webp)', s))) if not (HERE.parent / p).exists()]
if missing:
    print('нет файлов:', ', '.join(missing))
