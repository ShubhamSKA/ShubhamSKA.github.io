// Wireless state of charge sensing, as a picture. A LiPo cell, cut away to
// show lithium ions shuttling between cathode and anode as it charges and
// discharges, with a planar coil lying on top. The coil feeds a readout board
// whose output is a sinusoid; its frequency and amplitude follow the charge.
// No numbers on the wave on purpose: the mapping here is illustrative.
(function () {
  var fig = document.getElementById("demo-battery");
  if (!fig) return;
  var stage = fig.querySelector(".demoStage");

  var SOC_MIN = 0.12;
  var SWEEP_MS = 7000; // empty to full, and back
  var HOLD_MS = 900;
  var PERIOD = 2 * (SWEEP_MS + HOLD_MS);
  var IONS = 44;
  var WAVE_SPEED = 140; // px per second, how fast the output runs off the board

  function freq(soc) {
    return 1.15 + 1.75 * soc; // cycles per second at the source
  }
  function amp(soc) {
    return 0.95 - 0.5 * soc; // fraction of the available height
  }

  // ---- layouts, in their own logical units ---------------------------------
  var WIDE = {
    w: 960, h: 430,
    meter: { x: 36, y: 34 },
    cell: { x0: 36, y0: 180, x1: 372, y1: 400, dx: 98, dy: -82 },
    padU: 0.965,
    pcb: { x: 530, y: 120, w: 140, h: 104 },
    wave: { x0: 684, x1: 940, cy: 172, a: 66 },
    wireOut: [60, -45]
  };
  var NARROW = {
    w: 480, h: 600,
    meter: { x: 24, y: 34 },
    cell: { x0: 84, y0: 178, x1: 360, y1: 372, dx: 86, dy: -74 },
    padU: 0.035,
    pcb: { x: 40, y: 440, w: 150, h: 104 },
    wave: { x0: 202, x1: 458, cy: 492, a: 64 },
    wireOut: [-95, 30]
  };

  // ---- canvas --------------------------------------------------------------
  stage.classList.add("canvasStage", "batteryStage");
  var canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "A lithium polymer cell cut away to show ions moving between its electrodes as it charges and discharges. A planar coil on top connects to a circuit board, whose output sinusoid changes frequency and amplitude with the charge."
  );
  stage.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, L = WIDE, k = 1;

  var col = {};
  function readColours() {
    var cs = getComputedStyle(fig);
    ["--d-bg", "--d-ink", "--d-muted", "--d-faint", "--d-coil", "--d-pcb"].forEach(function (n) {
      col[n] = cs.getPropertyValue(n).trim();
    });
    col.accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    var light = document.documentElement.getAttribute("data-theme") === "light";
    col.light = light;
    col.cathode = light ? "#c8d3e1" : "#283546";
    col.anode = light ? "#b9b9b9" : "#2a2a2c";
    col.electrolyte = light ? "rgba(90,140,200,0.10)" : "rgba(120,170,230,0.07)";
    col.lattice = light ? "rgba(0,0,0,0.13)" : "rgba(255,255,255,0.09)";
    col.top0 = light ? "#c6cbd2" : "#3b4049";
    col.top1 = light ? "#aab0b8" : "#2b2f36";
    col.side = light ? "#9aa0a8" : "#22252b";
    col.front = light ? "#8d939b" : "#1b1d22";
    col.ion = light ? "#e39400" : "#ffc94a";
  }

  var ions = [];
  var sites = { cathode: [], anode: [] };

  function layers(c) {
    // Collector, electrode, electrolyte, separator, electrolyte, electrode,
    // collector, as fractions of the inside height.
    var top = c.y0 + 6, h = c.y1 - c.y0 - 12;
    var f = [0.03, 0.31, 0.11, 0.03, 0.11, 0.31, 0.03];
    var out = [], y = top + h * 0.035;
    f.forEach(function (fr) {
      out.push([y, y + fr * h]);
      y += fr * h;
    });
    return out;
  }

  function buildSites() {
    var c = L.cell, ly = layers(c);
    sites = { cathode: [], anode: [] };
    [["cathode", ly[1]], ["anode", ly[5]]].forEach(function (pair) {
      var band = pair[1], rows = 5, x0 = c.x0 + 92, x1 = c.x1 - 14;
      for (var r = 0; r < rows; r++) {
        var y = band[0] + ((r + 0.5) / rows) * (band[1] - band[0]);
        for (var x = x0 + (r % 2) * 8; x < x1; x += 17) {
          sites[pair[0]].push({ x: x, y: y, used: false });
        }
      }
    });
  }

  function freeSite(side) {
    var list = sites[side].filter(function (s) {
      return !s.used;
    });
    var s = list[Math.floor(Math.random() * list.length)];
    s.used = true;
    return s;
  }

  function placeIons(soc) {
    buildSites();
    ions = [];
    var inAnode = Math.round(soc * IONS);
    for (var i = 0; i < IONS; i++) {
      var side = i < inAnode ? "anode" : "cathode";
      var s = freeSite(side);
      ions.push({ side: side, site: s, from: null, t0: 0, dur: 0, wob: Math.random() * 6.28 });
    }
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    var next = W < 560 ? NARROW : WIDE;
    if (next !== L || !ions.length) {
      L = next;
      placeIons(socAt(clock));
      history = [];
    }
    k = W / L.w;
    draw(lastNow);
  }

  // ---- charge cycle --------------------------------------------------------
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  function socAt(t) {
    t = ((t % PERIOD) + PERIOD) % PERIOD;
    if (t < SWEEP_MS) return SOC_MIN + (1 - SOC_MIN) * smooth(t / SWEEP_MS);
    t -= SWEEP_MS;
    if (t < HOLD_MS) return 1;
    t -= HOLD_MS;
    if (t < SWEEP_MS) return 1 - (1 - SOC_MIN) * smooth(t / SWEEP_MS);
    return SOC_MIN;
  }
  function stateAt(t) {
    t = ((t % PERIOD) + PERIOD) % PERIOD;
    if (t < SWEEP_MS) return "Charging";
    if (t < SWEEP_MS + HOLD_MS) return "Charged";
    if (t < 2 * SWEEP_MS + HOLD_MS) return "Discharging";
    return "Discharged";
  }

  // Move ions so the count in the anode tracks the state of charge.
  function updateIons(soc, now) {
    var want = Math.round(soc * IONS);
    var have = ions.filter(function (i) {
      return i.side === "anode";
    }).length;
    while (have !== want) {
      var go = have < want ? "anode" : "cathode";
      var from = go === "anode" ? "cathode" : "anode";
      var pool = ions.filter(function (i) {
        return i.side === from;
      });
      if (!pool.length) break;
      var ion = pool[Math.floor(Math.random() * pool.length)];
      var p = ionPos(ion, now);
      ion.site.used = false;
      ion.from = p;
      ion.side = go;
      ion.site = freeSite(go);
      ion.t0 = now;
      ion.dur = 1000 + Math.random() * 600;
      have += go === "anode" ? 1 : -1;
    }
  }

  function ionPos(ion, now) {
    var s = ion.site;
    var jx = Math.sin(now / 420 + ion.wob) * 1.2, jy = Math.cos(now / 530 + ion.wob) * 1.2;
    if (!ion.from) return { x: s.x + jx, y: s.y + jy };
    var u = (now - ion.t0) / ion.dur;
    if (u >= 1) {
      ion.from = null;
      return { x: s.x + jx, y: s.y + jy };
    }
    var e = smooth(u);
    return {
      x: ion.from.x + (s.x - ion.from.x) * e + Math.sin(Math.PI * e) * 14 * Math.sin(ion.wob),
      y: ion.from.y + (s.y - ion.from.y) * e
    };
  }

  // ---- the output wave -----------------------------------------------------
  // The board emits a sample each frame; the trace is that history running off
  // to the right, so a change in charge travels along the wave as it happens.
  var history = [];
  var phase = 0;

  function emit(now, soc, dt) {
    phase += 2 * Math.PI * freq(soc) * (dt / 1000);
    history.push({ t: now, ph: phase, a: amp(soc) });
    var keep = ((L.wave.x1 - L.wave.x0) / WAVE_SPEED) * 1000 + 300;
    while (history.length > 2 && now - history[1].t > keep) history.shift();
  }

  function sampleAt(t) {
    if (!history.length || t < history[0].t) return null;
    var lo = 0, hi = history.length - 1;
    if (t >= history[hi].t) return history[hi];
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (history[mid].t <= t) lo = mid;
      else hi = mid;
    }
    var a = history[lo], b = history[hi], f = (t - a.t) / (b.t - a.t || 1);
    return { ph: a.ph + (b.ph - a.ph) * f, a: a.a + (b.a - a.a) * f };
  }

  // ---- drawing -------------------------------------------------------------
  function P(c, u, v) {
    return [c.x0 + u * (c.x1 - c.x0) + v * c.dx, c.y0 + v * c.dy];
  }

  function poly(pts) {
    ctx.beginPath();
    pts.forEach(function (p, i) {
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Sizes are in CSS pixels, so labels stay readable however far the
  // drawing is scaled down.
  function text(str, x, y, size, colour, align) {
    ctx.font = size / k + "px Roboto, sans-serif";
    ctx.fillStyle = colour;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }

  function drawCell(now) {
    var c = L.cell;
    // Right side and top of the pouch.
    poly([P(c, 1, 0), P(c, 1, 1), [c.x1 + c.dx, c.y1 + c.dy], [c.x1, c.y1]]);
    ctx.fillStyle = col.side;
    ctx.fill();
    var g = ctx.createLinearGradient(c.x0, c.y0, c.x0 + c.dx, c.y0 + c.dy);
    g.addColorStop(0, col.top0);
    g.addColorStop(1, col.top1);
    poly([P(c, 0, 0), P(c, 1, 0), P(c, 1, 1), P(c, 0, 1)]);
    ctx.fillStyle = g;
    ctx.fill();

    // Cut face.
    ctx.fillStyle = col.front;
    ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
    var ly = layers(c), xi = c.x0 + 6, wi = c.x1 - c.x0 - 12;
    var fills = ["#c4c9cf", col.cathode, col.electrolyte, null, col.electrolyte, col.anode, "#c47a45"];
    ly.forEach(function (b, i) {
      if (!fills[i]) return;
      ctx.fillStyle = fills[i];
      ctx.fillRect(xi, b[0], wi, b[1] - b[0]);
    });
    // Separator: a porous membrane.
    var sep = ly[3];
    ctx.fillStyle = col.light ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)";
    ctx.fillRect(xi, sep[0], wi, sep[1] - sep[0]);
    ctx.fillStyle = col.front;
    for (var x = xi + 3; x < xi + wi; x += 7) ctx.fillRect(x, sep[0] + 1, 2, sep[1] - sep[0] - 2);
    // Layered electrode structure.
    ctx.strokeStyle = col.lattice;
    ctx.lineWidth = 1;
    [ly[1], ly[5]].forEach(function (b) {
      for (var r = 0; r <= 5; r++) {
        var y = b[0] + (r / 5) * (b[1] - b[0]);
        ctx.beginPath();
        ctx.moveTo(c.x0 + 84, y);
        ctx.lineTo(xi + wi, y);
        ctx.stroke();
      }
    });
    var lc = col["--d-muted"];
    text("Cathode", xi + 10, (ly[1][0] + ly[1][1]) / 2, 12, lc);
    text("Separator", xi + 10, (ly[3][0] + ly[3][1]) / 2 - 11 / k, 12, lc);
    text("Anode", xi + 10, (ly[5][0] + ly[5][1]) / 2, 12, lc);

    // Ions.
    ions.forEach(function (ion) {
      var p = ionPos(ion, now);
      ctx.beginPath();
      ctx.arc(p.x, p.y, ion.from ? 4.6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = col.ion;
      ctx.shadowColor = col.ion;
      ctx.shadowBlur = ion.from ? 10 : 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function coilPath(c) {
    // A rectangular spiral in the plane of the top face, spaced evenly in
    // screen units even though the face is foreshortened.
    var depth = Math.sqrt(c.dx * c.dx + c.dy * c.dy), width = c.x1 - c.x0;
    var turns = 7, gap = 6;
    var cu = 0.5, cv = 0.5, hu = 0.36, hv = 0.37;
    var du = gap / width, dv = gap / depth;
    var pts = [];
    var padSideU = L.padU;
    pts.push([padSideU, cv + hv]);
    for (var i = 0; i < turns; i++) {
      var a = hu - i * du, b = hv - i * dv, a2 = hu - (i + 1) * du;
      if (padSideU > 0.5) {
        pts.push([cu + a, cv + b], [cu + a, cv - b], [cu - a, cv - b], [cu - a, cv + b], [cu + a2, cv + b]);
      } else {
        pts.push([cu - a, cv + b], [cu - a, cv - b], [cu + a, cv - b], [cu + a, cv + b], [cu - a2, cv + b]);
      }
    }
    var end = pts[pts.length - 1];
    return { spiral: pts, inner: end, padOuter: [padSideU, cv + hv], padInner: [padSideU, cv - 0.06] };
  }

  function drawCoil(now, soc) {
    var c = L.cell, cp = coilPath(c);
    var map = function (q) {
      return P(c, q[0], q[1]);
    };
    // Flex substrate under the windings.
    var lo = Math.min(0.08, L.padU - 0.03), hi = Math.max(0.92, L.padU + 0.03);
    poly([P(c, lo, 0.07), P(c, hi, 0.07), P(c, hi, 0.93), P(c, lo, 0.93)]);
    ctx.fillStyle = col.light ? "rgba(214,150,60,0.35)" : "rgba(214,150,60,0.22)";
    ctx.fill();

    // The windings shimmer in step with the oscillation they set up.
    var s = sampleAt(now);
    var glow = s ? 0.5 + 0.5 * Math.sin(s.ph) : 0.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = col["--d-coil"];
    ctx.lineWidth = 2.2;
    ctx.shadowColor = col["--d-coil"];
    ctx.shadowBlur = 2 + glow * 7;
    ctx.beginPath();
    cp.spiral.map(map).forEach(function (p, i) {
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bridge from the centre back out to the second pad, over the turns.
    var a = map(cp.inner), b = map([cp.inner[0], cp.padInner[1]]), d = map(cp.padInner);
    ctx.strokeStyle = col.front;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.stroke();
    ctx.strokeStyle = col["--d-coil"];
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Pads.
    [cp.padOuter, cp.padInner].forEach(function (q) {
      var p = map(q);
      ctx.fillStyle = "#d9a441";
      ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8);
    });
    return [map(cp.padOuter), map(cp.padInner)];
  }

  function drawWires(pads) {
    var b = L.pcb, ends;
    if (L === WIDE) {
      ends = [[b.x, b.y + b.h * 0.3], [b.x, b.y + b.h * 0.55]];
    } else {
      ends = [[b.x + b.w * 0.18, b.y], [b.x + b.w * 0.36, b.y]];
    }
    ctx.lineCap = "round";
    pads.forEach(function (p, i) {
      var e = ends[i];
      var c1 = [p[0] + L.wireOut[0] - i * 10, p[1] + L.wireOut[1] + i * 8];
      var c2 = L === WIDE ? [e[0] - 70, e[1]] : [14 + i * 10, e[1] - 110];
      ctx.strokeStyle = col.light ? "#5a3a1a" : "#1a1a1a";
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
      ctx.stroke();
      ctx.strokeStyle = col["--d-coil"];
      ctx.lineWidth = 2.4;
      ctx.stroke();
    });
  }

  function drawPCB() {
    var b = L.pcb;
    roundRect(b.x, b.y, b.w, b.h, 6);
    ctx.fillStyle = col["--d-pcb"];
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Traces first, so the parts sit on them.
    ctx.strokeStyle = "rgba(160,230,170,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b.x + 6, b.y + b.h * 0.3);
    ctx.lineTo(b.x + b.w * 0.3, b.y + b.h * 0.3);
    ctx.moveTo(b.x + 6, b.y + b.h * 0.55);
    ctx.lineTo(b.x + b.w * 0.3, b.y + b.h * 0.55);
    ctx.moveTo(b.x + b.w * 0.18, b.y + 6);
    ctx.lineTo(b.x + b.w * 0.18, b.y + b.h * 0.3);
    ctx.moveTo(b.x + b.w * 0.36, b.y + 6);
    ctx.lineTo(b.x + b.w * 0.36, b.y + b.h * 0.55);
    ctx.moveTo(b.x + b.w * 0.62, b.y + b.h * 0.5);
    ctx.lineTo(b.x + b.w - 6, b.y + b.h * 0.5);
    ctx.stroke();

    function chip(x, y, w, h, pins) {
      if (pins) {
        ctx.fillStyle = "#c9ccd1";
        for (var i = 0; i < pins; i++) {
          var o = ((i + 0.5) / pins) * w;
          ctx.fillRect(b.x + x + o - 1, b.y + y - 3, 2, h + 6);
          ctx.fillRect(b.x + x - 3, b.y + y + ((i + 0.5) / pins) * h - 1, w + 6, 2);
        }
      }
      ctx.fillStyle = "#121212";
      ctx.fillRect(b.x + x, b.y + y, w, h);
    }
    chip(b.w * 0.36, b.h * 0.24, 44, 44, 6);
    chip(b.w * 0.12, b.h * 0.7, 18, 10);
    chip(b.w * 0.74, b.h * 0.2, 16, 10);
    chip(b.w * 0.74, b.h * 0.72, 12, 7);
    chip(b.w * 0.88, b.h * 0.72, 8, 6);
    chip(b.w * 0.12, b.h * 0.08, 8, 6);

    // Pads, mounting holes, output pin.
    ctx.fillStyle = "#d9a441";
    if (L === WIDE) {
      ctx.fillRect(b.x + 2, b.y + b.h * 0.3 - 4, 8, 8);
      ctx.fillRect(b.x + 2, b.y + b.h * 0.55 - 4, 8, 8);
    } else {
      ctx.fillRect(b.x + b.w * 0.18 - 4, b.y + 2, 8, 8);
      ctx.fillRect(b.x + b.w * 0.36 - 4, b.y + 2, 8, 8);
    }
    ctx.fillRect(b.x + b.w - 10, b.y + b.h * 0.5 - 5, 10, 10);
    [[8, 8], [b.w - 8, 8], [8, b.h - 8], [b.w - 8, b.h - 8]].forEach(function (h) {
      ctx.beginPath();
      ctx.arc(b.x + h[0], b.y + h[1], 3.2, 0, Math.PI * 2);
      ctx.strokeStyle = "#d9a441";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });
  }

  function drawWave(now) {
    var w = L.wave, b = L.pcb;
    var x0 = b.x + b.w, y0 = b.y + b.h * 0.5;
    // Lead from the output pin to where the trace starts.
    ctx.strokeStyle = col["--d-faint"];
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(w.x0, w.cy);
    ctx.lineTo(w.x1, w.cy);
    ctx.stroke();
    ctx.setLineDash([]);
    if (y0 !== w.cy || x0 !== w.x0) {
      ctx.strokeStyle = col["--d-muted"];
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(w.x0 - 4, y0);
      ctx.lineTo(w.x0 - 4, w.cy);
      ctx.lineTo(w.x0, w.cy);
      ctx.stroke();
    }

    ctx.strokeStyle = col.accent || col["--d-ink"];
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    var started = false;
    for (var x = w.x0; x <= w.x1; x += 1.5) {
      var s = sampleAt(now - ((x - w.x0) / WAVE_SPEED) * 1000);
      if (!s) break;
      // Fade the trace in over its first few pixels so it leaves the pin cleanly.
      var ramp = Math.min(1, (x - w.x0) / 10);
      var y = w.cy - w.a * s.a * ramp * Math.sin(s.ph);
      if (started) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        started = true;
      }
    }
    ctx.stroke();
  }

  function drawMeter(soc, state) {
    var m = L.meter, bw = 54, bh = 24;
    roundRect(m.x, m.y - bh / 2, bw, bh, 4);
    ctx.strokeStyle = col["--d-ink"];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = col["--d-ink"];
    ctx.fillRect(m.x + bw + 1, m.y - 5, 4, 10);
    var fillCol = soc < 0.2 ? "#e5533d" : state === "Discharging" ? "#e0a020" : "#38c172";
    ctx.fillStyle = fillCol;
    roundRect(m.x + 3, m.y - bh / 2 + 3, Math.max(2, (bw - 6) * soc), bh - 6, 2);
    ctx.fill();
    if (state === "Charging") {
      // Lightning bolt.
      ctx.fillStyle = col["--d-ink"];
      var cx = m.x + bw / 2, cy = m.y;
      poly([[cx + 2, cy - 9], [cx - 5, cy + 1], [cx - 0.5, cy + 1], [cx - 2, cy + 9], [cx + 5, cy - 1], [cx + 0.5, cy - 1]]);
      ctx.fill();
    }
    text(state + ", " + Math.round(soc * 100) + "%", m.x + bw + 16, m.y + 1, 15, col["--d-ink"]);
  }

  function drawCaptions() {
    var c = L.cell, b = L.pcb, w = L.wave, mc = col["--d-muted"];
    var t = P(c, 0.5, 1);
    text("Planar coil", t[0], t[1] - 12 / k, 12, mc, "center");
    text("Readout board", b.x + b.w / 2, b.y + b.h + 14 / k, 12, mc, "center");
    text("Output", (w.x0 + w.x1) / 2, w.cy - w.a - 14 / k, 12, mc, "center");
  }

  // ---- loop ----------------------------------------------------------------
  var clock = 0, last = 0, raf = 0, visible = false;
  var lastNow = 0; // time of the last frame drawn, for redraws while stopped
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var playing = !reduce;

  function draw(now) {
    if (!W) return;
    var soc = socAt(clock);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col["--d-bg"];
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    drawCell(now);
    var pads = drawCoil(now, soc);
    drawPCB();
    drawWires(pads);
    drawWave(now);
    drawMeter(soc, stateAt(clock));
    drawCaptions();
  }

  function frame(now) {
    raf = 0;
    if (!last && lastNow) {
      // Resuming after a pause or a scroll away: slide the stored timeline
      // forward so the wave and any ion in flight carry on where they were.
      var gap = now - lastNow - 16;
      history.forEach(function (h) {
        h.t += gap;
      });
      ions.forEach(function (ion) {
        ion.t0 += gap;
      });
    }
    var dt = last ? Math.min(now - last, 100) : 16;
    last = now;
    lastNow = now;
    clock += dt;
    var soc = socAt(clock);
    updateIons(soc, now);
    emit(now, soc, dt);
    draw(now);
    if (playing && visible) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (playing && visible && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  var controls = document.createElement("div");
  controls.className = "demoControls";
  var playBtn = document.createElement("button");
  playBtn.type = "button";
  controls.appendChild(playBtn);
  fig.querySelector("figcaption").appendChild(controls);
  function paintButton() {
    playBtn.textContent = playing ? "Pause" : "Play";
  }
  playBtn.addEventListener("click", function () {
    playing = !playing;
    paintButton();
    kick();
  });

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    kick();
  }, { threshold: 0.2 }).observe(fig);
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(function () {
    readColours();
    if (!raf) draw(lastNow);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // The accent colour drifts with the clock; pick it up now and then.
  setInterval(function () {
    col.accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  }, 1000);

  readColours();
  if (reduce) {
    // A still frame: half charged, with a stretch of output already drawn.
    clock = SWEEP_MS / 2;
    var t = performance.now() - 2000;
    for (var i = 0; i <= 120; i++) emit(t + i * 17, socAt(clock), 17);
    lastNow = t + 120 * 17;
  } else {
    lastNow = performance.now();
  }
  paintButton();
  fig.classList.add("ready");
  resize();
  if (document.fonts) document.fonts.ready.then(function () {
    if (!raf) draw(lastNow);
  });
})();
