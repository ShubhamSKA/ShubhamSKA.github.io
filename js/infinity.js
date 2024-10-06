const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const body2 = document.querySelector("body");
body2.style.overflowY = "hidden";

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

//ctx.imageSmoothingEnabled = false;

document.addEventListener("mousemove", handleMouseMove);
let cursorPosition = { x: 0, y: 0, prevX: 0, prevY: 0 };
const loadTime = new Date();
const loadButton = document.querySelector(".loadButton");

loadButton.style.top = `${
  (window.innerHeight - loadButton.offsetHeight) / 2
}px`;
loadButton.style.left = `${(window.innerWidth - loadButton.offsetWidth) / 2}px`;

function handleResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  loadButton.style.top = `${
    (window.innerHeight - loadButton.offsetHeight) / 2
  }px`;
  loadButton.style.left = `${
    (window.innerWidth - loadButton.offsetWidth) / 2
  }px`;
}
window.addEventListener("resize", handleResize);

let opacity = 0;

loadButton.addEventListener("click", function () {
  body2.style.overflowY = "auto";
  const decreaseOpacityInterval = setInterval(function () {
    opacity -= 0.02;
    canvas.style.opacity = `${opacity}`;
    loadButton.style.opacity = `${opacity}`;
    if (opacity <= 0) {
      clearInterval(decreaseOpacityInterval);
      canvas.style.display = "none";
    }
  }, 10);

  setTimeout(function () {
    loadButton.classList.add("Loaded");
    loadButton.style.visibility = "hidden";
    loadButton.style.display = "none";
    loadButton.style.right = "10000px";
  }, 3000);
});

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
];

let functionNum =
  (loadTime.getSeconds() * (graphFunctions.length + 1)*(loadTime.getMilliseconds() % 761)) % graphFunctions.length;
let extraPar = 1;

const extraParValues = [
  [loadTime.getMilliseconds() / 1000 + 1],
  [(loadTime.getMilliseconds() % 9) / 2 + 1.5],
  [0, Math.PI / 2],
  [1],
  [(loadTime.getMilliseconds() % 80) / 10 + 3],
  [(loadTime.getMilliseconds() % 99) / 100 + 0.01],
  [(loadTime.getMilliseconds() % 50) / 25 + 0.01],
  [(loadTime.getMilliseconds() % 80) / 10 + 3],
];

extraPar =
  extraParValues[functionNum][
    (loadTime.getMilliseconds()%997) % [extraParValues[functionNum].length]
  ];

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
  const x = (16 * Math.sin(t) * Math.sin(t) * Math.sin(t)) / 20;
  const y =
    -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      1 * Math.cos(4 * t)
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
    if (t === 0) {
      console.log(functionNum);
      console.log(extraPar);
    }
    for (let i = 0; i < whiteElements.length; i++) {
      let whiteElement = whiteElements[i];
      let angle = t + i;

      whiteElement.targetX =
        speed * (1 / increment) * graphFunctions[functionNum](angle).x +
        canvas.width / 2;
      whiteElement.targetY =
        speed * (1 / increment) * graphFunctions[functionNum](angle).y +
        canvas.height / 2;

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

    if (!loadButton.classList.contains("Loaded")) {
      requestAnimationFrame(moveWhiteElements);
    }
  }
}

moveWhiteElements();

let increaseOpacityInterval;
increaseOpacityInterval = setInterval(function () {
  const currentTime = new Date();
  const timeElapsed =
    currentTime.getMinutes() * 60 +
    currentTime.getSeconds() -
    loadTime.getMinutes() * 60 -
    loadTime.getSeconds();
  if (
    timeElapsed > 7 &&
    !loadButton.classList.contains("Loaded") &&
    opacity < 1
  ) {
    opacity += 0.05;
    loadButton.style.opacity = `${opacity}`;
    if (opacity >= 1) {
      clearInterval(increaseOpacityInterval);
    }
  }
}, 50);

function hoverEffect(element) {
  let intervalId; // variable to store the interval ID
  if (!loadButton.classList.contains("Loaded")) {
    element.addEventListener("mouseover", function () {
      intervalId = setInterval(function () {
        element.style.color = `hsl(${color}, 100%, 75%)`;
        element.style.borderColor = `hsl(${color}, 100%, 75%)`;
      }, 10);
    });

    element.addEventListener("mouseout", function () {
      clearInterval(intervalId); // Stop the interval when mouse leaves
      element.style.color = "white";
      element.style.borderColor = "white";
    });
  }
}

hoverEffect(loadButton);
