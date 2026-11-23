// Solmar Bay — police: the wanted level, the pursuit cars and the helicopter.
// One pursuit car per star, up to five. At four stars the helicopter comes
// up with its spotlight and rotor, orbits the player and shows on the
// minimap. Stars decay when the player stays clean.

import { POLICE, WANTED } from './config.js';
import { Car } from './vehicles.js';

function buildHeliMesh() {
  const group = new THREE.Group();
  group.name = 'policeHeli';
  const navy = new THREE.MeshLambertMaterial({ color: 0x2b4a6b });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f3f4 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 3.4), navy);
  body.name = 'heliBody';
  body.position.y = 0;
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.35, 3.0), white);
  stripe.name = 'heliStripe';
  stripe.position.y = 0.1;
  group.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.6), navy);
  tail.name = 'heliTail';
  tail.position.set(0, 0.25, -2.8);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.7), navy);
  fin.name = 'heliFin';
  fin.position.set(0, 0.7, -3.9);
  group.add(fin);
  // The rotor: a long thin blade pair on a mast, spinning every frame.
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  rotor.position.y = 0.85;
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.07, 0.4), bladeMat);
  blade1.name = 'rotorBlade';
  rotor.add(blade1);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 7.5), bladeMat);
  blade2.name = 'rotorBladeCross';
  rotor.add(blade2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), dark);
  mast.name = 'rotorMast';
  mast.position.y = -0.2;
  rotor.add(mast);
  group.add(rotor);
  // The spotlight: a translucent cone hanging under the helicopter, apex
  // at the belly, widening toward the ground.
  const coneMat = new THREE.MeshLambertMaterial({
    color: 0xfff6c9, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 9, 16, 1, true), coneMat);
  cone.name = 'spotlight';
  cone.rotation.x = Math.PI;
  cone.position.y = -5.2;
  group.add(cone);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshLambertMaterial({ color: 0xfff6c9 }));
  lamp.name = 'spotLamp';
  lamp.position.y = -0.7;
  group.add(lamp);
  return group;
}

export function createPolice(scene, city, rng, audio) {
  let wanted = 0;
  let decayTimer = 0;
  const cars = [];
  let heli = null;
  let heliAngle = 0;

  function siren() {
    if (audio && typeof audio.setSiren === 'function') audio.setSiren(wanted > 0);
  }

  function spawnSpotNear(px, pz) {
    for (let tries = 0; tries < 8; tries++) {
      const p = city.randomRoadPoint(rng);
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d > 35 && d < 120) return p;
    }
    return city.randomRoadPoint(rng);
  }

  function addStars(n) {
    if (n <= 0) return;
    wanted = Math.min(WANTED.maxStars, wanted + n);
    decayTimer = 0;
    siren();
  }

  function removeCar(car) {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    car.dispose();
  }

  function clearHeli() {
    if (heli) {
      scene.remove(heli);
      heli = null;
    }
  }

  function clearWanted() {
    wanted = 0;
    decayTimer = 0;
    while (cars.length) removeCar(cars[0]);
    clearHeli();
    siren();
  }

  // One step of the pursuit. Returns the ram damage dealt to the player
  // this step (0 when no police car made contact). The caller decides what
  // the damage hits: the car when the player is driving (inCar), the
  // player's health when on foot. The bust itself is the caller's call
  // too — it watches policePositions and the player's speed.
  function step(dt, px, pz, inCar) {
    let ramDamage = 0;
    if (wanted > 0) {
      decayTimer += dt;
      if (decayTimer >= WANTED.decaySeconds) {
        decayTimer = 0;
        wanted -= 1;
        if (wanted === 0) {
          while (cars.length) removeCar(cars[0]);
          clearHeli();
          siren();
          return 0;
        }
      }
    }
    const target = Math.min(POLICE.maxCars, POLICE.baseCars + wanted * POLICE.carsPerStar);
    while (cars.length < target) {
      const spot = spawnSpotNear(px, pz);
      const car = new Car(scene, 'sedan', spot.x, spot.z, 0, { police: true, rng });
      car.ramTimer = 0;
      car.backoff = 0;
      cars.push(car);
    }
    while (cars.length > target) removeCar(cars[cars.length - 1]);

    for (const car of cars) {
      const dx = px - car.x;
      const dz = pz - car.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const turn = Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      car.heading += turn;
      if (car.backoff > 0) {
        car.backoff -= dt;
        car.speed = -8;
      } else if (dist > 4) {
        car.speed = POLICE.speed;
      } else {
        car.speed = Math.max(0, POLICE.speed * (dist / 10));
      }
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const pushed = city.collideCircle(car.x, car.z, 2.2);
      if (pushed) {
        car.x = pushed.x;
        car.z = pushed.z;
      }
      if (car.ramTimer > 0) car.ramTimer -= dt;
      if (dist < 3.4 && car.ramTimer <= 0) {
        car.ramTimer = 1.2;
        car.backoff = 0.7;
        ramDamage += POLICE.ramDamage;
      }
      car.updateSmoke(dt);
      car.roll(dt);
    }
    // Keep pursuit cars from stacking on top of each other.
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 4) {
          const push = (4 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
        }
      }
    }

    // The helicopter: up at four stars, gone below them.
    if (wanted >= POLICE.heliAtStars) {
      if (!heli) {
        heli = buildHeliMesh();
        scene.add(heli);
      }
      heliAngle += dt * 0.22;
      const hx = px + Math.cos(heliAngle) * POLICE.heliOrbit;
      const hz = pz + Math.sin(heliAngle) * POLICE.heliOrbit;
      heli.position.set(hx, POLICE.heliHeight, hz);
      heli.lookAt(px, 0, pz);
      const rotor = heli.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 22;
    } else if (heli) {
      clearHeli();
    }
    return ramDamage;
  }

  function wantedCount() {
    return wanted;
  }

  function isSirenOn() {
    return wanted > 0;
  }

  function policePositions() {
    const out = cars.map((c) => ({ x: c.x, z: c.z }));
    if (heli) out.push({ x: heli.position.x, z: heli.position.z, heli: true });
    return out;
  }

  function heliActive() {
    return !!heli;
  }

  function heliPosition() {
    if (!heli) return null;
    return { x: heli.position.x, y: heli.position.y, z: heli.position.z };
  }

  return {
    wantedCount, addStars, clearWanted, step, isSirenOn,
    policePositions, heliActive, heliPosition, cars,
  };
}
