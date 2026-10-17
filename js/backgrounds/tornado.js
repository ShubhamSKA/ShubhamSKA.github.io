// The tornado background. Loaded after infinity.js.

// ---- Tornado -----------------------------------------------------------------
// A tornado seen from the side, hanging from a wall cloud near the top of the
// screen down to the ground near the bottom, that chases the cursor. Its
// centre line is a chain of levels, each with a mass that a spring draws
// towards the cursor's x, hardest near the cursor's height; each level is
// also held in line with its neighbours, and the ground drags on the lowest,
// so the funnel leans and bends as it moves, overshoots when it stops, and
// waves run up and down it like a rope. It snakes a little on its own too.
// The funnel is narrow at the ground and flares out into the cloud. Its dots
// spin round the centre line, faster where it is narrow, and climb on the
// updraft, slower where it is wide, as the air in a widening pipe would; at
// the top they start again from the ground. The rings are seen a little from
// above. The wall cloud turns slowly over the funnel's top, lowest in the
// middle. Debris is thrown up and out from the funnel's foot and falls back.
// Dots: the cloud and the debris take a fixed number each; the funnel the rest.
const tornado = {
  levels: 48, // along the centre line
  top: 0.2, // where the funnel hangs from the cloud, share of the height
  ground: 0.94, // share of the height
  neck: 7, // px: the funnel's radius at the ground
  mouth: 0.07, // its radius at the cloud, share of the width
  flare: 2.6, // how late it widens; higher keeps it narrow for longer
  chase: 0.0025, // how hard the funnel is drawn towards the cursor
  calm: 0.965, // share of its speed it keeps each frame
  groundDrag: 0.08, // extra speed lost near the ground, which drags behind
  tension: 0.25, // how much each level keeps in line with its neighbours
  reach: 0.3, // share of the height round the cursor's that is drawn hardest
  sway: 14, // px it snakes by on its own
  spin: 0.16, // rad per frame round the neck; slower further out
  climb: 0.004, // share of the funnel's height a dot climbs per frame, at the neck
  ripple: 0.15, // how much the funnel's width ripples
  tilt: 0.22, // how far from above the rings are seen
  cloudDots: 1300,
  cloudWidth: 0.42, // share of the width, either side of the funnel
  cloudSpin: 0.012, // rad per frame at the funnel's mouth
  debrisDots: 700,
  debrisReach: 7, // how far debris is flung, in neck radii
  debrisLift: [1, 3.5], // px per frame it is thrown up at
  gravity: 0.06, // px per frame per frame, for the debris
};

let tornadoTime = 0;
let tornadoX = new Float32Array(0); // the centre line, ground first
let tornadoV = new Float32Array(0);
let tornadoFunnel = 0; // dots in each part
let tornadoCloud = 0;
let tornadoDebris = 0;
let tornadoQ = new Float32Array(0); // funnel: height, share of the way up
let tornadoA = new Float32Array(0); // and every part: angle round the centre
let tornadoR = new Float32Array(0); // funnel: share of the radius; cloud and
//                                     debris: px from the centre
let tornadoZ = new Float32Array(0); // cloud: layer; debris: px above ground
let tornadoVR = new Float32Array(0); // debris: outward and upward speed
let tornadoVZ = new Float32Array(0);

function tornadoTarget() {
  const w = canvas.width;
  const h = canvas.height;
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  return { x: w * (0.5 + 0.28 * Math.sin(tornadoTime * 0.003)), y: h * 0.6 };
}

function tornadoThrow(i) {
  tornadoA[i] = Math.random() * Math.PI * 2;
  tornadoR[i] = tornado.neck * (1 + Math.random());
  tornadoZ[i] = 0;
  tornadoVR[i] = 0.1 + Math.random() * 0.5;
  tornadoVZ[i] = tornado.debrisLift[0] + Math.random() * (tornado.debrisLift[1] - tornado.debrisLift[0]);
}

function startTornado() {
  const n = whiteElements.length;
  const w = canvas.width;
  tornadoTime = 0;
  const levels = Math.max(2, Math.round(tornado.levels));
  const target = tornadoTarget();
  tornadoX = new Float32Array(levels).fill(target.x);
  tornadoV = new Float32Array(levels);
  tornadoCloud = Math.min(n, Math.max(0, Math.round(tornado.cloudDots)));
  tornadoDebris = Math.min(n - tornadoCloud, Math.max(0, Math.round(tornado.debrisDots)));
  tornadoFunnel = n - tornadoCloud - tornadoDebris;
  tornadoQ = new Float32Array(n);
  tornadoA = new Float32Array(n);
  tornadoR = new Float32Array(n);
  tornadoZ = new Float32Array(n);
  tornadoVR = new Float32Array(n);
  tornadoVZ = new Float32Array(n);
  for (let i = 0; i < tornadoFunnel; i++) {
    tornadoQ[i] = Math.random();
    tornadoA[i] = Math.random() * Math.PI * 2;
    // Most on the funnel's wall, some inside it.
    tornadoR[i] = 1 - 0.25 * Math.random() ** 2;
  }
  const mouth = tornado.mouth * w;
  const wide = Math.max(mouth + 1, tornado.cloudWidth * w);
  for (let i = tornadoFunnel; i < tornadoFunnel + tornadoCloud; i++) {
    tornadoA[i] = Math.random() * Math.PI * 2;
    tornadoR[i] = mouth * 0.5 + (wide - mouth * 0.5) * Math.sqrt(Math.random());
    tornadoZ[i] = Math.random();
  }
  for (let i = tornadoFunnel + tornadoCloud; i < n; i++) {
    tornadoThrow(i);
    // Spread through a throw already, so they do not all go up together.
    const t = Math.random() * ((2 * tornadoVZ[i]) / tornado.gravity);
    tornadoZ[i] = tornadoVZ[i] * t - 0.5 * tornado.gravity * t * t;
    tornadoVZ[i] -= tornado.gravity * t;
    tornadoR[i] += tornadoVR[i] * t;
  }
}

// The centre line's x at height q.
function tornadoCentre(q) {
  const last = tornadoX.length - 1;
  const f = Math.min(last, Math.max(0, q * last));
  const i = Math.min(last - 1, Math.floor(f));
  return tornadoX[i] + (tornadoX[i + 1] - tornadoX[i]) * (f - i);
}

function stepTornado() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  tornadoTime++;
  const time = tornadoTime;
  const topY = tornado.top * h;
  const groundY = tornado.ground * h;
  const height = groundY - topY;

  // The centre line: springs to the cursor, tension along it, drag at the foot.
  const target = tornadoTarget();
  const X = tornadoX;
  const V = tornadoV;
  const last = X.length - 1;
  for (let k = 0; k <= last; k++) {
    const q = k / last;
    const y = groundY - q * height;
    const near = Math.exp(-(((y - target.y) / (tornado.reach * h)) ** 2));
    const goal = target.x + tornado.sway * Math.sin(time * 0.013 + q * 3.1);
    const below = k > 0 ? X[k - 1] : X[k];
    const above = k < last ? X[k + 1] : X[k];
    const pull = tornado.chase * (0.3 + 0.7 * near) * (goal - X[k]);
    const keep = tornado.calm - tornado.groundDrag * (1 - q) ** 3;
    V[k] = (V[k] + pull + tornado.tension * (below + above - 2 * X[k])) * keep;
  }
  for (let k = 0; k <= last; k++) X[k] += V[k];

  // The funnel.
  const neck = tornado.neck;
  const mouth = Math.max(neck, tornado.mouth * w);
  const tilt = tornado.tilt;
  for (let i = 0; i < tornadoFunnel; i++) {
    const q = tornadoQ[i];
    const swell = 1 + tornado.ripple * Math.sin(Math.PI * 6 * q - time * 0.06);
    const r = (neck + (mouth - neck) * Math.pow(q, tornado.flare)) * swell;
    tornadoA[i] += tornado.spin * Math.sqrt(neck / r);
    tornadoQ[i] += tornado.climb * Math.max(0.12, Math.min(1, (3 * neck) / r));
    if (tornadoQ[i] > 1) {
      tornadoQ[i] -= 1;
      tornadoA[i] = Math.random() * Math.PI * 2;
    }
    const a = tornadoA[i];
    const e = whiteElements[i];
    e.x = tornadoCentre(q) + r * tornadoR[i] * Math.cos(a);
    e.y = groundY - q * height + r * tornadoR[i] * Math.sin(a) * tilt;
  }

  // The wall cloud, lowest over the funnel.
  const cloudX = X[last];
  const wide = Math.max(mouth + 1, tornado.cloudWidth * w);
  for (let i = tornadoFunnel; i < tornadoFunnel + tornadoCloud; i++) {
    const R = tornadoR[i];
    tornadoA[i] += tornado.cloudSpin * Math.sqrt(mouth / R);
    const out = R / wide;
    const base = topY - topY * 0.3 * out * Math.sqrt(out);
    const a = tornadoA[i];
    const e = whiteElements[i];
    e.x = cloudX + R * Math.cos(a);
    e.y = base - tornadoZ[i] * topY * 0.55 * (0.5 + 0.5 * out) + R * Math.sin(a) * tilt * 0.3;
  }

  // Debris, thrown up and out from the foot.
  const footX = X[0];
  const flung = tornado.debrisReach * neck;
  for (let i = tornadoFunnel + tornadoCloud; i < n; i++) {
    tornadoA[i] += tornado.spin * 0.6 * Math.sqrt(neck / Math.max(neck, tornadoR[i]));
    tornadoR[i] += tornadoVR[i];
    tornadoVR[i] *= 0.99;
    tornadoZ[i] += tornadoVZ[i];
    tornadoVZ[i] -= tornado.gravity;
    if ((tornadoZ[i] < 0 && tornadoVZ[i] < 0) || tornadoR[i] > flung) tornadoThrow(i);
    const a = tornadoA[i];
    const e = whiteElements[i];
    e.x = footX + tornadoR[i] * Math.cos(a);
    e.y = groundY - tornadoZ[i] + tornadoR[i] * Math.sin(a) * tilt;
  }
}

registerBackground("tornado", {
  start: startTornado,
  step: stepTornado,
  settings: tornado,
});
