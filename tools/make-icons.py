"""Genera les icones PNG de la PWA a partir d'una definicio geometrica simple.

Us:  python tools/make-icons.py
Requereix Pillow (pip install pillow). Nomes cal tornar-lo a executar si es
canvia el disseny de la icona; els PNG resultants es publiquen al repositori.
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
SS = 4  # supersampling

GREEN = "#2F5D50"
PAPER = "#FAFAF7"
OCHRE = "#A9791F"
INK = "#1C1C1A"


def draw_icon(size: int, content_scale: float = 1.0, full_bleed: bool = True) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Fons
    if full_bleed:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=GREEN)
    else:
        d.rectangle([0, 0, s - 1, s - 1], fill=GREEN)

    # Full de paper centrat
    w = s * 0.60 * content_scale
    h = s * 0.50 * content_scale
    x0 = (s - w) / 2
    y0 = (s - h) / 2
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=int(s * 0.045 * content_scale), fill=PAPER)

    # Franja de color de la materia (vora esquerra, sense costures)
    stripe = w * 0.11
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        [x0, y0, x0 + w, y0 + h], radius=int(s * 0.045 * content_scale), fill=OCHRE
    )
    box = (int(x0), int(y0), int(x0 + stripe), int(y0 + h) + 1)
    img.paste(layer.crop(box), box, layer.crop(box))

    # Linia de titol
    pad = w * 0.22
    line_y = y0 + h * 0.24
    d.rounded_rectangle(
        [x0 + pad, line_y, x0 + w - w * 0.16, line_y + h * 0.085],
        radius=int(h * 0.05),
        fill=INK,
    )

    # Marca de verificat
    cx = x0 + pad
    cy = y0 + h * 0.62
    d.line(
        [(cx, cy), (cx + w * 0.12, cy + h * 0.15), (cx + w * 0.40, cy - h * 0.17)],
        fill=GREEN,
        width=int(h * 0.11),
        joint="curve",
    )

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(192).save(OUT / "icon-192.png")
    draw_icon(512).save(OUT / "icon-512.png")
    # Versio "maskable": el contingut queda dins la zona segura del 80%.
    draw_icon(512, content_scale=0.72, full_bleed=False).save(OUT / "icon-maskable-512.png")
    print("Icones generades a", OUT)


if __name__ == "__main__":
    main()
