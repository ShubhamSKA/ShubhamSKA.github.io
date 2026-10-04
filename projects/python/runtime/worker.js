// Runs one Python program in Pyodide, off the page's main thread.
//
// The program is the original source, untouched. What changes is the machine
// under it: time.sleep blocks this worker instead of a desktop process, input()
// and keyboard/mouse events arrive through a SharedArrayBuffer the page writes
// into, and tkinter is the stand-in in ./tkinter, which sends drawing back to
// the page. Blocking here is fine because the page keeps running.

// A module worker, because under cross-origin isolation Chrome refuses the
// no-cors request that importScripts makes to the CDN.
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.mjs";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/";

let ctl, data, dataSize;            // the shared event ring, see host.js
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const send = (msg) => postMessage(msg);

// ---- reading events the page queued ----
function poll() {
  const w = Atomics.load(ctl, 0);
  const r = Atomics.load(ctl, 1);
  if (w === r) return undefined;   // undefined arrives in Python as None; null would not
  const at = (i) => data[(r + i) % dataSize];
  const len = at(0) | (at(1) << 8) | (at(2) << 16) | (at(3) << 24);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = at(4 + i);
  Atomics.store(ctl, 1, (r + 4 + len) % dataSize);
  return decoder.decode(bytes);
}

function wait(ms) {
  const seq = Atomics.load(ctl, 2);
  if (Atomics.load(ctl, 0) !== Atomics.load(ctl, 1)) return;
  Atomics.wait(ctl, 2, seq, Math.max(0, ms));
}

function sleep(ms) {
  // Index 3 is never written, so this is a plain timed block.
  if (ms > 0) Atomics.wait(ctl, 3, 0, ms);
}

// ---- text measurement and colour parsing, done the way the page will draw ----
const measureCtx = new OffscreenCanvas(4, 4).getContext("2d");
function measure(font, text) {
  measureCtx.font = font;
  const m = measureCtx.measureText(text);
  const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] || "11");
  const ascent = m.fontBoundingBoxAscent ?? px * 0.905;
  const descent = m.fontBoundingBoxDescent ?? px * 0.212;
  return [m.width, ascent, descent];
}

function color(name) {
  measureCtx.fillStyle = "#010203";
  measureCtx.fillStyle = name;
  const first = measureCtx.fillStyle;
  measureCtx.fillStyle = "#040506";
  measureCtx.fillStyle = name;
  if (first === "#010203" && measureCtx.fillStyle === "#040506") return undefined;
  const v = measureCtx.fillStyle;
  if (v.startsWith("#")) return v;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v);
  if (!m) return undefined;
  return "#" + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("");
}

let screenSize = [1920, 1080];

// ---- stdout, line-buffered like a console ----
function makeWriter(stream) {
  const dec = new TextDecoder();
  return {
    write(buf) {
      send({ t: "out", stream, text: dec.decode(buf, { stream: true }) });
      return buf.length;
    },
    isatty: true,
  };
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load " + url + " (" + res.status + ")");
  return res.text();
}

// Python run before the program: the bits of a desktop session that the
// browser lacks.
const PRELUDE = `
import builtins, os, sys, time, json, _tkhost

def _sleep(secs):
    secs = float(secs)
    if secs < 0:
        raise ValueError("sleep length must be non-negative")
    _tkhost.sleep(int(secs * 1000))
time.sleep = _sleep

_line_queue = []
def _input(prompt=""):
    sys.stdout.write(str(prompt))
    sys.stdout.flush()
    import tkinter
    while True:
        tkinter._app._poll()
        for i, ev in enumerate(tkinter._app.pending):
            if ev.get("t") == "line":
                del tkinter._app.pending[i]
                return ev["text"]
            if ev.get("t") == "eof":
                del tkinter._app.pending[i]
                raise EOFError
        tkinter._app.pending = [e for e in tkinter._app.pending if e.get("t") in ("line", "eof")]
        tkinter._app._wait(250)
builtins.input = _input

def _system(command):
    sys.stdout.flush()
    if str(command).strip().lower() in ("cls", "clear"):
        _tkhost.post(json.dumps({"t": "cls"}))
        return 0
    sys.stdout.write("'%s' is not recognized as an internal or external command,\\noperable program or batch file.\\n" % command)
    return 1
os.system = _system
`;

const PLAYHOST = `
import json, os, _tkhost

_saved = {}

def idle():
    """Called before the program blocks on the player: hands any files it wrote to the page."""
    files = {}
    for name in os.listdir("."):
        if name.endswith(".txt") and os.path.isfile(name):
            with open(name, encoding="utf-8", errors="replace") as f:
                files[name] = f.read()
    if files != _saved:
        _saved.clear()
        _saved.update(files)
        _tkhost.post(json.dumps({"t": "files", "files": files}))
`;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.t !== "start") return;
  try {
    ctl = new Int32Array(msg.sab, 0, 4);
    data = new Uint8Array(msg.sab, 16);
    dataSize = data.length;
    screenSize = msg.screen || screenSize;

    send({ t: "status", text: "Loading Python" });
    const pyodide = await loadPyodide({ indexURL: PYODIDE });
    pyodide.setStdout(makeWriter("out"));
    pyodide.setStderr(makeWriter("err"));

    pyodide.registerJsModule("_tkhost", {
      post: (s) => send({ t: "py", body: s }),
      poll,
      wait,
      sleep,
      measure,
      color,
      screen: () => screenSize,
    });

    send({ t: "status", text: "Loading the game" });
    const FS = pyodide.FS;
    const base = new URL(".", self.location.href).href;
    const lib = "/home/pyodide/lib";
    FS.mkdirTree(lib + "/tkinter");
    for (const name of ["tkinter/__init__.py", "tkinter/simpledialog.py", "turtle.py"]) {
      FS.writeFile(lib + "/" + name, await fetchText(base + name));
    }
    FS.writeFile(lib + "/_playhost.py", PLAYHOST);

    const root = "/home/pyodide/games";
    for (const [path, url] of Object.entries(msg.files)) {
      const full = root + "/" + path;
      FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
      FS.writeFile(full, await fetchText(new URL(url, msg.pageUrl).href));
    }
    const cwd = root + "/" + msg.cwd;
    FS.mkdirTree(cwd);
    for (const [name, text] of Object.entries(msg.saved || {})) {
      FS.writeFile(cwd + "/" + name, text);
    }

    pyodide.runPython(`
import sys, os
sys.path.insert(0, ${JSON.stringify(lib)})
sys.path.insert(0, ${JSON.stringify(root)})
os.chdir(${JSON.stringify(cwd)})
sys.stdout.reconfigure(line_buffering=True)
`);
    pyodide.runPython(PRELUDE);

    send({ t: "ready" });
    await new Promise((resolve) => {
      self.onmessage = (ev) => { if (ev.data.t === "run") resolve(); };
    });
    send({ t: "running" });

    let exitText = "";
    try {
      pyodide.runPython(`
import runpy, sys
sys.argv = [${JSON.stringify(msg.main)}]
try:
    runpy.run_path(${JSON.stringify(root + "/" + msg.main)}, run_name="__main__")
finally:
    sys.stdout.flush()
    sys.stderr.flush()
    try:
        import _playhost
        _playhost.idle()
    except Exception:
        pass
`);
    } catch (err) {
      const text = String(err.message || err);
      // exit() and sys.exit() end the program the way a console would.
      if (!/SystemExit/.test(text)) exitText = text;
    }
    send({ t: "exit", error: exitText });
  } catch (err) {
    send({ t: "exit", error: String(err && err.message || err) });
  }
};

send({ t: "hello" });
