# Draws Baitna's app icon, notification icon and splash into the Android project.
from PIL import Image, ImageDraw
import os, glob
R = 'android/app/src/main/res/'
TEAL = (15, 118, 110, 255); WHITE = (255, 255, 255, 255); ORANGE = (242, 154, 75, 255)
def house(size, bg=True, color=WHITE, scale=1.0, round_=False):
    S = size * 8; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if bg:
        if round_: d.ellipse([0, 0, S - 1, S - 1], fill=TEAL)
        else: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=TEAL)
    c = S / 2; u = S * 0.30 * scale; lw = int(u * 0.22)
    roof = [(c - u * 1.15, c - u * 0.05), (c, c - u * 1.15), (c + u * 1.15, c - u * 0.05)]
    d.line(roof, fill=color, width=lw, joint='curve')
    for x, y in roof[::2]: d.ellipse([x - lw / 2, y - lw / 2, x + lw / 2, y + lw / 2], fill=color)
    d.ellipse([c - lw / 2, c - u * 1.15 - lw / 2, c + lw / 2, c - u * 1.15 + lw / 2], fill=color)
    d.rounded_rectangle([c - u * 0.8, c - u * 0.25, c + u * 0.8, c + u * 1.0], radius=int(u * 0.18), outline=color, width=lw)
    d.rounded_rectangle([c - u * 0.22, c + u * 0.28, c + u * 0.22, c + u * 1.0], radius=int(u * 0.12), fill=color)
    if color == WHITE: d.ellipse([c + u * 0.40, c + u * 0.05, c + u * 0.58, c + u * 0.23], fill=ORANGE)
    return im.resize((size, size), Image.LANCZOS)
for k, m in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
    d = R + f'mipmap-{k}/'; os.makedirs(d, exist_ok=True)
    house(int(48 * m)).save(d + 'ic_launcher.png'); house(int(48 * m), round_=True).save(d + 'ic_launcher_round.png')
    house(int(108 * m), bg=False, scale=0.62).save(d + 'ic_launcher_foreground.png')
    nd = R + f'drawable-{k}/'; os.makedirs(nd, exist_ok=True)
    house(int(24 * m), bg=False, scale=1.15).save(nd + 'ic_stat_baitna.png')
open(R + 'values/ic_launcher_background.xml', 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F766E</color>\n</resources>\n')
for f in glob.glob(R + 'drawable*/splash.png'):
    w, h = Image.open(f).size
    im = Image.new('RGBA', (w, h), (244, 243, 239, 255)); ic = house(int(min(w, h) * 0.28))
    im.paste(ic, ((w - ic.width) // 2, (h - ic.height) // 2), ic); im.save(f)
print('icons done')
