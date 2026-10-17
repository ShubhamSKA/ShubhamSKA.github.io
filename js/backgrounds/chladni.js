// The Chladni plate background. Loaded after infinity.js.

// ---- Chladni plate ---------------------------------------------------------
// Sand on a vibrating plate collects along the lines that stay still. The
// figure is a square plate's, centred on the cursor and `size` across, but
// with no edge: it carries on over the whole screen while the sand thins out
// away from the cursor. Each grain is shaken in proportion to how much the
// plate moves under it and slides towards the nearest still ground, so the
// sand gathers on the nodal lines and keeps trembling there. The shape for
// mode (n, m) is the classic cos(n pi u) cos(m pi v) - cos(m pi u) cos(n pi v),
// which is always still at the plate's centre, so a line of sand always runs
// through the cursor. Where the cursor sits on the screen picks the mode:
// across sets n, down sets m, and the figure melts from the old one into the
// new. A steady trickle of grains is thrown back on at a distance from the
// cursor picked evenly between nothing and `spread`; spread over rings that
// grow with distance, that thins the sand as 1 / distance, so the figure is
// crisp round the cursor and fades out rather than stopping at an edge, and
// sand left behind when the cursor moves drifts away over a few seconds.
// With no cursor the figure sits mid-screen and changes mode now and then.
const chladni = {
  size: 0.45, // the plate's side, as a share of the screen's shorter side;
  //             sets how big the figure's cells are
  spread: 0.55, // how far out sand is thrown, share of the screen's diagonal
  modes: [1, 8], // lowest and highest n or m the cursor can pick
  shake: 1.6, // px a grain jitters where the plate moves most
  rattle: 0.3, // px it jitters even on a still line, so it spreads along it
  sprinkle: 0.006, // share of the sand thrown on afresh each frame
  settle: 0.8, // px per frame a grain slides towards still ground
  morph: 90, // frames to melt from one figure to the next
  idleChange: 480, // frames between figures when there is no cursor
};

let chladniFrom = { n: 1, m: 2 };
let chladniTo = { n: 1, m: 2 };
let chladniBlend = 1; // 0 = all `from`, 1 = all `to`
let chladniIdle = 0;

// The plate's displacement and its gradient (per px) at plate coordinates
// (u, v), each 0 to 1, for one mode, added into plateAt with a weight.
const plateAt = { f: 0, gu: 0, gv: 0 };
function plate(mode, u, v, weight) {
  const { n, m } = mode;
  const pu = Math.PI * u;
  const pv = Math.PI * v;
  const cnu = Math.cos(n * pu), snu = Math.sin(n * pu);
  const cmu = Math.cos(m * pu), smu = Math.sin(m * pu);
  const cmv = Math.cos(m * pv), smv = Math.sin(m * pv);
  const cnv = Math.cos(n * pv), snv = Math.sin(n * pv);
  plateAt.f += weight * (cnu * cmv - cmu * cnv);
  plateAt.gu += weight * Math.PI * (-n * snu * cmv + m * smu * cnv);
  plateAt.gv += weight * Math.PI * (-m * cnu * smv + n * cmu * snv);
}

function pickMode(n, m) {
  // n = m has no still lines worth the name: the shape vanishes everywhere.
  if (n === m) m = m < chladni.modes[1] ? m + 1 : m - 1;
  if (n === chladniTo.n && m === chladniTo.m) return;
  // Start from wherever the melt had got to.
  chladniFrom = chladniBlend < 0.5 ? chladniFrom : chladniTo;
  chladniTo = { n, m };
  chladniBlend = 0;
}

function startChladni() {
  chladniFrom = { n: 1, m: 2 };
  chladniTo = { n: 2, m: 3 };
  chladniBlend = 0;
  chladniIdle = 0;
}

function stepChladni() {
  const w = canvas.width;
  const h = canvas.height;
  const size = chladni.size * Math.min(w, h);
  const cx = cursorOnPage ? cursorPosition.x : w / 2;
  const cy = cursorOnPage ? cursorPosition.y : h / 2;
  const left = cx - size / 2;
  const top = cy - size / 2;
  const [low, high] = chladni.modes;
  const count = high - low + 1;
  if (cursorOnPage) {
    const n = low + Math.min(count - 1, Math.floor((cx / w) * count));
    const m = low + Math.min(count - 1, Math.floor((cy / h) * count));
    pickMode(n, m);
  } else if (++chladniIdle > chladni.idleChange) {
    chladniIdle = 0;
    pickMode(low + Math.floor(Math.random() * count), low + Math.floor(Math.random() * count));
  }
  chladniBlend = Math.min(1, chladniBlend + 1 / chladni.morph);
  // Smooth in and out of the melt.
  const b = chladniBlend * chladniBlend * (3 - 2 * chladniBlend);

  const spread = chladni.spread * Math.hypot(w, h);
  for (let i = 0; i < whiteElements.length; i++) {
    const e = whiteElements[i];
    const offScreen = e.x < 0 || e.x > w || e.y < 0 || e.y > h;
    if (offScreen || Math.random() < chladni.sprinkle) {
      // Thrown back on: an even distance out, in any direction, on screen.
      for (let tries = 0; tries < 8; tries++) {
        const r = Math.random() * spread;
        const a = Math.random() * Math.PI * 2;
        e.x = cx + Math.cos(a) * r;
        e.y = cy + Math.sin(a) * r;
        if (e.x >= 0 && e.x <= w && e.y >= 0 && e.y <= h) break;
      }
    }
    const u = (e.x - left) / size;
    const v = (e.y - top) / size;
    plateAt.f = 0;
    plateAt.gu = 0;
    plateAt.gv = 0;
    plate(chladniFrom, u, v, 1 - b);
    plate(chladniTo, u, v, b);
    const f = plateAt.f;
    const gx = plateAt.gu / size;
    const gy = plateAt.gv / size;
    const g = Math.hypot(gx, gy) || 1e-6;
    const jitter = chladni.shake * Math.min(1, Math.abs(f) / 2) + chladni.rattle;
    // Downhill on f squared, at a steady pace, easing off near the line.
    const slide = Math.min(chladni.settle, Math.abs(f) / g);
    const dir = f > 0 ? -1 : 1;
    e.x += (dir * gx * slide) / g + (Math.random() - 0.5) * 2 * jitter;
    e.y += (dir * gy * slide) / g + (Math.random() - 0.5) * 2 * jitter;
  }
}

registerBackground("chladni", {
  start: startChladni,
  step: stepChladni,
  settings: chladni,
});
