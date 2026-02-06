function openAndRedirect(element, url) {
  // 1. Add the 'open' class to start the CSS animation
  element.classList.add("open");
  const sat = document.getElementById("listened")

  setTimeout(() => {
    window.open(url, "_blank");
  }, 800);
  
  setTimeout(() => {
    sat.style.opacity = 1;
  }, 5000);
}
