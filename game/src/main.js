// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between menu, playing, paused, wasted and busted — and the ?shot= scenes
// stage a frozen frame of the real game for screenshots.

import { MISSIONS, PALETTE, PLAYER, POLICE, WANTED } from './config.js';
import { createRandom } from './rng.js';
import { createInput, ACTION_ATTACK, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { Car, randomCarColor, randomKind } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { readSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;
const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const START_POS = { x: 30, z: 180 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261120;

const canvas = document.getElementById('game');
const rng = createRandom(seed);
const audio = createAudio();
const hud = createHud();
const input = createInput(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.sky, 220, 720);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
sun.position.set(140, 190, 90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 600;
scene.add(sun);
const ambient = new THREE.AmbientLight(0xbfd8ff, 0.85);
scene.add(ambient);
const skyDay = new THREE.Color(PALETTE.sky);
const skyDusk = new THREE.Color(0xff9a5d);
const skyNight = new THREE.Color(0x0b1020);

// The clock runs 09:00 + 1 game-minute per real second, so a long session
// slides from morning through dusk into night: sun, sky and fog follow it.
function updateLighting() {
  const hour = (9 + timeSeconds / 60) % 24;
  let day = 1;
  if (hour >= 18 && hour < 20) day = 1 - (hour - 18) / 2;
  else if (hour >= 20 || hour < 5) day = 0;
  else if (hour >= 5 && hour < 7) day = (hour - 5) / 2;
  sun.intensity = 0.35 + 2.05 * day;
  ambient.intensity = 0.3 + 0.55 * day;
  const sky = new THREE.Color();
  if (day > 0.7) sky.copy(skyDay);
  else if (day > 0.25) sky.lerpColors(skyDusk, skyDay, (day - 0.25) / 0.45);
  else sky.lerpColors(skyNight, skyDusk, day / 0.25);
  scene.background = sky;
  scene.fog.color.copy(sky);
}

const city = buildCity(scene, rng);
const traffic = createTraffic(scene, city, rng);
const pedestrians = createPedestrians(scene, city, rng);
const police = createPolice(scene, city, rng);
const combat = createCombat(scene, city, rng);

function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: PALETTE.playerJacket });
  const pants = new THREE.MeshLambertMaterial({ color: PALETTE.playerPants });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b090 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.32), jacket);
  body.position.y = 1.1;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.16, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2a1a12 }),
  );
  hair.position.y = 1.94;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), pants);
  legL.position.set(-0.15, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), pants);
  legR.position.set(0.15, 0.35, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

const playerMesh = makePlayerMesh();
scene.add(playerMesh);

const player = {
  x: START_POS.x,
  z: START_POS.z,
  heading: Math.PI,
  health: PLAYER.health,
  cash: PLAYER.startCash,
  walkPhase: 0,
  inCar: false,
  car: null,
  carKind: null,
  attackTimer: 0,
  hurtTimer: 0,
  moving: false,
};

// Parked cars the player can take, scattered on the roads — sedans, sports
// cars and vans, each with its own handling.
const parkedCars = [];
for (let i = 0; i < 9; i += 1) {
  const spot = city.randomRoadPoint(rng);
  const car = new Car(scene, randomCarColor(rng), { kind: randomKind(rng) });
  car.place(spot.x, spot.z, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
  parkedCars.push(car);
}
const missionCars = [];

// Dead-drop markers: spinning gold boxes at the collect points of a job.
const collectMarkers = [];
function showCollect(points) {
  hideCollect();
  for (const p of points) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    mesh.position.set(p.x, 1.2, p.z);
    scene.add(mesh);
    collectMarkers.push(mesh);
  }
}
function hideCollect() {
  for (const mesh of collectMarkers) scene.remove(mesh);
  collectMarkers.length = 0;
}

let screen = 'menu';
let timeSeconds = 0;
let cameraYaw = Math.PI;
let cameraPitch = 0.32;
let cameraDistance = 10;
let danger = { x: 0, z: 0, active: false };
let freeRoam = false;
let frozen = false; // screenshot scenes freeze the sim after staging

function playerSpeed() {
  if (player.inCar && player.car) return Math.abs(player.car.speed);
  return player.moving ? (input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
}

function addCash(amount) {
  player.cash += amount;
}

function addStars(n, reason) {
  const result = police.addStars(n, reason);
  if (result.rose) hud.toast(`Wanted level ${result.stars} — ${reason}`);
  return result;
}

function setBeacon(x, z, visible) {
  city.setBeacon(x, z, visible);
}

const missions = createMissions({
  setBeacon,
  spawnMissionCar(kind, x, z) {
    const color = kind === 'taxi' ? PALETTE.taxi : kind === 'coupe' ? 0xd81f2a : kind === 'sports' ? 0xff6a00 : 0x3a3f4a;
    const car = new Car(scene, color, { taxi: kind === 'taxi', kind });
    car.place(x, z, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    missionCars.push(car);
    return car;
  },
  spawnEnemies(x, z, count) { combat.spawnEnemies(x, z, count); },
  showCollect(points) { showCollect(points); },
  collectReached(i) {
    const mesh = collectMarkers[i];
    if (mesh) mesh.visible = false;
  },
  hideCollect() { hideCollect(); },
  toast(text) { hud.toast(text); },
  dialogue(who, text) { hud.dialogue(who, text); },
  addCash,
  addStars,
  sound(name) {
    if (name === 'mission') audio.mission();
    else if (name === 'cash') audio.cash();
    else if (name === 'pickup') audio.pickup();
    else if (name === 'busted') audio.busted();
  },
  onMissionComplete(def, count) {
    saveGame();
    if (count >= MISSIONS.total) hud.toast(`ALL ${MISSIONS.total} JOBS DONE — Solmar Bay is yours!`);
  },
});

function saveGame() {
  writeSave({
    cash: player.cash,
    health: player.health,
    x: player.x,
    z: player.z,
    heading: player.heading,
    completedCount: missions.state().completedCount,
    nextIndex: missions.state().nextIndex,
    savedAt: 'solmar-bay',
  });
}

function loadSave(data) {
  player.cash = data.cash ?? PLAYER.startCash;
  player.health = data.health ?? PLAYER.health;
  player.x = data.x ?? START_POS.x;
  player.z = data.z ?? START_POS.z;
  player.heading = data.heading ?? Math.PI;
  missions.restore({ completedCount: data.completedCount || 0, nextIndex: data.nextIndex || 0 });
}

function nearestDrivableCar(maxDist) {
  let best = null;
  let bestDist = maxDist;
  const check = (car) => {
    if (car.occupied || car.isPolice) return;
    const dx = car.x - player.x;
    const dz = car.z - player.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestDist) { bestDist = d; best = car; }
  };
  for (const car of parkedCars) check(car);
  for (const car of missionCars) check(car);
  const trafficCar = traffic.nearestFreeCar(player.x, player.z, bestDist);
  if (trafficCar) best = trafficCar;
  return best;
}

function enterCar(car, stolen) {
  if (player.inCar) return;
  player.inCar = true;
  player.car = car;
  player.carKind = car.kind;
  car.occupied = true;
  playerMesh.visible = false;
  audio.setEngine(true, 0);
  hud.showCrosshair(false);
  if (stolen) {
    car.stolen = true;
    addStars(1, 'Car stolen');
    hud.toast('Car stolen!');
  }
}

function exitCar() {
  if (!player.inCar || !player.car) return;
  const car = player.car;
  car.occupied = false;
  car.speed = 0;
  player.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.2;
  player.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.2;
  player.heading = car.heading;
  player.inCar = false;
  player.car = null;
  player.carKind = null;
  playerMesh.visible = true;
  audio.setEngine(false, 0);
  hud.showCrosshair(true);
}

function hurtPlayer(amount, cause) {
  if (player.hurtTimer > 0 || screen !== 'playing') return;
  player.health -= amount;
  player.hurtTimer = 0.7;
  audio.crash();
  if (player.health <= 0) {
    player.health = 0;
    wasted();
  }
}

function wasted() {
  screen = 'menu';
  player.cash = Math.max(0, player.cash - 200);
  player.health = PLAYER.health;
  if (player.inCar) exitCar();
  player.x = START_POS.x;
  player.z = START_POS.z;
  combat.clearEnemies();
  police.clearWanted();
  audio.setEngine(false, 0);
  audio.setSiren(false);
  hud.showMenu(true, !!readSave());
  hud.toast('WASTED — the bay hospital patched you up. -$200');
  hud.announce('Wasted. You woke up at the hospital, $200 poorer.');
  saveGame();
}

function busted() {
  screen = 'menu';
  player.cash = Math.max(0, player.cash - 300);
  if (player.inCar) exitCar();
  player.x = START_POS.x;
  player.z = START_POS.z;
  player.health = PLAYER.health;
  police.clearWanted();
  combat.clearEnemies();
  audio.setEngine(false, 0);
  audio.setSiren(false);
  audio.busted();
  hud.showMenu(true, !!readSave());
  hud.toast('BUSTED — the SBPD let you go with a fine. -$300');
  hud.announce('Busted. You paid a $300 fine.');
  saveGame();
}

let lastShotStarAt = -100;

function startPlaying(mode) {
  freeRoam = mode === 'free';
  screen = 'playing';
  hud.showMenu(false, false);
  hud.showPaused(false);
  hud.showCrosshair(!player.inCar);
  audio.unlock();
  hud.announce('Playing Solmar Bay.');
  if (!freeRoam && !missions.isActive() && missions.state().completedCount < MISSIONS.total) {
    hud.toast('Find the yellow marker to start your first job.');
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function updateCamera(dt) {
  const target = player.inCar && player.car
    ? { x: player.car.x, z: player.car.z, h: player.car.heading }
    : { x: player.x, z: player.z, h: player.heading };
  // Ease the camera yaw toward the direction of travel.
  let diff = target.h - cameraYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cameraYaw += diff * Math.min(1, dt * 2.2);
  const dist = player.inCar ? 12.5 : 9.5;
  const height = player.inCar ? 5.2 : 4.4;
  const cx = target.x - Math.sin(cameraYaw) * dist;
  const cz = target.z - Math.cos(cameraYaw) * dist;
  camera.position.set(cx, height, cz);
  // Speed widens the view; a crash shakes it.
  const speedRatio = player.inCar && player.car ? Math.abs(player.car.speed) / player.car.topSpeed() : 0;
  const wantFov = 62 + speedRatio * 9;
  if (Math.abs(camera.fov - wantFov) > 0.1) {
    camera.fov = wantFov;
    camera.updateProjectionMatrix();
  }
  if (player.inCar && player.car && player.car.crashed > 0) {
    camera.position.x += Math.sin(timeSeconds * 83) * 0.22;
    camera.position.y += Math.cos(timeSeconds * 71) * 0.18;
  }
  camera.lookAt(target.x, 1.6, target.z);
  cameraDistance = dist;
}

function stepPlayer(dt) {
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.attackTimer = Math.max(0, player.attackTimer - dt);

  if (player.inCar && player.car) {
    const car = player.car;
    const before = { x: car.x, z: car.z };
    car.drive(dt, {
      forward: input.forward(),
      back: input.back(),
      left: input.left(),
      right: input.right(),
      handbrake: input.handbrake(),
    }, (x, z, r) => city.collideCircle(x, z, r));
    const moved = Math.hypot(car.x - before.x, car.z - before.z);
    if (car.crashed > 0.2) audio.crash();
    audio.setEngine(true, Math.abs(car.speed) / car.topSpeed());
    // Running over a pedestrian is a crime the whole street sees.
    const ped = pedestrians.nearest(car.x, car.z, 2.2);
    if (ped && Math.abs(car.speed) > 5) {
      pedestrians.knockDown(ped);
      addStars(WANTED.hitPedStars, 'Pedestrian hit');
      danger = { x: car.x, z: car.z, active: true };
      car.speed *= 0.5;
    }
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    return;
  }

  // On foot: WASD moves relative to the camera, Shift sprints.
  const drag = input.takeDrag();
  if (drag) cameraYaw -= drag * 0.005;
  const fx = Math.sin(cameraYaw);
  const fz = Math.cos(cameraYaw);
  const rx = Math.sin(cameraYaw + Math.PI / 2);
  const rz = Math.cos(cameraYaw + Math.PI / 2);
  let mx = 0;
  let mz = 0;
  if (input.forward()) { mx += fx; mz += fz; }
  if (input.back()) { mx -= fx; mz -= fz; }
  if (input.right()) { mx += rx; mz += rz; }
  if (input.left()) { mx -= rx; mz -= rz; }
  const len = Math.hypot(mx, mz);
  player.moving = len > 0;
  if (len > 0) {
    const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    mx /= len;
    mz /= len;
    player.heading = Math.atan2(mx, mz);
    let nx = player.x + mx * speed * dt;
    let nz = player.z + mz * speed * dt;
    const fixed = city.collideCircle(nx, nz, PLAYER.radius);
    nx = fixed.x;
    nz = fixed.z;
    const clamped = city.clampToBounds(nx, nz, PLAYER.radius);
    player.x = clamped.x;
    player.z = clamped.z;
    player.walkPhase += dt * (input.run() ? 13 : 9);
  }
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.5 : 0;
  playerMesh.userData.legL.rotation.x = swing;
  playerMesh.userData.legR.rotation.x = -swing;
  playerMesh.position.set(player.x, player.moving ? Math.abs(Math.sin(player.walkPhase)) * 0.06 : 0, player.z);
  playerMesh.rotation.y = player.heading;
}

function drawMinimapNow() {
  hud.drawMinimap({
    cityRoads: city.roads,
    beaconVisible: city.beacon.visible,
    beaconX: city.beacon.position.x,
    beaconZ: city.beacon.position.z,
    policeCars: police.policePositions(),
    trafficCars: traffic.cars.filter((e) => !e.car.occupied).map((e) => ({ x: e.car.x, z: e.car.z })),
    playerX: player.x,
    playerZ: player.z,
    playerHeading: player.heading,
  });
}

function stepWorld(dt) {
  timeSeconds += dt;
  updateLighting();
  city.pulseBeacon(timeSeconds);
  for (const marker of collectMarkers) {
    marker.rotation.y += dt * 2;
    marker.position.y = 1.2 + Math.sin(timeSeconds * 3) * 0.15;
  }

  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.isMuted());
    hud.toast(audio.isMuted() ? 'Sound muted' : 'Sound on');
  }
  if (actions & ACTION_PAUSE) {
    if (screen === 'playing') {
      screen = 'paused';
      saveGame();
      hud.showPaused(true);
      hud.announce('Paused. Progress saved.');
    } else if (screen === 'paused') {
      screen = 'playing';
      hud.showPaused(false);
    }
  }
  if (screen !== 'playing') return;

  stepPlayer(dt);

  // Interact: enter/exit a car, or start the next job at the marker.
  if (actions & ACTION_INTERACT) {
    if (player.inCar) {
      exitCar();
    } else {
      const car = nearestDrivableCar(3.6);
      if (car) {
        const isTraffic = traffic.cars.some((e) => e.car === car);
        enterCar(car, isTraffic);
        if (isTraffic) traffic.removeCar(car);
      } else if (!missions.isActive() && !freeRoam && missions.state().completedCount < MISSIONS.total) {
        missions.startNext();
      }
    }
  }

  // Attack: punch up close, otherwise shoot. Mouse hold fires repeatedly.
  const wantAttack = (actions & ACTION_ATTACK) || input.mouseDown();
  if (wantAttack && !player.inCar && player.attackTimer <= 0) {
    player.attackTimer = PLAYER.shootRate;
    const nearEnemy = combat.punch(player, player.heading);
    if (nearEnemy) {
      audio.punch();
    } else {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = new THREE.Vector3(player.x, 1.5, player.z);
      const hit = combat.shoot(origin, dir);
      audio.shoot();
      if (hit) danger = { x: player.x, z: player.z, active: true };
      // Firing a gun in public draws the law — at most one new star per burst.
      if (timeSeconds - lastShotStarAt > 4) {
        lastShotStarAt = timeSeconds;
        addStars(1, 'Shots fired');
      }
    }
  }

  traffic.step(dt, player.inCar ? player.car : null, player);
  pedestrians.step(dt, danger, player);
  danger.active = false;

  const combatDamage = combat.step(dt, player, screen === 'playing');
  if (combatDamage > 0) hurtPlayer(combatDamage, 'beaten');

  const policeEvents = police.step(dt, player, playerSpeed(), player.inCar, timeSeconds);
  if (policeEvents.rammed) hurtPlayer(POLICE.ramDamage, 'rammed');
  if (policeEvents.rammedCar && player.inCar && player.car) {
    player.car.speed *= 0.72;
    player.car.crashed = 0.3;
    audio.crash();
  }
  if (policeEvents.busted) busted();
  if (policeEvents.starFaded) hud.toast(`Wanted level ${police.wantedCount()} — lay low`);
  audio.setSiren(police.isSirenOn());

  missions.update(dt, {
    x: player.x,
    z: player.z,
    inCar: player.inCar,
    carKind: player.carKind,
    enemiesLeft: combat.enemiesLeft(),
  });

  // No job running: point the beacon at the next job's start, so the player
  // can always find work.
  if (!missions.isActive() && !freeRoam && missions.state().completedCount < MISSIONS.total) {
    const def = missions.currentDef();
    if (def) setBeacon(def.steps[0].x, def.steps[0].z, true);
  }

  // The prompt line: what E does right now.
  if (!player.inCar) {
    const car = nearestDrivableCar(3.6);
    if (car) hud.prompt(car.kind === 'taxi' ? 'E — Get in the taxi' : 'E — Steal the car');
    else if (!missions.isActive() && !freeRoam && missions.state().completedCount < MISSIONS.total) hud.prompt('E — Start the next job');
    else hud.prompt('');
  } else {
    hud.prompt('E — Get out of the car');
  }

  // HUD refresh.
  const objective = missions.objectiveText();
  const mState = missions.state();
  const progress = missions.isActive()
    ? `Job ${mState.activeId} of ${MISSIONS.total}`
    : `Jobs ${mState.completedCount}/${MISSIONS.total}`;
  const beaconDist = city.beacon.visible
    ? Math.hypot(player.x - city.beacon.position.x, player.z - city.beacon.position.z)
    : 0;
  hud.updateObjective(objective.name, objective.text, missions.timerLeft(), progress, beaconDist);
  hud.updateStats(player.cash, player.health, timeSeconds);
  hud.updateWanted(police.wantedCount());
  hud.updateSpeed(
    player.inCar,
    player.inCar && player.car ? Math.abs(player.car.speed) * 2.2 : 0,
    player.inCar && player.car ? player.car.speed < -0.5 : false,
    player.inCar && player.car ? player.car.kindLabel() : '',
    player.inCar && player.car ? Math.round(player.car.damage) : 0,
  );
  drawMinimapNow();
}

function renderFrame() {
  updateCamera(STEP);
  renderer.render(scene, camera);
}

// The game object the screenshot stager and the play-test harness drive.
const game = {
  get screen() { return screen; },
  get player() { return player; },
  get police() { return police; },
  get missions() { return missions; },
  get combat() { return combat; },
  get traffic() { return traffic; },
  get pedestrians() { return pedestrians; },
  get city() { return city; },
  get timeSeconds() { return timeSeconds; },
  get sunIntensity() { return sun.intensity; },
  get skyColor() { return scene.background.getHexString(); },
  setTime(t) { timeSeconds = t; },
  setCamera(yaw, pitch, dist) {
    cameraYaw = yaw;
    cameraPitch = pitch;
    cameraDistance = dist;
  },
  placePlayer(x, z, heading) {
    if (player.inCar) exitCar();
    player.x = x;
    player.z = z;
    player.heading = heading;
    cameraYaw = heading;
  },
  driveCar(car, heading) {
    enterCar(car, false);
    player.heading = heading;
    cameraYaw = heading;
  },
  setWanted(n) {
    police.clearWanted();
    if (n > 0) police.addStars(n, 'staged');
  },
  startMissionAt(i) { missions.startMission(i); },
  spawnEnemiesAt(x, z, n) { combat.spawnEnemies(x, z, n); },
  setFrozen(value) { frozen = value; },
  advance(dt, fakeInput) {
    // Advance the world with scripted input (used by screenshot staging).
    stepWorld(dt);
  },
  renderOnce() { renderFrame(); },
  drawMinimap() { drawMinimapNow(); },
  state() {
    return {
      screen,
      x: player.x,
      z: player.z,
      heading: player.heading,
      health: player.health,
      cash: player.cash,
      inCar: player.inCar,
      carKind: player.carKind,
      carDamage: player.inCar && player.car ? Math.round(player.car.damage) : 0,
      carTopSpeed: player.inCar && player.car ? Math.round(player.car.topSpeed()) : 0,
      smokePuffs: player.inCar && player.car ? player.car.smoke.filter((p) => p.life > 0).length : 0,
      heli: police.heliActive(),
      wanted: police.wantedCount(),
      missionActive: missions.isActive(),
      mission: missions.activeMission() ? missions.activeMission().name : null,
      objective: missions.objectiveText(),
      enemiesLeft: combat.enemiesLeft(),
      enemyPositions: combat.enemyPositions(),
      trafficCars: traffic.cars.length,
      pedsUp: pedestrians.countUp(),
      policeCars: police.cars.length,
    };
  },
};
window.__solmar = game;

// Menu buttons.
document.getElementById('btnStart').addEventListener('click', () => {
  clearSave();
  player.cash = PLAYER.startCash;
  player.health = PLAYER.health;
  player.x = START_POS.x;
  player.z = START_POS.z;
  player.heading = Math.PI;
  missions.restore({ completedCount: 0, nextIndex: 0 });
  startPlaying('story');
});
document.getElementById('btnContinue').addEventListener('click', () => {
  const data = readSave();
  if (data) loadSave(data);
  startPlaying('story');
});
document.getElementById('btnFree').addEventListener('click', () => startPlaying('free'));
document.getElementById('btnResume').addEventListener('click', () => {
  screen = 'playing';
  hud.showPaused(false);
});
document.getElementById('btnSaveQuit').addEventListener('click', () => {
  saveGame();
  screen = 'menu';
  hud.showPaused(false);
  hud.showMenu(true, !!readSave());
});

hud.showMenu(true, !!readSave());
hud.updateStats(player.cash, player.health, 0);
hud.updateWanted(0);
drawMinimapNow();

if (shot) {
  // Stage after the page has loaded: the staging runs the real sim forward in
  // one synchronous burst, and a slow renderer would otherwise hold the load
  // event past a screenshot tool's navigation timeout.
  requestAnimationFrame(() => {
    window.setTimeout(() => stageShot(game, shot, { renderer, scene, camera, hud, audio, city, input }), 50);
  });
} else {
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (!frozen) {
      while (accumulator >= STEP) {
        stepWorld(STEP);
        accumulator -= STEP;
      }
    }
    if (screen === 'menu') {
      // The menu's backdrop: a slow orbit over the beachfront.
      const t = performance.now() / 1000;
      camera.position.set(Math.sin(t * 0.05) * 120, 42, 190 + Math.cos(t * 0.05) * 40);
      camera.lookAt(0, 6, 60);
      drawMinimapNow();
      renderer.render(scene, camera);
    } else {
      renderFrame();
    }
  }
  requestAnimationFrame(frame);
}
