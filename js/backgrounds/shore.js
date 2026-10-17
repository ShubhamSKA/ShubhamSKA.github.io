// The shore background. Loaded after infinity.js.

// ---- Bioluminescent shore ----------------------------------------------------
// A beach at night where the water is full of dinoflagellates, plankton that
// flash with light when the water round them is disturbed. Seen from above,
// the sea at the top and the sand at the bottom. The coastline runs across
// the screen and juts out towards the cursor as a headland, or bends back into
// a bay when the cursor is on the sand side of it; it eases after the cursor,
// so the coast reshapes slowly. The water gets shallower towards the coast,
// and waves go slower in shallow water, so each crest comes in bent round to
// meet the coast more nearly square on (refraction), wrapping round a headland
// and spreading out in a bay. A crest is tracked as a line of points, one per
// column, each moving on at the speed the depth under it allows.
// Out in deep water a crest is dark but for a few flashes; it lights up more
// as it steepens. Where the water is shallow enough a point breaks and flares
// up bright, so a wave lights up first where it reaches the shallows first
// and the light runs along the crest as the break peels. The broken water
// glows as it churns on to the coast and dims as it goes. It is brightest of
// all where it hits the sand: the swash runs up as a sheet of glowing foam,
// thickest along its edge and lacy behind it, a pattern of bubbles and holes
// that rides along with the water, and it stays lit while it runs up and back.
// Where the swash stops it strands clumps of foam that glow on the wet sand a
// while.
// Glowing water leaves sparks behind that twinkle and fade, and moving the
// cursor through the water stirs up a trail of them.
// Dots: brighter water has more of them; a faint line along the coast, the
// crests, the broken water and swash, then the sparks.
const shore = {
  coast: 0.62, // where the coastline runs, share of the height
  headland: 0.16, // how wide the headland or bay round the cursor is, share of the width
  reshape: 0.03, // share of the way to the cursor's coastline it goes each frame
  column: 4, // px between the points a crest is tracked by
  speed: 2.2, // px per frame a crest moves in deep water
  shoal: 0.35, // depth where waves start to slow, share of the height
  breakAt: 0.07, // depth where they break, share of the height
  bore: 0.55, // speed of broken water, share of the deep-water speed
  period: 140, // frames between waves
  swell: 0.2, // rad: how far off square to the screen the swell comes in, at most
  runUp: 1.6, // px per frame swash runs up the sand at first
  drag: 0.016, // px per frame per frame it slows by
  whitewater: 26, // px: how deep the band of broken water is
  darkCrest: 0.06, // share of a crest that flashes out in deep water
  glowFade: 0.985, // share of its glow broken water keeps each frame
  sparks: 0.05, // chance per column per frame glowing water leaves a spark, at full glow
  sparkLife: [40, 140], // frames a spark lasts
  foam: 20, // foam dots per column of swash, at full glow
  foamDepth: 33, // px: how far behind its edge the swash's foam reaches
  lace: 0.45, // share of the foam sheet that is holes
  swashFade: 0.995, // share of its glow swash keeps each frame
  stranded: 0.6, // chance per column a stopping swash strands a clump of foam on the sand
  strandLife: [80, 220], // frames stranded foam glows
  wake: 1.5, // sparks per px the cursor moves through the water
};

let shoreWaves = []; // { y, v, glow, state, born, seed }; state: 0 crest, 1 broken, 2 swash, 3 gone
let shoreCoast = new Float32Array(0); // the coastline's height in each column
let shoreTime = 0;
let shoreLastWave = 0;
let shoreSparkX = new Float32Array(0);
let shoreSparkY = new Float32Array(0);
let shoreSparkLife = new Float32Array(0); // frames left
let shoreSparkSpan = new Float32Array(0); // frames it had to start with
let shoreSparkDrift = new Float32Array(0); // px per frame towards the coast; 0 on the sand
let shoreSparks = 0;
let shoreSparkRoom = 0; // dots the waves left over last frame, for sparks
let shoreMouse = { x: 0, y: 0, on: false };

function shoreColumns() {
  return Math.max(2, Math.ceil(canvas.width / shore.column) + 1);
}

// Where the coast wants to be in each column: level, with a headland or bay
// reaching for the cursor.
function shoreCoastTarget(i) {
  const h = canvas.height;
  const base = shore.coast * h;
  if (!cursorOnPage) return base;
  const x = i * shore.column;
  const reach = Math.min(h * 0.92, Math.max(h * 0.18, cursorPosition.y));
  const off = (x - cursorPosition.x) / Math.max(1, shore.headland * canvas.width);
  return base + (reach - base) * Math.exp(-off * off);
}

function shoreAddWave(y) {
  const count = shoreColumns();
  const w = canvas.width;
  const angle = (Math.random() * 2 - 1) * shore.swell;
  const wave = {
    y: new Float32Array(count),
    v: new Float32Array(count),
    glow: new Float32Array(count),
    state: new Uint8Array(count),
    born: shoreTime,
    seed: Math.random() * 100,
  };
  for (let i = 0; i < count; i++) wave.y[i] = y + Math.tan(angle) * (i * shore.column - w / 2);
  shoreWaves.push(wave);
}

function startShore() {
  const n = whiteElements.length;
  const count = shoreColumns();
  shoreTime = 0;
  shoreWaves = [];
  shoreCoast = new Float32Array(count);
  for (let i = 0; i < count; i++) shoreCoast[i] = shoreCoastTarget(i);
  // Some waves already on their way in.
  const gap = shore.period * shore.speed;
  for (let y = -40; y < shore.coast * canvas.height * 0.55; y += gap) shoreAddWave(y);
  shoreLastWave = 0;
  shoreSparkX = new Float32Array(n);
  shoreSparkY = new Float32Array(n);
  shoreSparkLife = new Float32Array(n);
  shoreSparkSpan = new Float32Array(n);
  shoreSparkDrift = new Float32Array(n);
  shoreSparks = 0;
  shoreSparkRoom = 0;
  shoreMouse = { x: cursorPosition.x, y: cursorPosition.y, on: cursorOnPage };
}

// A number in [0, 1) that stays the same for the same inputs.
function shoreHash(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// Smooth noise in [0, 1) over a 5 px grid: thresholded, it makes the bubbles
// and holes of a sheet of foam.
function shoreLace(x, y, seed) {
  const gx = x / 5;
  const gy = y / 5;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = shoreHash(ix + seed, iy);
  const b = shoreHash(ix + 1 + seed, iy);
  const c = shoreHash(ix + seed, iy + 1);
  const d = shoreHash(ix + 1 + seed, iy + 1);
  return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy;
}

function shoreSpark(x, y, life, drift) {
  if (shoreSparks >= shoreSparkRoom) return;
  const k = shoreSparks++;
  shoreSparkX[k] = x;
  shoreSparkY[k] = y;
  shoreSparkLife[k] = shoreSparkSpan[k] = life[0] + Math.random() * (life[1] - life[0]);
  shoreSparkDrift[k] = drift;
}

function stepShore() {
  const n = whiteElements.length;
  const h = canvas.height;
  const count = shoreColumns();
  shoreTime++;
  if (shoreCoast.length !== count) startShore();

  for (let i = 0; i < count; i++) shoreCoast[i] += (shoreCoastTarget(i) - shoreCoast[i]) * shore.reshape;
  if (shoreTime - shoreLastWave >= shore.period) {
    shoreLastWave = shoreTime;
    shoreAddWave(-40);
  }

  const shoal = Math.max(1, shore.shoal * h);
  const breakDepth = shore.breakAt * h;
  const dx = shore.column;
  for (const wave of shoreWaves) {
    const y = wave.y;
    const state = wave.state;
    const glow = wave.glow;
    const next = new Float32Array(y);
    for (let i = 0; i < count; i++) {
      const s = state[i];
      if (s === 3) continue;
      const depth = shoreCoast[i] - y[i];
      glow[i] *= s === 2 ? shore.swashFade : shore.glowFade;
      if (s === 2) {
        // Swash: up the sand, slowing, then back down; gone at the waterline.
        // Where it stops, it strands glowing plankton on the sand.
        const before = wave.v[i];
        wave.v[i] = Math.max(-shore.runUp, wave.v[i] - shore.drag);
        next[i] = y[i] + wave.v[i];
        if (before >= 0 && wave.v[i] < 0 && Math.random() < shore.stranded * glow[i]) {
          // A clump of foam, not a single spark.
          const cx = i * dx + (Math.random() - 0.5) * dx;
          for (let k = 0; k < 4; k++) {
            shoreSpark(cx + (Math.random() - 0.5) * 5, y[i] - Math.random() * 4, shore.strandLife, 0);
          }
        }
        if (wave.v[i] < 0 && next[i] <= shoreCoast[i]) state[i] = 3;
        continue;
      }
      // A crest moves on square to itself, at the speed the depth allows: a
      // point on a slope across the screen covers more ground downwards.
      const left = y[i > 0 ? i - 1 : i];
      const right = y[i < count - 1 ? i + 1 : i];
      const slope = (right - left) / (2 * dx);
      const pace =
        s === 0
          ? shore.speed * Math.sqrt(Math.max(0.04, Math.min(1, depth / shoal)))
          : shore.speed * shore.bore;
      // A little smoothing keeps the line from kinking.
      next[i] = y[i] + pace * Math.sqrt(1 + slope * slope) + 0.15 * (left + right - 2 * y[i]);
      if (s === 0 && depth < breakDepth) {
        // It breaks, and flares.
        state[i] = 1;
        glow[i] = 1;
      }
      if (s === 1) {
        if (next[i] >= shoreCoast[i]) {
          // On to the sand, flaring brightest of all as it hits.
          state[i] = 2;
          glow[i] = 1;
          // Lacy: each column runs up a little differently, in uneven cusps.
          wave.v[i] =
            shore.runUp *
            (1 +
              0.1 * Math.sin(i * 0.37 + wave.seed) +
              0.08 * Math.sin(i * 0.13 + wave.seed * 2.3) +
              0.12 * (shoreHash(i, wave.seed) - 0.5));
        } else if (Math.random() < shore.sparks * glow[i]) {
          shoreSpark(i * dx + (Math.random() - 0.5) * dx * 2, y[i] - Math.random() * shore.whitewater, shore.sparkLife, 0.15);
        }
      }
    }
    wave.y = next;
  }
  shoreWaves = shoreWaves.filter(function (wave) {
    for (let i = 0; i < count; i++) if (wave.state[i] !== 3) return true;
    return false;
  });

  // The cursor stirs a trail of sparks wherever it moves through the water.
  if (cursorOnPage && shoreMouse.on) {
    const moved = Math.hypot(cursorPosition.x - shoreMouse.x, cursorPosition.y - shoreMouse.y);
    const column = Math.min(count - 1, Math.max(0, Math.round(cursorPosition.x / dx)));
    if (moved > 0.5 && cursorPosition.y < shoreCoast[column]) {
      const sparks = Math.min(40, Math.round(moved * shore.wake));
      for (let k = 0; k < sparks; k++) {
        const t = Math.random();
        shoreSpark(
          shoreMouse.x + (cursorPosition.x - shoreMouse.x) * t + (Math.random() - 0.5) * 12,
          shoreMouse.y + (cursorPosition.y - shoreMouse.y) * t + (Math.random() - 0.5) * 12,
          shore.sparkLife,
          0.15
        );
      }
    }
  }
  shoreMouse = { x: cursorPosition.x, y: cursorPosition.y, on: cursorOnPage };

  // Sparks drift slowly in; those in the water go out at the waterline.
  for (let k = shoreSparks - 1; k >= 0; k--) {
    shoreSparkLife[k]--;
    let gone = shoreSparkLife[k] <= 0;
    if (shoreSparkDrift[k]) {
      shoreSparkY[k] += shoreSparkDrift[k];
      shoreSparkX[k] += (Math.random() - 0.5) * 0.3;
      const column = Math.min(count - 1, Math.max(0, Math.round(shoreSparkX[k] / dx)));
      gone = gone || shoreSparkY[k] > shoreCoast[column];
    }
    if (gone) {
      shoreSparks--;
      shoreSparkX[k] = shoreSparkX[shoreSparks];
      shoreSparkY[k] = shoreSparkY[shoreSparks];
      shoreSparkLife[k] = shoreSparkLife[shoreSparks];
      shoreSparkSpan[k] = shoreSparkSpan[shoreSparks];
      shoreSparkDrift[k] = shoreSparkDrift[shoreSparks];
    }
  }

  // ---- Laying out the dots ----
  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  const churn = Math.floor(shoreTime / 4);
  for (let i = 0; i < count; i += 4) put(i * dx, shoreCoast[i] + 2);
  for (const wave of shoreWaves) {
    for (let i = 0; i < count; i++) {
      const y = wave.y[i];
      const x = i * dx;
      const s = wave.state[i];
      const glow = wave.glow[i];
      if (s === 3 || y < -5) continue;
      const flicker = shoreHash(i + wave.seed, churn);
      if (s === 0) {
        // Dark but for flashes, more as it steepens towards breaking.
        const steep = Math.max(0, 1 - (shoreCoast[i] - y - breakDepth) / (2 * breakDepth));
        if (flicker < shore.darkCrest + 0.6 * steep) put(x, y);
      } else if (s === 1) {
        // Churning glow, brightest at the front, dimming as it goes.
        if (flicker < glow * 1.5) put(x, y);
        const dots = Math.round(glow * 5);
        for (let k = 0; k < dots; k++) {
          const a = shoreHash(i * 5 + k, churn + wave.seed);
          const b = shoreHash(i * 5 + k + 0.5, churn + wave.seed);
          put(x + (b - 0.5) * dx * 2, y - a * a * shore.whitewater);
        }
      } else {
        // Swash: a thick glowing edge, and a lacy sheet of foam behind it that
        // rides along with it, thinning as it goes back down.
        put(x, y);
        if (flicker < glow) put(x + dx / 2, y - 1.5);
        const reach = Math.min(shore.foamDepth, Math.max(4, y - shoreCoast[i] + 8));
        const dots = Math.round(shore.foam * glow * (wave.v[i] >= 0 ? 1 : 0.6));
        for (let k = 0; k < dots; k++) {
          const a = shoreHash(i * 7 + k, wave.seed + Math.floor(shoreTime / 3));
          const b = shoreHash(i * 7 + k + 0.5, wave.seed);
          const behind = a * a * reach;
          const fx = x + (b - 0.5) * dx * 2;
          if (shoreLace(fx, behind, wave.seed) > shore.lace) put(fx, y - behind);
        }
      }
    }
  }
  shoreSparkRoom = n - next;
  // Sparks twinkle, showing less often as they fade.
  for (let k = 0; k < shoreSparks; k++) {
    if (shoreHash(k, churn) < shoreSparkLife[k] / shoreSparkSpan[k]) put(shoreSparkX[k], shoreSparkY[k]);
  }
  while (next < n) put(-100, -100);
}

registerBackground("shore", {
  start: startShore,
  step: stepShore,
  settings: shore,
});
