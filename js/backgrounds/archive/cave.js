// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js.

// ---- Cave ----------------------------------------------------------------------
// A chamber of a limestone cave, like those of Cacahuamilpa, seen in section,
// its formations growing, lit only by the lamp of someone standing at the
// right wall, looking at the cursor.
// Water finds its way down a few cracks in the ceiling. Where it comes through
// most, it gathers into a drop, hangs, falls and splashes, and every drop
// leaves a little calcite where it hung and where it landed: a stalactite
// grows down and a stalagmite up to meet it, thickening as they lengthen;
// where they meet they fuse into a column, its waist filling out, and the
// water then runs down its sides. Each such place makes its own kind: a
// stalactite over a candle, a cone or a low mound; a stalagmite of stacked
// plates, like a pagoda; a curtain hanging in folds, striped along its edge; a
// cluster of soda straws; or a massive fluted column. Round them, along the
// cracks, hang many more stalactites, a few large and most small, each grown
// at its own pace and shaped its own way: tapering like a carrot, or swelling
// like a cigar, into a thin straw tip that the water drips from; flaring
// where it meets the ceiling; lumpy, its two sides unlike, with bulges here
// and there; bending a little one way; and now and then broken off short.
// Long lines down the larger ones follow the water's flow. The stalagmites
// are ringed with the rims the splashing leaves. Water drips faster near the
// cursor, so the formations there grow faster.
// The lamp throws a cone of light from the right wall to the cursor, the
// wearer turning their head after it, with a dim spill round it; everything
// else is dark. Formations in the beam are lit on the side facing the lamp
// and cast shadows behind them, because the light stops at the first thing
// it meets; specks of dust drifting through the chamber show only in the
// beam, and falling drops glint in it. Without a cursor the lamp looks round
// the cave.
// Dots: the rock, the ceiling and the floor, the wearer and the lamp, the
// dust, the water, then the formations, thinned evenly to fit what is left;
// the rest are parked out of sight.
const cave = {
  sites: 9, // places water comes through most, each growing a formation of its own kind
  hangers: 48, // smaller stalactites along the cracks
  cracks: 4, // cracks in the ceiling the water finds its way through
  ceiling: 0.13, // where the ceiling runs, share of the height
  floor: 0.87, // where the floor runs
  rock: 240, // dots stippling the rock
  motes: 260, // specks of dust, seen only in the lamp's beam
  drip: [30, 110], // frames between drops at a place, quickest to slowest
  pace: 45, // drops a formation takes to grow most of the way
  seep: 6, // how much faster water drips near the cursor
  gravity: 0.3, // px per frame per frame a drop falls
  beam: 0.2, // rad the lamp's beam spreads either side of where it looks
  spill: 0.7, // rad its dim spill reaches
  dark: 0.06, // how bright the cave is where no light reaches
};

const CAVE_BINS = 600; // the lamp's view, split into narrow wedges for its shadows
const CAVE_VIEW = 0.75; // rad either side of where the lamp looks that the wedges cover
let caveTime = 0;
let caveCeiling = new Float32Array(0); // how far down the ceiling is, every px across
let caveFloor = new Float32Array(0); // and the floor
let caveRock = new Float32Array(0); // x, y
let caveSites = [];
let caveHangers = [];
let caveDrops = []; // { x, y, vy, hang, site, splash, side, film }
let caveMotes = new Float32Array(0); // x, y, and their drift
let caveBuffer = new Float32Array(90000); // the formations' dots, before thinning
let caveFine = 2; // px between them, kept to just more than the dots left
let caveLamp = { x: 0, y: 0, angle: Math.PI }; // where the lamp is, and the way it looks
let caveShadow = new Float32Array(CAVE_BINS); // how far the light reaches down each wedge
let caveMoteFrom = 0; // which dots are the dust
let caveMoteTo = 0;

function caveBetween(range, k) {
  return range[0] + (range[1] - range[0]) * k;
}

function caveWrap(a) {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

function caveRamp(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// A rocky line across the screen around `mid`, rising `vault` in the middle.
function caveLine(w, mid, amp, vault) {
  const line = new Float32Array(Math.ceil(w) + 2);
  const p = [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3];
  for (let x = 0; x < line.length; x++) {
    const rough =
      0.45 * Math.sin(x * 0.004 + p[0]) +
      0.3 * Math.sin(x * 0.011 + p[1]) +
      0.15 * Math.sin(x * 0.029 + p[2]) +
      0.1 * Math.sin(x * 0.071 + p[3]);
    line[x] = mid + amp * rough + vault * Math.sin((Math.PI * x) / w);
  }
  return line;
}

function caveAt(line, x) {
  return line[Math.max(0, Math.min(line.length - 1, Math.round(x)))];
}

// Bulges along a formation: where, as a share of its length, how much and how
// wide.
function caveBulges(count, most) {
  const list = [];
  for (let k = 0; k < count; k++) {
    list.push({ f: Math.random(), a: (Math.random() * 2 - 0.6) * most, w: 0.04 + Math.random() * 0.12 });
  }
  return list;
}

// Lumps along each side of a formation, its two sides each their own.
function caveLumps(most) {
  const list = [];
  for (let k = 0; k < 3; k++) {
    const f = 0.04 + Math.random() * 0.3;
    list.push({ f, a: Math.random() * most, left: Math.random() * 6.3, right: Math.random() * 6.3 });
  }
  return list;
}

// A stalactite's own shape: `size`, 0 small to 1 large, sets how long and
// wide it grows; the rest is its own.
function caveStalactite(size) {
  const r = Math.random;
  return {
    reach: 0.025 + 0.32 * size, // how far down it comes, fully grown, share of the gap
    width: (1.5 + 14 * size) * (0.6 + 0.8 * r()), // half its width at the top, fully grown
    tip: 0.9 + r() * 0.6, // half its width at the tip
    straw: 0.08 + r() * 0.3, // share of its length that is a thin straw tip
    taper: 0.7 + r() * 1.5, // above 1, a carrot; below, a cigar
    flare: (1 + r() * 4) * (0.4 + size), // px it spreads where it meets the ceiling
    bend: (r() - 0.5) * (3 + 12 * size), // px its tip bends off straight
    broken: r() < 0.1, // snapped off short
    bulges: caveBulges(Math.floor(r() * 3), 0.45),
    lumps: caveLumps(0.05 + 0.08 * r()),
  };
}

// Half a stalactite's width `s` px below the ceiling, `L` long, `grown`.
function caveHangWidth(f, s, L, grown) {
  const body = Math.max(1, L * (1 - f.straw));
  const wide = f.width * (0.25 + 0.75 * Math.pow(grown, 0.7));
  let r = s >= body ? f.tip : f.tip + Math.max(0, wide - f.tip) * Math.pow(1 - s / body, f.taper);
  const at = s / Math.max(1, L);
  for (const b of f.bulges) r *= 1 + b.a * Math.exp(-Math.pow((at - b.f) / b.w, 2));
  return r + f.flare * grown * Math.exp(-s / (4 + 0.08 * L));
}

// How lumpy one side of a formation is, `s` px along it: 1 smooth.
function caveLump(lumps, s, side) {
  let k = 1;
  for (const l of lumps) k += l.a * Math.sin(s * l.f + (side < 0 ? l.left : l.right));
  return k;
}

// A place where water comes through most, at `x`, making formations of
// `kind`, each shaped its own way.
function caveMakeSite(x, kind) {
  const r = Math.random;
  const site = {
    x,
    kind,
    age: 0, // drops so far
    joined: -1, // drops when its formations met, or -1
    wait: r() * 60,
    every: caveBetween(cave.drip, r()),
    hang: 0.3 + r() * 0.3, // how far its stalactite comes down, fully grown, share of the gap
    rise: 0.25 + r() * 0.3, // how far its stalagmite comes up
    above: caveStalactite(0.75 + r() * 0.25), // its stalactite's shape
    top: 4 + r() * 6, // px across its stalagmite's rounded top, half
    thinM: 14 + r() * 22, // the stalagmite's radius 150 px down from its top, fully grown
    taperM: 0.7 + r() * 0.3,
    foot: 3 + r() * 10, // px it spreads where it meets the floor
    bulgesM: caveBulges(2 + Math.floor(r() * 4), 0.6),
    lumpsM: caveLumps(0.04 + 0.1 * r()),
    rib: r() * 0.08, // ribs round it
    ribF: 0.15 + r() * 0.3,
    ribP: r() * 6.3,
    plates: 0, // stacked plates, on a pagoda
    plateF: 0.35 + r() * 0.25,
    lean: (r() - 0.5) * 12, // px its stalagmite bows off upright, either way
    band: 16 + r() * 12, // px between the rims round its stalagmite
    mounds: [], // smaller stalagmites round its foot: px off, share of its height, how thin
    span: 0, // a curtain: px across, and its folds
    folds: 0.06 + r() * 0.06,
    foldP: r() * 6.3,
    straws: [], // soda straws: px off the middle, and how far they come down
    phase: r() * 6.3,
  };
  site.above.straw *= 0.6;
  site.above.broken = false;
  const shape = r();
  if (shape < 0.3) {
    // A candle: slender, nearly as wide at the top as below.
    site.taperM = 0.25 + r() * 0.2;
    site.thinM = 6 + r() * 6;
    site.top = 5 + r() * 4;
  } else if (shape < 0.45) {
    // A low mound, wide and rounded.
    site.top = 14 + r() * 14;
    site.rise *= 0.45;
  }
  for (let k = Math.floor(r() * 4); k > 0; k--) {
    const dx = (r() < 0.5 ? -1 : 1) * (14 + site.thinM * 0.5 + r() * 34);
    site.mounds.push({ dx, reach: 0.08 + r() * 0.3, thin: 0.3 + r() * 0.4 });
  }
  if (kind === "pagoda") {
    site.plates = 0.4 + r() * 0.4;
    site.taperM = 0.5 + r() * 0.3;
    site.thinM = 10 + r() * 10;
    site.above.width *= 0.6;
    site.rise = 0.35 + r() * 0.25;
  } else if (kind === "column") {
    site.hang = 0.5 + r() * 0.15;
    site.rise = 0.5 + r() * 0.15;
    site.above.width = 26 + r() * 18;
    site.above.taper = 0.8 + r() * 0.4;
    site.thinM = 32 + r() * 20;
    site.taperM = 0.7 + r() * 0.3;
    site.rib = 0.08 + r() * 0.08;
    site.ribF = 0.25 + r() * 0.25;
    site.foot = 10 + r() * 14;
  } else if (kind === "curtain") {
    site.span = 100 + r() * 120;
    site.hang = 0.22 + r() * 0.16;
    site.rise = 0.08 + r() * 0.15;
  } else if (kind === "straws") {
    const count = 4 + Math.floor(r() * 5);
    for (let k = 0; k < count; k++) site.straws.push({ dx: (r() - 0.5) * 26, reach: 0.08 + r() * 0.25 });
    site.hang = Math.max(...site.straws.map((s) => s.reach));
    site.rise = 0.04 + r() * 0.1;
    site.every *= 0.7;
  }
  return site;
}

function startCave() {
  const w = canvas.width;
  const h = canvas.height;
  caveTime = 0;
  caveCeiling = caveLine(w, cave.ceiling * h, 0.06 * h, -0.05 * h);
  caveFloor = caveLine(w, cave.floor * h, 0.03 * h, 0.01 * h);
  // The rock, stippled thickest near the chamber.
  const rock = [];
  const count = Math.max(0, Math.round(cave.rock));
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const deep = Math.random() * Math.random();
    if (i % 2) rock.push(x, caveAt(caveCeiling, x) * (1 - deep));
    else rock.push(x, caveAt(caveFloor, x) + (h - caveAt(caveFloor, x)) * deep);
  }
  caveRock = new Float32Array(rock);
  // The cracks, and the places along them where water comes through most,
  // each its own kind, every kind turning up before any comes again; well
  // clear of the lamp, so nothing close to it shades half the cave.
  const clear = w * 0.75;
  const cracks = [];
  for (let k = 0; k < Math.max(1, Math.round(cave.cracks)); k++) {
    cracks.push({ x: w * 0.06 + Math.random() * (clear - w * 0.12), spread: 40 + Math.random() * 130 });
  }
  function nearCrack(k) {
    const c = cracks[k % cracks.length];
    const off = (Math.random() + Math.random() + Math.random() - 1.5) * c.spread;
    return Math.max(10, Math.min(clear, c.x + off));
  }
  const sites = Math.max(1, Math.round(cave.sites));
  const kinds = [];
  while (kinds.length < sites) {
    const round = ["cone", "cone", "pagoda", "curtain", "straws", "column"];
    for (let k = round.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [round[k], round[j]] = [round[j], round[k]];
    }
    kinds.push(...round);
  }
  caveSites = [];
  for (let i = 0; i < sites; i++) {
    let x = nearCrack(i);
    for (let tries = 0; tries < 12 && caveSites.some((s) => Math.abs(s.x - x) < 60); tries++) x = nearCrack(i + tries);
    caveSites.push(caveMakeSite(x, kinds[i]));
  }
  // And the smaller stalactites, most along the cracks, a few out on their
  // own; a few large, most small.
  caveHangers = [];
  for (let i = 0; i < Math.max(0, Math.round(cave.hangers)); i++) {
    const x = Math.random() < 0.8 ? nearCrack(Math.floor(Math.random() * cracks.length)) : Math.random() * clear;
    const form = caveStalactite(Math.pow(Math.random(), 2.2) * 0.7);
    form.x = x;
    form.age = 0;
    form.wait = Math.random() * 300;
    form.every = 120 + Math.random() * 500;
    caveHangers.push(form);
  }
  // The dust.
  const motes = Math.max(0, Math.round(cave.motes));
  caveMotes = new Float32Array(motes * 4);
  for (let i = 0; i < motes; i++) {
    caveMotes[i * 4] = Math.random() * w;
    caveMotes[i * 4 + 1] = h * (cave.ceiling + Math.random() * (cave.floor - cave.ceiling));
  }
  caveDrops = [];
  caveFine = 2;
  caveLamp.angle = Math.PI;
}

// How grown formations `age` drops old are, 0 to 1: quickly at first, then
// slowly.
function caveGrown(age) {
  return 1 - Math.exp(-age / Math.max(1, cave.pace));
}

// Half a stalagmite's width `z` px above the floor, `L` tall, `grown`.
function caveRiseWidth(site, z, L, grown) {
  const d = Math.max(0, L - z);
  const top = site.top * (0.5 + 0.5 * grown);
  let r;
  if (d < top) r = top * Math.sqrt(Math.max(0, 1 - Math.pow(1 - d / top, 2)));
  else r = top + (site.thinM * (0.35 + 0.65 * grown) * Math.pow(d - top, site.taperM)) / Math.pow(150, site.taperM);
  const f = z / Math.max(1, L);
  for (const b of site.bulgesM) r *= 1 + b.a * Math.exp(-Math.pow((f - b.f) / b.w, 2));
  r *= 1 + site.rib * Math.sin(z * site.ribF + site.ribP);
  if (site.plates) r *= 1 + site.plates * Math.pow(Math.max(0, Math.sin(z * site.plateF + site.phase)), 6);
  return r + site.foot * grown * Math.exp(-z / 15);
}

// How far a curtain `hang` long comes down below the ceiling at `x`: deepest
// in its middle, in folds, striped.
function caveCurtain(site, x, hang) {
  const t = Math.max(0, Math.min(1, (x - (site.x - site.span / 2)) / site.span));
  const fold = Math.sin((x - site.x) * site.folds + site.foldP);
  const ripple = 1 + 0.15 * Math.sin((x - site.x) * site.folds * 2.3 + site.phase);
  return hang * Math.pow(Math.sin(Math.PI * t), 0.6) * (0.55 + 0.45 * fold) * ripple;
}

// Where the lamp looks: the cursor, or, without one, round the cave.
function caveLook() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  const t = caveTime;
  return {
    x: canvas.width * (0.42 + 0.34 * Math.sin(t * 0.0027)),
    y: canvas.height * (0.5 + 0.3 * Math.sin(t * 0.0041 + 1.2)),
  };
}

// How bright dot `i` at (x, y) is: in the lamp's beam, bright, fading with
// distance, unless something nearer the lamp stands in the way, when only a
// little light bounced off the rock reaches it, the shadow's edge soft; in
// the beam's spill, dimly; otherwise dark. The dust shows only in the beam.
function caveLight(x, y, i) {
  const dust = i >= caveMoteFrom && i < caveMoteTo;
  const dx = x - caveLamp.x;
  const dy = y - caveLamp.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 10) return 1;
  const off = caveWrap(Math.atan2(dy, dx) - caveLamp.angle);
  const a = Math.abs(off);
  let beam = 1 - caveRamp(cave.beam * 0.6, cave.beam, a);
  if (beam > 0 && a < CAVE_VIEW) {
    const bin = Math.floor(((off + CAVE_VIEW) / (2 * CAVE_VIEW)) * CAVE_BINS);
    beam *= 1 - 0.88 * caveRamp(7, 40, d - caveShadow[bin]);
  }
  beam *= 1 / Math.sqrt(1 + Math.pow(d / (0.6 * canvas.width), 2));
  if (dust) return beam * 0.85;
  const spill = 0.12 * (1 - caveRamp(cave.beam, cave.spill, a));
  return Math.min(1, cave.dark + spill + beam);
}

function stepCave() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  caveTime++;
  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }

  // The lamp, worn at head height by someone standing at the right wall,
  // turning to look at the cursor; and what stands in its way, wedge by
  // wedge, so the light stops at the first thing it meets.
  const look = caveLook();
  caveLamp.x = w * 0.955;
  caveLamp.y = caveAt(caveFloor, caveLamp.x) - 0.16 * h;
  const want = Math.atan2(look.y - caveLamp.y, look.x - caveLamp.x);
  caveLamp.angle += caveWrap(want - caveLamp.angle) * 0.1;
  caveShadow.fill(1e9);
  function wedge(x, y) {
    const off = caveWrap(Math.atan2(y - caveLamp.y, x - caveLamp.x) - caveLamp.angle);
    return ((off + CAVE_VIEW) / (2 * CAVE_VIEW)) * CAVE_BINS;
  }
  // Something solid from (x1, y1) to (x2, y2): the wedges it spans see no
  // further than it.
  function block(x1, y1, x2, y2) {
    let b1 = wedge(x1, y1);
    let b2 = wedge(x2, y2);
    if (Math.abs(b2 - b1) > CAVE_BINS / 2) return;
    if (b1 > b2) [b1, b2] = [b2, b1];
    const d = Math.min(Math.hypot(x1 - caveLamp.x, y1 - caveLamp.y), Math.hypot(x2 - caveLamp.x, y2 - caveLamp.y));
    for (let b = Math.max(0, Math.floor(b1)); b <= Math.min(CAVE_BINS - 1, Math.floor(b2)); b++) {
      if (d < caveShadow[b]) caveShadow[b] = d;
    }
  }

  // The rock, the ceiling and the floor.
  for (let i = 0; i < caveRock.length; i += 2) put(caveRock[i], caveRock[i + 1]);
  for (let x = 0; x < w; x += 3) {
    put(x, caveAt(caveCeiling, x));
    put(x, caveAt(caveFloor, x));
    block(x, caveAt(caveCeiling, x), x + 3, caveAt(caveCeiling, x + 3));
    block(x, caveAt(caveFloor, x), x + 3, caveAt(caveFloor, x + 3));
  }
  // The one with the lamp, a dark shape against the wall: helmet, head and
  // shoulders; and the lamp on the helmet's front.
  const hx = caveLamp.x + 0.012 * h;
  const hy = caveLamp.y;
  const head = 0.022 * h;
  for (let k = 0; k <= 14; k++) {
    const a = Math.PI + (k / 14) * Math.PI;
    put(hx + head * 1.15 * Math.cos(a), hy - head * 0.3 + head * 0.9 * Math.sin(a));
  }
  for (let k = 0; k <= 8; k++) put(hx - head * 1.5 + (k / 8) * head * 3, hy - head * 0.3);
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI;
    put(hx + head * 0.8 * Math.cos(a), hy - head * 0.3 + head * 1.1 * Math.sin(a));
  }
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    put(hx - head * 2.4 * t, hy + head * 1.2 + head * 1.6 * t * t);
    put(hx + head * 1.6 * t, hy + head * 1.2 + head * 1.2 * t * t);
  }
  for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) put(caveLamp.x + ox, caveLamp.y + oy);

  // The dust, drifting through the chamber.
  caveMoteFrom = next;
  for (let i = 0; i < caveMotes.length; i += 4) {
    caveMotes[i + 2] = caveMotes[i + 2] * 0.98 + (Math.random() - 0.5) * 0.02;
    caveMotes[i + 3] = caveMotes[i + 3] * 0.98 + (Math.random() - 0.5) * 0.02;
    caveMotes[i] += caveMotes[i + 2] + 0.03;
    caveMotes[i + 1] += caveMotes[i + 3];
    if (caveMotes[i] > w) caveMotes[i] -= w;
    const x = caveMotes[i];
    const low = caveAt(caveCeiling, x) + 4;
    const high = caveAt(caveFloor, x) - 4;
    if (caveMotes[i + 1] < low || caveMotes[i + 1] > high) caveMotes[i + 1] = low + Math.random() * (high - low);
    put(x, caveMotes[i + 1]);
  }
  caveMoteTo = next;

  // Each place's formations as they stand: how far each reaches, and where
  // the water drips from and lands.
  const seepX = cursorOnPage ? cursorPosition.x : look.x;
  for (const site of caveSites) {
    const grown = caveGrown(site.age);
    const ceiling = caveAt(caveCeiling, site.x);
    const floor = caveAt(caveFloor, site.x);
    const gap = floor - ceiling;
    let hang = gap * site.hang * grown;
    let rise = gap * site.rise * grown;
    if (hang + rise >= gap) {
      if (site.joined < 0) site.joined = site.age;
      const meet = (gap * site.hang) / (site.hang + site.rise);
      hang = meet;
      rise = gap - meet;
    }
    site.ceilingY = ceiling;
    site.floorY = floor;
    site.hangL = hang;
    site.riseL = rise;
    site.grownNow = grown;
    // Where it drips from: the tip, the lowest fold of a curtain, or the
    // longest straw.
    site.dripX = site.x + site.above.bend;
    site.dripY = ceiling + hang;
    if (site.kind === "curtain") {
      site.dripX = site.x + (((Math.PI / 2 - site.foldP) / site.folds) % (site.span / 2));
      site.dripY = caveAt(caveCeiling, site.dripX) + caveCurtain(site, site.dripX, hang);
    } else if (site.kind === "straws") {
      let longest = site.straws[0];
      for (const s of site.straws) if (s.reach > longest.reach) longest = s;
      site.dripX = site.x + longest.dx;
      site.dripY = caveAt(caveCeiling, site.dripX) + gap * longest.reach * grown;
    } else if (site.joined >= 0) {
      site.dripX = site.x;
    }
    // Dripping, faster near the cursor.
    site.wait -= Math.abs(site.x - seepX) < 0.12 * w ? cave.seep : 1;
    if (site.wait <= 0) {
      site.wait = site.every * (0.7 + Math.random() * 0.6);
      if (site.joined >= 0 && site.kind !== "curtain" && site.kind !== "straws") {
        // Down the column's side instead.
        site.age++;
        caveDrops.push({ site, film: true, y: ceiling + hang, side: Math.random() < 0.5 ? -1 : 1, vy: 1.5 });
      } else {
        const hangs = 14 + Math.random() * 10;
        caveDrops.push({ site, film: false, x: site.dripX, y: site.dripY, vy: 0, hang: hangs, splash: 0 });
      }
    }
  }
  // The smaller stalactites grow at their own pace, faster near the cursor,
  // now and then letting a drop fall.
  for (const form of caveHangers) {
    form.wait -= Math.abs(form.x - seepX) < 0.12 * w ? cave.seep : 1;
    if (form.wait > 0) continue;
    form.wait = form.every * (0.7 + Math.random() * 0.6);
    form.age++;
    if (Math.random() < 0.4) {
      const ceiling = caveAt(caveCeiling, form.x);
      const L = (caveAt(caveFloor, form.x) - ceiling) * form.reach * caveGrown(form.age * 6);
      caveDrops.push({ site: null, film: false, x: form.x + form.bend, y: ceiling + L, vy: 0, hang: 10, splash: 0 });
    }
  }

  // The water: drops gathering at a tip, falling and splashing, each leaving
  // its calcite where it lands; or running down a column.
  caveDrops = caveDrops.filter(function (d) {
    const site = d.site;
    if (d.film) {
      d.y += d.vy;
      const z = site.floorY - d.y;
      if (z <= 0) return false;
      const above = d.y < site.ceilingY + site.hangL;
      const r = above
        ? caveHangWidth(site.above, d.y - site.ceilingY, site.hangL, site.grownNow)
        : caveRiseWidth(site, z, site.riseL, site.grownNow);
      put(site.x + d.side * r, d.y);
      return true;
    }
    const land = site ? site.floorY - site.riseL : caveAt(caveFloor, d.x);
    if (d.splash > 0) {
      const k = 9 - d.splash;
      put(d.x - k * 1.5, land - k * (3 - k * 0.35));
      put(d.x + k * 1.5, land - k * (3 - k * 0.35));
      put(d.x, land - k * 0.8);
      return --d.splash > 0;
    }
    if (d.hang > 0) {
      d.hang--;
      if (site) d.y = site.dripY;
      put(d.x, d.y + 1.5);
      if (d.hang < 7) put(d.x, d.y + 2.5);
      return true;
    }
    d.vy += cave.gravity;
    d.y += d.vy;
    if (d.y >= land) {
      if (site) site.age++;
      d.splash = 8;
      return true;
    }
    put(d.x, d.y);
    put(d.x, d.y - d.vy * 0.5);
    return true;
  });

  // The formations, laid out finely, then thinned to fit; each solid row of
  // them standing in the lamp's way.
  let count = 0;
  const buffer = caveBuffer;
  const fine = caveFine;
  function add(x, y) {
    if (count + 2 > buffer.length) return;
    buffer[count++] = x;
    buffer[count++] = y;
  }
  // Both sides of a solid row, from xl to xr at y.
  function row(xl, xr, y) {
    add(xl, y);
    add(xr, y);
    block(xl, y, xr, y);
  }
  // A rim round a stalagmite, half `r` across, seen a little from the side.
  function rim(x, y, r) {
    const steps = Math.max(3, Math.round((Math.PI * r) / (fine * 2.5)));
    for (let k = 0; k <= steps; k++) {
      const a = (k / steps) * Math.PI;
      add(x + r * Math.cos(a), y + r * 0.22 * Math.sin(a));
    }
  }
  // A stalactite of shape `f` from the ceiling at (x, top), `L` long: its
  // sides; lines down it following the flow, on the larger ones; a blunt end
  // where it has snapped off; and anything added to its width.
  function stalactite(f, x, top, L, grown, extra) {
    if (L < 1) return;
    const end = f.broken ? L * 0.85 : L;
    for (let s = 0; s <= end; s += fine) {
      const r = caveHangWidth(f, s, L, grown) + (extra ? extra(top + s) : 0);
      const bend = f.bend * Math.pow(s / L, 2);
      row(x + bend - r * caveLump(f.lumps, s, -1), x + bend + r * caveLump(f.lumps, s, 1), top + s);
    }
    const wide = f.width * (0.25 + 0.75 * Math.pow(grown, 0.7));
    if (wide > 6) {
      for (let s = L * 0.06; s < end * (1 - f.straw) * 0.9; s += fine * 1.6) {
        const r = caveHangWidth(f, s, L, grown);
        const bend = f.bend * Math.pow(s / L, 2);
        add(x + bend - r * 0.45 * caveLump(f.lumps, s + 30, -1), top + s);
        add(x + bend + r * 0.4 * caveLump(f.lumps, s + 60, 1), top + s);
      }
    }
    if (f.broken) {
      const r = caveHangWidth(f, end, L, grown);
      const bend = f.bend * Math.pow(end / L, 2);
      for (let k = -r; k <= r; k += fine) add(x + bend + k, top + end);
    }
  }

  // The smaller stalactites.
  for (const form of caveHangers) {
    const top = caveAt(caveCeiling, form.x);
    const grown = caveGrown(form.age * 6);
    stalactite(form, form.x, top, (caveAt(caveFloor, form.x) - top) * form.reach * grown, grown, null);
  }
  // Each place's formations.
  for (const site of caveSites) {
    const grown = site.grownNow;
    const top = site.ceilingY;
    const bottom = site.floorY;
    const hang = site.hangL;
    const rise = site.riseL;
    // Its waist filling out, once its formations have met.
    const waist = site.joined >= 0 ? Math.min(1, (site.age - site.joined) / cave.pace) * site.above.width * 0.4 : 0;
    const neck = function (y) {
      return waist * Math.exp(-Math.pow((y - (top + hang)) / 25, 2));
    };
    if (site.kind === "curtain") {
      // A curtain, folded, hanging from the ceiling, striped along its edge.
      const half = site.span / 2;
      let last = 0;
      let lastX = 0;
      let lastY = 0;
      for (let x = site.x - half; x <= site.x + half; x += fine) {
        const ceil = caveAt(caveCeiling, x);
        const fold = Math.sin((x - site.x) * site.folds + site.foldP);
        const drop = caveCurtain(site, x, hang);
        add(x, ceil + drop);
        if (lastX) block(lastX, lastY, x, ceil + drop);
        lastX = x;
        lastY = ceil + drop;
        if ((x | 0) % (fine * 2) < fine) {
          for (const f of [0.2, 0.42, 0.62, 0.8, 0.92]) add(x, ceil + drop * f);
        }
        // Down each fold, from the ceiling to the edge.
        if (fold > 0.97 || (last > 0 && fold <= 0) || (last < 0 && fold >= 0)) {
          for (let y = ceil; y < ceil + drop; y += fine * 1.5) add(x, y);
        }
        last = fold;
      }
    } else if (site.kind === "straws") {
      // Soda straws: thin tubes, each with a drop-rimmed tip.
      for (const straw of site.straws) {
        const x = site.x + straw.dx;
        const ceil = caveAt(caveCeiling, x);
        const length = (bottom - top) * straw.reach * grown;
        for (let y = ceil; y < ceil + length; y += fine) row(x - 1.2, x + 1.2, y);
        rim(x, ceil + length, 1.6);
      }
    } else {
      stalactite(site.above, site.x, top, hang, grown, neck);
    }
    // The stalagmite under where it drips, bowing a little off upright and
    // back, so its top is where the drops land; ringed with rims at uneven
    // spacing, as the splashing left them.
    const mx = site.dripX;
    const bow = function (z) {
      return site.lean * Math.sin(Math.PI * Math.min(1, z / Math.max(1, rise)));
    };
    for (let z = 0; z <= rise; z += fine) {
      const y = bottom - z;
      const r = caveRiseWidth(site, z, rise, grown) + neck(y);
      row(mx + bow(z) - r * caveLump(site.lumpsM, z, -1), mx + bow(z) + r * caveLump(site.lumpsM, z, 1), y);
    }
    const uneven = (k) => site.band * (0.6 + 0.8 * ((k * 0.618 + site.phase * 0.7) % 1));
    for (let z = site.band * 0.5, k = 0; z < rise - 2; z += uneven(k++)) {
      rim(mx + bow(z), bottom - z, caveRiseWidth(site, z, rise, grown) + neck(bottom - z));
    }
    // Smaller stalagmites round its foot.
    for (const mound of site.mounds) {
      const x = mx + mound.dx;
      const floor = caveAt(caveFloor, x);
      const tall = Math.max(rise, (bottom - top) * 0.15 * grown) * mound.reach;
      for (let z = 0; z <= tall; z += fine) {
        const r = Math.max(0.8, caveRiseWidth(site, z, tall, grown) * mound.thin);
        row(x - r * caveLump(site.lumpsM, z + 150, -1), x + r * caveLump(site.lumpsM, z + 150, 1), floor - z);
      }
    }
  }
  // Thinned evenly to fit the dots left; and next time laid out only a little
  // more finely than that needs.
  const points = count / 2;
  const room = Math.max(0, n - next);
  caveFine = Math.max(1.5, Math.min(12, caveFine + ((caveFine * points) / Math.max(1, room * 1.15) - caveFine) * 0.3));
  const stride = Math.max(1, points / Math.max(1, room));
  for (let k = 0; k < points && next < n; k += stride) {
    const i = Math.floor(k) * 2;
    put(buffer[i], buffer[i + 1]);
  }
  while (next < n) put(-100, -100);
}

registerBackground("cave", {
  start: startCave,
  step: stepCave,
  light: caveLight,
  settings: cave,
  archived: true,
});
