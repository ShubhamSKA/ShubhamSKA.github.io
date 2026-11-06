// The snake background, in development. Loaded after infinity.js, by the
// canvas lab only.

// ---- Snake -------------------------------------------------------------------
// A snake, seen from above, that follows the cursor about. It moves the way
// real snakes mostly do, by lateral undulation: the head swings from side to
// side as it goes, and the body follows exactly the path the head took, so
// the S-bends stay where the head made them and the snake slides along them.
// It heads for the cursor, slowing as it nears it, and once there it circles
// it rather than stopping, the body coiling round. The body is narrow behind
// the head, thickest a third of the way down, and tapers to a fine tail. Its
// back is covered in overlapping scales in staggered rows, each drawn by its
// free edge, the arc that points towards the tail; scales near the sides are
// foreshortened as the body curves away. A chain of diamonds runs down the
// back, picked out with extra dots, and a dot line marks each flank. The head
// is a little wider than the neck and eases into it, with large plates on
// top, eyes and nostrils.
// Dots: the head, the flanks, then the scales, as many to a scale
// as the dots allow; the rest are parked out of sight.
const snake = {
  length: 0.9, // share of the shorter side
  thickness: 0.013, // half the body's width at its thickest, share of the shorter side
  head: 2.6, // the head's length, in half-widths of the body
  speed: 3, // px per frame at most
  turn: 0.07, // rad per frame the head can turn
  slither: 0.55, // rad the head swings either side as it slithers
  wave: 0.35, // the slither's wavelength, share of the snake's length
  coil: 70, // px from the cursor where it starts to circle rather than close in
  scaleLength: 0.5, // between rows of scales, in half-widths of the body
  scaleWidth: 0.42, // across a scale, in half-widths of the body
  pattern: 3.6, // between the diamonds down its back, in half-widths of the body
};

let snakePathX = []; // where the head has been, oldest first
let snakePathY = [];
let snakeHeadState = { x: 0, y: 0, angle: 0, speed: 0, phase: 0, circle: 1 };
let snakeTime = 0;
let snakePerScale = 5;
// The spine, sampled every px from the snout back: position, and the unit
// vector pointing forwards.
let snakeSX = new Float32Array(0);
let snakeSY = new Float32Array(0);
let snakeTX = new Float32Array(0);
let snakeTY = new Float32Array(0);

function snakeSizes() {
  const side = Math.min(canvas.width, canvas.height);
  const thick = snake.thickness * side;
  return {
    length: Math.max(60, snake.length * side),
    thick,
    head: snake.head * thick,
    scaleLength: Math.max(2, snake.scaleLength * thick),
    scaleWidth: Math.max(2, snake.scaleWidth * thick),
    pattern: Math.max(4, snake.pattern * thick),
  };
}

// Half the body's width `s` of the way from the neck to the tail tip, as a
// share of the thickest.
function snakeGirth(s) {
  const ramp = function (a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  if (s < 0.55) return 0.74 + 0.26 * ramp(0, 0.3, s);
  return Math.max(0, 1 - Math.pow(ramp(0.55, 1, s), 0.85));
}

// Half the head's width `u` of the way from the snout to the neck, as a share
// of the body's thickest: a rounded snout, widest by the eyes, easing in to
// the neck, just as wide as the body there, and no steeper where they meet
// than the body is, so the head flows into it.
function snakeHeadWidth(u) {
  const widest = 0.92;
  const neck = snakeGirth(0);
  if (u < 0.62) {
    const k = (0.62 - u) / 0.62;
    return widest * Math.sqrt(Math.max(0, 1 - k * k));
  }
  const k = Math.min(1, (u - 0.62) / 0.38);
  return neck + (widest - neck) * (1 - k * k * (3 - 2 * k));
}

function snakeTarget() {
  if (cursorOnPage) return { x: cursorPosition.x, y: cursorPosition.y };
  const t = snakeTime;
  return {
    x: canvas.width * (0.5 + 0.35 * Math.sin(t * 0.0047)),
    y: canvas.height * (0.5 + 0.32 * Math.sin(t * 0.0061 + 1.3)),
  };
}

function startSnake() {
  const sizes = snakeSizes();
  snakeTime = 0;
  const angle = Math.random() * Math.PI * 2;
  const start = snakeTarget();
  snakeHeadState = { x: start.x, y: start.y, angle, speed: 0, phase: 0, circle: Math.random() < 0.5 ? -1 : 1 };
  // A straight snake to begin with, lying back from the head.
  snakePathX = [];
  snakePathY = [];
  for (let d = sizes.length + 20; d >= 0; d -= 2) {
    snakePathX.push(start.x - Math.cos(angle) * d);
    snakePathY.push(start.y - Math.sin(angle) * d);
  }
  const samples = Math.ceil(sizes.length) + 2;
  snakeSX = new Float32Array(samples);
  snakeSY = new Float32Array(samples);
  snakeTX = new Float32Array(samples);
  snakeTY = new Float32Array(samples);
  // As many dots to a scale as the dots go round.
  let scales = 0;
  for (let a = sizes.head + sizes.scaleLength / 2; a < sizes.length - 2; a += sizes.scaleLength) {
    const r = sizes.thick * snakeGirth((a - sizes.head) / (sizes.length - sizes.head));
    scales += Math.max(1, Math.round((2 * r * 0.95) / sizes.scaleWidth));
  }
  const flanks = (2 * sizes.length) / 3;
  const spare = whiteElements.length - flanks - 320;
  snakePerScale = Math.max(3, Math.min(8, Math.floor(spare / (scales * 1.12))));
}

// Samples the head's path every px from the snout back, into the spine.
function snakeSpine(length) {
  const px = snakePathX;
  const py = snakePathY;
  let k = px.length - 1;
  let done = 0; // length of path walked up to point k
  const count = Math.min(snakeSX.length, Math.ceil(length) + 2);
  snakeSX[0] = px[k];
  snakeSY[0] = py[k];
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
      snakeSX[d] = px[k] + (px[k - 1] - px[k]) * t;
      snakeSY[d] = py[k] + (py[k - 1] - py[k]) * t;
    } else {
      // Past the oldest point: on in a straight line.
      snakeSX[d] = 2 * snakeSX[d - 1] - snakeSX[d - 2 >= 0 ? d - 2 : 0];
      snakeSY[d] = 2 * snakeSY[d - 1] - snakeSY[d - 2 >= 0 ? d - 2 : 0];
    }
  }
  for (let d = 0; d < count; d++) {
    const a = Math.max(0, d - 2);
    const b = Math.min(count - 1, d + 2);
    const tx = snakeSX[a] - snakeSX[b];
    const ty = snakeSY[a] - snakeSY[b];
    const t = Math.hypot(tx, ty) || 1;
    snakeTX[d] = tx / t;
    snakeTY[d] = ty / t;
  }
  // Drop what the tail has left behind.
  if (k > 2) {
    snakePathX.splice(0, k - 2);
    snakePathY.splice(0, k - 2);
  }
}

function stepSnake() {
  const n = whiteElements.length;
  const sizes = snakeSizes();
  const L = Math.min(sizes.length, snakeSX.length - 2);
  snakeTime++;

  // The head: towards the cursor, swinging side to side, circling it once there.
  const head = snakeHeadState;
  const target = snakeTarget();
  const dx = target.x - head.x;
  const dy = target.y - head.y;
  const dist = Math.hypot(dx, dy);
  let aim = Math.atan2(dy, dx);
  if (dist < snake.coil) aim += head.circle * (Math.PI / 2) * (1 - dist / snake.coil) * 1.2;
  const swing = snake.slither * Math.max(0.3, Math.min(1, dist / (snake.coil * 2)));
  const want = aim + swing * Math.sin(head.phase);
  let turn = want - head.angle;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  head.angle += Math.max(-snake.turn, Math.min(snake.turn, turn));
  const pace = snake.speed * Math.max(0.35, Math.min(1, dist / 150));
  head.speed += (pace - head.speed) * 0.05;
  head.phase += (Math.PI * 2 * head.speed) / Math.max(1, snake.wave * L);
  head.x += Math.cos(head.angle) * head.speed;
  head.y += Math.sin(head.angle) * head.speed;
  const last = snakePathX.length - 1;
  if (Math.hypot(head.x - snakePathX[last], head.y - snakePathY[last]) >= 1) {
    snakePathX.push(head.x);
    snakePathY.push(head.y);
  }
  snakeSpine(L);

  // ---- Laying out the dots ----
  let next = 0;
  function put(x, y) {
    if (next >= n) return;
    const e = whiteElements[next++];
    e.x = x;
    e.y = y;
  }
  // A point `along` px forwards and `across` px to the left of the spine at
  // `a` px from the snout.
  function at(a, along, across) {
    const d = Math.max(0, Math.min(L, Math.round(a)));
    const tx = snakeTX[d];
    const ty = snakeTY[d];
    put(snakeSX[d] + tx * along - ty * across, snakeSY[d] + ty * along + tx * across);
  }
  const thick = sizes.thick;
  const headLength = sizes.head;

  // The head: outline, plates, eyes and nostrils.
  for (let a = 0; a <= headLength; a += 1.5) {
    const hw = thick * snakeHeadWidth(a / headLength);
    at(a, 0, hw);
    at(a, 0, -hw);
  }
  const plates = [
    [0.22, [0]],
    [0.4, [-0.4, 0.4]],
    [0.6, [-0.42, 0, 0.42]],
    [0.82, [-0.38, 0.38]],
  ];
  for (const [u, columns] of plates) {
    const a = u * headLength;
    const hw = thick * snakeHeadWidth(u);
    for (const v of columns) {
      for (let k = 0; k < 5; k++) {
        const t = (k / 4) * 2 - 1;
        at(a + (1 - t * t) * headLength * 0.08, -headLength * 0.04, v * hw + t * hw * 0.22);
      }
    }
  }
  for (const side of [-1, 1]) {
    const a = 0.46 * headLength;
    const hw = thick * snakeHeadWidth(0.46);
    for (let k = 0; k < 8; k++) {
      const angle = (k / 8) * Math.PI * 2;
      at(a + Math.cos(angle) * 2.3, 0, side * hw * 0.74 + Math.sin(angle) * 2.3);
    }
    // A slit pupil.
    at(a - 0.8, 0, side * hw * 0.74);
    at(a + 0.8, 0, side * hw * 0.74);
    at(0.1 * headLength, 0, side * thick * snakeHeadWidth(0.1) * 0.45);
  }

  // The flanks.
  const body = L - headLength;
  for (let a = headLength; a < L; a += 3) {
    const r = thick * snakeGirth((a - headLength) / body);
    at(a, 0, r);
    at(a, 0, -r);
  }

  // The scales, row on row, staggered, each its free edge; diamonds down the back.
  const K = snakePerScale;
  const scaleLength = sizes.scaleLength;
  const scaleWidth = sizes.scaleWidth;
  let row = 0;
  for (let a = headLength + scaleLength / 2; a < L - 2; a += scaleLength, row++) {
    const s = (a - headLength) / body;
    const r = thick * snakeGirth(s);
    const count = Math.max(1, Math.round((2 * r * 0.95) / scaleWidth));
    const offset = row % 2 ? 0.5 : 0;
    const q = ((a - headLength) / sizes.pattern) % 1;
    for (let j = 0; j < count + (offset ? 1 : 0); j++) {
      const v = ((j + 0.5 - offset) / count) * 2 - 1;
      if (Math.abs(v) > 1) continue;
      // Round the curve of the back: scales by the flanks are seen edge on.
      const phi = v * (Math.PI / 2) * 0.92;
      const across = r * Math.sin(phi);
      const narrow = Math.cos(phi);
      for (let k = 0; k < K; k++) {
        const t = (k / (K - 1)) * 2 - 1;
        at(a, scaleLength * (0.25 - 0.55 * (1 - t * t)), across + t * scaleWidth * 0.5 * narrow);
      }
      // On the outline of a diamond: filled in.
      const diamond = (1 - Math.abs(2 * q - 1)) * 0.85;
      if (Math.abs(Math.abs(v) - diamond) < 0.2) {
        at(a, 0, across);
        at(a, scaleLength * 0.2, across);
      }
    }
  }
  while (next < n) put(-100, -100);
}

registerBackground("snake", {
  start: startSnake,
  step: stepSnake,
  settings: snake,
  lab: true,
});

