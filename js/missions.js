/* =====================================================================
   missions.js — the three missions and every number that tunes them.
   =====================================================================
   duration     seconds for the water to climb from 0 to maximum. This is
                the mission clock; the balance target is a competent run
                finishing in 2–4 minutes, which means clearing the roster
                before the gauge tops out.
   dark         0 = full daylight, 1 = pitch black. Drives the vision cone.
   rain         base rain intensity; scales up with the water level.
   ===================================================================== */
(function (BR) {
  'use strict';

  var MISSIONS = [
    {
      id: 'm1', index: 1, seed: 20110511,
      fil: 'Pagbaha sa Barangay', eng: 'The Water Rises',
      condition: 'Daytime · Flood',
      brief: 'The creek jumped its banks before dawn. Families are on their roofs and in the mango trees, waving at anything that floats.',
      teaches: 'Movement, boat capacity and the run back to the evacuation center.',
      difficulty: 1,
      cols: 37, rows: 26,
      slots: 4,
      duration: 205,
      dark: 0, rain: 0.25, wind: 0.12,
      wires: 0,
      currentLanes: 2,
      // 10 residents at a capacity of 3 forces four runs to the evacuation
      // center, which is what pushes a clean playthrough past two minutes.
      roster: { total: 10, water: 2, debris: 1, injured: 1 },
      recommended: ['salbabida', 'botika', 'lubid', 'tubig']
    },
    {
      id: 'm2', index: 2, seed: 19911225,
      fil: 'Ang Nawawala', eng: 'The Missing',
      condition: 'Dusk · Heavy rain',
      brief: 'The barangay radio is reading out names of people nobody has seen since the surge. They are out there somewhere in the blocks.',
      teaches: 'The flashlight, the radio, and searching under a clock.',
      difficulty: 2,
      cols: 40, rows: 27,
      slots: 5,
      duration: 200,
      dark: 0.66, rain: 0.7, wind: 0.3,
      wires: 0,
      currentLanes: 3,
      roster: { total: 11, water: 3, debris: 2, injured: 3 },
      recommended: ['flashlight', 'radyo', 'salbabida', 'botika', 'lubid']
    },
    {
      id: 'm3', index: 3, seed: 20131108,
      fil: 'Ang Huling Sakay', eng: 'The Last Boat',
      condition: 'Night · Water rising fastest',
      brief: 'Last run before the barangay is written off for the night. Live wires in the water, debris everywhere, and more people than one boat should carry.',
      teaches: 'Everything at once — and what the slot you skipped was really worth.',
      difficulty: 3,
      cols: 44, rows: 29,
      slots: 5,
      duration: 195,
      dark: 0.84, rain: 1.0, wind: 0.42,
      wires: 9,
      currentLanes: 4,
      roster: { total: 13, water: 4, debris: 3, injured: 4 },
      recommended: ['flashlight', 'salbabida', 'botika', 'lubid', 'radyo']
    }
  ];

  var BY_ID = {};
  MISSIONS.forEach(function (m) { BY_ID[m.id] = m; });

  BR.missions = {
    list: MISSIONS,
    get: function (id) { return BY_ID[id]; },
    byIndex: function (i) { return MISSIONS[i - 1] || null; },
    next: function (id) {
      var m = BY_ID[id];
      return m ? (MISSIONS[m.index] || null) : null;
    }
  };

})(window.BR);
