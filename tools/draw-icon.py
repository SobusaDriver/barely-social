#!/usr/bin/env python3
"""Dibuja el icono fuente de BarelySocial (1024x1024, cuadrado completo).

    python3 tools/draw-icon.py [salida.png]

Marca: un post (avatar coral + tres líneas); solo la primera línea es blanca,
las otras se difuminan en el fondo. Fondo charcoal con degradado sutil.
Se dibuja a 4096 y se reduce para antialias.
"""
import sys

from PIL import Image, ImageDraw

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/barelysocial-icon-src.png"
S = 4096

TOP = (25, 28, 34)
BOTTOM = (15, 17, 21)
CORAL = (255, 91, 61)
WHITE = (244, 241, 234)
SLATE = (58, 64, 74)
SLATE_DARK = (38, 43, 51)

img = Image.new("RGB", (S, S), TOP)
d = ImageDraw.Draw(img)

# fondo: degradado vertical muy sutil
for y in range(S):
    t = y / (S - 1)
    d.line(
        [(0, y), (S, y)],
        fill=(
            round(TOP[0] + (BOTTOM[0] - TOP[0]) * t),
            round(TOP[1] + (BOTTOM[1] - TOP[1]) * t),
            round(TOP[2] + (BOTTOM[2] - TOP[2]) * t),
        ),
    )

# avatar
r = round(0.135 * S)
cx, cy = round(0.30 * S), round(0.41 * S)
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CORAL)

# tres líneas tipo post, alineadas con el avatar
x0, x1 = round(0.50 * S), round(0.82 * S)
h = round(0.075 * S)
for center_y, color in ((0.41, WHITE), (0.515, SLATE), (0.62, SLATE_DARK)):
    y = round(center_y * S)
    d.rounded_rectangle(
        [x0, y - h // 2, x1, y + h // 2],
        radius=h // 2,
        fill=color,
    )

img.resize((1024, 1024), Image.LANCZOS).save(OUT)
print("fuente:", OUT)
