"""Generate the bundled Repeatfield demo assets (source of truth for public/).

Visual language from the logo mark, with a restrained Moroccan-tile silhouette:
Field uses the original cream #fff7ee and orange #ff8c24 mark; Edge and
Corner preserve its exact geometry and vary only their base/stroke shades.

Renders 2x supersampled then downscaled to crisp 2048x2048 PNGs:
  demo-tile-field.png    favicon mark (cream / orange)
  demo-tile-edge.png     same mark (peach / dark orange)
  demo-tile-corner.png   same mark (orange / dark orange)
  demo-shape-petal.png   transparent quarter-petal for the Tessellate demo
"""
from PIL import Image, ImageDraw

CREAM = (255, 247, 238)
FIELD_ORANGE = (255, 140, 36)
EDGE_BASE = (254, 192, 154)
CORNER_BASE = (253, 131, 47)
ROLE_STROKE = (199, 85, 26)

S = 4096
FINAL = 2048
RATIO = 0.24
OUT = "/Users/rodneyestrada/repeatfield/public"

def finish(img, name):
    img.resize((FINAL, FINAL), Image.LANCZOS).save(f"{OUT}/{name}.png")
    print("wrote", f"{OUT}/{name}.png")

def mark_tile(base, stroke):
    # The production mark is a 64-unit tile with rx=6 and two r=32 circles.
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S, S], radius=S * 6 // 64, fill=base + (255,))
    width = S * 8 // 64
    d.arc([-S // 2, -S // 2, S // 2, S // 2], 0, 90, fill=stroke + (255,), width=width)
    d.arc([S // 2, S // 2, 3 * S // 2, 3 * S // 2], 180, 270, fill=stroke + (255,), width=width)
    return img

# Field, Edge, and Corner share the exact favicon/logo geometry; shades vary only.
finish(mark_tile(CREAM, FIELD_ORANGE), "demo-tile-field")
finish(mark_tile(EDGE_BASE, ROLE_STROKE), "demo-tile-edge")
finish(mark_tile(CORNER_BASE, ROLE_STROKE), "demo-tile-corner")

# Tessellate demo — transparent quarter-petal on real alpha
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
pr = int(S * 0.42)
d.pieslice([0, 0, 2 * pr, 2 * pr], 0, 90, fill=FIELD_ORANGE + (255,))
finish(img, "demo-shape-petal")
