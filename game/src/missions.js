// The story: six jobs that pay off Dario's $40,000 debt to the Harlow crew.
// Each mission is a list of steps — go somewhere, get in a car, fight, deliver —
// and the manager walks the player through them, one objective at a time.

import { MISSIONS } from './config.js';

const DARIO = 'Dario';
const LENA = 'Lena';
const HARLOW = 'Mr. Harlow';

const DEFS = [
  {
    id: 1,
    name: 'First Fare',
    reward: 800,
    intro: [
      { who: DARIO, text: 'Vex. You owe me one, sis — the taxi at the depot needs a driver and the fare pays cash. Get in it.' },
      { who: LENA, text: 'One fare. Then we talk about the forty grand, Dario.' },
    ],
    steps: [
      { type: 'getIn', kind: 'taxi', x: -150, z: 150, label: 'Get in the yellow taxi at the depot' },
      { type: 'goto', x: 0, z: 232, label: 'Drive the fare to the beach boardwalk', radius: 6 },
    ],
    outro: [
      { who: DARIO, text: 'Eight hundred. See? The city pays if you move fast enough.' },
    ],
  },
  {
    id: 2,
    name: 'The Package',
    reward: 1200,
    intro: [
      { who: DARIO, text: 'A package is waiting in Palm Park. Pick it up, walk it to the pier. And Vex — the cops got tipped off. Walk fast.' },
    ],
    steps: [
      { type: 'goto', x: -120, z: -120, label: 'Pick up the package in Palm Park', radius: 5 },
      { type: 'goto', x: 0, z: 292, label: 'Deliver the package to the end of the pier', radius: 5, wantedOnArrive: 1 },
    ],
    outro: [
      { who: LENA, text: 'Delivered. Twelve hundred closer to free.' },
    ],
  },
  {
    id: 3,
    name: 'The Getaway',
    reward: 2000,
    intro: [
      { who: DARIO, text: 'Harlow left a cherry-red coupe on Marlin Street. Take it. The hideout is up northwest — and the whole department will be on you.' },
    ],
    steps: [
      { type: 'steal', kind: 'coupe', x: 90, z: -90, label: 'Steal the red coupe on Marlin Street', wantedOnSteal: 2 },
      { type: 'goto', x: -180, z: -180, label: 'Reach the hideout in the northwest', radius: 8, needCar: true },
    ],
    outro: [
      { who: DARIO, text: 'Clean. Harlow is going to love that car almost as much as he loves your debt.' },
    ],
  },
  {
    id: 4,
    name: 'Dockside Deal',
    reward: 3500,
    intro: [
      { who: HARLOW, text: 'Miss Marlowe. Three of my former associates are waiting at the docks with something of mine. Take it back. All of it.' },
      { who: LENA, text: 'Three of them. One of me. Fine.' },
    ],
    steps: [
      { type: 'goto', x: 0, z: 280, label: 'Go to the docks at the end of the pier', radius: 8 },
      { type: 'combat', x: 0, z: 292, count: 3, label: 'Deal with the three Harlow men' },
      { type: 'goto', x: 0, z: 292, label: 'Collect the cash bag', radius: 5 },
    ],
    outro: [
      { who: HARLOW, text: 'Efficient. I almost like you, Marlowe.' },
    ],
  },
  {
    id: 5,
    name: 'Night Shift',
    reward: 4500,
    intro: [
      { who: DARIO, text: 'Five drops, one night, no questions. The timer starts when you hit the first checkpoint. Drive like the rent is due — it is.' },
    ],
    steps: [
      {
        type: 'checkpoints',
        points: [
          { x: -150, z: -150 }, { x: 150, z: -150 }, { x: 150, z: 150 },
          { x: -150, z: 150 }, { x: 30, z: 30 },
        ],
        timeLimit: 150,
        label: 'Hit all 5 checkpoints before the timer runs out',
      },
    ],
    outro: [
      { who: LENA, text: 'Five drops, zero questions. The night shift pays.' },
    ],
  },
  {
    id: 6,
    name: 'The Big Score',
    reward: 30000,
    intro: [
      { who: HARLOW, text: 'One last job, Marlowe. An armoured van parks by my tower every morning. Bring it to the garage in the northeast and your brother walks free.' },
      { who: LENA, text: 'Then this is the last one. For Dario. For me.' },
    ],
    steps: [
      { type: 'steal', kind: 'van', x: 30, z: 30, label: 'Steal the armoured van by Harlow Tower', wantedOnSteal: 3 },
      { type: 'goto', x: 180, z: -180, label: 'Deliver the van to the garage — lose the cops if you can', radius: 8, needCar: true },
    ],
    outro: [
      { who: HARLOW, text: 'The debt is paid, Marlowe. Dario is free. Solmar Bay is yours now — spend it well.' },
      { who: LENA, text: 'Forty grand. Done. The bay never looked this good.' },
    ],
  },
  {
    id: 7,
    name: 'Marina Ambush',
    reward: 6000,
    intro: [
      { who: HARLOW, text: 'The debt is paid, Marlowe — but the bay still owes me. Four of my old rivals are waiting at the south marina with a ledger of names. Bring it to me.' },
      { who: LENA, text: 'Four of them, one ledger, and a long walk home. Same as always.' },
    ],
    steps: [
      { type: 'goto', x: -150, z: 210, label: 'Go to the south marina', radius: 8 },
      { type: 'combat', x: -150, z: 210, count: 4, label: 'Deal with the four rivals at the marina' },
      { type: 'goto', x: -150, z: 210, label: 'Pick up the ledger', radius: 5 },
      { type: 'goto', x: 150, z: -150, label: 'Deliver the ledger to the northeast corner', radius: 8 },
    ],
    outro: [
      { who: HARLOW, text: 'The ledger. You are not just free, Marlowe — you are useful.' },
    ],
  },
  {
    id: 8,
    name: 'The Last Lap',
    reward: 8000,
    intro: [
      { who: DARIO, text: 'One last run to celebrate, sis. Six checkpoints, all over the bay, before the clock dies. Grab any car you like — and make it look easy.' },
      { who: LENA, text: 'Six checkpoints. One bay. Watch me.' },
    ],
    steps: [
      {
        type: 'checkpoints',
        points: [
          { x: -150, z: -150 }, { x: 150, z: -150 }, { x: 150, z: 150 },
          { x: -150, z: 150 }, { x: 90, z: -90 }, { x: -90, z: 90 },
        ],
        timeLimit: 210,
        label: 'Hit all 6 checkpoints before the timer runs out',
      },
    ],
    outro: [
      { who: DARIO, text: 'Six for six. The bay is yours, Vex — every street, every shortcut.' },
      { who: LENA, text: 'Forty grand, two extra jobs, one city. Done.' },
    ],
  },
  {
    id: 9,
    name: 'Dead Drops',
    reward: 7000,
    intro: [
      { who: HARLOW, text: 'Four dead drops, scattered across the bay, each one mine. Collect them all, bring them to the pier, and do not get curious about what is inside.' },
      { who: LENA, text: 'Four stops, one pier. I can do curious later.' },
    ],
    steps: [
      {
        type: 'collect',
        points: [
          { x: -150, z: -150 }, { x: 150, z: 150 }, { x: 90, z: 90 }, { x: -90, z: -90 },
        ],
        label: 'Pick up the 4 dead drops around the bay',
      },
      { type: 'goto', x: 0, z: 292, label: 'Deliver the drops to the end of the pier', radius: 5 },
    ],
    outro: [
      { who: HARLOW, text: 'All four. You collect almost as well as you drive, Marlowe.' },
    ],
  },
  {
    id: 10,
    name: "Harlow's Farewell",
    reward: 12000,
    intro: [
      { who: HARLOW, text: 'One last run, Marlowe — my farewell gift. A sports car is parked in the southwest. Take it, run six checkpoints, and make it look easy. The whole department will be watching.' },
      { who: LENA, text: 'Six checkpoints, one sports car, the whole bay watching. Let us go.' },
    ],
    steps: [
      { type: 'steal', kind: 'sports', x: -150, z: 150, label: 'Steal the sports car in the southwest', wantedOnSteal: 3 },
      {
        type: 'checkpoints',
        points: [
          { x: -150, z: -150 }, { x: 150, z: -150 }, { x: 150, z: 150 },
          { x: -150, z: 150 }, { x: 90, z: -90 }, { x: -90, z: 90 },
        ],
        timeLimit: 240,
        label: 'Hit all 6 checkpoints before the timer runs out',
      },
    ],
    outro: [
      { who: HARLOW, text: 'Ten jobs. You paid your brother out and then some, Marlowe. Solmar Bay remembers drivers like you.' },
      { who: LENA, text: 'Ten for ten. The bay is mine now — every street, every shortcut.' },
    ],
  },
];

export function createMissions(hooks) {
  let index = 0; // next mission to start (0-based)
  let active = null; // { def, stepIndex, timer, checkpointIndex }
  let completedCount = 0;

  function currentDef() {
    return DEFS[index] || null;
  }

  function currentStep() {
    if (!active) return null;
    return active.def.steps[active.stepIndex] || null;
  }

  function objectiveText() {
    if (!active) {
      if (completedCount >= MISSIONS.total) return { name: 'BAY LEGEND', text: 'All 10 jobs done. Solmar Bay is yours. Free roam — the city never sleeps.' };
      if (completedCount >= 6) return { name: 'DEBT PAID', text: `The $40,000 is paid. ${completedCount - 6} of 4 extra jobs done — find the yellow marker for the next one.` };
      const next = currentDef();
      return { name: 'FREE ROAM', text: next ? `Find the yellow marker to start "${next.name}" ($${next.reward.toLocaleString()}).` : 'Free roam.' };
    }
    const step = currentStep();
    return { name: active.def.name.toUpperCase(), text: step ? step.label : '' };
  }

  function moveBeacon() {
    const step = currentStep();
    if (!step) { hooks.setBeacon(0, 0, false); return; }
    if (step.type === 'checkpoints') {
      const point = step.points[active.checkpointIndex] || step.points[0];
      hooks.setBeacon(point.x, point.z, true);
    } else if (step.type === 'collect') {
      const point = step.points[active.collected] || step.points[0];
      hooks.setBeacon(point.x, point.z, true);
    } else if (step.x !== undefined) {
      hooks.setBeacon(step.x, step.z, true);
    } else {
      hooks.setBeacon(0, 0, false);
    }
  }

  function showIntro(def) {
    let delay = 0;
    for (const line of def.intro) {
      window.setTimeout(() => hooks.dialogue(line.who, line.text), delay);
      delay += 4200;
    }
  }

  // Arm a step's own state: the checkpoints clock, the collect markers.
  // Both the first step (startMission) and later steps (advanceStep) go
  // through here — before this fix a mission whose first step was a timed
  // checkpoint run started with timer 0 and failed on its first frame.
  function setupStep(step) {
    if (!step) return;
    if (step.type === 'checkpoints') {
      active.checkpointIndex = 0;
      active.timer = step.timeLimit;
    }
    if (step.type === 'collect') {
      active.collected = 0;
      if (hooks.showCollect) hooks.showCollect(step.points);
    }
  }

  function startMission(i) {
    const def = DEFS[i];
    if (!def) return false;
    active = { def, stepIndex: 0, timer: 0, checkpointIndex: 0, collected: 0 };
    index = i;
    const step = currentStep();
    if (step && (step.type === 'getIn' || step.type === 'steal')) {
      hooks.spawnMissionCar(step.kind, step.x, step.z);
    }
    setupStep(step);
    showIntro(def);
    hooks.toast(`${def.name} — $${def.reward.toLocaleString()}`);
    hooks.sound('mission');
    moveBeacon();
    return true;
  }

  function startNext() {
    if (index >= DEFS.length) return false;
    return startMission(index);
  }

  function advanceStep() {
    active.stepIndex += 1;
    if (active.stepIndex >= active.def.steps.length) {
      completeMission();
      return;
    }
    const step = currentStep();
    if (step.type === 'getIn' || step.type === 'steal') {
      hooks.spawnMissionCar(step.kind, step.x, step.z);
    }
    if (step.type === 'combat') {
      hooks.spawnEnemies(step.x, step.z, step.count);
    }
    setupStep(step);
    moveBeacon();
  }

  function completeMission() {
    const def = active.def;
    active = null;
    completedCount += 1;
    index = completedCount;
    hooks.addCash(def.reward);
    hooks.toast(`Job done — +$${def.reward.toLocaleString()}`);
    hooks.sound('cash');
    hooks.setBeacon(0, 0, false);
    let delay = 600;
    for (const line of def.outro) {
      window.setTimeout(() => hooks.dialogue(line.who, line.text), delay);
      delay += 4200;
    }
    hooks.onMissionComplete(def, completedCount);
    if (hooks.hideCollect) hooks.hideCollect();
  }

  function failMission(reason) {
    hooks.toast(reason);
    hooks.sound('busted');
    active = null;
    hooks.setBeacon(0, 0, false);
    if (hooks.hideCollect) hooks.hideCollect();
  }

  /**
   * Advance the active mission. `world` carries what the mission checks:
   * player position, whether they are in a car, the car they drive, and the
   * enemies left standing. Returns nothing; it talks through the hooks.
   */
  function update(dt, world) {
    if (!active) return;
    const step = currentStep();
    if (!step) return;
    if (step.type === 'checkpoints') {
      active.timer -= dt;
      const point = step.points[active.checkpointIndex];
      const dx = world.x - point.x;
      const dz = world.z - point.z;
      if (Math.sqrt(dx * dx + dz * dz) < 7) {
        active.checkpointIndex += 1;
        hooks.sound('pickup');
        hooks.toast(`Checkpoint ${active.checkpointIndex} of ${step.points.length}`);
        if (active.checkpointIndex >= step.points.length) { advanceStep(); return; }
        moveBeacon();
      }
      if (active.timer <= 0) {
        failMission('Out of time — try again at the marker.');
      }
      return;
    }
    if (step.type === 'collect') {
      // Walk or drive over each drop: the beacon points at the next one.
      const point = step.points[active.collected];
      const dx = world.x - point.x;
      const dz = world.z - point.z;
      if (Math.sqrt(dx * dx + dz * dz) < 4) {
        if (hooks.collectReached) hooks.collectReached(active.collected);
        active.collected += 1;
        hooks.sound('pickup');
        hooks.toast(`Dead drop ${active.collected} of ${step.points.length}`);
        if (active.collected >= step.points.length) { advanceStep(); return; }
        moveBeacon();
      }
      return;
    }
    if (step.type === 'combat') {
      if (world.enemiesLeft <= 0) advanceStep();
      return;
    }
    if (step.type === 'getIn') {
      if (world.inCar && world.carKind === step.kind) advanceStep();
      return;
    }
    if (step.type === 'steal') {
      if (world.inCar && world.carKind === step.kind) {
        if (step.wantedOnSteal) hooks.addStars(step.wantedOnSteal, 'Grand theft auto');
        advanceStep();
      }
      return;
    }
    // Plain 'goto' steps: arrive inside the radius (in a car when the job says so).
    const dx = world.x - step.x;
    const dz = world.z - step.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < (step.radius || 6)) {
      if (step.needCar && !world.inCar) return;
      if (step.wantedOnArrive) hooks.addStars(step.wantedOnArrive, 'Tipped off');
      hooks.sound('pickup');
      advanceStep();
    }
  }

  function timerLeft() {
    if (!active) return 0;
    const step = currentStep();
    return step && step.type === 'checkpoints' ? Math.max(0, active.timer) : 0;
  }

  function isActive() {
    return active !== null;
  }

  function state() {
    return { completedCount, nextIndex: index, activeId: active ? active.def.id : 0 };
  }

  function restore(saved) {
    completedCount = saved.completedCount || 0;
    index = saved.nextIndex || completedCount;
  }

  return {
    DEFS,
    startNext,
    startMission,
    update,
    objectiveText,
    timerLeft,
    isActive,
    state,
    restore,
    currentDef,
    activeMission() { return active ? active.def : null; },
  };
}
