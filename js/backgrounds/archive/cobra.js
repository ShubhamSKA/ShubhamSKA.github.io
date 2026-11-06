// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js.

// ---- Cobras ------------------------------------------------------------------
// A cobra, seen from above, that follows the cursor about; or more than one,
// if `count` is raised. Cobras move the way real snakes mostly do, by lateral
// undulation: the head swings from side to side as it goes, and the body
// follows exactly the path the head took, so the S-bends stay where the head
// made them and the snake slides along them.
// A cobra can only turn as it moves, and never tighter than its body is wide,
// so the body never folds over itself; with the hood spread, that is wider
// still. More than one keep out of each other's way: each has its own place
// by the cursor, spaced evenly round it, kept turned to suit where they are;
// and each steers its head clear of the others' bodies, slowing to give way
// when it comes close.
// A cobra heads for its place, slowing as it nears it, and stops there, just
// short of the cursor. There it rears and spreads its hood, the long ribs of
// its neck splayed into a broad flat shield that swells smoothly out from the
// back of the head, with the spectacle mark on its back, two pale rings round
// dark centres. Its head and hood sway from side to side, watching the
// cursor, and the rest of its body keeps swaying too, waves running down it,
// growing towards the tail. Move the cursor away and the hood folds and it
// comes after it.
// The body is long and slender, tapering to a fine tail, and covered in
// overlapping scales in staggered rows, each drawn by its free edge, the arc
// that points towards the tail; scales near the sides are foreshortened as
// the body curves away, and spread wider over the hood. Pale bands cross the
// body at intervals, picked out with extra dots, and a dot line marks each
// flank. The head is short and rounded, with large plates on top,
// round-pupilled eyes and nostrils.
// Dots: shared between the cobras; for each, the head, the flanks and the
// spectacles, then the scales, as many to a scale as its share allows with the
// hood spread; the rest are parked out of sight.
const cobra = {
  count: 1, // cobras
  length: 0.9, // each, share of the shorter side
  thickness: 0.012, // half the body's width at its thickest, share of the shorter side
  head: 2.3, // the head's length, in half-widths of the body
  speed: 3, // px per frame at most
  turn: 0.07, // rad per frame the head can turn, at most
  bend: 1.15, // the tightest it can turn, as a radius, in widest half-widths of its body
  slither: 0.5, // rad the head swings either side as it slithers
  wave: 0.35, // the slither's wavelength, share of the snake's length
  gap: 25, // px from the cursor to each cobra's place
  rear: 20, // px from its place where a cobra stops, rears and spreads its hood
  clearance: 2, // half-widths a head keeps clear of the other's body, beyond both their widths
  dodge: 5, // how hard a head turns away from the other's body
  hood: 1.9, // how far the spread hood reaches past the neck either side, in half-widths
  hoodLength: 6, // the hood's length, in half-widths
  spread: 0.04, // share of the way the hood opens or folds each frame
  sway: 0.7, // half-widths the reared head sways by, either side
  swish: 2.5, // half-widths the reared body sways by at the tail tip, either side
  swishRate: 0.08, // rad per frame of the body's sway
  swishWaves: 1.5, // waves along the swaying body at once
  scaleLength: 0.5, // between rows of scales, in half-widths of the body
  scaleWidth: 0.42, // across a scale, in half-widths of the body
  bands: 9, // between the pale bands across the body, in half-widths
};

let cobras = []; // see cobraMake
let cobraTime = 0;
let cobraBase = 0; // the angle round the cursor of the first cobra's place

function cobraSizes() {
  const side = Math.min(canvas.width, canvas.height);
  const thick = cobra.thickness * side;
  return {
    length: Math.max(60, cobra.length * side),
    thick,
    head: cobra.head * thick,
    hoodLength: cobra.hoodLength * thick,
    scaleLength: Math.max(2, cobra.scaleLength * thick),
    scaleWidth: Math.max(2, cobra.scaleWidth * thick),
    bands: Math.max(4, cobra.bands * thick),
  };
}

function cobraRamp(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Half the body's width `s` of the way from the neck to the tail tip, as a
// share of the thickest: long and even, tapering from about two thirds down.
function cobraGirth(s) {
  if (s < 0.65) return 0.7 + 0.3 * cobraRamp(0, 0.2, s);
  return Math.max(0, 1 - Math.pow(cobraRamp(0.65, 1, s), 0.85));
}

// How far the hood, spread by `hood`, 0 to 1, reaches past the body's own
// width `a` px from the snout. It starts where the head is widest, by the
// eyes, and swells out from there faster than the head narrows, so head and
// hood make one curve; it is widest in its front third, then narrows back
// into the neck.
function cobraHoodWidth(a, sizes, hood) {
  if (hood <= 0) return 0;
  const start = sizes.head * 0.6;
  const x = (a - start) / (sizes.hoodLength + sizes.head * 0.4);
  if (x <= 0 || x >= 1) return 0;
  return hood * sizes.thick * cobra.hood * Math.pow(Math.sin(Math.PI * Math.pow(x, 0.7)), 1.5);
}

// Half the body's width, in px, `a` px from the snout, with the hood spread by
// `hood`, 0 to 1.
function cobraWidth(a, sizes, hood) {
  const body = sizes.length - sizes.head;
  return sizes.thick * cobraGirth((a - sizes.head) / body) + cobraHoodWidth(a, sizes, hood);
}

// Half the head's width `u` of the way from the snout to the neck, as a share
// of the body's thickest: short and rounded.
function cobraHeadWidth(u) {
  const widest = 0.9;
  if (u < 0.6) {
    const k = (0.6 - u) / 0.6;
    return widest * Math.sqrt(Math.max(0, 1 - k * k));
  }
  const k = (u - 0.6) / 0.4;
  return widest * (1 - 0.2 * k * k);
}

function cobraCursor() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  const t = cobraTime;
  return {
    x: canvas.width * (0.5 + 0.35 * Math.sin(t * 0.0047)),
    y: canvas.height * (0.5 + 0.32 * Math.sin(t * 0.0061 + 1.3)),
  };
}

// A cobra lying straight back from (x, y), heading `angle`.
function cobraMake(x, y, angle, sizes) {
  const c = {
    pathX: [], // where the head has been, oldest first
    pathY: [],
    head: { x, y, angle, speed: 0, phase: Math.random() * 6.3, hood: 0 },
    beat: Math.random() * 6.3, // its own sway, out of step with the other's
    // The spine, sampled every px from the snout back: position, and the unit
    // vector pointing forwards.
    sx: new Float32Array(Math.ceil(sizes.length) + 2),
    sy: new Float32Array(Math.ceil(sizes.length) + 2),
    tx: new Float32Array(Math.ceil(sizes.length) + 2),
    ty: new Float32Array(Math.ceil(sizes.length) + 2),
  };
  for (let d = sizes.length + 20; d >= 0; d -= 2) {
    c.pathX.push(x - Math.cos(angle) * d);
    c.pathY.push(y - Math.sin(angle) * d);
  }
  return c;
}

let cobraPerScale = 5;

function startCobra() {
  const sizes = cobraSizes();
  cobraTime = 0;
  const count = Math.max(1, Math.round(cobra.count));
  const centre = cobraCursor();
  cobras = [];
  cobraBase = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    // Each starts out on its own side, well away.
    const a = cobraBase + (i * Math.PI * 2) / count;
    const r = sizes.length * 0.45;
    cobras.push(cobraMake(centre.x + Math.cos(a) * r, centre.y + Math.sin(a) * r, a + Math.PI / 2, sizes));
  }
  // Spines from the start, for each to keep clear of the other's.
  for (const c of cobras) cobraSpine(c, Math.min(sizes.length, c.sx.length - 2));
  // As many dots to a scale as each cobra's share goes round, hood spread.
  let scales = 0;
  for (let a = sizes.head + sizes.scaleLength / 2; a < sizes.length - 2; a += sizes.scaleLength) {
    scales += Math.max(1, Math.round((2 * cobraWidth(a, sizes, 1) * 0.95) / sizes.scaleWidth));
  }
  const share = whiteElements.length / count;
  const spare = share - (2 * sizes.length) / 3 - 360;
  cobraPerScale = Math.max(3, Math.min(8, Math.floor(spare / (scales * 1.15))));
}

// Samples a cobra's path every px from the snout back, into its spine.
function cobraSpine(c, length) {
  const px = c.pathX;
  const py = c.pathY;
  let k = px.length - 1;
  let done = 0; // length of path walked up to point k
  const count = Math.min(c.sx.length, Math.ceil(length) + 2);
  c.sx[0] = px[k];
  c.sy[0] = py[k];
  for (let d = 1; d < count; d++) {
    while (k > 0) {
      const seg = Math.hypot(px[k] - px[k - 1], py[k] - py[k - 1]);
      if (done + seg >= d) break;
      done += seg;
      k--;
    }
    if (k > 0) {
      const seg = Math.hypot(px[k] - px[k - 1], py[k] - py[k - 1]) || 1;
      const t = (d - done) / seg;
      c.sx[d] = px[k] + (px[k - 1] - px[k]) * t;
      c.sy[d] = py[k] + (py[k - 1] - py[k]) * t;
    } else {
      // Past the oldest point: on in a straight line.
      c.sx[d] = 2 * c.sx[d - 1] - c.sx[d - 2 >= 0 ? d - 2 : 0];
      c.sy[d] = 2 * c.sy[d - 1] - c.sy[d - 2 >= 0 ? d - 2 : 0];
    }
  }
  for (let d = 0; d < count; d++) {
    const a = Math.max(0, d - 2);
    const b = Math.min(count - 1, d + 2);
    const tx = c.sx[a] - c.sx[b];
    const ty = c.sy[a] - c.sy[b];
    const t = Math.hypot(tx, ty) || 1;
    c.tx[d] = tx / t;
    c.ty[d] = ty / t;
  }
  // Drop what the tail has left behind.
  if (k > 2) {
    c.pathX.splice(0, k - 2);
    c.pathY.splice(0, k - 2);
  }
}

// Moves a cobra's head: towards its place by the cursor, swinging side to
// side, clear of the other cobras' bodies; stopping there to rear.
function cobraSteer(c, place, sizes, L) {
  const head = c.head;
  const dx = place.x - head.x;
  const dy = place.y - head.y;
  const dist = Math.hypot(dx, dy) || 1;
  const arrived = dist < cobra.rear;
  // Pushed off any other cobra's body that the head comes too near, and
  // slowed the closer it comes, to give way.
  let pushX = 0;
  let pushY = 0;
  let room = 1;
  const own = sizes.thick * (0.9 + cobra.clearance);
  for (const other of cobras) {
    if (other === c) continue;
    for (let d = 0; d < L; d += 5) {
      const ox = head.x - other.sx[d];
      const oy = head.y - other.sy[d];
      const reach = own + cobraWidth(Math.max(d, sizes.head), sizes, other.head.hood);
      const o2 = ox * ox + oy * oy;
      if (o2 >= reach * reach) continue;
      const o = Math.sqrt(o2) || 1;
      pushX += (ox / o) * (1 - o / reach);
      pushY += (oy / o) * (1 - o / reach);
      room = Math.min(room, o / reach);
    }
  }
  const swing = cobra.slither * Math.max(0, Math.min(1, (dist - cobra.rear) / (cobra.rear * 3)));
  const want = Math.atan2(dy / dist + pushY * cobra.dodge, dx / dist + pushX * cobra.dodge) + swing * Math.sin(head.phase);
  let turn = want - head.angle;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  // No turning on the spot, and no bend tighter than the body is wide, hood
  // and all, or the inside of the bend would fold over itself.
  const widest = sizes.thick * Math.max(1, cobraGirth(0) + head.hood * cobra.hood);
  const most = Math.min(cobra.turn, head.speed / Math.max(1, cobra.bend * widest));
  head.angle += Math.max(-most, Math.min(most, turn));
  const pace = arrived
    ? 0
    : cobra.speed * Math.max(0.35, Math.min(1, (dist - cobra.rear) / 150)) * Math.max(0.15, room);
  head.speed += (pace - head.speed) * 0.06;
  // The hood spreads once it has stopped, and folds twice as fast once it
  // moves off.
  const spreading = arrived && head.speed < 0.6;
  head.hood += ((spreading ? 1 : 0) - head.hood) * cobra.spread * (spreading ? 1 : 2);
  head.phase += (Math.PI * 2 * head.speed) / Math.max(1, cobra.wave * L);
  head.x += Math.cos(head.angle) * head.speed;
  head.y += Math.sin(head.angle) * head.speed;
  const last = c.pathX.length - 1;
  if (Math.hypot(head.x - c.pathX[last], head.y - c.pathY[last]) >= 1) {
    c.pathX.push(head.x);
    c.pathY.push(head.y);
  }
}

function stepCobra() {
  const n = whiteElements.length;
  const sizes = cobraSizes();
  cobraTime++;
  if (!cobras.length) return;
  const L = Math.min(sizes.length, cobras[0].sx.length - 2);
  const count = cobras.length;

  // The places round the cursor, evenly spaced and turned to suit where the
  // cobras already are, so none has further to go round than it must.
  const centre = cobraCursor();
  let mx = 0;
  let my = 0;
  for (let i = 0; i < count; i++) {
    const h = cobras[i].head;
    const a = Math.atan2(h.y - centre.y, h.x - centre.x) - (i * Math.PI * 2) / count;
    mx += Math.cos(a);
    my += Math.sin(a);
  }
  let shift = Math.atan2(my, mx) - cobraBase;
  shift = Math.atan2(Math.sin(shift), Math.cos(shift));
  cobraBase += shift * 0.02;
  for (let i = 0; i < count; i++) {
    const a = cobraBase + (i * Math.PI * 2) / count;
    cobraSteer(cobras[i], { x: centre.x + Math.cos(a) * cobra.gap, y: centre.y + Math.sin(a) * cobra.gap }, sizes, L);
  }
  for (const c of cobras) cobraSpine(c, L);

  let next = 0;
  const share = Math.floor(n / count);
  for (let i = 0; i < count; i++) next = cobraDraw(cobras[i], sizes, L, next, i === count - 1 ? n : next + share);
  while (next < n) {
    whiteElements[next].x = -100;
    whiteElements[next].y = -100;
    next++;
  }
}

// Lays out one cobra's dots, from dot `next` up to `limit`; gives back where
// it got to.
function cobraDraw(c, sizes, L, next, limit) {
  function put(x, y) {
    if (next >= limit) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  const thick = sizes.thick;
  const headLength = sizes.head;
  const hood = c.head.hood;
  // Reared, the head and hood sway from side to side, and the rest of the
  // body sways too, waves running down it, growing towards the tail.
  const hoodEnd = headLength + sizes.hoodLength;
  const swayReach = hoodEnd * 1.1;
  const sway = hood * thick * cobra.sway * Math.sin(cobraTime * 0.045 + c.beat);
  const swishPhase = cobraTime * cobra.swishRate + c.beat;
  const swish = hood * thick * cobra.swish;
  const waves = Math.PI * 2 * cobra.swishWaves;
  // A point `along` px forwards and `across` px to the left of the spine at
  // `a` px from the snout.
  function at(a, along, across) {
    const d = Math.max(0, Math.min(L, Math.round(a)));
    const tx = c.tx[d];
    const ty = c.ty[d];
    let swing = a < swayReach ? sway * (1 - a / swayReach) : 0;
    if (swish > 0 && a > hoodEnd) {
      const t = (a - hoodEnd) / (L - hoodEnd);
      swing += swish * (0.25 + 0.75 * t) * cobraRamp(0, 0.12, t) * Math.sin(swishPhase - t * waves);
    }
    put(c.sx[d] + tx * along - ty * (across + swing), c.sy[d] + ty * along + tx * (across + swing));
  }

  // The head: outline, plates, eyes and nostrils. Its back merges into the
  // hood where that reaches wider.
  for (let a = 0; a <= headLength; a += 1.5) {
    const flare = cobraHoodWidth(a, sizes, hood);
    const hw = Math.max(thick * cobraHeadWidth(a / headLength), flare > 0 ? thick * cobraGirth(0) + flare : 0);
    at(a, 0, hw);
    at(a, 0, -hw);
  }
  const plates = [
    [0.22, [0]],
    [0.42, [-0.4, 0.4]],
    [0.62, [-0.42, 0, 0.42]],
    [0.84, [-0.38, 0.38]],
  ];
  for (const [u, columns] of plates) {
    const a = u * headLength;
    const hw = thick * cobraHeadWidth(u);
    for (const v of columns) {
      for (let k = 0; k < 5; k++) {
        const t = (k / 4) * 2 - 1;
        at(a + (1 - t * t) * headLength * 0.08, -headLength * 0.04, v * hw + t * hw * 0.22);
      }
    }
  }
  for (const side of [-1, 1]) {
    const a = 0.42 * headLength;
    const hw = thick * cobraHeadWidth(0.42);
    for (let k = 0; k < 8; k++) {
      const angle = (k / 8) * Math.PI * 2;
      at(a + Math.cos(angle) * 2.3, 0, side * hw * 0.72 + Math.sin(angle) * 2.3);
    }
    // A round pupil.
    at(a, 0, side * hw * 0.72);
    at(0.1 * headLength, 0, side * thick * cobraHeadWidth(0.1) * 0.45);
  }

  // The flanks, the hood's edge among them.
  for (let a = headLength; a < L; a += 3) {
    const r = cobraWidth(a, sizes, hood);
    at(a, 0, r);
    at(a, 0, -r);
  }

  // The spectacles on the back of the spread hood: two pale rings, doubled to
  // stand out, joined by a loop; their centres are kept dark below.
  const specA = headLength + 0.42 * sizes.hoodLength;
  const specWide = cobraWidth(specA, sizes, hood);
  const specRing = specWide * 0.22;
  const spectacles = hood > 0.2;
  if (spectacles) {
    for (const side of [-1, 1]) {
      for (const ring of [specRing, specRing + 1.6]) {
        for (let k = 0; k < 18; k++) {
          const angle = (k / 18) * Math.PI * 2;
          at(specA + Math.cos(angle) * ring, 0, side * specWide * 0.4 + Math.sin(angle) * ring);
        }
      }
    }
    for (let k = 0; k <= 12; k++) {
      const t = (k / 12) * 2 - 1;
      at(specA + specRing + (1 - t * t) * specRing * 0.9, 0, t * specWide * 0.4);
    }
  }

  // The scales, row on row, staggered, each its free edge; pale bands across.
  const K = cobraPerScale;
  const scaleLength = sizes.scaleLength;
  const scaleWidth = sizes.scaleWidth;
  let row = 0;
  for (let a = headLength + scaleLength / 2; a < L - 2; a += scaleLength, row++) {
    const r = cobraWidth(a, sizes, hood);
    const count = Math.max(1, Math.round((2 * r * 0.95) / scaleWidth));
    const offset = row % 2 ? 0.5 : 0;
    const band = ((a - headLength) / sizes.bands) % 1 < 0.16;
    for (let j = 0; j < count + (offset ? 1 : 0); j++) {
      const v = ((j + 0.5 - offset) / count) * 2 - 1;
      if (Math.abs(v) > 1) continue;
      // Round the curve of the back: scales by the flanks are seen edge on.
      const phi = v * (Math.PI / 2) * 0.92;
      const across = r * Math.sin(phi);
      const narrow = Math.cos(phi);
      // Inside a spectacle ring: left dark.
      if (spectacles && Math.hypot(a - specA, Math.abs(across) - specWide * 0.4) < specRing * 0.9) continue;
      for (let k = 0; k < K; k++) {
        const t = (k / (K - 1)) * 2 - 1;
        at(a, scaleLength * (0.25 - 0.55 * (1 - t * t)), across + t * scaleWidth * 0.5 * narrow);
      }
      if (band) {
        at(a, 0, across);
        at(a, scaleLength * 0.2, across);
      }
    }
  }
  return next;
}

registerBackground("cobra", {
  start: startCobra,
  step: stepCobra,
  settings: cobra,
  archived: true,
});
