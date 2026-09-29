const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const root = document.documentElement;

// The intro plays as a full-screen overlay, then demotes itself to a faint
// background layer. Nothing is gated behind a click.
const INTRO_HOLD_MS = 2000; // how long the overlay stays opaque
const INTRO_FADE_MS = 900; // how long it takes to sink into the background
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

let introDone = false;

function cameFromThisSite() {
  if (!document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch (e) {
    return false;
  }
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let currentCenterX = window.innerWidth / 2;
let currentCenterY = window.innerHeight / 2;

//ctx.imageSmoothingEnabled = false;

document.addEventListener("mousemove", handleMouseMove);
let cursorPosition = { x: 0, y: 0, prevX: 0, prevY: 0 };
const loadTime = new Date();

function handleResize() {
  const newWidth = window.innerWidth;
  const newHeight = window.innerHeight;
  
  const newCenterX = newWidth / 2;
  const newCenterY = newHeight / 2;

  const deltaX = newCenterX - currentCenterX;
  const deltaY = newCenterY - currentCenterY;

  canvas.width = newWidth;
  canvas.height = newHeight;

  for (let i = 0; i < whiteElements.length; i++) {
    whiteElements[i].x += deltaX;
    whiteElements[i].y += deltaY;
  }

  currentCenterX = newCenterX;
  currentCenterY = newCenterY;
}
window.addEventListener("resize", handleResize);
window.addEventListener("load", handleResize); 


const playButton = document.getElementById("playBackground");
const bgControls = document.getElementById("backgroundControls");

// Set here rather than inside the intro branch so bringing the canvas back to
// the front later fades as well.
canvas.style.transition = `opacity ${INTRO_FADE_MS}ms ease, background-color ${INTRO_FADE_MS}ms ease`;

function settleIntoBackground() {
  if (introDone) return;
  introDone = true;
  canvas.classList.add("canvas--settled");
  root.classList.remove("intro-active");
  if (playButton) playButton.hidden = false;
}

if (prefersReducedMotion || window.location.hash || cameFromThisSite()) {
  settleIntoBackground();
} else {
  root.classList.add("intro-active");
  setTimeout(settleIntoBackground, INTRO_HOLD_MS);
  setTimeout(function () {
    root.classList.remove("intro-active");
  }, INTRO_HOLD_MS + INTRO_FADE_MS + 500);
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (evt) {
    window.addEventListener(evt, settleIntoBackground, { once: true, passive: true });
  });
}

function handleMouseMove(event) {
  cursorPosition.prevX = cursorPosition.x;
  cursorPosition.prevY = cursorPosition.y;
  cursorPosition.x = event.clientX;
  cursorPosition.y = event.clientY;
}

function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function moveTowardsTarget(currentX, currentY, targetX, targetY, speed) {
  const distance = calculateDistance(currentX, currentY, targetX, targetY);
  const dx = (targetX - currentX) / distance;
  const dy = (targetY - currentY) / distance;
  let newX = currentX + dx * speed;
  let newY = currentY + dy * speed;
  const distanceToCursor = calculateDistance(
    newX,
    newY,
    cursorPosition.x,
    cursorPosition.y
  );
  if (distanceToCursor < 15) {
    const avoidanceFactor = (30 - distanceToCursor) / 15;
    const avoidanceX =
      (newX -
        cursorPosition.x -
        2 * (cursorPosition.prevX - cursorPosition.x)) /
      distanceToCursor;
    const avoidanceY =
      (newY -
        cursorPosition.y -
        2 * (cursorPosition.prevY - cursorPosition.y)) /
      distanceToCursor;
    newX = currentX + avoidanceX * speed * avoidanceFactor;
    newY = currentY + avoidanceY * speed * avoidanceFactor;
  }
  return { x: newX, y: newY };
}

let whiteElements = [];
let arrivedElements = [];
let speed = 3.5;
let radiusPar=Math.random()/2;
for (let i = 0; i < 5000; i += 1) {
  const angle = 2 * Math.random() * Math.PI;
  const radius = canvas.width / 2*radiusPar;
  let whiteElementX = Math.cos(angle) * radius + canvas.width / 2;
  let whiteElementY = Math.sin(angle) * radius + canvas.height / 2;

  ctx.fillStyle = "white";
  ctx.fillRect(whiteElementX, whiteElementY, 1, 1);

  let whiteElement = {
    x: whiteElementX,
    y: whiteElementY,
    targetX: 0,
    targetY: 0,
  };

  whiteElements.push(whiteElement);
}

const graphFunctions = [
  circle,
  dunno,
  eight,
  heart,
  boomerang,
  hypocicloid,
  venusian,
  astroid,
];

// The parameter fed into a given curve. Several of the curves take only one
// value, so this is mostly a lookup; the second entry is the one with a real
// choice in it.
function parameterFor(index, ms) {
  const options = [
    [ms / 1000 + 1],
    [(ms % 9) / 2 + 1.5],
    [0, Math.PI / 2],
    [1],
    [(ms % 80) / 10 + 3],
    [(ms % 99) / 100 + 0.01],
    [(ms % 50) / 25 + 0.01],
    [(ms % 80) / 10 + 3],
  ][index];
  return options[(ms % 997) % options.length];
}

// The curve the page opens on is still picked at random.
let functionNum = Math.floor(Math.random() * graphFunctions.length);
let extraPar = parameterFor(functionNum, loadTime.getMilliseconds());

// After that, step through the curves in order. Drawing the index from the
// clock the way the first one used to be skewed heavily towards a few values,
// because the arithmetic ran modulo a power of two and browsers round their
// timers differently. Walking the list visits all eight evenly.
function regeneratePattern() {
  functionNum = (functionNum + 1) % graphFunctions.length;
  extraPar = parameterFor(functionNum, Math.floor(Math.random() * 1000));
  color = Math.floor(Math.random() * 360);
  t = 0;
}

function circle(t) {
  const radius = Math.sin(t);
  const y = Math.sin(t) * radius - 0.4;
  const x = Math.cos(t) * extraPar * radius;
  return { x, y };
}
function dunno(t) {
  const y = Math.sin(t) * Math.cos(t) * Math.sin(extraPar * t);
  const x = Math.cos(t) * Math.cos(extraPar * t);
  return { x, y };
}
function eight(t) {
  //extraPar = Math.PI/2
  const x2 = Math.sin(t) * Math.cos(t);
  const y2 = Math.cos(t);
  const x = x2 * Math.cos(extraPar) - y2 * Math.sin(extraPar);
  const y = x2 * Math.sin(extraPar) - y2 * Math.cos(extraPar);
  return { x, y };
}
function heart(t) {
  const x = (16 * Math.sin(t) * Math.sin(t) * Math.sin(t)) / 20;
  const y =
    -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      1 * Math.cos(4 * t)
    ) / 20;
  return { x, y };
}
function boomerang(t) {
  const x = (1 + Math.sin(extraPar * t)) * Math.cos(t);
  const y = (1 + Math.sin(extraPar * t)) * Math.sin(t);
  return { x, y };
}
function hypocicloid(t) {
  const x = ((extraPar - 1) * Math.cos(t) + Math.cos((extraPar - 1) * t)) / 1.5;
  const y = ((extraPar - 1) * Math.sin(t) - Math.sin((extraPar - 1) * t)) / 1.5;
  return { x, y };
}
function venusian(t) {
  const x =
    (Math.sin(t) + Math.pow(extraPar, 2 / 3) * Math.sin(t / extraPar)) / 4;
  const y =
    (Math.cos(t) + Math.pow(extraPar, 2 / 3) * Math.cos(t / extraPar)) / 4;
  return { x, y };
}
function astroid(t) {
  const x =
    ((extraPar - 1) * Math.cos(t) + Math.cos((extraPar - 1) * t)) /
    (1.5 * extraPar);
  const y =
    ((extraPar - 1) * Math.sin(t) - Math.sin((extraPar - 1) * t)) /
    (1.5 * extraPar);
  return { x, y };
}

let t = 0;
const increment = 0.01;
let color = loadTime.getMilliseconds() % 360;

function moveWhiteElements() {
  color += 0.1;
  t += increment;
  if (t > 2) {
    t = 0;
  }

  if (whiteElements.length > 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < whiteElements.length; i++) {
      let whiteElement = whiteElements[i];
      let angle = t + i;

      whiteElement.targetX =
        speed * (1 / increment) * graphFunctions[functionNum](angle).x +
        canvas.width / 2;
      whiteElement.targetY =
        speed * (1 / increment) * graphFunctions[functionNum](angle).y +
        canvas.height / 2;

      let updatedWhiteElement = moveTowardsTarget(
        whiteElement.x,
        whiteElement.y,
        whiteElement.targetX,
        whiteElement.targetY,
        speed
      );

      whiteElement.x = updatedWhiteElement.x;
      whiteElement.y = updatedWhiteElement.y;

      ctx.fillStyle = `hsl(${Math.floor(color)},100%,75%)`;
      ctx.fillRect(whiteElement.x, whiteElement.y, 1, 1);
    }

    if (loopShouldRun()) {
      requestAnimationFrame(moveWhiteElements);
    } else {
      rafPending = false;
    }
  }
}

let rafPending = true;
let userPlaying = false;

// Reduced motion stops the idle background animation, but not a visitor who has
// deliberately asked to play with it.
function loopShouldRun() {
  return (!prefersReducedMotion || userPlaying) && !document.hidden;
}

function ensureLoopRunning() {
  if (!rafPending && loopShouldRun()) {
    rafPending = true;
    moveWhiteElements();
  }
}

moveWhiteElements();

// Stop burning frames on a backgrounded tab; pick back up on return.
document.addEventListener("visibilitychange", ensureLoopRunning);

// ---- Playing with the background -------------------------------------------
let cycleTimer = null;

function stopCycle() {
  if (!cycleTimer) return;
  clearInterval(cycleTimer);
  cycleTimer = null;
  const cycle = document.getElementById("bgCycle");
  if (cycle) {
    cycle.setAttribute("aria-pressed", "false");
    cycle.classList.remove("isOn");
  }
}

function startCycle() {
  if (cycleTimer) return;
  regeneratePattern();
  cycleTimer = setInterval(regeneratePattern, 4000);
  const cycle = document.getElementById("bgCycle");
  if (cycle) {
    cycle.setAttribute("aria-pressed", "true");
    cycle.classList.add("isOn");
  }
}

function bringToFront() {
  userPlaying = true;
  canvas.classList.remove("canvas--settled");
  root.classList.add("intro-active"); // holds the page still underneath
  if (playButton) playButton.hidden = true;
  if (bgControls) bgControls.hidden = false;
  ensureLoopRunning();
}

function returnToPage() {
  userPlaying = false;
  stopCycle();
  canvas.classList.add("canvas--settled");
  root.classList.remove("intro-active");
  if (bgControls) bgControls.hidden = true;
  if (playButton) playButton.hidden = false;
}

if (playButton && bgControls) {
  playButton.addEventListener("click", bringToFront);
  document.getElementById("bgBack").addEventListener("click", returnToPage);
  document.getElementById("bgNew").addEventListener("click", regeneratePattern);
  document.getElementById("bgCycle").addEventListener("click", function () {
    if (cycleTimer) {
      stopCycle();
    } else {
      startCycle();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && userPlaying) returnToPage();
  });
}
