// The orbits background. Loaded after infinity.js.

// ---- Orbits ----------------------------------------------------------------
// The cursor is a star and the dots are a disc of debris orbiting it. The star
// is not nailed to the mouse but chases it on a spring, so dragging it sets
// the disc sloshing and smears the rings into tidal streams that wind back up
// over time: a faint drag, like the gas in a real disc, eases every dot back
// towards the circular orbit for its distance. Planets on circular orbits,
// each drawn as a little clump of dots, carve gaps and stir wakes in the disc,
// and now and then catch debris into orbits of their own. The rest of the dots
// start on circular orbits wherever the pattern left them; one that is flung
// out or falls in comes back on a fresh orbit. Gravity is softened close in,
// and steps are leapfrog, which keeps orbits from slowly drifting.
const orbits = {
  gm: 900, // the star's pull: px^3 per frame^2
  soften: 10, // px
  inner: 40, // px: closest a fresh orbit starts
  outer: 0.45, // farthest a fresh orbit starts, share of the shorter side
  swallow: 14, // px: closer than this, a dot has fallen in
  flungOut: 0.6, // share of the screen diagonal: further than this, it is lost
  settle: 0.01, // drag towards a circular orbit, per frame
  chase: 0.01, // how hard the spring pulls the star towards the cursor
  calm: 0.86, // how much of its speed the star keeps each frame
  scatter: 0.06, // how far off circular a fresh orbit is
  // The planets, innermost first: distance (share of the shorter side), pull,
  // and size of the clump that draws it (px).
  planetOrbits: [0.13, 0.21, 0.3, 0.4],
  planetPulls: [18, 40, 28, 60],
  planetSizes: [3, 5, 4, 6],
  planetDots: 30, // dots in each planet's clump
};

let orbitVX = new Float32Array(0);
let orbitVY = new Float32Array(0);
let orbitStar = { x: 0, y: 0, vx: 0, vy: 0 };
let orbitPlanets = []; // { x, y, angle }
let orbitBodyDots = 0; // the first this many dots draw the planets
let orbitBodyX = new Float32Array(0); // each body dot's place in its clump
let orbitBodyY = new Float32Array(0);

// A circular orbit around the star through (x, y), give or take `scatter`.
function circularOrbit(i, x, y) {
  const s = orbitStar;
  const dx = x - s.x;
  const dy = y - s.y;
  const r = Math.hypot(dx, dy) || 1;
  const speed = Math.sqrt(orbits.gm / r) * (1 + (Math.random() - 0.5) * 2 * orbits.scatter);
  whiteElements[i].x = x;
  whiteElements[i].y = y;
  // Anticlockwise on screen, and along with the star.
  orbitVX[i] = s.vx + (dy / r) * speed;
  orbitVY[i] = s.vy - (dx / r) * speed;
}

function freshOrbit(i) {
  const side = Math.min(canvas.width, canvas.height);
  const outer = Math.max(orbits.inner + 1, orbits.outer * side);
  // Even over the disc's area.
  const r = Math.sqrt(orbits.inner ** 2 + Math.random() * (outer ** 2 - orbits.inner ** 2));
  const a = Math.random() * Math.PI * 2;
  circularOrbit(i, orbitStar.x + Math.cos(a) * r, orbitStar.y + Math.sin(a) * r);
}

function orbitTarget() {
  return cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: canvas.width / 2, y: canvas.height / 2 };
}

function startOrbits() {
  const n = whiteElements.length;
  const target = orbitTarget();
  orbitStar = { x: target.x, y: target.y, vx: 0, vy: 0 };
  orbitPlanets = orbits.planetOrbits.map(function () {
    return { x: target.x, y: target.y, angle: Math.random() * Math.PI * 2 };
  });
  orbitBodyDots = Math.min(n, orbitPlanets.length * orbits.planetDots);
  orbitBodyX = new Float32Array(orbitBodyDots);
  orbitBodyY = new Float32Array(orbitBodyDots);
  for (let i = 0; i < orbitBodyDots; i++) {
    const r = Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    orbitBodyX[i] = Math.cos(a) * r;
    orbitBodyY[i] = Math.sin(a) * r;
  }
  orbitVX = new Float32Array(n);
  orbitVY = new Float32Array(n);
  const side = Math.min(canvas.width, canvas.height);
  for (let i = orbitBodyDots; i < n; i++) {
    const e = whiteElements[i];
    const r = Math.hypot(e.x - orbitStar.x, e.y - orbitStar.y);
    // The pattern starts turning where it is, if it is in the disc.
    if (r > orbits.inner && r < orbits.outer * side * 1.5) circularOrbit(i, e.x, e.y);
    else freshOrbit(i);
  }
}

// The pull on a dot at (x, y), into orbitPull.
const orbitPull = { x: 0, y: 0 };
function pullAt(x, y) {
  const s = orbitStar;
  let dx = s.x - x;
  let dy = s.y - y;
  let r2 = dx * dx + dy * dy + orbits.soften * orbits.soften;
  let f = orbits.gm / (r2 * Math.sqrt(r2));
  orbitPull.x = dx * f;
  orbitPull.y = dy * f;
  for (let k = 0; k < orbitPlanets.length; k++) {
    const p = orbitPlanets[k];
    dx = p.x - x;
    dy = p.y - y;
    r2 = dx * dx + dy * dy + 16;
    f = (orbits.planetPulls[k] || 0) / (r2 * Math.sqrt(r2));
    orbitPull.x += dx * f;
    orbitPull.y += dy * f;
  }
}

function stepOrbits() {
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  const s = orbitStar;

  // The star chases the cursor on a damped spring.
  const target = orbitTarget();
  s.vx = (s.vx + (target.x - s.x) * orbits.chase) * orbits.calm;
  s.vy = (s.vy + (target.y - s.y) * orbits.chase) * orbits.calm;
  s.x += s.vx;
  s.y += s.vy;

  // Planets go round at the speed their distance asks for, each a clump of
  // dots turning slowly about itself.
  for (let k = 0; k < orbitPlanets.length; k++) {
    const p = orbitPlanets[k];
    const r = (orbits.planetOrbits[k] || 0.3) * side;
    p.angle -= Math.sqrt(orbits.gm / r) / r;
    p.x = s.x + Math.cos(p.angle) * r;
    p.y = s.y + Math.sin(p.angle) * r;
  }
  const spin = orbitPlanets.length ? orbitPlanets[0].angle * 3 : 0;
  for (let i = 0; i < orbitBodyDots; i++) {
    const k = Math.floor(i / orbits.planetDots);
    const p = orbitPlanets[k];
    const size = orbits.planetSizes[k] || 4;
    const c = Math.cos(spin);
    const sn = Math.sin(spin);
    whiteElements[i].x = p.x + (orbitBodyX[i] * c - orbitBodyY[i] * sn) * size;
    whiteElements[i].y = p.y + (orbitBodyX[i] * sn + orbitBodyY[i] * c) * size;
  }

  const lost = orbits.flungOut * Math.hypot(w, h);
  const swallow2 = orbits.swallow * orbits.swallow;
  for (let i = orbitBodyDots; i < whiteElements.length; i++) {
    const e = whiteElements[i];
    // Leapfrog: half a kick, a drift, half a kick.
    pullAt(e.x, e.y);
    orbitVX[i] += orbitPull.x * 0.5;
    orbitVY[i] += orbitPull.y * 0.5;
    e.x += orbitVX[i];
    e.y += orbitVY[i];
    pullAt(e.x, e.y);
    orbitVX[i] += orbitPull.x * 0.5;
    orbitVY[i] += orbitPull.y * 0.5;

    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < swallow2 || r2 > lost * lost) {
      freshOrbit(i);
      continue;
    }
    // The drag: towards the circular orbit here, moving with the star.
    const r = Math.sqrt(r2);
    const circle = Math.sqrt(orbits.gm / r);
    orbitVX[i] += (s.vx + (dy / r) * circle - orbitVX[i]) * orbits.settle;
    orbitVY[i] += (s.vy - (dx / r) * circle - orbitVY[i]) * orbits.settle;
  }
}

registerBackground("orbits", {
  start: startOrbits,
  step: stepOrbits,
  settings: orbits,
});
