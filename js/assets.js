/* =====================================================================
   assets.js — image loader + the procedural sprite library
   =====================================================================
   The reference art delivered in /BAYANIHAN_ELEMENTS/ belongs to a
   different project, so nothing in it is shipped as a game sprite.
   Everything the arena and the UI need is drawn here on canvas in the
   palette sampled from that reference. load() stays as the seam: drop a
   real sprite sheet in and register it, and the draw helpers below can
   defer to it.
   ===================================================================== */
(function (BR) {
  'use strict';

  var images = {};

  /* Optional image loader. Never rejects — a missing file just means the
     procedural fallback keeps being used, rather than a broken <img>. */
  function load(map) {
    var keys = Object.keys(map);
    return Promise.all(keys.map(function (k) {
      return new Promise(function (res) {
        var img = new Image();
        img.onload = function () { images[k] = img; res(true); };
        img.onerror = function () { res(false); };
        img.src = map[k];
      });
    }));
  }

  var P = {
    hull: '#C98A52', hullDark: '#9C6335', bamboo: '#E4C27A', bambooDark: '#B8933F',
    nipa: '#D9A45B', nipaDark: '#A9762F',
    roofA: '#B0522F', roofADark: '#7E3620',
    roofB: '#8E6BC4', roofBDark: '#5C4487',
    roofC: '#4C8FB8', roofCDark: '#2F6480',
    roofD: '#C6893A', roofDDark: '#8E5C1E',
    leaf: '#35A83A', leafDark: '#1F7B2C', leafLight: '#57C64B',
    trunk: '#8B5E2E',
    debris: '#7A6248', debrisDark: '#54432F',
    concrete: '#D8D2C4', concreteDark: '#A79E8B',
    skin: ['#C98A52', '#D89A62', '#B87E48', '#E0AE7C'],
    shirt: ['#E9553C', '#4C8FB8', '#57B01A', '#F6A623', '#8E6BC4', '#E86FA0'],
    amber: '#F6A623', amberDark: '#C4770F', brown: '#4A2A12',
    foam: '#E4FAFF', water: '#2BB4D4', waterDeep: '#1489B4', flood: '#3E92A8'
  };

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ------------------------------------------------------------------
     BANGKA — outrigger boat, drawn facing +X, origin at its centre
     ------------------------------------------------------------------ */
  function drawBoat(c, x, y, ang, s, opts) {
    opts = opts || {};
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.scale(s, s);

    // wake shadow
    c.fillStyle = 'rgba(6,40,55,.22)';
    c.beginPath(); c.ellipse(-2, 5, 30, 15, 0, 0, 6.2832); c.fill();

    // outrigger floats (katig) — one each side
    c.strokeStyle = P.bambooDark; c.lineWidth = 3.4; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(4, -9);  c.lineTo(2, -22);
    c.moveTo(-8, -9); c.lineTo(-10, -22);
    c.moveTo(4, 9);   c.lineTo(2, 22);
    c.moveTo(-8, 9);  c.lineTo(-10, 22);
    c.stroke();
    c.strokeStyle = P.bamboo; c.lineWidth = 4.6;
    c.beginPath(); c.moveTo(-18, -23); c.lineTo(16, -23); c.stroke();
    c.beginPath(); c.moveTo(-18, 23);  c.lineTo(16, 23);  c.stroke();

    // hull
    c.fillStyle = P.hull;
    c.beginPath();
    c.moveTo(26, 0);
    c.quadraticCurveTo(12, -11, -20, -8);
    c.quadraticCurveTo(-26, -4, -26, 0);
    c.quadraticCurveTo(-26, 4, -20, 8);
    c.quadraticCurveTo(12, 11, 26, 0);
    c.closePath(); c.fill();

    c.fillStyle = P.hullDark;
    c.beginPath();
    c.moveTo(26, 0);
    c.quadraticCurveTo(12, 6, -20, 8);
    c.quadraticCurveTo(-26, 4, -26, 0);
    c.closePath(); c.fill();

    // deck plank
    c.fillStyle = P.bamboo;
    rr(c, -19, -4.4, 36, 8.8, 3); c.fill();

    // passengers stacked toward the stern
    var seats = opts.aboard || 0;
    for (var i = 0; i < seats; i++) {
      var px = -12 + i * 9;
      c.fillStyle = P.shirt[i % P.shirt.length];
      rr(c, px - 3.2, -4, 6.4, 8, 2.6); c.fill();
      c.fillStyle = P.skin[i % P.skin.length];
      c.beginPath(); c.arc(px, -6.6, 3.1, 0, 6.2832); c.fill();
    }

    // the volunteer at the bow, in an amber vest
    c.fillStyle = P.amber;
    rr(c, 8, -4.6, 8, 9.2, 3.4); c.fill();
    c.fillStyle = P.skin[0];
    c.beginPath(); c.arc(12, -7.6, 3.5, 0, 6.2832); c.fill();
    c.fillStyle = P.amberDark;
    c.beginPath(); c.ellipse(12, -9.6, 5, 2.4, 0, Math.PI, 0); c.fill();

    // paddle
    c.strokeStyle = P.bambooDark; c.lineWidth = 2;
    c.beginPath(); c.moveTo(6, 6); c.lineTo(-6, 15); c.stroke();

    c.restore();
  }

  /* ------------------------------------------------------------------
     RESIDENT — a small figure with a triage icon floating above
     ------------------------------------------------------------------ */
  var TAG_ICON = { elderly: '👵', child: '🧒', injured: '🩹', adult: '🧍' };
  var TAG_COLOR = { elderly: '#8E6BC4', child: '#F6A623', injured: '#E9553C', adult: '#4C8FB8' };

  function drawResident(c, x, y, r, res, t) {
    var bob = Math.sin(t * 2.4 + (res.seed || 0)) * 1.6;
    var inWater = res.situation === 'water';

    c.save();
    c.translate(x, y + bob);

    if (inWater) {
      // ripple ring so "in the water" reads without relying on colour
      c.strokeStyle = 'rgba(228,250,255,.75)'; c.lineWidth = 2;
      var rr1 = r * (1.1 + 0.25 * Math.sin(t * 3 + res.seed));
      c.beginPath(); c.ellipse(0, r * 0.55, rr1 * 1.5, rr1 * 0.6, 0, 0, 6.2832); c.stroke();
    }

    // waving arms
    var wave = Math.sin(t * 6 + res.seed) * 0.5;
    c.strokeStyle = res.skin; c.lineWidth = r * 0.30; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-r * 0.4, -r * 0.1);
    c.lineTo(-r * 0.95, -r * 0.85 + wave * r * 0.3);
    c.moveTo(r * 0.4, -r * 0.1);
    c.lineTo(r * 0.95, -r * 0.85 - wave * r * 0.3);
    c.stroke();

    // body
    c.fillStyle = res.shirt;
    rr(c, -r * 0.52, -r * 0.28, r * 1.04, r * (inWater ? 0.78 : 1.15), r * 0.4); c.fill();

    // head
    c.fillStyle = res.skin;
    c.beginPath(); c.arc(0, -r * 0.72, r * 0.46, 0, 6.2832); c.fill();

    // hair / cap band, keeps the tags distinguishable in silhouette
    c.fillStyle = res.tag === 'elderly' ? '#E8E4DC' : '#3A2A1E';
    c.beginPath(); c.ellipse(0, -r * 0.9, r * 0.48, r * 0.28, 0, Math.PI, 0); c.fill();

    c.restore();

    // floating triage badge
    var by = y - r * 2.1 + bob;
    c.save();
    c.translate(x, by);
    c.fillStyle = TAG_COLOR[res.tag] || '#4C8FB8';
    rr(c, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.4); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6;
    rr(c, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.4); c.stroke();
    c.font = Math.round(r * 1.05) + 'px system-ui, "Segoe UI Emoji", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(TAG_ICON[res.tag] || '🧍', 0, r * 0.06);
    c.restore();

    // requirement pip beneath the badge (rope / lifebuoy / first-aid)
    if (res.need) {
      c.save();
      c.translate(x + r * 1.05, by + r * 0.9);
      c.fillStyle = 'rgba(14,30,40,.85)';
      c.beginPath(); c.arc(0, 0, r * 0.52, 0, 6.2832); c.fill();
      c.font = Math.round(r * 0.66) + 'px system-ui, "Segoe UI Emoji", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(res.need, 0, r * 0.04);
      c.restore();
    }

    // personal timer ring — drains as the situation worsens
    if (res.timer != null && res.timerMax) {
      var frac = BR.clamp(res.timer / res.timerMax, 0, 1);
      c.save();
      c.translate(x, y + bob);
      c.lineWidth = Math.max(2, r * 0.22);
      c.strokeStyle = 'rgba(10,26,34,.45)';
      c.beginPath(); c.arc(0, 0, r * 1.5, 0, 6.2832); c.stroke();
      c.strokeStyle = frac > 0.5 ? '#8FE04A' : (frac > 0.22 ? '#FFC44F' : '#FF6A4D');
      c.beginPath();
      c.arc(0, 0, r * 1.5, -Math.PI / 2, -Math.PI / 2 + frac * 6.2832);
      c.stroke();
      c.restore();
    }
  }

  /* ------------------------------------------------------------------
     TILES
     ------------------------------------------------------------------ */
  function drawRoof(c, x, y, s, cell, submergence) {
    var pal = [
      [P.roofA, P.roofADark], [P.roofB, P.roofBDark],
      [P.roofC, P.roofCDark], [P.roofD, P.roofDDark]
    ][cell.variant % 4];

    c.save();
    c.translate(x, y);

    // wall band showing how much is still above the waterline
    var above = 1 - submergence;
    c.fillStyle = P.concrete;
    c.fillRect(0, s * 0.34, s, s * 0.66);
    c.fillStyle = P.concreteDark;
    c.fillRect(0, s * 0.34, s, s * 0.10);

    c.fillStyle = pal[0];
    c.fillRect(0, 0, s, s * 0.40);
    c.fillStyle = pal[1];
    c.fillRect(0, s * 0.32, s, s * 0.08);

    // ridge line
    c.strokeStyle = 'rgba(255,255,255,.20)'; c.lineWidth = Math.max(1, s * 0.04);
    c.beginPath(); c.moveTo(0, s * 0.16); c.lineTo(s, s * 0.16); c.stroke();

    // waterline creeping up the wall, plus a wave hatch so the state is
    // never communicated by colour alone
    if (submergence > 0) {
      var wl = s * (1 - submergence * 0.85);
      c.fillStyle = 'rgba(62,146,168,.55)';
      c.fillRect(0, wl, s, s - wl);
      c.strokeStyle = 'rgba(228,250,255,.55)'; c.lineWidth = 1.4;
      for (var i = 0; i < 3; i++) {
        var yy = wl + 4 + i * 7;
        if (yy > s - 2) break;
        c.beginPath();
        c.moveTo(2, yy);
        c.quadraticCurveTo(s * 0.25, yy - 3, s * 0.5, yy);
        c.quadraticCurveTo(s * 0.75, yy + 3, s - 2, yy);
        c.stroke();
      }
    }
    c.restore();
    return above;
  }

  function drawTree(c, x, y, s, cell) {
    c.save(); c.translate(x + s / 2, y + s / 2);
    c.fillStyle = 'rgba(6,40,55,.2)';
    c.beginPath(); c.ellipse(2, s * 0.3, s * 0.4, s * 0.16, 0, 0, 6.2832); c.fill();
    c.fillStyle = P.trunk;
    c.fillRect(-s * 0.07, -s * 0.05, s * 0.14, s * 0.4);
    var n = 6, R = s * 0.44;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * 6.2832 + cell.variant;
      c.fillStyle = i % 2 ? P.leaf : P.leafDark;
      c.beginPath();
      c.moveTo(0, -s * 0.05);
      c.quadraticCurveTo(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6 - s * 0.3,
                         Math.cos(a) * R, Math.sin(a) * R - s * 0.12);
      c.quadraticCurveTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5 + s * 0.02, 0, -s * 0.05);
      c.fill();
    }
    c.fillStyle = P.leafLight;
    c.beginPath(); c.arc(0, -s * 0.12, s * 0.13, 0, 6.2832); c.fill();
    c.restore();
  }

  function drawDebris(c, x, y, s, cell, t) {
    c.save();
    c.translate(x + s / 2, y + s / 2);
    c.rotate(Math.sin(t * 0.6 + cell.variant) * 0.06 + cell.variant);
    c.fillStyle = 'rgba(6,40,55,.18)';
    c.beginPath(); c.ellipse(0, s * 0.16, s * 0.42, s * 0.16, 0, 0, 6.2832); c.fill();
    c.fillStyle = P.debris;
    rr(c, -s * 0.42, -s * 0.16, s * 0.84, s * 0.2, 3); c.fill();
    c.fillStyle = P.debrisDark;
    rr(c, -s * 0.3, -s * 0.3, s * 0.7, s * 0.16, 3); c.fill();
    c.save(); c.rotate(0.7);
    c.fillStyle = P.bambooDark;
    rr(c, -s * 0.38, -s * 0.05, s * 0.76, s * 0.11, 3); c.fill();
    c.restore();
    // corrugated sheet
    c.strokeStyle = P.concreteDark; c.lineWidth = 1.5;
    for (var i = -2; i <= 2; i++) {
      c.beginPath(); c.moveTo(i * s * 0.12, -s * 0.26); c.lineTo(i * s * 0.12, -s * 0.16); c.stroke();
    }
    c.restore();
  }

  function drawWire(c, x, y, s, t) {
    c.save(); c.translate(x + s / 2, y + s / 2);
    var pulse = 0.5 + 0.5 * Math.sin(t * 7);
    c.strokeStyle = 'rgba(255,196,79,' + (0.35 + 0.4 * pulse) + ')';
    c.lineWidth = 2 + pulse * 2;
    c.beginPath();
    c.moveTo(-s * 0.42, -s * 0.1);
    c.lineTo(-s * 0.12, s * 0.08);
    c.lineTo(s * 0.06, -s * 0.14);
    c.lineTo(s * 0.42, s * 0.06);
    c.stroke();
    c.fillStyle = 'rgba(255,122,92,' + (0.25 + 0.3 * pulse) + ')';
    c.beginPath(); c.arc(0, 0, s * 0.34, 0, 6.2832); c.fill();
    c.font = Math.round(s * 0.4) + 'px system-ui, "Segoe UI Emoji", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('⚡', 0, 0);
    c.restore();
  }

  function drawEvac(c, x, y, s, cell) {
    c.save(); c.translate(x, y);
    c.fillStyle = P.concrete; c.fillRect(0, 0, s, s);
    c.fillStyle = '#57B01A';
    c.fillRect(0, 0, s, s * 0.26);
    c.fillStyle = '#3F8410';
    c.fillRect(0, s * 0.22, s, s * 0.07);
    c.strokeStyle = P.concreteDark; c.lineWidth = 1;
    c.strokeRect(0.5, 0.5, s - 1, s - 1);
    if (cell.marker) {
      c.font = Math.round(s * 0.62) + 'px system-ui, "Segoe UI Emoji", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('🏫', s / 2, s * 0.64);
    }
    c.restore();
  }

  /* ------------------------------------------------------------------
     SUPPLY ICONS — used by the prep grid, boat slots and the hotbar
     ------------------------------------------------------------------ */
  var ICONS = {
    salbabida: function (c, s) {
      c.fillStyle = '#E9553C';
      c.beginPath(); c.arc(s / 2, s / 2, s * 0.36, 0, 6.2832); c.fill();
      c.fillStyle = '#FFF';
      for (var i = 0; i < 4; i++) {
        c.save(); c.translate(s / 2, s / 2); c.rotate(i * Math.PI / 2);
        c.fillRect(-s * 0.07, -s * 0.38, s * 0.14, s * 0.16); c.restore();
      }
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.arc(s / 2, s / 2, s * 0.16, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
    },
    botika: function (c, s) {
      c.fillStyle = '#F4F1EA'; rr(c, s * 0.16, s * 0.26, s * 0.68, s * 0.5, s * 0.09); c.fill();
      c.fillStyle = '#D8D2C4'; c.fillRect(s * 0.16, s * 0.26, s * 0.68, s * 0.08);
      c.fillStyle = '#E9553C';
      c.fillRect(s * 0.44, s * 0.38, s * 0.12, s * 0.28);
      c.fillRect(s * 0.36, s * 0.46, s * 0.28, s * 0.12);
      c.fillStyle = '#A79E8B'; c.fillRect(s * 0.4, s * 0.2, s * 0.2, s * 0.08);
    },
    flashlight: function (c, s) {
      c.save(); c.translate(s / 2, s / 2); c.rotate(-0.5);
      c.fillStyle = 'rgba(255,224,140,.55)';
      c.beginPath(); c.moveTo(s * 0.04, -s * 0.1); c.lineTo(s * 0.42, -s * 0.3);
      c.lineTo(s * 0.42, s * 0.3); c.lineTo(s * 0.04, s * 0.1); c.closePath(); c.fill();
      c.fillStyle = '#4C5A63'; rr(c, -s * 0.34, -s * 0.11, s * 0.34, s * 0.22, s * 0.05); c.fill();
      c.fillStyle = '#F6A623'; rr(c, -s * 0.02, -s * 0.14, s * 0.1, s * 0.28, s * 0.04); c.fill();
      c.restore();
    },
    lubid: function (c, s) {
      c.strokeStyle = '#C9A25E'; c.lineWidth = s * 0.11; c.lineCap = 'round';
      c.beginPath(); c.arc(s / 2, s / 2, s * 0.28, 0, 6.2832); c.stroke();
      c.strokeStyle = '#A9762F'; c.lineWidth = s * 0.05;
      c.beginPath(); c.arc(s / 2, s / 2, s * 0.28, 0, 6.2832); c.stroke();
      c.strokeStyle = '#C9A25E'; c.lineWidth = s * 0.1;
      c.beginPath(); c.moveTo(s * 0.66, s * 0.66); c.lineTo(s * 0.86, s * 0.86); c.stroke();
    },
    tubig: function (c, s) {
      c.fillStyle = 'rgba(95,214,230,.9)';
      rr(c, s * 0.3, s * 0.24, s * 0.4, s * 0.58, s * 0.08); c.fill();
      c.fillStyle = '#2BB4D4';
      rr(c, s * 0.3, s * 0.46, s * 0.4, s * 0.36, s * 0.08); c.fill();
      c.fillStyle = '#4C8FB8'; c.fillRect(s * 0.4, s * 0.14, s * 0.2, s * 0.12);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(s * 0.36, s * 0.3, s * 0.06, s * 0.36);
    },
    radyo: function (c, s) {
      c.fillStyle = '#3E4E58'; rr(c, s * 0.28, s * 0.3, s * 0.34, s * 0.54, s * 0.06); c.fill();
      c.fillStyle = '#5F6E79'; rr(c, s * 0.32, s * 0.36, s * 0.26, s * 0.16, s * 0.03); c.fill();
      c.strokeStyle = '#8E9AA2'; c.lineWidth = s * 0.06; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s * 0.56, s * 0.3); c.lineTo(s * 0.74, s * 0.1); c.stroke();
      c.fillStyle = '#F6A623'; c.beginPath(); c.arc(s * 0.76, s * 0.09, s * 0.07, 0, 6.2832); c.fill();
      c.fillStyle = '#2A343A';
      for (var i = 0; i < 3; i++) c.fillRect(s * 0.33, s * 0.58 + i * s * 0.08, s * 0.24, s * 0.04);
    },
    kapote: function (c, s) {
      c.fillStyle = '#F6A623';
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.18);
      c.quadraticCurveTo(s * 0.86, s * 0.34, s * 0.8, s * 0.84);
      c.lineTo(s * 0.2, s * 0.84);
      c.quadraticCurveTo(s * 0.14, s * 0.34, s * 0.5, s * 0.18);
      c.fill();
      c.fillStyle = '#C4770F';
      c.beginPath(); c.arc(s * 0.5, s * 0.28, s * 0.16, Math.PI, 0); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(s * 0.47, s * 0.34, s * 0.06, s * 0.5);
    },
    relief: function (c, s) {
      c.fillStyle = '#C9A25E'; rr(c, s * 0.2, s * 0.34, s * 0.6, s * 0.46, s * 0.05); c.fill();
      c.fillStyle = '#A9762F'; c.fillRect(s * 0.2, s * 0.34, s * 0.6, s * 0.09);
      c.fillStyle = '#57B01A';
      c.beginPath(); c.arc(s * 0.5, s * 0.57, s * 0.13, 0, 6.2832); c.fill();
      c.fillStyle = '#FFF'; c.font = 'bold ' + Math.round(s * 0.2) + 'px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('+', s * 0.5, s * 0.58);
    }
  };

  function drawSupplyIcon(c, id, size, ox, oy) {
    c.save();
    c.translate(ox || 0, oy || 0);
    var f = ICONS[id];
    if (f) f(c, size);
    else { c.fillStyle = '#A79E8B'; rr(c, size * 0.2, size * 0.2, size * 0.6, size * 0.6, 6); c.fill(); }
    c.restore();
  }

  /* Renders a supply icon into a standalone <canvas> for DOM use. */
  function supplyCanvas(id, px) {
    var cv = document.createElement('canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = px * dpr; cv.height = px * dpr;
    cv.style.width = px + 'px'; cv.style.height = px + 'px';
    var c = cv.getContext('2d');
    c.scale(dpr, dpr);
    drawSupplyIcon(c, id, px);
    return cv;
  }

  BR.art = {
    P: P, rr: rr, load: load, images: images,
    drawBoat: drawBoat, drawResident: drawResident,
    drawRoof: drawRoof, drawTree: drawTree, drawDebris: drawDebris,
    drawWire: drawWire, drawEvac: drawEvac,
    drawSupplyIcon: drawSupplyIcon, supplyCanvas: supplyCanvas,
    TAG_ICON: TAG_ICON, TAG_COLOR: TAG_COLOR
  };

})(window.BR);
