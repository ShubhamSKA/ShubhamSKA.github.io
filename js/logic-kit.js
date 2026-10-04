// Shared pieces for the three logic figures on the Cadence pages (Manchester
// adder, Wallace tree multiplier, flash ADC): SVG helpers, bit cells, moving
// tokens, a run clock that a new run can cancel, and the input bar.
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function text(str, attrs, parent) {
    var t = el("text", attrs, parent);
    t.textContent = str;
    return t;
  }

  // Class names v1 / v0 for a known bit, none while it is unknown.
  function setBit(node, v) {
    node.classList.remove("v0", "v1");
    if (v === 0 || v === 1) node.classList.add("v" + v);
  }

  // A square cell holding one bit.
  function cell(x, y, size, parent) {
    var g = el("g", { class: "cell", transform: "translate(" + x + "," + y + ")" }, parent);
    el("rect", { x: -size / 2, y: -size / 2, width: size, height: size, rx: 3 }, g);
    var t = text("–", { x: 0, y: 0.5 }, g);
    return {
      g: g,
      set: function (v) {
        setBit(g, v);
        t.textContent = v === 0 || v === 1 ? String(v) : "–";
      },
    };
  }

  // A small dot that travels between points carrying a value.
  function token(parent) {
    var g = el("g", { class: "token", opacity: 0 }, parent);
    el("circle", { r: 5.5 }, g);
    var pos = [0, 0];
    function place(x, y) {
      pos = [x, y];
      g.style.transform = "translate(" + x + "px," + y + "px)";
    }
    return {
      g: g,
      // Jump to a point without animating, then show it carrying v.
      start: function (x, y, v) {
        g.style.transition = "none";
        place(x, y);
        setBit(g, v);
        g.getBoundingClientRect();
        g.style.transition = "";
        g.setAttribute("opacity", 1);
      },
      to: function (x, y, ms) {
        g.style.transitionDuration = (reduce ? 0 : ms) + "ms";
        place(x, y);
      },
      hide: function () {
        g.setAttribute("opacity", 0);
      },
      at: function () {
        return pos;
      },
    };
  }

  // Each run gets a clock; starting a new run makes every wait in the old one
  // throw, so stale animations stop where they are.
  function Runner() {
    var gen = 0;
    return {
      start: function () {
        gen++;
        var mine = gen;
        return {
          wait: function (ms) {
            return new Promise(function (resolve, reject) {
              setTimeout(function () {
                if (mine !== gen) reject(new Error("superseded"));
                else resolve();
              }, reduce ? 0 : ms);
            });
          },
          live: function () {
            return mine === gen;
          },
        };
      },
    };
  }

  // A byte typed in hex, as the reports' testbenches write them (BB or 0xBB).
  function parseHexByte(s) {
    s = String(s).trim().replace(/^0x/i, "");
    if (!/^[0-9a-f]{1,2}$/i.test(s)) return null;
    return parseInt(s, 16);
  }

  function hex(n, digits) {
    var s = n.toString(16).toUpperCase();
    while (s.length < digits) s = "0" + s;
    return s;
  }

  // The bar of inputs above a figure. fields: [{key, label, kind, value, ...}]
  function bar(stage, fields, buttons) {
    var form = document.createElement("form");
    form.className = "logicBar";
    form.setAttribute("novalidate", "");
    var inputs = {};
    fields.forEach(function (f) {
      var label = document.createElement("label");
      if (f.kind === "check") label.className = "check";
      var input = document.createElement("input");
      if (f.kind === "check") {
        input.type = "checkbox";
        input.checked = !!f.value;
        label.appendChild(input);
        label.appendChild(document.createTextNode(f.label));
      } else {
        label.appendChild(document.createTextNode(f.label));
        input.type = f.kind || "text";
        input.value = f.value;
        input.autocomplete = "off";
        input.spellcheck = false;
        ["min", "max", "step", "maxLength", "inputMode"].forEach(function (k) {
          if (f[k] != null) input[k] = f[k];
        });
        label.appendChild(input);
      }
      inputs[f.key] = input;
      form.appendChild(label);
    });
    var row = document.createElement("div");
    row.className = "buttons";
    var made = {};
    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = b.submit ? "submit" : "button";
      btn.textContent = b.label;
      if (!b.submit) btn.addEventListener("click", b.onClick);
      made[b.key] = btn;
      row.appendChild(btn);
    });
    form.appendChild(row);
    stage.appendChild(form);
    var readout = document.createElement("p");
    readout.className = "logicReadout";
    readout.setAttribute("aria-live", "polite");
    stage.appendChild(readout);
    return { form: form, inputs: inputs, buttons: made, readout: readout };
  }

  // Play once when the figure first scrolls into view.
  function onFirstView(fig, fn) {
    if (!("IntersectionObserver" in window)) {
      fn();
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        io.disconnect();
        fn();
      }
    }, { threshold: 0.35 });
    io.observe(fig);
  }

  window.LogicKit = {
    el: el,
    text: text,
    setBit: setBit,
    cell: cell,
    token: token,
    Runner: Runner,
    parseHexByte: parseHexByte,
    hex: hex,
    bar: bar,
    onFirstView: onFirstView,
    reduce: reduce,
  };
})();
