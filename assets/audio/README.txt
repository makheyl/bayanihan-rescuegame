assets/audio/
=============

Intentionally empty. Every sound in the build is synthesised at runtime with
the Web Audio API — see js/audio.js. Nothing autoplays: the AudioContext is
created on the first pointerdown or keydown (js/main.js -> wireAudioUnlock).

Cues currently synthesised:
  click, back, pack, unpack, deny        UI
  splash, bump, rescue, stabilise        rescue loop
  dropoff, lost, ping, drink, torch      supplies and delivery
  thunder, alarm, help                   weather and the calls for help
  win, fail                              mission end
plus a continuous rain bed and a drone that tightens as the water rises.

If real audio files are dropped in here later, BR.audio.loadFile(url) in
js/audio.js is the hook — but note it uses fetch(), which needs a server;
from file:// the synthesised cues are the only ones that work.
