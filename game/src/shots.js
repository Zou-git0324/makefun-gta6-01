// The screenshot scenes behind ?shot=start|chase|street|mission. Each one plays
// the real game forward from a staged state — real driving, real police, real
// combat — so the frame is what a short session really looks like, and the same
// seed always gives the same frame. Sets window.__shotReady when painted.

function pressKey(code) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true }));
}

function releaseKey(code) {
  window.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true }));
}

function holdKey(code, game, seconds) {
  pressKey(code);
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) game.advance(1 / 60);
  releaseKey(code);
}

function paintReady(game) {
  // Let the follow camera ease onto the action before the final paints.
  for (let i = 0; i < 40; i += 1) game.renderOnce();
  game.renderOnce();
  game.renderOnce();
  window.__shotReady = true;
}

export function stageShot(game, name, ctx) {
  const { hud } = ctx;

  if (name === 'start') {
    // The title screen over a living street: traffic and pedestrians roll past
    // behind the menu while the player stands on the beachfront avenue.
    game.placePlayer(30, 180, Math.PI);
    for (let i = 0; i < 150; i += 1) {
      game.traffic.step(1 / 60, null, { x: 30, z: 180 });
      game.pedestrians.step(1 / 60, { x: 0, z: 0, active: false }, { x: 30, z: 180 });
    }
    game.drawMinimap();
    paintReady(game);
    return;
  }

  // Every other scene starts from the Free Roam / Story buttons.
  if (name === 'chase') {
    document.getElementById('btnStart').click();
    game.setTime(480); // late afternoon, long shadows (09:00 + 480 game-minutes)
    game.startMissionAt(2); // "The Getaway": steal the red coupe
    game.placePlayer(90, -87, Math.PI / 2);
    pressKey('KeyE');
    game.advance(1 / 60);
    releaseKey('KeyE');
    // Four stars on us before the run, so the chase — and the police
    // helicopter overhead — is already happening.
    game.setWanted(4);
    // Steal the coupe, then run: four seconds of hard driving with the cops closing in.
    holdKey('KeyW', game, 4);
    for (let i = 0; i < 30; i += 1) game.advance(1 / 60);
    paintReady(game);
    return;
  }

  if (name === 'street') {
    document.getElementById('btnFree').click();
    game.placePlayer(-30, 88, Math.PI * 0.25);
    game.setTime(60); // mid-morning
    for (let i = 0; i < 150; i += 1) game.advance(1 / 60);
    paintReady(game);
    return;
  }

  if (name === 'mission') {
    document.getElementById('btnStart').click();
    game.setTime(360); // afternoon
    game.startMissionAt(3); // "Dockside Deal": fight at the docks
    game.placePlayer(0, 278, 0);
    for (let i = 0; i < 30; i += 1) game.advance(1 / 60); // reach the docks, thugs spawn
    game.placePlayer(0, 284, 0);
    game.setWanted(1);
    for (let i = 0; i < 45; i += 1) game.advance(1 / 60);
    paintReady(game);
    return;
  }

  // Unknown shot name: fall back to the title screen.
  game.setCamera(Math.PI * 0.15, 0.3, 10);
  paintReady(game);
}
