// Police — wanted stars, cruisers, and the helicopter.
//
// Heat is a number from 0 to 5. Each star puts another cruiser on the
// road, and the cruisers hunt Lena: they steer toward her, ram her, and
// bust her if she stands still next to one on foot. Stars fade one at a
// time when she stays out of trouble.
//
// The helicopter is pickier. It only lifts off at four stars, and it only
// stands down once the heat is back down to two — it does not flinch at
// three. While it is up it circles overhead with its spotlight on her,
// and it shows on the minimap.

import { POLICE, WANTED } from './config.js';
import { Car } from './vehicles.js';

export function createPolice(scene, city, rng) {
  let stars = 0;
  let decayTimer = 0;
  let stillTimer = 0;
  let lastX = 0;
  let lastZ = 0;
  const cars = [];

  // Helicopter pieces, built lazily the first time it is needed.
  let heli = null;
  let heliRotor = null;
  let heliPool = null;
  let heliAngle = 0;

  function wantedCount() {
    return stars;
  }

  function addStars(n) {
    if (n <= 0) return;
    stars = Math.min(WANTED.maxStars, stars + n);
    decayTimer = WANTED.decaySeconds;
  }

  function clearWanted() {
    stars = 0;
    decayTimer = 0;
    stillTimer = 0;
    for (const car of cars) scene.remove(car.mesh);
    cars.length = 0;
    removeHeli();
  }

  function isSirenOn() {
    return stars > 0;
  }

  function heliActive() {
    return heli !== null;
  }
  function heliPosition() {
    if (!heli) return null;
    return { x: heli.position.x, y: heli.position.y, z: heli.position.z };
  }

  function policePositions() {
    const out = cars.map((c) => ({ x: c.x, z: c.z }));
    if (heli) out.push({ x: heli.position.x, z: heli.position.z, heli: true });
    return out;
  }

  // A cruiser appears on a road somewhere near the player — close
  // enough to matter, far enough not to spawn on top of her.
  function spawnPoliceCar(px, pz) {
    let pt = city.randomRoadPoint(rng);
    for (let i = 0; i < 10; i++) {
      const c = city.randomRoadPoint(rng);
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d > 60 && d < 150) {
        pt = c;
        break;
      }
    }
    const car = new Car(scene, {
      kind: 'sedan',
      isPolice: true,
      tune: { topSpeed: POLICE.speed },
      x: pt.x,
      z: pt.z,
      heading: rng.range(0, Math.PI * 2),
    });
    cars.push(car);
    return car;
  }

  function buildHeli() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2f57 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 1.4), bodyMat);
    body.castShadow = true;
    group.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4), bodyMat);
    tail.position.set(0, 0.1, -2.4);
    group.add(tail);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.7, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x9fc4d8 }),
    );
    glass.position.set(0, 0.1, 1.2);
    group.add(glass);
    // Main rotor: one long thin blade that spins.
    heliRotor = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.06, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    heliRotor.position.y = 0.85;
    group.add(heliRotor);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), bodyMat);
    mast.position.y = 0.6;
    group.add(mast);
    // The spotlight beam: a translucent cone hanging underneath.
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(7, POLICE.heliHeight, 20, 1, true),
      new THREE.MeshLambertMaterial({
        color: 0xfff6c0,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.y = -POLICE.heliHeight / 2;
    group.add(beam);
    // The pool of light on the ground under the beam.
    heliPool = new THREE.Mesh(
      new THREE.CircleGeometry(7, 20),
      new THREE.MeshBasicMaterial({
        color: 0xfff6c0,
        transparent: true,
        opacity: 0.22,
      }),
    );
    heliPool.rotation.x = -Math.PI / 2;
    heliPool.position.y = -POLICE.heliHeight + 0.3;
    group.add(heliPool);
    group.position.set(0, POLICE.heliHeight, 0);
    scene.add(group);
    heli = group;
    heliAngle = rng.range(0, Math.PI * 2);
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli);
    heli = null;
    heliRotor = null;
    heliPool = null;
  }

  // One simulation step. Returns what happened this step, so the main
  // loop can hurt Lena, shake the camera, or play the busted sting:
  // { busted, starFaded, rammed, rammedCar }.
  function step(dt, playerX, playerZ, inCar) {
    let starFaded = false;

    // Stars cool off one at a time.
    if (stars > 0) {
      decayTimer -= dt;
      if (decayTimer <= 0) {
        stars -= 1;
        starFaded = true;
        decayTimer = WANTED.decaySeconds;
        if (stars === 0) {
          for (const car of cars) scene.remove(car.mesh);
          cars.length = 0;
          removeHeli();
        }
      }
    }

    // Helicopter hysteresis: up at four stars, down at two.
    if (stars >= POLICE.heliAtStars && !heli) buildHeli();
    if (heli && stars <= 2) removeHeli();

    // Match the fleet to the heat.
    const want = stars === 0
      ? 0
      : Math.min(POLICE.maxCars, POLICE.baseCars + POLICE.carsPerStar * stars);
    while (cars.length < want) spawnPoliceCar(playerX, playerZ);
    while (cars.length > want) {
      let idx = cars.length - 1;
      while (idx >= 0 && cars[idx].occupied) idx--;
      if (idx < 0) break;
      const car = cars[idx];
      cars.splice(idx, 1);
      scene.remove(car.mesh);
    }

    let rammed = false;
    let rammedCar = false;
    for (const car of cars) {
      // A cruiser Lena is driving answers to her, not to the chase.
      if (car.occupied) {
        car.sync();
        continue;
      }
      // Steer toward the player, with a limited turn rate so Lena can
      // actually out-drive them.
      const dx = playerX - car.x;
      const dz = playerZ - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      car.speed = POLICE.speed * (dist > 30 ? 1 : 0.85);
      const fwd = car.forwardVector();
      const nx = car.x + fwd.x * car.speed * dt;
      const nz = car.z + fwd.z * car.speed * dt;
      const fixed = city.collideCircle(nx, nz, 2.2);
      car.x = fixed.x;
      car.z = fixed.z;
      car.sync();
      if (dist < 4) {
        if (inCar) rammedCar = true;
        else rammed = true;
      }
    }

    // Busted: on foot, a cruiser right next to her, and she has not
    // moved for a few seconds. Running keeps her free.
    let busted = false;
    const moved = Math.hypot(playerX - lastX, playerZ - lastZ);
    if (!inCar && stars > 0) {
      const near = cars.some(
        (c) => Math.hypot(c.x - playerX, c.z - playerZ) < WANTED.bustDistance,
      );
      if (near && moved < 0.4) {
        stillTimer += dt;
        if (stillTimer > WANTED.bustStillSeconds) busted = true;
      } else {
        stillTimer = 0;
      }
    } else {
      stillTimer = 0;
    }
    lastX = playerX;
    lastZ = playerZ;

    // The helicopter circles the player and keeps its beam on her.
    if (heli) {
      heliAngle += dt * 0.25;
      const hx = playerX + Math.cos(heliAngle) * POLICE.heliOrbit;
      const hz = playerZ + Math.sin(heliAngle) * POLICE.heliOrbit;
      heli.position.set(hx, POLICE.heliHeight, hz);
      heli.rotation.y = -heliAngle;
      if (heliRotor) heliRotor.rotation.y += dt * 25;
      if (heliPool) heliPool.position.set(playerX - hx, -POLICE.heliHeight + 0.3, playerZ - hz);
    }

    return { busted, starFaded, rammed, rammedCar };
  }

  return {
    wantedCount,
    addStars,
    clearWanted,
    step,
    isSirenOn,
    policePositions,
    heliActive,
    heliPosition,
    cars,
  };
}
