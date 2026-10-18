// Phone motion. Loaded after infinity.js, before the backgrounds.

// ---- Phone motion ----------------------------------------------------------
// A phone has no cursor for the backgrounds to follow, so they follow the
// phone instead. Its tilt moves a point about the screen that stands in for
// the cursor: tip the phone from the way it is being held and the point runs
// that way, further the more it is tipped; hold it a new way for a while and
// that becomes the new rest, so the point drifts back to the middle. The
// cursor glow follows the point too. Gravity tells the backgrounds where down
// really is, so what rises or falls in them goes by the phone's true up and
// down, not the screen's; and a sharp jolt counts as a shake, for the
// backgrounds that startle. Tilt and gravity come from the orientation
// sensor, which reads the same on every phone, turned to match the screen in
// landscape; shakes come from the motion sensor. iOS asks the
// visitor's leave before a page may read the sensors, and that can only be
// asked on a tap, so it is asked on the first one. On a computer with a mouse
// none of this happens; the canvas lab can feed it made-up tilts instead.
const phoneMotion = {
  reach: 20, // degrees of tilt from rest that take the point to the edge
  settle: 0.002, // share of the way the rest catches up with the tilt, per reading
  ease: 0.15, // share of the way the point moves to where the tilt puts it, per frame
  shake: 14, // m/s^2 of jolt that counts as a shake
};

const phone = {
  active: false, // whether the phone's motion stands in for the cursor
  downX: 0, // which way is down, on the screen: a unit vector
  downY: 1,
  shakes: 0, // shakes so far; a background notices one by this changing
  jolt: 0, // how hard the phone has been jolted lately, in shakes
};

let phoneTiltX = 0; // gravity in the screen's plane, x right and y down, 1 at most
let phoneTiltY = 0;
let phoneRestX = 0;
let phoneRestY = 0;
let phoneHasRest = false;
let phoneLastShake = 0;

function phoneScreenAngle() {
  const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  return ((angle % 360) + 360) % 360;
}

// The orientation sensor's tilt as gravity in the screen's plane. With the
// phone flat there is none, and down stays the way it was.
function phoneOnOrientation(event) {
  if (event.beta == null || event.gamma == null) return;
  const b = (event.beta * Math.PI) / 180;
  const g = (event.gamma * Math.PI) / 180;
  // Gravity on the phone's own axes, x to its right edge and y to its bottom.
  let x = Math.sin(g) * Math.cos(b);
  let y = Math.sin(b);
  // Turned to landscape, the screen's axes turn with it.
  const angle = phoneScreenAngle();
  if (angle === 90) [x, y] = [y, -x];
  else if (angle === 180) [x, y] = [-x, -y];
  else if (angle === 270) [x, y] = [-y, x];
  phoneTiltX = x;
  phoneTiltY = y;
  if (!phoneHasRest) {
    phoneRestX = x;
    phoneRestY = y;
    phoneHasRest = true;
  }
  phoneRestX += (x - phoneRestX) * phoneMotion.settle;
  phoneRestY += (y - phoneRestY) * phoneMotion.settle;
  const tilt = Math.hypot(x, y);
  if (tilt > 0.15) {
    phone.downX = x / tilt;
    phone.downY = y / tilt;
  }
  if (!phone.active) {
    phone.active = true;
    cursorPosition.x = canvas.width / 2;
    cursorPosition.y = canvas.height / 2;
    requestAnimationFrame(phoneFrame);
  }
}

// A jolt, from the motion sensor: without gravity where the phone gives it,
// else the way the total differs from gravity alone.
function phoneOnMotion(event) {
  let jolt;
  const a = event.acceleration;
  if (a && a.x != null) {
    jolt = Math.hypot(a.x, a.y, a.z);
  } else {
    const g = event.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    jolt = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
  }
  phone.jolt = Math.max(phone.jolt, jolt / phoneMotion.shake);
  const now = performance.now();
  if (jolt > phoneMotion.shake && now - phoneLastShake > 600) {
    phoneLastShake = now;
    phone.shakes++;
  }
}

// Each frame the point eases to where the tilt puts it, and stands in for the
// cursor, a tap's stray mouse events included.
function phoneFrame() {
  if (!phone.active) return;
  const w = canvas.width;
  const h = canvas.height;
  const reach = Math.sin((phoneMotion.reach * Math.PI) / 180) || 1;
  const across = Math.max(-1, Math.min(1, (phoneTiltX - phoneRestX) / reach));
  const down = Math.max(-1, Math.min(1, (phoneTiltY - phoneRestY) / reach));
  cursorPosition.prevX = cursorPosition.x;
  cursorPosition.prevY = cursorPosition.y;
  cursorPosition.x += (w / 2 + (across * w) / 2 - cursorPosition.x) * phoneMotion.ease;
  cursorPosition.y += (h / 2 + (down * h) / 2 - cursorPosition.y) * phoneMotion.ease;
  cursorOnPage = true;
  phone.jolt *= 0.95;
  requestAnimationFrame(phoneFrame);
}

function phoneListen() {
  window.addEventListener("deviceorientation", phoneOnOrientation);
  window.addEventListener("devicemotion", phoneOnMotion);
}

// For the canvas lab: a made-up tilt, a shake, and back to the mouse.
function phoneSimulate(beta, gamma) {
  phoneOnOrientation({ beta, gamma });
}
function phoneShake() {
  phone.shakes++;
  phone.jolt = 1;
}
function phoneStop() {
  phone.active = false;
  phone.downX = 0;
  phone.downY = 1;
  phoneHasRest = false;
}

if (window.matchMedia("(hover: none) and (pointer: coarse)").matches && "DeviceOrientationEvent" in window) {
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    // Asked on a tap, until the visitor answers; a request that fails because
    // it was not on a tap is tried again on the next.
    const ask = function () {
      DeviceOrientationEvent.requestPermission()
        .then(function (state) {
          if (state !== "granted" && state !== "denied") return;
          window.removeEventListener("touchend", ask);
          window.removeEventListener("click", ask);
          if (state === "granted") phoneListen();
        })
        .catch(function () {});
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        DeviceMotionEvent.requestPermission().catch(function () {});
      }
    };
    window.addEventListener("touchend", ask, { passive: true });
    window.addEventListener("click", ask);
  } else {
    phoneListen();
  }
}
