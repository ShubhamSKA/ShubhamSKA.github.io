// The growth background. Loaded after infinity.js.

// ---- Growth ----------------------------------------------------------------
// A branching tree in the manner of a Cayley tree: each branch grows for a
// while and then splits in two, every generation shorter than the one before.
// Trees grow from the ground, the bottom edge or the lower half of a side, on
// a single trunk that starts out straight from the edge it grows on. Like a
// plant following the sun, every growing tip then bends a little each step
// towards the light: upwards, and towards the cursor, which is the sun. The
// sun is far away, so its light is parallel: a tree takes one direction to it,
// from its root, and all its tips lean the same way, rather than converging on
// the cursor like fingers. Wood already grown keeps the way it grew, so when
// the cursor moves the new growth swings after it and the tree records where
// the sun has been. The trunk is long enough that the crown reaches the
// cursor's height. Dots are laid along the branches as they grow. The
// pattern it started from is used up first; after that a growing tree takes
// its dots from the oldest tree, starting from that tree's newest, outermost
// twigs, so an old tree withers back from its tips to its trunk, the way it
// grew but in reverse, while the new one spreads.
const growth = {
  step: 3, // px between dots along a branch
  firstBranch: 0.12, // length of the first branches above the trunk, share of
  //                    the shorter side
  minTrunk: 0.08, // the shortest a trunk gets, share of the shorter side
  crownReach: 0.6, // how much of its branches' total length a crown spans
  shrink: 0.74, // each generation's branches this much shorter; small enough
  //               that a whole tree fits in the dots there are
  spread: 0.45, // rad: half the angle between the two halves of a split
  generations: 8, // splits above the trunk
  bias: 0.012, // rad per step a tip turns towards the light, at most
  upward: 1, // how much the light comes from straight up
  sun: 1.5, // and how much from the cursor's direction
  perFrame: 20, // dots laid per frame
  wobble: 0.02, // rad of random wandering per step
};

let growthTips = []; // { x, y, angle, left, generation, root }
let growthTrees = []; // oldest first; each the dots it laid, in order
let growthUnused = 0; // dots of the starting pattern not yet taken

function plantTree() {
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  const target = cursorOnPage
    ? { x: cursorPosition.x, y: cursorPosition.y }
    : { x: w / 2, y: h * 0.4 };
  // Candidate roots along the bottom and the lower halves of the sides, in
  // proportion to their lengths; one of the nearer ones to the cursor, not
  // always the nearest, so trees do not all come up in the same spot.
  const candidates = [];
  for (let k = 0; k < 24; k++) {
    const along = Math.random() * (w + h);
    let x;
    let y;
    if (along < w) {
      x = along;
      y = h;
    } else {
      x = along < w + h / 2 ? 0 : w;
      y = h / 2 + Math.random() * (h / 2);
    }
    candidates.push({ x, y, d: Math.hypot(target.x - x, target.y - y) });
  }
  candidates.sort(function (a, b) {
    return a.d - b.d;
  });
  const root = candidates[Math.floor(Math.random() * 6)];
  // Straight out from its edge: up from the bottom, inwards from a side.
  const angle = root.y >= h ? -Math.PI / 2 : root.x <= 0 ? 0 : Math.PI;
  // The crown spans roughly this much; the trunk makes up the rest.
  const crown = ((growth.firstBranch * side) / (1 - growth.shrink)) * growth.crownReach;
  growthTips.push({
    x: root.x,
    y: root.y,
    angle,
    left: Math.max(growth.minTrunk * side, root.d - crown),
    generation: 0,
    root: { x: root.x, y: root.y },
  });
  growthTrees.push([]);
}

// The next dot to lay: an unused one from the starting pattern, else the
// newest twig of the oldest tree still standing.
function takeDot() {
  if (growthUnused < whiteElements.length) return growthUnused++;
  while (growthTrees.length > 1 && !growthTrees[0].length) growthTrees.shift();
  if (growthTrees.length > 1) return growthTrees[0].pop();
  // Only the growing tree is left: it gives up its own trunk.
  return growthTrees[0].shift();
}

function startGrowth() {
  growthTips = [];
  growthTrees = [];
  growthUnused = 0;
  plantTree();
}

function stepGrowth() {
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  let laid = 0;
  // Tips take turns, so a tree with many tips still grows at a steady pace.
  while (laid < growth.perFrame) {
    if (!growthTips.length) plantTree();
    const tip = growthTips.shift();
    // Towards the light: up, plus the direction from the tree's root to the
    // sun, the same for every tip of the tree.
    let lightX = 0;
    let lightY = -growth.upward;
    if (cursorOnPage) {
      const sx = cursorPosition.x - tip.root.x;
      const sy = cursorPosition.y - tip.root.y;
      const sd = Math.hypot(sx, sy) || 1;
      lightX += (sx / sd) * growth.sun;
      lightY += (sy / sd) * growth.sun;
    }
    let turn = Math.atan2(lightY, lightX) - tip.angle;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    tip.angle += Math.max(-growth.bias, Math.min(growth.bias, turn));
    tip.angle += (Math.random() - 0.5) * growth.wobble * 2;
    tip.x += Math.cos(tip.angle) * growth.step;
    tip.y += Math.sin(tip.angle) * growth.step;
    tip.left -= growth.step;

    const dot = takeDot();
    whiteElements[dot].x = tip.x;
    whiteElements[dot].y = tip.y;
    growthTrees[growthTrees.length - 1].push(dot);
    laid++;

    if (tip.x < 0 || tip.x > w || tip.y < 0 || tip.y > h) continue;
    if (tip.left > 0) {
      growthTips.push(tip);
    } else if (tip.generation < growth.generations) {
      const next = growth.firstBranch * side * Math.pow(growth.shrink, tip.generation);
      for (const hand of [-1, 1]) {
        growthTips.push({
          x: tip.x,
          y: tip.y,
          angle: tip.angle + hand * growth.spread,
          left: next,
          generation: tip.generation + 1,
          root: tip.root,
        });
      }
    }
  }
}

registerBackground("growth", {
  start: startGrowth,
  step: stepGrowth,
  settings: growth,
});
