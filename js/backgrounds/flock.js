// The flock background. Loaded after infinity.js and shared.js.

// ---- Flock -----------------------------------------------------------------
// Boids: every dot steers by what it can see within `vision` (match heading,
// drift towards the middle of the group, keep out of each other's way). Nothing
// steers the flock as a whole except a pull back towards a point that wanders
// around the screen, which keeps it on screen and makes it swoop. The pull only
// starts outside a zone around that point: pulling everyone towards the same
// spot at every distance squeezes the flock into a knot. On a phone, a shake
// startles it: every dot turns to flee the point the phone's tilt sets.
const flock = {
  vision: 30, // px: who counts as a neighbour
  personal: 4, // px: closer than this and they push apart
  maxNeighbours: 12, // dense knots would otherwise cost n^2
  minSpeed: 1.6,
  maxSpeed: 3.2,
  alignment: 0.15,
  cohesion: 1,
  separation: 1.2,
  homing: 0.0004, // pull back into the zone, per px outside it
  gravity: 25, // the cursor's pull: gravity / distance, so it fades with range
  softening: 30, // px: keeps the pull finite when a dot passes over the cursor
  zone: 0.25, // radius of the zone, as a share of the shorter screen side
  frame: 0,
};

// Each frame the dots are counting-sorted into grid cells, so each dot only
// looks at the 3x3 block of cells around it, and each row of that block is one
// unbroken run of the sorted arrays. There are two grids: a coarse one a
// vision radius wide for heading and cohesion, and a fine one a personal space
// wide for separation. With a single coarse grid and a cap on neighbours, the
// dots a bird counted were rarely the ones touching it, so nothing kept them
// apart and the flock packed solid.
const visionGrid = makeGrid();
const personalGrid = makeGrid();

function startFlock() {
  const reach = speed * (1 / increment) * patternScale;
  for (let i = 0; i < whiteElements.length; i++) {
    const e = whiteElements[i];
    // Leave along the curve: the heading is where this dot's target was about
    // to go next.
    const ahead = graphFunctions[functionNum](t + increment + i * patternSampleStep);
    let vx = reach * ahead.x + canvas.width / 2 - e.targetX;
    let vy = reach * ahead.y + canvas.height / 2 - e.targetY;
    let v = Math.sqrt(vx * vx + vy * vy);
    if (!(v > 1e-6)) {
      const a = Math.random() * Math.PI * 2;
      vx = Math.cos(a);
      vy = Math.sin(a);
      v = 1;
    }
    e.vx = (vx / v) * 2.4;
    e.vy = (vy / v) * 2.4;
  }
}

let flockShakes = 0; // the phone's shakes already answered

function stepFlock() {
  if (phone.shakes !== flockShakes) {
    flockShakes = phone.shakes;
    for (const e of whiteElements) {
      const a = Math.atan2(e.y - cursorPosition.y, e.x - cursorPosition.x) + (Math.random() - 0.5);
      e.vx = Math.cos(a) * flock.maxSpeed;
      e.vy = Math.sin(a) * flock.maxSpeed;
    }
  }
  const n = loadDots();
  const w = canvas.width;
  const h = canvas.height;
  const R2 = flock.vision * flock.vision;
  const P = flock.personal;
  const P2 = P * P;

  fillGrid(visionGrid, flock.vision, w, h);
  fillGrid(personalGrid, P, w, h);
  // Pulled out into locals: the inner loops are hot enough that going through
  // the grid objects every time showed up in the frame time.
  const cap = flock.maxNeighbours;
  const { cols: vCols, rows: vRows, start: vStart, slot: vSlot, cell: vCell, x: vX, y: vY, vx: vVX, vy: vVY } = visionGrid;
  const { cols: pCols, rows: pRows, start: pStart, slot: pSlot, cell: pCell, x: pX, y: pY } = personalGrid;

  flock.frame++;
  const goalX = w / 2 + w * 0.3 * Math.sin(flock.frame * 0.0041);
  const goalY = h / 2 + h * 0.25 * Math.sin(flock.frame * 0.0067 + 1);
  const margin = Math.min(80, w * 0.08);
  // Any stronger and the flock settles into a slow spinning disc (a mill)
  // instead of travelling.
  const cohesion = flock.cohesion * 0.002;
  const zone = Math.min(w, h) * flock.zone;

  for (let i = 0; i < n; i++) {
    const ax = posX[i];
    const ay = posY[i];
    let vx = velX[i];
    let vy = velY[i];
    let alignX = 0, alignY = 0, centreX = 0, centreY = 0, pushX = 0, pushY = 0;
    let seen = 0;

    let self = vSlot[i];
    let cx0 = vCell[i] % vCols;
    let cy0 = (vCell[i] - cx0) / vCols;
    let left = Math.max(0, cx0 - 1);
    let right = Math.min(vCols - 1, cx0 + 1);
    search: for (let gy = Math.max(0, cy0 - 1); gy <= Math.min(vRows - 1, cy0 + 1); gy++) {
      const end = vStart[gy * vCols + right + 1];
      for (let k = vStart[gy * vCols + left]; k < end; k++) {
        if (k === self) continue;
        const dx = vX[k] - ax;
        const dy = vY[k] - ay;
        if (dx * dx + dy * dy > R2) continue;
        alignX += vVX[k];
        alignY += vVY[k];
        centreX += dx;
        centreY += dy;
        if (++seen >= cap) break search;
      }
    }

    self = pSlot[i];
    cx0 = pCell[i] % pCols;
    cy0 = (pCell[i] - cx0) / pCols;
    left = Math.max(0, cx0 - 1);
    right = Math.min(pCols - 1, cx0 + 1);
    let crowd = 0;
    crowding: for (let gy = Math.max(0, cy0 - 1); gy <= Math.min(pRows - 1, cy0 + 1); gy++) {
      const end = pStart[gy * pCols + right + 1];
      for (let k = pStart[gy * pCols + left]; k < end; k++) {
        if (k === self) continue;
        const dx = pX[k] - ax;
        const dy = pY[k] - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 >= P2) continue;
        const d = Math.sqrt(d2) || 0.01;
        // Harder the closer they are, nothing at the edge of personal space.
        const f = (1 - d / P) / d;
        pushX -= dx * f;
        pushY -= dy * f;
        if (++crowd >= cap) break crowding;
      }
    }

    if (seen > 0) {
      vx += (alignX / seen - vx) * flock.alignment;
      vy += (alignY / seen - vy) * flock.alignment;
      vx += (centreX / seen) * cohesion;
      vy += (centreY / seen) * cohesion;
    }
    vx += pushX * flock.separation;
    vy += pushY * flock.separation;

    // The wandering goal, the screen edges and the cursor's slight gravity.
    const gx = goalX - ax;
    const gy = goalY - ay;
    const gd = Math.sqrt(gx * gx + gy * gy);
    if (gd > zone) {
      const pull = ((gd - zone) / gd) * flock.homing;
      vx += gx * pull;
      vy += gy * pull;
    }
    if (ax < margin) vx += 0.12;
    else if (ax > w - margin) vx -= 0.12;
    if (ay < margin) vy += 0.12;
    else if (ay > h - margin) vy -= 0.12;
    if (cursorOnPage) {
      const mx = cursorPosition.x - ax;
      const my = cursorPosition.y - ay;
      const md = Math.sqrt(mx * mx + my * my) + flock.softening;
      const pull = flock.gravity / (md * md);
      vx += mx * pull;
      vy += my * pull;
    }
    vx += (Math.random() - 0.5) * 0.08;
    vy += (Math.random() - 0.5) * 0.08;

    const v = Math.sqrt(vx * vx + vy * vy) || 1;
    const clamped = Math.min(flock.maxSpeed, Math.max(flock.minSpeed, v));
    nextVX[i] = (vx / v) * clamped;
    nextVY[i] = (vy / v) * clamped;
  }

  // Everyone decides from the same snapshot, then moves.
  for (let i = 0; i < n; i++) {
    const e = whiteElements[i];
    e.vx = nextVX[i];
    e.vy = nextVY[i];
    e.x += e.vx;
    e.y += e.vy;
  }
}

registerBackground("flock", {
  start: startFlock,
  step: stepFlock,
  settings: flock,
  runtime: ["frame"],
});
