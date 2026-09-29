from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
PREVIEW = ROOT.parent / "artifacts" / "alipro-app-icon.png"
BACKGROUND = "#fbf8f1"
FOREGROUND = "#e07856"
SCALE = 4


def paw(draw, size, transparent=False):
    factor = size / 24

    def box(cx, cy, rx, ry):
        return tuple(round(value * factor) for value in (cx - rx, cy - ry, cx + rx, cy + ry))

    for cx, cy in ((6.5, 9.5), (10, 7), (14, 7), (17.5, 9.5)):
        draw.ellipse(box(cx, cy, 1.9, 2.5), fill=FOREGROUND)

    def cubic(start, control1, control2, end, steps=24):
        values = []
        for index in range(1, steps + 1):
            t = index / steps
            u = 1 - t
            values.append((
                u ** 3 * start[0] + 3 * u ** 2 * t * control1[0] + 3 * u * t ** 2 * control2[0] + t ** 3 * end[0],
                u ** 3 * start[1] + 3 * u ** 2 * t * control1[1] + 3 * u * t ** 2 * control2[1] + t ** 3 * end[1],
            ))
        return values

    start = (12.0, 11.2)
    curves = [
        ((8.7, 11.2), (6.3, 13.8), (6.3, 16.6)),
        ((6.3, 18.7), (7.8, 20.0), (9.6, 20.0)),
        ((10.5, 20.0), (11.2, 19.7), (12.0, 19.7)),
        ((12.8, 19.7), (13.5, 20.0), (14.4, 20.0)),
        ((16.2, 20.0), (17.7, 18.7), (17.7, 16.6)),
        ((17.7, 13.8), (15.3, 11.2), (12.0, 11.2)),
    ]
    points = [start]
    current = start
    for control1, control2, end in curves:
        points.extend(cubic(current, control1, control2, end))
        current = end
    draw.polygon([(round(x * factor), round(y * factor)) for x, y in points], fill=FOREGROUND)


def render_legacy(size, round_icon=False):
    canvas_size = size * SCALE
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if round_icon:
        draw.ellipse((0, 0, canvas_size - 1, canvas_size - 1), fill=BACKGROUND)
    else:
        radius = canvas_size // 4
        draw.rounded_rectangle((0, 0, canvas_size - 1, canvas_size - 1), radius=radius, fill=BACKGROUND)
    paw(draw, canvas_size)
    return image.resize((size, size), Image.Resampling.LANCZOS)


def render_foreground(size):
    canvas_size = size * SCALE
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    # Android adaptive foreground canvas is 108 units; map the favicon's 24-unit paw
    # into the central 72-unit safe area while leaving the background to Android.
    safe = round(canvas_size * 2 / 3)
    layer = Image.new("RGBA", (safe, safe), (0, 0, 0, 0))
    paw(ImageDraw.Draw(layer), safe)
    offset = (canvas_size - safe) // 2
    image.alpha_composite(layer, (offset, offset))
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main():
    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }
    for density, (legacy_size, foreground_size) in densities.items():
        target = RES / f"mipmap-{density}"
        target.mkdir(parents=True, exist_ok=True)
        render_legacy(legacy_size).save(target / "ic_launcher.png")
        render_legacy(legacy_size, round_icon=True).save(target / "ic_launcher_round.png")
        render_foreground(foreground_size).save(target / "ic_launcher_foreground.png")

    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    render_legacy(512).save(PREVIEW)
    print(PREVIEW)


if __name__ == "__main__":
    main()
