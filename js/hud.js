/* =====================================================================
   hud.js — capacity seats, rising-water gauge, supply hotbar, context
   prompt, banners, and the radio's screen-edge arrow.
   ===================================================================== */
(function (BR) {
  'use strict';

  var el = {};
  var hotEls = [];
  var bannerTimer = null;
  var lastCtxHtml = '';

  function $(id) { return document.getElementById(id); }

  function cache() {
    el.rescued = $('hudRescued');
    el.obj = $('hudObj');
    el.seats = $('hudSeats');
    el.seatCount = $('hudSeatCount');
    el.stam = $('hudStam');
    el.stamFill = $('hudStamFill');
    el.score = $('hudScore');
    el.gauge = $('gauge');
    el.gaugeWrap = $('gaugeWrap');
    el.gaugeFill = $('gaugeFill');
    el.gaugeCrit = $('gaugeCrit');
    el.gaugeCap = $('gaugeCap');
    el.hotbar = $('hotbar');
    el.ctx = $('ctxPrompt');
    el.banner = $('banner');
  }

  /* ------------------------------------------------------------------
     Built once per mission from the packed loadout.
     ------------------------------------------------------------------ */
  function mount(game) {
    if (!el.hotbar) cache();

    // seats — capacity is 3 people and the HUD says so physically
    el.seats.innerHTML = '';
    for (var i = 0; i < game.CAPACITY; i++) {
      var s = document.createElement('div');
      s.className = 'seat';
      s.innerHTML = '<span aria-hidden="true">·</span>';
      el.seats.appendChild(s);
    }

    // hotbar
    el.hotbar.innerHTML = '';
    hotEls = [];
    game.inventory.packed.forEach(function (id, i) {
      var def = BR.supplies.get(id);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hot' + (def.mode === 'passive' ? ' passive' : '');
      b.title = def.fil + ' / ' + def.eng + ' — ' + def.fx;
      b.setAttribute('aria-label', def.fil + ' ' + def.eng);
      b.appendChild(BR.art.supplyCanvas(id, 34));
      var k = document.createElement('span');
      k.className = 'hot__key';
      k.textContent = (i + 1) + ' · ' + def.fil.toUpperCase();
      b.appendChild(k);
      var badge = document.createElement('span');
      badge.className = 'hot__badge';
      badge.style.display = 'none';
      b.appendChild(badge);
      b.addEventListener('click', function () { game.useSupply(i); });
      el.hotbar.appendChild(b);
      hotEls.push({ btn: b, badge: badge, id: id, def: def });
    });

    el.gaugeCrit.style.bottom = (game.CRITICAL * 100) + '%';
    setCtx('');
    if (el.banner) el.banner.classList.remove('show');
  }

  /* ------------------------------------------------------------------
     Per-frame DOM sync
     ------------------------------------------------------------------ */
  function update(game) {
    var ms = game.missionState, inv = game.inventory;

    el.rescued.textContent = ms.rescued + ' / ' + ms.total;
    el.score.textContent = Math.round(ms.score);

    var remaining = ms.total - ms.rescued - ms.lost;
    el.obj.innerHTML = '<b>' + remaining + '</b> still out there · <b>' + ms.lost + '</b> lost';

    // seats
    var kids = el.seats.children;
    for (var i = 0; i < kids.length; i++) {
      var r = game.aboard[i];
      if (r) {
        kids[i].className = 'seat filled';
        kids[i].innerHTML = '<span aria-hidden="true">' + (BR.art.TAG_ICON[r.tag] || '🧍') + '</span>';
        kids[i].title = r.name + ' — ' + r.tag;
      } else {
        kids[i].className = 'seat';
        kids[i].innerHTML = '<span aria-hidden="true">·</span>';
        kids[i].title = 'empty';
      }
    }
    el.seatCount.textContent = game.aboard.length + '/' + game.CAPACITY;

    // stamina
    var sp = BR.clamp(game.boat.stamina / 100, 0, 1);
    el.stamFill.style.width = (sp * 100) + '%';
    el.stam.classList.toggle('low', sp < 0.3);

    // rising water
    var wl = BR.clamp(ms.waterLevel, 0, 1);
    el.gaugeFill.style.height = (wl * 100) + '%';
    el.gaugeCap.textContent = Math.round(wl * 100) + '%';
    el.gaugeWrap.classList.toggle('crit', wl >= game.CRITICAL);

    // hotbar state
    for (var h = 0; h < hotEls.length; h++) {
      var he = hotEls[h], st = inv.state[he.id], def = he.def;
      if (!st) continue;
      if (def.mode === 'toggle') {
        he.btn.classList.toggle('on', st.on);
        he.badge.style.display = 'block';
        he.badge.textContent = st.on ? 'ON' : 'OFF';
        he.badge.style.background = st.on ? '#57B01A' : '#5D6E79';
      } else if (def.mode === 'charge') {
        he.badge.style.display = 'block';
        he.badge.textContent = String(st.charges);
        he.badge.style.background = st.charges > 0 ? '#57B01A' : '#B93A26';
        he.btn.classList.toggle('passive', st.charges <= 0);
      } else if (def.mode === 'cooldown') {
        var cd = st.cd / def.cooldown;
        he.btn.classList.toggle('cooling', st.cd > 0);
        he.btn.style.setProperty('--cd', cd.toFixed(3));
        he.badge.style.display = 'block';
        he.badge.textContent = st.cd > 0 ? Math.ceil(st.cd) + 's' : 'GO';
        he.badge.style.background = st.cd > 0 ? '#5D6E79' : '#57B01A';
      }
    }
  }

  /* ------------------------------------------------------------------
     Context prompt (rescue / drop-off / blocked)
     ------------------------------------------------------------------ */
  function setCtx(html, progress) {
    if (!el.ctx) cache();
    if (!html) {
      if (lastCtxHtml !== '') { el.ctx.classList.remove('show'); lastCtxHtml = ''; }
      return;
    }
    var full = html + (progress != null
      ? '<div class="ctx-bar"><i style="width:' + Math.round(progress * 100) + '%"></i></div>'
      : '');
    if (full !== lastCtxHtml) { el.ctx.innerHTML = full; lastCtxHtml = full; }
    el.ctx.classList.add('show');
  }

  function banner(text, good, ms) {
    if (!el.banner) cache();
    el.banner.textContent = text;
    el.banner.classList.toggle('good', !!good);
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.banner.classList.remove('show'); }, ms || 1900);
  }

  /* ------------------------------------------------------------------
     Radio ping — a directional arrow pinned to the screen edge.
     Drawn in screen space on the game canvas, after the world pass.
     ------------------------------------------------------------------ */
  function drawPing(c, vw, vh, screenX, screenY, label, alpha) {
    var cx = vw / 2, cy = vh / 2;
    var dx = screenX - cx, dy = screenY - cy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var margin = 74;
    var maxX = cx - margin, maxY = cy - margin;
    var scale = Math.min(maxX / Math.abs(dx || 0.0001), maxY / Math.abs(dy || 0.0001));

    var onScreen = screenX > margin && screenX < vw - margin && screenY > margin && screenY < vh - margin;
    var px, py;
    if (onScreen) { px = screenX; py = screenY - 54; }
    else { px = cx + dx * scale; py = cy + dy * scale; }

    var ang = Math.atan2(dy, dx);

    c.save();
    c.globalAlpha = alpha;
    c.translate(px, py);

    // halo
    c.fillStyle = 'rgba(246,166,35,.22)';
    c.beginPath(); c.arc(0, 0, 30, 0, 6.2832); c.fill();

    c.save();
    c.rotate(onScreen ? Math.PI / 2 : ang);
    c.fillStyle = '#F6A623';
    c.strokeStyle = '#4A2A12'; c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(20, 0); c.lineTo(-10, -13); c.lineTo(-4, 0); c.lineTo(-10, 13);
    c.closePath(); c.fill(); c.stroke();
    c.restore();

    if (label) {
      c.font = '700 11px Nunito, system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      var w = c.measureText(label).width + 14;
      c.fillStyle = 'rgba(14,30,40,.86)';
      BR.art.rr(c, -w / 2, 22, w, 20, 8); c.fill();
      c.fillStyle = '#FFE0A2';
      c.fillText(label, 0, 33);
    }
    c.restore();

    return len;
  }

  BR.hud = {
    cache: cache, mount: mount, update: update,
    setCtx: setCtx, banner: banner, drawPing: drawPing
  };

})(window.BR);
