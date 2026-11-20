// The wanted system and the Solmar Bay Police Department. Stars rise when the
// player commits crimes and fade after a clean stretch; police cars spawn at
// the city edge, chase, ram, and bust the player when they pin them down.

import { PALETTE, POLICE, WANTED } from './config.js';
import { Car } from './vehicles.js';

export function createPolice(scene, city, rng) {
  let stars = 0;
  let cleanTimer = 0;
  let bustTimer = 0;
  let sirenOn = false;
  const cars = [];

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
  function step(dt, playerPos, playerSpeed, inCar) {
    const events = { busted: false, starFaded: false };
    if (stars === 0) {
      sirenOn = false;
      if (cars.length) ensureCars(playerPos);
      return events;
    }
    sirenOn = true;
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
    return cars.map((car) => ({ x: car.x, z: car.z }));
  }

  return { wantedCount, addStars, clearWanted, step, isSirenOn, policePositions, cars };
}
