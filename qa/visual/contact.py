"""Hoja de contacto: una cuadrícula con fases en filas y cámaras en columnas, con etiquetas.
Uso: python3 qa/visual/contact.py <carpeta> <prefijo> <salida.jpg>"""
import sys, os, glob
from PIL import Image, ImageDraw
d, pre, out = sys.argv[1], sys.argv[2], sys.argv[3]
phases = ['00', '26', '50', '74']; names = {'00': 'De pie', '26': 'Descenso', '50': 'Fondo', '74': 'Ascenso'}
cams = ['frontal', 'tres_cuartos', 'lateral_d', 'lateral_i', 'posterior']
tw, th = 260, 334
img = Image.new('RGB', (80 + tw * len(cams), 24 + th * len(phases) + th), (12, 14, 18))
dr = ImageDraw.Draw(img)
for j, c in enumerate(cams): dr.text((80 + j * tw + 8, 6), c, fill=(220, 220, 220))
for i, p in enumerate(phases):
    dr.text((8, 24 + i * th + th // 2), names[p], fill=(220, 220, 220))
    for j, c in enumerate(cams):
        f = os.path.join(d, f'{pre}_{p}_{c}.jpg')
        if os.path.exists(f): img.paste(Image.open(f).resize((tw, th)), (80 + j * tw, 24 + i * th))
zs = sorted(glob.glob(os.path.join(d, f'{pre}_zoom_*.jpg')))
dr.text((8, 24 + len(phases) * th + th // 2), 'Detalle', fill=(220, 220, 220))
for j, f in enumerate(zs):
    img.paste(Image.open(f).resize((tw, th)), (80 + j * tw, 24 + len(phases) * th))
    dr.text((80 + j * tw + 8, 24 + len(phases) * th + 6), os.path.basename(f).split('zoom_')[1][:-4], fill=(255, 220, 120))
img.save(out, quality=88); print(out, img.size)
