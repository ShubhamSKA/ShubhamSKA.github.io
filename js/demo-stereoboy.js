// A playable StereoBoy. The shell, buttons and VU meter are SVG; the 240x240
// display is a canvas drawn in the firmware's own coordinates, following
// StereoBoy_Firmware (lib/sb_util/core1_entry.c, lib/display/fft.c,
// lib/led_driver/led_driver.c, lib/sb_util/jukebox.c):
//
//   oscilloscope   right channel centred at y=90, left at y=150, white traces
//   spectrum       mirrored bars from y=120, right channel up in cyan, left
//                  down in green, with the falling part of each bar lighter
//   album art      160x160, centred, in 16-bit colour
//   overlay        play/pause/seek icon top left, title marquee from x=30,
//                  elapsed time at y=210, progress bar along the bottom
//   VU meter       8 LEDs per channel, linear steps, partial top LED
//   pause/resume   the "tape warp": playback slows to a stop over 0.6 s and
//                  spins back up over 1.2 s, pitch and all
//
// Only the basics are here: power, play/pause, seek, volume and switching
// between three visualisers. The track comes from the figure's data-src,
// data-title, data-artist and data-art attributes.
(function () {
  var fig = document.getElementById("demo-stereoboy");
  if (!fig) return;
  var stage = fig.querySelector(".demoStage");
  var NS = "http://www.w3.org/2000/svg";

  var TRACK = {
    src: fig.getAttribute("data-src"),
    title: fig.getAttribute("data-title") || "Untitled",
    artist: fig.getAttribute("data-artist") || "",
    art: fig.getAttribute("data-art")
  };

  // ---- firmware constants --------------------------------------------------
  var SCOPE_R_Y = 90, SCOPE_L_Y = 150, SCOPE_HALF = 30;
  var FFT_MID = 120, FFT_MAX = 110, FFT_BARS = 32;
  var PAUSE_WARP_MS = 600, RESUME_WARP_MS = 1200;
  var MIN_RATE = 9000 / 44100; // the codec rate is clamped at 9 kHz
  var SKIP_S = 2, SKIP_EVERY_MS = 100, BLINK_MS = 250;
  var VU_FULL = 600 / 806; // MAX_AMPLITUDE over half the ADC swing
  var MODES = ["art", "scope", "fft"]; // SELECT steps through these
  var BOOT_MS = 900;
  var FFT_DARK = { l: "rgb(0,194,0)", r: "rgb(0,190,255)" };
  var FFT_LIGHT = { l: "rgb(140,255,140)", r: "rgb(173,255,255)" };
  var ICONS = {
    play: ["....................", "....................", "....................", "....................", "....##..............", "....####............", "....######..........", "....########........", "....##########......", "....############....", "....############....", "....##########......", "....########........", "....######..........", "....####............", "....##..............", "....................", "....................", "....................", "...................."],
    pause: ["....................", "....................", "....................", ".......#....#.......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", "......###..###......", ".......#....#.......", "....................", "....................", "...................."],
    ff: ["....................", "....................", "....................", "....................", "...##.....##........", "...###....###.......", "...####...####......", "...#####..#####.....", "...######.######....", "...##############...", "...##############...", "...######.######....", "...#####..#####.....", "...####...####......", "...###....###.......", "...##.....##........", "....................", "....................", "....................", "...................."]
  };
  ICONS.rew = ICONS.ff.map(function (row) {
    return row.split("").reverse().join("");
  });

  // ---- shell geometry, in its own units (5 per mm of a Game Boy Pocket) ----
  var VB = { x: -16, y: -18, w: 424, h: 676 };
  var SCREEN = { x: 66, y: 98, s: 164 }; // active area of the LCD

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(str, attrs, parent) {
    var t = el("text", attrs, parent);
    t.textContent = str;
    return t;
  }

  // ---- build the device ----------------------------------------------------
  stage.classList.add("splitStage", "sbStage");
  var device = document.createElement("div");
  device.className = "sbDevice";
  stage.appendChild(device);

  var svg = el("svg", {
    viewBox: [VB.x, VB.y, VB.w, VB.h].join(" "),
    role: "group",
    "aria-label": "StereoBoy, a music player in a handheld game console shell"
  }, device);
  var defs = el("defs", {}, svg);
  var g1 = el("linearGradient", { id: "sbShell", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  el("stop", { offset: 0, "stop-color": "#e0343a" }, g1);
  el("stop", { offset: 1, "stop-color": "#a8161d" }, g1);
  var g2 = el("linearGradient", { id: "sbBezel", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: 0, "stop-color": "#a4a7ad" }, g2);
  el("stop", { offset: 1, "stop-color": "#8b8e95" }, g2);
  var glow = el("filter", { id: "sbGlow", x: "-150%", y: "-150%", width: "400%", height: "400%" }, defs);
  el("feGaussianBlur", { stdDeviation: 4 }, glow);

  // Controls that sit behind the shell edge: the volume wheel and the switch.
  var wheel = el("g", { class: "sbWheel" }, svg);
  el("rect", { x: 372, y: 150, width: 30, height: 104, rx: 8, fill: "#262628" }, wheel);
  var ridges = el("g", { stroke: "#4a4a4e", "stroke-width": 2.2 }, wheel);
  var ridgeLines = [];
  for (var ri = 0; ri < 18; ri++) ridgeLines.push(el("line", { x1: 390, x2: 401, y1: 0, y2: 0 }, ridges));

  el("rect", { x: 40, y: -9, width: 76, height: 12, rx: 3, fill: "#3a0b0e" }, svg);
  var knob = el("rect", { class: "sbKnob", x: 46, y: -12, width: 24, height: 14, rx: 3, fill: "#2a2a2c" }, svg);

  // Shell.
  el("path", {
    d: "M24,0 H364 Q388,0 388,24 V508 Q388,638 258,638 H36 Q0,638 0,602 V24 Q0,0 24,0 Z",
    fill: "url(#sbShell)", stroke: "#7c0e13", "stroke-width": 2
  }, svg);
  el("path", {
    d: "M28,7 H360 Q381,7 381,28 V506 Q381,631 258,631 H38 Q7,631 7,600 V28 Q7,7 28,7 Z",
    fill: "none", stroke: "#fff", "stroke-opacity": 0.12, "stroke-width": 1.5
  }, svg);
  text("OFF", { x: 50, y: 22, class: "sbEmboss" }, svg);
  text("ON", { x: 92, y: 22, class: "sbEmboss" }, svg);
  text("VOL", { x: 372, y: 202, class: "sbEmboss", transform: "rotate(90 372 202)", "text-anchor": "middle" }, svg);
  text("+", { x: 373, y: 160, class: "sbEmboss", "text-anchor": "middle" }, svg);
  text("−", { x: 373, y: 252, class: "sbEmboss", "text-anchor": "middle" }, svg);

  // Bezel and window.
  el("path", {
    d: "M36,30 H352 Q362,30 362,40 V256 Q362,318 300,318 H36 Q26,318 26,308 V40 Q26,30 36,30 Z",
    fill: "url(#sbBezel)"
  }, svg);
  el("rect", { x: 52, y: 46, width: 286, height: 228, rx: 3, fill: "#0b0b0d", stroke: "#2a2b2f", "stroke-width": 1.5 }, svg);

  // What shows of the board through the window.
  var pcb = el("g", { class: "sbPcb" }, svg);
  for (var si = 0; si < 5; si++) {
    el("path", { d: "M" + (62 + si * 16) + ",54 l10,0 l-6,10 l-10,0 Z", fill: "#e8e8e8", opacity: 0.85 }, pcb);
  }
  text("ENGINEERING PROTOTYPE", { x: 150, y: 64, class: "sbSilk" }, pcb);
  text("StereoBoy", { x: 330, y: 172, class: "sbSilkBig", transform: "rotate(-90 330 172)" }, pcb);
  for (var ti = 0; ti < 8; ti++) el("rect", { x: 304, y: 60 + ti * 16, width: 6, height: 1.6, fill: "#e8e8e8", opacity: 0.8 }, pcb);
  el("rect", { x: 248, y: 242, width: 30, height: 22, fill: "#1c1c20", stroke: "#3a3a40" }, pcb);
  el("rect", { x: 286, y: 246, width: 40, height: 14, fill: "#1c1c20", stroke: "#3a3a40" }, pcb);
  [[266, 214], [302, 214]].forEach(function (c) {
    el("circle", { cx: c[0], cy: c[1], r: 13, fill: "#d9dadf", stroke: "#8a8b90" }, pcb);
    el("circle", { cx: c[0], cy: c[1], r: 9, fill: "#c7262f", opacity: 0.85 }, pcb);
    el("circle", { cx: c[0], cy: c[1], r: 3, fill: "#d9dadf" }, pcb);
  });
  // LCD module around the active area.
  el("rect", { x: SCREEN.x - 8, y: SCREEN.y - 8, width: SCREEN.s + 16, height: SCREEN.s + 18, rx: 2, fill: "#151517", stroke: "#3c3d42" }, pcb);
  el("rect", { x: SCREEN.x - 1, y: SCREEN.y - 1, width: SCREEN.s + 2, height: SCREEN.s + 2, fill: "#000" }, pcb);

  // VU meter: left channel on the left column, bottom to top 5 green, 2 yellow, 1 red.
  var LED_COL = { off: ["#123a1b", "#123a1b", "#123a1b", "#123a1b", "#123a1b", "#3f3810", "#3f3810", "#451210"], on: ["#3cf06a", "#3cf06a", "#3cf06a", "#3cf06a", "#3cf06a", "#ffd83a", "#ffd83a", "#ff3b30"] };
  var leds = { l: [], r: [] };
  var ledGlow = el("g", { filter: "url(#sbGlow)" }, svg);
  var ledLit = el("g", {}, svg);
  [["l", 264], ["r", 290]].forEach(function (col) {
    for (var i = 0; i < 8; i++) {
      var cy = 174 - i * 16;
      el("circle", { cx: col[1], cy: cy, r: 7, fill: LED_COL.off[i], stroke: "#000", "stroke-opacity": 0.5 }, pcb);
      var lit = el("circle", { cx: col[1], cy: cy, r: 7, fill: LED_COL.on[i], opacity: 0 }, ledLit);
      var halo = el("circle", { cx: col[1], cy: cy, r: 8, fill: LED_COL.on[i], opacity: 0 }, ledGlow);
      el("circle", { cx: col[1] - 2.2, cy: cy - 2.4, r: 2, fill: "#fff", opacity: 0.35 }, svg);
      leds[col[0]].push({ lit: lit, halo: halo });
    }
  });

  // Power LED and the wordmark on the bezel.
  var powerLed = el("circle", { cx: 38, cy: 148, r: 3.6, fill: "#3a0d0d" }, svg);
  var powerGlow = el("circle", { cx: 38, cy: 148, r: 6, fill: "#ff2a1f", opacity: 0, filter: "url(#sbGlow)" }, svg);
  [5, 8, 11].forEach(function (r) {
    el("path", { d: "M" + (38 + r * 0.7) + "," + (148 - r * 0.7) + " A" + r + "," + r + " 0 0 1 " + (38 + r * 0.7) + "," + (148 + r * 0.7), fill: "none", stroke: "#3d3f44", "stroke-width": 1.1 }, svg);
  });
  text("POWER", { x: 40, y: 168, class: "sbBezelText", "text-anchor": "middle" }, svg);
  text("StereoBoy", { x: 58, y: 302, class: "sbWordmark" }, svg);
  text("MODULAR STEREO SYSTEM", { x: 172, y: 301, class: "sbBezelText" }, svg);

  // D-pad.
  var DP = { x: 92, y: 430, w: 15, l: 45 };
  el("circle", { cx: DP.x, cy: DP.y, r: 56, fill: "#000", opacity: 0.16 }, svg);
  el("path", {
    d: "M" + [[-DP.w, -DP.l], [DP.w, -DP.l], [DP.w, -DP.w], [DP.l, -DP.w], [DP.l, DP.w], [DP.w, DP.w], [DP.w, DP.l], [-DP.w, DP.l], [-DP.w, DP.w], [-DP.l, DP.w], [-DP.l, -DP.w], [-DP.w, -DP.w]].map(function (p) {
      return DP.x + p[0] + "," + (DP.y + p[1]);
    }).join(" L") + " Z",
    fill: "#ececef", stroke: "#b9b9c0", "stroke-width": 2, "stroke-linejoin": "round"
  }, svg);
  el("circle", { cx: DP.x, cy: DP.y, r: 7, fill: "#000", opacity: 0.07 }, svg);
  [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d) {
    var cx = DP.x + d[0] * 32, cy = DP.y + d[1] * 32;
    var px = -d[1], py = d[0];
    el("path", { d: "M" + (cx + d[0] * 6) + "," + (cy + d[1] * 6) + " L" + (cx - d[0] * 4 + px * 6) + "," + (cy - d[1] * 4 + py * 6) + " L" + (cx - d[0] * 4 - px * 6) + "," + (cy - d[1] * 4 - py * 6) + " Z", fill: "#000", opacity: 0.13 }, svg);
  });

  // A and B.
  el("rect", { x: 230, y: 372, width: 128, height: 64, rx: 32, fill: "#000", opacity: 0.14, transform: "rotate(-26 294 404)" }, svg);
  text("B", { x: 252, y: 460, class: "sbLabel" }, svg);
  text("A", { x: 334, y: 432, class: "sbLabel" }, svg);

  // SELECT and START.
  [[150, 528, "SELECT"], [212, 528, "START"]].forEach(function (b) {
    el("rect", { x: b[0] - 29, y: b[1] - 11, width: 58, height: 22, rx: 11, fill: "#000", opacity: 0.14, transform: "rotate(-26 " + b[0] + " " + b[1] + ")" }, svg);
    text(b[2], { x: b[0] - 2, y: b[1] + 30, class: "sbLabel sbLabelSmall", "text-anchor": "middle", transform: "rotate(-26 " + b[0] + " " + (b[1] + 30) + ")" }, svg);
  });

  // Speaker grille.
  el("circle", { cx: 306, cy: 548, r: 52, fill: "#000", opacity: 0.1 }, svg);
  for (var gy = -40; gy <= 40; gy += 8) {
    for (var gx = -40; gx <= 40; gx += 8) {
      var ox = gx + ((gy / 8) % 2 ? 4 : 0);
      if (ox * ox + gy * gy < 40 * 40) el("circle", { cx: 306 + ox, cy: 548 + gy, r: 2.3, fill: "#4a080c" }, svg);
    }
  }

  // ---- interactive parts ---------------------------------------------------
  function control(label, shape, role) {
    var g = el("g", { class: "sbBtn", tabindex: 0, role: role || "button", "aria-label": label }, svg);
    shape(g);
    return g;
  }

  var btnA = control("A: play or pause", function (g) {
    el("circle", { class: "face", cx: 322, cy: 390, r: 24, fill: "#2fb3a8", stroke: "#1d7c74", "stroke-width": 2 }, g);
    el("circle", { cx: 316, cy: 383, r: 9, fill: "#fff", opacity: 0.18 }, g);
  });
  var btnB = control("B, not used here", function (g) {
    el("circle", { class: "face", cx: 264, cy: 418, r: 24, fill: "#2a6bd1", stroke: "#1a4a96", "stroke-width": 2 }, g);
    el("circle", { cx: 258, cy: 411, r: 9, fill: "#fff", opacity: 0.18 }, g);
  });
  var btnSel = control("Select: change visualiser", function (g) {
    el("rect", { class: "face", x: 128, y: 521, width: 44, height: 14, rx: 7, fill: "#d9d9de", stroke: "#a9a9b0", transform: "rotate(-26 150 528)" }, g);
  });
  var btnStart = control("Start, not used here", function (g) {
    el("rect", { class: "face", x: 190, y: 521, width: 44, height: 14, rx: 7, fill: "#d9d9de", stroke: "#a9a9b0", transform: "rotate(-26 212 528)" }, g);
  });
  function dpadArm(label, dx, dy) {
    return control(label, function (g) {
      var x = dx ? (dx > 0 ? DP.x + DP.w - 2 : DP.x - DP.l - 2) : DP.x - DP.w - 2;
      var y = dy ? (dy > 0 ? DP.y + DP.w - 2 : DP.y - DP.l - 2) : DP.y - DP.w - 2;
      var w = dx ? DP.l - DP.w + 4 : 2 * DP.w + 4;
      var h = dy ? DP.l - DP.w + 4 : 2 * DP.w + 4;
      el("rect", { class: "armShade", x: x, y: y, width: w, height: h, rx: 3 }, g);
    });
  }
  var padRight = dpadArm("Right: fast forward, hold to keep going", 1, 0);
  var padLeft = dpadArm("Left: rewind, hold to keep going", -1, 0);
  var padUp = dpadArm("Up, not used here", 0, -1);
  var padDown = dpadArm("Down, not used here", 0, 1);

  var powerSwitch = control("Power", function (g) {
    el("rect", { x: 32, y: -18, width: 96, height: 50, fill: "transparent" }, g);
  }, "switch");
  powerSwitch.setAttribute("aria-checked", "false");

  var volWheel = control("Volume", function (g) {
    el("rect", { x: 352, y: 140, width: 60, height: 124, fill: "transparent" }, g);
  }, "slider");
  volWheel.setAttribute("aria-valuemin", "0");
  volWheel.setAttribute("aria-valuemax", "100");
  volWheel.classList.add("sbWheelHit");

  // Screen.
  var canvas = document.createElement("canvas");
  canvas.className = "sbScreen";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.left = ((SCREEN.x - VB.x) / VB.w) * 100 + "%";
  canvas.style.top = ((SCREEN.y - VB.y) / VB.h) * 100 + "%";
  canvas.style.width = (SCREEN.s / VB.w) * 100 + "%";
  canvas.style.height = (SCREEN.s / VB.h) * 100 + "%";
  device.appendChild(canvas);
  var glass = document.createElement("div");
  glass.className = "sbGlass";
  ["left", "top", "width", "height"].forEach(function (p) {
    glass.style[p] = canvas.style[p];
  });
  device.appendChild(glass);
  var ctx = canvas.getContext("2d");

  // Side panel: what each control does.
  var side = document.createElement("div");
  var key = document.createElement("ul");
  key.className = "demoKey sbKey";
  [
    ["Power switch", "top edge, on and off"],
    ["A", "play and pause"],
    ["◀ ▶", "rewind and fast forward; hold to keep going"],
    ["SELECT", "album art, oscilloscope, spectrum"],
    ["Volume wheel", "right edge; drag or scroll it"]
  ].forEach(function (row) {
    var li = document.createElement("li");
    var b = document.createElement("strong");
    b.textContent = row[0];
    li.appendChild(b);
    li.appendChild(document.createTextNode(row[1]));
    key.appendChild(li);
  });
  var keys = document.createElement("li");
  keys.className = "sbKeys";
  keys.textContent = "Keyboard, once it has focus: P power, A play, S select, arrow keys seek, + and − volume.";
  key.appendChild(keys);
  side.appendChild(key);
  stage.appendChild(side);

  // ---- state ---------------------------------------------------------------
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var on = false;
  var booting = 0; // time the boot splash started, 0 when not booting
  var paused = false;
  var rate = 1;
  var warp = null;
  var mode = 1; // firmware default is the oscilloscope
  var volume = 0.6;
  var volShownAt = -1e9;
  var seekDir = 0, seekTimer = 0, seekStarted = 0;
  var savedTime = 0; // what the FRAM would hold across a power cycle
  var noCart = false;
  var audio = null, actx = null, gain = null, anL = null, anR = null;
  var tdL, tdR, fdL, fdR;
  var fftShown = { l: new Float32Array(FFT_BARS), r: new Float32Array(FFT_BARS) };
  var vuPeak = { l: 0, r: 0 };
  var art = null; // 160x160 canvas, quantised to 16-bit colour

  function now() {
    return performance.now();
  }

  // ---- audio ---------------------------------------------------------------
  function setupAudio() {
    if (audio) return;
    audio = new Audio();
    audio.preload = "auto";
    audio.loop = true;
    audio.src = TRACK.src;
    ["preservesPitch", "mozPreservesPitch", "webkitPreservesPitch"].forEach(function (p) {
      if (p in audio) audio[p] = false;
    });
    audio.addEventListener("error", function () {
      noCart = true;
    });
    var AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    var srcNode = actx.createMediaElementSource(audio);
    gain = actx.createGain();
    srcNode.connect(gain);
    gain.connect(actx.destination);
    // The firmware samples the output with its ADC; here the analysers sit
    // before the volume so the visuals do not vanish when it is turned down.
    var split = actx.createChannelSplitter(2);
    srcNode.connect(split);
    anL = actx.createAnalyser();
    anR = actx.createAnalyser();
    [anL, anR].forEach(function (a, i) {
      a.fftSize = 2048;
      a.smoothingTimeConstant = 0;
      split.connect(a, i);
    });
    tdL = new Float32Array(anL.fftSize);
    tdR = new Float32Array(anR.fftSize);
    fdL = new Float32Array(anL.frequencyBinCount);
    fdR = new Float32Array(anR.frequencyBinCount);
    applyVolume();
  }

  function applyVolume() {
    // About the DAC's 48 dB of travel, with the bottom of the wheel silent.
    var g = volume <= 0.001 ? 0 : Math.pow(10, (-48 * (1 - volume)) / 20);
    if (gain) gain.gain.setTargetAtTime(g, actx.currentTime, 0.03);
    volWheel.setAttribute("aria-valuenow", String(Math.round(volume * 100)));
    var off = (volume * 60) % 6;
    ridgeLines.forEach(function (l, i) {
      var y = 148 + i * 6 + off;
      l.setAttribute("y1", y);
      l.setAttribute("y2", y);
      l.setAttribute("opacity", y > 152 && y < 252 ? 1 : 0);
    });
  }

  function setRate(r) {
    rate = r;
    if (audio) audio.playbackRate = Math.max(MIN_RATE, r);
  }

  function startWarp(to, dur) {
    warp = { from: rate, to: to, t0: now(), dur: reduce ? 1 : dur };
    if (to > 0 && audio && audio.paused) audio.play().catch(function () {});
  }

  function stepWarp() {
    if (!warp) return;
    var u = Math.min(1, (now() - warp.t0) / warp.dur);
    // Slowing down accelerates into the stop; spinning up eases out.
    var e = warp.to < warp.from ? u * u : u * (2 - u);
    setRate(warp.from + (warp.to - warp.from) * e);
    if (u >= 1) {
      if (warp.to === 0 && audio) audio.pause();
      warp = null;
    }
  }

  function seek(dir) {
    if (!audio || !isFinite(audio.duration)) return;
    var t = audio.currentTime + dir * SKIP_S;
    audio.currentTime = Math.max(0, Math.min(audio.duration - 0.05, t));
  }

  // ---- controls ------------------------------------------------------------
  function power(want) {
    if (want === on) return;
    on = want;
    powerSwitch.setAttribute("aria-checked", on ? "true" : "false");
    knob.setAttribute("x", on ? 86 : 46);
    if (on) {
      setupAudio();
      if (actx.state === "suspended") actx.resume();
      noCart = false;
      paused = false;
      booting = now();
      // Start the element inside the click, silenced, so browsers that only
      // allow playback from a gesture (iOS Safari) let it play after the
      // splash. It is paused again straight away.
      gain.gain.cancelScheduledValues(actx.currentTime);
      gain.gain.value = 0;
      var p = audio.play();
      if (p && p.then) {
        p.then(function () {
          if (booting || !on) audio.pause();
        }).catch(function () {});
      }
      startLoops();
    } else {
      if (audio) {
        savedTime = audio.currentTime || 0;
        audio.pause();
      }
      warp = null;
      stopSeek();
      booting = 0;
      paintOff();
    }
  }

  // Called once the splash is over: pick up where the last session left off,
  // with the resume warp, as the firmware does from FRAM.
  function beginPlayback() {
    if (!audio || noCart) return;
    try {
      audio.currentTime = savedTime;
    } catch (e) {}
    applyVolume();
    if (savedTime > 0) {
      setRate(0);
      startWarp(1, RESUME_WARP_MS);
    } else {
      setRate(1);
      audio.play().catch(function () {});
    }
  }

  function pressA() {
    if (!on || booting || noCart) return;
    paused = !paused;
    startWarp(paused ? 0 : 1, paused ? PAUSE_WARP_MS : RESUME_WARP_MS);
  }

  function pressSelect() {
    if (!on || booting) return;
    mode = (mode + 1) % MODES.length;
    if (MODES[mode] === "fft") {
      fftShown.l.fill(0);
      fftShown.r.fill(0);
    }
  }

  function startSeek(dir) {
    if (!on || booting || noCart) return;
    stopSeek();
    seekDir = dir;
    seekStarted = now();
    seek(dir);
    seekTimer = setInterval(function () {
      seek(dir);
    }, SKIP_EVERY_MS);
  }

  function stopSeek() {
    clearInterval(seekTimer);
    seekTimer = 0;
    seekDir = 0;
  }

  function nudgeVolume(d) {
    volume = Math.max(0, Math.min(1, volume + d));
    volShownAt = now();
    applyVolume();
  }

  // Pointer handling: press on down, release on up, so holds work.
  function bindPress(g, onDown, onUp) {
    g.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      g.classList.add("pressed");
      try {
        g.setPointerCapture(e.pointerId);
      } catch (err) {}
      onDown();
    });
    function up() {
      if (!g.classList.contains("pressed")) return;
      g.classList.remove("pressed");
      if (onUp) onUp();
    }
    g.addEventListener("pointerup", up);
    g.addEventListener("pointercancel", up);
    g.addEventListener("lostpointercapture", up);
    g.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
        e.preventDefault();
        g.classList.add("pressed");
        onDown();
      }
    });
    g.addEventListener("keyup", function (e) {
      if (e.key === "Enter" || e.key === " ") up();
    });
  }

  bindPress(btnA, pressA);
  bindPress(btnB, function () {});
  bindPress(btnStart, function () {});
  bindPress(btnSel, pressSelect);
  bindPress(padUp, function () {});
  bindPress(padDown, function () {});
  bindPress(padRight, function () {
    startSeek(1);
  }, stopSeek);
  bindPress(padLeft, function () {
    startSeek(-1);
  }, stopSeek);
  bindPress(powerSwitch, function () {
    power(!on);
  });

  // The wheel: drag it, scroll over it, or use the arrow keys on it.
  var dragY = null;
  volWheel.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    dragY = e.clientY;
    try {
      volWheel.setPointerCapture(e.pointerId);
    } catch (err) {}
  });
  volWheel.addEventListener("pointermove", function (e) {
    if (dragY === null) return;
    var scale = VB.h / svg.getBoundingClientRect().height;
    nudgeVolume(((dragY - e.clientY) * scale) / 160);
    dragY = e.clientY;
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (t) {
    volWheel.addEventListener(t, function () {
      dragY = null;
    });
  });
  // Keep a drag on the wheel from scrolling the page on touch screens.
  volWheel.addEventListener("touchmove", function (e) {
    e.preventDefault();
  }, { passive: false });
  volWheel.addEventListener("wheel", function (e) {
    e.preventDefault();
    nudgeVolume(-Math.sign(e.deltaY) * 0.04);
  }, { passive: false });
  volWheel.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") nudgeVolume(0.05);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") nudgeVolume(-0.05);
    else return;
    e.preventDefault();
  });

  // Keyboard shortcuts while focus is anywhere on the device.
  function mark(g, down) {
    g.classList.toggle("pressed", down);
  }
  device.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) {
      if (e.repeat && (e.key === "ArrowLeft" || e.key === "ArrowRight")) e.preventDefault();
      return;
    }
    if (e.target === volWheel && /Arrow/.test(e.key)) return;
    var k = e.key.toLowerCase();
    if (k === "p") power(!on);
    else if (k === "a") {
      mark(btnA, true);
      pressA();
    } else if (k === "s") {
      mark(btnSel, true);
      pressSelect();
    } else if (e.key === "ArrowRight") {
      mark(padRight, true);
      startSeek(1);
    } else if (e.key === "ArrowLeft") {
      mark(padLeft, true);
      startSeek(-1);
    } else if (e.key === "+" || e.key === "=") nudgeVolume(0.05);
    else if (e.key === "-") nudgeVolume(-0.05);
    else return;
    e.preventDefault();
  });
  device.addEventListener("keyup", function (e) {
    var k = e.key.toLowerCase();
    if (k === "a") mark(btnA, false);
    else if (k === "s") mark(btnSel, false);
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      mark(padRight, false);
      mark(padLeft, false);
      stopSeek();
    }
  });

  // ---- album art -----------------------------------------------------------
  if (TRACK.art) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = c.height = 160;
      var x = c.getContext("2d");
      // Cover-crop to a square, then drop to RGB565 like the cache files.
      var s = Math.min(img.width, img.height);
      x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
      try {
        var d = x.getImageData(0, 0, 160, 160);
        for (var i = 0; i < d.data.length; i += 4) {
          d.data[i] &= 0xf8;
          d.data[i + 1] &= 0xfc;
          d.data[i + 2] &= 0xf8;
        }
        x.putImageData(d, 0, 0);
      } catch (e) {}
      art = c;
    };
    img.src = TRACK.art;
  }

  // ---- drawing -------------------------------------------------------------
  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    if (canvas.width !== w) {
      canvas.width = w;
      canvas.height = w;
    }
    ctx.setTransform(w / 240, 0, 0, w / 240, 0, 0);
  }

  function paintOff() {
    resizeCanvas();
    ctx.fillStyle = "#0a0c0b";
    ctx.fillRect(0, 0, 240, 240);
    leds.l.concat(leds.r).forEach(function (d) {
      d.lit.setAttribute("opacity", 0);
      d.halo.setAttribute("opacity", 0);
    });
    powerLed.setAttribute("fill", "#3a0d0d");
    powerGlow.setAttribute("opacity", 0);
  }

  function icon(name, x, y) {
    var rows = ICONS[name];
    ctx.fillStyle = name === "play" ? "#fff" : "#ff0000";
    for (var r = 0; r < 20; r++) {
      for (var c = 0; c < 20; c++) {
        if (rows[r].charAt(c) === "#") ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }

  function monoText(str, x, y, colour) {
    // The firmware's font is 11 px wide on a 20 px line; keep that grid.
    ctx.fillStyle = colour || "#fff";
    ctx.font = "bold 17px ui-monospace, Menlo, Consolas, 'Courier New', monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    for (var i = 0; i < str.length; i++) ctx.fillText(str.charAt(i), x + i * 11 + 5.5, y + 2);
    ctx.textAlign = "left";
  }

  var marquee = { pos: 0, last: 0 };
  function titleWindow(t) {
    var src = TRACK.title + (TRACK.artist ? " - " + TRACK.artist : "");
    var WIN = 18, GAP = 6;
    if (src.length <= WIN) return src;
    var wait = marquee.pos === 0 ? 2000 : 150;
    if (t - marquee.last >= wait) {
      marquee.pos = (marquee.pos + 1) % (src.length + GAP);
      marquee.last = t;
    }
    var out = "", total = src.length + GAP;
    for (var i = 0; i < WIN; i++) {
      var idx = (marquee.pos + i) % total;
      out += idx < src.length ? src.charAt(idx) : " ";
    }
    return out;
  }

  function overlay(t) {
    var status = paused ? "pause" : "play";
    if (seekDir) {
      var blinkOn = Math.floor((t - seekStarted) / BLINK_MS) % 2 === 0;
      status = blinkOn ? (seekDir > 0 ? "ff" : "rew") : null;
    }
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 240, 21);
    if (status) icon(status, 0, 0);
    monoText(titleWindow(t), 30, 1);

    var cur = audio ? audio.currentTime || 0 : 0;
    var dur = audio && isFinite(audio.duration) ? audio.duration : 0;
    var m = Math.floor(cur / 60), s = Math.floor(cur % 60);
    monoText(m + ":" + (s < 10 ? "0" : "") + s, 0, 210);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 235, 240, 5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 235, dur ? (240 * cur) / dur : 0, 5);

    if (t - volShownAt < 1200) {
      ctx.fillStyle = "#000";
      ctx.fillRect(118, 210, 122, 22);
      monoText("VOL", 120, 210);
      for (var i = 0; i < 10; i++) {
        ctx.fillStyle = i < Math.round(volume * 10) ? "#fff" : "#333";
        ctx.fillRect(158 + i * 8, 214, 6, 14);
      }
    }
  }

  function drawScope() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 240, 240);
    var STEP = 2;
    var start = tdL.length - 240 * STEP;
    ctx.fillStyle = "#fff";
    [[tdR, SCOPE_R_Y], [tdL, SCOPE_L_Y]].forEach(function (ch) {
      var data = ch[0], mid = ch[1], last = null;
      for (var x = 0; x < 240; x++) {
        var v = data[start + x * STEP] * 1.6;
        var y = Math.round(mid - Math.max(-1, Math.min(1, v)) * SCOPE_HALF);
        if (last === null) last = y;
        var a = Math.min(y, last), b = Math.max(y, last);
        ctx.fillRect(x, a, 1, b - a + 1);
        last = y;
      }
    });
  }

  function drawFFT() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 240, 240);
    var bins = fdL.length;
    var nyquist = actx.sampleRate / 2;
    var maxBin = Math.min(bins - 1, Math.floor((16000 / nyquist) * bins));
    var pitch = Math.floor(240 / FFT_BARS), width = Math.max(1, Math.floor(pitch * 0.8));
    var lastBin = 2;
    for (var b = 0; b < FFT_BARS; b++) {
      var ratio = (b + 1) / FFT_BARS;
      var end = Math.floor(2 + (maxBin - 2) * Math.pow(ratio, 2.2));
      if (end <= lastBin) end = lastBin + 1;
      var pl = -200, pr = -200;
      for (var i = lastBin; i <= end && i < bins; i++) {
        if (fdL[i] > pl) pl = fdL[i];
        if (fdR[i] > pr) pr = fdR[i];
      }
      lastBin = end + 1;
      // Higher bands get more gain, as in the firmware's sensitivity ramp.
      var tilt = ratio * 18;
      var tl = Math.max(0, ((pl + tilt + 82) / 62) * FFT_MAX);
      var tr = Math.max(0, ((pr + tilt + 82) / 62) * FFT_MAX);
      var decay = 4 - ratio * 3;
      fftShown.l[b] = tl > fftShown.l[b] ? tl : Math.max(0, fftShown.l[b] - decay);
      fftShown.r[b] = tr > fftShown.r[b] ? tr : Math.max(0, fftShown.r[b] - decay);
      var x = b * pitch;
      bar(x, width, fftShown.r[b], tr, -1, "r");
      bar(x, width, fftShown.l[b], tl, 1, "l");
    }
  }

  function bar(x, w, shown, target, dir, ch) {
    var h = Math.min(FFT_MAX, Math.round(shown));
    var t = Math.min(h, Math.round(target));
    ctx.fillStyle = FFT_DARK[ch];
    if (dir > 0) ctx.fillRect(x, FFT_MID, w, t);
    else ctx.fillRect(x, FFT_MID - t, w, t);
    if (h > t) {
      ctx.fillStyle = FFT_LIGHT[ch];
      if (dir > 0) ctx.fillRect(x, FFT_MID + t, w, h - t);
      else ctx.fillRect(x, FFT_MID - h, w, h - t);
    }
  }

  function drawArt() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 240, 240);
    if (art) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, 40, 40, 160, 160);
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.fillStyle = "#222";
      ctx.fillRect(40, 40, 160, 160);
      monoText("NO ART", 87, 110, "#888");
    }
  }

  function drawSplash(t) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 240, 240);
    var a = Math.min(1, (t - booting) / 250);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "italic 800 36px Roboto, Arial, sans-serif";
    ctx.fillText("StereoBoy", 120, 122);
    ctx.font = "700 10px Roboto, Arial, sans-serif";
    ctx.fillText("MODULAR STEREO SYSTEM", 120, 140);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function drawMessage(lines) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 240, 240);
    lines.forEach(function (l, i) {
      monoText(l, 120 - (l.length * 11) / 2, 100 + i * 22, i ? "#aaa" : "#fff");
    });
  }

  function updateLeds(t, dt) {
    var levels = { l: 0, r: 0 };
    if (booting) {
      // Lamp test while the splash is up: fill and drain once.
      var u = (t - booting) / BOOT_MS;
      levels.l = levels.r = u < 0.5 ? u * 2 : 2 - u * 2;
      vuPeak.l = vuPeak.r = 0;
    } else if (anL && !noCart) {
      var pl = 0, pr = 0;
      for (var i = tdL.length - 1024; i < tdL.length; i++) {
        var a = Math.abs(tdL[i]), b = Math.abs(tdR[i]);
        if (a > pl) pl = a;
        if (b > pr) pr = b;
      }
      var decay = 0.055 * (dt / 16.7);
      ["l", "r"].forEach(function (c) {
        var lvl = Math.min(1, (c === "l" ? pl : pr) / VU_FULL);
        vuPeak[c] = lvl > vuPeak[c] ? lvl : Math.max(0, vuPeak[c] - decay);
        levels[c] = vuPeak[c];
      });
    }
    ["l", "r"].forEach(function (c) {
      for (var i = 0; i < 8; i++) {
        var lo = i / 8, hi = (i + 1) / 8, p = levels[c];
        var f = p >= hi ? 1 : p > lo ? (p - lo) * 8 : 0;
        leds[c][i].lit.setAttribute("opacity", f.toFixed(2));
        leds[c][i].halo.setAttribute("opacity", (f * 0.85).toFixed(2));
      }
    });
  }

  // ---- loops ---------------------------------------------------------------
  var raf = 0, ctrl = 0, lastFrame = 0, visible = false;

  function frame(t) {
    raf = 0;
    if (!on) return;
    var dt = lastFrame ? Math.min(t - lastFrame, 100) : 16.7;
    lastFrame = t;
    resizeCanvas();
    powerLed.setAttribute("fill", "#ff3a2a");
    powerGlow.setAttribute("opacity", 0.7);

    if (booting) {
      drawSplash(t);
      if (t - booting >= BOOT_MS) {
        booting = 0;
        beginPlayback();
      }
    } else if (noCart) {
      drawMessage(["NO STEREOMAG", "insert a cartridge"]);
    } else if (!audio || audio.readyState < 2) {
      drawMessage(["LOADING"]);
    } else {
      anL.getFloatTimeDomainData(tdL);
      anR.getFloatTimeDomainData(tdR);
      if (MODES[mode] === "scope") drawScope();
      else if (MODES[mode] === "fft") {
        anL.getFloatFrequencyData(fdL);
        anR.getFloatFrequencyData(fdR);
        drawFFT();
      } else drawArt();
      overlay(t);
    }
    updateLeds(t, dt);
    if (visible) raf = requestAnimationFrame(frame);
  }

  function startLoops() {
    lastFrame = 0;
    if (!raf && visible) raf = requestAnimationFrame(frame);
    if (!ctrl) {
      // Transport control runs off a timer, so the tape warp and seeking
      // keep working when the display is scrolled out of view.
      ctrl = setInterval(function () {
        if (!on) {
          clearInterval(ctrl);
          ctrl = 0;
          return;
        }
        stepWarp();
      }, 20);
    }
  }

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible && on && !raf) {
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
    }
  }).observe(device);

  new ResizeObserver(function () {
    if (!on) paintOff();
  }).observe(canvas);

  applyVolume();
  paintOff();
  fig.classList.add("ready");
})();
