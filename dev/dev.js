// The canvas lab: every pattern and background simulation, archived ones
// included, on a bare canvas, switchable without reloading. Not linked from
// the site. It drives infinity.js through the globals it already keeps
// (userPlaying, backgroundMode, functionNum and friends) rather than through
// an API of its own, so the main page carries nothing extra for it.

const lab = {
  panel: document.getElementById("lab"),
  readout: document.getElementById("readout"),
  settings: document.getElementById("settings"),
  behindPage: document.getElementById("behindPage"),
  glow: document.getElementById("cursorGlow"),
  items: [], // { kind: "pattern" | "background", key, button }
  current: -1,
};

// What the canvas looks like behind the page on the site, dark theme.
const BEHIND_PAGE_OPACITY = 0.45;

function addItem(container, kind, key, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  const index = lab.items.length;
  button.addEventListener("click", function () {
    show(index);
  });
  container.appendChild(button);
  lab.items.push({ kind, key, button });
}

graphFunctions.forEach(function (fn, index) {
  addItem(document.getElementById("patterns"), "pattern", index, fn.name);
});
Object.keys(backgrounds).forEach(function (name) {
  const sim = backgrounds[name];
  const where = sim.archived ? "archived" : sim.lab ? "inDevelopment" : "live";
  addItem(document.getElementById(where), "background", name, name);
});
// A group with nothing in it, and its heading, are left out.
["live", "inDevelopment", "archived"].forEach(function (id) {
  const group = document.getElementById(id);
  if (group.children.length) return;
  group.hidden = true;
  if (group.previousElementSibling) group.previousElementSibling.hidden = true;
});

function setPattern(index) {
  functionNum = index;
  extraPar = parameterFor(index);
  patternScale = parameterRanges[index].scale || 1;
  patternSampleStep = parameterRanges[index].sampleStep || 1;
  t = 0;
}

function start(item) {
  if (item.kind === "pattern") {
    // In front, the loop traces the curve instead of picking a background.
    userPlaying = true;
    backgroundMode = null;
    setPattern(item.key);
  } else {
    userPlaying = false;
    backgroundMode = item.key;
    lastBackgroundMode = item.key;
    backgrounds[item.key].start();
  }
  ensureLoopRunning();
}

function show(index) {
  const count = lab.items.length;
  lab.current = ((index % count) + count) % count;
  const item = lab.items[lab.current];
  lab.items.forEach(function (other, i) {
    other.button.setAttribute("aria-current", String(i === lab.current));
  });
  start(item);
  buildSettings(item);
  history.replaceState(null, "", "#" + (item.kind === "pattern" ? graphFunctions[item.key].name : item.key));
}

// ---- Settings ----------------------------------------------------------------
// Every number a simulation keeps in its settings object gets a field: plain
// numbers, pairs like a band, and one level of nesting (pull.reach). Keys the
// simulation lists as `runtime` are its running state, not settings.
function numberField(label, read, write) {
  const row = document.createElement("label");
  row.className = "row";
  const name = document.createElement("span");
  name.textContent = label;
  name.title = label;
  const input = document.createElement("input");
  input.type = "number";
  input.step = "any";
  input.value = read();
  input.addEventListener("input", function () {
    const value = Number(input.value);
    if (input.value !== "" && isFinite(value)) write(value);
  });
  row.append(name, input);
  return row;
}

function settingsRows(object, prefix, skip) {
  const rows = [];
  Object.keys(object).forEach(function (key) {
    if (skip.indexOf(key) !== -1) return;
    const value = object[key];
    const label = prefix + key;
    if (typeof value === "number") {
      rows.push(
        numberField(
          label,
          function () {
            return object[key];
          },
          function (v) {
            object[key] = v;
          }
        )
      );
    } else if (Array.isArray(value) && value.every((v) => typeof v === "number")) {
      value.forEach(function (_, i) {
        rows.push(
          numberField(
            label + "[" + i + "]",
            function () {
              return value[i];
            },
            function (v) {
              value[i] = v;
            }
          )
        );
      });
    } else if (value && value.constructor === Object && !prefix) {
      rows.push.apply(rows, settingsRows(value, key + ".", []));
    }
  });
  return rows;
}

function buildSettings(item) {
  lab.settings.textContent = "";
  if (item.kind === "pattern") {
    // The same slider the site shows in front.
    const range = parameterRanges[item.key];
    const row = document.createElement("label");
    row.className = "row";
    const name = document.createElement("span");
    name.textContent = range.label;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = range.min;
    slider.max = range.max;
    slider.step = range.step || (range.max - range.min) / 500;
    slider.value = extraPar;
    slider.addEventListener("input", function () {
      extraPar = Number(slider.value);
    });
    row.append(name, slider);
    lab.settings.append(row);
    return;
  }
  const sim = backgrounds[item.key];
  if (!sim.settings) {
    lab.settings.textContent = "No settings exposed.";
    return;
  }
  lab.settings.append.apply(lab.settings, settingsRows(sim.settings, "", sim.runtime || []));
}

// ---- View ------------------------------------------------------------------
function applyView() {
  canvas.style.opacity = lab.behindPage.checked ? BEHIND_PAGE_OPACITY : 1;
  cursorGlow.enabled = lab.glow.checked;
}
lab.behindPage.addEventListener("change", applyView);
lab.glow.addEventListener("change", applyView);
applyView();

// ---- Phone -----------------------------------------------------------------
// A phone's tilt and shakes, made up with sliders (js/motion.js), to try the
// backgrounds the way a phone drives them. The first tilt is taken as the way
// the phone is held, as on a real one.
const phoneTilt = document.getElementById("phoneTilt");
const phoneControls = document.getElementById("phoneControls");
const phoneBeta = document.getElementById("phoneBeta");
const phoneGamma = document.getElementById("phoneGamma");
function feedTilt() {
  if (phoneTilt.checked) phoneSimulate(Number(phoneBeta.value), Number(phoneGamma.value));
}
phoneTilt.addEventListener("change", function () {
  phoneControls.hidden = !phoneTilt.checked;
  if (phoneTilt.checked) feedTilt();
  else phoneStop();
});
phoneBeta.addEventListener("input", feedTilt);
phoneGamma.addEventListener("input", feedTilt);
document.getElementById("phoneShake").addEventListener("click", phoneShake);

document.getElementById("restart").addEventListener("click", function () {
  start(lab.items[lab.current]);
});

document.addEventListener("keydown", function (event) {
  if (event.target instanceof HTMLInputElement && (event.target.type === "number" || event.target.type === "range")) return;
  const key = event.key.toLowerCase();
  if (event.key === "ArrowDown" || event.key === "ArrowRight") show(lab.current + 1);
  else if (event.key === "ArrowUp" || event.key === "ArrowLeft") show(lab.current - 1);
  else if (key === "r") start(lab.items[lab.current]);
  else if (key === "h") lab.panel.hidden = !lab.panel.hidden;
  else if (key === "b") {
    lab.behindPage.checked = !lab.behindPage.checked;
    applyView();
  } else if (key === "g") {
    lab.glow.checked = !lab.glow.checked;
    applyView();
  } else return;
  event.preventDefault();
});

// ---- Cursor ring -------------------------------------------------------------
// The ring the main page draws round the pointer (js/script.js), so the
// animations are judged with it in view.
const ring = document.querySelector(".cursor");
let ringPending = false;
document.addEventListener("mousemove", function (event) {
  if (ringPending) return;
  ringPending = true;
  setTimeout(function () {
    ring.style.left = `${event.clientX - 10}px`;
    ring.style.top = `${event.clientY - 10}px`;
    ringPending = false;
  }, 5);
});

// ---- Frame time ------------------------------------------------------------
// Wraps the loop to time it; the loop asks for its next frame by this name.
const runFrame = moveWhiteElements;
let frameTotal = 0;
let frameCount = 0;
moveWhiteElements = function () {
  const begin = performance.now();
  runFrame();
  frameTotal += performance.now() - begin;
  frameCount++;
};
setInterval(function () {
  if (!frameCount) return;
  const item = lab.items[lab.current];
  const name = item.kind === "pattern" ? graphFunctions[item.key].name : item.key;
  lab.readout.textContent = `${name} · ${(frameTotal / frameCount).toFixed(1)} ms/frame · ${frameCount} fps`;
  frameTotal = 0;
  frameCount = 0;
}, 1000);

// Open on whatever the address names, else the first background.
const named = decodeURIComponent(window.location.hash.slice(1));
const opening = lab.items.findIndex(function (item) {
  return item.kind === "pattern" ? graphFunctions[item.key].name === named : item.key === named;
});
show(opening !== -1 ? opening : lab.items.findIndex((item) => item.kind === "background"));
