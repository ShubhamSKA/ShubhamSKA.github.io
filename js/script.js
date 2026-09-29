const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

function isMobileDevice() {
  let a;
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
  return a;
}

let stylesheet = document.getElementById("stylesheet");
if (isMobileDevice()) {
  stylesheet.href = "/css/phone.css";
} else {
  stylesheet.href = "/css/style.css";
}

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
  const letters = document.querySelectorAll(".logoLetters a div");
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
  if (reducedMotion) {
    document.getElementById(element.elementID).innerText = element.elementName;
    return;
  }
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
    element.style.color = ""; // hand the colour back to the stylesheet
  });
}
menuItems.forEach(hoverEffect);

let projectItems = document.querySelectorAll(".singleProject");

function hoverEffect2(element) {
  let intervalId; // variable to store the interval ID

  element.addEventListener("mouseover", function () {
    if (isLightTheme()) {
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

// ---- Theme -----------------------------------------------------------------
// One attribute on <html> drives every colour rule in the stylesheet. Defaults
// to the visitor's system setting; an explicit choice is remembered.
const THEME_KEY = "ska-theme";
const modeToggle = document.getElementById("modeToggle");
const modeImage = document.getElementById("modeImage");

function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (e) {
    return null;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const light = theme === "light";
  modeToggle.setAttribute("aria-pressed", light ? "true" : "false");
  modeToggle.title = light ? "Switch to dark mode" : "Switch to light mode";
  modeImage.src = light ? "/img/dark_mode.png" : "/img/sun_white.png";
  document.querySelectorAll(".gitImage").forEach(function (element) {
    element.src = light ? "/img/github-mark.png" : "/img/github-mark-white.png";
  });
}

const systemLight = window.matchMedia("(prefers-color-scheme: light)");
applyTheme(storedTheme() || (systemLight.matches ? "light" : "dark"));

systemLight.addEventListener("change", function (event) {
  if (!storedTheme()) {
    applyTheme(event.matches ? "light" : "dark");
  }
});

modeToggle.addEventListener("click", function () {
  const next =
    document.documentElement.getAttribute("data-theme") === "light"
      ? "dark"
      : "light";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (e) {
    /* private browsing: the choice just won't survive a reload */
  }
});

function isLightTheme() {
  return document.documentElement.getAttribute("data-theme") === "light";
}

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
        if (response.status !== 200) {
          throw new Error(`web3forms responded ${response.status}`);
        }
        reset2();
        setFormStatus("Thanks -- your message is on its way.");
      })
      .catch(function () {
        setFormStatus(
          "That didn't send. Please try again, or reach me on LinkedIn.",
          true
        );
      });

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
if (reducedMotion) {
  cursorCircle.style.display = "none";
}

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

// Keeps the address out of the markup -- the form still tells you what happened.
function setFormStatus(message, isError) {
  const status = document.getElementById("formStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("formStatus--error", Boolean(isError));
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isMobileDevice() && !reducedMotion) {
    const sliderContainer = document.querySelector(".marqueeSlider");
    const marqueeContainers = document.querySelectorAll(
      ".marqueeSlider .singleProject"
    );
    sliderContainer.style.gridTemplateColumns = `repeat(${marqueeContainers.length}, 1fr)`;
    const marqueeWidth = 620;
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
  if (!isMobileDevice() && !reducedMotion) {
    const sliderContainer = document.querySelector(".marqueeSliderArt");
    const marqueeContainers = document.querySelectorAll(
      ".marqueeSliderArt .singleProject"
    );
    sliderContainer.style.gridTemplateColumns = `repeat(${marqueeContainers.length}, 1fr)`;
    const marqueeWidth = 620;
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

if (!reducedMotion) {
  animateMenuButton();
  setInterval(animateMenuButton, 6000);
}

const skill_descriptions = {
  Python:
    "Data engineering, instrument communication and data acquisition, GUI development, dashboard creation, simple game development, and web API management. NumPy and Pandas for analysis; PyTorch and TensorFlow for models.",
  C: "Coded several problems from scratch, including tree balancing, Dijkstra's Algorithm, Sudoku solving, among others.",
  LaTeX:
    "Took notes for classes (alongside a friend), as well as developed several reports and assignments. Check out the repository!",
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
    "Learned it with the rest of the WebDev stack, but I know there is a lot more it can offer that I don't know. I had a lot of fun designing the landing page for this website though. I was also given the responsibility of modifying and maintaining a few websites in one of my research teams.",
  Arduino:
    "My first embedded language. Can use it's in-built tools, but I have used it less now that I can use higher-end microcontrollers.",
  Altium:
    "Outlined the circuit architecture and designed the initial PCB prototypes for AirVolt, the wireless voltage-sensing project at the Wireless Sensing Lab.",
  SQL:
    "Pulled and joined data from production SQL databases at Micron to build lifespan and life-expectancy analyses for DRAM components.",
  RISCV:
    "Coursework and project work on multicore processor design, writing and verifying modules against the RISC-V ISA.",
  PyTorch:
    "Trained and evaluated models in both: baseline benchmarks and a VGGNet-based efficiency predictor for photonic inverse design, and a time-agnostic classifier for small materials datasets.",
  LTSpice:
    "Once again, I have used this for circuit simulations. These circuits have been mostly composed of linear components. Used it in some of my classes, as well as to help understand what I am doing in my research projects.",
  Kotlin:
    "Took a basic course in Kotlin for AppDev, but I don't think I know enough to make an actual app with any use.",
  AStudio:
    "Same as Kotlin, learned it for AppDev, but I am not familiar enough to make an app with it.",
  ML: "Trained four baseline models to benchmark an inverse-design framework, built a VGGNet-based network that replaces an electromagnetic solver and cuts efficiency evaluation time by over 100x, and trained a time-agnostic model reaching 97% classification accuracy on small materials datasets.",
  THSoldering:
    "Several years of experience with through-hole soldering. Have also taught dozens of people how to solder.",
  SMD: "Less experience than through-hole soldering, but still notable. Some challenges I have faced are: an 0402 RF module with 6 ball pins and recreating a broken trace on a copper PCB with no mask.",
  TroubleShooting:
    "I can troubleshoot PCBs with basic techniques like continuity checking and parameter measurements.",
  Design:
    "Learned a lot of digital circuit design with my senior design project. Learning more with FiberCircuits",
  Sensor:
    "I am taking a course on sensor design, goal is to go from raw materials to digital signals.",
  Milling:
    "Milled up to two layer PCBs on an AccurateCNC PCB Mill, using their proprietary software.",
  EPlating:
    "I know how this works, I have made the solute for it, and I have electroplated (albeit unevenly) some 3D printed objects.",
  Haptics:
    "Taking a course on Haptic Systems. Also, developing haptic taxels at VESL, and exploring electrostimulation with FiberCircuits.",
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
  PublicSpeaking:
    "I love public speaking, there is something about standing in front of people that just calls to me.",
  Climbing: "I love climbing trees, rocks, and challenges.",
  Dancing:
    "I am not embarrassed to love freestyle dance. I see it as a form of expression.",
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



const projectContainers = document.querySelectorAll('.projectType');

projectContainers.forEach(container => {
    const numChildren = container.children.length;

    if (numChildren < 5 && !isMobileDevice()) {
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${numChildren}, 1fr)`;

        const dynamicWidth = 120 / (numChildren + 1);
        
        // Select both images and videos at once
        const mediaElements = container.querySelectorAll('div a img, div a video');
        
        // Vertical centring and equal card heights are handled in CSS; this
        // only has to set the width the media should render at.
        mediaElements.forEach(media => {
            media.style.width = `${dynamicWidth}vw`;
            media.style.height = 'auto'; // Ensure aspect ratio is maintained
        });

    }
});