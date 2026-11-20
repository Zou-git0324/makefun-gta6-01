// Pedestrians: small box people who stroll the sidewalks, cross at corners, and
// run away from gunfire, speeding cars and police chases. Hitting one with a
// car is a crime — the wanted system hears about it.

import { PEDESTRIANS } from './config.js';

const THREE = window.THREE;

const SHIRT_COLORS = [0xe84a5f, 0x4a90d8, 0x7ab648, 0xe8b44a, 0x9a6ad8, 0xe8e8e8, 0x4ad8c8, 0xd86aa0];
const PANTS_COLORS = [0x2a3550, 0x3a3a3a, 0x5a4a3a, 0x2a4a3a];

function makePedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({
    color: SHIRT_COLORS[Math.floor(rng.next() * SHIRT_COLORS.length)],
  });
  const pants = new THREE.MeshLambertMaterial({
    color: PANTS_COLORS[Math.floor(rng.next() * PANTS_COLORS.length)],
  });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a080 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.12, 0.36),
    new THREE.MeshLambertMaterial({ color: rng.chance(0.5) ? 0x2a1a12 : 0x6a4a2a }),
  );
  hair.position.y = 1.82;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), pants);
  legL.position.set(-0.14, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), pants);
  legR.position.set(0.14, 0.33, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export function createPedestrians(scene, city, rng) {
  const peds = [];
  for (let i = 0; i < PEDESTRIANS.count; i += 1) {
    const mesh = makePedMesh(rng);
    scene.add(mesh);
    const spot = city.randomSidewalkPoint(rng);
    peds.push({
      mesh,
      x: spot.x,
      z: spot.z,
      heading: rng.next() * Math.PI * 2,
      speed: rng.range(PEDESTRIANS.speedMin, PEDESTRIANS.speedMax),
      target: null,
      flee: 0,
      walkPhase: rng.next() * 6,
      down: false,
    });
  }

  function pickTarget(ped) {
    const spot = city.randomSidewalkPoint(rng);
    ped.target = spot;
  }

  function step(dt, danger, playerPos) {
    for (const ped of peds) {
      if (ped.down) continue;
      // Flee from the danger point (gunfire, a speeding car, a chase).
      const ddx = ped.x - danger.x;
      const ddz = ped.z - danger.z;
      const dangerDist = Math.sqrt(ddx * ddx + ddz * ddz);
      if (danger.active && dangerDist < 18) ped.flee = 1.6;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const len = Math.max(0.01, dangerDist);
        ped.heading = Math.atan2(ddx / len, ddz / len);
        ped.x += Math.sin(ped.heading) * 5.5 * dt;
        ped.z += Math.cos(ped.heading) * 5.5 * dt;
      } else {
        if (!ped.target) pickTarget(ped);
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 1.5) { pickTarget(ped); continue; }
        ped.heading = Math.atan2(dx, dz);
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
      }
      const fixed = city.clampToBounds(ped.x, ped.z, 1);
      ped.x = fixed.x;
      ped.z = fixed.z;
      // Walk-cycle bob and leg swing.
      ped.walkPhase += dt * (ped.flee > 0 ? 14 : 8);
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase)) * 0.05, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  /** The nearest upright pedestrian within `maxDist` of a point. */
  function nearest(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const ped of peds) {
      if (ped.down) continue;
      const dx = ped.x - x;
      const dz = ped.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestDist) { bestDist = d; best = ped; }
    }
    return best;
  }

  /** Knock a pedestrian down (car hit or bullet): they stay down and fade out. */
  function knockDown(ped) {
    ped.down = true;
    ped.mesh.rotation.z = Math.PI / 2;
    ped.mesh.position.y = 0.4;
    window.setTimeout(() => { ped.mesh.visible = false; }, 4000);
  }

  function countUp() {
    return peds.filter((p) => !p.down).length;
  }

  return { peds, step, nearest, knockDown, countUp };
}
