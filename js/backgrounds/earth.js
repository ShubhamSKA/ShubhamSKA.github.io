// The Earth background. Loaded after infinity.js and earth-map.js.

// ---- Earth -------------------------------------------------------------------
// The Earth at night, seen from space, turning slowly west to east, its axis
// leaning and its north tipped a little towards us. The edge of the disc is a
// ring of dots, with a faint haze of atmosphere round it, and the coasts are
// traced in dots; drawn in orthographic projection, so they bunch up towards
// the edge as the globe curves away, and only the near side is drawn.
// Wherever the cursor is, the land under it lights up, as densely as people
// live there: every real city a tight, bright cluster of lights, more and
// spread wider the bigger it is, with towns scattered round it and a fainter
// sprinkling over the countryside further out, all on land. A light comes on
// a little while after the cursor reaches it, the middle of a city first,
// then its towns, then the country round, flickering as it catches, and goes
// out a little while after the cursor has gone, so the lights spread and fade
// behind it. Lights are only ever on round the cursor, so every dot not
// needed for the edge and the coasts goes to them; where there are more than
// that, an even share of them comes on, so the density still tells.
// Without a cursor a point wanders over the globe instead. Scrolling turns the
// globe over the way the page goes, its near side up as the page scrolls up,
// into the screen and out of it, carried on a little after, like a flicked
// globe slowing.
// Dots: the edge and its haze, the coasts, then the lights that are on; the
// rest are parked out of sight.
const earth = {
  radius: 0.42, // share of the shorter side
  spin: 0.075, // degrees the Earth turns each frame
  scroll: 0.004, // degrees a frame it turns over on by, for every px scrolled
  lean: 23.4, // degrees its axis leans in the picture
  view: 12, // degrees north of the equator it is seen from
  reach: 0.3, // how far round the cursor the lights come on, share of the radius
  coast: 0.8, // degrees between dots along the coasts
  edge: 600, // dots round the edge
  haze: [240, 120], // dots in the rings of haze just outside it
  lights: 40000, // lights over the whole Earth, shared out by how many live where
  weight: 0.85, // a city's share of them, by its millions to this power
  middle: 0.5, // share of a city's lights in its middle
  country: 0.2, // share scattered over the country round it; the rest are its towns
  lightUp: [4, 60], // frames a light takes to come on once the cursor is there, least to most
  lightOut: [10, 120], // and to go out once it has gone
};

const EARTH_RAD = Math.PI / 180;
let earthMask = null; // land, every half degree: 720 across from 180°W, 360 down from 90°N
let earthCoast = new Float32Array(0); // points on the unit sphere, x y z
let earthLights = new Float32Array(0);
let earthTier = new Uint8Array(0); // each light: 0 in a city's middle, 1 a town, 2 the country
let earthSeed = new Float32Array(0); // each light's own randomness, 0 to 1: when it changes
let earthThin = new Float32Array(0); // and whether it is among those that come on, crowded
let earthRagged = new Float32Array(0); // and how far from the cursor it still comes on
let earthLit = new Uint8Array(0);
let earthWait = new Int16Array(0); // frames until a light changes, or -1
let earthFlicker = new Uint8Array(0); // frames of flickering left as it catches
let earthWithin = 0; // lights near enough the cursor to come on, last frame
let earthTurn = 0; // degrees the Earth has turned
let earthTip = 0; // degrees scrolling has turned it over, about the screen's level
let earthTipSpeed = 0; // degrees a frame it is turning over
// Scrolling, by the wheel or by the page moving, px since the last frame. The
// wheel scrolls the page too, so for a moment after it the page's own
// scrolling is not counted again.
let earthWheel = 0;
let earthWheelAt = 0;
let earthScrolled = 0;
let earthScrollY = window.scrollY;
window.addEventListener(
  "wheel",
  function (event) {
    earthWheel += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
    earthWheelAt = performance.now();
  },
  { passive: true }
);
window.addEventListener(
  "scroll",
  function () {
    if (performance.now() - earthWheelAt > 400) earthScrolled += window.scrollY - earthScrollY;
    earthScrollY = window.scrollY;
  },
  { passive: true }
);
let earthTime = 0;

// Fills the half-degree mask from the outlines: even-odd along each row of
// latitude, so outlines that run past 180° wrap round.
function earthFill(polygons, value) {
  for (const p of polygons) {
    for (let j = 0; j < 360; j++) {
      const lat = 90 - (j + 0.5) * 0.5;
      const xs = [];
      for (let k = 0; k < p.length; k += 2) {
        const m = (k + 2) % p.length;
        const y0 = p[k + 1];
        const y1 = p[m + 1];
        if (y0 <= lat !== y1 <= lat) xs.push(p[k] + ((lat - y0) / (y1 - y0)) * (p[m] - p[k]));
      }
      xs.sort(function (a, b) {
        return a - b;
      });
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const from = Math.ceil((xs[q] + 180) * 2 - 0.5);
        const to = Math.floor((xs[q + 1] + 180) * 2 - 0.5);
        for (let i = from; i <= to; i++) earthMask[j * 720 + (((i % 720) + 720) % 720)] = value;
      }
    }
  }
}

function earthIsLand(lon, lat) {
  const i = Math.floor((lon + 180) * 2);
  const j = Math.min(359, Math.max(0, Math.floor((90 - lat) * 2)));
  return earthMask[j * 720 + (((i % 720) + 720) % 720)] === 1;
}

// The point at `lon`, `lat` on the unit sphere, x towards 0°, z north.
function earthPush(list, lon, lat) {
  const c = Math.cos(lat * EARTH_RAD);
  list.push(c * Math.cos(lon * EARTH_RAD), c * Math.sin(lon * EARTH_RAD), Math.sin(lat * EARTH_RAD));
}

// The map, laid out once: the mask and the coasts.
function earthMap() {
  earthMask = new Uint8Array(720 * 360);
  earthFill(EARTH_LAND, 1);
  earthFill(EARTH_WATER, 0);
  // Along every edge of every outline, but not along the seam or the pole
  // that close Antarctica's.
  const coast = [];
  for (const p of EARTH_LAND.concat(EARTH_WATER)) {
    for (let k = 0; k < p.length; k += 2) {
      const m = (k + 2) % p.length;
      const lon0 = p[k];
      const lat0 = p[k + 1];
      const lon1 = p[m];
      const lat1 = p[m + 1];
      if (lat0 < -89 || lat1 < -89) continue;
      const across = (lon1 - lon0) * Math.cos(((lat0 + lat1) / 2) * EARTH_RAD);
      const steps = Math.max(1, Math.round(Math.hypot(across, lat1 - lat0) / earth.coast));
      for (let s = 0; s < steps; s++) {
        earthPush(coast, lon0 + ((lon1 - lon0) * s) / steps, lat0 + ((lat1 - lat0) * s) / steps);
      }
    }
  }
  earthCoast = new Float32Array(coast);
}

function earthGauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
}

function earthBetween(range, k) {
  return range[0] + (range[1] - range[0]) * k;
}

// The lights, shared out between the cities by how many live in each: for
// each, its middle, a tight cluster on the city itself; its towns, scattered
// round it a little further out; and the country, sparser, further out
// still. Towns and country only on land; a city's middle wherever it is, for
// the coasts are only drawn roughly.
function earthPeople() {
  let total = 0;
  for (let k = 2; k < EARTH_CITIES.length; k += 3) total += Math.pow(EARTH_CITIES[k], earth.weight);
  const lights = [];
  const tier = [];
  for (let k = 0; k < EARTH_CITIES.length; k += 3) {
    const lon = EARTH_CITIES[k];
    const lat = EARTH_CITIES[k + 1];
    const millions = EARTH_CITIES[k + 2];
    const size = Math.sqrt(millions);
    const stretch = 1 / Math.max(0.2, Math.cos(lat * EARTH_RAD));
    const spread = 0.12 + 0.13 * size;
    const count = Math.max(3, Math.round((earth.lights * Math.pow(millions, earth.weight)) / total));
    const middle = Math.max(2, Math.round(count * earth.middle));
    const country = Math.round(count * earth.country);
    for (let i = 0; i < count; i++) {
      const kind = i < middle ? 0 : i < count - country ? 1 : 2;
      for (let tries = 0; tries < 6; tries++) {
        let dLon;
        let dLat;
        if (kind === 0) {
          dLon = i ? earthGauss() * spread : 0;
          dLat = i ? earthGauss() * spread : 0;
        } else {
          const d =
            kind === 1
              ? spread * 1.5 + Math.pow(Math.random(), 1.5) * (1.5 + 0.6 * size)
              : spread * 3 + Math.sqrt(Math.random()) * (3 + 1.2 * size);
          const a = Math.random() * Math.PI * 2;
          dLon = Math.cos(a) * d;
          dLat = Math.sin(a) * d;
        }
        const plon = lon + dLon * stretch;
        const plat = Math.max(-89, Math.min(89, lat + dLat));
        if (kind > 0 && !earthIsLand(plon, plat)) continue;
        earthPush(lights, plon, plat);
        tier.push(kind);
        break;
      }
    }
  }
  earthLights = new Float32Array(lights);
  const n = tier.length;
  earthTier = new Uint8Array(tier);
  earthSeed = new Float32Array(n);
  earthThin = new Float32Array(n);
  earthRagged = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    earthSeed[i] = Math.random();
    earthThin[i] = Math.random();
    earthRagged[i] = Math.random();
  }
  earthLit = new Uint8Array(n);
  earthWait = new Int16Array(n).fill(-1);
  earthFlicker = new Uint8Array(n);
  earthWithin = 0;
}

function startEarth() {
  earthMap();
  earthPeople();
  earthTime = 0;
  earthTurn = Math.random() * 360;
  earthTip = 0;
  earthTipSpeed = 0;
  earthWheel = 0;
  earthScrolled = 0;
}

function earthCursor() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  const t = earthTime;
  const r = earth.radius * Math.min(canvas.width, canvas.height);
  return {
    x: canvas.width / 2 + r * 0.8 * Math.sin(t * 0.0041),
    y: canvas.height / 2 + r * 0.7 * Math.sin(t * 0.0057 + 1.3),
  };
}

function stepEarth() {
  const n = whiteElements.length;
  earthTime++;
  earthTurn = (earthTurn + earth.spin) % 360;
  earthTipSpeed = (earthTipSpeed + (earthWheel + earthScrolled) * earth.scroll) * 0.94;
  earthTip = (earthTip + earthTipSpeed) % 360;
  earthWheel = 0;
  earthScrolled = 0;
  const w = canvas.width;
  const h = canvas.height;
  const R = earth.radius * Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const spinCos = Math.cos(earthTurn * EARTH_RAD);
  const spinSin = Math.sin(earthTurn * EARTH_RAD);
  const viewCos = Math.cos(earth.view * EARTH_RAD);
  const viewSin = Math.sin(earth.view * EARTH_RAD);
  const leanCos = Math.cos(earth.lean * EARTH_RAD);
  const leanSin = Math.sin(earth.lean * EARTH_RAD);
  const tipCos = Math.cos(earthTip * EARTH_RAD);
  const tipSin = Math.sin(earthTip * EARTH_RAD);
  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  // Where a point on the sphere lands on the screen: turned with the Earth,
  // tipped to be seen from a little north, its axis leaned, then turned over
  // about the screen's level by scrolling; and how far it faces us, 1 in the
  // middle of the disc down to 0 at the edge.
  let sx = 0;
  let sy = 0;
  function project(list, i) {
    const x = list[i];
    const y = list[i + 1];
    const z = list[i + 2];
    const x1 = x * spinCos - y * spinSin;
    const y1 = x * spinSin + y * spinCos;
    const near = x1 * viewCos + z * viewSin;
    const up = z * viewCos - x1 * viewSin;
    const down = y1 * leanSin - up * leanCos;
    sx = cx + R * (y1 * leanCos + up * leanSin);
    sy = cy + R * (down * tipCos - near * tipSin);
    return near * tipCos + down * tipSin;
  }
  // Just how far it faces us.
  function facing(list, i) {
    const x1 = list[i] * spinCos - list[i + 1] * spinSin;
    const y1 = list[i] * spinSin + list[i + 1] * spinCos;
    const near = x1 * viewCos + list[i + 2] * viewSin;
    const up = list[i + 2] * viewCos - x1 * viewSin;
    return near * tipCos + (y1 * leanSin - up * leanCos) * tipSin;
  }

  // The edge, the haze round it, and the coasts.
  for (let k = 0; k < earth.edge; k++) {
    const a = (k / earth.edge) * Math.PI * 2;
    put(cx + R * Math.cos(a), cy + R * Math.sin(a));
  }
  for (let ring = 0; ring < earth.haze.length; ring++) {
    const r = R * (1 + 0.01 * (ring + 1) * (ring + 1));
    const count = earth.haze[ring];
    for (let k = 0; k < count; k++) {
      const a = ((k + 0.5 * ring) / count) * Math.PI * 2;
      put(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
  }
  for (let i = 0; i < earthCoast.length && next < n; i += 3) {
    if (project(earthCoast, i) > 0) put(sx, sy);
  }

  // The lights. Those near enough the cursor come on, or, when there were
  // more of them last frame than dots to spare, an even share of them. Each
  // comes on a while after the cursor reaches it, the middle of a city first,
  // then its towns, then the country; and goes out a while after it has gone.
  // Those on the far side that are out already are passed over.
  const cursor = earthCursor();
  const reach = earth.reach * R;
  const share = Math.min(1, ((n - next) * 0.95) / Math.max(1, earthWithin));
  let within = 0;
  for (let k = 0, i = 0; k < earthTier.length; k++, i += 3) {
    if (!earthLit[k] && earthWait[k] < 0 && facing(earthLights, i) <= 0.02) continue;
    const near = project(earthLights, i);
    const dx = sx - cursor.x;
    const dy = sy - cursor.y;
    const edge = reach * (0.75 + 0.25 * earthRagged[k]);
    const close = near > 0.02 && dx * dx + dy * dy < edge * edge;
    if (close) within++;
    const want = close && earthThin[k] < share ? 1 : 0;
    const seed = earthSeed[k];
    if (want === earthLit[k]) {
      earthWait[k] = -1;
    } else if (earthWait[k] < 0) {
      const tier = earthTier[k];
      const order = tier === 0 ? seed * 0.4 : tier === 1 ? 0.3 + seed * 0.45 : 0.55 + seed * 0.45;
      earthWait[k] = Math.round(want ? earthBetween(earth.lightUp, order) : earthBetween(earth.lightOut, seed));
    } else if (--earthWait[k] <= 0) {
      earthLit[k] = want;
      earthWait[k] = -1;
      if (want) earthFlicker[k] = 9;
    }
    if (!earthLit[k] || near <= 0) continue;
    if (earthFlicker[k] > 0 && earthFlicker[k]-- % 4 < 2) continue;
    put(sx, sy);
  }
  earthWithin = within;
  while (next < n) put(-100, -100);
}

registerBackground("earth", {
  start: startEarth,
  step: stepEarth,
  settings: earth,
});
