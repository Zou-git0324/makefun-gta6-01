// Cars: a box-built body with spinning wheels, and the arcade driving model
// (accelerate, steer, handbrake slide) shared by the player's car, traffic and
// the police. No physics library — the model is small enough to own.

import { CAR, CAR_DAMAGE, CAR_KINDS } from './config.js';

const THREE = window.THREE;

const BODY_COLORS = [0xd84a4a, 0x4a7dd8, 0xe8e8e8, 0x2c2f36, 0x7ab648, 0xd8a04a, 0x8a5ad8, 0x4ad8c8, 0xc8c8c8];

/** The kinds a street car can be; sports cars are rarer than sedans. */
export function randomKind(rng) {
  const roll = rng.next();
  if (roll < 0.22) return 'sports';
  if (roll < 0.42) return 'van';
  return 'sedan';
}

/** Build a car mesh. `opts` picks the paint, taxi sign and police livery. */
export function makeCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2836 });
  const trim = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const kind = opts.kind || 'sedan';
  const sporty = kind === 'sports' || kind === 'coupe';

  // Vans stand tall, sports cars sit low with a spoiler; sedans are the middle.
  const bodyH = kind === 'van' ? 1.1 : sporty ? 0.55 : 0.7;
  const bodyY = kind === 'van' ? 0.8 : sporty ? 0.48 : 0.55;
  const bodyL = kind === 'van' ? 4.6 : 4.4;
  const cabinH = kind === 'van' ? 0.85 : sporty ? 0.45 : 0.6;
  const cabinY = kind === 'van' ? 1.65 : sporty ? 0.95 : 1.15;
  const cabinL = kind === 'van' ? 2.8 : sporty ? 2.0 : 2.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, bodyH, bodyL), paint);
  body.position.y = bodyY;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, cabinH, cabinL), glass);
  cabin.position.set(0, cabinY, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (sporty) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), trim);
    spoiler.position.set(0, 0.95, -2.1);
    group.add(spoiler);
    for (const sx of [-0.8, 0.8]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), trim);
      strut.position.set(sx, 0.82, -2.1);
      group.add(strut);
    }
  }
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.25, 0.3), trim);
  bumperF.position.set(0, 0.35, 2.2);
  group.add(bumperF);
  const bumperB = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.25, 0.3), trim);
  bumperB.position.set(0, 0.35, -2.2);
  group.add(bumperB);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    head.position.set(sx, 0.65, 2.26);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    tail.position.set(sx, 0.65, -2.26);
    group.add(tail);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffc93c }),
    );
    sign.position.set(0, 1.6, -0.2);
    group.add(sign);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    group.userData.bar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

export function randomCarColor(rng) {
  return BODY_COLORS[Math.floor(rng.next() * BODY_COLORS.length)];
}

/**
 * One drivable car. `drive` takes the frame's inputs and the collision helper;
 * it returns how far the car moved, so the caller can score crashes.
 */
export class Car {
  constructor(scene, color, opts = {}) {
    this.mesh = makeCarMesh(color, opts);
    this.wheels = this.mesh.userData.wheels;
    scene.add(this.mesh);
    this.scene = scene;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.occupied = false;
    this.stolen = false;
    this.isPolice = !!opts.police;
    this.isTaxi = !!opts.taxi;
    this.kind = opts.kind || 'civilian';
    this.tune = CAR_KINDS[this.kind] || CAR_KINDS.sedan;
    this.crashed = 0; // seconds of crash shake left
    this.damage = 0; // 0–100: crashes bend the car, smoke it, slow it down
    this.smokeTimer = 0;
    // A small pool of smoke puffs, recycled while the car is hurt.
    this.smoke = [];
    const puffGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const puffMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.45 });
    for (let i = 0; i < 12; i += 1) {
      const puff = new THREE.Mesh(puffGeo, puffMat.clone());
      puff.visible = false;
      scene.add(puff);
      this.smoke.push({ mesh: puff, life: 0 });
    }
  }

  topSpeed() {
    return this.tune.topSpeed * (1 - CAR_DAMAGE.maxSpeedLoss * (this.damage / 100));
  }

  kindLabel() {
    return this.tune.label;
  }

  place(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016 * 2.6;
    for (const wheel of this.wheels) wheel.rotation.x += spin;
  }

  forwardVector() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  drive(dt, input, collide) {
    const tune = this.tune;
    const grip = input.handbrake ? CAR.handbrakeGrip : tune.grip;
    if (input.forward) this.speed += tune.accel * dt;
    if (input.back) {
      this.speed -= this.speed > 0.5 ? CAR.brake * dt : CAR.reverseAccel * dt;
    }
    if (!input.forward && !input.back) {
      this.speed -= this.speed * 0.8 * dt;
    }
    if (input.handbrake) this.speed -= this.speed * 1.6 * dt;
    this.speed = Math.max(-CAR.maxReverse, Math.min(this.topSpeed(), this.speed));

    const targetSteer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const speedSign = this.speed >= 0 ? 1 : -1;
    this.steer += (targetSteer * CAR.steerAngle - this.steer) * Math.min(1, dt * 8);
    this.heading += (this.steer * this.speed * dt * 0.055) * speedSign * (grip / CAR.grip);

    const fwd = this.forwardVector();
    let nx = this.x + fwd.x * this.speed * dt;
    let nz = this.z + fwd.z * this.speed * dt;
    const before = { x: nx, z: nz };
    const fixed = collide(nx, nz, 1.35);
    nx = fixed.x;
    nz = fixed.z;
    if (Math.abs(before.x - nx) > 0.01 || Math.abs(before.z - nz) > 0.01) {
      if (Math.abs(this.speed) > 6) {
        this.crashed = 0.25;
        this.damage = Math.min(100, this.damage + Math.abs(this.speed) * CAR_DAMAGE.crashPerSpeed);
      }
      this.speed *= 0.4;
    }
    this.x = nx;
    this.z = nz;
    if (this.crashed > 0) this.crashed -= dt;
    this.stepSmoke(dt);
    this.sync();
    return Math.abs(this.speed);
  }

  /** Smoke puffs rise from the hood while the car is badly hurt. */
  stepSmoke(dt) {
    if (this.damage > CAR_DAMAGE.smokeAt && Math.abs(this.speed) > 1) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.14;
        const puff = this.smoke.find((p) => p.life <= 0);
        if (puff) {
          const fwd = this.forwardVector();
          puff.mesh.position.set(this.x + fwd.x * 1.8, 1.1, this.z + fwd.z * 1.8);
          puff.mesh.visible = true;
          puff.mesh.material.opacity = 0.5;
          puff.mesh.scale.set(1, 1, 1);
          puff.life = 0.9;
        }
      }
    }
    for (const puff of this.smoke) {
      if (puff.life <= 0) continue;
      puff.life -= dt;
      puff.mesh.position.y += dt * 2.2;
      puff.mesh.scale.multiplyScalar(1 + dt * 1.6);
      puff.mesh.material.opacity = Math.max(0, puff.life * 0.55);
      if (puff.life <= 0) puff.mesh.visible = false;
    }
  }
}
