// Missions — ten jobs between Lena and a $40,000 debt.
//
// Each job is a list of steps. A step is one of:
//   getIn        climb into a car of a given kind
//   goto         reach a point (optionally: only counts in a car, and
//                optionally adds heat the moment she arrives)
//   steal        take a specific parked car (adds heat on the steal)
//   combat       clear out the enemies waiting at a spot
//   checkpoints  hit a chain of points before the clock runs out
//   collect      pick up every dead drop on the list
//
// The step timer is armed the moment a step becomes current — including
// the very first step of a job. Jobs 5 and 8 used to fail on their first
// frame because the timer was only armed when advancing to a later step;
// that is fixed here by arming it inside startStep, which startMission
// calls for step zero too.
//
// The engine never touches the world directly. Everything it needs from
// outside — spawning the job car, the beacon, the toast, the sounds, the
// enemies, the heat, the payout — comes through `hooks`, which main.js
// provides. That keeps this file a pure state machine.

export function createMissions(hooks) {
  // Roads run at -210, -150, -90, -30, 30, 90, 150, 210, so every
  // target below sits on a street a car or a pair of feet can reach.
  const DEFS = [
    {
      id: 1,
      name: 'First Fare',
      reward: 1000,
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
      id: 2,
      name: 'The Package',
      reward: 1500,
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
      id: 3,
      name: 'The Getaway',
      reward: 2000,
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
      id: 4,
      name: 'Dockside Deal',
      reward: 2500,
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
      id: 5,
      name: 'Night Shift',
      reward: 3000,
      intro: [
        { who: 'Dispatcher', text: 'Five checkpoints, one timer, no excuses. The night route pays triple because nobody finishes it. Prove the nobody wrong.' },
        { who: 'Lena', text: 'Five stops, one clock. I drive fast when I have to.' },
      ],
      steps: [
        {
          type: 'checkpoints',
          label: 'Hit all 5 checkpoints before the timer runs out',
          timeLimit: 150,
          points: [
            { x: -150, z: 150 },
            { x: 150, z: 150 },
            { x: 150, z: -150 },
            { x: -150, z: -150 },
            { x: 30, z: 30 },
          ],
        },
      ],
      outro: [
        { who: 'Dispatcher', text: 'Five for five, inside the clock. The night route has a new name on it.' },
      ],
    },
    {
      id: 6,
      name: 'The Big Score',
      reward: 3500,
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
      id: 7,
      name: 'Marina Ambush',
      reward: 4000,
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
      id: 8,
      name: 'The Last Lap',
      reward: 5000,
      intro: [
        { who: 'Dispatcher', text: 'Six checkpoints, three minutes, one city that is not slowing down for you. This is the lap they time you on. Make it count.' },
        { who: 'Lena', text: 'Six stops, three minutes. Watch the clock, not me.' },
      ],
      steps: [
        {
          type: 'checkpoints',
          label: 'Hit all 6 checkpoints before the timer runs out',
          timeLimit: 180,
          points: [
            { x: -150, z: -150 },
            { x: 30, z: -150 },
            { x: 150, z: -30 },
            { x: 150, z: 150 },
            { x: -30, z: 150 },
            { x: -150, z: 30 },
          ],
        },
      ],
      outro: [
        { who: 'Dispatcher', text: 'Six for six. The timing board has your name at the top now.' },
      ],
    },
    {
      id: 9,
      name: 'Dead Drops',
      reward: 7000,
      intro: [
        { who: 'Mr. Harlow', text: 'The drops are out there waiting. Four of them, spread over the bay. Fetch them, bring them to the pier, and keep your eyes on the road.' },
        { who: 'Lena', text: 'Four pickups and a pier. Fine. I was not planning to sightsee anyway.' },
      ],
      steps: [
        {
          type: 'collect',
          label: 'Pick up the 4 dead drops around the bay',
          points: [
            { x: -150, z: 30 },
            { x: 30, z: -150 },
            { x: 150, z: 90 },
            { x: -30, z: 150 },
          ],
        },
        { type: 'goto', x: -90, z: 180, label: 'Bring the drops to the pier', radius: 12 },
      ],
      outro: [
        { who: 'Mr. Harlow', text: 'All four, unopened, on time. You are becoming the most reliable thing in this city, Vex.' },
      ],
    },
    {
      id: 10,
      name: "Harlow's Farewell",
      reward: 12000,
      intro: [
        { who: 'Mr. Harlow', text: 'One last job, Vex. A getaway car on the east road — take it, run the six checkpoints, and do it while the whole bay watches. Then your brother is free.' },
        { who: 'Lena', text: 'Six checkpoints, four minutes, one debt. This ends tonight.' },
      ],
      steps: [
        { type: 'steal', kind: 'sports', x: 90, z: -90, label: 'Steal the getaway car', wantedOnSteal: 3 },
        {
          type: 'checkpoints',
          label: 'Run the 6 checkpoints before the timer runs out',
          timeLimit: 240,
          points: [
            { x: 150, z: -150 },
            { x: 150, z: 150 },
            { x: -30, z: 150 },
            { x: -150, z: 30 },
            { x: -150, z: -150 },
            { x: 30, z: -90 },
          ],
        },
      ],
      outro: [
        { who: 'Mr. Harlow', text: 'Done. The debt is paid, the slate is clean. Solmar Bay is yours now, Vex — drive it like you mean it.' },
        { who: 'Lena', text: 'Forty grand. Ten jobs. Dario, we are free.' },
      ],
    },
  ];

  let completedCount = 0;
  let nextIndex = 0;
  let active = null;
  let activeIndex = -1;
  let activeId = 0;
  let stepIndex = 0;
  let timer = 0;
  let collected = [];
  let checkIndex = 0;
  let missionCar = null;
  let lastX = 0;
  let lastZ = 0;

  function currentStep() {
    return active ? active.steps[stepIndex] : null;
  }

  // Point the beacon at whatever the current step wants Lena to find.
  function updateBeacon() {
    const step = currentStep();
    if (!step) {
      hooks.setBeacon(0, 0, false);
      return;
    }
    if (step.type === 'collect') {
      const next = step.points.find((p, i) => !collected[i]);
      if (next) hooks.setBeacon(next.x, next.z, true);
      else hooks.setBeacon(0, 0, false);
    } else if (step.type === 'checkpoints') {
      const p = step.points[checkIndex];
      if (p) hooks.setBeacon(p.x, p.z, true);
      else hooks.setBeacon(0, 0, false);
    } else if (step.x !== undefined) {
      hooks.setBeacon(step.x, step.z, true);
    }
  }

  // Arm a step: timer, job car, enemies, drop markers. This runs for
  // step zero as well — a timed first step must have its clock running
  // before the first update, or the job fails on frame one.
  function armStep() {
    const step = currentStep();
    if (!step) return;
    if (step.type === 'checkpoints') {
      timer = step.timeLimit;
      checkIndex = 0;
    } else {
      timer = 0;
    }
    if (step.type === 'getIn' || step.type === 'steal') {
      missionCar = hooks.spawnMissionCar(step.kind, step.x, step.z);
    }
    if (step.type === 'combat') {
      hooks.spawnEnemies(step.x, step.z, step.count);
    }
    if (step.type === 'collect') {
      collected = step.points.map(() => false);
      hooks.showCollect(step.points);
    }
  }

  function startStep() {
    armStep();
    updateBeacon();
  }

  function advanceStep() {
    stepIndex += 1;
    if (stepIndex >= active.steps.length) {
      completeMission();
      return;
    }
    startStep();
  }

  function completeMission() {
    const def = active;
    completedCount += 1;
    nextIndex = activeIndex + 1;
    active = null;
    activeIndex = -1;
    activeId = 0;
    stepIndex = 0;
    timer = 0;
    missionCar = null;
    hooks.setBeacon(0, 0, false);
    hooks.showCollect(null);
    hooks.onMissionComplete(def);
  }

  function failMission(reason) {
    const def = active;
    active = null;
    activeIndex = -1;
    activeId = 0;
    stepIndex = 0;
    timer = 0;
    missionCar = null;
    hooks.setBeacon(0, 0, false);
    hooks.showCollect(null);
    hooks.onMissionFailed(def, reason);
  }

  function startMission(i) {
    if (i < 0 || i >= DEFS.length) return false;
    active = DEFS[i];
    activeIndex = i;
    activeId = active.id;
    nextIndex = i;
    stepIndex = 0;
    startStep();
    hooks.toast('Job ' + active.id + ' of ' + DEFS.length + ': ' + active.name);
    hooks.sound('mission');
    return true;
  }

  function startNext() {
    if (nextIndex >= DEFS.length) return false;
    return startMission(nextIndex);
  }

  function update(dt, player) {
    if (!active) return;
    lastX = player.x;
    lastZ = player.z;
    const step = currentStep();
    if (!step) return;

    // The clock only ever runs down. It was armed in armStep, so a job
    // that opens on a timed step is already ticking.
    if (step.type === 'checkpoints') {
      timer -= dt;
      if (timer <= 0) {
        timer = 0;
        failMission('time');
        return;
      }
    }

    if (step.type === 'goto') {
      const d = Math.hypot(step.x - player.x, step.z - player.z);
      if (d < (step.radius || 12) && (!step.needCar || player.inCar)) {
        if (step.wantedOnArrive) hooks.addStars(step.wantedOnArrive);
        advanceStep();
      }
    } else if (step.type === 'getIn') {
      if (player.inCar && player.car && (!step.kind || player.car.kind === step.kind)) {
        advanceStep();
      }
    } else if (step.type === 'steal') {
      if (player.inCar && player.car === missionCar) {
        hooks.addStars(step.wantedOnSteal || 1);
        advanceStep();
      }
    } else if (step.type === 'combat') {
      if (hooks.enemiesLeft() === 0) advanceStep();
    } else if (step.type === 'checkpoints') {
      const p = step.points[checkIndex];
      const radius = step.radius || 12;
      if (p && Math.hypot(p.x - player.x, p.z - player.z) < radius) {
        checkIndex += 1;
        hooks.sound('pickup');
        if (checkIndex >= step.points.length) advanceStep();
        else updateBeacon();
      }
    } else if (step.type === 'collect') {
      let changed = false;
      const radius = step.radius || 6;
      step.points.forEach((p, i) => {
        if (!collected[i] && Math.hypot(p.x - player.x, p.z - player.z) < radius) {
          collected[i] = true;
          changed = true;
          hooks.sound('pickup');
          hooks.toast(
            'Dead drop ' + collected.filter(Boolean).length + ' of ' + step.points.length,
          );
        }
      });
      if (changed) {
        if (collected.every(Boolean)) {
          hooks.showCollect(null);
          advanceStep();
        } else {
          updateBeacon();
        }
      }
    }
  }

  // { name, text } for the HUD banner. Distances come from the player
  // position cached by the last update call.
  function objectiveText() {
    if (!active) {
      return { name: 'FREE ROAM', text: 'Find the yellow marker to start a job.' };
    }
    const step = currentStep();
    let text = step.label;
    if (step.type === 'collect') {
      const got = collected.filter(Boolean).length;
      text += ' (' + got + '/' + step.points.length + ')';
      const next = step.points.find((p, i) => !collected[i]);
      if (next) {
        text += ' · ' + Math.round(Math.hypot(next.x - lastX, next.z - lastZ)) + 'm';
      }
    } else if (step.type === 'checkpoints') {
      text += ' (' + checkIndex + '/' + step.points.length + ')';
      const p = step.points[checkIndex];
      if (p) {
        text += ' · ' + Math.round(Math.hypot(p.x - lastX, p.z - lastZ)) + 'm';
      }
    } else if (step.type === 'combat') {
      text += ' (' + hooks.enemiesLeft() + ' left)';
    } else if (step.x !== undefined) {
      text += ' · ' + Math.round(Math.hypot(step.x - lastX, step.z - lastZ)) + 'm';
    }
    return { name: active.name.toUpperCase(), text };
  }

  function timerLeft() {
    return Math.max(0, timer);
  }

  function isActive() {
    return active !== null;
  }

  function state() {
    return { completedCount, nextIndex, activeId };
  }

  function restore(saved) {
    if (!saved) return;
    completedCount = saved.completedCount || 0;
    nextIndex = saved.nextIndex || 0;
    active = null;
    activeIndex = -1;
    activeId = 0;
    stepIndex = 0;
    timer = 0;
  }

  function currentDef() {
    return active || DEFS[nextIndex] || null;
  }

  function activeMission() {
    return active;
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
    activeMission,
  };
}
