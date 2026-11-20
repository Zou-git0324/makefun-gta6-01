// Cars: a box-built body with spinning wheels, and the arcade driving model
// (accelerate, steer, handbrake slide) shared by the player's car, traffic and
// the police. No physics library — the model is small enough to own.

import { CAR } from './config.js';

const THREE = window.THREE;

const BODY_COLORS = [0xd84a4a, 0x4a7dd8, 0xe8e8e8, 0x2c2f36, 0x7ab648, 0xd8a04a, 0x8a5ad8, 0x4ad8c8, 0xc8c8c8];

/** Build a car mesh. `opts` picks the paint, taxi sign and police livery. */
export function makeCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2836 });
  const trim = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glass);
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
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
    this.crashed = 0; // seconds of crash shake left
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
    const grip = input.handbrake ? CAR.handbrakeGrip : CAR.grip;
    if (input.forward) this.speed += CAR.accel * dt;
    if (input.back) {
      this.speed -= this.speed > 0.5 ? CAR.brake * dt : CAR.reverseAccel * dt;
    }
    if (!input.forward && !input.back) {
      this.speed -= this.speed * 0.8 * dt;
    }
    if (input.handbrake) this.speed -= this.speed * 1.6 * dt;
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));

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
      if (Math.abs(this.speed) > 6) this.crashed = 0.25;
      this.speed *= 0.4;
    }
    this.x = nx;
    this.z = nz;
    if (this.crashed > 0) this.crashed -= dt;
    this.sync();
    return Math.abs(this.speed);
  }
}
