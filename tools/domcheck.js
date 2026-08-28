/* Static wiring check: every id / selector the JS reaches for must exist in
   index.html, and every script tag must point at a file that exists. */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const htmlClasses = new Set([...html.matchAll(/\bclass="([^"]+)"/g)]
  .flatMap(m => m[1].split(/\s+/)).filter(Boolean));
const dataAttrs = new Set([...html.matchAll(/\b(data-[a-z-]+)/g)].map(m => m[1]));

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const cssLinks = [...html.matchAll(/<link[^>]*href="((?!http)[^"]+)"/g)].map(m => m[1]);

let problems = 0;
console.log('--- assets referenced by index.html ---');
for (const s of [...scripts, ...cssLinks]) {
  const p = path.join(ROOT, s);
  const ok = fs.existsSync(p);
  if (!ok) { problems++; console.log(`  MISSING  ${s}`); }
}
console.log(`  ${scripts.length} scripts, ${cssLinks.length} stylesheets checked`);

// every JS file that is on disk but not referenced
const onDisk = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
const referenced = new Set(scripts.map(s => path.basename(s)));
for (const f of onDisk) if (!referenced.has(f)) { problems++; console.log(`  ORPHAN js/${f} not loaded by index.html`); }

console.log('\n--- getElementById targets ---');
const missing = new Map();
for (const f of onDisk) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  for (const m of src.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) {
    if (!htmlIds.has(m[1])) {
      if (!missing.has(m[1])) missing.set(m[1], []);
      missing.get(m[1]).push(f);
    }
  }
}
if (missing.size === 0) console.log('  all resolve ✓');
else for (const [id, files] of missing) { problems++; console.log(`  MISSING #${id}  (used in ${[...new Set(files)].join(', ')})`); }

console.log('\n--- querySelector class/attr targets ---');
const selMissing = [];
for (const f of onDisk) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  for (const m of src.matchAll(/querySelector(?:All)?\(\s*'([^']+)'\s*\)/g)) {
    const sel = m[1];
    for (const cm of sel.matchAll(/\.([a-zA-Z][\w-]*)/g))
      if (!htmlClasses.has(cm[1])) selMissing.push(`${sel}  -> .${cm[1]} absent  (${f})`);
    for (const am of sel.matchAll(/\[(data-[a-z-]+)/g))
      if (!dataAttrs.has(am[1])) selMissing.push(`${sel}  -> ${am[1]} absent  (${f})`);
  }
}
if (!selMissing.length) console.log('  all resolve ✓');
else selMissing.forEach(s => { problems++; console.log('  ' + s); });

console.log('\n--- floater ids opened by data-floater / openFloater ---');
const wanted = new Set([
  ...[...html.matchAll(/data-floater="([^"]+)"/g)].map(m => m[1]),
  ...onDisk.flatMap(f => [...fs.readFileSync(path.join(ROOT,'js',f),'utf8')
    .matchAll(/(?:open|close)Floater\(\s*'([^']+)'/g)].map(m => m[1]))
]);
for (const w of wanted) {
  if (!htmlIds.has(w)) { problems++; console.log(`  MISSING floater #${w}`); }
}
if (![...wanted].some(w => !htmlIds.has(w))) console.log(`  ${wanted.size} floater targets resolve ✓`);

console.log('\n--- screens the router switches ---');
for (const s of ['title','missions','prep','game','report','farewell']) {
  if (!htmlIds.has('screen-' + s)) { problems++; console.log(`  MISSING #screen-${s}`); }
}
console.log('  6 screens checked');

console.log(problems ? `\n${problems} PROBLEM(S)` : '\nNo wiring problems found.');
process.exit(problems ? 1 : 0);
