/* Phone or tablet, or laptop and desktop? Loaded in the <head> of the pages that care, before
   anything is drawn.

   Phones and tablets have no keyboard, so they never get the games, and they steer the
   backgrounds by tilting instead of with a pointer. Pointer media queries cannot be trusted
   to tell the two apart: Firefox on a Windows laptop with a touchscreen reports no mouse at
   all, trackpad or not, so "(any-pointer: fine)" is false there. So this goes by the device,
   as the home page already does for its phone layout: a phone or tablet name in the user
   agent, or an iPad, which calls itself a Mac but has a touchscreen.

   Sets window.touchOnly, and the class "touchOnly" on <html> for the stylesheets. */
(function () {
  var ua = navigator.userAgent;
  var touchOnly = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone|Mobi/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  window.touchOnly = touchOnly;
  if (touchOnly) document.documentElement.classList.add("touchOnly");
})();
