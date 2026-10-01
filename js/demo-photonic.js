// The benchmarking loop, drawn with real designs. Each dataset (metagratings,
// and the existing thermophotovoltaic set) trains four generators: an AAE, a
// WGAN and their conditional versions. The figure alternates between the two
// things those models do:
//
//   reconstruct  an autoencoder is handed a real design and rebuilds it. The
//                originals and reconstructions are cut straight out of the
//                two figure images, and compared pixel by pixel.
//   generate     a model starts from random noise and produces a design that
//                is not in the dataset.
//
// Every design, real or new, then goes on to be scored, where the VGG
// surrogate gets through them over 100 times faster than the solver.
//
// Honest labels: the match percentages are measured from the images. The
// generated designs are stand-ins, made by blending the real designs with
// smooth noise under each dataset's mirror symmetry, not samples from the
// trained models. The latent bars are a picture of a latent vector only.
(function () {
  var fig = document.getElementById("demo-photonic");
  if (!fig) return;
  var stage = fig.querySelector(".demoStage");
  var NS = "http://www.w3.org/2000/svg";

  // Where each design sits in its source image: originals in the first row of
  // tiles, reconstructions in the second, same columns. `sym` is the mirror
  // symmetry the designs share and `block` the size of their pixel steps,
  // both of which the stand-in generator copies.
  var SETS = [
    {
      key: "meta", name: "Metagratings", src: "/img/photonic_metagrating_recon.png",
      rows: [32, 200], cols: [10, 253, 495, 738], w: 203, h: 101, pixelated: true, perRow: 4, perRowNarrow: 2, sym: "y", block: 3
    },
    {
      key: "tpv", name: "Thermophotovoltaics", src: "/img/photonic_tpv_recon.png",
      rows: [32, 200], cols: [10, 169, 329, 488, 648, 807], w: 133, h: 133, pixelated: false, perRow: 6, perRowNarrow: 3, sym: "xy", block: 2
    }
  ];
  var GENERATORS = [
    { name: "WGAN", gan: true, cond: false },
    { name: "cWGAN", gan: true, cond: true },
    { name: "AAE", gan: false, cond: false },
    { name: "cAAE", gan: false, cond: true }
  ];
  var CYCLE = 3.8; // seconds per reconstruction or generation
  var SURROGATE_PER_S = 14; // designs a second through the surrogate...
  var PER_THUMB = 3; // each thumbnail in its lane stands for a small batch
  var SOLVER_S = 8; // ...against one every eight seconds through the solver

  function el(tag, attrs, parent, ns) {
    var n = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function chevron(parent) {
    var a = el("div", { class: "pdArrow", "aria-hidden": "true" }, parent);
    var s = el("svg", { viewBox: "0 0 24 24" }, a, true);
    el("path", { d: "M5 8l7 7 7-7", fill: "none", stroke: "currentColor", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, s, true);
  }

  // ---- layout --------------------------------------------------------------
  stage.classList.add("pdStage");
  var tabs = el("div", { class: "pdTabs", role: "group", "aria-label": "Dataset" }, stage);
  var tabBtns = SETS.map(function (set, i) {
    var b = el("button", { type: "button", "aria-pressed": i === 0 ? "true" : "false" }, tabs);
    b.textContent = set.name;
    b.addEventListener("click", function () {
      choose(i);
    });
    return b;
  });

  var rowData = el("div", { class: "pdRow" }, stage);
  var labData = el("div", { class: "pdLabel" }, rowData);
  labData.innerHTML = "<span><b>Dataset</b> &middot; designs the models train on</span><span class='pdCountLabel'></span>";
  var tilesBox = el("div", { class: "pdTiles" }, rowData);

  chevron(stage);

  var rowGen = el("div", { class: "pdRow" }, stage);
  var labGen = el("div", { class: "pdLabel" }, rowGen);
  var modeLabel = el("span", {}, labGen);
  var chips = el("span", { class: "pdChips" }, labGen);
  var chipEls = {};
  ["AAE", "cAAE", "WGAN", "cWGAN"].forEach(function (name) {
    chipEls[name] = el("span", { class: "pdChip" }, chips);
    chipEls[name].textContent = name;
  });
  var flow = el("div", { class: "pdFlow" }, rowGen);
  var bigOrigBox = el("div", { class: "pdBig" }, flow);
  var bigOrig = el("canvas", { "aria-hidden": "true" }, bigOrigBox);
  var capLeft = el("div", { class: "pdCap" }, bigOrigBox);
  bigOrig.style.transition = "opacity 0.3s";

  var net = el("div", { class: "pdNet", "aria-hidden": "true" }, flow);
  var svg = el("svg", { viewBox: "0 0 200 124" }, net, true);
  var encG = el("g", { class: "pdEnc" }, svg, true);
  el("polygon", { class: "pdShape", points: "4,12 70,44 70,80 4,112" }, encG, true);
  var encHot = el("polygon", { class: "pdHot", points: "4,12 70,44 70,80 4,112" }, encG, true);
  var tEnc = el("text", { x: 37, y: 66, "text-anchor": "middle", class: "pdNetText" }, encG, true);
  tEnc.textContent = "encode";
  el("polygon", { class: "pdShape", points: "130,44 196,12 196,112 130,80" }, svg, true);
  var decHot = el("polygon", { class: "pdHot", points: "130,44 196,12 196,112 130,80" }, svg, true);
  var bars = [];
  for (var bi = 0; bi < 8; bi++) bars.push(el("rect", { class: "pdBar", x: 81 + bi * 5, y: 52, width: 3.4, height: 20, rx: 1 }, svg, true));
  var tDec = el("text", { x: 163, y: 66, "text-anchor": "middle", class: "pdNetText" }, svg, true);
  var tZ = el("text", { x: 100, y: 30, "text-anchor": "middle", class: "pdNetText" }, svg, true);

  var bigRecBox = el("div", { class: "pdBig" }, flow);
  var bigRec = el("canvas", { "aria-hidden": "true" }, bigRecBox);
  var bigDiff = el("canvas", { class: "pdDiff", "aria-hidden": "true" }, bigRecBox);
  var capRight = el("div", { class: "pdCap" }, bigRecBox);

  var meta = el("div", { class: "pdMeta" }, rowGen);
  var matchEl = el("span", {}, meta);
  var btnBox = el("span", { class: "pdBtns" }, meta);
  var diffBtn = el("button", { type: "button", "aria-pressed": "false" }, btnBox);
  diffBtn.textContent = "Show differences";
  var genBtn = el("button", { type: "button" }, btnBox);
  genBtn.textContent = "Generate one";

  var gallery = el("div", { class: "pdGallery" }, rowGen);
  var galLabel = el("div", { class: "pdLabel" }, gallery);
  galLabel.innerHTML = "<span><b>Generated so far</b> &middot; stand-ins blended from the real designs</span>";
  var galTiles = el("div", { class: "pdTiles" }, gallery);

  chevron(stage);

  var rowScore = el("div", { class: "pdRow" }, stage);
  var labScore = el("div", { class: "pdLabel" }, rowScore);
  labScore.innerHTML = "<span><b>Efficiency</b> &middot; scoring every design, real or new</span><span>Surrogate: over 100&times; faster</span>";
  function lane(name, sub) {
    var row = el("div", { class: "pdLane" }, rowScore);
    var l = el("div", {}, row);
    l.innerHTML = name + "<small>" + sub + "</small>";
    var c = el("canvas", { class: "pdTrack", "aria-hidden": "true" }, row);
    var n = el("div", { class: "pdCount" }, row);
    return { canvas: c, ctx: c.getContext("2d"), count: n };
  }
  var laneSolver = lane("EM solver", "full simulation");
  var laneSurr = lane("VGG surrogate", "predicts efficiency");

  var status = el("p", { class: "pdStatus", "aria-live": "polite" }, stage);

  // ---- data ----------------------------------------------------------------
  var data = [null, null];

  function load(i) {
    if (data[i]) return Promise.resolve(data[i]);
    var set = SETS[i];
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var designs = set.cols.map(function (cx) {
          var o = cut(img, cx, set.rows[0], set.w, set.h);
          var r = cut(img, cx, set.rows[1], set.w, set.h);
          return analyse(o, r, set);
        });
        var total = designs.reduce(function (a, d) {
          return a + d.match;
        }, 0);
        data[i] = { set: set, designs: designs, mean: total / designs.length, made: [] };
        resolve(data[i]);
      };
      img.src = set.src;
    });
  }

  function cut(img, x, y, w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(img, x, y, w, h, 0, 0, w, h);
    return c;
  }

  function boxBlur(src, w, h, r) {
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var s = 0, n = 0;
        for (var k = -r; k <= r; k++) {
          var xx = x + k;
          if (xx < 0 || xx >= w) continue;
          s += src[y * w + xx];
          n++;
        }
        tmp[y * w + x] = s / n;
      }
    }
    for (var y2 = 0; y2 < h; y2++) {
      for (var x2 = 0; x2 < w; x2++) {
        var s2 = 0, n2 = 0;
        for (var k2 = -r; k2 <= r; k2++) {
          var yy = y2 + k2;
          if (yy < 0 || yy >= h) continue;
          s2 += tmp[yy * w + x2];
          n2++;
        }
        out[y2 * w + x2] = s2 / n2;
      }
    }
    return out;
  }

  // Binarise both at mid-grey and compare. The differing pixels become a red
  // overlay; the rest is the match rate. Also keep a softened copy of each
  // original for the stand-in generator to blend.
  function analyse(o, r, set) {
    var w = set.w, h = set.h;
    var od = o.getContext("2d").getImageData(0, 0, w, h).data;
    var rd = r.getContext("2d").getImageData(0, 0, w, h).data;
    var diff = document.createElement("canvas");
    diff.width = w;
    diff.height = h;
    var dx = diff.getContext("2d");
    var dimg = dx.createImageData(w, h);
    var same = 0, n = w * h, filled = 0;
    var strips = [0, 0, 0, 0, 0, 0, 0, 0];
    var mask = new Float32Array(n);
    for (var p = 0; p < n; p++) {
      var a = od[p * 4] > 127, b = rd[p * 4] > 127;
      mask[p] = a ? 1 : 0;
      if (a) filled++;
      if (a === b) same++;
      else {
        dimg.data[p * 4] = 255;
        dimg.data[p * 4 + 1] = 59;
        dimg.data[p * 4 + 2] = 92;
        dimg.data[p * 4 + 3] = 235;
      }
      if (a) strips[Math.min(7, Math.floor(((p % w) / w) * 8))]++;
    }
    dx.putImageData(dimg, 0, 0);
    var r1 = Math.max(2, Math.round(Math.min(w, h) / 26));
    return {
      orig: o, rec: r, diff: diff, match: same / n, fill: filled / n,
      soft: boxBlur(boxBlur(mask, w, h, r1), w, h, r1),
      latent: strips.map(function (s) {
        return s / ((n / 8) || 1);
      })
    };
  }

  // ---- stand-in generation -------------------------------------------------
  function hash(x, y, seed) {
    var v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return v - Math.floor(v);
  }
  function smoothNoise(w, h, cell, seed) {
    var out = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
        var tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx);
        ty = ty * ty * (3 - 2 * ty);
        var a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
        out[y * w + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty - 0.5;
      }
    }
    return out;
  }
  function symmetrise(f, w, h, sym) {
    var out = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var my = h - 1 - y, mx = w - 1 - x;
        var v = f[y * w + x] + f[my * w + x];
        var n = 2;
        if (sym === "xy") {
          v += f[y * w + mx] + f[my * w + mx];
          n = 4;
        }
        out[y * w + x] = v / n;
      }
    }
    return out;
  }

  // Blend two or three real designs, add smooth noise, keep the symmetry, and
  // threshold to the blended fill fraction.
  function makeDesign() {
    var set = cur.set, w = set.w, h = set.h, n = w * h, ds = cur.designs;
    var pick = [];
    var count = Math.min(ds.length, 2 + (Math.random() < 0.5 ? 1 : 0));
    while (pick.length < count) {
      var k = Math.floor(Math.random() * ds.length);
      if (pick.indexOf(k) < 0) pick.push(k);
    }
    var wts = pick.map(function () {
      return 0.3 + Math.random();
    });
    var tot = wts.reduce(function (a, b) {
      return a + b;
    }, 0);
    var field = new Float32Array(n), fill = 0;
    pick.forEach(function (k, i) {
      var wt = wts[i] / tot, soft = ds[k].soft;
      fill += ds[k].fill * wt;
      for (var p = 0; p < n; p++) field[p] += soft[p] * wt;
    });
    var noise = smoothNoise(w, h, Math.max(6, Math.round(Math.min(w, h) / 6)), Math.random() * 1000);
    for (var q = 0; q < n; q++) field[q] += noise[q] * 0.45;
    field = symmetrise(field, w, h, set.sym);
    var sorted = Array.prototype.slice.call(field).sort(function (a, b) {
      return a - b;
    });
    var thr = sorted[Math.min(n - 1, Math.max(0, Math.floor(n * (1 - fill))))];
    // Fine noise for the design to condense out of, under the same symmetry.
    var raw = new Float32Array(n);
    for (var r = 0; r < n; r++) raw[r] = Math.random();
    var grain = symmetrise(raw, w, h, set.sym);
    var lat = [];
    for (var s = 0; s < 8; s++) lat.push(Math.random());
    return { field: field, thr: thr, grain: grain, latent: lat, canvas: null };
  }

  function renderMask(g, a, target) {
    var set = cur.set, w = set.w, h = set.h, n = w * h, b = set.block;
    var x = target.getContext("2d");
    var img = x.createImageData(w, h);
    for (var p = 0; p < n; p++) {
      // Sample on the dataset's own pixel grid, so edges step like theirs.
      var px = p % w, py = (p / w) | 0;
      var sx = Math.min(w - 1, Math.floor(px / b) * b + (b >> 1));
      var sy = Math.min(h - 1, Math.floor(py / b) * b + (b >> 1));
      var q = sy * w + sx;
      // From grain (a=0) to the design (a=1); the grain is spread so that its
      // speckle thins out as the design comes through.
      var v = a >= 1 ? g.field[q] : (1 - a) * (g.thr + (g.grain[q] - 0.5) * 0.9) + a * g.field[q];
      var on = v > g.thr ? 255 : 0;
      img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = on;
      img.data[p * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }

  function renderNoise(target) {
    var set = cur.set, w = set.w, h = set.h, n = w * h;
    var x = target.getContext("2d");
    var img = x.createImageData(w, h);
    for (var p = 0; p < n; p++) {
      var v = (Math.random() * 255) | 0;
      img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = v;
      img.data[p * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }

  // ---- state ---------------------------------------------------------------
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var setIdx = 0, cur = null, idx = 0, cycleT = 0;
  var mode = "rec"; // or "gen"
  var genIdx = 0, gen = null, genAdded = false, lastNoise = 0;
  var diffOn = false;
  var prevLatent = [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4];
  var tileBtns = [];
  var thumbs = [];
  var lanes = { surr: [], solver: null, nSurr: 0, nSolver: 0, spawn: 0, solverT: 0 };

  function choose(i) {
    setIdx = i;
    tabBtns.forEach(function (b, k) {
      b.setAttribute("aria-pressed", k === i ? "true" : "false");
    });
    load(i).then(function (d) {
      if (setIdx !== i) return;
      cur = d;
      buildTiles();
      buildThumbs();
      buildGallery();
      lanes = { surr: [], solver: null, nSurr: 0, nSolver: 0, spawn: 0, solverT: 0 };
      startRec(0);
      fig.querySelector(".pdCountLabel").textContent = d.designs.length + " shown here";
      kick();
    });
  }

  function columns() {
    var narrow = stage.clientWidth < 560;
    return "repeat(" + (narrow ? cur.set.perRowNarrow : cur.set.perRow) + ", 1fr)";
  }

  function buildTiles() {
    var set = cur.set;
    tilesBox.innerHTML = "";
    tilesBox.style.gridTemplateColumns = columns();
    tileBtns = cur.designs.map(function (d, k) {
      var b = el("button", { type: "button", class: "pdTile", "aria-label": set.name + " design " + (k + 1) }, tilesBox);
      var c = el("canvas", { width: set.w, height: set.h }, b);
      c.getContext("2d").drawImage(d.orig, 0, 0);
      c.style.imageRendering = set.pixelated ? "pixelated" : "auto";
      b.addEventListener("click", function () {
        startRec(k);
        kick();
      });
      return b;
    });
    [bigOrig, bigRec, bigDiff].forEach(function (c) {
      c.width = set.w;
      c.height = set.h;
      c.style.imageRendering = set.pixelated ? "pixelated" : "auto";
    });
  }

  function thumbOf(src) {
    var set = cur.set, th = 30;
    var c = document.createElement("canvas");
    c.width = Math.round((th * set.w) / set.h) * 2;
    c.height = th * 2;
    var x = c.getContext("2d");
    x.imageSmoothingEnabled = !set.pixelated;
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  function buildThumbs() {
    thumbs = [];
    cur.designs.forEach(function (d) {
      thumbs.push(thumbOf(d.orig), thumbOf(d.rec));
    });
    cur.made.forEach(function (c) {
      thumbs.push(thumbOf(c));
    });
  }

  // The newest generated designs, newest first, one row's worth.
  function buildGallery() {
    var set = cur.set;
    galTiles.innerHTML = "";
    galTiles.style.gridTemplateColumns = columns();
    var shown = cur.made.slice(-set.perRow).reverse();
    for (var i = 0; i < set.perRow; i++) {
      var box = el("div", { class: "pdSlot" }, galTiles);
      box.style.aspectRatio = set.w + " / " + set.h;
      if (shown[i]) {
        var c = el("canvas", { width: set.w, height: set.h }, box);
        c.getContext("2d").drawImage(shown[i], 0, 0);
        c.style.imageRendering = set.pixelated ? "pixelated" : "auto";
      }
    }
  }

  function setChips(names) {
    Object.keys(chipEls).forEach(function (k) {
      chipEls[k].classList.toggle("on", names.indexOf(k) >= 0);
    });
  }

  function startRec(k) {
    mode = "rec";
    idx = k;
    cycleT = reduce ? CYCLE - 0.01 : 0;
    tileBtns.forEach(function (b, j) {
      b.classList.toggle("active", j === k);
    });
    modeLabel.innerHTML = "<b>Reconstruct</b> &middot; an autoencoder rebuilds a real design";
    setChips(["AAE", "cAAE"]);
    encG.style.opacity = 1;
    tEnc.textContent = "encode";
    tDec.textContent = "decode";
    tZ.textContent = "latent z";
    capLeft.textContent = "Original";
    capRight.textContent = "Reconstruction";
    diffBtn.style.visibility = "visible";
    var d = cur.designs[k];
    var ox = bigOrig.getContext("2d");
    bigOrig.style.opacity = 0;
    ox.clearRect(0, 0, bigOrig.width, bigOrig.height);
    ox.drawImage(d.orig, 0, 0);
    requestAnimationFrame(function () {
      bigOrig.style.opacity = 1;
    });
    bigRec.getContext("2d").clearRect(0, 0, bigRec.width, bigRec.height);
    var dx = bigDiff.getContext("2d");
    dx.clearRect(0, 0, bigDiff.width, bigDiff.height);
    dx.drawImage(d.diff, 0, 0);
    bigDiff.style.opacity = 0;
    matchEl.textContent = "Pixels matching the original: measuring...";
  }

  function startGen() {
    mode = "gen";
    cycleT = reduce ? CYCLE - 0.01 : 0;
    var G = GENERATORS[genIdx];
    genIdx = (genIdx + 1) % GENERATORS.length;
    gen = makeDesign();
    gen.model = G;
    genAdded = false;
    tileBtns.forEach(function (b) {
      b.classList.remove("active");
    });
    modeLabel.innerHTML = "<b>Generate</b> &middot; a new design from random noise";
    setChips([G.name]);
    encG.style.opacity = 0.22;
    tDec.textContent = G.gan ? "generate" : "decode";
    tZ.textContent = G.cond ? "z + target" : "random z";
    capLeft.textContent = G.cond ? "Noise + target" : "Random noise";
    capRight.textContent = "New design";
    diffBtn.style.visibility = "hidden";
    bigDiff.style.opacity = 0;
    bigOrig.style.opacity = 1;
    renderNoise(bigOrig);
    bigRec.getContext("2d").clearRect(0, 0, bigRec.width, bigRec.height);
    matchEl.textContent = G.name + " is sampling...";
  }

  diffBtn.addEventListener("click", function () {
    diffOn = !diffOn;
    diffBtn.setAttribute("aria-pressed", diffOn ? "true" : "false");
    kick();
  });
  genBtn.addEventListener("click", function () {
    if (!cur) return;
    startGen();
    if (reduce) finishGen();
    kick();
  });

  function finishGen() {
    if (genAdded) return;
    genAdded = true;
    var c = document.createElement("canvas");
    c.width = cur.set.w;
    c.height = cur.set.h;
    renderMask(gen, 1, c);
    cur.made.push(c);
    if (cur.made.length > 24) cur.made.shift();
    thumbs.push(thumbOf(c));
    if (thumbs.length > cur.designs.length * 2 + 12) thumbs.splice(cur.designs.length * 2, 1);
    buildGallery();
  }

  // ---- drawing -------------------------------------------------------------
  function bump(t, a, b) {
    if (t < a || t > b) return 0;
    return Math.sin(((t - a) / (b - a)) * Math.PI);
  }
  function ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  var lastStatus = "";
  function say(s) {
    if (s !== lastStatus) {
      status.textContent = s;
      lastStatus = s;
    }
  }

  function drawBars(target, t0) {
    var m = ease((cycleT - t0) / 0.6);
    bars.forEach(function (b, k) {
      var v = prevLatent[k] + (target[k] - prevLatent[k]) * m;
      var h = 6 + 44 * v;
      b.setAttribute("y", (62 - h / 2).toFixed(1));
      b.setAttribute("height", h.toFixed(1));
    });
  }

  function drawRec() {
    var d = cur.designs[idx], t = cycleT;
    encHot.style.opacity = (bump(t, 0.35, 1.05) * 0.55).toFixed(3);
    decHot.style.opacity = (bump(t, 1.4, 2.05) * 0.55).toFixed(3);
    drawBars(d.latent, 0.9);
    // The reconstruction is drawn in from the left as the decoder finishes.
    var wipe = ease((t - 1.9) / 0.7);
    var rx = bigRec.getContext("2d");
    rx.clearRect(0, 0, bigRec.width, bigRec.height);
    rx.fillStyle = "rgba(127,127,127,0.12)";
    rx.fillRect(0, 0, bigRec.width, bigRec.height);
    if (wipe > 0) {
      var w = Math.max(1, Math.round(bigRec.width * wipe));
      rx.drawImage(d.rec, 0, 0, w, bigRec.height, 0, 0, w, bigRec.height);
    }
    var auto = bump(t, 2.6, 3.75);
    bigDiff.style.opacity = wipe >= 1 ? (diffOn ? 1 : auto).toFixed(3) : 0;
    if (t >= 2.6) {
      matchEl.innerHTML = "Pixels matching the original: <strong>" + (d.match * 100).toFixed(1) +
        "%</strong> &middot; across these " + cur.designs.length + ": <strong>" + (cur.mean * 100).toFixed(1) + "%</strong>";
    }
    if (t < 0.35) say("Design " + (idx + 1) + " of the " + cur.set.name.toLowerCase() + " set goes in.");
    else if (t < 1.3) say("The encoder squeezes it into a short latent vector.");
    else if (t < 2.6) say("The decoder rebuilds a design from that vector alone.");
    else say("Red marks the pixels the reconstruction got wrong.");
  }

  function drawGenerate(now) {
    var t = cycleT, G = gen.model;
    encHot.style.opacity = 0;
    decHot.style.opacity = (bump(t, 1.0, 2.0) * 0.55).toFixed(3);
    drawBars(gen.latent, 0.4);
    // The input noise churns until the sample is drawn.
    if (t < 1.0 && now - lastNoise > 90) {
      renderNoise(bigOrig);
      lastNoise = now;
    }
    var a = ease((t - 1.8) / 1.1);
    var rx = bigRec.getContext("2d");
    if (a <= 0) {
      rx.clearRect(0, 0, bigRec.width, bigRec.height);
      rx.fillStyle = "rgba(127,127,127,0.12)";
      rx.fillRect(0, 0, bigRec.width, bigRec.height);
    } else renderMask(gen, a, bigRec);
    if (t >= 2.9) {
      finishGen();
      matchEl.textContent = "A new design, in neither dataset. It joins the queue to be scored.";
    }
    var who = G.gan ? "the generator" : "the decoder";
    if (t < 1.0) say(G.name + ": " + (G.cond ? "random noise and a target go in." : "random noise goes in."));
    else if (t < 1.8) say("Nothing is encoded this time; " + who + " works from the noise alone.");
    else if (t < 2.9) say("A new design condenses out of it.");
    else say("It goes on to be scored alongside the real ones.");
  }

  function sizeLane(L) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(L.canvas.clientWidth * dpr), h = Math.round(L.canvas.clientHeight * dpr);
    if (L.canvas.width !== w || L.canvas.height !== h) {
      L.canvas.width = w;
      L.canvas.height = h;
    }
    return dpr;
  }

  var ink = "#fff", faint = "rgba(255,255,255,0.14)";
  function readColours() {
    var cs = getComputedStyle(fig);
    ink = cs.getPropertyValue("--d-ink").trim();
    faint = cs.getPropertyValue("--d-faint").trim();
  }

  // Icons at the end of each lane: a mesh for the solver, stacked conv blocks
  // narrowing to an output for the VGG network.
  function drawIcon(ctx, x, y, h, kind) {
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 1;
    if (kind === "mesh") {
      for (var i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * (h / 4), y);
        ctx.lineTo(x + i * (h / 4), y + h);
        ctx.moveTo(x, y + i * (h / 4));
        ctx.lineTo(x + h, y + i * (h / 4));
        ctx.stroke();
      }
    } else {
      [1, 0.8, 0.62, 0.46, 0.3].forEach(function (f, k) {
        var bh = h * f;
        ctx.globalAlpha = 0.45 + k * 0.1;
        ctx.fillRect(x + k * (h / 5), y + (h - bh) / 2, h / 5 - 1.5, bh);
      });
      ctx.globalAlpha = 1;
    }
  }

  function drawLanes(dt) {
    var anim = !reduce;
    [laneSolver, laneSurr].forEach(function (L) {
      var dpr = sizeLane(L);
      var c = L.ctx, w = L.canvas.width, h = L.canvas.height;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, w, h);
      c.scale(dpr, dpr);
      L.cw = w / dpr;
      L.ch = h / dpr;
      c.strokeStyle = faint;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, L.ch / 2);
      c.lineTo(L.cw - L.ch - 6, L.ch / 2);
      c.stroke();
      drawIcon(c, L.cw - L.ch + 2, 3, L.ch - 6, L === laneSolver ? "mesh" : "vgg");
    });
    if (!thumbs.length) return;
    var th = laneSurr.ch - 10, tw = (th * thumbs[0].width) / thumbs[0].height;
    var end = laneSurr.cw - laneSurr.ch - 8 - tw;

    // Surrogate: a steady stream. Solver: one design at a time, crawling.
    if (anim) {
      lanes.spawn -= dt;
      while (lanes.spawn <= 0) {
        lanes.surr.push({ x: -tw, k: Math.floor(Math.random() * thumbs.length) });
        lanes.spawn += PER_THUMB / SURROGATE_PER_S;
      }
      var speed = Math.max(80, (end + tw) / 0.8);
      lanes.surr.forEach(function (s) {
        s.x += speed * dt;
      });
      lanes.surr = lanes.surr.filter(function (s) {
        if (s.x >= end) {
          lanes.nSurr += PER_THUMB;
          return false;
        }
        return true;
      });
      lanes.solverT += dt;
      if (lanes.solverT >= SOLVER_S) {
        lanes.solverT -= SOLVER_S;
        lanes.nSolver++;
        lanes.solver = null;
      }
      if (!lanes.solver) lanes.solver = { k: Math.floor(Math.random() * thumbs.length) };
    } else {
      lanes.nSurr = SURROGATE_PER_S * SOLVER_S;
      lanes.nSolver = 1;
      lanes.solver = { k: 0 };
      lanes.surr = [];
      for (var q = 0; q < 6; q++) lanes.surr.push({ x: (end * q) / 6, k: q % thumbs.length });
    }
    var sc = laneSurr.ctx;
    lanes.surr.forEach(function (s) {
      var img = thumbs[s.k] || thumbs[0];
      sc.globalAlpha = Math.min(1, (end - s.x) / 30 + 0.2);
      sc.drawImage(img, s.x, 5, tw, th);
    });
    sc.globalAlpha = 1;
    var vc = laneSolver.ctx;
    var sx = (end + tw) * (lanes.solverT / SOLVER_S) - tw;
    if (!anim) sx = end * 0.4;
    vc.drawImage(thumbs[lanes.solver.k] || thumbs[0], sx, 5, tw, th);
    laneSolver.count.textContent = lanes.nSolver;
    laneSurr.count.textContent = lanes.nSurr;
  }

  // ---- loop ----------------------------------------------------------------
  var raf = 0, last = 0, visible = false;
  function frame(t) {
    raf = 0;
    var dt = last ? Math.min((t - last) / 1000, 0.1) : 1 / 60;
    last = t;
    if (cur) {
      if (!reduce) {
        cycleT += dt;
        if (cycleT >= CYCLE) {
          // Alternate: rebuild a real design, then make a new one.
          if (mode === "rec") {
            prevLatent = cur.designs[idx].latent.slice();
            startGen();
          } else {
            prevLatent = gen.latent.slice();
            startRec((idx + 1) % cur.designs.length);
          }
        }
      }
      if (mode === "rec") drawRec();
      else drawGenerate(t);
      drawLanes(dt);
    }
    if (visible && !reduce) raf = requestAnimationFrame(frame);
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
  new ResizeObserver(function () {
    if (cur) {
      tilesBox.style.gridTemplateColumns = columns();
      galTiles.style.gridTemplateColumns = columns();
    }
    if (!raf && cur) {
      if (mode === "rec") drawRec();
      else drawGenerate(performance.now());
      drawLanes(0);
    }
  }).observe(stage);
  new MutationObserver(function () {
    readColours();
    if (!raf && cur) drawLanes(0);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  readColours();
  fig.classList.add("ready");
  choose(0);
})();
