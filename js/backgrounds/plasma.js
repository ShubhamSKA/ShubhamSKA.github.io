// The plasma ball background. Loaded after infinity.js.

// ---- Plasma ball -------------------------------------------------------------
// The cursor is the electrode of a plasma ball whose glass is the edge of the
// page. Bolts run from it nearly straight out to the edge, jagged the way
// lightning is: each is drawn by midpoint displacement, so it bends a little
// over its whole length and more and more sharply over shorter stretches.
// The broad bends drift from frame to frame; the fine kinks are redrawn every
// few frames, so a bolt crackles while keeping its course. Near the edge a
// bolt splits into a few tendrils that fan out and meet the edge close by,
// with a bright spot at each place it touches, and a short branch or two
// forks off along the way and dies out in the air. The bolts swing round the
// electrode quickly and at random, keep apart from one another, and live only
// a moment: each goes out and strikes again somewhere else, running out from
// the electrode in a few frames.
// Dots: a glowing clump for the electrode, a spot where each bolt meets the
// edge, and the rest shared out along the bolts by length, so every bolt is
// drawn equally bright.
const plasma = {
  bolts: 9,
  coreSize: 6, // px: spread of the electrode's glow
  coreDots: 200,
  spotDots: 20, // where a bolt touches the edge
  spotSize: 4, // px
  detail: 6, // halvings of a bolt for its kinks: 2^detail stretches
  rough: 0.07, // how far a bolt bends off straight overall, share of its length
  jagged: 0.56, // share of each halving's bend the next keeps; 0.5 is even at every
  //               scale, higher is more jagged up close
  sway: 0.08, // how quickly the broad bends drift, per frame
  recrackle: 0.35, // chance per frame the fine kinks are redrawn
  tendrils: [2, 4], // at a bolt's end, fewest to most
  tendrilSpread: 0.12, // rad either side of the bolt their ends land, at most
  tendrilFrom: [0.72, 0.93], // where along the bolt they split off
  branches: [0, 3], // short branches dying out in the air, fewest to most
  branchLength: [0.06, 0.2], // share of the bolt's length
  branchAngle: [0.3, 0.9], // rad off the bolt
  whirl: 0.012, // how quickly the bolts swing round the electrode
  repel: 0.0015, // how hard they keep apart
  life: [12, 90], // frames a bolt lasts before it strikes again
  strike: 3, // frames a new bolt takes to reach the edge
  shimmer: 0.4, // px of fresh jitter on every dot every frame
};

let plasmaBolts = [];

function plasmaBetween(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

// A whole number from range[0] to range[1], each as likely.
function plasmaCount(range) {
  const lo = Math.round(range[0]);
  return lo + Math.floor(Math.random() * (Math.round(range[1]) - lo + 1));
}

function plasmaGauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random() * 0.9999)) * Math.cos(Math.random() * Math.PI * 2);
}

// A path of 2^detail stretches between two ends, and the random numbers it
// is displaced by: one per point, each point's halving known from its index.
function plasmaPath(detail) {
  const count = 1 << detail;
  const g = new Float32Array(count + 1);
  for (let i = 1; i < count; i++) g[i] = plasmaGauss();
  return { detail, g, offset: new Float32Array(count + 1) };
}

// Midpoint displacement: each halving moves the middle of every stretch
// sideways, by less each time. Offsets are a share of the path's length.
function plasmaDisplace(path, rough) {
  const count = 1 << path.detail;
  const o = path.offset;
  o[0] = 0;
  o[count] = 0;
  let amp = rough;
  for (let level = 0; level < path.detail; level++) {
    const step = count >> (level + 1);
    for (let i = step; i < count; i += 2 * step) {
      o[i] = 0.5 * (o[i - step] + o[i + step]) + path.g[i] * amp;
    }
    amp *= plasma.jagged;
  }
}

// The first two halvings drift; the rest are redrawn now and then.
function plasmaCrackle(path, recrackle) {
  const count = 1 << path.detail;
  const keep = 1 - plasma.sway;
  const fresh = Math.sqrt(1 - keep * keep);
  const broad = count >> 2;
  const redraw = Math.random() < recrackle;
  for (let i = 1; i < count; i++) {
    if (i % broad === 0) path.g[i] = path.g[i] * keep + plasmaGauss() * fresh;
    else if (redraw) path.g[i] = plasmaGauss();
  }
}

function plasmaStrike(bolt) {
  bolt.angle = Math.random() * Math.PI * 2;
  bolt.spin = 0;
  bolt.age = 0;
  bolt.life = plasmaBetween(plasma.life);
  bolt.path = plasmaPath(Math.max(2, Math.round(plasma.detail)));
  bolt.tendrils = [];
  for (let k = plasmaCount(plasma.tendrils); k > 0; k--) {
    bolt.tendrils.push({
      from: plasmaBetween(plasma.tendrilFrom),
      turn: (Math.random() * 2 - 1) * plasma.tendrilSpread,
      path: plasmaPath(Math.max(2, Math.round(plasma.detail) - 2)),
    });
  }
  bolt.branches = [];
  for (let k = plasmaCount(plasma.branches); k > 0; k--) {
    bolt.branches.push({
      from: 0.15 + Math.random() * 0.6,
      length: plasmaBetween(plasma.branchLength),
      turn: (Math.random() < 0.5 ? -1 : 1) * plasmaBetween(plasma.branchAngle),
      path: plasmaPath(Math.max(2, Math.round(plasma.detail) - 3)),
    });
  }
}

function plasmaCentre() {
  return cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: canvas.width / 2, y: canvas.height / 2 };
}

// Where a ray from (x, y) at `angle` leaves the page, into plasmaEnd.
const plasmaEnd = { x: 0, y: 0 };
function plasmaEdge(x, y, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = dx > 1e-9 ? (canvas.width - x) / dx : dx < -1e-9 ? -x / dx : Infinity;
  const ty = dy > 1e-9 ? (canvas.height - y) / dy : dy < -1e-9 ? -y / dy : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  plasmaEnd.x = x + dx * t;
  plasmaEnd.y = y + dy * t;
}

function startPlasma() {
  plasmaBolts = [];
  for (let i = 0; i < Math.max(1, Math.round(plasma.bolts)); i++) {
    const bolt = {};
    plasmaStrike(bolt);
    // Not all at the start of their lives, or they would all strike again
    // together.
    bolt.age = plasma.strike + Math.random() * bolt.life;
    bolt.life += bolt.age;
    plasmaBolts.push(bolt);
  }
}

// The point t of the way along a path from (ax, ay) to (bx, by), into
// plasmaAt.
const plasmaAt = { x: 0, y: 0 };
function plasmaAlong(path, ax, ay, bx, by, t) {
  const count = 1 << path.detail;
  const f = Math.min(count - 1e-4, Math.max(0, t * count));
  const i = Math.floor(f);
  const o = path.offset[i] + (path.offset[i + 1] - path.offset[i]) * (f - i);
  // The offset is a share of the length, along the normal (-dy, dx).
  plasmaAt.x = ax + (bx - ax) * t - (by - ay) * o;
  plasmaAt.y = ay + (by - ay) * t + (bx - ax) * o;
}

let plasmaNext = 0;
function plasmaPut(x, y) {
  if (plasmaNext >= whiteElements.length) return;
  const e = whiteElements[plasmaNext++];
  e.x = x + (Math.random() * 2 - 1) * plasma.shimmer;
  e.y = y + (Math.random() * 2 - 1) * plasma.shimmer;
}

// `dots` dots along a path, none past `reach` of the way: a bolt still
// running out has its spare dots bunched at its leader.
function plasmaDraw(path, ax, ay, bx, by, dots, reach) {
  for (let k = 0; k < dots; k++) {
    plasmaAlong(path, ax, ay, bx, by, Math.min(reach, (k + 0.5) / dots));
    plasmaPut(plasmaAt.x, plasmaAt.y);
  }
}

function plasmaSpot(x, y, dots) {
  for (let k = 0; k < dots; k++) {
    plasmaPut(x + plasmaGauss() * plasma.spotSize, y + plasmaGauss() * plasma.spotSize);
  }
}

function stepPlasma() {
  const n = whiteElements.length;
  const c = plasmaCentre();
  const bolts = plasmaBolts;

  // The bolts swing round at random, keep apart, flicker, and strike anew.
  for (let i = 0; i < bolts.length; i++) {
    const bolt = bolts[i];
    bolt.age++;
    if (bolt.age > bolt.life) plasmaStrike(bolt);
    let push = 0;
    for (let j = 0; j < bolts.length; j++) {
      if (j === i) continue;
      let d = bolt.angle - bolts[j].angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      push += (Math.sign(d) * plasma.repel) / (d * d + 0.02);
    }
    bolt.spin = bolt.spin * 0.85 + plasmaGauss() * plasma.whirl;
    bolt.angle += bolt.spin + push;
    plasmaCrackle(bolt.path, plasma.recrackle);
    plasmaDisplace(bolt.path, plasma.rough);
    for (const piece of bolt.tendrils.concat(bolt.branches)) {
      plasmaCrackle(piece.path, plasma.recrackle);
      plasmaDisplace(piece.path, plasma.rough * 1.2);
    }
  }

  // Where every piece runs, and how long it is, so dots can go by length.
  const pieces = [];
  let total = 0;
  for (const bolt of bolts) {
    plasmaEdge(c.x, c.y, bolt.angle);
    const ex = plasmaEnd.x;
    const ey = plasmaEnd.y;
    const reach = Math.min(1, bolt.age / Math.max(1, plasma.strike));
    const length = Math.hypot(ex - c.x, ey - c.y);
    // A piece the leader has not reached yet keeps its dots there.
    plasmaAlong(bolt.path, c.x, c.y, ex, ey, reach);
    const lead = { x: plasmaAt.x, y: plasmaAt.y };
    pieces.push({ path: bolt.path, ax: c.x, ay: c.y, bx: ex, by: ey, reach, length, spot: true, lead });
    total += length;
    for (const tendril of bolt.tendrils) {
      plasmaAlong(bolt.path, c.x, c.y, ex, ey, tendril.from);
      const ax = plasmaAt.x;
      const ay = plasmaAt.y;
      plasmaEdge(c.x, c.y, bolt.angle + tendril.turn);
      const tendrilLength = Math.hypot(plasmaEnd.x - ax, plasmaEnd.y - ay);
      pieces.push({
        path: tendril.path,
        ax,
        ay,
        bx: plasmaEnd.x,
        by: plasmaEnd.y,
        reach: reach < tendril.from ? 0 : (reach - tendril.from) / (1 - tendril.from),
        length: tendrilLength,
        spot: true,
        lead,
      });
      total += tendrilLength;
    }
    for (const branch of bolt.branches) {
      plasmaAlong(bolt.path, c.x, c.y, ex, ey, branch.from);
      const ax = plasmaAt.x;
      const ay = plasmaAt.y;
      const heading = Math.atan2(ey - c.y, ex - c.x) + branch.turn;
      const branchLength = branch.length * length;
      pieces.push({
        path: branch.path,
        ax,
        ay,
        bx: ax + Math.cos(heading) * branchLength,
        by: ay + Math.sin(heading) * branchLength,
        reach: Math.max(0, Math.min(1, (reach - branch.from) / 0.15)),
        length: branchLength,
        spot: false,
        lead,
      });
      total += branchLength;
    }
  }

  plasmaNext = 0;
  const coreDots = Math.min(n, Math.max(0, Math.round(plasma.coreDots)));
  const spotDots = Math.max(0, Math.round(plasma.spotDots));
  let spots = 0;
  for (const piece of pieces) if (piece.spot) spots++;
  const spare = Math.max(0, n - coreDots - spots * spotDots);
  const perPx = total > 0 ? spare / total : 0;

  for (const piece of pieces) {
    const dots = Math.floor(piece.length * perPx);
    if (piece.reach <= 0) {
      for (let k = 0; k < dots + (piece.spot ? spotDots : 0); k++) plasmaPut(piece.lead.x, piece.lead.y);
      continue;
    }
    plasmaDraw(piece.path, piece.ax, piece.ay, piece.bx, piece.by, dots, piece.reach);
    if (piece.spot) {
      if (piece.reach >= 1) plasmaSpot(piece.bx, piece.by, spotDots);
      else {
        plasmaAlong(piece.path, piece.ax, piece.ay, piece.bx, piece.by, piece.reach);
        plasmaSpot(plasmaAt.x, plasmaAt.y, spotDots);
      }
    }
  }

  // The electrode, with whatever rounding left over: redrawn every frame, so
  // it glows rather than sits.
  while (plasmaNext < n) {
    const r = plasma.coreSize * Math.sqrt(-2 * Math.log(1 - Math.random() * 0.999));
    const a = Math.random() * Math.PI * 2;
    const e = whiteElements[plasmaNext++];
    e.x = c.x + Math.cos(a) * r;
    e.y = c.y + Math.sin(a) * r;
  }
}

registerBackground("plasma", {
  start: startPlasma,
  step: stepPlasma,
  settings: plasma,
});
