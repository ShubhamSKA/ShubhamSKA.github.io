// The ripples background. Loaded after infinity.js.

// ---- Ripples ---------------------------------------------------------------
// The cursor bobs on the water like a float and sends out a ring every so
// often. The rings are the crests of the waves it makes, a wavelength apart,
// with the troughs halfway between. A ring keeps the centre it was born at,
// so a cursor sitting still draws even concentric circles, and a moving one
// crowds the rings ahead of it and spreads them out behind (Doppler). Waves
// weaken as they spread, and where they cross their heights add. Dots are
// laid along every crest, and each is shown only as often as the water there
// is high. Rings from one place stay in step, so a still float's rings run on
// unbroken; once the float has moved, or the page has scrolled under it,
// rings from different places cross, and where crest meets crest they run on
// bright and where crest meets trough they break off, leaving the nodal lines
// of an interference pattern. A weaker wave shows fewer dots. Scrolling
// carries the water, and every ring on it, along with the page, which moves
// the float through the water just the same. Once a ring has spread its full
// distance it goes back to the float to make the next one.
const ripple = {
  speed: 2.5, // px per frame a ring travels
  period: 40, // frames between rings; with speed, sets the wavelength
  reach: 0.6, // how far a ring spreads, as a share of the screen diagonal
  fade: 0.004, // how quickly waves weaken as they spread
  crest: 0.5, // how far each ring's wave reaches either side, in wavelengths
  spacing: 3, // px: the closest the dots lie along a ring
  roughness: 1.5, // px: dots sit this far either side of the line, at most
  frame: 0,
  rings: [], // { x, y, born }
  scrolled: 0,
};

let lastScrollY = window.scrollY;
window.addEventListener(
  "scroll",
  function () {
    ripple.scrolled += window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
  },
  { passive: true }
);

// Every wave on the water this frame: centre, radius, height, and which ring
// it is, so each dot keeps its own chance of showing from frame to frame.
let rippleWaveX = new Float32Array(0);
let rippleWaveY = new Float32Array(0);
let rippleWaveR = new Float32Array(0);
let rippleWaveA = new Float32Array(0);
let rippleWaveId = new Float32Array(0);
let rippleWaves = 0;
let rippleNear = new Int32Array(0); // the waves that reach a given wave's ring

// One wave's height against distance from its ring, in wavelengths: a crest
// with a trough either side, dying away within RIPPLE_REACH wavelengths.
// Looked up rather than worked out, since it is needed so often.
const RIPPLE_REACH = 1.5;
const RIPPLE_STEPS = 1024;
const rippleShape = new Float32Array(RIPPLE_STEPS + 1);
let rippleShapeCrest = -1;
function rippleMakeShape() {
  if (rippleShapeCrest === ripple.crest) return;
  rippleShapeCrest = ripple.crest;
  const bell = 1 / (2 * ripple.crest * ripple.crest);
  for (let i = 0; i <= RIPPLE_STEPS; i++) {
    const u = (i / RIPPLE_STEPS) * 2 * RIPPLE_REACH - RIPPLE_REACH;
    rippleShape[i] = Math.cos(Math.PI * 2 * u) * Math.exp(-u * u * bell);
  }
}

function rippleSource() {
  // The float is the cursor, or the middle of the screen without one.
  return cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: canvas.width / 2, y: canvas.height / 2 };
}

function rippleLifetime() {
  const w = canvas.width;
  const h = canvas.height;
  return (ripple.reach * Math.sqrt(w * w + h * h)) / ripple.speed;
}

function startRipples() {
  const count = Math.max(1, Math.ceil(rippleLifetime() / ripple.period));
  // Start as if the float had been bobbing for a while, so every ring is
  // already out.
  const source = rippleSource();
  ripple.frame = 0;
  ripple.rings = [];
  for (let k = 0; k < count; k++) {
    ripple.rings.push({ x: source.x, y: source.y, born: -k * ripple.period });
  }
  const most = count;
  rippleWaveX = new Float32Array(most);
  rippleWaveY = new Float32Array(most);
  rippleWaveR = new Float32Array(most);
  rippleWaveA = new Float32Array(most);
  rippleWaveId = new Float32Array(most);
  rippleNear = new Int32Array(most);
  ripple.scrolled = 0;
}

function rippleAddWave(x, y, r, a, id) {
  if (a < 0.02) return;
  const k = rippleWaves++;
  rippleWaveX[k] = x;
  rippleWaveY[k] = y;
  rippleWaveR[k] = r;
  rippleWaveA[k] = a;
  rippleWaveId[k] = id;
}

// The same number in [0, 1) every frame for a given ring and angle.
function rippleHash(id, angle) {
  const s = Math.sin(id * 12.9898 + angle * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function stepRipples() {
  const w = canvas.width;
  const h = canvas.height;
  const n = whiteElements.length;
  const rings = ripple.rings;
  const count = rings.length;
  const lifetime = count * ripple.period;
  const wavelength = ripple.speed * ripple.period;
  ripple.frame++;

  // Scrolling down slides the page, and the water with it, up the screen.
  if (ripple.scrolled !== 0) {
    for (const ring of rings) ring.y -= ripple.scrolled;
    ripple.scrolled = 0;
  }

  // The oldest ring goes back to the float to start again.
  for (let k = 0; k < count; k++) {
    if (ripple.frame - rings[k].born >= lifetime) {
      const source = rippleSource();
      rings[k] = { x: source.x, y: source.y, born: ripple.frame };
    }
  }

  // Each ring, weakening as it spreads, easing in as it leaves the float and
  // out before it goes back.
  rippleWaves = 0;
  for (let k = 0; k < count; k++) {
    const ring = rings[k];
    const age = ripple.frame - ring.born;
    const r = age * ripple.speed;
    if (r <= 0) continue;
    const a =
      Math.min(1, r / (0.5 * wavelength)) *
      Math.min(1, (lifetime - age) / (2 * ripple.period)) /
      Math.sqrt(1 + ripple.fade * r);
    rippleAddWave(ring.x, ring.y, r, a, ring.born);
  }

  // How much of each wave is on screen, so the dots can be spaced to go
  // round. A weak wave gets fewer.
  let wanted = 0;
  for (let k = 0; k < rippleWaves; k++) {
    let inside = 0;
    for (let s = 0; s < 32; s++) {
      const angle = ((s + 0.5) / 32) * Math.PI * 2;
      const x = rippleWaveX[k] + Math.cos(angle) * rippleWaveR[k];
      const y = rippleWaveY[k] + Math.sin(angle) * rippleWaveR[k];
      if (x >= 0 && x < w && y >= 0 && y < h) inside++;
    }
    wanted += (inside / 32) * Math.PI * 2 * rippleWaveR[k] * Math.min(1, rippleWaveA[k]);
  }
  const spacing = Math.max(ripple.spacing, wanted / (0.9 * n));

  // A lone crest at full height reads as this tall, its neighbours included.
  rippleMakeShape();
  const bell = 1 / (2 * ripple.crest * ripple.crest);
  let full = 0;
  for (let k = -1; k <= 1; k++) full += Math.exp(-k * k * bell);
  const band = RIPPLE_REACH * wavelength;
  const scale = RIPPLE_STEPS / (2 * band);
  // Kept local: the loop below runs some hundred thousand times a frame.
  const WX = rippleWaveX;
  const WY = rippleWaveY;
  const WR = rippleWaveR;
  const WA = rippleWaveA;
  const near = rippleNear;
  const shape = rippleShape;

  // Strongest waves first, in case the dots run out.
  const order = [];
  for (let k = 0; k < rippleWaves; k++) order.push(k);
  order.sort(function (a, b) {
    return rippleWaveA[b] - rippleWaveA[a];
  });

  let next = 0;
  for (let o = 0; o < order.length && next < n; o++) {
    const k = order[o];
    const cx = rippleWaveX[k];
    const cy = rippleWaveY[k];
    const r = rippleWaveR[k];
    const strength = Math.min(1, rippleWaveA[k]);
    // Only waves whose band can touch this ring matter along it.
    let nearby = 0;
    for (let m = 0; m < rippleWaves; m++) {
      const apart = Math.hypot(WX[m] - cx, WY[m] - cy);
      if (apart + band >= Math.abs(r - WR[m]) && apart <= r + WR[m] + band) near[nearby++] = m;
    }
    // A power of two round the ring, so as it grows and more are needed
    // they fall between the dots already there, which stay put. Fewer for a
    // weaker wave, each the likelier to show.
    const doublings = Math.ceil(Math.log2((Math.PI * 2 * r * strength) / spacing));
    const around = 1 << Math.min(16, Math.max(3, doublings));
    const enough = full * strength;
    for (let j = 0; j < around && next < n; j++) {
      const angle = (j / around) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = cx + cos * r;
      const y = cy + sin * r;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      // The water's height here: every wave's crest and troughs near it.
      let height = 0;
      for (let i = 0; i < nearby; i++) {
        const m = near[i];
        const dx = x - WX[m];
        const dy = y - WY[m];
        const d2 = dx * dx + dy * dy;
        const lo = WR[m] - band;
        const hi = WR[m] + band;
        if (d2 >= hi * hi || (lo > 0 && d2 <= lo * lo)) continue;
        const at = ((Math.sqrt(d2) - lo) * scale + 0.5) | 0;
        if (at >= 0 && at <= RIPPLE_STEPS) height += WA[m] * shape[at];
      }
      const chance = rippleHash(rippleWaveId[k], angle);
      if (height / enough <= chance) continue;
      const rough = (((chance * 7.31) % 1) * 2 - 1) * ripple.roughness;
      const e = whiteElements[next++];
      e.x = x + cos * rough;
      e.y = y + sin * rough;
    }
  }
  for (; next < n; next++) {
    whiteElements[next].x = -100;
    whiteElements[next].y = -100;
  }
}

registerBackground("ripples", {
  start: startRipples,
  step: stepRipples,
  settings: ripple,
  runtime: ["frame", "scrolled"],
});
