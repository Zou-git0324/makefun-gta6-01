// HUD — every panel on screen, and the minimap.
//
// The HUD owns the DOM and nothing else. main.js tells it what to show;
// it never reads game state on its own. All the numbers it renders come
// in through its methods, so the panels stay honest about the game.

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    stats: $('stats'),
    clock: $('clock'),
    cash: $('cash'),
    healthfill: $('healthfill'),
    wanted: $('wanted'),
    objective: $('objective'),
    missionName: $('missionName'),
    missionText: $('missionText'),
    speedo: $('speedo'),
    mphNum: $('mphNum'),
    speedKind: $('speedKind'),
    damagefill: $('damagefill'),
    damageLabel: $('damageLabel'),
    toast: $('toast'),
    crosshair: $('crosshair'),
    prompt: $('prompt'),
    dialogue: $('dialogue'),
    menu: $('menu'),
    paused: $('paused'),
    continueBtn: $('btn-continue'),
  };
  const map = $('minimap');
  const mctx = map.getContext('2d');

  let toastTimer = 0;
  let dialogueTimer = 0;
  let announceTimer = 0;

  function show(el, on) {
    if (el) el.style.display = on ? '' : 'none';
  }

  // A short message at the bottom of the screen. A big one — an
  // announcement — borrows the same box with a bigger style.
  function toast(msg, big) {
    const el = els.toast;
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('big', !!big);
    show(el, true);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => show(el, false), big ? 3200 : 2400);
  }

  function announce(msg) {
    toast(msg, true);
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => show(els.toast, false), 3200);
  }

  function dialogue(who, text) {
    const el = els.dialogue;
    if (!el) return;
    el.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = who + ': ';
    el.appendChild(b);
    el.appendChild(document.createTextNode(text));
    show(el, true);
    window.clearTimeout(dialogueTimer);
    dialogueTimer = window.setTimeout(() => show(el, false), 4600);
  }

  function prompt(text) {
    const el = els.prompt;
    if (!el) return;
    if (!text) {
      show(el, false);
      return;
    }
    el.textContent = text;
    show(el, true);
  }

  function updateStats(cash, health, clockText) {
    if (els.clock) els.clock.textContent = clockText;
    if (els.cash) els.cash.textContent = '$' + cash;
    if (els.healthfill) {
      els.healthfill.style.width = Math.max(0, Math.min(100, health)) + '%';
      els.healthfill.style.background = health < 30 ? '#e33' : '#ff7a59';
    }
  }

  function updateWanted(stars) {
    if (!els.wanted) return;
    let out = '';
    for (let i = 0; i < 5; i++) out += i < stars ? '★' : '☆';
    els.wanted.textContent = out;
    els.wanted.style.color = stars > 0 ? '#ffd23f' : '#8a93a6';
  }

  function updateObjective(name, text, timerSeconds) {
    if (els.missionName) els.missionName.textContent = name;
    if (els.missionText) {
      let line = text;
      if (timerSeconds > 0) {
        const m = Math.floor(timerSeconds / 60);
        const s = Math.floor(timerSeconds % 60);
        line += '  ·  ' + m + ':' + String(s).padStart(2, '0');
      }
      els.missionText.textContent = line;
    }
  }

  // Speed in mph, the kind of car, and how hurt it is. Pass null for the
  // kind when Lena is on foot and the whole dial hides.
  function updateSpeed(mph, kindLabel, damage) {
    if (!els.speedo) return;
    if (!kindLabel) {
      show(els.speedo, false);
      return;
    }
    show(els.speedo, true);
    if (els.mphNum) els.mphNum.textContent = String(Math.round(mph));
    if (els.speedKind) els.speedKind.textContent = 'MPH · D · ' + kindLabel.toUpperCase();
    if (els.damagefill) {
      els.damagefill.style.width = Math.max(0, Math.min(100, damage)) + '%';
      els.damagefill.style.background = damage > 50 ? '#e33' : '#ffb02e';
    }
    if (els.damageLabel) {
      els.damageLabel.textContent = 'DAMAGE ' + Math.round(damage) + '%';
      els.damageLabel.style.color = damage > 50 ? '#ff6b5e' : '#9fb2c8';
    }
  }

  function showCrosshair(on) {
    show(els.crosshair, on);
  }

  function showMenu(on, hasSave) {
    show(els.menu, on);
    if (els.continueBtn) show(els.continueBtn, !!hasSave);
  }

  function showPaused(on) {
    show(els.paused, on);
  }

  // The round minimap: sea at the bottom, the road grid, and one dot per
  // thing that matters — Lena in yellow, the beacon pulsing, police in
  // blue, the helicopter ringed in white, enemies in red, dead drops in
  // green, traffic and pedestrians as faint specks.
  function drawMinimap(data) {
    if (!map || !mctx || !data) return;
    const W = map.width;
    const H = map.height;
    const b = data.bounds || { minX: -230, maxX: 230, minZ: -230, maxZ: 260 };
    const sx = (x) => ((x - b.minX) / (b.maxX - b.minX)) * W;
    const sy = (z) => ((z - b.minZ) / (b.maxZ - b.minZ)) * H;
    mctx.clearRect(0, 0, W, H);

    // Water and sand along the south edge.
    mctx.fillStyle = '#0d1b2a';
    mctx.fillRect(0, 0, W, H);
    const beachY = sy(210);
    mctx.fillStyle = '#8a7a52';
    mctx.fillRect(0, beachY, W, H - beachY);
    mctx.fillStyle = '#1d5f7a';
    mctx.fillRect(0, sy(256), W, H - sy(256));

    // City blocks, then the road grid over them.
    mctx.fillStyle = '#1a2733';
    mctx.fillRect(sx(-210), sy(-210), sx(210) - sx(-210), sy(210) - sy(-210));
    mctx.strokeStyle = '#33465c';
    mctx.lineWidth = 2;
    for (const r of data.roads || []) {
      mctx.beginPath();
      mctx.moveTo(sx(r), sy(-210));
      mctx.lineTo(sx(r), sy(210));
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(sx(-210), sy(r));
      mctx.lineTo(sx(210), sy(r));
      mctx.stroke();
    }

    const dot = (x, z, color, r) => {
      mctx.fillStyle = color;
      mctx.beginPath();
      mctx.arc(sx(x), sy(z), r, 0, Math.PI * 2);
      mctx.fill();
    };
    for (const c of data.traffic || []) dot(c.x, c.z, '#cfd8e3', 1.6);
    for (const p of data.peds || []) dot(p.x, p.z, '#7d8aa0', 1.2);
    for (const e of data.enemies || []) dot(e.x, e.z, '#ff4444', 3);
    for (const p of data.collect || []) dot(p.x, p.z, '#37d67a', 3.5);
    for (const p of data.police || []) {
      if (p.heli) {
        mctx.strokeStyle = '#ffffff';
        mctx.lineWidth = 1.5;
        mctx.beginPath();
        mctx.arc(sx(p.x), sy(p.z), 6, 0, Math.PI * 2);
        mctx.stroke();
        dot(p.x, p.z, '#ff5566', 3);
      } else {
        dot(p.x, p.z, '#4da3ff', 3);
      }
    }
    if (data.beacon) {
      const pulse = 4 + Math.sin(performance.now() / 240) * 1.5;
      mctx.fillStyle = '#ffd23f';
      mctx.beginPath();
      mctx.moveTo(sx(data.beacon.x), sy(data.beacon.z) - pulse);
      mctx.lineTo(sx(data.beacon.x) + pulse, sy(data.beacon.z));
      mctx.lineTo(sx(data.beacon.x), sy(data.beacon.z) + pulse);
      mctx.lineTo(sx(data.beacon.x) - pulse, sy(data.beacon.z));
      mctx.closePath();
      mctx.fill();
    }
    // Lena: a yellow arrow pointing where she faces.
    const px = sx(data.x);
    const py = sy(data.z);
    const a = data.heading || 0;
    mctx.fillStyle = '#ffd23f';
    mctx.beginPath();
    mctx.moveTo(px + Math.sin(a) * 7, py + Math.cos(a) * 7);
    mctx.lineTo(px + Math.sin(a + 2.5) * 5, py + Math.cos(a + 2.5) * 5);
    mctx.lineTo(px + Math.sin(a - 2.5) * 5, py + Math.cos(a - 2.5) * 5);
    mctx.closePath();
    mctx.fill();
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
