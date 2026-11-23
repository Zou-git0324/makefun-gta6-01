// Solmar Bay — vehicles: car meshes, the Car class, damage and smoke.
// Every car in the city, parked or driven, is one of these. The five kinds
// have different bodies, different handling and different top speeds; the
// sports car is the only one with a spoiler.

import { CAR, CAR_DAMAGE, CAR_KINDS, PALETTE } from './config.js';

// Body dimensions per kind: [width, height, length] in metres, plus the
// cabin box [width, height, length, z-offset]. A van is one tall box.
const KIND_DIMS = {
  sedan: { body: [2.0, 0.75, 4.4], cabin: [1.7, 0.65, 2.2, -0.2] },
  sports: { body: [1.9, 0.6, 4.3], cabin: [1.6, 0.55, 1.7, -0.3] },
  coupe: { body: [1.9, 0.7, 3.9], cabin: [1.6, 0.6, 1.6, -0.1] },
  van: { body: [2.1, 1.9, 5.0], cabin: null },
  taxi: { body: [2.0, 0.75, 4.4], cabin: [1.7, 0.65, 2.2, -0.2] },
};

const PAINTS = [
  0xc0392b, 0x2471a3, 0x7d3c98, 0x1e8449, 0xb7950b,
  0x5d6d7e, 0x2c3e50, 0xd5dbdb, 0x922b21, 0x148f77,
];

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function box(w, h, d, material, x, y, z, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  if (name) mesh.name = name;
  return mesh;
}

// Build the visible mesh for one car. Front of the car is +z, so a mesh
// with rotation.y = heading drives toward (sin heading, cos heading).
export function makeCarMesh(kind, colorHex, opts = {}) {
  const dims = KIND_DIMS[kind] || KIND_DIMS.sedan;
  const group = new THREE.Group();
  group.name = 'car-' + kind;
  const paint = colorHex !== undefined ? colorHex : 0x888888;
  const bodyMat = lambert(paint);
  const [bw, bh, bl] = dims.body;
  const body = box(bw, bh, bl, bodyMat, 0, 0.55 + bh / 2 - 0.35, 0, 'body');
  group.add(body);
  if (dims.cabin) {
    const [cw, ch, cl, cz] = dims.cabin;
    const cabin = box(cw, ch, cl, lambert(0x1a2530), 0, 0.55 + bh + ch / 2 - 0.35, cz, 'cabin');
    group.add(cabin);
  }
  if (kind === 'van') {
    // Tall windshield band at the front so the van reads as one vehicle.
    const shield = box(bw - 0.3, 0.7, 0.15, lambert(0x1a2530), 0, 1.45, bl / 2 - 0.1, 'windshield');
    group.add(shield);
  }
  if (kind === 'sports') {
    // The spoiler: a flat wing on two struts at the rear of the car.
    const strutMat = lambert(0x222222);
    group.add(box(0.08, 0.28, 0.08, strutMat, -0.6, 1.0, -bl / 2 + 0.25));
    group.add(box(0.08, 0.28, 0.08, strutMat, 0.6, 1.0, -bl / 2 + 0.25));
    const wing = box(1.7, 0.06, 0.45, lambert(paint), 0, 1.16, -bl / 2 + 0.25, 'spoiler');
    group.add(wing);
  }
  if (kind === 'taxi' || opts.taxi) {
    const sign = box(0.9, 0.28, 0.4, lambert(0xfff6c9), 0, 1.55, -0.2, 'taxiSign');
    group.add(sign);
  }
  if (opts.police) {
    // White doors and a red/blue light bar on the roof.
    const door = box(bw + 0.02, 0.5, 2.0, lambert(0xf2f3f4), 0, 0.75, 0, 'policeDoors');
    group.add(door);
    const bar = box(1.1, 0.16, 0.3, lambert(0x222222), 0, 1.5, -0.2, 'lightbar');
    group.add(bar);
    group.add(box(0.5, 0.18, 0.32, lambert(0xff2222), -0.28, 1.5, -0.2, 'lightRed'));
    group.add(box(0.5, 0.18, 0.32, lambert(0x2244ff), 0.28, 1.5, -0.2, 'lightBlue'));
  }
  // Headlights and taillights.
  const headMat = lambert(0xfff8d6);
  const tailMat = lambert(0xcc2222);
  group.add(box(0.35, 0.18, 0.06, headMat, -bw / 2 + 0.3, 0.72, bl / 2 + 0.01, 'headlightL'));
  group.add(box(0.35, 0.18, 0.06, headMat, bw / 2 - 0.3, 0.72, bl / 2 + 0.01, 'headlightR'));
  group.add(box(0.35, 0.16, 0.06, tailMat, -bw / 2 + 0.3, 0.72, -bl / 2 - 0.01, 'taillightL'));
  group.add(box(0.35, 0.16, 0.06, tailMat, bw / 2 - 0.3, 0.72, -bl / 2 - 0.01, 'taillightR'));
  // Wheels: a pivot group per wheel so the tyre can spin around its axle.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = lambert(0x181818);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8);
  const hubMat = lambert(0xbbbbbb);
  const wheelX = bw / 2 - 0.05;
  const wheelZ = bl / 2 - 0.85;
  for (const [wx, wz] of [[-wheelX, wheelZ], [wheelX, wheelZ], [-wheelX, -wheelZ], [wheelX, -wheelZ]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    pivot.name = 'wheelPivot';
    const tyre = new THREE.Mesh(wheelGeo, wheelMat);
    tyre.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    pivot.add(tyre);
    pivot.add(hub);
    group.add(pivot);
    wheels.push(pivot);
  }
  group.userData.wheels = wheels;
  return group;
}

export function randomCarColor(rng) {
  if (rng && typeof rng.pick === 'function') return rng.pick(PAINTS);
  return PAINTS[Math.floor(Math.random() * PAINTS.length)];
}

export function randomKind(rng) {
  const kinds = Object.keys(CAR_KINDS);
  if (rng && typeof rng.pick === 'function') return rng.pick(kinds);
  return kinds[Math.floor(Math.random() * kinds.length)];
}

export class Car {
  constructor(scene, kind, x, z, heading, opts = {}) {
    this.scene = scene;
    this.kind = kind;
    this.tune = CAR_KINDS[kind] || {};
    this.x = x;
    this.z = z;
    this.heading = heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.occupied = false;
    this.stolen = false;
    this.parked = !!opts.parked;
    this.crashed = false;
    this.damage = 0;
    this.smokeTimer = 0;
    this.smoke = false;
    this.smokePuffs = 0;
    this.crashCooldown = 0;
    this.puffs = [];
    this.isPolice = !!opts.police;
    this.isTaxi = kind === 'taxi' || !!opts.taxi;
    const color = this.isPolice
      ? PALETTE.police
      : this.isTaxi
        ? PALETTE.taxi
        : opts.color !== undefined
          ? opts.color
          : randomCarColor(opts.rng);
    this.mesh = makeCarMesh(kind, color, { police: this.isPolice, taxi: this.isTaxi });
    this.wheels = this.mesh.userData.wheels;
    this.syncMesh();
    scene.add(this.mesh);
  }

  // Top speed right now: damage eats up to half of it.
  effectiveTopSpeed() {
    const base = this.tune.topSpeed || CAR.maxSpeed;
    return base * (1 - CAR_DAMAGE.maxSpeedLoss * Math.min(100, this.damage) / 100);
  }

  applyDamage(amount) {
    if (amount <= 0) return;
    this.damage = Math.min(100, this.damage + amount);
    this.crashed = this.damage > 0;
    if (this.damage > CAR_DAMAGE.smokeAt) this.smoke = true;
  }

  // Smoke puffs while the car is badly damaged. Capped at six puffs so a
  // wreck never fills the scene.
  updateSmoke(dt) {
    if (this.damage > CAR_DAMAGE.smokeAt) {
      this.smoke = true;
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0 && this.puffs.length < 6) {
        this.smokeTimer = 0.18;
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0x666666, transparent: true, opacity: 0.55 }),
        );
        puff.name = 'smokePuff';
        puff.position.set(this.x - Math.sin(this.heading) * 1.5, 1.2, this.z - Math.cos(this.heading) * 1.5);
        puff.userData.life = 1.2;
        this.scene.add(puff);
        this.puffs.push(puff);
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      puff.userData.life -= dt;
      puff.position.y += dt * 1.5;
      puff.scale.setScalar(1 + (1.2 - puff.userData.life) * 0.8);
      puff.material.opacity = Math.max(0, 0.55 * (puff.userData.life / 1.2));
      if (puff.userData.life <= 0) {
        this.scene.remove(puff);
        puff.geometry.dispose();
        puff.material.dispose();
        this.puffs.splice(i, 1);
      }
    }
    this.smokePuffs = this.puffs.length;
    if (this.crashCooldown > 0) this.crashCooldown -= dt;
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  // Spin the wheels to match the road speed, then put the mesh where the
  // car is. Called every frame by whoever drives this car.
  roll(dt) {
    const spin = (this.speed * dt) / 0.36;
    for (const wheel of this.wheels) wheel.rotation.x += spin;
    this.syncMesh();
  }

  dispose() {
    this.scene.remove(this.mesh);
    for (const puff of this.puffs) this.scene.remove(puff);
    this.puffs.length = 0;
  }
}
