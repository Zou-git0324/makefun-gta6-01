# Solmar Bay — Neon Tide

An open-world crime story in the browser. You are Lena "Vex" Marlowe, a
courier back in Solmar Bay with a burned bridge and a brother who owes
$40,000 to the Harlow crew. Ten jobs stand between her and a clean slate:
drive, deliver, steal, fight — and stay ahead of the Solmar Bay Police
Department.

## Play

Serve the `game` folder with any static server and open it:

```sh
cd game
python3 -m http.server 8123
```

Then open http://127.0.0.1:8123/ — the game runs entirely offline, no
account and no network needed. `main.ts` at the repo root is the
competition entrypoint: it bundles and serves the game.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Look around |
| E | Enter / steal a car, exit a car, start a job at the marker |
| F / Click | Punch up close, shoot at range (pistol, infinite ammo) |
| Shift | Sprint |
| Space | Handbrake while driving |
| P | Pause and save |
| M | Mute sound |

## The ten jobs

| # | Job | Pay |
| --- | --- | --- |
| 1 | First Fare — take the taxi, drop the passenger | $1,000 |
| 2 | The Package — carry a sealed box across town | $1,500 |
| 3 | The Getaway — steal a sports car, reach the northwest hideout | $2,000 |
| 4 | Dockside Deal — settle things with three Harlow men at the pier | $2,500 |
| 5 | Night Shift — 5 checkpoints against a 150-second clock | $3,000 |
| 6 | The Big Score — move a coupe across town, no stops | $3,500 |
| 7 | Marina Ambush — clear the ambush, then slip away | $4,000 |
| 8 | The Last Lap — 6 checkpoints against a 180-second clock | $5,000 |
| 9 | Dead Drops — collect 4 dead drops, bring them to the pier | $7,000 |
| 10 | Harlow's Farewell — steal the getaway car, run 6 checkpoints in 240 seconds | $12,000 |

## Systems

- **Wanted stars.** Stealing cars, hitting pedestrians and shooting all
  draw heat. Cruisers hunt you, ram you, and bust you if you stand still
  next to one on foot. Stars fade one at a time when you lie low.
- **Police helicopter.** It lifts off at four stars, circles overhead
  with its spotlight on you, shows on the minimap, and only stands down
  once the heat is back to two stars.
- **Vehicle kinds.** Sedans, sports cars, coupes, vans and taxis each
  drive differently — the sports car tops out at 43, the sedan at 34, the
  van at 26 — and the sports car wears a wing you can spot from across
  the map.
- **Vehicle damage.** Crashes hurt. Past 50 damage the car starts
  smoking, and the more hurt it is the slower it goes — up to half its
  top speed at 100 damage. The speedometer shows the damage bar and the
  car you are driving.
- **Dead drops.** A new step type: pick up every package on the list
  before the job moves on.

## Verify

The game is checked headless: Chrome drives the page through the
`__solmar` API on `window` — starting jobs, teleporting Lena to each
objective, setting the wanted level, crashing a car — and asserts the
results: mission 5's timer is armed on its first step, mission 9 pays
+$7,000, mission 10 pays +$12,000 with a 240-second clock, the helicopter
appears at four stars and leaves at two, a full-speed crash costs 52
damage and cuts the top speed from 43 to 32, and the four screenshots
are re-shot at four stars. `main.ts` must also bundle cleanly.

## Tech

Three.js (vendored, no CDN), plain ES modules, no build step for the
browser. Progress saves to local storage. The screenshots in
`screenshots/` are staged through the game's own `__solmar` API.
