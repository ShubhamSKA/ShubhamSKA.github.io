// The growth background. Loaded after infinity.js.

// ---- Growth ----------------------------------------------------------------
// A branching tree in the manner of a Cayley tree: each branch grows for a
// while and then splits, mostly in two, every generation shorter than the one
// before. No two trees are alike. Each tree has a habit of its own: how
// widely it splits, how quickly its branches shorten, how long its first
// branches are, and which side of its splits runs longer. And each split
// varies on top of that: its branches differ in length and angle, and now
// and then a split puts out one branch only, or three.
// Trees grow from the ground, the bottom edge or the lower half of a side, on
// a single trunk that starts out straight from the edge it grows on. Like a
// plant following the sun, every growing tip then bends a little each step
// towards the light: upwards, and towards the cursor, which is the sun. The
// sun is far away, so its light is parallel: a tree takes one direction to it,
// from its root, and all its tips lean the same way, rather than converging on
// the cursor like fingers. Wood already grown keeps the way it grew, so when
// the cursor moves the new growth swings after it and the tree records where
// the sun has been. The trunk is long enough that the crown reaches the
// cursor's height. Tips near the sun grow fastest, so the side of the crown
// facing the cursor fills in first, and the branches they put out are longer
// than those of shaded tips far from it.
// Trees compete. The next tree comes up before the last has finished, so two
// grow at once, and both grow among the trees still standing. Each tree's wood
// is counted on a coarse grid, and a tip in among another tree's wood is
// crowded: it grows more slowly, so the dots it would have had go to tips in
// the open; it turns away from the other tree's wood, so crowns keep a little
// apart; and when it splits, its branches come out shorter, or only one comes
// out. The length a crowded split loses is not lost: it is kept and handed
// out as extra length at the tree's next splits with room, and whatever the
// tree has not used when it finishes goes to the tree growing beside it, or
// else to the next one to come up. A growing tree crowds hardest; a finished
// one, already withering, much less, or new trees coming up among the old
// would all be stunted.
// Dots are laid along the branches as they grow. The pattern it started from
// is used up first; after that a growing tree takes its dots from the oldest
// tree that has finished, starting from that tree's newest, outermost twigs,
// so an old tree withers back from its tips to its trunk, the way it grew but
// in reverse, while the new ones spread.
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
  // How trees differ from one another:
  habitSpread: 0.25, // how much a tree's spread differs, share of the spread
  habitShrink: 0.04, // how much shorter its branches may shrink each generation
  habitFirst: 0.15, // how much its first branches' length differs, share
  lopsided: 0.25, // how much longer one side of its splits runs, share, at most
  // How splits differ within a tree:
  vary: 0.25, // how much branches' lengths differ, share
  splay: 0.35, // how much their angles differ, share of the spread
  single: 0.1, // chance a split puts out one branch only
  triple: 0.06, // chance it puts out three
  // How the sun favours the tips near it:
  favour: 0.2, // share of the shorter side round the cursor where tips grow fastest
  farGrowth: 0.15, // how fast a tip far from the cursor grows, next to one beside it
  vigour: 0.4, // how much longer the branches put out beside the cursor are than
  //              those far from it, share
  // How trees compete where they meet:
  stagger: 0.6, // share of a tree grown before the next one comes up
  together: 2, // trees growing at once, at most
  crowding: 12, // dots of other trees' wood round a tip that halve its growth
  shy: 0.015, // rad per step a tip turns away from other trees' wood, at most
  squeeze: 0.5, // how much shorter a crowded tip's branches come out, at most
  deadwood: 0.2, // how hard a finished tree's wood crowds, next to a growing one's
};

// Wood is counted in cells this size. Beside a tip means its cell and the
// eight round it.
const GROWTH_CELL = 16;

let growthTips = []; // { x, y, angle, left, generation, tree }
let growthTrees = []; // oldest first; see plantTree
let growthUnused = 0; // dots of the starting pattern not yet taken
let growthWeights = new Float32Array(0);
let growthCols = 1;
let growthRows = 1;
let growthLive = new Uint16Array(0); // growing trees' dots in each cell
let growthDead = new Uint16Array(0); // finished trees' dots in each cell
let growthLeftover = 0; // px a finished tree did not use, for the next tree

function growthBetween(a, b) {
  return a + Math.random() * (b - a);
}

function growthCell(x, y) {
  const cx = Math.min(growthCols - 1, Math.max(0, Math.floor(x / GROWTH_CELL)));
  const cy = Math.min(growthRows - 1, Math.max(0, Math.floor(y / GROWTH_CELL)));
  return cy * growthCols + cx;
}

// Other trees' dots in the cells round (x, y), a finished tree's counting for
// less.
function growthOthers(x, y, tree) {
  const cx = Math.floor(x / GROWTH_CELL);
  const cy = Math.floor(y / GROWTH_CELL);
  let others = 0;
  for (let j = Math.max(0, cy - 1); j <= Math.min(growthRows - 1, cy + 1); j++) {
    for (let i = Math.max(0, cx - 1); i <= Math.min(growthCols - 1, cx + 1); i++) {
      const c = j * growthCols + i;
      others += growthLive[c] - tree.wood[c] + growth.deadwood * growthDead[c];
    }
  }
  return others;
}

// How much room a tip at (x, y) has: 1 in the open, a half with `crowding`
// of other trees' dots round it, less with more.
function growthRoom(x, y, tree) {
  return 1 / (1 + growthOthers(x, y, tree) / Math.max(1, growth.crowding));
}

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
  // This tree's habit. Branches only ever shrink faster than the setting, so
  // a tree never outgrows the dots there are.
  const tree = {
    root: { x: root.x, y: root.y },
    spread: growth.spread * (1 + growthBetween(-1, 1) * growth.habitSpread),
    shrink: growth.shrink - Math.random() * growth.habitShrink,
    first: growth.firstBranch * side * (1 + growthBetween(-1, 1) * growth.habitFirst),
    lopsided: growthBetween(-1, 1) * growth.lopsided,
    dots: [], // the dots it has laid, in order
    wood: new Uint16Array(growthCols * growthRows), // its dots in each cell
    tips: 1, // tips still growing
    laid: 0,
    expected: 0, // dots a whole tree of its habit would take
    followed: false, // whether the next tree has come up
    reserve: growthLeftover, // px lost to crowding, for its next splits with room
  };
  growthLeftover = 0;
  // Straight out from its edge: up from the bottom, inwards from a side.
  const angle = root.y >= h ? -Math.PI / 2 : root.x <= 0 ? 0 : Math.PI;
  // The crown spans roughly this much; the trunk makes up the rest.
  const crown = (tree.first / (1 - tree.shrink)) * growth.crownReach;
  const trunk = Math.max(growth.minTrunk * side, root.d - crown);
  let wood = trunk;
  for (let g = 0; g < growth.generations; g++) wood += Math.pow(2, g + 1) * tree.first * Math.pow(tree.shrink, g);
  tree.expected = wood / growth.step;
  growthTips.push({ x: root.x, y: root.y, angle, left: trunk, generation: 0, tree });
  growthTrees.push(tree);
}

// Takes `dot` from `tree`, off its count of wood.
function growthTake(tree, dot) {
  const e = whiteElements[dot];
  const c = growthCell(e.x, e.y);
  if (tree.wood[c]) tree.wood[c]--;
  const grid = tree.tips ? growthLive : growthDead;
  if (grid[c]) grid[c]--;
  return dot;
}

// The next dot to lay: an unused one from the starting pattern, else the
// newest twig of the oldest tree that has finished growing.
function takeDot() {
  if (growthUnused < whiteElements.length) return growthUnused++;
  while (growthTrees.length > 1 && !growthTrees[0].dots.length && !growthTrees[0].tips) {
    growthTrees.shift();
  }
  for (const tree of growthTrees) {
    if (!tree.tips && tree.dots.length) return growthTake(tree, tree.dots.pop());
  }
  // Every tree standing is still growing: the oldest gives up its trunk.
  for (const tree of growthTrees) {
    if (tree.dots.length) return growthTake(tree, tree.dots.shift());
  }
  return 0;
}

function startGrowth() {
  growthTips = [];
  growthTrees = [];
  growthUnused = 0;
  growthLeftover = 0;
  growthCols = Math.max(1, Math.ceil(canvas.width / GROWTH_CELL));
  growthRows = Math.max(1, Math.ceil(canvas.height / GROWTH_CELL));
  growthLive = new Uint16Array(growthCols * growthRows);
  growthDead = new Uint16Array(growthCols * growthRows);
  plantTree();
}

// How much sun a tip at (x, y) gets: 1 beside the cursor, falling off to
// farGrowth far from it. Everywhere alike with no cursor.
function growthSun(x, y, side) {
  if (!cursorOnPage) return 1;
  const reach = Math.max(1, growth.favour * side);
  const d2 = ((x - cursorPosition.x) ** 2 + (y - cursorPosition.y) ** 2) / (reach * reach);
  return growth.farGrowth + (1 - growth.farGrowth) / (1 + d2);
}

// Which tip grows next: any of them at random, the sunnier and the less
// crowded the likelier.
function growthPick(side) {
  const count = growthTips.length;
  if (growthWeights.length < count) growthWeights = new Float32Array(count * 2);
  let total = 0;
  for (let k = 0; k < count; k++) {
    const tip = growthTips[k];
    const weight = growthSun(tip.x, tip.y, side) * growthRoom(tip.x, tip.y, tip.tree);
    growthWeights[k] = weight;
    total += weight;
  }
  let pick = Math.random() * total;
  for (let k = 0; k < count; k++) {
    pick -= growthWeights[k];
    if (pick <= 0) return k;
  }
  return count - 1;
}

// A tip stops growing. If it was its tree's last, the tree has finished, and
// its wood moves over to the dead.
function growthDrop(index) {
  const tree = growthTips[index].tree;
  growthTips[index] = growthTips[growthTips.length - 1];
  growthTips.pop();
  if (--tree.tips) return;
  const heir = growthTrees.find(function (other) {
    return other.tips;
  });
  if (heir) heir.reserve += tree.reserve;
  else growthLeftover += tree.reserve;
  tree.reserve = 0;
  for (let c = 0; c < tree.wood.length; c++) {
    if (!tree.wood[c]) continue;
    growthLive[c] -= Math.min(growthLive[c], tree.wood[c]);
    growthDead[c] += tree.wood[c];
  }
}

// A finished branch puts out the next generation: mostly two, sometimes one
// or three, each a little different in length and angle. Crowded, fewer and
// shorter, with the length that loses saved for later; in the open, longer,
// with what was saved.
function growthSplit(tip, side) {
  const tree = tip.tree;
  const roll = Math.random();
  let hands = roll < growth.single ? [0] : roll < growth.single + growth.triple ? [-1, 0, 1] : [-1, 1];
  const base = tree.first * Math.pow(tree.shrink, tip.generation);
  // Sunny tips put out longer branches than shaded ones.
  const sunny = (growthSun(tip.x, tip.y, side) - growth.farGrowth) / (1 - growth.farGrowth || 1);
  const vigour = 1 + growth.vigour * (sunny - 0.5);
  const room = growthRoom(tip.x, tip.y, tree);
  if (room < 0.25 && hands.length > 1) {
    tree.reserve += base * vigour * (hands.length - 1);
    hands = [0];
  }
  for (const hand of hands) {
    let length = base * vigour * (1 + hand * tree.lopsided) * (1 + growth.vary * growthBetween(-1, 1));
    const lost = length * growth.squeeze * (1 - room);
    length -= lost;
    tree.reserve += lost;
    if (room > 0.5 && tree.reserve > 0) {
      const extra = Math.min(tree.reserve, length * 0.6 * room);
      length += extra;
      tree.reserve -= extra;
    }
    // A lone branch carries on more or less straight.
    const turn = hand
      ? hand * tree.spread * (1 + growth.splay * growthBetween(-1, 1))
      : tree.spread * growth.splay * growthBetween(-1, 1);
    growthTips.push({
      x: tip.x,
      y: tip.y,
      angle: tip.angle + turn,
      left: length,
      generation: tip.generation + 1,
      tree,
    });
    tree.tips++;
  }
}

function stepGrowth() {
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.min(w, h);
  const ahead = 2.5 * GROWTH_CELL;
  let laid = 0;
  while (laid < growth.perFrame) {
    // The next tree comes up once the newest is far enough along, as long as
    // not too many are growing already.
    const newest = growthTrees[growthTrees.length - 1];
    let growing = 0;
    for (const tree of growthTrees) if (tree.tips) growing++;
    if (!growthTips.length) plantTree();
    else if (!newest.followed && newest.laid >= growth.stagger * newest.expected && growing < growth.together) {
      newest.followed = true;
      plantTree();
    }
    const index = growthPick(side);
    const tip = growthTips[index];
    const tree = tip.tree;
    // Towards the light: up, plus the direction from the tree's root to the
    // sun, the same for every tip of the tree.
    let lightX = 0;
    let lightY = -growth.upward;
    if (cursorOnPage) {
      const sx = cursorPosition.x - tree.root.x;
      const sy = cursorPosition.y - tree.root.y;
      const sd = Math.hypot(sx, sy) || 1;
      lightX += (sx / sd) * growth.sun;
      lightY += (sy / sd) * growth.sun;
    }
    let turn = Math.atan2(lightY, lightX) - tip.angle;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    tip.angle += Math.max(-growth.bias, Math.min(growth.bias, turn));
    tip.angle += (Math.random() - 0.5) * growth.wobble * 2;
    // Away from other trees' wood: a look ahead to either side, and a turn
    // towards the emptier.
    const left = growthOthers(tip.x + Math.cos(tip.angle - 0.6) * ahead, tip.y + Math.sin(tip.angle - 0.6) * ahead, tree);
    const right = growthOthers(tip.x + Math.cos(tip.angle + 0.6) * ahead, tip.y + Math.sin(tip.angle + 0.6) * ahead, tree);
    if (left + right > 0) tip.angle += (growth.shy * (left - right)) / (left + right);
    tip.x += Math.cos(tip.angle) * growth.step;
    tip.y += Math.sin(tip.angle) * growth.step;
    tip.left -= growth.step;

    const dot = takeDot();
    whiteElements[dot].x = tip.x;
    whiteElements[dot].y = tip.y;
    tree.dots.push(dot);
    tree.laid++;
    const c = growthCell(tip.x, tip.y);
    tree.wood[c]++;
    growthLive[c]++;
    laid++;

    // A finished branch splits before it stops, so its tree is not taken for
    // finished in between.
    if (tip.x < 0 || tip.x > w || tip.y < 0 || tip.y > h) {
      growthDrop(index);
    } else if (tip.left <= 0) {
      if (tip.generation < growth.generations) growthSplit(tip, side);
      growthDrop(index);
    }
  }
}

registerBackground("growth", {
  start: startGrowth,
  step: stepGrowth,
  settings: growth,
});
