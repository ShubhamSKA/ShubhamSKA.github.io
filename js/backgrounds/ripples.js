// The ripples background. Loaded after infinity.js.

// ---- Ripples ---------------------------------------------------------------
// The cursor bobs on the water like a float and sends out a ring every so
// often, and the dots are the rings: each ring has a fixed share of them, spaced
// round it. A ring keeps the centre it was born at, so a cursor sitting still
// draws even concentric circles, and a moving one crowds the rings ahead of it
// and spreads them out behind (Doppler). Scrolling carries the water, and every
// ring on it, along with the page, which moves the float through the water just
// the same. Once a ring has grown to full size its dots go back to the float to
// make the next one.
const ripple = {
  speed: 2.5, // px per frame a ring travels
  period: 40, // frames between rings
  reach: 0.6, // how big a ring grows, as a share of the screen diagonal
  roughness: 1.5, // px: dots sit this far either side of the line, at most
  frame: 0,
  rings: [], // one per share of dots: { x, y, born }
  angle: new Float32Array(0),
  offset: new Float32Array(0),
  scrolled: 0,
};

let lastScrollY = window.scrollY;
window.addEventListener(
  "scroll",
  function () {
    ripple.scrolled += window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
  },
  { passive: true }
);

function rippleSource() {
  // The float is the cursor, or the middle of the screen without one.
  return cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: canvas.width / 2, y: canvas.height / 2 };
}

function startRipples() {
  const n = whiteElements.length;
  const w = canvas.width;
  const h = canvas.height;
  const lifetime = (ripple.reach * Math.sqrt(w * w + h * h)) / ripple.speed;
  const count = Math.max(1, Math.ceil(lifetime / ripple.period));
  const perRing = Math.ceil(n / count);

  // Start as if the float had been bobbing for a while, so every ring is
  // already out and the curve has something to settle into.
  const source = rippleSource();
  ripple.frame = 0;
  ripple.rings = [];
  for (let k = 0; k < count; k++) {
    ripple.rings.push({ x: source.x, y: source.y, born: -k * ripple.period });
  }
  ripple.angle = new Float32Array(n);
  ripple.offset = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const place = Math.floor(i / count);
    ripple.angle[i] = ((place + Math.random() * 0.5) / perRing) * Math.PI * 2;
    ripple.offset[i] = (Math.random() * 2 - 1) * ripple.roughness;
  }
  ripple.scrolled = 0;
}

function stepRipples() {
  const rings = ripple.rings;
  const count = rings.length;
  const lifetime = count * ripple.period;
  ripple.frame++;

  // Scrolling down slides the page, and the water with it, up the screen.
  if (ripple.scrolled !== 0) {
    for (const ring of rings) ring.y -= ripple.scrolled;
    ripple.scrolled = 0;
  }

  // The oldest ring goes back to the float to start again.
  const reborn = [];
  for (let k = 0; k < count; k++) {
    if (ripple.frame - rings[k].born >= lifetime) {
      const source = rippleSource();
      rings[k] = { x: source.x, y: source.y, born: ripple.frame };
      reborn.push(k);
    }
  }
  const radius = rings.map(function (ring) {
    return (ripple.frame - ring.born) * ripple.speed;
  });

  // Dots drift onto their rings at first, then ride them exactly. A reborn
  // ring's dots jump straight back to the float rather than flying across.
  const ease = Math.min(1, 0.03 + ripple.frame * 0.0015);
  for (let i = 0; i < whiteElements.length; i++) {
    const k = i % count;
    const ring = rings[k];
    const r = radius[k] + ripple.offset[i];
    const tx = ring.x + Math.cos(ripple.angle[i]) * r;
    const ty = ring.y + Math.sin(ripple.angle[i]) * r;
    const e = whiteElements[i];
    if (ease >= 1 || reborn.indexOf(k) !== -1) {
      e.x = tx;
      e.y = ty;
    } else {
      e.x += (tx - e.x) * ease;
      e.y += (ty - e.y) * ease;
    }
  }
}

registerBackground("ripples", {
  start: startRipples,
  step: stepRipples,
  settings: ripple,
  runtime: ["frame", "scrolled"],
});
