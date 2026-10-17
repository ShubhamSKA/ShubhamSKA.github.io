// The accretion disc background. Loaded after infinity.js.

// ---- Accretion disc ----------------------------------------------------------
// A black hole sits on the cursor, ringed by a disc of hot gas seen almost
// edge on. The gas goes round on near-circular orbits, faster the closer in
// (Kepler), so the clumps it starts in shear out into streaks, and it drifts
// slowly inwards. Inside the disc's inner edge, the innermost stable orbit,
// it plunges into the hole, and fresh gas takes its place further out. The
// hole bends light. Gas on the far side of the disc, behind the hole, is
// seen lifted up and over the hole's shadow, as a lens would show it: each
// dot is moved out from the hole by the point-lens equation, more the further
// behind the hole it lies. A second, fainter image of the far side wraps
// under the shadow, and a thin photon ring rims it. The side of the disc
// coming towards the viewer is brighter than the side going away (Doppler
// beaming), which here means more of its dots show. Two narrow jets shoot out
// along the disc's axis, widening and twisting as they go.
// Real discs flicker, and this one does too. Between flares only some of the
// gas shines. Magnetic flares heat patches of the disc now and then, most
// often close in, where the gas is hottest. A heated patch lights up, goes
// round with its gas, shears out into an arc and cools. Every so often a big
// flare, a hot spot, lights gas just outside the inner edge; it whips round
// the hole in a couple of seconds, its lensed image arcing over the shadow,
// and brightens the photon ring. It also sends a knot up the jets, as do
// smaller outbursts in between, so the jets run dim with bright knots
// travelling out along them. The hole's spin drags the disc's axis round in
// a slow wobble (Lense-Thirring precession), jets and all. The disc turns in
// the screen with the cursor's place across it: level in the middle, tipped
// down towards whichever side the cursor is nearer. And it is seen as if from
// the middle of the screen: edge on with the cursor halfway down, from above
// when the cursor is lower, from below when it is higher, so the lensed image
// of the far side swings over the top or under the bottom of the shadow.
// Dots: the photon ring and the jets take a fixed number each, the second
// image keeps a share for itself, and the disc has the rest.
const accretion = {
  horizon: 0.022, // the event horizon's radius, share of the shorter side
  inner: 3, // the disc's inner edge, in horizon radii
  outer: 0.36, // its outer edge, share of the shorter side
  innerShare: 0.75, // share of the gas crowded towards the inner edge
  tilt: 0.45, // rad the disc is seen from above or below its plane with the
  //             cursor at the bottom or top edge
  roll: 0.5, // rad it is turned in the screen with the cursor at either edge
  lens: 4, // how strongly light from behind the hole is bent round it
  spin: 0.07, // rad per frame the inner edge goes round; slower further out
  inflow: 0.03, // px per frame the gas drifts inwards at the inner edge
  thickness: 0.008, // the disc's half thickness, share of the radius
  wobble: 0.012, // how far off circular the orbits are, at most
  beaming: 0.4, // how much brighter the side coming towards the viewer is
  ringDots: 220, // the photon ring
  imageDots: 400, // the second image of the far side, under the hole
  jetDots: 300, // the jets; 0 for none
  jetSpeed: 6, // px per frame
  jetSpread: 0.05, // how quickly the jets widen
  jetReach: 0.55, // how far they go, share of the height
  clumps: 80, // the disc starts as this many clumps, which shear into streaks
  quiet: 0.35, // share of the gas that shines between flares
  flares: 0.25, // flares per frame, on average
  flareSize: [0.1, 0.4], // how far a flare reaches, share of its distance from
  //                         the hole, smallest to largest
  cooling: 0.98, // share of its heat gas keeps each frame
  hotSpot: 300, // frames between hot spots, on average
  knots: 120, // frames between the other knots in the jets, on average
  knotLength: 0.03, // how long a knot is, share of the height
  jetQuiet: 0.25, // share of a jet that shines between knots
  precession: 0.06, // rad the disc's axis wobbles by
  precessionPeriod: 1500, // frames for one wobble
};

let accretionTime = 0;
let accretionRoll = 0; // both eased, so they do not jump when the cursor
let accretionTilt = 0; //  comes in
let accretionDisc = 0; // dots in the disc
let accretionR = new Float32Array(0); // gas: radius, angle, how far off
let accretionA = new Float32Array(0); //      circular and which way, height
let accretionE = new Float32Array(0); //      off the plane, plunge speed, and
let accretionW = new Float32Array(0); //      a number to decide whether it
let accretionZ = new Float32Array(0); //      shows on the dim side
let accretionV = new Float32Array(0);
let accretionK = new Float32Array(0);
let accretionH = new Float32Array(0); // gas: how hot from flares, 0 to 1
let accretionJetS = new Float32Array(0); // jets: how far out, across, twist,
let accretionJetL = new Float32Array(0); //       and a number to decide whether
let accretionJetP = new Float32Array(0); //       it shows between knots
let accretionJetK = new Float32Array(0);
let accretionKnots = []; // the frames knots were launched up the jets
let accretionInnerHeat = 0; // how hot the gas near the inner edge is, on average

function accretionCentre() {
  return cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: canvas.width / 2, y: canvas.height / 2 };
}

// Clockwise with the cursor to the right of the middle, anticlockwise to the left.
function accretionWantedRoll() {
  if (!cursorOnPage) return 0;
  const across = Math.max(-1, Math.min(1, (2 * cursorPosition.x) / canvas.width - 1));
  return -accretion.roll * across;
}

// From above with the cursor below the middle, from below above it; a little
// from above with no cursor.
function accretionWantedTilt() {
  if (!cursorOnPage) return accretion.tilt * 0.3;
  const down = Math.max(-1, Math.min(1, (2 * cursorPosition.y) / canvas.height - 1));
  return accretion.tilt * down;
}

function accretionGauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random() * 0.9999)) * Math.cos(Math.random() * Math.PI * 2);
}

function accretionSizes() {
  const side = Math.min(canvas.width, canvas.height);
  const horizon = accretion.horizon * side;
  const inner = accretion.inner * horizon;
  return { horizon, inner, outer: Math.max(inner + 10, accretion.outer * side), shadow: 2.6 * horizon };
}

// A radius in the disc. A real disc shines mostly from close in, so most of
// the gas is put there, thinning out as the cube of the distance; the rest
// thins out as its square, so the outer disc still shows.
function accretionRadius(sizes) {
  if (Math.random() < accretion.innerShare) {
    return 1 / (1 / sizes.inner - Math.random() * (1 / sizes.inner - 1 / sizes.outer));
  }
  return sizes.inner * Math.pow(sizes.outer / sizes.inner, Math.random());
}

// Fresh gas somewhere in the disc.
function accretionFeed(i, sizes) {
  accretionR[i] = accretionRadius(sizes);
  accretionA[i] = Math.random() * Math.PI * 2;
  accretionV[i] = 0;
  accretionH[i] = 0;
}

// Heats the gas within `size` of a point `r0` from the hole, at a random
// angle round it.
function accretionFlare(r0, size, heat) {
  const a0 = Math.random() * Math.PI * 2;
  const x0 = r0 * Math.cos(a0);
  const y0 = r0 * Math.sin(a0);
  const size2 = size * size;
  for (let i = 0; i < accretionDisc; i++) {
    const r = accretionR[i];
    if (Math.abs(r - r0) > size) continue;
    const dx = r * Math.cos(accretionA[i]) - x0;
    const dy = r * Math.sin(accretionA[i]) - y0;
    const d2 = dx * dx + dy * dy;
    if (d2 < size2) accretionH[i] = Math.max(accretionH[i], heat * (1 - d2 / size2));
  }
}

function startAccretion() {
  const n = whiteElements.length;
  const h = canvas.height;
  const sizes = accretionSizes();
  accretionTime = 0;
  accretionRoll = accretionWantedRoll();
  accretionTilt = accretionWantedTilt();
  const ring = Math.max(0, Math.round(accretion.ringDots));
  const jets = Math.max(0, Math.round(accretion.jetDots));
  const images = Math.max(0, Math.round(accretion.imageDots));
  accretionDisc = Math.max(0, n - ring - jets - images);
  const d = accretionDisc;
  accretionR = new Float32Array(d);
  accretionA = new Float32Array(d);
  accretionE = new Float32Array(d);
  accretionW = new Float32Array(d);
  accretionZ = new Float32Array(d);
  accretionV = new Float32Array(d);
  accretionK = new Float32Array(d);
  accretionH = new Float32Array(d);
  accretionKnots = [];
  accretionInnerHeat = 0;
  const clumps = [];
  for (let c = 0; c < Math.max(1, Math.round(accretion.clumps)); c++) {
    clumps.push({
      r: accretionRadius(sizes),
      a: Math.random() * Math.PI * 2,
    });
  }
  for (let i = 0; i < d; i++) {
    if (Math.random() < 0.3) {
      accretionFeed(i, sizes);
    } else {
      const clump = clumps[Math.floor(Math.random() * clumps.length)];
      accretionR[i] = Math.max(sizes.inner, clump.r * (1 + accretionGauss() * 0.04));
      accretionA[i] = clump.a + accretionGauss() * 0.12;
    }
    accretionE[i] = Math.random() * accretion.wobble;
    accretionW[i] = Math.random() * Math.PI * 2;
    accretionZ[i] = accretionGauss() * accretion.thickness;
    accretionK[i] = Math.random();
  }
  accretionJetS = new Float32Array(jets);
  accretionJetL = new Float32Array(jets);
  accretionJetP = new Float32Array(jets);
  accretionJetK = new Float32Array(jets);
  for (let j = 0; j < jets; j++) {
    accretionJetS[j] = sizes.horizon + Math.random() * accretion.jetReach * h;
    accretionJetL[j] = Math.random() * 2 - 1;
    accretionJetP[j] = Math.random() * Math.PI * 2;
    accretionJetK[j] = Math.random();
  }
}

function stepAccretion() {
  const n = whiteElements.length;
  const h = canvas.height;
  const sizes = accretionSizes();
  const c = accretionCentre();
  accretionTime++;
  const t = accretionTime;
  accretionTilt += (accretionWantedTilt() - accretionTilt) * 0.1;
  accretionRoll += (accretionWantedRoll() - accretionRoll) * 0.1;
  // The precession wobbles the axis round on top of where the cursor puts it.
  const wobble = (Math.PI * 2 * t) / Math.max(1, accretion.precessionPeriod);
  const tilt = accretionTilt + accretion.precession * Math.sin(wobble);
  const roll = accretionRoll + accretion.precession * Math.cos(wobble);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  // Flares: mostly small and close in. Now and then a hot spot at the inner
  // edge, which also sends a knot up the jets.
  const sizeSpan = accretion.flareSize[1] - accretion.flareSize[0];
  for (let chance = accretion.flares; Math.random() < chance; chance -= 1) {
    const r0 = accretionRadius(sizes);
    const size = r0 * (accretion.flareSize[0] + sizeSpan * Math.pow(Math.random(), 3));
    accretionFlare(r0, size, 0.5 + 0.5 * Math.random());
  }
  if (Math.random() < 1 / Math.max(1, accretion.hotSpot)) {
    const r0 = sizes.inner * (1.05 + 0.4 * Math.random());
    accretionFlare(r0, r0 * 0.35, 1);
    accretionKnots.push(t);
  }
  if (Math.random() < 1 / Math.max(1, accretion.knots)) accretionKnots.push(t);
  let next = 0;
  // From the disc's view (x across, up the screen) to the page.
  function place(e, x, up) {
    e.x = c.x + x * cr - up * sr;
    e.y = c.y - (x * sr + up * cr);
  }
  function put(x, up) {
    if (next < n) place(whiteElements[next++], x, up);
  }
  function park() {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = -100;
    e.y = -100;
  }

  // The photon ring, shimmering, and brighter while the gas close in is hot.
  const ring = Math.min(n, Math.max(0, Math.round(accretion.ringDots)));
  const ringShows = 0.55 + 0.45 * Math.min(1, accretionInnerHeat * 4);
  for (let k = 0; k < ring; k++) {
    if ((k * 0.618034) % 1 > ringShows) {
      park();
      continue;
    }
    const a = (k / ring) * Math.PI * 2 + t * 0.01;
    const r = sizes.shadow * (1 + Math.random() * 0.05);
    put(Math.cos(a) * r, Math.sin(a) * r);
  }

  // The jets, out along the disc's axis both ways, widening and twisting,
  // dim but for the knots running out along them.
  const reach = accretion.jetReach * h;
  const knotLength = Math.max(1, accretion.knotLength * h);
  accretionKnots = accretionKnots.filter(function (born) {
    return (t - born) * accretion.jetSpeed < reach + 3 * knotLength;
  });
  for (let j = 0; j < accretionJetS.length; j++) {
    accretionJetS[j] += accretion.jetSpeed;
    if (accretionJetS[j] > reach) accretionJetS[j] = sizes.horizon;
    const s = accretionJetS[j];
    let knot = 0;
    for (const born of accretionKnots) {
      const off = (s - sizes.horizon - (t - born) * accretion.jetSpeed) / knotLength;
      knot += Math.exp(-off * off);
    }
    if (accretionJetK[j] > accretion.jetQuiet + (1 - accretion.jetQuiet) * Math.min(1, knot)) {
      park();
      continue;
    }
    const way = j % 2 ? -1 : 1;
    const across =
      (accretion.jetSpread * s + 1.5) * accretionJetL[j] + 3 * Math.sin(s * 0.04 - t * 0.2 + accretionJetP[j]);
    put(across, way * s * ct);
  }

  // The gas: round, inwards, and in through the inner edge.
  const images = Math.min(n - next, Math.max(0, Math.round(accretion.imageDots)));
  const imageStart = next;
  next += images;
  let imagesUsed = 0;
  const lensing = accretion.lens * sizes.horizon;
  let innerHeat = 0;
  let innerCount = 0;
  for (let i = 0; i < accretionDisc; i++) {
    let r = accretionR[i];
    accretionA[i] += accretion.spin * Math.pow(sizes.inner / Math.max(r, sizes.horizon), 1.5);
    if (r > sizes.inner) {
      r -= (accretion.inflow * sizes.inner) / r;
    } else {
      accretionV[i] += 0.03;
      r -= accretionV[i];
    }
    if (r < sizes.horizon * 1.05) {
      accretionFeed(i, sizes);
      r = accretionR[i];
    }
    accretionR[i] = r;
    accretionW[i] += 0.0005;
    accretionH[i] *= accretion.cooling;
    if (r < sizes.inner * 1.6) {
      innerHeat += accretionH[i];
      innerCount++;
    }

    const a = accretionA[i];
    const rr = r * (1 + accretionE[i] * Math.cos(a - accretionW[i]));
    const x = rr * Math.cos(a);
    const along = rr * Math.sin(a); // into the screen across the disc's plane
    const lift = accretionZ[i] * rr;
    const up = along * st + lift * ct;
    const behind = along * ct - lift * st;

    // Hot gas shines; between flares only some of it does. And coming towards
    // the viewer on the left, going away on the right: gas going away shows
    // fewer of its dots, the fewer the faster it goes.
    const towards = -Math.cos(a) * ct * Math.sqrt(sizes.inner / Math.max(r, sizes.inner));
    const shine = accretion.quiet + (1 - accretion.quiet) * accretionH[i];
    if (accretionK[i] > shine * Math.pow(1 + accretion.beaming * towards, 3)) {
      park();
      continue;
    }

    if (behind <= 0) {
      put(x, up);
      continue;
    }
    // Behind the hole: the point lens moves the image out to b, and makes a
    // second, flipped image inside, which shows only outside the shadow.
    const offset = Math.hypot(x, up) || 1e-3;
    const einstein2 = lensing * behind;
    const root = Math.sqrt(offset * offset + 4 * einstein2);
    const outward = (offset + root) / 2 / offset;
    put(x * outward, up * outward);
    if (imagesUsed < images) {
      const inward = (offset - root) / 2 / offset;
      if (Math.abs(inward) * offset > sizes.shadow) {
        place(whiteElements[imageStart + imagesUsed++], x * inward, up * inward);
      }
    }
  }
  accretionInnerHeat = innerCount ? innerHeat / innerCount : 0;
  for (let k = imageStart + imagesUsed; k < imageStart + images; k++) {
    whiteElements[k].x = -100;
    whiteElements[k].y = -100;
  }
  while (next < n) park();
}

registerBackground("accretion", {
  start: startAccretion,
  step: stepAccretion,
  settings: accretion,
});
