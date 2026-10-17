// Helpers the dot simulations share. Loaded after infinity.js, before the
// simulations themselves.

// Each frame the dots are copied into flat arrays and counting-sorted into
// grid cells, so a dot only looks at the 3x3 block of cells around it, and each
// row of that block is one unbroken run of the sorted arrays.
function makeGrid() {
  return {
    cols: 1,
    rows: 1,
    start: new Int32Array(0), // where each cell's run begins; one extra at the end
    slot: new Int32Array(0), // where dot i landed in the sorted arrays
    cell: new Int32Array(0),
    x: new Float32Array(0),
    y: new Float32Array(0),
    vx: new Float32Array(0),
    vy: new Float32Array(0),
  };
}

// Sorts the first `count` dots (all of them by default) into the grid.
function fillGrid(grid, size, w, h, count) {
  const n = count === undefined ? posX.length : count;
  grid.cols = Math.max(1, Math.ceil(w / size));
  grid.rows = Math.max(1, Math.ceil(h / size));
  const cells = grid.cols * grid.rows;
  if (grid.start.length !== cells + 1) grid.start = new Int32Array(cells + 1);
  if (grid.slot.length !== n) {
    grid.slot = new Int32Array(n);
    grid.cell = new Int32Array(n);
    grid.x = new Float32Array(n);
    grid.y = new Float32Array(n);
    grid.vx = new Float32Array(n);
    grid.vy = new Float32Array(n);
  }
  const start = grid.start;
  start.fill(0);
  for (let i = 0; i < n; i++) {
    const cx = Math.min(grid.cols - 1, Math.max(0, Math.floor(posX[i] / size)));
    const cy = Math.min(grid.rows - 1, Math.max(0, Math.floor(posY[i] / size)));
    const c = cy * grid.cols + cx;
    grid.cell[i] = c;
    start[c + 1]++;
  }
  for (let c = 0; c < cells; c++) start[c + 1] += start[c];
  // Hand out slots from the end of each run backwards, which leaves start[c]
  // pointing at the beginning of the run again once every dot is placed.
  for (let c = 0; c < cells; c++) start[c] = start[c + 1];
  for (let i = n - 1; i >= 0; i--) {
    const k = --start[grid.cell[i]];
    grid.slot[i] = k;
    grid.x[k] = posX[i];
    grid.y[k] = posY[i];
    grid.vx[k] = velX[i];
    grid.vy[k] = velY[i];
  }
}

// Working copies of the dots in flat arrays: the inner loops run thousands of
// times a frame and object lookups were half the cost.
let posX = new Float32Array(0);
let posY = new Float32Array(0);
let velX = new Float32Array(0);
let velY = new Float32Array(0);
let nextVX = new Float32Array(0);
let nextVY = new Float32Array(0);

// Copies the dots into the flat arrays and returns how many there are.
function loadDots() {
  const n = whiteElements.length;
  if (posX.length !== n) {
    posX = new Float32Array(n);
    posY = new Float32Array(n);
    velX = new Float32Array(n);
    velY = new Float32Array(n);
    nextVX = new Float32Array(n);
    nextVY = new Float32Array(n);
  }
  for (let i = 0; i < n; i++) {
    const e = whiteElements[i];
    posX[i] = e.x;
    posY[i] = e.y;
    velX[i] = e.vx;
    velY[i] = e.vy;
  }
  return n;
}
