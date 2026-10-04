// 3D reconstruction in fog, in miniature. A small street scene is ray traced in
// the browser, once clear and once through fog, so the true depth of every
// pixel is known. Each picture is then "reconstructed": depth is estimated
// with errors that grow where the fog has eaten the contrast, and the pixels
// are lifted into a point cloud. The animation starts on the flat picture,
// swings round to show it is flat, inflates it to depth, and orbits.
//
// The scene and the error model are made up for illustration; nothing here is
// challenge data or a real model's output.
(function () {
  var fig = document.getElementById("demo-fog3d");
  if (!fig) return;
  var stage = fig.querySelector(".demoStage");

  var W = 200, H = 125; // picture resolution, one point per pixel
  var HFOV = (72 * Math.PI) / 180;
  var TANX = Math.tan(HFOV / 2), TANY = (TANX * H) / W;
  var CAM = [0, 1.7, 0];
  var TILT = (4 * Math.PI) / 180;
  var FWD = [0, -Math.sin(TILT), Math.cos(TILT)];
  var UP = [0, Math.cos(TILT), Math.sin(TILT)];
  var RIGHT = [1, 0, 0];
  var SUN = norm([0.5, 0.75, -0.45]);
  var FOG_BETA = 0.03; // per metre
  var FOG = [198, 205, 212];
  var FAR = 140; // beyond this is backdrop, not reconstructed
  var CARD = 14; // the flat picture sits this far out
  var PIVOT = [0, 2, 30];
  var LOOP = 13;

  function norm(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function hash(x, y) {
    var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  // ---- scene ---------------------------------------------------------------
  var BRICK = [156, 90, 68], BEIGE = [200, 180, 143], GREY = [142, 152, 163], SLATE = [111, 127, 149], CREAM = [217, 207, 184];
  var boxes = [];
  [[6, 18, 10, BRICK], [20, 31, 16, BEIGE], [33, 47, 8, GREY], [49, 64, 22, SLATE], [66, 85, 12, CREAM], [87, 110, 18, BRICK]].forEach(function (b) {
    boxes.push({ min: [-20, 0, b[0]], max: [-7, b[2], b[1]], col: b[3], win: true });
  });
  [[4, 16, 13, GREY], [18, 30, 9, CREAM], [32, 46, 19, BRICK], [48, 60, 11, BEIGE], [62, 80, 24, SLATE], [82, 105, 14, GREY]].forEach(function (b) {
    boxes.push({ min: [7, 0, b[0]], max: [20, b[2], b[1]], col: b[3], win: true });
  });
  var spheres = [];
  for (var tz = 9; tz <= 72; tz += 9) {
    [-5.2, 5.2].forEach(function (tx, side) {
      if ((tz / 9 + side) % 3 === 2) return; // a gap here and there
      boxes.push({ min: [tx - 0.16, 0, tz - 0.16], max: [tx + 0.16, 2.4, tz + 0.16], col: [92, 66, 46] });
      spheres.push({ c: [tx, 3.5, tz], r: 1.55, col: [64, 108, 48], leaf: true });
    });
  }
  // Hills far off, past the end of the street.
  spheres.push({ c: [-90, -95, 420], r: 120, col: [112, 140, 156], far: true });
  spheres.push({ c: [70, -105, 470], r: 125, col: [104, 130, 150], far: true });
  spheres.push({ c: [210, -90, 430], r: 115, col: [118, 145, 160], far: true });

  function hitBox(o, d, b, best) {
    var t0 = -Infinity, t1 = Infinity, axis = -1, sign = 0;
    for (var a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (o[a] < b.min[a] || o[a] > b.max[a]) return null;
        continue;
      }
      var ta = (b.min[a] - o[a]) / d[a], tb = (b.max[a] - o[a]) / d[a];
      var s = -1;
      if (ta > tb) {
        var tmp = ta;
        ta = tb;
        tb = tmp;
        s = 1;
      }
      if (ta > t0) {
        t0 = ta;
        axis = a;
        sign = s;
      }
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
    if (t0 < 1e-4 || t0 >= best) return null;
    var n = [0, 0, 0];
    n[axis] = sign;
    return { t: t0, n: n };
  }
  function hitSphere(o, d, s, best) {
    var oc = [o[0] - s.c[0], o[1] - s.c[1], o[2] - s.c[2]];
    var b = oc[0] * d[0] + oc[1] * d[1] + oc[2] * d[2];
    var c = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - s.r * s.r;
    var disc = b * b - c;
    if (disc < 0) return null;
    var t = -b - Math.sqrt(disc);
    if (t < 1e-4 || t >= best) return null;
    return { t: t };
  }

  function trace(o, d, shadowOnly) {
    var best = Infinity, hit = null;
    if (d[1] < -1e-6) {
      var tg = -o[1] / d[1];
      if (tg > 1e-4) {
        best = tg;
        hit = { kind: "ground", t: tg, n: [0, 1, 0] };
      }
    }
    for (var i = 0; i < boxes.length; i++) {
      var h = hitBox(o, d, boxes[i], best);
      if (h) {
        if (shadowOnly) return true;
        best = h.t;
        hit = { kind: "box", t: h.t, n: h.n, obj: boxes[i] };
      }
    }
    for (var j = 0; j < spheres.length; j++) {
      if (shadowOnly && spheres[j].far) continue;
      var hs = hitSphere(o, d, spheres[j], best);
      if (hs) {
        if (shadowOnly) return true;
        best = hs.t;
        var p = [o[0] + d[0] * hs.t, o[1] + d[1] * hs.t, o[2] + d[2] * hs.t];
        hit = { kind: "sphere", t: hs.t, n: norm([p[0] - spheres[j].c[0], p[1] - spheres[j].c[1], p[2] - spheres[j].c[2]]), obj: spheres[j] };
      }
    }
    if (shadowOnly) return false;
    return hit;
  }

  function sky(d) {
    var u = Math.max(0, d[1]);
    var top = [92, 150, 214], hor = [212, 228, 240];
    var k = Math.pow(u, 0.6);
    var col = [hor[0] + (top[0] - hor[0]) * k, hor[1] + (top[1] - hor[1]) * k, hor[2] + (top[2] - hor[2]) * k];
    var sd = d[0] * SUN[0] + d[1] * SUN[1] + d[2] * SUN[2];
    if (sd > 0.995) col = [255, 250, 235];
    return col;
  }

  function shade(o, d, hit) {
    var p = [o[0] + d[0] * hit.t, o[1] + d[1] * hit.t, o[2] + d[2] * hit.t];
    var alb, n = hit.n;
    if (hit.kind === "ground") {
      var ax = Math.abs(p[0]);
      if (ax < 3.4) {
        var g = 58 + 10 * vnoise(p[0] * 3, p[2] * 3);
        alb = [g, g + 2, g + 6];
        if (ax < 0.1 && ((p[2] % 7) + 7) % 7 < 3.5) alb = [232, 226, 200];
        if (ax > 3.12 && ax < 3.28) alb = [222, 222, 216];
      } else if (ax < 5.8) {
        var sw = 150 + 14 * vnoise(p[0] * 2, p[2] * 2) - (((p[2] % 1.5) + 1.5) % 1.5 < 0.06 ? 30 : 0);
        alb = [sw, sw - 4, sw - 12];
      } else {
        var gr = vnoise(p[0] * 0.8, p[2] * 0.8);
        alb = [76 + 30 * gr, 116 + 30 * gr, 56 + 14 * gr];
      }
    } else if (hit.kind === "box") {
      alb = hit.obj.col;
      if (hit.obj.win && n[1] === 0) {
        var u = n[0] !== 0 ? p[2] : p[0];
        var fu = ((u / 2.4) % 1 + 1) % 1, fv = ((p[1] / 3.2) % 1 + 1) % 1;
        if (fu > 0.22 && fu < 0.74 && fv > 0.28 && fv < 0.8) alb = [58, 72, 92];
      }
    } else {
      alb = hit.obj.col;
      if (hit.obj.leaf) {
        var lv = vnoise(p[0] * 4 + p[1] * 3, p[2] * 4);
        alb = [alb[0] * (0.8 + 0.4 * lv), alb[1] * (0.8 + 0.4 * lv), alb[2] * (0.8 + 0.4 * lv)];
      }
      if (hit.obj.far) return alb;
    }
    var ndl = Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]);
    var lit = 0;
    if (ndl > 0) {
      var so = [p[0] + n[0] * 0.01, p[1] + n[1] * 0.01, p[2] + n[2] * 0.01];
      lit = trace(so, SUN, true) ? 0 : ndl;
    }
    var k = 0.42 + 0.78 * lit;
    return [Math.min(255, alb[0] * k + 8), Math.min(255, alb[1] * k + 10), Math.min(255, alb[2] * k + 16)];
  }

  function rayDir(px, py) {
    var u = (2 * px) / W - 1, v = 1 - (2 * py) / H;
    return norm([FWD[0] + u * TANX * RIGHT[0] + v * TANY * UP[0], FWD[1] + u * TANX * RIGHT[1] + v * TANY * UP[1], FWD[2] + u * TANX * RIGHT[2] + v * TANY * UP[2]]);
  }

  // ---- reconstruction ------------------------------------------------------
  var clouds = null; // [clear, foggy]

  function seeded(seed) {
    return function () {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
  }

  function boxBlur(src, r) {
    var out = new Float32Array(src.length);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var sum = 0, n = 0;
        for (var dy = -r; dy <= r; dy++) {
          for (var dx = -r; dx <= r; dx++) {
            var xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            var v = src[yy * W + xx];
            if (!isFinite(v)) continue;
            sum += v;
            n++;
          }
        }
        out[y * W + x] = n ? sum / n : Infinity;
      }
    }
    return out;
  }

  function build() {
    var N = W * H;
    var depth = new Float32Array(N), clear = new Float32Array(N * 3), dirs = new Float32Array(N * 3);
    for (var py = 0; py < H; py++) {
      for (var px = 0; px < W; px++) {
        var i = py * W + px;
        var d = rayDir(px + 0.5, py + 0.5);
        dirs[i * 3] = d[0];
        dirs[i * 3 + 1] = d[1];
        dirs[i * 3 + 2] = d[2];
        var h = trace(CAM, d, false);
        depth[i] = h ? h.t : Infinity;
        // 2x2 supersampled colour.
        var acc = [0, 0, 0];
        for (var s = 0; s < 4; s++) {
          var ds = rayDir(px + 0.25 + 0.5 * (s & 1), py + 0.25 + 0.5 * (s >> 1));
          var hs = trace(CAM, ds, false);
          var c = hs ? shade(CAM, ds, hs) : sky(ds);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
        clear[i * 3] = acc[0] / 4;
        clear[i * 3 + 1] = acc[1] / 4;
        clear[i * 3 + 2] = acc[2] / 4;
      }
    }
    // The same picture through fog: I = J t + A (1 - t), t = exp(-beta d).
    var foggy = new Float32Array(N * 3), trans = new Float32Array(N);
    for (var k = 0; k < N; k++) {
      var t = isFinite(depth[k]) ? Math.exp(-FOG_BETA * depth[k]) : 0;
      trans[k] = t;
      for (var ch = 0; ch < 3; ch++) foggy[k * 3 + ch] = clear[k * 3 + ch] * t + FOG[ch] * (1 - t);
    }
    clouds = [reconstruct(depth, clear, dirs, trans, false), reconstruct(depth, foggy, dirs, trans, true)];
  }

  // Estimated depth: right on average, with noise, smeared edges, and, in fog,
  // errors and a pull towards the camera that both grow as contrast drops.
  function reconstruct(depth, col, dirs, trans, fogged) {
    var rnd = seeded(fogged ? 91 : 17);
    var N = W * H;
    var est = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var d = depth[i];
      if (!isFinite(d) || d > FAR) {
        est[i] = Infinity;
        continue;
      }
      var x = i % W, y = (i / W) | 0;
      var lowf = vnoise(x * 0.08 + (fogged ? 40 : 0), y * 0.08) - 0.5;
      var white = rnd() - 0.5;
      var loss = fogged ? 1 - trans[i] : 0;
      var sigma = fogged ? 0.016 + 0.045 * loss : 0.012;
      est[i] = d * (1 - (fogged ? 0.1 * loss : 0)) * (1 + sigma * (1.6 * lowf + 0.8 * white));
    }
    var blur = boxBlur(est, fogged ? 2 : 1);
    var mix = fogged ? 0.55 : 0.25;
    var pts = [];
    for (var j = 0; j < N; j++) {
      var e = est[j], drop = 0;
      if (isFinite(e)) {
        if (isFinite(blur[j])) e = e * (1 - mix) + blur[j] * mix;
        if (fogged && trans[j] < 0.05) drop = 1; // lost in the fog altogether
      } else if (fogged && rnd() < 0.025) {
        e = 55 + 25 * rnd(); // fog read as a surface: stray points in the sky
      } else drop = 1; // sky and backdrop: no depth to give
      pts.push(j, e, drop);
    }
    var n = pts.length / 3;
    var cloud = {
      n: n,
      est: new Float32Array(n * 3),
      flat: new Float32Array(n * 3),
      tEst: new Float32Array(n),
      tFlat: new Float32Array(n),
      rgb: new Uint32Array(n),
      // For points with no depth: how far into the inflation they vanish.
      gone: new Float32Array(n)
    };
    for (var k = 0; k < n; k++) {
      var p = pts[k * 3], t = pts[k * 3 + 1];
      var dx = dirs[p * 3], dy = dirs[p * 3 + 1], dz = dirs[p * 3 + 2];
      var tf = CARD / (dx * FWD[0] + dy * FWD[1] + dz * FWD[2]);
      if (pts[k * 3 + 2]) {
        t = tf;
        cloud.gone[k] = 0.01 + 0.3 * rnd();
      } else cloud.gone[k] = 2;
      cloud.est[k * 3] = CAM[0] + dx * t;
      cloud.est[k * 3 + 1] = CAM[1] + dy * t;
      cloud.est[k * 3 + 2] = CAM[2] + dz * t;
      cloud.flat[k * 3] = CAM[0] + dx * tf;
      cloud.flat[k * 3 + 1] = CAM[1] + dy * tf;
      cloud.flat[k * 3 + 2] = CAM[2] + dz * tf;
      cloud.tEst[k] = t;
      cloud.tFlat[k] = tf;
      var r = col[p * 3] | 0, g = col[p * 3 + 1] | 0, b = col[p * 3 + 2] | 0;
      cloud.rgb[k] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
    return cloud;
  }

  // ---- views ---------------------------------------------------------------
  stage.classList.add("fogStage");
  var panels = [["Clear", "clear"], ["Foggy", "foggy"]].map(function (p) {
    var wrap = document.createElement("div");
    wrap.className = "fogPanel";
    var c = document.createElement("canvas");
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", p[0] + " street scene, reconstructed as a 3D point cloud");
    var lab = document.createElement("span");
    lab.className = "fogLabel";
    lab.textContent = p[0];
    wrap.appendChild(c);
    wrap.appendChild(lab);
    stage.appendChild(wrap);
    return { canvas: c, ctx: c.getContext("2d"), img: null, zbuf: null, px: null };
  });
  var status = document.createElement("p");
  status.className = "fogStatus";
  status.setAttribute("aria-live", "polite");
  stage.appendChild(status);

  var controls = document.createElement("div");
  controls.className = "demoControls";
  var replayBtn = document.createElement("button");
  replayBtn.type = "button";
  replayBtn.textContent = "Replay";
  controls.appendChild(replayBtn);
  fig.querySelector("figcaption").appendChild(controls);

  var bgPacked = 0;
  function readColours() {
    var bg = getComputedStyle(fig).getPropertyValue("--d-bg").trim().replace("#", "");
    if (bg.length === 3) bg = bg.replace(/./g, "$&$&");
    var v = parseInt(bg, 16);
    bgPacked = (255 << 24) | ((v & 255) << 16) | (((v >> 8) & 255) << 8) | ((v >> 16) & 255);
  }

  function sizePanels() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    panels.forEach(function (p) {
      var w = Math.max(1, Math.round(p.canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round((w * H) / W));
      if (p.canvas.width !== w || p.canvas.height !== h) {
        p.canvas.width = w;
        p.canvas.height = h;
        p.img = p.ctx.createImageData(w, h);
        p.px = new Uint32Array(p.img.data.buffer);
        p.zbuf = new Float32Array(w * h);
      }
    });
  }

  // Pose: rotate the world about PIVOT, then view it from the original
  // camera pulled back by `dolly`. At rest it shows exactly the picture.
  var view = { yaw: 0, pitch: 0, dolly: 0, s: 0 };

  function draw(p, cloud) {
    if (!p.px) return;
    var cw = p.canvas.width, ch = p.canvas.height;
    p.px.fill(bgPacked);
    p.zbuf.fill(Infinity);
    var cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    // Pulled back, and raised in step, so the cloud sits in the middle of the frame.
    var lift = 6 * (view.dolly / SIDE.dolly);
    var cx0 = CAM[0] - FWD[0] * view.dolly + UP[0] * lift;
    var cy0 = CAM[1] - FWD[1] * view.dolly + UP[1] * lift;
    var cz0 = CAM[2] - FWD[2] * view.dolly + UP[2] * lift;
    var fx = cw / 2 / TANX, fy = ch / 2 / TANY;
    var pixAng = (2 * TANX) / W;
    var s = view.s, n = cloud.n, est = cloud.est, flat = cloud.flat;
    for (var i = 0; i < n; i++) {
      if (s > cloud.gone[i]) continue;
      var k = i * 3;
      var x = flat[k] + (est[k] - flat[k]) * s - PIVOT[0];
      var y = flat[k + 1] + (est[k + 1] - flat[k + 1]) * s - PIVOT[1];
      var z = flat[k + 2] + (est[k + 2] - flat[k + 2]) * s - PIVOT[2];
      // yaw about the vertical, then pitch about the horizontal (negative
    // pitch lifts the far end, as if looking down from above)
      var x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
      var y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;
      var rx = x1 + PIVOT[0] - cx0, ry = y2 + PIVOT[1] - cy0, rz = z2 + PIVOT[2] - cz0;
      var zc = rx * FWD[0] + ry * FWD[1] + rz * FWD[2];
      if (zc < 0.5) continue;
      var xc = rx * RIGHT[0] + ry * RIGHT[1] + rz * RIGHT[2];
      var yc = rx * UP[0] + ry * UP[1] + rz * UP[2];
      var sx = cw / 2 + (xc / zc) * fx, syy = ch / 2 - (yc / zc) * fy;
      var t = cloud.tFlat[i] + (cloud.tEst[i] - cloud.tFlat[i]) * s;
      var size = Math.min(7, Math.max(1, Math.round((fx * t * pixAng) / zc + 0.35)));
      var x0 = Math.round(sx - size / 2), y0 = Math.round(syy - size / 2);
      if (x0 >= cw || y0 >= ch || x0 + size <= 0 || y0 + size <= 0) continue;
      var col = cloud.rgb[i];
      for (var yy = Math.max(0, y0); yy < Math.min(ch, y0 + size); yy++) {
        var row = yy * cw;
        for (var xx = Math.max(0, x0); xx < Math.min(cw, x0 + size); xx++) {
          if (zc < p.zbuf[row + xx]) {
            p.zbuf[row + xx] = zc;
            p.px[row + xx] = col;
          }
        }
      }
    }
    p.ctx.putImageData(p.img, 0, 0);
  }

  function drawAll() {
    if (!clouds) return;
    sizePanels();
    draw(panels[0], clouds[0]);
    draw(panels[1], clouds[1]);
  }

  // ---- timeline ------------------------------------------------------------
  function ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  var SIDE = { yaw: 0.8, pitch: -0.22, dolly: 34 };
  var phases = [
    [0, "The input: one picture of the street, clear and in fog."],
    [1.4, "Swung round, each is still just a flat picture."],
    [3.0, "Estimating depth for every pixel..."],
    [5.0, "Point clouds. The foggy one is noisier, softer at the edges and loses the far end. Drag to look around."],
    [10.5, ""]
  ];
  function timeline(t) {
    if (t < 1.4) return { yaw: 0, pitch: 0, dolly: 0, s: 0 };
    if (t < 3.0) {
      var a = ease((t - 1.4) / 1.6);
      return { yaw: SIDE.yaw * a, pitch: SIDE.pitch * a, dolly: SIDE.dolly * a, s: 0 };
    }
    if (t < 5.0) return { yaw: SIDE.yaw, pitch: SIDE.pitch, dolly: SIDE.dolly, s: ease((t - 3) / 2) };
    if (t < 10.5) {
      var b = ease((t - 5) / 5.5);
      return { yaw: lerp(SIDE.yaw, -SIDE.yaw, b), pitch: SIDE.pitch, dolly: SIDE.dolly, s: 1 };
    }
    if (t < 12.2) {
      var c = ease((t - 10.5) / 1.7);
      return { yaw: lerp(-SIDE.yaw, 0, c), pitch: lerp(SIDE.pitch, 0, c), dolly: lerp(SIDE.dolly, 0, c), s: 1 - c };
    }
    return { yaw: 0, pitch: 0, dolly: 0, s: 0 };
  }
  var lastPhase = -1;
  function setStatus(t) {
    var idx = 0;
    for (var i = 0; i < phases.length; i++) if (t >= phases[i][0]) idx = i;
    if (idx === lastPhase) return;
    lastPhase = idx;
    if (phases[idx][1]) status.textContent = phases[idx][1];
  }

  // ---- interaction ---------------------------------------------------------
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var manual = reduce;
  var clock = 0;
  var drag = null;
  if (reduce) {
    view = { yaw: 0.4, pitch: SIDE.pitch, dolly: SIDE.dolly, s: 1 };
    status.textContent = phases[3][1];
  }

  panels.forEach(function (p) {
    var c = p.canvas;
    c.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch };
      manual = true;
      status.textContent = phases[3][1];
      try {
        c.setPointerCapture(e.pointerId);
      } catch (err) {}
      kick();
    });
    c.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var w = c.clientWidth;
      view.yaw = Math.max(-1.2, Math.min(1.2, drag.yaw + ((e.clientX - drag.x) / w) * 2.2));
      view.pitch = Math.max(-1.1, Math.min(0.15, drag.pitch - ((e.clientY - drag.y) / w) * 1.6));
      kick();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (t) {
      c.addEventListener(t, function () {
        drag = null;
      });
    });
  });
  replayBtn.addEventListener("click", function () {
    manual = false;
    clock = 0;
    lastPhase = -1;
    kick();
  });

  // ---- loop ----------------------------------------------------------------
  var raf = 0, last = 0, visible = false;
  function frame(t) {
    raf = 0;
    var dt = last ? Math.min((t - last) / 1000, 0.1) : 1 / 60;
    last = t;
    if (!manual) {
      clock = (clock + dt) % LOOP;
      view = timeline(clock);
      setStatus(clock);
    } else {
      // Ease into the full point cloud and a viewing distance after a drag.
      view.s += (1 - view.s) * Math.min(1, dt * 4);
      view.dolly += (SIDE.dolly - view.dolly) * Math.min(1, dt * 4);
    }
    drawAll();
    var settling = manual && (view.s < 0.999 || Math.abs(view.dolly - SIDE.dolly) > 0.01);
    if (visible && (!manual || settling || drag)) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && visible && clouds) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible && !clouds) {
      status.textContent = "Rendering the scene...";
      // Let the message paint before the ray tracing blocks for a moment.
      setTimeout(function () {
        build();
        if (!reduce) status.textContent = phases[0][1];
        drawAll();
        kick();
      }, 30);
    } else kick();
  }, { threshold: 0.15 }).observe(fig);
  new ResizeObserver(function () {
    if (clouds && !raf) drawAll();
  }).observe(stage);
  new MutationObserver(function () {
    readColours();
    if (!raf) drawAll();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  readColours();
  fig.classList.add("ready");
})();
