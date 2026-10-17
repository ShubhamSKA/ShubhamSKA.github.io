// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js.

// ---- Tail in the wind --------------------------------------------------------
// A horse's tail at a gallop. The dock, the short fleshy root the hair grows
// from, comes out of the middle of the left edge raised and arching over, and
// bobs and swishes with every stride. Hair grows along the whole dock, more
// towards its end, so the tail thickens as the hair joins it, then streams to
// the right edge and tries to pass through the cursor: a smooth line from the
// end of the dock, through the cursor, to a point on the right edge that
// drifts up and down and hangs a little below the cursor, is where the hair
// wants to be. Each strand is a chain of beads that keep their spacing and are
// drawn towards their place along that line by a spring, firmly near the root
// and loosely at the tip, so the hair lags behind a moving cursor and gravity
// drags the loose ends down. The strands gather into locks that fan out into
// a broad plume; the middle locks are longest, so the plume tapers to a few
// long hairs at its end. A slow wave runs down the tail as the wind shakes it
// and a quicker one with each stride, both growing towards the end; each lock
// is a little out of step with the others and each strand has a ripple of its
// own. A few strands are loose wisps that stray from the plume and flutter.
// Dots: a solid clump for the dock; the rest shared between the strands, more
// of them near the root, where the hair is thickest.
const tail = {
  strands: 56,
  beads: 36, // per strand
  locks: 7, // locks the strands gather into
  dock: 0.07, // the dock's length, share of the width
  dockWidth: 22, // px: how thick it is at the root; it tapers to half
  dockDots: 350,
  lift: 0.45, // rad the dock rises at from level
  arch: 0.7, // rad it curves back down by its end
  stride: 28, // frames per stride of the gallop
  bob: 5, // px the dock bobs with each stride
  swish: 0.1, // rad it swings with each stride
  fan: 0.12, // how far the plume spreads either side, share of the height
  lengths: [0.55, 1.1], // hair lengths, share of the way to the right edge;
  //                       waves and gravity take up some, so over 1 to reach it
  pull: 0.04, // how hard a bead is drawn towards its place, at the root
  tipPull: 0.15, // share of that pull left at the tip, so the ends swing free
  gravity: 0.15, // px per frame per frame
  calm: 0.96, // share of its speed a bead keeps each frame
  wave: 0.05, // how far the slow wave swings the end, share of the height
  waves: 1.4, // slow waves along the tail at once
  waveSpeed: 0.012, // slow waves per frame running down the tail
  strideWave: 0.02, // how far each stride's wave swings the end, share of the height
  ripple: 0.008, // each strand's own ripple, share of the height
  wisps: 0.12, // share of the strands that are loose wisps
  sag: 0.08, // how far below the cursor's height the end hangs, share of the height
  endWander: 0.15, // how far the end wanders up and down, share of the height
  stiffness: 3, // passes per frame that keep each strand its length
};

let tailX = new Float32Array(0); // bead positions, strand after strand
let tailY = new Float32Array(0);
let tailPrevX = new Float32Array(0);
let tailPrevY = new Float32Array(0);
let tailStrands = []; // see startTail
let tailLockOffsets = [];
let tailLockPhases = [];
let tailDockU = new Float32Array(0); // each dock dot: how far along, and across
let tailDockV = new Float32Array(0);
let tailBeads = 0; // the bead count the arrays were made for
let tailTime = 0;
let tailEndY = 0;
let tailDockLength = 0;
let tailHairLength = 0; // the guide beyond the dock, eased

// The guide, sampled: along the dock, then from its end through the cursor to
// the right edge.
const TAIL_DOCK = 16;
const TAIL_HALF = 64;
const TAIL_POINTS = TAIL_DOCK + 2 * TAIL_HALF + 1;
const tailGuideX = new Float32Array(TAIL_POINTS);
const tailGuideY = new Float32Array(TAIL_POINTS);
const tailGuideL = new Float32Array(TAIL_POINTS); // length so far

function tailCursor() {
  const w = canvas.width;
  const h = canvas.height;
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  return {
    x: w * (0.55 + 0.15 * Math.sin(tailTime * 0.0021)),
    y: h * (0.5 + 0.2 * Math.sin(tailTime * 0.0033 + 1)),
  };
}

// One half of the hair's line: a Hermite curve from (ax, ay) heading (am) to
// (bx, by) heading (bm), into samples from index `from`.
function tailHalf(from, ax, ay, amx, amy, bx, by, bmx, bmy) {
  for (let k = 0; k <= TAIL_HALF; k++) {
    const s = k / TAIL_HALF;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    tailGuideX[from + k] = h00 * ax + h10 * amx + h01 * bx + h11 * bmx;
    tailGuideY[from + k] = h00 * ay + h10 * amy + h01 * by + h11 * bmy;
  }
}

function tailGuide() {
  const w = canvas.width;
  const h = canvas.height;
  const stride = (Math.PI * 2 * tailTime) / Math.max(1, tail.stride);

  // The dock: raised, arching over, bobbing and swishing with the stride.
  tailDockLength = tail.dock * w;
  const step = tailDockLength / TAIL_DOCK;
  const swing = tail.swish * Math.sin(stride);
  let x = 0;
  let y = h / 2 + tail.bob * Math.sin(stride + 0.6);
  let angle = -tail.lift + swing;
  for (let k = 0; k <= TAIL_DOCK; k++) {
    tailGuideX[k] = x;
    tailGuideY[k] = y;
    angle = -tail.lift + swing + (tail.arch * k) / TAIL_DOCK;
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
  }

  // The hair's line, out of the dock the way it points, through the cursor.
  const dx = tailGuideX[TAIL_DOCK];
  const dy = tailGuideY[TAIL_DOCK];
  const c = tailCursor();
  const cursor = { x: Math.max(dx + 30, c.x), y: c.y };
  const wanted =
    cursor.y + (h / 2 - cursor.y) * 0.4 + tail.sag * h + tail.endWander * h * Math.sin(tailTime * 0.004);
  if (tailTime <= 1) tailEndY = wanted;
  tailEndY += (wanted - tailEndY) * 0.02;
  tailEndY = Math.min(h * 0.95, Math.max(h * 0.05, tailEndY));
  const end = { x: w, y: tailEndY };

  const d1 = Math.hypot(cursor.x - dx, cursor.y - dy);
  const d2 = Math.hypot(end.x - cursor.x, end.y - cursor.y);
  const in1x = (cursor.x - dx) / (d1 || 1);
  const in1y = (cursor.y - dy) / (d1 || 1);
  const in2x = (end.x - cursor.x) / (d2 || 1);
  const in2y = (end.y - cursor.y) / (d2 || 1);
  let mx = in1x + in2x;
  let my = in1y + in2y;
  const md = Math.hypot(mx, my) || 1;
  mx /= md;
  my /= md;
  tailHalf(TAIL_DOCK, dx, dy, Math.cos(angle) * d1, Math.sin(angle) * d1, cursor.x, cursor.y, mx * d1, my * d1);
  tailHalf(TAIL_DOCK + TAIL_HALF, cursor.x, cursor.y, mx * d2, my * d2, end.x, end.y, in2x * d2, in2y * d2);

  tailGuideL[0] = 0;
  for (let k = 1; k < TAIL_POINTS; k++) {
    tailGuideL[k] =
      tailGuideL[k - 1] + Math.hypot(tailGuideX[k] - tailGuideX[k - 1], tailGuideY[k] - tailGuideY[k - 1]);
  }
  tailDockLength = tailGuideL[TAIL_DOCK];
}

// The point `along` px down the guide, and the guide's normal there, into
// tailAt. Past the end it carries on straight.
const tailAt = { x: 0, y: 0, nx: 0, ny: 0 };
function tailLookup(along) {
  const last = TAIL_POINTS - 1;
  let lo = 0;
  let hi = last;
  if (along >= tailGuideL[last]) {
    lo = last - 1;
  } else {
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tailGuideL[mid] <= along) lo = mid;
      else hi = mid;
    }
  }
  hi = lo + 1;
  let tx = tailGuideX[hi] - tailGuideX[lo];
  let ty = tailGuideY[hi] - tailGuideY[lo];
  const seg = Math.hypot(tx, ty);
  if (seg > 1e-6) {
    tx /= seg;
    ty /= seg;
  } else {
    tx = 1;
    ty = 0;
  }
  const into = along - tailGuideL[lo];
  tailAt.x = tailGuideX[lo] + tx * into;
  tailAt.y = tailGuideY[lo] + ty * into;
  tailAt.nx = -ty;
  tailAt.ny = tx;
}

// How thick the dock is `u` of the way along it.
function tailDockWidth(u) {
  return tail.dockWidth * (1 - 0.5 * Math.min(1, u));
}

// Where bead i of strand j wants to be, into tailAt.
function tailPlace(j, i, beads) {
  const h = canvas.height;
  const strand = tailStrands[j];
  const along = strand.root * tailDockLength + (i / (beads - 1)) * strand.length;
  tailLookup(along);
  // s: how far out along the hair, from the end of the dock.
  const s = Math.max(0, (along - tailDockLength) / (tailHairLength || 1));
  const onDock = Math.min(1, along / (tailDockLength || 1));
  const lock = strand.lock;
  const spread = 1 - (1 - Math.min(1, s / 0.5)) ** 2;
  const stride = (Math.PI * 2 * tailTime) / Math.max(1, tail.stride);
  const off =
    // Across the dock where it grows, giving way to its place in the plume.
    strand.across * (tailDockWidth(onDock) / 2) * Math.max(0, 1 - s * 4) +
    tail.fan * h * spread * (tailLockOffsets[lock] + 0.4 * strand.offset) +
    tail.wave * h * Math.pow(s, 1.3) *
      Math.sin(Math.PI * 2 * (tail.waves * s - tail.waveSpeed * tailTime) + tailLockPhases[lock]) +
    tail.strideWave * h * s * Math.sin(Math.PI * 2 * s - stride + tailLockPhases[lock] * 0.5) +
    tail.ripple * strand.loose * h * s *
      Math.sin(Math.PI * 2 * (tail.waves * 4 * s - tail.waveSpeed * 2.7 * tailTime) + strand.phase);
  tailAt.x += tailAt.nx * off;
  tailAt.y += tailAt.ny * off;
}

function startTail() {
  const n = whiteElements.length;
  const strands = Math.max(1, Math.round(tail.strands));
  const beads = Math.max(3, Math.round(tail.beads));
  const locks = Math.max(1, Math.round(tail.locks));
  tailTime = 0;
  tailBeads = beads;
  tailLockOffsets = [];
  tailLockPhases = [];
  for (let k = 0; k < locks; k++) {
    const even = locks > 1 ? (k / (locks - 1)) * 2 - 1 : 0;
    tailLockOffsets.push(even + (Math.random() - 0.5) * (1 / locks));
    tailLockPhases.push((Math.random() - 0.5) * 1.6);
  }
  tailGuide();
  tailHairLength = tailGuideL[TAIL_POINTS - 1] - tailDockLength;
  tailStrands = [];
  for (let j = 0; j < strands; j++) {
    const lock = j % locks;
    const wisp = Math.random() < tail.wisps;
    // The middle locks are longest, so the plume tapers.
    const middle = 1 - Math.abs(tailLockOffsets[lock]) * 0.6;
    const spread = tail.lengths[1] - tail.lengths[0];
    tailStrands.push({
      lock,
      // Hair grows all along the dock, more of it towards the end.
      root: Math.sqrt(Math.random()),
      across: Math.random() * 2 - 1,
      offset: (Math.random() * 2 - 1) * (wisp ? 1.8 : 1),
      share: tail.lengths[0] + spread * middle * (0.7 + 0.3 * Math.random()),
      length: 0,
      phase: Math.random() * Math.PI * 2,
      loose: wisp ? 3 : 0.6 + Math.random() * 0.8, // how much it ripples
      pull: wisp ? 0.5 : 1,
      stagger: Math.random(),
    });
  }
  const total = strands * beads;
  tailX = new Float32Array(total);
  tailY = new Float32Array(total);
  tailPrevX = new Float32Array(total);
  tailPrevY = new Float32Array(total);
  for (let j = 0; j < strands; j++) {
    const strand = tailStrands[j];
    strand.length = (1 - strand.root) * tailDockLength + strand.share * tailHairLength;
    for (let i = 0; i < beads; i++) {
      tailPlace(j, i, beads);
      const b = j * beads + i;
      tailX[b] = tailPrevX[b] = tailAt.x;
      tailY[b] = tailPrevY[b] = tailAt.y;
    }
  }
  const dockDots = Math.min(n, Math.max(0, Math.round(tail.dockDots)));
  tailDockU = new Float32Array(dockDots);
  tailDockV = new Float32Array(dockDots);
  for (let k = 0; k < dockDots; k++) {
    tailDockU[k] = Math.random();
    tailDockV[k] = Math.random() * 2 - 1;
  }
}

// Catmull-Rom through the beads of a strand, at f beads along, into tailAt.
function tailCurve(base, beads, f) {
  const i = Math.min(beads - 2, Math.max(0, Math.floor(f)));
  const t = f - i;
  const i0 = base + Math.max(0, i - 1);
  const i1 = base + i;
  const i2 = base + i + 1;
  const i3 = base + Math.min(beads - 1, i + 2);
  const t2 = t * t;
  const t3 = t2 * t;
  tailAt.x =
    0.5 *
    (2 * tailX[i1] +
      (tailX[i2] - tailX[i0]) * t +
      (2 * tailX[i0] - 5 * tailX[i1] + 4 * tailX[i2] - tailX[i3]) * t2 +
      (3 * tailX[i1] - tailX[i0] - 3 * tailX[i2] + tailX[i3]) * t3);
  tailAt.y =
    0.5 *
    (2 * tailY[i1] +
      (tailY[i2] - tailY[i0]) * t +
      (2 * tailY[i0] - 5 * tailY[i1] + 4 * tailY[i2] - tailY[i3]) * t2 +
      (3 * tailY[i1] - tailY[i0] - 3 * tailY[i2] + tailY[i3]) * t3);
}

function stepTail() {
  const beads = tailBeads;
  const strands = tailStrands.length;
  tailTime++;
  tailGuide();
  // Eased, so the hair does not jump in length when the cursor does.
  tailHairLength += (tailGuideL[TAIL_POINTS - 1] - tailDockLength - tailHairLength) * 0.05;

  for (let j = 0; j < strands; j++) {
    const strand = tailStrands[j];
    strand.length = (1 - strand.root) * tailDockLength + strand.share * tailHairLength;
    const rest = strand.length / (beads - 1);
    const base = j * beads;
    // The root is held where it grows on the dock.
    tailPlace(j, 0, beads);
    tailX[base] = tailPrevX[base] = tailAt.x;
    tailY[base] = tailPrevY[base] = tailAt.y;
    for (let i = 1; i < beads; i++) {
      const b = base + i;
      tailPlace(j, i, beads);
      const pull = tail.pull * strand.pull * (1 - (1 - tail.tipPull) * (i / (beads - 1)));
      const vx = (tailX[b] - tailPrevX[b]) * tail.calm;
      const vy = (tailY[b] - tailPrevY[b]) * tail.calm;
      tailPrevX[b] = tailX[b];
      tailPrevY[b] = tailY[b];
      tailX[b] += vx + (tailAt.x - tailX[b]) * pull;
      tailY[b] += vy + (tailAt.y - tailY[b]) * pull + tail.gravity;
    }
    // Each link back to its length; the root does not give.
    for (let pass = 0; pass < tail.stiffness; pass++) {
      for (let i = 1; i < beads; i++) {
        const a = base + i - 1;
        const b = base + i;
        const dx = tailX[b] - tailX[a];
        const dy = tailY[b] - tailY[a];
        const d = Math.hypot(dx, dy) || 1e-6;
        const fix = (d - rest) / d;
        if (i === 1) {
          tailX[b] -= dx * fix;
          tailY[b] -= dy * fix;
        } else {
          tailX[a] += dx * fix * 0.5;
          tailY[a] += dy * fix * 0.5;
          tailX[b] -= dx * fix * 0.5;
          tailY[b] -= dy * fix * 0.5;
        }
      }
    }
  }

  const n = whiteElements.length;
  let next = 0;
  // The dock, solid.
  for (let k = 0; k < tailDockU.length; k++) {
    const u = tailDockU[k];
    tailLookup(u * tailDockLength);
    const across = (tailDockV[k] * tailDockWidth(u)) / 2;
    whiteElements[next].x = tailAt.x + tailAt.nx * across;
    whiteElements[next].y = tailAt.y + tailAt.ny * across;
    next++;
  }
  // Dots along each strand, bunched towards the root and a little staggered
  // so strands do not line up.
  const each = strands ? Math.floor((n - next) / strands) : 0;
  for (let j = 0; j < strands; j++) {
    const base = j * beads;
    const stagger = tailStrands[j].stagger;
    for (let k = 0; k < each; k++) {
      const u = Math.pow((k + stagger) / each, 1.3);
      tailCurve(base, beads, u * (beads - 1));
      whiteElements[next].x = tailAt.x;
      whiteElements[next].y = tailAt.y;
      next++;
    }
  }
  for (; next < n; next++) {
    whiteElements[next].x = -100;
    whiteElements[next].y = -100;
  }
}

registerBackground("tail", {
  start: startTail,
  step: stepTail,
  settings: tail,
  archived: true,
});
