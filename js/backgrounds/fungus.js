// The fungus background. Loaded after infinity.js.

// ---- Fungus ----------------------------------------------------------------
// A mycelium foraging for food, and the cursor is the food. Threads (hyphae)
// grow from spores as wandering tips that now and then send out a side branch;
// a tip that runs into another thread fuses with it and stops, so the threads
// knit into a net. Tips can smell the food: the nearer they are, the harder
// they turn towards it, and once there they branch and wander far more, so a
// dense mat builds up on the food. Dots are laid along the threads as they
// grow, always taking the dot laid longest ago, so old threads far from the
// food die back while the growth reaches after the mouse. When every tip has
// stopped, a fresh spore lands somewhere.
const fungus = {
  step: 2.5, // px a tip grows per dot laid
  perFrame: 30, // dots laid per frame
  wander: 0.22, // rad of random turning per step
  scent: 0.06, // rad per step a tip turns towards the food, at most
  smell: 0.7, // how far the food can be smelt, share of the screen diagonal
  branch: 0.02, // chance per step that a tip sends out a side branch
  branchAngle: [0.5, 1.2], // rad off the parent, least and most
  feedReach: 70, // px: this close to the food, a tip is feeding
  feedBranch: 0.12, // chance per step a feeding tip branches
  feedWander: 0.6, // rad of random turning per step while feeding
  maxTips: 140,
  lifetime: 500, // steps before a tip stops of its own accord
  grace: 5, // steps a new branch grows before it can fuse
  spores: 3, // tips a fresh spore starts with
};

const FUNGUS_CELL = 3; // px: the grid that records where threads are
let fungusTips = []; // { x, y, angle, age, last }
let fungusNext = 0; // the dot to lay next: the one laid longest ago
let fungusGrid = new Int32Array(0); // dot in each cell, or -1
let fungusCols = 0;
let fungusRows = 0;

function fungusCell(x, y) {
  const i = Math.floor(x / FUNGUS_CELL);
  const j = Math.floor(y / FUNGUS_CELL);
  if (i < 0 || j < 0 || i >= fungusCols || j >= fungusRows) return -1;
  return j * fungusCols + i;
}

function fungusFood() {
  return cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: canvas.width / 2, y: canvas.height / 2 };
}

// A spore lands somewhere and sends out a few tips.
function sowSpore() {
  const w = canvas.width;
  const h = canvas.height;
  const x = w * (0.05 + 0.9 * Math.random());
  const y = h * (0.05 + 0.9 * Math.random());
  const turn = Math.random() * Math.PI * 2;
  for (let k = 0; k < fungus.spores; k++) {
    fungusTips.push({ x, y, angle: turn + (k * Math.PI * 2) / fungus.spores, age: 0, last: -1 });
  }
}

function startFungus() {
  fungusCols = Math.ceil(canvas.width / FUNGUS_CELL);
  fungusRows = Math.ceil(canvas.height / FUNGUS_CELL);
  fungusGrid = new Int32Array(fungusCols * fungusRows).fill(-1);
  fungusTips = [];
  fungusNext = 0;
  sowSpore();
  sowSpore();
}

function stepFungus() {
  const w = canvas.width;
  const h = canvas.height;
  const n = whiteElements.length;
  if (fungusCols !== Math.ceil(w / FUNGUS_CELL) || fungusRows !== Math.ceil(h / FUNGUS_CELL)) startFungus();
  const food = fungusFood();
  const smell = fungus.smell * Math.hypot(w, h);
  let laid = 0;
  while (laid < fungus.perFrame) {
    if (!fungusTips.length) sowSpore();
    const tip = fungusTips.shift();
    const dx = food.x - tip.x;
    const dy = food.y - tip.y;
    const d = Math.hypot(dx, dy);
    const feeding = d < fungus.feedReach;

    // Turn: a random wander, and towards the food the nearer it is.
    tip.angle += (Math.random() - 0.5) * 2 * (feeding ? fungus.feedWander : fungus.wander);
    if (!feeding && d < smell) {
      let turn = Math.atan2(dy, dx) - tip.angle;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const pull = fungus.scent * (1 - d / smell);
      tip.angle += Math.max(-pull, Math.min(pull, turn));
    }
    tip.x += Math.cos(tip.angle) * fungus.step;
    tip.y += Math.sin(tip.angle) * fungus.step;
    tip.age++;
    if (tip.x < 0 || tip.x >= w || tip.y < 0 || tip.y >= h) continue;

    // Running into another thread: fuse and stop.
    const cell = fungusCell(tip.x, tip.y);
    const there = fungusGrid[cell];
    if (there !== -1 && there !== tip.last && tip.age > fungus.grace) continue;

    // Lay the next dot, taking it from wherever it was before.
    const dot = fungusNext;
    fungusNext = (fungusNext + 1) % n;
    const e = whiteElements[dot];
    const old = fungusCell(e.x, e.y);
    if (old !== -1 && fungusGrid[old] === dot) fungusGrid[old] = -1;
    e.x = tip.x;
    e.y = tip.y;
    fungusGrid[cell] = dot;
    tip.last = dot;
    laid++;

    if (tip.age > fungus.lifetime) continue;
    fungusTips.push(tip);
    if (fungusTips.length < fungus.maxTips && Math.random() < (feeding ? fungus.feedBranch : fungus.branch)) {
      const [low, high] = fungus.branchAngle;
      const side = Math.random() < 0.5 ? -1 : 1;
      fungusTips.push({
        x: tip.x,
        y: tip.y,
        angle: tip.angle + side * (low + Math.random() * (high - low)),
        age: 0,
        last: dot,
      });
    }
  }
}

registerBackground("fungus", {
  start: startFungus,
  step: stepFungus,
  settings: fungus,
});
