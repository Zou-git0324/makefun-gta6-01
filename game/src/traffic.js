// The city's traffic: cars that loop the blocks on the road grid, slow for the
// car ahead, and honk (visually) when the player blocks them. Each one owns a
// rectangular loop around one block; at every corner it turns onto the next leg.

import { TRAFFIC } from './config.js';
import { Car, randomCarColor } from './vehicles.js';

function loopForBlock(city, rng) {
  const bx = rng.pick(city.blocks);
  const bz = rng.pick(city.blocks);
  const half = 30; // half the pitch: the loop runs on the roads around this block
  const corners = [
    { x: bx - half, z: bz - half },
    { x: bx + half, z: bz - half },
    { x: bx + half, z: bz + half },
    { x: bx - half, z: bz + half },
  ];
  if (rng.chance(0.5)) corners.reverse();
  return corners;
}

export function createTraffic(scene, city, rng) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const car = new Car(scene, randomCarColor(rng));
    const loop = loopForBlock(city, rng);
    const corner = loop[Math.floor(rng.next() * loop.length)];
    car.place(corner.x, corner.z, rng.next() * Math.PI * 2);
    cars.push({
      car,
      loop,
      leg: 0,
      speed: rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax),
      stuck: 0,
    });
  }

  function distanceTo(other, x, z) {
    const dx = other.car.x - x;
    const dz = other.car.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function step(dt, playerCar, playerPos) {
    for (const entry of cars) {
      const { car, loop } = entry;
      if (car.occupied) continue; // the player is driving this one
      const target = loop[(entry.leg + 1) % loop.length];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 3) {
        entry.leg = (entry.leg + 1) % loop.length;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      // Slow down for the car ahead on the same leg.
      let ahead = false;
      for (const other of cars) {
        if (other === entry || other.car.occupied) continue;
        const fwd = car.forwardVector();
        const ox = other.car.x - car.x;
        const oz = other.car.z - car.z;
        const along = ox * fwd.x + oz * fwd.z;
        const side = Math.abs(ox * fwd.z - oz * fwd.x);
        if (along > 0 && along < 9 && side < 2.4) { ahead = true; break; }
      }
      // And for the player's car or the player on foot, right in front.
      const px = playerCar ? playerCar.x : playerPos.x;
      const pz = playerCar ? playerCar.z : playerPos.z;
      const fwd = car.forwardVector();
      const ox = px - car.x;
      const oz = pz - car.z;
      const along = ox * fwd.x + oz * fwd.z;
      const side = Math.abs(ox * fwd.z - oz * fwd.x);
      if (along > 0 && along < 8 && side < 2.2) ahead = true;

      const speed = ahead ? entry.speed * 0.15 : entry.speed;
      car.x += fwd.x * speed * dt;
      car.z += fwd.z * speed * dt;
      car.sync();
    }
  }

  function nearestFreeCar(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const entry of cars) {
      if (entry.car.occupied) continue;
      const d = distanceTo(entry, x, z);
      if (d < bestDist) { bestDist = d; best = entry.car; }
    }
    return best;
  }

  function removeCar(car) {
    const index = cars.findIndex((entry) => entry.car === car);
    if (index >= 0) cars.splice(index, 1);
  }

  return { cars, step, nearestFreeCar, removeCar };
}
