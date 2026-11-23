// Solmar Bay — main: boot, the game loop, driving and walking, combat
// input, wanted/busted/wasted, saving, and the debug helpers the test
// harness drives the game with (window.__solmar).
//
// The loop runs on requestAnimationFrame with the frame time clamped to
// 0.05s. advance(dt) runs exactly one update with the given dt, which is
// how the harness steps the simulation deterministically while frozen.

import { CAR, CAR_DAMAGE, CAR_KINDS, DAY_LENGTH, MISSIONS, PALETTE, PLAYER, WANTED } from './config.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { ACTION_ATTACK, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createMissions } from './missions.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createRandom } from './rng.js';
import { readSave, writeSave } from './save.js';
import { stageShot } from './shots.js';
import { createTraffic } from './traffic.js';
import { randomKind } from './vehicles.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const shotParam = params.get('shot');
const seed = seedParam === null ? null : (parseInt(seedParam, 10) || 0);
const rng = createRandom(seed !== null ? seed : (Math.random() * 2147483647) | 0);

// --- renderer, scene, camera, lights --------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.sky, 220, 560);
const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 900);
camera.position.set(140, 90, 300);

const hemi = new THREE.HemisphereLight(PALETTE.sun, 0x3a4a3a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, 1.4);
sun.position.set(120, 180, 60);
scene.add(sun);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- world and systems -----------------------------------------------------
const city = buildCity(scene, rng);
const audio = createAudio();
const input = createInput(canvas);
const hud = createHud();
const traffic = createTraffic(scene, city, rng);
const pedestrians = createPedestrians(scene, city, rng);
const combat = createCombat(scene, city, rng, audio);
const police = createPolice(scene, city, rng, audio);

const player = {
  x: 30, z: 180, heading: Math.PI,
  health: PLAYER.health, cash: PLAYER.startCash,
  walkPhase: 0, inCar: false, car: null, carKind: null,
  attackTimer: 0, hurtTimer: 0, moving: false,
};

const missions = createMissions({
  scene, city, traffic, combat, police, audio, hud, rng, player,
  addCash: (n) => { player.cash += n; },
});

// --- the player on foot ----------------------------------------------------
const playerMesh = new THREE.Group();
playerMesh.name = 'playerMesh';
{
  const jacket = new THREE.MeshLambertMaterial({ color: PALETTE.playerJacket });
  const pants = new THREE.MeshLambertMaterial({ color: PALETTE.playerPants });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x2b2118 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), jacket);
  torso.position.y = 0.85;
  torso.name = 'torso';
  playerMesh.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.42;
  head.name = 'head';
  playerMesh.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), hair);
  hairTop.position.y = 1.62;
  hairTop.name = 'hair';
  playerMesh.add(hairTop);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.24), pants);
    leg.position.set(side * 0.14, 0.25, 0);
    leg.name = side < 0 ? 'legL' : 'legR';
    playerMesh.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), jacket);
    arm.position.set(side * 0.4, 0.85, 0);
    arm.name = side < 0 ? 'armL' : 'armR';
    playerMesh.add(arm);
  }
}
scene.add(playerMesh);

function syncPlayerMesh() {
  playerMesh.position.set(player.x, 0, player.z);
  playerMesh.rotation.y = player.heading;
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  const legL = playerMesh.getObjectByName('legL');
  const legR = playerMesh.getObjectByName('legR');
  const armL = playerMesh.getObjectByName('armL');
  const armR = playerMesh.getObjectByName('armR');
  if (legL) legL.rotation.x = swing;
  if (legR) legR.rotation.x = -swing;
  if (armL) armL.rotation.x = -swing * 0.7;
  if (armR) armR.rotation.x = swing * 0.7;
  playerMesh.visible = !player.inCar;
}

// --- game state ------------------------------------------------------------
let screen = 'menu';
let frozen = false;
let timeOfDay = 9;
let camYaw = player.heading;
let camManual = false;
let menuAngle = 0.6;
let bustTimer = 0;
let savedCompleted = [];

function fmtTimeOfDay(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// --- cars: entering, exiting, driving --------------------------------------
function enterCar(car) {
  if (player.inCar && player.car) player.car.occupied = false;
  player.inCar = true;
  player.car = car;
  player.carKind = car.tune;
  car.occupied = true;
  car.parked = false;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  camYaw = car.heading;
  hud.prompt(null);
  syncPlayerMesh();
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  car.occupied = false;
  player.x = car.x + Math.cos(car.heading) * 2;
  player.z = car.z - Math.sin(car.heading) * 2;
  player.heading = car.heading;
  player.inCar = false;
  player.car = null;
  player.carKind = null;
  syncPlayerMesh();
}

function tryInteract() {
  if (player.inCar) {
    exitCar();
    return;
  }
  const car = traffic.nearestFreeCar(player.x, player.z, 5);
  if (car) enterCar(car);
}

function tryAttack() {
  if (player.attackTimer > 0 || screen !== 'playing') return;
  const dx = Math.sin(player.heading);
  const dz = Math.cos(player.heading);
  let close = false;
  for (const e of combat.enemyPositions()) {
    if (Math.hypot(e.x - player.x, e.z - player.z) < PLAYER.punchRange + 0.5) close = true;
  }
  if (close) {
    combat.punch(dx, dz);
    audio.punch();
    player.attackTimer = PLAYER.punchRate;
  } else {
    combat.shoot(dx, dz);
    audio.shoot();
    player.attackTimer = PLAYER.shootRate;
  }
}

function stepPlayerOnFoot(dt) {
  const run = input.run();
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let move = 0;
  if (input.forward()) move += 1;
  if (input.back()) move -= 0.6;
  let turn = 0;
  if (input.left()) turn += 1;
  if (input.right()) turn -= 1;
  // Facing +z, left is +x, so turning left grows the heading.
  player.heading += turn * 1.9 * dt;
  if (move !== 0) {
    const nx = player.x + Math.sin(player.heading) * speed * move * dt;
    const nz = player.z + Math.cos(player.heading) * speed * move * dt;
    // collideCircle always returns a position (the input when clear, the
    // pushed-out one when a building is in the way), so take it as-is.
    const pushed = city.collideCircle(nx, nz, PLAYER.radius);
    player.x = pushed.x;
    player.z = pushed.z;
    player.moving = true;
    player.walkPhase += dt * speed * 1.6;
  } else {
    player.moving = false;
  }
  const clamped = city.clampToBounds(player.x, player.z, PLAYER.radius);
  player.x = clamped.x;
  player.z = clamped.z;
}

function stepPlayerCar(dt) {
  const car = player.car;
  if (!car) return;
  const tune = car.tune;
  const fwd = input.forward() ? 1 : 0;
  const back = input.back() ? 1 : 0;
  const handbrake = input.handbrake();
  const top = car.effectiveTopSpeed();
  if (fwd) {
    car.speed += tune.accel * dt;
  } else if (back) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    const drag = Math.min(Math.abs(car.speed), 6 * dt);
    car.speed -= Math.sign(car.speed) * drag;
  }
  if (handbrake) {
    const cut = Math.min(Math.abs(car.speed), 24 * dt);
    car.speed -= Math.sign(car.speed) * cut;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(top, car.speed));
  const steerInput = (input.left() ? 1 : 0) - (input.right() ? 1 : 0);
  const authority = Math.min(1, Math.abs(car.speed) / 8);
  car.heading += steerInput * CAR.steerAngle * (tune.grip || 1) * authority
    * Math.sign(car.speed || 1) * dt * (handbrake ? 1.6 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // collideCircle always returns a position: it is the input position when
  // the road is clear, and the pushed-out position when a building is in
  // the way. Only a changed position means a wall was hit.
  const pushed = city.collideCircle(nx, nz, 2.2);
  if (pushed.x !== nx || pushed.z !== nz) {
    // Buildings stop the car but do not damage it: the wall takes the hit.
    car.x = pushed.x;
    car.z = pushed.z;
    car.speed *= 0.25;
  } else {
    car.x = nx;
    car.z = nz;
  }
  const clamped = city.clampToBounds(car.x, car.z, 2.2);
  car.x = clamped.x;
  car.z = clamped.z;
  // Crashes into other cars: the closing speed sets the damage.
  for (const other of traffic.cars) {
    if (other === car || other.occupied) continue;
    const dx = car.x - other.x;
    const dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d >= 4.6 || d < 0.001) continue;
    const nx2 = dx / d;
    const nz2 = dz / d;
    const pvx = Math.sin(car.heading) * car.speed;
    const pvz = Math.cos(car.heading) * car.speed;
    const ovx = Math.sin(other.heading) * (other.speed || 0);
    const ovz = Math.cos(other.heading) * (other.speed || 0);
    // The rate the gap is closing: n points from the other car toward
    // ours, so the approach speed is the other car's velocity minus ours,
    // dotted with n. (The first version had this sign backwards and the
    // cars drove straight through each other.)
    const closing = (ovx - pvx) * nx2 + (ovz - pvz) * nz2;
    if (closing > 4 && car.crashCooldown <= 0) {
      const dmg = closing * CAR_DAMAGE.crashPerSpeed;
      car.applyDamage(dmg);
      other.applyDamage(dmg * 0.5);
      car.crashCooldown = 1;
      car.speed *= -0.2;
      audio.crash();
      combat.spawnBurst((car.x + other.x) / 2, (car.z + other.z) / 2, 5, 2);
      const overlap = 4.6 - d;
      car.x += nx2 * overlap * 0.5;
      car.z += nz2 * overlap * 0.5;
      other.x -= nx2 * overlap * 0.5;
      other.z -= nz2 * overlap * 0.5;
      other.speed = 0;
    }
  }
  // Running down a pedestrian: they go down, the law notices.
  for (const ped of pedestrians.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2) {
      pedestrians.knockDown(ped);
      police.addStars(WANTED.hitPedStars);
    }
  }
  car.updateSmoke(dt);
  car.roll(dt);
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  player.moving = Math.abs(car.speed) > 0.5;
}

// --- wanted: busted and wasted ---------------------------------------------
function hurtPlayer(dmg) {
  if (dmg <= 0) return;
  player.health -= dmg;
  player.hurtTimer = 0.5;
}

function respawn(penalty, message) {
  if (player.inCar) exitCar();
  player.cash = Math.max(0, player.cash - penalty);
  player.health = PLAYER.health;
  police.clearWanted();
  combat.clearEnemies();
  placePlayer(30, 180, Math.PI);
  hud.toast(message);
  audio.busted();
}

function checkBust(dt) {
  if (police.wantedCount() <= 0) {
    bustTimer = 0;
    return;
  }
  let nearest = Infinity;
  for (const p of police.policePositions()) {
    if (p.heli) continue;
    nearest = Math.min(nearest, Math.hypot(p.x - player.x, p.z - player.z));
  }
  const speed = player.inCar && player.car ? Math.abs(player.car.speed) : (player.moving ? PLAYER.walkSpeed : 0);
  if (nearest < WANTED.bustDistance && speed < 0.5) bustTimer += dt;
  else bustTimer = 0;
  if (bustTimer >= WANTED.bustStillSeconds) {
    bustTimer = 0;
    respawn(500, 'BUSTED — The SBPD caught up with you. -$500.');
  }
}

// --- screens, save, menu ----------------------------------------------------
function currentSave() {
  return {
    cash: Math.round(player.cash),
    health: Math.round(player.health),
    // main.js mirrors the finished-job list itself: it notes which job
    // was active right before the count of finished jobs grows.
    completed: savedCompleted.slice(),
    x: player.x, z: player.z, heading: player.heading,
    timeOfDay,
  };
}

function applySave(s) {
  if (!s) return;
  if (typeof s.cash === 'number') player.cash = s.cash;
  if (typeof s.health === 'number') player.health = s.health;
  if (Array.isArray(s.completed)) {
    savedCompleted = s.completed.slice();
    missions.restore({ completed: s.completed });
  }
  if (typeof s.x === 'number' && typeof s.z === 'number') placePlayer(s.x, s.z, s.heading ?? Math.PI);
  if (typeof s.timeOfDay === 'number') timeOfDay = s.timeOfDay;
}

function menuInfo() {
  return { hasSave: !!readSave(), defs: missions.DEFS, completedIds: savedCompleted.slice() };
}

function toMenu() {
  screen = 'menu';
  camManual = false;
  hud.showPaused(false);
  hud.showMenu(true, menuInfo());
}

function startStory() {
  screen = 'playing';
  camManual = false;
  camYaw = player.heading;
  hud.showMenu(false);
  audio.unlock();
  missions.startNext();
}

function freeRoam() {
  screen = 'playing';
  camManual = false;
  hud.showMenu(false);
  audio.unlock();
}

function continueGame() {
  const s = readSave();
  if (!s) return;
  applySave(s);
  screen = 'playing';
  camManual = false;
  hud.showMenu(false);
  audio.unlock();
}

function togglePause() {
  if (screen === 'playing') {
    screen = 'paused';
    hud.showPaused(true);
    writeSave(currentSave());
  } else if (screen === 'paused') {
    screen = 'playing';
    hud.showPaused(false);
  }
}

function quitToMenu() {
  writeSave(currentSave());
  toMenu();
}

document.getElementById('btn-start').addEventListener('click', startStory);
document.getElementById('btn-free').addEventListener('click', freeRoam);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-quit').addEventListener('click', quitToMenu);
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

// --- camera and HUD ----------------------------------------------------------
function updateCamera(dt) {
  if (camManual) return;
  if (screen === 'menu') {
    menuAngle += dt * 0.02;
    camera.position.set(Math.cos(menuAngle) * 260, 115, Math.sin(menuAngle) * 260 + 20);
    camera.lookAt(0, 0, 0);
    return;
  }
  const target = player.inCar && player.car ? player.car : player;
  const dist = player.inCar ? 13 : 11;
  const height = player.inCar ? 6.5 : 5;
  camera.position.set(
    target.x - Math.sin(camYaw) * dist,
    height,
    target.z - Math.cos(camYaw) * dist,
  );
  camera.lookAt(target.x, 1.5, target.z);
}

function drawMinimap() {
  hud.drawMinimap({ player, city, traffic, police, missions, combat });
}

function refreshHud() {
  hud.updateStats({
    cash: player.cash,
    health: player.health,
    time: fmtTimeOfDay(timeOfDay),
    jobsDone: missions.state().completedCount,
    jobsTotal: MISSIONS.total,
  });
  hud.updateWanted(police.wantedCount());
  hud.updateObjective(missions.objectiveText());
  hud.updateSpeed(player.inCar && player.car ? player.car : null);
  hud.showCrosshair(screen === 'playing' && !player.inCar);
  drawMinimap();
}

function updatePrompt() {
  if (player.inCar) {
    hud.prompt(null);
    return;
  }
  const car = traffic.nearestFreeCar(player.x, player.z, 5);
  hud.prompt(car ? 'Press E to enter the car' : null);
}

// --- the update --------------------------------------------------------------
function update(dt) {
  timeOfDay = (timeOfDay + (dt / DAY_LENGTH) * 24) % 24;
  city.pulseBeacon(dt);
  if (screen === 'menu') {
    traffic.step(dt, player.x, player.z);
    pedestrians.step(dt, player.x, player.z);
    return;
  }
  if (screen !== 'playing') return;
  const drag = input.takeDrag();
  if (drag) {
    camYaw -= drag * 0.005;
    camManual = false;
  }
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) togglePause();
  if (screen !== 'playing') return;
  if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
  if (actions & ACTION_INTERACT) tryInteract();
  if ((actions & ACTION_ATTACK) || input.mouseDown()) tryAttack();
  if (player.attackTimer > 0) player.attackTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  if (player.inCar) stepPlayerCar(dt);
  else stepPlayerOnFoot(dt);
  traffic.step(dt, player.x, player.z);
  pedestrians.step(dt, player.x, player.z);
  const combatDmg = combat.step(dt, player.x, player.z);
  if (combatDmg > 0) hurtPlayer(combatDmg);
  const ramDmg = police.step(dt, player.x, player.z, player.inCar);
  if (ramDmg > 0) {
    if (player.inCar && player.car) {
      player.car.applyDamage(ramDmg);
      audio.crash();
    } else {
      hurtPlayer(ramDmg);
    }
  }
  checkBust(dt);
  const wasActive = missions.isActive() ? missions.activeMission().id : null;
  const countBefore = missions.state().completedCount;
  missions.update(dt, player);
  if (wasActive !== null && missions.state().completedCount > countBefore) {
    savedCompleted.push(wasActive);
  }
  audio.setEngine(player.inCar && player.car ? Math.abs(player.car.speed) / (player.car.effectiveTopSpeed() || 1) : 0, player.inCar);
  updatePrompt();
  syncPlayerMesh();
  if (player.health <= 0) {
    respawn(250, 'WASTED — You wake up at the marina clinic. -$250.');
  }
}

// --- debug helpers -----------------------------------------------------------
function placePlayer(x, z, heading) {
  player.x = x;
  player.z = z;
  if (heading !== undefined) player.heading = heading;
  if (player.inCar && player.car) {
    player.car.x = x;
    player.car.z = z;
    if (heading !== undefined) player.car.heading = heading;
    player.car.syncMesh();
  }
  camManual = false;
  syncPlayerMesh();
}

function driveCar(kind, heading) {
  let car;
  if (kind && typeof kind === 'object' && kind.mesh) {
    car = kind;
    car.occupied = false;
  } else {
    let kindName = kind;
    if (typeof kind === 'number') {
      const kinds = Object.keys(CAR_KINDS);
      kindName = kinds[kind] || randomKind(rng);
    }
    if (!kindName || !CAR_KINDS[kindName]) kindName = randomKind(rng);
    car = traffic.spawnCar(kindName, player.x, player.z, heading !== undefined ? heading : player.heading);
  }
  camManual = false;
  enterCar(car);
  return car;
}

function state() {
  const car = player.inCar && player.car ? player.car : null;
  return {
    screen,
    x: player.x,
    z: player.z,
    heading: player.heading,
    health: Math.round(player.health),
    cash: Math.round(player.cash),
    inCar: player.inCar,
    carKind: car ? car.tune : null,
    carDamage: car ? Math.round(car.damage) : 0,
    carTopSpeed: car ? Math.round(car.effectiveTopSpeed()) : 0,
    smokePuffs: car ? car.smokePuffs : 0,
    heli: police.heliActive(),
    wanted: police.wantedCount(),
    missionActive: missions.isActive(),
    mission: missions.isActive() ? missions.activeMission().name : missions.state(),
    objective: missions.objectiveText(),
    enemiesLeft: combat.enemiesLeft(),
    enemyPositions: combat.enemyPositions(),
    trafficCars: traffic.cars.length,
    pedsUp: pedestrians.countUp(),
    policeCars: police.cars.length,
  };
}

window.__solmar = {
  player, police, missions, combat, traffic, pedestrians, city, scene,
  setTime: (h) => { timeOfDay = ((h % 24) + 24) % 24; },
  setCamera: (x, y, z) => { camera.position.set(x, y, z); camManual = true; },
  setCameraLookAt: (x, y, z, tx, ty, tz) => {
    camera.position.set(x, y, z);
    camera.lookAt(tx, ty, tz);
    camManual = true;
  },
  heliPos: () => police.heliPosition(),
  placePlayer,
  driveCar,
  setWanted: (n) => {
    police.clearWanted();
    if (n > 0) police.addStars(n);
  },
  startMissionAt: (i) => {
    if (screen !== 'playing') {
      screen = 'playing';
      hud.showMenu(false);
      hud.showPaused(false);
    }
    camManual = false;
    missions.startMission(i);
  },
  spawnEnemiesAt: (x, z, count) => combat.spawnEnemies(x, z, count),
  setFrozen: (b) => { frozen = !!b; },
  advance: (dt) => { update(dt); },
  renderOnce: () => {
    updateCamera(0);
    renderer.render(scene, camera);
    drawMinimap();
  },
  drawMinimap: () => drawMinimap(),
  toMenu: () => toMenu(),
  state,
};

// --- boot --------------------------------------------------------------------
syncPlayerMesh();
hud.showMenu(true, menuInfo());
hud.updateStats({ cash: player.cash, health: player.health, time: fmtTimeOfDay(timeOfDay), jobsDone: 0, jobsTotal: MISSIONS.total });
hud.updateWanted(0);
hud.updateObjective(missions.objectiveText());
if (shotParam !== null) {
  const n = parseInt(shotParam, 10);
  if (n >= 1 && n <= 4) stageShot(n, window.__solmar);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(rawDt, 0.05);
  if (!frozen) update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  if (screen === 'playing') refreshHud();
}
requestAnimationFrame(frame);
