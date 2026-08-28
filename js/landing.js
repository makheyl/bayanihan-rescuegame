/* =====================================================================
   landing.js — title screen wiring plus the rain drifting over the
   coastal scene.
   ===================================================================== */
(function (BR) {
  'use strict';

  var rainCv = null, rainCtx = null, drops = [], rafId = 0, t0 = 0;

  function startRain() {
    rainCv = document.getElementById('titleRain');
    if (!rainCv) return;
    rainCtx = rainCv.getContext('2d');
    sizeRain();
    window.addEventListener('resize', sizeRain);
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function sizeRain() {
    if (!rainCv) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = rainCv.clientWidth || window.innerWidth;
    var h = rainCv.clientHeight || window.innerHeight;
    rainCv.width = w * dpr; rainCv.height = h * dpr;
    rainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drops = [];
    var n = Math.round(Math.min(180, w * h / 9000));
    for (var i = 0; i < n; i++) {
      drops.push({ x: Math.random() * w, y: Math.random() * h, l: 8 + Math.random() * 16, s: 220 + Math.random() * 260 });
    }
  }

  function tick(ts) {
    rafId = requestAnimationFrame(tick);
    if (!rainCtx) return;
    // stop burning frames while another screen is up
    var titleVisible = document.getElementById('screen-title').classList.contains('is-active');
    if (!titleVisible || BR.state.settings.reduceMotion) {
      rainCtx.clearRect(0, 0, rainCv.width, rainCv.height);
      return;
    }
    if (!t0) t0 = ts;
    var dt = Math.min((ts - t0) / 1000, 0.05); t0 = ts;

    var w = rainCv.clientWidth, h = rainCv.clientHeight;
    rainCtx.clearRect(0, 0, w, h);
    rainCtx.strokeStyle = 'rgba(224,246,255,.38)';
    rainCtx.lineWidth = 1.3;
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      d.y += d.s * dt; d.x += d.s * 0.22 * dt;
      if (d.y > h) { d.y = -20; d.x = Math.random() * w; }
      if (d.x > w) d.x = -10;
      rainCtx.beginPath();
      rainCtx.moveTo(d.x, d.y);
      rainCtx.lineTo(d.x - d.l * 0.22, d.y + d.l);
      rainCtx.stroke();
    }
  }

  function wire() {
    document.getElementById('btnPlay').addEventListener('click', function () {
      BR.audio.play('click');
      BR.missionSelect.open();
    });

    // EXIT is never a dead end: confirm -> farewell card -> return
    document.getElementById('exitConfirm').addEventListener('click', function () {
      BR.audio.play('back');
      BR.ui.closeFloater('fl-exit');
      BR.ui.go('farewell');
    });
    document.getElementById('fwReturn').addEventListener('click', function () {
      BR.audio.play('click');
      BR.ui.go('title');
    });

    document.getElementById('howPlay').addEventListener('click', function () {
      BR.audio.play('click');
      BR.ui.closeFloater('fl-howto');
      BR.missionSelect.open();
    });

    startRain();
  }

  BR.landing = { wire: wire };

})(window.BR);
