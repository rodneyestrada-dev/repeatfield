"""Generate proposal tile artwork (plan-stage design assets only — no app code).

Visual language borrowed from the Repeatfield logo mark:
  cream #fff7ee ground, Pattern Orange #FF8C17 strokes, stroke/radius ratio 0.24
  (logo: r=50 stroke=12 on a 100 viewBox).

Renders 2x supersampled, downscaled to crisp 2048x2048 PNGs:
  demo-tile-field.png   — logo tile: quarter arcs TL + BR (seamless, square corners)
  demo-tile-edge.png    — border tile: half-circle scallops at top & bottom edges
  demo-tile-corner.png  — border corner: quarter arc turning the line 90 degrees
  demo-shape-petal.png  — transparent quarter-petal shape (Tessellate primary demo)
"""
from PIL import Image, ImageDraw

CREAM = (255, 247, 238)
ORANGE = (255, 140, 23)

S = 4096          # supersample canvas
FINAL = 2048      # shipped resolution
RATIO = 0.24      # stroke width = 0.24 * radius (matches logo mark)

def arc(draw, cx, cy, r, start, end, color=ORANGE, width=None):
    w = width if width is not None else int(RATIO * r)
    draw.arc([cx - r, cy - r, cx + r, cy + r], start, end, fill=color, width=w)

def finish(img, path):
    img = img.resize((FINAL, FINAL), Image.LANCZOS)
    img.save(path)
    print("wrote", path)

import os
OUT = os.path.join(os.path.dirname(__file__), "..", "design", "proposals")
os.makedirs(OUT, exist_ok=True)

# 1) FIELD demo tile = the logo mark, square corners for seamless tiling
img = Image.new("RGB", (S, S), CREAM)
d = ImageDraw.Draw(img)
arc(d, 0, 0, S // 2, 0, 90)          # quarter circle, top-left corner
arc(d, S, S, S // 2, 180, 270)       # quarter circle, bottom-right corner
finish(img, os.path.join(OUT, "demo-tile-field.png"))

# 2) EDGE tile — half-circle scallops centered on top & bottom edges
img = Image.new("RGB", (S, S), CREAM)
d = ImageDraw.Draw(img)
arc(d, S // 2, 0, S // 4, 0, 180)        # bulges downward from top edge
arc(d, S // 2, S, S // 4, 180, 360)      # bulges upward from bottom edge
finish(img, os.path.join(OUT, "demo-tile-edge.png"))

# 3) CORNER tile — one quarter arc at the corner: the border line turns 90°
img = Image.new("RGB", (S, S), CREAM)
d = ImageDraw.Draw(img)
arc(d, 0, 0, S // 4, 0, 90)
finish(img, os.path.join(OUT, "demo-tile-corner.png"))

# 4) TESSELLATE primary demo — transparent quarter-petal on alpha
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
r = int(S * 0.42)
d.pieslice([0, 0, 2 * r, 2 * r], 0, 90, fill=ORANGE + (255,))
finish(img, os.path.join(OUT, "demo-shape-petal.png"))

# 5) display-sized copies for base64 embedding in the sample HTML
for name in ["demo-tile-field", "demo-tile-edge", "demo-tile-corner", "demo-shape-petal"]:
    src = Image.open(os.path.join(OUT, name + ".png"))
    src.resize((480, 480), Image.LANCZOS).save(os.path.join(OUT, name + "-480.png"))
print("display copies done")
