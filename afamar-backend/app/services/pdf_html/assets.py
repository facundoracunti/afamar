"""Static assets for the legacy PDF: the company logo and the croquis PNGs.

Both helpers come from the former monolithic ``app/services/pdf_html.py``.
"""
import base64
import json as _json
import logging
import os
from io import BytesIO
from typing import Optional

from PIL import Image as PILImage, ImageDraw

from app.services.pdf_html.env import _BACKEND_ROOT

logger = logging.getLogger(__name__)


def _load_logo_base64(logo_path: Optional[str] = None) -> Optional[str]:
    candidates = []
    if logo_path:
        if os.path.isabs(logo_path):
            candidates.append(logo_path)
        else:
            candidates.append(str(_BACKEND_ROOT / logo_path.lstrip("/")))
    candidates.append(str(_BACKEND_ROOT / "uploads" / "logo.png"))
    candidates.append(str(_BACKEND_ROOT / "uploads" / "logo.jpg"))
    candidates.append(str(_BACKEND_ROOT / "static" / "logo.png"))
    for path in candidates:
        if path and os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            except Exception:
                logger.warning("Failed to encode logo image")
    return None


def _sketch_to_png_base64_list(croquis_data) -> list:
    if not croquis_data:
        return []
    if isinstance(croquis_data, dict):
        pages = croquis_data.get("paginas", [croquis_data])
    elif isinstance(croquis_data, list):
        pages = croquis_data
    else:
        return []

    W, H = 800, 500
    results = []

    def _hex_to_rgb(h):
        if not h or h == "none":
            return None
        h = h.lstrip("#")
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) != 6:
            return (0, 0, 0)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    def _parse_lw(lw):
        try:
            return max(1, int(float(lw)))
        except (ValueError, TypeError):
            return 1

    for page in pages:
        elementos = page.get("elementos") or page.get("dibujo") or []
        img = PILImage.new("RGB", (W, H), "white")
        draw = ImageDraw.Draw(img)

        for el in elementos:
            if not isinstance(el, dict):
                continue
            # The frontend wire format stores the geometry as a JSON string in
            # `data` (`{type, data, order}`). Merge it back in so the drawing
            # code below can read `x`/`y`/`r` straight off the element.
            if isinstance(el.get("data"), (str, dict)):
                _geo = el.get("data")
                if isinstance(_geo, str):
                    try:
                        _parsed = _json.loads(_geo)
                    except (ValueError, TypeError):
                        _parsed = {}
                else:
                    _parsed = _geo
                if isinstance(_parsed, dict):
                    el = {**_parsed, **el}
            t = el.get("type", "")
            color = _hex_to_rgb(el.get("color", "#1e40af")) or (0, 0, 0)
            fill_c = _hex_to_rgb(el.get("fill", "none"))
            lw = _parse_lw(el.get("lineWidth", 1.5))

            if t == "rect":
                x = float(el.get("x", 0))
                y = float(el.get("y", 0))
                w = float(el.get("w", el.get("ancho", 0)))
                rh = float(el.get("h", el.get("alto", 0)))
                if fill_c:
                    draw.rectangle([x, y, x + w, y + rh], fill=fill_c, outline=color, width=lw)
                else:
                    draw.rectangle([x, y, x + w, y + rh], outline=color, width=lw)

            elif t == "circle":
                # Frontend circle uses `cx/cy/radius`; legacy wire uses `x/y/r`
                # (both center-based).
                cx = float(el.get("cx", el.get("x", 0)))
                cy = float(el.get("cy", el.get("y", 0)))
                r = float(el.get("radius", el.get("r", 10)))
                bbox = [cx - r, cy - r, cx + r, cy + r]
                if fill_c:
                    draw.ellipse(bbox, fill=fill_c, outline=color, width=lw)
                else:
                    draw.ellipse(bbox, outline=color, width=lw)

            elif t == "hole":
                cx = float(el.get("x", 0))
                cy = float(el.get("y", 0))
                r = float(el.get("r", 12))
                h_color = _hex_to_rgb(el.get("color", "#dc2626")) or (220, 38, 38)
                h_fill = _hex_to_rgb(el.get("fill", "#fee2e2")) or (254, 226, 226)
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=h_fill, outline=h_color, width=lw)

            elif t == "line":
                x1 = float(el.get("x1", 0))
                y1 = float(el.get("y1", 0))
                x2 = float(el.get("x2", 0))
                y2 = float(el.get("y2", 0))
                draw.line([x1, y1, x2, y2], fill=color, width=lw)

            elif t == "path":
                pts = el.get("points", [])
                if pts and len(pts) > 1:
                    coords = []
                    for p in pts:
                        coords.append(float(p.get("x", 0)))
                        coords.append(float(p.get("y", 0)))
                    draw.line(coords, fill=color, width=lw)

            elif t == "text":
                tx = float(el.get("x", 0))
                ty = float(el.get("y", 0))
                text = el.get("text", "")
                draw.text((tx, ty), text, fill=color)

            elif t == "measure":
                x1 = float(el.get("x1", 0))
                y1 = float(el.get("y1", 0))
                x2 = float(el.get("x2", 0))
                y2 = float(el.get("y2", 0))
                blue = (37, 99, 235)
                draw.line([x1, y1, x2, y2], fill=blue, width=2)
                label = el.get("label", "")
                if label:
                    mx = (x1 + x2) / 2
                    my = (y1 + y2) / 2
                    draw.text((mx + 5, my - 15), label, fill=blue)

            elif t == "bacha":
                bx = float(el.get("x", 0))
                by = float(el.get("y", 0))
                bw = float(el.get("ancho", 80))
                bh = float(el.get("alto", 50))
                blue = (37, 99, 235)
                draw.rectangle([bx, by, bx + bw, by + bh], outline=blue, width=2)
                cx = bx + bw / 2
                cy = by + bh / 2
                draw.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], outline=blue, width=2)

            elif t == "anafe":
                ax = float(el.get("x", 0))
                ay = float(el.get("y", 0))
                aw = float(el.get("ancho", 60))
                ah = float(el.get("alto", 60))
                red = (220, 38, 38)
                draw.rectangle([ax, ay, ax + aw, ay + ah], outline=red, width=2)
                for ox, oy in [(15, 15), (45, 15), (15, 45), (45, 45)]:
                    draw.ellipse(
                        [ax + ox - 10, ay + oy - 10, ax + ox + 10, ay + oy + 10],
                        outline=red, width=2,
                    )

        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
        results.append(encoded)

    return results
