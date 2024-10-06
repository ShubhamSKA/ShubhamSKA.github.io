document.documentElement.style.cursor = "none";

/*function loadingPage() {
  const loadingBackground = document.querySelector(".loadingPage");
  let opacityLoadingBackground = 1;

  const opacityInterval = setInterval(function () {
    opacityLoadingBackground -= 0.1;
    loadingBackground.style.opacity = opacityLoadingBackground;

    if (opacityLoadingBackground <= 0) {
      clearInterval(opacityInterval);
      loadingBackground.style.visibility = "hidden";
      loadingBackground.style.display = "none";
    }
  }, 10);
}*/

function isMobileDevice() {
  console.log(/Mobi|Android/i.test(navigator.userAgent))
  return /Mobi|Android/i.test(navigator.userAgent);
}

let stylesheet = document.getElementById("stylesheet");
if (isMobileDevice()) {
  stylesheet.href = "/css/phone.css";
} else {
  stylesheet.href = "/css/index.css";
}

let currentFontSize = 1.5;
let currentMargin = 0;
let currentDirection = 0;
let loadingPageSpeed = 4.5;
function fontIncrease() {
  const loadingLetters = document.querySelectorAll(".loadingPage div p[id]");
  if (currentFontSize < 20) {
    currentFontSize += 0.25;
  }
  if (currentFontSize >= 20) {
    if (currentDirection % 1300 < 650) {
      currentMargin += loadingPageSpeed;
      currentDirection += loadingPageSpeed;
    } else {
      currentMargin -= loadingPageSpeed;
      currentDirection += loadingPageSpeed;
    }
    loadingLetters.forEach(function (element, index) {
      if (index % 2 === 0) {
        element.style.transform = `translateX(${currentMargin}px)`;
      } else {
        element.style.transform = `translateX(${-currentMargin}px)`;
      }
    });
  }
  loadingLetters.forEach(function (element) {
    element.style.fontSize = `${currentFontSize}rem`;
  });
}

setInterval(fontIncrease, 8);

window.addEventListener("load", function () {
  setTimeout(loadingPage, 3860);
});

function handleScroll(elementId, letterId, staticMargin, subLetter) {
  const subscript = document.getElementById(subLetter);
  const name = document.getElementById(elementId);
  const namePos = name.getBoundingClientRect().bottom;
  const nameTop = name.getBoundingClientRect().top;
  const letter = document.getElementById(letterId);

  if (namePos < 80) {
    letter.style.top = "0";
    letter.style.display = "block";
    subscript.style.visibility = "visible";
  } else {
    name.style.position = "static";
    name.style.fontSize = "100%";
    letter.style.display = "none";
    subscript.style.visibility = "hidden";
  }
  if (nameTop < 0) {
    name.style.marginLeft = `${nameTop * -0.3 + staticMargin}%`;
  } else {
    name.style.marginLeft = "";
    name.style.marginRight = 0;
  }
}

const nameElements = [
  {
    elementId: "Shubham",
    letterId: "ShubhamS",
    staticMargin: 10,
    subLetter: "shSub",
  },
  {
    elementId: "Saluja",
    letterId: "SalujaS",
    staticMargin: 20,
    subLetter: "saSub",
  },
  {
    elementId: "Kumar",
    letterId: "KumarK",
    staticMargin: 30,
    subLetter: "kuSub",
  },
  {
    elementId: "Agarwal",
    letterId: "AgarwalA",
    staticMargin: 40,
    subLetter: "agSub",
  },
];

function handleScrollEvent(element) {
  window.addEventListener("scroll", function () {
    handleScroll(
      element.elementId,
      element.letterId,
      element.staticMargin,
      element.subLetter
    );
  });
}

nameElements.forEach(handleScrollEvent);

let colorTimer = 0;

function updateColor() {
  const currentTime = new Date();
  colorTimer = (currentTime.getMinutes() * 60 + currentTime.getSeconds()) % 360;
  const coloredElements = document.querySelectorAll("span.colored");
  const letters = document.querySelectorAll("h3 div");
  const formBackgrounds = document.querySelectorAll(".contactInput");
  const resume = document.querySelectorAll(".resume");
  coloredElements.forEach(function (element) {
    element.style.color = `hsl(${colorTimer}, 100%, 50%)`;
  });
  resume.forEach(function (element) {
    element.style.borderColor = `hsl(${colorTimer}, 100%, 40%)`;
    element.style.backgroundColor = `hsl(${colorTimer}, 100%, 40%)`;
  });
  letters.forEach(function (element) {
    element.style.color = `hsl(${colorTimer}, 100%, 50%)`;
  });
  formBackgrounds.forEach(function (element) {
    element.style.backgroundColor = `hsl(${colorTimer}, 100%, 90%)`;
  });
}

setInterval(updateColor, 1000);

const acronymName = [
  { elementID: "shSub", elementName: "Shubham", elementWord: "Stay" },
  { elementID: "saSub", elementName: "Saluja", elementWord: "Strong" },
  { elementID: "kuSub", elementName: "Kumar", elementWord: "Keep" },
  { elementID: "agSub", elementName: "Agarwal", elementWord: "Advancing" },
];

let degrees = 0;

function rotateLogo(ID, Name, Word) {
  const subLogo = document.getElementById(ID);
  degrees++;
  if (degrees === 360) {
    degrees = 0;
  }

  if (degrees % 360 > 90 && degrees % 360 < 270) {
    subLogo.innerText = Word;
    subLogo.style.transform = `rotateY(${degrees + 180}deg)`;
  } else {
    subLogo.innerText = Name;
    subLogo.style.transform = `rotateY(${degrees}deg)`;
  }
}

function rotateLogoEvent(element) {
  setInterval(function () {
    rotateLogo(element.elementID, element.elementName, element.elementWord);
  }, 50);
}

acronymName.forEach(rotateLogoEvent);

let menuItems = document.querySelectorAll(".menu-item a");

function hoverEffect(element) {
  let intervalId; // variable to store the interval ID

  element.addEventListener("mouseover", function () {
    intervalId = setInterval(function () {
      element.style.color = `hsl(${colorTimer}, 100%, 50%)`;
    }, 10);
  });

  element.addEventListener("mouseout", function () {
    clearInterval(intervalId); // Stop the interval when mouse leaves
    if (element.classList.contains("light-mode")) {
      element.style.color = "black";
    } else {
      element.style.color = "white";
    }
  });
}
menuItems.forEach(hoverEffect);

let projectItems = document.querySelectorAll(".singleProject");

function hoverEffect2(element) {
  let intervalId; // variable to store the interval ID

  element.addEventListener("mouseover", function () {
    if (element.classList.contains("light-mode")) {
      intervalId = setInterval(function () {
        element.style.backgroundColor = `hsl(${colorTimer}, 100%, 90%)`;
      }, 100);
    } else {
      intervalId = setInterval(function () {
        element.style.backgroundColor = `hsla(${colorTimer}, 50%, 50%, 0.3)`;
      }, 10);
    }
  });

  element.addEventListener("mouseout", function () {
    clearInterval(intervalId);
    element.style.backgroundColor = "";
  });
}

projectItems.forEach(hoverEffect2);

document
  .querySelector("a[href='#aboutMe']")
  .addEventListener("click", function (event) {
    event.preventDefault(); // Prevent default anchor click behavior
    document.querySelector(".aboutAll").scrollIntoView({ behavior: "smooth" });
  });

document
  .querySelector("a[href='#workExperience']")
  .addEventListener("click", function (event) {
    event.preventDefault(); // Prevent default anchor click behavior
    document.querySelector(".workAll").scrollIntoView({ behavior: "smooth" });
  });

document
  .querySelector("a[href='#projects']")
  .addEventListener("click", function (event) {
    event.preventDefault(); // Prevent default anchor click behavior
    document
      .querySelector(".projectsAll")
      .scrollIntoView({ behavior: "smooth" });
  });

document
  .querySelector("a[href='#skills']")
  .addEventListener("click", function (event) {
    event.preventDefault(); // Prevent default anchor click behavior
    document.querySelector(".skillsAll").scrollIntoView({ behavior: "smooth" });
  });

document
  .querySelector("a[href='#contact']")
  .addEventListener("click", function (event) {
    event.preventDefault(); // Prevent default anchor click behavior
    document
      .querySelector(".contactAll")
      .scrollIntoView({ behavior: "smooth" });
  });

const modeToggle = document.getElementById("modeToggle");
const allLinks = document.querySelectorAll("a");
const allSubtitles = document.querySelectorAll(".subTitle");
const singleProjects = document.querySelectorAll(".singleProject");
const aboutMe = document.querySelector(".aboutMe");
const allTitleDivs = document.querySelectorAll(".titleDiv");
const menuRectangle = document.querySelector(".menu-block");
const menuItemsAll = document.querySelectorAll(".menu-item");
const modeImage = document.getElementById("modeImage");
const tableBody = document.querySelectorAll(".skillsBody tr td");
const tableHeader = document.querySelectorAll(".skillsHeader tr th");
const contactMain = document.querySelector(".contactAll");
const linksToMe = document.querySelectorAll(".linksToMe");
const gitImage = document.querySelectorAll(".gitImage");
const cursorLight = document.querySelector(".cursor");
const cursorDot = document.querySelector(".cursorCenter");
const lightMenuButton = document.querySelector(".menuButton")
const buttonLine = document.querySelectorAll(".line")
const phoneMenu = document.querySelector(".menu")
const menuHeader = document.querySelector(".menu-header")
const body = document.body;

modeToggle.addEventListener("click", function () {
  body.classList.toggle("light-mode");
  aboutMe.classList.toggle("light-mode");
  menuRectangle.classList.toggle("light-mode");
  modeImage.classList.toggle("light-mode");
  contactMain.classList.toggle("light-mode");
  cursorLight.classList.toggle("light-mode");
  cursorDot.classList.toggle("light-mode");
  lightMenuButton.classList.toggle("light-mode");
  phoneMenu.classList.toggle("light-mode");
  menuHeader.classList.toggle("light-mode");
  if (modeImage.classList.contains("light-mode")) {
    modeImage.src = "/img/dark_mode.png";
  } else {
    modeImage.src = "/img/sun_white.png";
  }
  gitImage.forEach(function (element) {
    element.classList.toggle("light-mode");
    if (element.classList.contains("light-mode")) {
      element.src = "img/github-mark.png";
    } else {
      element.src = "img/github-mark-white.png";
    }
  });
  allLinks.forEach(function (element) {
    element.classList.toggle("light-mode");
    if (element.classList.contains("light-mode")) {
      element.style.color = "black";
    } else {
      element.style.color = "";
    }
  });
  singleProjects.forEach(function (element) {
    element.classList.toggle("light-mode");
  });
  linksToMe.forEach(function (element) {
    element.classList.toggle("light-mode");
  });
  allSubtitles.forEach(function (element) {
    element.classList.toggle("light-mode");
  });
  buttonLine.forEach(function (element) {
    element.classList.toggle("light-mode");
  });
  allTitleDivs.forEach(function (element) {
    element.classList.toggle("light-mode");
  });
  menuItemsAll.forEach(function (element) {
    element.classList.toggle("light-mode");
  });
  tableHeader.forEach(function (element) {
    element.classList.toggle("light-mode");
  });
  tableBody.forEach(function (element) {
    element.classList.toggle("light-mode");
  });
});

mailButton = document.querySelector(".sendButton");
mailCircle = document.querySelector(".mailCircle");
let circleColor = 180;

mailButton.addEventListener("click", function () {
  let rotation = 0;
  let speed = 2;
  let position = 0;
  circleColor += 20;

  const filled = document.querySelectorAll(".contactInput");
  let isFormFilled = true;

  filled.forEach(function (element) {
    if (element.value.trim() === "") {
      isFormFilled = false;
      return;
    }
  });

  if (!isFormFilled) {
    return;
  }
  if (isFormFilled) {
    reset2();
    const rotateInterval = setInterval(function () {
      mailCircle.style.transform = `rotate(${rotation}deg)`;
      rotation += speed;
      speed += 0.1;

      if (rotation >= 1080) {
        position += speed;
        mailButton.style.transform = `translateX(${position}px)`;
      }
      if (rotation >= 4000) {
        clearInterval(rotateInterval);
        mailCircle.style.transform = "rotate(0deg)";
        mailButton.style.transform = `translateX(0px)`;
        mailCircle.style.backgroundColor = `hsl(${
          circleColor % 360
        }, 100%, 50%)`;
      }
    }, 10);
  }
});

let cursorCircle = document.querySelector(".cursor");
cursorCircle.style.pointerEvents = "none";

function throttle(callback, delay) {
  let timeoutId;

  return function (event) {
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        callback(event); // Pass the event object to the callback
        timeoutId = null;
      }, delay);
    }
  };
}

let throttledMouseMove = throttle(function (event) {
  let xCoor = event.clientX;
  let yCoor = event.clientY;

  cursorCircle.style.left = `${xCoor - 10}px`;
  cursorCircle.style.top = `${yCoor - 10}px`;
}, 5); // Adjust the delay as needed

document.addEventListener("mousemove", throttledMouseMove);

function reset2() {
  document.getElementById("contact-form").reset();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isMobileDevice()) {
    const marqueeContainers = document.querySelectorAll(".marqueeSlider .singleProject");
    const marqueeWidth = 610;
    const wholeMarqueeWidth = marqueeWidth * marqueeContainers.length;
    let positions = Array.from(marqueeContainers).map(() => ({
      displacement: 0,
    }));

    function animateMarquee() {
      marqueeContainers.forEach((container, index) => {
        positions[index].displacement -= marqueeWidth * 0.005;
        if (positions[index].displacement < -marqueeWidth * (index + 1)) {
          positions[index].displacement += wholeMarqueeWidth;
        }
        container.style.transform = `translateX(${positions[index].displacement}px)`;
      });

      requestAnimationFrame(animateMarquee);
    }

    animateMarquee();
  }
});




if (isMobileDevice()) {
  const menuButton = document.querySelector(".menuButton");
  const menuItems = document.querySelectorAll(".menu-item");
  const menuWhole = document.querySelector(".menu");
  menuWhole.style.backgroundColor = "black";
  menuButton.addEventListener("click", function () {
    menuButton.classList.toggle("displaying");
    menuItems.forEach(function (element) {
      if (menuButton.classList.contains("displaying")) {
        element.style.display = "block";
      } else {
        element.style.display = "none";
      }
    });
  });
  menuItems.forEach(function (element) {
    element.addEventListener("click", function () {
      menuButton.classList.toggle("displaying");
      menuItems.forEach(function (element) {
        if (menuButton.classList.contains("displaying")) {
          element.style.display = "block";
        } else {
          element.style.display = "none";
        }
      });
    });
  });
}
const menuButton = document.querySelector(".menuButton");
const menuLines = document.querySelectorAll(".line");
menuButton.style.transition = "transform 1s";
menuLines[2].style.transition = "transform 1s";
menuLines[3].style.transition = "transform 1s";
menuLines[1].style.transition = "transform 1s";
menuLines[0].style.transition = "transform 1s";
function animateMenuButton() {
  setTimeout(() => {
    menuLines[2].style.transform = "translateX(0px) translateY(0px)";
    menuLines[3].style.transform = "rotate(0deg) translateX(0px)";
  }, 1000);

  setTimeout(() => {
    menuButton.style.transform = "rotate(-90deg)";
  }, 2000);

  setTimeout(() => {
    menuButton.style.transform = "rotate(0deg)";
    menuLines[2].style.transform =
      "rotate(45deg) translateX(6px) translateY(-5px)";
    menuLines[3].style.transform = "rotate(-45deg) translateX(-3px)";
    menuLines[0].style.transform = "translateX(3px)";
    menuLines[1].style.transform = "translateX(-4px)";
  }, 3000);

  setTimeout(() => {
    menuLines[2].style.transform =
      "rotate(0deg) translateX(17px) translateY(0px)";
    menuLines[3].style.transform = "rotate(90deg) translateX(13px)";
    menuLines[0].style.transform = "translateX(0px)";
    menuLines[1].style.transform = "translateX(0px)";
  }, 4000);

}

// Call the function initially
animateMenuButton();

// Repeat the function every 5 seconds
setInterval(animateMenuButton, 6000);
