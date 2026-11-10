// The snowflake background. Loaded after infinity.js and motion.js.

// ---- Snowflake -----------------------------------------------------------------
// A snow crystal growing on the cursor, in a snowfall only the cursor lights. A real
// crystal's shape is the record of the air it fell through: its six arms stay alike
// because they all met the same air at the same moments, and no two crystals match
// because no two fall the same way. So here: before a flake starts, a series of
// random numbers is drawn, one set for each stage of its growth, saying how far
// that stage goes, how humid the air is and how fast vapour settles on the ice.
// Then it grows by Reiter's model: on a hexagonal lattice, vapour diffuses between
// sites, and sites touching ice collect it until they freeze in turn. Dry stages
// send out thin feathered arms, moist ones spread them into plates, and each change
// of stage leaves its line in the ice.
// The cursor is the air moving round it. The flake hangs on the cursor, lagging,
// swinging over and turning as it is dragged. Moving feeds it: it grows steadily
// while the cursor rests and several times as fast while it moves, and thicker the
// faster, as a crystal does with more air blowing past it. A flick is a gust, throwing it
// into new air, drawn at random, and the line that leaves stays in the ice. Scrolling
// spins it, carries it up or down through damper or drier air, and moves the
// snowfall past it. So its shape is the random numbers and the way it was carried.
// Only one twelfth of the flake is grown, and it is drawn twelve times, mirrored
// and turned, so the arms are alike exactly. When a flake is done it hangs a moment,
// then the wind takes it, or a flick does sooner and in the flick's direction: it
// comes away whole, gathers speed, tumbles and shrinks into the distance, while
// the next begins on the cursor from new numbers, so there is always one growing.
// Without a cursor it drifts about the middle of the screen; on a phone, tilting
// steers it and a shake is a flick.
// Dots: the snowfall has its own, always the same number. The flake on the cursor
// has first call on the rest, outlines and the lines inside it, thinned evenly if
// they would take more than there are; the one blowing away has what is left.
const snowflake = {
  size: 0.1, // radius it grows to, share of the shorter side
  cell: 1.2, // px between lattice sites: finer gives more, smaller branches
  stages: [6, 16], // stages of growth, least to most
  humid: [0.25, 0.8], // the air's vapour in a stage, driest to dampest: much above this it fills in solid
  feed: [0.0001, 0.02], // vapour settling on the ice each step in a stage, least to most
  wander: 0.3, // how far the air can change from one stage to the next, share of those ranges
  diffuse: 1, // how freely the vapour spreads
  air: 0.0005, // how fast the air round it comes to the stage's humidity, per step, the cursor still
  draught: 0.003, // how much faster, the cursor moving flat out
  pace: 0.12, // lattice sites its radius grows a frame, the cursor still
  rush: 0.4, // how many more, the cursor moving flat out
  emerge: 12, // frames new ice takes to grow out from the ice it froze against
  steps: 24, // most steps of growth a frame
  patience: 4000, // steps a stage may stall before the next takes over
  stir: 24, // px per frame of the cursor that counts as flat out
  gust: 34, // px per frame of the cursor that counts as a flick
  linger: 150, // frames a finished flake hangs before the wind takes it
  blow: [9, 14], // px per frame the wind carries it away at, least to most
  gale: 0.4, // how much more of a flick's own speed it is carried away at
  blowUp: 0.03, // how fast it picks up the wind's speed, per frame
  tumble: 0.07, // radians a frame it turns over as it goes, at most
  recede: 0.35, // share of its size it loses going off into the distance
  snow: 1000, // dots that are always falling snow
  lines: 0.2, // share of the flake's dots always left to the lines inside it
  follow: 0.16, // how closely it keeps up with the cursor
  lean: 0.012, // radians it swings over per px it lags
  spin: 0.0008, // radians it turns a frame by itself
  scrollSpin: 0.00006, // radians a frame per px scrolled
  scrollAir: 0.0005, // how far a px of scrolling moves it through the air's humidity
  scrollSnow: 0.25, // px the nearest snow moves per px scrolled
  sweep: 170, // px round the cursor in which its moving carries the snow along
  fall: [0.25, 1.1], // px per frame the snow falls, furthest to nearest
  gather: 70, // frames the dots take to fly from the pattern into the snowfall
};

const SNOW_ROOT = Math.sqrt(3) / 2;
const SNOW_MARGIN = 40; // lattice sites of air worked out beyond the tips

let snowRadius = 0; // the lattice's radius, in sites
let snowCount = 0; // sites in the twelfth of it that is grown
let snowDist = new Float32Array(0); // each site's distance from the middle, nearest first
let snowNear = new Int32Array(0); // each site's six neighbours, folded back into the twelfth
let snowPX = new Float32Array(0); // each site's place, in sites
let snowPY = new Float32Array(0);
let snowCopies = new Uint8Array(0); // how many times it appears in the whole flake
let snowRank = new Float32Array(0); // its place in the queue if dots run short

// The flake growing: each site's vapour, whether it is air, touching ice or ice,
// the stage it froze in, and how many of its neighbours are not ice.
let snowVapour = new Float64Array(0);
let snowNext = new Float64Array(0);
let snowState = new Uint8Array(0);
let snowStageOf = new Uint8Array(0);
let snowOpen = new Uint8Array(0);
let snowLine = new Uint8Array(0); // 1 where the ice shows a line inside the flake
let snowParent = new Int32Array(0); // the ice each site froze against
let snowBornAt = new Int32Array(0); // the frame it froze on
let snowIce = new Int32Array(0); // the sites frozen so far, in order
let snowIced = 0;
// The series of random numbers it is grown from, and how far through it is.
let snowHistory = []; // { until, humid, feed }
let snowStage = 0;
let snowStageSteps = 0;
let snowSteps = 0;
let snowReached = 0; // radius so far, in sites
let snowEffort = 5; // steps of growth this air has been taking to move the tips a site
let snowSinceTip = 0; // steps since the tips last moved
let snowGained = 0; // how far they have moved in that time
let snowDue = 0; // steps of growth owed
let snowActive = 0; // sites being worked out
let snowDone = false;
let snowWait = 0;

// How it is being carried: where it is, how it is turning, the cursor's moving,
// 0 to 1, and how far scrolling has carried it through the air.
const snowFlake = { x: 0, y: 0, vx: 0, vy: 0, turn: 0, spin: 0 };
const snowCursor = { x: 0, y: 0, on: false, vx: 0, vy: 0 };
// The last flake, blowing away: where its dots are relative to its middle, as they
// were when it came loose, and how it is going. None while count is 0.
const snowGone = {
  count: 0,
  age: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  windX: 1, // the wind it is being carried by
  windY: 0,
  turn: 0,
  spin: 0,
  flip: 0, // how far it has turned over
  flipBy: 0,
  beat: 0,
  leanX: 1, // how it was leaning as it came away, which it straightens out of
  leanY: 0,
  squash: 0,
};
let snowGoneX = new Float32Array(0);
let snowGoneY = new Float32Array(0);
let snowGoneLit = new Float32Array(0);
// The flake on the cursor as it was last drawn, ready to be let go of.
let snowShapeX = new Float32Array(0);
let snowShapeY = new Float32Array(0);
let snowShapeLit = new Float32Array(0);
let snowShaped = 0;
let snowWind = 0;
let snowLayer = 0;
let snowCalm = 0; // frames until another flick counts
let snowShakes = 0;
const snowCos = new Float32Array(6);
const snowSin = new Float32Array(6);

// Scrolling, by the wheel or by the page moving, px since the last frame. The
// wheel scrolls the page too, so for a moment after it the page's own scrolling
// is not counted again.
let snowWheel = 0;
let snowWheelAt = 0;
let snowScrolled = 0;
let snowScrollY = window.scrollY;
window.addEventListener(
  "wheel",
  function (event) {
    snowWheel += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
    snowWheelAt = performance.now();
  },
  { passive: true }
);
window.addEventListener(
  "scroll",
  function () {
    if (performance.now() - snowWheelAt > 400) snowScrolled += window.scrollY - snowScrollY;
    snowScrollY = window.scrollY;
  },
  { passive: true }
);

let snowTime = 0;
let snowX = new Float32Array(0); // the falling snow
let snowY = new Float32Array(0);
let snowDrop = new Float32Array(0);
let snowBeat = new Float32Array(0);
let snowFromX = new Float32Array(0); // where the pattern left the dots
let snowFromY = new Float32Array(0);
let snowLit = new Float32Array(0); // each dot's light, this frame

function snowBetween(range, k) {
  return range[0] + (range[1] - range[0]) * k;
}

// A site of the lattice, by its two whole coordinates, folded into the twelfth of
// the plane from 0 to 30 degrees.
function snowFold(i, j) {
  const x = i + j / 2;
  const y = j * SNOW_ROOT;
  const r = Math.hypot(x, y);
  const sixth = Math.PI / 3;
  let angle = Math.atan2(y, x);
  angle = ((angle % sixth) + sixth) % sixth;
  if (angle > sixth / 2) angle = sixth - angle;
  const fy = r * Math.sin(angle);
  const fj = Math.round(fy / SNOW_ROOT);
  return [Math.round(r * Math.cos(angle) - fj / 2), fj];
}

function snowBuild(radius) {
  if (radius === snowRadius) return;
  snowRadius = radius;
  const sites = [];
  const most = Math.ceil(radius * 1.2) + 2;
  for (let i = 0; i <= most; i++) {
    for (let j = 0; j <= i; j++) {
      const d = Math.hypot(i + j / 2, j * SNOW_ROOT);
      if (d <= radius) sites.push({ i, j, d });
    }
  }
  sites.sort(function (a, b) {
    return a.d - b.d;
  });
  const count = sites.length;
  const key = function (i, j) {
    return i * (most + 2) + j;
  };
  const index = new Map();
  sites.forEach(function (site, k) {
    index.set(key(site.i, site.j), k);
  });
  snowCount = count;
  snowDist = new Float32Array(count);
  snowNear = new Int32Array(count * 6);
  snowPX = new Float32Array(count);
  snowPY = new Float32Array(count);
  snowCopies = new Uint8Array(count);
  snowRank = new Float32Array(count);
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  sites.forEach(function (site, k) {
    snowDist[k] = site.d;
    snowPX[k] = site.i + site.j / 2;
    snowPY[k] = site.j * SNOW_ROOT;
    snowCopies[k] = site.i === 0 ? 1 : site.j === 0 || site.i === site.j ? 6 : 12;
    // An even spread over the lattice, not a random one: thinned, a line of sites
    // stays a line of evenly spaced dots, where random holes would turn it to dust.
    snowRank[k] = (site.i * 0.7548776662 + site.j * 0.569840291) % 1;
    around.forEach(function (step, d) {
      const [fi, fj] = snowFold(site.i + step[0], site.j + step[1]);
      const n = index.get(key(fi, fj));
      // Off the edge of the lattice is the air itself, one extra site.
      snowNear[k * 6 + d] = n === undefined ? count : n;
    });
  });
  // One more of each, for that site of open air.
  snowVapour = new Float64Array(count + 1);
  snowNext = new Float64Array(count + 1);
  snowState = new Uint8Array(count + 1);
  snowStageOf = new Uint8Array(count + 1);
  snowOpen = new Uint8Array(count + 1);
  snowLine = new Uint8Array(count + 1);
  snowParent = new Int32Array(count + 1);
  snowBornAt = new Int32Array(count + 1);
  snowIce = new Int32Array(count);
}

function snowFeed(k) {
  return snowflake.feed[0] * Math.pow(snowflake.feed[1] / snowflake.feed[0], k);
}

// The series of numbers a flake is grown from: first its own climate, a damp and
// a richness, 0 to 1; then for each stage how far out it goes, and how far the
// air wanders from where it just was, drawn back towards that climate. Were each
// stage's air drawn afresh they would average out, and every flake look alike.
function snowDraw() {
  const stages = Math.max(1, Math.round(snowBetween(snowflake.stages, Math.random())));
  const climateH = Math.random();
  const climateF = Math.random();
  const widths = [];
  let total = 0;
  for (let k = 0; k < stages; k++) {
    widths.push(0.4 + Math.random());
    total += widths[k];
  }
  const history = [];
  const wander = snowflake.wander;
  let reach = 0;
  let h = climateH;
  let f = climateF;
  for (let k = 0; k < stages; k++) {
    reach += widths[k] / total;
    h = Math.max(0, Math.min(1, h + (climateH - h) * 0.3 + (Math.random() - 0.5) * 2 * wander));
    f = Math.max(0, Math.min(1, f + (climateF - f) * 0.3 + (Math.random() - 0.5) * 2 * wander));
    history.push({ until: reach, humid: snowBetween(snowflake.humid, h), feed: snowFeed(f) });
  }
  return history;
}

function snowFreeze(k) {
  const near = snowNear;
  snowState[k] = 2;
  snowStageOf[k] = snowStage;
  snowBornAt[k] = snowTime;
  snowIce[snowIced++] = k;
  if (snowDist[k] > snowReached) {
    // How many steps a site of radius has been taking, over at least a whole site.
    snowGained += snowDist[k] - snowReached;
    snowReached = snowDist[k];
    if (snowGained >= 1) {
      snowEffort += (snowSinceTip / snowGained - snowEffort) * 0.25;
      snowSinceTip = 0;
      snowGained = 0;
    }
  }
  let open = 0;
  let line = snowDist[k] < 0.5 ? 1 : 0;
  let parent = k;
  for (let d = 0; d < 6; d++) {
    const n = near[k * 6 + d];
    if (snowState[n] === 2) {
      snowOpen[n]--;
      if (parent === k && n !== k) parent = n;
      // Where it froze against the ice of an earlier stage, a line is left.
      if (snowStageOf[n] !== snowStage) line = 1;
    } else {
      open++;
      if (snowState[n] === 0 && n !== snowCount) snowState[n] = 1;
    }
  }
  snowOpen[k] = open;
  snowLine[k] = line;
  snowParent[k] = parent;
}

// Starts a flake growing from a series of numbers.
function snowBegin(history) {
  snowHistory = history;
  snowStage = 0;
  snowStageSteps = 0;
  snowSteps = 0;
  snowReached = 0;
  snowEffort = 5;
  snowSinceTip = 0;
  snowGained = 0;
  snowDue = 0;
  snowActive = 0;
  snowIced = 0;
  snowDone = false;
  snowWait = 0;
  snowLayer = 0;
  snowVapour.fill(history[0].humid);
  snowState.fill(0);
  snowOpen.fill(0);
  snowLine.fill(0);
  snowFreeze(0);
}

function snowHumid() {
  return Math.max(0.1, Math.min(snowflake.humid[1], snowHistory[snowStage].humid + snowLayer));
}

function snowNextStage() {
  snowStage++;
  snowStageSteps = 0;
  const humid = snowHumid();
  // The air out beyond what is being worked out is simply the new air.
  for (let k = snowActive; k <= snowCount; k++) if (snowState[k] === 0) snowVapour[k] = humid;
}

// A gust: it is thrown into new air, drawn at random, for as long as this stage
// had left to run.
function snowGust() {
  const history = snowHistory;
  const until = history[snowStage].until;
  history.splice(snowStage + 1, 0, {
    until,
    humid: snowBetween(snowflake.humid, Math.random()),
    feed: snowFeed(Math.random()),
  });
  snowNextStage();
}

// One step of growth.
function snowGrow() {
  const history = snowHistory;
  while (snowStage < history.length - 1 && snowReached >= history[snowStage].until * snowRadius) snowNextStage();
  if (snowStageSteps > snowflake.patience) {
    if (snowStage < history.length - 1) snowNextStage();
    else snowDone = true;
  }
  if (snowDone) return;
  snowSteps++;
  snowStageSteps++;
  snowSinceTip++;
  if (snowSinceTip > snowEffort) snowEffort = snowSinceTip;

  const humid = snowHumid();
  const feed = history[snowStage].feed;
  const flow = snowflake.diffuse / 12;
  const air = snowflake.air + snowWind * snowflake.draught;
  const near = snowNear;
  const state = snowState;
  const S = snowVapour;
  const N = snowNext;
  let active = snowActive;
  const out = snowReached + SNOW_MARGIN;
  while (active < snowCount && snowDist[active] <= out) active++;
  snowActive = active;
  S[snowCount] = humid;

  for (let k = 0; k < active; k++) {
    const kind = state[k];
    if (kind === 2) continue;
    let sum = 0;
    const m = k * 6;
    for (let d = 0; d < 6; d++) {
      const n = near[m + d];
      if (state[n] === 0) sum += S[n];
    }
    if (kind === 0) {
      const u = S[k];
      const next = u + flow * (sum - 6 * u);
      N[k] = next + (humid - next) * air;
    } else {
      N[k] = S[k] + feed + flow * sum;
    }
  }
  for (let k = 0; k < active; k++) {
    if (state[k] === 2) continue;
    S[k] = N[k];
  }
  // After all the vapour has moved, so that nothing freezes in step with its
  // neighbours' half-finished sums.
  for (let k = 0; k < active; k++) {
    if (state[k] === 1 && S[k] >= 1) snowFreeze(k);
  }
  if (snowReached >= snowRadius - 2) snowDone = true;
}

// Where it should be: on the cursor, or without one, drifting about the middle.
function snowTarget() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  const t = snowTime;
  return {
    x: canvas.width * (0.5 + 0.2 * Math.sin(t * 0.0017)),
    y: canvas.height * (0.5 + 0.16 * Math.sin(t * 0.0023 + 1)),
  };
}

// Done: the wind takes it, whole, along a flick if that is what did it, or else
// more or less sideways; and the next begins where it was.
function snowLetGo(flick, leanX, leanY, squash) {
  const g = snowGone;
  const f = snowFlake;
  const c = snowCursor;
  [snowGoneX, snowShapeX] = [snowShapeX, snowGoneX];
  [snowGoneY, snowShapeY] = [snowShapeY, snowGoneY];
  [snowGoneLit, snowShapeLit] = [snowShapeLit, snowGoneLit];
  g.count = snowShaped;
  snowShaped = 0;
  const flung = flick ? Math.hypot(c.vx, c.vy) : 0;
  const angle = flung > 0 ? Math.atan2(c.vy, c.vx) : (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.2;
  const speed = snowBetween(snowflake.blow, Math.random()) + flung * snowflake.gale;
  g.age = 0;
  g.x = f.x;
  g.y = f.y;
  g.vx = f.vx;
  g.vy = f.vy;
  g.windX = Math.cos(angle) * speed;
  g.windY = Math.sin(angle) * speed;
  g.turn = 0;
  g.spin = f.spin + snowflake.spin;
  g.flip = 0;
  g.flipBy = snowflake.tumble * (0.5 + 0.5 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
  g.beat = Math.random() * Math.PI * 2;
  g.leanX = leanX;
  g.leanY = leanY;
  g.squash = squash;
  snowBegin(snowDraw());
  f.turn = Math.random() * Math.PI * 2;
}

function startSnowflake() {
  const n = whiteElements.length;
  const side = Math.min(canvas.width, canvas.height);
  snowTime = 0;
  snowBuild(Math.max(30, Math.round((snowflake.size * side) / snowflake.cell)));
  snowBegin(snowDraw());
  const target = snowTarget();
  snowFlake.x = target.x;
  snowFlake.y = target.y;
  snowFlake.vx = 0;
  snowFlake.vy = 0;
  snowFlake.turn = Math.random() * Math.PI * 2;
  snowFlake.spin = 0;
  snowGone.count = 0;
  snowShaped = 0;
  snowCursor.on = false;
  snowWind = 0;
  snowCalm = 0;
  snowWheel = 0;
  snowScrolled = 0;
  snowShakes = phone.shakes;
  snowX = new Float32Array(n);
  snowY = new Float32Array(n);
  snowDrop = new Float32Array(n);
  snowBeat = new Float32Array(n);
  snowFromX = new Float32Array(n);
  snowFromY = new Float32Array(n);
  snowLit = new Float32Array(n);
  snowShapeX = new Float32Array(n);
  snowShapeY = new Float32Array(n);
  snowShapeLit = new Float32Array(n);
  snowGoneX = new Float32Array(n);
  snowGoneY = new Float32Array(n);
  snowGoneLit = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    snowFromX[i] = whiteElements[i].x;
    snowFromY[i] = whiteElements[i].y;
    snowX[i] = Math.random() * canvas.width;
    snowY[i] = Math.random() * canvas.height;
    snowDrop[i] = Math.random();
    snowBeat[i] = Math.random() * Math.PI * 2;
  }
}

// Each dot's own light, dimmed with its distance from the cursor as every
// background's dots are, so that it is the cursor that shows.
function snowLight(x, y, i) {
  const lit = snowLit[i] || 0;
  if (!cursorOnPage) return lit;
  const d = Math.hypot(x - cursorPosition.x, y - cursorPosition.y) || 1;
  return lit * Math.min(1, Math.max(cursorGlow.floor, cursorGlow.full / d));
}

function stepSnowflake() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  snowTime++;

  // The cursor's moving, as wind, and whether it was a flick.
  const c = snowCursor;
  const target = snowTarget();
  c.vx = c.on && cursorOnPage ? target.x - c.x : 0;
  c.vy = c.on && cursorOnPage ? target.y - c.y : 0;
  c.x = target.x;
  c.y = target.y;
  c.on = cursorOnPage;
  const speed = Math.hypot(c.vx, c.vy);
  snowWind += (Math.min(1, speed / snowflake.stir) - snowWind) * 0.1;
  if (snowCalm > 0) snowCalm--;
  let flick = speed > snowflake.gust && snowCalm === 0;
  if (phone.shakes !== snowShakes) {
    snowShakes = phone.shakes;
    flick = true;
  }

  // Scrolling.
  const scrolled = snowWheel + snowScrolled;
  snowWheel = 0;
  snowScrolled = 0;
  snowLayer = Math.max(-0.3, Math.min(0.3, (snowLayer + scrolled * snowflake.scrollAir) * 0.998));

  // It lags behind the cursor, swinging over, and turns as it is swung round.
  const f = snowFlake;
  const lagX = target.x - f.x;
  const lagY = target.y - f.y;
  f.vx = lagX * snowflake.follow;
  f.vy = lagY * snowflake.follow;
  f.x += f.vx;
  f.y += f.vy;
  f.spin = (f.spin + scrolled * snowflake.scrollSpin + (lagX * c.vy - lagY * c.vx) * 5e-7) * 0.96;
  f.turn += snowflake.spin + f.spin;
  const lag = Math.hypot(lagX, lagY) || 1;
  const leanX = lagX / lag;
  const leanY = lagY / lag;
  const squash = 1 - Math.cos(Math.min(1.1, lag * snowflake.lean));

  // Growing, at a pace set by the wind: as many steps a frame as this air needs to
  // move the tips that fast, spread evenly over the frames, so that it does not
  // stand still and then lurch each time the tips move on a whole site.
  if (!snowDone) {
    if (flick) snowGust();
    const pace = snowflake.pace + snowWind * snowflake.rush;
    snowDue = Math.min(snowflake.steps, snowDue + pace * snowEffort);
    while (snowDue >= 1 && !snowDone) {
      snowDue -= 1;
      snowGrow();
    }
  } else if ((++snowWait > snowflake.linger || (flick && snowWait > 20)) && snowGone.count === 0) {
    snowLetGo(flick, leanX, leanY, squash);
  }
  if (flick) snowCalm = 40;

  // The flake: twelve of each site, its outlines and the lines inside it, either
  // thinned by each site's place in the queue if there is not room; the lines kept
  // a share of the room, being all that shows of the gusts it has been through.
  const cell = snowflake.cell;
  for (let r = 0; r < 6; r++) {
    const a = f.turn + (Math.PI / 3) * r;
    snowCos[r] = Math.cos(a);
    snowSin[r] = Math.sin(a);
  }
  let outlines = 0;
  let inner = 0;
  for (let q = 0; q < snowIced; q++) {
    const k = snowIce[q];
    if (snowOpen[k] > 0) outlines += snowCopies[k];
    else if (snowLine[k]) inner += snowCopies[k];
  }
  const room = Math.max(0, n - Math.round(snowflake.snow));
  const lines = Math.min(inner, room * snowflake.lines);
  const keepOut = Math.min(1, (room - lines) / Math.max(1, outlines));
  const keepIn = Math.min(1, Math.max(lines, room - outlines * keepOut) / Math.max(1, inner));
  let next = 0;
  function place(x, y, lit) {
    if (next >= room) return;
    const along = (x * leanX + y * leanY) * squash;
    const e = whiteElements[next];
    e.x = f.x + x - leanX * along;
    e.y = f.y + y - leanY * along;
    snowShapeX[next] = x;
    snowShapeY[next] = y;
    snowShapeLit[next] = lit;
    snowLit[next++] = lit;
  }
  for (let q = 0; q < snowIced; q++) {
    const k = snowIce[q];
    const open = snowOpen[k] > 0;
    if (!open && !snowLine[k]) continue;
    if (snowRank[k] > (open ? keepOut : keepIn)) continue;
    const age = snowTime - snowBornAt[k];
    const lit = Math.min(1, (open ? 0.8 : 0.45) + 0.5 * Math.exp(-age / 40));
    // New ice grows out from the ice it froze against.
    let px = snowPX[k];
    let py = snowPY[k];
    if (age < snowflake.emerge) {
      const t = (age + 1) / snowflake.emerge;
      const out = t * (2 - t);
      const p = snowParent[k];
      px = snowPX[p] + (px - snowPX[p]) * out;
      py = snowPY[p] + (py - snowPY[p]) * out;
    }
    px *= cell;
    py *= cell;
    const copies = snowCopies[k];
    const turns = copies === 1 ? 1 : 6;
    for (let r = 0; r < turns; r++) {
      place(px * snowCos[r] - py * snowSin[r], px * snowSin[r] + py * snowCos[r], lit);
      if (copies === 12) place(px * snowCos[r] + py * snowSin[r], px * snowSin[r] - py * snowCos[r], lit);
    }
  }
  snowShaped = next;

  // The last flake, picking up the wind, fluttering across it, turning over and
  // going off into the distance, straightening out of how it was leaning; and with
  // what dots the new one leaves it, evenly thinned.
  const g = snowGone;
  if (g.count) {
    g.age++;
    g.vx += (g.windX - g.vx) * snowflake.blowUp;
    g.vy += (g.windY - g.vy) * snowflake.blowUp;
    const wind = Math.hypot(g.windX, g.windY) || 1;
    const windX = g.windX / wind;
    const windY = g.windY / wind;
    const settled = Math.min(1, g.age / 40);
    const flutter = 1.4 * settled * Math.sin(g.age * 0.09 + g.beat);
    g.x += g.vx - windY * flutter;
    g.y += g.vy + windX * flutter;
    g.turn += g.spin;
    g.spin += (0.05 * Math.sign(g.flipBy) - g.spin) * 0.02;
    g.flip += g.flipBy * settled;
    const margin = snowRadius * snowflake.cell * 1.5;
    if (g.x < -margin || g.x > w + margin || g.y < -margin || g.y > h + margin) {
      g.count = 0;
    } else {
      const cos = Math.cos(g.turn);
      const sin = Math.sin(g.turn);
      const scale = 1 - snowflake.recede * (1 - Math.exp(-g.age / 60));
      const leaning = g.squash * Math.exp(-g.age / 15);
      const turnedOver = (1 - Math.abs(Math.cos(g.flip))) * 0.85;
      const every = Math.max(1, g.count / Math.max(1, room - next));
      for (let q = 0; q < g.count && next < room; q += every) {
        const d = Math.floor(q);
        let x = snowGoneX[d] * cos - snowGoneY[d] * sin;
        let y = snowGoneX[d] * sin + snowGoneY[d] * cos;
        const along = (x * g.leanX + y * g.leanY) * leaning;
        x -= g.leanX * along;
        y -= g.leanY * along;
        const over = (x * windX + y * windY) * turnedOver;
        x -= windX * over;
        y -= windY * over;
        const e = whiteElements[next];
        e.x = g.x + x * scale;
        e.y = g.y + y * scale;
        snowLit[next++] = snowGoneLit[d];
      }
    }
  }

  // The snowfall's dots are falling snow, the nearer flakes faster and brighter,
  // moved by scrolling and carried along by the cursor. Any dots between are not
  // needed; at first all of them fly in to the speck on the cursor, or out to the
  // snowfall, from wherever the pattern left them.
  const time = snowTime;
  const gathering = time < snowflake.gather;
  const t = time / snowflake.gather;
  const gathered = t * t * (3 - 2 * t);
  for (let i = next; i < room; i++) {
    const e = whiteElements[i];
    e.x = gathering ? snowFromX[i] + (f.x - snowFromX[i]) * gathered : -100;
    e.y = gathering ? snowFromY[i] + (f.y - snowFromY[i]) * gathered : -100;
    snowLit[i] = gathering ? 0.6 : 0;
  }
  const sweep2 = snowflake.sweep * snowflake.sweep;
  for (let i = room; i < n; i++) {
    const near = snowDrop[i];
    snowY[i] += snowBetween(snowflake.fall, near) - scrolled * snowflake.scrollSnow * (0.3 + 0.7 * near);
    snowX[i] += Math.sin(time * 0.012 + snowBeat[i]) * (0.15 + 0.35 * near);
    if (speed > 0) {
      const dx = snowX[i] - target.x;
      const dy = snowY[i] - target.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < sweep2) {
        const carried = 0.5 * (1 - d2 / sweep2);
        snowX[i] += c.vx * carried;
        snowY[i] += c.vy * carried;
      }
    }
    if (snowY[i] > h + 4) {
      snowY[i] = -4;
      snowX[i] = Math.random() * w;
    } else if (snowY[i] < -4) {
      snowY[i] = h + 4;
      snowX[i] = Math.random() * w;
    }
    const e = whiteElements[i];
    e.x = gathering ? snowFromX[i] + (snowX[i] - snowFromX[i]) * gathered : snowX[i];
    e.y = gathering ? snowFromY[i] + (snowY[i] - snowFromY[i]) * gathered : snowY[i];
    snowLit[i] = 0.35 + 0.55 * near;
  }
}

registerBackground("snowflake", {
  start: startSnowflake,
  step: stepSnowflake,
  light: snowLight,
  settings: snowflake,
});
