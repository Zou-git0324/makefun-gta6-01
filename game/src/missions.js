// Solmar Bay — missions: the eleven jobs, the step engine and the stash run.
// A mission is a list of steps. Step types:
//   getIn  — get into the parked car of a kind at (x, z)
//   goto   — reach a point (optionally in a car, optionally wanted on arrival)
//   steal  — steal the parked car of a kind at (x, z), stars on the steal
//   combat — clear the enemies spawned at (x, z)
//   checkpoints — hit every point before the timer runs out; the timer is
//     armed the moment the step starts, never on the first checkpoint
//   collect — pick up every point; each one is a glowing marker in the
//     world and a blip on the minimap, with its own counter and timer
// Mission 11, the Solmar Stash Run, is a collect step with six stashes and
// a 300-second clock. It is open from the start: no chain gate.

import { MISSIONS, STASH } from './config.js';

const DEFS = [
  {
    id: 1, name: 'First Fare', reward: 1000,
    intro: [
      { who: 'Dispatcher', text: 'Vex, you still owe the Harlows forty grand. First fare is waiting — a taxi, north side. Take it and drop the passenger downtown.' },
      { who: 'Lena', text: 'One fare at a time. Fine. Point me at the cab.' },
    ],
    steps: [
      { type: 'getIn', kind: 'taxi', x: -30, z: 150, label: 'Get in the taxi' },
      { type: 'goto', x: 90, z: -90, label: 'Drop the passenger off', radius: 12 },
    ],
    outro: [
      { who: 'Dispatcher', text: 'Passenger delivered, no complaints. That is how you start paying a debt.' },
    ],
  },
  {
    id: 2, name: 'The Package', reward: 1500,
    intro: [
      { who: 'Mr. Harlow', text: 'A package is waiting on the west side. Pick it up, carry it east, and do not open it. Curious couriers get fired. Permanently.' },
      { who: 'Lena', text: 'West side, east side, sealed box. Got it.' },
    ],
    steps: [
      { type: 'goto', x: -150, z: 30, label: 'Pick up the package', radius: 10 },
      { type: 'goto', x: 150, z: -150, label: 'Deliver the package', radius: 10, wantedOnArrive: 1 },
    ],
    outro: [
      { who: 'Mr. Harlow', text: 'Delivered. The east side boys are watching you now — that is the price of the route.' },
    ],
  },
  {
    id: 3, name: 'The Getaway', reward: 2000,
    intro: [
      { who: 'Dario', text: 'Lena, listen — there is a sports car parked on the east road and a hideout in the northwest. Take the car, lose whoever notices, get to the hideout.' },
      { who: 'Lena', text: 'You owe me for this one too, little brother.' },
    ],
    steps: [
      { type: 'steal', kind: 'sports', x: 30, z: 90, label: 'Steal the sports car', wantedOnSteal: 2 },
      { type: 'goto', x: -150, z: -150, label: 'Reach the hideout in the northwest', radius: 12, needCar: true },
    ],
    outro: [
      { who: 'Dario', text: 'You made it. Hideout key is under the mat. Do not ask whose mat.' },
    ],
  },
  {
    id: 4, name: 'Dockside Deal', reward: 2500,
    intro: [
      { who: 'Mr. Harlow', text: 'Three of my men are waiting at the pier and they have forgotten who they work for. Go down there and remind them. Then come home.' },
      { who: 'Lena', text: 'Three of them. One of me. Fine.' },
    ],
    steps: [
      { type: 'goto', x: -90, z: 180, label: 'Go to the pier', radius: 10 },
      { type: 'combat', x: -90, z: 180, count: 3, label: 'Deal with the three Harlow men' },
      { type: 'goto', x: 30, z: 30, label: 'Leave the docks', radius: 10 },
    ],
    outro: [
      { who: 'Mr. Harlow', text: 'They remember now. You have a talent for reminding people, Vex.' },
    ],
  },
  {
    id: 5, name: 'Night Shift', reward: 3000,
    intro: [
      { who: 'Dispatcher', text: 'Five checkpoints, one timer, no excuses. The night route pays triple because nobody finishes it. Prove the nobody wrong.' },
      { who: 'Lena', text: 'Five stops, one clock. I drive fast when I have to.' },
    ],
    steps: [
      {
        type: 'checkpoints', label: 'Hit all 5 checkpoints before the timer runs out', timeLimit: 150,
        points: [{ x: -150, z: 150 }, { x: 150, z: 150 }, { x: 150, z: -150 }, { x: -150, z: -150 }, { x: 30, z: 30 }],
      },
    ],
    outro: [
      { who: 'Dispatcher', text: 'Five for five, inside the clock. The night route has a new name on it.' },
    ],
  },
  {
    id: 6, name: 'The Big Score', reward: 3500,
    intro: [
      { who: 'Mr. Harlow', text: 'A coupe is sitting on the north road with the keys in it. Somebody wants it moved across town, no questions, no stops. You are the somebody.' },
      { who: 'Lena', text: 'Keys in it. Across town. No stops. I can do no stops.' },
    ],
    steps: [
      { type: 'steal', kind: 'coupe', x: -90, z: -30, label: 'Steal the coupe', wantedOnSteal: 2 },
      { type: 'goto', x: 150, z: 150, label: 'Deliver the coupe', radius: 12, needCar: true },
    ],
    outro: [
      { who: 'Mr. Harlow', text: 'Parked, locked, untouched. You drive like the car is yours. It is not. Remember that.' },
    ],
  },
  {
    id: 7, name: 'Marina Ambush', reward: 4000,
    intro: [
      { who: 'Dario', text: 'The marina is crawling with the crew that jumped me. They are waiting for a courier. Walk in like you own the place, then walk out the same way.' },
      { who: 'Lena', text: 'They jumped my brother. They can wait for me instead.' },
    ],
    steps: [
      { type: 'goto', x: 90, z: 180, label: 'Go to the marina', radius: 10 },
      { type: 'combat', x: 90, z: 180, count: 4, label: 'Clear the ambush at the marina' },
      { type: 'goto', x: -30, z: -90, label: 'Slip away north', radius: 10 },
      { type: 'goto', x: -150, z: 90, label: 'Lose them for good', radius: 10 },
    ],
    outro: [
      { who: 'Dario', text: 'Four down and you walked out. The marina is quiet tonight. Thank you, sis.' },
    ],
  },
  {
    id: 8, name: 'The Last Lap', reward: 5000,
    intro: [
      { who: 'Dispatcher', text: 'Six checkpoints, three minutes, one city that is not slowing down for you. This is the lap they time you on. Make it count.' },
      { who: 'Lena', text: 'Six stops, three minutes. Watch the clock, not me.' },
    ],
    steps: [
      {
        type: 'checkpoints', label: 'Hit all 6 checkpoints before the timer runs out', timeLimit: 180,
        points: [{ x: -150, z: -150 }, { x: 30, z: -150 }, { x: 150, z: -30 }, { x: 150, z: 150 }, { x: -30, z: 150 }, { x: -150, z: 30 }],
      },
    ],
    outro: [
      { who: 'Dispatcher', text: 'Six for six. The timing board has your name at the top now.' },
    ],
  },
  {
    id: 9, name: 'Dead Drops', reward: 7000,
    intro: [
      { who: 'Mr. Harlow', text: 'The drops are out there waiting. Four of them, spread over the bay. Fetch them, bring them to the pier, and keep your eyes on the road.' },
      { who: 'Lena', text: 'Four pickups and a pier. Fine. I was not planning to sightsee anyway.' },
    ],
    steps: [
      {
        type: 'collect', label: 'Pick up the 4 dead drops around the bay', counter: 'Drops',
        points: [{ x: -150, z: 30 }, { x: 30, z: -150 }, { x: 150, z: 90 }, { x: -30, z: 150 }],
      },
      { type: 'goto', x: -90, z: 180, label: 'Bring the drops to the pier', radius: 12 },
    ],
    outro: [
      { who: 'Mr. Harlow', text: 'All four, unopened, on time. You are becoming the most reliable thing in this city, Vex.' },
    ],
  },
  {
    id: 10, name: "Harlow's Farewell", reward: 12000,
    intro: [
      { who: 'Mr. Harlow', text: 'One last job, Vex. A getaway car on the east road — take it, run the six checkpoints, and do it while the whole bay watches. Then your brother is free.' },
      { who: 'Lena', text: 'Six checkpoints, four minutes, one debt. This ends tonight.' },
    ],
    steps: [
      { type: 'steal', kind: 'sports', x: 90, z: -90, label: 'Steal the getaway car', wantedOnSteal: 3 },
      {
        type: 'checkpoints', label: 'Run the 6 checkpoints before the timer runs out', timeLimit: 240,
        points: [{ x: 150, z: -150 }, { x: 150, z: 150 }, { x: -30, z: 150 }, { x: -150, z: 30 }, { x: -150, z: -150 }, { x: 30, z: -90 }],
      },
    ],
    outro: [
      { who: 'Mr. Harlow', text: 'Done. The debt is paid, the slate is clean. Solmar Bay is yours now, Vex — drive it like you mean it.' },
      { who: 'Lena', text: 'Forty grand. Dario, we are free.' },
    ],
  },
  {
    id: 11, name: 'Solmar Stash Run', reward: STASH.reward,
    intro: [
      { who: 'Mr. Harlow', text: 'The debt is paid, but the bay still owes you one score. Six stash packages are hidden across the city — docks, rooftops, back alleys. Five minutes. Bring them all home.' },
      { who: 'Lena', text: 'Six packages, five minutes, one victory lap. Let us see what this city has left.' },
    ],
    steps: [
      {
        type: 'collect', label: 'Collect the 6 stash packages', counter: 'Stash', timeLimit: STASH.timeLimit,
        points: [
          { x: -252, z: 36 }, { x: 252, z: -36 }, { x: -36, z: -252 },
          { x: 36, z: 252 }, { x: -180, z: 180 }, { x: 180, z: -180 },
        ],
      },
    ],
    outro: [
      { who: 'Mr. Harlow', text: 'Six for six, inside five minutes. That was not a job, Vex — that was a statement.' },
      { who: 'Lena', text: 'The bay is mine now. Every corner of it.' },
    ],
  },
];

function fmtClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function makeMarkerMesh(x, z) {
  const group = new THREE.Group();
  group.name = 'stashMarker';
  group.position.set(x, 0, z);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 7, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  pillar.name = 'markerPillar';
  pillar.position.y = 3.5;
  group.add(pillar);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  gem.name = 'markerGem';
  gem.position.y = 2.2;
  group.add(gem);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.name = 'markerRing';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  return group;
}

export function createMissions(deps) {
  const { scene, city, traffic, combat, police, audio, hud } = deps;
  const addCash = typeof deps.addCash === 'function' ? deps.addCash : () => {};
  let completedIds = [];
  let nextIndex = 0;
  let active = null;
  let bobTime = 0;

  function firstIncompleteIndex() {
    for (let i = 0; i < DEFS.length; i++) {
      if (!completedIds.includes(DEFS[i].id)) return i;
    }
    return DEFS.length;
  }

  function stepTarget(def, step) {
    if (step.type === 'checkpoints') return step.points[0];
    if (step.type === 'collect') return step.points[0];
    return { x: step.x, z: step.z };
  }

  function showBeaconAt(x, z) {
    city.setBeacon(x, z, true);
  }

  function hideBeacon() {
    city.setBeacon(0, 0, false);
  }

  function findParked(kind, x, z) {
    for (const car of traffic.cars) {
      if (car.parked && car.kind === kind && !car.occupied && Math.hypot(car.x - x, car.z - z) < 15) return car;
    }
    return null;
  }

  function clearMarkers(rt) {
    if (!rt || !rt.markers) return;
    for (const m of rt.markers) {
      if (m.mesh) scene.remove(m.mesh);
    }
    rt.markers = [];
  }

  function armStep(def, stepIndex) {
    const step = def.steps[stepIndex];
    const rt = { stepIndex };
    if (step.type === 'getIn' || step.type === 'steal') {
      rt.car = findParked(step.kind, step.x, step.z) || traffic.addParkedCar(step.kind, step.x, step.z);
      showBeaconAt(step.x, step.z);
    } else if (step.type === 'goto') {
      showBeaconAt(step.x, step.z);
    } else if (step.type === 'combat') {
      combat.spawnEnemies(step.x, step.z, step.count);
      rt.spawned = true;
      showBeaconAt(step.x, step.z);
    } else if (step.type === 'checkpoints') {
      // The timer is armed the moment the step starts — that is the fix
      // for the old first-frame instant fail on missions 5 and 8.
      rt.pointIndex = 0;
      rt.timerLeft = step.timeLimit;
      showBeaconAt(step.points[0].x, step.points[0].z);
    } else if (step.type === 'collect') {
      rt.collected = 0;
      rt.timerLeft = step.timeLimit !== undefined ? step.timeLimit : null;
      rt.markers = step.points.map((p) => {
        const mesh = makeMarkerMesh(p.x, p.z);
        scene.add(mesh);
        return { x: p.x, z: p.z, collected: false, mesh };
      });
      showBeaconAt(step.points[0].x, step.points[0].z);
    }
    active.rt = rt;
  }

  function idleBeacon() {
    if (nextIndex >= DEFS.length) {
      hideBeacon();
      return;
    }
    const def = DEFS[nextIndex];
    const step = def.steps[0];
    const t = stepTarget(def, step);
    showBeaconAt(t.x, t.z);
  }

  function startMission(i) {
    if (i < 0 || i >= DEFS.length) return;
    if (active) {
      clearMarkers(active.rt);
      combat.clearEnemies();
    }
    const def = DEFS[i];
    active = { def, stepIndex: 0, rt: null };
    armStep(def, 0);
    if (hud && typeof hud.dialogue === 'function') hud.dialogue(def.intro);
    if (audio && typeof audio.mission === 'function') audio.mission();
  }

  function startNext() {
    if (nextIndex < DEFS.length) startMission(nextIndex);
  }

  function completeStep() {
    const def = active.def;
    active.stepIndex += 1;
    if (active.stepIndex >= def.steps.length) {
      completeMission();
      return;
    }
    armStep(def, active.stepIndex);
  }

  function completeMission() {
    const def = active.def;
    clearMarkers(active.rt);
    addCash(def.reward);
    if (!completedIds.includes(def.id)) completedIds.push(def.id);
    nextIndex = firstIncompleteIndex();
    active = null;
    if (hud && typeof hud.dialogue === 'function') hud.dialogue(def.outro);
    if (hud && typeof hud.announce === 'function') hud.announce('Job complete — +$' + def.reward.toLocaleString('en-US'));
    if (audio && typeof audio.cash === 'function') audio.cash();
    if (audio && typeof audio.mission === 'function') audio.mission();
    idleBeacon();
  }

  function failMission(reason) {
    clearMarkers(active.rt);
    combat.clearEnemies();
    active = null;
    if (hud && typeof hud.toast === 'function') hud.toast('Mission failed — ' + reason);
    if (audio && typeof audio.busted === 'function') audio.busted();
    idleBeacon();
  }

  function distTo(player, x, z) {
    return Math.hypot(player.x - x, player.z - z);
  }

  function nearestUncollected(rt, player) {
    let best = null;
    let bestD = Infinity;
    for (const m of rt.markers) {
      if (m.collected) continue;
      const d = Math.hypot(m.x - player.x, m.z - player.z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  function update(dt, player) {
    bobTime += dt;
    if (!active) {
      const def = nextIndex < DEFS.length ? DEFS[nextIndex] : null;
      if (def) {
        const t = stepTarget(def, def.steps[0]);
        if (distTo(player, t.x, t.z) < 9) startNext();
      }
      return;
    }
    const def = active.def;
    const step = def.steps[active.stepIndex];
    const rt = active.rt;
    if (!step || !rt) return;
    if (step.type === 'getIn') {
      if (player.inCar && player.car === rt.car) completeStep();
    } else if (step.type === 'steal') {
      if (player.inCar && player.car === rt.car) {
        player.car.stolen = true;
        if (step.wantedOnSteal) police.addStars(step.wantedOnSteal);
        completeStep();
      }
    } else if (step.type === 'goto') {
      if (step.needCar && !player.inCar) return;
      if (distTo(player, step.x, step.z) < (step.radius || 10)) {
        if (step.wantedOnArrive) police.addStars(step.wantedOnArrive);
        completeStep();
      }
    } else if (step.type === 'combat') {
      if (combat.enemiesLeft() === 0) completeStep();
    } else if (step.type === 'checkpoints') {
      rt.timerLeft -= dt;
      if (rt.timerLeft <= 0) {
        failMission('Out of time');
        return;
      }
      const p = step.points[rt.pointIndex];
      if (distTo(player, p.x, p.z) < 14) {
        rt.pointIndex += 1;
        if (audio && typeof audio.pickup === 'function') audio.pickup();
        if (hud && typeof hud.toast === 'function') hud.toast('Checkpoint ' + rt.pointIndex + '/' + step.points.length);
        if (rt.pointIndex >= step.points.length) {
          completeStep();
        } else {
          const n = step.points[rt.pointIndex];
          showBeaconAt(n.x, n.z);
        }
      }
    } else if (step.type === 'collect') {
      if (rt.timerLeft !== null && rt.timerLeft !== undefined) {
        rt.timerLeft -= dt;
        if (rt.timerLeft <= 0) {
          failMission('Out of time — the stash went cold');
          return;
        }
      }
      let hit = false;
      for (const m of rt.markers) {
        if (m.collected) continue;
        if (distTo(player, m.x, m.z) < 10) {
          m.collected = true;
          rt.collected += 1;
          hit = true;
          if (m.mesh) scene.remove(m.mesh);
          if (audio && typeof audio.pickup === 'function') audio.pickup();
          if (combat && typeof combat.spawnBurst === 'function') combat.spawnBurst(m.x, m.z, 6, 2);
          if (hud && typeof hud.toast === 'function') {
            hud.toast((step.counter || 'Items') + ' ' + rt.collected + '/' + rt.markers.length);
          }
        }
      }
      // Animate the markers that are still out there.
      for (const m of rt.markers) {
        if (m.collected || !m.mesh) continue;
        const gem = m.mesh.getObjectByName('markerGem');
        if (gem) {
          gem.position.y = 2.2 + Math.sin(bobTime * 2.5) * 0.3;
          gem.rotation.y += dt * 1.5;
        }
      }
      if (hit) {
        const next = nearestUncollected(rt, player);
        if (next) showBeaconAt(next.x, next.z);
      }
      if (rt.collected >= rt.markers.length) completeStep();
    }
  }

  function objectiveText() {
    if (!active) {
      if (completedIds.length >= DEFS.length) {
        return { name: 'FREE ROAM', text: 'Every job done — Solmar Bay is yours.' };
      }
      return { name: 'FREE ROAM', text: 'Find the yellow marker to start a job.' };
    }
    const def = active.def;
    const step = def.steps[active.stepIndex];
    const rt = active.rt;
    const name = def.name.toUpperCase();
    if (!step) return { name, text: '' };
    if (step.type === 'checkpoints') {
      return {
        name,
        text: step.label + ' · ' + rt.pointIndex + '/' + step.points.length + ' · ' + fmtClock(rt.timerLeft),
      };
    }
    if (step.type === 'collect') {
      let text = step.label + ' · ' + (step.counter || 'Items') + ' ' + rt.collected + '/' + rt.markers.length;
      if (rt.timerLeft !== null && rt.timerLeft !== undefined) text += ' · ' + fmtClock(rt.timerLeft);
      return { name, text };
    }
    if (step.type === 'combat') {
      return { name, text: step.label + ' · ' + combat.enemiesLeft() + ' left' };
    }
    return { name, text: step.label };
  }

  function timerLeft() {
    if (!active || !active.rt) return 0;
    const t = active.rt.timerLeft;
    if (t === null || t === undefined) return 0;
    return Math.max(0, t);
  }

  function markers() {
    if (!active || !active.rt || !active.rt.markers) return [];
    return active.rt.markers.map((m) => ({ x: m.x, z: m.z, collected: m.collected }));
  }

  function state() {
    return {
      completedCount: completedIds.length,
      nextIndex,
      activeId: active ? active.def.id : 0,
    };
  }

  function restore(save) {
    if (!save) return;
    completedIds = Array.isArray(save.completed) ? save.completed.slice() : [];
    nextIndex = firstIncompleteIndex();
    active = null;
    idleBeacon();
  }

  idleBeacon();

  return {
    DEFS,
    startNext,
    startMission,
    update,
    objectiveText,
    timerLeft,
    isActive: () => !!active,
    state,
    restore,
    currentDef: () => (active ? active.def : null),
    activeMission: () => (active ? active.def : null),
    markers,
    total: MISSIONS.total,
  };
}
