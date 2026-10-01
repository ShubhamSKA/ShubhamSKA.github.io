// Seven segment display built from electro-permanent magnet taxels, one EPM
// frame per segment: two AlNiCo bars along the long sides, ferrite cores
// capping the ends, and the composite elastomer over the aperture.
//
// With the AlNiCos antiparallel the flux circulates inside the frame and the
// elastomer stays flat. A pulse through the coil on one AlNiCo flips it, the
// pair goes parallel, flux is pushed across the aperture and the elastomer
// rises. Either state then holds with no current, which is the point.
(function () {
  var fig = document.getElementById("demo-sevenseg");
  if (!fig) return;
  var stage = fig.querySelector(".demoStage");
  var NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // One segment, drawn with its long axis horizontal and centred on 0,0.
  var GAP = 150; // aperture length
  var GAPH = 30; // aperture height
  var MAG = 13; // AlNiCo thickness
  var CORE = 16; // ferrite core width
  var HX = GAP / 2 + CORE; // half extents of the frame
  var HY = GAPH / 2 + MAG;
  var PITCH = HX + HY + 5; // centre to centre, horizontal to vertical

  var SEGS = [
    { id: "a", name: "top", x: 0, y: -2 * PITCH, r: 0 },
    { id: "b", name: "upper right", x: PITCH, y: -PITCH, r: 90 },
    { id: "c", name: "lower right", x: PITCH, y: PITCH, r: 90 },
    { id: "d", name: "bottom", x: 0, y: 2 * PITCH, r: 0 },
    { id: "e", name: "lower left", x: -PITCH, y: PITCH, r: 90 },
    { id: "f", name: "upper left", x: -PITCH, y: -PITCH, r: 90 },
    { id: "g", name: "middle", x: 0, y: 0, r: 0 }
  ];

  var DIGITS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];

  // Closed path through the given corners in order, each corner rounded.
  // The order sets the direction the dashes flow, so it is the field direction.
  function loop(pts, r) {
    var d = "";
    function toward(p, q) {
      var dx = q[0] - p[0];
      var dy = q[1] - p[1];
      var l = Math.sqrt(dx * dx + dy * dy);
      return p[0] + (dx / l) * r + "," + (p[1] + (dy / l) * r);
    }
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var prev = pts[(i + pts.length - 1) % pts.length];
      var next = pts[(i + 1) % pts.length];
      d += (i ? " L" : "M") + toward(p, prev) + " Q" + p[0] + "," + p[1] + " " + toward(p, next);
    }
    return d + " Z";
  }

  function arrow(parent, y, cls) {
    var g = el("g", { class: cls }, parent);
    el("line", { x1: 30, y1: y, x2: -24, y2: y }, g);
    el("polygon", { points: [-34, y, -23, y - 5, -23, y + 5].join(" "), "stroke-linejoin": "round" }, g);
    return g;
  }

  function buildSegment(svg, s) {
    var g = el("g", {
      class: "seg",
      transform: "translate(" + s.x + " " + s.y + ") rotate(" + s.r + ")",
      tabindex: "0",
      role: "button",
      "aria-pressed": "false",
      "aria-label": "Segment " + s.id.toUpperCase() + ", " + s.name
    }, svg);

    el("rect", { class: "hit", x: -HX - 5, y: -HY - 5, width: 2 * HX + 10, height: 2 * HY + 10, rx: 7 }, g);

    // Frame: cores at the ends, magnets along the sides.
    el("rect", { class: "core", x: -HX, y: -HY, width: CORE, height: 2 * HY, rx: 2 }, g);
    el("rect", { class: "core", x: HX - CORE, y: -HY, width: CORE, height: 2 * HY, rx: 2 }, g);
    el("rect", { class: "alnico", x: -GAP / 2, y: -HY, width: GAP, height: MAG }, g);
    el("rect", { class: "alnico", x: -GAP / 2, y: GAPH / 2, width: GAP, height: MAG }, g);

    // The switching coil, wound on the lower AlNiCo.
    var coil = el("g", { class: "coil" }, g);
    for (var x = -66; x <= 66; x += 6) {
      el("line", { x1: x - 2, y1: GAPH / 2 - 1.5, x2: x + 2, y2: HY + 1.5 }, coil);
    }

    // Composite elastomer over the aperture, with its two NdFeB patches
    // magnetised out of plane in opposite directions.
    el("rect", { class: "membrane", x: -GAP / 2, y: -GAPH / 2, width: GAP, height: GAPH, rx: 3 }, g);
    el("rect", { class: "raised", x: -GAP / 2 + 3, y: -GAPH / 2 + 3, width: GAP - 6, height: GAPH - 6, rx: 12 }, g);
    el("ellipse", { class: "shine", cx: -14, cy: -5, rx: 44, ry: 3.2 }, g);
    [-1, 1].forEach(function (side) {
      var cx = (side * GAP) / 4;
      el("rect", { class: "patch", x: cx - 10, y: -8, width: 20, height: 16, rx: 2 }, g);
      var mark = el("g", { class: "patchMark" }, g);
      el("circle", { cx: cx, cy: 0, r: 4.6 }, mark);
      if (side < 0) {
        el("circle", { class: "dot", cx: cx, cy: 0, r: 1.5 }, mark);
      } else {
        el("path", { d: "M" + (cx - 3.2) + ",-3.2 L" + (cx + 3.2) + ",3.2 M" + (cx - 3.2) + ",3.2 L" + (cx + 3.2) + ",-3.2" }, mark);
      }
    });

    // Field lines. Off: two loops circulating round the frame. On: four loops,
    // each out of a magnet, through a core, across the aperture and back.
    var off = el("g", { class: "field fieldOff" }, g);
    [[86.5, 24.5], [79.5, 18.5]].forEach(function (p) {
      var X = p[0], Y = p[1];
      el("path", { d: loop([[X, -Y], [-X, -Y], [-X, Y], [X, Y]], 4) }, off);
    });
    var on = el("g", { class: "field fieldOn" }, g);
    [[86.5, 24.5, 9], [79.5, 18.5, 3.5]].forEach(function (p) {
      var X = p[0], Y1 = p[1], Y2 = p[2];
      el("path", { d: loop([[X, -Y1], [-X, -Y1], [-X, -Y2], [X, -Y2]], 4) }, on);
      el("path", { d: loop([[X, Y1], [-X, Y1], [-X, Y2], [X, Y2]], 4) }, on);
    });

    // Magnetisation. The upper AlNiCo never changes; the coiled one flips.
    arrow(g, -HY + MAG / 2, "mArrow");
    arrow(g, HY - MAG / 2, "mArrow flip");

    s.node = g;
    s.on = false;
    g.addEventListener("click", function () {
      toggle(s);
    });
    g.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(s);
      }
    });
  }

  var statusEl;

  function toggle(s, want) {
    if (want === undefined) want = !s.on;
    if (want === s.on) return;
    s.on = want;
    s.node.classList.toggle("on", want);
    s.node.setAttribute("aria-pressed", want ? "true" : "false");
    s.node.classList.add("pulse");
    clearTimeout(s.pulseTimer);
    s.pulseTimer = setTimeout(function () {
      s.node.classList.remove("pulse");
    }, 140);
    updateStatus();
  }

  function pattern() {
    return SEGS.filter(function (s) {
      return s.on;
    })
      .map(function (s) {
        return s.id;
      })
      .sort()
      .join("");
  }

  function updateStatus() {
    var p = pattern();
    var n = p.length;
    var digit = DIGITS.indexOf(p);
    var first =
      n === 0
        ? "All seven segments flat."
        : n + " of 7 raised" + (digit >= 0 ? ", reading " + digit : "") + ".";
    statusEl.textContent = first;
  }

  // Write a whole digit one segment at a time, the way the display is rastered.
  var writeTimers = [];
  function writeDigit(n) {
    writeTimers.forEach(clearTimeout);
    writeTimers = [];
    var want = n === null ? "" : DIGITS[n];
    var delay = 0;
    SEGS.forEach(function (s) {
      var on = want.indexOf(s.id) >= 0;
      if (on !== s.on) {
        writeTimers.push(setTimeout(toggle, delay, s, on));
        delay += 120;
      }
    });
  }

  // ---- build ---------------------------------------------------------------
  stage.classList.add("splitStage");
  var pad = 14;
  var w = 2 * (PITCH + HY + pad);
  var h = 2 * (2 * PITCH + HY + pad);
  var svg = el("svg", {
    viewBox: [-w / 2, -h / 2, w, h].join(" "),
    role: "group",
    "aria-label": "Seven segment haptic display. Each segment is a button that switches its magnet."
  }, stage);
  SEGS.forEach(function (s) {
    buildSegment(svg, s);
  });

  var side = document.createElement("div");
  var key = document.createElement("ul");
  key.className = "demoKey";
  var swatches = [
    ['<rect x="1" y="3" width="24" height="9" fill="var(--d-alnico)"/>', "AlNiCo magnet"],
    ['<rect x="1" y="3" width="24" height="9" fill="var(--d-alnico)"/><path d="M5 2l2 11M10 2l2 11M15 2l2 11M20 2l2 11" stroke="var(--d-coil)" stroke-width="1.5"/>', "Switching coil"],
    ['<rect x="7" y="0" width="12" height="15" fill="var(--d-core)"/>', "Ferrite core"],
    ['<path d="M22 7.5H7" stroke="var(--d-m)" stroke-width="2.4"/><path d="M2 7.5l7-4v8z" fill="var(--d-m)"/>', "Magnetisation"],
    ['<path d="M1 7.5h24" stroke="var(--d-field)" stroke-width="1.6" stroke-dasharray="5 4"/>', "Magnetic field"],
    ['<rect x="1" y="2" width="24" height="11" rx="5.5" fill="var(--d-ink)" opacity="0.72"/>', "Raised elastomer"]
  ];
  swatches.forEach(function (sw) {
    var li = document.createElement("li");
    li.innerHTML = '<svg viewBox="0 0 26 15" aria-hidden="true">' + sw[0] + "</svg>";
    li.appendChild(document.createTextNode(sw[1]));
    key.appendChild(li);
  });
  statusEl = document.createElement("li");
  statusEl.className = "demoStatus";
  statusEl.setAttribute("aria-live", "polite");
  key.appendChild(statusEl);
  side.appendChild(key);
  stage.appendChild(side);

  var controls = document.createElement("div");
  controls.className = "demoControls";
  var clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Clear";
  clear.addEventListener("click", function () {
    writeDigit(null);
  });
  controls.appendChild(clear);
  fig.querySelector("figcaption").appendChild(controls);

  // Typing a digit writes it, as long as the display is on screen.
  var inView = false;
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
  }).observe(fig);
  document.addEventListener("keydown", function (e) {
    if (!inView || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key >= "0" && e.key <= "9" && e.key.length === 1) writeDigit(+e.key);
  });

  updateStatus();
  fig.classList.add("ready");
})();
