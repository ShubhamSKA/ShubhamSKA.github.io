// The river background. Loaded after infinity.js.

// ---- River -----------------------------------------------------------------
// A river from the top-left corner to the bottom-right one, its dots flowing
// down it, fastest in mid-stream. The bed meanders the way real rivers do:
// every bend erodes its outer bank, so bends grow and creep downstream, and
// the stretch nearest the cursor is drawn slowly towards it, as if the river
// were trying to pass through it. When a loop's neck erodes shut the river cuts
// through, and the loop is left behind as an oxbow lake that slowly dries up.
// The centre line is a chain of points kept about `spacing` apart; dots ride it
// by distance downstream and by place across the stream.
const river = {
  width: 22, // px across
  spacing: 15, // px between points on the centre line
  speed: 1.6, // px per frame in mid-stream
  erosion: 0.3, // how fast outer banks wear: px per frame per radian of bend
  toCursor: 0.8, // px per frame the bed moves towards the cursor, at most
  cursorSpan: 30, // points either side of the nearest that feel the cursor
  // Straightens kinks too small to be meanders. It works on the bend of the
  // bend (fourth differences), so it bites hard on short wiggles and barely
  // touches long bends; plain smoothing scales with the bend just as erosion
  // does, and the two cancelled out at every size. With the numbers here,
  // bends shorter than about 150 px die and ones round 210 px grow fastest,
  // about ten widths, as in real rivers.
  stiffness: 0.05,
  cutoff: 0.9, // widths: a loop whose neck gets this narrow is cut off
  lakeLife: 2400, // frames an oxbow lake takes to dry up
  lakeShare: 0.6, // share of a cut loop's dots that stay in the lake
  margin: 24, // px from the edges of the screen
};

let riverPoints = []; // the centre line, source first
let riverLength = 0;
let riverCum = new Float32Array(0); // distance downstream of each point
let riverLakes = []; // { points, cum, length, age, cx, cy }
let riverS = new Float32Array(0); // each dot's distance along its water
let riverU = new Float32Array(0); // and its place across it, -1 to 1
let riverLake = new Int16Array(0); // -1 in the river, else which lake
let riverFrame = 0;

function measure(points, closed) {
  const count = points.length;
  const cum = new Float32Array(count + 1);
  for (let i = 1; i <= count; i++) {
    const a = points[i - 1];
    const b = points[i % count];
    if (i === count && !closed) {
      cum[i] = cum[i - 1];
      break;
    }
    cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  return cum;
}

// Point and left-hand normal at distance s along a chain of points.
const riverAt = { x: 0, y: 0, nx: 0, ny: 0 };
function along(points, cum, s, closed) {
  const count = points.length;
  const segments = closed ? count : count - 1;
  let lo = 0;
  let hi = segments - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo];
  const b = points[(lo + 1) % count];
  const length = cum[lo + 1] - cum[lo] || 1;
  const f = Math.min(1, Math.max(0, (s - cum[lo]) / length));
  riverAt.x = a.x + (b.x - a.x) * f;
  riverAt.y = a.y + (b.y - a.y) * f;
  riverAt.nx = -(b.y - a.y) / length;
  riverAt.ny = (b.x - a.x) / length;
}

function startRiver() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  const m = river.margin;
  const x0 = m;
  const y0 = m;
  const x1 = w - m;
  const y1 = h - m;
  const length = Math.hypot(x1 - x0, y1 - y0);
  const count = Math.max(2, Math.round(length / river.spacing));
  riverPoints = [];
  for (let i = 0; i <= count; i++) {
    const f = i / count;
    // A gentle wiggle to start meanders from; zero at both ends.
    const wiggle = Math.sin(f * Math.PI * 3) * Math.sin(f * Math.PI) * 30;
    riverPoints.push({
      x: x0 + (x1 - x0) * f + (wiggle * (y1 - y0)) / length,
      y: y0 + (y1 - y0) * f - (wiggle * (x1 - x0)) / length,
    });
  }
  riverCum = measure(riverPoints, false);
  riverLength = riverCum[riverPoints.length - 1];
  riverLakes = [];
  riverS = new Float32Array(n);
  riverU = new Float32Array(n);
  riverLake = new Int16Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    riverS[i] = Math.random() * riverLength;
    riverU[i] = Math.random() * 2 - 1;
  }
  riverFrame = 0;
}

function erodeRiver() {
  const pts = riverPoints;
  const count = pts.length;
  const w = canvas.width;
  const h = canvas.height;
  // Which way each bend's centre lies: the change in direction across it.
  const inX = new Float32Array(count);
  const inY = new Float32Array(count);
  for (let i = 1; i < count - 1; i++) {
    const a = pts[i - 1];
    const p = pts[i];
    const b = pts[i + 1];
    const l1 = Math.hypot(p.x - a.x, p.y - a.y) || 1;
    const l2 = Math.hypot(b.x - p.x, b.y - p.y) || 1;
    inX[i] = (b.x - p.x) / l2 - (p.x - a.x) / l1;
    inY[i] = (b.y - p.y) / l2 - (p.y - a.y) / l1;
  }

  // The stretch nearest the cursor is drawn towards it.
  let nearest = -1;
  if (cursorOnPage) {
    let best = Infinity;
    for (let i = 0; i < count; i++) {
      const d = (pts[i].x - cursorPosition.x) ** 2 + (pts[i].y - cursorPosition.y) ** 2;
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
  }

  const moved = pts.map(function (p) {
    return { x: p.x, y: p.y };
  });
  for (let i = 1; i < count - 1; i++) {
    // Outer banks wear away. Bends feel the bends upstream of them too, which
    // is what makes meanders creep downstream rather than only grow.
    const bx = 0.5 * inX[i] + 0.3 * inX[i - 1] + 0.2 * inX[Math.max(0, i - 2)];
    const by = 0.5 * inY[i] + 0.3 * inY[i - 1] + 0.2 * inY[Math.max(0, i - 2)];
    let dx = -bx * river.erosion;
    let dy = -by * river.erosion;
    // Kinks smaller than a meander are straightened.
    if (i >= 2 && i < count - 2) {
      dx -= river.stiffness * (pts[i - 2].x - 4 * pts[i - 1].x + 6 * pts[i].x - 4 * pts[i + 1].x + pts[i + 2].x);
      dy -= river.stiffness * (pts[i - 2].y - 4 * pts[i - 1].y + 6 * pts[i].y - 4 * pts[i + 1].y + pts[i + 2].y);
    } else {
      dx += ((pts[i - 1].x + pts[i + 1].x) / 2 - pts[i].x) * 0.2;
      dy += ((pts[i - 1].y + pts[i + 1].y) / 2 - pts[i].y) * 0.2;
    }
    if (nearest !== -1 && Math.abs(i - nearest) < river.cursorSpan) {
      const weight = Math.exp(-(((i - nearest) / (river.cursorSpan / 2)) ** 2));
      const cx = cursorPosition.x - pts[i].x;
      const cy = cursorPosition.y - pts[i].y;
      const d = Math.hypot(cx, cy) || 1;
      const pull = river.toCursor * weight * Math.min(1, d / 20);
      dx += (cx / d) * pull;
      dy += (cy / d) * pull;
    }
    const m = river.margin;
    moved[i].x = Math.min(w - m, Math.max(m, pts[i].x + dx));
    moved[i].y = Math.min(h - m, Math.max(m, pts[i].y + dy));
  }

  // Keep the points about `spacing` apart.
  const even = [moved[0]];
  for (let i = 1; i < moved.length; i++) {
    const prev = even[even.length - 1];
    const p = moved[i];
    const gap = Math.hypot(p.x - prev.x, p.y - prev.y);
    if (gap < river.spacing * 0.5 && i < moved.length - 1) continue;
    if (gap > river.spacing * 1.5) {
      const parts = Math.ceil(gap / river.spacing);
      for (let k = 1; k < parts; k++) {
        even.push({ x: prev.x + ((p.x - prev.x) * k) / parts, y: prev.y + ((p.y - prev.y) * k) / parts });
      }
    }
    even.push(p);
  }
  riverPoints = even;
}

// A loop whose neck has closed is cut off, and becomes a lake.
function cutOffLoops() {
  const pts = riverPoints;
  const neck2 = (river.cutoff * river.width) ** 2;
  const gap = Math.ceil((river.width * 4) / river.spacing); // a real loop, not a neighbour
  for (let i = 1; i < pts.length - gap; i++) {
    for (let j = i + gap; j < pts.length - 1; j++) {
      const d2 = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
      if (d2 > neck2) continue;
      const cum = measure(pts, false);
      const from = cum[i];
      const to = cum[j];
      const loop = pts.slice(i, j + 1);
      const lakeCum = measure(loop, true);
      const lake = {
        points: loop,
        cum: lakeCum,
        length: lakeCum[loop.length],
        age: 0,
        cx: loop.reduce((a, p) => a + p.x, 0) / loop.length,
        cy: loop.reduce((a, p) => a + p.y, 0) / loop.length,
      };
      const lakeIndex = riverLakes.length;
      riverLakes.push(lake);
      const removed = to - from - Math.sqrt(d2);
      for (let k = 0; k < riverS.length; k++) {
        if (riverLake[k] !== -1) continue;
        if (riverS[k] > from && riverS[k] < to) {
          if (Math.random() < river.lakeShare) {
            riverLake[k] = lakeIndex;
            riverS[k] = ((riverS[k] - from) / (to - from)) * lake.length;
          } else {
            riverS[k] = from;
          }
        } else if (riverS[k] >= to) {
          riverS[k] -= removed;
        }
      }
      riverPoints = pts.slice(0, i + 1).concat(pts.slice(j));
      return;
    }
  }
}

function stepRiver() {
  riverFrame++;
  erodeRiver();
  if (riverFrame % 15 === 0) cutOffLoops();
  riverCum = measure(riverPoints, false);
  riverLength = riverCum[riverPoints.length - 1];

  // Lakes dry up, shrinking towards their middle, and hand their dots back.
  for (let k = riverLakes.length - 1; k >= 0; k--) {
    const lake = riverLakes[k];
    lake.age++;
    if (lake.age < river.lakeLife) continue;
    const last = riverLakes.length - 1;
    for (let i = 0; i < riverLake.length; i++) {
      if (riverLake[i] === k) {
        riverLake[i] = -1;
        riverS[i] = Math.random() * riverLength;
      } else if (riverLake[i] === last) {
        riverLake[i] = k;
      }
    }
    riverLakes[k] = riverLakes[last];
    riverLakes.pop();
  }

  const ease = Math.min(1, 0.04 + riverFrame * 0.002);
  const half = river.width / 2;
  for (let i = 0; i < whiteElements.length; i++) {
    const u = riverU[i];
    let tx;
    let ty;
    if (riverLake[i] === -1) {
      riverS[i] += river.speed * (0.35 + 0.65 * (1 - u * u));
      if (riverS[i] >= riverLength) {
        riverS[i] -= riverLength;
        riverU[i] = Math.random() * 2 - 1;
      }
      along(riverPoints, riverCum, riverS[i], false);
      tx = riverAt.x + riverAt.nx * u * half;
      ty = riverAt.y + riverAt.ny * u * half;
    } else {
      // Lake water barely moves.
      const lake = riverLakes[riverLake[i]];
      riverS[i] = (riverS[i] + 0.05) % lake.length;
      along(lake.points, lake.cum, riverS[i], true);
      const shrink = 1 - 0.7 * (lake.age / river.lakeLife);
      tx = lake.cx + (riverAt.x + riverAt.nx * u * half * 0.6 - lake.cx) * shrink;
      ty = lake.cy + (riverAt.y + riverAt.ny * u * half * 0.6 - lake.cy) * shrink;
    }
    const e = whiteElements[i];
    e.x += (tx - e.x) * ease;
    e.y += (ty - e.y) * ease;
  }
}

registerBackground("river", {
  start: startRiver,
  step: stepRiver,
  settings: river,
});
