/* =========================================================================
   TERRAQUA CLASH — animals.js
   The roster plus one procedural creature renderer shared by the character
   cards and the arena, so a card and its in-game body are always the same
   character.

   ASSET NOTE: /TERRAQUA_ELEMENTS/ turned out to be a layered export of the
   landing page (background / logo / characters / one button per file), not a
   folder of animal art. The roster below is therefore built from the
   characters actually drawn in that art — the polar bear, penguin, shiba and
   brown bear in 4.png, plus the raccoon and husky visible in the CHARACTER
   SELECT and PLAY NOW button icons — topped up with two SDG-14 species from
   the brief's fallback list so land and water are evenly matched.

   Stats are 1–5. class drives the Tide-Shift advantage:
     LAND  — fast on land, struggles in water
     WATER — fast in water, struggles on land
     AMPHI — no weakness, but never excels either
   ========================================================================= */
(function (global) {
  'use strict';

  var TQ = global.TQ || (global.TQ = {});
  var INK = '#2A1E18';

  var ROSTER = [
    {
      id: 'nanuq', name: 'Nanuq', species: 'Polar Bear', cls: 'AMPHI',
      sdg: [14, 15], source: 'in landing art',
      blurb: 'Heavy hitter that is equally at home on ice and in open water.',
      fact: 'Polar bears are listed as Vulnerable. They hunt from sea ice, and Arctic sea ice has been shrinking by roughly 13% per decade.',
      stats: { speed: 3, push: 5, size: 5, grip: 3 },
      art: {
        body: '#FFFFFF', bodyDk: '#DCE9F2', belly: '#FFFFFF', muzzle: '#F1F6FA',
        inner: '#F0B9C8', nose: '#3B2A2A', accent: '#FF6FA8',
        ears: 'tiny', face: 'muzzle', limbs: 'paw', tail: 'stub', extra: 'ring'
      }
    },
    {
      id: 'waddles', name: 'Waddles', species: 'Gentoo Penguin', cls: 'WATER',
      sdg: [14], source: 'in landing art',
      blurb: 'Rockets through flooded ground, but comically slow on dry land.',
      fact: 'Gentoo colonies shift as krill move with warming seas — some Antarctic penguin colonies have fallen by more than half in forty years.',
      stats: { speed: 4, push: 2, size: 2, grip: 2 },
      art: {
        body: '#3A4457', bodyDk: '#2A3243', belly: '#FFF9EC', muzzle: null,
        inner: '#FFA23A', nose: '#2B2B2B', accent: '#FF6FA8',
        ears: 'none', face: 'beak', limbs: 'flipper', tail: 'flat', extra: 'ring'
      }
    },
    {
      id: 'kuya', name: 'Kuya', species: 'Shiba Guardian', cls: 'LAND',
      sdg: [15], source: 'in landing art',
      blurb: 'The all-rounder. Best grip on the roster — hard to shove off.',
      fact: 'Domestic animals shape wild ones. Keeping pets supervised near protected habitat is one of the simplest ways to defend native ground-nesting wildlife.',
      stats: { speed: 4, push: 3, size: 3, grip: 5 },
      art: {
        body: '#EFA463', bodyDk: '#D4813F', belly: '#FFF3E0', muzzle: '#FFF3E0',
        inner: '#F0B9A0', nose: '#3B2A2A', accent: '#3E7BD6',
        ears: 'pointed', face: 'muzzle', limbs: 'paw', tail: 'bushy', extra: 'cape'
      }
    },
    {
      id: 'bruno', name: 'Bruno', species: 'Brown Bear', cls: 'LAND',
      sdg: [15], source: 'in landing art',
      blurb: 'Slowest mover, biggest shove. One good hit clears the ledge.',
      fact: 'Brown bears need huge connected ranges. Habitat fragmentation by roads and fencing is a leading cause of their decline.',
      stats: { speed: 2, push: 5, size: 5, grip: 4 },
      art: {
        body: '#A9703F', bodyDk: '#8A5730', belly: '#D9A86F', muzzle: '#D9A86F',
        inner: '#C98F62', nose: '#3B2A2A', accent: '#E0433F',
        ears: 'round', face: 'muzzle', limbs: 'paw', tail: 'stub', extra: 'shirt'
      }
    },
    {
      id: 'bandit', name: 'Bandit', species: 'Raccoon', cls: 'LAND',
      sdg: [15], source: 'button icon art',
      blurb: 'Fastest on the roster and light as a leaf — easy to knock around.',
      fact: 'Raccoons thrive in disturbed and urban habitat. Generalists like them boom while specialists disappear — a warning sign of a simplifying ecosystem.',
      stats: { speed: 5, push: 2, size: 2, grip: 4 },
      art: {
        body: '#8D97A6', bodyDk: '#6E7787', belly: '#D7DDE6', muzzle: '#EDF1F6',
        inner: '#B9C2CE', nose: '#2B2B2B', accent: '#33383F',
        ears: 'round', face: 'muzzle', limbs: 'paw', tail: 'ringed', extra: 'mask'
      }
    },
    {
      id: 'sitka', name: 'Sitka', species: 'Husky', cls: 'LAND',
      sdg: [14, 15], source: 'button icon art',
      blurb: 'Quick and sure-footed. Reads the shoreline better than most.',
      fact: 'Sled dogs still carry Arctic communities, but thinning sea ice is closing traditional winter travel routes that have been used for generations.',
      stats: { speed: 5, push: 3, size: 3, grip: 4 },
      art: {
        body: '#6C7A8C', bodyDk: '#505C6B', belly: '#FFFFFF', muzzle: '#FFFFFF',
        inner: '#E8B7B0', nose: '#2B2B2B', accent: '#57C8E8',
        ears: 'pointed', face: 'muzzle', limbs: 'paw', tail: 'bushy', extra: 'scarf'
      }
    },
    {
      id: 'nerida', name: 'Nerida', species: 'Sea Otter', cls: 'WATER',
      sdg: [14], source: 'roster fill (SDG 14)',
      blurb: 'Nimble in the shallows, and never lets go of her lucky clam.',
      fact: 'Sea otters are a keystone species — by eating urchins they protect kelp forests, which store carbon and shelter hundreds of other species.',
      stats: { speed: 4, push: 3, size: 3, grip: 2 },
      art: {
        body: '#8B6A4E', bodyDk: '#6E5239', belly: '#C9A882', muzzle: '#EFE0CC',
        inner: '#C09B7A', nose: '#2B2B2B', accent: '#7ED0E8',
        ears: 'tiny', face: 'muzzle', limbs: 'paw', tail: 'flat', extra: 'clam'
      }
    },
    {
      id: 'tala', name: 'Tala', species: 'Sea Turtle', cls: 'WATER',
      sdg: [14], source: 'roster fill (SDG 14)',
      blurb: 'A shell that shrugs off knockback — if she can reach the water.',
      fact: 'Six of the seven sea turtle species are threatened. Plastic waste and artificial light on nesting beaches are two of the biggest pressures.',
      stats: { speed: 2, push: 4, size: 4, grip: 5 },
      art: {
        body: '#5FAE6B', bodyDk: '#3F8A52', belly: '#C8E6A8', muzzle: '#7CC488',
        inner: '#9AD4A4', nose: '#2B2B2B', accent: '#B4783C',
        ears: 'none', face: 'turtle', limbs: 'flipper', tail: 'stub', extra: 'shell'
      }
    }
  ];

  /* How each class copes with the tile it is standing on.
     spd  — multiplier on acceleration and top speed
     sta  — change in stamina per second: POSITIVE recovers, NEGATIVE drains.
            (The sim does `stamina += sta * dt`, so the sign here is simply
            the direction the bar moves.)

     Drain is deliberately slower than the fastest tide cycle (9s on the reef):
     at 7.2/s a full bar lasts ~14s, so being caught out is a scramble to reach
     the right ground rather than an instant loss you cannot answer. */
  var BIOME = {
    LAND:  { land: { spd: 1.00, sta: 30 },   water: { spd: 0.60, sta: -7.2 } },
    WATER: { land: { spd: 0.62, sta: -7.2 }, water: { spd: 1.15, sta: 30 } },
    AMPHI: { land: { spd: 0.92, sta: 20 },   water: { spd: 1.00, sta: 20 } }
  };

  var CLASS_LABEL = { LAND: 'Land', WATER: 'Water', AMPHI: 'Amphibious' };

  /* ------------------------------------------------------------- drawing */

  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
  }
  function paint(ctx, fill, lw, stroke) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw > 0) { ctx.lineWidth = lw; ctx.strokeStyle = stroke || INK; ctx.lineJoin = 'round'; ctx.stroke(); }
  }

  /**
   * Draw a roster animal centred on (x, y).
   * @param r      half-width of the body; the creature occupies roughly 2r × 2.1r
   * @param o      { flip, lean, squash, t, alpha, shadow, dim }
   */
  function draw(ctx, def, x, y, r, o) {
    o = o || {};
    var a = def.art;
    var t = o.t || 0;
    var lw = Math.max(1.1, r * 0.072);
    // small parts (ears, beak) need a lighter outline or the stroke eats them
    var lwFine = lw * 0.7;
    var breathe = Math.sin(t * 2.1 + (def.id.charCodeAt(0))) * 0.02;
    var squash = (o.squash == null ? 1 : o.squash) * (1 + breathe);

    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;

    if (o.shadow !== false) {
      ell(ctx, x, y + r * 0.98, r * 0.82, r * 0.26);
      ctx.fillStyle = 'rgba(15,45,60,0.22)';
      ctx.fill();
    }

    ctx.translate(x, y);
    if (o.lean) ctx.rotate(o.lean);
    ctx.scale((o.flip ? -1 : 1) * (1 / squash), squash);

    var bodyY = r * 0.22, bodyRX = r * 0.80, bodyRY = r * 0.70;
    var headY = -r * 0.46, headR = r * 0.58;

    /* --- tail (behind everything) --- */
    if (a.tail === 'bushy' || a.tail === 'ringed') {
      ctx.save();
      ctx.translate(-r * 0.74, bodyY - r * 0.1);
      ctx.rotate(-0.5 + Math.sin(t * 3.4) * 0.14);
      ell(ctx, -r * 0.3, 0, r * 0.42, r * 0.26, -0.3);
      paint(ctx, a.tail === 'ringed' ? a.bodyDk : a.body, lw);
      if (a.tail === 'ringed') {
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#3B4148';
        for (var ri = 0; ri < 3; ri++) {
          ctx.fillRect(-r * 0.72 + ri * r * 0.24, -r * 0.3, r * 0.12, r * 0.6);
        }
        ctx.restore();
      }
      ctx.restore();
    } else if (a.tail === 'flat') {
      ell(ctx, -r * 0.72, bodyY + r * 0.28, r * 0.34, r * 0.17, -0.35);
      paint(ctx, a.bodyDk, lw);
    } else if (a.tail === 'stub') {
      ell(ctx, -r * 0.76, bodyY, r * 0.16, r * 0.15);
      paint(ctx, a.bodyDk, lw);
    }

    /* --- cape sits behind the body --- */
    if (a.extra === 'cape') {
      ctx.save();
      ctx.translate(0, bodyY - r * 0.2);
      ctx.rotate(Math.sin(t * 2.6) * 0.08);
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.15);
      ctx.quadraticCurveTo(-r * 1.02, r * 0.55, -r * 0.42, r * 0.9);
      ctx.quadraticCurveTo(0, r * 1.12, r * 0.42, r * 0.9);
      ctx.quadraticCurveTo(r * 1.02, r * 0.55, r * 0.6, -r * 0.15);
      ctx.closePath();
      paint(ctx, a.accent, lw);
      ctx.restore();
    }

    /* --- legs / feet --- */
    var footY = bodyY + bodyRY * 0.82;
    var footSwing = Math.sin(t * 6) * r * 0.06 * (o.moving ? 1 : 0);
    if (a.limbs === 'flipper') {
      ell(ctx, -r * 0.42, footY + footSwing, r * 0.28, r * 0.16, 0.25);
      paint(ctx, a.inner || a.bodyDk, lw);
      ell(ctx, r * 0.42, footY - footSwing, r * 0.28, r * 0.16, -0.25);
      paint(ctx, a.inner || a.bodyDk, lw);
    } else {
      ell(ctx, -r * 0.36, footY + footSwing, r * 0.24, r * 0.19);
      paint(ctx, a.bodyDk, lw);
      ell(ctx, r * 0.36, footY - footSwing, r * 0.24, r * 0.19);
      paint(ctx, a.bodyDk, lw);
    }

    /* --- body --- */
    ell(ctx, 0, bodyY, bodyRX, bodyRY);
    paint(ctx, a.body, lw);

    /* belly patch */
    ell(ctx, 0, bodyY + r * 0.12, bodyRX * 0.62, bodyRY * 0.68);
    paint(ctx, a.belly, 0);

    /* --- torso extras --- */
    if (a.extra === 'shirt') {
      ctx.save();
      ell(ctx, 0, bodyY, bodyRX, bodyRY); ctx.clip();
      ctx.fillStyle = a.accent;
      ctx.fillRect(-bodyRX, bodyY - r * 0.22, bodyRX * 2, bodyRY * 1.4);
      ctx.restore();
      ell(ctx, 0, bodyY, bodyRX, bodyRY);
      paint(ctx, null, lw);
    }
    if (a.extra === 'shell') {
      ell(ctx, 0, bodyY - r * 0.04, bodyRX * 0.94, bodyRY * 0.9);
      paint(ctx, a.accent, lw);
      ctx.save();
      ell(ctx, 0, bodyY - r * 0.04, bodyRX * 0.94, bodyRY * 0.9); ctx.clip();
      ctx.strokeStyle = 'rgba(60,35,15,0.45)'; ctx.lineWidth = lw * 0.7;
      for (var sx = -1; sx <= 1; sx++) {
        ctx.beginPath(); ctx.moveTo(sx * r * 0.34, bodyY - r); ctx.lineTo(sx * r * 0.34, bodyY + r); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-r, bodyY - r * 0.06); ctx.lineTo(r, bodyY - r * 0.06); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r, bodyY + r * 0.36); ctx.lineTo(r, bodyY + r * 0.36); ctx.stroke();
      ctx.restore();
    }

    /* --- arms / flippers --- */
    var armY = bodyY - r * 0.04;
    var armSwing = Math.sin(t * 6 + 1.6) * r * 0.07 * (o.moving ? 1 : 0);
    if (a.limbs === 'flipper') {
      ell(ctx, -bodyRX * 0.94, armY + armSwing, r * 0.17, r * 0.4, 0.35);
      paint(ctx, a.bodyDk, lw);
      ell(ctx, bodyRX * 0.94, armY - armSwing, r * 0.17, r * 0.4, -0.35);
      paint(ctx, a.bodyDk, lw);
    } else {
      ell(ctx, -bodyRX * 0.9, armY + armSwing, r * 0.2, r * 0.28, 0.3);
      paint(ctx, a.bodyDk, lw);
      ell(ctx, bodyRX * 0.9, armY - armSwing, r * 0.2, r * 0.28, -0.3);
      paint(ctx, a.bodyDk, lw);
    }

    /* --- swim ring worn around the middle --- */
    if (a.extra === 'ring') {
      ctx.save();
      ell(ctx, 0, bodyY + r * 0.3, bodyRX * 1.16, bodyRY * 0.48);
      paint(ctx, a.accent, lw);
      ell(ctx, 0, bodyY + r * 0.3, bodyRX * 0.62, bodyRY * 0.2);
      ctx.fillStyle = 'rgba(0,0,0,0.001)'; ctx.fill();
      paint(ctx, null, lw * 0.8);
      // little flowers
      ctx.fillStyle = '#FFF3B0';
      for (var fi = 0; fi < 4; fi++) {
        var fa = fi * (Math.PI / 2) + 0.5;
        ell(ctx, Math.cos(fa) * bodyRX * 0.92, bodyY + r * 0.3 + Math.sin(fa) * bodyRY * 0.34, r * 0.09, r * 0.07);
        ctx.fill();
      }
      ctx.restore();
    }
    if (a.extra === 'clam') {
      ell(ctx, bodyRX * 0.72, armY + r * 0.24, r * 0.26, r * 0.2, -0.2);
      paint(ctx, a.accent, lw);
    }
    if (a.extra === 'scarf') {
      ell(ctx, 0, bodyY - bodyRY * 0.82, bodyRX * 0.78, r * 0.16);
      paint(ctx, a.accent, lw);
    }

    /* --- head --- */
    var headBob = Math.sin(t * 2.1 + 0.7) * r * 0.02;

    /* ears go behind the head circle */
    if (a.ears === 'round' || a.ears === 'tiny') {
      var er = a.ears === 'tiny' ? headR * 0.36 : headR * 0.46;
      var ex = headR * 0.72, ey = headY + headBob - headR * 0.62;
      ell(ctx, -ex, ey, er, er); paint(ctx, a.body, lwFine);
      ell(ctx, ex, ey, er, er); paint(ctx, a.body, lwFine);
      ell(ctx, -ex, ey, er * 0.54, er * 0.54); paint(ctx, a.inner, 0);
      ell(ctx, ex, ey, er * 0.54, er * 0.54); paint(ctx, a.inner, 0);
    } else if (a.ears === 'pointed') {
      [-1, 1].forEach(function (s) {
        ctx.beginPath();
        ctx.moveTo(s * headR * 0.3, headY + headBob - headR * 0.5);
        ctx.quadraticCurveTo(s * headR * 1.12, headY + headBob - headR * 1.5, s * headR * 0.94, headY + headBob - headR * 0.34);
        ctx.closePath();
        paint(ctx, a.body, lwFine);
        ctx.beginPath();
        ctx.moveTo(s * headR * 0.46, headY + headBob - headR * 0.58);
        ctx.quadraticCurveTo(s * headR * 0.88, headY + headBob - headR * 1.18, s * headR * 0.8, headY + headBob - headR * 0.46);
        ctx.closePath();
        paint(ctx, a.inner, 0);
      });
    }

    ell(ctx, 0, headY + headBob, headR, headR * 0.94);
    paint(ctx, a.body, lw);

    /* face patch */
    if (a.face === 'muzzle') {
      ell(ctx, 0, headY + headBob + headR * 0.3, headR * 0.66, headR * 0.5);
      paint(ctx, a.muzzle, 0);
    } else if (a.face === 'turtle') {
      ell(ctx, 0, headY + headBob + headR * 0.24, headR * 0.72, headR * 0.56);
      paint(ctx, a.muzzle, 0);
    } else if (a.face === 'beak') {
      ell(ctx, 0, headY + headBob + headR * 0.16, headR * 0.62, headR * 0.68);
      paint(ctx, a.belly, 0);
    }

    /* raccoon bandit mask */
    if (a.extra === 'mask') {
      ctx.save();
      ell(ctx, 0, headY + headBob, headR, headR * 0.94); ctx.clip();
      ctx.fillStyle = a.accent;
      ctx.beginPath();
      ctx.ellipse(0, headY + headBob - headR * 0.06, headR * 1.1, headR * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* eyes */
    var eyeY = headY + headBob - headR * 0.06;
    var eyeX = headR * 0.34;
    var blink = (Math.sin(t * 0.9 + def.id.length) > 0.985) ? 0.12 : 1;
    [-1, 1].forEach(function (s) {
      ell(ctx, s * eyeX, eyeY, headR * 0.15, headR * 0.19 * blink);
      paint(ctx, a.extra === 'mask' ? '#12161A' : (a.accent === '#57C8E8' ? '#57C8E8' : '#2B2320'), 0);
      if (blink > 0.5) {
        ell(ctx, s * eyeX + headR * 0.06, eyeY - headR * 0.07, headR * 0.055, headR * 0.06);
        paint(ctx, '#FFFFFF', 0);
      }
    });

    /* nose / beak / mouth */
    if (a.face === 'beak') {
      ctx.beginPath();
      ctx.moveTo(-headR * 0.2, headY + headBob + headR * 0.2);
      ctx.quadraticCurveTo(0, headY + headBob + headR * 0.62, headR * 0.2, headY + headBob + headR * 0.2);
      ctx.quadraticCurveTo(0, headY + headBob + headR * 0.3, -headR * 0.2, headY + headBob + headR * 0.2);
      ctx.closePath();
      paint(ctx, a.inner, lwFine);
    } else {
      ell(ctx, 0, headY + headBob + headR * 0.22, headR * 0.15, headR * 0.12);
      paint(ctx, a.nose, 0);
      ctx.beginPath();
      ctx.moveTo(-headR * 0.16, headY + headBob + headR * 0.42);
      ctx.quadraticCurveTo(0, headY + headBob + headR * 0.56, headR * 0.16, headY + headBob + headR * 0.42);
      ctx.lineWidth = lw * 0.7; ctx.strokeStyle = INK; ctx.stroke();
    }

    /* hero mask over the eyes */
    if (a.extra === 'cape') {
      ctx.beginPath();
      ctx.moveTo(-headR * 0.72, eyeY - headR * 0.26);
      ctx.lineTo(headR * 0.72, eyeY - headR * 0.26);
      ctx.lineTo(headR * 0.5, eyeY + headR * 0.2);
      ctx.lineTo(-headR * 0.5, eyeY + headR * 0.2);
      ctx.closePath();
      ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * 0.92;
      paint(ctx, a.accent, lw * 0.8);
      ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha);
      [-1, 1].forEach(function (s) {
        ell(ctx, s * eyeX, eyeY - headR * 0.02, headR * 0.13, headR * 0.15);
        paint(ctx, '#FFFFFF', 0);
      });
    }

    ctx.restore();
  }

  /* Convenience: render one animal to fill a canvas element. */
  function drawToCanvas(canvas, def, opts) {
    opts = opts || {};
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || canvas.width || 200;
    var h = canvas.clientHeight || canvas.height || 200;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (opts.ground !== false) {
      // little island so the card has depth
      ctx.fillStyle = 'rgba(255,216,134,.95)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.82, w * 0.34, h * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(42,30,24,.35)'; ctx.lineWidth = 2; ctx.stroke();
    }
    var r = Math.min(w, h) * 0.29;
    draw(ctx, def, w / 2, h * 0.62, r, { t: opts.t || 0, moving: false });
  }

  var byId = {};
  ROSTER.forEach(function (d) { byId[d.id] = d; });

  TQ.animals = {
    list: ROSTER,
    byId: function (id) { return byId[id] || ROSTER[0]; },
    ids: ROSTER.map(function (d) { return d.id; }),
    BIOME: BIOME,
    classLabel: function (cls) { return CLASS_LABEL[cls] || cls; },
    biome: function (def, tile) { return BIOME[def.cls][tile === 'water' ? 'water' : 'land']; },
    draw: draw,
    drawToCanvas: drawToCanvas,
    INK: INK,
    /* derived physics values so cards and the sim agree */
    derive: function (def) {
      var s = def.stats;
      return {
        maxSpeed: 168 + s.speed * 26,
        accel: 690 + s.speed * 135,
        push: 0.72 + s.push * 0.27,
        radius: 19 + s.size * 3.6,
        mass: 0.6 + s.size * 0.34,
        grip: 0.5 + s.grip * 0.12,
        dashPower: 250 + s.push * 34
      };
    }
  };

}(window));
