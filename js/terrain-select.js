/* =========================================================================
   TERRAQUA CLASH — terrain-select.js
   Habitat picker. Each card previews the real arena — same height field the
   match will load — so the shape you choose is the shape you play.
   ========================================================================= */
(function (global) {
  'use strict';

  var TQ = global.TQ;
  var U = TQ.util;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var SEAT_COLORS = ['#FF6B5B', '#4CC8DA', '#95DA51', '#FFD886'];
  var chosen = null;

  /* Land / water split of the playable island at the mid tide. */
  function splitOf(arena) {
    var land = 0, water = 0;
    for (var i = 0; i < arena.height.length; i++) {
      var h = arena.height[i];
      if (h < arena.voidLevel) continue;
      if (h >= arena.seaLevel) land++; else water++;
    }
    var total = Math.max(1, land + water);
    return { land: Math.round(land / total * 100), water: Math.round(water / total * 100) };
  }

  /* ------------------------------------------------------------ line-up */
  function renderLineup() {
    var m = TQ.match.all();
    var seats = U.clamp(m.humans + m.bots, 1, 4);
    var host = $('#lineup');
    host.innerHTML = '<span class="lineup__label">Line-up</span>';

    for (var i = 0; i < seats; i++) {
      (function (idx) {
        var def = TQ.animals.byId(m.picks[idx]);
        var slot = document.createElement('div');
        slot.className = 'lineup__slot';
        var cv = document.createElement('canvas');
        cv.style.boxShadow = '0 0 0 3px ' + SEAT_COLORS[idx];
        var txt = document.createElement('div');
        txt.innerHTML =
          '<div class="lineup__name">' + U.esc(def.name) + '</div>' +
          '<div class="lineup__cls">' + (idx >= m.humans ? 'AI' : 'P' + (idx + 1)) +
            ' · ' + U.esc(TQ.animals.classLabel(def.cls)) + '</div>';
        slot.appendChild(cv); slot.appendChild(txt);
        host.appendChild(slot);
        requestAnimationFrame(function () {
          TQ.animals.drawToCanvas(cv, def, { ground: false, t: idx * 0.8 });
        });
      }(i));
    }

    var edit = document.createElement('button');
    edit.className = 'tq-btn tq-btn--ghost tq-btn--sm';
    edit.type = 'button';
    edit.style.marginLeft = 'auto';
    edit.textContent = 'Edit';
    edit.addEventListener('click', function () { TQ.nav.go('character-select.html'); });
    host.appendChild(edit);
  }

  /* ----------------------------------------------------------- terrains */
  function renderTerrains() {
    var host = $('#terrains');
    host.innerHTML = '';

    TQ.terrains.list.forEach(function (def) {
      var arena = TQ.terrains.buildArena(def.id);
      var sp = splitOf(arena);

      var card = document.createElement('button');
      card.className = 'card';
      card.type = 'button';
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('data-terrain', def.id);
      card.setAttribute('aria-label', def.name + '. ' + def.tagline + '. ' + sp.land + ' percent land at mid tide.');

      card.innerHTML =
        '<div class="card__art tcard__art"><canvas></canvas>' +
          '<div class="tcard__split">' +
            '<span class="tcard__bar">' +
              '<span style="flex:' + sp.land + ';background:' + def.palette.landDk + '"></span>' +
              '<span style="flex:' + sp.water + ';background:' + def.palette.waterDk + '"></span>' +
            '</span>' +
            sp.land + '% land at mid tide' +
          '</div>' +
          '<div class="tcard__tide">Tide every ' + def.tide.period + 's</div>' +
        '</div>' +
        '<div class="card__body">' +
          '<div>' +
            '<div class="card__name">' + U.esc(def.name) + '</div>' +
            '<div class="card__species">' + U.esc(def.tagline) + '</div>' +
          '</div>' +
          '<div class="chip-row">' +
            def.sdg.map(function (s) { return '<span class="chip chip--sdg' + s + '">SDG ' + s + '</span>'; }).join('') +
            '<span class="chip" style="background:var(--ink)">' + U.esc(def.difficulty) + '</span>' +
            '<span class="chip" style="background:' + def.palette.accent + '">' + U.esc(hazardLabel(def.hazard)) + '</span>' +
          '</div>' +
          '<div class="card__blurb">' + U.esc(def.blurb) + '</div>' +
          '<div class="tcard__fact">' + U.esc(def.fact) + '</div>' +
        '</div>';

      card.addEventListener('click', function () { choose(def.id); });
      card.addEventListener('mouseenter', function () { TQ.sfx.play('hover'); });
      host.appendChild(card);

      requestAnimationFrame(function () {
        TQ.terrains.drawPreview(card.querySelector('canvas'), def.id);
      });
    });
  }

  function hazardLabel(h) {
    return ({
      current: 'Rip currents',
      pillar: 'Root pillars',
      crumble: 'Crumbling floes',
      geyser: 'Geysers',
      falling: 'Falling timber'
    })[h] || h;
  }

  function choose(id) {
    chosen = id;
    TQ.match.set('terrain', id);
    TQ.sfx.play('select');
    $$('#terrains .card').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.getAttribute('data-terrain') === id));
    });
    var def = TQ.terrains.byId(id);
    $('#pickHint').innerHTML = '<strong>' + U.esc(def.name) + '</strong> selected · ' + U.esc(def.difficulty);
    $('#btnStart').disabled = false;
  }

  /* ------------------------------------------------------------- boot */
  document.addEventListener('DOMContentLoaded', function () {
    TQ.boot();
    renderLineup();
    renderTerrains();

    // preselect whatever the match config already holds
    choose(TQ.match.get('terrain'));

    $('#btnBack').addEventListener('click', function () { TQ.nav.back('index.html'); });
    $('#btnChars').addEventListener('click', function () { TQ.nav.go('character-select.html'); });
    $('#btnStart').addEventListener('click', function () {
      if (!chosen) { TQ.sfx.play('deny'); return; }
      TQ.nav.go('game.html');
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') TQ.nav.back('index.html');
      if (ev.key === 'Enter' && chosen && document.activeElement === document.body) TQ.nav.go('game.html');
    });

    var resizeTimer = 0;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        renderLineup();
        $$('#terrains .card').forEach(function (c) {
          TQ.terrains.drawPreview(c.querySelector('canvas'), c.getAttribute('data-terrain'));
        });
      }, 200);
    });
  });

}(window));
