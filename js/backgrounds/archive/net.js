// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js.

// ---- Net -----------------------------------------------------------------------
// A net of knotted string stretched across the screen, its meshes diamonds,
// its edges tied to the screen's, seen face on and in perspective. The cursor
// presses into it like a fingertip, a ball pushed into the net: the knots it
// touches slide round it and back, the threads round it stretch and draw the
// meshes in towards the dent, and the dent, sinking away from the eye, looks
// smaller. Move the cursor and the dent follows; behind it the net springs
// back, overshoots and ripples as it settles. A faint breeze stirs it all the
// time. Each knot is a weight, and each thread a string of a few links with
// weights between, so a thread can wrap round the ball too; the links pull
// when they are stretched and go slack when they are not, and are a little
// short, so the net is taut. Without a cursor the fingertip wanders.
// Dots: each knot a small cluster, then dots along every thread, as many as
// are left, shared out evenly, so they crowd where the net is drawn in; the
// rest are parked out of sight.
const net = {
  mesh: 0.14, // a diamond's width, share of the shorter side
  links: 4, // links in each thread
  press: 0.28, // how far the cursor presses into the net, share of the shorter side
  finger: 0.13, // the radius of what presses, share of the shorter side
  eye: 0.55, // how far the eye is in front of the net, in widths of the screen's longer side
  taut: 0.96, // the strings' length, share of the length they are stretched across
  calm: 0.98, // share of its speed a knot keeps each frame
  breeze: 0.05, // px per frame per frame the breeze pushes the net by, at most
  passes: 8, // times each frame the strings are pulled back to length
};

let netKnots = 0; // knots; after them, the weights along the threads
let netCount = 0; // knots and weights
let netX = new Float32Array(0); // each, and where it was last frame; z away from the eye
let netY = new Float32Array(0);
let netZ = new Float32Array(0);
let netOX = new Float32Array(0);
let netOY = new Float32Array(0);
let netOZ = new Float32Array(0);
let netTied = new Uint8Array(0); // whether a knot is tied to the edge
let netA = new Int32Array(0); // each link's two ends
let netB = new Int32Array(0);
let netRest = new Float32Array(0); // and its length
let netThreads = new Int32Array(0); // each thread, knot to knot, its weights in order
let netSX = new Float32Array(0); // each on the screen, this frame
let netSY = new Float32Array(0);
let netPerString = 1;
let netTime = 0;

function startNet() {
  const w = canvas.width;
  const h = canvas.height;
  const half = Math.max(8, (net.mesh * Math.min(w, h)) / 2);
  const I = Math.max(2, Math.round(w / half));
  const J = Math.max(2, Math.round(h / half));
  const stepX = w / I;
  const stepY = h / J;
  // Knots where the column and row add up even; strings from each to its
  // neighbours on the diagonals, which makes the meshes diamonds.
  const index = new Int32Array((I + 1) * (J + 1)).fill(-1);
  const xs = [];
  const ys = [];
  const tied = [];
  for (let j = 0; j <= J; j++) {
    for (let i = 0; i <= I; i++) {
      if ((i + j) % 2) continue;
      index[j * (I + 1) + i] = xs.length;
      xs.push(i * stepX);
      ys.push(j * stepY);
      tied.push(i === 0 || i === I || j === 0 || j === J ? 1 : 0);
    }
  }
  const as = [];
  const bs = [];
  for (let j = 0; j <= J; j++) {
    for (let i = 0; i < I; i++) {
      const a = index[j * (I + 1) + i];
      if (a < 0) continue;
      for (const dj of [-1, 1]) {
        if (j + dj < 0 || j + dj > J) continue;
        const b = index[(j + dj) * (I + 1) + i + 1];
        if (b >= 0) {
          as.push(a);
          bs.push(b);
        }
      }
    }
  }
  // Each thread, a few links, with weights between laid along it.
  netKnots = xs.length;
  const links = Math.max(1, Math.round(net.links));
  const threads = [];
  const la = [];
  const lb = [];
  const rest = [];
  for (let s = 0; s < as.length; s++) {
    const a = as[s];
    const b = bs[s];
    const length = (net.taut * Math.hypot(xs[b] - xs[a], ys[b] - ys[a])) / links;
    let from = a;
    threads.push(a);
    for (let q = 1; q <= links; q++) {
      let to = b;
      if (q < links) {
        to = xs.length;
        xs.push(xs[a] + ((xs[b] - xs[a]) * q) / links);
        ys.push(ys[a] + ((ys[b] - ys[a]) * q) / links);
        tied.push(0);
      }
      la.push(from);
      lb.push(to);
      rest.push(length);
      threads.push(to);
      from = to;
    }
  }
  netCount = xs.length;
  netX = new Float32Array(xs);
  netY = new Float32Array(ys);
  netZ = new Float32Array(netCount);
  netOX = new Float32Array(xs);
  netOY = new Float32Array(ys);
  netOZ = new Float32Array(netCount);
  netTied = new Uint8Array(tied);
  netA = new Int32Array(la);
  netB = new Int32Array(lb);
  netRest = new Float32Array(rest);
  netThreads = new Int32Array(threads);
  netSX = new Float32Array(netCount);
  netSY = new Float32Array(netCount);
  netPerString = Math.max(1, Math.floor((whiteElements.length - netKnots * 3) / Math.max(1, as.length)));
  netTime = 0;
}

function netCursor() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  const t = netTime;
  return {
    x: canvas.width * (0.5 + 0.32 * Math.sin(t * 0.0053)),
    y: canvas.height * (0.5 + 0.3 * Math.sin(t * 0.0071 + 1.1)),
  };
}

function stepNet() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  netTime++;
  const time = netTime;
  const eye = net.eye * Math.max(w, h);
  const cx = w / 2;
  const cy = h / 2;
  // The fingertip: a ball whose far side is pressed `depth` into the net,
  // under the cursor.
  const tip = netCursor();
  const ball = net.finger * side;
  const depth = net.press * side;
  const grow = (eye + depth) / eye;
  const bx = cx + (tip.x - cx) * grow;
  const by = cy + (tip.y - cy) * grow;
  const bz = depth - ball;
  // The ball has been pushed through from the front, so the net over it is
  // kept behind it, wrapped round its far side.
  function press(k) {
    const dx = netX[k] - bx;
    const dy = netY[k] - by;
    const d2 = dx * dx + dy * dy;
    if (d2 >= ball * ball) return;
    const behind = bz + Math.sqrt(ball * ball - d2);
    if (netZ[k] < behind) netZ[k] = behind;
  }

  // Each knot carries on, the breeze pushing it, and is kept behind the
  // ball.
  for (let k = 0; k < netCount; k++) {
    if (netTied[k]) continue;
    const x = netX[k];
    const y = netY[k];
    const z = netZ[k];
    const breeze = net.breeze * Math.sin(x * 0.005 + time * 0.011) * Math.sin(y * 0.007 - time * 0.008 + 1.7);
    netX[k] += (x - netOX[k]) * net.calm;
    netY[k] += (y - netOY[k]) * net.calm;
    netZ[k] += (z - netOZ[k]) * net.calm + breeze;
    netOX[k] = x;
    netOY[k] = y;
    netOZ[k] = z;
    press(k);
  }
  // The strings pull stretched ones back to length, the ball keeping its
  // shape; the edge's knots stay tied.
  const strings = netA.length;
  for (let pass = 0; pass < net.passes; pass++) {
    const forward = pass % 2 === 0;
    for (let q = 0; q < strings; q++) {
      const s = forward ? q : strings - 1 - q;
      const a = netA[s];
      const b = netB[s];
      const dx = netX[b] - netX[a];
      const dy = netY[b] - netY[a];
      const dz = netZ[b] - netZ[a];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= netRest[s]) continue;
      const wa = netTied[a] ? 0 : 1;
      const wb = netTied[b] ? 0 : 1;
      if (wa + wb === 0) continue;
      const pull = (d - netRest[s]) / (d * (wa + wb));
      netX[a] += dx * pull * wa;
      netY[a] += dy * pull * wa;
      netZ[a] += dz * pull * wa;
      netX[b] -= dx * pull * wb;
      netY[b] -= dy * pull * wb;
      netZ[b] -= dz * pull * wb;
    }
    for (let k = 0; k < netCount; k++) if (!netTied[k]) press(k);
  }

  // In perspective: further from the eye, nearer the middle.
  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  for (let k = 0; k < netCount; k++) {
    const f = eye / (eye + netZ[k]);
    netSX[k] = cx + (netX[k] - cx) * f;
    netSY[k] = cy + (netY[k] - cy) * f;
    if (k >= netKnots) continue;
    put(netSX[k], netSY[k]);
    put(netSX[k] + 1, netSY[k]);
    put(netSX[k], netSY[k] + 1);
  }
  // Along each thread, its dots shared between its links.
  const links = Math.max(1, Math.round(net.links));
  const perLink = Math.max(1, Math.floor(netPerString / links));
  for (let i = 0; i + links < netThreads.length; i += links + 1) {
    for (let q = 0; q < links; q++) {
      const ax = netSX[netThreads[i + q]];
      const ay = netSY[netThreads[i + q]];
      const dx = netSX[netThreads[i + q + 1]] - ax;
      const dy = netSY[netThreads[i + q + 1]] - ay;
      for (let r = 0; r < perLink; r++) {
        const t = (r + 0.5) / perLink;
        put(ax + dx * t, ay + dy * t);
      }
    }
  }
  while (next < n) put(-100, -100);
}

registerBackground("net", {
  start: startNet,
  step: stepNet,
  settings: net,
  archived: true,
});
