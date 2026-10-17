// The magnetic field lines background. Loaded after infinity.js.

// ---- Magnetic field lines --------------------------------------------------
// A few bar magnets, one of them the cursor. The dots are iron filings set
// moving: each one travels along the field, out of a north pole and round into
// a south pole, so the lines are drawn by what flows along them and never sit
// still. Dots leave each pole along a fixed fan of lines, so they keep tracing
// the same lines rather than filling the screen with haze. The cursor's magnet turns slowly on its own and swings to point the way
// the mouse moves; the others wander about the screen, turning as they go, so
// the whole field keeps shifting even when the mouse is still.
const magnet = {
  speed: 1.6, // px per frame along the field
  core: 3, // px: a dot this close to a magnet's centre has arrived; small, so
  //           no empty ring shows round the magnet
  lifetime: 360, // frames, on average, before a dot starts again anyway
  fromPoles: 0.92, // share of new dots that leave from a north pole
  lines: 14, // field lines leaving each north pole
  poleSpread: 1.2, // rad either side of the north pole they fan across
  spin: 0.004, // rad per frame the cursor's magnet turns by itself
  steer: 0.08, // how quickly it swings towards the mouse's heading
  others: 2, // magnets besides the cursor's
  otherStrength: 0.7, // their strength, the cursor's being 1
  wander: 0.0008, // how fast they wander
};

let magnets = []; // { x, y, angle, strength }
let magnetAge = new Float32Array(0);
let magnetLife = new Float32Array(0);
let magnetTime = 0;
let magnetLastX = 0;
let magnetLastY = 0;

function placeMagnets() {
  const w = canvas.width;
  const h = canvas.height;
  if (magnets.length !== magnet.others + 1) {
    magnets = [{ x: w / 2, y: h / 2, angle: 0, strength: 1 }];
    for (let k = 0; k < magnet.others; k++) {
      magnets.push({ x: 0, y: 0, angle: Math.random() * Math.PI * 2, strength: magnet.otherStrength });
    }
  }
  // The cursor's magnet sits on the cursor, or mid-screen without one.
  const main = magnets[0];
  if (cursorOnPage) {
    const dx = cursorPosition.x - magnetLastX;
    const dy = cursorPosition.y - magnetLastY;
    if (dx * dx + dy * dy > 4) {
      let turn = Math.atan2(dy, dx) - main.angle;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      main.angle += turn * magnet.steer;
    }
    main.x = cursorPosition.x;
    main.y = cursorPosition.y;
    magnetLastX = cursorPosition.x;
    magnetLastY = cursorPosition.y;
  } else {
    main.x = w / 2;
    main.y = h / 2;
  }
  main.angle += magnet.spin;
  // The others trace slow, different Lissajous paths.
  for (let k = 1; k < magnets.length; k++) {
    const m = magnets[k];
    const phase = magnetTime * magnet.wander * (1 + k * 0.37);
    m.x = w / 2 + w * 0.36 * Math.sin(phase * 1.3 + k * 2.1);
    m.y = h / 2 + h * 0.34 * Math.sin(phase * 1.7 + k * 4.2);
    m.angle += magnet.spin * (k % 2 ? -0.7 : 0.9);
    m.strength = magnet.otherStrength;
  }
  main.strength = 1;
}

// The field at (x, y): the sum of each magnet's dipole field,
// (3 (m . r) r / r^5 - m / r^3). Returns it in magnetField.
const magnetField = { x: 0, y: 0 };
function fieldAt(x, y) {
  let bx = 0;
  let by = 0;
  for (const m of magnets) {
    const rx = x - m.x;
    const ry = y - m.y;
    const r2 = Math.max(rx * rx + ry * ry, 1);
    const r = Math.sqrt(r2);
    const mx = Math.cos(m.angle) * m.strength;
    const my = Math.sin(m.angle) * m.strength;
    const mr = (mx * rx + my * ry) / r;
    const r3 = r2 * r;
    bx += (3 * mr * (rx / r) - mx) / r3;
    by += (3 * mr * (ry / r) - my) / r3;
  }
  magnetField.x = bx;
  magnetField.y = by;
}

function respawnFiling(i) {
  const e = whiteElements[i];
  if (Math.random() < magnet.fromPoles) {
    // Just outside a north pole, pointing out of it.
    const m = magnets[Math.floor(Math.random() * magnets.length)];
    const line = Math.floor(Math.random() * magnet.lines);
    const a = m.angle + ((line + 0.5) / magnet.lines * 2 - 1) * magnet.poleSpread + (Math.random() - 0.5) * 0.02;
    const r = magnet.core + 1;
    e.x = m.x + Math.cos(a) * r;
    e.y = m.y + Math.sin(a) * r;
  } else {
    e.x = Math.random() * canvas.width;
    e.y = Math.random() * canvas.height;
  }
  magnetAge[i] = 0;
  magnetLife[i] = magnet.lifetime * (0.4 + Math.random() * 1.2);
}

function startMagnet() {
  const n = whiteElements.length;
  magnets = [];
  magnetTime = Math.random() * 10000;
  magnetLastX = cursorPosition.x;
  magnetLastY = cursorPosition.y;
  placeMagnets();
  magnetAge = new Float32Array(n);
  magnetLife = new Float32Array(n);
  // Everyone starts flowing from where the pattern left them, and is replaced
  // over the first few seconds.
  for (let i = 0; i < n; i++) magnetLife[i] = magnet.lifetime * Math.random();
}

function stepMagnet() {
  const w = canvas.width;
  const h = canvas.height;
  magnetTime++;
  placeMagnets();
  const core2 = magnet.core * magnet.core;
  for (let i = 0; i < whiteElements.length; i++) {
    const e = whiteElements[i];
    magnetAge[i]++;
    let arrived = magnetAge[i] > magnetLife[i] || e.x < -20 || e.x > w + 20 || e.y < -20 || e.y > h + 20;
    for (let k = 0; !arrived && k < magnets.length; k++) {
      const dx = e.x - magnets[k].x;
      const dy = e.y - magnets[k].y;
      if (dx * dx + dy * dy < core2) arrived = true;
    }
    if (arrived) {
      respawnFiling(i);
      continue;
    }
    fieldAt(e.x, e.y);
    const b = Math.hypot(magnetField.x, magnetField.y);
    if (b === 0) continue;
    e.x += (magnetField.x / b) * magnet.speed;
    e.y += (magnetField.y / b) * magnet.speed;
  }
}

registerBackground("magnet", {
  start: startMagnet,
  step: stepMagnet,
  settings: magnet,
});
