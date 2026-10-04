"""A stand-in for tkinter, so that unmodified turtle programs run in a browser.

Pyodide ships CPython without Tk. This module provides the slice of tkinter
that the standard library's turtle.py uses, plus the canvas queries that
programs reach through getcanvas() (find_overlapping, itemcget, coords, bbox).
The canvas keeps the same item model Tk does, and the geometry behind
find_overlapping is a line-for-line port of Tk 8.6's tkTrig.c, tkCanvLine.c,
tkCanvPoly.c, tkCanvText.c and tkCanvImg.c, so a program that tuned itself
against real Tk gets the same answers here.

Drawing is sent to the page as a list of changed items. Events come back from
the page through a shared buffer, and are only handed to the program when it
calls update(), mainloop() or a dialog, which is when Tk would deliver them.

The page side is a JS module, _tkhost, registered by the worker.
"""

import json
import math
import time as _time

import _tkhost

TkVersion = 8.6
TclVersion = 8.6
wantobjects = 1

# tkinter.constants
NO = FALSE = OFF = 0
YES = TRUE = ON = 1
N, S, W, E = "n", "s", "w", "e"
NW, SW, NE, SE = "nw", "sw", "ne", "se"
NS, EW, NSEW, CENTER = "ns", "ew", "nsew", "center"
NONE, X, Y, BOTH = "none", "x", "y", "both"
LEFT, TOP, RIGHT, BOTTOM = "left", "top", "right", "bottom"
RAISED, SUNKEN, FLAT, RIDGE, GROOVE, SOLID = (
    "raised", "sunken", "flat", "ridge", "groove", "solid")
HORIZONTAL, VERTICAL = "horizontal", "vertical"
NUMERIC, CHAR, WORD = "numeric", "char", "word"
BASELINE = "baseline"
INSIDE, OUTSIDE = "inside", "outside"
SEL, SEL_FIRST, SEL_LAST, END, INSERT, CURRENT, ANCHOR, ALL = (
    "sel", "sel.first", "sel.last", "end", "insert", "current", "anchor", "all")
NORMAL, DISABLED, ACTIVE, HIDDEN = "normal", "disabled", "active", "hidden"
CASCADE, CHECKBUTTON, COMMAND, RADIOBUTTON, SEPARATOR = (
    "cascade", "checkbutton", "command", "radiobutton", "separator")
SINGLE, BROWSE, MULTIPLE, EXTENDED = "single", "browse", "multiple", "extended"
DOTBOX, UNDERLINE = "dotbox", "underline"
PIESLICE, CHORD, ARC, FIRST, LAST = "pieslice", "chord", "arc", "first", "last"
BUTT, PROJECTING, ROUND, BEVEL, MITER = (
    "butt", "projecting", "round", "bevel", "miter")
MOVETO, SCROLL, UNITS, PAGES = "moveto", "scroll", "units", "pages"


class TclError(Exception):
    pass


_default_root = None


def _flatten(seq):
    out = []
    for item in seq:
        if isinstance(item, (tuple, list)):
            out.extend(_flatten(item))
        else:
            out.append(item)
    return out


# ---------------------------------------------------------------------------
# Talking to the page

class _App:
    """Process-wide state: the one window, its timers and its event queue."""

    def __init__(self):
        self.root = None
        self.canvases = []
        self.timers = []          # [due, id, func, args]
        self.timer_seq = 0
        self.destroyed = False
        self.quit_flag = False
        self.width = 200
        self.height = 200
        self.pending = []         # events waiting for the next update()
        self.focus_sent = 0.0

    # -- events --
    def _poll(self):
        raw = _tkhost.poll()
        while raw is not None:
            self.pending.append(json.loads(raw))
            raw = _tkhost.poll()

    def _wait(self, timeout_ms):
        _tkhost.wait(timeout_ms)
        self._poll()

    def flush(self):
        for cv in self.canvases:
            cv._flush()

    def run_timers(self):
        now = _time.monotonic()
        due = [t for t in self.timers if t[0] <= now]
        for t in sorted(due, key=lambda t: (t[0], t[1])):
            if t in self.timers:
                self.timers.remove(t)
                t[2](*t[3])

    def dispatch_pending(self, only=None):
        """Deliver queued events. Returns the first event of type `only`."""
        found = None
        while self.pending:
            ev = self.pending.pop(0)
            if only is not None and ev.get("t") == only and found is None:
                found = ev
                continue
            self._deliver(ev)
            if found is not None:
                break
        return found

    def _deliver(self, ev):
        kind = ev.get("t")
        if kind == "close":
            if self.root is not None:
                self.root._close_requested()
            return
        if kind in ("answer", "line"):
            return
        target = self.canvases[0] if self.canvases else None
        if target is None:
            return
        e = Event()
        e.widget = target
        e.x = ev.get("x", 0)
        e.y = ev.get("y", 0)
        e.x_root = e.x
        e.y_root = e.y
        e.state = ev.get("state", 0)
        e.time = int(_time.monotonic() * 1000) & 0x7FFFFFFF
        if kind in ("keypress", "keyrelease"):
            e.keysym = ev.get("keysym", "")
            e.char = ev.get("char", "")
            e.keycode = ev.get("keycode", 0)
            e.keysym_num = 0
            e.type = "2" if kind == "keypress" else "3"
            seq_type = "KeyPress" if kind == "keypress" else "KeyRelease"
            detail = e.keysym
        elif kind in ("buttonpress", "buttonrelease", "motion"):
            e.num = ev.get("num", 1)
            if kind == "buttonpress":
                seq_type, e.type = "ButtonPress", "4"
                detail = str(e.num)
            elif kind == "buttonrelease":
                seq_type, e.type = "ButtonRelease", "5"
                detail = str(e.num)
            else:
                seq_type, e.type = "Motion", "6"
                detail = ev.get("buttons", "")
            target._fire_tag_bindings(seq_type, detail, e)
        else:
            return
        for widget in (target, self.root):
            if widget is not None:
                widget._fire(seq_type, detail, e)

    def update(self):
        self._poll()
        self.dispatch_pending()
        self.run_timers()
        self.flush()

    def mainloop(self):
        self.quit_flag = False
        _idle_hook()
        while not self.destroyed and not self.quit_flag:
            self.flush()
            if self.timers:
                wait = max(0.0, min(t[0] for t in self.timers) - _time.monotonic())
                timeout = min(int(wait * 1000) + 1, 250)
            else:
                timeout = 250
            self._wait(timeout)
            self.dispatch_pending()
            self.run_timers()
        self.flush()

    def wait_for(self, kind):
        """Block until an event of `kind` arrives, as a modal dialog would."""
        self.flush()
        _idle_hook()
        while True:
            self._poll()
            for i, ev in enumerate(self.pending):
                if ev.get("t") == kind:
                    del self.pending[i]
                    return ev
                if ev.get("t") == "close":
                    del self.pending[i]
                    if self.root is not None:
                        self.root._close_requested()
                    return None
            # A dialog holds the grab: other input is dropped, timers still run.
            self.pending = [ev for ev in self.pending if ev.get("t") == "close"]
            self.run_timers()
            self._wait(100)


_app = _App()


def _idle_hook():
    try:
        import _playhost
    except ImportError:
        return
    _playhost.idle()


def _post(obj):
    _tkhost.post(json.dumps(obj, separators=(",", ":")))


# ---------------------------------------------------------------------------
# Colours and fonts

_color_cache = {}


def _parse_color(name):
    """Return '#rrggbb' for a Tk colour name, or None if Tk would reject it."""
    if not isinstance(name, str):
        return None
    if name in _color_cache:
        return _color_cache[name]
    result = None
    key = name.strip()
    if key.startswith("#"):
        digits = key[1:]
        if len(digits) in (3, 6, 9, 12) and all(c in "0123456789abcdefABCDEF" for c in digits):
            n = len(digits) // 3
            parts = [int(digits[i * n:(i + 1) * n], 16) for i in range(3)]
            scale = (16 ** n) - 1
            result = "#%02x%02x%02x" % tuple(round(p * 255 / scale) for p in parts)
    else:
        low = key.lower().replace(" ", "")
        m = None
        for prefix in ("grey", "gray"):
            if low.startswith(prefix) and low[len(prefix):].isdigit():
                m = int(low[len(prefix):])
        if m is not None and 0 <= m <= 100:
            v = round(m * 255 / 100)
            result = "#%02x%02x%02x" % (v, v, v)
        elif low:
            result = _tkhost.color(low)
    _color_cache[name] = result
    return result


def _font_spec(font):
    """Turn a Tk font description into (css font string, pixel size, underline)."""
    family, size, styles = "Arial", 8, []
    if isinstance(font, str):
        parts = font.split()
        if parts:
            if font.startswith("{"):
                close = font.index("}")
                family = font[1:close]
                parts = font[close + 1:].split()
            else:
                family = parts[0]
                parts = parts[1:]
            if parts:
                try:
                    size = int(parts[0])
                    parts = parts[1:]
                except ValueError:
                    pass
            styles = parts
    elif isinstance(font, (tuple, list)) and font:
        family = str(font[0])
        if len(font) > 1:
            try:
                size = int(font[1])
            except (TypeError, ValueError):
                size = 8
        for s in font[2:]:
            styles.extend(str(s).split())
    # Positive sizes are points. Tk on a 96 dpi display scales by 4/3.
    px = -size if size < 0 else max(1, int(size * 4 / 3 + 0.5))
    weight = "bold" if "bold" in styles else "normal"
    slant = "italic" if "italic" in styles else "normal"
    css = '%s %s %dpx "%s", Arial, sans-serif' % (slant, weight, px, family)
    return css, px, "underline" in styles


_measure_cache = {}


def _measure(css, text):
    key = (css, text)
    if key not in _measure_cache:
        res = _tkhost.measure(css, text)
        _measure_cache[key] = (int(res[0] + 0.5), int(res[1] + 0.5), int(res[2] + 0.5))
    return _measure_cache[key]


# ---------------------------------------------------------------------------
# Geometry, ported from Tk 8.6 (generic/tkTrig.c and the canvas item types).
# Return values follow Tk: -1 outside, 0 overlapping, 1 inside.

def _div(a, b):
    if b != 0:
        return a / b
    if a == 0 or a != a:
        return math.nan
    return math.inf if (a > 0) == (math.copysign(1.0, b) > 0) else -math.inf


def _line_to_area(x1, y1, x2, y2, r):
    inside1 = (x1 >= r[0]) and (x1 <= r[2]) and (y1 >= r[1]) and (y1 <= r[3])
    inside2 = (x2 >= r[0]) and (x2 <= r[2]) and (y2 >= r[1]) and (y2 <= r[3])
    if inside1 != inside2:
        return 0
    if inside1 and inside2:
        return 1
    if x1 == x2:
        if ((y1 >= r[1]) ^ (y2 >= r[1])) and (x1 >= r[0]) and (x1 <= r[2]):
            return 0
    elif y1 == y2:
        if ((x1 >= r[0]) ^ (x2 >= r[0])) and (y1 >= r[1]) and (y1 <= r[3]):
            return 0
    else:
        m = (y2 - y1) / (x2 - x1)
        low, high = (x1, x2) if x1 < x2 else (x2, x1)
        y = y1 + (r[0] - x1) * m
        if (r[0] >= low) and (r[0] <= high) and (y >= r[1]) and (y <= r[3]):
            return 0
        y += (r[2] - r[0]) * m
        if (y >= r[1]) and (y <= r[3]) and (r[2] >= low) and (r[2] <= high):
            return 0
        low, high = (y1, y2) if y1 < y2 else (y2, y1)
        x = x1 + (r[1] - y1) / m
        if (x >= r[0]) and (x <= r[2]) and (r[1] >= low) and (r[1] <= high):
            return 0
        x += (r[3] - r[1]) / m
        if (x >= r[0]) and (x <= r[2]) and (r[3] >= low) and (r[3] <= high):
            return 0
    return -1


def _polygon_to_point(p, n, px, py):
    best = 1.0e36
    intersections = 0
    i = 0
    for _ in range(n - 1):
        x0, y0, x1, y1 = p[i], p[i + 1], p[i + 2], p[i + 3]
        if x1 == x0:
            x = x0
            if y0 >= y1:
                y = max(min(y0, py), y1)
            else:
                y = max(min(y1, py), y0)
        elif y1 == y0:
            y = y0
            if x0 >= x1:
                x = max(min(x0, px), x1)
                if (py < y) and (px < x0) and (px >= x1):
                    intersections += 1
            else:
                x = max(min(x1, px), x0)
                if (py < y) and (px < x1) and (px >= x0):
                    intersections += 1
        else:
            m1 = (y1 - y0) / (x1 - x0)
            b1 = y0 - m1 * x0
            m2 = -1.0 / m1
            b2 = py - m2 * px
            x = (b2 - b1) / (m1 - m2)
            y = m1 * x + b1
            if x0 > x1:
                if x > x0:
                    x, y = x0, y0
                elif x < x1:
                    x, y = x1, y1
            else:
                if x > x1:
                    x, y = x1, y1
                elif x < x0:
                    x, y = x0, y0
            lower = (m1 * px + b1) > py
            if lower and (px >= min(x0, x1)) and (px < max(x0, x1)):
                intersections += 1
        d = math.hypot(px - x, py - y)
        if d < best:
            best = d
        i += 2
    if intersections & 1:
        return 0.0
    return best


def _polygon_to_area(p, n, r):
    state = _line_to_area(p[0], p[1], p[2], p[3], r)
    if state == 0:
        return 0
    i = 2
    for _ in range(n - 2):
        if _line_to_area(p[i], p[i + 1], p[i + 2], p[i + 3], r) != state:
            return 0
        i += 2
    if state == 1:
        return 1
    if _polygon_to_point(p, n, r[0], r[1]) == 0.0:
        return 0
    return -1


def _oval_to_area(o, r):
    if (r[0] <= o[0]) and (r[2] >= o[2]) and (r[1] <= o[1]) and (r[3] >= o[3]):
        return 1
    if (r[2] < o[0]) or (r[0] > o[2]) or (r[3] < o[1]) or (r[1] > o[3]):
        return -1
    cx = (o[0] + o[2]) / 2
    cy = (o[1] + o[3]) / 2
    rx = (o[2] - o[0]) / 2
    ry = (o[3] - o[1]) / 2
    dy = r[1] - cy
    if dy < 0.0:
        dy = cy - r[3]
        if dy < 0.0:
            dy = 0
    dy = _div(dy, ry)
    dy *= dy
    dx = _div(r[0] - cx, rx)
    dx *= dx
    if (dx + dy) <= 1.0:
        return 0
    dx = _div(r[2] - cx, rx)
    dx *= dx
    if (dx + dy) <= 1.0:
        return 0
    dx = r[0] - cx
    if dx < 0.0:
        dx = cx - r[2]
        if dx < 0.0:
            dx = 0
    dx = _div(dx, rx)
    dx *= dx
    dy = _div(r[1] - cy, ry)
    dy *= dy
    if (dx + dy) < 1.0:
        return 0
    dy = _div(r[3] - cy, ry)
    dy *= dy
    if (dx + dy) < 1.0:
        return 0
    return -1


def _butt_points(p1x, p1y, p2x, p2y, width, project):
    width *= 0.5
    length = math.hypot(p2x - p1x, p2y - p1y)
    if length == 0.0:
        return [p2x, p2y, p2x, p2y]
    dx = -width * (p2y - p1y) / length
    dy = width * (p2x - p1x) / length
    m1x, m2x = p2x + dx, p2x - dx
    m1y, m2y = p2y + dy, p2y - dy
    if project:
        m1x += dy
        m2x += dy
        m1y -= dx
        m2y -= dx
    return [m1x, m1y, m2x, m2y]


def _edges_to_area(c, n, width, cap, join, r, inside, closed_outline):
    """The edge walk shared by TkThickPolyLineToArea and PolygonToArea.
    Mitred joins are treated as bevelled; turtle never asks for them."""
    radius = width / 2.0
    poly = [0.0] * 10
    project = (cap == "projecting") and not closed_outline
    i = 0
    count = n
    while count >= 2:
        x0, y0, x1, y1 = c[i], c[i + 1], c[i + 2], c[i + 3]
        if closed_outline:
            round_here = join == "round"
        else:
            round_here = (cap == "round" and count == n) or (join == "round" and count != n)
        if round_here:
            if _oval_to_area((x0 - radius, y0 - radius, x0 + radius, y0 + radius), r) != inside:
                return 0
        if count == n:
            poly[0:4] = _butt_points(x1, y1, x0, y0, width, project)
        else:
            poly[0:4] = _butt_points(x1, y1, x0, y0, width, False)
            if join in ("bevel", "miter"):
                poly[8], poly[9] = poly[0], poly[1]
                if _polygon_to_area(poly, 5, r) != inside:
                    return 0
        poly[4:8] = _butt_points(x0, y0, x1, y1, width, project and count == 2)
        poly[8], poly[9] = poly[0], poly[1]
        if _polygon_to_area(poly, 5, r) != inside:
            return 0
        count -= 1
        i += 2
    if not closed_outline and cap == "round":
        x, y = c[i], c[i + 1]
        if _oval_to_area((x - radius, y - radius, x + radius, y + radius), r) != inside:
            return 0
    return inside


def _float(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


class _Item:
    __slots__ = ("id", "type", "coords", "opts", "tags", "bbox", "layout")

    def __init__(self, iid, kind, coords, opts):
        self.id = iid
        self.type = kind
        self.coords = coords
        self.opts = opts
        self.tags = []
        self.bbox = (-1, -1, -1, -1)
        self.layout = None

    # -- polygon helpers --
    def _poly_points(self):
        c = list(self.coords)
        n = len(c) // 2
        if len(c) > 2 and (c[-2] != c[0] or c[-1] != c[1]):
            c += c[:2]
            n += 1
        return c, n

    def compute_bbox(self):
        t = self.type
        c = self.coords
        if self.opts.get("state") == "hidden":
            self.bbox = (-1, -1, -1, -1)
            return
        if t == "line":
            n = len(c) // 2
            if n == 0:
                self.bbox = (-1, -1, -1, -1)
                return
            x1 = x2 = int(c[0])
            y1 = y2 = int(c[1])
            for k in range(1, n):
                tx = int(c[2 * k] + 0.5)
                ty = int(c[2 * k + 1] + 0.5)
                x1, x2 = min(x1, tx), max(x2, tx)
                y1, y2 = min(y1, ty), max(y2, ty)
            width = _float(self.opts.get("width", 1.0), 1.0)
            if width < 1.0:
                width = 1.0
            w = int(width + 0.5)
            x1 -= w
            x2 += w
            y1 -= w
            y2 += w
            if n == 1:
                self.bbox = (x1 - 1, y1 - 1, x2 + 1, y2 + 1)
                return
            self.bbox = (x1 - 1, y1 - 1, x2 + 1, y2 + 1)
        elif t == "polygon":
            p, n = self._poly_points()
            if n < 1:
                self.bbox = (-1, -1, -1, -1)
                return
            x1 = x2 = int(p[0])
            y1 = y2 = int(p[1])
            for k in range(1, n - 1):
                tx = int(p[2 * k] + 0.5)
                ty = int(p[2 * k + 1] + 0.5)
                x1, x2 = min(x1, tx), max(x2, tx)
                y1, y2 = min(y1, ty), max(y2, ty)
            if self.opts.get("outline", ""):
                width = _float(self.opts.get("width", 1.0), 1.0)
                k = int((width + 1.5) / 2.0)
                x1 -= k
                x2 += k
                y1 -= k
                y2 += k
            self.bbox = (x1 - 1, y1 - 1, x2 + 1, y2 + 1)
        elif t == "text":
            self._layout_text()
            ox, oy, width, height = self.layout[0], self.layout[1], self.layout[2], self.layout[3]
            fudge = 1
            xs = (ox - fudge, ox + width + fudge)
            ys = (oy, oy + height)
            self.bbox = (int(math.floor(xs[0] + 0.5)), int(math.floor(ys[0] + 0.5)),
                         int(math.floor(xs[1] + 0.5)), int(math.floor(ys[1] + 0.5)))
        elif t == "image":
            x, y = (c + [0, 0])[:2]
            ix = int(x + (0.5 if x >= 0 else -0.5))
            iy = int(y + (0.5 if y >= 0 else -0.5))
            img = self.opts.get("image")
            if not isinstance(img, PhotoImage) or img._w == 0:
                self.bbox = (ix, iy, ix, iy)
                return
            w, h = img._w, img._h
            a = self.opts.get("anchor", "center")
            if a in ("n", "s", "center"):
                ix -= w // 2
            elif a in ("ne", "e", "se"):
                ix -= w
            if a in ("e", "w", "center"):
                iy -= h // 2
            elif a in ("se", "s", "sw"):
                iy -= h
            self.bbox = (ix, iy, ix + w, iy + h)
        else:  # rectangle / oval, used by nothing here; a plain box is enough
            if len(c) >= 4:
                xa, xb = sorted((c[0], c[2]))
                ya, yb = sorted((c[1], c[3]))
                width = _float(self.opts.get("width", 1.0), 1.0)
                k = int(width / 2 + 0.5) + 1
                self.bbox = (int(xa) - k, int(ya) - k, int(xb) + k, int(yb) + k)
            else:
                self.bbox = (-1, -1, -1, -1)

    def _layout_text(self):
        c = self.coords
        x, y = (c + [0, 0])[:2]
        text = str(self.opts.get("text", ""))
        css, px, _ = _font_spec(self.opts.get("font", ("Arial", 8)))
        lines = text.split("\n")
        _, ascent, descent = _measure(css, "Hg")
        linespace = ascent + descent
        widths = [_measure(css, ln)[0] if ln else 0 for ln in lines]
        width = max(widths) if widths else 0
        height = linespace * len(lines)
        if not self.opts.get("fill", "black"):
            width = height = 0
        a = self.opts.get("anchor", "center")
        dy = 0 if a in ("nw", "n", "ne") else (-height if a in ("sw", "s", "se") else -(height // 2))
        dx = 0 if a in ("nw", "w", "sw") else (-width if a in ("ne", "e", "se") else -(width // 2))
        just = self.opts.get("justify", "left")
        chunks = []
        for k, ln in enumerate(lines):
            lw = widths[k]
            if just == "center":
                lx = (width - lw) // 2
            elif just == "right":
                lx = width - lw
            else:
                lx = 0
            chunks.append((lx, k * linespace, lx + lw, k * linespace + linespace, bool(ln)))
        self.layout = (x + dx, y + dy, width, height, chunks, css, ascent)

    def area(self, r):
        """Tk's areaProc for this item type."""
        t = self.type
        c = self.coords
        if self.opts.get("state") == "hidden":
            return -1
        if t == "line":
            n = len(c) // 2
            width = _float(self.opts.get("width", 1.0), 1.0)
            if n == 0:
                return -1
            if n == 1:
                radius = (width + 1.0) / 2.0
                return _oval_to_area((c[0] - radius, c[1] - radius, c[0] + radius, c[1] + radius), r)
            if width < 1.0:
                width = 1.0
            inside = -1
            if (c[0] >= r[0]) and (c[0] <= r[2]) and (c[1] >= r[1]) and (c[1] <= r[3]):
                inside = 1
            return _edges_to_area(c, n, width, self.opts.get("capstyle", "butt"),
                                  self.opts.get("joinstyle", "round"), r, inside, False)
        if t == "polygon":
            p, n = self._poly_points()
            width = _float(self.opts.get("width", 1.0), 1.0)
            if n < 2:
                return -1
            if n < 3:
                radius = width / 2.0
                return _oval_to_area((p[0] - radius, p[1] - radius, p[0] + radius, p[1] + radius), r)
            inside = _polygon_to_area(p, n, r)
            if inside == 0:
                return 0
            if not self.opts.get("outline", ""):
                return inside
            return _edges_to_area(p, n, width, "butt", self.opts.get("joinstyle", "round"),
                                  r, inside, True)
        if t == "text":
            if self.layout is None:
                self._layout_text()
            ox, oy, width, height, chunks = self.layout[:5]
            left = int((r[0] + 0.5) - ox)
            top = int((r[1] + 0.5) - oy)
            right = left + int(r[2] - r[0] + 0.5)
            bottom = top + int(r[3] - r[1] + 0.5)
            result = 0
            for cx1, cy1, cx2, cy2, real in chunks:
                if not real:
                    continue
                if (right < cx1) or (left >= cx2) or (bottom < cy1) or (top >= cy2):
                    if result == 1:
                        return 0
                    result = -1
                elif (cx1 < left) or (cx2 >= right) or (cy1 < top) or (cy2 >= bottom):
                    return 0
                else:
                    if result == -1:
                        return 0
                    result = 1
            return result if result else -1
        b = self.bbox
        if (r[2] <= b[0]) or (r[0] >= b[2]) or (r[3] <= b[1]) or (r[1] >= b[3]):
            return -1
        if (r[0] <= b[0]) and (r[1] <= b[1]) and (r[2] >= b[2]) and (r[3] >= b[3]):
            return 1
        return 0

    def snapshot(self):
        o = self.opts
        out = {"k": self.type, "c": self.coords}
        if self.type in ("line", "polygon", "rectangle", "oval"):
            out["f"] = _parse_color(o.get("fill", "")) if o.get("fill", "") else ""
            out["w"] = _float(o.get("width", 1.0), 1.0)
            if self.type != "line":
                out["o"] = _parse_color(o.get("outline", "")) if o.get("outline", "") else ""
            else:
                out["cap"] = o.get("capstyle", "butt")
                out["join"] = o.get("joinstyle", "round")
        elif self.type == "text":
            if self.layout is None:
                self._layout_text()
            out["f"] = _parse_color(o.get("fill", "black")) if o.get("fill", "black") else ""
            out["t"] = str(o.get("text", ""))
            out["font"] = self.layout[5]
            out["ox"] = self.layout[0]
            out["oy"] = self.layout[1]
            out["ch"] = [[ch[0], ch[1]] for ch in self.layout[4]]
            out["asc"] = self.layout[6]
            out["u"] = _font_spec(o.get("font", ("Arial", 8)))[2]
        if o.get("state") == "hidden":
            out["hidden"] = True
        return out


# ---------------------------------------------------------------------------
# Widgets

class Event:
    def __repr__(self):
        return "<Event %s>" % ", ".join("%s=%r" % kv for kv in sorted(vars(self).items())
                                         if kv[0] != "widget")


def _parse_sequence(seq):
    """'<KeyPress-w>' -> ('KeyPress', 'w'); '<Button1-ButtonRelease>' -> ('ButtonRelease', '1')."""
    s = seq.strip()
    if s.startswith("<") and s.endswith(">"):
        s = s[1:-1]
    elif len(s) == 1:
        return ("KeyPress", s)
    parts = s.split("-")
    kind, detail, button = None, None, None
    for p in parts:
        if p in ("KeyPress", "Key"):
            kind = "KeyPress"
        elif p == "KeyRelease":
            kind = "KeyRelease"
        elif p in ("Button", "ButtonPress"):
            kind = "ButtonPress"
        elif p == "ButtonRelease":
            kind = "ButtonRelease"
        elif p == "Motion":
            kind = "Motion"
        elif p in ("Configure", "Destroy", "Enter", "Leave", "FocusIn", "FocusOut",
                   "MouseWheel", "Map", "Unmap", "Expose", "Visibility"):
            kind = p
        elif len(p) == 2 and p[0] == "B" and p[1].isdigit():
            button = p[1]
        elif p.startswith("Button") and p[6:].isdigit():
            button = p[6:]
        else:
            detail = p
    if kind is None:
        if detail is not None and detail.isdigit() and len(parts) == 1:
            kind, detail = "ButtonPress", detail
        else:
            kind = "KeyPress"
    if kind in ("ButtonPress", "ButtonRelease") and detail is None:
        detail = button
    if kind == "Motion":
        detail = button
    return (kind, detail)


class _TkInterp:
    """Stands in for the Tcl interpreter object (widget.tk)."""

    def mainloop(self, n=0):
        _app.mainloop()

    def call(self, *args):
        return ""

    def eval(self, *args):
        return ""

    def getboolean(self, v):
        return bool(v)

    def splitlist(self, v):
        return tuple(v) if isinstance(v, (tuple, list)) else tuple(str(v).split())

    def quit(self):
        _app.quit_flag = True

    def dooneevent(self, flags=0):
        _app.update()
        return 0


class Misc:
    _interp = _TkInterp()

    def __init__(self):
        self._bindings = {}
        self._options = {}
        self.tk = Misc._interp
        self.master = None
        self.children = {}

    # -- bindings --
    def bind(self, sequence=None, func=None, add=None):
        if sequence is None:
            return tuple(self._bindings.keys())
        key = _parse_sequence(sequence)
        if func is None:
            return self._bindings.get(key)
        if add and str(add).startswith("+"):
            self._bindings.setdefault(key, []).append(func)
        else:
            self._bindings[key] = [func]
        return "%d%s" % (id(func), getattr(func, "__name__", "f"))

    def unbind(self, sequence, funcid=None):
        self._bindings.pop(_parse_sequence(sequence), None)

    def bind_all(self, sequence=None, func=None, add=None):
        return self.bind(sequence, func, add)

    def unbind_all(self, sequence):
        self.unbind(sequence)

    def _fire(self, kind, detail, event):
        funcs = self._bindings.get((kind, detail))
        if funcs is None and detail is not None:
            funcs = self._bindings.get((kind, None))
        for f in list(funcs or ()):
            if f(event) == "break":
                break

    # -- timers --
    def after(self, ms, func=None, *args):
        if func is None:
            _app.flush()
            _tkhost.sleep(int(ms))
            return None
        _app.timer_seq += 1
        tid = "after#%d" % _app.timer_seq
        _app.timers.append([_time.monotonic() + max(0, ms) / 1000.0, _app.timer_seq, func, args, tid])
        return tid

    def after_idle(self, func, *args):
        return self.after(0, func, *args)

    def after_cancel(self, tid):
        _app.timers[:] = [t for t in _app.timers if t[4] != tid]

    # -- event loop --
    def update(self):
        if _app.destroyed:
            raise TclError("can't invoke \"update\" command: application has been destroyed")
        _app.update()

    def update_idletasks(self):
        _app.flush()

    def mainloop(self, n=0):
        _app.mainloop()

    def quit(self):
        _app.quit_flag = True

    def wait_window(self, window=None):
        _app.mainloop()

    # -- focus, grabs --
    def focus_force(self):
        # Programs call listen() every frame; the page only needs telling once in a while.
        now = _time.monotonic()
        if now - _app.focus_sent > 0.5:
            _app.focus_sent = now
            _post({"t": "focus"})

    focus_set = focus = focus_force

    def grab_set(self):
        pass

    def grab_release(self):
        pass

    # -- winfo --
    def winfo_toplevel(self):
        return _app.root or self

    def winfo_width(self):
        return _app.width

    def winfo_height(self):
        return _app.height

    def winfo_reqwidth(self):
        return _app.width

    def winfo_reqheight(self):
        return _app.height

    def winfo_screenwidth(self):
        return int(_tkhost.screen()[0])

    def winfo_screenheight(self):
        return int(_tkhost.screen()[1])

    def winfo_rootx(self):
        return 0

    def winfo_rooty(self):
        return 0

    def winfo_x(self):
        return 0

    def winfo_y(self):
        return 0

    def winfo_exists(self):
        return 0 if _app.destroyed else 1

    def winfo_ismapped(self):
        return 1

    def winfo_viewable(self):
        return 1

    def winfo_rgb(self, color):
        hexed = _parse_color(color)
        if hexed is None:
            raise TclError('unknown color name "%s"' % color)
        r, g, b = int(hexed[1:3], 16), int(hexed[3:5], 16), int(hexed[5:7], 16)
        return (r * 257, g * 257, b * 257)

    # -- options --
    def configure(self, cnf=None, **kw):
        if cnf:
            kw.update(cnf)
        self._options.update(kw)
        self._configured(kw)

    config = configure

    def _configured(self, kw):
        pass

    def cget(self, key):
        return self._options.get(key, "")

    def __getitem__(self, key):
        return self.cget(key)

    def __setitem__(self, key, value):
        self.configure({key: value})

    def keys(self):
        return list(self._options.keys())

    # -- geometry managers and other things that only matter on a desktop --
    def _noop(self, *args, **kw):
        return None

    pack = pack_configure = pack_forget = grid = grid_configure = grid_forget = _noop
    place = place_configure = place_forget = _noop
    rowconfigure = columnconfigure = grid_rowconfigure = grid_columnconfigure = _noop
    lift = tkraise = lower = _noop
    bell = _noop
    event_generate = _noop

    def destroy(self):
        pass


class Wm:
    def wm_title(self, string=None):
        if string is None:
            return self._title
        self._title = string
        _post({"t": "title", "text": str(string)})

    title = wm_title

    def wm_geometry(self, newGeometry=None):
        if newGeometry is None:
            return "%dx%d+0+0" % (_app.width, _app.height)
        size = newGeometry.split("+")[0].split("-")[0]
        if "x" in size:
            w, h = size.split("x")
            _app.width, _app.height = int(float(w)), int(float(h))
            _post({"t": "geometry", "w": _app.width, "h": _app.height})
            self._fire("Configure", None, self._configure_event())
        return ""

    geometry = wm_geometry

    def _configure_event(self):
        e = Event()
        e.widget = self
        e.width, e.height = _app.width, _app.height
        e.x = e.y = 0
        e.type = "22"
        return e

    def wm_protocol(self, name=None, func=None):
        if func is None:
            return self._protocols.get(name)
        self._protocols[name] = func

    protocol = wm_protocol

    def _noop(self, *args, **kw):
        return ""

    wm_resizable = resizable = wm_iconbitmap = iconbitmap = wm_iconphoto = iconphoto = _noop
    wm_minsize = minsize = wm_maxsize = maxsize = wm_attributes = attributes = _noop
    wm_deiconify = deiconify = wm_withdraw = withdraw = wm_iconify = iconify = _noop
    wm_transient = transient = wm_overrideredirect = overrideredirect = _noop
    wm_state = state = _noop


class Tk(Misc, Wm):
    def __init__(self, screenName=None, baseName=None, className="Tk", useTk=True,
                 sync=False, use=None):
        global _default_root
        Misc.__init__(self)
        self._title = "tk"
        self._protocols = {}
        _app.root = self
        _app.destroyed = False
        _default_root = self
        _post({"t": "window"})

    def _close_requested(self):
        handler = self._protocols.get("WM_DELETE_WINDOW")
        if handler is not None:
            handler()
        else:
            self.destroy()

    def destroy(self):
        global _default_root
        if _app.destroyed:
            return
        _app.flush()
        _app.destroyed = True
        _app.quit_flag = True
        _default_root = None
        _post({"t": "destroy"})

    def report_callback_exception(self, exc, val, tb):
        import traceback
        traceback.print_exception(exc, val, tb)


Toplevel = Tk


class Widget(Misc):
    def __init__(self, master=None, cnf=None, **kw):
        Misc.__init__(self)
        self.master = master if master is not None else _default_root
        if cnf:
            kw.update(cnf)
        self._options.update(kw)


class BaseWidget(Widget):
    pass


class Frame(Widget):
    pass


class Label(Widget):
    pass


class Button(Widget):
    pass


class Entry(Widget):
    def get(self):
        return ""


class Scrollbar(Widget):
    def set(self, *args):
        pass


class Canvas(Widget):
    def __init__(self, master=None, cnf=None, **kw):
        Widget.__init__(self, master, cnf, **kw)
        self._items = {}
        self._order = []
        self._next_id = 1
        self._dirty = set()
        self._deleted = []
        self._order_changed = False
        self._bg_sent = None
        self._tag_bindings = {}
        _app.canvases.append(self)
        self._options.setdefault("bg", "white")

    # -- bookkeeping --
    def _configured(self, kw):
        if "background" in kw:
            self._options["bg"] = kw["background"]

    def _resolve(self, tag_or_id):
        if tag_or_id is None:
            return []
        if isinstance(tag_or_id, int) or (isinstance(tag_or_id, str) and tag_or_id.isdigit()):
            iid = int(tag_or_id)
            return [iid] if iid in self._items else []
        if tag_or_id == "all":
            return list(self._order)
        return [i for i in self._order if tag_or_id in self._items[i].tags]

    def _touch(self, item):
        item.layout = None
        item.compute_bbox()
        self._dirty.add(item.id)

    def _create(self, kind, args, kw):
        coords = [float(v) for v in _flatten(args)]
        iid = self._next_id
        self._next_id += 1
        opts = {}
        for k, v in kw.items():
            k = k.rstrip("_")
            if k == "tags":
                continue
            opts[k] = v
        item = _Item(iid, kind, coords, opts)
        tags = kw.get("tags", kw.get("tag"))
        if tags:
            item.tags = list(tags) if isinstance(tags, (tuple, list)) else str(tags).split()
        self._items[iid] = item
        self._order.append(iid)
        self._order_changed = True
        self._touch(item)
        return iid

    def create_line(self, *args, **kw):
        return self._create("line", args, kw)

    def create_polygon(self, *args, **kw):
        kw.setdefault("fill", "black")
        kw.setdefault("outline", "")
        return self._create("polygon", args, kw)

    def create_text(self, *args, **kw):
        kw.setdefault("fill", "black")
        return self._create("text", args, kw)

    def create_image(self, *args, **kw):
        return self._create("image", args, kw)

    def create_rectangle(self, *args, **kw):
        kw.setdefault("outline", "black")
        return self._create("rectangle", args, kw)

    def create_oval(self, *args, **kw):
        kw.setdefault("outline", "black")
        return self._create("oval", args, kw)

    def coords(self, tag_or_id, *args):
        ids = self._resolve(tag_or_id)
        if not ids:
            return []
        if not args:
            return list(self._items[ids[0]].coords)
        coords = [float(v) for v in _flatten(args)]
        item = self._items[ids[0]]
        item.coords = coords
        self._touch(item)
        return None

    def itemconfigure(self, tag_or_id, cnf=None, **kw):
        if cnf:
            kw.update(cnf)
        for iid in self._resolve(tag_or_id):
            item = self._items[iid]
            for k, v in kw.items():
                k = k.rstrip("_")
                if k == "tags":
                    item.tags = list(v) if isinstance(v, (tuple, list)) else str(v).split()
                else:
                    item.opts[k] = v
            self._touch(item)

    itemconfig = itemconfigure

    def itemcget(self, tag_or_id, option):
        ids = self._resolve(tag_or_id)
        if not ids:
            return ""
        item = self._items[ids[0]]
        if item.type == "image" and option not in ("anchor", "image", "activeimage",
                                                   "disabledimage", "state", "tags"):
            raise TclError('unknown option "-%s"' % option)
        defaults = {"fill": "black" if item.type in ("polygon", "text") else "",
                    "width": "1.0", "outline": "", "capstyle": "butt",
                    "joinstyle": "round", "anchor": "center", "state": ""}
        v = item.opts.get(option, defaults.get(option, ""))
        if option == "width":
            return str(float(v))
        if option == "font" and isinstance(v, (tuple, list)):
            return " ".join(("{%s}" % p) if " " in str(p) else str(p) for p in v)
        if isinstance(v, PhotoImage):
            return v.name
        return v if isinstance(v, str) else str(v)

    def type(self, tag_or_id):
        ids = self._resolve(tag_or_id)
        return self._items[ids[0]].type if ids else None

    def gettags(self, tag_or_id):
        ids = self._resolve(tag_or_id)
        return tuple(self._items[ids[0]].tags) if ids else ()

    def addtag_withtag(self, newtag, tag_or_id):
        for iid in self._resolve(tag_or_id):
            if newtag not in self._items[iid].tags:
                self._items[iid].tags.append(newtag)

    def dtag(self, tag_or_id, tag_to_delete=None):
        for iid in self._resolve(tag_or_id):
            t = self._items[iid].tags
            if tag_to_delete in t:
                t.remove(tag_to_delete)

    def delete(self, *args):
        for a in args:
            for iid in self._resolve(a):
                if iid in self._items:
                    del self._items[iid]
                    self._order.remove(iid)
                    self._dirty.discard(iid)
                    self._deleted.append(iid)
                    self._order_changed = True

    def tag_raise(self, tag_or_id, above=None):
        ids = self._resolve(tag_or_id)
        if not ids:
            return
        for iid in ids:
            self._order.remove(iid)
        if above is None:
            self._order.extend(ids)
        else:
            ref = self._resolve(above)
            pos = (self._order.index(ref[-1]) + 1) if ref else len(self._order)
            self._order[pos:pos] = ids
        self._order_changed = True

    tkraise = lift = tag_raise

    def tag_lower(self, tag_or_id, below=None):
        ids = self._resolve(tag_or_id)
        if not ids:
            return
        for iid in ids:
            self._order.remove(iid)
        if below is None:
            self._order[0:0] = ids
        else:
            ref = self._resolve(below)
            pos = self._order.index(ref[0]) if ref else 0
            self._order[pos:pos] = ids
        self._order_changed = True

    lower = tag_lower

    def move(self, tag_or_id, dx, dy):
        for iid in self._resolve(tag_or_id):
            item = self._items[iid]
            item.coords = [v + (dx if k % 2 == 0 else dy) for k, v in enumerate(item.coords)]
            self._touch(item)

    def bbox(self, *args):
        boxes = []
        for a in args:
            for iid in self._resolve(a):
                b = self._items[iid].bbox
                if b[0] >= b[2] or b[1] >= b[3]:
                    continue
                boxes.append(b)
        if not boxes:
            return None
        return (min(b[0] for b in boxes), min(b[1] for b in boxes),
                max(b[2] for b in boxes), max(b[3] for b in boxes))

    def find_all(self):
        return tuple(self._order)

    def find_withtag(self, tag_or_id):
        return tuple(self._resolve(tag_or_id))

    def _find_area(self, x1, y1, x2, y2, enclosed):
        r = [float(x1), float(y1), float(x2), float(y2)]
        if r[0] > r[2]:
            r[0], r[2] = r[2], r[0]
        if r[1] > r[3]:
            r[1], r[3] = r[3], r[1]
        ix1 = int(r[0] - 1.0)
        iy1 = int(r[1] - 1.0)
        ix2 = int(r[2] + 1.0)
        iy2 = int(r[3] + 1.0)
        found = []
        for iid in self._order:
            item = self._items[iid]
            if item.opts.get("state") == "hidden":
                continue
            b = item.bbox
            if (b[0] >= ix2) or (b[2] <= ix1) or (b[1] >= iy2) or (b[3] <= iy1):
                continue
            if item.area(r) >= enclosed:
                found.append(iid)
        return tuple(found)

    def find_overlapping(self, x1, y1, x2, y2):
        return self._find_area(x1, y1, x2, y2, 0)

    def find_enclosed(self, x1, y1, x2, y2):
        return self._find_area(x1, y1, x2, y2, 1)

    def find_closest(self, x, y, halo=None, start=None):
        hits = self._find_area(x - 1, y - 1, x + 1, y + 1, 0)
        return (hits[-1],) if hits else ((self._order[-1],) if self._order else ())

    # -- scrolling: the view is always centred on the origin --
    def canvasx(self, screenx, gridspacing=None):
        return float(screenx) - _app.width / 2.0

    def canvasy(self, screeny, gridspacing=None):
        return float(screeny) - _app.height / 2.0

    def xview(self, *args):
        return (0.0, 1.0)

    def yview(self, *args):
        return (0.0, 1.0)

    def xview_moveto(self, fraction):
        pass

    def yview_moveto(self, fraction):
        pass

    def xview_scroll(self, number, what):
        pass

    def yview_scroll(self, number, what):
        pass

    def tag_bind(self, tag_or_id, sequence=None, func=None, add=None):
        key = (str(tag_or_id), _parse_sequence(sequence))
        if func is None:
            return self._tag_bindings.get(key)
        if add and str(add).startswith("+"):
            self._tag_bindings.setdefault(key, []).append(func)
        else:
            self._tag_bindings[key] = [func]
        return "tb%d" % id(func)

    def tag_unbind(self, tag_or_id, sequence, funcid=None):
        self._tag_bindings.pop((str(tag_or_id), _parse_sequence(sequence)), None)

    def _fire_tag_bindings(self, kind, detail, event):
        if not self._tag_bindings:
            return
        x, y = self.canvasx(event.x), self.canvasy(event.y)
        hits = self._find_area(x, y, x, y, 0)
        if not hits:
            return
        top = self._items[hits[-1]]
        for tag in [str(top.id)] + top.tags:
            funcs = self._tag_bindings.get((tag, (kind, detail)))
            for f in list(funcs or ()):
                f(event)

    def postscript(self, cnf=None, **kw):
        raise TclError("postscript output is not available in the browser")

    # -- sending the scene to the page --
    def _flush(self):
        bg = self._options.get("bg", "white")
        msg = None
        if self._dirty or self._deleted or self._order_changed or bg != self._bg_sent:
            msg = {"t": "draw"}
            if self._dirty:
                msg["items"] = {str(i): self._items[i].snapshot() for i in self._dirty
                                if i in self._items}
            if self._deleted:
                msg["del"] = self._deleted
            if self._order_changed:
                msg["order"] = self._order
            if bg != self._bg_sent:
                msg["bg"] = _parse_color(bg) or "#ffffff"
                self._bg_sent = bg
            _post(msg)
            self._dirty = set()
            self._deleted = []
            self._order_changed = False


class PhotoImage:
    _count = 0

    def __init__(self, name=None, cnf=None, master=None, **kw):
        PhotoImage._count += 1
        self.name = name or "pyimage%d" % PhotoImage._count
        self._w = int(kw.get("width", 0) or 0)
        self._h = int(kw.get("height", 0) or 0)
        self._file = kw.get("file")

    def blank(self):
        pass

    def width(self):
        return self._w

    def height(self):
        return self._h

    def __str__(self):
        return self.name


class StringVar:
    def __init__(self, master=None, value="", name=None):
        self._v = value

    def get(self):
        return self._v

    def set(self, v):
        self._v = v


def mainloop(n=0):
    _app.mainloop()


def _test():
    pass
