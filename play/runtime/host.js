// The page side of the Python player: starts the worker, draws what the
// program's tkinter canvas holds, and passes keys, clicks, dialog answers and
// typed lines back to it. See worker.js and tkinter/__init__.py.
//
// PlayHost.mount(stageElement, {
//   mode: "turtle" | "terminal",
//   files: { "path/in/python/fs.py": "url relative to the page", ... },
//   main: "path/in/python/fs.py",   // run as __main__
//   cwd: "folder",                   // working directory, holds saved files
//   key: "localStorage key for files the program writes",
//   autostart: true,                 // run as soon as Python is ready
// })

(function () {
  "use strict";

  const RING_BYTES = 1 << 16;

  // Tk keysyms for the keys a browser reports by name.
  const KEYSYM = {
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    " ": "space", Enter: "Return", Escape: "Escape", Backspace: "BackSpace",
    Tab: "Tab", Delete: "Delete", Insert: "Insert", Home: "Home", End: "End",
    PageUp: "Prior", PageDown: "Next", Shift: "Shift_L", Control: "Control_L",
    Alt: "Alt_L", Meta: "Super_L", CapsLock: "Caps_Lock",
    ".": "period", ",": "comma", ";": "semicolon", "'": "apostrophe", "/": "slash",
    "\\": "backslash", "-": "minus", "=": "equal", "[": "bracketleft", "]": "bracketright",
    "`": "grave", "!": "exclam", "@": "at", "#": "numbersign", "$": "dollar",
    "%": "percent", "^": "asciicircum", "&": "ampersand", "*": "asterisk",
    "(": "parenleft", ")": "parenright", "_": "underscore", "+": "plus",
    "{": "braceleft", "}": "braceright", "|": "bar", ":": "colon", '"': "quotedbl",
    "<": "less", ">": "greater", "?": "question", "~": "asciitilde",
  };
  for (let i = 1; i <= 12; i++) KEYSYM["F" + i] = "F" + i;

  function keysymOf(e) {
    if (KEYSYM[e.key]) return KEYSYM[e.key];
    if (e.key.length === 1) return e.key;
    return e.key;
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function loadSaved(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; }
  }

  function storeSaved(key, files) {
    try { localStorage.setItem(key, JSON.stringify(files)); } catch (e) { }
  }

  // ---------------------------------------------------------------------
  // The turtle window: a canvas inside a small desktop-style frame.

  function TurtleWindow(parent, onEvent) {
    const frame = el("div", "pyWindow");
    const bar = el("div", "pyWindowBar");
    const title = el("span", "pyWindowTitle", "Python Turtle Graphics");
    const close = el("button", "pyWindowClose", "×");
    close.type = "button";
    close.title = "Close the window, as you would on a desktop";
    close.setAttribute("aria-label", "Close the turtle window");
    bar.append(title, close);
    const canvas = el("canvas", "pyCanvas");
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Game window. Click it, then use the keyboard.");
    frame.append(bar, canvas);
    parent.append(frame);

    const ctx = canvas.getContext("2d");
    const items = new Map();
    let order = [];
    let bg = "#ffffff";
    let W = 450, H = 340, scale = 1;
    let queued = false;

    function layout() {
      const room = parent.clientWidth || W;
      scale = Math.max(0.5, Math.min(2, (room - 4) / W));
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = W * scale + "px";
      canvas.style.height = H * scale + "px";
      canvas.width = Math.round(W * scale * dpr);
      canvas.height = Math.round(H * scale * dpr);
      frame.style.width = W * scale + 4 + "px";
      draw();
    }

    function strokePath(c, closed) {
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      for (let i = 2; i < c.length; i += 2) ctx.lineTo(c[i], c[i + 1]);
      if (closed) ctx.closePath();
    }

    function draw() {
      queued = false;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2);
      for (const id of order) {
        const it = items.get(id);
        if (!it || it.hidden) continue;
        const c = it.c;
        if (it.k === "line") {
          if (!it.f || c.length < 2) continue;
          const width = Math.max(1, it.w);
          const cap = it.cap === "projecting" ? "square" : it.cap;
          let zero = true;
          for (let i = 2; i < c.length; i += 2) {
            if (c[i] !== c[0] || c[i + 1] !== c[1]) { zero = false; break; }
          }
          ctx.fillStyle = it.f;
          ctx.strokeStyle = it.f;
          if (zero) {
            // A zero-length line is how turtle draws dot(); Tk paints its cap.
            if (cap === "round") {
              ctx.beginPath();
              ctx.arc(c[0], c[1], width / 2, 0, Math.PI * 2);
              ctx.fill();
            } else if (cap === "square") {
              ctx.fillRect(c[0] - width / 2, c[1] - width / 2, width, width);
            }
            continue;
          }
          ctx.lineWidth = width;
          ctx.lineCap = cap;
          ctx.lineJoin = it.join;
          strokePath(c, false);
          ctx.stroke();
        } else if (it.k === "polygon") {
          if (c.length < 4) continue;
          strokePath(c, true);
          if (it.f) {
            ctx.fillStyle = it.f;
            ctx.fill("evenodd");
          }
          if (it.o) {
            ctx.lineWidth = Math.max(1, it.w);
            ctx.lineJoin = "round";
            ctx.strokeStyle = it.o;
            ctx.stroke();
          }
        } else if (it.k === "text") {
          if (!it.f) continue;
          ctx.font = it.font;
          ctx.fillStyle = it.f;
          ctx.textBaseline = "alphabetic";
          ctx.textAlign = "left";
          const lines = it.t.split("\n");
          lines.forEach((line, i) => {
            const ch = it.ch[i] || [0, 0];
            ctx.fillText(line, it.ox + ch[0], it.oy + ch[1] + it.asc);
          });
        } else if (it.k === "rectangle" || it.k === "oval") {
          if (c.length < 4) continue;
          ctx.beginPath();
          if (it.k === "rectangle") {
            ctx.rect(c[0], c[1], c[2] - c[0], c[3] - c[1]);
          } else {
            ctx.ellipse((c[0] + c[2]) / 2, (c[1] + c[3]) / 2,
              Math.abs(c[2] - c[0]) / 2, Math.abs(c[3] - c[1]) / 2, 0, 0, Math.PI * 2);
          }
          if (it.f) { ctx.fillStyle = it.f; ctx.fill(); }
          if (it.o) { ctx.lineWidth = Math.max(1, it.w); ctx.strokeStyle = it.o; ctx.stroke(); }
        }
      }
    }

    function schedule() {
      if (queued) return;
      queued = true;
      // A hidden tab still gets drawn, so the picture is right when it returns.
      if (document.hidden) setTimeout(draw, 16);
      else requestAnimationFrame(draw);
    }

    // ---- input ----
    function widgetXY(e) {
      const r = canvas.getBoundingClientRect();
      return { x: Math.round((e.clientX - r.left) / scale), y: Math.round((e.clientY - r.top) / scale) };
    }
    function stateOf(e) {
      return (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 4 : 0) | (e.altKey ? 8 : 0);
    }
    canvas.addEventListener("keydown", (e) => {
      if (e.metaKey || (e.ctrlKey && (e.key === "r" || e.key === "R"))) return;
      if (e.key !== "Tab") e.preventDefault();
      onEvent({ t: "keypress", keysym: keysymOf(e), char: e.key.length === 1 ? e.key : "", state: stateOf(e) });
    });
    canvas.addEventListener("keyup", (e) => {
      onEvent({ t: "keyrelease", keysym: keysymOf(e), char: e.key.length === 1 ? e.key : "", state: stateOf(e) });
    });
    canvas.addEventListener("mousedown", (e) => {
      canvas.focus({ preventScroll: true });
      e.preventDefault();
      onEvent(Object.assign({ t: "buttonpress", num: e.button + 1, state: stateOf(e) }, widgetXY(e)));
    });
    canvas.addEventListener("mouseup", (e) => {
      onEvent(Object.assign({ t: "buttonrelease", num: e.button + 1, state: stateOf(e) }, widgetXY(e)));
    });
    canvas.addEventListener("mousemove", (e) => {
      if (!e.buttons) return;
      const held = e.buttons & 1 ? "1" : e.buttons & 4 ? "2" : "3";
      onEvent(Object.assign({ t: "motion", buttons: held, state: stateOf(e) }, widgetXY(e)));
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    close.addEventListener("click", () => onEvent({ t: "close" }));
    window.addEventListener("resize", layout);

    layout();

    return {
      element: frame,
      canvas,
      apply(msg) {
        if (msg.items) for (const [id, it] of Object.entries(msg.items)) items.set(+id, it);
        if (msg.del) for (const id of msg.del) items.delete(id);
        if (msg.order) order = msg.order;
        if (msg.bg) bg = msg.bg;
        schedule();
      },
      geometry(w, h) { W = w; H = h; layout(); },
      title(text) { title.textContent = text; },
      focus() {
        const a = document.activeElement;
        if (!a || a === document.body || a === canvas) canvas.focus({ preventScroll: true });
      },
      closed(on) { frame.classList.toggle("isClosed", on); },
      clear() { items.clear(); order = []; bg = "#ffffff"; schedule(); },
    };
  }

  // ---------------------------------------------------------------------
  // A console for programs that talk through print() and input().

  function Console(parent, onLine, accepting) {
    const box = el("div", "pyTerminal");
    parent.append(box);
    const term = new window.Terminal({
      convertEol: true,
      cursorBlink: true,
      cols: 92,
      rows: 34,
      scrollback: 2000,
      fontFamily: 'Consolas, "Cascadia Mono", "Lucida Console", "Courier New", monospace',
      fontSize: 15,
      theme: { background: "#0c0c0c", foreground: "#cccccc", cursor: "#cccccc" },
    });
    term.open(box);

    let line = "";
    term.onData((chunk) => {
      if (!accepting()) return;
      for (const ch of chunk.replace(/\r\n/g, "\r")) {
        if (ch === "\r" || ch === "\n") {
          term.write("\r\n");
          onLine(line);
          line = "";
        } else if (ch === "\u007f" || ch === "\b") {
          if (line.length) {
            line = line.slice(0, -1);
            term.write("\b \b");
          }
        } else if (ch >= " " && ch !== "\u007f") {
          line += ch;
          term.write(ch);
        }
      }
    });

    function fit() {
      // Keep the console's width fixed in columns, like a desktop window, and size the font to fit.
      const room = parent.clientWidth;
      if (!room) return;
      const size = Math.max(10, Math.min(16, Math.floor((room - 24) / (92 * 0.6))));
      if (term.options.fontSize !== size) term.options.fontSize = size;
    }
    window.addEventListener("resize", fit);
    fit();

    return {
      element: box,
      write(text) { term.write(text); },
      cls() { term.write("\x1b[H\x1b[2J\x1b[3J"); },
      focus() { term.focus(); },
      reset() { term.reset(); line = ""; },
    };
  }

  // A plain read-only console, for turtle programs that print now and then.
  function PlainConsole(parent) {
    const pre = el("pre", "pyConsole");
    pre.hidden = true;
    parent.append(pre);
    return {
      write(text) {
        pre.hidden = false;
        pre.textContent += text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
        pre.scrollTop = pre.scrollHeight;
      },
      cls() { pre.textContent = ""; },
      reset() { pre.textContent = ""; pre.hidden = true; },
    };
  }

  // ---------------------------------------------------------------------
  // simpledialog, drawn over the stage.

  function askDialog(parent, msg, answer) {
    const shade = el("div", "pyDialogShade");
    const box = el("form", "pyDialog");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    const head = el("div", "pyDialogTitle", msg.title);
    const prompt = el("label", "pyDialogPrompt", msg.prompt);
    const input = el("input");
    input.type = "text";
    input.value = msg.initial || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    prompt.append(input);
    const row = el("div", "pyDialogButtons");
    const ok = el("button", "", "OK");
    ok.type = "submit";
    const cancel = el("button", "", "Cancel");
    cancel.type = "button";
    row.append(ok, cancel);
    box.append(head, prompt, row);
    shade.append(box);
    parent.append(shade);
    input.focus();

    function done(value) {
      shade.remove();
      answer(value);
    }
    box.addEventListener("submit", (e) => { e.preventDefault(); done(input.value); });
    cancel.addEventListener("click", () => done(null));
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); done(null); } });
    return shade;
  }

  // ---------------------------------------------------------------------

  function mount(stage, opts) {
    const status = stage.querySelector(".pyStatus");
    const runBtn = stage.querySelector(".pyRun");
    const stopBtn = stage.querySelector(".pyStop");
    const screenArea = stage.querySelector(".pyScreen");

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    if (!window.crossOriginIsolated) {
      const sw = "serviceWorker" in navigator && window.isSecureContext;
      status.textContent = sw
        ? "Setting the page up. If this message stays, your browser is blocking the service worker this page needs (private windows often do), so try a normal window."
        : "This browser cannot run the games here: it has no service workers, which the page needs to give Python a shared buffer.";
      runBtn.hidden = true;
      return;
    }

    let worker = null;
    let ring = null;
    let ctl = null, data = null;
    let state = "idle";
    let openDialog = null;
    let view = null;
    let out = null;
    let startMessage = null;
    const encoder = new TextEncoder();

    function push(ev) {
      if (!ring || state !== "running") return;
      const bytes = encoder.encode(JSON.stringify(ev));
      const size = data.length;
      const w = Atomics.load(ctl, 0);
      const r = Atomics.load(ctl, 1);
      const used = (w - r + size) % size;
      const need = 4 + bytes.length;
      if (used + need >= size - 1) return;
      const head = [bytes.length & 255, (bytes.length >> 8) & 255, (bytes.length >> 16) & 255, (bytes.length >> 24) & 255];
      for (let i = 0; i < 4; i++) data[(w + i) % size] = head[i];
      for (let i = 0; i < bytes.length; i++) data[(w + 4 + i) % size] = bytes[i];
      Atomics.store(ctl, 0, (w + need) % size);
      Atomics.add(ctl, 2, 1);
      Atomics.notify(ctl, 2);
    }

    if (opts.mode === "turtle") {
      view = TurtleWindow(screenArea, push);
      out = PlainConsole(screenArea);
    } else {
      out = Console(screenArea, (text) => push({ t: "line", text }), () => state === "running");
      view = null;
    }

    function setState(next, text) {
      state = next;
      stage.dataset.state = next;
      if (text != null) status.textContent = text;
      runBtn.hidden = !(next === "ready" || next === "ended");
      runBtn.textContent = next === "ended" ? "Play again" : "Start";
      stopBtn.hidden = next !== "running";
    }

    function boot(autorun) {
      if (worker) worker.terminate();
      if (openDialog) { openDialog.remove(); openDialog = null; }
      ring = new SharedArrayBuffer(16 + RING_BYTES);
      ctl = new Int32Array(ring, 0, 4);
      data = new Uint8Array(ring, 16);
      if (view) { view.clear(); view.closed(false); }
      out.reset();
      setState("loading", "Loading Python (about 10 MB the first time)");

      worker = new Worker(new URL("runtime/worker.js", location.href).href, { type: "module" });
      worker.onmessage = (e) => handle(e.data, autorun);
      worker.onerror = (e) => setState("ended", "The Python worker failed to start: " + (e.message || "unknown error"));
      startMessage = {
        t: "start",
        sab: ring,
        files: opts.files,
        main: opts.main,
        cwd: opts.cwd,
        saved: loadSaved(opts.key),
        pageUrl: location.href,
        screen: [screen.width, screen.height],
      };
    }

    function run() {
      if (state !== "ready") return;
      setState("running", opts.runningText || "Running.");
      worker.postMessage({ t: "run" });
      if (view) view.canvas.focus({ preventScroll: true });
      else out.focus();
    }

    function handle(msg, autorun) {
      switch (msg.t) {
        case "hello":
          worker.postMessage(startMessage);
          break;
        case "status":
          if (state === "loading") status.textContent = msg.text;
          break;
        case "ready":
          setState("ready", opts.readyText || "Ready.");
          if (autorun) run();
          break;
        case "running":
          break;
        case "out":
          out.write(msg.text);
          break;
        case "py":
          program(JSON.parse(msg.body));
          break;
        case "exit":
          if (openDialog) { openDialog.remove(); openDialog = null; }
          if (msg.error) {
            out.write("\r\n" + msg.error.replace(/\n/g, "\r\n"));
            setState("ended", "The program stopped with an error, shown below the window.");
          } else {
            setState("ended", opts.endedText || "The program has finished.");
          }
          break;
      }
    }

    function program(msg) {
      switch (msg.t) {
        case "draw": view && view.apply(msg); break;
        case "geometry": view && view.geometry(msg.w, msg.h); break;
        case "title": view && view.title(msg.text); break;
        case "window": view && view.closed(false); break;
        case "destroy": view && view.closed(true); break;
        case "focus": view && view.focus(); break;
        case "cls": out.cls(); break;
        case "files": storeSaved(opts.key, msg.files); break;
        case "ask":
          openDialog = askDialog(view ? view.element.parentNode : screenArea, msg, (value) => {
            openDialog = null;
            push({ t: "answer", value });
            if (view) view.canvas.focus({ preventScroll: true });
          });
          break;
      }
    }

    runBtn.addEventListener("click", () => {
      if (state === "ready") run();
      else if (state === "ended") boot(true);
    });
    stopBtn.addEventListener("click", () => {
      if (worker) worker.terminate();
      worker = null;
      if (openDialog) { openDialog.remove(); openDialog = null; }
      setState("ended", "Stopped.");
    });

    boot(!!opts.autostart);
  }

  window.PlayHost = { mount };
})();
