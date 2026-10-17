// The dandelions background. Loaded after infinity.js.

// ---- Dandelions in the wind ------------------------------------------------
// Seed heads on stems along the bottom of the screen, swaying in a gusty wind:
// a breeze that slowly changes direction and strength, with swirls riding on
// it. Gusts pluck seeds off. The cursor breathes: it blows outwards all the
// time, with a twist, so loose seeds whirl round it and keep clear of it, and
// heads near it bow away and shed; moving the mouse blows a puff along its
// path on top. Loose seeds are also drawn gently towards the cursor, so the
// breath and the pull between them keep a swirl of seeds circling it. Each
// seed catches the wind a little differently and flutters on its own; seeds
// that all moved alike ran together into a single thread. A loose seed drifts as a little parachute, a tuft with the seed
// hanging under it, and once it leaves the screen it waits, parked out of
// sight, until its head has gone bald and grows back.
// Dots: a few dozen per stem; the rest split evenly into seeds of a few dots.
const dandelion = {
  heads: 5,
  stemDots: 50,
  seedDots: 5, // tuft and stalk
  headSize: 0.06, // radius, as a share of the shorter side
  stemHeight: [0.35, 0.4], // share of the height
  breeze: 0.9, // px per frame of wind, on average
  gusts: 0.8, // how much the wind's strength swings
  swirl: 0.5, // px per frame of swirling on top
  pluck: 0.0012, // chance per frame a seed lets go in the plain breeze; it
  //                grows with the square of the wind there
  breath: 1, // px per frame the cursor blows outwards, right next to it
  breathReach: 220, // px
  breathTwist: 0.7, // how much of the breath swirls round rather than out
  seedPull: 0.8, // how fast loose seeds drift towards the cursor, as a share of
  //               the breeze; kept under 1 so the wind still has the upper hand
  catchWind: [0.025, 0.08], // how readily a seed takes up the wind, least to most
  flutter: 0.12, // px per frame per frame of a seed's own random tumbling
  mouseWind: 0.35, // how much of the mouse's motion becomes wind
  mouseReach: 120, // px
  regrow: 400, // frames a bald head waits before growing back
  growTime: 180, // frames it takes to grow back
  sink: 0.012, // px per frame per frame: seeds fall slowly
};

let dandelionTime = 0;
let dandelionHeads = []; // { x, height, phase, bald, grown }
let dandelionSeeds = []; // { head, dx, dy, length, free, x, y, vx, vy, parked }
let dandelionMouse = { x: 0, y: 0, vx: 0, vy: 0 };

// The wind at (x, y) now: a slowly turning breeze, its gusts, a few swirls,
// and the puff the mouse leaves behind.
const dandelionWind = { x: 0, y: 0 };
function windAt(x, y) {
  const t = dandelionTime;
  const gust = 1 + dandelion.gusts * Math.sin(t * 0.007) * Math.sin(t * 0.0031 + 1);
  const heading = -0.15 + 0.35 * Math.sin(t * 0.0013);
  let wx = Math.cos(heading) * dandelion.breeze * gust;
  let wy = Math.sin(heading) * dandelion.breeze * gust;
  wx += dandelion.swirl * Math.sin(y * 0.011 + t * 0.021) * gust;
  wy += dandelion.swirl * Math.cos(x * 0.009 - t * 0.017) * gust;
  const m = dandelionMouse;
  const d2 = (x - m.x) ** 2 + (y - m.y) ** 2;
  const reach2 = dandelion.mouseReach * dandelion.mouseReach;
  if (cursorOnPage && d2 < reach2) {
    const fall = 1 - d2 / reach2;
    wx += m.vx * dandelion.mouseWind * fall;
    wy += m.vy * dandelion.mouseWind * fall;
  }
  // The breath: outwards and round, strongest right at the cursor.
  const breathReach2 = dandelion.breathReach * dandelion.breathReach;
  if (cursorOnPage && d2 < breathReach2 && d2 > 1) {
    const d = Math.sqrt(d2);
    const fall = 1 - d / dandelion.breathReach;
    const blow = dandelion.breath * fall * fall;
    const ox = (x - m.x) / d;
    const oy = (y - m.y) / d;
    wx += blow * (ox - oy * dandelion.breathTwist);
    wy += blow * (oy + ox * dandelion.breathTwist);
  }
  dandelionWind.x = wx;
  dandelionWind.y = wy;
  return gust;
}

function headCentre(head) {
  const h = canvas.height;
  windAt(head.x, h - head.height);
  // The stem bows with the wind it feels at the top.
  const sway = Math.max(-0.5, Math.min(0.5, dandelionWind.x * 0.18 + 0.05 * Math.sin(dandelionTime * 0.03 + head.phase)));
  return {
    x: head.x + Math.sin(sway) * head.height,
    y: h - Math.cos(sway) * head.height,
    sway,
  };
}

function startDandelion() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  dandelionTime = Math.random() * 10000;
  dandelionHeads = [];
  for (let k = 0; k < dandelion.heads; k++) {
    const [low, high] = dandelion.stemHeight;
    dandelionHeads.push({
      x: w * (k + 0.5 + (Math.random() - 0.5) * 0.5) / dandelion.heads,
      height: h * (low + Math.random() * (high - low)),
      phase: Math.random() * 6,
      bald: 0,
      grown: 1,
    });
  }
  const seedDotsTotal = n - dandelion.heads * dandelion.stemDots;
  const seeds = Math.floor(seedDotsTotal / dandelion.seedDots);
  dandelionSeeds = [];
  for (let s = 0; s < seeds; s++) {
    const angle = Math.random() * Math.PI * 2;
    dandelionSeeds.push({
      head: s % dandelion.heads,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      length: 0.8 + Math.random() * 0.2,
      free: false,
      parked: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    });
  }
  dandelionMouse = { x: cursorPosition.x, y: cursorPosition.y, vx: 0, vy: 0 };
}

function stepDandelion() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  dandelionTime++;

  // The mouse's own speed, smoothed, is the puff it blows.
  const m = dandelionMouse;
  m.vx = m.vx * 0.8 + (cursorPosition.x - m.x) * 0.2;
  m.vy = m.vy * 0.8 + (cursorPosition.y - m.y) * 0.2;
  m.x = cursorPosition.x;
  m.y = cursorPosition.y;

  const centres = dandelionHeads.map(headCentre);
  const attached = new Int32Array(dandelionHeads.length);
  const total = new Int32Array(dandelionHeads.length);

  let dot = 0;
  // Stems: a gentle curve from the ground to the head.
  dandelionHeads.forEach(function (head, k) {
    const c = centres[k];
    for (let s = 0; s < dandelion.stemDots; s++, dot++) {
      const f = s / (dandelion.stemDots - 1);
      const bend = f * f; // stiff at the root, bending towards the top
      const e = whiteElements[dot];
      e.x = head.x + (c.x - head.x) * bend;
      e.y = h - (h - c.y) * f;
    }
  });

  for (const seed of dandelionSeeds) {
    const head = dandelionHeads[seed.head];
    const c = centres[seed.head];
    total[seed.head]++;
    if (!seed.free) {
      attached[seed.head]++;
      const r = dandelion.headSize * side * seed.length * head.grown;
      windAt(c.x + seed.dx * r, c.y + seed.dy * r);
      // Let go in strong wind, gust or breath, more readily on the side the
      // wind comes from.
      const strength = Math.hypot(dandelionWind.x, dandelionWind.y) / dandelion.breeze;
      const facing = -(seed.dx * dandelionWind.x + seed.dy * dandelionWind.y) / (strength * dandelion.breeze || 1);
      const exposed = 1 + 0.5 * facing;
      if (head.grown >= 1 && Math.random() < dandelion.pluck * strength * strength * exposed) {
        seed.free = true;
        const [least, most] = dandelion.catchWind;
        seed.catch = least + Math.random() * (most - least);
        seed.x = c.x + seed.dx * r;
        seed.y = c.y + seed.dy * r;
        seed.vx = dandelionWind.x;
        seed.vy = dandelionWind.y - 0.3;
      }
    }
    if (seed.free && !seed.parked) {
      windAt(seed.x, seed.y);
      // The seed settles towards the wind's speed plus a drift to the cursor.
      let towardX = dandelionWind.x;
      let towardY = dandelionWind.y;
      if (cursorOnPage) {
        const dx = cursorPosition.x - seed.x;
        const dy = cursorPosition.y - seed.y;
        const d = Math.hypot(dx, dy) || 1;
        const drift = dandelion.seedPull * dandelion.breeze;
        towardX += (dx / d) * drift;
        towardY += (dy / d) * drift;
      }
      const take = seed.catch || 0.05;
      seed.vx += (towardX - seed.vx) * take + (Math.random() - 0.5) * dandelion.flutter;
      seed.vy += (towardY - seed.vy) * take + dandelion.sink + (Math.random() - 0.5) * dandelion.flutter;
      seed.x += seed.vx;
      seed.y += seed.vy;
      if (seed.x < -30 || seed.x > w + 30 || seed.y < -30 || seed.y > h + 10) seed.parked = true;
    }

    // Its dots: on the head, a line out from the centre; loose, a tuft with
    // the seed hanging below; parked, out of sight.
    for (let k = 0; k < dandelion.seedDots; k++, dot++) {
      const e = whiteElements[dot];
      if (seed.parked) {
        e.x = -100;
        e.y = -100;
      } else if (!seed.free) {
        const r = dandelion.headSize * side * seed.length * head.grown;
        const along = 0.25 + (0.75 * k) / (dandelion.seedDots - 1);
        e.x = c.x + seed.dx * r * along;
        e.y = c.y + seed.dy * r * along;
      } else if (k < 3) {
        e.x = seed.x + (k - 1) * 2.5;
        e.y = seed.y - (k === 1 ? 1 : 0);
      } else {
        e.x = seed.x;
        e.y = seed.y + (k - 2) * 3;
      }
    }
  }
  // Any dots left over sit out of sight.
  for (; dot < n; dot++) {
    whiteElements[dot].x = -100;
    whiteElements[dot].y = -100;
  }

  // Bald heads wait, then grow back from every seed that has gone.
  dandelionHeads.forEach(function (head, k) {
    if (head.grown < 1) {
      head.grown = Math.min(1, head.grown + 1 / dandelion.growTime);
      return;
    }
    if (attached[k] > total[k] * 0.1) {
      head.bald = 0;
      return;
    }
    head.bald++;
    if (head.bald < dandelion.regrow) return;
    head.bald = 0;
    head.grown = 0;
    for (const seed of dandelionSeeds) {
      if (seed.head === k && seed.parked) {
        seed.free = false;
        seed.parked = false;
      }
    }
  });
}

registerBackground("dandelion", {
  start: startDandelion,
  step: stepDandelion,
  settings: dandelion,
});
