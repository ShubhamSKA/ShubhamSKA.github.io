// The springs pattern without the chasing, to set beside it. Loaded after
// infinity.js, by the canvas lab only. The curve in infinity.js has its dots
// chase where the springs would put them at a capped speed; here each dot is
// moved by its spring outright, so it is always exactly there.

// ---- Spring ring ---------------------------------------------------------------
// Dots start at rest, evenly spaced on a circle of radius r, each tied to the
// centre by a spring nobody sees, its stiffness set by where the dot started:
// k = c + sin(n theta). The springs have no length of their own, so the pull
// grows in step with the distance from the centre, and each dot swings along
// its own diameter, through the centre and out the other side, at sqrt(k).
// All start in step and drift apart, so the circle buckles into n lobes, folds
// through itself, and winds tighter the longer it runs; only the dots at the
// stiffest and softest springs, whose neighbours keep nearly their time, stay
// bunched together. Below c = 1 some springs push instead of pull.
const springRing = {
  r: 0.4, // the circle's radius, share of the screen's shorter side
  c: 1.5, // k = c + sin(n theta)
  n: 5, // lobes; anything but a whole number leaves a seam at theta = 0
  pace: 0.03, // time passing each frame: k = 1 swings out and back in 2 pi / pace frames
};

// Dots a pushing spring throws away are held here, in r, just out of sight, so
// nothing runs off to infinity and comes back as NaN in the next pattern.
const SPRING_FAR = 4;

let springAt = new Float64Array(0); // how far out each dot is, in r; negative past the centre
let springSpeed = new Float64Array(0);

function startSprings() {
  springAt = new Float64Array(whiteElements.length).fill(1);
  springSpeed = new Float64Array(whiteElements.length);
}

function stepSprings() {
  const radius = springRing.r * Math.min(canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const count = whiteElements.length;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const k = springRing.c + Math.sin(springRing.n * theta);
    // Speed first, then place, which keeps a dot's swing the same size for good.
    springSpeed[i] -= k * springAt[i] * springRing.pace;
    springAt[i] += springSpeed[i] * springRing.pace;
    if (Math.abs(springAt[i]) > SPRING_FAR) {
      springAt[i] = Math.sign(springAt[i]) * SPRING_FAR;
      springSpeed[i] = 0;
    }
    const e = whiteElements[i];
    e.x = cx + Math.cos(theta) * radius * springAt[i];
    e.y = cy - Math.sin(theta) * radius * springAt[i]; // theta runs anticlockwise
  }
}

registerBackground("springs-exact", {
  start: startSprings,
  step: stepSprings,
  settings: springRing,
  light: function () {
    return 1; // lit evenly, as the patterns are, wherever the cursor is
  },
  lab: true,
});
