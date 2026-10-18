// The smoke background. Loaded after infinity.js.

// ---- Smoke -----------------------------------------------------------------
// Smoke rising from a smouldering strip along the bottom of the screen. The air
// is a coarse grid of velocities kept incompressible the usual way (Stam's
// stable fluids: carry the velocity along itself, then remove its divergence),
// with a little vorticity confinement so the curls the grid is too coarse to
// keep get put back. Warm smoke rises and spreads as it goes. The smoulder
// sits right under the cursor, following it across the screen, so the smoke
// always rises towards it; the cursor is a small hand held in the smoke, which
// the air only partly passes through, so the smoke parts round it a little and
// curls off its edges, and moving it drags the air along. The
// dots are the smoke, carried by the air; one that leaves the screen or burns
// out starts again at the source. On a phone the smoke rises the way that is
// truly up, so tipping the phone tips the plume.
const smoke = {
  cells: 64, // across; down follows the screen's shape
  rise: 0.003, // cells per frame per frame of lift where the smoke is
  plume: 0.008, // extra lift in the column straight over the source
  follow: 0.03, // how quickly the source moves under the cursor
  swirl: 0.25, // vorticity confinement
  stir: 0.12, // how much of the mouse's motion goes into the air
  stirReach: 3, // cells
  hand: 18, // px: radius of the hand the smoke goes round
  grip: 0.4, // how much of the air inside the hand moves with it, 0 to 1
  shove: 0.3, // how much of the way out of the hand smoke is pushed each frame
  // The air keeps this much of its speed each frame. Lift piles up into speed
  // until this drag balances it, so it sets how fast smoke rises far more
  // than the lift does: at 0.995 the smoke shot up at hundreds of px a second.
  fade: 0.95,
  life: 520, // frames, on average, before a dot starts again
  source: 0.35, // share of the width the smouldering strip covers
  spreading: 0.9, // px per frame of drift an old wisp has, in random directions
  passes: 16, // pressure iterations per frame
};

let smokeCols = 0;
let smokeRows = 0;
let smokeU = new Float32Array(0);
let smokeV = new Float32Array(0);
let smokeU0 = new Float32Array(0);
let smokeV0 = new Float32Array(0);
let smokeP = new Float32Array(0);
let smokeDiv = new Float32Array(0);
let smokeCurl = new Float32Array(0);
let smokeHeat = new Float32Array(0); // dots per cell, this frame
let smokeAge = new Float32Array(0);
let smokeLife = new Float32Array(0);
let smokeTime = 0;
let smokeMouse = { x: 0, y: 0 };
let smokeSourceX = 0; // the middle of the smouldering strip, in cells
let smokeHandX = 0; // where the hand was last frame
let smokeHandY = 0;

function smokeIndex(i, j) {
  return i + (smokeCols + 2) * j;
}

function smokeGrid() {
  const cols = smoke.cells;
  const rows = Math.max(8, Math.round((cols * canvas.height) / canvas.width));
  if (cols === smokeCols && rows === smokeRows) return;
  smokeCols = cols;
  smokeRows = rows;
  const size = (cols + 2) * (rows + 2);
  smokeU = new Float32Array(size);
  smokeV = new Float32Array(size);
  smokeU0 = new Float32Array(size);
  smokeV0 = new Float32Array(size);
  smokeP = new Float32Array(size);
  smokeDiv = new Float32Array(size);
  smokeCurl = new Float32Array(size);
  smokeHeat = new Float32Array(size);
}

// Walls on three sides, open at the top so smoke can leave. `kind` is "u"
// (across), "v" (down) or "p" (pressure): no flow through a wall, and no
// pressure at the open top.
function smokeWalls(field, kind) {
  const cols = smokeCols;
  const rows = smokeRows;
  const I = smokeIndex;
  for (let j = 1; j <= rows; j++) {
    field[I(0, j)] = kind === "u" ? -field[I(1, j)] : field[I(1, j)];
    field[I(cols + 1, j)] = kind === "u" ? -field[I(cols, j)] : field[I(cols, j)];
  }
  for (let i = 1; i <= cols; i++) {
    field[I(i, 0)] = kind === "p" ? 0 : field[I(i, 1)];
    field[I(i, rows + 1)] = kind === "v" ? -field[I(i, rows)] : field[I(i, rows)];
  }
}

// Bilinear sample of a field at a point in cell coordinates.
function smokeSample(field, x, y) {
  const cols = smokeCols;
  const rows = smokeRows;
  x = Math.min(cols + 0.5, Math.max(0.5, x));
  y = Math.min(rows + 0.5, Math.max(0.5, y));
  const i0 = Math.floor(x);
  const j0 = Math.floor(y);
  const s = x - i0;
  const t = y - j0;
  return (
    (1 - s) * ((1 - t) * field[smokeIndex(i0, j0)] + t * field[smokeIndex(i0, j0 + 1)]) +
    s * ((1 - t) * field[smokeIndex(i0 + 1, j0)] + t * field[smokeIndex(i0 + 1, j0 + 1)])
  );
}

// The middle of the smouldering strip, in cells; it wanders a little.
function incense() {
  return { x: smokeSourceX, y: smokeRows - 1 };
}

// The source eases towards the cursor's column, or wanders about the middle
// without one.
function moveSource() {
  const cols = smokeCols;
  const target = cursorOnPage
    ? (cursorPosition.x / canvas.width) * cols + 0.5
    : cols / 2 + 0.5 + cols * 0.06 * Math.sin(smokeTime * 0.004);
  smokeSourceX += (target - smokeSourceX) * smoke.follow;
}

function relight(k) {
  const source = incense();
  const cell = canvas.width / smokeCols;
  const e = whiteElements[k];
  const half = (smoke.source * smokeCols) / 2;
  e.x = (source.x - 0.5 + (Math.random() * 2 - 1) * half) * cell;
  e.y = (source.y - 0.5 + Math.random() * 0.8) * cell;
  smokeAge[k] = 0;
  smokeLife[k] = smoke.life * (0.5 + Math.random());
}

function startSmoke() {
  const n = whiteElements.length;
  smokeCols = 0;
  smokeGrid();
  smokeAge = new Float32Array(n);
  smokeLife = new Float32Array(n);
  // The pattern's dots drift off as smoke and are relit over the first while.
  for (let i = 0; i < n; i++) smokeLife[i] = smoke.life * Math.random();
  smokeTime = 0;
  smokeSourceX = cursorOnPage ? (cursorPosition.x / canvas.width) * smokeCols + 0.5 : smokeCols / 2 + 0.5;
  smokeMouse = { x: cursorPosition.x, y: cursorPosition.y };
}

function stepSmoke() {
  smokeGrid();
  smokeTime++;
  moveSource();
  smokeHandX = smokeMouse.x;
  smokeHandY = smokeMouse.y;
  const cols = smokeCols;
  const rows = smokeRows;
  const cell = canvas.width / cols;
  const u = smokeU;
  const v = smokeV;
  const I = smokeIndex;

  // Forces. Warm smoke rises where it is: count the dots in each cell.
  smokeHeat.fill(0);
  for (let k = 0; k < whiteElements.length; k++) {
    const i = Math.floor(whiteElements[k].x / cell) + 1;
    const j = Math.floor(whiteElements[k].y / cell) + 1;
    if (i >= 1 && i <= cols && j >= 1 && j <= rows) smokeHeat[I(i, j)]++;
  }
  const perCell = whiteElements.length / (cols * rows);
  const source = incense();
  // Lift is against gravity: straight up off a phone.
  const upX = -phone.downX;
  const upY = -phone.downY;
  for (let j = 1; j <= rows; j++) {
    for (let i = 1; i <= cols; i++) {
      const c = I(i, j);
      let lift = smoke.rise * Math.min(4, smokeHeat[c] / perCell);
      const across = Math.abs(i - source.x) / ((smoke.source * cols) / 2 + 1);
      if (across < 1) lift += smoke.plume * (1 - across) * (j / rows);
      u[c] += upX * lift;
      v[c] += upY * lift;
      u[c] *= smoke.fade;
      v[c] *= smoke.fade;
    }
  }
  // The mouse stirs the air along its path.
  if (cursorOnPage) {
    const mx = cursorPosition.x / cell + 0.5;
    const my = cursorPosition.y / cell + 0.5;
    const dx = (cursorPosition.x - smokeMouse.x) / cell;
    const dy = (cursorPosition.y - smokeMouse.y) / cell;
    const r = smoke.stirReach;
    for (let j = Math.max(1, Math.floor(my - r)); j <= Math.min(rows, Math.ceil(my + r)); j++) {
      for (let i = Math.max(1, Math.floor(mx - r)); i <= Math.min(cols, Math.ceil(mx + r)); i++) {
        const d = Math.hypot(i - mx, j - my);
        if (d > r) continue;
        const fall = 1 - d / r;
        u[I(i, j)] += dx * smoke.stir * fall;
        v[I(i, j)] += dy * smoke.stir * fall;
      }
    }
  }
  smokeMouse.x = cursorPosition.x;
  smokeMouse.y = cursorPosition.y;
  handInAir();

  // Vorticity confinement: push along the curl's gradient to keep swirls.
  for (let j = 1; j <= rows; j++) {
    for (let i = 1; i <= cols; i++) {
      smokeCurl[I(i, j)] = 0.5 * (v[I(i + 1, j)] - v[I(i - 1, j)] - u[I(i, j + 1)] + u[I(i, j - 1)]);
    }
  }
  for (let j = 2; j < rows; j++) {
    for (let i = 2; i < cols; i++) {
      const c = I(i, j);
      const nx = 0.5 * (Math.abs(smokeCurl[I(i + 1, j)]) - Math.abs(smokeCurl[I(i - 1, j)]));
      const ny = 0.5 * (Math.abs(smokeCurl[I(i, j + 1)]) - Math.abs(smokeCurl[I(i, j - 1)]));
      const len = Math.hypot(nx, ny) + 1e-5;
      u[c] += smoke.swirl * (ny / len) * smokeCurl[c];
      v[c] -= smoke.swirl * (nx / len) * smokeCurl[c];
    }
  }

  // Carry the velocity along itself (semi-Lagrangian).
  smokeU0.set(u);
  smokeV0.set(v);
  for (let j = 1; j <= rows; j++) {
    for (let i = 1; i <= cols; i++) {
      const c = I(i, j);
      const x = i - smokeU0[c];
      const y = j - smokeV0[c];
      u[c] = smokeSample(smokeU0, x, y);
      v[c] = smokeSample(smokeV0, x, y);
    }
  }
  smokeWalls(u, "u");
  smokeWalls(v, "v");
  handInAir();

  // Take out the divergence, so the air neither piles up nor thins out.
  for (let j = 1; j <= rows; j++) {
    for (let i = 1; i <= cols; i++) {
      smokeDiv[I(i, j)] = -0.5 * (u[I(i + 1, j)] - u[I(i - 1, j)] + v[I(i, j + 1)] - v[I(i, j - 1)]);
    }
  }
  smokeP.fill(0);
  for (let pass = 0; pass < smoke.passes; pass++) {
    for (let j = 1; j <= rows; j++) {
      for (let i = 1; i <= cols; i++) {
        smokeP[I(i, j)] =
          (smokeDiv[I(i, j)] + smokeP[I(i - 1, j)] + smokeP[I(i + 1, j)] + smokeP[I(i, j - 1)] + smokeP[I(i, j + 1)]) / 4;
      }
    }
    smokeWalls(smokeP, "p");
  }
  for (let j = 1; j <= rows; j++) {
    for (let i = 1; i <= cols; i++) {
      u[I(i, j)] -= 0.5 * (smokeP[I(i + 1, j)] - smokeP[I(i - 1, j)]);
      v[I(i, j)] -= 0.5 * (smokeP[I(i, j + 1)] - smokeP[I(i, j - 1)]);
    }
  }
  smokeWalls(u, "u");
  smokeWalls(v, "v");

  // The dots ride the air.
  const w = canvas.width;
  const h = canvas.height;
  for (let k = 0; k < whiteElements.length; k++) {
    const e = whiteElements[k];
    smokeAge[k]++;
    if (smokeAge[k] > smokeLife[k] || e.y < -5 || e.x < -5 || e.x > w + 5 || e.y > h + 5) {
      relight(k);
      continue;
    }
    const x = e.x / cell + 0.5;
    const y = e.y / cell + 0.5;
    // Smoke spreads as it ages.
    const drift = 0.2 + smoke.spreading * Math.min(1, smokeAge[k] / smokeLife[k]);
    e.x += smokeSample(u, x, y) * cell + (Math.random() - 0.5) * 2 * drift;
    e.y += smokeSample(v, x, y) * cell + (Math.random() - 0.5) * 2 * drift;
    // Smoke in the hand is nudged out of it, part of the way each frame.
    if (cursorOnPage) {
      const dx = e.x - cursorPosition.x;
      const dy = e.y - cursorPosition.y;
      const d = Math.hypot(dx, dy);
      if (d < smoke.hand && d > 0.01) {
        const out = (smoke.hand - d) * smoke.shove;
        e.x += (dx / d) * out;
        e.y += (dy / d) * out;
      }
    }
  }
}

// Inside the hand the air is drawn towards the hand's own motion, by `grip`;
// done before and after the divergence is taken out, so the flow bends round.
function handInAir() {
  if (!cursorOnPage) return;
  const cell = canvas.width / smokeCols;
  const cx = cursorPosition.x / cell + 0.5;
  const cy = cursorPosition.y / cell + 0.5;
  const r = smoke.hand / cell;
  const hx = (cursorPosition.x - smokeHandX) / cell;
  const hy = (cursorPosition.y - smokeHandY) / cell;
  for (let j = Math.max(1, Math.floor(cy - r)); j <= Math.min(smokeRows, Math.ceil(cy + r)); j++) {
    for (let i = Math.max(1, Math.floor(cx - r)); i <= Math.min(smokeCols, Math.ceil(cx + r)); i++) {
      if ((i - cx) ** 2 + (j - cy) ** 2 > r * r) continue;
      const c = smokeIndex(i, j);
      smokeU[c] += (hx - smokeU[c]) * smoke.grip;
      smokeV[c] += (hy - smokeV[c]) * smoke.grip;
    }
  }
}

registerBackground("smoke", {
  start: startSmoke,
  step: stepSmoke,
  settings: smoke,
});
