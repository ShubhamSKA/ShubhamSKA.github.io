// EdemaFlex glove, back of the right hand. Each line is an SMA spring knit
// into a channel: five round every digit and four across the hand. They fire
// one level at a time from the fingertips towards the wrist. A spring heats
// for 300 ms and pulls the knit in, then takes 3 s to cool and let go, while
// the next level along is already heating. That sweep is the distal to
// proximal compression the glove is built for.
(function () {
  var fig = document.getElementById("demo-glove");
  if (!fig) return;
  var stage = fig.querySelector(".demoStage");
  var NS = "http://www.w3.org/2000/svg";

  var COMPRESS_MS = 300; // heating, the knit pulls in
  var RELEASE_MS = 3000; // cooling, the knit relaxes
  var STEP_MS = COMPRESS_MS; // next level starts as this one finishes heating
  var REST_MS = 900; // pause before the sweep repeats
  var FINGER_SQUEEZE = 0.34; // fraction of the half-width lost at a spring
  var PALM_SQUEEZE = 0.15;

  // Digits: base point, lean in degrees (positive leans right), length, and
  // half-width at the base and tip. Springs sit at fractions of the length,
  // fingertip first.
  var DIGITS = [
    { name: "thumb", x: 131, y: 396, a: -52, len: 116, w0: 24, w1: 18.5 },
    { name: "index", x: 150, y: 252, a: -9, len: 146, w0: 20.5, w1: 17 },
    { name: "middle", x: 194, y: 243, a: -2, len: 164, w0: 21, w1: 17.5 },
    { name: "ring", x: 238, y: 249, a: 5, len: 152, w0: 20, w1: 16.5 },
    { name: "little", x: 279, y: 266, a: 13, len: 118, w0: 17.5, w1: 14.5 }
  ];
  var DIGIT_SPRINGS = [0.86, 0.68, 0.5, 0.32, 0.14];
  var PALM_SPRINGS = [300, 346, 392, 438]; // heights, knuckles to wrist
  var LEVELS = DIGIT_SPRINGS.length + PALM_SPRINGS.length;
  var SIGMA = 7.5; // how far along the knit one spring's pull spreads

  var PERIOD = (LEVELS - 1) * STEP_MS + COMPRESS_MS + RELEASE_MS + REST_MS;

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // How contracted a level is, 0 to 1, at time t into the cycle.
  function envelope(level, t) {
    var tau = t - level * STEP_MS;
    if (tau <= 0) return 0;
    if (tau < COMPRESS_MS) {
      var x = tau / COMPRESS_MS;
      return 1 - (1 - x) * (1 - x) * (1 - x);
    }
    tau -= COMPRESS_MS;
    if (tau >= RELEASE_MS) return 0;
    var k = 3.2;
    return (Math.exp((-k * tau) / RELEASE_MS) - Math.exp(-k)) / (1 - Math.exp(-k));
  }

  function bump(d) {
    return Math.exp(-(d * d) / (SIGMA * SIGMA));
  }

  // ---- geometry ------------------------------------------------------------
  function digitOutline(f, e) {
    var rad = (f.a * Math.PI) / 180;
    var dx = Math.sin(rad), dy = -Math.cos(rad); // along the digit
    var nx = Math.cos(rad), ny = Math.sin(rad); // across it, to its right
    var springs = DIGIT_SPRINGS.map(function (p) {
      return p * f.len;
    });

    function half(s) {
      var u = Math.max(0, Math.min(1, s / f.len));
      var w = f.w0 + (f.w1 - f.w0) * u;
      var sq = 0;
      for (var k = 0; k < springs.length; k++) sq += e[k] * bump(s - springs[k]);
      return w * (1 - FINGER_SQUEEZE * Math.min(1, sq));
    }

    var left = [], right = [];
    for (var s = -26; s < f.len; s += 3) {
      var w = half(s);
      var cx = f.x + dx * s, cy = f.y + dy * s;
      left.push([cx - nx * w, cy - ny * w]);
      right.push([cx + nx * w, cy + ny * w]);
    }
    var r = half(f.len);
    var tx = f.x + dx * f.len, ty = f.y + dy * f.len;
    var cap = [];
    for (var i = 0; i <= 14; i++) {
      var th = Math.PI - (i / 14) * Math.PI;
      cap.push([tx + nx * Math.cos(th) * r + dx * Math.sin(th) * r, ty + ny * Math.cos(th) * r + dy * Math.sin(th) * r]);
    }
    var pts = left.concat(cap, right.reverse());

    var lines = springs.map(function (s) {
      var w = half(s) - 2.5;
      var cx = f.x + dx * s, cy = f.y + dy * s;
      return [cx - nx * w, cy - ny * w, cx + nx * w, cy + ny * w];
    });
    return { d: toPath(pts), springs: lines };
  }

  var PALM_TOP = [[128, 262], [150, 252], [194, 243], [238, 249], [279, 266], [297, 280]];
  function palmLeft(y) {
    var u = (y - 262) / (470 - 262);
    return 128 + 22 * u - 6 * Math.sin(Math.PI * u);
  }
  function palmRight(y) {
    var u = (y - 280) / (470 - 280);
    return 297 - 25 * u + 7 * Math.sin(Math.PI * u);
  }

  function palmOutline(e) {
    function pinch(y, xl, xr) {
      var sq = 0;
      for (var j = 0; j < PALM_SPRINGS.length; j++) sq += e[j] * bump(y - PALM_SPRINGS[j]);
      return ((xr - xl) / 2) * PALM_SQUEEZE * Math.min(1, sq);
    }
    var pts = PALM_TOP.slice();
    var y;
    for (y = 283; y <= 470; y += 3) {
      pts.push([palmRight(y) - pinch(y, palmLeft(y), palmRight(y)), y]);
    }
    pts.push([274, 524], [148, 524]);
    for (y = 470; y >= 262; y -= 3) {
      pts.push([palmLeft(y) + pinch(y, palmLeft(y), palmRight(y)), y]);
    }
    var lines = PALM_SPRINGS.map(function (py) {
      var xl = palmLeft(py), xr = palmRight(py), p = pinch(py, xl, xr);
      return [xl + p + 3, py, xr - p - 3, py];
    });
    return { d: toPath(pts), springs: lines };
  }

  function toPath(pts) {
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) d += "L" + pts[i][0].toFixed(1) + "," + pts[i][1].toFixed(1);
    return d + "Z";
  }

  // ---- colour --------------------------------------------------------------
  var cool, hot;
  function hexToRgb(h) {
    h = h.trim().replace("#", "");
    if (h.length === 3) h = h.replace(/./g, "$&$&");
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readColours() {
    var cs = getComputedStyle(fig);
    cool = hexToRgb(cs.getPropertyValue("--d-sma"));
    hot = hexToRgb(cs.getPropertyValue("--d-hot"));
  }
  function mix(t) {
    return "rgb(" + [0, 1, 2].map(function (i) {
      return Math.round(cool[i] + (hot[i] - cool[i]) * t);
    }).join(",") + ")";
  }

  // ---- build ---------------------------------------------------------------
  stage.classList.add("splitStage", "gloveStage");
  var svg = el("svg", {
    viewBox: "0 44 340 488",
    role: "img",
    "aria-label": "A knit glove with shape memory alloy springs across each digit and the back of the hand, contracting in turn from the fingertips to the wrist."
  }, stage);

  var defs = el("defs", {}, svg);
  var pat = el("pattern", { id: "gloveKnit", width: 6, height: 4.5, patternUnits: "userSpaceOnUse" }, defs);
  el("rect", { width: 6, height: 4.5, style: "fill: var(--d-glove)" }, pat);
  el("path", { d: "M0 3.6H6", stroke: "#fff", "stroke-opacity": 0.09, "stroke-width": 1.2 }, pat);

  // The same shapes twice: a thick dark stroke underneath, then the knit fill
  // on top. Only the outer half of the stroke survives, which outlines the
  // whole hand as one piece without working out the union.
  var edge = el("g", { class: "edge" }, svg);
  var knit = el("g", { class: "knit" }, svg);
  var shapes = DIGITS.concat([{ palm: true }]).map(function () {
    return [el("path", {}, edge), el("path", {}, knit)];
  });

  var cuff = el("g", { class: "cuff" }, svg);
  for (var cx = 156; cx <= 268; cx += 7) el("line", { x1: cx, y1: 478, x2: cx, y2: 520 }, cuff);

  var smaGroup = el("g", { class: "sma" }, svg);
  var smaLines = [];
  function springLine() {
    var glow = el("line", { "stroke-width": 9, opacity: 0 }, smaGroup);
    var core = el("line", { "stroke-width": 3.2 }, smaGroup);
    var pair = { glow: glow, core: core };
    smaLines.push(pair);
    return pair;
  }

  // Side panel: key and the fingertip-to-wrist ladder.
  var side = document.createElement("div");
  var key = document.createElement("ul");
  key.className = "demoKey";
  key.innerHTML =
    '<li><svg viewBox="0 0 26 15" aria-hidden="true"><path d="M2 7.5h22" stroke="var(--d-sma)" stroke-width="3" stroke-linecap="round"/></svg>SMA spring, cool</li>' +
    '<li><svg viewBox="0 0 26 15" aria-hidden="true"><path d="M2 7.5h22" stroke="var(--d-hot)" stroke-width="7" stroke-opacity="0.3" stroke-linecap="round"/><path d="M2 7.5h22" stroke="var(--d-hot)" stroke-width="3" stroke-linecap="round"/></svg>Heated, contracting</li>';
  side.appendChild(key);

  var ladder = document.createElement("div");
  ladder.className = "seqLadder";
  ladder.innerHTML = '<svg viewBox="0 0 10 ' + (LEVELS * 12 - 2) + '" preserveAspectRatio="none" aria-hidden="true"></svg><div><span>Fingertips</span><span>Wrist</span></div>';
  var ladderSvg = ladder.querySelector("svg");
  var rungs = [];
  for (var i = 0; i < LEVELS; i++) {
    rungs.push(el("rect", { x: 0, y: i * 12, width: 10, height: 10, rx: 2 }, ladderSvg));
  }
  side.appendChild(ladder);
  stage.appendChild(side);

  var controls = document.createElement("div");
  controls.className = "demoControls";
  var playBtn = document.createElement("button");
  playBtn.type = "button";
  controls.appendChild(playBtn);
  fig.querySelector("figcaption").appendChild(controls);

  // ---- draw ----------------------------------------------------------------
  function draw(t) {
    var e = [];
    for (var l = 0; l < LEVELS; l++) e.push(envelope(l, t));
    var digitE = e.slice(0, DIGIT_SPRINGS.length);
    var palmE = e.slice(DIGIT_SPRINGS.length);

    var outlines = DIGITS.map(function (f) {
      return digitOutline(f, digitE);
    });
    outlines.push(palmOutline(palmE));

    var n = 0;
    outlines.forEach(function (o, idx) {
      shapes[idx][0].setAttribute("d", o.d);
      shapes[idx][1].setAttribute("d", o.d);
      var levelE = idx < DIGITS.length ? digitE : palmE;
      o.springs.forEach(function (s, k) {
        var line = smaLines[n] || springLine();
        n++;
        var heat = levelE[k];
        [line.glow, line.core].forEach(function (ln) {
          ln.setAttribute("x1", s[0].toFixed(1));
          ln.setAttribute("y1", s[1].toFixed(1));
          ln.setAttribute("x2", s[2].toFixed(1));
          ln.setAttribute("y2", s[3].toFixed(1));
        });
        line.core.setAttribute("stroke", mix(heat));
        line.core.setAttribute("stroke-width", (3.2 + heat * 1.4).toFixed(2));
        line.glow.setAttribute("stroke", mix(1));
        line.glow.setAttribute("opacity", (heat * 0.32).toFixed(3));
      });
    });

    rungs.forEach(function (r, k) {
      r.style.fill = e[k] > 0.004 ? mix(e[k]) : "";
    });
  }

  // ---- run -----------------------------------------------------------------
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var playing = !reduce;
  var visible = false;
  var raf = 0;
  var clock = 0; // ms into the cycle
  var last = 0;

  function frame(now) {
    raf = 0;
    if (last) clock = (clock + Math.min(now - last, 100)) % PERIOD;
    last = now;
    draw(clock);
    if (playing && visible) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (playing && visible && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function paintButton() {
    playBtn.textContent = playing ? "Pause" : "Play";
  }

  playBtn.addEventListener("click", function () {
    playing = !playing;
    paintButton();
    kick();
  });

  new IntersectionObserver(function (entries) {
    var was = visible;
    visible = entries[0].isIntersecting;
    // Start each viewing from the top of the sweep.
    if (visible && !was && !raf && playing) clock = 0;
    kick();
  }, { threshold: 0.25 }).observe(fig);

  new MutationObserver(function () {
    readColours();
    if (!raf) draw(clock);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  readColours();
  // Without motion, rest on a moment partway down the fingers.
  clock = reduce ? 2 * STEP_MS + COMPRESS_MS : 0;
  draw(clock);
  paintButton();
  fig.classList.add("ready");
})();
