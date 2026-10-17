// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js and shared.js.

// ---- Pool ------------------------------------------------------------------
// The dots as a liquid. Gravity pours them to the bottom of the screen and the
// cursor pulls the other way, lifting a bulge of liquid up after the pointer.
// Pressure is the double density relaxation of Clavet et al. (2005): each dot
// works out how crowded it is and pushes its neighbours apart by moving their
// positions directly, which stays stable at the step sizes a frame allows.
const pool = {
  radius: 14, // px: how far pressure reaches
  restDensity: 2.5, // how crowded a dot likes to be; lower spreads the liquid
  stiffness: 0.3,
  nearStiffness: 0.6, // short-range push that stops dots stacking up
  maxPush: 1.5, // px per neighbour per frame; tames the first splash
  gravity: 0.12, // px per frame per frame, downwards
  pull: 30, // the cursor: pull / distance, against gravity
  softening: 40, // px: keeps the pull finite right at the cursor
  drag: 0.98, // calms the fizz of a liquid at rest
  maxSpeed: 10,
  maxNeighbours: 24,
};
const poolGrid = makeGrid();
let prevX = new Float32Array(0);
let prevY = new Float32Array(0);
const poolNeighbour = new Int32Array(64);
const poolCloseness = new Float32Array(64);

function startPool() {
  // Let go of the curve where it is and let it pour.
  for (let i = 0; i < whiteElements.length; i++) {
    whiteElements[i].vx = 0;
    whiteElements[i].vy = 0;
  }
}

function stepPool() {
  const n = loadDots();
  const w = canvas.width;
  const h = canvas.height;
  const R = pool.radius;
  const R2 = R * R;
  if (prevX.length !== n) {
    prevX = new Float32Array(n);
    prevY = new Float32Array(n);
  }

  for (let i = 0; i < n; i++) {
    let vx = velX[i] * pool.drag;
    let vy = velY[i] * pool.drag + pool.gravity;
    if (cursorOnPage) {
      const mx = cursorPosition.x - posX[i];
      const my = cursorPosition.y - posY[i];
      const md = Math.sqrt(mx * mx + my * my);
      const pull = pool.pull / ((md + pool.softening) * (md || 1));
      vx += mx * pull;
      vy += my * pull;
    }
    const v = Math.sqrt(vx * vx + vy * vy);
    if (v > pool.maxSpeed) {
      vx *= pool.maxSpeed / v;
      vy *= pool.maxSpeed / v;
    }
    prevX[i] = posX[i];
    prevY[i] = posY[i];
    posX[i] += vx;
    posY[i] += vy;
  }

  // Relax in grid order, straight on the sorted copies, so neighbours sit
  // next to each other in memory.
  fillGrid(poolGrid, R, w, h);
  const { cols, rows, start, slot, x: X, y: Y } = poolGrid;
  const cap = Math.min(pool.maxNeighbours, poolNeighbour.length);
  const maxPush = pool.maxPush;
  for (let k = 0; k < n; k++) {
    const ax = X[k];
    const ay = Y[k];
    const cx0 = Math.min(cols - 1, Math.max(0, Math.floor(ax / R)));
    const cy0 = Math.min(rows - 1, Math.max(0, Math.floor(ay / R)));
    const left = Math.max(0, cx0 - 1);
    const right = Math.min(cols - 1, cx0 + 1);
    let density = 0;
    let nearDensity = 0;
    let found = 0;
    search: for (let gy = Math.max(0, cy0 - 1); gy <= Math.min(rows - 1, cy0 + 1); gy++) {
      const end = start[gy * cols + right + 1];
      for (let j = start[gy * cols + left]; j < end; j++) {
        if (j === k) continue;
        const dx = X[j] - ax;
        const dy = Y[j] - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R2) continue;
        const q = 1 - Math.sqrt(d2) / R;
        density += q * q;
        nearDensity += q * q * q;
        poolNeighbour[found] = j;
        poolCloseness[found] = q;
        if (++found >= cap) break search;
      }
    }
    const pressure = pool.stiffness * (density - pool.restDensity);
    const nearPressure = pool.nearStiffness * nearDensity;
    let selfX = 0;
    let selfY = 0;
    for (let f = 0; f < found; f++) {
      const j = poolNeighbour[f];
      const q = poolCloseness[f];
      const dx = X[j] - ax;
      const dy = Y[j] - ay;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      let push = (pressure * q + nearPressure * q * q) / 2;
      if (push > maxPush) push = maxPush;
      else if (push < -maxPush) push = -maxPush;
      const ux = (dx / d) * push;
      const uy = (dy / d) * push;
      X[j] += ux;
      Y[j] += uy;
      selfX -= ux;
      selfY -= uy;
    }
    X[k] = ax + selfX;
    Y[k] = ay + selfY;
  }

  // The screen edges are the walls of the tank; velocity is whatever the step
  // actually moved, so hitting a wall also stops the dot.
  for (let i = 0; i < n; i++) {
    const k = slot[i];
    const x = Math.min(w - 1, Math.max(0, X[k]));
    const y = Math.min(h - 1, Math.max(0, Y[k]));
    const e = whiteElements[i];
    e.vx = x - prevX[i];
    e.vy = y - prevY[i];
    e.x = x;
    e.y = y;
  }
}

registerBackground("pool", {
  start: startPool,
  step: stepPool,
  settings: pool,
  archived: true,
});
