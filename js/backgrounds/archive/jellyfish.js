// ARCHIVED: not loaded by the site, only by the dev page (/dev/). Kept to look
// at and work on later. Loaded after infinity.js.

// ---- Jellyfish ---------------------------------------------------------------
// A tank of moon jellies, seen through the glass, the screen's edges its
// walls. Each swims by pulsing its bell: a quick squeeze, the bell narrowing
// and doming up, its rim curling in, that drives it forwards, then a slow
// relaxation, the bell spreading flat again, while it coasts and sinks a
// little. It heads up, wandering, slanting one way or the other across the
// tank, turning away from the walls, the surface and the floor, and drifts
// towards the cursor, as jellies drift towards light, without bumping into
// it. Each keeps to a depth of its own, which drifts now and then, so they
// spread through the tank: below it, it pulses hard, above it only weakly,
// and sinks back. The bell is drawn as a solid seen a
// little from below: its outline, its rim as an ellipse, the radial canals
// running down it, and the four horseshoe gonads in its crown, all turning
// slowly with it. From the rim hang fine tentacles, fanning out a little, and
// from its middle four frilled oral arms; each is a chain of links that
// trails the bell as it moves, sways with the water and curls in slow waves
// running down it, but however the bell turns it hangs back from it, never
// pulled straight or swept up past it. Moving the cursor stirs the water, pushing
// the jellies, their tentacles and the specks of marine snow that sink
// slowly through the tank; a faint current runs through it all the time.
// Bigger jellies are nearer, and move further across the screen. Without a
// cursor they just wander.
// Dots: for each jelly, its bell, its arms, then its tentacles; then the
// snow; the rest are parked out of sight.
const jelly = {
  count: 7, // jellyfish
  size: [0.035, 0.085], // bell radius, share of the shorter side, furthest to nearest
  pulse: [90, 150], // frames from one pulse to the next, least to most
  squeeze: 0.25, // share of a pulse spent squeezing; the rest relaxing
  thrust: 1, // how hard a pulse drives it on
  sink: 0.012, // px per frame per frame it sinks, at its nearest
  drag: 0.965, // share of its speed it keeps each frame
  turn: 0.012, // rad per frame it turns, at most
  wander: 0.9, // rad it wanders off its way, either side
  depths: [0.12, 0.85], // the depths it keeps to, share of the height, highest to lowest
  lure: 0.25, // how much it heads towards the cursor
  tilt: 0.28, // how far from below the bell is seen
  tentacles: 10, // round each rim
  reach: [1.6, 3.2], // tentacle length, in bell radii, least to most
  arms: 4, // oral arms
  armLength: 1.3, // in bell radii
  gap: 5, // px between the dots along tentacles and arms
  stir: 0.35, // how hard the cursor's movement pushes the water
  stirReach: 0.14, // how far round the cursor it does, share of the shorter side
  snow: 300, // specks of marine snow
};

const JELLY_LINKS = 10; // nodes along a tentacle, the first on the rim
const JELLY_ARM_LINKS = 8;
let jellies = [];
let jellyTime = 0;
let jellySnowX = new Float32Array(0);
let jellySnowY = new Float32Array(0);
let jellySnowSink = new Float32Array(0);
let jellyStirX = 0; // the cursor's speed, smoothed
let jellyStirY = 0;
let jellyLastX = null;
let jellyLastY = null;

function jellyBetween(range, k) {
  return range[0] + (range[1] - range[0]) * k;
}

function jellyWrap(a) {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

// A jelly `near`, 0 furthest to 1 nearest, at (x, y), heading up.
function jellyMake(x, y, near, side) {
  const R = jellyBetween(jelly.size, near) * side;
  const T = Math.max(3, Math.round(jelly.tentacles));
  const A = Math.max(0, Math.round(jelly.arms));
  const j = {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.6, // the way its crown points
    near,
    R,
    period: jellyBetween(jelly.pulse, Math.random()),
    t: Math.random() * 100, // frames into its pulse
    spin: Math.random() * 6.3, // its turn about its own axis
    beat: Math.random() * 100, // its own wandering
    depth: jellyBetween(jelly.depths, Math.random()), // the depth it keeps to, share of the height
    across: Math.random() < 0.5 ? -1 : 1, // the way it heads across, at that depth; back from the walls
    reach: new Float32Array(T), // each tentacle's length
    tx: new Float32Array(T * JELLY_LINKS), // tentacle nodes, and where they were
    ty: new Float32Array(T * JELLY_LINKS),
    tox: new Float32Array(T * JELLY_LINKS),
    toy: new Float32Array(T * JELLY_LINKS),
    ax: new Float32Array(A * JELLY_ARM_LINKS), // arm nodes, likewise
    ay: new Float32Array(A * JELLY_ARM_LINKS),
    aox: new Float32Array(A * JELLY_ARM_LINKS),
    aoy: new Float32Array(A * JELLY_ARM_LINKS),
  };
  for (let k = 0; k < T; k++) j.reach[k] = jellyBetween(jelly.reach, Math.random()) * R;
  // Hanging straight down from it to begin with.
  for (let k = 0; k < T * JELLY_LINKS; k++) {
    const m = k % JELLY_LINKS;
    j.tx[k] = j.tox[k] = x + (((k / JELLY_LINKS) | 0) / T - 0.5) * R;
    j.ty[k] = j.toy[k] = y + (m * j.reach[(k / JELLY_LINKS) | 0]) / (JELLY_LINKS - 1);
  }
  for (let k = 0; k < A * JELLY_ARM_LINKS; k++) {
    const m = k % JELLY_ARM_LINKS;
    j.ax[k] = j.aox[k] = x;
    j.ay[k] = j.aoy[k] = y + (m * jelly.armLength * R) / (JELLY_ARM_LINKS - 1);
  }
  return j;
}

function startJellyfish() {
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  jellyTime = 0;
  jellies = [];
  const count = Math.max(1, Math.round(jelly.count));
  for (let i = 0; i < count; i++) {
    const near = count > 1 ? i / (count - 1) : 1;
    jellies.push(jellyMake(w * (0.1 + 0.8 * Math.random()), h * (0.25 + 0.6 * Math.random()), near, side));
  }
  const snow = Math.max(0, Math.round(jelly.snow));
  jellySnowX = new Float32Array(snow);
  jellySnowY = new Float32Array(snow);
  jellySnowSink = new Float32Array(snow);
  for (let i = 0; i < snow; i++) {
    jellySnowX[i] = Math.random() * w;
    jellySnowY[i] = Math.random() * h;
    jellySnowSink[i] = 0.08 + Math.random() * 0.25;
  }
  jellyStirX = 0;
  jellyStirY = 0;
  jellyLastX = null;
}

// How far into a pulse `t` frames of `period` the bell is squeezed, 0 to 1:
// quickly in, slowly out.
function jellySqueeze(t, period) {
  const squeeze = period * jelly.squeeze;
  if (t < squeeze) return Math.sin((Math.PI / 2) * (t / squeeze));
  const k = (t - squeeze) / (period - squeeze);
  return 1 - k * k * (3 - 2 * k);
}

function stepJellyfish() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  jellyTime++;
  const time = jellyTime;

  // The water: stirred by the cursor's movement round it, and a faint
  // current running through the tank.
  if (cursorOnPage) {
    if (jellyLastX !== null) {
      jellyStirX += (cursorPosition.x - jellyLastX - jellyStirX) * 0.2;
      jellyStirY += (cursorPosition.y - jellyLastY - jellyStirY) * 0.2;
    }
    jellyLastX = cursorPosition.x;
    jellyLastY = cursorPosition.y;
  } else {
    jellyStirX *= 0.8;
    jellyStirY *= 0.8;
    jellyLastX = null;
  }
  const reach2 = 2 * Math.pow(jelly.stirReach * side, 2);
  let flowX = 0;
  let flowY = 0;
  function flow(x, y) {
    flowX = 0.08 * Math.sin(y * 0.004 + time * 0.002);
    flowY = 0.04 * Math.cos(x * 0.003 + time * 0.0017);
    if (cursorOnPage) {
      const dx = x - cursorPosition.x;
      const dy = y - cursorPosition.y;
      const k = jelly.stir * Math.exp(-(dx * dx + dy * dy) / reach2);
      flowX += jellyStirX * k;
      flowY += jellyStirY * k;
    }
  }

  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  const gap = Math.max(1.5, jelly.gap);
  // Dots every `gap` px along a chain of `links` nodes from index `from`.
  function chain(xs, ys, from, links) {
    for (let m = from; m < from + links - 1; m++) {
      const dx = xs[m + 1] - xs[m];
      const dy = ys[m + 1] - ys[m];
      const steps = Math.max(1, Math.round(Math.hypot(dx, dy) / gap));
      for (let s = 0; s < steps; s++) put(xs[m] + (dx * s) / steps, ys[m] + (dy * s) / steps);
    }
  }
  // Moves a chain on, its first node held at (x0, y0): each link carried on
  // by its own momentum and the water, then drawn towards where it would
  // hang, back from the bell the way `back` points, fanned out by `fan` and
  // curled by a wave of `wave` rad running down it at `phase`, and kept
  // `link` px long and never far off hanging back, less near the bell than
  // at the tip; so however the bell moves or turns, the chain trails it,
  // curved even when it is swung as far as it goes, and never sweeps up past
  // it.
  function trail(xs, ys, oxs, oys, from, links, link, x0, y0, back, fan, wave, phase) {
    xs[from] = oxs[from] = x0;
    ys[from] = oys[from] = y0;
    for (let m = from + 1; m < from + links; m++) {
      const u = (m - from) / (links - 1);
      const bend = 0.55 + 0.65 * u;
      flow(xs[m], ys[m]);
      let x = xs[m] + (xs[m] - oxs[m]) * 0.85 + flowX * 0.5;
      let y = ys[m] + (ys[m] - oys[m]) * 0.85 + flowY * 0.5;
      oxs[m] = xs[m];
      oys[m] = ys[m];
      const hang = back + fan * (1 - 0.5 * u) + wave * u * Math.sin(phase - u * 5);
      x += (xs[m - 1] + Math.cos(hang) * link - x) * 0.18;
      y += (ys[m - 1] + Math.sin(hang) * link - y) * 0.18;
      const off = Math.max(-bend, Math.min(bend, jellyWrap(Math.atan2(y - ys[m - 1], x - xs[m - 1]) - back)));
      xs[m] = xs[m - 1] + Math.cos(back + off) * link;
      ys[m] = ys[m - 1] + Math.sin(back + off) * link;
    }
  }

  for (const j of jellies) {
    const R = j.R;
    const scale = 0.4 + 0.6 * j.near; // nearer ones move further on the screen
    // Its pulse: squeezing drives it on the way its crown points.
    const before = jellySqueeze(j.t, j.period);
    j.t += 1;
    if (j.t >= j.period) {
      j.t -= j.period;
      j.period = jellyBetween(jelly.pulse, Math.random());
    }
    const squeeze = jellySqueeze(j.t, j.period);
    const fx = Math.cos(j.angle);
    const fy = Math.sin(j.angle);
    // Below its depth it pulses hard; above it, only weakly, and sinks back.
    const rise = Math.max(-1, Math.min(1, (j.y - j.depth * h) / (0.12 * h)));
    const strength = Math.max(0.05, Math.min(1.4, 0.6 + 0.8 * rise));
    const push = Math.max(0, squeeze - before) * jelly.thrust * strength * R * 0.06;
    j.vx += fx * push;
    j.vy += fy * push + jelly.sink * scale;
    flow(j.x, j.y);
    j.vx = j.vx * jelly.drag + flowX * 0.08 * scale;
    j.vy = j.vy * jelly.drag + flowY * 0.08 * scale;
    j.x += j.vx;
    j.y += j.vy;
    // Where it heads: up, wandering, slanting across the tank one way, then
    // back the other from the walls; towards the cursor, but round it rather
    // than into it; away from the walls, the surface and the floor. Now and
    // then it settles on another depth.
    if (Math.random() < 1 / 1200) j.depth = jellyBetween(jelly.depths, Math.random());
    if (j.x < 4 * R) j.across = 1;
    else if (j.x > w - 4 * R) j.across = -1;
    const drift = 0.65 * Math.sin(time * 0.0031 + j.beat) + 0.35 * Math.sin(time * 0.0083 + j.beat * 2);
    const wander = jelly.wander * drift;
    let hx = Math.cos(-Math.PI / 2 + 0.35 * j.across + wander);
    let hy = Math.sin(-Math.PI / 2 + 0.35 * j.across + wander);
    if (cursorOnPage && jelly.lure > 0) {
      const dx = cursorPosition.x - j.x;
      const dy = cursorPosition.y - j.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = jelly.lure * Math.min(1, Math.max(0, (d - 3 * R) / (4 * R)));
      hx = hx * (1 - k) + (dx / d) * k * 2;
      hy = hy * (1 - k) + (dy / d) * k * 2;
    }
    const margin = 2 * R;
    if (j.x < margin) hx += 3 * (1 - j.x / margin);
    if (j.x > w - margin) hx -= 3 * (1 - (w - j.x) / margin);
    if (j.y < margin * 1.5) hy += 3 * (1 - j.y / (margin * 1.5));
    if (j.y > h - margin) hy -= 3 * (1 - (h - j.y) / margin);
    j.angle += Math.max(-jelly.turn, Math.min(jelly.turn, jellyWrap(Math.atan2(hy, hx) - j.angle)));
    j.x = Math.max(-R, Math.min(w + R, j.x));
    j.y = Math.max(-R, Math.min(h + R, j.y));
    j.spin += 0.004;

    // The bell: squeezed, narrower and more domed, its rim curled in.
    const across = R * (1 - 0.22 * squeeze);
    const tall = R * (0.55 + 0.3 * squeeze);
    const curl = 0.05 + 0.22 * squeeze;
    const nx = -fy;
    const ny = fx;
    function at(along, side) {
      put(j.x + fx * along + nx * side, j.y + fy * along + ny * side);
    }
    function radius(s) {
      return across * Math.pow(Math.cos((s * Math.PI) / 2), 0.8) * (1 - curl * Math.pow(1 - s, 4));
    }
    function height(s) {
      return tall * Math.sin((s * Math.PI) / 2);
    }
    const tilt = jelly.tilt;
    // Its outline, either side.
    const steps = Math.max(8, Math.round(R / 3));
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      at(height(s), radius(s));
      if (i < steps) at(height(s), -radius(s));
    }
    // Its rim, an ellipse, the near side fuller.
    const rim = radius(0);
    const around = Math.max(16, Math.round(R * 0.9));
    for (let k = 0; k < around; k++) {
      const a = (k / around) * Math.PI * 2;
      if (Math.sin(a) < 0 && k % 2) continue;
      at(rim * Math.sin(a) * tilt, rim * Math.cos(a));
    }
    // The radial canals, and the gonads in its crown.
    for (let m = 0; m < 8; m++) {
      const a = j.spin + (m * Math.PI) / 4;
      const front = Math.sin(a) >= 0;
      for (let i = 1; i < steps; i += front ? 1 : 2) {
        const s = i / steps;
        const r = radius(s);
        at(height(s) + r * Math.sin(a) * tilt, r * Math.cos(a));
      }
    }
    for (let g = 0; g < 4; g++) {
      const a = j.spin + Math.PI / 4 + (g * Math.PI) / 2;
      if (Math.sin(a) < -0.3) continue;
      const r = radius(0.5);
      const ca = height(0.5) + r * Math.sin(a) * tilt;
      const cs = r * Math.cos(a) * 0.85;
      const ring = R * 0.17;
      const flat = Math.max(0.3, Math.abs(Math.sin(a)));
      for (let k = 0; k < 9; k++) {
        const b = (k / 10) * Math.PI * 2 + 0.3;
        at(ca + ring * 0.7 * Math.cos(b), cs + ring * flat * Math.sin(b));
      }
    }

    // The oral arms, from the middle of the bell, frilled.
    const back = Math.atan2(-fy, -fx);
    const arms = j.ax.length / JELLY_ARM_LINKS;
    const armLink = (jelly.armLength * R) / (JELLY_ARM_LINKS - 1);
    for (let k = 0; k < arms; k++) {
      const a = j.spin + (k * Math.PI * 2) / arms;
      const ox = rim * 0.15 * Math.cos(a);
      const oy = rim * 0.15 * Math.sin(a) * tilt + tall * 0.1;
      const from = k * JELLY_ARM_LINKS;
      const x0 = j.x + fx * oy + nx * ox;
      const y0 = j.y + fy * oy + ny * ox;
      const phase = time * 0.04 + k * 1.7;
      trail(j.ax, j.ay, j.aox, j.aoy, from, JELLY_ARM_LINKS, armLink, x0, y0, back, -0.12 * Math.cos(a), 0.25, phase);
      // Either edge of the arm's frill, widest near the bell.
      for (let m = from; m < from + JELLY_ARM_LINKS - 1; m++) {
        const dx = j.ax[m + 1] - j.ax[m];
        const dy = j.ay[m + 1] - j.ay[m];
        const d = Math.hypot(dx, dy) || 1;
        const px = -dy / d;
        const py = dx / d;
        const stepsA = Math.max(1, Math.round(d / gap));
        for (let s = 0; s < stepsA; s++) {
          const u = (m - from + s / stepsA) / (JELLY_ARM_LINKS - 1);
          const frill = R * 0.09 * (1 - 0.6 * u) * (0.6 + 0.4 * Math.sin(u * 14 + time * 0.07 + k));
          const x = j.ax[m] + (dx * s) / stepsA;
          const y = j.ay[m] + (dy * s) / stepsA;
          put(x + px * frill, y + py * frill);
          put(x - px * frill, y - py * frill);
        }
      }
    }

    // The tentacles, from round the rim.
    const T = j.reach.length;
    for (let k = 0; k < T; k++) {
      const a = j.spin + (k * Math.PI * 2) / T;
      const along = rim * Math.sin(a) * tilt;
      const side = rim * Math.cos(a);
      const from = k * JELLY_LINKS;
      const x0 = j.x + fx * along + nx * side;
      const y0 = j.y + fy * along + ny * side;
      const link = j.reach[k] / (JELLY_LINKS - 1);
      const phase = time * 0.06 + k * 1.3;
      trail(j.tx, j.ty, j.tox, j.toy, from, JELLY_LINKS, link, x0, y0, back, -0.35 * Math.cos(a), 0.45, phase);
      chain(j.tx, j.ty, from, JELLY_LINKS);
    }
  }

  // Marine snow, sinking slowly, carried by the water; what reaches the floor
  // starts again at the top.
  for (let i = 0; i < jellySnowX.length; i++) {
    flow(jellySnowX[i], jellySnowY[i]);
    jellySnowX[i] += flowX * 0.6 + (Math.random() - 0.5) * 0.15;
    jellySnowY[i] += jellySnowSink[i] + flowY * 0.6;
    if (jellySnowY[i] > h) {
      jellySnowY[i] = 0;
      jellySnowX[i] = Math.random() * w;
    }
    if (jellySnowX[i] < 0) jellySnowX[i] += w;
    else if (jellySnowX[i] > w) jellySnowX[i] -= w;
    put(jellySnowX[i], jellySnowY[i]);
  }
  while (next < n) put(-100, -100);
}

registerBackground("jellyfish", {
  start: startJellyfish,
  step: stepJellyfish,
  settings: jelly,
  archived: true,
});
