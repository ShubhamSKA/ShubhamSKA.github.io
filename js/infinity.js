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
const paramPanel = document.getElementById("backgroundParam");
const paramSlider = document.getElementById("bgParamSlider");
const paramLabel = document.getElementById("bgParamLabel");
const paramValue = document.getElementById("bgParamValue");

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
  butterfly,
  farris,
  gielis,
  harmonograph,
];

// What extraPar means differs per curve, so each one gets its own range. These
// are continuous now: the old version quantised them to whatever the clock
// happened to read, which left eight() with only two angles and heart() with
// no parameter at all.
const parameterRanges = [
  { min: 0.55, max: 2.0, label: "Width" }, // circle: horizontal stretch
  { min: 1.5, max: 5.5, label: "Frequency" }, // dunno: lobe count
  { min: 0, max: Math.PI * 2, label: "Angle" }, // eight: rotation
  { min: 0.55, max: 1.7, label: "Size" }, // heart: scale
  { min: 2, max: 11, label: "Petals" }, // boomerang
  { min: 0.02, max: 0.98, label: "Ratio" }, // hypocicloid
  { min: 0.12, max: 2.0, label: "Ratio" }, // venusian
  { min: 2.5, max: 11, label: "Cusps" }, // astroid
  { min: 2, max: 7, step: 0.1, label: "Wings" }, // butterfly
  { min: 2, max: 8, step: 0.25, label: "Turns" }, // farris
  { min: 2.25, max: 9, step: 0.25, label: "Petals" }, // gielis
  // Drawn a little smaller so the particles can hold the weave: the targets
  // sweep at speed * |f'|, and a smaller figure slows them without touching
  // the particle speed. Above ratio 4 it smears whatever the scale.
  { min: 1, max: 4, step: 0.05, sampleStep: 0.02, scale: 0.6, label: "Ratio" }, // harmonograph
];

function parameterFor(index) {
  const range = parameterRanges[index];
  if (!range.step) {
    return range.min + Math.random() * (range.max - range.min);
  }
  // Land on one of the notches the slider can actually stop at, whatever the
  // step is. Picking a free-running value put the thumb between notches and
  // made the readout disagree with the slider.
  const notches = Math.round((range.max - range.min) / range.step);
  return range.min + range.step * Math.floor(Math.random() * (notches + 1));
}

// Enough decimals to show the step, and no more.
function decimalsFor(step) {
  if (!step) return 2;
  const text = String(step);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

// The curve the page opens on is still picked at random.
let functionNum = Math.floor(Math.random() * graphFunctions.length);
let extraPar = parameterFor(functionNum);
let patternScale = parameterRanges[functionNum].scale || 1;
let patternSampleStep = parameterRanges[functionNum].sampleStep || 1;

// After that, step through the curves in order. Drawing the index from the
// clock the way the first one used to be skewed heavily towards a few values,
// because the arithmetic ran modulo a power of two and browsers round their
// timers differently. Walking the list visits all eight evenly.
function regeneratePattern() {
  functionNum = (functionNum + 1) % graphFunctions.length;
  extraPar = parameterFor(functionNum);
  patternScale = parameterRanges[functionNum].scale || 1;
  patternSampleStep = parameterRanges[functionNum].sampleStep || 1;
  color = Math.floor(Math.random() * 360);
  t = 0;
  syncParameterSlider();
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
  const x = (extraPar * 16 * Math.sin(t) * Math.sin(t) * Math.sin(t)) / 20;
  const y =
    -(
      extraPar *
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        1 * Math.cos(4 * t))
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
function butterfly(t) {
  const wings = extraPar;
  const r =
    Math.exp(Math.sin(t)) -
    2 * Math.cos(wings * t) +
    Math.pow(Math.sin(t / 2), 5);
  // The theoretical bound on |r| is e + 3, but the extremes never line up,
  // so normalising by it drew the butterfly at about half the size of every
  // other curve. 3.6 is measured: it puts the span alongside the rest.
  const k = 5;//3.6;
  const x = (Math.sin(t) * r) / k;
  const y = (Math.cos(t) * r) / k;
  return { x, y };
}
function farris(t) {
  const n = extraPar;
  const k = 1 + 1 / 2 + 1 / 3;                // |z| ≤ 11/6 for every n
  const x = (Math.cos(t) + Math.cos((n + 1) * t) / 2 + Math.sin((3 * n - 1) * t) / 3) / k;
  const y = (Math.sin(t) + Math.sin((n + 1) * t) / 2 + Math.cos((3 * n - 1) * t) / 3) / k;
  return { x, y };
}
function gielis(t) {
  const a = extraPar * t / 4;
  const r = 1 / (Math.pow(Math.abs(Math.cos(a)), 7) + Math.pow(Math.abs(Math.sin(a)), 8));
  const k = 6.68;                              // max r (independent of m)
  const x = (r * Math.cos(t)) / k;
  const y = (r * Math.sin(t)) / k;
  return { x, y };
}
// A harmonograph is two pendulums very slightly out of tune, so each loop lands
// a little rotated from the last and the trace weaves a ribbon. That only reads
// if consecutive particles sit next to each other along the path, which is what
// this curve's sampleStep is for: every other curve steps 1 per particle and
// scatters over the whole orbit, this one steps 0.02 and follows it.
function harmonograph(t) {
  const a = extraPar;
  const detune = 0.012;
  const x = (Math.sin(a * t) + Math.sin((a + detune) * t + 1.2) / 2) / 1.5;
  const y = (Math.cos(2 * t) + Math.cos((a + detune) * t + 0.5) / 2) / 1.5;
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
      let angle = t + i * patternSampleStep;

      const shape = graphFunctions[functionNum](angle);
      const reach = speed * (1 / increment) * patternScale;
      whiteElement.targetX = reach * shape.x + canvas.width / 2;
      whiteElement.targetY = reach * shape.y + canvas.height / 2;

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

function showParameterValue() {
  if (!paramValue) return;
  const range = parameterRanges[functionNum];
  paramValue.textContent = Number(extraPar).toFixed(decimalsFor(range.step));
}

// Each curve reads extraPar differently, so the slider is re-scaled to that
// curve's range whenever the shape changes.
function syncParameterSlider() {
  if (!paramSlider) return;
  const range = parameterRanges[functionNum];
  paramSlider.min = range.min;
  paramSlider.max = range.max;
  paramSlider.step = range.step || (range.max - range.min) / 500;
  paramSlider.value = extraPar;
  paramSlider.setAttribute("aria-label", range.label);
  if (paramLabel) paramLabel.textContent = range.label;
  showParameterValue();
}

function bringToFront() {
  userPlaying = true;
  canvas.classList.remove("canvas--settled");
  root.classList.add("intro-active"); // holds the page still underneath
  if (playButton) playButton.hidden = true;
  if (bgControls) bgControls.hidden = false;
  if (paramPanel) paramPanel.hidden = false;
  syncParameterSlider();
  ensureLoopRunning();
}

function returnToPage() {
  userPlaying = false;
  stopCycle();
  canvas.classList.add("canvas--settled");
  root.classList.remove("intro-active");
  if (bgControls) bgControls.hidden = true;
  if (paramPanel) paramPanel.hidden = true;
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
  if (paramSlider) {
    // No t reset here: dragging should morph the shape rather than restart it.
    paramSlider.addEventListener("input", function () {
      extraPar = Number(paramSlider.value);
      showParameterValue();
    });
  }
}
