/* The page side of /projects/mcu-snake.html. Builds the two boards, runs the emulated pair
   from stm32.js in step with the real clock, turns keys into button presses, and draws what
   travels on the four wires between the boards. */

(function () {
  "use strict";

  var root = document.getElementById("snakeRig");
  if (!root || !window.Stm32) return;
  var BASE = root.getAttribute("data-base") || "/projects/mcu-snake/";
  var MS = 48000;                                               // cycles per millisecond

  // Where each board is in main.c's state machine, from the `wfi` it last slept in.
  var LINE_STATE = { 73: "init", 96: "button", 119: "p1", 135: "p2", 154: "seed", 189: "game", 197: "over" };
  var STATES = {
    init: ["WAIT_FOR_INIT", "Has raised its ready line and waits for the other board's."],
    button: ["WAIT_FOR_BUTTON", "Both boards are ready. Waits for a button here, or a 'p' from the other board."],
    p1: ["PLAYER_1_WAIT_FOR_PLAYER_2", "Its button came first, so it is player 1. Waits for the other board's 'p'."],
    p2: ["PLAYER_2_WAIT_FOR_INPUT", "The other board's 'p' came first, so this is player 2. Waits for a button here."],
    seed: ["PLAYER_2_RECEIVE_SEED", "Has sent its 'p'. Waits for player 1's random seed."],
    setup: ["GAME", "Setting up: starts the LCD, shows its snake's colour for a second, draws the board."],
    game: ["GAME", "Every tick it sends its direction, waits for the other board's, then moves both snakes."],
    over: ["GAME", "Game over. Shows the winner's colour and waits for a reset."],
    off: ["", "Powered off."]
  };

  // button_input.c: PA9 left, PA10 up, PA11 down, PA12 right.
  var PIN = { up: 10, left: 9, down: 11, right: 12 };
  var KEYS = {
    KeyW: [0, "up"], KeyA: [0, "left"], KeyS: [0, "down"], KeyD: [0, "right"],
    ArrowUp: [1, "up"], ArrowLeft: [1, "left"], ArrowDown: [1, "down"], ArrowRight: [1, "right"]
  };
  var LABEL = [{ up: "W", left: "A", down: "S", right: "D" }, { up: "↑", left: "←", down: "↓", right: "→" }];
  var KEY_TEXT = ["W, A, S or D", "an arrow key"];
  var NAME = ["A", "B"];
  var DIR = [["right", "→"], ["up", "↑"], ["left", "←"], ["down", "↓"]];
  var SNAKE = { 1: ["blue", "#0000ff"], 2: ["green", "#00ff00"] };

  var pair, wfiLine = {}, sym = {}, ui = [], wires;
  var pending = [];                                             // [{t, fn, kind}] in emulated time
  var held = [{}, {}];
  var wallNow = 0, last = 0;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var statusEl = root.querySelector(".rigStatus");
  var powerBtn = root.querySelector(".rigPower");
  var resetBtn = root.querySelector(".rigReset");

  Promise.all([
    fetch(BASE + "firmware/firmware.bin").then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
    fetch(BASE + "firmware/firmware.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  ]).then(function (res) { start(res[0], res[1]); }, function () {
    statusEl.textContent = "The firmware image did not load. Reload the page to try again.";
  });

  function start(bin, meta) {
    Object.keys(meta.wfi).forEach(function (k) { wfiLine[parseInt(k, 16)] = parseInt(meta.wfi[k].split(":")[1], 10); });
    Object.keys(meta.symbols).forEach(function (k) { sym[k] = parseInt(meta.symbols[k], 16); });
    pair = new Stm32.Pair(bin);
    pair.boards.forEach(function (m) {
      m.onHalt = function (why) { if (window.console) console.warn("board " + m.name + " stopped: " + why); };
    });
    buildBoards();
    wires = makeWires(root.querySelector(".wires canvas"));
    pair.on(onSignal);

    powerBtn.addEventListener("click", function () { if (anyPowered() || isPending("boot")) powerOff(); else powerOn(); });
    resetBtn.addEventListener("click", resetBoth);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", releaseAll);

    powerBtn.hidden = false; resetBtn.hidden = false;
    statusEl.textContent = "Both boards are off. Power them on to start.";
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- boards ---- */

  function buildBoards() {
    root.querySelectorAll(".board").forEach(function (host, i) {
      var b = { host: host };
      var head = el("div", "boardHead");
      head.appendChild(el("span", "boardName", "Board " + NAME[i]));
      b.role = head.appendChild(el("span", "boardRole", i ? "arrow keys" : "W A S D"));
      host.appendChild(head);

      var mod = el("div", "lcdModule"), glass = el("div", "lcdGlass");
      b.canvas = el("canvas"); b.canvas.width = 240; b.canvas.height = 320;
      b.canvas.setAttribute("role", "img");
      b.canvas.setAttribute("aria-label", "Board " + NAME[i] + "'s LCD");
      glass.appendChild(b.canvas); mod.appendChild(glass);
      host.appendChild(mod);
      b.ctx = b.canvas.getContext("2d");
      b.img = b.ctx.createImageData(240, 320);
      b.px = new Uint32Array(b.img.data.buffer);
      b.shown = "";

      var mcu = el("div", "mcuBoard"), leds = el("div", "leds");
      b.leds = [6, 7, 8, 9].map(function (p) {
        var l = el("span", "led"); l.appendChild(el("i"));
        l.title = "Debug light"; leds.appendChild(l); return l;
      });
      mcu.appendChild(leds);
      b.nrst = el("button", "nrst", "RESET"); b.nrst.type = "button";
      b.nrst.title = "Reset board " + NAME[i];
      b.nrst.addEventListener("click", function () { resetBoard(i); });
      mcu.appendChild(b.nrst);
      host.appendChild(mcu);

      var pad = el("div", "pad"); b.pad = {};
      ["up", "left", "down", "right"].forEach(function (d) {
        var btn = el("button", d); btn.type = "button";
        btn.appendChild(document.createTextNode(LABEL[i][d]));
        btn.setAttribute("aria-label", "Board " + NAME[i] + " " + d + " button");
        btn.addEventListener("pointerdown", function (e) { e.preventDefault(); btn.setPointerCapture(e.pointerId); press(i, d); });
        ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (ev) { btn.addEventListener(ev, function () { release(i, d); }); });
        pad.appendChild(btn); b.pad[d] = btn;
      });
      host.appendChild(pad);

      var st = el("div", "boardState");
      b.stateName = st.appendChild(el("code"));
      st.appendChild(document.createElement("br"));
      b.stateNote = st.appendChild(el("span"));
      b.vars = st.appendChild(el("span", "boardVars"));
      host.appendChild(st);
      ui.push(b);
    });
  }

  function stateOf(m) {
    if (!m.powered) return "off";
    var line = wfiLine[m.lastWfi];
    if (line === 197) return "over";
    if (line === 189) return "game";
    if ((m.gpio[2].odr >> 8) & 1) return "setup";            // main.c lights PC8 on entering GAME
    return LINE_STATE[line] || "init";
  }
  function ramWord(m, a) { return m.r32[(a - 0x20000000) >>> 2] | 0; }
  function ramByte(m, a) { return m.ram[a - 0x20000000]; }

  var LUT = new Uint32Array(65536);
  (function () {
    for (var c = 0; c < 65536; c++) {
      var r = Math.round(((c >> 11) & 31) * 255 / 31), g = Math.round(((c >> 5) & 63) * 255 / 63), bl = Math.round((c & 31) * 255 / 31);
      LUT[c] = ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0;
    }
  })();
  var WHITE = LUT[0xFFFF], DARK = LUT[0x0841];

  function drawBoard(i) {
    var m = pair.boards[i], b = ui[i], lcd = m.lcd;
    if (lcd.dirty) {
      lcd.dirty = false;
      if (lcd.visible()) { var fb = lcd.fb, px = b.px; for (var k = 0; k < fb.length; k++) px[k] = LUT[fb[k]]; }
      else b.px.fill(lcd.powered ? WHITE : DARK);              // backlight on, nothing driven / no power
      b.ctx.putImageData(b.img, 0, 0);
    }
    var odr = m.powered ? m.gpio[2].odr : 0;
    for (var p = 0; p < 4; p++) b.leds[p].classList.toggle("isOn", !!((odr >> (6 + p)) & 1));

    var s = stateOf(m), player = m.powered ? ramWord(m, sym.player_num) : 0;
    var vars = "";
    if (m.powered) {
      var t = m.tim15;
      vars = "player_num = " + player + "  seed = " + ramByte(m, sym.seed) +
        ((t.cr1 & 1) ? "  tick = " + Math.round((t.arr + 1) * (t.pscActive + 1) / MS) + " ms" : "");
    }
    var key = s + "|" + player + "|" + vars;
    if (key !== b.shown) {
      b.shown = key;
      b.stateName.textContent = STATES[s][0];
      b.stateName.hidden = !STATES[s][0];
      b.stateNote.textContent = STATES[s][1];
      b.vars.textContent = vars;
      b.role.textContent = "";
      if (SNAKE[player] && s !== "button" && s !== "init") {
        var sw = el("span", "swatch"); sw.style.background = SNAKE[player][1];
        b.role.appendChild(sw); b.role.appendChild(document.createTextNode("player " + player + ", " + SNAKE[player][0]));
      } else b.role.textContent = i ? "arrow keys" : "W A S D";
    }
  }

  /* ------------------------------------------------------- time and input ---- */

  function at(t, fn, kind) { pending.push({ t: t, fn: fn, kind: kind }); pending.sort(function (a, b) { return a.t - b.t; }); }
  function cancel(kind) { pending = pending.filter(function (p) { return p.kind !== kind; }); }
  function isPending(kind) { return pending.some(function (p) { return p.kind === kind; }); }
  function anyPowered() { return pair.boards[0].powered || pair.boards[1].powered; }

  function frame(now) {
    var dt = last ? Math.min(now - last, 100) : 16;           // a background tab simply pauses
    last = now; wallNow = now;
    if (anyPowered() || pending.length) {
      var target = pair.now + Math.round(dt * MS);
      while (pending.length && pending[0].t <= target) {
        var p = pending.shift();
        if (p.t > pair.now) pair.run(p.t - pair.now);
        p.fn();
      }
      if (target > pair.now) pair.run(target - pair.now);
    }
    drawBoard(0); drawBoard(1);
    wires.draw(now);
    updateStatus();
    requestAnimationFrame(frame);
  }

  function press(i, d) {
    var h = held[i][d];
    if (h) { h.releasing = false; return; }
    held[i][d] = { downAt: pair.now, releasing: false };
    pair.button(i, PIN[d], true);
    ui[i].pad[d].classList.add("isDown");
  }
  function release(i, d) {
    var h = held[i][d];
    if (!h || h.releasing) return;
    h.releasing = true;
    // TIM6 reads the buttons every 10 ms. Hold each press for at least one scan, as a finger would.
    at(Math.max(pair.now, h.downAt + 12 * MS), function () {
      if (held[i][d] !== h || !h.releasing) return;
      delete held[i][d];
      pair.button(i, PIN[d], false);
      ui[i].pad[d].classList.remove("isDown");
    }, "key");
  }
  function releaseAll() {
    cancel("key");
    [0, 1].forEach(function (i) {
      Object.keys(held[i]).forEach(function (d) { pair.button(i, PIN[d], false); ui[i].pad[d].classList.remove("isDown"); });
      held[i] = {};
    });
  }
  function onKey(e) {
    var k = KEYS[e.code];
    if (!k || e.ctrlKey || e.metaKey || e.altKey) return;
    var r = root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;    // leave the keys alone while reading further down
    if (!anyPowered() && !isPending("boot")) return;
    e.preventDefault();
    if (e.type === "keydown") { if (!e.repeat) press(k[0], k[1]); }
    else release(k[0], k[1]);
  }

  // Two boards plugged in or reset by hand never start on the same clock cycle. The gap
  // matters: player 1's seed is its TIM6 count, which would always be about 0 if both
  // timers started together.
  function stagger(fn) {
    var first = Math.random() < 0.5 ? 0 : 1;
    fn(first);
    at(pair.now + Math.round((40 + Math.random() * 260) * MS), function () { fn(1 - first); }, "boot");
  }
  function powerOn() {
    wires.clear();
    stagger(function (i) { pair.powerOn(i); });
    powerBtn.textContent = "Power off";
  }
  function powerOff() {
    cancel("boot"); releaseAll();
    pair.powerOff(0); pair.powerOff(1);
    powerBtn.textContent = "Power on";
  }
  function resetBoth() {
    if (!anyPowered()) return;
    cancel("boot");
    stagger(function (i) { if (pair.boards[i].powered) pair.reset(i); else pair.powerOn(i); });
  }
  function resetBoard(i) {
    if (!pair.boards[i].powered) return;
    pair.reset(i);
  }

  /* --------------------------------------------------------------- status ---- */

  var lastStatus = "";
  function winner() {
    var fb = pair.boards[0].lcd.fb, top = fb[80 * 240 + 120], bottom = fb[240 * 240 + 120];
    if (top === 0x001F && bottom === 0x07E0) return "a tie";
    if (top === 0x001F && bottom === 0x001F) return "blue wins";
    if (top === 0x07E0 && bottom === 0x07E0) return "green wins";
    return "see the screens";
  }
  function updateStatus() {
    var A = pair.boards[0], B = pair.boards[1], a = stateOf(A), b = stateOf(B), s;
    var p1 = a === "p1" ? 0 : b === "p1" ? 1 : -1;
    resetBtn.disabled = !anyPowered();
    ui.forEach(function (u, i) { u.nrst.disabled = !pair.boards[i].powered; });
    if (!A.powered && !B.powered) s = isPending("boot") ? "Powering on." : "Both boards are off. Power them on to start.";
    else if (!A.powered || !B.powered) s = "Board " + NAME[A.powered ? 1 : 0] + " comes on a moment after board " + NAME[A.powered ? 0 : 1] + ", as two boards plugged in by hand would.";
    else if (a === "init" || b === "init") s = "Starting up. Each board raises its ready line and waits for the other's.";
    else if (a === "button" && b === "button") s = "Ready. Press a key on each side: W A S D for board A, the arrow keys for board B. Whichever board sees its button first is player 1, the blue snake.";
    else if (p1 >= 0 && (a === "p2" || b === "p2" || a === "button" || b === "button")) s = "Board " + NAME[p1] + " is player 1 (blue). Board " + NAME[1 - p1] + " is player 2 (green): press " + KEY_TEXT[1 - p1] + " to start.";
    else if (/seed|setup/.test(a + b) && /^(p1|seed|setup|game)$/.test(a) && /^(p1|seed|setup|game)$/.test(b)) s = "Seed sent. Each screen shows its own snake's colour for a second, then the game starts.";
    else if (a === "game" && b === "game") s = "Playing. W A S D steers board A's snake, the arrow keys board B's.";
    else if (a === "over" && b === "over") s = "Game over: " + winner() + ". Reset both boards to play again.";
    else if (a === "over" || b === "over") s = "Game over on one board. Reset both to play again.";
    else s = "The boards are out of step. Reset both to start again.";
    if (s !== lastStatus) { lastStatus = s; statusEl.textContent = s; }
  }

  /* ------------------------------------------------------------- signals ---- */

  // What a byte means depends on where the sender is in the state machine.
  function label(from, byte) {
    var s = stateOf(pair.boards[from]);
    if (s === "setup" || s === "game" || s === "over") return DIR[byte] ? hex2(byte) + " " + DIR[byte][1] : hex2(byte);
    if (s === "p1") return hex2(byte) + " seed";
    return byte === 0x70 ? "0x70 'p'" : hex2(byte);
  }
  function hex2(v) { return "0x" + (v < 16 ? "0" : "") + v.toString(16); }

  function onSignal(e) {
    if (e.type === "uart") wires.packet(e.from, e.byte, label(e.from, e.byte), wallNow);
    else if (e.type === "gpio") wires.level(e.from, e.level, wallNow);
  }

  /* -------------------------------------------------------------- wires ---- */

  function makeWires(canvas) {
    var ctx = canvas.getContext("2d"), W = 0, H = 0, colors = null, frames = 0;
    var UART_MS = 750, EDGE_MS = 320;
    var gpio = [{ level: null, was: null, at: -1e9 }, { level: null, was: null, at: -1e9 }];
    var uart = [[], []], lastRx = [null, null];

    function size() {
      var r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = r.width; H = r.height;
    }
    function readColors() {
      var cs = getComputedStyle(root);
      colors = {
        accent: cs.getPropertyValue("--accent").trim() || "#1cf",
        text: cs.getPropertyValue("--text").trim() || "#fff",
        muted: cs.getPropertyValue("--muted").trim() || "#999",
        idle: cs.getPropertyValue("--wire-idle").trim() || "#666"
      };
    }

    // Lane geometry: two GPIO lines on top, the two UART lines under them.
    function lanes() {
      return [0.2, 0.36, 0.62, 0.78].map(function (f) { return Math.round(H * f) + 0.5; });
    }

    function line(points, color, width, dash) {
      ctx.beginPath();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      points.forEach(function (p, k) { if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    function text(s, x, y, color, align, size, alpha) {
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.fillStyle = color; ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
      ctx.font = (size || 11) + "px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.fillText(s, x, y); ctx.globalAlpha = 1;
    }
    function arrow(x, y, dir, color) {
      ctx.beginPath(); ctx.fillStyle = color;
      ctx.moveTo(x, y); ctx.lineTo(x - dir * 7, y - 4.5); ctx.lineTo(x - dir * 7, y + 4.5); ctx.closePath(); ctx.fill();
    }

    function drawGpio(i, y, x0, x1, now) {
      var g = gpio[i], dir = i === 0 ? 1 : -1, xs = dir > 0 ? x0 : x1, xe = dir > 0 ? x1 : x0, amp = 7;
      var u = Math.min(1, (now - g.at) / EDGE_MS), xm = xs + (xe - xs) * u;
      function yl(l) { return l === 1 ? y - amp : l === 0 ? y + amp : y; }
      function col(l) { return l === 1 ? colors.accent : l === 0 ? colors.text : colors.idle; }
      // New level from the driving end to the travelling edge, the old one beyond it.
      line([[xs, yl(g.level)], [xm, yl(g.level)]], col(g.level), 2, g.level === null ? [4, 4] : null);
      if (u < 1) {
        line([[xm, yl(g.level)], [xm, yl(g.was)]], colors.muted, 1.5);
        line([[xm, yl(g.was)], [xe, yl(g.was)]], col(g.was), 2, g.was === null ? [4, 4] : null);
      }
      var lv = u < 1 ? g.was : g.level;
      arrow(xe + dir * 7, yl(lv), dir, col(lv));
      text(g.level === 1 ? "high" : g.level === 0 ? "low" : "floating", xs + dir * 4, y + amp + 12, colors.muted, dir > 0 ? "left" : "right", 11);
    }

    function drawUart(i, y, x0, x1, now) {
      var dir = i === 0 ? 1 : -1, xs = dir > 0 ? x0 : x1, xe = dir > 0 ? x1 : x0, amp = 7;
      var L = x1 - x0, bw = Math.max(4, Math.min(10, L / 30)), wp = bw * 10, list = uart[i];
      line([[x0, y - amp], [x1, y - amp]], colors.idle, 2);
      arrow(xe + dir * 7, y - amp, dir, colors.idle);
      for (var k = list.length - 1; k >= 0; k--) {
        var p = list[k], front = ((now - p.start) / UART_MS) * (L + wp);
        if (front >= L && !p.arrived) { p.arrived = true; lastRx[i] = { label: p.label, at: now }; }
        if (front - wp > L) { list.splice(k, 1); continue; }
        // Bit 0 (the start bit) leads; 8 data bits follow, least significant first; then the stop bit.
        var pts = [], prev = null;
        for (var b = 0; b <= 9; b++) {
          var lv = b === 0 ? 0 : b === 9 ? 1 : (p.byte >> (b - 1)) & 1;
          var d0 = Math.max(0, Math.min(L, front - (b + 1) * bw)), d1 = Math.max(0, Math.min(L, front - b * bw));
          if (d1 <= d0) continue;
          var yy = lv ? y - amp : y + amp, xa = xs + dir * d1, xb = xs + dir * d0;
          if (prev !== null && prev !== yy) pts.push([xa, prev]);
          pts.push([xa, yy], [xb, yy]); prev = yy;
        }
        if (pts.length) {
          // Rising back to idle behind the stop bit.
          ctx.save(); ctx.shadowColor = colors.accent; ctx.shadowBlur = 6;
          line(pts, colors.accent, 2); ctx.restore();
          var mid = xs + dir * Math.max(wp / 2, Math.min(L - wp / 2, front - wp / 2));
          text(p.label, mid, y - amp - 13, colors.accent, "center", 12);
        }
      }
      var rx = lastRx[i];
      if (rx) {
        var age = (now - rx.at) / 2000;
        text("RX " + rx.label, xe - dir * 2, y + amp + 12, colors.text, dir > 0 ? "right" : "left", 11, Math.max(0.35, 1 - age));
      }
    }

    return {
      clear: function () { uart = [[], []]; lastRx = [null, null]; },
      level: function (i, lv, now) { var g = gpio[i]; g.was = (now - g.at < EDGE_MS) ? g.was : g.level; g.level = lv; g.at = now; },
      packet: function (i, byte, label, now) {
        var list = uart[i];
        // Bytes sent in the same instant would sit on top of each other; space them out.
        var lastStart = list.length ? list[list.length - 1].start : -1e9;
        list.push({ byte: byte, label: label, start: Math.max(now, lastStart + 260) });
      },
      draw: function (now) {
        if (!colors || ++frames % 30 === 0) readColors();
        size();
        ctx.clearRect(0, 0, W, H);
        if (W < 60) return;
        var ys = lanes(), x0 = 28, x1 = W - 28;
        var gTop = ys[0] - 40, uTop = ys[2] - 42;
        text("ready lines (GPIO)", W / 2, gTop, colors.muted, "center", 11);
        text("USART1, 115200 baud", W / 2, uTop, colors.muted, "center", 11);
        ys.forEach(function (y) {
          line([[0, y], [x0 - 10, y]], colors.idle, 1); line([[x1 + 10, y], [W, y]], colors.idle, 1);
        });
        drawGpio(0, ys[0], x0, x1, now); drawGpio(1, ys[1], x0, x1, now);
        drawUart(0, ys[2], x0, x1, now); drawUart(1, ys[3], x0, x1, now);
        text("A → B", W / 2, ys[0] - 20, colors.text, "center", 11, 0.7);
        text("B → A", W / 2, ys[1] - 20, colors.text, "center", 11, 0.7);
        text("A → B", W / 2, ys[2] + 19, colors.text, "center", 11, 0.7);
        text("B → A", W / 2, ys[3] + 19, colors.text, "center", 11, 0.7);
      }
    };
  }
})();
