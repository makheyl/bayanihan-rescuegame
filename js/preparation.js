/* =====================================================================
   preparation.js — Paghahanda.
   A grid of supply cards on the left, a boat with visible physical slots
   on the right. Packing badly is always allowed; it is the whole point.
   ===================================================================== */
(function (BR) {
  'use strict';

  var current = null;      // the mission being packed for

  function open(mission) {
    current = mission;
    BR.state.loadout.missionId = mission.id;
    if (BR.state.loadout.packed.length > mission.slots) {
      BR.state.loadout.packed = BR.state.loadout.packed.slice(0, mission.slots);
    }
    buildGrid();
    buildBrief();
    refresh();
    BR.ui.go('prep');
  }

  function packed() { return BR.state.loadout.packed; }

  function toggle(id) {
    var p = packed();
    var i = p.indexOf(id);
    if (i !== -1) {
      p.splice(i, 1);
      BR.audio.play('unpack');
    } else {
      if (p.length >= current.slots) {
        BR.audio.play('deny');
        flashWarn('Puno na ang bangka — ' + current.slots + ' slots only. Take something out first.');
        return;
      }
      p.push(id);
      BR.audio.play('pack');
    }
    refresh();
  }

  var warnTimer = null;
  function flashWarn(msg) {
    var el = document.getElementById('capWarn');
    el.textContent = msg;
    clearTimeout(warnTimer);
    warnTimer = setTimeout(function () { el.innerHTML = '&nbsp;'; }, 2600);
  }

  /* ------------------------------------------------------------------ */
  function buildGrid() {
    var host = document.getElementById('supplyGrid');
    host.innerHTML = '';
    BR.supplies.list.forEach(function (def) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'scard';
      b.dataset.id = def.id;
      b.setAttribute('aria-pressed', 'false');

      var top = document.createElement('div');
      top.className = 'scard__top';
      var art = BR.art.supplyCanvas(def.id, 46);
      art.className = 'scard__art';
      top.appendChild(art);
      var nm = document.createElement('div');
      nm.className = 'scard__name';
      nm.innerHTML = def.fil + '<span>' + def.eng + '</span>';
      top.appendChild(nm);
      b.appendChild(top);

      var fx = document.createElement('div');
      fx.className = 'scard__fx';
      fx.textContent = def.fx;
      b.appendChild(fx);

      var tag = document.createElement('span');
      tag.className = 'scard__tag' + (def.mode === 'passive' ? '' : ' act');
      tag.textContent = def.mode === 'passive' ? 'Passive'
                      : def.mode === 'toggle' ? 'Toggle · hotkey'
                      : def.mode === 'charge' ? def.charges + ' uses · hotkey'
                      : def.cooldown + 's cooldown · hotkey';
      b.appendChild(tag);

      var chk = document.createElement('span');
      chk.className = 'scard__check';
      chk.textContent = '✓';
      b.appendChild(chk);

      b.addEventListener('click', function () { toggle(def.id); });
      host.appendChild(b);
    });
  }

  function buildBrief() {
    var el = document.getElementById('prepBrief');
    var m = current;
    el.innerHTML =
      '<b>' + m.fil + ' · ' + m.eng + '</b>' +
      m.brief +
      '<div style="margin-top:.7em; opacity:.82"><strong>' + m.condition + '</strong> · ' +
      m.roster.total + ' residents on the roster · boat holds 3 at a time</div>';
    document.getElementById('prepSub').textContent =
      'Mission ' + m.index + ' gives you ' + m.slots + ' slots and eight things worth taking. ' +
      'Pack badly if you like — the report afterwards will tell you exactly what it cost.';
  }

  /* ------------------------------------------------------------------ */
  function refresh() {
    var p = packed(), slots = current.slots;

    // supply cards
    var cards = document.querySelectorAll('#supplyGrid .scard');
    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].dataset.id;
      var on = p.indexOf(id) !== -1;
      cards[i].classList.toggle('is-packed', on);
      cards[i].classList.toggle('is-rec', current.recommended.indexOf(id) !== -1);
      cards[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    // physical slots on the deck
    var row = document.getElementById('slotRow');
    row.innerHTML = '';
    for (var s = 0; s < slots; s++) {
      var id2 = p[s];
      var d = document.createElement('div');
      d.className = 'slot' + (id2 ? ' filled' : '');
      var key = document.createElement('span');
      key.className = 'key'; key.textContent = String(s + 1);
      d.appendChild(key);
      if (id2) {
        d.appendChild(BR.art.supplyCanvas(id2, 40));
        d.title = 'Remove ' + BR.supplies.get(id2).fil;
        (function (sid) {
          d.addEventListener('click', function () { toggle(sid); });
        })(id2);
      } else {
        var em = document.createElement('span');
        em.className = 'empty-mark'; em.textContent = '+';
        d.appendChild(em);
      }
      row.appendChild(d);
    }

    document.getElementById('capLine').textContent = p.length + ' / ' + slots + ' slots packed';

    var launch = document.getElementById('btnLaunch');
    launch.disabled = false;
    // arrows go in the body face — the pixel display font has no glyph for them
    launch.innerHTML = (p.length === 0 ? 'Ilunsad · Launch empty' : 'Ilunsad · Launch') +
                       ' <span class="ar">&#8594;</span>';

    drawBoat();
  }

  /* A small illustration of the bangka with its deck slots visible. */
  function drawBoat() {
    var cv = document.getElementById('boatCanvas');
    var c = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);

    // water
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2A4653'); g.addColorStop(1, '#16303C');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(143,224,238,.24)'; c.lineWidth = 3;
    for (var i = 0; i < 5; i++) {
      var y = 60 + i * 52;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(W * 0.3, y - 14, W * 0.7, y + 14, W, y);
      c.stroke();
    }

    BR.art.drawBoat(c, W / 2, H / 2 + 14, 0, 4.4, { aboard: 0 });

    // cargo crates sitting on the deck, one per packed supply
    var p = packed();
    var startX = W / 2 - (current.slots - 1) * 30 - 4;
    for (var s = 0; s < current.slots; s++) {
      var x = startX + s * 60, y = H / 2 - 34;
      c.save();
      if (p[s]) {
        c.fillStyle = 'rgba(255,240,206,.95)';
        BR.art.rr(c, x - 22, y - 22, 44, 44, 8); c.fill();
        c.strokeStyle = '#C4770F'; c.lineWidth = 3;
        BR.art.rr(c, x - 22, y - 22, 44, 44, 8); c.stroke();
        BR.art.drawSupplyIcon(c, p[s], 38, x - 19, y - 19);
      } else {
        c.setLineDash([6, 5]);
        c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 3;
        BR.art.rr(c, x - 22, y - 22, 44, 44, 8); c.stroke();
        c.setLineDash([]);
        c.fillStyle = 'rgba(255,255,255,.4)';
        c.font = 'bold 22px Nunito, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('+', x, y);
      }
      c.restore();
    }
  }

  /* ------------------------------------------------------------------ */
  function wire() {
    document.getElementById('btnSuggest').addEventListener('click', function () {
      BR.audio.play('pack');
      BR.state.loadout.packed = current.recommended.slice(0, current.slots);
      flashWarn('Suggested pack loaded — override any of it.');
      refresh();
    });
    document.getElementById('btnClearPack').addEventListener('click', function () {
      BR.audio.play('unpack');
      BR.state.loadout.packed = [];
      refresh();
    });
    document.getElementById('btnLaunch').addEventListener('click', function () {
      BR.audio.play('click');
      BR.ui.go('game');
      // let the screen become visible so the canvas measures non-zero
      requestAnimationFrame(function () {
        BR.render.resize();
        BR.game.start(current, packed().slice());
      });
    });
  }

  BR.prep = {
    open: open,
    wire: wire,
    currentMission: function () { return current; }
  };

})(window.BR);
