// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js.

// ---- Hypercube ---------------------------------------------------------------
// A cube of more dimensions than three, from 4 up to 12, flattened onto the
// screen: its corners, every combination of a step either way along each of
// its dimensions, and its edges, each joining two corners a single step
// apart. It is drawn by a linear projection, each of its dimensions laid
// along a direction on the screen; to begin with these are spread evenly round
// half a turn, the most symmetric view, where the cube flattens into a
// many-sided figure tiled with rhombs. It turns all the time, in pairs of its
// dimensions at once, each pair at its own rate, which drifts and reverses,
// so it tumbles through ever new shadows of itself; and it settles back
// towards its symmetric view, the more so whenever the turning eases. The
// more dimensions it has, the slower it turns and the harder it settles: in
// many, any other view is a blur of edges, so there it mostly breathes and
// twists about its rosette. Moving the cursor turns it too, across and up and
// down, carrying on after. It climbs through
// the dimensions and back down: a new dimension unfolds out of the cube,
// every corner splitting into two that draw apart along it, and later folds
// away again. The picture is kept to the same size whatever the view.
// Dots: each corner a small cluster, smaller the more corners there are; the
// rest shared evenly between the edges, a few getting one more. An edge with
// dots enough is drawn whole; one with too few for that, as there are with
// many dimensions, keeps them by its two ends, a few px apart, so each corner
// becomes a star of short spokes, one along each of its dimensions.
const hypercube = {
  dimensions: 0, // from 4 to 12 to stay at, or 0 to climb through them and back
  lowest: 4, // the dimensions it climbs between
  highest: 12,
  hold: 420, // frames it stays at each dimension, climbing
  unfold: 150, // frames a dimension takes to unfold, or fold away
  size: 0.44, // how far its widest reach comes from the middle, share of the shorter side
  spin: 0.006, // rad per frame it turns in a pair of dimensions, at most, in four dimensions
  order: 0.006, // how strongly it settles towards its symmetric view, in four dimensions
  turn: 0.00025, // rad of turn per px the cursor moves
  gap: 3, // px between dots along an edge drawn only by its ends; drawn whole if they would be within four
};

const HYPERCUBE_MOST = 13;
let hypercubeBase = 4; // dimensions fully unfolded
let hypercubeGrow = 0; // how far the next one has unfolded, 0 to 1
let hypercubeWay = 1; // climbing, 1, or coming down, -1
let hypercubeWait = 0; // frames until it next unfolds or folds one
let hypercubeAxes = new Float64Array(HYPERCUBE_MOST * 2); // where each dimension lies on the screen
let hypercubeCorners = new Float32Array((1 << HYPERCUBE_MOST) * 2);
let hypercubeScale = 0; // px per step
let hypercubeTime = 0;
let hypercubeLastX = null; // where the cursor was last frame
let hypercubeLastY = null;
let hypercubeDragX = 0; // turn the cursor has given it, carrying on
let hypercubeDragY = 0;

// The symmetric view of `count` dimensions, some way to `along` of it with a
// dimension unfolding: each laid along its own direction, spread evenly round
// half a turn.
function hypercubeSymmetric(i, count) {
  const a = (Math.PI * i) / count;
  return [Math.cos(a), Math.sin(a)];
}

function hypercubeWanted() {
  const fixed = Math.round(hypercube.dimensions);
  if (fixed >= 2) return Math.min(HYPERCUBE_MOST, fixed);
  return 0;
}

function startHypercube() {
  const fixed = hypercubeWanted();
  hypercubeBase = Math.max(2, Math.min(HYPERCUBE_MOST, fixed || Math.round(hypercube.lowest)));
  hypercubeGrow = 0;
  hypercubeWay = 1;
  hypercubeWait = hypercube.hold;
  for (let i = 0; i < HYPERCUBE_MOST; i++) {
    const [x, y] = hypercubeSymmetric(i, hypercubeBase);
    hypercubeAxes[i * 2] = x;
    hypercubeAxes[i * 2 + 1] = y;
  }
  hypercubeScale = 0;
  hypercubeTime = 0;
  hypercubeLastX = null;
  hypercubeDragX = 0;
  hypercubeDragY = 0;
}

// Turns the cube by `angle` in the plane of dimensions `i` and `j`: on the
// screen, their two directions turn into each other.
function hypercubeTurn(i, j, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const ax = hypercubeAxes[i * 2];
  const ay = hypercubeAxes[i * 2 + 1];
  const bx = hypercubeAxes[j * 2];
  const by = hypercubeAxes[j * 2 + 1];
  hypercubeAxes[i * 2] = ax * c - bx * s;
  hypercubeAxes[i * 2 + 1] = ay * c - by * s;
  hypercubeAxes[j * 2] = ax * s + bx * c;
  hypercubeAxes[j * 2 + 1] = ay * s + by * c;
}

function stepHypercube() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  hypercubeTime++;
  const time = hypercubeTime;

  // Climbing: after a while at each dimension the next unfolds, or, coming
  // down, the last folds away; at either end it turns back. Told to stay at
  // one, it climbs or comes down to it and stays.
  const fixed = hypercubeWanted();
  const lowest = Math.max(2, Math.min(HYPERCUBE_MOST, Math.round(hypercube.lowest)));
  const highest = Math.max(lowest, Math.min(HYPERCUBE_MOST, Math.round(hypercube.highest)));
  const step = 1 / Math.max(1, hypercube.unfold);
  if (hypercubeGrow > 0 && hypercubeWay > 0) {
    hypercubeGrow = Math.min(1, hypercubeGrow + step);
    if (hypercubeGrow === 1) {
      hypercubeBase++;
      hypercubeGrow = 0;
      hypercubeWait = hypercube.hold;
    }
  } else if (hypercubeGrow > 0) {
    hypercubeGrow = Math.max(0, hypercubeGrow - step);
    if (hypercubeGrow === 0) hypercubeWait = hypercube.hold;
  } else if (--hypercubeWait <= 0 || (fixed && fixed !== hypercubeBase)) {
    const up = fixed ? fixed > hypercubeBase : hypercubeWay > 0 ? hypercubeBase < highest : hypercubeBase <= lowest;
    if (fixed === hypercubeBase) {
      hypercubeWait = hypercube.hold;
    } else if (up && hypercubeBase < HYPERCUBE_MOST) {
      // The new dimension starts along its place in the symmetric view.
      hypercubeWay = 1;
      const [x, y] = hypercubeSymmetric(hypercubeBase, hypercubeBase + 1);
      hypercubeAxes[hypercubeBase * 2] = x;
      hypercubeAxes[hypercubeBase * 2 + 1] = y;
      hypercubeGrow = step;
    } else if (hypercubeBase > 2) {
      hypercubeWay = -1;
      hypercubeBase--;
      hypercubeGrow = 1 - step;
    }
  }
  const unfolding = hypercubeGrow > 0;
  const dims = hypercubeBase + (unfolding ? 1 : 0);

  // Turning, in pairs of dimensions, each at a rate that drifts and
  // reverses; and by the cursor, across and up and down.
  const spin = (hypercube.spin * 4) / dims;
  for (let i = 0; i < dims - 1; i++) {
    const rate = spin * Math.sin(time * 0.0011 * (1 + 0.31 * i) + i * 1.7);
    hypercubeTurn(i, i + 1, rate);
  }
  if (dims > 2) hypercubeTurn(dims - 1, 0, spin * Math.sin(time * 0.0009 + 4.1));
  if (cursorOnPage) {
    if (hypercubeLastX !== null) {
      hypercubeDragX += (cursorPosition.x - hypercubeLastX) * hypercube.turn;
      hypercubeDragY += (cursorPosition.y - hypercubeLastY) * hypercube.turn;
    }
    hypercubeLastX = cursorPosition.x;
    hypercubeLastY = cursorPosition.y;
  } else {
    hypercubeLastX = null;
  }
  if (dims > 2) {
    hypercubeTurn(0, dims - 1, hypercubeDragX);
    hypercubeTurn(1, dims - 2, hypercubeDragY);
  }
  hypercubeDragX *= 0.95;
  hypercubeDragY *= 0.95;
  // Settling towards the symmetric view, the more the gentler the turning.
  const calm = 1 - Math.min(1, Math.abs(Math.sin(time * 0.0011 + 1.7)) * 1.5);
  const settle = hypercube.order * Math.pow(dims / 4, 2) * (0.25 + calm);
  for (let i = 0; i < dims; i++) {
    const [x, y] = hypercubeSymmetric(i, hypercubeBase + hypercubeGrow);
    hypercubeAxes[i * 2] += (x - hypercubeAxes[i * 2]) * settle;
    hypercubeAxes[i * 2 + 1] += (y - hypercubeAxes[i * 2 + 1]) * settle;
  }

  // How far each dimension reaches, the unfolding one only so far; and the
  // size, kept so its widest reach is the same whatever the view.
  const reach = new Float64Array(dims * 2);
  for (let i = 0; i < dims; i++) {
    const g = unfolding && i === dims - 1 ? hypercubeGrow : 1;
    reach[i * 2] = hypercubeAxes[i * 2] * g;
    reach[i * 2 + 1] = hypercubeAxes[i * 2 + 1] * g;
  }
  let widest = 1e-6;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let support = 0;
    for (let i = 0; i < dims; i++) support += Math.abs(reach[i * 2] * dx + reach[i * 2 + 1] * dy);
    widest = Math.max(widest, support);
  }
  const target = (hypercube.size * Math.min(w, h)) / widest;
  hypercubeScale = hypercubeScale ? hypercubeScale + (target - hypercubeScale) * 0.05 : target;
  const scale = hypercubeScale;

  // Every corner: from the one a step back along every dimension, each corner
  // is the one without its lowest step forwards, plus that step.
  const corners = 1 << dims;
  const pos = hypercubeCorners;
  let x0 = w / 2;
  let y0 = h / 2;
  for (let i = 0; i < dims; i++) {
    x0 -= reach[i * 2] * scale;
    y0 -= reach[i * 2 + 1] * scale;
  }
  pos[0] = x0;
  pos[1] = y0;
  for (let v = 1; v < corners; v++) {
    const low = 31 - Math.clz32(v & -v);
    const from = v & (v - 1);
    pos[v * 2] = pos[from * 2] + 2 * reach[low * 2] * scale;
    pos[v * 2 + 1] = pos[from * 2 + 1] + 2 * reach[low * 2 + 1] * scale;
  }

  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  // The corners, each a small cluster while there are dots for it.
  const cluster = [0, 0, 1, 0, -1, 0, 0, 1, 0, -1];
  const knot = Math.max(1, Math.min(5, Math.floor((0.2 * n) / corners)));
  for (let v = 0; v < corners; v++) {
    for (let c = 0; c < knot; c++) put(pos[v * 2] + cluster[c * 2], pos[v * 2 + 1] + cluster[c * 2 + 1]);
  }
  // The edges, sharing what is left; a scattering of them one more each.
  const edges = dims * (corners >> 1);
  const left = Math.max(0, n - next);
  const each = Math.floor(left / edges);
  const extra = (left - each * edges) / edges;
  const gap = Math.max(1, hypercube.gap);
  let e = 0;
  for (let v = 0; v < corners && next < n; v++) {
    for (let i = 0; i < dims; i++) {
      if (v & (1 << i)) continue;
      e++;
      const count = each + (((e * 2654435761) >>> 0) / 4294967296 < extra ? 1 : 0);
      if (!count) continue;
      const ax = pos[v * 2];
      const ay = pos[v * 2 + 1];
      const dx = 2 * reach[i * 2] * scale;
      const dy = 2 * reach[i * 2 + 1] * scale;
      const length = Math.hypot(dx, dy);
      if ((count + 1) * gap * 4 >= length) {
        for (let q = 0; q < count; q++) {
          const t = (q + 1) / (count + 1);
          put(ax + dx * t, ay + dy * t);
        }
      } else {
        // Too few to draw it whole: by its two ends, in turn.
        for (let q = 0; q < count; q++) {
          const t = (((q >> 1) + 1) * gap) / length;
          if (q & 1) put(ax + dx * (1 - t), ay + dy * (1 - t));
          else put(ax + dx * t, ay + dy * t);
        }
      }
    }
  }
  while (next < n) put(-100, -100);
}

registerBackground("hypercube", {
  start: startHypercube,
  step: stepHypercube,
  settings: hypercube,
  archived: true,
});
