const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const root = document.documentElement;

// The intro plays as a full-screen overlay, then demotes itself to a faint
// background layer. Nothing is gated behind a click.
const INTRO_HOLD_MS = 2500; // how long the overlay stays opaque
const INTRO_FADE_MS = 900; // how long it takes to sink into the background
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

let introDone = false;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let currentCenterX = window.innerWidth / 2;
let currentCenterY = window.innerHeight / 2;

//ctx.imageSmoothingEnabled = false;

document.addEventListener("mousemove", handleMouseMove);
let cursorPosition = { x: 0, y: 0, prevX: 0, prevY: 0 };
const loadTime = new Date();

function handleResize() {
  const newWidth = window.innerWidth;
  const newHeight = window.innerHeight;
  
  const newCenterX = newWidth / 2;
  const newCenterY = newHeight / 2;

  const deltaX = newCenterX - currentCenterX;
  const deltaY = newCenterY - currentCenterY;

  canvas.width = newWidth;
  canvas.height = newHeight;

  for (let i = 0; i < whiteElements.length; i++) {
    whiteElements[i].x += deltaX;
    whiteElements[i].y += deltaY;
  }

  currentCenterX = newCenterX;
  currentCenterY = newCenterY;
}
window.addEventListener("resize", handleResize);
window.addEventListener("load", handleResize); 


const playButton = document.getElementById("playBackground");
const bgControls = document.getElementById("backgroundControls");
const paramPanel = document.getElementById("backgroundParam");
const paramSlider = document.getElementById("bgParamSlider");
const paramLabel = document.getElementById("bgParamLabel");
const paramValue = document.getElementById("bgParamValue");

// Set here rather than inside the intro branch so bringing the canvas back to
// the front later fades as well.
canvas.style.transition = `opacity ${INTRO_FADE_MS}ms ease, background-color ${INTRO_FADE_MS}ms ease`;

function settleIntoBackground() {
  if (introDone) return;
  introDone = true;
  canvas.classList.add("canvas--settled");
  root.classList.remove("intro-active");
  if (playButton) playButton.hidden = false;
}

// It plays on every load of the page, reloads and returns from other pages
// included; only a link straight to a section skips it.
if (prefersReducedMotion || window.location.hash) {
  settleIntoBackground();
} else {
  root.classList.add("intro-active");
  setTimeout(settleIntoBackground, INTRO_HOLD_MS);
  setTimeout(function () {
    root.classList.remove("intro-active");
  }, INTRO_HOLD_MS + INTRO_FADE_MS + 500);
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (evt) {
    window.addEventListener(evt, settleIntoBackground, { once: true, passive: true });
  });
}

function handleMouseMove(event) {
  cursorPosition.prevX = cursorPosition.x;
  cursorPosition.prevY = cursorPosition.y;
  cursorPosition.x = event.clientX;
  cursorPosition.y = event.clientY;
}

function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function moveTowardsTarget(currentX, currentY, targetX, targetY, speed) {
  const distance = calculateDistance(currentX, currentY, targetX, targetY);
  const dx = (targetX - currentX) / distance;
  const dy = (targetY - currentY) / distance;
  let newX = currentX + dx * speed;
  let newY = currentY + dy * speed;
  const distanceToCursor = calculateDistance(
    newX,
    newY,
    cursorPosition.x,
    cursorPosition.y
  );
  if (distanceToCursor < 15) {
    const avoidanceFactor = (30 - distanceToCursor) / 15;
    const avoidanceX =
      (newX -
        cursorPosition.x -
        2 * (cursorPosition.prevX - cursorPosition.x)) /
      distanceToCursor;
    const avoidanceY =
      (newY -
        cursorPosition.y -
        2 * (cursorPosition.prevY - cursorPosition.y)) /
      distanceToCursor;
    newX = currentX + avoidanceX * speed * avoidanceFactor;
    newY = currentY + avoidanceY * speed * avoidanceFactor;
  }
  return { x: newX, y: newY };
}

let whiteElements = [];
let arrivedElements = [];
let speed = 3.5;
let radiusPar=Math.random()/2;
for (let i = 0; i < 5000; i += 1) {
  const angle = 2 * Math.random() * Math.PI;
  const radius = canvas.width / 2*radiusPar;
  let whiteElementX = Math.cos(angle) * radius + canvas.width / 2;
  let whiteElementY = Math.sin(angle) * radius + canvas.height / 2;

  ctx.fillStyle = "white";
  ctx.fillRect(whiteElementX, whiteElementY, 1, 1);

  let whiteElement = {
    x: whiteElementX,
    y: whiteElementY,
    targetX: 0,
    targetY: 0,
  };

  whiteElements.push(whiteElement);
}

const graphFunctions = [
  circle,
  dunno,
  eight,
  heart,
  boomerang,
  hypocicloid,
  venusian,
  astroid,
  butterfly,
  farris,
  gielis,
  harmonograph,
];

// What extraPar means differs per curve, so each one gets its own range. These
// are continuous now: the old version quantised them to whatever the clock
// happened to read, which left eight() with only two angles and heart() with
// no parameter at all.
const parameterRanges = [
  { min: 0.55, max: 2.0, label: "Width" }, // circle: horizontal stretch
  { min: 1.5, max: 5.5, label: "Frequency" }, // dunno: lobe count
  { min: 0, max: Math.PI * 2, label: "Angle" }, // eight: rotation
  { min: 0.55, max: 1.7, label: "Size" }, // heart: scale
  { min: 2, max: 11, label: "Petals" }, // boomerang
  { min: 0.02, max: 0.98, label: "Ratio" }, // hypocicloid
  { min: 0.12, max: 2.0, label: "Ratio" }, // venusian
  { min: 2.5, max: 11, label: "Cusps" }, // astroid
  { min: 2, max: 7, step: 0.1, label: "Wings" }, // butterfly
  { min: 2, max: 8, step: 0.25, label: "Turns" }, // farris
  { min: 2.25, max: 9, step: 0.25, label: "Petals" }, // gielis
  // Drawn a little smaller so the particles can hold the weave: the targets
  // sweep at speed * |f'|, and a smaller figure slows them without touching
  // the particle speed. Above ratio 4 it smears whatever the scale.
  { min: 1, max: 4, step: 0.05, sampleStep: 0.02, scale: 0.6, label: "Ratio" }, // harmonograph
];

function parameterFor(index) {
  const range = parameterRanges[index];
  if (!range.step) {
    return range.min + Math.random() * (range.max - range.min);
  }
  // Land on one of the notches the slider can actually stop at, whatever the
  // step is. Picking a free-running value put the thumb between notches and
  // made the readout disagree with the slider.
  const notches = Math.round((range.max - range.min) / range.step);
  return range.min + range.step * Math.floor(Math.random() * (notches + 1));
}

// Enough decimals to show the step, and no more.
function decimalsFor(step) {
  if (!step) return 2;
  const text = String(step);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

// The curve the page opens on is still picked at random.
let functionNum = Math.floor(Math.random() * graphFunctions.length);
let extraPar = parameterFor(functionNum);
let patternScale = parameterRanges[functionNum].scale || 1;
let patternSampleStep = parameterRanges[functionNum].sampleStep || 1;

// After that, step through the curves in order. Drawing the index from the
// clock the way the first one used to be skewed heavily towards a few values,
// because the arithmetic ran modulo a power of two and browsers round their
// timers differently. Walking the list visits all eight evenly.
function regeneratePattern() {
  functionNum = (functionNum + 1) % graphFunctions.length;
  extraPar = parameterFor(functionNum);
  patternScale = parameterRanges[functionNum].scale || 1;
  patternSampleStep = parameterRanges[functionNum].sampleStep || 1;
  color = Math.floor(Math.random() * 360);
  t = 0;
  syncParameterSlider();
}

function circle(t) {
  const radius = Math.sin(t);
  const y = Math.sin(t) * radius - 0.4;
  const x = Math.cos(t) * extraPar * radius;
  return { x, y };
}
function dunno(t) {
  const y = Math.sin(t) * Math.cos(t) * Math.sin(extraPar * t);
  const x = Math.cos(t) * Math.cos(extraPar * t);
  return { x, y };
}
function eight(t) {
  //extraPar = Math.PI/2
  const x2 = Math.sin(t) * Math.cos(t);
  const y2 = Math.cos(t);
  const x = x2 * Math.cos(extraPar) - y2 * Math.sin(extraPar);
  const y = x2 * Math.sin(extraPar) - y2 * Math.cos(extraPar);
  return { x, y };
}
function heart(t) {
  const x = (extraPar * 16 * Math.sin(t) * Math.sin(t) * Math.sin(t)) / 20;
  const y =
    -(
      extraPar *
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        1 * Math.cos(4 * t))
    ) / 20;
  return { x, y };
}
function boomerang(t) {
  const x = (1 + Math.sin(extraPar * t)) * Math.cos(t);
  const y = (1 + Math.sin(extraPar * t)) * Math.sin(t);
  return { x, y };
}
function hypocicloid(t) {
  const x = ((extraPar - 1) * Math.cos(t) + Math.cos((extraPar - 1) * t)) / 1.5;
  const y = ((extraPar - 1) * Math.sin(t) - Math.sin((extraPar - 1) * t)) / 1.5;
  return { x, y };
}
function venusian(t) {
  const x =
    (Math.sin(t) + Math.pow(extraPar, 2 / 3) * Math.sin(t / extraPar)) / 4;
  const y =
    (Math.cos(t) + Math.pow(extraPar, 2 / 3) * Math.cos(t / extraPar)) / 4;
  return { x, y };
}
function astroid(t) {
  const x =
    ((extraPar - 1) * Math.cos(t) + Math.cos((extraPar - 1) * t)) /
    (1.5 * extraPar);
  const y =
    ((extraPar - 1) * Math.sin(t) - Math.sin((extraPar - 1) * t)) /
    (1.5 * extraPar);
  return { x, y };
}
function butterfly(t) {
  const wings = extraPar;
  const r =
    Math.exp(Math.sin(t)) -
    2 * Math.cos(wings * t) +
    Math.pow(Math.sin(t / 2), 5);
  // The theoretical bound on |r| is e + 3, but the extremes never line up,
  // so normalising by it drew the butterfly at about half the size of every
  // other curve. 3.6 is measured: it puts the span alongside the rest.
  const k = 5;//3.6;
  const x = (Math.sin(t) * r) / k;
  const y = (Math.cos(t) * r) / k;
  return { x, y };
}
function farris(t) {
  const n = extraPar;
  const k = 1 + 1 / 2 + 1 / 3;                // |z| ≤ 11/6 for every n
  const x = (Math.cos(t) + Math.cos((n + 1) * t) / 2 + Math.sin((3 * n - 1) * t) / 3) / k;
  const y = (Math.sin(t) + Math.sin((n + 1) * t) / 2 + Math.cos((3 * n - 1) * t) / 3) / k;
  return { x, y };
}
function gielis(t) {
  const a = extraPar * t / 4;
  const r = 1 / (Math.pow(Math.abs(Math.cos(a)), 7) + Math.pow(Math.abs(Math.sin(a)), 8));
  const k = 6.68;                              // max r (independent of m)
  const x = (r * Math.cos(t)) / k;
  const y = (r * Math.sin(t)) / k;
  return { x, y };
}
// A harmonograph is two pendulums very slightly out of tune, so each loop lands
// a little rotated from the last and the trace weaves a ribbon. That only reads
// if consecutive particles sit next to each other along the path, which is what
// this curve's sampleStep is for: every other curve steps 1 per particle and
// scatters over the whole orbit, this one steps 0.02 and follows it.
function harmonograph(t) {
  const a = extraPar;
  const detune = 0.012;
  const x = (Math.sin(a * t) + Math.sin((a + detune) * t + 1.2) / 2) / 1.5;
  const y = (Math.cos(2 * t) + Math.cos((a + detune) * t + 0.5) / 2) / 1.5;
  return { x, y };
}

// ---- Flocking --------------------------------------------------------------
// Whenever the canvas sits behind the page the dots flock instead of tracing the
// curve, and the cursor pulls the flock along; bringing the canvas to the front
// sends them back to the pattern.
// Boids: every dot steers by what it can see within `vision` (match heading,
// drift towards the middle of the group, keep out of each other's way). Nothing
// steers the flock as a whole except a pull back towards a point that wanders
// around the screen, which keeps it on screen and makes it swoop. The pull only
// starts outside a zone around that point: pulling everyone towards the same
// spot at every distance squeezes the flock into a knot.
const flock = {
  on: false,
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
// Only pull towards the cursor while it is over the page; before the first move
// it sits at (0, 0) and would drag the flock into the corner.
let cursorOnPage = false;
document.addEventListener("mousemove", function () {
  cursorOnPage = true;
});
document.documentElement.addEventListener("mouseleave", function () {
  cursorOnPage = false;
});

// Each frame the dots are counting-sorted into grid cells, so each dot only
// looks at the 3x3 block of cells around it, and each row of that block is one
// unbroken run of the sorted arrays. There are two grids: a coarse one a
// vision radius wide for heading and cohesion, and a fine one a personal space
// wide for separation. With a single coarse grid and a cap on neighbours, the
// dots a bird counted were rarely the ones touching it, so nothing kept them
// apart and the flock packed solid.
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

function fillGrid(grid, size, w, h) {
  const n = posX.length;
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
  flock.on = true;
}

function stepFlock() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  const R2 = flock.vision * flock.vision;
  const P = flock.personal;
  const P2 = P * P;

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

let t = 0;
const increment = 0.01;
let color = loadTime.getMilliseconds() % 360;

function moveWhiteElements() {
  color += 0.1;
  t += increment;
  if (t > 2) {
    t = 0;
  }

  if (whiteElements.length > 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const inBackground = introDone && !userPlaying;
    if (inBackground && !flock.on) startFlock();
    // Nothing to undo: the curve loop pulls every dot back to its target from
    // wherever the flock left it.
    if (!inBackground) flock.on = false;
    if (flock.on) {
      stepFlock();
      ctx.fillStyle = `hsl(${Math.floor(color)},100%,75%)`;
      for (let i = 0; i < whiteElements.length; i++) {
        ctx.fillRect(whiteElements[i].x, whiteElements[i].y, 1, 1);
      }
    }
    for (let i = 0; !flock.on && i < whiteElements.length; i++) {
      let whiteElement = whiteElements[i];
      let angle = t + i * patternSampleStep;

      const shape = graphFunctions[functionNum](angle);
      const reach = speed * (1 / increment) * patternScale;
      whiteElement.targetX = reach * shape.x + canvas.width / 2;
      whiteElement.targetY = reach * shape.y + canvas.height / 2;

      let updatedWhiteElement = moveTowardsTarget(
        whiteElement.x,
        whiteElement.y,
        whiteElement.targetX,
        whiteElement.targetY,
        speed
      );

      whiteElement.x = updatedWhiteElement.x;
      whiteElement.y = updatedWhiteElement.y;

      ctx.fillStyle = `hsl(${Math.floor(color)},100%,75%)`;
      ctx.fillRect(whiteElement.x, whiteElement.y, 1, 1);
    }

    if (loopShouldRun()) {
      requestAnimationFrame(moveWhiteElements);
    } else {
      rafPending = false;
    }
  }
}

let rafPending = true;
let userPlaying = false;

// Reduced motion stops the idle background animation, but not a visitor who has
// deliberately asked to play with it.
function loopShouldRun() {
  return (!prefersReducedMotion || userPlaying) && !document.hidden;
}

function ensureLoopRunning() {
  if (!rafPending && loopShouldRun()) {
    rafPending = true;
    moveWhiteElements();
  }
}

moveWhiteElements();

// Stop burning frames on a backgrounded tab; pick back up on return.
document.addEventListener("visibilitychange", ensureLoopRunning);

// ---- Playing with the background -------------------------------------------
let cycleTimer = null;

function stopCycle() {
  if (!cycleTimer) return;
  clearInterval(cycleTimer);
  cycleTimer = null;
  const cycle = document.getElementById("bgCycle");
  if (cycle) {
    cycle.setAttribute("aria-pressed", "false");
    cycle.classList.remove("isOn");
  }
}

function startCycle() {
  if (cycleTimer) return;
  regeneratePattern();
  cycleTimer = setInterval(regeneratePattern, 4000);
  const cycle = document.getElementById("bgCycle");
  if (cycle) {
    cycle.setAttribute("aria-pressed", "true");
    cycle.classList.add("isOn");
  }
}

function showParameterValue() {
  if (!paramValue) return;
  const range = parameterRanges[functionNum];
  paramValue.textContent = Number(extraPar).toFixed(decimalsFor(range.step));
}

// Each curve reads extraPar differently, so the slider is re-scaled to that
// curve's range whenever the shape changes.
function syncParameterSlider() {
  if (!paramSlider) return;
  const range = parameterRanges[functionNum];
  paramSlider.min = range.min;
  paramSlider.max = range.max;
  paramSlider.step = range.step || (range.max - range.min) / 500;
  paramSlider.value = extraPar;
  paramSlider.setAttribute("aria-label", range.label);
  if (paramLabel) paramLabel.textContent = range.label;
  showParameterValue();
}

function bringToFront() {
  userPlaying = true;
  canvas.classList.remove("canvas--settled");
  root.classList.add("intro-active"); // holds the page still underneath
  if (playButton) playButton.hidden = true;
  if (bgControls) bgControls.hidden = false;
  if (paramPanel) paramPanel.hidden = false;
  syncParameterSlider();
  ensureLoopRunning();
}

function returnToPage() {
  userPlaying = false;
  stopCycle();
  canvas.classList.add("canvas--settled");
  root.classList.remove("intro-active");
  if (bgControls) bgControls.hidden = true;
  if (paramPanel) paramPanel.hidden = true;
  if (playButton) playButton.hidden = false;
}

if (playButton && bgControls) {
  playButton.addEventListener("click", bringToFront);
  document.getElementById("bgBack").addEventListener("click", returnToPage);
  document.getElementById("bgNew").addEventListener("click", regeneratePattern);
  document.getElementById("bgCycle").addEventListener("click", function () {
    if (cycleTimer) {
      stopCycle();
    } else {
      startCycle();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && userPlaying) returnToPage();
  });
  if (paramSlider) {
    // No t reset here: dragging should morph the shape rather than restart it.
    paramSlider.addEventListener("input", function () {
      extraPar = Number(paramSlider.value);
      showParameterValue();
    });
  }
}
