// Vehicles — car meshes, kinds, and the Car itself.
//
// A Car is a little state machine on wheels: it knows where it is, how
// fast it is going, how hurt it is, and whether it is smoking. Everything
// that drives — traffic, police cruisers, the car Lena steals — is one of
// these, so they all obey the same physics and the same damage rules.
//
// Local forward is +z: a car with heading h moves along
// (sin h, cos h). Meshes are built facing +z so rotation.y = heading.

import { CAR, CAR_KINDS, CAR_DAMAGE } from './config.js';

// Paint jobs traffic can wear. Taxi yellow and police white are handled
// separately, so they never show up here.
const PAINTS = [
  0xc0392b, 0x2471a3, 0x1e8449, 0xd35400, 0x7d3c98,
  0xe8e8e8, 0x2c3e50, 0x16a085, 0xb7950b, 0x922b21,
];

// One shared smoke puff shape for every car. Puffs are cheap boxes that
// rise, shrink and vanish; there are never many alive at once.
const SMOKE_GEO = new THREE.BoxGeometry(0.7, 0.7, 0.7);
const SMOKE_MAT = new THREE.MeshLambertMaterial({
  color: 0x8a8a8a,
  transparent: true,
  opacity: 0.55,
});

export function randomKind(rng) {
  return rng.pick(['sedan', 'sports', 'coupe', 'van', 'taxi']);
}

export function randomCarColor(rng) {
  return rng.pick(PAINTS);
}

// Build the visible car for a kind. The body material is kept on
// userData so the Car can repaint it (taxi yellow, police white).
export function makeCarMesh(kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x223344 });
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  group.userData.bodyMat = bodyMat;

  // Body sizes per kind. Vans are tall boxes; sports cars are low and
  // long; everything else is a plain four-door shape.
  let bodyLen = 4.2;
  let bodyH = 0.75;
  let bodyY = 0.55;
  let cabinLen = 2.2;
  let cabinH = 0.6;
  let cabinY = 1.15;
  let cabinZ = -0.2;
  if (kind === 'sports') {
    bodyLen = 4.4;
    bodyH = 0.6;
    bodyY = 0.5;
    cabinLen = 1.9;
    cabinH = 0.5;
    cabinY = 1.0;
  } else if (kind === 'coupe') {
    bodyLen = 4.0;
    bodyH = 0.65;
    bodyY = 0.5;
    cabinLen = 1.8;
    cabinH = 0.55;
    cabinY = 1.05;
  } else if (kind === 'van') {
    bodyLen = 4.6;
    bodyH = 1.5;
    bodyY = 0.95;
    cabinLen = 1.4;
    cabinH = 0.5;
    cabinY = 1.85;
    cabinZ = 0.9;
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, bodyH, bodyLen), bodyMat);
  body.position.y = bodyY;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, cabinH, cabinLen), glassMat);
  cabin.position.set(0, cabinY, cabinZ);
  cabin.castShadow = true;
  group.add(cabin);

  // The sports car gets a wing on the back. It is the only kind with one,
  // so you can spot it from across the map.
  if (kind === 'sports') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.35), bodyMat);
    wing.position.set(0, 1.0, -bodyLen / 2 + 0.1);
    wing.castShadow = true;
    group.add(wing);
    for (const sx of [-0.6, 0.6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), bodyMat);
      strut.position.set(sx, 0.85, -bodyLen / 2 + 0.1);
      group.add(strut);
    }
  }

  // Taxis wear their sign on the roof.
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.16, 0.45),
      new THREE.MeshLambertMaterial({ color: 0xf5c518 }),
    );
    sign.position.set(0, cabinY + cabinH / 2 + 0.1, cabinZ);
    group.add(sign);
  }

  // Headlights and tail lights.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  for (const sx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMat);
    head.position.set(sx, 0.6, bodyLen / 2 + 0.01);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), tailMat);
    tail.position.set(sx, 0.65, -bodyLen / 2 - 0.01);
    group.add(tail);
  }

  // Four wheels. Each one lives on a pivot at its axle, with the tyre
  // spun 90 degrees so the axle runs across the car; drive() turns the
  // pivots, so the wheels roll instead of sliding.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const wheel = new THREE.Mesh(wheelGeo, tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(pivot);
  }
  group.userData.wheels = wheels;
  return group;
}

export class Car {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.kind = opts.kind || 'sedan';
    this.tune = { ...CAR_KINDS[this.kind], ...(opts.tune || {}) };
    this.mesh = makeCarMesh(this.kind);
    this.wheels = this.mesh.userData.wheels || [];
    this.isPolice = !!opts.isPolice;
    this.isTaxi = this.kind === 'taxi' || !!opts.isTaxi;

    // Paint. Police cruisers are white with a light bar; taxis are yellow.
    let paint = opts.color !== undefined ? opts.color : 0xd8d8d8;
    if (this.isPolice) paint = 0xf2f2f2;
    if (this.kind === 'taxi') paint = 0xf5c518;
    this.mesh.userData.bodyMat.color.setHex(paint);
    if (this.isPolice) this.addLightBar();

    this.x = opts.x || 0;
    this.z = opts.z || 0;
    this.heading = opts.heading || 0;
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
    scene.add(this.mesh);
    this.sync();
  }

  // Red and blue flashers on the cabin roof. They alternate in sync().
  addLightBar() {
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xff2222 }),
    );
    red.position.set(-0.35, 1.52, -0.2);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2244ff }),
    );
    blue.position.set(0.35, 1.52, -0.2);
    this.mesh.add(red);
    this.mesh.add(blue);
    this.mesh.userData.lightRed = red;
    this.mesh.userData.lightBlue = blue;
  }

  // Effective top speed. Damage eats it: at 100 damage the car has lost
  // `maxSpeedLoss` of its pace, so a sports car that did 43 does 21.5.
  topSpeed() {
    const worn = Math.min(this.damage, 100) / 100;
    return this.tune.topSpeed * (1 - CAR_DAMAGE.maxSpeedLoss * worn);
  }

  kindLabel() {
    return this.tune.label;
  }

  place(x, z, heading) {
    this.x = x;
    this.z = z;
    if (heading !== undefined) this.heading = heading;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Flash the light bar on police cars, about twice a second.
    const red = this.mesh.userData.lightRed;
    const blue = this.mesh.userData.lightBlue;
    if (red && blue) {
      const phase = Math.floor(performance.now() / 280) % 2 === 0;
      red.material.color.setHex(phase ? 0xff2222 : 0x551111);
      blue.material.color.setHex(phase ? 0x222255 : 0x2244ff);
    }
  }

  forwardVector() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // Drive one step. `input` is { forward, back, left, right, handbrake }.
  // Steering only bites while the car is moving, and the handbrake trades
  // grip for a slide.
  drive(input, dt) {
    const top = this.topSpeed();
    if (input.forward) {
      this.speed += this.tune.accel * dt;
    } else if (input.back) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed -= CAR.reverseAccel * dt;
    } else {
      this.speed -= this.speed * 0.6 * dt;
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    if (input.handbrake) this.speed -= this.speed * 2.5 * dt;
    if (this.speed > top) this.speed = top;
    if (this.speed < -CAR.maxReverse) this.speed = -CAR.maxReverse;

    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const grip = input.handbrake ? CAR.handbrakeGrip : this.tune.grip;
    const speedFactor = Math.min(1, Math.abs(this.speed) / 12);
    this.steer += (steerInput - this.steer) * Math.min(1, 8 * dt);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += this.steer * CAR.steerAngle * grip * speedFactor * dt * dir;

    const fwd = this.forwardVector();
    this.x += fwd.x * this.speed * dt;
    this.z += fwd.z * this.speed * dt;
    for (const wheel of this.wheels) wheel.rotation.x += (this.speed * dt) / 0.36;
    this.sync();
  }

  // Smoke, one puff at a time. Returns 1 when a puff was born this step.
  // Only cars hurt past `smokeAt` smoke at all.
  stepSmoke(dt) {
    if (this.damage <= CAR_DAMAGE.smokeAt) {
      this.smoke = false;
      return 0;
    }
    this.smoke = true;
    this.smokeTimer -= dt;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt;
      p.mesh.position.y += dt * 1.6;
      p.mesh.scale.setScalar(Math.max(0.01, p.life));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.puffs.splice(i, 1);
      }
    }
    if (this.smokeTimer > 0) return 0;
    this.smokeTimer += 0.5;
    const fwd = this.forwardVector();
    const puff = new THREE.Mesh(SMOKE_GEO, SMOKE_MAT);
    puff.position.set(this.x - fwd.x * 1.8, 0.9, this.z - fwd.z * 1.8);
    puff.scale.setScalar(1.2);
    this.scene.add(puff);
    this.puffs.push({ mesh: puff, life: 1.2 });
    this.smokePuffs += 1;
    return 1;
  }
}
