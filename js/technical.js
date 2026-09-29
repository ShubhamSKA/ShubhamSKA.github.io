// Chrome for the technical detail pages: the theme toggle, and the accent
// colour cycle shared with the main site.
//
// The initial theme is set by a small inline script in each page's <head> so
// there is no flash; this only handles the button.
(function () {
  var root = document.documentElement;
  var btn = document.getElementById("themeToggle");

  // ---- accent colour -------------------------------------------------------
  // Same cycle as updateColor() in js/script.js: the hue follows the minute
  // hand, with a lightness bump across the darker part of the wheel.
  var LIGHTNESS_LOWER_BOUND = 210;
  var LIGHTNESS_RANGE = 120;

  function paintAccent() {
    var now = new Date();
    var hue = (now.getMinutes() * 60 + now.getSeconds()) % 360;

    var offset = 0;
    if (hue > LIGHTNESS_LOWER_BOUND && hue < LIGHTNESS_LOWER_BOUND + LIGHTNESS_RANGE) {
      var x = (hue - LIGHTNESS_LOWER_BOUND) / LIGHTNESS_RANGE;
      offset = 16 * 20 * x * x * (1 - x) * (1 - x);
    }

    // These pages are long-form reading and the accent carries headings, so on
    // the light background the hue is kept but the lightness is pulled down far
    // enough to stay legible.
    var lightness =
      root.getAttribute("data-theme") === "light"
        ? Math.min(38, 50 + offset)
        : 50 + offset;

    root.style.setProperty("--accent", "hsl(" + Math.floor(hue) + ", 100%, " + lightness + "%)");
  }

  paintAccent();
  setInterval(paintAccent, 1000);

  // ---- theme toggle --------------------------------------------------------
  if (!btn) return;

  // Same two images the landing page uses, so the control reads identically
  // across the site rather than being a unicode glyph here and an icon there.
  function paintButton() {
    var light = root.getAttribute("data-theme") === "light";
    var icon = btn.querySelector("img");
    if (!icon) {
      icon = document.createElement("img");
      icon.alt = "";
      btn.innerHTML = "";
      btn.appendChild(icon);
    }
    icon.src = light ? "/img/dark_mode.png" : "/img/sun_white.png";
    btn.setAttribute("aria-pressed", light ? "true" : "false");
    btn.title = light ? "Switch to dark mode" : "Switch to light mode";
  }

  paintButton();

  btn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ska-theme", next);
    } catch (e) {
      /* private browsing: the choice just won't survive a reload */
    }
    paintButton();
    paintAccent();
  });
})();
