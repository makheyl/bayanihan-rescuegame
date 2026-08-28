/* =====================================================================
   mission-select.js — three cards, played in order, each unlocking the
   next. Selecting one advances to the Preparation Phase, never straight
   into the mission.
   ===================================================================== */
(function (BR) {
  'use strict';

  var built = false;

  function build() {
    var host = document.getElementById('missionGrid');
    host.innerHTML = '';

    BR.missions.list.forEach(function (m) {
      var unlocked = BR.state.progress.unlocked >= m.index;
      var best = BR.state.progress.best[m.id];

      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'mcard';
      card.disabled = !unlocked;

      /* --- art: a minimap of the barangay this mission actually generates --- */
      var art = document.createElement('div');
      art.className = 'mcard__art';
      var cv = document.createElement('canvas');
      art.appendChild(cv);

      var num = document.createElement('span');
      num.className = 'mcard__num';
      num.textContent = 'MISYON ' + m.index;
      art.appendChild(num);

      var cond = document.createElement('span');
      cond.className = 'mcard__cond';
      cond.textContent = m.condition;
      art.appendChild(cond);

      if (!unlocked) {
        var lock = document.createElement('div');
        lock.className = 'mcard__lock';
        lock.innerHTML = '<span class="lk" aria-hidden="true">🔒</span>' +
                         'Naka-lock<br>Clear Mission ' + (m.index - 1) + ' first';
        art.appendChild(lock);
      }
      card.appendChild(art);

      /* --- body --- */
      var body = document.createElement('div');
      body.className = 'mcard__body';

      var name = document.createElement('h3');
      name.className = 'mcard__name';
      name.innerHTML = m.fil + '<span>' + m.eng + '</span>';
      body.appendChild(name);

      var brief = document.createElement('p');
      brief.className = 'mcard__brief';
      brief.textContent = m.brief;
      body.appendChild(brief);

      var meta = document.createElement('div');
      meta.className = 'mcard__meta';
      var pips = '<span class="pips" role="img" aria-label="Difficulty ' + m.difficulty + ' of 3">';
      for (var d = 1; d <= 3; d++) pips += '<i class="pip' + (d <= m.difficulty ? ' on' : '') + '"></i>';
      pips += '</span>';
      meta.innerHTML = '<span>' + m.roster.total + ' residents · ' + m.slots + ' supply slots</span>' + pips;
      body.appendChild(meta);

      var teach = document.createElement('p');
      teach.style.cssText = 'font-size:12px; opacity:.72; margin:.6em 0 0';
      teach.textContent = 'Teaches: ' + m.teaches;
      body.appendChild(teach);

      /* recommended supplies — a preview, not a prescription */
      var rec = document.createElement('div');
      rec.className = 'mcard__rec';
      var chips = m.recommended.map(function (id) {
        var def = BR.supplies.get(id);
        return '<span class="rec-chip">' + def.fil + '</span>';
      }).join('');
      rec.innerHTML = '<b>Barangay radio suggests</b><div class="rec-row">' + chips + '</div>';
      body.appendChild(rec);

      if (best) {
        var b = document.createElement('div');
        b.className = 'mcard__best';
        b.textContent = '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars) +
                        ' · best ' + best.score + ' pts · ' + best.rescued + '/' + best.total + ' rescued';
        body.appendChild(b);
      }

      card.appendChild(body);

      card.addEventListener('click', function () {
        if (!unlocked) return;
        BR.audio.play('click');
        BR.prep.open(m);
      });

      host.appendChild(card);

      // the preview needs the card in the DOM to measure itself
      requestAnimationFrame(function () {
        try { BR.maps.drawPreview(cv, BR.maps.make(m)); } catch (e) { /* preview is decorative */ }
      });
    });

    built = true;
  }

  BR.missionSelect = {
    open: function () { build(); BR.ui.go('missions'); },
    refresh: function () { if (built) build(); }
  };

})(window.BR);
