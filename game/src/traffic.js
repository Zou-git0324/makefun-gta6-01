// Solmar Bay — traffic: the cars that drive the city on their own.
// Fourteen of them cruise the road grid, turn at intersections and stay on
// the asphalt. Missions also ask traffic for parked cars (the taxi to take,
// the coupe to steal) and for the car the player is dropped into.

import { TRAFFIC } from './config.js';
import { Car, randomCarColor, randomKind } from './vehicles.js';

export function createTraffic(scene, city, rng) {
  const cars = [];
  const roads = city.roads;
  const half = city.bounds.maxX;

  // One AI driver per car: which road line it follows, which way, how fast.
  function giveDriver(car) {
    const alongX = rng.next() < 0.5;
    const line = rng.pick(roads);
    car.ai = {
      axis: alongX ? 'x' : 'z',
      line,
      dir: rng.next() < 0.5 ? 1 : -1,
      cruise: rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax),
      turnedAt: null,
    };
    if (alongX) {
      car.z = line;
      car.x = rng.range(-half + 20, half - 20);
      car.heading = car.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = line;
      car.z = rng.range(-half + 20, city.bounds.maxZ - 20);
      car.heading = car.ai.dir > 0 ? 0 : Math.PI;
    }
    car.speed = car.ai.cruise;
    car.syncMesh();
  }

  function addCar(kind, x, z, heading, opts = {}) {
    const car = new Car(scene, kind, x, z, heading, {
      ...opts,
      rng,
      color: opts.color !== undefined ? opts.color : randomCarColor(rng),
    });
    cars.push(car);
    return car;
  }

  // The daily traffic: parked nowhere, always moving.
  for (let i = 0; i < TRAFFIC.count; i++) {
    const kind = randomKind(rng);
    const car = addCar(kind, 0, 0, 0);
    giveDriver(car);
  }

  function nearestFreeCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist === undefined ? Infinity : maxDist;
    for (const car of cars) {
      if (car.occupied || car.crashed) continue;
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
    car.dispose();
  }

  // A car that waits where a mission put it: taxi for the first fare, the
  // sports car for the getaway, the coupe for the big score.
  function addParkedCar(kind, x, z, opts = {}) {
    const headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const heading = opts.heading !== undefined ? opts.heading : headings[Math.floor(rng.next() * headings.length)];
    const car = addCar(kind, x, z, heading, { ...opts, parked: true });
    car.speed = 0;
    return car;
  }

  // A fresh car under the player, used by the drive helper and by tests.
  function spawnCar(kind, x, z, heading) {
    const car = addCar(kind, x, z, heading === undefined ? 0 : heading);
    car.speed = 0;
    return car;
  }

  // Step the traffic. The player position is passed the way the other
  // steppers take it (dt, x, z); traffic does not need it to drive, but
  // the caller passes it anyway so every stepper is called the same way.
  function step(dt, _px, _pz) {
    for (const car of cars) {
      if (car.parked || car.occupied) {
        car.updateSmoke(dt);
        car.roll(0);
        continue;
      }
      const ai = car.ai;
      if (!ai) {
        car.updateSmoke(dt);
        car.roll(dt);
        continue;
      }
      // Cruise along the current road line.
      if (ai.axis === 'x') {
        car.x += ai.dir * ai.cruise * dt;
        car.z = ai.line;
        car.heading = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.z += ai.dir * ai.cruise * dt;
        car.x = ai.line;
        car.heading = ai.dir > 0 ? 0 : Math.PI;
      }
      car.speed = ai.cruise;
      // At an intersection, sometimes turn onto the crossing road.
      const along = ai.axis === 'x' ? car.x : car.z;
      let nearestLine = null;
      let nearestD = Infinity;
      for (const line of roads) {
        const d = Math.abs(along - line);
        if (d < nearestD) {
          nearestD = d;
          nearestLine = line;
        }
      }
      if (nearestD < 2 && ai.turnedAt !== nearestLine && rng.next() < 0.35) {
        ai.turnedAt = nearestLine;
        if (ai.axis === 'x') {
          ai.axis = 'z';
          car.x = nearestLine;
          ai.line = nearestLine;
          ai.dir = rng.next() < 0.5 ? 1 : -1;
        } else {
          ai.axis = 'x';
          car.z = nearestLine;
          ai.line = nearestLine;
          ai.dir = rng.next() < 0.5 ? 1 : -1;
        }
      } else if (nearestD > 6) {
        ai.turnedAt = null;
      }
      // Never leave the city: turn around at the edge.
      if (car.x > half - 8 || car.x < -half + 8 || car.z > city.bounds.maxZ - 8 || car.z < -half + 8) {
        ai.dir *= -1;
        if (ai.axis === 'x') car.x = Math.max(-half + 10, Math.min(half - 10, car.x));
        else car.z = Math.max(-half + 10, Math.min(city.bounds.maxZ - 10, car.z));
      }
      car.updateSmoke(dt);
      car.roll(dt);
    }
  }

  return { cars, step, nearestFreeCar, removeCar, addParkedCar, spawnCar };
}
