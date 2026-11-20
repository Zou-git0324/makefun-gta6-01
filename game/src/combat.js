// Combat: fists and a pistol for the player, thugs who chase and swing, and
// the little burst of particles and light that sells every hit. Enemies are
// plain box people with a health bar floating over their heads.

import { PLAYER } from './config.js';

const THREE = window.THREE;

function makeThugMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x4a2a3a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.32), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.65;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cap.position.y = 1.86;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.24), pants);
  legL.position.set(-0.15, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.24), pants);
  legR.position.set(0.15, 0.33, 0);
  group.add(legR);
  // A thin health bar that always faces the camera.
  const barBg = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.1, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x222222 }),
  );
  barBg.position.y = 2.15;
  group.add(barBg);
  const barFg = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.07, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xff4040 }),
  );
  barFg.position.y = 2.15;
  group.add(barFg);
  group.userData.barFg = barFg;
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export function createCombat(scene, city, rng) {
  const enemies = [];
  const particles = [];
  const particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  const particleMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const flash = new THREE.PointLight(0xffd23f, 0, 12);
  scene.add(flash);

  function spawnBurst(x, y, z, color) {
    for (let i = 0; i < 10; i += 1) {
      const mesh = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color }));
      mesh.position.set(x, y, z);
      scene.add(mesh);
      particles.push({
        mesh,
        vx: (rng.next() - 0.5) * 6,
        vy: rng.next() * 4,
        vz: (rng.next() - 0.5) * 6,
        life: 0.5,
      });
    }
  }

  function spawnEnemies(x, z, count) {
    for (let i = 0; i < count; i += 1) {
      const mesh = makeThugMesh();
      scene.add(mesh);
      const ex = x + rng.range(-6, 6);
      const ez = z + rng.range(-6, 6);
      enemies.push({
        mesh,
        x: ex,
        z: ez,
        health: 100,
        speed: rng.range(3.2, 4.2),
        attackTimer: 0,
        walkPhase: rng.next() * 6,
        dead: false,
      });
    }
  }

  function enemiesLeft() {
    return enemies.filter((e) => !e.dead).length;
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
  }

  /** The player's punch: the nearest thug inside range and in front takes a hit. */
  function punch(playerPos, heading) {
    let best = null;
    let bestDist = PLAYER.punchRange;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - playerPos.x;
      const dz = e.z - playerPos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > bestDist) continue;
      if ((dx * fx + dz * fz) / Math.max(0.01, d) < 0.3) continue;
      bestDist = d;
      best = e;
    }
    if (!best) return false;
    hurtEnemy(best, PLAYER.punchDamage);
    spawnBurst(best.x, 1.4, best.z, 0xffd23f);
    return true;
  }

  /** The player's shot: a hitscan ray from the camera through the crosshair. */
  function shoot(origin, direction) {
    let best = null;
    let bestDist = PLAYER.shootRange;
    for (const e of enemies) {
      if (e.dead) continue;
      const cx = e.x - origin.x;
      const cy = 1.2 - origin.y;
      const cz = e.z - origin.z;
      const along = cx * direction.x + cy * direction.y + cz * direction.z;
      if (along < 0 || along > bestDist) continue;
      const px = cx - direction.x * along;
      const py = cy - direction.y * along;
      const pz = cz - direction.z * along;
      const perp = Math.sqrt(px * px + py * py + pz * pz);
      if (perp < 1.1) { bestDist = along; best = e; }
    }
    flash.position.set(origin.x + direction.x * 2, origin.y + direction.y * 2, origin.z + direction.z * 2);
    flash.intensity = 60;
    window.setTimeout(() => { flash.intensity = 0; }, 60);
    if (!best) return false;
    hurtEnemy(best, PLAYER.shootDamage);
    spawnBurst(best.x, 1.3, best.z, 0xff4040);
    return true;
  }

  function hurtEnemy(enemy, damage) {
    enemy.health -= damage;
    enemy.mesh.userData.barFg.scale.x = Math.max(0.01, enemy.health / 100);
    enemy.mesh.userData.barFg.position.x = -(1 - Math.max(0, enemy.health) / 100) * 0.43;
    if (enemy.health <= 0 && !enemy.dead) {
      enemy.dead = true;
      enemy.mesh.rotation.z = Math.PI / 2;
      enemy.mesh.position.y = 0.4;
      spawnBurst(enemy.x, 1, enemy.z, 0xffffff);
    }
  }

  /**
   * Thugs chase the player and swing when close. Returns the damage dealt to
   * the player this step (0 when nobody lands a hit).
   */
  function step(dt, playerPos, playerAlive) {
    let damage = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.5) {
        e.x += (dx / dist) * e.speed * dt;
        e.z += (dz / dist) * e.speed * dt;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.walkPhase += dt * 9;
      const swing = Math.sin(e.walkPhase) * 0.45;
      e.mesh.userData.legL.rotation.x = swing;
      e.mesh.userData.legR.rotation.x = -swing;
      e.attackTimer -= dt;
      if (dist < 1.6 && e.attackTimer <= 0 && playerAlive) {
        e.attackTimer = 1.1;
        damage += 12;
        spawnBurst(playerPos.x, 1.4, playerPos.z, 0xff4040);
      }
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
    }
    return damage;
  }

  function enemyPositions() {
    return enemies.map((e) => ({ x: e.x, z: e.z, health: e.health, dead: e.dead }));
  }

  return { spawnEnemies, enemiesLeft, enemyPositions, clearEnemies, punch, shoot, step, spawnBurst };
}
