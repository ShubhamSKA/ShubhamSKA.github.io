// The Keplerian orbits background, in development. Loaded after infinity.js, by
// the canvas lab only.

// ---- Kepler --------------------------------------------------------------------
// The solar system round the cursor, held to Kepler's laws. It starts out as near
// the real thing as fits on a screen: the eight planets in order, with their real
// eccentricities and each where it really is in its orbit today, the asteroid belt
// inside Jupiter, the Trojans sharing Jupiter's orbit sixty degrees either side of
// it, the Kuiper belt beyond Neptune, comets on long thin ellipses. Only the
// distances are squeezed, since to scale nearly everything would be empty space,
// and the sizes swollen. The Sun holds them all, and nothing approximates its pull:
// each frame carries each body exactly along its orbit by solving Kepler's
// equation, so orbits close on themselves, however close to it they pass, and with
// the distances squeezed, the square of each year still goes as the cube of its
// orbit. Mercury races, Neptune crawls, and eccentric bodies whip round the Sun
// and dawdle at the far end.
// The giants have weight too, three times what they really have as far as the
// belts and comets can tell, though the planets feel each other at their real
// masses: they pull on the belts, bend the comets that pass and tug on the Sun
// itself. Everything is measured from the Sun, so that tug is felt by everything
// else, the other way, which is what makes the Trojans stay where they are; and
// Jupiter, squeezed so close to the asteroid belt, slowly eats into it. The small
// planets are too light to matter to anything. Each planet carries its moons, on
// ellipses of their own by the same laws on a smaller scale, and Saturn its rings.
// Nothing puts any of this back. The Sun chases the cursor on a spring, and a
// gentle pull takes the whole system along together, as the galaxy takes the real
// one; but a sudden jerk is felt, the Sun running out from under everything, and
// what that does to the orbits stays done. Every body goes on along whatever new
// ellipse it was thrown onto, so the system comes apart a little more with each
// jerk, and one hard flick can undo most of it at a stroke. All that is restored
// is what would otherwise be gone for good: a body that falls into the Sun or is
// flung right out comes back on the ellipse it began on.
// Dots: the planets' clumps, the Sun, the moons and Saturn's rings, the comets'
// trains, the Trojans, the asteroids, and the rest in the Kuiper belt.

// The planets, from J2000 mean elements: semi-major axis in AU, eccentricity,
// longitudes of perihelion and of the planet in degrees, the second's rate in
// degrees a century, and mass in Suns. Then how they are drawn: size of the clump
// in px and dots in it; their moons' distances in px, a negative one going round
// the other way, as Triton does; and for Saturn, rings as inner and outer radii.
const KEPLER_PLANETS = [
  { name: "Mercury", au: 0.3871, e: 0.2056, perihelion: 77.46, longitude: 252.25, rate: 149472.67, mass: 1.66e-7,
    size: 1.5, dots: 5, moons: [] },
  { name: "Venus", au: 0.7233, e: 0.0068, perihelion: 131.6, longitude: 181.98, rate: 58517.82, mass: 2.45e-6,
    size: 2.5, dots: 12, moons: [] },
  { name: "Earth", au: 1, e: 0.0167, perihelion: 102.94, longitude: 100.46, rate: 35999.37, mass: 3e-6,
    size: 2.6, dots: 12, moons: [5] },
  { name: "Mars", au: 1.5237, e: 0.0934, perihelion: 336.06, longitude: 355.45, rate: 19140.3, mass: 3.23e-7,
    size: 2, dots: 7, moons: [3.5, 5] },
  // Io, Europa and Ganymede kept in their real 1:2:4 of years.
  { name: "Jupiter", au: 5.2029, e: 0.0484, perihelion: 14.73, longitude: 34.4, rate: 3034.75, mass: 9.55e-4,
    size: 7, dots: 60, moons: [9, 14.3, 22.7, 30] },
  { name: "Saturn", au: 9.5367, e: 0.0539, perihelion: 92.6, longitude: 49.95, rate: 1222.49, mass: 2.86e-4,
    size: 6, dots: 45, moons: [22], rings: [[8, 11.2], [12.2, 14]] },
  { name: "Uranus", au: 19.1892, e: 0.0473, perihelion: 170.95, longitude: 313.24, rate: 428.48, mass: 4.37e-5,
    size: 4, dots: 24, moons: [7, 9.5, 12.5, 16] },
  { name: "Neptune", au: 30.0699, e: 0.0086, perihelion: 44.96, longitude: 304.88, rate: 218.46, mass: 5.15e-5,
    size: 4, dots: 24, moons: [-9] },
];

const kepler = {
  gm: 300, // the Sun's pull: px^3 per frame^2
  reach: 0.42, // Neptune's semi-major axis, share of the shorter side
  squeeze: 0.5, // distances go as AU to this power: 1 would be to scale
  weight: 3, // how many times their real mass the belts and comets feel the planets at: above 5, the belts dissolve
  ringDots: 220, // Saturn's rings
  comets: 4,
  cometDots: 100, // dots in each comet's train
  cometNear: [0.4, 1.5], // AU from the Sun at their closest, least to most
  cometFar: [15, 40], // AU out they go, least to most
  cometTrain: 0.012, // how long a train is, share of its orbit, in time
  trojans: 240, // sharing Jupiter's orbit, half ahead of it, half behind
  trojanSpread: 12, // degrees either side of sixty, or so
  asteroids: 1400,
  belt: [2.1, 3.3], // AU
  beltEccentric: 0.2, // eccentricity of its most eccentric
  kuiper: [33, 50], // AU: the rest of the dots
  kuiperEccentric: 0.12,
  sun: 7, // px
  sunDots: 100,
  flungOut: 0.8, // share of the screen diagonal: further than this and unbound, it is lost
  chase: 0.01, // how hard the spring pulls the Sun towards the cursor
  calm: 0.86, // how much of its speed the Sun keeps each frame
  shake: 0.1, // share of the Sun's kicks its system feels: the whole of it undoes everything at a stroke
  steady: 0.6, // px per frame^2: the Sun accelerating no harder than this, nothing is felt
  gather: 70, // frames the dots take to fly from the pattern onto their orbits
};

let keplerTime = 0;
let keplerStar = { x: 0, y: 0, vx: 0, vy: 0 };
// Each body's place and velocity relative to what it goes round, and the ellipse
// it began on, for when it has to start again: semi-latus rectum, eccentricity
// vector (pointing to its closest approach), and the speed scale that goes with
// them, signed by which way round it goes. The first keplerDots are dots, indexed
// as in whiteElements; after them, the planets.
let keplerX = new Float64Array(0);
let keplerY = new Float64Array(0);
let keplerVX = new Float64Array(0);
let keplerVY = new Float64Array(0);
let keplerP = new Float64Array(0);
let keplerEX = new Float64Array(0);
let keplerEY = new Float64Array(0);
let keplerW = new Float64Array(0);
let keplerDots = 0;
let keplerBodyDots = 0; // the first this many dots draw the planets
let keplerBodyOf = new Uint8Array(0); // which planet each of those draws
let keplerBodyX = new Float32Array(0); // and its place in the clump
let keplerBodyY = new Float32Array(0);
let keplerMoonFrom = 0; // after the Sun's dots, from here on, the moons and rings
let keplerMoonOf = new Uint8Array(0); // which planet each of those goes round
let keplerFrom = 0; // and from here on, what goes round the Sun
// For each planet: the pull everything else feels from it, the pull its moons
// feel, the softening of its pull (it has a size), and where it is this frame.
let keplerPull = new Float64Array(0);
let keplerMoonPull = new Float64Array(0);
let keplerSoft = new Float64Array(0);
let keplerAtX = new Float64Array(0);
let keplerAtY = new Float64Array(0);
let keplerHeavy = []; // the planets heavy enough to matter
let keplerFromX = new Float32Array(0); // where the dots were in the pattern
let keplerFromY = new Float32Array(0);

function keplerBetween(range, k) {
  return range[0] + (range[1] - range[0]) * k;
}

function keplerTurn(angle) {
  const whole = Math.PI * 2;
  return ((angle % whole) + whole) % whole;
}

function keplerTarget() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  return { x: canvas.width / 2, y: canvas.height / 2 };
}

// Gives body i its ellipse: semi-major axis, eccentricity, the angle to its
// closest approach, which way round (on screen, -1 anticlockwise), and the pull
// of what it goes round.
function keplerOrbit(i, a, e, angle, way, mu) {
  const p = a * (1 - e * e);
  keplerP[i] = p;
  keplerEX[i] = e * Math.cos(angle);
  keplerEY[i] = e * Math.sin(angle);
  keplerW[i] = way * Math.sqrt(mu / p);
}

// The eccentric anomaly for a mean anomaly from 0 to 2π: Kepler's equation, by
// Newton's method, from π, which converges for any eccentricity.
function keplerAnomaly(m, e) {
  const back = m > Math.PI;
  const t = back ? Math.PI * 2 - m : m;
  let anomaly = Math.PI;
  for (let k = 0; k < 12; k++) {
    anomaly -= (anomaly - e * Math.sin(anomaly) - t) / (1 - e * Math.cos(anomaly));
  }
  return back ? Math.PI * 2 - anomaly : anomaly;
}

// Puts body i on the ellipse it was given at mean anomaly m, 0 to 2π: its place
// in its year, by time.
function keplerPlace(i, m) {
  const ex = keplerEX[i];
  const ey = keplerEY[i];
  const e = Math.sqrt(ex * ex + ey * ey);
  const anomaly = keplerAnomaly(m, e);
  const r = (keplerP[i] / (1 - e * e)) * (1 - e * Math.cos(anomaly));
  const half = anomaly / 2;
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(half), Math.sqrt(1 - e) * Math.cos(half));
  const w = keplerW[i];
  const theta = Math.atan2(ey, ex) + (w > 0 ? nu : -nu);
  const rx = Math.cos(theta);
  const ry = Math.sin(theta);
  keplerX[i] = r * rx;
  keplerY[i] = r * ry;
  // The hodograph: a Keplerian velocity is always a circle's plus a constant.
  keplerVX[i] = -w * (ry + ey);
  keplerVY[i] = w * (rx + ex);
}

// One frame along body i's orbit round a pull of mu, exactly; gives its distance
// from what it goes round. With E the eccentric anomaly, Kepler's equation for
// the step is dE - ec sin dE + es (1 - cos dE) = n, and the step's Gauss f and g
// functions turn the old place and velocity into the new, with no need of the
// angles of the ellipse itself.
function keplerDrift(i, mu) {
  const x = keplerX[i];
  const y = keplerY[i];
  const vx = keplerVX[i];
  const vy = keplerVY[i];
  const r = Math.sqrt(x * x + y * y);
  // One over the semi-major axis, from the energy.
  const alpha = 2 / r - (vx * vx + vy * vy) / mu;
  if (alpha <= 1e-5) {
    // Unbound: Kepler's laws say nothing of it, so a plain step.
    const pull = mu / (r * r * r);
    keplerVX[i] = vx - x * pull;
    keplerVY[i] = vy - y * pull;
    keplerX[i] = x + keplerVX[i];
    keplerY[i] = y + keplerVY[i];
    return Math.sqrt(keplerX[i] * keplerX[i] + keplerY[i] * keplerY[i]);
  }
  const a = 1 / alpha;
  const n = Math.sqrt(mu * alpha * alpha * alpha);
  const ec = 1 - r * alpha;
  const es = (x * vx + y * vy) * Math.sqrt(alpha / mu);
  let dE = (n * a) / r;
  for (let k = 0; k < 8; k++) {
    const sin = Math.sin(dE);
    const cos = Math.cos(dE);
    const off = (dE - ec * sin + es * (1 - cos) - n) / (1 - ec * cos + es * sin);
    dE -= off;
    if (off < 1e-11 && off > -1e-11) break;
  }
  const sin = Math.sin(dE);
  const cos = Math.cos(dE);
  const r1 = a * (1 - ec * cos + es * sin);
  const f = 1 - (a / r) * (1 - cos);
  const g = 1 + (sin - dE) / n;
  const fDot = (-Math.sqrt(mu * a) / (r * r1)) * sin;
  const gDot = 1 - (a / r1) * (1 - cos);
  keplerX[i] = f * x + g * vx;
  keplerY[i] = f * y + g * vy;
  keplerVX[i] = fDot * x + gDot * vx;
  keplerVY[i] = fDot * y + gDot * vy;
  return r1;
}

function startKepler() {
  const n = whiteElements.length;
  const side = Math.min(canvas.width, canvas.height);
  const target = keplerTarget();
  const mu = kepler.gm;
  keplerTime = 0;
  keplerStar = { x: target.x, y: target.y, vx: 0, vy: 0 };

  // Distances squeezed, Neptune's where it was asked for.
  const unit = (kepler.reach * side) / Math.pow(KEPLER_PLANETS[KEPLER_PLANETS.length - 1].au, kepler.squeeze);
  function distance(au) {
    return unit * Math.pow(au, kepler.squeeze);
  }

  const planets = KEPLER_PLANETS.length;
  keplerDots = n;
  keplerX = new Float64Array(n + planets);
  keplerY = new Float64Array(n + planets);
  keplerVX = new Float64Array(n + planets);
  keplerVY = new Float64Array(n + planets);
  keplerP = new Float64Array(n + planets);
  keplerEX = new Float64Array(n + planets);
  keplerEY = new Float64Array(n + planets);
  keplerW = new Float64Array(n + planets);
  keplerFromX = new Float32Array(n);
  keplerFromY = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    keplerFromX[i] = whiteElements[i].x;
    keplerFromY[i] = whiteElements[i].y;
  }

  // The planets, each where it is today: its longitude from J2000 by its mean
  // rate. On screen, longitudes run anticlockwise, seen from the north.
  keplerPull = new Float64Array(planets);
  keplerMoonPull = new Float64Array(planets);
  keplerSoft = new Float64Array(planets);
  keplerAtX = new Float64Array(planets);
  keplerAtY = new Float64Array(planets);
  keplerHeavy = [];
  const centuries = (Date.now() - Date.UTC(2000, 0, 1, 12)) / (36525 * 86400000);
  const degrees = Math.PI / 180;
  KEPLER_PLANETS.forEach(function (planet, k) {
    const i = n + k;
    keplerOrbit(i, distance(planet.au), planet.e, -planet.perihelion * degrees, -1, mu);
    keplerPlace(i, keplerTurn((planet.longitude + planet.rate * centuries - planet.perihelion) * degrees));
    keplerPull[k] = planet.mass * kepler.weight * mu;
    keplerMoonPull[k] = Math.max(1, keplerPull[k]);
    keplerSoft[k] = planet.size * planet.size;
    if (planet.mass > 1e-5) keplerHeavy.push(k);
  });

  // Each planet a clump of dots.
  let i = 0;
  const bodyOf = [];
  KEPLER_PLANETS.forEach(function (planet, k) {
    for (let d = 0; d < planet.dots && i < n; d++, i++) bodyOf.push(k);
  });
  keplerBodyDots = i;
  keplerBodyOf = Uint8Array.from(bodyOf);
  keplerBodyX = new Float32Array(i);
  keplerBodyY = new Float32Array(i);
  for (let j = 0; j < i; j++) {
    const r = Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    keplerBodyX[j] = Math.cos(a) * r;
    keplerBodyY[j] = Math.sin(a) * r;
  }

  // The moons, then Saturn's rings, even over their area, with a gap for Cassini's.
  keplerMoonFrom = Math.min(n, i + Math.max(0, Math.round(kepler.sunDots)));
  i = keplerMoonFrom;
  const moonOf = [];
  function satellite(k, a, e, way, m) {
    if (i >= n) return;
    keplerOrbit(i, a, e, Math.random() * Math.PI * 2, way, keplerMoonPull[k]);
    keplerPlace(i, m);
    moonOf.push(k);
    i++;
  }
  KEPLER_PLANETS.forEach(function (planet, k) {
    for (const a of planet.moons) {
      satellite(k, Math.abs(a), 0.01, a < 0 ? 1 : -1, Math.random() * Math.PI * 2);
    }
    if (!planet.rings) return;
    let area = 0;
    for (const [inner, outer] of planet.rings) area += outer * outer - inner * inner;
    for (const [inner, outer] of planet.rings) {
      const dots = Math.round((kepler.ringDots * (outer * outer - inner * inner)) / area);
      for (let d = 0; d < dots; d++) {
        const a = Math.sqrt(inner * inner + Math.random() * (outer * outer - inner * inner));
        satellite(k, a, 0, -1, Math.random() * Math.PI * 2);
      }
    }
  });
  keplerMoonOf = Uint8Array.from(moonOf);
  keplerFrom = i;

  // The comets, a train of dots on each ellipse, the first the wrong way round,
  // as Halley's goes.
  for (let c = 0; c < Math.max(0, Math.round(kepler.comets)); c++) {
    const near = distance(keplerBetween(kepler.cometNear, Math.random()));
    const far = distance(keplerBetween(kepler.cometFar, Math.random()));
    const angle = Math.random() * Math.PI * 2;
    const m = Math.random() * Math.PI * 2;
    const stop = Math.min(n, i + Math.max(0, Math.round(kepler.cometDots)));
    for (; i < stop; i++) {
      keplerOrbit(i, (near + far) / 2, (far - near) / (far + near), angle, c === 0 ? 1 : -1, mu);
      const behind = Math.random() * Math.random() * kepler.cometTrain;
      keplerPlace(i, keplerTurn(m - behind * Math.PI * 2));
    }
  }

  // The Trojans: Jupiter's own ellipse, sixty degrees ahead of it or behind.
  const jupiter = KEPLER_PLANETS.findIndex(function (planet) {
    return planet.name === "Jupiter";
  });
  const home = KEPLER_PLANETS[jupiter];
  const jupiterM = (home.longitude + home.rate * centuries - home.perihelion) * degrees;
  const trojans = Math.min(n, i + Math.max(0, Math.round(kepler.trojans)));
  for (; i < trojans; i++) {
    const wander = (Math.random() + Math.random() + Math.random() - 1.5) * 2 * kepler.trojanSpread;
    const a = distance(home.au) * (1 + (Math.random() - 0.5) * 0.02);
    keplerOrbit(i, a, home.e, -home.perihelion * degrees, -1, mu);
    keplerPlace(i, keplerTurn(jupiterM + (((i % 2) * 2 - 1) * 60 + wander) * degrees));
  }

  // The belts: anywhere round, the ellipses lying every way.
  function belt(stop, range, eccentric) {
    for (; i < stop; i++) {
      const a = distance(keplerBetween(range, Math.random()));
      keplerOrbit(i, a, Math.random() * eccentric, Math.random() * Math.PI * 2, -1, mu);
      keplerPlace(i, Math.random() * Math.PI * 2);
    }
  }
  belt(Math.min(n, i + Math.max(0, Math.round(kepler.asteroids))), kepler.belt, kepler.beltEccentric);
  belt(n, kepler.kuiper, kepler.kuiperEccentric);
}

function stepKepler() {
  const n = keplerDots;
  const X = keplerX;
  const Y = keplerY;
  const VX = keplerVX;
  const VY = keplerVY;
  const s = keplerStar;
  const mu = kepler.gm;
  keplerTime++;

  // The Sun chases the cursor on a damped spring, and the kick that gives it is
  // felt by everything going round it, the other way; but not the first of it. A
  // gentle pull takes the whole system along together, and only a sudden jerk
  // gets through.
  const target = keplerTarget();
  const wasX = s.vx;
  const wasY = s.vy;
  s.vx = (s.vx + (target.x - s.x) * kepler.chase) * kepler.calm;
  s.vy = (s.vy + (target.y - s.y) * kepler.chase) * kepler.calm;
  s.x += s.vx;
  s.y += s.vy;
  const pushed = Math.hypot(s.vx - wasX, s.vy - wasY);
  const felt = kepler.shake * Math.max(0, 1 - kepler.steady / (pushed || 1));
  const kickX = (s.vx - wasX) * felt;
  const kickY = (s.vy - wasY) * felt;

  // Where the heavy planets are, and the tug they give the Sun, which everything
  // measured from the Sun feels the other way.
  const planets = X.length - n;
  const atX = keplerAtX;
  const atY = keplerAtY;
  const pulls = keplerPull;
  const soft = keplerSoft;
  const heavy = keplerHeavy;
  let tugX = 0;
  let tugY = 0;
  for (let k = 0; k < planets; k++) {
    atX[k] = X[n + k];
    atY[k] = Y[n + k];
  }
  for (let h = 0; h < heavy.length; h++) {
    const k = heavy[h];
    const r2 = atX[k] * atX[k] + atY[k] * atY[k];
    const pull = pulls[k] / (r2 * Math.sqrt(r2));
    tugX += atX[k] * pull;
    tugY += atY[k] * pull;
  }

  const lost = kepler.flungOut * Math.hypot(canvas.width, canvas.height);
  const total = X.length;
  for (let i = keplerFrom; i < total; i++) {
    const x0 = X[i];
    const y0 = Y[i];
    const share = i < n ? 1 : 1 / Math.max(1, kepler.weight);
    let vx = VX[i] - kickX - tugX * share;
    let vy = VY[i] - kickY - tugY * share;
    // The heavy planets' pull, as a kick between one frame's stretch of ellipse
    // and the next: softened by each one's size, so a body can pass through.
    for (let h = 0; h < heavy.length; h++) {
      const k = heavy[h];
      if (i === n + k) continue;
      const dx = atX[k] - x0;
      const dy = atY[k] - y0;
      const d2 = dx * dx + dy * dy + soft[k];
      const pull = (pulls[k] * share) / (d2 * Math.sqrt(d2));
      vx += dx * pull;
      vy += dy * pull;
    }
    VX[i] = vx;
    VY[i] = vy;
    const r = Math.sqrt(x0 * x0 + y0 * y0);
    if (r < kepler.sun || (r > lost && 2 / r - (vx * vx + vy * vy) / mu <= 0)) {
      // Fallen into the Sun or flung right out: back where it began.
      keplerPlace(i, Math.random() * Math.PI * 2);
    } else {
      keplerDrift(i, mu);
    }
    if (i < n) {
      const e = whiteElements[i];
      e.x = s.x + X[i];
      e.y = s.y + Y[i];
    }
  }

  // The moons and Saturn's rings, each going round its planet, with it wherever
  // it is taken.
  for (let i = keplerMoonFrom; i < keplerFrom; i++) {
    const k = keplerMoonOf[i - keplerMoonFrom];
    keplerDrift(i, keplerMoonPull[k]);
    const e = whiteElements[i];
    e.x = s.x + X[n + k] + X[i];
    e.y = s.y + Y[n + k] + Y[i];
  }

  // The planets' clumps, turning slowly about themselves.
  const spin = keplerTime * 0.05;
  const spinCos = Math.cos(spin);
  const spinSin = Math.sin(spin);
  for (let i = 0; i < keplerBodyDots; i++) {
    const k = keplerBodyOf[i];
    const size = KEPLER_PLANETS[k].size;
    const e = whiteElements[i];
    e.x = s.x + X[n + k] + (keplerBodyX[i] * spinCos - keplerBodyY[i] * spinSin) * size;
    e.y = s.y + Y[n + k] + (keplerBodyX[i] * spinSin + keplerBodyY[i] * spinCos) * size;
  }
  // The Sun.
  const sunDots = keplerMoonFrom - keplerBodyDots;
  for (let i = keplerBodyDots; i < keplerMoonFrom; i++) {
    const a = (i * 2.4) % (Math.PI * 2);
    const r = kepler.sun * Math.sqrt((i - keplerBodyDots + 0.5) / sunDots);
    whiteElements[i].x = s.x + Math.cos(a) * r;
    whiteElements[i].y = s.y + Math.sin(a) * r;
  }

  // At first the dots fly in from wherever the pattern left them.
  if (keplerTime < kepler.gather) {
    const t = keplerTime / kepler.gather;
    const k = t * t * (3 - 2 * t);
    for (let i = 0; i < n; i++) {
      const e = whiteElements[i];
      e.x = keplerFromX[i] + (e.x - keplerFromX[i]) * k;
      e.y = keplerFromY[i] + (e.y - keplerFromY[i]) * k;
    }
  }
}

registerBackground("kepler", {
  start: startKepler,
  step: stepKepler,
  settings: kepler,
  lab: true,
});
