// Traffic — the cars that make Solmar Bay feel alive.
//
// A fixed fleet cruises the grid on cardinal headings: north, south,
// east, west, turning at random like drivers who changed their minds.
// Cars the player is driving, and cars parked for a job, are left alone.
// A car that ends up far from the player is quietly respawned closer, so
// the streets around Lena are never empty.

import { TRAFFIC } from './config.js';
import { Car, randomKind, randomCarColor } from './vehicles.js';

export function createTraffic(scene, city, rng) {
  const cars = [];

  // A road point somewhere near (x, z) when one is given.
  function roadPointNear(x, z) {
    let pt = city.randomRoadPoint(rng);
    if (x === undefined) return pt;
    for (let i = 0; i < 8; i++) {
      const c = city.randomRoadPoint(rng);
      if (Math.hypot(c.x - x, c.z - z) < 200) return c;
    }
    return pt;
  }

  function spawnCar(nearX, nearZ) {
    const pt = roadPointNear(nearX, nearZ);
    const car = new Car(scene, {
      kind: randomKind(rng),
      color: randomCarColor(rng),
      x: pt.x,
      z: pt.z,
      heading: Math.floor(rng.range(0, 4)) * Math.PI / 2,
    });
    car.cruise = rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
    car.turnTimer = rng.range(2, 7);
    cars.push(car);
    return car;
  }

  for (let i = 0; i < TRAFFIC.count; i++) spawnCar();

  // True when a coordinate sits on a cross street, so a turn happens
  // at an intersection instead of in the middle of a block.
  function nearCrossStreet(v) {
    for (const r of city.roads) {
      if (Math.abs(v - r) < 6) return true;
    }
    return false;
  }

  function step(dt, playerX, playerZ) {
    for (const car of cars) {
      // The player's car and parked job cars drive themselves — or not
      // at all. Traffic never touches them.
      if (car.occupied || car.parked) continue;

      car.turnTimer -= dt;
      if (car.turnTimer <= 0) {
        car.turnTimer = rng.range(3, 8);
        // Turning across the grid only makes sense at a crossing: a car
        // running east-west turns where a north-south road meets it.
        const alongX = Math.abs(Math.sin(car.heading)) > 0.5;
        const crossPos = alongX ? car.x : car.z;
        if (rng.chance(0.35) && nearCrossStreet(crossPos)) {
          car.heading += rng.pick([-Math.PI / 2, Math.PI / 2]);
        }
      }

      const fwd = car.forwardVector();
      const nx = car.x + fwd.x * car.cruise * dt;
      const nz = car.z + fwd.z * car.cruise * dt;
      // Buildings push the car back out; a blocked car turns away
      // instead of grinding along the wall forever.
      const fixed = city.collideCircle(nx, nz, 2.2);
      if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) {
        car.heading += Math.PI / 2;
        car.x = fixed.x;
        car.z = fixed.z;
      } else {
        car.x = nx;
        car.z = nz;
      }
      car.sync();

      // Too far from the action: come back near the player.
      if (Math.hypot(car.x - playerX, car.z - playerZ) > 260) {
        const pt = roadPointNear(playerX, playerZ);
        car.place(pt.x, pt.z, Math.floor(rng.range(0, 4)) * Math.PI / 2);
        car.cruise = rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
      }
    }
  }

  // Closest car nobody is driving, within maxDist metres. Null if none.
  function nearestFreeCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.occupied) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function removeCar(car) {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    scene.remove(car.mesh);
  }

  return { cars, step, nearestFreeCar, removeCar };
}
