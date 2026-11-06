"""Gera assets/icon.ico e assets/icon.png — o ícone do app (squircle em gradiente + seta)."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
S = 1024


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def build() -> Image.Image:
    # gradiente diagonal: ciano -> azul -> violeta
    stops = [(0.0, (90, 200, 250)), (0.45, (0, 122, 255)), (1.0, (94, 43, 255))]
    grad = Image.new("RGB", (S, S))
    px = grad.load()
    for y in range(S):
        for x in range(S):
            t = (x * 0.55 + y * 0.45) / S
            for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
                if t0 <= t <= t1:
                    px[x, y] = lerp(c0, c1, (t - t0) / (t1 - t0))
                    break

    # brilho no topo
    gloss = Image.new("L", (S, S), 0)
    ImageDraw.Draw(gloss).ellipse((-S * 0.3, -S * 0.75, S * 1.0, S * 0.45), fill=110)
    gloss = gloss.filter(ImageFilter.GaussianBlur(S * 0.08))
    grad = Image.composite(Image.new("RGB", (S, S), (255, 255, 255)), grad, gloss)

    # máscara squircle
    pad = int(S * 0.06)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((pad, pad, S - pad, S - pad), radius=int(S * 0.23), fill=255)

    icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    icon.paste(grad, (0, 0), mask)

    # seta + base
    d = ImageDraw.Draw(icon)
    w = int(S * 0.075)
    cx = S // 2
    white = (255, 255, 255, 255)
    d.line((cx, S * 0.25, cx, S * 0.62), fill=white, width=w)
    d.line((cx - S * 0.17, S * 0.46, cx, S * 0.63), fill=white, width=w, joint="curve")
    d.line((cx + S * 0.17, S * 0.46, cx, S * 0.63), fill=white, width=w, joint="curve")
    d.line((S * 0.29, S * 0.76, S * 0.71, S * 0.76), fill=white, width=w)
    r = w // 2
    for x, y in [(cx, S * 0.25), (cx - S * 0.17, S * 0.46), (cx + S * 0.17, S * 0.46),
                 (S * 0.29, S * 0.76), (S * 0.71, S * 0.76), (cx, S * 0.63)]:
        d.ellipse((x - r, y - r, x + r, y + r), fill=white)
    return icon


def main() -> None:
    OUT.mkdir(exist_ok=True)
    img = build()
    img.resize((512, 512), Image.LANCZOS).save(OUT / "icon.png")
    img.save(OUT / "icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    print("ícones gerados em", OUT)


if __name__ == "__main__":
    main()
