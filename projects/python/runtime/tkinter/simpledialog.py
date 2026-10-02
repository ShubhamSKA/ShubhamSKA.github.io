"""tkinter.simpledialog for the browser: the page shows the dialog, and the
program waits for the answer the way it would wait on a modal Tk dialog."""

import tkinter as _tk


def _ask(kind, title, prompt, **kw):
    msg = {"t": "ask", "kind": kind, "title": str(title), "prompt": str(prompt)}
    initial = kw.get("initialvalue")
    if initial is not None:
        msg["initial"] = str(initial)
    for bound in ("minvalue", "maxvalue"):
        if kw.get(bound) is not None:
            msg[bound] = kw[bound]
    _tk._post(msg)
    ev = _tk._app.wait_for("answer")
    if ev is None or ev.get("value") is None:
        return None
    return ev["value"]


def askstring(title, prompt, **kw):
    return _ask("string", title, prompt, **kw)


def askinteger(title, prompt, **kw):
    while True:
        v = _ask("integer", title, prompt, **kw)
        if v is None:
            return None
        try:
            value = int(v)
        except ValueError:
            continue
        lo, hi = kw.get("minvalue"), kw.get("maxvalue")
        if (lo is not None and value < lo) or (hi is not None and value > hi):
            continue
        return value


def askfloat(title, prompt, **kw):
    while True:
        v = _ask("float", title, prompt, **kw)
        if v is None:
            return None
        try:
            value = float(v)
        except ValueError:
            continue
        lo, hi = kw.get("minvalue"), kw.get("maxvalue")
        if (lo is not None and value < lo) or (hi is not None and value > hi):
            continue
        return value


class Dialog:
    def __init__(self, parent, title=None):
        pass
