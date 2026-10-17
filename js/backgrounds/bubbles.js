// The boiling background. Loaded after infinity.js.

// ---- Boiling -----------------------------------------------------------------
// The cursor is a hot spot under water, and bubbles boil off it. Nucleation
// sites are scattered round the cursor; on each a bubble swells until it lets
// go, and the next starts after a pause. Most let go small, so the stream is
// mostly fine bubbles with a few big ones. Bubbles behave by size, as real ones do. The smallest are round
// specks that rise slowly and straight. Bigger ones rise faster, squash into
// wobbling ellipsoids, and zigzag as they go. The biggest flatten underneath
// into caps with a dome on top and a rippling skirt below, rise fastest, and
// now and then shed a small bubble from the skirt. Every outline wobbles in a
// few shape modes of its own, jiggling quickly, and a bubble's rim is drawn a
// little ragged and heavier along its underside, where light bent through the
// bubble makes a bright crescent.
// Bubbles swell a little as they rise and the pressure drops, merge when they
// run into each other, keeping their volume, and drift with slow eddies in the
// water, which grow as they rise, so the column sways and spreads. Moving the
// mouse stirs the water near it. The pattern the background starts from fizzes
// away, each dot a speck rising at its own pace, and gives up its dots to
// bubbles as they need them.
// Dots: the bubbles first, then the fizz; anything left is parked out of sight.
const bubbles = {
  sites: 20, // nucleation sites round the cursor
  siteSpread: 30, // px: how far round the cursor they are scattered
  detach: [1, 7], // px: the radius a bubble lets go at, smallest to largest
  smallMostly: 3, // how strongly bubbles let go towards the small end
  grow: 0.4, // px per frame a clinging bubble's radius grows
  pause: [0, 15], // frames a site waits before the next bubble
  rise: 1.8, // px per frame a bubble of radius 2 px rises at; smaller ones
  //            slower, bigger ones faster with the root of their size
  speedUp: 0.05, // share of the way to its full speed a bubble gains per frame
  swell: 0.3, // how much bigger a bubble has grown by the time it has risen
  //             the height of the screen
  zigzag: 1, // sideways swing of the bubbles that zigzag, share of their radius
  zigzagRate: 0.12, // rad per frame, roughly
  squash: 0.22, // how squat the ellipsoids get
  wobble: 0.16, // how much an outline wobbles, at the biggest
  jiggle: [0.25, 0.6], // rad per frame its shape modes oscillate at
  capFrom: 9, // px: bubbles bigger than this start to flatten underneath into caps
  biggest: 18, // px: and are full caps by this
  shed: 0.012, // chance per frame a full cap sheds a small bubble
  eddies: 0.8, // px per frame of sideways drift from the eddies in the water
  spacing: 1.6, // px between the dots round a bubble
  rim: 0.6, // px the rim's dots are scattered across
  crescent: 0.45, // how much heavier the rim is along the underside
  merge: 0.4, // bubbles closer than this share of their radii put together merge
  stir: 0.25, // how much of the mouse's motion the water near it takes up
  stirReach: 90, // px
  fizz: [0.2, 1.2], // px per frame the starting pattern's specks rise at
};

let bubbleList = []; // see bubbleMake
let bubbleSites = []; // { dx, dy, bubble, wait, size }
let bubbleFizzX = new Float32Array(0);
let bubbleFizzY = new Float32Array(0);
let bubbleFizzV = new Float32Array(0);
let bubbleFizz = 0; // how many specks are left
let bubbleMouse = { x: 0, y: 0, vx: 0, vy: 0 };
let bubbleTime = 0;

function bubbleSource() {
  // Off the page the heat is on the bottom, like a pan's.
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  return { x: canvas.width / 2, y: canvas.height * 0.95 };
}

function bubbleBetween(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

// 0 below a, 1 above b, smooth between.
function bubbleRamp(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

function bubbleScatterSite(site) {
  const r = bubbles.siteSpread * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  site.dx = Math.cos(a) * r;
  site.dy = Math.sin(a) * r * 0.5;
  site.size =
    bubbles.detach[0] +
    (bubbles.detach[1] - bubbles.detach[0]) * Math.pow(Math.random(), bubbles.smallMostly);
}

function bubbleMake(x, y, r) {
  const modes = [];
  for (let m = 2; m <= 4; m++) {
    modes.push({
      m,
      amp: 0.4 + Math.random() * 0.6,
      rate: bubbleBetween(bubbles.jiggle),
      phase: Math.random() * Math.PI * 2,
      turn: Math.random() * Math.PI * 2,
    });
  }
  return {
    x,
    y,
    r, // radius when it was at y0; it swells from there
    y0: y,
    vx: 0,
    vy: 0,
    zig: Math.random() * Math.PI * 2,
    modes,
    seed: Math.random() * 1000,
    site: -1, // a site index while it clings
  };
}

function startBubbles() {
  const n = whiteElements.length;
  bubbleTime = 0;
  bubbleList = [];
  bubbleSites = [];
  for (let i = 0; i < Math.round(bubbles.sites); i++) {
    const site = { dx: 0, dy: 0, bubble: null, wait: Math.random() * bubbles.pause[1], size: 0 };
    bubbleScatterSite(site);
    bubbleSites.push(site);
  }
  bubbleFizzX = new Float32Array(n);
  bubbleFizzY = new Float32Array(n);
  bubbleFizzV = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    bubbleFizzX[i] = whiteElements[i].x;
    bubbleFizzY[i] = whiteElements[i].y;
    bubbleFizzV[i] = bubbleBetween(bubbles.fizz);
  }
  bubbleFizz = n;
  const source = bubbleSource();
  bubbleMouse = { x: source.x, y: source.y, vx: 0, vy: 0 };
}

// Dots a bubble of radius r is drawn with: a speck for the smallest, else a
// rim.
function bubbleDots(r) {
  if (r < 1.6) return Math.max(1, Math.round(r * 2));
  return Math.max(6, Math.round((2 * Math.PI * r) / bubbles.spacing));
}

// How big a bubble is now, having swelled on its way up.
function bubbleRadius(b, h) {
  return b.r * (1 + (bubbles.swell * Math.max(0, b.y0 - b.y)) / h);
}

// Sideways drift of the water at (x, y).
function bubbleEddy(x, y) {
  const t = bubbleTime;
  return (
    bubbles.eddies *
    (0.7 * Math.sin(y * 0.009 + t * 0.011 + 1.3 * Math.sin(x * 0.006 + t * 0.004)) +
      0.3 * Math.sin(y * 0.021 - t * 0.017 + x * 0.011))
  );
}

// The same small number every frame for dot j of a bubble.
function bubbleNoise(seed, j) {
  const s = Math.sin(seed + j * 12.9898) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

function stepBubbles() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  bubbleTime++;
  const source = bubbleSource();

  // The mouse's motion, smoothed, stirs the water.
  const m = bubbleMouse;
  m.vx += (source.x - m.x - m.vx) * 0.3;
  m.vy += (source.y - m.y - m.vy) * 0.3;
  m.x = source.x;
  m.y = source.y;

  let used = 0;
  for (let k = 0; k < bubbleList.length; k++) used += bubbleDots(bubbleRadius(bubbleList[k], h));

  // Sites grow their bubbles, while the dots can be found.
  for (let s = 0; s < bubbleSites.length; s++) {
    const site = bubbleSites[s];
    const sx = source.x + site.dx;
    const sy = source.y + site.dy;
    if (!site.bubble) {
      if (--site.wait > 0) continue;
      site.bubble = bubbleMake(sx, sy, 0.5);
      site.bubble.site = s;
      bubbleList.push(site.bubble);
      used += bubbleDots(0.5);
    }
    const b = site.bubble;
    const grown = Math.min(site.size, b.r + bubbles.grow);
    const extra = bubbleDots(grown) - bubbleDots(b.r);
    if (used + extra <= n || bubbleFizz > 0) {
      b.r = grown;
      used += extra;
    }
    // It sits on its site, which moves with the cursor.
    b.x = sx;
    b.y = sy - b.r;
    b.y0 = b.y;
    if (b.r >= site.size) {
      b.site = -1;
      site.bubble = null;
      site.wait = bubbleBetween(bubbles.pause);
      bubbleScatterSite(site);
    }
  }

  // Free bubbles rise, zigzag, drift with the eddies and get stirred.
  const reach2 = bubbles.stirReach * bubbles.stirReach;
  const shed = [];
  for (let k = 0; k < bubbleList.length; k++) {
    const b = bubbleList[k];
    if (b.site !== -1) continue;
    const r = bubbleRadius(b, h);
    const full = bubbles.rise * (r < 2 ? r / 2 : Math.sqrt(r / 2));
    b.vy += (-full - b.vy) * bubbles.speedUp;
    // Small bubbles go with the water; big ones only slowly. The eddies are
    // weak where the bubble set off and grow as it climbs.
    const risen = Math.min(1, Math.max(0, b.y0 - b.y) / (0.3 * h));
    const follow = r < 2 ? 0.08 : 0.08 / Math.sqrt(r / 2);
    b.vx += (bubbleEddy(b.x, b.y) * risen - b.vx) * follow;
    const d2 = (b.x - m.x) ** 2 + (b.y - m.y) ** 2;
    if (cursorOnPage && d2 < reach2) {
      const near = 1 - Math.sqrt(d2) / bubbles.stirReach;
      b.vx += m.vx * bubbles.stir * near;
      b.vy += m.vy * bubbles.stir * near * 0.5;
    }
    // Mid-sized bubbles zigzag, unevenly; caps mostly rock.
    const zigs = bubbleRamp(2, 6, r) * (1 - 0.7 * bubbleRamp(bubbles.capFrom, bubbles.biggest, r));
    b.zig += bubbles.zigzagRate * (0.6 + 0.8 * Math.random());
    b.x += b.vx + bubbles.zigzag * r * zigs * bubbles.zigzagRate * Math.cos(b.zig);
    b.y += b.vy;
    // A full cap sheds a little bubble off its skirt now and then.
    if (r > bubbles.biggest * 0.9 && Math.random() < bubbles.shed) {
      const small = 1 + Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      const child = bubbleMake(b.x + side * r * 1.1, b.y + r * 0.3, small);
      child.vx = b.vx + side * 0.4;
      child.vy = b.vy * 0.4;
      shed.push(child);
      b.r = Math.cbrt(r * r * r - small * small * small);
      b.y0 = b.y;
    }
  }
  for (const child of shed) bubbleList.push(child);

  // Bubbles that run into each other merge, keeping their volume.
  for (let i = 0; i < bubbleList.length; i++) {
    const a = bubbleList[i];
    if (a.site !== -1) continue;
    let ra = bubbleRadius(a, h);
    for (let j = i + 1; j < bubbleList.length; j++) {
      const b = bubbleList[j];
      if (b.site !== -1) continue;
      const rb = bubbleRadius(b, h);
      const reach = (ra + rb) * bubbles.merge;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy > reach * reach) continue;
      const va = ra * ra * ra;
      const vb = rb * rb * rb;
      const share = vb / (va + vb);
      a.x += dx * share;
      a.y += dy * share;
      a.vx += (b.vx - a.vx) * share;
      a.vy += (b.vy - a.vy) * share;
      // Re-based so it does not swell twice for the height already risen.
      a.r = Math.cbrt(va + vb);
      a.y0 = a.y;
      ra = a.r;
      bubbleList.splice(j, 1);
      j--;
    }
  }

  // Off the top, or blown off a side, they are gone.
  for (let k = bubbleList.length - 1; k >= 0; k--) {
    const b = bubbleList[k];
    const r = bubbleRadius(b, h);
    if (b.site === -1 && (b.y + 2 * r < 0 || b.x < -50 || b.x > w + 50)) bubbleList.splice(k, 1);
  }

  // The fizz rises and gives up its dots to whatever needs them.
  used = 0;
  for (let k = 0; k < bubbleList.length; k++) used += bubbleDots(bubbleRadius(bubbleList[k], h));
  for (let i = bubbleFizz - 1; i >= 0; i--) {
    bubbleFizzY[i] -= bubbleFizzV[i];
    if (bubbleFizzY[i] < 0) {
      bubbleFizz--;
      bubbleFizzX[i] = bubbleFizzX[bubbleFizz];
      bubbleFizzY[i] = bubbleFizzY[bubbleFizz];
      bubbleFizzV[i] = bubbleFizzV[bubbleFizz];
    }
  }
  // Specks taken at random, so the pattern thins out evenly.
  while (bubbleFizz > 0 && used + bubbleFizz > n) {
    const i = Math.floor(Math.random() * bubbleFizz);
    bubbleFizz--;
    bubbleFizzX[i] = bubbleFizzX[bubbleFizz];
    bubbleFizzY[i] = bubbleFizzY[bubbleFizz];
    bubbleFizzV[i] = bubbleFizzV[bubbleFizz];
  }

  // ---- Laying out the dots ----
  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  const t = bubbleTime;
  for (let k = 0; k < bubbleList.length; k++) {
    const b = bubbleList[k];
    const r = bubbleRadius(b, h);
    if (r < 1.6) {
      // A speck.
      const dots = bubbleDots(r);
      for (let j = 0; j < dots; j++) {
        const a = (j / dots) * Math.PI * 2 + b.seed;
        put(b.x + Math.cos(a) * r * 0.5, b.y + Math.sin(a) * r * 0.5);
      }
      continue;
    }
    const ellipsoid = bubbleRamp(3, bubbles.capFrom, r);
    const cap = bubbleRamp(bubbles.capFrom, bubbles.biggest, r);
    const wobble = bubbles.wobble * bubbleRamp(2.5, bubbles.biggest, r);
    const squash = bubbles.squash * ellipsoid * (1 - 0.5 * cap);
    const wide = 1 + squash + 0.3 * cap;
    const tall = 1 - squash;
    // A cap's underside is cut off this far below its middle.
    const floor = r * (1 - 0.75 * cap);
    // Tipped the way it is drifting.
    const tip = b.site === -1 ? Math.max(-0.4, Math.min(0.4, b.vx * 0.25)) * ellipsoid : 0;
    const cos = Math.cos(tip);
    const sin = Math.sin(tip);
    const outline = bubbleDots(r);
    for (let j = 0; j < outline; j++) {
      // Bunched towards the underside: the crescent.
      const even = (j / outline) * Math.PI * 2;
      const phi = even + bubbles.crescent * Math.cos(even);
      let shape = 1;
      for (const mode of b.modes) {
        shape += wobble * mode.amp * Math.sin(mode.rate * t + mode.phase) * Math.cos(mode.m * (phi - mode.turn));
      }
      const rho = r * shape + bubbleNoise(b.seed, j) * bubbles.rim;
      const px = Math.cos(phi) * rho * wide;
      let py = Math.sin(phi) * rho * tall;
      if (cap > 0 && py > floor) {
        // Flattened into a skirt that ripples.
        py = floor + (py - floor) * 0.15 + Math.sin(phi * 5 + t * 0.2 + b.seed) * 0.06 * r * cap;
      }
      put(b.x + px * cos - py * sin, b.y + px * sin + py * cos);
    }
  }
  for (let i = 0; i < bubbleFizz; i++) put(bubbleFizzX[i], bubbleFizzY[i]);
  while (next < n) put(-100, -100);
}

registerBackground("bubbles", {
  start: startBubbles,
  step: stepBubbles,
  settings: bubbles,
});
