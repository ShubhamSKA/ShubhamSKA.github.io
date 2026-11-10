// The Chladni plate background. Loaded after infinity.js.

// ---- Chladni plate ---------------------------------------------------------
// Sand on a vibrating plate collects along the lines that stay still. The plate
// is driven at the cursor and carries on over the whole screen with no edge,
// while the sand thins out away from the cursor. Each grain is shaken in
// proportion to how much the plate moves under it and slides towards the
// nearest still ground, so the sand gathers on the nodal lines and keeps
// trembling there.
// Where the cursor is decides the figure, smoothly: every point of the screen
// has a figure of its own, a little different from its neighbours' and nothing
// like those far off. Figures are scattered over the screen at evenly spread
// points, drawn afresh at random each time the background starts, from three
// kinds of plate. A square one: cos(n pi u) cos(m pi v) + a cos(m pi u) cos(n pi v),
// the two modes that share a pitch, mixed in any proportion a, and the whole
// turned any way. A round one: J_n(k r) cos(n theta), rings of still ground crossed
// by n diameters, dying away outwards as a round plate's do. And crossing waves:
// N sets of straight waves at equal angles, which make squares and hexagons, and
// at five sets, a quasicrystal, a pattern that never repeats. The plate sounds
// the nearest few at once, each the louder the nearer the cursor, and a figure
// fades out to nothing just as it stops being among the nearest, so nothing ever
// jumps; the whole also turns a little over broad swells across the screen.
// It stays a real plate's figure throughout. A plate driven steadily vibrates at
// one pitch, and away from its edges any one pitch's vibration is some mix of
// straight waves all of one wavelength, which every figure here is. So all of
// them sound at the same pitch, which the cursor sets: finer to the right, and
// rising and falling a little over the swells. Mixed, they are still a mix of
// waves of one wavelength, a figure a plate could make, however little it
// repeats. Every figure is centred on the cursor and symmetric about it, the way a
// plate's are about the point it is driven at, so the cursor is always its
// middle: where lines of sand cross, or the heart of a ring or a rosette. And the
// drive there sends out rings of its own that fade into the figure, as hard as
// the figure moves at the cursor, since a drive can only shake a plate as much
// as the plate moves where it is driven: none where lines cross at the cursor,
// and a bullseye where it sits mid-cell in a grid that would otherwise look the
// same all over.
// A steady trickle of grains is thrown back on at a distance from the cursor
// picked evenly between nothing and `spread`; spread over rings that grow with
// distance, that thins the sand as 1 / distance, so the figure is crisp round
// the cursor and fades out rather than stopping at an edge, and sand left
// behind when the cursor moves drifts away over a few seconds. With no cursor
// the figure sits mid-screen and changes as though a cursor wandered slowly by.
const chladni = {
  size: 0.45, // share of the screen's shorter side that `pitch` counts lines across
  pitch: [5, 11], // nodal lines across `size`: at the screen's left edge, and at its right
  spread: 0.55, // how far out sand is thrown, share of the screen's diagonal
  figures: 20, // figures scattered over the screen
  nearest: 3, // how many of the nearest sound at once: with two, the figure lurches where three are equally near
  reach: 0.6, // how far each one carries, share of the distance between them
  kinds: [1, 1, 1], // how often a figure is a square plate's, a round one's, crossing waves'
  drive: 0.5, // how strongly the drive's own rings sound, for each of the figure's movement at the cursor
  turn: 0.5, // radians the whole figure turns, at most, across the screen's swells
  zoom: 0.25, // how much its pitch rises or falls across them
  follow: 0.15, // how closely the choice of figure keeps up with the cursor
  shake: 1.6, // px a grain jitters where the plate moves most
  rattle: 0.3, // px it jitters even on a still line, so it spreads along it
  sprinkle: 0.006, // share of the sand thrown on afresh each frame
  settle: 0.8, // px per frame a grain slides towards still ground
};

const CHLADNI_ORDERS = 11; // Bessel functions J_0 to J_10 are tabulated
const CHLADNI_STEP = 0.05; // between arguments
const CHLADNI_REACH = 160; // the furthest; past it, their long-range form
let chladniBessel = null; // J_n(x), order by order
let chladniSteps = 0;
let chladniPeak = new Float64Array(CHLADNI_ORDERS); // the largest each J_n gets

let chladniFigures = []; // { x, y, figure }: scattered over the screen
let chladniMix = []; // { figure, weight }: those sounding this frame
let chladniSwells = []; // { kx, ky, phase }: broad waves across the screen that turn it and shift its pitch
const chladniAt = { x: 0, y: 0 }; // the point the figure is chosen by, easing after the cursor
let chladniTime = 0;
// Each grain's last worked-out displacement and slope, kept for the frame
// between: the pull on a grain is worked out every other frame, half the sand
// one frame and half the next, and in between it goes on as it was last pulled.
// A frame is too short for that to show, and it halves the work.
let chladniLastF = new Float32Array(0);
let chladniLastX = new Float32Array(0);
let chladniLastY = new Float32Array(0);

// J_0 to J_10 at every step up to CHLADNI_REACH, by Miller's backward
// recurrence from well above each argument, normalised so that
// J_0 + 2 (J_2 + J_4 + ...) = 1. Done once.
function chladniTable() {
  if (chladniBessel) return;
  const steps = Math.round(CHLADNI_REACH / CHLADNI_STEP) + 2;
  const table = new Float64Array(CHLADNI_ORDERS * steps);
  const j = new Float64Array(CHLADNI_ORDERS);
  table[0] = 1;
  for (let s = 1; s < steps; s++) {
    const x = s * CHLADNI_STEP;
    const top = 2 * Math.ceil((x + 30) / 2);
    let above = 0;
    let here = 1e-30;
    let sum = 2 * here;
    for (let k = top; k >= 1; k--) {
      const below = ((2 * k) / x) * here - above;
      above = here;
      here = below;
      const order = k - 1;
      if (order < CHLADNI_ORDERS) j[order] = here;
      if (order > 0 && order % 2 === 0) sum += 2 * here;
      if (Math.abs(here) > 1e150) {
        here *= 1e-150;
        above *= 1e-150;
        sum *= 1e-150;
        for (let o = 0; o < CHLADNI_ORDERS; o++) j[o] *= 1e-150;
      }
    }
    sum += here;
    for (let o = 0; o < CHLADNI_ORDERS; o++) {
      table[o * steps + s] = j[o] / sum;
      chladniPeak[o] = Math.max(chladniPeak[o], Math.abs(j[o] / sum));
    }
  }
  chladniPeak[0] = 1;
  chladniBessel = table;
  chladniSteps = steps;
}

function chladniJ(n, x) {
  if (n < 0) return n % 2 ? -chladniJ(-n, x) : chladniJ(-n, x);
  if (x >= CHLADNI_REACH) return Math.sqrt(2 / (Math.PI * x)) * Math.cos(x - (n * Math.PI) / 2 - Math.PI / 4);
  const t = x / CHLADNI_STEP;
  const s = Math.floor(t);
  const at = n * chladniSteps + s;
  return chladniBessel[at] + (chladniBessel[at + 1] - chladniBessel[at]) * (t - s);
}

function chladniPickOf(weights) {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return i;
  }
  return 0;
}

// A figure, at random: only its shape, since how fine it is, its pitch, is
// the same for every figure sounding at once.
function chladniFigure() {
  const kind = chladniPickOf(chladni.kinds);
  if (kind === 0) {
    // A square plate's: the two modes of one pitch, n and m both odd or both
    // even so that the figure is symmetric about its middle, in any mixture,
    // turned any way. With n = m the two are one mode, which taken from itself
    // leaves nothing, so that one is only ever added.
    let n;
    let m;
    do {
      n = Math.floor(Math.random() * 9);
      m = Math.floor(Math.random() * 9);
    } while ((n + m) % 2 || n + m === 0);
    const r = Math.random();
    const mix = n === m ? 1 : r < 0.3 ? -1 : r < 0.5 ? 1 : Math.random() * 2 - 1;
    const turn = Math.random() < 0.4 ? 0 : (Math.random() * Math.PI) / 2;
    return {
      kind,
      n,
      m,
      mix,
      lines: Math.hypot(n, m), // its pitch, in lines across the square
      cos: Math.cos(turn),
      sin: Math.sin(turn),
      loud: 2 / (1 + Math.abs(mix)),
    };
  }
  if (kind === 1) {
    // A round plate's: rings, crossed by n diameters.
    const n = Math.floor(Math.random() * 9);
    return { kind, n, turn: Math.random() * Math.PI * 2, loud: 2 / chladniPeak[n] };
  }
  // Crossing waves: N sets at equal angles, all in step at the cursor. Six or
  // more in step are all but a round plate's rings, so there are at most five.
  const sets = [2, 3, 4, 5][chladniPickOf([1, 2, 2, 2])];
  const turn = Math.random() * Math.PI;
  const dx = new Float64Array(sets);
  const dy = new Float64Array(sets);
  for (let i = 0; i < sets; i++) {
    dx[i] = Math.cos(turn + (i * Math.PI) / sets);
    dy[i] = Math.sin(turn + (i * Math.PI) / sets);
  }
  return { kind, sets, dx, dy, loud: 1.4 / Math.sqrt(sets) };
}

// The plate's displacement and its gradient (per px) at (x, y) px from the
// cursor, for one figure at wavenumber k, added into plateAt with a weight.
const plateAt = { f: 0, gx: 0, gy: 0 };
function plate(figure, x, y, weight, k) {
  const w = weight * figure.loud;
  if (figure.kind === 0) {
    const { n, m, mix } = figure;
    const size = (Math.PI * figure.lines) / k;
    const c = figure.cos;
    const s = figure.sin;
    const rx = x * c + y * s;
    const ry = -x * s + y * c;
    const pu = Math.PI * (0.5 + rx / size);
    const pv = Math.PI * (0.5 + ry / size);
    const cnu = Math.cos(n * pu), snu = Math.sin(n * pu);
    const cmu = Math.cos(m * pu), smu = Math.sin(m * pu);
    const cmv = Math.cos(m * pv), smv = Math.sin(m * pv);
    const cnv = Math.cos(n * pv), snv = Math.sin(n * pv);
    const fu = (Math.PI * (-n * snu * cmv - mix * m * smu * cnv)) / size;
    const fv = (Math.PI * (-m * cnu * smv - mix * n * cmu * snv)) / size;
    plateAt.f += w * (cnu * cmv + mix * cmu * cnv);
    plateAt.gx += w * (fu * c - fv * s);
    plateAt.gy += w * (fu * s + fv * c);
  } else if (figure.kind === 1) {
    const n = figure.n;
    const r = Math.max(1e-3, Math.hypot(x, y));
    const kr = k * r;
    const j = chladniJ(n, kr);
    const dj = n === 0 ? -chladniJ(1, kr) : (chladniJ(n - 1, kr) - chladniJ(n + 1, kr)) / 2;
    const a = n * (Math.atan2(y, x) - figure.turn);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const dr = k * dj * ca;
    const dt = (-n * j * sa) / r;
    plateAt.f += w * j * ca;
    plateAt.gx += w * ((dr * x) / r - (dt * y) / r);
    plateAt.gy += w * ((dr * y) / r + (dt * x) / r);
  } else {
    const { sets, dx, dy } = figure;
    for (let i = 0; i < sets; i++) {
      const a = k * (x * dx[i] + y * dy[i]);
      const sa = Math.sin(a);
      plateAt.f += w * Math.cos(a);
      plateAt.gx -= w * k * dx[i] * sa;
      plateAt.gy -= w * k * dy[i] * sa;
    }
  }
}

// The figures sounding at a point of the screen, and how loud: each by how near
// it is, falling off smoothly with distance, the nearest few only. Each has the
// next nearest's loudness taken off it, so that one stops being among them just
// as it falls silent, rather than dropping out while still heard.
function chladniWeigh(px, py) {
  const w = canvas.width;
  const h = canvas.height;
  const apart = Math.sqrt((w * h) / Math.max(1, chladniFigures.length));
  const reach = 2 * Math.pow(chladni.reach * apart, 2);
  const near = chladniFigures.map(function (p) {
    return { figure: p.figure, weight: Math.exp(-((p.x - px) ** 2 + (p.y - py) ** 2) / reach) };
  });
  near.sort(function (a, b) {
    return b.weight - a.weight;
  });
  const count = Math.max(1, Math.min(near.length - 1, Math.round(chladni.nearest)));
  const floor = near.length > count ? near[count].weight : 0;
  let total = 0;
  chladniMix = [];
  for (let i = 0; i < count; i++) {
    const weight = near[i].weight - floor;
    if (weight <= 0) continue;
    chladniMix.push({ figure: near[i].figure, weight });
    total += weight;
  }
  if (!total) chladniMix = [{ figure: near[0].figure, weight: (total = 1) }];
  for (const m of chladniMix) m.weight /= total;
}

// How far the broad swells turn the figure, and the wavenumber everything
// sounds at, at a point of the screen.
function chladniPitch(px, py) {
  const s = chladniSwells.map(function (wave) {
    return Math.sin(wave.kx * px + wave.ky * py + wave.phase);
  });
  const [low, high] = chladni.pitch;
  const across = Math.max(0, Math.min(1, px / canvas.width));
  const lines = low * Math.pow(high / low, across) * Math.exp((chladni.zoom * (s[2] + s[3])) / 2);
  const size = chladni.size * Math.min(canvas.width, canvas.height);
  return { turn: (chladni.turn * (s[0] + s[1])) / 2, k: (Math.PI * lines) / size };
}

// The point the figure is chosen by: the cursor, or without one, a point
// wandering slowly over the screen.
function chladniTarget() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  const t = chladniTime;
  return {
    x: canvas.width * (0.5 + 0.38 * Math.sin(t * 0.0011)),
    y: canvas.height * (0.5 + 0.34 * Math.sin(t * 0.0017 + 1)),
  };
}

function startChladni() {
  chladniTable();
  const w = canvas.width;
  const h = canvas.height;
  // Spread evenly: each new point the best of a handful of candidates, the one
  // furthest from any already placed.
  chladniFigures = [];
  const count = Math.max(1, Math.round(chladni.figures));
  for (let i = 0; i < count; i++) {
    let best = null;
    let room = -1;
    for (let c = 0; c < 24; c++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      let near = Infinity;
      for (const p of chladniFigures) near = Math.min(near, (p.x - x) ** 2 + (p.y - y) ** 2);
      if (near > room) {
        room = near;
        best = { x, y };
      }
    }
    chladniFigures.push({ x: best.x, y: best.y, figure: chladniFigure() });
  }
  const diagonal = Math.hypot(w, h);
  chladniSwells = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const k = (Math.PI * 2) / (diagonal * (0.8 + Math.random() * 0.8));
    chladniSwells.push({ kx: Math.cos(a) * k, ky: Math.sin(a) * k, phase: Math.random() * Math.PI * 2 });
  }
  chladniTime = 0;
  const target = chladniTarget();
  chladniAt.x = target.x;
  chladniAt.y = target.y;
  chladniLastF = new Float32Array(0);
}

function stepChladni() {
  const w = canvas.width;
  const h = canvas.height;
  const cx = cursorOnPage ? cursorPosition.x : w / 2;
  const cy = cursorOnPage ? cursorPosition.y : h / 2;
  if (!chladniFigures.length || chladniFigures.length !== Math.max(1, Math.round(chladni.figures))) startChladni();
  chladniTime++;
  const target = chladniTarget();
  chladniAt.x += (target.x - chladniAt.x) * chladni.follow;
  chladniAt.y += (target.y - chladniAt.y) * chladni.follow;
  chladniWeigh(chladniAt.x, chladniAt.y);
  const playing = chladniMix;
  const pitch = chladniPitch(chladniAt.x, chladniAt.y);
  const k = pitch.k;
  const turnCos = Math.cos(pitch.turn);
  const turnSin = Math.sin(pitch.turn);
  // The drive's rings, as loud as the figures move at the cursor, and in step
  // with them there.
  plateAt.f = 0;
  for (let p = 0; p < playing.length; p++) plate(playing[p].figure, 0, 0, playing[p].weight, k);
  const drive = chladni.drive * plateAt.f;

  const n = whiteElements.length;
  const all = chladniLastF.length !== n;
  if (all) {
    chladniLastF = new Float32Array(n);
    chladniLastX = new Float32Array(n);
    chladniLastY = new Float32Array(n);
  }
  const half = chladniTime & 1;
  const spread = chladni.spread * Math.hypot(w, h);
  for (let i = 0; i < n; i++) {
    const e = whiteElements[i];
    const offScreen = e.x < 0 || e.x > w || e.y < 0 || e.y > h;
    let thrown = false;
    if (offScreen || Math.random() < chladni.sprinkle) {
      // Thrown back on: an even distance out, in any direction, on screen.
      for (let tries = 0; tries < 8; tries++) {
        const r = Math.random() * spread;
        const a = Math.random() * Math.PI * 2;
        e.x = cx + Math.cos(a) * r;
        e.y = cy + Math.sin(a) * r;
        if (e.x >= 0 && e.x <= w && e.y >= 0 && e.y <= h) break;
      }
      thrown = true;
    }
    if (all || thrown || (i & 1) === half) {
      // The figure turned about the cursor: worked out where the grain would
      // be on the unturned figure, and its slope turned back.
      const x = e.x - cx;
      const y = e.y - cy;
      const fx = x * turnCos + y * turnSin;
      const fy = -x * turnSin + y * turnCos;
      plateAt.f = 0;
      plateAt.gx = 0;
      plateAt.gy = 0;
      for (let p = 0; p < playing.length; p++) plate(playing[p].figure, fx, fy, playing[p].weight, k);
      if (drive) {
        const r = Math.max(1e-3, Math.hypot(fx, fy));
        const ring = (-drive * k * chladniJ(1, k * r)) / r;
        plateAt.f += drive * chladniJ(0, k * r);
        plateAt.gx += ring * fx;
        plateAt.gy += ring * fy;
      }
      chladniLastF[i] = plateAt.f;
      chladniLastX[i] = plateAt.gx * turnCos - plateAt.gy * turnSin;
      chladniLastY[i] = plateAt.gx * turnSin + plateAt.gy * turnCos;
    }
    const f = chladniLastF[i];
    const gx = chladniLastX[i];
    const gy = chladniLastY[i];
    const g = Math.hypot(gx, gy) || 1e-6;
    const jitter = chladni.shake * Math.min(1, Math.abs(f) / 2) + chladni.rattle;
    // Downhill on f squared, at a steady pace, easing off near the line.
    const slide = Math.min(chladni.settle, Math.abs(f) / g);
    const dir = f > 0 ? -1 : 1;
    e.x += (dir * gx * slide) / g + (Math.random() - 0.5) * 2 * jitter;
    e.y += (dir * gy * slide) / g + (Math.random() - 0.5) * 2 * jitter;
  }
}

registerBackground("chladni", {
  start: startChladni,
  step: stepChladni,
  settings: chladni,
});
