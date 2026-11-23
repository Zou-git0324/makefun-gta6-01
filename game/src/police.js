// The wanted system and the Solmar Bay Police Department. Stars rise when the
// player commits crimes and fade after a clean stretch; police cars spawn at
// the city edge, chase, ram, and bust the player when they pin them down.

import { PALETTE, POLICE, WANTED } from './config.js';
import { Car } from './vehicles.js';

const THREE = window.THREE;

export function createPolice(scene, city, rng) {
  let stars = 0;
  let cleanTimer = 0;
  let bustTimer = 0;
  let sirenOn = false;
  let heliAngle = 0;
  const cars = [];

  // The SBPD helicopter: body, tail, spinning main rotor and a searchlight
  // cone that tracks the player. It only flies at four stars and up.
  const heli = new THREE.Group();
  const heliBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.4, 4.2),
    new THREE.MeshLambertMaterial({ color: 0x1c2f6e }),
  );
  heliBody.castShadow = true;
  heli.add(heliBody);
  const heliTail = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 3.4),
    new THREE.MeshLambertMaterial({ color: 0x1c2f6e }),
  );
  heliTail.position.set(0, 0.2, -3.6);
  heli.add(heliTail);
  const heliGlass = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.7, 1.2),
    new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }),
  );
  heliGlass.position.set(0, 0.3, 1.8);
  heli.add(heliGlass);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.08, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x222222 }),
  );
  rotor.position.y = 1.0;
  heli.add(rotor);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(7, POLICE.heliHeight, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  heli.add(beam);
  heli.visible = false;
  scene.add(heli);

  function heliActive() {
    return heli.visible;
  }

  function stepHeli(dt, playerPos, timeSeconds) {
    if (stars < POLICE.heliAtStars) {
      heli.visible = false;
      return;
    }
    heli.visible = true;
    heliAngle += dt * 0.35;
    const hx = playerPos.x + Math.cos(heliAngle) * POLICE.heliOrbit;
    const hz = playerPos.z + Math.sin(heliAngle) * POLICE.heliOrbit;
    heli.position.set(hx, POLICE.heliHeight, hz);
    heli.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
    rotor.rotation.y += dt * 28;
    // The searchlight cone hangs from the heli down to the player: its apex
    // sits at the heli, its base opens on the ground below.
    beam.position.set(0, -POLICE.heliHeight / 2, 0);
    beam.material.opacity = 0.10 + Math.sin(timeSeconds * 2) * 0.03;
  }

  function wantedCount() {
    return stars;
  }

  function addStars(n, reason) {
    const before = stars;
    stars = Math.min(WANTED.maxStars, stars + n);
    cleanTimer = 0;
    if (stars > before) return { rose: true, stars, reason };
    return { rose: false, stars, reason };
  }

  function clearWanted() {
    stars = 0;
    cleanTimer = 0;
    bustTimer = 0;
    heli.visible = false;
    for (const car of cars) scene.remove(car.mesh);
    cars.length = 0;
  }

  function spawnPointNear(playerPos) {
    // Pick a road point 60–90 m from the player, on the side facing the centre.
    for (let tries = 0; tries < 12; tries += 1) {
      const spot = city.randomRoadPoint(rng);
      const dx = spot.x - playerPos.x;
      const dz = spot.z - playerPos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 55 && d < 110) return spot;
    }
    return { x: playerPos.x + 70, z: playerPos.z };
  }

  function ensureCars(playerPos) {
    const want = stars === 0 ? 0 : Math.min(POLICE.maxCars, POLICE.baseCars + (stars - 1) * POLICE.carsPerStar);
    while (cars.length < want) {
      const spot = spawnPointNear(playerPos);
      const car = new Car(scene, PALETTE.police, { police: true, kind: 'police' });
      car.place(spot.x, spot.z, Math.atan2(playerPos.x - spot.x, playerPos.z - spot.z));
      cars.push(car);
    }
    while (cars.length > want) {
      const car = cars.pop();
      scene.remove(car.mesh);
    }
  }

  /**
   * One step. Returns an event object the game reacts to: `busted` when the
   * police pin the player, `starFaded` when a star decays away.
   */
  function step(dt, playerPos, playerSpeed, inCar, timeSeconds = 0) {
    const events = { busted: false, starFaded: false, rammed: false, rammedCar: false };
    if (stars === 0) {
      sirenOn = false;
      heli.visible = false;
      if (cars.length) ensureCars(playerPos);
      return events;
    }
    sirenOn = true;
    stepHeli(dt, playerPos, timeSeconds);
    cleanTimer += dt;
    if (cleanTimer >= WANTED.decaySeconds) {
      cleanTimer = 0;
      stars -= 1;
      events.starFaded = true;
      if (stars === 0) { clearWanted(); return events; }
    }
    ensureCars(playerPos);

    let nearest = Infinity;
    for (const car of cars) {
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      nearest = Math.min(nearest, dist);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const speed = dist > 14 ? POLICE.speed + stars * 1.5 : POLICE.speed * 0.55;
      const fwd = car.forwardVector();
      const nx = car.x + fwd.x * speed * dt;
      const nz = car.z + fwd.z * speed * dt;
      const fixed = city.collideCircle(nx, nz, 1.35);
      car.x = fixed.x;
      car.z = fixed.z;
      car.speed = speed;
      car.sync();
      // Flashing light bar: red / blue, twice a second, so a chase reads at a glance.
      if (car.mesh.userData.bar) {
        car.mesh.userData.bar.material.color.setHex(Math.floor(timeSeconds * 2) % 2 === 0 ? 0xff2a2a : 0x2244ff);
      }
      // PIT manoeuvre: ramming the player's car shoves it and slows it down.
      if (dist < 3.4 && inCar) {
        events.rammedCar = true;
      }
      // Ramming the player on foot hurts; ramming their car shakes it.
      if (dist < 2.6 && !inCar) {
        events.rammed = true;
      }
    }

    if (nearest < WANTED.bustDistance && playerSpeed < 2.5) {
      bustTimer += dt;
      if (bustTimer >= WANTED.bustStillSeconds) {
        events.busted = true;
        bustTimer = 0;
      }
    } else {
      bustTimer = 0;
    }
    return events;
  }

  function isSirenOn() {
    return sirenOn;
  }

  function policePositions() {
    const spots = cars.map((car) => ({ x: car.x, z: car.z }));
    if (heli.visible) spots.push({ x: heli.position.x, z: heli.position.z, heli: true });
    return spots;
  }

  return { wantedCount, addStars, clearWanted, step, isSirenOn, policePositions, heliActive, cars };
}
