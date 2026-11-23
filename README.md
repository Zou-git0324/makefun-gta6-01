[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zou-git0324/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zou-git0324/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — Neon Tide

An open-world crime story that runs entirely in your browser. You are Lena
"Vex" Marlowe, a courier in Solmar Bay — a neon city of palm-lined avenues,
marina deals, and cops who never sleep. Her brother Dario owes $40,000 to the
Harlow crew. Eleven jobs. One debt. No way back but forward.

Walk the streets, steal cars, outrun the police, and finish all eleven jobs
to clear the debt. The whole game is plain HTML, CSS, and JavaScript on top
of three.js — no downloads, no accounts, no network calls once it loads.

## Controls

| Key | What it does |
| --- | --- |
| W A S D | Move on foot / drive |
| Mouse drag | Look around |
| E | Enter or steal a car (exit the car while driving) |
| F / Click | Punch up close, shoot otherwise |
| Shift | Sprint on foot |
| Space | Handbrake while driving |
| P | Pause and save |
| M | Mute |

## The eleven jobs

| # | Job | Pay | What happens |
| --- | --- | --- | --- |
| 1 | First Fare | $1,000 | Get in the taxi and drive a fare across town. |
| 2 | The Package | $1,500 | Pick up a package and deliver it. The cops take notice on arrival. |
| 3 | The Getaway | $2,000 | Steal a sports car and drive it across town with two stars on you. |
| 4 | Dockside Deal | $2,500 | Meet the contact at the docks, fight off the ambush, deliver. |
| 5 | Night Shift | $3,000 | Hit five checkpoints around the city in 150 seconds. |
| 6 | The Big Score | $3,500 | Steal a coupe and deliver it to the buyer. |
| 7 | Marina Ambush | $4,000 | Walk into an ambush at the marina, fight through, make two drops. |
| 8 | The Last Lap | $5,000 | Six checkpoints in 180 seconds, end to end across the city. |
| 9 | Dead Drops | $7,000 | Collect four dead drops hidden around town, then deliver. |
| 10 | Harlow's Farewell | $12,000 | Steal the getaway car and run six checkpoints in 240 seconds with three stars on you. |
| 11 | Solmar Stash Run | $10,000 | Collect six stash packages hidden across the city in 300 seconds. |

Finish job 10 and the $40,000 debt is paid. Job 11 is the victory lap: the
stash run is open from the start, so you can take it whenever you like.

Walk up to a glowing beacon in the world to start the next job, or press
START STORY from the menu. Every completed job is saved, and CONTINUE picks
up where you left off.

## Systems

- **Wanted level.** Stealing cars, running down pedestrians, and fighting
  draw stars — up to five. Stars fade one at a time if you stay out of
  trouble for twenty seconds. Sit still next to a patrol car while wanted
  and you get busted: a $500 fine and a trip back to the marina.
- **Police helicopter.** At four stars a police helicopter joins the chase.
  It circles above you with a spinning rotor and a searchlight, and it
  shows up as a blip on the minimap. Drop to two stars and it is gone.
- **Vehicle types.** Sedans, sports cars, coupes, vans, and taxis all drive
  differently — sports cars are the fastest, vans the slowest — and each
  has its own body shape. The sports car carries a rear spoiler; the taxi
  has a roof sign; police cars have a light bar.
- **Vehicle damage.** Crashing into other cars damages yours. Past 50%
  damage the car starts smoking, and its top speed falls — up to half at
  full damage. The speedometer shows a damage bar and the model you are
  driving. Buildings stop you but do not damage the car.
- **Stash runs.** Stash packages glow in the world and show as blips on the
  minimap. The HUD counts them down and runs the clock while a stash job
  is active. Run out of time and the job fails cleanly — the game keeps
  running and you can retry.
- **Traffic and pedestrians.** Fourteen cars drive the road grid and
  twenty-six pedestrians walk the sidewalks. Traffic and foot traffic keep
  moving while you are in the menu.
- **Day and night.** The clock runs a full day in 48 real minutes, and the
  sun and sky follow it.

## How to run it

Serve the `game/` folder with any static server and open `index.html`:

```sh
cd game
python3 -m http.server 8123
```

Then open `http://localhost:8123/`. The game needs no build step and makes
no network requests — every script, image, and font it loads is a file
under `game/` or a `data:` URI.

For a reproducible city layout, add a seed to the URL, for example
`http://localhost:8123/?seed=7`. The same seed always generates the same
streets, traffic, and pedestrians.

## Notes

A fan-made tribute, not affiliated with Rockstar Games or Take-Two
Interactive. Built for the make.fun gta6-01 bounty.
