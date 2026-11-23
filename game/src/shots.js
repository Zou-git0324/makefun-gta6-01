// Shots — staging the four screenshots.
//
// A shot is a camera preset: how far around Lena the camera sits, how
// high it looks down, and how far back it stands. stageShot points the
// camera, redraws the minimap, and renders one frame. Everything else
// about the scene — the wanted level, the car, the job in progress — is
// set up by the caller through the game API before staging, so a shot
// never has to guess at game state.
//
// Camera angles are relative to where Lena faces: azimuth 0 is directly
// behind her, positive values swing the camera around to her left.

const SHOTS = {
  // A chase at four stars: low, close, just off her shoulder, with the
  // helicopter's beam in the sky above the street.
  '1-chase': { azimuth: 0.35, elevation: 0.12, distance: 85 },
  // A street-level look down a long avenue, wide enough to read the city.
  '2-street': { azimuth: 0.9, elevation: 0.35, distance: 16 },
  // A job in progress: high and wide so the beacon and the street read.
  '3-mission': { azimuth: 0.15, elevation: 0.55, distance: 20 },
  // The opening frame: right behind Lena as the story starts.
  '4-start': { azimuth: 0, elevation: 0.3, distance: 18 },
};

export function stageShot(game, name, opts) {
  const shot = SHOTS[name];
  if (!shot || !game) return false;
  const preset = { ...shot, ...((opts && opts.camera) || {}) };
  game.setCamera(preset.azimuth, preset.elevation, preset.distance);
  if (typeof game.drawMinimap === 'function') game.drawMinimap();
  if (name === '1-chase' && game.heliPos && game.setCameraLookAt) {
    const heli = game.heliPos();
    if (heli) {
      const st = game.state();
      const mx = (st.x + heli.x) / 2, my = heli.y / 2, mz = (st.z + heli.z) / 2;
      const dx = heli.x - st.x, dz = heli.z - st.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len, pz = dx / len;
      game.setCameraLookAt(mx - px * 70, my + 40, mz - pz * 70, mx, my, mz);
    }
  }
  game.renderOnce();
  return true;
}
