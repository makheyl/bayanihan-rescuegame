/* =====================================================================
   audio.js — Web Audio API only, everything synthesised.
   =====================================================================
   The context is created lazily on the first user gesture (see BR.audio.unlock,
   called from main.js on the first pointerdown/keydown), so nothing ever
   autoplays. If /assets/audio/*.wav files are dropped in later, loadFile()
   below is the hook — but the build ships with no audio files at all.
   ===================================================================== */
(function (BR) {
  'use strict';

  var ctx = null, master = null, sfxBus = null, musBus = null;
  var unlocked = false;
  var ambience = null;          // { rainSrc, rainGain, droneOsc, droneGain }

  function S() { return BR.state.settings; }

  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musBus = ctx.createGain();
    sfxBus.connect(master); musBus.connect(master); master.connect(ctx.destination);
    applyVolumes();
    return true;
  }

  function applyVolumes() {
    if (!ctx) return;
    var s = S();
    master.gain.setTargetAtTime(s.master, ctx.currentTime, 0.02);
    sfxBus.gain.setTargetAtTime(s.sfx, ctx.currentTime, 0.02);
    musBus.gain.setTargetAtTime(s.music, ctx.currentTime, 0.02);
  }

  /* ------------------------------------------------------------------
     Primitive: a short enveloped oscillator
     ------------------------------------------------------------------ */
  function tone(opts) {
    if (!ctx || S().master <= 0) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);

    var peak = (opts.gain == null ? 0.25 : opts.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

    var dest = opts.bus === 'music' ? musBus : sfxBus;
    if (opts.pan != null && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = BR.clamp(opts.pan, -1, 1);
      osc.connect(g); g.connect(p); p.connect(dest);
    } else {
      osc.connect(g); g.connect(dest);
    }
    osc.start(t0); osc.stop(t0 + opts.dur + 0.03);
  }

  /* Noise buffer, reused for splashes / rain / thunder */
  var noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      var len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    return src;
  }

  function noiseBurst(opts) {
    if (!ctx || S().master <= 0) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var src = noise();
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + opts.dur);
    f.Q.value = opts.q == null ? 1.2 : opts.q;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain == null ? 0.3 : opts.gain, t0 + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

    src.connect(f); f.connect(g); g.connect(opts.bus === 'music' ? musBus : sfxBus);
    src.start(t0); src.stop(t0 + opts.dur + 0.05);
  }

  /* ------------------------------------------------------------------
     Named cues
     ------------------------------------------------------------------ */
  var cues = {
    click:    function () { tone({ type: 'square', f0: 520, f1: 300, dur: 0.09, gain: 0.16 }); },
    back:     function () { tone({ type: 'square', f0: 300, f1: 200, dur: 0.10, gain: 0.14 }); },
    pack:     function () { tone({ type: 'triangle', f0: 620, f1: 880, dur: 0.11, gain: 0.2 }); },
    unpack:   function () { tone({ type: 'triangle', f0: 480, f1: 300, dur: 0.11, gain: 0.16 }); },
    deny:     function () { tone({ type: 'sawtooth', f0: 180, f1: 110, dur: 0.16, gain: 0.16 }); },

    splash:   function (p) { noiseBurst({ f0: 1400, f1: 380, dur: 0.24, gain: 0.16, q: 0.7, pan: p }); },
    bump:     function () {
      noiseBurst({ f0: 240, f1: 90, dur: 0.22, gain: 0.34, filter: 'lowpass', q: 0.8 });
      tone({ type: 'sine', f0: 130, f1: 60, dur: 0.2, gain: 0.22 });
    },
    rescue:   function () {
      tone({ type: 'triangle', f0: 523, dur: 0.12, gain: 0.2 });
      tone({ type: 'triangle', f0: 784, dur: 0.16, gain: 0.2, delay: 0.09 });
    },
    stabilise: function () { tone({ type: 'sine', f0: 660, f1: 990, dur: 0.3, gain: 0.16 }); },
    dropoff:  function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone({ type: 'triangle', f0: f, dur: 0.2, gain: 0.18, delay: i * 0.075 });
      });
      noiseBurst({ f0: 2600, f1: 900, dur: 0.5, gain: 0.07, delay: 0.1, q: 0.5 });
    },
    lost:     function () {
      tone({ type: 'sawtooth', f0: 300, f1: 90, dur: 0.65, gain: 0.16 });
    },
    ping:     function () {
      tone({ type: 'sine', f0: 1400, dur: 0.08, gain: 0.16 });
      tone({ type: 'sine', f0: 1900, dur: 0.1, gain: 0.14, delay: 0.11 });
    },
    drink:    function () { tone({ type: 'sine', f0: 380, f1: 720, dur: 0.26, gain: 0.16 }); },
    torch:    function () { tone({ type: 'square', f0: 900, f1: 1250, dur: 0.07, gain: 0.12 }); },
    thunder:  function () {
      noiseBurst({ f0: 420, f1: 55, dur: 1.7, gain: 0.34, filter: 'lowpass', q: 0.4, attack: 0.06 });
    },
    alarm:    function () {
      tone({ type: 'square', f0: 740, dur: 0.16, gain: 0.14 });
      tone({ type: 'square', f0: 620, dur: 0.2, gain: 0.14, delay: 0.19 });
    },
    win:      function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        tone({ type: 'triangle', f0: f, dur: 0.32, gain: 0.17, delay: i * 0.1 });
      });
    },
    fail:     function () {
      [392, 330, 262].forEach(function (f, i) {
        tone({ type: 'sawtooth', f0: f, dur: 0.4, gain: 0.14, delay: i * 0.17 });
      });
    },
    /* a resident calling for help — panned and attenuated by distance */
    help: function (pan, vol) {
      tone({ type: 'sine', f0: 620, f1: 820, dur: 0.19, gain: 0.22 * vol, pan: pan });
      tone({ type: 'sine', f0: 540, f1: 700, dur: 0.22, gain: 0.18 * vol, pan: pan, delay: 0.23 });
    }
  };

  /* ------------------------------------------------------------------
     Ambience — a rain bed plus a drone that tightens as water rises
     ------------------------------------------------------------------ */
  function startAmbience() {
    if (!ctx || ambience) return;
    var rain = noise();
    var rf = ctx.createBiquadFilter();
    rf.type = 'highpass'; rf.frequency.value = 900; rf.Q.value = 0.4;
    var rg = ctx.createGain(); rg.gain.value = 0.0001;
    rain.connect(rf); rf.connect(rg); rg.connect(musBus);
    rain.start();

    var osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 55;
    var og = ctx.createGain(); og.gain.value = 0.0001;
    osc.connect(og); og.connect(musBus);
    osc.start();

    ambience = { rain: rain, rainGain: rg, drone: osc, droneGain: og };
  }

  function stopAmbience() {
    if (!ctx || !ambience) return;
    try { ambience.rain.stop(); ambience.drone.stop(); } catch (e) { /* already stopped */ }
    ambience = null;
  }

  /* rainAmt 0..1, tension 0..1 (water level) */
  function setAmbience(rainAmt, tension) {
    if (!ctx || !ambience) return;
    var t = ctx.currentTime;
    ambience.rainGain.gain.setTargetAtTime(Math.max(0.0001, 0.10 * rainAmt + 0.05 * tension), t, 0.4);
    ambience.droneGain.gain.setTargetAtTime(Math.max(0.0001, 0.02 + 0.09 * tension * tension), t, 0.6);
    ambience.drone.frequency.setTargetAtTime(48 + 26 * tension, t, 0.8);
  }

  /* ------------------------------------------------------------------ */
  BR.audio = {
    unlock: function () {
      if (unlocked) return;
      if (!ctx && !build()) return;
      if (ctx.state === 'suspended') ctx.resume();
      unlocked = true;
    },
    ready: function () { return !!ctx; },
    play: function (name) {
      if (!ctx || !cues[name]) return;
      try { cues[name].apply(null, Array.prototype.slice.call(arguments, 1)); }
      catch (e) { /* an over-scheduled node is never worth breaking the frame for */ }
    },
    applyVolumes: applyVolumes,
    startAmbience: startAmbience,
    stopAmbience: stopAmbience,
    setAmbience: setAmbience,

    /* Hook for /assets/audio/ — unused by this build, kept as the seam. */
    loadFile: function (url) {
      if (!ctx) return Promise.reject(new Error('audio context not started'));
      return fetch(url).then(function (r) { return r.arrayBuffer(); })
        .then(function (b) { return ctx.decodeAudioData(b); });
    }
  };

})(window.BR);
