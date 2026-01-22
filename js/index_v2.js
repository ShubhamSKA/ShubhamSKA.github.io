document.documentElement.style.cursor = "none";
console.log(navigator.userAgentData);

function isMobileDevice() {
  let a;
  console.log(a);
  if (
    navigator.userAgent.match(/Android/i) ||
    navigator.userAgent.match(/webOS/i) ||
    navigator.userAgent.match(/iPhone/i) ||
    navigator.userAgent.match(/iPad/i) ||
    navigator.userAgent.match(/iPod/i) ||
    navigator.userAgent.match(/BlackBerry/i) ||
    navigator.userAgent.match(/Windows Phone/i)
  ) {
    a = true;
  } else {
    a = false;
  }
  console.log(a);
  return a;
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
let lightnessOffset = 0;

function updateColor() {
  const currentTime = new Date();
  colorTimer = (currentTime.getMinutes() * 60 + currentTime.getSeconds()) % 360;
  const LightnessLowerBound = 210;
  const LightnessRange = 120;
  lightnessOffset =
    colorTimer > LightnessLowerBound &&
    colorTimer < LightnessLowerBound + LightnessRange
      ? 16 *
        20 *
        ((colorTimer - LightnessLowerBound) / LightnessRange) *
        ((colorTimer - LightnessLowerBound) / LightnessRange) *
        (1 - (colorTimer - LightnessLowerBound) / LightnessRange) *
        (1 - (colorTimer - LightnessLowerBound) / LightnessRange)
      : 0;
  const coloredElements = document.querySelectorAll("span.colored");
  const letters = document.querySelectorAll("h3 div");
  const formBackgrounds = document.querySelectorAll(".contactInput");
  const resume = document.querySelectorAll(".resume");

  coloredElements.forEach(function (element) {
    element.style.color = `hsl(${colorTimer}, 100%, ${50 + lightnessOffset}%)`;
  });
  resume.forEach(function (element) {
    element.style.borderColor = `hsl(${colorTimer}, 100%, ${
      40 + lightnessOffset
    }%)`;
    element.style.backgroundColor = `hsl(${colorTimer}, 100%, ${
      40 + lightnessOffset
    }%)`;
  });
  letters.forEach(function (element) {
    element.style.color = `hsl(${colorTimer}, 100%, ${50 + lightnessOffset}%)`;
  });
  formBackgrounds.forEach(function (element) {
    element.style.backgroundColor = `hsl(${colorTimer}, 100%, 90%)`;
  });
}

setInterval(updateColor, 1000);

const acronymName = [
  { elementID: "shSub", elementName: "Shubham", elementWord: "Simulate" },
  { elementID: "saSub", elementName: "Saluja", elementWord: "Sense" },
  { elementID: "kuSub", elementName: "Kumar", elementWord: "Know" },
  { elementID: "agSub", elementName: "Agarwal", elementWord: "Apply" },
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
const lightMenuButton = document.querySelector(".menuButton");
const buttonLine = document.querySelectorAll(".line");
const phoneMenu = document.querySelector(".menu");
const menuHeader = document.querySelector(".menu-header");
const skillOverlay = document.querySelectorAll(".skillOverlay");
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
  skillOverlay.forEach(function (element) {
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

mailButton.addEventListener("click", function (e) {
  // 1. PREVENT the standard HTML submit so the page doesn't reload
  e.preventDefault();

  let rotation = 0;
  let speed = 2;
  let position = 0;
  circleColor += 20;

  const filled = document.querySelectorAll(".contactInput");
  let isFormFilled = true;

  // Check if fields are empty
  filled.forEach(function (element) {
    if (element.value.trim() === "") {
      isFormFilled = false;
      // Triggers browser validation UI manually since we prevented default
      element.reportValidity();
      return;
    }
  });

  if (!isFormFilled) {
    return;
  }

  if (isFormFilled) {
    // 2. DO NOT call reset2() here. It deletes the data before we send it.
    // reset2(); <--- REMOVED

    // 3. SEND THE DATA VIA FETCH
    const form = document.getElementById("contact-form");
    const formData = new FormData(form);

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        if (response.status === 200) {
          reset2();
          console.log("Email sent successfully");
        } else {
          console.log("Error sending email");
        }
      })
      .catch((error) => console.log(error));

    // 5. RUN YOUR ANIMATION
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
    const sliderContainer = document.querySelector(".marqueeSlider");
    const marqueeContainers = document.querySelectorAll(
      ".marqueeSlider .singleProject"
    );
    sliderContainer.style.gridTemplateColumns = `repeat(${marqueeContainers.length}, 1fr)`;
    const marqueeWidth = 610;
    const wholeMarqueeWidth = marqueeWidth * marqueeContainers.length;
    let positions = Array.from(marqueeContainers).map(() => ({
      displacement: 0,
    }));

    let speed = 0.005;

    // Hover listeners
    sliderContainer.addEventListener("mouseenter", () => {
      speed = 0.002; // Slow down
    });
    sliderContainer.addEventListener("mouseleave", () => {
      speed = 0.005; // Resume normal speed
    });

    function animateMarquee() {
      marqueeContainers.forEach((container, index) => {
        positions[index].displacement -= marqueeWidth * speed;
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

document.addEventListener("DOMContentLoaded", () => {
  if (!isMobileDevice()) {
    const sliderContainer = document.querySelector(".marqueeSliderArt");
    const marqueeContainers = document.querySelectorAll(
      ".marqueeSliderArt .singleProject"
    );
    sliderContainer.style.gridTemplateColumns = `repeat(${marqueeContainers.length}, 1fr)`;
    const marqueeWidth = 610;
    const wholeMarqueeWidth = marqueeWidth * marqueeContainers.length;
    let positions = Array.from(marqueeContainers).map(() => ({
      displacement: 0,
    }));
    let speed2 = 0.005;

    // Hover listeners
    sliderContainer.addEventListener("mouseenter", () => {
      speed2 = 0.002; // Slow down
    });
    sliderContainer.addEventListener("mouseleave", () => {
      speed2 = 0.005; // Resume normal speed
    });

    function animateMarquee() {
      marqueeContainers.forEach((container, index) => {
        positions[index].displacement += marqueeWidth * speed2;

        const effectivePosition =
          (index + 1) * marqueeWidth + positions[index].displacement;

        if (effectivePosition > wholeMarqueeWidth) {
          positions[index].displacement -= wholeMarqueeWidth;
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

const skill_descriptions = {
  Python:
    "Data Engineering, Instrument Communication and Data Acquisition, GUI development, Dashboard Creation, Simple Game Development, Web API management",
  C: "Coded several problems from scratch, including tree balancing, Djikstra's Algorithm, Sudoku solving, among others.",
  LaTeX:
    "Took notes for classes (alongside a friend), as well as developed several reports and assignments. Check out the repository!",
  Microsoft:
    "I love thinking about how I can make PPTX presentations dynamic and visually appealing, so I have some pretty cool presentations. I also have quite a bit of experience using Excel. I have not, however, used Word much since I discovered LaTeX.",
  Fusion:
    "Several designs, like the ones showed on this website. I have also made, and printed, casings for PCBs. Finally I know basics of CAM and PCB Design (I have used Autodesk Eagle before).",
  Onshape:
    "Like in Fusion360, I made a few Onshape designs, the relevant skillset is similar, but there are some differences in tool utilization.",
  SysVerilog:
    "Experience writing modules and testbenches. Made a USB 1.0 communication protocol. Now taking a course to develop a Multicore Processor.",
  Virtuoso:
    "Design, Simulation, Layout, Verification of transistor level circuits. Made, simulated, and created the layout for a Manchester Carry Adder and a Wallace Tree Multiplier.",
  STM32:
    "Used an STM32 to accurately count frequency (3Hz resolution), perform ADC and DAC, and communicate and synchronize with a Python script.",
  Embedded:
    "Learned to code microcontrollers without built-in libraries, like HAL or Arduino. Made a 2-player (2 microcontroller) game of snake with display control, alongside a team of three other people.",
  MATLAB:
    "Scripts for data processing, aligning, filtering, and plotting. Some scripting for simulations, and some scripting for instrument data acquisition.",
  HTML: "I designed this webpage from scratch. Learned from Youtube tutorials and LLMs. I can now read and understand how HTML files behave, as well as use this knowledge to help design GUIs.",
  CSS: "Learned it alongside HTML. You get the idea, I was trying to learn the stack of front-end development.",
  KiCad:
    "Been using this for PCB design instead of Eagle, since it was more user friendly. I have also taught several people who came to BIDC how to use it.",
  Simulink:
    "Learned it for circuit simulations. That is, I simulated a 5kVDC, 2km transmission line and its subcomponents. I also designed a PLL inverter in Simulink, with hopes of expanding it into a hybrid inverter simulation.",
  Javascript:
    "Learned it with the rest of the WebDev stack, but I know there is a lot more it can offer that I don't know. I had a lot of fun designing the landing page for this website though. I was also given the responsibility of modifying and maintaing a few websites in one of my research teams.",
  Arduino:
    "My first embedded language. Can use it's in-built tools, but I have used it less now that I can use higher-end microcontrollers.",
  Altium:
    "Learning PCB design on it now - for a new project I am working on at the Wireless Sensing Lab.",
  LTSpice:
    "Once again, I have used this for circuit simulations. These circuits have been mostly composed of linear components. Used it in some of my classes, as well as to help understand what I am doing in my research projects.",
  Kotlin:
    "Took a basic course in Kotlin for AppDev, but I don't think I know enough to make an actual app with any use.",
  AStudio:
    "Same as Kotlin, learned it for AppDev, but I am not familiar enough to make an app with it.",
  ML: "Took a Coursera ML course, so I understand the idea behind it. I have also run, and made slight modifications to some models. However, I would not say I can make a model of my own.",
  THSoldering:
    "Several years of experience with through-hole soldering. Have also taught dozens of people how to solder.",
  SMD: "Less experience than through-hole soldering, but still notable. Some challenges I have faced are: an 0402 RF module with 6 ball pins and recreating a broken trace on a copper PCB with no mask.",
  TroubleShooting:
    "I can troubleshoot PCBs with basic techniques like continuity checking and parameter measurements.",
  Design:
    "I can design basic circuits, both linear and logical. Planning to learn more with my senior design project.",
  Milling:
    "Milled up to two layer PCBs on an AccurateCNC PCB Mill, using their proprietary software.",
  EPlating:
    "I know how this works, I have made the solute for it, and I have electroplated (albeit unevenly) some 3D printed objects.",
  English:
    "My most proficient language. I can read upwards of 400WPM while still maintaining a general understanding of what I am reading.",
  Spanish:
    "I was born and raised in Mexico, so I can fluently read, write and converse in Spanish.",
  Hindi:
    "Fluent enough in it to converse and survive in India. I am a very slow reader though. Probably about 2WPM.",
  French:
    "I took the DELF A2 in high school, and scored decently well. I am sure I cannot follow an actual french conversation.",
  Math: "I have ten years of Math Olympiad, achieving national rankings and medals multiple times.",
  Physics:
    "Five years of Physics Olympiad Experience, with multiple International level medals",
  Teach:
    "I have taught people with diverse backgrounds and skills in the Math Olympiad. I have also tutored several people in similar topics.",
  Communication:
    "I can communicate with people from diverse backgrounds and cultures, happily and effectively.",
  Optimism:
    "I view life very optimistically, that is, I can find the positives in everything. 'Live and let live' is my motto.",
  PublicSpeaking:
    "I love public speaking, there is something about standing in front of people that just calls to me.",
  Climbing: "I love climbing trees, rocks, and challenges.",
  Dancing:
    "I am not embarassed to love freestyle dance. I see it as a form of expression.",
};

document.querySelectorAll(".subSkillAll").forEach((container) => {
  const overlay = container.querySelector(".skillOverlay");
  const skills = container.querySelectorAll(".skill");

  skills.forEach((skill) => {
    skill.addEventListener("mouseenter", () => {
      const skillName = skill.dataset.skill;
      // Use innerHTML instead of textContent
      overlay.innerHTML = skill_descriptions[skillName] || skillName;
      overlay.classList.add("active");
    });

    skill.addEventListener("mouseleave", () => {
      overlay.classList.remove("active");
    });
  });
});
