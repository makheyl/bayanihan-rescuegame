/* =====================================================================
   report.js — After-Action Report.
   Scores the run and, more importantly, names the link between what the
   player packed and what happened to the people they went out for.
   ===================================================================== */
(function (BR) {
  'use strict';

  var TAG_LABEL = {
    elderly: '👵 Elderly / Matanda',
    child:   '🧒 Child / Bata',
    injured: '🩹 Injured / Sugatan',
    adult:   '🧍 Able-bodied / Malakas'
  };

  function countBlocked(ms, id) {
    var m = ms.blockedAttempts[id];
    return m ? Object.keys(m).length : 0;
  }

  function stars(ratio, lost) {
    if (ratio >= 0.85 && lost <= 1) return 3;
    if (ratio >= 0.85) return 3;
    if (ratio >= 0.60) return 2;
    if (ratio > 0) return 1;
    return 0;
  }

  function show(mission, ms, roster, inv) {
    var total = ms.total;
    var ratio = total ? ms.rescued / total : 0;
    var st = stars(ratio, ms.lost);

    var result = {
      missionId: mission.id,
      stars: st, score: Math.round(ms.score),
      rescued: ms.rescued, lost: ms.lost, total: total,
      time: ms.elapsed, packed: inv.packed.slice()
    };
    BR.state.setReport(result);
    BR.state.recordBest(mission.id, result);
    if (st >= 1 && mission.index >= BR.state.progress.unlocked) {
      BR.state.unlock(Math.min(3, mission.index + 1));
    }

    /* ---------------- header ---------------- */
    var starHost = document.getElementById('repStars');
    starHost.innerHTML = '';
    for (var s = 0; s < 3; s++) {
      var sp = document.createElement('span');
      sp.className = 'star' + (s < st ? ' on' : '');
      sp.textContent = s < st ? '★' : '☆';
      starHost.appendChild(sp);
    }

    var verdictText = st === 3 ? 'MAHUSAY! · OUTSTANDING'
                    : st === 2 ? 'MAAYOS · SOLID RUN'
                    : st === 1 ? 'MAY NAKALIGTAS · SOME MADE IT'
                    : 'WALANG NASAGIP · NOBODY REACHED SAFETY';
    var endedText = {
      cleared: 'Every name on the list was accounted for.',
      flood:   'The water topped out and the mission ended where it stood.',
      called:  'You called it in from the evacuation center.',
      aborted: 'You abandoned the run.'
    }[ms.endedBy] || '';
    document.getElementById('repVerdict').innerHTML =
      verdictText + '<span>' + mission.fil + ' · ' + mission.eng + ' — ' + endedText + '</span>';

    /* ---------------- people ---------------- */
    var people = document.getElementById('repPeople');
    people.innerHTML =
      row('Naligtas · Rescued', '<b class="good">' + ms.rescued + '</b>') +
      row('Nawala · Lost', '<b class="bad">' + ms.lost + '</b>') +
      row('Kabuuan · Total on the roster', '<b>' + total + '</b>') +
      row('Ferry trips to the center', '<b>' + Math.max(ms.trips, ms.rescued ? 1 : 0) + '</b>') +
      row('Oras · Time taken', '<b>' + BR.fmtTime(ms.elapsed) + '</b>') +
      row('Waterline at finish', '<b>' + Math.round(ms.waterLevel * 100) + '%</b>') +
      row('Puntos · Score', '<b>' + Math.round(ms.score) + '</b>');

    /* ---------------- triage breakdown ---------------- */
    var byTag = {};
    roster.forEach(function (r) {
      byTag[r.tag] = byTag[r.tag] || { safe: 0, lost: 0 };
      if (r.state === 'safe') byTag[r.tag].safe++; else byTag[r.tag].lost++;
    });
    var triage = document.getElementById('repTriage');
    triage.innerHTML = '';
    ['injured', 'elderly', 'child', 'adult'].forEach(function (tag) {
      var d = byTag[tag];
      if (!d) return;
      triage.innerHTML += row(TAG_LABEL[tag],
        '<b class="' + (d.lost === 0 ? 'good' : (d.safe === 0 ? 'bad' : '')) + '">' +
        d.safe + ' / ' + (d.safe + d.lost) + '</b>');
    });
    var highTotal = (byTag.injured ? byTag.injured.safe + byTag.injured.lost : 0) +
                    (byTag.elderly ? byTag.elderly.safe + byTag.elderly.lost : 0) +
                    (byTag.child   ? byTag.child.safe   + byTag.child.lost   : 0);
    var highSafe = (byTag.injured ? byTag.injured.safe : 0) +
                   (byTag.elderly ? byTag.elderly.safe : 0) +
                   (byTag.child   ? byTag.child.safe   : 0);
    triage.innerHTML += row('<strong>High-priority saved</strong>',
      '<b class="' + (highSafe === highTotal ? 'good' : 'bad') + '">' + highSafe + ' / ' + highTotal + '</b>');

    /* ---------------- supplies ---------------- */
    var sup = document.getElementById('repSupplies');
    sup.innerHTML = '';
    var wasted = [];
    inv.packed.forEach(function (id) {
      var def = BR.supplies.get(id);
      var uses = inv.used[id] || 0;
      var earned = supplyEarned(id, roster, inv, ms);
      var verdictHtml;
      if (earned > 0) verdictHtml = '<b class="good">used · ' + earned + ' rescue' + (earned === 1 ? '' : 's') + '</b>';
      else if (uses > 0) verdictHtml = '<b>used ×' + uses + '</b>';
      else { verdictHtml = '<b class="bad">never needed</b>'; wasted.push(def); }
      sup.innerHTML += row(def.fil + ' <span style="opacity:.6">· ' + def.eng + '</span>', verdictHtml);
    });
    var left = BR.supplies.list.filter(function (d) { return inv.packed.indexOf(d.id) === -1; });
    if (left.length) {
      sup.innerHTML += '<div class="rrow" style="border-top:2px solid var(--paper-line); margin-top:.5em; padding-top:.7em">' +
        '<span style="opacity:.72">Left behind</span><b style="font-size:9px; text-align:right">' +
        left.map(function (d) { return d.fil; }).join(' · ') + '</b></div>';
    }

    /* ---------------- the lessons ---------------- */
    var host = document.getElementById('repLessons');
    host.innerHTML = '';
    buildLessons(mission, ms, roster, inv, wasted).forEach(function (l) {
      var div = document.createElement('div');
      div.className = 'lesson ' + l.kind;
      div.innerHTML = '<span class="ic" aria-hidden="true">' + l.icon + '</span><div>' + l.text + '</div>';
      host.appendChild(div);
    });

    /* ---------------- actions ---------------- */
    var nextM = BR.missions.next(mission.id);
    var nextBtn = document.getElementById('repNext');
    if (nextM && BR.state.progress.unlocked >= nextM.index) {
      nextBtn.disabled = false;
      nextBtn.textContent = 'Susunod · ' + nextM.eng + ' →';
      nextBtn.onclick = function () { BR.audio.play('click'); BR.prep.open(nextM); };
    } else if (nextM) {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Susunod · Locked — save someone first';
      nextBtn.onclick = null;
    } else {
      nextBtn.disabled = false;
      nextBtn.textContent = 'Tapos · All Missions Cleared';
      nextBtn.onclick = function () { BR.audio.play('click'); BR.ui.go('missions'); };
    }
    document.getElementById('repRetry').onclick = function () {
      BR.audio.play('click');
      BR.prep.open(mission);          // retry always returns to the packing screen
    };
    document.getElementById('repMenu').onclick = function () {
      BR.audio.play('back'); BR.ui.go('missions');
    };

    BR.ui.go('report');
  }

  function row(label, value) {
    return '<div class="rrow"><span>' + label + '</span>' + value + '</div>';
  }

  /* How many rescues a packed supply actually unlocked. */
  function supplyEarned(id, roster, inv, ms) {
    var n = 0;
    roster.forEach(function (r) {
      var reached = r.state === 'safe';
      if (!reached) return;
      if (id === 'salbabida' && r.situation === 'water') n++;
      else if (id === 'lubid' && r.situation === 'debris') n++;
      else if (id === 'botika' && r.tag === 'injured') n++;
      else if (id === 'relief') n++;
    });
    if (id === 'flashlight' || id === 'radyo' || id === 'kapote' || id === 'tubig') {
      return 0;   // these are graded in the lesson lines, not per-head
    }
    return n;
  }

  /* --------------------------------------------------------------------
     The prep linkage — the part the whole game exists to deliver.
     -------------------------------------------------------------------- */
  function buildLessons(mission, ms, roster, inv, wasted) {
    var out = [];
    var has = function (id) { return inv.packed.indexOf(id) !== -1; };
    var dark = mission.dark >= 0.3;

    // --- what you did not pack ---
    if (dark && !has('flashlight')) {
      var unfound = ms.neverFound;
      out.push({
        kind: 'bad', icon: '🔦',
        text: unfound > 0
          ? '<strong>You left the flashlight.</strong> ' + unfound + ' resident' + (unfound === 1 ? ' was' : 's were') +
            ' never found in time — you drove past ' + (unfound === 1 ? 'them' : 'them') + ' in the dark.'
          : '<strong>You left the flashlight</strong> on a ' + (mission.dark > 0.75 ? 'night' : 'dusk') +
            ' mission and searched almost blind. You got away with it this once.'
      });
    }
    var bSalb = countBlocked(ms, 'salbabida');
    if (!has('salbabida') && bSalb > 0) {
      out.push({
        kind: 'bad', icon: '🛟',
        text: '<strong>No salbabida.</strong> You pulled alongside ' + bSalb + ' person' + (bSalb === 1 ? '' : 's') +
              ' in open water and had nothing to throw them.'
      });
    }
    var bLub = countBlocked(ms, 'lubid');
    if (!has('lubid') && bLub > 0) {
      out.push({
        kind: 'bad', icon: '🪢',
        text: '<strong>No lubid.</strong> ' + bLub + ' resident' + (bLub === 1 ? ' was' : 's were') +
              ' pinned behind debris you could not clear by hand.'
      });
    }
    var bBot = countBlocked(ms, 'botika');
    if (!has('botika') && bBot > 0) {
      out.push({
        kind: 'bad', icon: '🩹',
        text: '<strong>No botika.</strong> ' + bBot + ' injured resident' + (bBot === 1 ? '' : 's') +
              ' could be reached but not stabilised, so ' + (bBot === 1 ? 'they' : 'they') + ' could not board at all.'
      });
    }

    // --- what you did pack, and what it bought ---
    if (has('radyo') && dark) {
      var pings = inv.used.radyo || 0;
      out.push({
        kind: pings > 0 ? 'good' : 'warn', icon: '📻',
        text: pings > 0
          ? '<strong>The radyo earned its slot.</strong> You called for a bearing ' + pings + ' time' + (pings === 1 ? '' : 's') +
            ' and it pointed you straight at people you had not seen yet.'
          : '<strong>You packed the radyo and never pressed it.</strong> A bearing was free the whole run.'
      });
    }
    if (has('flashlight') && dark) {
      out.push({
        kind: 'good', icon: '🔦',
        text: '<strong>The flashlight did the heavy lifting.</strong> Your search cone was roughly two and a half times ' +
              'longer and twice as wide as it would have been without it.'
      });
    }
    if (has('relief') && ms.rescued > 0) {
      out.push({
        kind: 'good', icon: '📦',
        text: '<strong>Relief goods:</strong> +' + (ms.rescued * 30) + ' points across ' + ms.rescued + ' deliveries — ' +
              'but that slot never pulled anyone out of the water.'
      });
    }
    if (has('tubig')) {
      var swigs = inv.used.tubig || 0;
      if (swigs === 0) out.push({
        kind: 'warn', icon: '💧',
        text: '<strong>Three swigs of tubig, unopened.</strong> Stamina was never your bottleneck on this run.'
      });
    }

    // --- wasted slots ---
    var deadWeight = wasted.filter(function (d) {
      return d.id !== 'kapote' && !(d.id === 'flashlight' && dark) && !(d.id === 'radyo' && dark);
    });
    if (deadWeight.length) {
      out.push({
        kind: 'warn', icon: '🎒',
        text: '<strong>Dead weight:</strong> ' + deadWeight.map(function (d) { return d.fil; }).join(', ') +
              ' came back untouched. On a ' + mission.slots + '-slot boat that is ' +
              (deadWeight.length === 1 ? 'a slot' : deadWeight.length + ' slots') + ' someone needed.'
      });
    }

    // --- outcome framing ---
    var unfoundLost = roster.filter(function (r) { return r.state === 'lost' && r.lostTo === 'unfound'; }).length;
    var drowned = roster.filter(function (r) { return r.state === 'lost' && r.lostTo === 'submerged'; }).length;
    if (drowned > 0) {
      out.push({
        kind: 'bad', icon: '🌊',
        text: '<strong>' + drowned + ' roof' + (drowned === 1 ? '' : 's') + ' went under with '
              + (drowned === 1 ? 'someone' : 'people') + ' still on ' + (drowned === 1 ? 'it' : 'them') +
              '.</strong> The low houses always flood first — that is who you go to first.'
      });
    }
    if (unfoundLost > 0 && !dark) {
      out.push({ kind: 'warn', icon: '🧭', text: unfoundLost + ' resident' + (unfoundLost === 1 ? '' : 's') + ' were never reached before the water topped out.' });
    }
    if (ms.rescued === ms.total) {
      out.push({
        kind: 'good', icon: '🏘️',
        text: '<strong>Buong barangay, ligtas.</strong> Every single person on the roster is at the evacuation ' +
              'center. That is what a packed bag buys you.'
      });
    }

    // --- always close on the real-world point ---
    out.push({
      kind: 'good', icon: '🎒',
      text: '<strong>Sa totoong buhay:</strong> the household go-bag is packed on a quiet day, not when the water ' +
            'is at the door — water, food, first-aid, flashlight, radio, whistle, IDs in a sealed bag. ' +
            'Every choice you just regretted is free to make correctly right now.'
    });

    return out;
  }

  BR.report = { show: show };

})(window.BR);
