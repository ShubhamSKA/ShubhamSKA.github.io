// The aurora background, in development. Loaded after infinity.js, by the
// canvas lab only.

// ---- Aurora borealis -----------------------------------------------------------
// The northern lights among the stars. A few curtains of light hang across
// the sky, each a band with a sharp, bright lower edge and rays rising from
// it, fading as they climb and leaning in a little towards the zenith. The
// curtains ripple: folds travel along them, and where one doubles back on
// itself the light piles up into a bright fold, because the dots are spread
// along the curtain, not across the screen. Along each, the rays flicker and
// run, bright ones and dim gaps sliding past each other, and the whole
// display slowly swells and fades. The light gathers round the cursor: there
// the curtains blaze, their rays reach higher and their edges bend towards
// it, and away from it they fade to a glimmer. Further curtains are fainter,
// with shorter rays. A few stars twinkle. Without a cursor the light gathers
// round a point that wanders across the sky.
// Dots: the stars, then the curtains, shared out by how bright each is, every
// dot finding its place along its curtain by how bright it is there; the rest
// are parked out of sight.
const aurora = {
  curtains: 2, // bands of light across the sky
  edge: [0.3, 0.55], // where their lower edges hang, share of the height, highest to lowest
  rays: [0.12, 0.3], // how high their rays reach, share of the height, furthest to nearest
  folds: 1.4, // how deeply they fold back on themselves
  drift: 0.0035, // how fast the folds travel along them, a share of their length a frame
  shimmer: 0.035, // how fast the rays run along them
  focus: 0.8, // share of the light that gathers round the cursor
  width: 0.2, // how far round the cursor it gathers, share of the width
  pull: 0.6, // how far the cursor draws a curtain's edge towards it
  stars: 220,
};

let auroraTime = 0;
let auroraStarX = new Float32Array(0);
let auroraStarY = new Float32Array(0);
let auroraStarBeat = new Float32Array(0); // each star's own twinkle
let auroraPhase = new Float32Array(0); // each curtain's own randomness
let auroraQ = new Float32Array(0); // each dot's place in its curtain: a jitter along, up, and a nudge across
let auroraUp = new Float32Array(0);
let auroraNudge = new Float32Array(0);
const AURORA_GRID = 1024;
let auroraW = new Float32Array(AURORA_GRID + 1); // a curtain's brightness along it, summed

function auroraRamp(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function startAurora() {
  const w = canvas.width;
  const h = canvas.height;
  auroraTime = 0;
  const stars = Math.max(0, Math.round(aurora.stars));
  auroraStarX = new Float32Array(stars);
  auroraStarY = new Float32Array(stars);
  auroraStarBeat = new Float32Array(stars);
  for (let i = 0; i < stars; i++) {
    auroraStarX[i] = Math.random() * w;
    auroraStarY[i] = Math.random() * h;
    auroraStarBeat[i] = Math.random() * 100;
  }
  const curtains = Math.max(1, Math.round(aurora.curtains));
  auroraPhase = new Float32Array(curtains * 8);
  for (let i = 0; i < auroraPhase.length; i++) auroraPhase[i] = Math.random() * Math.PI * 2;
  // Every dot keeps its place in the light: a jitter along the brightness
  // from its even share of it, how far up its ray, and a nudge across.
  const n = whiteElements.length;
  auroraQ = new Float32Array(n);
  auroraUp = new Float32Array(n);
  auroraNudge = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    auroraQ[i] = Math.random();
    // A sharp lower edge, the light falling away above it.
    const r = Math.random();
    auroraUp[i] = r < 0.12 ? Math.random() * 0.03 : -Math.log(1 - Math.random() * 0.9) / 2.3;
    auroraNudge[i] = (Math.random() - 0.5) * 1.5;
  }
}

function auroraFocus() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  const t = auroraTime;
  return {
    x: canvas.width * (0.5 + 0.35 * Math.sin(t * 0.0023)),
    y: canvas.height * (0.42 + 0.12 * Math.sin(t * 0.0031 + 1.1)),
  };
}

function stepAurora() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  auroraTime++;
  const time = auroraTime;
  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }

  // The stars, twinkling.
  for (let i = 0; i < auroraStarX.length; i++) {
    if (Math.sin(time * 0.07 + auroraStarBeat[i] * 7) > 0.93) continue;
    put(auroraStarX[i], auroraStarY[i]);
  }
  // Where the light gathers, and how much, a share of the way across.
  const focus = auroraFocus();
  const reachAcross = Math.max(1, aurora.width * w);
  function gathered(x) {
    return Math.exp(-Math.pow((x - focus.x) / reachAcross, 2));
  }

  // The curtains, nearest last and brightest; their share of the dots by how
  // bright each is.
  const curtains = auroraPhase.length / 8;
  const swell = 0.75 + 0.25 * Math.sin(time * 0.0021);
  const left = Math.max(0, n - next);
  let weights = 0;
  for (let c = 0; c < curtains; c++) weights += 0.5 + c / Math.max(1, curtains - 1);
  const span = w * 1.3;
  const x0 = -w * 0.15;
  let start = next;
  for (let c = 0; c < curtains; c++) {
    const near = curtains > 1 ? c / (curtains - 1) : 1;
    const p = c * 8;
    const ph = auroraPhase;
    // Further curtains hang lower, towards the horizon.
    const edge = h * (aurora.edge[0] + (aurora.edge[1] - aurora.edge[0]) * (1 - near) + 0.03 * Math.sin(ph[p]));
    const tall = h * (aurora.rays[0] + (aurora.rays[1] - aurora.rays[0]) * near);
    const f1 = 2.2 + ph[p + 1] * 0.2;
    const f2 = 3.7 + ph[p + 2] * 0.2;
    const a1 = (aurora.folds * 0.7 * span) / (Math.PI * 2 * f1);
    const a2 = (aurora.folds * 0.35 * span) / (Math.PI * 2 * f2);
    const drift = aurora.drift * Math.PI * 2 * time;
    const shimmer = aurora.shimmer * time;
    function across(u) {
      const fold1 = a1 * Math.sin(Math.PI * 2 * f1 * u - drift + ph[p + 3]);
      const fold2 = a2 * Math.sin(Math.PI * 2 * f2 * u + drift * 0.7 + ph[p + 4]);
      return x0 + u * span + fold1 + fold2;
    }
    function lower(u, x) {
      let y = edge + h * 0.07 * Math.sin(Math.PI * 2 * 1.1 * u + time * 0.0013 + ph[p + 5]);
      y += h * 0.03 * Math.sin(Math.PI * 2 * 2.7 * u - time * 0.002 + ph[p + 6]);
      return y + (focus.y - y) * aurora.pull * 0.5 * gathered(x);
    }
    // Brightness along the curtain: narrow rays, running along it at two
    // speeds so they brighten and dim as they pass each other, over a broad
    // swell; gathered round the cursor, dying away at the ends.
    let sum = 0;
    auroraW[0] = 0;
    for (let g = 0; g < AURORA_GRID; g++) {
      const u = (g + 0.5) / AURORA_GRID;
      const ray1 = Math.pow(0.5 + 0.5 * Math.sin(Math.PI * 2 * 31 * u - shimmer * 1.3 + ph[p + 6]), 10);
      const ray2 = Math.pow(0.5 + 0.5 * Math.sin(Math.PI * 2 * 47 * u + shimmer + ph[p + 7]), 10);
      const broad = 0.55 + 0.45 * Math.sin(Math.PI * 2 * 4.3 * u + shimmer * 0.05 + ph[p + 1]);
      let bright = (0.06 + ray1 + 0.8 * ray2) * broad * auroraRamp(0, 0.08, u) * (1 - auroraRamp(0.92, 1, u));
      bright *= (1 - aurora.focus) * 0.25 + aurora.focus * gathered(across(u));
      sum += bright;
      auroraW[g + 1] = sum;
    }
    // This curtain's dots, spread evenly through its brightness, each where
    // its share falls.
    const count = c === curtains - 1 ? n - start : Math.round((left * (0.5 + near)) / weights);
    const stop = Math.min(n, start + count);
    let g = 0;
    for (let i = start; i < stop; i++) {
      const target = ((i - start + auroraQ[i]) / Math.max(1, stop - start)) * sum;
      while (g < AURORA_GRID - 1 && auroraW[g + 1] < target) g++;
      const within = (target - auroraW[g]) / Math.max(1e-9, auroraW[g + 1] - auroraW[g]);
      const u = (g + within) / AURORA_GRID;
      const x = across(u);
      const wave = 0.75 + 0.25 * Math.sin(Math.PI * 2 * 3.1 * u - time * 0.002 + ph[p + 2]);
      const reach = tall * wave * (1 + 0.6 * gathered(x));
      const rise = reach * auroraUp[i] * swell;
      // Rays lean in towards the zenith as they climb.
      put(x + auroraNudge[i] + (w / 2 - x) * 0.12 * (rise / h), lower(u, x) - rise);
    }
    start = stop;
    next = stop;
  }
  while (next < n) put(-100, -100);
}

registerBackground("aurora", {
  start: startAurora,
  step: stepAurora,
  settings: aurora,
  lab: true,
});
