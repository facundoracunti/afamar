"""Jinja2 environment for the legacy (xhtml2pdf) PDF templates.

The environment, the template directory and the custom ``format`` filter
live in their own module so the data builders, the row helpers and the
renderer can import them without dragging the whole legacy PDF pipeline.
"""
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

# NOTE: the depth of the ``parents`` lookup depends on THIS file living in
# ``app/services/pdf_html/``:
#   parents[0] = app/services/pdf_html
#   parents[1] = app/services
#   parents[2] = app           -> the ``templates`` dir lives here
#   parents[3] = <backend root> -> ``uploads/`` + ``static/`` live here
_TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "templates"
_BACKEND_ROOT = Path(__file__).resolve().parents[3]

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _jinja2_format(value, *args, **kwargs):
    """Override built-in ``format`` filter so that ``"{:,.2f}"|format(n)``
    works the same as ``f"{n:,.2f}"`` in Python.  The default Jinja2 filter
    uses ``%``-style formatting which does not understand ``{:,}``."""
    if not args and not kwargs:
        return str(value)
    try:
        if kwargs:
            return str(value).format(**kwargs)
        return str(value).format(*args)
    except (IndexError, KeyError, ValueError, TypeError):
        return str(value)


_env.filters["format"] = _jinja2_format
