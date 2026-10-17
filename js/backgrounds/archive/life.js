// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. It used to be played from the front with a Life
// button; on the dev page it runs like any background. Loaded after
// infinity.js.

// ---- Life ------------------------------------------------------------------
// A moving Game of Life. The dots carry on tracing the pattern exactly as
// before, and on top of that, every few frames, each dot on the curve looks at
// how far out its nth nearest neighbour is: inside the survival band it lives,
// outside it (too crowded or too lonely) it dies. The band is measured against
// the typical distance on the curve right now, because that differs fifteenfold
// between patterns (the heart packs its dots much tighter than the
// harmonograph), so no one radius in pixels could suit them all. A dead dot is
// reborn somewhere random on the screen and rushes back to its place on the
// curve like any other; until it gets there it is out of the game, or it would
// die of loneliness on the way, every time. Only a few percent die in one
// generation, picked at random from those that fail, so the pattern frays
// rather than bursting. The mouse pulls: dots near it are drawn in off their
// paths.
const life = {
  on: false,
  radius: 1, // scales the band, in typical distances
  nth: 3, // which neighbour to measure to
  surviveBand: [0.6, 1.6], // nth neighbour this far out, in radii, to live
  rush: 2, // extra steps a reborn dot takes towards its place each frame
  turnover: 0.03, // most of the dots that may die in one generation
  arrived: 1, // dot spacings from its target: back in the game
  pull: { reach: 6, strength: 1 }, // dot spacings; px per frame at the cursor
  every: 5, // frames per generation
  frame: 0,
  generation: 0,
  away: new Uint8Array(0), // 1 while a reborn dot is on its way back
  typical: 0, // px: median nth-neighbour distance of the dots on the curve
  distance: new Float32Array(0), // each dot's, this generation
};

// The dots, one search radius to a cell, rebuilt every generation.
const lifeGrid = {
  size: 1,
  cols: 1,
  rows: 1,
  start: new Int32Array(0),
  cell: new Int32Array(0),
  x: new Float32Array(0),
  y: new Float32Array(0),
  index: new Int32Array(0),
};
const lifeBest = new Float32Array(16);

function lifeSpacing() {
  return Math.sqrt((canvas.width * canvas.height) / whiteElements.length);
}

function startLife() {
  life.away = new Uint8Array(whiteElements.length);
  life.distance = new Float32Array(whiteElements.length);
  life.typical = 0;
  life.on = true;
  life.frame = 0;
  life.generation = 0;
}

function stopLife() {
  life.on = false;
}

function buildLifeGrid(size) {
  const n = whiteElements.length;
  const g = lifeGrid;
  g.size = size;
  g.cols = Math.max(1, Math.ceil(canvas.width / size));
  g.rows = Math.max(1, Math.ceil(canvas.height / size));
  const cells = g.cols * g.rows;
  if (g.start.length !== cells + 1) g.start = new Int32Array(cells + 1);
  if (g.x.length !== n) {
    g.cell = new Int32Array(n);
    g.x = new Float32Array(n);
    g.y = new Float32Array(n);
    g.index = new Int32Array(n);
  }
  const start = g.start;
  start.fill(0);
  for (let i = 0; i < n; i++) {
    const e = whiteElements[i];
    const cx = Math.min(g.cols - 1, Math.max(0, Math.floor(e.x / size)));
    const cy = Math.min(g.rows - 1, Math.max(0, Math.floor(e.y / size)));
    g.cell[i] = cy * g.cols + cx;
    start[g.cell[i] + 1]++;
  }
  for (let c = 0; c < cells; c++) start[c + 1] += start[c];
  for (let c = 0; c < cells; c++) start[c] = start[c + 1];
  for (let i = n - 1; i >= 0; i--) {
    const k = --start[g.cell[i]];
    g.x[k] = whiteElements[i].x;
    g.y[k] = whiteElements[i].y;
    g.index[k] = i;
  }
}

// Distance from dot i to its nth nearest neighbour, or Infinity if that is
// further than the grid reaches.
function nthNeighbour(i) {
  const g = lifeGrid;
  const x = whiteElements[i].x;
  const y = whiteElements[i].y;
  const reach2 = g.size * g.size;
  const nth = Math.min(life.nth, lifeBest.length);
  let found = 0;
  const cx0 = Math.min(g.cols - 1, Math.max(0, Math.floor(x / g.size)));
  const cy0 = Math.min(g.rows - 1, Math.max(0, Math.floor(y / g.size)));
  const left = Math.max(0, cx0 - 1);
  const right = Math.min(g.cols - 1, cx0 + 1);
  for (let gy = Math.max(0, cy0 - 1); gy <= Math.min(g.rows - 1, cy0 + 1); gy++) {
    const end = g.start[gy * g.cols + right + 1];
    for (let k = g.start[gy * g.cols + left]; k < end; k++) {
      if (g.index[k] === i) continue;
      const dx = g.x[k] - x;
      const dy = g.y[k] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach2) continue;
      // Keep the nth smallest so far, in order.
      if (found < nth || d2 < lifeBest[nth - 1]) {
        let slot = found < nth ? found++ : nth - 1;
        while (slot > 0 && lifeBest[slot - 1] > d2) {
          lifeBest[slot] = lifeBest[slot - 1];
          slot--;
        }
        lifeBest[slot] = d2;
      }
    }
  }
  return found >= nth ? Math.sqrt(lifeBest[nth - 1]) : Infinity;
}

function lifeGeneration() {
  const n = whiteElements.length;
  const spacing = lifeSpacing();
  const band = life.surviveBand;
  // Look far enough to judge by last generation's measure, and never less
  // than a couple of pixels.
  const radius = life.radius * (life.typical || spacing);
  buildLifeGrid(Math.max(2, radius * band[1] * 1.5));
  const arrived2 = (life.arrived * spacing) ** 2;

  // Measure everyone on the curve first, then judge them against the median.
  const onCurve = [];
  for (let i = 0; i < n; i++) {
    const e = whiteElements[i];
    if (life.away[i]) {
      const dx = e.x - e.targetX;
      const dy = e.y - e.targetY;
      if (dx * dx + dy * dy > arrived2) continue;
      life.away[i] = 0;
    }
    life.distance[i] = nthNeighbour(i);
    onCurve.push(i);
  }
  const measured = onCurve
    .map(function (i) {
      return life.distance[i];
    })
    .filter(isFinite)
    .sort(function (a, b) {
      return a - b;
    });
  if (measured.length) life.typical = measured[measured.length >> 1];
  const unit = life.radius * (life.typical || spacing);

  const dies = [];
  for (const i of onCurve) {
    const d = life.distance[i] / unit;
    if (d < band[0] || d > band[1]) dies.push(i);
  }

  // Who goes is drawn at random from those that fail.
  const moves = Math.min(dies.length, Math.ceil(n * life.turnover));
  for (let m = 0; m < moves; m++) {
    const k = m + Math.floor(Math.random() * (dies.length - m));
    const i = dies[k];
    dies[k] = dies[m];
    const e = whiteElements[i];
    e.x = Math.random() * canvas.width;
    e.y = Math.random() * canvas.height;
    life.away[i] = 1;
  }
  life.generation++;
}

// Runs after the dots have taken their step along the curve this frame.
function tickLife() {
  life.frame++;
  // The reborn rush home: a few more steps towards their place.
  for (let i = 0; i < whiteElements.length; i++) {
    if (!life.away[i]) continue;
    const e = whiteElements[i];
    for (let s = 0; s < life.rush; s++) {
      const step = moveTowardsTarget(e.x, e.y, e.targetX, e.targetY, speed);
      e.x = step.x;
      e.y = step.y;
    }
  }
  if (cursorOnPage) {
    const spacing = lifeSpacing();
    const reach = life.pull.reach * spacing;
    const reach2 = reach * reach;
    for (let i = 0; i < whiteElements.length; i++) {
      const e = whiteElements[i];
      const dx = e.x - cursorPosition.x;
      const dy = e.y - cursorPosition.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach2 || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const shift = Math.min(d, life.pull.strength * (1 - d / reach));
      e.x -= (dx / d) * shift;
      e.y -= (dy / d) * shift;
    }
  }
  if (life.frame % life.every === 0) lifeGeneration();
}

registerBackground("life", {
  start: startLife,
  // Life plays on top of the pattern, not instead of it.
  step: function () {
    followCurve();
    tickLife();
  },
  settings: life,
  runtime: ["on", "frame", "generation", "typical"],
  archived: true,
});
