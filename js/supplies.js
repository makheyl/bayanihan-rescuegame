/* =====================================================================
   supplies.js — the eight things worth taking, and what each one
   actually does in the field.
   =====================================================================
   `mode` drives the hotbar:
     passive  — works simply by being packed
     toggle   — pressing its number turns it on/off
     charge   — pressing its number spends one of `charges`
     cooldown — pressing its number fires it, then waits `cooldown` seconds
   ===================================================================== */
(function (BR) {
  'use strict';

  var LIST = [
    {
      id: 'salbabida', fil: 'Salbabida', eng: 'Lifebuoy', mode: 'passive',
      fx: 'Lets you pull someone out of open water. Without it you can only pass them by.',
      tip: 'Unlocks every resident already in the current.'
    },
    {
      id: 'botika', fil: 'Botika', eng: 'First-aid kit', mode: 'passive',
      fx: 'Stabilise an injured resident (a 2-second hold) so they can board at all.',
      tip: 'Injured residents carry the highest score and the shortest timer.'
    },
    {
      id: 'flashlight', fil: 'Flashlight', eng: 'Flashlight', mode: 'toggle', defaultOn: true,
      fx: 'Widens and lengthens the visibility cone. At dusk and at night, searching without it is nearly blind.',
      tip: 'Daylight mission? It does almost nothing. Night mission? It is everything.'
    },
    {
      id: 'lubid', fil: 'Lubid', eng: 'Rope', mode: 'passive',
      fx: 'Haul residents out from behind debris and off collapsing structures.',
      tip: 'Debris piles are marked with a rope pip.'
    },
    {
      id: 'tubig', fil: 'Tubig', eng: 'Drinking water', mode: 'charge', charges: 3,
      fx: 'Three swigs. Each one refills stamina instantly, so you can keep pushing against the current.',
      tip: 'Stamina is what lets you fight a current lane instead of going around it.'
    },
    {
      id: 'radyo', fil: 'Radyo', eng: 'Two-way radio', mode: 'cooldown', cooldown: 20,
      fx: 'Points to the nearest resident you have not found yet, then cools down for 20 seconds.',
      tip: 'The search assist. Pairs with the flashlight on Mission 2.'
    },
    {
      id: 'kapote', fil: 'Kapote', eng: 'Raincoat', mode: 'passive',
      fx: 'Cuts the rain visibility penalty for everyone in the boat.',
      tip: 'Helps most when the rain is heaviest — late in a mission.'
    },
    {
      id: 'relief', fil: 'Relief Goods', eng: 'Food packs', mode: 'passive',
      fx: '+30 points for every resident you deliver. Costs a slot a rescue tool could have used.',
      tip: 'Pure score. It never saves anyone the tools would have saved.'
    }
  ];

  var BY_ID = {};
  LIST.forEach(function (s) { BY_ID[s.id] = s; });

  BR.supplies = {
    list: LIST,
    get: function (id) { return BY_ID[id]; },
    has: function (packed, id) { return packed.indexOf(id) !== -1; },

    /* Runtime inventory built at mission start from the packed loadout.
       Kept as a plain object so it serializes with the rest of the state. */
    makeInventory: function (packed) {
      var inv = { packed: packed.slice(), state: {}, used: {} };
      packed.forEach(function (id) {
        var def = BY_ID[id];
        if (!def) return;
        inv.state[id] = {
          on: def.mode === 'toggle' ? !!def.defaultOn : false,
          charges: def.charges || 0,
          cd: 0
        };
        inv.used[id] = 0;
      });
      return inv;
    }
  };

})(window.BR);
