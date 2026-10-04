// The 6-bit flash ADC from the report, from input voltage to output code.
//
// A resistor ladder sets 63 thresholds k/64 V, k = 1..63, between ground and
// the 1 V rail. Each feeds a StrongARM comparator (PMOS-tail below the 0.5 V
// midpoint, NMOS-tail above it) that outputs 1 when the input clears its
// threshold, so together they make a 63-bit thermometer code. The encoder
// folds that code in half five times. In a layer of K bits, the middle bit,
// number (K + 1) / 2, is the select line of every multiplexer in the layer and
// is also the next output bit, most significant first. Multiplexer i passes
// bit (K + 1) / 2 + i of the upper half when the select is 1 and bit i of the
// lower half when it is 0. 63 bits become 31, 15, 7, 3 and finally 1, which is
// the least significant bit.
(function () {
  // ---- the arithmetic ----
  function thermometer(vin) {
    var t = [null];
    for (var k = 1; k <= 63; k++) t.push(vin > k / 64 ? 1 : 0);
    return t; // 1-indexed, t[1] is the lowest threshold
  }

  function encode(t) {
    var layers = [t];
    var bits = [];
    var cur = t;
    while (cur.length - 1 > 1) {
      var K = cur.length - 1;
      var m = (K + 1) / 2;
      var sel = cur[m];
      bits.push(sel);
      var next = [null];
      for (var i = 1; i < m; i++) next.push(sel ? cur[m + i] : cur[i]);
      layers.push(next);
      cur = next;
    }
    bits.push(cur[1]);
    var code = bits.reduce(function (acc, b) { return acc * 2 + b; }, 0);
    return { layers: layers, bits: bits, code: code };
  }

  if (typeof document === "undefined") {
    if (typeof module === "object") module.exports = { thermometer: thermometer, encode: encode };
    return;
  }

  var fig = document.getElementById("demo-flashadc");
  if (!fig || !window.LogicKit) return;
  var K = window.LogicKit;
  var el = K.el, text = K.text;
  var stage = fig.querySelector(".demoStage");
  stage.classList.add("logicStage");

  var runner = K.Runner();
  var ui = K.bar(stage, [
    { key: "v", label: "Input (V)", kind: "number", value: "0.600", min: 0, max: 1, step: 0.001, inputMode: "decimal" },
    { key: "s", label: "Drag", kind: "range", value: "0.6", min: 0, max: 1, step: 0.001 },
  ], [
    { key: "go", label: "Convert", submit: true },
    { key: "rand", label: "Random", onClick: randomise },
  ]);

  // ---- geometry ----
  var Y0 = 560, SPAN = 512;
  function yv(u) { return Y0 - u * SPAN; }
  function yBit(K, i) { return Y0 - i * (SPAN / (K + 1)); }
  var X_LADDER = 92, X_CMP = 150, X_T = 205;
  var X_LAYER = [X_T, 330, 455, 570, 670, 760];
  var SIZE = [6, 10, 14, 18, 22, 24];
  var X_OUT = 880;

  var svg = el("svg", { viewBox: "0 0 940 600", class: "tall", role: "img",
    "aria-label": "Resistor ladder, comparators, thermometer code and folding encoder of a 6-bit flash ADC" }, stage);
  var gWire = el("g", {}, svg);
  var gParts = el("g", {}, svg);
  var gTok = el("g", {}, svg);
  var gTop = el("g", {}, svg);

  // ladder: a zigzag between every pair of taps, VDD at the top
  var d = "M" + X_LADDER + "," + (yv(1) - 14) + " V" + yv(1);
  for (var k = 64; k >= 1; k--) {
    var top = yBit(63, k), bottom = yBit(63, k - 1);
    var step = (bottom - top) / 4;
    d += " L" + (X_LADDER + 4) + "," + (top + step) + " L" + (X_LADDER - 4) + "," + (top + 3 * step) + " L" + X_LADDER + "," + bottom;
  }
  d += " V" + (Y0 + 14);
  el("path", { d: d, class: "wire", style: "stroke: var(--d-muted); stroke-width: 1.2" }, gWire);
  text("1 V", { x: X_LADDER - 12, y: yv(1) - 8, "text-anchor": "end", class: "lab" }, gParts);
  text("0 V", { x: X_LADDER - 12, y: Y0 + 14, "text-anchor": "end", class: "lab" }, gParts);

  // comparators and the thermometer column
  var therm = [null], cmps = [null];
  for (k = 1; k <= 63; k++) {
    var y = yBit(63, k);
    el("line", { x1: X_LADDER, y1: y, x2: X_CMP - 9, y2: y, class: "wire", style: "stroke-width: 1" }, gWire);
    var tri = el("path", {
      d: "M" + (X_CMP - 9) + "," + (y - 3.4) + " L" + (X_CMP + 9) + "," + y + " L" + (X_CMP - 9) + "," + (y + 3.4) + " Z",
      style: "fill: none; stroke-width: 1.2; stroke: var(--d-muted)",
    }, gParts);
    cmps.push(tri);
    el("line", { x1: X_CMP + 9, y1: y, x2: X_T - 3, y2: y, class: "wire", style: "stroke-width: 1" }, gWire);
  }
  // the input, shared by every comparator
  var vinBus = el("line", { x1: X_CMP - 22, y1: yv(1), x2: X_CMP - 22, y2: Y0, class: "wire", style: "stroke-width: 1.5" }, gWire);
  var vinMark = el("g", { class: "token" }, gTop);
  el("line", { x1: 4, y1: 0, x2: X_CMP + 12, y2: 0, style: "stroke: var(--d-one); stroke-width: 1.5; stroke-dasharray: 4 3" }, vinMark);
  el("rect", { x: 2, y: -19, width: 78, height: 15, rx: 3, style: "fill: var(--d-bg)" }, vinMark);
  var vinLabel = text("", { x: 6, y: -7, class: "lab mono" }, vinMark);
  function placeVin(u, ms) {
    vinMark.style.transitionDuration = (K.reduce ? 0 : ms) + "ms";
    vinMark.style.transform = "translate(0px," + yv(u) + "px)";
    vinLabel.textContent = "in " + u.toFixed(3) + " V";
  }

  // encoder layers: 63, 31, 15, 7, 3, 1 bits
  var layerCells = [];
  var layerK = [63, 31, 15, 7, 3, 1];
  layerK.forEach(function (Kb, L) {
    var cells = [null];
    for (var i = 1; i <= Kb; i++) {
      var s = SIZE[L];
      var c = K.cell(X_LAYER[L], yBit(Kb, i), s, gParts);
      if (s < 12) c.g.querySelector("text").style.display = "none";
      cells.push(c);
    }
    layerCells.push(cells);
    text(Kb + (Kb === 1 ? " bit" : " bits"), { x: X_LAYER[L], y: Y0 + 30, "text-anchor": "middle" }, gParts);
  });
  text("thermometer", { x: X_T, y: Y0 + 44, "text-anchor": "middle" }, gParts);

  // multiplexer wiring between layers: two candidate inputs per output
  var muxLines = [];
  for (var L = 0; L < 5; L++) {
    var Kb = layerK[L], m = (Kb + 1) / 2, lines = [];
    var xa = X_LAYER[L] + SIZE[L] / 2 + 2, xb = X_LAYER[L + 1] - SIZE[L + 1] / 2 - 2;
    for (var i = 1; i < m; i++) {
      var yo = yBit(layerK[L + 1], i);
      lines.push({
        lower: el("line", { x1: xa, y1: yBit(Kb, i), x2: xb, y2: yo, class: "wire faint", style: "stroke-width: 1" }, gWire),
        upper: el("line", { x1: xa, y1: yBit(Kb, m + i), x2: xb, y2: yo, class: "wire faint", style: "stroke-width: 1" }, gWire),
      });
    }
    muxLines.push(lines);
  }

  // select rings and the output register
  var rings = layerK.map(function (Kb, L) {
    var m = (Kb + 1) / 2, s = SIZE[L] + 8;
    return el("rect", { x: X_LAYER[L] - s / 2, y: yBit(Kb, m) - s / 2, width: s, height: s, rx: 4, class: "hl" }, gParts);
  });
  text("Output", { x: X_OUT, y: 132, "text-anchor": "middle", class: "lab" }, gParts);
  var outCells = [];
  for (var b = 0; b < 6; b++) {
    var yy = 160 + b * 40;
    text("D" + (5 - b), { x: X_OUT - 28, y: yy + 4, "text-anchor": "end" }, gParts);
    outCells.push(K.cell(X_OUT, yy, 26, gParts));
  }
  var codeText = text("", { x: X_OUT, y: 160 + 6 * 40 + 6, "text-anchor": "middle", class: "lab mono" }, gParts);
  // which comparator flavour sits where: PMOS-tail below the midpoint, NMOS-tail above
  [["NMOS-tail", 0.5, 1], ["PMOS-tail", 0, 0.5]].forEach(function (h) {
    var y1 = yv(h[2]) + 3, y2 = yv(h[1]) - 3, mid = (y1 + y2) / 2;
    el("path", { d: "M52," + y1 + " h-6 V" + y2 + " h6", class: "wire", style: "stroke: var(--d-muted); stroke-width: 1" }, gParts);
    text(h[0] + " comparators", { x: 36, y: mid, "text-anchor": "middle", transform: "rotate(-90 36 " + mid + ")" }, gParts);
  });

  function reset() {
    layerCells.forEach(function (cells) { cells.forEach(function (c) { if (c) c.set(null); }); });
    outCells.forEach(function (c) { c.set(null); });
    rings.forEach(function (r) { r.classList.remove("show"); });
    muxLines.forEach(function (lines) {
      lines.forEach(function (l) {
        [l.lower, l.upper].forEach(function (w) { K.setBit(w, null); w.classList.add("faint"); });
      });
    });
    cmps.forEach(function (c) { if (c) c.style.fill = "none"; });
    codeText.textContent = "";
    while (gTok.firstChild) gTok.removeChild(gTok.firstChild);
  }

  function read() {
    var u = parseFloat(String(ui.inputs.v.value).replace(",", "."));
    var bad = !(u >= 0 && u <= 1);
    ui.inputs.v.setAttribute("aria-invalid", bad);
    if (bad) {
      ui.readout.textContent = "Type a voltage from 0 to 1 V.";
      return null;
    }
    return u;
  }

  async function run() {
    var u = read();
    if (u === null) return;
    ui.inputs.s.value = u;
    var clock = runner.start();
    try {
      reset();
      var t = thermometer(u);
      var enc = encode(t);
      placeVin(u, 450);
      ui.readout.textContent = "";
      await clock.wait(500);

      // every comparator decides at the same clock edge
      for (var k = 1; k <= 63; k++) {
        layerCells[0][k].set(t[k]);
        if (t[k]) cmps[k].style.fill = "var(--d-one)";
        if (k % 8 === 0) await clock.wait(16);
      }
      var ones = t.filter(function (x) { return x === 1; }).length;
      ui.readout.textContent = ones + " of 63 comparators see the input above their threshold.";
      await clock.wait(700);

      // fold five times
      for (var L = 0; L < 5; L++) {
        var Kb = layerK[L], m = (Kb + 1) / 2, sel = enc.layers[L][m];
        rings[L].classList.add("show");
        ui.readout.textContent = "Layer of " + Kb + ": the middle bit is " + sel + ", so D" + (5 - L) + " = " + sel +
          (L < 4 ? " and the " + (sel ? "upper" : "lower") + " half carries on." : " and its partner carries on.");
        var from = [X_LAYER[L], yBit(Kb, m)];
        var tk = K.token(gTok);
        tk.start(from[0], from[1], sel);
        await clock.wait(30);
        tk.to(X_OUT, 160 + L * 40, 500);
        await clock.wait(520);
        gTok.removeChild(tk.g);
        outCells[L].set(sel);

        muxLines[L].forEach(function (l, idx) {
          var chosen = sel ? l.upper : l.lower;
          var v = enc.layers[L + 1][idx + 1];
          chosen.classList.remove("faint");
          K.setBit(chosen, v);
        });
        await clock.wait(250);
        for (var i = 1; i < m; i++) layerCells[L + 1][i].set(enc.layers[L + 1][i]);
        await clock.wait(550);
        rings[L].classList.remove("show");
      }

      // the last bit standing is the LSB
      rings[5].classList.add("show");
      var lsb = enc.layers[5][1];
      var tk2 = K.token(gTok);
      tk2.start(X_LAYER[5], yBit(1, 1), lsb);
      await clock.wait(30);
      tk2.to(X_OUT, 160 + 5 * 40, 450);
      await clock.wait(470);
      gTok.removeChild(tk2.g);
      outCells[5].set(lsb);
      rings[5].classList.remove("show");

      var bits = enc.bits.join("");
      codeText.textContent = bits + " = " + enc.code;
      var expect = Math.max(0, Math.min(63, Math.ceil(u * 64) - 1));
      var ok = enc.code === ones && enc.code === expect;
      ui.readout.innerHTML = "";
      ui.readout.appendChild(document.createTextNode(
        "in " + u.toFixed(3) + " V → " + bits + " = " + enc.code + ", the step from " +
        (enc.code / 64).toFixed(4) + " to " + ((enc.code + 1) / 64).toFixed(4) + " V "));
      var mark = document.createElement("span");
      mark.className = ok ? "ok" : "";
      mark.textContent = ok ? "✓" : "mismatch";
      ui.readout.appendChild(mark);
    } catch (e) {
      if (clock.live()) throw e;
    }
  }

  function randomise() {
    ui.inputs.v.value = (Math.random()).toFixed(3);
    run();
  }

  ui.form.addEventListener("submit", function (e) {
    e.preventDefault();
    run();
  });
  ui.inputs.s.addEventListener("input", function () {
    ui.inputs.v.value = Number(ui.inputs.s.value).toFixed(3);
    placeVin(Number(ui.inputs.s.value), 0);
  });
  ui.inputs.s.addEventListener("change", run);

  placeVin(0.6, 0);
  fig.classList.add("ready");
  K.onFirstView(fig, run);
})();
