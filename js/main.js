/* =====================================================================
   main.js — screen router, floater system, settings, touch controls,
   audio unlock and boot.
   ===================================================================== */
(function (BR) {
  'use strict';

  var SCREENS = ['title', 'missions', 'prep', 'game', 'report', 'farewell'];
  var currentScreen = 'title';

  /* ------------------------------------------------------------------
     ROUTER
     ------------------------------------------------------------------ */
  function go(name) {
    if (SCREENS.indexOf(name) === -1) return;
    if (currentScreen === 'game' && name !== 'game') BR.game.stop();

    SCREENS.forEach(function (s) {
      var el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('is-active', s === name);
    });
    currentScreen = name;

    if (name === 'missions') BR.missionSelect.refresh();
    if (name === 'game') { requestAnimationFrame(BR.render.resize); }
    if (name !== 'game') closeFloater('fl-pause');

    var el2 = document.getElementById('screen-' + name);
    if (el2) el2.scrollTop = 0;
  }

  /* ------------------------------------------------------------------
     FLOATERS — keyboard-navigable, Esc-closable, focus-trapped
     ------------------------------------------------------------------ */
  var stack = [];
  var lastFocus = null;

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.disabled && el.offsetParent !== null; }
    );
  }

  function openFloater(id) {
    var el = document.getElementById(id);
    if (!el || el.classList.contains('is-open')) return;
    if (!stack.length) lastFocus = document.activeElement;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    stack.push(el);
    var auto = el.querySelector('[data-autofocus]') || focusables(el)[0];
    if (auto) setTimeout(function () { auto.focus(); }, 30);
  }

  function closeFloater(id) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el || !el.classList.contains('is-open')) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    stack = stack.filter(function (s) { return s !== el; });
    if (el.id === 'fl-pause' && BR.game.active && BR.game.paused) BR.game.paused = false;
    if (!stack.length && lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
  }

  function wireFloaters() {
    document.addEventListener('click', function (e) {
      var opener = e.target.closest ? e.target.closest('[data-floater]') : null;
      if (opener) { BR.audio.play('click'); openFloater(opener.getAttribute('data-floater')); return; }
      var closer = e.target.closest ? e.target.closest('[data-floater-close]') : null;
      if (closer) {
        var root = closer.closest('.floater-root');
        if (root) { BR.audio.play('back'); closeFloater(root); }
        return;
      }
      var goer = e.target.closest ? e.target.closest('[data-goto]') : null;
      if (goer) { BR.audio.play('back'); go(goer.getAttribute('data-goto')); }
    });

    document.addEventListener('keydown', function (e) {
      if (!stack.length) return;
      var top = stack[stack.length - 1];

      if (e.key === 'Escape') {
        e.preventDefault();
        BR.audio.play('back');
        closeFloater(top);
        return;
      }
      if (e.key === 'Tab') {
        var f = focusables(top);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }, true);

    // tabbed floaters
    document.addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('.tab') : null;
      if (!tab) return;
      var root = tab.closest('.floater');
      Array.prototype.forEach.call(root.querySelectorAll('.tab'), function (t) {
        t.setAttribute('aria-selected', String(t === tab));
      });
      var want = tab.getAttribute('data-tab');
      Array.prototype.forEach.call(root.querySelectorAll('[data-panel]'), function (p) {
        p.hidden = p.getAttribute('data-panel') !== want;
      });
      BR.audio.play('click');
    });
  }

  /* ------------------------------------------------------------------
     SETTINGS
     ------------------------------------------------------------------ */
  function wireSettings() {
    var s = BR.state.settings;

    function slider(inputId, valId, key) {
      var input = document.getElementById(inputId), val = document.getElementById(valId);
      function sync() {
        var v = parseInt(input.value, 10);
        s[key] = v / 100;
        val.textContent = v + '%';
        input.style.setProperty('--fill', v + '%');
        BR.audio.applyVolumes();
      }
      input.value = Math.round(s[key] * 100);
      input.addEventListener('input', sync);
      sync();
    }
    slider('setMaster', 'setMasterVal', 'master');
    slider('setSfx', 'setSfxVal', 'sfx');
    slider('setMusic', 'setMusicVal', 'music');

    var seg = document.getElementById('setMotion');
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        s.reduceMotion = b.getAttribute('data-v') === '1';
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        BR.state.applyReduceMotion();
        BR.audio.play('click');
      });
    });

    document.getElementById('setReset').addEventListener('click', function () {
      s.master = 0.8; s.sfx = 0.9; s.music = 0.5; s.reduceMotion = false;
      document.getElementById('setMaster').value = 80;
      document.getElementById('setSfx').value = 90;
      document.getElementById('setMusic').value = 50;
      ['setMaster', 'setSfx', 'setMusic'].forEach(function (id) {
        document.getElementById(id).dispatchEvent(new Event('input'));
      });
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === '0'));
      });
      BR.state.applyReduceMotion();
      BR.audio.play('click');
      BR.toast('Settings reset');
    });
  }

  /* ------------------------------------------------------------------
     PAUSE
     ------------------------------------------------------------------ */
  function wirePause() {
    document.getElementById('btnPause').addEventListener('click', function () {
      BR.audio.play('click');
      BR.game.togglePause();
    });

    document.getElementById('pauseRestart').addEventListener('click', function () {
      BR.audio.play('click');
      var m = BR.prep.currentMission();
      var packed = BR.state.loadout.packed.slice();
      closeFloater('fl-pause');
      BR.game.stop();
      requestAnimationFrame(function () { BR.game.start(m, packed); });
    });

    document.getElementById('pauseAbort').addEventListener('click', function () {
      BR.audio.play('back');
      closeFloater('fl-pause');
      BR.game.paused = false;
      BR.game.finish('aborted');
    });

    // show the current loadout inside the pause card
    var host = document.getElementById('pauseLoadout');
    var obs = setInterval(function () {
      if (!document.getElementById('fl-pause').classList.contains('is-open')) return;
      if (!BR.game.inventory) return;
      var html = '<h3>Dala mo · What you packed</h3><div class="rec-row">';
      BR.game.inventory.packed.forEach(function (id, i) {
        var d = BR.supplies.get(id);
        html += '<span class="rec-chip">' + (i + 1) + ' · ' + d.fil + '</span>';
      });
      if (!BR.game.inventory.packed.length) html += '<span class="rec-chip">Nothing. You went out empty.</span>';
      html += '</div>';
      if (host.innerHTML !== html) host.innerHTML = html;
    }, 400);
    void obs;
  }

  /* ------------------------------------------------------------------
     TOUCH CONTROLS — only mounted on touch devices
     ------------------------------------------------------------------ */
  function wireTouch() {
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    document.body.classList.add('touch-device');

    var stick = document.getElementById('tStick');
    var nub = document.getElementById('tNub');
    var t = BR.game.touch;
    var pid = null, cx = 0, cy = 0, R = 1;

    function down(e) {
      var r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2;
      pid = e.pointerId;
      stick.setPointerCapture(pid);
      t.active = true;
      move(e);
      e.preventDefault();
    }
    function move(e) {
      if (pid !== e.pointerId) return;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var m = Math.sqrt(dx * dx + dy * dy);
      var lim = Math.min(m, R);
      var nx = m ? dx / m : 0, ny = m ? dy / m : 0;
      t.x = nx * (lim / R); t.y = ny * (lim / R);
      nub.style.transform = 'translate(calc(-50% + ' + (nx * lim) + 'px), calc(-50% + ' + (ny * lim) + 'px))';
      e.preventDefault();
    }
    function up(e) {
      if (pid !== e.pointerId) return;
      pid = null; t.active = false; t.x = 0; t.y = 0;
      nub.style.transform = 'translate(-50%,-50%)';
    }
    stick.addEventListener('pointerdown', down);
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', up);
    stick.addEventListener('pointercancel', up);

    var act = document.getElementById('tAction');
    act.addEventListener('pointerdown', function (e) { t.action = true; BR.game.setActionEdge(); e.preventDefault(); });
    act.addEventListener('pointerup', function () { t.action = false; });
    act.addEventListener('pointercancel', function () { t.action = false; });

    var spr = document.getElementById('tSprint');
    spr.addEventListener('pointerdown', function (e) { t.sprint = true; e.preventDefault(); });
    spr.addEventListener('pointerup', function () { t.sprint = false; });
    spr.addEventListener('pointercancel', function () { t.sprint = false; });

    BR.toast('Touch controls on — landscape recommended', null, 3200);
  }

  /* ------------------------------------------------------------------
     AUDIO UNLOCK — never before a gesture
     ------------------------------------------------------------------ */
  function wireAudioUnlock() {
    function unlock() {
      BR.audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    }
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /* ------------------------------------------------------------------
     BOOT
     ------------------------------------------------------------------ */
  function boot() {
    BR.ui = { go: go, openFloater: openFloater, closeFloater: closeFloater };

    wireFloaters();
    wireSettings();
    wirePause();
    wireTouch();
    wireAudioUnlock();

    BR.landing.wire();
    BR.prep.wire();
    BR.game.bindInput();
    BR.state.applyReduceMotion();

    window.addEventListener('resize', function () {
      if (currentScreen === 'game') BR.render.resize();
    });

    // honour the OS-level preference as the initial value
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      BR.state.settings.reduceMotion = true;
      BR.state.applyReduceMotion();
      var seg = document.getElementById('setMotion');
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', String(x.getAttribute('data-v') === '1'));
      });
    }

    go('title');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.BR);
