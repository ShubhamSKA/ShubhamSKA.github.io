// The bismuth background. Loaded after infinity.js.

// ---- Bismuth -----------------------------------------------------------------
// Bismuth crystals growing out of the melt round the cursor. Bismuth grows as
// hopper crystals: the edges of a face grow faster than its middle, so each
// crystal is a nest of rectangular terraces round a hollow, every terrace a
// step above the one inside it, like a stepped pit. They are seen from above
// at an angle, so the rectangles are foreshortened and the outer terraces
// stand higher. Real hoppers are far from regular, and these are not either.
// Each side of a crystal grows at its own rate, so the terraces are oblong and
// the hollow sits off centre; every step is a different width and height; a
// side often has a jog in it, stepping in or out partway along, which gives
// the staircase edges bismuth is known for; now and then a side stops short,
// and the last terrace may get only partway round. Each crystal that comes up
// by the cursor is turned its own way; when one is done, smaller crystals
// come up on its corners, sitting on its rim, turned nearly as it is, as
// bismuth grows on bismuth along its crystal axes. Crystals do not grow
// through one another: a terrace runs on until it meets another crystal and
// stops against it, so crystals that meet grow together into one block, and
// one hemmed in all round stops growing. Dots are laid along the terraces as
// they grow. The pattern it started from is used up first; after that the
// oldest finished crystal melts back, from its outer edge inwards, to give its
// dots up.
const bismuth = {
  every: 50, // frames between tries at a new crystal by the cursor
  scatter: 130, // px round the cursor new crystals come up within
  room: 50, // px a new crystal keeps from the middles of others
  spacing: [4, 9], // px between a crystal's terraces, on average
  terraces: [4, 12], // terraces in a crystal when it is done
  lopsided: 0.45, // how much faster or slower each side grows than the average, at most
  speed: 8, // px of terrace a crystal grows per frame
  dot: 2.5, // px between dots along a terrace
  squash: 0.6, // how foreshortened the view from above at an angle is
  rise: 2.5, // px each terrace stands above the one inside it, on average
  jog: 0.35, // chance a side has a step in it
  shortSide: 0.12, // chance a side stops short
  daughters: [1, 3], // crystals that come up on a finished one's corners
  smaller: 0.6, // a daughter's size, share of its parent's
  turn: 0.15, // rad a daughter may be turned off its parent, at most
  generations: 2, // daughters of daughters, at most
  growing: 5, // crystals growing at once, at most
};

// Which crystal holds each patch of screen is kept on a grid this size, so
// crystals can stop where they meet.
const BISMUTH_CELL = 3;

let bismuthCrystals = []; // oldest first; see bismuthCrystal
let bismuthUnused = 0;
let bismuthTime = 0;
let bismuthCols = 1;
let bismuthRows = 1;
let bismuthOwner = new Int32Array(0); // the crystal with dots in each cell
let bismuthOwned = new Uint16Array(0); // and how many
let bismuthNextId = 1;

function bismuthBetween(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

function bismuthCount(range) {
  const fewest = Math.round(range[0]);
  return fewest + Math.floor(Math.random() * (Math.round(range[1]) - fewest + 1));
}

// A crystal with its middle at (x, y) on the screen, its floor `base` px up,
// turned by `angle`.
function bismuthCrystal(x, y, base, angle, spacing, terraces, generation) {
  const rate = function () {
    return 1 + (Math.random() * 2 - 1) * bismuth.lopsided;
  };
  const crystal = {
    id: bismuthNextId++,
    x,
    y,
    base,
    angle,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    spacing,
    terraces: Math.max(2, Math.round(terraces)),
    generation,
    // How fast each side grows: left, right, near and far.
    rates: [rate(), rate(), rate(), rate()],
    // The terrace being traced: how far each side is from the middle, and
    // how high it stands.
    extent: [0, 0, 0, 0],
    z: 0,
    terrace: 0,
    side: 0, // which side of it
    along: 0, // px along that side
    sinceDot: 0,
    sideEnd: 1, // share of this side it gets along before it stops short
    jogAt: 2, // share of this side where it steps in or out; past 1 for none
    jog: 0, // px it steps out by; in if negative
    jogged: false,
    blocked: false, // whether this side has run into another crystal
    laidThisTerrace: 0,
    lastSides: 4, // sides its last terrace gets round
    dots: [],
    done: false,
  };
  for (let k = 0; k < 4; k++) crystal.extent[k] = spacing * crystal.rates[k] * 0.8;
  bismuthNewSide(crystal);
  return crystal;
}

// Where the side about to be traced stops short or steps.
function bismuthNewSide(crystal) {
  crystal.along = 0;
  crystal.blocked = false;
  crystal.jogged = false;
  crystal.sideEnd = Math.random() < bismuth.shortSide ? 0.3 + 0.6 * Math.random() : 1;
  if (Math.random() < bismuth.jog) {
    crystal.jogAt = 0.2 + 0.6 * Math.random();
    crystal.jog = (Math.random() < 0.5 ? -1 : 1) * crystal.spacing * (0.3 + 0.5 * Math.random());
  } else {
    crystal.jogAt = 2;
    crystal.jog = 0;
  }
}

// Side `side` of the crystal's terrace: where it starts, which way it runs,
// which way is out, and how long it is, into bismuthSide.
const bismuthSide = { u: 0, v: 0, du: 0, dv: 0, nu: 0, nv: 0, length: 0 };
function bismuthTrace(crystal, side) {
  const [left, right, near, far] = crystal.extent;
  const s = bismuthSide;
  if (side === 0) {
    Object.assign(s, { u: -left, v: -far, du: 1, dv: 0, nu: 0, nv: -1, length: left + right });
  } else if (side === 1) {
    Object.assign(s, { u: right, v: -far, du: 0, dv: 1, nu: 1, nv: 0, length: far + near });
  } else if (side === 2) {
    Object.assign(s, { u: right, v: near, du: -1, dv: 0, nu: 0, nv: 1, length: left + right });
  } else {
    Object.assign(s, { u: -left, v: near, du: 0, dv: -1, nu: -1, nv: 0, length: far + near });
  }
}

function bismuthCell(x, y) {
  const cx = Math.min(bismuthCols - 1, Math.max(0, Math.floor(x / BISMUTH_CELL)));
  const cy = Math.min(bismuthRows - 1, Math.max(0, Math.floor(y / BISMUTH_CELL)));
  return cy * bismuthCols + cx;
}

// Whether a crystal other than `id` has a dot where (x, y) is.
function bismuthTaken(x, y, id) {
  const owner = bismuthOwner[bismuthCell(x, y)];
  return owner !== 0 && owner !== id;
}

// Whether any crystal has dots within a few cells of (x, y).
function bismuthNearAny(x, y, cells) {
  const cx = Math.floor(x / BISMUTH_CELL);
  const cy = Math.floor(y / BISMUTH_CELL);
  for (let j = Math.max(0, cy - cells); j <= Math.min(bismuthRows - 1, cy + cells); j++) {
    for (let i = Math.max(0, cx - cells); i <= Math.min(bismuthCols - 1, cx + cells); i++) {
      if (bismuthOwner[j * bismuthCols + i]) return true;
    }
  }
  return false;
}

// Takes dot `dot` of crystal `id` off the grid.
function bismuthRelease(dot, id) {
  const c = bismuthCell(whiteElements[dot].x, whiteElements[dot].y);
  if (bismuthOwner[c] === id && --bismuthOwned[c] === 0) bismuthOwner[c] = 0;
  return dot;
}

// The screen position of the crystal's point (u, v) at height z above its
// floor, into bismuthAt.
const bismuthAt = { x: 0, y: 0 };
function bismuthPlace(crystal, u, v, z) {
  const px = u * crystal.cos - v * crystal.sin;
  const py = u * crystal.sin + v * crystal.cos;
  bismuthAt.x = crystal.x + px;
  bismuthAt.y = crystal.y + py * bismuth.squash - crystal.base - z;
}

// The next dot to lay: an unused one from the starting pattern, else the
// outermost of the oldest finished crystal's.
function bismuthTake() {
  if (bismuthUnused < whiteElements.length) return bismuthUnused++;
  while (bismuthCrystals.length > 1 && bismuthCrystals[0].done && !bismuthCrystals[0].dots.length) {
    bismuthCrystals.shift();
  }
  for (const crystal of bismuthCrystals) {
    if (crystal.done && crystal.dots.length) return bismuthRelease(crystal.dots.pop(), crystal.id);
  }
  for (const crystal of bismuthCrystals) {
    if (crystal.dots.length) return bismuthRelease(crystal.dots.shift(), crystal.id);
  }
  return 0;
}

// Lays a dot for the crystal at (x, y), unless another crystal is there, in
// which case the side has met it and stops.
function bismuthLay(crystal, x, y) {
  if (crystal.blocked) return;
  if (bismuthTaken(x, y, crystal.id)) {
    crystal.blocked = true;
    return;
  }
  const dot = bismuthTake();
  whiteElements[dot].x = x;
  whiteElements[dot].y = y;
  crystal.dots.push(dot);
  crystal.laidThisTerrace++;
  const c = bismuthCell(x, y);
  if (!bismuthOwner[c]) bismuthOwner[c] = crystal.id;
  if (bismuthOwner[c] === crystal.id) bismuthOwned[c]++;
}

function bismuthNucleate() {
  const growing = bismuthCrystals.filter((c) => !c.done).length;
  if (growing >= bismuth.growing) return;
  const centre = cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: canvas.width / 2, y: canvas.height / 2 };
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = attempt ? bismuth.scatter * Math.sqrt(Math.random()) : 0;
    const a = Math.random() * Math.PI * 2;
    const x = centre.x + Math.cos(a) * r;
    const y = centre.y + Math.sin(a) * r;
    const crowded = bismuthCrystals.some(function (c) {
      return !c.done && Math.hypot(c.x - x, c.y - y) < bismuth.room;
    });
    if (crowded || bismuthNearAny(x, y, 3)) continue;
    bismuthCrystals.push(
      bismuthCrystal(x, y, 0, Math.random() * Math.PI * 2, bismuthBetween(bismuth.spacing), bismuthCount(bismuth.terraces), 0)
    );
    return;
  }
}

// A finished crystal's daughters, on its outer corners, turned nearly as it is.
function bismuthDaughters(parent) {
  if (parent.generation >= bismuth.generations) return;
  const [left, right, near, far] = parent.extent;
  const corners = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, bismuthCount(bismuth.daughters));
  for (const corner of corners) {
    const su = corner === 0 || corner === 3 ? 1 : -1;
    const sv = corner < 2 ? 1 : -1;
    const terraces = parent.terraces * bismuth.smaller * (0.7 + Math.random() * 0.6);
    const spacing = parent.spacing * (0.8 + Math.random() * 0.3);
    const size = spacing * terraces * 0.6;
    // Its middle out past the corner, so it sits over the rim.
    const u = su > 0 ? right + size : -left - size;
    const v = sv > 0 ? near + size : -far - size;
    bismuthPlace(parent, u, v, 0);
    const angle = parent.angle + Math.floor(Math.random() * 4) * (Math.PI / 2) + (Math.random() * 2 - 1) * bismuth.turn;
    bismuthCrystals.push(
      bismuthCrystal(bismuthAt.x, bismuthAt.y + parent.base, parent.base + parent.z, angle, spacing, terraces, parent.generation + 1)
    );
  }
}

function startBismuth() {
  bismuthCrystals = [];
  bismuthUnused = 0;
  bismuthTime = 0;
  bismuthNextId = 1;
  bismuthCols = Math.max(1, Math.ceil(canvas.width / BISMUTH_CELL));
  bismuthRows = Math.max(1, Math.ceil(canvas.height / BISMUTH_CELL));
  bismuthOwner = new Int32Array(bismuthCols * bismuthRows);
  bismuthOwned = new Uint16Array(bismuthCols * bismuthRows);
  bismuthNucleate();
}

function stepBismuth() {
  bismuthTime++;
  if (bismuthTime % Math.max(1, Math.round(bismuth.every)) === 0 || !bismuthCrystals.some((c) => !c.done)) {
    bismuthNucleate();
  }
  const growing = bismuthCrystals.filter((c) => !c.done);
  const step = bismuth.dot;
  for (const crystal of growing) {
    let left = bismuth.speed;
    while (left > 0 && !crystal.done) {
      bismuthTrace(crystal, crystal.side);
      const side = bismuthSide;
      const run = Math.min(left, side.length - crystal.along, step - crystal.sinceDot);
      crystal.along += run;
      crystal.sinceDot += run;
      left -= run;
      if (crystal.sinceDot >= step - 1e-6) {
        crystal.sinceDot = 0;
        const t = crystal.along / Math.max(1e-6, side.length);
        if (t <= crystal.sideEnd) {
          // The jog: a short riser out or in, then the rest of the side offset.
          if (!crystal.jogged && t >= crystal.jogAt) {
            crystal.jogged = true;
            const sign = crystal.jog < 0 ? -1 : 1;
            for (let o = step; o < Math.abs(crystal.jog); o += step) {
              bismuthPlace(
                crystal,
                side.u + side.du * crystal.along + side.nu * o * sign,
                side.v + side.dv * crystal.along + side.nv * o * sign,
                crystal.z
              );
              bismuthLay(crystal, bismuthAt.x, bismuthAt.y);
            }
          }
          const off = crystal.jogged ? crystal.jog : 0;
          bismuthPlace(
            crystal,
            side.u + side.du * crystal.along + side.nu * off,
            side.v + side.dv * crystal.along + side.nv * off,
            crystal.z
          );
          bismuthLay(crystal, bismuthAt.x, bismuthAt.y);
        }
      }
      if (crystal.along >= side.length - 1e-6) {
        const last = crystal.terrace === crystal.terraces - 1;
        crystal.side++;
        bismuthNewSide(crystal);
        if (crystal.side < (last ? crystal.lastSides : 4)) continue;
        crystal.side = 0;
        // Hemmed in all round: it can grow no further.
        const hemmedIn = crystal.laidThisTerrace === 0;
        crystal.laidThisTerrace = 0;
        if (++crystal.terrace >= crystal.terraces || hemmedIn) {
          crystal.done = true;
          bismuthDaughters(crystal);
        } else {
          // The next terrace out: each side by its own rate, every step a
          // different width and height. The last may get only partway round.
          for (let k = 0; k < 4; k++) {
            crystal.extent[k] += crystal.spacing * crystal.rates[k] * (0.6 + 0.8 * Math.random());
          }
          crystal.z += bismuth.rise * (0.5 + Math.random());
          if (crystal.terrace === crystal.terraces - 1) crystal.lastSides = 1 + Math.floor(Math.random() * 4);
        }
      }
    }
  }
}

registerBackground("bismuth", {
  start: startBismuth,
  step: stepBismuth,
  settings: bismuth,
});
