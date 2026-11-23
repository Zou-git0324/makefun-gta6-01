// Solmar Bay — the main loop and the wiring between every system.
//
// main.js owns the frame: it reads the input, moves Lena (on foot or in
// a car), steps traffic, pedestrians, police, combat and missions, keeps
// the sun and the HUD in sync, and exposes the game through
// window.__solmar for screenshots and scripted playthroughs.
//
// The systems themselves live in their own files and only talk to the
// world through the objects passed to their factories. Nothing here
// reaches into another module's internals.

import { CAR, CAR_DAMAGE, DAY_LENGTH, MISSIONS, PALETTE, PLAYER, POLICE, WANTED } from './config.js';
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
import { Car, randomCarColor, randomKind } from './vehicles.js';

// ---------------------------------------------------------------- boot

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const skyDay = new THREE.Color(PALETTE.sky);
const skyNight = new THREE.Color(0x0e1a2b);
const skyNow = new THREE.Color(PALETTE.sky);
scene.background = skyNow;
scene.fog = new THREE.Fog(PALETTE.sky, 220, 700);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 90, 200);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a4238, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 600;
scene.add(sun);
scene.add(sun.target);

const rng = createRandom((Date.now() % 2147483646) + 1);
const city = buildCity(scene, rng);
const audio = createAudio();
const hud = createHud();
const input = createInput(canvas);
const traffic = createTraffic(scene, city, rng);
const peds = createPedestrians(scene, city, rng);
const police = createPolice(scene, city, rng);
const combat = createCombat(scene, city, rng);

// ---------------------------------------------------------------- state

let screen = 'menu'; // menu | playing | paused
let mode = 'story'; // story | free
let frozen = false;
let timeSeconds = 0;
let sunIntensity = 2.4;
let skyColor = '8ec9ee';
let totalSmokePuffs = 0;
let cameraOverride = null;
let menuAngle = 0;
let pendingNext = 0;
let dialogueTimer = 0;
let shootStarTimer = 0;
const dialogueQueue = [];

// Lena. The shape of this object is the game's public player state.
const player = {
  x: 30,
  z: 180,
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

// The beacon target for the minimap and the job marker.
let beaconTarget = null;
// Glowing boxes marking uncollected dead drops.
let collectMarkers = [];
let collectPoints = [];

// ---------------------------------------------------------------- player mesh

const playerMesh = new THREE.Group();
{
  const jacket = new THREE.MeshLambertMaterial({ color: PALETTE.playerJacket });
  const pants = new THREE.MeshLambertMaterial({ color: PALETTE.playerPants });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x2a1a12 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pants);
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), jacket);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 1.75;
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.36), hair);
  hairTop.position.y = 1.95;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), jacket);
  armL.position.set(-0.4, 1.15, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  for (const part of [legL, legR, torso, head, hairTop, armL, armR]) {
    part.castShadow = true;
    playerMesh.add(part);
  }
  playerMesh.userData.legL = legL;
  playerMesh.userData.legR = legR;
  playerMesh.userData.armL = armL;
  playerMesh.userData.armR = armR;
}
scene.add(playerMesh);

function syncPlayerMesh() {
  playerMesh.visible = !player.inCar;
  playerMesh.position.set(player.x, 0, player.z);
  playerMesh.rotation.y = player.heading;
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.6 : 0;
  playerMesh.userData.legL.rotation.x = swing;
  playerMesh.userData.legR.rotation.x = -swing;
  playerMesh.userData.armL.rotation.x = -swing;
  playerMesh.userData.armR.rotation.x = swing;
}

// ---------------------------------------------------------------- missions

function queueDialogue(lines) {
  if (!lines) return;
  for (const line of lines) dialogueQueue.push(line);
}

const hooks = {
  spawnMissionCar(kind, x, z) {
    const car = new Car(scene, {
      kind,
      color: randomCarColor(rng),
      x,
      z,
      heading: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      parked: true,
    });
    car.missionCar = true;
    traffic.cars.push(car);
    return car;
  },
  toast(msg) {
    hud.toast(msg);
  },
  sound(name) {
    const fn = audio[name];
    if (typeof fn === 'function') fn.call(audio);
  },
  setBeacon(x, z, visible) {
    beaconTarget = visible ? { x, z } : null;
    city.setBeacon(x, z, visible);
  },
  showCollect(points) {
    for (const m of collectMarkers) scene.remove(m);
    collectMarkers = [];
    collectPoints = points || [];
    if (!points) return;
    const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const mat = new THREE.MeshLambertMaterial({ color: 0x37d67a });
    for (const p of points) {
      const marker = new THREE.Mesh(geo, mat);
      marker.position.set(p.x, 1.0, p.z);
      scene.add(marker);
      collectMarkers.push(marker);
    }
  },
  spawnEnemies(x, z, count) {
    combat.spawnEnemies(x, z, count);
  },
  enemiesLeft() {
    return combat.enemiesLeft();
  },
  addStars(n) {
    police.addStars(n);
  },
  onMissionComplete(def) {
    player.cash += def.reward;
    audio.cash();
    hud.announce('JOB COMPLETE  +$' + def.reward);
    queueDialogue(def.outro);
    saveGame();
    if (missions.state().completedCount >= MISSIONS.total) {
      hud.announce('DEBT PAID — SOLMAR BAY IS YOURS');
    } else if (mode === 'story') {
      pendingNext = 2.5;
    }
  },
  onMissionFailed(def, reason) {
    hud.toast(reason === 'time' ? 'Job failed — out of time' : 'Job failed');
    audio.busted();
    saveGame();
  },
};

const missions = createMissions(hooks);

function beginMission(i) {
  pendingNext = 0;
  if (!missions.startMission(i)) return;
  const def = missions.currentDef();
  if (def) queueDialogue(def.intro);
}

// Where the next job starts, for the free-roam marker.
function jobMarkerTarget() {
  const def = missions.currentDef();
  if (!def) return null;
  const first = def.steps[0];
  if (first.x !== undefined) return { x: first.x, z: first.z };
  if (first.points && first.points.length) return first.points[0];
  return null;
}

function updateJobMarker() {
  if (missions.isActive()) return;
  const target = jobMarkerTarget();
  if (target) hooks.setBeacon(target.x, target.z, true);
}

// ---------------------------------------------------------------- save

function saveGame() {
  writeSave({
    cash: player.cash,
    health: player.health,
    completedCount: missions.state().completedCount,
    nextIndex: missions.state().nextIndex,
    x: player.x,
    z: player.z,
    heading: player.heading,
    timeSeconds,
    mode,
  });
}

function applySave(s) {
  player.cash = s.cash !== undefined ? s.cash : PLAYER.startCash;
  player.health = s.health !== undefined ? s.health : PLAYER.health;
  missions.restore(s);
  if (s.x !== undefined) {
    player.x = s.x;
    player.z = s.z;
    player.heading = s.heading || 0;
  }
  timeSeconds = s.timeSeconds || 0;
  mode = s.mode || 'story';
  syncPlayerMesh();
}

// ---------------------------------------------------------------- menu

function startStory() {
  mode = 'story';
  missions.restore({ completedCount: 0, nextIndex: 0 });
  player.cash = PLAYER.startCash;
  player.health = PLAYER.health;
  player.x = 30;
  player.z = 180;
  player.heading = Math.PI;
  player.inCar = false;
  player.car = null;
  player.carKind = null;
  timeSeconds = 0;
  screen = 'playing';
  hud.showMenu(false);
  audio.unlock();
  audio.click();
  beginMission(0);
}

function continueGame() {
  const s = readSave();
  if (!s) return;
  applySave(s);
  screen = 'playing';
  hud.showMenu(false);
  audio.unlock();
  audio.click();
  updateJobMarker();
}

function startFreeRoam() {
  mode = 'free';
  screen = 'playing';
  hud.showMenu(false);
  audio.unlock();
  audio.click();
  updateJobMarker();
}

function quitToMenu() {
  saveGame();
  screen = 'menu';
  hud.showPaused(false);
  hud.showMenu(true, true);
}

document.getElementById('btn-start').addEventListener('click', startStory);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-free').addEventListener('click', startFreeRoam);
document.getElementById('btn-resume').addEventListener('click', () => {
  screen = 'playing';
  hud.showPaused(false);
});
document.getElementById('btn-quit').addEventListener('click', quitToMenu);

// ---------------------------------------------------------------- camera

function updateCamera(dt, snap) {
  const fwd = { x: Math.sin(player.heading), z: Math.cos(player.heading) };
  let tx;
  let ty;
  let tz;
  let lx;
  let ly;
  let lz;
  if (cameraOverride) {
    const a = player.heading + Math.PI + cameraOverride.azimuth;
    const horiz = Math.cos(cameraOverride.elevation) * cameraOverride.distance;
    tx = player.x + Math.sin(a) * horiz;
    ty = Math.sin(cameraOverride.elevation) * cameraOverride.distance + 1.2;
    tz = player.z + Math.cos(a) * horiz;
    lx = player.x + fwd.x * 4;
    ly = 1.6;
    lz = player.z + fwd.z * 4;
  } else {
    const dist = player.inCar ? 10 : 7.5;
    const height = player.inCar ? 4.2 : 3.6;
    tx = player.x - fwd.x * dist;
    ty = height;
    tz = player.z - fwd.z * dist;
    lx = player.x + fwd.x * 6;
    ly = 1.6;
    lz = player.z + fwd.z * 6;
  }
  const k = snap ? 1 : 1 - Math.exp(-8 * dt);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(lx, ly, lz);
}

// ---------------------------------------------------------------- hud sync

function clockText() {
  const total = (9 * 3600 + timeSeconds) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function minimapData() {
  return {
    x: player.x,
    z: player.z,
    heading: player.heading,
    beacon: beaconTarget,
    police: police.policePositions(),
    enemies: combat.enemyPositions(),
    collect: collectPoints,
    traffic: traffic.cars.map((c) => ({ x: c.x, z: c.z })),
    peds: peds.peds.filter((p) => !p.down).map((p) => ({ x: p.x, z: p.z })),
    roads: city.roads,
    bounds: city.bounds,
  };
}

function syncHud() {
  const obj = missions.objectiveText();
  const jobSuffix = missions.isActive()
    ? ' · Job ' + missions.currentDef().id + ' of ' + MISSIONS.total
    : '';
  hud.updateObjective(obj.name + jobSuffix, obj.text, missions.timerLeft());
  hud.updateStats(player.cash, Math.round(player.health), clockText());
  hud.updateWanted(police.wantedCount());
  if (player.inCar && player.car) {
    hud.updateSpeed(
      Math.abs(player.car.speed) * 2.23694,
      player.car.kindLabel(),
      player.car.damage,
    );
  } else {
    hud.updateSpeed(0, null, 0);
  }
  hud.showCrosshair(!player.inCar && screen === 'playing');
  hud.drawMinimap(minimapData());
}

// ---------------------------------------------------------------- damage

function addCarDamage(car, impact) {
  car.damage = Math.min(100, car.damage + CAR_DAMAGE.crashPerSpeed * impact);
  car.crashed = true;
  car.crashCooldown = 0.8;
  audio.crash();
}

function wasted() {
  player.health = PLAYER.health;
  player.cash = Math.max(0, player.cash - 150);
  police.clearWanted();
  if (player.inCar && player.car) {
    player.car.occupied = false;
    player.car = null;
    player.carKind = null;
    player.inCar = false;
  }
  player.x = 30;
  player.z = 180;
  player.heading = Math.PI;
  syncPlayerMesh();
  hud.toast('You woke up at the clinic — $150 poorer');
  audio.busted();
  saveGame();
}

function busted() {
  player.cash = Math.max(0, player.cash - 200);
  police.clearWanted();
  if (player.inCar && player.car) {
    player.car.occupied = false;
    player.car = null;
    player.carKind = null;
    player.inCar = false;
  }
  player.x = 30;
  player.z = 180;
  player.heading = Math.PI;
  syncPlayerMesh();
  hud.toast('Busted — the SBPD took $200');
  audio.busted();
  saveGame();
}

// ---------------------------------------------------------------- step

function enterCar(car) {
  player.car = car;
  player.carKind = car.tune;
  player.inCar = true;
  car.occupied = true;
  car.parked = false;
  if (car.missionCar) {
    // The job pays the heat for this one; no extra star.
    car.stolen = true;
  } else {
    car.stolen = true;
    police.addStars(WANTED.stealStars);
  }
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  const fwd = car.forwardVector();
  player.x = car.x - fwd.z * 2.5;
  player.z = car.z + fwd.x * 2.5;
  player.heading = car.heading;
  const fixed = city.collideCircle(player.x, player.z, PLAYER.radius);
  player.x = fixed.x;
  player.z = fixed.z;
  const clamped = city.clampToBounds(player.x, player.z, 1);
  player.x = clamped.x;
  player.z = clamped.z;
  car.occupied = false;
  car.parked = true;
  player.car = null;
  player.carKind = null;
  player.inCar = false;
  syncPlayerMesh();
}

function nearestEnterableCar() {
  const free = traffic.nearestFreeCar(player.x, player.z, 4);
  let best = free;
  let bestD = free ? Math.hypot(free.x - player.x, free.z - player.z) : 4;
  for (const car of police.cars) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// One simulation step. `ctl` carries this step's input; the live loop
// builds it from the keyboard and mouse, advance() builds it from a
// scripted key set.
function stepSim(dt, ctl) {
  // Clock and sky.
  timeSeconds += dt * (86400 / DAY_LENGTH);
  const hour = (9 + timeSeconds / 3600) % 24;
  const daylight = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
  sunIntensity = 0.3 + 2.1 * daylight;
  skyNow.lerpColors(skyNight, skyDay, daylight);
  skyColor = skyNow.getHexString();
  scene.background = skyNow;
  scene.fog.color.copy(skyNow);
  sun.intensity = sunIntensity;
  hemi.intensity = 0.35 + 0.5 * daylight;
  sun.position.set(player.x + 120, 180, player.z + 60);
  sun.target.position.set(player.x, 0, player.z);

  if (shootStarTimer > 0) shootStarTimer -= dt;
  if (player.attackTimer > 0) player.attackTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;

  // Dialogue lines, one at a time.
  if (dialogueTimer > 0) dialogueTimer -= dt;
  if (dialogueTimer <= 0 && dialogueQueue.length > 0) {
    const line = dialogueQueue.shift();
    hud.dialogue(line.who, line.text);
    dialogueTimer = 4.2;
  }

  // Story mode moves on to the next job a breath after the last one pays.
  if (pendingNext > 0) {
    pendingNext -= dt;
    if (pendingNext <= 0) {
      const next = missions.state().nextIndex;
      if (next < MISSIONS.total) beginMission(next);
    }
  }

  // Mouse drag turns Lena (and the camera with her).
  if (ctl.drag) player.heading -= ctl.drag * 0.004;

  if (player.inCar && player.car) {
    const car = player.car;
    car.drive(
      {
        forward: ctl.forward,
        back: ctl.back,
        left: ctl.left,
        right: ctl.right,
        handbrake: ctl.handbrake,
      },
      dt,
    );
    if (car.crashCooldown > 0) car.crashCooldown -= dt;

    // Buildings. A hard hit hurts the car and bounces it back.
    const fixed = city.collideCircle(car.x, car.z, 2.2);
    if (Math.abs(fixed.x - car.x) > 0.01 || Math.abs(fixed.z - car.z) > 0.01) {
      const impact = Math.abs(car.speed);
      car.x = fixed.x;
      car.z = fixed.z;
      if (impact > 6 && car.crashCooldown <= 0) addCarDamage(car, impact);
      car.speed *= -0.25;
    }
    const clamped = city.clampToBounds(car.x, car.z, 2);
    car.x = clamped.x;
    car.z = clamped.z;

    // Other traffic. A shunt at speed hurts both cars.
    for (const other of traffic.cars) {
      if (other === car || other.occupied || other.parked) continue;
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 4.2 && Math.abs(car.speed) > 6 && car.crashCooldown <= 0) {
        addCarDamage(car, Math.abs(car.speed) * 0.6);
        other.damage = Math.min(100, other.damage + CAR_DAMAGE.crashPerSpeed * Math.abs(car.speed) * 0.4);
        other.crashed = true;
        const push = 2.5 / Math.max(d, 0.5);
        other.x += (other.x - car.x) * push;
        other.z += (other.z - car.z) * push;
        other.sync();
        car.speed *= 0.4;
      }
    }

    // Pedestrians in the way. It costs a star and a little speed.
    for (const ped of peds.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.4) {
        peds.knockDown(ped);
        police.addStars(WANTED.hitPedStars);
        car.speed *= 0.85;
        audio.crash();
      }
    }

    // Smoke, if the car is hurt enough. Other damaged cars smoke too,
    // but this car already had its step above — stepping it twice would
    // double its puff rate.
    totalSmokePuffs += car.stepSmoke(dt);
    for (const other of traffic.cars) {
      if (other !== car && other.damage > 50) other.stepSmoke(dt);
    }

    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    player.moving = Math.abs(car.speed) > 0.5;
  } else {
    // On foot.
    const fwd = { x: Math.sin(player.heading), z: Math.cos(player.heading) };
    const right = { x: -Math.cos(player.heading), z: Math.sin(player.heading) };
    let mx = 0;
    let mz = 0;
    if (ctl.forward) {
      mx += fwd.x;
      mz += fwd.z;
    }
    if (ctl.back) {
      mx -= fwd.x;
      mz -= fwd.z;
    }
    if (ctl.right) {
      mx += right.x;
      mz += right.z;
    }
    if (ctl.left) {
      mx -= right.x;
      mz -= right.z;
    }
    const len = Math.hypot(mx, mz);
    player.moving = len > 0;
    if (len > 0) {
      const speed = ctl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const nx = player.x + (mx / len) * speed * dt;
      const nz = player.z + (mz / len) * speed * dt;
      const fixed = city.collideCircle(nx, nz, PLAYER.radius);
      const clamped = city.clampToBounds(fixed.x, fixed.z, 1);
      player.x = clamped.x;
      player.z = clamped.z;
      player.walkPhase += speed * dt * 1.6;
    }
    // Traffic nudges her aside rather than running her over.
    for (const car of traffic.cars) {
      if (car.occupied || car.parked) continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < 2 && d > 0.01) {
        player.x += ((player.x - car.x) / d) * (2 - d);
        player.z += ((player.z - car.z) / d) * (2 - d);
      }
    }
    syncPlayerMesh();
  }

  // Interact: get in or out of a car, or start the next job at the marker.
  if (ctl.interact) {
    if (player.inCar) {
      exitCar();
    } else {
      const car = nearestEnterableCar();
      if (car) {
        enterCar(car);
      } else if (!missions.isActive()) {
        const target = jobMarkerTarget();
        if (target && Math.hypot(target.x - player.x, target.z - player.z) < 6) {
          beginMission(missions.state().nextIndex);
        }
      }
    }
  }

  // Attack: punch what is close, shoot what is not.
  if (ctl.attack && player.attackTimer <= 0 && !player.inCar) {
    const fwd = { x: Math.sin(player.heading), z: Math.cos(player.heading) };
    const nearEnemy = combat.enemyPositions().find(
      (e) => !e.dead && Math.hypot(e.x - player.x, e.z - player.z) < PLAYER.punchRange,
    );
    if (nearEnemy) {
      combat.punch(fwd.x, fwd.z);
      audio.punch();
      player.attackTimer = PLAYER.punchRate;
    } else {
      const nearPed = peds.nearest(player.x, player.z, PLAYER.punchRange);
      if (nearPed && !nearPed.down) {
        peds.knockDown(nearPed);
        police.addStars(WANTED.hitPedStars);
        combat.punch(fwd.x, fwd.z);
        audio.punch();
        player.attackTimer = PLAYER.punchRate;
      } else {
        combat.shoot(fwd.x, fwd.z);
        audio.shoot();
        player.attackTimer = PLAYER.shootRate;
        if (shootStarTimer <= 0) {
          police.addStars(WANTED.shootStars);
          shootStarTimer = 5;
        }
      }
    }
  }

  // The world steps around her.
  traffic.step(dt, player.x, player.z);
  peds.step(dt, player.x, player.z);
  const hurt = combat.step(dt, player.x, player.z);
  if (hurt > 0) {
    player.health -= hurt;
    player.hurtTimer = 0.6;
  }
  const policeResult = police.step(dt, player.x, player.z, player.inCar);
  if (policeResult.rammed) {
    player.health -= POLICE.ramDamage;
    player.hurtTimer = 0.6;
    audio.crash();
  }
  if (policeResult.rammedCar && player.car) {
    player.car.damage = Math.min(100, player.car.damage + POLICE.ramDamage);
    player.car.speed *= 0.5;
    audio.crash();
  }
  if (policeResult.busted) {
    busted();
  } else if (player.health <= 0) {
    wasted();
  }

  // Dead-drop markers vanish as she picks them up.
  if (collectMarkers.length > 0) {
    for (let i = collectMarkers.length - 1; i >= 0; i--) {
      const m = collectMarkers[i];
      if (Math.hypot(m.position.x - player.x, m.position.z - player.z) < 6) {
        scene.remove(m);
        collectMarkers.splice(i, 1);
      }
    }
  }

  missions.update(dt, player);
  city.pulseBeacon(dt);
  updateJobMarker();
  updateCamera(dt, false);
  syncHud();
}

// ---------------------------------------------------------------- frame

function liveControl() {
  const acts = input.takeActions();
  return {
    forward: input.forward(),
    back: input.back(),
    left: input.left(),
    right: input.right(),
    run: input.run(),
    handbrake: input.handbrake(),
    interact: !!(acts & ACTION_INTERACT),
    attack: !!(acts & ACTION_ATTACK) || input.mouseDown(),
    pause: !!(acts & ACTION_PAUSE),
    mute: !!(acts & ACTION_MUTE),
    drag: input.takeDrag(),
  };
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;

  if (screen === 'menu') {
    menuAngle += dt * 0.03;
    camera.position.set(Math.cos(menuAngle) * 180, 90, 20 + Math.sin(menuAngle) * 180);
    camera.lookAt(0, 0, 20);
    renderer.render(scene, camera);
    return;
  }

  const ctl = liveControl();
  if (ctl.mute) audio.setMuted(!audio.isMuted());
  if (ctl.pause) {
    if (screen === 'playing') {
      screen = 'paused';
      hud.showPaused(true);
      saveGame();
    } else if (screen === 'paused') {
      screen = 'playing';
      hud.showPaused(false);
    }
  }

  if (screen === 'playing' && !frozen) {
    stepSim(dt, ctl);
    renderer.render(scene, camera);
  } else if (screen === 'paused') {
    renderer.render(scene, camera);
  }
  // Frozen while playing: the loop renders nothing. renderOnce() owns
  // the frame, so a staged shot stays exactly as staged.
}

// ---------------------------------------------------------------- prompt

// The prompt line is refreshed from the live frame, not from stepSim, so
// it also answers while the game is frozen for a screenshot.
function refreshPrompt() {
  if (screen !== 'playing') {
    hud.prompt(null);
    return;
  }
  if (player.inCar) {
    hud.prompt('E — Get out of the car');
    return;
  }
  const car = nearestEnterableCar();
  if (car) {
    hud.prompt(car.missionCar ? 'E — Steal the car' : car.isPolice ? 'E — Steal the police car' : 'E — Get in the car');
    return;
  }
  if (!missions.isActive()) {
    const target = jobMarkerTarget();
    if (target && Math.hypot(target.x - player.x, target.z - player.z) < 6) {
      hud.prompt('E — Start job');
      return;
    }
  }
  hud.prompt(null);
}
window.setInterval(refreshPrompt, 150);

// ---------------------------------------------------------------- public API

const api = {
  player,
  police,
  missions,
  combat,
  traffic,
  pedestrians: peds,
  city,
  setTime(hours) {
    timeSeconds = (((hours - 9) % 24) + 24) % 24 * 3600;
  },
  setCamera(azimuth, elevation, distance) {
    cameraOverride = { azimuth, elevation, distance };
  },
    setCameraLookAt(cx, cy, cz, tx, ty, tz) {
      camera.position.set(cx, cy, cz);
      camera.lookAt(tx, ty, tz);
    },
    heliPos() {
      return police.heliPosition ? police.heliPosition() : null;
    },
  placePlayer(x, z, heading) {
    player.x = x;
    player.z = z;
    if (heading !== undefined) player.heading = heading;
    if (player.inCar && player.car) player.car.place(x, z, heading);
    syncPlayerMesh();
  },
  driveCar(kind, color) {
    if (player.inCar && player.car) {
      player.car.occupied = false;
      player.car.parked = true;
      player.car = null;
      player.carKind = null;
      player.inCar = false;
    }
    const car = new Car(scene, {
      kind: kind || randomKind(rng),
      color: color !== undefined ? color : randomCarColor(rng),
      x: player.x,
      z: player.z,
      heading: player.heading,
    });
    traffic.cars.push(car);
    player.car = car;
    player.carKind = car.tune;
    player.inCar = true;
    car.occupied = true;
    car.parked = false;
    car.stolen = false;
    return car;
  },
  setWanted(n) {
    const cur = police.wantedCount();
    if (n > cur) {
      police.addStars(n - cur);
    } else if (n < cur) {
      police.clearWanted();
      if (n > 0) police.addStars(n);
    }
  },
  startMissionAt(i) {
    if (screen === 'menu') {
      mode = 'story';
      screen = 'playing';
      hud.showMenu(false);
      audio.unlock();
    }
    beginMission(i);
  },
  spawnEnemiesAt(x, z, count) {
    combat.spawnEnemies(x, z, count);
  },
  setFrozen(b) {
    frozen = !!b;
  },
  advance(dt, keys) {
    const ctl = {
      forward: !!(keys && keys.forward),
      back: !!(keys && keys.back),
      left: !!(keys && keys.left),
      right: !!(keys && keys.right),
      run: !!(keys && keys.run),
      handbrake: !!(keys && keys.handbrake),
      interact: !!(keys && keys.interact),
      attack: !!(keys && keys.attack),
      drag: 0,
    };
    stepSim(dt, ctl);
  },
  renderOnce() {
    updateCamera(1, true);
    renderer.render(scene, camera);
  },
  drawMinimap() {
    hud.drawMinimap(minimapData());
  },
  state() {
    const car = player.inCar ? player.car : null;
    return {
      screen,
      x: player.x,
      z: player.z,
      heading: player.heading,
      health: player.health,
      cash: player.cash,
      inCar: player.inCar,
      carKind: player.carKind,
      carDamage: car ? Math.round(car.damage) : 0,
      carTopSpeed: car ? Math.round(car.topSpeed()) : 0,
      smokePuffs: totalSmokePuffs,
      heli: police.heliActive(),
      wanted: police.wantedCount(),
      missionActive: missions.isActive(),
      mission: missions.isActive() ? missions.currentDef().name : missions.state(),
      objective: missions.objectiveText(),
      enemiesLeft: combat.enemiesLeft(),
      enemyPositions: combat.enemyPositions(),
      trafficCars: traffic.cars.length,
      pedsUp: peds.countUp(),
      policeCars: police.cars.length,
    };
  },
};
Object.defineProperty(api, 'screen', { get: () => screen });
Object.defineProperty(api, 'timeSeconds', { get: () => timeSeconds });
Object.defineProperty(api, 'sunIntensity', { get: () => sunIntensity });
Object.defineProperty(api, 'skyColor', { get: () => skyColor });
window.__solmar = api;

// ---------------------------------------------------------------- go

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

{
  const save = readSave();
  hud.showMenu(true, !!save);
  screen = 'menu';
  syncPlayerMesh();
  syncHud();
  requestAnimationFrame(frame);
  // A ?shot=name URL stages one screenshot hands-free: start roaming,
  // freeze the frame, and let shots.js place the camera.
  const shotName = new URLSearchParams(window.location.search).get('shot');
  if (shotName) {
    window.setTimeout(() => {
      startFreeRoam();
      api.setFrozen(true);
      stageShot(api, shotName, { hud });
    }, 600);
  }
}
