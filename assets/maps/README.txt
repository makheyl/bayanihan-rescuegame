assets/maps/
============

This folder is intentionally empty of JSON.

The suggested file structure in prompt.md put per-mission tile layouts here
as JSON. That does not survive the "runs by opening index.html directly"
constraint: fetching a local .json file from a file:// origin is blocked by
CORS in Chrome, Edge and Safari, so the game would only run behind a server.

Instead the barangay layouts are generated in js/maps.js from each mission's
seed (see missions.js -> seed). The generator is deterministic, so a given
mission always produces exactly the same streets, houses, debris and current
lanes — a defence demo is reproducible run to run.

If this build ever moves behind a real server, js/maps.js already has the
right shape to swap for a loader: BR.maps.make(mission) returns a plain
object with { cols, rows, cells[], evac, dock, spawn }, which is precisely
what a JSON layout would deserialize into.
