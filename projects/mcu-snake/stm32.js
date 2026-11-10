/* An STM32F091RC, as far as the 2-player snake firmware needs one: a Cortex-M0 core that
   runs the compiled firmware instruction by instruction, plus models of the peripherals the
   firmware touches (RCC, GPIO, EXTI, TIM6, TIM15, USART1, SPI1) and the ILI9341 LCD on SPI1.

   Two of these are wired together by a Link the way the real boards were: PA6 of each to
   PA8 of the other, and USART1 TX (PB6) of each to RX (PB7) of the other.

   Time is counted in CPU cycles at 48 MHz. Peripherals do not tick; each one works out when
   its next event is due (a timer update, the end of a UART frame) and the core runs up to
   that moment, so a board asleep in `wfi` costs nothing until something wakes it.

   Works in the browser (window.Stm32) and in Node (module.exports) for headless tests. */

(function (root) {
  "use strict";

  var HZ = 48000000;
  var FLASH_BASE = 0x08000000, FLASH_SIZE = 0x40000;
  var RAM_BASE = 0x20000000, RAM_SIZE = 0x8000;

  function hex(v, n) { return "0x" + (v >>> 0).toString(16).padStart(n || 8, "0"); }

  function Fault(msg) { this.message = msg; }

  /* ------------------------------------------------------------------ GPIO ---- */

  function Gpio(mcu, port, moder, pupdr) {
    this.mcu = mcu; this.port = port;
    this.resetModer = moder; this.resetPupdr = pupdr;
    this.ext = 0; this.extMask = 0;        // levels driven onto pins from outside the chip
    this.reset();
  }
  Gpio.prototype.reset = function () {
    this.moder = this.resetModer; this.otyper = 0; this.ospeedr = 0; this.pupdr = this.resetPupdr;
    this.odr = 0; this.afr0 = 0; this.afr1 = 0; this.lckr = 0;
    this.lastIdr = this.idr(); this.lastOut = this.outputs();
  };
  Gpio.prototype.idr = function () {
    var v = 0;
    for (var p = 0; p < 16; p++) {
      var mode = (this.moder >>> (2 * p)) & 3, bit = 1 << p, level;
      if (mode === 1) level = this.odr & bit;
      else if (this.extMask & bit) level = this.ext & bit;
      else level = ((this.pupdr >>> (2 * p)) & 3) === 1 ? bit : 0;   // pull-up reads high, pull-down / floating low
      v |= level;
    }
    return v;
  };
  // Levels this port drives out: bit set in `mask` when the pin is a push-pull output.
  Gpio.prototype.outputs = function () {
    var mask = 0;
    for (var p = 0; p < 16; p++) if (((this.moder >>> (2 * p)) & 3) === 1) mask |= 1 << p;
    return { mask: mask, level: this.odr & mask };
  };
  Gpio.prototype.changed = function () {
    var idr = this.idr(), diff = idr ^ this.lastIdr;
    if (diff) { this.mcu.exti.inputChanged(this.port, diff, idr); this.lastIdr = idr; }
    var out = this.outputs();
    if (out.mask !== this.lastOut.mask || out.level !== this.lastOut.level) {
      var was = this.lastOut; this.lastOut = out;
      this.mcu.pinsChanged(this.port, was, out);
    }
  };
  Gpio.prototype.setExternal = function (pin, level) {   // level: 1, 0 or null (not driven)
    var bit = 1 << pin;
    if (level === null) this.extMask &= ~bit; else { this.extMask |= bit; this.ext = level ? (this.ext | bit) : (this.ext & ~bit); }
    this.changed();
  };
  Gpio.prototype.read = function (off) {
    switch (off) {
      case 0x00: return this.moder;
      case 0x04: return this.otyper;
      case 0x08: return this.ospeedr;
      case 0x0C: return this.pupdr;
      case 0x10: return this.idr();
      case 0x14: return this.odr;
      case 0x1C: return this.lckr;
      case 0x20: return this.afr0;
      case 0x24: return this.afr1;
      default: return 0;                                     // BSRR, BRR are write-only
    }
  };
  Gpio.prototype.write = function (off, v) {
    switch (off) {
      case 0x00: this.moder = v >>> 0; break;
      case 0x04: this.otyper = v & 0xFFFF; break;
      case 0x08: this.ospeedr = v >>> 0; break;
      case 0x0C: this.pupdr = v >>> 0; break;
      case 0x14: this.odr = v & 0xFFFF; break;
      case 0x18: this.odr = (this.odr & ~(v >>> 16)) | (v & 0xFFFF); break;   // reset bits, then set bits win
      case 0x1C: this.lckr = v >>> 0; return;
      case 0x20: this.afr0 = v >>> 0; return;
      case 0x24: this.afr1 = v >>> 0; return;
      case 0x28: this.odr &= ~(v & 0xFFFF); break;
      default: return;
    }
    this.changed();
  };

  /* ------------------------------------------------------- EXTI and SYSCFG ---- */

  function Exti(mcu) { this.mcu = mcu; this.reset(); }
  Exti.prototype.reset = function () {
    this.imr = 0x0FF40000; this.emr = 0; this.rtsr = 0; this.ftsr = 0; this.pr = 0;
    this.exticr = [0, 0, 0, 0];
  };
  Exti.prototype.inputChanged = function (port, diff, idr) {
    for (var line = 0; line < 16; line++) {
      var bit = 1 << line;
      if (!(diff & bit)) continue;
      if (((this.exticr[line >> 2] >>> (4 * (line & 3))) & 0xF) !== port) continue;
      var rising = !!(idr & bit);
      if ((rising && (this.rtsr & bit)) || (!rising && (this.ftsr & bit))) this.pr |= bit;
    }
    this.irq();
  };
  Exti.prototype.irq = function () {
    var on = this.pr & this.imr;
    this.mcu.setIrq(5, !!(on & 0x0003));
    this.mcu.setIrq(6, !!(on & 0x000C));
    this.mcu.setIrq(7, !!(on & 0xFFF0));
  };
  Exti.prototype.read = function (off) {
    switch (off) {
      case 0x00: return this.imr; case 0x04: return this.emr; case 0x08: return this.rtsr;
      case 0x0C: return this.ftsr; case 0x14: return this.pr; default: return 0;
    }
  };
  Exti.prototype.write = function (off, v) {
    switch (off) {
      case 0x00: this.imr = v >>> 0; break; case 0x04: this.emr = v >>> 0; break;
      case 0x08: this.rtsr = v >>> 0; break; case 0x0C: this.ftsr = v >>> 0; break;
      case 0x10: this.pr |= v & this.imr; break;               // SWIER
      case 0x14: this.pr &= ~v; break;                          // write 1 to clear
    }
    this.irq();
  };

  function Syscfg(mcu) { this.mcu = mcu; this.reset(); }
  Syscfg.prototype.reset = function () { this.cfgr1 = 0; };
  Syscfg.prototype.read = function (off) {
    if (off === 0) return this.cfgr1;
    if (off >= 0x08 && off <= 0x14) return this.mcu.exti.exticr[(off - 8) >> 2];
    return 0;
  };
  Syscfg.prototype.write = function (off, v) {
    if (off === 0) this.cfgr1 = v >>> 0;
    else if (off >= 0x08 && off <= 0x14) this.mcu.exti.exticr[(off - 8) >> 2] = v & 0xFFFF;
  };

  /* ----------------------------------------------------------------- RCC ---- */

  function Rcc(mcu) { this.mcu = mcu; this.reset(); }
  Rcc.prototype.reset = function () {
    this.r = { 0x00: 0x00000083, 0x04: 0, 0x08: 0, 0x0C: 0, 0x10: 0, 0x14: 0x14, 0x18: 0, 0x1C: 0,
               0x20: 0, 0x24: 0x0C000000, 0x28: 0, 0x2C: 0, 0x30: 0, 0x34: 0x80 };
  };
  Rcc.prototype.read = function (off) {
    var v = this.r[off] || 0;
    if (off === 0x00) {                                         // CR: oscillators are ready as soon as they are on
      v &= ~((1 << 1) | (1 << 17) | (1 << 25));
      if (v & (1 << 0)) v |= 1 << 1;
      if (v & (1 << 16)) v |= 1 << 17;
      if (v & (1 << 24)) v |= 1 << 25;
    } else if (off === 0x04) {                                  // CFGR: SWS follows SW
      v = (v & ~0xC) | ((v & 3) << 2);
    } else if (off === 0x34) {                                  // CR2: HSI14 and HSI48 ready likewise
      v &= ~((1 << 1) | (1 << 17));
      if (v & 1) v |= 1 << 1;
      if (v & (1 << 16)) v |= 1 << 17;
    }
    return v >>> 0;
  };
  Rcc.prototype.write = function (off, v) { this.r[off] = v >>> 0; };

  function Plain() { this.r = {}; }                             // registers that only need to hold a value
  Plain.prototype.reset = function () { this.r = {}; };
  Plain.prototype.read = function (off) { return this.r[off] || 0; };
  Plain.prototype.write = function (off, v) { this.r[off] = v >>> 0; };

  /* ---------------------------------------------------- basic timers (16 bit) ---- */

  function Timer(mcu, irq, name) { this.mcu = mcu; this.irqNum = irq; this.name = name; this.reset(); }
  Timer.prototype.reset = function () {
    this.cr1 = 0; this.dier = 0; this.sr = 0; this.psc = 0; this.pscActive = 0; this.arr = 0xFFFF;
    this.cnt0 = 0; this.t0 = 0; this.next = Infinity;
  };
  Timer.prototype.period = function () { return this.pscActive + 1; };
  // Bring cnt0/t0 up to `t`, keeping the prescaler's phase.
  Timer.prototype.rebase = function (t) {
    if (!(this.cr1 & 1)) return;
    var k = Math.floor((t - this.t0) / this.period());
    this.cnt0 = (this.cnt0 + k) & 0xFFFF; this.t0 += k * this.period();
  };
  Timer.prototype.schedule = function () {
    if (!(this.cr1 & 1) || this.arr === 0) this.next = Infinity;
    else {
      // The update event comes when the counter passes ARR. If it is already above ARR it
      // runs on to 0xFFFF, wraps, and comes back up.
      var ticks = this.cnt0 <= this.arr ? this.arr - this.cnt0 + 1 : 0x10000 - this.cnt0 + this.arr + 1;
      this.next = this.t0 + ticks * this.period();
    }
    this.mcu.reschedule();
  };
  Timer.prototype.update = function (t) {                       // update event: counter to 0, PSC preload taken
    this.cnt0 = 0; this.t0 = t; this.pscActive = this.psc;
    this.sr |= 1;
    this.irq(); this.schedule();
  };
  Timer.prototype.event = function (t) { this.update(t); };
  Timer.prototype.irq = function () { this.mcu.setIrq(this.irqNum, !!(this.sr & this.dier & 1)); };
  Timer.prototype.cnt = function () {
    if (!(this.cr1 & 1)) return this.cnt0;
    return (this.cnt0 + Math.floor((this.mcu.cycles - this.t0) / this.period())) & 0xFFFF;
  };
  Timer.prototype.read = function (off) {
    switch (off) {
      case 0x00: return this.cr1; case 0x0C: return this.dier; case 0x10: return this.sr;
      case 0x24: return this.cnt(); case 0x28: return this.psc; case 0x2C: return this.arr;
      default: return 0;
    }
  };
  Timer.prototype.write = function (off, v) {
    var now = this.mcu.cycles;
    switch (off) {
      case 0x00:
        this.rebase(now);
        var was = this.cr1 & 1;
        this.cr1 = v & 0x3FF;
        if (!was && (this.cr1 & 1)) this.t0 = now;
        this.schedule(); break;
      case 0x0C: this.dier = v & 0xFFFF; this.irq(); break;
      case 0x10: this.sr &= v; this.irq(); break;               // rc_w0
      case 0x14: if (v & 1) this.update(now); break;            // UG
      case 0x24: this.rebase(now); this.cnt0 = v & 0xFFFF; this.schedule(); break;
      case 0x28: this.psc = v & 0xFFFF; break;                  // buffered until the next update event
      case 0x2C: this.rebase(now); this.arr = v & 0xFFFF; this.schedule(); break;   // ARPE off: takes effect now
    }
  };

  /* --------------------------------------------------------------- USART1 ---- */

  function Usart(mcu, irq) { this.mcu = mcu; this.irqNum = irq; this.reset(); }
  Usart.prototype.reset = function () {
    this.cr1 = 0; this.cr2 = 0; this.cr3 = 0; this.brr = 0;
    this.rdr = 0; this.tdr = 0; this.rxne = 0; this.ore = 0; this.txe = 1; this.tc = 1;
    this.tdrFull = false; this.shiftEnd = 0; this.next = Infinity; this.sending = null;
  };
  Usart.prototype.on = function () { return this.cr1 & 1; };
  Usart.prototype.frameCycles = function () {                 // 1 start + 8 data + 1 stop, 16x oversampling
    var bit = (this.cr1 & (1 << 15)) ? ((this.brr & 0xFFF0) | ((this.brr & 7) << 1)) : this.brr;
    return 10 * Math.max(bit, 16);
  };
  Usart.prototype.isr = function () {
    var te = this.on() && (this.cr1 & 8), re = this.on() && (this.cr1 & 4);
    var busy = this.mcu.cycles < this.shiftEnd;
    return (this.ore << 3) | (this.rxne << 5) | (this.tc << 6) | (this.txe << 7) |
      (busy ? 1 << 16 : 0) | (te ? 1 << 21 : 0) | (re ? 1 << 22 : 0);
  };
  Usart.prototype.irq = function () {
    var c = this.cr1;
    this.mcu.setIrq(this.irqNum, !!(((c & (1 << 5)) && (this.rxne || this.ore)) ||
      ((c & (1 << 7)) && this.txe) || ((c & (1 << 6)) && this.tc)));
  };
  Usart.prototype.startFrame = function (t) {
    var byte = this.tdr & 0xFF;
    this.tdrFull = false; this.txe = 1;
    this.shiftEnd = t + this.frameCycles();
    this.next = this.shiftEnd; this.mcu.reschedule();
    this.mcu.uartSent(byte, t, this.shiftEnd);
  };
  Usart.prototype.event = function (t) {                      // the frame on the wire has finished
    this.next = Infinity;
    if (this.tdrFull) this.startFrame(t); else this.tc = 1;
    this.irq(); this.mcu.reschedule();
  };
  Usart.prototype.receive = function (byte) {
    if (!(this.on() && (this.cr1 & 4))) return;
    if (this.rxne) this.ore = 1;                               // overrun: the new byte is lost
    else { this.rdr = byte; this.rxne = 1; }
    this.irq();
  };
  Usart.prototype.read = function (off) {
    switch (off) {
      case 0x00: return this.cr1; case 0x04: return this.cr2; case 0x08: return this.cr3;
      case 0x0C: return this.brr; case 0x1C: return this.isr();
      case 0x24: var v = this.rdr; this.rxne = 0; this.irq(); return v;
      case 0x28: return this.tdr;
      default: return 0;
    }
  };
  Usart.prototype.write = function (off, v) {
    var now = this.mcu.cycles;
    switch (off) {
      case 0x00:
        var teWas = this.on() && (this.cr1 & 8);
        this.cr1 = v >>> 0;
        if (!teWas && this.on() && (this.cr1 & 8) && now >= this.shiftEnd) {
          // Enabling the transmitter sends one idle frame first.
          this.shiftEnd = now + this.frameCycles(); this.next = this.shiftEnd; this.tc = 0; this.mcu.reschedule();
        }
        break;
      case 0x04: this.cr2 = v >>> 0; break;
      case 0x08: this.cr3 = v >>> 0; break;
      case 0x0C: this.brr = v & 0xFFFF; break;
      case 0x18: if (v & 8) this.rxne = 0; break;              // RQR: RXFRQ
      case 0x20: if (v & 8) this.ore = 0; if (v & 0x40) this.tc = 0; break;
      case 0x28:
        this.tdr = v & 0x1FF;
        if (!(this.on() && (this.cr1 & 8))) break;
        this.txe = 0; this.tc = 0;
        if (now >= this.shiftEnd) this.startFrame(now); else this.tdrFull = true;
        break;
    }
    this.irq();
  };

  /* ------------------------------------------------------------------ SPI1 ---- */

  function Spi(mcu) { this.mcu = mcu; this.reset(); }
  Spi.prototype.reset = function () {
    this.cr1 = 0; this.cr2 = 0x0700; this.fifo = []; this.fifoBytes = 0; this.shiftEnd = 0;
  };
  Spi.prototype.bits = function () { return ((this.cr2 >>> 8) & 0xF) + 1; };
  Spi.prototype.div = function () { return 2 << ((this.cr1 >>> 3) & 7); };
  Spi.prototype.advance = function (now) {                      // move frames from the TX FIFO into the shifter
    while (this.fifo.length) {
      var f = this.fifo[0], start = Math.max(this.shiftEnd, f.t);
      if (start > now) break;
      this.shiftEnd = start + f.cycles; this.fifo.shift(); this.fifoBytes -= f.bytes;
    }
  };
  // When TXE (TX FIFO at most half full) next becomes true.
  Spi.prototype.txeTime = function () {
    var t = this.shiftEnd, bytes = this.fifoBytes;
    for (var i = 0; i < this.fifo.length && bytes > 2; i++) {
      var f = this.fifo[i], start = Math.max(t, f.t);
      bytes -= f.bytes; t = start + f.cycles;
      if (bytes <= 2) return start;
    }
    return t;
  };
  Spi.prototype.sr = function () {
    var now = this.mcu.cycles;
    this.advance(now);
    if (this.fifoBytes > 2) {
      // A firmware loop polling TXE would spin until it sets; let the core skip to that moment
      // (or to its next event, whichever is first) instead of interpreting every spin.
      this.mcu.stallUntil(this.txeTime());
      now = this.mcu.cycles; this.advance(now);
    }
    var busy = (this.cr1 & 0x40) && (now < this.shiftEnd || this.fifo.length > 0);
    var ftlvl = Math.min(3, this.fifoBytes);
    return (this.fifoBytes <= 2 ? 2 : 0) | (busy ? 0x80 : 0) | (ftlvl << 11);
  };
  Spi.prototype.read = function (off) {
    switch (off) { case 0x00: return this.cr1; case 0x04: return this.cr2; case 0x08: return this.sr(); default: return 0; }
  };
  Spi.prototype.push = function (bytes, bits) {
    var now = this.mcu.cycles;
    this.advance(now);
    this.fifo.push({ t: now, cycles: bits * this.div(), bytes: bytes.length });
    this.fifoBytes += bytes.length;
    this.mcu.spiFrame(bytes);
  };
  Spi.prototype.write = function (off, v, size) {
    switch (off) {
      case 0x00: this.cr1 = v & 0xFFFF; break;
      case 0x04:
        var ds = (v >>> 8) & 0xF;
        if (ds < 3) ds = 7;                                      // reserved sizes fall back to 8 bit
        this.cr2 = (v & 0xF0FF) | (ds << 8); break;
      case 0x0C:
        if (!(this.cr1 & 0x40)) break;
        var bits = this.bits();
        if (bits > 8) this.push([(v >>> 8) & 0xFF, v & 0xFF], bits);
        else if (size === 1) this.push([v & 0xFF], bits);
        else { this.push([v & 0xFF], bits); this.push([(v >>> 8) & 0xFF], bits); }   // data packing
        break;
    }
  };

  /* --------------------------------------------------------------- ILI9341 ---- */

  function Lcd() {
    this.W = 240; this.H = 320;
    this.fb = new Uint16Array(this.W * this.H);
    for (var i = 0; i < this.fb.length; i++) this.fb[i] = (Math.random() * 0x10000) | 0;   // GRAM at power-up
    this.dirty = true; this.powered = false;
    this.hardReset();
  }
  Lcd.prototype.hardReset = function () {
    this.cmd = -1; this.args = []; this.on = false; this.awake = false; this.madctl = 0;
    this.xs = 0; this.xe = 239; this.ys = 0; this.ye = 319; this.x = 0; this.y = 0;
    this.hi = -1; this.dirty = true;
  };
  Lcd.prototype.visible = function () { return this.powered && this.on && this.awake; };
  Lcd.prototype.byte = function (b, dc) {
    if (!dc) {                                                  // command
      this.cmd = b; this.args = []; this.hi = -1;
      switch (b) {
        case 0x01: this.hardReset(); break;
        case 0x10: this.awake = false; this.dirty = true; break;
        case 0x11: this.awake = true; this.dirty = true; break;
        case 0x28: this.on = false; this.dirty = true; break;
        case 0x29: this.on = true; this.dirty = true; break;
        case 0x2C: this.x = this.xs; this.y = this.ys; break;
      }
      return;
    }
    if (this.cmd === 0x2C) {                                    // pixel data, 16 bit, high byte first
      if (this.hi < 0) { this.hi = b; return; }
      this.pixel((this.hi << 8) | b); this.hi = -1; return;
    }
    this.args.push(b);
    var a = this.args;
    if (this.cmd === 0x2A && a.length === 4) { this.xs = (a[0] << 8) | a[1]; this.xe = (a[2] << 8) | a[3]; }
    else if (this.cmd === 0x2B && a.length === 4) { this.ys = (a[0] << 8) | a[1]; this.ye = (a[2] << 8) | a[3]; }
    else if (this.cmd === 0x36 && a.length === 1) this.madctl = b;
  };
  Lcd.prototype.pixel = function (c) {
    var col = this.x, row = this.y, m = this.madctl, px, py;
    if (m & 0x20) { px = row; py = col; } else { px = col; py = row; }
    if (m & 0x40) px = this.W - 1 - px;
    if (m & 0x80) py = this.H - 1 - py;
    if (px >= 0 && px < this.W && py >= 0 && py < this.H) { this.fb[py * this.W + px] = c; this.dirty = true; }
    if (++this.x > this.xe) { this.x = this.xs; if (++this.y > this.ye) this.y = this.ys; }
  };

  /* ------------------------------------------------------------ the chip ---- */


  function Mcu(firmware, name) {
    this.name = name;
    this.flash = new Uint8Array(FLASH_SIZE).fill(0xFF);
    this.flash.set(new Uint8Array(firmware));
    this.f16 = new Uint16Array(this.flash.buffer);
    this.f32 = new Uint32Array(this.flash.buffer);
    this.ram = new Uint8Array(RAM_SIZE);
    this.r16 = new Uint16Array(this.ram.buffer);
    this.r32 = new Uint32Array(this.ram.buffer);
    this.r = new Uint32Array(16);
    this.cycles = 0;
    this.events = [];                                           // [{t, fn}] from outside: wire deliveries
    this.lcd = new Lcd();
    this.gpio = [new Gpio(this, 0, 0x28000000, 0x24000000), new Gpio(this, 1, 0, 0), new Gpio(this, 2, 0, 0)];
    this.exti = new Exti(this);
    this.syscfg = new Syscfg(this);
    this.rcc = new Rcc(this);
    this.tim6 = new Timer(this, 17, "TIM6");
    this.tim15 = new Timer(this, 20, "TIM15");
    this.usart1 = new Usart(this, 27);
    this.spi1 = new Spi(this);
    this.misc = new Plain();
    this.timed = [this.tim6, this.tim15, this.usart1];
    this.periph = {};
    this.periph[0x40001000] = this.tim6;
    this.periph[0x40010000] = this.syscfg;
    this.periph[0x40010400] = this.exti;
    this.periph[0x40013000] = this.spi1;
    this.periph[0x40013800] = this.usart1;
    this.periph[0x40014000] = this.tim15;
    this.periph[0x40021000] = this.rcc;
    this.periph[0x48000000] = this.gpio[0];
    this.periph[0x48000400] = this.gpio[1];
    this.periph[0x48000800] = this.gpio[2];
    // Hooks for the page.
    this.onUart = null;                                         // (byte, tStart, tEnd)
    this.onPins = null;                                         // (port, was, now)
    this.onWfi = null;                                          // (address)
    this.onHalt = null;
    this.powered = false;
    this.halted = true;
    this.active = []; this.limit = 0;
    this.resetPeripherals();
    this.reschedule();
  }

  Mcu.prototype.powerOn = function (t) {
    this.cycles = t; this.powered = true; this.lcd.powered = true; this.lcd.dirty = true;
    this.ram.fill(0);
    this.reset();
  };
  Mcu.prototype.powerOff = function () {
    this.powered = false; this.halted = true; this.lcd.powered = false; this.lcd.dirty = true;
    this.events = [];
    this.resetPeripherals();
    this.lcd.hardReset();
  };
  Mcu.prototype.resetPeripherals = function () {
    var self = this;
    var was = this.gpio.map(function (g) { return g.lastOut; });
    this.gpio.forEach(function (g) { g.reset(); });
    [this.exti, this.syscfg, this.rcc, this.tim6, this.tim15, this.usart1, this.spi1, this.misc].forEach(function (p) { p.reset(); });
    this.nvicEnabled = 0; this.nvicPending = 0; this.irqLevel = 0;
    this.ipr = new Uint8Array(32); this.shpr2 = 0; this.shpr3 = 0; this.scr = 0;
    this.gpio.forEach(function (g, k) { g.lastIdr = g.idr(); self.pinsChanged(g.port, was[k], g.lastOut); });
  };
  Mcu.prototype.reset = function () {                           // NRST: the chip restarts, the LCD keeps its memory
    this.resetPeripherals();
    this.active = []; this.primask = 0; this.control = 0;
    this.n = 0; this.z = 0; this.c = 0; this.v = 0; this.ipsr = 0;
    this.r.fill(0);
    this.r[13] = this.f32[0] & ~3;
    this.pc = this.f32[1] & ~1;
    this.r[14] = 0xFFFFFFFF;
    this.sleeping = false; this.halted = !this.powered; this.brk = false;
    this.lastWfi = 0;
    this.reschedule();
  };

  /* ---- interrupts ---- */

  Mcu.prototype.setIrq = function (n, level) {
    var bit = 1 << n;
    if (level) {
      if (!(this.irqLevel & bit)) { this.irqLevel |= bit; }
      if (this.active.indexOf(16 + n) < 0) this.nvicPending |= bit;
      this.brk = true;
    } else this.irqLevel &= ~bit;
  };
  Mcu.prototype.priorityOf = function (exc) {
    if (exc === 1) return -3; if (exc === 2) return -2; if (exc === 3) return -1;
    if (exc === 11) return (this.shpr2 >>> 24) & 0xC0;
    if (exc === 14) return (this.shpr3 >>> 16) & 0xC0;
    if (exc === 15) return (this.shpr3 >>> 24) & 0xC0;
    return this.ipr[exc - 16] & 0xC0;
  };
  Mcu.prototype.execPriority = function (withPrimask) {
    var p = 256;
    for (var i = 0; i < this.active.length; i++) p = Math.min(p, this.priorityOf(this.active[i]));
    if (withPrimask && this.primask) p = Math.min(p, 0);
    return p;
  };
  Mcu.prototype.bestPending = function () {
    var cand = this.nvicPending & this.nvicEnabled, best = -1, bp = 999;
    if (!cand) return null;
    for (var i = 0; i < 32; i++) if (cand & (1 << i)) { var p = this.ipr[i] & 0xC0; if (p < bp) { bp = p; best = i; } }
    return { irq: best, pri: bp };
  };
  Mcu.prototype.tryTakeIrq = function () {
    var b = this.bestPending();
    if (!b || b.pri >= this.execPriority(true)) return false;
    this.nvicPending &= ~(1 << b.irq);
    this.enterException(16 + b.irq, this.pc);
    return true;
  };
  Mcu.prototype.xpsr = function () {
    return ((this.n << 31) | (this.z << 30) | (this.c << 29) | (this.v << 28) | (1 << 24) | this.ipsr) >>> 0;
  };
  Mcu.prototype.enterException = function (exc, ret) {
    var r = this.r, sp = r[13], align = (sp >>> 2) & 1;
    var fp = ((sp - 32) & ~4) >>> 0;
    var psr = (this.xpsr() & ~(1 << 9)) | (align << 9);
    r[13] = fp;
    this.write32(fp, r[0]); this.write32(fp + 4, r[1]); this.write32(fp + 8, r[2]); this.write32(fp + 12, r[3]);
    this.write32(fp + 16, r[12]); this.write32(fp + 20, r[14]); this.write32(fp + 24, ret); this.write32(fp + 28, psr);
    r[14] = this.active.length ? 0xFFFFFFF1 : 0xFFFFFFF9;
    this.active.push(exc);
    this.ipsr = exc;
    var vec = this.read32(exc * 4);
    if (!(vec & 1)) { this.halt("vector " + exc + " is not a Thumb address"); return; }
    this.pc = vec & ~1;
    this.sleeping = false;
    this.cycles += 16;
  };
  Mcu.prototype.exceptionReturn = function (exc) {
    var r = this.r, fp = r[13];
    var done = this.active.pop();
    r[0] = this.read32(fp); r[1] = this.read32(fp + 4); r[2] = this.read32(fp + 8); r[3] = this.read32(fp + 12);
    r[12] = this.read32(fp + 16); r[14] = this.read32(fp + 20);
    var pc = this.read32(fp + 24), psr = this.read32(fp + 28);
    r[13] = (fp + 32) | (((psr >>> 9) & 1) << 2);
    this.n = psr >>> 31; this.z = (psr >>> 30) & 1; this.c = (psr >>> 29) & 1; this.v = (psr >>> 28) & 1;
    this.ipsr = psr & 0x3F;
    this.pc = pc & ~1;
    if (done >= 16 && (this.irqLevel & (1 << (done - 16)))) this.nvicPending |= 1 << (done - 16);   // level still high
    this.cycles += 16;
    this.brk = true;
  };
  Mcu.prototype.fault = function (msg) {
    if (typeof console !== "undefined") console.warn("[" + this.name + "] fault at " + hex(this.pc) + ": " + msg);
    if (this.active.indexOf(3) >= 0) { this.halt("lockup: " + msg); return; }
    this.enterException(3, this.pc);
  };
  Mcu.prototype.halt = function (why) {
    this.halted = true;
    if (this.onHalt) this.onHalt(why);
  };

  /* ---- scheduling ---- */

  Mcu.prototype.reschedule = function () {
    var t = Infinity;
    for (var i = 0; i < this.timed.length; i++) if (this.timed[i].next < t) t = this.timed[i].next;
    if (this.events.length && this.events[0].t < t) t = this.events[0].t;
    this.nextEvent = t;
    this.brk = true;
  };
  Mcu.prototype.schedule = function (t, fn) {
    var e = this.events, i = e.length;
    while (i > 0 && e[i - 1].t > t) i--;
    e.splice(i, 0, { t: t, fn: fn });
    this.reschedule();
  };
  Mcu.prototype.processEvents = function () {
    for (;;) {
      var now = this.cycles, best = null, bt = Infinity;
      for (var i = 0; i < this.timed.length; i++) if (this.timed[i].next < bt) { bt = this.timed[i].next; best = this.timed[i]; }
      if (this.events.length && this.events[0].t < bt) { bt = this.events[0].t; best = null; }
      if (bt > now) break;
      if (best) best.event(bt);
      else this.events.shift().fn(bt);
    }
    this.reschedule();
  };
  // A polling loop would spin until `t`; jump there, but not past the next event or the slice.
  Mcu.prototype.stallUntil = function (t) {
    var lim = Math.min(t, this.nextEvent, this.limit);
    if (lim > this.cycles) this.cycles = lim;
  };

  Mcu.prototype.runUntil = function (limit) {
    if (!this.powered || this.halted) { this.cycles = Math.max(this.cycles, limit); this.dropEventsBefore(limit); return; }
    this.limit = limit;
    while (this.cycles < limit && !this.halted) {
      this.processEvents();
      this.brk = false;
      if (this.tryTakeIrq()) continue;
      if (this.sleeping) {
        var b = this.bestPending();
        if (b && b.pri < this.execPriority(false)) { this.sleeping = false; continue; }
        this.cycles = Math.min(limit, this.nextEvent);
        continue;
      }
      try { this.exec(Math.min(limit, this.nextEvent)); }
      catch (e) { if (e instanceof Fault) this.fault(e.message); else throw e; }
    }
  };
  Mcu.prototype.dropEventsBefore = function (t) {
    while (this.events.length && this.events[0].t <= t) this.events.shift();
  };

  /* ---- memory ---- */

  Mcu.prototype.periphAt = function (a) {
    var p = this.periph[(a & ~0x3FF) >>> 0];
    return p || this.misc;
  };
  Mcu.prototype.read32 = function (a) {
    a >>>= 0;
    if (a & 3) throw new Fault("unaligned word read " + hex(a));
    var o = a - RAM_BASE;
    if (o >= 0 && o < RAM_SIZE) return this.r32[o >>> 2];
    o = a - FLASH_BASE;
    if (o >= 0 && o < FLASH_SIZE) return this.f32[o >>> 2];
    if (a < FLASH_SIZE) return this.f32[a >>> 2];
    if (a >>> 28 === 4) { var p = this.periphAt(a); return p.read(a & 0x3FF, 4) >>> 0; }
    if (a >>> 28 === 0xE) return this.sysRead(a);
    if (a >= 0x1FFFF000 && a < 0x20000000) return 0;           // option bytes / system memory
    throw new Fault("bus error reading " + hex(a));
  };
  Mcu.prototype.read16 = function (a) {
    a >>>= 0;
    if (a & 1) throw new Fault("unaligned halfword read " + hex(a));
    var o = a - RAM_BASE;
    if (o >= 0 && o < RAM_SIZE) return this.r16[o >>> 1];
    o = a - FLASH_BASE;
    if (o >= 0 && o < FLASH_SIZE) return this.f16[o >>> 1];
    if (a < FLASH_SIZE) return this.f16[a >>> 1];
    if (a >>> 28 === 4) { var p = this.periphAt(a); return (p.read((a & 0x3FF) & ~3, 2) >>> ((a & 2) * 8)) & 0xFFFF; }
    if (a >>> 28 === 0xE) return (this.sysRead(a & ~3) >>> ((a & 2) * 8)) & 0xFFFF;
    throw new Fault("bus error reading " + hex(a));
  };
  Mcu.prototype.read8 = function (a) {
    a >>>= 0;
    var o = a - RAM_BASE;
    if (o >= 0 && o < RAM_SIZE) return this.ram[o];
    o = a - FLASH_BASE;
    if (o >= 0 && o < FLASH_SIZE) return this.flash[o];
    if (a < FLASH_SIZE) return this.flash[a];
    if (a >>> 28 === 4) { var p = this.periphAt(a); return (p.read((a & 0x3FF) & ~3, 1) >>> ((a & 3) * 8)) & 0xFF; }
    if (a >>> 28 === 0xE) return (this.sysRead(a & ~3) >>> ((a & 3) * 8)) & 0xFF;
    throw new Fault("bus error reading " + hex(a));
  };
  Mcu.prototype.write32 = function (a, v) {
    a >>>= 0;
    if (a & 3) throw new Fault("unaligned word write " + hex(a));
    var o = a - RAM_BASE;
    if (o >= 0 && o < RAM_SIZE) { this.r32[o >>> 2] = v; return; }
    if (a >>> 28 === 4) { this.periphAt(a).write(a & 0x3FF, v >>> 0, 4); return; }
    if (a >>> 28 === 0xE) { this.sysWrite(a, v >>> 0); return; }
    throw new Fault("bus error writing " + hex(a));
  };
  Mcu.prototype.write16 = function (a, v) {
    a >>>= 0;
    if (a & 1) throw new Fault("unaligned halfword write " + hex(a));
    var o = a - RAM_BASE;
    if (o >= 0 && o < RAM_SIZE) { this.r16[o >>> 1] = v; return; }
    if (a >>> 28 === 4) { this.periphAt(a).write((a & 0x3FF) & ~3, ((v & 0xFFFF) << ((a & 2) * 8)) >>> 0, 2); return; }
    throw new Fault("bus error writing " + hex(a));
  };
  Mcu.prototype.write8 = function (a, v) {
    a >>>= 0;
    var o = a - RAM_BASE;
    if (o >= 0 && o < RAM_SIZE) { this.ram[o] = v; return; }
    if (a >>> 28 === 4) { this.periphAt(a).write((a & 0x3FF) & ~3, ((v & 0xFF) << ((a & 3) * 8)) >>> 0, 1); return; }
    throw new Fault("bus error writing " + hex(a));
  };

  // System control space: NVIC, SCB, SysTick.
  Mcu.prototype.sysRead = function (a) {
    if (a === 0xE000E100 || a === 0xE000E180) return this.nvicEnabled >>> 0;
    if (a === 0xE000E200 || a === 0xE000E280) return this.nvicPending >>> 0;
    if (a >= 0xE000E400 && a < 0xE000E420) {
      var i = (a - 0xE000E400);
      return (this.ipr[i] | (this.ipr[i + 1] << 8) | (this.ipr[i + 2] << 16) | (this.ipr[i + 3] << 24)) >>> 0;
    }
    switch (a) {
      case 0xE000ED00: return 0x410CC200;
      case 0xE000ED04: return this.ipsr;
      case 0xE000ED10: return this.scr;
      case 0xE000ED1C: return this.shpr2;
      case 0xE000ED20: return this.shpr3;
    }
    return 0;
  };
  Mcu.prototype.sysWrite = function (a, v) {
    if (a === 0xE000E100) { this.nvicEnabled |= v; this.brk = true; return; }
    if (a === 0xE000E180) { this.nvicEnabled &= ~v; return; }
    if (a === 0xE000E200) { this.nvicPending |= v; this.brk = true; return; }
    if (a === 0xE000E280) { this.nvicPending &= ~v; return; }
    if (a >= 0xE000E400 && a < 0xE000E420) {
      var i = (a - 0xE000E400);
      for (var k = 0; k < 4; k++) this.ipr[i + k] = (v >>> (8 * k)) & 0xC0;
      this.brk = true; return;
    }
    switch (a) {
      case 0xE000ED0C: if ((v >>> 16) === 0x05FA && (v & 4)) this.reset(); return;   // SYSRESETREQ
      case 0xE000ED10: this.scr = v; return;
      case 0xE000ED1C: this.shpr2 = v; return;
      case 0xE000ED20: this.shpr3 = v; return;
    }
  };

  /* ---- glue to the page and the other board ---- */

  Mcu.prototype.uartSent = function (byte, t0, t1) { if (this.onUart) this.onUart(byte, t0, t1); };
  Mcu.prototype.pinsChanged = function (port, was, now) {
    if (port === 1) {
      var bit = 1 << 11;                                         // PB11 drives the LCD's RESET line
      var lowNow = (now.mask & bit) && !(now.level & bit), lowWas = (was.mask & bit) && !(was.level & bit);
      if (lowNow && !lowWas) this.lcd.hardReset();
    }
    if (this.onPins) this.onPins(port, was, now);
  };
  Mcu.prototype.spiFrame = function (bytes) {
    var b = this.gpio[1], out = b.lastOut;
    var cs = (out.mask & (1 << 8)) ? (out.level >>> 8) & 1 : 1;
    if (cs) return;                                              // LCD not selected
    var dc = (out.mask & (1 << 14)) ? (out.level >>> 14) & 1 : 1;
    for (var i = 0; i < bytes.length; i++) this.lcd.byte(bytes[i], dc);
  };

  /* ---- the core: ARMv6-M Thumb ---- */

  Mcu.prototype.fetch = function (a) {
    var o = a - FLASH_BASE;
    if (o >= 0 && o < FLASH_SIZE) return this.f16[o >>> 1];
    return this.read16(a);
  };
  Mcu.prototype.reg = function (i) { return i === 15 ? (this.pc + 4) >>> 0 : this.r[i]; };
  Mcu.prototype.add = function (a, b, carry) {
    var u = (a >>> 0) + (b >>> 0) + carry, res = u >>> 0;
    var s = (a | 0) + (b | 0) + carry;
    this.n = res >>> 31; this.z = res === 0 ? 1 : 0; this.c = u > 0xFFFFFFFF ? 1 : 0; this.v = s !== (res | 0) ? 1 : 0;
    return res;
  };
  Mcu.prototype.nz = function (v) { v >>>= 0; this.n = v >>> 31; this.z = v === 0 ? 1 : 0; return v; };
  Mcu.prototype.cond = function (c) {
    switch (c) {
      case 0: return this.z; case 1: return !this.z; case 2: return this.c; case 3: return !this.c;
      case 4: return this.n; case 5: return !this.n; case 6: return this.v; case 7: return !this.v;
      case 8: return this.c && !this.z; case 9: return !this.c || this.z;
      case 10: return this.n === this.v; case 11: return this.n !== this.v;
      case 12: return !this.z && this.n === this.v; case 13: return this.z || this.n !== this.v;
      default: return true;
    }
  };
  // Load a new PC the way BX and POP do: an EXC_RETURN value in Handler mode returns from the exception.
  Mcu.prototype.bxWrite = function (v) {
    if (this.active.length && (v >>> 28) === 0xF) { this.exceptionReturn(v); return; }
    if (!(v & 1)) throw new Fault("branch to ARM state " + hex(v));
    this.pc = v & ~1;
  };

  Mcu.prototype.exec = function (stop) {
    var r = this.r;
    while (this.cycles < stop && !this.brk) {
      var pc = this.pc, op = this.fetch(pc), next = pc + 2, a, b, v, rd, rn, rm, imm, list, i, cnt, addr;
      switch (op >>> 11) {
        case 0x00:                                               // LSLS Rd, Rm, #imm
          imm = (op >>> 6) & 31; v = r[(op >>> 3) & 7];
          if (imm) { this.c = (v >>> (32 - imm)) & 1; v = v << imm; }
          r[op & 7] = this.nz(v); this.cycles += 1; break;
        case 0x01:                                               // LSRS Rd, Rm, #imm
          imm = (op >>> 6) & 31 || 32; v = r[(op >>> 3) & 7];
          if (imm === 32) { this.c = v >>> 31; v = 0; } else { this.c = (v >>> (imm - 1)) & 1; v = v >>> imm; }
          r[op & 7] = this.nz(v); this.cycles += 1; break;
        case 0x02:                                               // ASRS Rd, Rm, #imm
          imm = (op >>> 6) & 31 || 32; v = r[(op >>> 3) & 7] | 0;
          if (imm === 32) { this.c = (v >>> 31) & 1; v = v >> 31; } else { this.c = (v >> (imm - 1)) & 1; v = v >> imm; }
          r[op & 7] = this.nz(v); this.cycles += 1; break;
        case 0x03:                                               // ADDS/SUBS register or 3-bit immediate
          a = r[(op >>> 3) & 7]; b = (op & 0x400) ? (op >>> 6) & 7 : r[(op >>> 6) & 7];
          r[op & 7] = (op & 0x200) ? this.add(a, ~b, 1) : this.add(a, b, 0);
          this.cycles += 1; break;
        case 0x04: rd = (op >>> 8) & 7; r[rd] = this.nz(op & 0xFF); this.cycles += 1; break;          // MOVS
        case 0x05: this.add(r[(op >>> 8) & 7], ~(op & 0xFF), 1); this.cycles += 1; break;           // CMP
        case 0x06: rd = (op >>> 8) & 7; r[rd] = this.add(r[rd], op & 0xFF, 0); this.cycles += 1; break; // ADDS
        case 0x07:                                               // SUBS Rdn, #imm8
          rd = (op >>> 8) & 7; imm = op & 0xFF;
          // nano_wait's `sub r0,#83; bgt repeat` runs ~12 million times a second. Skip whole
          // iterations at 4 cycles each, stopping short of the exit and of the next event.
          if (imm && this.fetch(next) === (0xDCFD) && (r[rd] | 0) > imm) {
            var left = Math.floor(((r[rd] | 0) - 1) / imm), room = Math.floor((stop - this.cycles) / 4);
            var k = Math.min(left, room);
            if (k > 0) { r[rd] = (r[rd] | 0) - k * imm; this.n = 0; this.z = 0; this.c = 1; this.v = 0; this.cycles += 4 * k; continue; }
          }
          r[rd] = this.add(r[rd], ~imm, 1); this.cycles += 1; break;
        case 0x08:
          if (!(op & 0x400)) {                                   // data processing
            rd = op & 7; rm = (op >>> 3) & 7; a = r[rd]; b = r[rm];
            switch ((op >>> 6) & 15) {
              case 0: r[rd] = this.nz(a & b); break;
              case 1: r[rd] = this.nz(a ^ b); break;
              case 2: b &= 0xFF;                                  // LSLS
                if (b === 0) v = a; else if (b < 32) { this.c = (a >>> (32 - b)) & 1; v = a << b; }
                else { this.c = b === 32 ? a & 1 : 0; v = 0; }
                r[rd] = this.nz(v); break;
              case 3: b &= 0xFF;                                  // LSRS
                if (b === 0) v = a; else if (b < 32) { this.c = (a >>> (b - 1)) & 1; v = a >>> b; }
                else { this.c = b === 32 ? a >>> 31 : 0; v = 0; }
                r[rd] = this.nz(v); break;
              case 4: b &= 0xFF;                                  // ASRS
                if (b === 0) v = a; else if (b < 32) { this.c = ((a | 0) >> (b - 1)) & 1; v = (a | 0) >> b; }
                else { this.c = a >>> 31; v = (a | 0) >> 31; }
                r[rd] = this.nz(v); break;
              case 5: r[rd] = this.add(a, b, this.c); break;          // ADCS
              case 6: r[rd] = this.add(a, ~b, this.c); break;         // SBCS
              case 7: b &= 0xFF;                                  // RORS
                if (b === 0) v = a; else { var s = b & 31; v = s ? ((a >>> s) | (a << (32 - s))) : a; this.c = (v >>> 31) & 1; }
                r[rd] = this.nz(v); break;
              case 8: this.nz(a & b); break;                       // TST
              case 9: r[rd] = this.add(~b, 0, 1); break;          // RSBS Rd, Rm, #0
              case 10: this.add(a, ~b, 1); break;                  // CMP
              case 11: this.add(a, b, 0); break;                   // CMN
              case 12: r[rd] = this.nz(a | b); break;
              case 13: r[rd] = this.nz(Math.imul(a, b)); break;    // MULS
              case 14: r[rd] = this.nz(a & ~b); break;             // BICS
              case 15: r[rd] = this.nz(~b); break;                 // MVNS
            }
            this.cycles += 1; break;
          }
          rd = ((op >>> 4) & 8) | (op & 7); rm = (op >>> 3) & 15;
          switch ((op >>> 8) & 3) {
            case 0:                                              // ADD Rdn, Rm (high registers)
              v = (this.reg(rd) + this.reg(rm)) >>> 0;
              if (rd === 15) { this.pc = v & ~1; this.cycles += 3; continue; }
              r[rd] = rd === 13 ? v & ~3 : v; this.cycles += 1; break;
            case 1: this.add(this.reg(rd), ~this.reg(rm), 1); this.cycles += 1; break;   // CMP
            case 2:                                              // MOV Rd, Rm
              v = this.reg(rm);
              if (rd === 15) { this.pc = v & ~1; this.cycles += 3; continue; }
              r[rd] = rd === 13 ? v & ~3 : v; this.cycles += 1; break;
            case 3:                                              // BX / BLX
              v = this.reg(rm);
              if (op & 0x80) r[14] = next | 1;
              this.cycles += 3; this.bxWrite(v); continue;
          }
          break;
        case 0x09:                                               // LDR Rt, [PC, #imm]
          r[(op >>> 8) & 7] = this.read32(((pc + 4) & ~3) + (op & 0xFF) * 4); this.cycles += 2; break;
        case 0x0A: case 0x0B:                                    // load/store, register offset
          addr = (r[(op >>> 3) & 7] + r[(op >>> 6) & 7]) >>> 0; rd = op & 7;
          switch ((op >>> 9) & 7) {
            case 0: this.write32(addr, r[rd]); break;
            case 1: this.write16(addr, r[rd] & 0xFFFF); break;
            case 2: this.write8(addr, r[rd] & 0xFF); break;
            case 3: r[rd] = (this.read8(addr) << 24) >> 24; break;
            case 4: r[rd] = this.read32(addr); break;
            case 5: r[rd] = this.read16(addr); break;
            case 6: r[rd] = this.read8(addr); break;
            case 7: r[rd] = (this.read16(addr) << 16) >> 16; break;
          }
          this.cycles += 2; break;
        case 0x0C: this.write32((r[(op >>> 3) & 7] + ((op >>> 6) & 31) * 4) >>> 0, r[op & 7]); this.cycles += 2; break;
        case 0x0D: r[op & 7] = this.read32((r[(op >>> 3) & 7] + ((op >>> 6) & 31) * 4) >>> 0); this.cycles += 2; break;
        case 0x0E: this.write8((r[(op >>> 3) & 7] + ((op >>> 6) & 31)) >>> 0, r[op & 7] & 0xFF); this.cycles += 2; break;
        case 0x0F: r[op & 7] = this.read8((r[(op >>> 3) & 7] + ((op >>> 6) & 31)) >>> 0); this.cycles += 2; break;
        case 0x10: this.write16((r[(op >>> 3) & 7] + ((op >>> 6) & 31) * 2) >>> 0, r[op & 7] & 0xFFFF); this.cycles += 2; break;
        case 0x11: r[op & 7] = this.read16((r[(op >>> 3) & 7] + ((op >>> 6) & 31) * 2) >>> 0); this.cycles += 2; break;
        case 0x12: this.write32((r[13] + (op & 0xFF) * 4) >>> 0, r[(op >>> 8) & 7]); this.cycles += 2; break;
        case 0x13: r[(op >>> 8) & 7] = this.read32((r[13] + (op & 0xFF) * 4) >>> 0); this.cycles += 2; break;
        case 0x14: r[(op >>> 8) & 7] = (((pc + 4) & ~3) + (op & 0xFF) * 4) >>> 0; this.cycles += 1; break;   // ADR
        case 0x15: r[(op >>> 8) & 7] = (r[13] + (op & 0xFF) * 4) >>> 0; this.cycles += 1; break;             // ADD Rd, SP, #imm
        case 0x16: case 0x17:                                    // miscellaneous
          switch ((op >>> 8) & 15) {
            case 0x0:
              imm = (op & 0x7F) * 4;
              r[13] = (op & 0x80) ? r[13] - imm : r[13] + imm; this.cycles += 1; break;
            case 0x2:
              rd = op & 7; v = r[(op >>> 3) & 7];
              switch ((op >>> 6) & 3) {
                case 0: r[rd] = (v << 16) >> 16; break;
                case 1: r[rd] = (v << 24) >> 24; break;
                case 2: r[rd] = v & 0xFFFF; break;
                case 3: r[rd] = v & 0xFF; break;
              }
              this.cycles += 1; break;
            case 0x4: case 0x5:                                  // PUSH
              list = op & 0xFF; cnt = 0;
              for (i = 0; i < 8; i++) if (list & (1 << i)) cnt++;
              if (op & 0x100) cnt++;
              addr = (r[13] - 4 * cnt) >>> 0; r[13] = addr;
              for (i = 0; i < 8; i++) if (list & (1 << i)) { this.write32(addr, r[i]); addr += 4; }
              if (op & 0x100) this.write32(addr, r[14]);
              this.cycles += 1 + cnt; break;
            case 0x6:
              if ((op & 0xFFEF) === 0xB662) { this.primask = (op >>> 4) & 1; this.brk = true; this.cycles += 1; break; }
              throw new Fault("undefined instruction " + hex(op, 4));
            case 0xA:
              rd = op & 7; v = r[(op >>> 3) & 7];
              switch ((op >>> 6) & 3) {
                case 0: r[rd] = ((v >>> 24) | ((v >>> 8) & 0xFF00) | ((v & 0xFF00) << 8) | (v << 24)) >>> 0; break;
                case 1: r[rd] = (((v >>> 8) & 0x00FF00FF) | ((v & 0x00FF00FF) << 8)) >>> 0; break;
                case 3: r[rd] = ((((v & 0xFF) << 24) >> 16) | ((v >>> 8) & 0xFF)) >>> 0; break;
                default: throw new Fault("undefined instruction " + hex(op, 4));
              }
              this.cycles += 1; break;
            case 0xC: case 0xD:                                  // POP
              list = op & 0xFF; addr = r[13]; cnt = 0;
              for (i = 0; i < 8; i++) if (list & (1 << i)) { r[i] = this.read32(addr); addr += 4; cnt++; }
              if (op & 0x100) {
                v = this.read32(addr); addr += 4; r[13] = addr; this.cycles += 4 + cnt; this.bxWrite(v); continue;
              }
              r[13] = addr; this.cycles += 1 + cnt; break;
            case 0xE: this.halt("BKPT at " + hex(pc)); return;
            case 0xF:
              if (op & 0xF) throw new Fault("undefined instruction " + hex(op, 4));
              switch ((op >>> 4) & 15) {
                case 2: case 3:                                  // WFE, WFI
                  this.pc = next; this.cycles += 2;
                  this.lastWfi = pc;
                  if (this.onWfi) this.onWfi(pc);
                  var p = this.bestPending();
                  if (!(p && p.pri < this.execPriority(false))) { this.sleeping = true; this.brk = true; }
                  continue;
                default: this.cycles += 1;                       // NOP, YIELD, SEV
              }
              break;
            default: throw new Fault("undefined instruction " + hex(op, 4));
          }
          break;
        case 0x18:                                               // STMIA Rn!, {list}
          rn = (op >>> 8) & 7; list = op & 0xFF; addr = r[rn]; cnt = 0;
          for (i = 0; i < 8; i++) if (list & (1 << i)) { this.write32(addr, r[i]); addr += 4; cnt++; }
          r[rn] = addr; this.cycles += 1 + cnt; break;
        case 0x19:                                               // LDMIA Rn{!}, {list}
          rn = (op >>> 8) & 7; list = op & 0xFF; addr = r[rn]; cnt = 0;
          for (i = 0; i < 8; i++) if (list & (1 << i)) { r[i] = this.read32(addr); addr += 4; cnt++; }
          if (!(list & (1 << rn))) r[rn] = addr;
          this.cycles += 1 + cnt; break;
        case 0x1A: case 0x1B:                                    // B<cond>, SVC
          a = (op >>> 8) & 15;
          if (a === 15) { this.pc = next; this.enterException(11, next); continue; }
          if (a === 14) throw new Fault("UDF " + hex(op, 4));
          if (this.cond(a)) { this.pc = (pc + 4 + (((op & 0xFF) << 24) >> 23)) >>> 0; this.cycles += 3; continue; }
          this.cycles += 1; break;
        case 0x1C:                                               // B
          imm = ((op & 0x7FF) << 21) >> 20;
          if (imm === -4) { this.cycles = Math.max(this.cycles, stop); continue; }   // `b .` spins forever
          this.pc = (pc + 4 + imm) >>> 0; this.cycles += 3; continue;
        case 0x1E: {                                             // 32-bit: BL, MSR, MRS, barriers
          var hw2 = this.fetch(pc + 2);
          next = pc + 4;
          if ((hw2 & 0xD000) === 0xD000) {
            var s = (op >>> 10) & 1, j1 = (hw2 >>> 13) & 1, j2 = (hw2 >>> 11) & 1;
            var i1 = 1 - (j1 ^ s), i2 = 1 - (j2 ^ s);
            imm = (s ? -1 << 24 : 0) | (i1 << 23) | (i2 << 22) | ((op & 0x3FF) << 12) | ((hw2 & 0x7FF) << 1);
            r[14] = next | 1; this.pc = (next + imm) >>> 0; this.cycles += 4; continue;
          }
          if (op === 0xF3BF && (hw2 & 0xFF00) === 0x8F00) { this.cycles += 4; break; }       // DSB, DMB, ISB
          if ((op & 0xFFF0) === 0xF380 && (hw2 & 0xFF00) === 0x8800) {                        // MSR
            v = r[op & 15];
            switch (hw2 & 0xFF) {
              case 8: r[13] = v & ~3; break;
              case 16: this.primask = v & 1; this.brk = true; break;
              case 20: this.control = v & 2; break;
              default: if ((hw2 & 0xFF) < 8) { this.n = v >>> 31; this.z = (v >>> 30) & 1; this.c = (v >>> 29) & 1; this.v = (v >>> 28) & 1; }
            }
            this.cycles += 4; break;
          }
          if (op === 0xF3EF && (hw2 & 0xF000) === 0x8000) {                                   // MRS
            rd = (hw2 >>> 8) & 15;
            switch (hw2 & 0xFF) {
              case 8: v = r[13]; break;
              case 16: v = this.primask; break;
              case 20: v = this.control; break;
              case 5: v = this.ipsr; break;
              default: v = (hw2 & 0xFF) < 8 ? this.xpsr() & 0xF000003F : 0;
            }
            r[rd] = v; this.cycles += 4; break;
          }
          throw new Fault("undefined 32-bit instruction " + hex(op, 4) + " " + hex(hw2, 4));
        }
        default: throw new Fault("undefined instruction " + hex(op, 4));
      }
      this.pc = next;
    }
  };

  /* ------------------------------------------------------------ the pair ---- */

  // Two boards on a shared timeline, counted in cycles of an ideal 48 MHz clock.
  //
  // Each STM32F091 here runs from its internal RC oscillator, which ST trims to within 1% of
  // 8 MHz. So the two boards never run at quite the same speed, and each one is given its own
  // error inside that band when it powers on. It matters to the game: the seed is player 1's
  // TIM6 count at the moment player 2's 'p' arrives, and both TIM6s start together at the
  // ready handshake, so with identical clocks the seed would come out the same every game.
  //
  // Board i counts local cycles l = l0 + (g - g0) * scale. Signals cross between boards in
  // shared time: the GPIO lines one slice late, UART bytes when their stop bit ends, which
  // is always more than a slice after they start.
  function Pair(firmware) {
    var self = this;
    this.boards = [new Mcu(firmware, "A"), new Mcu(firmware, "B")];
    this.clock = [{ g0: 0, l0: 0, scale: 1 }, { g0: 0, l0: 0, scale: 1 }];
    this.now = 0;
    this.slice = 1024;
    this.listeners = [];
    this.boards.forEach(function (m, i) {
      var j = 1 - i, other = self.boards[j];
      m.onUart = function (byte, t0, t1) {
        var g1 = self.global(i, t1);
        other.schedule(self.local(j, g1), function () { other.usart1.receive(byte); });
        self.emit({ type: "uart", from: i, byte: byte, t0: self.global(i, t0), t1: g1 });
      };
      m.onPins = function (port, was, now) {
        if (port !== 0) return;
        var bit = 1 << 6;
        var lvWas = (was.mask & bit) ? (was.level & bit ? 1 : 0) : null;
        var lvNow = (now.mask & bit) ? (now.level & bit ? 1 : 0) : null;
        if (lvWas === lvNow) return;
        var g = self.global(i, m.cycles);
        // PA6 here drives PA8 there. A pin that is not an output leaves the line to PA8's pull-down.
        if (other.powered) other.schedule(self.local(j, g + self.slice), function () { other.gpio[0].setExternal(8, lvNow); });
        else other.gpio[0].setExternal(8, lvNow);
        self.emit({ type: "gpio", from: i, level: lvNow, t: g });
      };
    });
  }
  function idle(m) { return !m.powered || m.halted || m.sleeping; }
  Pair.prototype.local = function (i, g) { var c = this.clock[i]; return c.l0 + (g - c.g0) * c.scale; };
  Pair.prototype.global = function (i, l) { var c = this.clock[i]; return c.g0 + (l - c.l0) / c.scale; };
  Pair.prototype.nextOf = function (i) {
    var m = this.boards[i];
    return m.powered && !m.halted ? this.global(i, m.nextEvent) : Infinity;
  };
  Pair.prototype.emit = function (e) { for (var i = 0; i < this.listeners.length; i++) this.listeners[i](e); };
  Pair.prototype.on = function (fn) { this.listeners.push(fn); };
  Pair.prototype.run = function (cycles) {
    var end = this.now + cycles, a = this.boards[0], b = this.boards[1];
    while (this.now < end) {
      var t = this.now + this.slice;
      // While both boards sleep nothing can reach either of them before one of their own
      // events is due, so jump straight there.
      if (idle(a) && idle(b)) t = Math.max(t, Math.min(this.nextOf(0), this.nextOf(1)));
      t = Math.min(end, t);
      a.runUntil(Math.ceil(this.local(0, t))); b.runUntil(Math.ceil(this.local(1, t)));
      this.now = t;
    }
  };
  // `scale` is the board's clock against the ideal one; leave it out for a random chip.
  Pair.prototype.powerOn = function (i, scale) {
    var m = this.boards[i];
    var l0 = Math.ceil(this.local(i, this.now));
    this.clock[i] = { g0: this.now, l0: l0, scale: scale || 1 + (Math.random() * 2 - 1) * 0.01 };
    m.powerOn(l0);
    this.syncInputs(i);
  };
  Pair.prototype.powerOff = function (i) { this.boards[i].powerOff(); };
  Pair.prototype.reset = function (i) {
    var m = this.boards[i];
    if (!m.powered) return;
    m.cycles = Math.max(m.cycles, Math.ceil(this.local(i, this.now)));
    m.events = []; m.reset(); this.syncInputs(i);
  };
  // The other board's PA6 may already be driving this one's PA8.
  Pair.prototype.syncInputs = function (i) {
    var m = this.boards[i], o = this.boards[1 - i].gpio[0].lastOut, bit = 1 << 6;
    m.gpio[0].setExternal(8, (o.mask & bit) ? (o.level & bit ? 1 : 0) : null);
  };
  // Buttons on PA9-PA12 of one board.
  Pair.prototype.button = function (i, pin, down) {
    this.boards[i].gpio[0].setExternal(pin, down ? 1 : null);
  };

  var api = { Mcu: Mcu, Pair: Pair, Lcd: Lcd, HZ: HZ, hex: hex };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Stm32 = api;
})(this);
