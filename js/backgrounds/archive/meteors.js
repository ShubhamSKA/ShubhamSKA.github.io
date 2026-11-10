// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js and meteors-sky.js.

// ---- Shooting stars ------------------------------------------------------------
// Lying back under the real night sky: a patch of it, picked at random each
// time round one of the constellations, as wide as the eye takes in. The stars
// are where they really are and as bright: the constellations' and the
// brightest of the rest from a catalogue, the very brightest a small cross,
// and thousands of faint ones besides, thicker towards the Milky Way. That
// runs where it really does too, a haze of fainter stars still, broad and
// bright towards the centre of the galaxy in Sagittarius, with star clouds
// along it and dark lanes through it: the Great Rift from Cygnus down to
// Ophiuchus, the Pipe, the Coalsack by the Southern Cross. The sky turns
// slowly about the pole, faster than it really does but still only just, and
// the stars twinkle. Over a constellation, the cursor draws its figure line by
// line, brightens its stars and writes its name beneath; away, it fades.
// Without a cursor, the constellations in view take turns.
// Meteor showers fall across it in waves: in each, dozens of shooting stars
// fly out from one radiant, far off across the sky, so they all run the same
// way, each along its own great circle, and longest furthest from the radiant;
// thickest round the cursor, swelling and dying away again; then, after a
// pause, the next, from somewhere else. Each meteor has a bright head and a
// tail tapering behind it, flares up and fades as it burns, and the brightest
// leave a glowing train along their path that lingers, twists in the wind
// high up and fades.
// Dots: the stars, brightest first, as many as the sky may take; then the
// figures and their names, the trains and the meteors; the rest are parked
// out of sight. Each brings its own light: the stars as bright as they are.
const meteors = {
  view: [105, 130], // degrees of sky across the screen's diagonal, least to most
  stars: 9000, // faint stars over the whole sky, besides the catalogue's
  milky: 9000, // fainter ones still, making the Milky Way
  budget: 3000, // most dots the stars may take; the faintest go first
  turn: 0.003, // degrees the sky turns about the pole a frame
  twinkle: 0.35, // how deeply the stars twinkle
  reach: 60, // px from a constellation's figure at which the cursor draws it
  rate: 0.5, // meteors a frame at the height of a shower
  shower: [150, 300], // frames a shower lasts, least to most
  pause: [40, 120], // frames between showers, least to most
  speed: [12, 22], // px per frame, the slowest shower's to the fastest's
  life: [25, 55], // frames a meteor burns, least to most
  tail: [60, 160], // px its tail reaches behind it at its brightest, least to most
  near: 0.55, // share of a shower's meteors that cross the sky close to the cursor
  trains: 0.3, // share of meteors bright enough to leave a train
  trainLife: [70, 160], // frames a train lingers, least to most
};

const METEOR_RAD = Math.PI / 180;
// Turning equatorial directions into galactic ones (J2000), by rows; its
// transpose turns them back.
const METEOR_GALACTIC = [
  -0.0548755604, -0.8734370902, -0.4838350155, 0.4941094279, -0.44482963, 0.7469822445, -0.867666149, -0.1980763734,
  0.4559837762,
];
// Brighter star clouds along the Milky Way: galactic longitude and latitude
// and radius, in degrees, and how much brighter.
const METEOR_CLOUDS = [
  [2, -4, 5, 1.6], // the Large Sagittarius Star Cloud
  [12, -1, 3, 0.8], // the Small Sagittarius Star Cloud
  [27, -2, 3, 1.0], // the Scutum Star Cloud
  [76, 1, 6, 0.8], // the Cygnus Star Cloud
  [287, -1, 5, 0.8], // round Eta Carinae
  [330, -3, 8, 0.5], // through Norma and Centaurus
];
// And dark ones: longitude, latitude and radius.
const METEOR_DARK = [
  [301, -1, 3], // the Coalsack
  [357, 6, 3], // the Pipe Nebula
  [353, 17, 4], // round Rho Ophiuchi
];

let meteorTime = 0;
// Every star in the sky: its direction, x, y and z, and how bright, 0 to 1;
// the catalogue's first, then the faint ones, then the Milky Way's.
let meteorStars = new Float32Array(0);
let meteorSize = new Uint8Array(0); // how each is drawn: 0 a dot, 1 a faint cross, 2 a cross, 3 a big one
let meteorOrder = new Uint32Array(0); // the stars to draw, brightest first
let meteorNearby = new Uint32Array(0); // those near enough where we look to be on the screen, still in order
let meteorGathered = NaN; // how far the sky had turned when they were gathered
let meteorHaze = 0; // where the Milky Way's begin
let meteorDot = new Int32Array(0); // the dot each catalogue star is drawn with this frame, or -1
// The constellations: their stars in meteorStars, where those are on the
// screen this frame and the box round them, and how far drawn their figures.
let meteorFigures = []; // { name, at, lines, centre, fade, x, y, box, shown }
let meteorTour = { figure: -1, left: 0 }; // without a cursor, the constellation showing, and for how long
let meteorLit = new Float32Array(0); // each dot's light, this frame
// Where we look, on the sky: straight ahead, and the screen's right and up;
// how much sky the screen's diagonal spans, and how far the sky has turned.
let meteorView = { ahead: [1, 0, 0], right: [0, -1, 0], up: [0, 0, 1], wide: 2, turned: 0 };
// The same, this frame, turned, with the screen's middle and px per unit.
const meteorEye = { ahead: [1, 0, 0], right: [0, -1, 0], up: [0, 0, 1], cx: 0, cy: 0, scale: 1, edge: 0 };
let meteorX = 0;
let meteorY = 0;
let meteorList = []; // { from, along, start, pace, age, life, bright, tail }
let meteorTrains = []; // { x0, y0, x1, y1, age, life, beat }
// The shower falling, or about to: its radiant, how fast and how far through
// it is; or, between showers, how long until the next.
let meteorShower = { radiant: [0, 0, 1], speed: 15, tail: 100, age: 0, life: 0, wait: 20 };

function meteorBetween(range, k) {
  return range[0] + (range[1] - range[0]) * k;
}

function meteorRamp(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function meteorGauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2;
}

function meteorUnit(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function meteorCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function meteorInner(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// A direction on the sky, from right ascension in hours and declination.
function meteorDirection(ra, dec) {
  const a = ra * 15 * METEOR_RAD;
  const d = dec * METEOR_RAD;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

// And from galactic longitude and latitude, in degrees.
function meteorFromGalactic(l, b) {
  const T = METEOR_GALACTIC;
  const g0 = Math.cos(b * METEOR_RAD) * Math.cos(l * METEOR_RAD);
  const g1 = Math.cos(b * METEOR_RAD) * Math.sin(l * METEOR_RAD);
  const g2 = Math.sin(b * METEOR_RAD);
  return [T[0] * g0 + T[3] * g1 + T[6] * g2, T[1] * g0 + T[4] * g1 + T[7] * g2, T[2] * g0 + T[5] * g1 + T[8] * g2];
}

// Degrees between two longitudes, -180 to 180.
function meteorAcross(a, b) {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

// Where a direction on the sky falls on the screen, stereographically, as a
// wide lens sees it: into meteorX and meteorY. Gives how nearly ahead it is,
// 1 dead ahead.
function meteorProject(x, y, z) {
  const eye = meteorEye;
  const a = eye.ahead;
  const r = eye.right;
  const u = eye.up;
  const ahead = x * a[0] + y * a[1] + z * a[2];
  const k = (2 * eye.scale) / (1 + Math.max(ahead, -0.9));
  meteorX = eye.cx + k * (x * r[0] + y * r[1] + z * r[2]);
  meteorY = eye.cy - k * (x * u[0] + y * u[1] + z * u[2]);
  return ahead;
}

// And back: the direction on the sky behind a point on the screen.
function meteorUnproject(sx, sy) {
  const eye = meteorEye;
  const X = (sx - eye.cx) / eye.scale;
  const Y = (eye.cy - sy) / eye.scale;
  const r2 = X * X + Y * Y;
  const ahead = (4 - r2) / (4 + r2);
  const out = 4 / (4 + r2);
  const v = [];
  for (let k = 0; k < 3; k++) v.push(ahead * eye.ahead[k] + out * (X * eye.right[k] + Y * eye.up[k]));
  return v;
}

// How bright a star of a magnitude looks, 0 to 1, and how big it is drawn.
function meteorBright(mag) {
  return Math.max(0.15, Math.min(1, 1 - 0.125 * (mag - 1)));
}

function meteorBig(mag) {
  return mag < 0.5 ? 3 : mag < 1.5 ? 2 : mag < 2.5 ? 1 : 0;
}

function startMeteors() {
  meteorTime = 0;
  meteorList = [];
  meteorTrains = [];
  meteorShower = { radiant: [0, 0, 1], speed: 15, tail: 100, age: 0, life: 0, wait: 20 };
  meteorTour = { figure: -1, left: 0 };
  const stars = [];
  const sizes = [];
  function add(v, bright, size) {
    stars.push(v[0], v[1], v[2], bright);
    sizes.push(size);
    return sizes.length - 1;
  }

  // The catalogue: the constellations' stars, once each, though some belong
  // to two, then the bright ones between them.
  const seen = new Map();
  meteorFigures = SKY_CONSTELLATIONS.map(function (figure) {
    const at = [];
    const centre = [0, 0, 0];
    for (const [ra, dec, mag] of figure.stars) {
      const v = meteorDirection(ra, dec);
      const key = ra + "," + dec;
      if (!seen.has(key)) seen.set(key, add(v, meteorBright(mag), meteorBig(mag)));
      at.push(seen.get(key));
      for (let k = 0; k < 3; k++) centre[k] += v[k];
    }
    return {
      name: figure.name,
      at,
      lines: figure.lines,
      centre: meteorUnit(centre),
      fade: 0,
      x: new Float32Array(at.length),
      y: new Float32Array(at.length),
      box: [0, 0, 0, 0],
      shown: false,
    };
  });
  for (const [ra, dec, mag] of SKY_BRIGHT) add(meteorDirection(ra, dec), meteorBright(mag), meteorBig(mag));
  meteorDot = new Int32Array(sizes.length);

  // Faint stars all over the sky, more of them the fainter, and thicker
  // towards the galactic plane.
  const T = METEOR_GALACTIC;
  const field = Math.max(0, Math.round(meteors.stars));
  for (let i = 0, tries = 0; i < field && tries < field * 10; tries++) {
    const z = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const v = [r * Math.cos(a), r * Math.sin(a), z];
    const b = Math.asin(T[6] * v[0] + T[7] * v[1] + T[8] * v[2]) / METEOR_RAD;
    if (Math.random() > 0.4 + 0.6 * Math.exp(-(b * b) / 450)) continue;
    const mag = 2.5 + Math.log(1 + 62 * Math.random()) / 1.036;
    add(v, meteorBright(mag), 0);
    i++;
  }

  // The Milky Way: fainter stars still, along the galactic plane, broad and
  // thick towards the centre, thinning towards the anticentre; brighter in
  // the star clouds, darker in the Great Rift and the dark clouds.
  meteorHaze = sizes.length;
  const milky = Math.max(0, Math.round(meteors.milky));
  for (let i = 0, tries = 0; i < milky && tries < milky * 20; tries++) {
    const l = meteorAcross(Math.random() < 0.5 ? Math.random() * 360 : meteorGauss() * 50, 0);
    const b = meteorGauss() * (3.5 + 5.5 * Math.exp(-Math.pow(l / 35, 2)));
    let keep = 1;
    for (const [cl, cb, r, more] of METEOR_CLOUDS) {
      const dl = meteorAcross(l, cl);
      keep += more * Math.exp(-(dl * dl + (b - cb) * (b - cb)) / (2 * r * r));
    }
    keep /= 2.6;
    // The Great Rift, a lane just north of the plane from Cygnus down to
    // Ophiuchus, wavering and widening as it goes.
    const rift = meteorRamp(-25, -10, l) * (1 - meteorRamp(70, 85, l));
    if (rift > 0) {
      const mid = 1.5 + 1.5 * Math.sin(l * 0.07 + 0.5);
      const half = 2 + Math.sin(l * 0.13);
      keep *= 1 - 0.85 * rift * Math.exp(-Math.pow((b - mid) / half, 2));
    }
    for (const [cl, cb, r] of METEOR_DARK) {
      const dl = meteorAcross(l, cl);
      keep *= 1 - 0.9 * Math.exp(-(dl * dl + (b - cb) * (b - cb)) / (2 * r * r));
    }
    if (Math.random() > keep) continue;
    add(meteorFromGalactic(l, b), 0.12 + 0.1 * Math.random(), 0);
    i++;
  }
  meteorStars = new Float32Array(stars);
  meteorSize = new Uint8Array(sizes);
  // Brightest first, so that where the sky has more than its dots, the
  // faintest are the ones left out; the haze last, in no order, so it thins
  // evenly.
  const order = [];
  for (let s = 0; s < meteorHaze; s++) order.push(s);
  order.sort(function (a, b) {
    return meteorStars[b * 4 + 3] - meteorStars[a * 4 + 3];
  });
  for (let s = meteorHaze; s < sizes.length; s++) order.push(s);
  meteorOrder = new Uint32Array(order);
  meteorGathered = NaN;
  meteorLit = new Float32Array(whiteElements.length);

  // Where we look: round one of the constellations, picked at random, give or
  // take 20°, and turned any way within 40° of north up.
  const c = meteorFigures[Math.floor(Math.random() * meteorFigures.length)].centre;
  const side = meteorUnit(meteorCross(c, Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const side2 = meteorCross(c, side);
  const way = Math.random() * Math.PI * 2;
  const off = Math.random() * 20 * METEOR_RAD;
  const ahead = [];
  for (let k = 0; k < 3; k++) {
    ahead.push(Math.cos(off) * c[k] + Math.sin(off) * (Math.cos(way) * side[k] + Math.sin(way) * side2[k]));
  }
  const view = { ahead: meteorUnit(ahead), right: [], up: [], wide: 0, turned: 0 };
  const towardsEast = meteorCross([0, 0, 1], view.ahead);
  const east = Math.hypot(...towardsEast) > 1e-6 ? meteorUnit(towardsEast) : [0, 1, 0];
  const north = meteorCross(view.ahead, east);
  // Looking up, east is to the left of north.
  const roll = (Math.random() - 0.5) * 80 * METEOR_RAD;
  for (let k = 0; k < 3; k++) {
    view.right.push(-Math.cos(roll) * east[k] + Math.sin(roll) * north[k]);
    view.up.push(Math.sin(roll) * east[k] + Math.cos(roll) * north[k]);
  }
  view.wide = meteorBetween(meteors.view, Math.random()) * METEOR_RAD;
  meteorView = view;
}

function meteorCursor() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  return { x: Math.random() * canvas.width, y: Math.random() * canvas.height };
}

// A new shower: its radiant, somewhere far off across the sky from where we
// look and mostly above, so its meteors mostly run downwards; a speed; how
// long it lasts.
function meteorNewShower() {
  const eye = meteorEye;
  const a = Math.PI / 2 + (Math.random() - 0.5) * 2.6;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const far = (75 + Math.random() * 25) * METEOR_RAD;
  const radiant = [];
  for (let k = 0; k < 3; k++) {
    const along = dx * eye.right[k] - dy * eye.up[k];
    radiant.push(Math.cos(far) * eye.ahead[k] - Math.sin(far) * along);
  }
  const fast = Math.random();
  meteorShower = {
    radiant,
    speed: meteorBetween(meteors.speed, fast),
    tail: meteorBetween(meteors.tail, 0.3 + 0.7 * fast),
    age: 0,
    life: meteorBetween(meteors.shower, Math.random()),
    wait: 0,
  };
}

// A meteor of the shower, crossing the sky somewhere, often close to the
// cursor: along the great circle from the radiant through there, as fast and
// as long as the shower's, give or take, the further from the radiant the
// longer.
function meteorLaunch() {
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  const shower = meteorShower;
  let x;
  let y;
  if (Math.random() < meteors.near) {
    const c = meteorCursor();
    x = c.x + (Math.random() + Math.random() + Math.random() - 1.5) * side * 0.35;
    y = c.y + (Math.random() + Math.random() + Math.random() - 1.5) * side * 0.35;
  } else {
    x = Math.random() * w;
    y = Math.random() * h;
  }
  const from = meteorUnproject(x, y);
  const r = shower.radiant;
  const toward = meteorInner(from, r);
  const along = [];
  for (let k = 0; k < 3; k++) along.push(from[k] * toward - r[k]);
  const away = Math.hypot(along[0], along[1], along[2]);
  if (away < 0.05) return;
  for (let k = 0; k < 3; k++) along[k] /= away;
  const life = meteorBetween(meteors.life, Math.random());
  const pace = ((shower.speed * (0.85 + Math.random() * 0.3)) / meteorEye.scale) * away;
  // It passes the point picked about a third of the way through.
  meteorList.push({
    from,
    along,
    start: -pace * life * 0.35,
    pace,
    age: 0,
    life,
    bright: 0.35 + 0.65 * Math.pow(Math.random(), 1.5),
    tail: ((shower.tail * (0.7 + Math.random() * 0.6)) / meteorEye.scale) * away,
  });
}

// Where a meteor is, an angle along its great circle, on the screen.
function meteorPlace(m, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return meteorProject(c * m.from[0] + s * m.along[0], c * m.from[1] + s * m.along[1], c * m.from[2] + s * m.along[2]);
}

function meteorToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - u * dx, y - ay - u * dy);
}

// Whether a point is inside the outline round some points: their convex
// hull, by Andrew's monotone chain.
function meteorInside(xs, ys, count, x, y) {
  const order = [];
  for (let j = 0; j < count; j++) order.push(j);
  order.sort(function (a, b) {
    return xs[a] - xs[b] || ys[a] - ys[b];
  });
  function turn(o, a, b) {
    return (xs[a] - xs[o]) * (ys[b] - ys[o]) - (ys[a] - ys[o]) * (xs[b] - xs[o]);
  }
  const hull = [];
  for (const p of order) {
    while (hull.length >= 2 && turn(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
    hull.push(p);
  }
  const lower = hull.length + 1;
  for (let j = order.length - 2; j >= 0; j--) {
    const p = order[j];
    while (hull.length >= lower && turn(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
    hull.push(p);
  }
  hull.pop();
  if (hull.length < 3) return false;
  for (let j = 0; j < hull.length; j++) {
    const a = hull[j];
    const b = hull[(j + 1) % hull.length];
    if ((xs[b] - xs[a]) * (y - ys[a]) - (ys[b] - ys[a]) * (x - xs[a]) < 0) return false;
  }
  return true;
}

// How near a point on the screen is to a constellation's figure: inside the
// outline of its stars, less than nothing, the less the nearer its middle;
// outside, how far from its nearest line.
function meteorNearness(figure, x, y, reach) {
  const box = figure.box;
  if (x < box[0] - reach || x > box[2] + reach || y < box[1] - reach || y > box[3] + reach) return Infinity;
  if (meteorInside(figure.x, figure.y, figure.at.length, x, y)) {
    return Math.hypot(x - (box[0] + box[2]) / 2, y - (box[1] + box[3]) / 2) - 1e5;
  }
  let near = Infinity;
  for (let j = 0; j < figure.lines.length; j += 2) {
    const a = figure.lines[j];
    const b = figure.lines[j + 1];
    near = Math.min(near, meteorToSegment(x, y, figure.x[a], figure.y[a], figure.x[b], figure.y[b]));
  }
  return near;
}

// Each dot's own light, set as it was placed; the faint ones show a little
// more round the cursor, where the eye is.
function meteorLight(x, y, i) {
  let lit = meteorLit[i] || 0;
  if (cursorOnPage && lit > 0 && lit < 0.6) {
    const dx = x - cursorPosition.x;
    const dy = y - cursorPosition.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 90000) lit += 0.15 * Math.exp(-d2 / 20000);
  }
  return lit;
}

function stepMeteors() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  meteorTime++;
  const time = meteorTime;
  if (meteorLit.length !== n) meteorLit = new Float32Array(n);
  let next = 0;
  function put(x, y, lit) {
    if (next >= n) return;
    meteorLit[next] = lit;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }

  // Where we look this frame, the sky turned a little further about the pole.
  const view = meteorView;
  const eye = meteorEye;
  view.turned += meteors.turn * METEOR_RAD;
  const turnCos = Math.cos(view.turned);
  const turnSin = Math.sin(view.turned);
  for (const [to, from] of [
    [eye.ahead, view.ahead],
    [eye.right, view.right],
    [eye.up, view.up],
  ]) {
    to[0] = from[0] * turnCos - from[1] * turnSin;
    to[1] = from[0] * turnSin + from[1] * turnCos;
    to[2] = from[2];
  }
  eye.cx = w / 2;
  eye.cy = h / 2;
  eye.scale = Math.hypot(w, h) / (4 * Math.tan(view.wide / 4));
  eye.edge = Math.cos(view.wide / 2 + 3 * METEOR_RAD);

  // Only the stars near where we look are worth looking at: gathered again
  // whenever the sky has turned a little further.
  const S = meteorStars;
  const [a0, a1, a2] = eye.ahead;
  if (!(Math.abs(view.turned - meteorGathered) < 2 * METEOR_RAD)) {
    const near = Math.cos(view.wide / 2 + 8 * METEOR_RAD);
    const nearby = [];
    for (const s of meteorOrder) if (S[s * 4] * a0 + S[s * 4 + 1] * a1 + S[s * 4 + 2] * a2 >= near) nearby.push(s);
    meteorNearby = Uint32Array.from(nearby);
    meteorGathered = view.turned;
  }
  // The stars, brightest first, as many as the sky may take, twinkling; the
  // brightest a small cross. Projected here as meteorProject does, inline,
  // there being so many.
  const [r0, r1, r2] = eye.right;
  const [u0, u1, u2] = eye.up;
  const twice = 2 * eye.scale;
  const budget = Math.min(n, Math.max(0, Math.round(meteors.budget)));
  meteorDot.fill(-1);
  for (let o = 0; o < meteorNearby.length && next < budget; o++) {
    const s = meteorNearby[o];
    const sx = S[s * 4];
    const sy = S[s * 4 + 1];
    const sz = S[s * 4 + 2];
    const ahead = sx * a0 + sy * a1 + sz * a2;
    if (ahead < eye.edge) continue;
    const k = twice / (1 + ahead);
    const x = eye.cx + k * (sx * r0 + sy * r1 + sz * r2);
    const y = eye.cy - k * (sx * u0 + sy * u1 + sz * u2);
    if (x < -3 || x > w + 3 || y < -3 || y > h + 3) continue;
    let lit = S[s * 4 + 3];
    if (s < meteorHaze) {
      const beat = Math.sin(time * (0.05 + 0.1 * ((s * 0.618034) % 1)) + s * 2.39996);
      if (beat > 0) lit *= 1 - meteors.twinkle * beat * beat * beat * beat * beat * beat;
    }
    if (s < meteorDot.length) meteorDot[s] = next;
    put(x, y, lit);
    const size = meteorSize[s];
    if (size) {
      const arm = lit * (size === 1 ? 0.3 : size === 2 ? 0.55 : 0.8);
      put(x + 1, y, arm);
      put(x - 1, y, arm);
      put(x, y + 1, arm);
      put(x, y - 1, arm);
      if (size === 3) {
        put(x + 2, y, lit * 0.35);
        put(x - 2, y, lit * 0.35);
        put(x, y + 2, lit * 0.35);
        put(x, y - 2, lit * 0.35);
      }
    }
  }

  // The constellations in view: where their stars are on the screen.
  const around = Math.cos(view.wide / 2 + 20 * METEOR_RAD);
  for (const figure of meteorFigures) {
    figure.shown = false;
    if (meteorInner(figure.centre, eye.ahead) < around) continue;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    let behind = false;
    for (let j = 0; j < figure.at.length; j++) {
      const s = figure.at[j];
      if (meteorProject(S[s * 4], S[s * 4 + 1], S[s * 4 + 2]) < -0.3) behind = true;
      figure.x[j] = meteorX;
      figure.y[j] = meteorY;
      box[0] = Math.min(box[0], meteorX);
      box[1] = Math.min(box[1], meteorY);
      box[2] = Math.max(box[2], meteorX);
      box[3] = Math.max(box[3], meteorY);
    }
    figure.box = box;
    figure.shown = !behind;
  }
  // Which one to draw: the one the cursor is over, or near; without a
  // cursor, the ones well in view by turns, each for a while, then a pause.
  let showing = -1;
  if (cursorOnPage) {
    let best = meteors.reach;
    for (let c = 0; c < meteorFigures.length; c++) {
      if (!meteorFigures[c].shown) continue;
      const near = meteorNearness(meteorFigures[c], cursorPosition.x, cursorPosition.y, best);
      if (near < best) {
        best = near;
        showing = c;
      }
    }
  } else {
    const tour = meteorTour;
    if (--tour.left <= 0) {
      const inView = [];
      for (let c = 0; c < meteorFigures.length; c++) {
        const box = meteorFigures[c].box;
        const fits = box[0] > 20 && box[2] < w - 20 && box[1] > 20 && box[3] < h - 60;
        if (meteorFigures[c].shown && fits && c !== tour.figure) inView.push(c);
      }
      tour.figure = inView.length ? inView[Math.floor(Math.random() * inView.length)] : -1;
      tour.left = 480;
    }
    if (tour.left > 150) showing = tour.figure;
  }

  // The figures: drawn line by line as the cursor comes, their stars
  // brightening, and their names written beneath; undrawn as it goes.
  for (let c = 0; c < meteorFigures.length; c++) {
    const figure = meteorFigures[c];
    figure.fade = Math.max(0, Math.min(1, figure.fade + (c === showing ? 0.03 : -0.05)));
    const fade = figure.fade;
    if (!fade || !figure.shown) continue;
    for (const s of figure.at) {
      const dot = meteorDot[s];
      if (dot >= 0) meteorLit[dot] = Math.min(1, meteorLit[dot] + 0.45 * fade);
    }
    const lines = figure.lines.length / 2;
    const drawn = fade * (1 + 0.4 * (lines - 1));
    const lineLit = 0.45 * Math.min(1, fade * 2);
    for (let j = 0; j < lines; j++) {
      const part = Math.min(1, drawn - 0.4 * j);
      if (part <= 0) break;
      const a = figure.lines[j * 2];
      const b = figure.lines[j * 2 + 1];
      const ax = figure.x[a];
      const ay = figure.y[a];
      const dx = figure.x[b] - ax;
      const dy = figure.y[b] - ay;
      const length = Math.hypot(dx, dy);
      // A little gap round each star, as on a star chart.
      const gap = 6;
      if (length <= gap * 2) continue;
      const end = gap + (length - gap * 2) * part;
      for (let d = gap; d <= end; d += 4) put(ax + (dx * d) / length, ay + (dy * d) / length, lineLit);
    }
    // The name, a letter at a time, below the figure, or above it at the
    // bottom of the screen.
    const name = figure.name;
    const pitch = 2;
    const wide = name.length * 6 * pitch - pitch;
    const box = figure.box;
    const x0 = Math.round(Math.max(8, Math.min(w - wide - 8, (box[0] + box[2]) / 2 - wide / 2)));
    let y0 = Math.round(box[3] + 18);
    if (y0 + 7 * pitch > h - 8) y0 = Math.round(box[1] - 18 - 7 * pitch);
    const written = Math.ceil(name.length * meteorRamp(0.35, 0.85, fade));
    const nameLit = 0.7 * meteorRamp(0.35, 0.6, fade);
    for (let j = 0; j < written; j++) {
      const glyph = SKY_LETTERS[name[j]];
      if (!glyph) continue;
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if ((glyph[row] >> (4 - col)) & 1) put(x0 + (j * 6 + col) * pitch, y0 + row * pitch, nameLit);
        }
      }
    }
  }

  // The shower: swelling and dying away, its meteors starting as often as
  // that allows; then a pause before the next.
  const shower = meteorShower;
  if (shower.age < shower.life) {
    shower.age++;
    let due = meteors.rate * Math.pow(Math.sin((Math.PI * shower.age) / shower.life), 0.6);
    while (due > 0) {
      if (Math.random() < due) meteorLaunch();
      due -= 1;
    }
    if (shower.age >= shower.life) shower.wait = meteorBetween(meteors.pause, Math.random());
  } else if (--shower.wait <= 0) {
    meteorNewShower();
  }

  // The trains, lingering, twisting and fading.
  meteorTrains = meteorTrains.filter(function (t) {
    return ++t.age < t.life;
  });
  for (const t of meteorTrains) {
    const fade = 1 - t.age / t.life;
    const dx = t.x1 - t.x0;
    const dy = t.y1 - t.y0;
    const length = Math.hypot(dx, dy) || 1;
    const px = -dy / length;
    const py = dx / length;
    const dots = Math.round((length / 4) * (0.4 + 0.6 * fade));
    const twist = 6 * (t.age / t.life);
    for (let q = 0; q < dots; q++) {
      const u = (q + 0.5) / dots;
      const sway = twist * Math.sin(u * 9 + t.beat + t.age * 0.03) + twist * 0.5 * Math.sin(u * 23 + t.beat * 2);
      put(t.x0 + dx * u + px * sway, t.y0 + dy * u + py * sway, 0.15 + 0.35 * fade);
    }
  }

  // The meteors: a head and a tail tapering behind it, flaring and fading as
  // they burn.
  meteorList = meteorList.filter(function (m) {
    m.age++;
    if (m.age < m.life) return true;
    // The brightest leave a train along the last of their path.
    if (m.bright > 1 - meteors.trains) {
      const at = m.start + m.pace * m.age;
      meteorPlace(m, at);
      const x1 = meteorX;
      const y1 = meteorY;
      meteorPlace(m, at - Math.min(m.tail * 1.5, m.pace * m.life));
      meteorTrains.push({
        x0: meteorX,
        y0: meteorY,
        x1,
        y1,
        age: 0,
        life: meteorBetween(meteors.trainLife, Math.random()),
        beat: Math.random() * 6.3,
      });
    }
    return false;
  });
  for (const m of meteorList) {
    const k = m.age / m.life;
    const glow = m.bright * Math.pow(Math.sin(Math.PI * k), 0.7) * (0.85 + 0.15 * Math.sin(time * 1.3 + m.life));
    const at = m.start + m.pace * m.age;
    if (meteorPlace(m, at) < -0.5) continue;
    const x = meteorX;
    const y = meteorY;
    const head = Math.round(1 + 4 * glow);
    for (let q = 0; q < head; q++) put(x + (q % 3) - 1, y + ((q / 3) | 0) - (q > 2 ? 0.5 : 0), 0.55 + 0.45 * glow);
    const tail = m.tail * glow;
    const dots = Math.round((tail * eye.scale) / 2.5);
    for (let q = 1; q <= dots; q++) {
      const u = q / dots;
      meteorPlace(m, at - tail * Math.pow(u, 1.5));
      const lit = Math.max(0.13, glow * Math.pow(1 - u, 1.2));
      put(meteorX + (Math.random() - 0.5) * 0.8, meteorY + (Math.random() - 0.5) * 0.8, lit);
    }
  }
  while (next < n) put(-100, -100, 0);
}

registerBackground("meteors", {
  start: startMeteors,
  step: stepMeteors,
  light: meteorLight,
  settings: meteors,
  archived: true,
});
