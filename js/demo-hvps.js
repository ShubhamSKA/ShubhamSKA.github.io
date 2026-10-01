// The high voltage supply from the paper, drawn as hardware rather than as a
// schematic: (a) the dimmer, (b) the car ignition coil, (c) the
// Cockcroft-Walton multiplier built from forty 1 nF caps and eight diodes, all
// inside (d) the box, with the 17 uF air-conditioner capacitor between the
// dimmer and the coil. Its output goes to a syringe needle above a grounded,
// foil-covered copper plate.
//
// Switch the power strip on and the multiplier charges up stage by stage. The
// dimmer dial sets the output between 18 and 30 kV. Past the onset voltage the
// drop at the needle pulls into a Taylor cone and a jet whips down and lays
// fibre on the foil; the harder the field pulls, the shorter the straight part
// of the jet and the wider and faster it whips.
(function () {
  var fig = document.getElementById("demo-hvps");
  if (!fig) return;
  var stage = fig.querySelector(".demoStage");
  var NS = "http://www.w3.org/2000/svg";

  var KV_MIN = 18; // the dial's range
  var KV_MAX = 30;
  var KV_ONSET = 15; // bottom of the 15 to 30 kV range the paper gives
  var KV_OFF = 14.4; // hysteresis, so the jet does not flicker at the edge
  var CHARGE_S = 0.9; // time constant charging up
  var BLEED_S = 1.6; // and bleeding off
  var MAX_FIBRE_PATHS = 140;

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
  function tag(letter, x, y, parent) {
    var g = el("g", { class: "hvTag" }, parent);
    el("circle", { cx: x, cy: y, r: 10 }, g);
    text(letter, { x: x, y: y + 4.2, "text-anchor": "middle" }, g);
  }

  // ---- canvas --------------------------------------------------------------
  stage.classList.add("hvStage");
  var svg = el("svg", { role: "group", "aria-label": "High voltage power supply driving an electrospinning needle" }, stage);
  var defs = el("defs", {}, svg);
  function grad(id, stops, vertical) {
    var g = el("linearGradient", { id: id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 }, defs);
    stops.forEach(function (s) {
      el("stop", { offset: s[0], "stop-color": s[1] }, g);
    });
  }
  grad("hvCoil", [[0, "#3c3c3e"], [0.45, "#141415"], [1, "#2e2e30"]], true);
  grad("hvCan", [[0, "#9aa1a9"], [0.35, "#eef0f2"], [0.7, "#b4bac1"], [1, "#868d95"]], false);
  grad("hvNeedle", [[0, "#8c939b"], [0.5, "#f1f3f5"], [1, "#8c939b"]], false);
  grad("hvCopper", [[0, "#e19a5b"], [1, "#b8692f"]], true);
  var blur = el("filter", { id: "hvGlow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
  el("feGaussianBlur", { stdDeviation: 3.5 }, blur);
  var blurBig = el("filter", { id: "hvGlowBig", x: "-80%", y: "-80%", width: "260%", height: "260%" }, defs);
  el("feGaussianBlur", { stdDeviation: 7 }, blurBig);

  var gStrip = el("g", {}, svg);
  var gCables = el("g", {}, svg);
  var gBox = el("g", {}, svg);
  var gSpin = el("g", {}, svg);

  // ---- power strip ---------------------------------------------------------
  el("path", { d: "M28,450 L28,470", stroke: "#2a2a2a", "stroke-width": 7, "stroke-linecap": "round" }, gStrip);
  el("rect", { x: 0, y: 228, width: 56, height: 226, rx: 10, fill: "#ececef", stroke: "#a9adb3", "stroke-width": 2 }, gStrip);
  [330, 400].forEach(function (y) {
    el("rect", { x: 9, y: y - 22, width: 38, height: 44, rx: 9, fill: "#dcdde1", stroke: "#b9bcc1" }, gStrip);
    el("rect", { x: 18, y: y - 12, width: 4, height: 12, rx: 1, fill: "#3a3a3a" }, gStrip);
    el("rect", { x: 34, y: y - 12, width: 4, height: 12, rx: 1, fill: "#3a3a3a" }, gStrip);
    el("path", { d: "M24," + (y + 12) + " a4,4 0 0 1 8,0 v5 h-8 Z", fill: "#3a3a3a" }, gStrip);
  });
  // The box's plug, in the top socket.
  el("rect", { x: 14, y: 318, width: 28, height: 22, rx: 5, fill: "#1f1f21" }, gStrip);
  var switchG = el("g", { class: "hvBtn", tabindex: 0, role: "switch", "aria-checked": "false", "aria-label": "Power strip switch" }, gStrip);
  el("rect", { x: 8, y: 244, width: 40, height: 58, rx: 6, fill: "#1b1b1d" }, switchG);
  var rockerGlow = el("rect", { x: 12, y: 250, width: 32, height: 46, rx: 4, fill: "#ff5a2a", opacity: 0, filter: "url(#hvGlow)" }, switchG);
  var rocker = el("rect", { x: 13, y: 250, width: 30, height: 46, rx: 4, fill: "#6e1a12", stroke: "#3a0c08" }, switchG);
  var rockerTop = el("rect", { x: 13, y: 250, width: 30, height: 23, rx: 4, fill: "#000", opacity: 0.22 }, switchG);
  text("I", { x: 28, y: 266, class: "hvRockerText", "text-anchor": "middle" }, switchG);
  text("O", { x: 28, y: 290, class: "hvRockerText", "text-anchor": "middle" }, switchG);

  // ---- (d) the box ---------------------------------------------------------
  el("rect", { x: 0, y: 0, width: 620, height: 440, rx: 22, fill: "#b9bdc2", stroke: "#8b9096", "stroke-width": 2 }, gBox);
  el("rect", { x: 16, y: 16, width: 588, height: 408, rx: 12, fill: "#e1e4e7", stroke: "#cbcfd4", "stroke-width": 4 }, gBox);
  el("rect", { x: 16, y: 196, width: 588, height: 10, fill: "#c7cbd0" }, gBox);
  [[36, 36], [584, 36], [36, 404], [584, 404]].forEach(function (p) {
    el("circle", { cx: p[0], cy: p[1], r: 15, fill: "#d2d6da", stroke: "#a7acb2" }, gBox);
    el("circle", { cx: p[0], cy: p[1], r: 5.5, fill: "#8a8f95" }, gBox);
  });
  [[8, 186], [612, 330], [612, 385]].forEach(function (p) {
    el("circle", { cx: p[0], cy: p[1], r: 12, fill: "#262628" }, gBox);
    el("circle", { cx: p[0], cy: p[1], r: 6.5, fill: "#3d3d40" }, gBox);
  });

  // Mains inside: live to the dimmer, neutral back to the coil.
  var wiresLV = el("g", { fill: "none", "stroke-linecap": "round" }, gBox);
  var mainsIn = [
    ["M16,190 L370,190 Q389,190 389,152", "#8a5a2b"],
    ["M16,184 L266,184 Q284,184 284,150 L284,124 L279,118", "#2f62b8"]
  ];
  var lvRun = [
    ["M389,80 C372,40 352,34 338,46", "#e6e6e6"],
    ["M312,46 C300,40 287,58 280,76", "#e6e6e6"]
  ];
  var flowPaths = [];
  mainsIn.concat(lvRun).forEach(function (w) {
    el("path", { d: w[0], stroke: "#222", "stroke-width": 5 }, wiresLV);
    el("path", { d: w[0], stroke: w[1], "stroke-width": 3 }, wiresLV);
    flowPaths.push(el("path", { d: w[0], class: "hvFlow" }, wiresLV));
  });

  // (b) ignition coil.
  var coil = el("g", {}, gBox);
  el("rect", { x: 72, y: 56, width: 190, height: 80, rx: 12, fill: "url(#hvCoil)" }, coil);
  el("rect", { x: 112, y: 76, width: 78, height: 40, rx: 3, fill: "#262628", stroke: "#4a4a4e" }, coil);
  text("12 V", { x: 151, y: 93, class: "hvSticker", "text-anchor": "middle" }, coil);
  text("IGNITION COIL", { x: 151, y: 106, class: "hvStickerSmall", "text-anchor": "middle" }, coil);
  el("rect", { x: 200, y: 50, width: 16, height: 92, rx: 3, fill: "#8b9097" }, coil);
  el("circle", { cx: 208, cy: 47, r: 6, fill: "#8b9097" }, coil);
  el("circle", { cx: 208, cy: 145, r: 6, fill: "#8b9097" }, coil);
  el("rect", { x: 258, y: 62, width: 14, height: 68, rx: 4, fill: "#1b1b1c" }, coil);
  [[279, 76, "+"], [279, 116, "−"]].forEach(function (t) {
    el("circle", { cx: t[0], cy: t[1], r: 6.5, fill: "#c4c8cd", stroke: "#7d838a" }, coil);
    text(t[2], { x: t[0] + 11, y: t[1] + 4, class: "hvTiny" }, coil);
  });
  el("polygon", { points: "72,78 56,84 44,90 44,102 56,108 72,114", fill: "#222" }, coil);
  var coronaCoil = el("circle", { cx: 34, cy: 96, r: 16, fill: "#b48cff", opacity: 0, filter: "url(#hvGlowBig)" }, coil);
  el("rect", { x: 28, y: 85, width: 24, height: 22, rx: 7, fill: "#b8261f" }, coil);

  // The 17 uF capacitor out of an air conditioner.
  var can = el("g", {}, gBox);
  el("rect", { x: 290, y: 50, width: 70, height: 128, rx: 9, fill: "url(#hvCan)", stroke: "#7f868e" }, can);
  el("ellipse", { cx: 325, cy: 52, rx: 35, ry: 9, fill: "#dfe3e7", stroke: "#8a9199" }, can);
  el("rect", { x: 308, y: 38, width: 8, height: 12, fill: "#c9a24d" }, can);
  el("rect", { x: 334, y: 38, width: 8, height: 12, fill: "#c9a24d" }, can);
  text("17 µF", { x: 325, y: 112, class: "hvCanText", "text-anchor": "middle" }, can);
  text("250 VAC", { x: 325, y: 128, class: "hvTiny", "text-anchor": "middle" }, can);
  var canGlow = el("rect", { x: 292, y: 52, width: 66, height: 124, rx: 9, fill: "#7ad7ff", opacity: 0, filter: "url(#hvGlow)" }, can);

  // (a) the dimmer, reduced to its dial: fully anticlockwise is 18 kV out,
  // fully clockwise 30 kV.
  var DIAL = { x: 488, y: 106 };
  var dimmer = el("g", {}, gBox);
  el("rect", { x: 380, y: 30, width: 216, height: 156, rx: 14, fill: "#f3f1ec", stroke: "#c4c0b6", "stroke-width": 2 }, dimmer);
  [[398, 46], [578, 46], [398, 170], [578, 170]].forEach(function (p) {
    el("circle", { cx: p[0], cy: p[1], r: 5, fill: "#d9d5cc", stroke: "#a8a397" }, dimmer);
    el("line", { x1: p[0] - 3, y1: p[1], x2: p[0] + 3, y2: p[1], stroke: "#8f8a7e", "stroke-width": 1.4 }, dimmer);
  });
  [80, 152].forEach(function (y) {
    el("circle", { cx: 389, cy: y, r: 6, fill: "#d4b45c", stroke: "#9c7f2f" }, dimmer);
  });
  var dimLed = el("circle", { cx: 572, cy: 106, r: 4, fill: "#5a3a12" }, dimmer);
  var dimLedGlow = el("circle", { cx: 572, cy: 106, r: 8, fill: "#ffb347", opacity: 0, filter: "url(#hvGlow)" }, dimmer);
  for (var tk = 0; tk <= 24; tk++) {
    var ta = ((-135 + (270 * tk) / 24) * Math.PI) / 180, major = tk % 6 === 0;
    var r0 = 49, r1 = major ? 58 : 54;
    el("line", {
      x1: DIAL.x + r0 * Math.sin(ta), y1: DIAL.y - r0 * Math.cos(ta),
      x2: DIAL.x + r1 * Math.sin(ta), y2: DIAL.y - r1 * Math.cos(ta),
      stroke: "#5b5850", "stroke-width": major ? 2 : 1
    }, dimmer);
    if (major) {
      text(String(18 + tk / 2), { x: DIAL.x + 68 * Math.sin(ta), y: DIAL.y - 68 * Math.cos(ta) + 3.5, class: "hvDialText", "text-anchor": "middle" }, dimmer);
    }
  }
  text("kV", { x: DIAL.x, y: DIAL.y + 66, class: "hvDialText", "text-anchor": "middle" }, dimmer);
  var knob = el("g", { class: "hvBtn hvKnob", tabindex: 0, role: "slider", "aria-label": "Dimmer dial, sets the output voltage", "aria-valuemin": 18, "aria-valuemax": 30 }, dimmer);
  var knobRot = el("g", {}, knob);
  el("circle", { cx: DIAL.x, cy: DIAL.y, r: 44, fill: "#2a2a2c", stroke: "#111", "stroke-width": 1.5 }, knobRot);
  for (var rr = 0; rr < 28; rr++) {
    var ra = (rr / 28) * Math.PI * 2;
    el("line", { x1: DIAL.x + Math.cos(ra) * 38, y1: DIAL.y + Math.sin(ra) * 38, x2: DIAL.x + Math.cos(ra) * 44, y2: DIAL.y + Math.sin(ra) * 44, stroke: "#47474b", "stroke-width": 2.4 }, knobRot);
  }
  el("circle", { cx: DIAL.x, cy: DIAL.y, r: 34, fill: "#323235" }, knobRot);
  el("circle", { cx: DIAL.x - 9, cy: DIAL.y - 11, r: 16, fill: "#fff", opacity: 0.06 }, knobRot);
  el("line", { x1: DIAL.x, y1: DIAL.y - 8, x2: DIAL.x, y2: DIAL.y - 40, stroke: "#f2f2f2", "stroke-width": 4, "stroke-linecap": "round" }, knobRot);

  // (c) the multiplier: two copper boards, four sets of ten 1 nF caps, and
  // four diode positions of two RG711s each, zigzagging between them.
  var mult = el("g", {}, gBox);
  var BOARDS = [
    { x: 60, y: 228, w: 420, h: 70, groups: [110, 190, 300, 380] },
    { x: 140, y: 332, w: 430, h: 70, groups: [200, 280, 390, 470] }
  ];
  var capGlows = []; // [set index] -> glow rects; sets C4, C6 on top, C5, C7 below
  BOARDS.forEach(function (b, bi) {
    el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 3, fill: "#7a3f1b", stroke: "#5a2e13" }, mult);
    var edges = [b.x + 4].concat(b.groups.reduce(function (acc, gx) {
      return acc.concat([gx, gx + 20]);
    }, []), [b.x + b.w - 4]);
    for (var i = 0; i < edges.length; i += 2) {
      el("rect", { x: edges[i], y: b.y + 4, width: edges[i + 1] - edges[i], height: b.h - 8, rx: 2, fill: "url(#hvCopper)" }, mult);
    }
    b.groups.forEach(function (gx, gi) {
      var set = bi * 2 + (gi >> 1);
      if (!capGlows[set]) capGlows[set] = [];
      capGlows[set].push(el("rect", { x: gx - 6, y: b.y + 2, width: 32, height: b.h - 4, rx: 6, fill: "#8fd8ff", opacity: 0, filter: "url(#hvGlow)" }, mult));
      for (var c = 0; c < 5; c++) {
        var cy = b.y + 7 + c * 12;
        el("circle", { cx: gx - 3, cy: cy + 4.5, r: 1.8, fill: "#e8e8e8" }, mult);
        el("circle", { cx: gx + 23, cy: cy + 4.5, r: 1.8, fill: "#e8e8e8" }, mult);
        el("rect", { x: gx - 2, y: cy, width: 24, height: 9, rx: 3, fill: "#2f7ed8", stroke: "#1d5aa5" }, mult);
        el("rect", { x: gx, y: cy + 1, width: 20, height: 3, rx: 1.5, fill: "#fff", opacity: 0.25 }, mult);
      }
    });
  });
  var DIODES = [[[180, 340], [225, 290]], [[285, 290], [315, 340]], [[375, 340], [415, 290]], [[460, 290], [505, 340]]];
  var diodeGlows = [];
  DIODES.forEach(function (d) {
    var p = d[0], q = d[1];
    el("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: "#d0d4d9", "stroke-width": 1.8 }, mult);
    el("circle", { cx: p[0], cy: p[1], r: 2.6, fill: "#e8e8e8" }, mult);
    el("circle", { cx: q[0], cy: q[1], r: 2.6, fill: "#e8e8e8" }, mult);
    var ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
    var glows = [];
    [0.3, 0.7].forEach(function (u) {
      var cx = p[0] + (q[0] - p[0]) * u, cy = p[1] + (q[1] - p[1]) * u;
      var g = el("g", { transform: "translate(" + cx + " " + cy + ") rotate(" + ang + ")" }, mult);
      glows.push(el("rect", { x: -11, y: -6, width: 22, height: 12, rx: 5, fill: "#ffae42", opacity: 0, filter: "url(#hvGlow)" }, g));
      el("rect", { x: -8, y: -3.6, width: 16, height: 7.2, rx: 2.5, fill: "#1a1a1b" }, g);
      el("rect", { x: 4, y: -3.6, width: 2.4, height: 7.2, fill: "#c9cdd2" }, g);
    });
    diodeGlows.push(glows);
  });

  // HV leads inside the box: coil tower to the input, output and ground out.
  var hvInside = [
    { d: "M30,96 C10,96 14,170 22,215 S50,262 80,262", c: "#b8261f", w: 6, hv: true },
    { d: "M540,360 C590,360 596,330 612,330", c: "#b8261f", w: 6, hv: true },
    { d: "M168,378 C168,418 200,418 300,418 L560,418 C600,418 604,392 612,385", c: "#1f1f21", w: 5 }
  ];
  var hvGlowPaths = [];
  hvInside.forEach(function (w) {
    if (w.hv) hvGlowPaths.push(el("path", { d: w.d, fill: "none", stroke: "#c18cff", "stroke-width": 12, opacity: 0, filter: "url(#hvGlow)" }, gBox));
    el("path", { d: w.d, fill: "none", stroke: w.c, "stroke-width": w.w, "stroke-linecap": "round" }, gBox);
  });

  tag("a", 586, 46, gBox);
  tag("b", 92, 46, gBox);
  tag("c", 40, 238, gBox);
  tag("d", 310, 8, gBox);

  // ---- needle, stand and collector ----------------------------------------
  var NX = 170, TIP = 178, FOIL = 389;
  el("rect", { x: 30, y: 430, width: 300, height: 16, rx: 3, fill: "#f1f1ee", stroke: "#bdbdb7" }, gSpin);
  el("rect", { x: 296, y: 20, width: 16, height: 412, rx: 3, fill: "#f6f6f3", stroke: "#bdbdb7" }, gSpin);
  el("rect", { x: 120, y: 64, width: 192, height: 14, rx: 3, fill: "#f6f6f3", stroke: "#bdbdb7" }, gSpin);
  el("rect", { x: 148, y: 56, width: 44, height: 30, rx: 4, fill: "#f6f6f3", stroke: "#bdbdb7" }, gSpin);
  el("circle", { cx: 200, cy: 71, r: 5, fill: "#e5e5e0", stroke: "#a9a9a3" }, gSpin);
  // Syringe.
  el("rect", { x: 150, y: 0, width: 40, height: 6, rx: 2, fill: "#e9edf2", stroke: "#9fb0c2" }, gSpin);
  el("rect", { x: 166, y: 6, width: 8, height: 40, fill: "#e9edf2", stroke: "#9fb0c2" }, gSpin);
  el("rect", { x: 146, y: 30, width: 48, height: 6, rx: 2, fill: "#e9edf2", stroke: "#9fb0c2" }, gSpin);
  el("rect", { x: 157, y: 46, width: 26, height: 80, fill: "#8ec6ff", opacity: 0.38 }, gSpin);
  el("rect", { x: 157, y: 42, width: 26, height: 6, fill: "#3a3a3d" }, gSpin);
  el("rect", { x: 156, y: 36, width: 28, height: 92, rx: 2, fill: "#fff", "fill-opacity": 0.1, stroke: "#9fb0c2", "stroke-width": 1.5 }, gSpin);
  for (var gi2 = 0; gi2 < 8; gi2++) el("line", { x1: 176, y1: 52 + gi2 * 9, x2: 183, y2: 52 + gi2 * 9, stroke: "#6d8097", "stroke-width": 1 }, gSpin);
  el("polygon", { points: "160,128 180,128 176,140 164,140", fill: "#e9edf2", stroke: "#9fb0c2" }, gSpin);
  el("rect", { x: 162, y: 140, width: 16, height: 11, rx: 2, fill: "#e86a9c" }, gSpin);
  el("rect", { x: NX - 1.6, y: 151, width: 3.2, height: TIP - 151, fill: "url(#hvNeedle)" }, gSpin);
  var tipGlow = el("circle", { cx: NX, cy: TIP + 4, r: 9, fill: "#b48cff", opacity: 0, filter: "url(#hvGlow)" }, gSpin);
  el("path", { d: "M147,154 l20,2 l0,6 l-20,2 Z", fill: "#c0261f" }, gSpin);
  // Collector: copper plate under aluminium foil, on an insulating block.
  el("rect", { x: 70, y: 404, width: 200, height: 26, fill: "#f6f6f3", stroke: "#bdbdb7" }, gSpin);
  el("polygon", { points: "40,398 300,398 300,406 40,406", fill: "url(#hvCopper)" }, gSpin);
  el("polygon", { points: "58,381 282,381 300,398 40,398", fill: "#c8773c" }, gSpin);
  el("polygon", { points: "64,382 276,382 292,396 48,396", fill: "#9da4ac", stroke: "#7f868e", "stroke-width": 0.8 }, gSpin);
  ["M80,386 L120,391", "M150,384 L190,393", "M210,388 L262,386", "M70,392 L110,387"].forEach(function (d) {
    el("path", { d: d, stroke: "#c3c8ce", "stroke-width": 0.7, fill: "none" }, gSpin);
  });
  var mat = el("g", { class: "hvFibre", fill: "none" }, gSpin);
  el("path", { d: "M300,401 l18,-4 l2,7 l-18,4 Z", fill: "#1f1f21" }, gSpin);
  // Distance, needle tip to collector.
  el("line", { x1: NX - 6, y1: TIP, x2: 30, y2: TIP, class: "hvMeasure" }, gSpin);
  el("line", { x1: 30, y1: TIP, x2: 30, y2: FOIL, class: "hvMeasure" }, gSpin);
  el("line", { x1: 24, y1: TIP, x2: 36, y2: TIP, class: "hvMeasureSolid" }, gSpin);
  el("line", { x1: 24, y1: FOIL, x2: 36, y2: FOIL, class: "hvMeasureSolid" }, gSpin);
  text("10 cm", { x: 22, y: (TIP + FOIL) / 2, class: "hvMeasureText", "text-anchor": "middle", transform: "rotate(-90 22 " + (TIP + FOIL) / 2 + ")" }, gSpin);
  // The drop, the jet, and the faint cone it whips inside.
  var envelope = el("path", { class: "hvEnvelope" }, gSpin);
  var jet = el("path", { class: "hvJet", fill: "none" }, gSpin);
  var drop = el("path", { fill: "#9fd0ff", "fill-opacity": 0.85, stroke: "#5f9fd6", "stroke-width": 0.6 }, gSpin);

  // ---- cables between the parts, placed per layout -------------------------
  var cableMains = el("path", { fill: "none", stroke: "#1f1f21", "stroke-width": 6, "stroke-linecap": "round" }, gCables);
  var flowMains = el("path", { class: "hvFlow" }, gCables);
  var cableHVGlow = el("path", { fill: "none", stroke: "#c18cff", "stroke-width": 12, opacity: 0, filter: "url(#hvGlow)" }, gCables);
  var cableHV = el("path", { fill: "none", stroke: "#b8261f", "stroke-width": 6, "stroke-linecap": "round" }, gCables);
  var cableGnd = el("path", { fill: "none", stroke: "#1f1f21", "stroke-width": 5, "stroke-linecap": "round" }, gCables);
  flowPaths.push(flowMains);
  hvGlowPaths.push(cableHVGlow);

  var LAYOUTS = {
    wide: { vb: [0, 0, 1100, 476], box: [80, 10], spin: [745, 10] },
    narrow: { vb: [0, 0, 710, 948], box: [80, 10], spin: [220, 478] }
  };
  var layoutName = "";
  function pt(g, x, y) {
    return [g[0] + x, g[1] + y];
  }
  function bez(a, c1, c2, b) {
    return "M" + a + " C" + c1 + " " + c2 + " " + b;
  }
  function layout() {
    var name = stage.clientWidth < 620 ? "narrow" : "wide";
    if (name === layoutName) return;
    layoutName = name;
    var L = LAYOUTS[name];
    svg.setAttribute("viewBox", L.vb.join(" "));
    gBox.setAttribute("transform", "translate(" + L.box.join(" ") + ")");
    gSpin.setAttribute("transform", "translate(" + L.spin.join(" ") + ")");
    // Out of the side of the plug, so the cord clears the strip's switch.
    var mains = bez([42, 329], [78, 334], [64, 196], pt(L.box, 6, 186));
    cableMains.setAttribute("d", mains);
    flowMains.setAttribute("d", mains);
    var hvA = pt(L.box, 620, 330), hvB = pt(L.spin, 148, 159);
    var gA = pt(L.box, 620, 385), gB = pt(L.spin, 318, 401);
    var hv, gnd;
    if (name === "wide") {
      hv = bez(hvA, [hvA[0] + 60, hvA[1]], [hvB[0] - 90, hvB[1]], hvB);
      gnd = bez(gA, [gA[0] + 40, gA[1] + 70], [gB[0] + 30, gB[1] + 60], gB);
    } else {
      hv = bez(hvA, [hvA[0] + 22, hvA[1] + 120], [hvB[0] - 120, hvB[1] - 120], hvB);
      gnd = bez(gA, [gA[0] + 16, gA[1] + 140], [gB[0] + 60, gB[1] + 40], gB);
    }
    cableHV.setAttribute("d", hv);
    cableHVGlow.setAttribute("d", hv);
    cableGnd.setAttribute("d", gnd);
  }

  // ---- side panel ----------------------------------------------------------
  var panel = document.createElement("div");
  panel.className = "hvPanel";
  var readout = document.createElement("div");
  readout.className = "hvReadout";
  readout.setAttribute("aria-live", "polite");
  var kvEl = document.createElement("strong");
  var stateEl = document.createElement("span");
  readout.appendChild(kvEl);
  readout.appendChild(stateEl);
  panel.appendChild(readout);
  var key = document.createElement("ul");
  key.className = "demoKey hvKey";
  [
    ["a", "Dimmer: turn the dial to set the output anywhere from 18 to 30 kV"],
    ["b", "Ignition coil from a car, fired 60 times a second through the 17 µF air-conditioner capacitor"],
    ["c", "Multiplier: 40 × 1 nF caps in four 2.5 nF sets and eight microwave diodes, doubling twice and rectifying"],
    ["d", "The box, with the high voltage lead out to the needle and the ground lead to the collector"]
  ].forEach(function (row) {
    var li = document.createElement("li");
    var b = document.createElement("b");
    b.className = "hvKeyTag";
    b.textContent = row[0];
    li.appendChild(b);
    li.appendChild(document.createTextNode(row[1]));
    key.appendChild(li);
  });
  panel.appendChild(key);
  stage.appendChild(panel);

  var controls = document.createElement("div");
  controls.className = "demoControls";
  var powerBtn = document.createElement("button");
  powerBtn.type = "button";
  var clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Clear foil";
  controls.appendChild(powerBtn);
  controls.appendChild(clearBtn);
  fig.querySelector("figcaption").appendChild(controls);

  // ---- state ---------------------------------------------------------------
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var on = false;
  var knobVal = 0.5;
  var vNow = 0; // where the voltage sits in the dial's range, 0 to 1
  var kv = 0;
  var jetting = false;
  var cone = 0; // 0 round drop, 1 Taylor cone
  var jetAlpha = 0;
  var sets = [0, 0, 0, 0]; // charge of C4, C6, C5, C7 as drawn: top pair then bottom pair
  var clock = 0;
  var fibre = null, fibreCount = 0;

  function setPower(want) {
    on = want;
    switchG.setAttribute("aria-checked", on ? "true" : "false");
    svg.classList.toggle("hvOn", on);
    rocker.setAttribute("fill", on ? "#ff5a2a" : "#6e1a12");
    rockerGlow.setAttribute("opacity", on ? 0.75 : 0);
    rockerTop.setAttribute("y", on ? 250 : 273);
    powerBtn.textContent = on ? "Switch off" : "Switch on";
    kick();
  }

  function setKnob(v) {
    knobVal = Math.max(0, Math.min(1, v));
    knobRot.setAttribute("transform", "rotate(" + (-135 + 270 * knobVal) + " " + DIAL.x + " " + DIAL.y + ")");
    var set = KV_MIN + (KV_MAX - KV_MIN) * knobVal;
    knob.setAttribute("aria-valuenow", set.toFixed(1));
    knob.setAttribute("aria-valuetext", set.toFixed(1) + " kilovolts");
    kick();
  }

  // ---- interaction ---------------------------------------------------------
  function pressable(g, fn) {
    g.addEventListener("click", fn);
    g.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn();
      }
    });
  }
  pressable(switchG, function () {
    setPower(!on);
  });
  powerBtn.addEventListener("click", function () {
    setPower(!on);
  });
  clearBtn.addEventListener("click", function () {
    while (mat.firstChild) mat.removeChild(mat.firstChild);
    fibre = null;
    fibreCount = 0;
  });

  // Turn the knob by dragging round it, scrolling over it, or arrow keys.
  function knobAngleFromEvent(e) {
    var r = knob.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var a = (Math.atan2(e.clientX - cx, cy - e.clientY) * 180) / Math.PI; // 0 = straight up
    return Math.max(-135, Math.min(135, a));
  }
  var turning = false;
  knob.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    turning = true;
    try {
      knob.setPointerCapture(e.pointerId);
    } catch (err) {}
    setKnob((knobAngleFromEvent(e) + 135) / 270);
  });
  knob.addEventListener("pointermove", function (e) {
    if (turning) setKnob((knobAngleFromEvent(e) + 135) / 270);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (t) {
    knob.addEventListener(t, function () {
      turning = false;
    });
  });
  knob.addEventListener("wheel", function (e) {
    e.preventDefault();
    setKnob(knobVal - Math.sign(e.deltaY) * 0.04);
  }, { passive: false });
  knob.addEventListener("touchmove", function (e) {
    e.preventDefault();
  }, { passive: false });
  knob.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") setKnob(knobVal + 1 / 24);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") setKnob(knobVal - 1 / 24);
    else return;
    e.preventDefault();
  });

  // ---- drawing -------------------------------------------------------------
  // A stronger field draws the cone in shorter.
  function coneLen() {
    return (7 + 7 * cone) * (1 - 0.35 * vNow);
  }

  function dropPath(c, jetOn) {
    var w = 4.6, h = coneLen();
    var bulge = 1 - c; // round drop bulges past the needle; a cone does not
    var y0 = TIP, x = NX, ay = y0 + h;
    var c1x = x - w - 2.4 * bulge, c1y = y0 + h * (0.75 - 0.3 * c);
    var c2x = x - 2.2 * bulge - (jetOn ? 0.4 : 0.8), c2y = ay;
    return "M" + (x - w) + "," + y0 + " C" + c1x + "," + c1y + " " + c2x + "," + c2y + " " + x + "," + ay +
      " C" + (2 * x - c2x) + "," + c2y + " " + (2 * x - c1x) + "," + c1y + " " + (x + w) + "," + y0 + " Z";
  }

  // The jet's shape follows the voltage: from 18 to 30 kV the straight part
  // shortens, and the whip below it gets wider, faster and more tightly wound.
  function jetParams() {
    return {
      straight: 48 - 32 * vNow,
      R: 38 + 46 * vNow,
      omega: reduce ? 0 : 13 + 15 * vNow,
      k: 0.1 + 0.07 * vNow
    };
  }

  function jetShape(t) {
    var P = jetParams();
    var top = TIP + coneLen();
    var straight = top + P.straight;
    var R = P.R, pts = [], land = null;
    pts.push([NX, top]);
    pts.push([NX, straight]);
    var omega = P.omega;
    for (var y = straight; y <= FOIL; y += 2) {
      var s = (y - straight) / (FOIL - straight);
      var r = R * Math.pow(s, 1.15) * (0.85 + 0.15 * Math.sin(t * 1.3 + s * 3));
      var ph = omega * t - (y - straight) * P.k;
      var x = NX + r * Math.cos(ph) + Math.sin(y * 0.21 + t * 7) * 0.8 * s;
      var z = Math.sin(ph);
      pts.push([x, y + z * 7 * s]);
      land = [x, z];
    }
    return { pts: pts, land: land };
  }

  function depositAt(land) {
    if (!land) return;
    var x = land[0] + (Math.random() - 0.5) * 2.5;
    var y = FOIL - 1 + land[1] * 6 + (Math.random() - 0.5) * 1.5;
    if (!fibre || fibreCount > 36) {
      fibre = el("path", { d: "M" + x.toFixed(1) + "," + y.toFixed(1) }, mat);
      fibreCount = 0;
      while (mat.childNodes.length > MAX_FIBRE_PATHS) mat.removeChild(mat.firstChild);
    } else {
      fibre.setAttribute("d", fibre.getAttribute("d") + "L" + x.toFixed(1) + "," + y.toFixed(1));
    }
    fibreCount++;
  }

  function stateText() {
    if (!on && kv < 0.5) return "Off. The drop just hangs at the needle.";
    if (!on) return "Off, bleeding down.";
    if (!jetting || Math.abs(kv - (KV_MIN + (KV_MAX - KV_MIN) * knobVal)) > 1) return "Charging up.";
    if (vNow < 0.3) return "Spinning gently: a long straight jet and a tight whip.";
    if (vNow > 0.7) return "Spinning hard: a short straight jet and a wide, fast whip.";
    return "Spinning: the jet whips down onto the foil.";
  }

  var lastText = "";
  function render(dt) {
    var target = on ? KV_MIN + (KV_MAX - KV_MIN) * knobVal : 0;
    var tau = target > kv ? CHARGE_S : BLEED_S;
    kv += (target - kv) * (1 - Math.exp(-dt / tau));
    if (!jetting && kv >= KV_ONSET) jetting = true;
    else if (jetting && kv < KV_OFF) jetting = false;

    // Stages charge in order along the ladder: C4, C5, C6, C7.
    var f = kv / KV_MAX;
    var order = [0, 2, 1, 3];
    order.forEach(function (s, i) {
      var want = on ? Math.max(0, Math.min(1, f * 1.25 - i * 0.12)) : Math.max(0, Math.min(1, f * 1.1 - (3 - i) * 0.08));
      sets[s] += (want - sets[s]) * Math.min(1, dt * 6);
      capGlows[s].forEach(function (g) {
        g.setAttribute("opacity", (sets[s] * 0.6).toFixed(3));
      });
    });

    var live = on && kv > 0.5;
    var flick = reduce ? 0.5 : Math.random();
    coronaCoil.setAttribute("opacity", live ? (0.25 + 0.5 * flick * f).toFixed(3) : 0);
    vNow = Math.max(0, Math.min(1, (kv - KV_MIN) / (KV_MAX - KV_MIN)));
    dimLed.setAttribute("fill", live ? "#ffb347" : "#5a3a12");
    dimLedGlow.setAttribute("opacity", live ? 0.8 : 0);
    canGlow.setAttribute("opacity", live ? (0.08 + 0.12 * (reduce ? 0.5 : Math.random())).toFixed(3) : 0);
    // Diodes conduct alternately, odd positions on one half-cycle, even on the other.
    var half = Math.floor(clock * 8) % 2;
    diodeGlows.forEach(function (pair, i) {
      var o = live ? ((i % 2 === half ? 0.75 : 0.1) * Math.min(1, f * 1.3)) : 0;
      pair.forEach(function (g) {
        g.setAttribute("opacity", o.toFixed(3));
      });
    });
    hvGlowPaths.forEach(function (p) {
      p.setAttribute("opacity", (Math.max(0, f - 0.15) * 0.5).toFixed(3));
    });
    tipGlow.setAttribute("opacity", (Math.max(0, f - 0.4) * 0.7).toFixed(3));

    // Drop to cone, then jet.
    var coneTarget = jetting ? 1 : Math.max(0, Math.min(1, (kv - 7) / 8)) * 0.55;
    cone += (coneTarget - cone) * Math.min(1, dt * 5);
    jetAlpha += ((jetting ? 1 : 0) - jetAlpha) * Math.min(1, dt * (jetting ? 4 : 8));
    drop.setAttribute("d", dropPath(cone, jetting));
    if (jetAlpha > 0.02) {
      var shape = jetShape(clock);
      jet.setAttribute("d", "M" + shape.pts.map(function (p) {
        return p[0].toFixed(1) + "," + p[1].toFixed(1);
      }).join(" L"));
      jet.setAttribute("opacity", jetAlpha.toFixed(3));
      jet.setAttribute("stroke-width", (1.35 - 0.55 * vNow).toFixed(2));
      var P = jetParams();
      var top = TIP + coneLen() + P.straight;
      envelope.setAttribute("d", "M" + NX + "," + top + " L" + (NX - P.R) + "," + FOIL + " L" + (NX + P.R) + "," + FOIL + " Z");
      envelope.setAttribute("opacity", (jetAlpha * 0.5).toFixed(3));
      if (jetting) {
        depositAt(shape.land);
        // More voltage, more material pulled through.
        if (!reduce && Math.random() < vNow) depositAt(jetShape(clock - 0.008).land);
        if (reduce) {
          // A still jet lands in one place; spread the mat out anyway.
          var r = jetParams().R * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
          depositAt([NX + r * Math.cos(a), Math.sin(a)]);
        }
      }
    } else {
      jet.setAttribute("opacity", 0);
      envelope.setAttribute("opacity", 0);
    }

    kvEl.textContent = (kv < 0.05 ? "0.0" : kv.toFixed(1)) + " kV";
    var st = stateText();
    if (st !== lastText) {
      stateEl.textContent = st;
      lastText = st;
    }
  }

  // ---- loop ----------------------------------------------------------------
  var raf = 0, last = 0, visible = false;
  function frame(t) {
    raf = 0;
    var dt = last ? Math.min((t - last) / 1000, 0.1) : 1 / 60;
    last = t;
    clock += dt;
    render(dt);
    var busy = on || kv > 0.05 || jetAlpha > 0.02 || cone > 0.01;
    if (visible && busy) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && visible) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    kick();
  }, { threshold: 0.1 }).observe(fig);
  new ResizeObserver(layout).observe(stage);

  layout();
  setKnob(knobVal);
  setPower(false);
  render(0);
  fig.classList.add("ready");
})();
