/* Runs every mission/loadout combination N times and reports medians, since
   the simulation carries real randomness (impacts, weather, overboard rolls). */
const { execFileSync } = require('child_process');
const path = require('path');
const ROOT = process.argv[2];
const N = parseInt(process.argv[3] || '5', 10);

const fs = require('fs'), vm = require('vm');
function stubEl() {
  return { style:{setProperty(){}}, classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    children:[], dataset:{}, innerHTML:'', textContent:'', value:'50', disabled:false,
    appendChild(c){this.children.push(c);return c;}, querySelector(){return null;}, querySelectorAll(){return [];},
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, getAttribute(){return null;},
    getBoundingClientRect(){return {left:0,top:0,width:1280,height:720};},
    getContext(){ return new Proxy({},{get:(t,k)=>{ if(k==='measureText') return ()=>({width:40});
      if(k==='createLinearGradient'||k==='createRadialGradient') return ()=>({addColorStop(){}});
      return ()=>{}; }, set(){return true;}}); },
    focus(){}, remove(){}, width:1280, height:720, clientWidth:1280, clientHeight:720 };
}
function makeSandbox() {
  const s = { console, Math, Date, JSON, Object, Array, String, Number, Promise, Error,
    parseInt, parseFloat, isNaN, setTimeout, clearTimeout, setInterval, clearInterval,
    navigator:{maxTouchPoints:0}, devicePixelRatio:1, Image:function(){}, Event:function(){} };
  s.window = s; s.self = s;
  s.document = { getElementById:()=>stubEl(), createElement:()=>stubEl(), querySelector:()=>null,
    querySelectorAll:()=>[], addEventListener(){}, body:stubEl(), readyState:'complete' };
  s.window.addEventListener=()=>{}; s.window.removeEventListener=()=>{};
  s.window.matchMedia=()=>({matches:false});
  s._raf = null;
  s.requestAnimationFrame = cb => { s._raf = cb; return 1; };
  s.cancelAnimationFrame = () => { s._raf = null; };
  vm.createContext(s);
  ['state','supplies','missions','maps','assets','rescue','hud','render','audio','game']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT,'js',f+'.js'),'utf8'), s, {filename:f+'.js'}));
  const BR = s.BR;
  BR.audio = new Proxy({}, { get: () => () => {} });
  BR.hud = { cache(){}, mount(){}, update(){}, setCtx(){}, banner(){}, drawPing(){} };
  BR.render = { draw(){}, resize(){} };
  BR.ui = { go(){}, openFloater(){}, closeFloater(){} };
  BR.toast = () => {};
  return s;
}
const makePilot = require('./pilot.js');

function once(mission, packed) {
  const s = makeSandbox(), BR = s.BR, g = BR.game;
  let done = false;
  BR.report = { show(){ done = true; } };
  g.start(mission, packed);
  const pilot = makePilot(BR, g);
  let ts = 0, stat = null, frames = 0;
  while (!done && frames++ < 60*60*6) {
    stat = pilot(1/60);
    ts += 1000/60;
    if (s._raf) s._raf(ts);
    if (g.ended) break;
  }
  const ms = g.missionState;
  return { time: ms.elapsed, rescued: ms.rescued, lost: ms.lost, total: ms.total,
           score: Math.round(ms.score), endedBy: ms.endedBy, water: ms.waterLevel,
           avg: stat.speedN ? stat.speedSum/stat.speedN : 0, stuck: stat.stuck,
           trips: ms.trips, unfound: ms.neverFound };
}

function med(a){ const b=a.slice().sort((x,y)=>x-y); return b[Math.floor(b.length/2)]; }

const s0 = makeSandbox();
const MISSIONS = s0.BR.missions.list;

console.log(`=== BALANCE (median of ${N} runs) ===\n`);
for (const m of MISSIONS) {
  const configs = [['recommended', m.recommended.slice(0, m.slots)], ['EMPTY pack', []]];
  if (m.dark >= 0.3) {
    configs.push(['no flashlight', m.recommended.filter(x=>x!=='flashlight').slice(0, m.slots)]);
    configs.push(['no radyo', m.recommended.filter(x=>x!=='radyo').slice(0, m.slots)]);
  }
  configs.push(['no rescue tools', ['relief','kapote','tubig','flashlight','radyo'].slice(0, m.slots)]);

  console.log(`-- ${m.fil} / ${m.eng}  (${m.slots} slots, ${m.duration}s rise, dark ${m.dark}, ${m.roster.total} residents) --`);
  for (const [label, pack] of configs) {
    const runs = []; for (let i=0;i<N;i++) runs.push(once(m, pack));
    const t = med(runs.map(r=>r.time)), sv = med(runs.map(r=>r.rescued));
    const av = med(runs.map(r=>r.avg)), st = med(runs.map(r=>r.stuck));
    const cleared = runs.filter(r=>r.endedBy==='cleared').length;
    console.log(`   ${label.padEnd(16)} ${t.toFixed(0).padStart(4)}s  saved ${String(sv).padStart(2)}/${m.roster.total}  ` +
      `cleared ${cleared}/${N}  score ${String(med(runs.map(r=>r.score))).padStart(5)}  ` +
      `trips ${med(runs.map(r=>r.trips))}  avg ${av.toFixed(0).padStart(3)}px/s  stuck ${st}`);
  }
  console.log('');
}
