// The 8-bit Manchester carry adder from the report, one bit slice per column.
//
// Each slice turns A_i and B_i into three signals: propagate p = A xor B,
// generate g = A and B (made as g-bar with a NAND) and delete d = A nor B.
// Exactly one of them is high. They set the three switches of the carry cell
// (Fig. in section 2.2 of the report): a transmission gate on the carry line
// that closes on p, a PMOS to VDD that closes on g, and an NMOS to ground that
// closes on d. Generate and delete slices settle their carry straight away;
// only a run of propagate slices has to wait for the carry to arrive, which is
// why the carry chain is the critical path. Each sum is then S = p xor C_in.
(function () {
  var fig = document.getElementById("demo-manchester");
  if (!fig || !window.LogicKit) return;
  var K = window.LogicKit;
  var el = K.el, text = K.text;
  var stage = fig.querySelector(".demoStage");
  stage.classList.add("logicStage");

  var runner = K.Runner();
  var ui = K.bar(stage, [
    { key: "a", label: "A (hex)", value: "BB", maxLength: 4 },
    { key: "b", label: "B (hex)", value: "F5", maxLength: 4 },
    { key: "cin", label: "Carry in", kind: "check", value: false },
  ], [
    { key: "go", label: "Add", submit: true },
    { key: "rand", label: "Random", onClick: randomise },
  ]);

  // ---- geometry ----
  var W = 1010, H = 445;
  var Y_VDD = 182, Y_C = 252, Y_GND = 322;
  var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
    "aria-label": "Eight slices of a Manchester carry adder, with the carry line running from right to left" }, stage);
  function cx(i) { return 920 - i * 108; }

  var gWires = el("g", {}, svg);
  var gParts = el("g", {}, svg);
  var gTokens = el("g", {}, svg);

  // rails
  el("line", { x1: 92, y1: Y_VDD, x2: 985, y2: Y_VDD, class: "wire rail1" }, gWires);
  el("line", { x1: 92, y1: Y_GND, x2: 985, y2: Y_GND, class: "wire rail0" }, gWires);
  text("VDD", { x: 14, y: Y_VDD + 4, class: "lab" }, gParts);
  text("GND", { x: 14, y: Y_GND + 4, class: "lab" }, gParts);

  // carry in and carry out
  text("C in", { x: 990, y: Y_C - 22, "text-anchor": "middle" }, gParts);
  var cinCell = K.cell(990, Y_C, 22, gParts);
  text("C out", { x: 60, y: Y_C - 22, "text-anchor": "middle" }, gParts);
  var coutCell = K.cell(60, Y_C, 22, gParts);
  var coutWire = el("line", { x1: 71, y1: Y_C, x2: cx(7) - 54, y2: Y_C, class: "wire" }, gWires);

  function switchAt(x, y, angleClosed, angleOpen, len, parent) {
    // A blade hinged at (x, y). Closed it lies along angleClosed.
    var g = el("g", { class: "switch", transform: "translate(" + x + "," + y + ")" }, parent);
    var blade = el("line", { x1: 0, y1: 0, x2: len, y2: 0, class: "blade" }, g);
    blade.style.transformOrigin = "0 0";
    function set(on) {
      g.classList.toggle("on", !!on);
      blade.style.transform = "rotate(" + (on ? angleClosed : angleOpen) + "deg)";
    }
    set(false);
    el("circle", { cx: 0, cy: 0, r: 3, class: "term" }, g);
    return { set: set };
  }

  var slices = [];
  for (var i = 0; i < 8; i++) {
    var x = cx(i);
    var s = { i: i, x: x };
    text("bit " + i, { x: x, y: 22, "text-anchor": "middle", class: "lab" }, gParts);
    text("A", { x: x - 17, y: 42, "text-anchor": "middle" }, gParts);
    text("B", { x: x + 17, y: 42, "text-anchor": "middle" }, gParts);
    s.a = K.cell(x - 17, 62, 24, gParts);
    s.b = K.cell(x + 17, 62, 24, gParts);

    // p, g, d
    ["p", "g", "d"].forEach(function (name, k) {
      var px = x - 30 + k * 30;
      text(name, { x: px, y: 98, "text-anchor": "middle" }, gParts);
      s[name] = K.cell(px, 116, 20, gParts);
    });
    s.mode = text("", { x: x, y: 146, class: "mode" }, gParts);

    // carry line pieces: in from the right boundary, through the gate, to the node, out to the left
    var right = x + 54, tgR = x + 38, tgL = x + 10, node = x - 14, left = x - 54;
    s.pts = { right: right, tgR: tgR, tgL: tgL, node: node, left: left };
    s.wIn = el("line", { x1: right, y1: Y_C, x2: tgR, y2: Y_C, class: "wire" }, gWires);
    s.wMid = el("line", { x1: tgL, y1: Y_C, x2: node, y2: Y_C, class: "wire" }, gWires);
    s.wOut = el("line", { x1: node, y1: Y_C, x2: left, y2: Y_C, class: "wire" }, gWires);
    s.tg = switchAt(tgL, Y_C, 0, -32, 28, gParts);
    el("circle", { cx: tgR, cy: Y_C, r: 3, class: "term" }, gParts);
    text("p", { x: (tgL + tgR) / 2, y: Y_C + 20, "text-anchor": "middle" }, gParts);

    // PMOS up to VDD, NMOS down to ground, both from the node
    el("line", { x1: node, y1: Y_VDD, x2: node, y2: Y_VDD + 18, class: "wire rail1" }, gWires);
    s.wUp = el("line", { x1: node, y1: Y_VDD + 44, x2: node, y2: Y_C, class: "wire" }, gWires);
    s.pmos = switchAt(node, Y_VDD + 44, -90, -122, 26, gParts);
    el("circle", { cx: node, cy: Y_VDD + 18, r: 3, class: "term" }, gParts);
    text("g", { x: node + 14, y: Y_VDD + 35 }, gParts);

    s.wDown = el("line", { x1: node, y1: Y_C, x2: node, y2: Y_GND - 44, class: "wire" }, gWires);
    s.nmos = switchAt(node, Y_GND - 44, 90, 58, 26, gParts);
    el("line", { x1: node, y1: Y_GND - 18, x2: node, y2: Y_GND, class: "wire rail0" }, gWires);
    el("circle", { cx: node, cy: Y_GND - 18, r: 3, class: "term" }, gParts);
    text("d", { x: node + 14, y: Y_GND - 26 }, gParts);
    s.nodeDot = el("circle", { cx: node, cy: Y_C, r: 4.5, class: "term" }, gParts);

    // sum: S = p xor carry-in, a downward XOR fed by p and by the carry tapped off the right of the slice
    var tap = right - 8;
    s.wTap = el("path", { d: "M" + tap + "," + Y_C + " V340 H" + (x + 7) + " V357", class: "wire" }, gWires);
    el("line", { x1: x - 7, y1: 338, x2: x - 7, y2: 357, class: "wire" }, gWires);
    text("p", { x: x - 7, y: 333, "text-anchor": "middle" }, gParts);
    el("path", {
      d: "M" + (x - 14) + ",349 q14,9 28,0 M" + (x - 14) + ",354 q14,9 28,0 q0,17 -14,27 q-14,-10 -14,-27 Z",
      class: "wire", style: "stroke: var(--d-muted)",
    }, gParts);
    s.wSum = el("line", { x1: x, y1: 381, x2: x, y2: 398, class: "wire" }, gWires);
    text("S" + i, { x: x - 22, y: 416, "text-anchor": "middle" }, gParts);
    s.sum = K.cell(x, 411, 24, gParts);
    slices.push(s);
  }

  var tok = K.token(gTokens);

  function reset() {
    cinCell.set(null);
    coutCell.set(null);
    K.setBit(coutWire, null);
    slices.forEach(function (s) {
      ["a", "b", "p", "g", "d", "sum"].forEach(function (k) { s[k].set(null); });
      [s.wIn, s.wMid, s.wOut, s.wUp, s.wDown, s.wTap, s.wSum].forEach(function (w) { K.setBit(w, null); });
      s.tg.set(false);
      s.pmos.set(false);
      s.nmos.set(false);
      s.mode.classList.remove("show");
      K.setBit(s.nodeDot, null);
    });
    tok.hide();
  }

  function setNode(s, v) {
    [s.wMid, s.wOut].forEach(function (w) { K.setBit(w, v); });
    if (s.on === "g") K.setBit(s.wUp, 1);
    if (s.on === "d") K.setBit(s.wDown, 0);
  }

  function read() {
    var a = K.parseHexByte(ui.inputs.a.value);
    var b = K.parseHexByte(ui.inputs.b.value);
    ui.inputs.a.setAttribute("aria-invalid", a === null);
    ui.inputs.b.setAttribute("aria-invalid", b === null);
    if (a === null || b === null) {
      ui.readout.textContent = "Type A and B as two hex digits each, 00 to FF.";
      return null;
    }
    return { a: a, b: b, cin: ui.inputs.cin.checked ? 1 : 0 };
  }

  async function run() {
    var v = read();
    if (!v) return;
    var clock = runner.start();
    try {
      reset();
      ui.readout.textContent = "";
      var A = v.a, B = v.b;

      // 1. the operands arrive
      slices.forEach(function (s) {
        s.A = (A >> s.i) & 1;
        s.B = (B >> s.i) & 1;
        s.a.set(s.A);
        s.b.set(s.B);
      });
      await clock.wait(500);

      // 2. every slice works out p, g and d at once and sets its switches
      slices.forEach(function (s) {
        var p = s.A ^ s.B, g = s.A & s.B, d = (s.A | s.B) ^ 1;
        s.P = p;
        s.on = p ? "p" : g ? "g" : "d";
        s.p.set(p);
        s.g.set(g);
        s.d.set(d);
        s.tg.set(p);
        s.pmos.set(g);
        s.nmos.set(d);
        s.mode.textContent = p ? "propagate" : g ? "generate" : "delete";
        s.mode.classList.add("show");
      });
      ui.readout.textContent = "Every slice knows p, g and d at the same moment.";
      await clock.wait(650);

      // generate and delete slices settle their carry without waiting
      slices.forEach(function (s) {
        if (s.on === "g") { s.carryOut = 1; setNode(s, 1); K.setBit(s.nodeDot, 1); }
        if (s.on === "d") { s.carryOut = 0; setNode(s, 0); K.setBit(s.nodeDot, 0); }
      });
      ui.readout.textContent = "Generate slices pull their carry to VDD and delete slices to ground straight away.";
      await clock.wait(900);

      // 3. the carry ripples in from the right
      var c = v.cin;
      cinCell.set(c);
      ui.readout.textContent = "Propagate slices have to wait for the carry to arrive from the right.";
      for (var i = 0; i < 8; i++) {
        var s = slices[i];
        s.C = c;
        K.setBit(s.wIn, c);
        K.setBit(s.wTap, c);
        tok.start(s.pts.right + 4, Y_C, c);
        tok.to(s.pts.tgR, Y_C, 160);
        await clock.wait(170);
        if (s.on === "p") {
          tok.to(s.pts.node, Y_C, 200);
          await clock.wait(200);
          s.carryOut = c;
          setNode(s, c);
          K.setBit(s.nodeDot, c);
          tok.to(s.pts.left, Y_C, 160);
          await clock.wait(170);
        } else {
          tok.hide();
          await clock.wait(90);
        }
        c = s.carryOut;
      }
      tok.hide();
      K.setBit(coutWire, c);
      coutCell.set(c);
      await clock.wait(300);

      // 4. sums
      for (var j = 0; j < 8; j++) {
        var t = slices[j];
        t.S = t.P ^ t.C;
        K.setBit(t.wSum, t.S);
        t.sum.set(t.S);
        await clock.wait(60);
      }
      var S = slices.reduce(function (acc, s) { return acc | (s.S << s.i); }, 0);
      var expect = A + B + v.cin;
      var ok = ((c << 8) | S) === expect;
      ui.readout.innerHTML = "";
      ui.readout.appendChild(document.createTextNode(
        K.hex(A, 2) + " + " + K.hex(B, 2) + (v.cin ? " + 1" : "") + " → S = " + K.hex(S, 2) +
        ", C out = " + c + "  (" + (A) + " + " + B + (v.cin ? " + 1" : "") + " = " + expect + ") "));
      var mark = document.createElement("span");
      mark.className = ok ? "ok" : "";
      mark.textContent = ok ? "✓" : "mismatch";
      ui.readout.appendChild(mark);
    } catch (e) {
      if (clock.live()) throw e;
    }
  }

  function randomise() {
    ui.inputs.a.value = K.hex(Math.floor(Math.random() * 256), 2);
    ui.inputs.b.value = K.hex(Math.floor(Math.random() * 256), 2);
    run();
  }

  ui.form.addEventListener("submit", function (e) {
    e.preventDefault();
    run();
  });

  reset();
  fig.classList.add("ready");
  K.onFirstView(fig, run);
})();
