// Keyboard and mouse state, read fresh every frame. Actions are edge-triggered:
// takeActions() returns what was pressed since the last call, then clears it.

import { KEYS } from './config.js';

export const ACTION_INTERACT = 1;
export const ACTION_ATTACK = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const down = new Set();
  let pending = 0;
  let dragDX = 0;
  let dragging = false;
  let lastX = 0;
  let mouseDown = false;

  function is(codeList) {
    for (const code of codeList) if (down.has(code)) return true;
    return false;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    if (KEYS.interact.includes(event.code)) pending |= ACTION_INTERACT;
    if (KEYS.attack.includes(event.code)) pending |= ACTION_ATTACK;
    if (KEYS.pause.includes(event.code)) pending |= ACTION_PAUSE;
    if (KEYS.mute.includes(event.code)) pending |= ACTION_MUTE;
    if (event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => down.delete(event.code));
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('mousedown', (event) => {
    mouseDown = true;
    dragging = true;
    lastX = event.clientX;
    if (event.button === 0) pending |= ACTION_ATTACK;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; dragging = false; });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    dragDX += event.clientX - lastX;
    lastX = event.clientX;
  });

  return {
    forward() { return is(KEYS.forward); },
    back() { return is(KEYS.back); },
    left() { return is(KEYS.left); },
    right() { return is(KEYS.right); },
    run() { return is(KEYS.run); },
    handbrake() { return is(KEYS.handbrake); },
    mouseDown() { return mouseDown; },
    takeDrag() { const d = dragDX; dragDX = 0; return d; },
    takeActions() { const a = pending; pending = 0; return a; },
  };
}
