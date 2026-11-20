// The HUD: cash, health, wanted stars, the mission objective, the speedometer,
// toasts, dialogue lines, the round minimap, and the start/pause menus.

import { WORLD } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('cash');
  const healthEl = el('healthfill');
  const starsEl = el('stars');
  const missionNameEl = el('missionName');
  const missionTextEl = el('missionText');
  const clockEl = el('clock');
  const toastEl = el('toast');
  const promptEl = el('prompt');
  const dialogueEl = el('dialogue');
  const dialogueWhoEl = el('dialogueWho');
  const dialogueTextEl = el('dialogueText');
  const speedoEl = el('speedo');
  const mphEl = el('mph');
  const gearEl = el('gear');
  const crosshairEl = el('crosshair');
  const menuEl = el('menu');
  const pausedEl = el('paused');
  const statusEl = el('status');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');

  let toastTimer = null;
  let dialogueTimer = null;
  let lastStars = -1;

  function toast(text) {
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toastEl.style.opacity = '0'; }, 2600);
  }

  function dialogue(who, text) {
    dialogueWhoEl.textContent = `${who}: `;
    dialogueTextEl.textContent = text;
    dialogueEl.style.display = 'block';
    if (dialogueTimer) window.clearTimeout(dialogueTimer);
    dialogueTimer = window.setTimeout(() => { dialogueEl.style.display = 'none'; }, 4000);
  }

  function prompt(text) {
    if (text) {
      promptEl.textContent = text;
      promptEl.style.display = 'block';
    } else {
      promptEl.style.display = 'none';
    }
  }

  function updateStats(cash, health, timeSeconds) {
    cashEl.textContent = cash.toLocaleString();
    healthEl.style.width = `${Math.max(0, Math.min(100, health))}%`;
    const hours = 9 + Math.floor(timeSeconds / 60);
    const mins = Math.floor(timeSeconds % 60);
    clockEl.textContent = `${String(hours % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  function updateWanted(stars) {
    if (stars === lastStars) return;
    lastStars = stars;
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += i < stars ? '★' : '<span class="dim">★</span>';
    }
    starsEl.innerHTML = html;
  }

  function updateObjective(name, text, timerLeft) {
    missionNameEl.textContent = name;
    missionTextEl.textContent = timerLeft > 0 ? `${text} — ${Math.ceil(timerLeft)}s left` : text;
  }

  function updateSpeed(inCar, mph, reversing) {
    speedoEl.style.display = inCar ? 'block' : 'none';
    if (inCar) {
      mphEl.textContent = String(Math.round(mph));
      gearEl.textContent = reversing ? 'R' : 'D';
    }
  }

  function showCrosshair(show) {
    crosshairEl.style.display = show ? 'block' : 'none';
  }

  function showMenu(show, hasSave) {
    menuEl.style.display = show ? 'flex' : 'none';
    el('btnContinue').style.display = hasSave ? 'inline-block' : 'none';
  }

  function showPaused(show) {
    pausedEl.style.display = show ? 'flex' : 'none';
  }

  function announce(message) {
    statusEl.textContent = message;
  }

  /** Draw the round minimap: roads, the beach, the player, cars, cops and the beacon. */
  function drawMinimap(world) {
    const size = 210;
    const half = WORLD.blocks * (WORLD.blockSize + WORLD.roadWidth) / 2 + 60;
    const toMap = (x, z) => [size / 2 + (x / half) * (size / 2), size / 2 + (z / half) * (size / 2)];
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.fillStyle = '#16233a';
    mapCtx.fillRect(0, 0, size, size);
    // Sea and beach along the bottom edge.
    mapCtx.fillStyle = '#2a7f9e';
    mapCtx.fillRect(0, size - 26, size, 26);
    mapCtx.fillStyle = '#e8cf9a';
    mapCtx.fillRect(0, size - 34, size, 8);
    // Roads.
    mapCtx.strokeStyle = '#4a5160';
    mapCtx.lineWidth = 5;
    for (const c of world.cityRoads) {
      const [x1] = toMap(c, -half);
      const [, y1] = toMap(-half, c);
      mapCtx.beginPath(); mapCtx.moveTo(x1, 0); mapCtx.lineTo(x1, size); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, y1); mapCtx.lineTo(size, y1); mapCtx.stroke();
    }
    const blip = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(mx, my, r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    if (world.beaconVisible) blip(world.beaconX, world.beaconZ, '#ffd23f', 6);
    for (const car of world.policeCars) blip(car.x, car.z, '#3a6aff', 4);
    for (const car of world.trafficCars) blip(car.x, car.z, '#c8c8c8', 2.5);
    // The player is a white triangle pointing along their heading.
    const [px, py] = toMap(world.playerX, world.playerZ);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(world.playerHeading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  return {
    toast,
    dialogue,
    prompt,
    updateStats,
    updateWanted,
    updateObjective,
    updateSpeed,
    showCrosshair,
    showMenu,
    showPaused,
    announce,
    drawMinimap,
  };
}
