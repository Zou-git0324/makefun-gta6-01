// Solmar Bay itself: a 7x7 grid city with a beach and a pier, built from
// procedural geometry and canvas-painted facades. Nothing here is copied from
// any real place or commercial game. Returns the collision boxes, road lines
// and the mission beacon the rest of the game steers by.

import { PALETTE, WORLD } from './config.js';

const THREE = window.THREE;

const PITCH = WORLD.blockSize + WORLD.roadWidth; // 60 m between road centres
const HALF = (WORLD.blocks * PITCH) / 2; // city edge, 210 m from the centre

function roadCentres() {
  const list = [];
  for (let i = 0; i <= WORLD.blocks; i += 1) list.push(-HALF + i * PITCH);
  return list;
}

function blockCentres() {
  const list = [];
  for (let i = 0; i < WORLD.blocks; i += 1) list.push(-HALF + PITCH / 2 + i * PITCH);
  return list;
}

/** A building facade painted on a canvas: lit and dark windows over a base colour. */
function facadeTexture(baseColor, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 10;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.next() < 0.35;
      ctx.fillStyle = lit ? '#ffe9a8' : '#2c3a4a';
      ctx.fillRect(10 + c * 22, 12 + r * 24, 14, 15);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(w, h, d, material, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function buildCity(scene, rng) {
  const aabbs = [];
  const roads = roadCentres();
  const blocks = blockCentres();
  const group = new THREE.Group();
  scene.add(group);

  // The ground under the city and the beach — but not under the sea, which
  // has its own plane just beyond the sand.
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6a7a5a });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + WORLD.beachDepth + 60),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, (WORLD.beachDepth - 60) / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // Asphalt: one long strip per road, both directions.
  const asphaltMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  for (const c of roads) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, HALF * 2), asphaltMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0, 0);
    ns.receiveShadow = true;
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, WORLD.roadWidth), asphaltMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0, c);
    ew.receiveShadow = true;
    group.add(ew);
  }

  // Centre dashes down every road.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2e9c8 });
  const dashGeo = new THREE.BoxGeometry(0.5, 0.02, 3);
  for (const c of roads) {
    for (let t = -HALF + 8; t < HALF - 8; t += 12) {
      const a = new THREE.Mesh(dashGeo, dashMat);
      a.position.set(c, 0.02, t);
      group.add(a);
      const b = new THREE.Mesh(dashGeo, dashMat);
      b.position.set(t, 0.02, c);
      group.add(b);
    }
  }

  // Sidewalks: pale frames around every block.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const bx of blocks) {
    for (const bz of blocks) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.blockSize + 4, WORLD.blockSize + 4), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx, 0.01, bz);
      walk.receiveShadow = true;
      group.add(walk);
    }
  }

  // Beach sand and the sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 60, WORLD.beachDepth),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, HALF + WORLD.beachDepth / 2);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 60, WORLD.seaDepth),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, HALF + WORLD.beachDepth + WORLD.seaDepth / 2);
  group.add(sea);

  // The pier: wooden planks running out into the sea, with a shack at the end.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 70), pierMat);
  pier.position.set(0, 0.4, HALF + WORLD.beachDepth + 30);
  pier.castShadow = true;
  group.add(pier);
  box(10, 5, 8, new THREE.MeshLambertMaterial({ color: 0xd86a5a }), 0, 3, HALF + WORLD.beachDepth + 58, group);

  // Buildings, one to four per block. The centre block holds Harlow Tower.
  const facadeCache = new Map();
  function facadeFor(color) {
    const key = color.toString(16);
    if (!facadeCache.has(key)) {
      facadeCache.set(key, facadeTexture(`#${key.padStart(6, '0')}`, rng));
    }
    return facadeCache.get(key);
  }

  let towerTop = 0;
  for (let bi = 0; bi < blocks.length; bi += 1) {
    for (let bj = 0; bj < blocks.length; bj += 1) {
      const bx = blocks[bi];
      const bz = blocks[bj];
      const distCentre = Math.abs(bx) + Math.abs(bz);
      // One block is the palm park; the centre block is the tower plaza.
      if (bi === 1 && bj === 1) {
        const grass = new THREE.Mesh(
          new THREE.PlaneGeometry(WORLD.blockSize, WORLD.blockSize),
          new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(bx, 0.03, bz);
        grass.receiveShadow = true;
        group.add(grass);
        for (let t = 0; t < 7; t += 1) {
          plantPalm(group, bx + rng.range(-18, 18), bz + rng.range(-18, 18), rng);
        }
        continue;
      }
      if (bi === 3 && bj === 3) {
        const plaza = new THREE.Mesh(
          new THREE.PlaneGeometry(WORLD.blockSize, WORLD.blockSize),
          new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }),
        );
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(bx, 0.02, bz);
        plaza.receiveShadow = true;
        group.add(plaza);
        const towerMat = new THREE.MeshLambertMaterial({
          map: facadeFor(0x3a5a8a),
          color: 0xffffff,
        });
        const tower = box(24, 64, 24, towerMat, bx, 32, bz, group);
        towerTop = 64;
        aabbs.push({ minX: bx - 12, maxX: bx + 12, minZ: bz - 12, maxZ: bz + 12 });
        // A glowing crown so the tower reads from anywhere in the city.
        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(26, 2, 26),
          new THREE.MeshBasicMaterial({ color: 0xffd23f }),
        );
        crown.position.set(bx, 65, bz);
        group.add(crown);
        continue;
      }
      const count = rng.int(1, 3);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(10, 20);
        const d = rng.range(10, 20);
        const h = Math.max(7, rng.range(8, 26) * (1 - distCentre / 700) + rng.range(0, 10));
        const ox = rng.range(-10, 10);
        const oz = rng.range(-10, 10);
        const x = bx + ox;
        const z = bz + oz;
        if (Math.abs(ox) + w / 2 > WORLD.blockSize / 2 - 2 || Math.abs(oz) + d / 2 > WORLD.blockSize / 2 - 2) continue;
        const color = rng.pick(PALETTE.building);
        const mat = new THREE.MeshLambertMaterial({ map: facadeFor(color), color: 0xffffff });
        box(w, h, d, mat, x, h / 2, z, group);
        // Flat roof cap in a darker shade.
        box(w + 0.4, 0.5, d + 0.4, new THREE.MeshLambertMaterial({ color: 0x555a63 }), x, h + 0.25, z, group);
        aabbs.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Palms along the beachfront and the main avenue.
  for (let x = -HALF + 10; x <= HALF - 10; x += 30) {
    plantPalm(group, x, HALF - 9, rng);
    if (rng.chance(0.6)) plantPalm(group, x + 12, -HALF + 9, rng);
  }

  // Street lamps at every other intersection.
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < roads.length; i += 2) {
    for (let j = 0; j < roads.length; j += 2) {
      const x = roads[i] + WORLD.roadWidth / 2 + 1;
      const z = roads[j] + WORLD.roadWidth / 2 + 1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampPoleMat);
      pole.position.set(x, 3, z);
      pole.castShadow = true;
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampGlowMat);
      lamp.position.set(x, 6.2, z);
      group.add(lamp);
    }
  }

  // The mission beacon: a golden light pillar and a pulsing ground ring.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);

  const bounds = {
    minX: -HALF - 20,
    maxX: HALF + 20,
    minZ: -HALF - 20,
    maxZ: HALF + WORLD.beachDepth + 4,
  };

  return {
    aabbs,
    roads,
    blocks,
    bounds,
    beachZ: HALF,
    seaZ: HALF + WORLD.beachDepth,
    towerTop,
    half: HALF,
    beacon,
    setBeacon(x, z, visible) {
      beacon.position.set(x, 0, z);
      beacon.visible = visible;
    },
    pulseBeacon(time) {
      const s = 1 + Math.sin(time * 3) * 0.18;
      ring.scale.set(s, s, 1);
    },
    /** Push a circle (x, z, radius) out of every building box; returns the fixed position. */
    collideCircle(x, z, radius) {
      for (const b of aabbs) {
        const cx = Math.max(b.minX, Math.min(x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        const dx = x - cx;
        const dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 < 0.0001) {
          // Dead centre of a box: push out along the smallest penetration.
          const pushL = x - b.minX + radius;
          const pushR = b.maxX - x + radius;
          const pushT = z - b.minZ + radius;
          const pushB = b.maxZ - z + radius;
          const min = Math.min(pushL, pushR, pushT, pushB);
          if (min === pushL) x = b.minX - radius;
          else if (min === pushR) x = b.maxX + radius;
          else if (min === pushT) z = b.minZ - radius;
          else z = b.maxZ + radius;
        } else {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * radius;
          z = cz + (dz / d) * radius;
        }
      }
      return { x, z };
    },
    clampToBounds(x, z, radius) {
      return {
        x: Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, x)),
        z: Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, z)),
      };
    },
    randomRoadPoint(rng2) {
      const horizontal = rng2.chance(0.5);
      const road = rng2.pick(roads);
      const along = rng2.range(-HALF + 20, HALF - 20);
      return horizontal ? { x: along, z: road } : { x: road, z: along };
    },
    randomSidewalkPoint(rng2) {
      const bx = rng2.pick(blocks);
      const bz = rng2.pick(blocks);
      return { x: bx + rng2.range(-20, 20), z: bz + rng2.range(-20, 20) };
    },
  };
}

function plantPalm(group, x, z, rng) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
  trunk.position.set(x, 3, z);
  trunk.rotation.z = rng.range(-0.12, 0.12);
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
    const angle = (i / 6) * Math.PI * 2;
    leaf.position.set(x + Math.cos(angle) * 1.1, 6.4, z + Math.sin(angle) * 1.1);
    leaf.rotation.z = Math.cos(angle) * 1.1;
    leaf.rotation.x = -Math.sin(angle) * 1.1;
    leaf.castShadow = true;
    group.add(leaf);
  }
}
