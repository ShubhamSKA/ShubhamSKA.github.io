// Sense of scale for the fiber. Everything is drawn to scale in millimetres:
// at first the fiber is a thread beside a credit card, and zooming in takes
// the view down past a coin and a human hair until the MSPM0C1104 in its
// WLCSP-8 package sits inside the fiber next to a grain of rice.
(function () {
  var fig = document.getElementById("demo-fiberscale");
  if (!fig) return;
  var stage = fig.querySelector(".demoStage");

  var ZOOM_IN_MS = 9000;
  var ZOOM_OUT_MS = 3500;

  // ---- scene, in mm --------------------------------------------------------
  var FIBER_D = 0.95; // "under 1 mm"
  var STRIP_W = 0.62; // flex circuit inside the sheath
  var CHIP = { x: 0, y: 0, w: 1.6, h: 0.861 }; // MSPM0C1104, YCJ package
  var RICE = { x: 4.7, y: -1.95, len: 7, wid: 2.1, rot: -4 };
  var HAIR = { d: 0.07, p0: [-6, -60], p1: [-3.5, 0], p2: [2, 60] };
  var PENNY = { x: 12, y: 22, r: 19.05 / 2 };
  var CARD = { x: -100, y: -78, w: 85.6, h: 53.98, r: 3.18 };

  // Start and end views: centre and width of the frame, in mm. A phone gets
  // a tighter frame at both ends so the objects are not lost in it.
  var VIEWS = {
    wide: { from: { x: -26, y: -4, w: 290 }, to: { x: 2.6, y: -0.9, w: 13 } },
    narrow: { from: { x: -30, y: -8, w: 180 }, to: { x: 2.6, y: -0.9, w: 12 } }
  };
  var FROM = VIEWS.wide.from, TO = VIEWS.wide.to;

  // ---- canvas --------------------------------------------------------------
  stage.classList.add("canvasStage");
  var canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "A fiber under 1 mm across drawn to scale beside a credit card. Zooming in shows a US penny, a human hair, and finally the 1.6 by 0.86 mm microcontroller inside the fiber next to a grain of rice."
  );
  stage.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1;

  var colours = {};
  function readColours() {
    var cs = getComputedStyle(fig);
    ["--d-bg", "--d-ink", "--d-muted", "--d-faint"].forEach(function (n) {
      colours[n] = cs.getPropertyValue(n).trim();
    });
    colours.light = document.documentElement.getAttribute("data-theme") === "light";
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    var v = W < 520 ? VIEWS.narrow : VIEWS.wide;
    FROM = v.from;
    TO = v.to;
    draw();
  }

  // ---- camera --------------------------------------------------------------
  var progress = 0; // 0 = start view, 1 = zoomed in
  var target = 0;

  function ease(t) {
    return t * t * (3 - 2 * t);
  }

  // Width moves geometrically, and the centre moves with it so that one point
  // stays put on screen. That reads as zooming into a spot, not panning.
  function camera() {
    var e = ease(progress);
    var w = Math.exp(Math.log(FROM.w) + (Math.log(TO.w) - Math.log(FROM.w)) * e);
    var k = (w - TO.w) / (FROM.w - TO.w);
    return { x: TO.x + (FROM.x - TO.x) * k, y: TO.y + (FROM.y - TO.y) * k, s: W / w };
  }

  var cam;
  function sx(x) {
    return (x - cam.x) * cam.s + W / 2;
  }
  function sy(y) {
    return (y - cam.y) * cam.s + H / 2;
  }

  // ---- drawing -------------------------------------------------------------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard() {
    var s = cam.s, x = sx(CARD.x), y = sy(CARD.y), w = CARD.w * s, h = CARD.h * s;
    if (x > W || x + w < 0 || y > H || y + h < 0) return;
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#1c3f7a");
    g.addColorStop(1, "#0f6c78");
    roundRect(x, y, w, h, CARD.r * s);
    ctx.fillStyle = g;
    ctx.fill();
    // EMV contact plate and an embossed number.
    roundRect(x + 9 * s, y + 19 * s, 11.5 * s, 9 * s, 1.5 * s);
    ctx.fillStyle = "#d8b45a";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (var gi = 0; gi < 4; gi++) {
      for (var di = 0; di < 4; di++) {
        roundRect(x + (9 + gi * 17 + di * 3.4) * s, y + 36 * s, 2.4 * s, 3.2 * s, 0.5 * s);
        ctx.fill();
      }
    }
  }

  function drawPenny() {
    var s = cam.s, x = sx(PENNY.x), y = sy(PENNY.y), r = PENNY.r * s;
    if (x - r > W || x + r < 0 || y - r > H || y + r < 0) return;
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, "#e39a62");
    g.addColorStop(1, "#8c4a22");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(0.5, r * 0.06);
    ctx.strokeStyle = "rgba(60,25,8,0.55)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawRice() {
    var s = cam.s;
    var a = (RICE.len / 2) * s, b = (RICE.wid / 2) * s;
    ctx.save();
    ctx.translate(sx(RICE.x), sy(RICE.y));
    ctx.rotate((RICE.rot * Math.PI) / 180);
    var g = ctx.createRadialGradient(-a * 0.2, -b * 0.4, b * 0.1, 0, 0, a);
    g.addColorStop(0, "#fffdf6");
    g.addColorStop(1, "#e6dcc3");
    // A grain is blunter than an ellipse: draw it as a superellipse.
    ctx.beginPath();
    for (var i = 0; i <= 48; i++) {
      var t = (i / 48) * Math.PI * 2;
      var c = Math.cos(t), sn = Math.sin(t);
      ctx.lineTo(a * Math.sign(c) * Math.pow(Math.abs(c), 0.8), b * Math.sign(sn) * Math.pow(Math.abs(sn), 0.85));
    }
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, 0.03 * s);
    ctx.strokeStyle = colours.light ? "rgba(120,100,60,0.55)" : "rgba(255,250,235,0.35)";
    ctx.stroke();
    ctx.restore();
  }

  function drawHair() {
    // Kept out of the wide views, where it would be a faint line on the edge
    // of visibility and read as a rendering fault.
    var w = HAIR.d * cam.s;
    if (w < 0.25) return;
    ctx.beginPath();
    ctx.moveTo(sx(HAIR.p0[0]), sy(HAIR.p0[1]));
    ctx.quadraticCurveTo(sx(HAIR.p1[0]), sy(HAIR.p1[1]), sx(HAIR.p2[0]), sy(HAIR.p2[1]));
    ctx.lineWidth = Math.max(w, 0.6);
    ctx.globalAlpha = Math.min(1, (w - 0.25) / 0.6);
    ctx.strokeStyle = colours.light ? "#4a3220" : "#c49a68";
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawFiber() {
    var s = cam.s;
    var top = sy(-FIBER_D / 2), bot = sy(FIBER_D / 2), th = bot - top;

    // Flex circuit inside, with two traces once they are resolvable.
    var st = sy(-STRIP_W / 2), sb = sy(STRIP_W / 2);
    ctx.fillStyle = "rgba(214,140,40,0.92)";
    ctx.fillRect(0, st, W, sb - st);
    if (s > 30) {
      ctx.fillStyle = "rgba(240,170,90,0.9)";
      [-0.17, 0.17].forEach(function (yy) {
        ctx.fillRect(0, sy(yy - 0.03), W, 0.06 * s);
      });
    }

    drawChip();

    // Translucent sheath over the top, shaded like a cylinder.
    var g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "rgba(170,195,215,0.55)");
    g.addColorStop(0.3, "rgba(235,245,252,0.28)");
    g.addColorStop(0.55, "rgba(200,220,235,0.16)");
    g.addColorStop(1, "rgba(120,145,165,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, th);
    if (th > 8) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(0, top + th * 0.18, W, Math.max(1, th * 0.06));
      ctx.strokeStyle = colours.light ? "rgba(70,90,110,0.6)" : "rgba(200,220,235,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(W, top);
      ctx.moveTo(0, bot);
      ctx.lineTo(W, bot);
      ctx.stroke();
    }
  }

  function drawChip() {
    var s = cam.s, w = CHIP.w * s, h = CHIP.h * s;
    if (w < 1) return;
    var x = sx(CHIP.x - CHIP.w / 2), y = sy(CHIP.y - CHIP.h / 2);
    roundRect(x, y, w, h, Math.min(2, 0.03 * s));
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#2b2f37");
    g.addColorStop(1, "#0d0f13");
    ctx.fillStyle = g;
    ctx.fill();
    if (w < 12) return;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Eight solder balls, 2 x 4.
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 2; r++) {
        var bx = sx(CHIP.x - 0.525 + c * 0.35), by = sy(CHIP.y - 0.2 + r * 0.4), br = 0.1 * s;
        var bg = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.4, br * 0.1, bx, by, br);
        bg.addColorStop(0, "#f2f4f6");
        bg.addColorStop(1, "#7d838b");
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---- labels and scale bar ------------------------------------------------
  function ramp(v, a, b) {
    return Math.max(0, Math.min(1, (v - a) / (b - a)));
  }

  // A label on a translucent pill, centred vertically on y. Text may hold a
  // line break. lead, if given, is the point a leader line runs to, drawn at
  // leadAlpha (default: the label's own).
  var LINE = 17;
  function label(text, x, y, align, alpha, lead, leadAlpha) {
    if (alpha <= 0.01) return;
    ctx.font = "13px Roboto, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    var lines = text.split("\n");
    var tw = Math.max.apply(null, lines.map(function (l) {
      return ctx.measureText(l).width;
    }));
    var th = lines.length * LINE;
    var left = align === "left" ? x : align === "right" ? x - tw : x - tw / 2;
    left = Math.max(8, Math.min(W - tw - 8, left));
    ctx.globalAlpha = alpha * (leadAlpha === undefined ? 1 : leadAlpha);
    if (lead && ctx.globalAlpha > 0.01) {
      ctx.strokeStyle = colours["--d-muted"];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lead[0], lead[1]);
      ctx.lineTo(Math.max(left, Math.min(left + tw, lead[0])), lead[1] < y ? y - th / 2 : y + th / 2);
      ctx.stroke();
    }
    ctx.fillStyle = colours["--d-bg"];
    ctx.globalAlpha = alpha * 0.8;
    roundRect(left - 6, y - th / 2 - 2, tw + 12, th + 4, 4);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colours["--d-ink"];
    lines.forEach(function (l, i) {
      ctx.fillText(l, left, y - th / 2 + LINE * (i + 0.5) + 0.5);
    });
    ctx.globalAlpha = 1;
  }

  function onScreen(x, y) {
    return x > -20 && x < W + 20 && y > -20 && y < H + 20;
  }

  function drawLabels() {
    var s = cam.s;

    var cx = sx(CARD.x), cy = sy(CARD.y + CARD.h);
    if (onScreen(cx + 20, cy)) label("Credit card, 85.6 mm", cx, cy + 16, "left", 1);

    var px = sx(PENNY.x), py = sy(PENNY.y + PENNY.r);
    if (onScreen(px, py)) label("US penny, 19 mm", px, py + 16, "center", 1);

    // The fiber label lives in the bottom left corner, where nothing else
    // goes at either end of the zoom. Its leader up to the fiber gives way to
    // the chip's label, by which point the fiber fills the frame anyway.
    var chipA = ramp(CHIP.w * s, 26, 50);
    var fx = 16 + 40, fy = H - 22;
    label("Fiber, under 1 mm across", 16, fy, "left", 1, [fx, sy(FIBER_D / 2)], 1 - chipA);

    var rx = sx(RICE.x + RICE.len / 2), ry = sy(RICE.y - RICE.wid / 2);
    label("Grain of rice, about 7 mm", rx, ry - 14, "right", ramp(RICE.len * s, 60, 110));

    var hairA = ramp(HAIR.d * s, 1.2, 2.4);
    if (hairA > 0) {
      var hy = 24;
      // Where the hair crosses that height: the curve is near enough to a
      // straight line over one screen to solve for t linearly.
      var y0 = sy(HAIR.p0[1]), y2 = sy(HAIR.p2[1]);
      var t = (hy - y0) / (y2 - y0);
      var hx = (1 - t) * (1 - t) * sx(HAIR.p0[0]) + 2 * t * (1 - t) * sx(HAIR.p1[0]) + t * t * sx(HAIR.p2[0]);
      label("Human hair, about 0.07 mm", hx + 12, hy, "left", hairA);
    }

    var chx = sx(CHIP.x), chy = sy(FIBER_D / 2);
    var chipText = W < 520 ? "MSPM0C1104, WLCSP-8\n1.6 × 0.86 mm" : "MSPM0C1104, WLCSP-8, 1.6 × 0.86 mm";
    var chipH = (chipText.split("\n").length * LINE) / 2;
    label(chipText, chx, chy + 18 + chipH, "center", chipA, [chx, sy(CHIP.h / 2)]);
  }

  function drawScaleBar() {
    var s = cam.s;
    var most = Math.min(150, W * 0.28); // longest the bar may be, in px
    var p = Math.pow(10, Math.floor(Math.log10((most * 0.7) / s)));
    var len = [1, 2, 5, 10].map(function (m) {
      return m * p;
    }).filter(function (v) {
      return v * s <= most;
    }).pop();
    var px = len * s;
    var text = len >= 10 ? len / 10 + " cm" : len >= 1 ? len + " mm" : Math.round(len * 1000) + " µm";
    ctx.font = "13px Roboto, sans-serif";
    // Bottom right, clear of the hair, which crosses on the left.
    var x1 = W - 16 - ctx.measureText(text).width - 8 - px, y = H - 18;
    ctx.strokeStyle = colours["--d-ink"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y - 5);
    ctx.lineTo(x1, y);
    ctx.lineTo(x1 + px, y);
    ctx.lineTo(x1 + px, y - 5);
    ctx.stroke();
    ctx.fillStyle = colours["--d-ink"];
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x1 + px + 8, y + 1);
  }

  function draw() {
    if (!W) return;
    cam = camera();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colours["--d-bg"];
    ctx.fillRect(0, 0, W, H);
    drawCard();
    drawPenny();
    drawRice();
    drawFiber();
    drawHair();
    drawLabels();
    drawScaleBar();
  }

  // ---- controls and loop ---------------------------------------------------
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var controls = document.createElement("div");
  controls.className = "demoControls";
  var btn = document.createElement("button");
  btn.type = "button";
  controls.appendChild(btn);
  fig.querySelector("figcaption").appendChild(controls);

  function paintButton() {
    btn.textContent = target ? "Zoom out" : "Zoom in";
  }

  var raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(now - last, 100) : 16;
    last = now;
    var dur = target ? ZOOM_IN_MS : ZOOM_OUT_MS;
    progress += (target ? 1 : -1) * (dt / dur);
    progress = Math.max(0, Math.min(1, progress));
    draw();
    if (progress !== target) raf = requestAnimationFrame(frame);
  }

  btn.addEventListener("click", function () {
    target = target ? 0 : 1;
    paintButton();
    if (reduce) {
      progress = target;
      draw();
      return;
    }
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  });

  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(function () {
    readColours();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  readColours();
  paintButton();
  fig.classList.add("ready");
  resize();
  // Labels are drawn in Roboto, which may still be loading on first paint.
  if (document.fonts) document.fonts.ready.then(draw);
})();
