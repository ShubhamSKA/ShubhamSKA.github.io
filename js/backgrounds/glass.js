// The breaking glass background. Loaded after infinity.js.

// ---- Breaking glass ----------------------------------------------------------
// Every few seconds a pane of glass breaks where the cursor is, and each break
// is drawn at random, Monte Carlo fashion, with a fixed number of dots. A small
// crushed spot marks the impact, and a random number of cracks run out from it
// at roughly even angles. Each crack is a random walk: it wanders a little
// every step, now and then kinks sharply, forks, or stops by itself, and turns
// back towards pointing straight out from the impact. Cracks run at speeds of
// their own, so they end up different lengths. One that runs into another
// crack of the same break stops there, as cracks in glass do, which leaves T
// junctions rather than crossings. Once the outward cracks have used their
// share of the dots, rings of cracks link neighbouring ones at a few radii,
// each link there or not by chance, bowing out a little and stopping where it
// meets the next crack: the spider's web. Dots left over go to more rings at
// random radii, then to the crushed spot. A new break takes its dots from the
// pattern first, then from the oldest break, which un-breaks from its last
// crack back to its impact as the new one runs. On a phone, a shake breaks
// the glass at once.
const glass = {
  every: 70, // frames between breaks
  perBreak: 1250, // dots in each break
  spacing: 1.8, // px between dots along a crack
  speed: 80, // dots a break lays per frame as it runs
  radials: [6, 12], // cracks running out from the impact, fewest to most
  bend: 0.04, // rad of random turning per step
  outward: 0.015, // share of the way back to pointing outwards a crack turns per step
  kink: 0.012, // chance per step of a sharp kink
  kinkAngle: 0.3, // rad
  fork: 0.005, // chance per step a crack forks
  forkAngle: [0.2, 0.55], // rad
  stop: 0.0015, // chance per step a crack stops by itself
  vigour: [0.4, 1], // chance per turn a crack steps, slowest to fastest
  radialShare: 0.7, // share of a break's dots for the outward cracks
  rings: [0.16, 0.34, 0.56], // ring radii, share of how far the cracks ran
  ringChance: 0.7, // chance each link of a ring is there
  extraRings: 3, // rings at random radii, for dots left over
  ringBow: 0.25, // rad a link sets off outwards of straight
  crush: 70, // dots in the crushed spot
  crushSize: 4, // px
};

const GLASS_CELL = 3; // px: grid cells for finding where cracks meet
let glassGrid = new Int32Array(0); // the key of the crack that last laid a dot in each cell
let glassCols = 0;
let glassRows = 0;
let glassBreaks = []; // oldest first; each { dots } in the order laid
let glassUnused = 0; // dots of the starting pattern not yet taken
let glassTimer = 0;
let glassSerial = 0;
let glassRun = null; // the break being laid
let glassShakes = 0; // the phone's shakes already answered

function glassGauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random() * 0.9999)) * Math.cos(Math.random() * Math.PI * 2);
}

function glassWrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function glassBetween(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

// The next dot to lay: one from the pattern, else the newest of the oldest
// break's.
function glassTake() {
  if (glassUnused < whiteElements.length) return glassUnused++;
  while (glassBreaks.length > 1 && !glassBreaks[0].dots.length) glassBreaks.shift();
  if (glassBreaks.length > 1) return glassBreaks[0].dots.pop();
  // Only the running break is left: it reuses its own first dots.
  return glassBreaks[0].dots.shift();
}

function glassLay(run, x, y, key) {
  const i = glassTake();
  whiteElements[i].x = x;
  whiteElements[i].y = y;
  run.dots.push(i);
  run.laid++;
  if (key) {
    const cx = Math.floor(x / GLASS_CELL);
    const cy = Math.floor(y / GLASS_CELL);
    if (cx >= 0 && cy >= 0 && cx < glassCols && cy < glassRows) glassGrid[cy * glassCols + cx] = key;
  }
}

// Whether the tip has run into another crack of its own break.
function glassHit(run, tip) {
  if (tip.steps <= tip.grace) return false;
  const cx = Math.floor(tip.x / GLASS_CELL);
  const cy = Math.floor(tip.y / GLASS_CELL);
  if (cx < 0 || cy < 0 || cx >= glassCols || cy >= glassRows) return false;
  const v = glassGrid[cy * glassCols + cx];
  return v >= run.serial * 4096 && v !== tip.key;
}

function glassKey(run) {
  run.tipCount = (run.tipCount + 1) % 4095;
  return run.serial * 4096 + 1 + run.tipCount;
}

function glassOff(x, y) {
  return x < 0 || y < 0 || x >= canvas.width || y >= canvas.height;
}

function glassBreak() {
  const w = canvas.width;
  const h = canvas.height;
  const cols = Math.ceil(w / GLASS_CELL);
  const rows = Math.ceil(h / GLASS_CELL);
  if (cols !== glassCols || rows !== glassRows) {
    glassCols = cols;
    glassRows = rows;
    glassGrid = new Int32Array(cols * rows);
  }
  const x = cursorOnPage ? cursorPosition.x : w * (0.15 + 0.7 * Math.random());
  const y = cursorOnPage ? cursorPosition.y : h * (0.15 + 0.7 * Math.random());
  const budget = Math.min(whiteElements.length, Math.max(1, Math.round(glass.perBreak)));
  const run = {
    x,
    y,
    dots: [],
    budget,
    laid: 0,
    serial: ++glassSerial,
    tipCount: 0,
    phase: "radial",
    tips: [],
    radials: [],
    rings: [],
    ring: 0,
  };
  glassBreaks.push({ dots: run.dots });
  glassRun = run;

  const crush = Math.min(budget, Math.max(0, Math.round(glass.crush)));
  for (let k = 0; k < crush; k++) {
    glassLay(run, x + glassGauss() * glass.crushSize, y + glassGauss() * glass.crushSize, 0);
  }
  run.radialEnd = run.laid + Math.round((budget - run.laid) * glass.radialShare);

  const count = Math.round(glassBetween(glass.radials));
  const turn = Math.random() * Math.PI * 2;
  for (let k = 0; k < count; k++) {
    const angle = turn + ((k + (Math.random() - 0.5) * 0.6) / count) * Math.PI * 2;
    run.radials.push({ angle, xs: [], ys: [] });
    run.tips.push({
      x,
      y,
      angle,
      key: glassKey(run),
      steps: 0,
      // Past the crushed spot before it can run into its neighbours.
      grace: Math.ceil((glass.crushSize * 3 + 2 * GLASS_CELL) / glass.spacing),
      vigour: glassBetween(glass.vigour),
      radial: k, // the crack whose line this is, if it is the trunk
    });
  }
}

function glassStepRadial(run, tip) {
  tip.angle += glassGauss() * glass.bend;
  if (Math.random() < glass.kink) tip.angle += (Math.random() < 0.5 ? -1 : 1) * glass.kinkAngle;
  const out = Math.atan2(tip.y - run.y, tip.x - run.x);
  tip.angle += glassWrap(out - tip.angle) * glass.outward;
  tip.x += Math.cos(tip.angle) * glass.spacing;
  tip.y += Math.sin(tip.angle) * glass.spacing;
  tip.steps++;
  if (glassOff(tip.x, tip.y)) return false;
  const hit = glassHit(run, tip);
  glassLay(run, tip.x, tip.y, tip.key);
  if (tip.radial >= 0) {
    run.radials[tip.radial].xs.push(tip.x);
    run.radials[tip.radial].ys.push(tip.y);
  }
  if (hit || Math.random() < glass.stop) return false;
  if (Math.random() < glass.fork && run.tips.length < 256) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const angle = glassBetween(glass.forkAngle);
    run.tips.push({
      x: tip.x,
      y: tip.y,
      angle: tip.angle + side * angle,
      key: glassKey(run),
      steps: 0,
      // Until it is clear of the crack it forked from.
      grace: Math.min(40, Math.ceil((2 * GLASS_CELL) / (glass.spacing * Math.max(0.05, Math.sin(angle))))),
      vigour: tip.vigour * (0.7 + Math.random() * 0.3),
      radial: -1,
    });
  }
  return true;
}

function glassStepRing(run, tip) {
  const want = Math.atan2(tip.ty - tip.y, tip.tx - tip.x);
  tip.angle += glassWrap(want - tip.angle) * 0.12 + glassGauss() * glass.bend;
  tip.x += Math.cos(tip.angle) * glass.spacing;
  tip.y += Math.sin(tip.angle) * glass.spacing;
  tip.steps++;
  if (glassOff(tip.x, tip.y)) return false;
  const hit = glassHit(run, tip);
  glassLay(run, tip.x, tip.y, tip.key);
  const arrived = Math.hypot(tip.tx - tip.x, tip.ty - tip.y) < glass.spacing;
  return !(hit || arrived || tip.steps > tip.most);
}

// The first point of a crack at least `radius` from the impact.
function glassOnCrack(run, crack, radius) {
  for (let k = 0; k < crack.xs.length; k++) {
    if (Math.hypot(crack.xs[k] - run.x, crack.ys[k] - run.y) >= radius) {
      return { x: crack.xs[k], y: crack.ys[k] };
    }
  }
  return null;
}

// One ring of links at `share` of the cracks' typical reach.
function glassRing(run, reach, share) {
  const radius = share * reach;
  const cracks = run.radials;
  const links = [];
  for (let i = 0; i < cracks.length && cracks.length > 1; i++) {
    if (Math.random() > glass.ringChance) continue;
    const from = glassOnCrack(run, cracks[i], radius);
    const to = glassOnCrack(run, cracks[(i + 1) % cracks.length], radius * (0.85 + 0.3 * Math.random()));
    if (!from || !to) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 3 * glass.spacing) continue;
    // Bowing away from the impact.
    const midX = (from.x + to.x) / 2 - run.x;
    const midY = (from.y + to.y) / 2 - run.y;
    const side = -dy * midX + dx * midY > 0 ? 1 : -1;
    links.push({
      x: from.x,
      y: from.y,
      tx: to.x,
      ty: to.y,
      angle: Math.atan2(dy, dx) + side * glass.ringBow,
      key: glassKey(run),
      steps: 0,
      grace: 3,
      most: (2.5 * length) / glass.spacing,
    });
  }
  return links;
}

function glassStartRings(run) {
  run.phase = "rings";
  run.tips = [];
  // The cracks were set off in order round the impact, so neighbours in the
  // list are neighbours on the glass.
  const reaches = run.radials
    .map(function (crack) {
      const k = crack.xs.length - 1;
      return k < 0 ? 0 : Math.hypot(crack.xs[k] - run.x, crack.ys[k] - run.y);
    })
    .sort(function (a, b) {
      return a - b;
    });
  run.reach = reaches.length ? reaches[Math.floor(reaches.length / 2)] : 0;
  run.rings = glass.rings.slice();
  for (let k = 0; k < Math.round(glass.extraRings); k++) run.rings.push(0.1 + Math.random() * 0.8);
  run.ring = 0;
}

function glassStepRun(run) {
  let laidNow = 0;
  let idle = 0;
  while (laidNow < glass.speed && run.laid < run.budget && run.phase !== "done") {
    if (run.phase === "radial") {
      if (!run.tips.length || run.laid >= run.radialEnd) {
        glassStartRings(run);
        continue;
      }
      const before = run.laid;
      for (let k = run.tips.length - 1; k >= 0 && run.laid < run.radialEnd; k--) {
        const tip = run.tips[k];
        if (Math.random() > tip.vigour) continue;
        if (!glassStepRadial(run, tip)) run.tips.splice(k, 1);
      }
      laidNow += run.laid - before;
      // Every tip may sit a turn out by chance; do not spin on it forever.
      if (run.laid === before && ++idle > 50) glassStartRings(run);
    } else {
      // Rings one at a time, inner first, the links of each together.
      if (!run.tips.length) {
        if (run.ring >= run.rings.length) {
          run.phase = "done";
          break;
        }
        run.tips = glassRing(run, run.reach, run.rings[run.ring++]);
        continue;
      }
      const before = run.laid;
      for (let k = run.tips.length - 1; k >= 0 && run.laid < run.budget; k--) {
        if (!glassStepRing(run, run.tips[k])) run.tips.splice(k, 1);
      }
      laidNow += run.laid - before;
    }
  }
  // Whatever is left goes to the crushed spot.
  if (run.phase === "done") {
    while (run.laid < run.budget) {
      glassLay(run, run.x + glassGauss() * glass.crushSize * 1.6, run.y + glassGauss() * glass.crushSize * 1.6, 0);
    }
  }
  if (run.laid >= run.budget) run.phase = "done";
}

function startGlass() {
  glassBreaks = [];
  glassUnused = 0;
  glassTimer = 0;
  glassRun = null;
}

function stepGlass() {
  if (phone.shakes !== glassShakes) {
    glassShakes = phone.shakes;
    glassTimer = 0;
  }
  if (--glassTimer <= 0) {
    glassTimer = Math.max(1, glass.every);
    glassBreak();
  }
  if (glassRun && glassRun.phase !== "done") glassStepRun(glassRun);
}

registerBackground("glass", {
  start: startGlass,
  step: stepGlass,
  settings: glass,
});
