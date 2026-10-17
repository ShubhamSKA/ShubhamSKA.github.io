// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js.

// ---- Brinicles ---------------------------------------------------------------
// Brinicles under sea ice, seen from the side. As sea water freezes, the salt
// is squeezed out as brine, far colder than freezing and denser than the sea,
// which drains from the underside of the ice and sinks. The sea round a
// falling stream of it freezes into a hollow tube of ice: a brinicle. The
// cursor's place across the screen is where the brine drains, so a brinicle
// grows down from the ice above the cursor; when the cursor moves well away,
// that one stops and a new one starts above the cursor. A brinicle grows down
// at its tip and thickens at its root, its walls rough with ice crystals, and
// brine streams out of its tip, sinking and spreading. When the tip reaches
// the seabed, the brine pools there and freezes the bed round it: a web of ice
// spreads out either way along the bottom, slowing as it goes, with crystals
// sticking up from it. The underside of the ice and the seabed are drawn
// faintly. When dots run short, the oldest brinicle melts away, tip first.
// Dots: the ice and the seabed, then the brinicles and their webs; the rest go
// to the brine.
const brinicle = {
  ice: 0.07, // the underside of the sea ice, share of the height
  bed: 0.95, // the seabed, share of the height
  grow: 0.8, // px per frame a brinicle's tip grows down
  root: [10, 22], // px: how thick a brinicle gets at its root, thinnest to thickest
  thicken: 0.02, // px per frame its root thickens
  tip: 3, // px: its radius at the tip
  rough: 2.5, // px: how rough its walls are
  move: 90, // px the cursor moves before a new brinicle starts above it
  brine: 5, // brine dots streaming from a tip per frame
  sink: [1.2, 2.6], // px per frame brine sinks at
  web: 1.2, // px per frame a web of ice spreads along the seabed at first
  webReach: 0.22, // how far it spreads either way, share of the width
  melt: 3, // px per frame the oldest brinicle melts back by, when dots run short
  brineShare: 0.3, // share of the dots kept for the brine
};

let brinicles = []; // oldest first; see brinicleMake
let brinicleBrine = []; // { x, y, vx, vy, life }
let brinicleTime = 0;
let brinicleShort = false; // whether the ice and brinicles took too many dots last frame

function brinicleBetween(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

// A number in [0, 1) that stays the same for the same inputs.
function brinicleHash(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// The underside of the ice: uneven, the same each frame.
function brinicleIce(x) {
  const h = canvas.height;
  return brinicle.ice * h + 6 * Math.sin(x * 0.013) + 4 * Math.sin(x * 0.041 + 1.7) + 2 * Math.sin(x * 0.11);
}

function brinicleBed(x) {
  const h = canvas.height;
  return brinicle.bed * h + 4 * Math.sin(x * 0.009 + 0.4) + 2 * Math.sin(x * 0.033);
}

function brinicleMake(x) {
  return {
    x,
    length: 0,
    root: 2,
    most: brinicleBetween(brinicle.root),
    seed: Math.random() * 100,
    growing: true,
    landed: false,
    left: 0, // how far its web has spread either way
    right: 0,
    reach: brinicle.webReach * canvas.width * (0.6 + 0.4 * Math.random()),
    melting: false,
  };
}

function brinicleSource() {
  return cursorOnPage ? cursorPosition.x : canvas.width / 2;
}

function startBrinicle() {
  brinicleTime = 0;
  brinicles = [brinicleMake(brinicleSource())];
  brinicleBrine = [];
  brinicleShort = false;
}

// The centre line of brinicle b, `s` px down from its root: it hangs nearly
// straight, with a slight wander.
function brinicleCentre(b, s) {
  return b.x + 6 * Math.sin(s * 0.012 + b.seed) * Math.min(1, s / 150);
}

function stepBrinicle() {
  const n = whiteElements.length;
  const w = canvas.width;
  brinicleTime++;

  // A new brinicle above the cursor once it has moved away from the last.
  const source = brinicleSource();
  const newest = brinicles[brinicles.length - 1];
  if (!newest || Math.abs(newest.x - source) > brinicle.move) {
    if (newest) newest.growing = false;
    brinicles.push(brinicleMake(source));
  }

  // Short of dots: the oldest melts away, tip first.
  if (brinicleShort && brinicles.length > 1) brinicles[0].melting = true;
  for (const b of brinicles) {
    const top = brinicleIce(b.x);
    const floor = brinicleBed(b.x) - top;
    if (b.melting) {
      b.length -= brinicle.melt;
      b.left = Math.max(0, b.left - brinicle.melt);
      b.right = Math.max(0, b.right - brinicle.melt);
      b.landed = b.length >= floor - 1;
      continue;
    }
    b.root = Math.min(b.most, b.root + brinicle.thicken * (b.growing ? 2 : 1));
    if (b.growing && !b.landed) {
      b.length += brinicle.grow;
      if (b.length >= floor) {
        b.length = floor;
        b.landed = true;
      }
    }
    if (b.landed) {
      // The web slows as it spreads.
      const pace = brinicle.web * (1 - b.left / b.reach);
      if (b.left < b.reach) b.left += Math.max(0, pace * (0.6 + 0.8 * Math.random()));
      if (b.right < b.reach) b.right += Math.max(0, pace * (0.6 + 0.8 * Math.random()));
    }
  }
  brinicles = brinicles.filter(function (b) {
    return !b.melting || b.length > 0;
  });

  // Brine streams from growing tips, sinks, and spreads along the bed.
  for (const b of brinicles) {
    if (!b.growing || b.melting || brinicleBrine.length > brinicle.brineShare * n) continue;
    const top = brinicleIce(b.x);
    const tipY = top + b.length;
    const tipX = brinicleCentre(b, b.length);
    for (let k = 0; k < brinicle.brine; k++) {
      brinicleBrine.push({
        x: tipX + (Math.random() - 0.5) * brinicle.tip * 2,
        y: tipY,
        vx: (Math.random() - 0.5) * 0.3,
        vy: brinicleBetween(brinicle.sink) * (b.landed ? 0.3 : 1),
        life: 300 + Math.random() * 300,
      });
    }
  }
  for (let k = brinicleBrine.length - 1; k >= 0; k--) {
    const p = brinicleBrine[k];
    const bed = brinicleBed(p.x);
    p.life--;
    if (p.y < bed - 2) {
      p.vx += (Math.random() - 0.5) * 0.08;
      p.x += p.vx;
      p.y = Math.min(bed - 2, p.y + p.vy);
    } else {
      // A cold pool along the bottom, spreading out.
      if (Math.abs(p.vx) < 0.4) p.vx = (p.vx >= 0 ? 1 : -1) * (0.4 + Math.random() * 0.6);
      p.vx *= 0.995;
      p.x += p.vx;
      p.y = bed - 2 - Math.random() * 3;
    }
    if (p.life <= 0 || p.x < 0 || p.x > w) brinicleBrine.splice(k, 1);
  }

  // ---- Laying out the dots ----
  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  for (let x = 0; x < w; x += 3) put(x, brinicleIce(x));
  for (let x = 0; x < w; x += 7) put(x, brinicleBed(x) + 2);
  for (const b of brinicles) {
    const top = brinicleIce(b.x);
    // The tube's two walls, tapering to the tip, rough with crystals.
    for (let s = 0; s <= b.length; s += 2.5) {
      const taper = 1 - s / Math.max(1, b.length);
      const r = brinicle.tip + (b.root - brinicle.tip) * Math.pow(taper, 0.6);
      const c = brinicleCentre(b, s);
      const y = top + s;
      for (const side of [-1, 1]) {
        const bump = brinicleHash(s * side + b.seed, 1) * brinicle.rough;
        put(c + side * (r + bump), y);
        // Now and then a crystal sticking out.
        if (brinicleHash(s * side + b.seed, 2) < 0.12) put(c + side * (r + bump + 2 + brinicleHash(s, b.seed) * 4), y - 1);
      }
    }
    // The rounded tip.
    if (!b.landed) {
      const c = brinicleCentre(b, b.length);
      for (let k = 1; k < 6; k++) {
        const a = (k / 6) * Math.PI;
        put(c - Math.cos(a) * brinicle.tip, top + b.length + Math.sin(a) * brinicle.tip);
      }
    }
    // The web along the seabed, with crystals standing up from it.
    if (b.left > 0 || b.right > 0) {
      const foot = brinicleCentre(b, b.length);
      for (let x = foot - b.left; x <= foot + b.right; x += 2.5) {
        const bed = brinicleBed(x);
        put(x, bed - 1 - brinicleHash(x, b.seed) * 2);
        if (brinicleHash(x, b.seed + 3) < 0.14) {
          const tall = 3 + brinicleHash(x, b.seed + 4) * 16 * (1 - Math.abs(x - foot) / (b.reach + 1));
          const lean = (brinicleHash(x, b.seed + 5) - 0.5) * 0.8;
          for (let t = 2; t < tall; t += 2) put(x + lean * t, bed - 1 - t);
        }
      }
    }
  }
  brinicleShort = next > (1 - brinicle.brineShare) * n;
  for (const p of brinicleBrine) put(p.x, p.y);
  while (next < n) put(-100, -100);
}

registerBackground("brinicle", {
  start: startBrinicle,
  step: stepBrinicle,
  settings: brinicle,
  archived: true,
});
