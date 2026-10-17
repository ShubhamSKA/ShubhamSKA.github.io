// The lava lamp background. Loaded after infinity.js and shared.js.

// ---- Lava lamp -------------------------------------------------------------
// Every dot is a drop of wax with a temperature of its own. The wax is a sticky
// liquid (Clavet et al.'s double density relaxation, as in the archived pool:
// too crowded pushes apart, too sparse pulls together), so it gathers in
// blobs that stretch, neck and pinch off, and merge again when they touch,
// rather than keeping any shape for long. Heat seeps between neighbouring
// drops, so a blob warms and cools as one. Only some of the dots are wax, so
// the lamp is not too full; the rest wait out of sight.
// With the cursor on the page the lamp is turned inside out round it: the
// cursor is the warm bulb, every edge of the screen is cold, and "down" is
// towards the cursor. Cold wax falls in towards the cursor, warms there, grows
// light and floats back out to the edges, cools and falls in again, so there
// are always blobs on their way to it. Without a cursor it is an ordinary
// lamp: a bulb under the middle of the floor, wax rising up the middle and
// sinking down the sides. (A heater along the whole floor lifted the wax as
// one sheet that floated level instead of turning over.)
const lava = {
  wax: 0.5, // share of the dots that are wax
  radius: 13, // px: how far stickiness and pressure reach
  restDensity: 3.5, // how crowded the wax likes to be; it clumps towards this
  stiffness: 0.35,
  nearStiffness: 0.9, // short-range push that stops drops stacking up
  maxPush: 1.2, // px per neighbour per frame
  // How hard wax may pull its neighbours in, per neighbour per frame. Kept
  // well under the push: at full strength a thin thread of wax holds itself
  // together as firmly as a blob does, and the wax linked up into one long
  // chain instead of pinching off into blobs.
  stick: 0.03,
  gravity: 0.05, // px per frame per frame on cold wax
  lift: 0.11, // px per frame per frame of buoyancy on fully warm wax
  heat: 0.03, // warmth per frame at the very bottom
  heatBand: 0.12, // share of the height the heater reaches
  heatWidth: 0.25, // how wide the bulb's warmth spreads, share of the width
  cool: 0.001, // warmth lost per frame, everywhere
  coolTop: 0.006, // extra loss per frame at the very top
  conduct: 0.04, // how fast warmth evens out between neighbours
  viscosity: 0.06, // how much drops move with their neighbours
  drag: 0.985,
  maxSpeed: 4,
  cursorHeat: 0.04, // warmth per frame right at the cursor
  cursorReach: 110, // px: how far the cursor's warmth reaches
  edgeCold: 0.02, // warmth lost per frame right at an edge of the screen
  edgeBand: 0.15, // share of the shorter side the edges' cold reaches
  maxNeighbours: 24,
};

const lavaGrid = makeGrid();
let lavaWarmth = new Float32Array(0);
let lavaPrevX = new Float32Array(0);
let lavaPrevY = new Float32Array(0);
let lavaSortedWarmth = new Float32Array(0); // warmth in grid order, this frame
const lavaNeighbour = new Int32Array(64);
const lavaCloseness = new Float32Array(64);

function startLava() {
  const n = whiteElements.length;
  lavaWarmth = new Float32Array(n);
  lavaPrevX = new Float32Array(n);
  lavaPrevY = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    whiteElements[i].vx = 0;
    whiteElements[i].vy = 0;
    lavaWarmth[i] = Math.random() * 0.3; // cold: it pours down into the pool first
  }
}

function stepLava() {
  loadDots();
  const n = Math.min(whiteElements.length, Math.round(whiteElements.length * lava.wax));
  const w = canvas.width;
  const h = canvas.height;
  const R = lava.radius;
  const R2 = R * R;
  const band = lava.edgeBand * Math.min(w, h);

  // Warmth, buoyancy and a step forward.
  for (let i = 0; i < n; i++) {
    const x = posX[i];
    const y = posY[i];
    let warm = lavaWarmth[i] - lava.cool;
    // Which way is down, as a unit vector.
    let downX = 0;
    let downY = 1;
    if (cursorOnPage) {
      const dx = cursorPosition.x - x;
      const dy = cursorPosition.y - y;
      const d = Math.hypot(dx, dy);
      if (d < lava.cursorReach) warm += lava.cursorHeat * (1 - d / lava.cursorReach);
      const edge = Math.min(x, w - x, y, h - y);
      if (edge < band) warm -= lava.edgeCold * (1 - edge / band);
      // Right at the cursor there is no down to speak of.
      if (d > 4) {
        downX = dx / d;
        downY = dy / d;
      } else {
        downY = 0;
      }
    } else {
      const depth = y / h; // 1 at the bottom
      const inHeat = (depth - (1 - lava.heatBand)) / lava.heatBand;
      if (inHeat > 0) {
        const across = (x - w / 2) / (lava.heatWidth * w);
        warm += lava.heat * Math.min(1, inHeat) * Math.exp(-across * across);
      }
      warm -= lava.coolTop * (1 - depth) * (1 - depth);
    }
    lavaWarmth[i] = Math.min(1, Math.max(0, warm));

    const weight = lava.gravity - lava.lift * lavaWarmth[i];
    let vx = velX[i] * lava.drag + downX * weight;
    let vy = velY[i] * lava.drag + downY * weight;
    const v = Math.hypot(vx, vy);
    if (v > lava.maxSpeed) {
      vx *= lava.maxSpeed / v;
      vy *= lava.maxSpeed / v;
    }
    velX[i] = vx;
    velY[i] = vy;
    lavaPrevX[i] = posX[i];
    lavaPrevY[i] = y;
    posX[i] += vx;
    posY[i] = y + vy;
  }

  // Stickiness and pressure, warmth seeping and velocities evening out, all on
  // the grid-sorted copies.
  fillGrid(lavaGrid, R, w, h, n);
  const { cols, rows, start, slot, x: X, y: Y, vx: VX, vy: VY } = lavaGrid;
  // Warmth sorted the same way as the dots.
  if (lavaSortedWarmth.length !== n) lavaSortedWarmth = new Float32Array(n);
  const warmth = lavaSortedWarmth;
  for (let i = 0; i < n; i++) warmth[slot[i]] = lavaWarmth[i];
  const cap = Math.min(lava.maxNeighbours, lavaNeighbour.length);
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
        lavaNeighbour[found] = j;
        lavaCloseness[found] = q;
        if (++found >= cap) break search;
      }
    }
    if (!found) continue;
    const pressure = lava.stiffness * (density - lava.restDensity);
    const nearPressure = lava.nearStiffness * nearDensity;
    let selfX = 0;
    let selfY = 0;
    let warmSum = 0;
    let vxSum = 0;
    let vySum = 0;
    for (let f = 0; f < found; f++) {
      const j = lavaNeighbour[f];
      const q = lavaCloseness[f];
      const dx = X[j] - ax;
      const dy = Y[j] - ay;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      let push = (pressure * q + nearPressure * q * q) / 2;
      if (push > lava.maxPush) push = lava.maxPush;
      else if (push < -lava.stick) push = -lava.stick;
      const ux = (dx / d) * push;
      const uy = (dy / d) * push;
      X[j] += ux;
      Y[j] += uy;
      selfX -= ux;
      selfY -= uy;
      warmSum += warmth[j];
      vxSum += VX[j];
      vySum += VY[j];
    }
    X[k] = ax + selfX;
    Y[k] = ay + selfY;
    warmth[k] += (warmSum / found - warmth[k]) * lava.conduct;
    VX[k] += (vxSum / found - VX[k]) * lava.viscosity;
    VY[k] += (vySum / found - VY[k]) * lava.viscosity;
  }

  // The glass; velocity is what the step actually did, nudged by the
  // neighbours' average.
  for (let i = 0; i < n; i++) {
    const k = slot[i];
    const x = Math.min(w - 1, Math.max(1, X[k]));
    const y = Math.min(h - 1, Math.max(1, Y[k]));
    const e = whiteElements[i];
    e.vx = x - lavaPrevX[i] + (VX[k] - velX[i]);
    e.vy = y - lavaPrevY[i] + (VY[k] - velY[i]);
    e.x = x;
    e.y = y;
    lavaWarmth[i] = warmth[k];
  }
  // The dots that are not wax wait out of sight.
  for (let i = n; i < whiteElements.length; i++) {
    whiteElements[i].x = -100;
    whiteElements[i].y = -100;
  }
}

registerBackground("lava", {
  start: startLava,
  step: stepLava,
  settings: lava,
});
