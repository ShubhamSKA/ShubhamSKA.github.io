// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js. A pattern, not a background:
// it adds itself to the curves from here, so the site never sees it.

// ---- Mathieu -------------------------------------------------------------------
// The ring of dots on hidden springs from the springs pattern, but the stiffness
// pulses too: k = c + sin(n theta) cos(beat t) + travel cos(n theta) sin(beat t).
// At travel = 1 that is c + sin(n theta + beat t), a wave of stiffness running
// round the ring; at 0 it stays put and each spring just pulses. Either way every
// dot's k averages c, so the dots have no lasting reason to drift apart: where
// the springs pattern winds up into haze, this keeps coming back as clean flowers.
// Each dot obeys Mathieu's equation, which has no tidy solution, so unlike the
// springs curve this one keeps each target's place and speed and moves them on a
// step at a time, counting on followCurve to ask for every dot once a frame. The
// dots then chase their targets at the usual capped speed. A beat near twice a
// dot's own frequency, 2 sqrt(c), pumps its target like legs pumping a swing:
// the swing grows until it is stopped at MATHIEU_FAR, and only the speed cap
// keeps the dots on screen, leaving torn, jagged lobes.
const mathieuSprings = {
  c: 1.5, // k = c + sin(n theta) cos(beat t) + travel cos(n theta) sin(beat t)
  beat: 1, // how fast k pulses, in the springs' time
  travel: 1, // 1 the stiffness runs round the ring, 0 it stands and pulses
  pace: 2, // how much faster than t the springs run
};

// Where a pumped target is stopped, in rings, so it can't run off to infinity.
const MATHIEU_FAR = 4;
const MATHIEU_STEP = (2 * Math.PI) / whiteElements.length;

const mathieuAt = new Float64Array(whiteElements.length); // how far out each target is, in rings
const mathieuSpeed = new Float64Array(whiteElements.length);

function mathieu(place) {
  const { c, beat, travel, pace } = mathieuSprings;
  const theta = place - t;
  const i = Math.round(theta / MATHIEU_STEP);
  // Every run starts with t at 0 and this is its first frame: back on the ring.
  if (t < 1.5 * increment) {
    mathieuAt[i] = 1;
    mathieuSpeed[i] = 0;
  }
  const clock = beat * pace * t;
  const k =
    c +
    Math.sin(extraPar * theta) * Math.cos(clock) +
    travel * Math.cos(extraPar * theta) * Math.sin(clock);
  const step = pace * increment;
  // Speed first, then place, so the only thing that grows a swing is the pulsing.
  mathieuSpeed[i] -= k * mathieuAt[i] * step;
  mathieuAt[i] += mathieuSpeed[i] * step;
  if (Math.abs(mathieuAt[i]) > MATHIEU_FAR) {
    mathieuAt[i] = Math.sign(mathieuAt[i]) * MATHIEU_FAR;
    mathieuSpeed[i] = 0;
  }
  const x = mathieuAt[i] * Math.cos(theta);
  const y = -mathieuAt[i] * Math.sin(theta); // theta runs anticlockwise
  return { x, y };
}

graphFunctions.push(mathieu);
parameterRanges.push({
  min: 2,
  max: 12,
  step: 1,
  sampleStep: MATHIEU_STEP,
  period: Infinity, // going back to t = 0 would put every dot back on the ring
  label: "Lobes",
  settings: mathieuSprings,
  archived: true,
});
