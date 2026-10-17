// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js.

// ---- Copper ------------------------------------------------------------------
// A copper tree growing in a copper salt solution, the cursor the cathode it
// grows on. The dots are copper ions, spread through the solution, wandering
// at random (Brownian motion) and drifting a little towards the cathode in
// its field. An ion that bumps into the copper registers a hit on the spot
// beside it and is used up there, and a fresh ion comes into the solution
// somewhere well away from the copper, so the solution round the copper stays
// thin, as it does round a real cathode. Once a spot has been hit a few times
// it plates out as copper, and the ion that made the last hit is held there.
// Counting hits smooths out the randomness of single ions (noise-reduced
// diffusion-limited aggregation), so instead of a fuzzy fractal the copper
// grows as a dendrite on the square lattice of its crystal: straight arms
// along its axes, with side branches at right angles. Tips reach furthest into
// the solution and catch the most ions, so they grow fastest and shade the
// gaps between them. When the cursor moves well away, a fresh crystal starts
// on the cursor, and the old one dissolves back into the solution, its newest
// copper first, ion by ion. When the copper has taken a good share of the ions
// and the cursor has not moved, it dies where it stands: it dissolves from its
// tips back to its seed, with the current off, so nothing plates and the ions
// spread back out through the solution rather than crowd in; only once it is all
// gone does a fresh crystal start on the cursor, from nothing, where the old
// one's core was, so the cathode is not left bare. The ions take many small steps a
// frame; ions well clear of the copper take them as one jump with the same
// spread and drift, which is far quicker and comes to the same.
const copper = {
  cell: 2, // px: the crystal lattice
  hits: 3, // hits a spot takes before it plates out
  steps: 50, // lattice steps an ion takes per frame
  drift: 0.05, // chance per step an ion steps towards the cathode rather than at
  //              random; the copper's look depends on this, its speed on steps
  most: 0.6, // share of the ions a crystal may take before it dies
  move: 90, // px the cursor moves before a fresh crystal starts on it
  dissolve: 20, // ions per frame an old or dying crystal gives back
};

let copperCols = 1;
let copperRows = 1;
let copperCell = 2; // the lattice the grids were made for
let copperSite = new Int32Array(0); // which crystal, if any, holds each spot
let copperHits = new Uint8Array(0);
let copperNear = new Uint8Array(0); // spots beside the active crystal's copper, give or
//                                     take some it has since lost; checked in full when set
let copperGX = new Int32Array(0); // each ion's spot
let copperGY = new Int32Array(0);
let copperFree = new Int32Array(0); // the ions still in solution
let copperFreeCount = 0;
let copperCrystals = []; // oldest first; { id, x, y, cathodeX, cathodeY, dots, dying }
let copperNextId = 1;
let copperReach = 0; // lattice steps from the active crystal's seed to its furthest copper
let copperRandom = 2463534242; // xorshift state: the walk needs far more random numbers than
//                                 Math.random gives cheaply

// Gives the newest copper of `crystal` back to the solution, where it stands,
// or, for a crystal dying where a fresh one will grow, well away from it: left
// there, it would all plate straight back on to the fresh one as a blob.
function copperDissolve(crystal, away) {
  const i = crystal.dots.pop();
  const s = copperGY[i] * copperCols + copperGX[i];
  copperSite[s] = 0;
  copperHits[s] = 0;
  copperFree[copperFreeCount++] = i;
  if (away) copperRelaunch(i, crystal);
}

// Ion `i` comes into the solution somewhere well clear of the active copper.
function copperRelaunch(i, crystal) {
  const clear = copperReach + 40;
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = Math.floor(Math.random() * copperCols);
    const y = Math.floor(Math.random() * copperRows);
    if (crystal && (x - crystal.x) ** 2 + (y - crystal.y) ** 2 < clear * clear && attempt < 7) continue;
    if (copperSite[y * copperCols + x]) continue;
    copperGX[i] = x;
    copperGY[i] = y;
    return;
  }
}

function copperPlace(i) {
  whiteElements[i].x = (copperGX[i] + 0.5) * copperCell;
  whiteElements[i].y = (copperGY[i] + 0.5) * copperCell;
}

function copperCathode() {
  return cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: canvas.width / 2, y: canvas.height / 2 };
}

// Takes ion `i` out of solution and plates it at its spot for `crystal`.
function copperPlate(i, crystal, freeIndex) {
  const s = copperGY[i] * copperCols + copperGX[i];
  copperSite[s] = crystal.id;
  crystal.dots.push(i);
  if (crystal === copperCrystals[copperCrystals.length - 1]) {
    if (copperGX[i] > 0) copperNear[s - 1] = 1;
    if (copperGX[i] < copperCols - 1) copperNear[s + 1] = 1;
    if (copperGY[i] > 0) copperNear[s - copperCols] = 1;
    if (copperGY[i] < copperRows - 1) copperNear[s + copperCols] = 1;
  }
  const reach = Math.hypot(copperGX[i] - crystal.x, copperGY[i] - crystal.y);
  if (crystal === copperCrystals[copperCrystals.length - 1]) copperReach = Math.max(copperReach, reach);
  copperFree[freeIndex] = copperFree[--copperFreeCount];
  copperPlace(i);
}

// A fresh crystal on the cursor, seeded with the free ion nearest it.
function copperSeed() {
  if (!copperFreeCount) return;
  const at = copperCathode();
  const sx = Math.min(copperCols - 1, Math.max(0, Math.floor(at.x / copperCell)));
  const sy = Math.min(copperRows - 1, Math.max(0, Math.floor(at.y / copperCell)));
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < copperFreeCount; k++) {
    const i = copperFree[k];
    const d = (copperGX[i] - sx) ** 2 + (copperGY[i] - sy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  const i = copperFree[best];
  // Moved onto the free spot nearest the cathode: an old crystal may still be
  // dissolving where the cursor is.
  let found = false;
  for (let r = 0; r < 40 && !found; r++) {
    for (let dy = -r; dy <= r && !found; dy++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = sx + dx;
        const y = sy + dy;
        if (x < 0 || y < 0 || x >= copperCols || y >= copperRows || copperSite[y * copperCols + x]) continue;
        copperGX[i] = x;
        copperGY[i] = y;
        found = true;
      }
    }
  }
  const crystal = {
    id: copperNextId++,
    x: copperGX[i],
    y: copperGY[i],
    cathodeX: at.x,
    cathodeY: at.y,
    dots: [],
    dying: false,
  };
  copperCrystals.push(crystal);
  copperReach = 0;
  copperNear.fill(0);
  copperPlate(i, crystal, best);
}

function startCopper() {
  const n = whiteElements.length;
  copperCell = Math.max(1, Math.round(copper.cell));
  copperCols = Math.max(1, Math.ceil(canvas.width / copperCell));
  copperRows = Math.max(1, Math.ceil(canvas.height / copperCell));
  copperSite = new Int32Array(copperCols * copperRows);
  copperHits = new Uint8Array(copperCols * copperRows);
  copperNear = new Uint8Array(copperCols * copperRows);
  copperGX = new Int32Array(n);
  copperGY = new Int32Array(n);
  copperFree = new Int32Array(n);
  copperFreeCount = 0;
  copperCrystals = [];
  copperNextId = 1;
  // The ions start spread evenly through the solution.
  for (let i = 0; i < n; i++) {
    copperRelaunch(i, null);
    copperFree[copperFreeCount++] = i;
  }
  copperSeed();
}

function stepCopper() {
  const n = whiteElements.length;
  const cols = copperCols;
  const rows = copperRows;
  let active = copperCrystals[copperCrystals.length - 1];

  // A fresh crystal when the cursor has moved off. One that has grown big
  // enough where the cursor still is dies completely first, and the fresh one
  // starts once it is gone.
  const at = copperCathode();
  const moved = !active || Math.hypot(active.cathodeX - at.x, active.cathodeY - at.y) > copper.move;
  if (moved) {
    copperSeed();
    active = copperCrystals[copperCrystals.length - 1];
  } else if (active.dots.length > copper.most * n) {
    active.dying = true;
  }
  if (active && active.dying) {
    for (let k = 0; k < copper.dissolve && active.dots.length; k++) copperDissolve(active, true);
    if (!active.dots.length) {
      copperSeed();
      active = copperCrystals[copperCrystals.length - 1];
    }
  }

  // Old crystals dissolve, newest copper first.
  let giving = copper.dissolve;
  for (let c = 0; c < copperCrystals.length - 1 && giving > 0; c++) {
    const crystal = copperCrystals[c];
    while (giving > 0 && crystal.dots.length) {
      copperDissolve(crystal);
      giving--;
    }
  }
  copperCrystals = copperCrystals.filter(function (crystal, c) {
    return crystal.dots.length || c === copperCrystals.length - 1;
  });
  if (!active) return;

  // Ions wander, drift towards the cathode, and plate out where they hit;
  // while the copper dies back, nothing plates.
  const id = active.dying ? -1 : active.id;
  const site = copperSite;
  const near = copperNear;
  const steps = Math.max(1, Math.round(copper.steps));
  // No current while the copper dies: the ions only wander.
  const drift = active.dying ? 0 : Math.max(0, Math.min(1, copper.drift));
  const driftBelow = Math.floor(drift * 4294967295);
  let rng = copperRandom;
  // An ion well clear of the copper cannot reach it this frame, so its many
  // steps are taken as one jump with the same spread and drift.
  const clear = copperReach + 3 * Math.sqrt(steps) + 4;
  const spread = Math.sqrt(steps / 2);
  for (let k = copperFreeCount - 1; k >= 0; k--) {
    const i = copperFree[k];
    let x = copperGX[i];
    let y = copperGY[i];
    let plated = false;
    const dx0 = active.x - x;
    const dy0 = active.y - y;
    if (dx0 * dx0 + dy0 * dy0 > clear * clear) {
      // Two numbers a frame per ion: Math.random is cheap enough here, and
      // the step generator's neighbouring outputs would show as stripes.
      const u1 = 1 - Math.random();
      const u2 = Math.random();
      const g = Math.sqrt(-2 * Math.log(u1)) * spread;
      const ax = dx0 < 0 ? -dx0 : dx0;
      const ay = dy0 < 0 ? -dy0 : dy0;
      const pull = (steps * drift) / (ax + ay || 1);
      const nx = Math.round(x + g * Math.cos(6.283185307 * u2) + dx0 * pull);
      const ny = Math.round(y + g * Math.sin(6.283185307 * u2) + dy0 * pull);
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !site[ny * cols + nx]) {
        copperGX[i] = nx;
        copperGY[i] = ny;
      }
      copperPlace(i);
      continue;
    }
    for (let step = 0; step < steps; step++) {
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      const u = rng >>> 0;
      let nx = x;
      let ny = y;
      if (u < driftBelow) {
        const dx = active.x - x;
        const dy = active.y - y;
        const ax = dx < 0 ? -dx : dx;
        const ay = dy < 0 ? -dy : dy;
        if ((u & 0xffff) * (ax + ay) < ax * 65536) nx += dx > 0 ? 1 : -1;
        else if (dy) ny += dy > 0 ? 1 : -1;
      } else {
        const r = u & 3;
        if (r === 0) nx++;
        else if (r === 1) nx--;
        else if (r === 2) ny++;
        else ny--;
      }
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !site[ny * cols + nx]) {
        x = nx;
        y = ny;
      }
      // Beside the copper: a hit on this spot, and copper once it has enough.
      const here = y * cols + x;
      if (!near[here] || site[here]) continue;
      const touching =
        (x > 0 && site[here - 1] === id) ||
        (x < cols - 1 && site[here + 1] === id) ||
        (y > 0 && site[here - cols] === id) ||
        (y < rows - 1 && site[here + cols] === id);
      if (touching) {
        if (++copperHits[here] >= copper.hits) {
          copperGX[i] = x;
          copperGY[i] = y;
          copperPlate(i, active, k);
          plated = true;
        } else {
          // Used up on the hit; a fresh ion comes in far away.
          copperRelaunch(i, active);
          x = copperGX[i];
          y = copperGY[i];
        }
        break;
      }
    }
    if (plated) continue;
    copperGX[i] = x;
    copperGY[i] = y;
    copperPlace(i);
  }
  copperRandom = rng >>> 0 || 2463534242;
}

registerBackground("copper", {
  start: startCopper,
  step: stepCopper,
  settings: copper,
  archived: true,
});
