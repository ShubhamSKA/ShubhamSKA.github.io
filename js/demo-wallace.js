// Fig. 1 of the Wallace tree report, running on real numbers.
//
// The 64 partial products a_j AND b_i sit in a parallelogram of dots, one row
// per bit of B. Four sum layers then squeeze the columns. In each layer a
// column's dots are taken from the top in threes: three go into a full adder,
// a leftover pair into a half adder, a leftover single through a buffer. The
// one exception is copied from the figure: in sum layer 2 the pairs in columns
// 12 to 14 go through two buffers, not a half adder. Every block's sum stays in
// its column and its carry moves one column left, and each colour in a column
// is one block, as in the figure. Once no column holds more than two dots, a
// ripple-carry adder (a half adder for the first pair, full adders after it)
// gives the 16-bit product.
(function () {
  // ---- the arithmetic, kept apart from the drawing ----
  function blocksFor(layer, col, n) {
    if (layer === 2 && col >= 12 && col <= 14 && n === 2) return [1, 1];
    var out = [];
    while (n >= 3) { out.push(3); n -= 3; }
    if (n) out.push(n);
    return out;
  }

  // Returns every band of dots, top to bottom, with values and block groupings.
  function plan(a, b) {
    var bands = [];
    // band 1: partial products, row i holds a_j & b_i at column i + j
    var pp = [];
    for (var c = 0; c < 16; c++) pp.push([]);
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        pp[i + j].push({ v: ((a >> j) & 1) & ((b >> i) & 1), row: i });
      }
    }
    bands.push(pp);
    var cols = pp;
    var counts = [];
    for (var layer = 1; layer <= 4; layer++) {
      var next = [];
      for (c = 0; c <= 16; c++) next.push([]);
      var carries = [];
      var tally = { fa: 0, ha: 0, buf: 0 };
      for (c = 0; c < cols.length; c++) {
        var dots = cols[c];
        var sizes = blocksFor(layer, c, dots.length);
        var k = 0;
        var colCarries = [];
        sizes.forEach(function (size, bi) {
          var ins = dots.slice(k, k + size);
          k += size;
          ins.forEach(function (d) { d.block = bi; d.size = size; });
          var ones = ins.reduce(function (s, d) { return s + d.v; }, 0);
          var block = { col: c, index: bi, size: size, ins: ins };
          block.sum = { v: ones & 1, from: block };
          next[c].push(block.sum);
          if (size > 1) {
            block.carry = { v: size === 3 ? (ones >= 2 ? 1 : 0) : (ones === 2 ? 1 : 0), from: block };
            colCarries.push(block.carry);
          }
          if (size === 3) tally.fa++;
          else if (size === 2) tally.ha++;
          else tally.buf++;
        });
        carries[c + 1] = colCarries;
      }
      for (c = 0; c <= 16; c++) {
        if (carries[c]) next[c] = next[c].concat(carries[c]);
      }
      while (next.length && next[next.length - 1].length === 0) next.pop();
      counts.push(tally);
      bands.push(next);
      cols = next;
    }
    // ripple-carry adder over the last band
    var product = 0, carry = 0, steps = [];
    for (c = 0; c < 16; c++) {
      var col = cols[c] || [];
      var s = col.reduce(function (t, d) { return t + d.v; }, 0) + carry;
      var bit = s & 1;
      steps.push({ col: c, inCarry: carry, bit: bit, pair: col.length === 2 });
      carry = s >> 1;
      product |= bit << c;
    }
    return { bands: bands, counts: counts, product: product, steps: steps, carryOut: carry };
  }

  if (typeof document === "undefined") {
    if (typeof module === "object") module.exports = { plan: plan, blocksFor: blocksFor };
    return;
  }

  var fig = document.getElementById("demo-wallace");
  if (!fig || !window.LogicKit) return;
  var K = window.LogicKit;
  var el = K.el, text = K.text;
  var stage = fig.querySelector(".demoStage");
  stage.classList.add("logicStage");

  var runner = K.Runner();
  var ui = K.bar(stage, [
    { key: "a", label: "A (hex)", value: "CB", maxLength: 4 },
    { key: "b", label: "B (hex)", value: "11", maxLength: 4 },
  ], [
    { key: "go", label: "Multiply", submit: true },
    { key: "rand", label: "Random", onClick: randomise },
  ]);

  // ---- geometry ----
  var DY = 26, R = 10;
  function X(c) { return 196 + (15 - c) * 36; }
  var BAND_TOP = [96, 318, 488, 606, 698];
  var Y_A = 30, Y_B = 56, Y_P = 766;
  var COLOURS = ["cr", "cb", "cg"];

  var svg = el("svg", { viewBox: "0 0 760 806", class: "tall", role: "img",
    "aria-label": "Dot diagram of the Wallace tree reduction, from partial products to the product" }, stage);
  var gRules = el("g", {}, svg);
  var gBlocks = el("g", {}, svg);
  var gDots = el("g", {}, svg);
  var gTok = el("g", {}, svg);

  [74, 296, 466, 584, 676, 744].forEach(function (y) {
    el("line", { x1: 150, y1: y, x2: 740, y2: y, class: "rule" }, gRules);
  });
  text("×", { x: 160, y: 50, class: "lab", style: "font-size: 20px" }, gRules);
  var labels = [
    [Y_A + 4, "A"], [Y_B + 4, "B"],
    [BAND_TOP[0] + 4, "Partial products"],
    [BAND_TOP[1] + 4, "After sum layer 1"],
    [BAND_TOP[2] + 4, "After sum layer 2"],
    [BAND_TOP[3] + 4, "After sum layer 3"],
    [BAND_TOP[4] + 4, "After sum layer 4"],
    [Y_P + 4, "Product"],
  ];
  labels.forEach(function (l) { text(l[1], { x: 14, y: l[0], class: "lab" }, gRules); });
  for (var c = 0; c < 16; c++) {
    text(String(c), { x: X(c), y: 800, "text-anchor": "middle", style: "font-size: 10px" }, gRules);
  }

  function dot(x, y, parent) {
    var g = el("g", { class: "dot", transform: "translate(" + x + "," + y + ")" }, parent);
    el("circle", { r: R }, g);
    var t = text("", { x: 0, y: 0.5 }, g);
    return {
      g: g, x: x, y: y,
      show: function (v, colour) {
        g.setAttribute("class", "dot known " + (colour || "c0") + " v" + v);
        t.textContent = String(v);
      },
      colour: function (colour) {
        g.classList.remove("c0", "cr", "cb", "cg", "cp");
        g.classList.add(colour);
      },
    };
  }

  // A and B
  var aDots = [], bDots = [];
  for (var j = 0; j < 8; j++) {
    aDots.push(dot(X(j), Y_A, gDots));
    bDots.push(dot(X(j), Y_B, gDots));
  }
  var productDots = [];
  for (c = 0; c < 16; c++) productDots.push(dot(X(c), Y_P, gDots));

  // Bands are redrawn per run, since their shape is fixed but simplest to rebuild.
  var bandLayer = el("g", {}, gDots);
  var current = null;

  function reset() {
    while (bandLayer.firstChild) bandLayer.removeChild(bandLayer.firstChild);
    while (gBlocks.firstChild) gBlocks.removeChild(gBlocks.firstChild);
    while (gTok.firstChild) gTok.removeChild(gTok.firstChild);
    aDots.concat(bDots, productDots).forEach(function (d) {
      d.g.setAttribute("class", "dot");
      d.g.querySelector("text").textContent = "";
    });
  }

  // Place a band's dots: the partial products keep their parallelogram, later
  // bands stack each column from the top, as in the figure.
  function placeBand(bi, cols) {
    cols.forEach(function (col, c) {
      col.forEach(function (d, k) {
        var row = bi === 0 ? d.row : k;
        d.view = dot(X(c), BAND_TOP[bi] + row * DY, bandLayer);
      });
    });
  }

  function outlineBlocks(bandIndex, cols) {
    var outlines = [];
    cols.forEach(function (col, c) {
      var groups = {};
      col.forEach(function (d) {
        if (d.block === undefined) return;
        (groups[d.block] = groups[d.block] || []).push(d);
      });
      Object.keys(groups).forEach(function (bi) {
        var ds = groups[bi];
        var ys = ds.map(function (d) { return d.view.y; });
        var top = Math.min.apply(null, ys), bottom = Math.max.apply(null, ys);
        var r = el("rect", {
          x: X(c) - R - 3, y: top - R - 3, width: 2 * R + 6, height: bottom - top + 2 * R + 6, rx: R + 3,
          class: "block " + COLOURS[bi % 3],
        }, gBlocks);
        var name = ds.length === 3 ? "full adder" : ds.length === 2 ? "half adder" : "buffer";
        el("title", {}, r).textContent = name + ", column " + c;
        outlines.push(r);
      });
    });
    return outlines;
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
    return { a: a, b: b };
  }

  function centreOf(block) {
    var ys = block.ins.map(function (d) { return d.view.y; });
    return [X(block.col), (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2];
  }

  async function run() {
    var v = read();
    if (!v) return;
    var clock = runner.start();
    try {
      reset();
      var p = plan(v.a, v.b);
      current = p;
      ui.readout.textContent = "";

      // 1. operands
      for (var j = 0; j < 8; j++) {
        aDots[j].show((v.a >> j) & 1);
        bDots[j].show((v.b >> j) & 1);
      }
      await clock.wait(450);

      // 2. 64 AND gates, all at once; shown a row at a time so the shape reads
      placeBand(0, p.bands[0]);
      for (var i = 0; i < 8; i++) {
        p.bands[0].forEach(function (col) {
          col.forEach(function (d) { if (d.row === i) d.view.show(d.v, "c0"); });
        });
        await clock.wait(70);
      }
      ui.readout.textContent = "64 partial products from 64 AND gates.";
      await clock.wait(500);

      // 3. four sum layers
      for (var L = 1; L <= 4; L++) {
        var cols = p.bands[L - 1];
        cols.forEach(function (col) {
          col.forEach(function (d) { d.view.colour(COLOURS[d.block % 3]); });
        });
        var outlines = outlineBlocks(L - 1, cols);
        await clock.wait(30);
        outlines.forEach(function (o) { o.classList.add("show"); });
        var t = p.counts[L - 1];
        ui.readout.textContent = "Sum layer " + L + ": " + t.fa + " full adders, " + t.ha + " half adders, " + t.buf + " buffers.";
        await clock.wait(700);

        var nextCols = p.bands[L];
        placeBand(L, nextCols);
        var flights = [];
        nextCols.forEach(function (col) {
          col.forEach(function (d) {
            var from = centreOf(d.from);
            var tk = K.token(gTok);
            tk.start(from[0], from[1], d.v);
            flights.push([tk, d]);
          });
        });
        await clock.wait(40);
        flights.forEach(function (f) { f[0].to(f[1].view.x, f[1].view.y, 550); });
        await clock.wait(580);
        flights.forEach(function (f) {
          f[1].view.show(f[1].v, "c0");
          gTok.removeChild(f[0].g);
        });
        outlines.forEach(function (o) { o.classList.remove("show"); });
        await clock.wait(350);
      }

      // 4. ripple-carry adder
      var last = p.bands[4];
      last.forEach(function (col) { col.forEach(function (d) { d.view.colour("cr"); }); });
      ui.readout.textContent = "Every column holds two dots or fewer, so a ripple-carry adder finishes it.";
      var carryTok = K.token(gTok);
      var tokOn = false;
      for (var s = 0; s < p.steps.length; s++) {
        var st = p.steps[s];
        var x = X(st.col);
        var carryOut = s + 1 < p.steps.length ? p.steps[s + 1].inCarry : p.carryOut;
        if (st.pair) {
          // the carry steps one column left between adders
          if (tokOn) {
            carryTok.to(x, Y_P - 22, 160);
            await clock.wait(170);
          }
          productDots[st.col].show(st.bit, "cp");
          if (!tokOn) {
            carryTok.start(x, Y_P - 22, carryOut);
            tokOn = true;
          } else {
            K.setBit(carryTok.g, carryOut);
          }
          await clock.wait(90);
        } else {
          // a lone dot goes straight down
          productDots[st.col].show(st.bit, "cp");
          await clock.wait(80);
        }
      }
      carryTok.hide();

      var expect = v.a * v.b;
      ui.readout.innerHTML = "";
      ui.readout.appendChild(document.createTextNode(
        K.hex(v.a, 2) + " × " + K.hex(v.b, 2) + " = " + K.hex(p.product, 4) +
        "  (" + v.a + " × " + v.b + " = " + expect + ") "));
      var mark = document.createElement("span");
      var ok = p.product === expect;
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

  fig.classList.add("ready");
  K.onFirstView(fig, run);
})();
