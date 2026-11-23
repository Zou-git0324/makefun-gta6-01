// Solmar Bay — shots: stage the four screenshots of the game.
// stageShot(n, solmar, done) sets the game up for one picture and returns
// true when the scene is ready. The third argument is optional: when it is
// a function it is called with the result once staging is done.
//   1 — the chase: four stars, the helicopter in frame, police behind
//   2 — the street: the city at street level, on foot
//   3 — the mission: a job in progress, objective on the HUD
//   4 — the start screen: the menu over the bay

function freeRoam(S) {
  if (S.state().screen === 'menu') {
    const btn = document.querySelector('#btn-free');
    if (btn) btn.click();
  }
}

function frameTwoPoints(S, a, b, height, back) {
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  const nx = -dz / d;
  const nz = dx / d;
  S.setCamera(a.x + nx * back, height, a.z + nz * back);
  S.setCameraLookAt(a.x + nx * back, height, a.z + nz * back, mx, 2, mz);
}

export function stageShot(n, S, done) {
  let ok = false;
  try {
    if (n === 1) {
      // Four-star chase with the helicopter in frame.
      freeRoam(S);
      S.placePlayer(36, 180, 0);
      S.driveCar('sports');
      S.setWanted(4);
      S.setFrozen(false);
      S.advance(1.5);
      S.advance(1.5);
      S.setFrozen(true);
      const heli = S.heliPos();
      const car = { x: S.player.x, z: S.player.z };
      if (heli) {
        // Frame the car and the helicopter together. The helicopter flies
        // at height 30 and the car is on the ground, so stand well back
        // and high and aim halfway up between them: both stay inside the
        // picture instead of the helicopter slipping over the top edge.
        const midX = (car.x + heli.x) / 2;
        const midZ = (car.z + heli.z) / 2;
        const dx = heli.x - car.x;
        const dz = heli.z - car.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        S.setCameraLookAt(midX + nx * 70, 45, midZ + nz * 70, midX, 15, midZ);
      } else {
        S.setCamera(car.x, 16, car.z - 26);
        S.setCameraLookAt(car.x, 16, car.z - 26, car.x, 2, car.z + 20);
      }
      S.renderOnce();
      ok = true;
    } else if (n === 2) {
      // Street level, on foot, in the middle of the city.
      freeRoam(S);
      S.setFrozen(true);
      S.placePlayer(36, 120, 0);
      S.setCamera(36, 3.5, 110);
      S.setCameraLookAt(36, 3.5, 110, 36, 1.6, 128);
      S.renderOnce();
      ok = true;
    } else if (n === 3) {
      // A job in progress: the first fare, taxi waiting, objective up.
      S.startMissionAt(0);
      S.setFrozen(true);
      S.placePlayer(-24, 150, -Math.PI / 2);
      S.setCamera(-14, 6, 150);
      S.setCameraLookAt(-14, 6, 150, -30, 1.5, 150);
      S.renderOnce();
      ok = true;
    } else if (n === 4) {
      // The start screen: menu over the bay.
      if (typeof S.toMenu === 'function') S.toMenu();
      S.setFrozen(true);
      S.setCamera(150, 110, 330);
      S.setCameraLookAt(150, 110, 330, 0, 0, 0);
      S.renderOnce();
      ok = true;
    }
  } catch (err) {
    ok = false;
  }
  if (typeof done === 'function') done(ok);
  return ok;
}
