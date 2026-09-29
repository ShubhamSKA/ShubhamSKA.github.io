// Theme toggle for the technical detail pages. The initial theme is set by a
// small inline script in each page's <head> so there is no flash; this only
// handles the button. The stored key is shared with the main site.
(function () {
  var root = document.documentElement;
  var btn = document.getElementById("themeToggle");
  if (!btn) return;

  function paint() {
    var light = root.getAttribute("data-theme") === "light";
    btn.innerHTML = light ? "&#9789;" : "&#9788;";
    btn.setAttribute("aria-pressed", light ? "true" : "false");
    btn.title = light ? "Switch to dark mode" : "Switch to light mode";
  }

  paint();

  btn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ska-theme", next);
    } catch (e) {
      /* private browsing: the choice just won't survive a reload */
    }
    paint();
  });
})();
