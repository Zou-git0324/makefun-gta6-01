// Solmar Bay — HUD: every panel the player reads, the menu job list and
// the minimap. All DOM lookups happen once here; every method is defensive
// about a missing element so a panel can never break the game loop.

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    clock: $('clock'),
    cash: $('cash'),
    healthfill: $('healthfill'),
    jobs: $('jobs'),
    wanted: $('wanted'),
    missionName: $('missionName'),
    missionText: $('missionText'),
    speedo: $('speedo'),
    mphNum: $('mphNum'),
    speedKind: $('speedKind'),
    damagefill: $('damagefill'),
    damageLabel: $('damageLabel'),
    minimap: $('minimap'),
    toast: $('toast'),
    crosshair: $('crosshair'),
    prompt: $('prompt'),
    dialogue: $('dialogue'),
    menu: $('menu'),
    missionList: $('missionList'),
    jobsDone: $('jobsDone'),
    btnContinue: $('btn-continue'),
    paused: $('paused'),
  };

  let toastTimer = 0;
  let dialogueTimer = 0;
  let dialogueLines = [];
  let dialogueIndex = 0;

  function toast(text, ms) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.style.display = 'none';
    }, ms || 2500);
  }

  function announce(text) {
    toast(text, 4000);
  }

  function showDialogueLine() {
    if (!els.dialogue) return;
    if (dialogueIndex >= dialogueLines.length) {
      els.dialogue.style.display = 'none';
      dialogueLines = [];
      return;
    }
    const line = dialogueLines[dialogueIndex];
    els.dialogue.innerHTML = '';
    const who = document.createElement('b');
    who.textContent = line.who + ': ';
    const text = document.createElement('span');
    text.textContent = line.text;
    els.dialogue.appendChild(who);
    els.dialogue.appendChild(text);
    els.dialogue.style.display = 'block';
    clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(() => {
      dialogueIndex += 1;
      showDialogueLine();
    }, 4500);
  }

  function dialogue(lines) {
    if (!lines || !lines.length) return;
    dialogueLines = lines.slice();
    dialogueIndex = 0;
    showDialogueLine();
  }

  if (els.dialogue) {
    els.dialogue.addEventListener('click', () => {
      clearTimeout(dialogueTimer);
      dialogueIndex += 1;
      showDialogueLine();
    });
  }

  function prompt(text) {
    if (!els.prompt) return;
    if (!text) {
      els.prompt.style.display = 'none';
      return;
    }
    els.prompt.textContent = text;
    els.prompt.style.display = 'block';
  }

  function updateStats(s) {
    if (els.clock && s.time !== undefined) els.clock.textContent = s.time;
    if (els.cash && s.cash !== undefined) els.cash.textContent = '$' + Math.floor(s.cash).toLocaleString('en-US');
    if (els.healthfill && s.health !== undefined) {
      const h = Math.max(0, Math.min(100, s.health));
      els.healthfill.style.width = h + '%';
      els.healthfill.style.background = h > 50 ? '#7ee787' : h > 25 ? '#ffb454' : '#ff7a59';
    }
    if (els.jobs && s.jobsDone !== undefined && s.jobsTotal !== undefined) {
      els.jobs.textContent = 'JOBS ' + s.jobsDone + '/' + s.jobsTotal;
    }
  }

  function updateWanted(stars) {
    if (!els.wanted) return;
    let out = '';
    for (let i = 0; i < 5; i++) out += i < stars ? '★' : '☆';
    els.wanted.textContent = out;
    els.wanted.style.color = stars === 0 ? '#8a93a6' : stars < 3 ? '#ffd23e' : '#ff5a4e';
  }

  function updateObjective(o) {
    if (!o) return;
    if (els.missionName) els.missionName.textContent = o.name || '';
    if (els.missionText) els.missionText.textContent = o.text || '';
  }

  function updateSpeed(car) {
    if (!els.speedo) return;
    if (!car) {
      els.speedo.style.display = 'none';
      return;
    }
    els.speedo.style.display = 'block';
    const mph = Math.round(Math.abs(car.speed || 0) * 2.237);
    if (els.mphNum) els.mphNum.textContent = String(mph);
    const gear = (car.speed || 0) < -0.5 ? 'R' : 'D';
    const label = (car.tune && car.tune.label) || (car.kind ? String(car.kind) : '');
    if (els.speedKind) els.speedKind.textContent = 'MPH · ' + gear + ' · ' + label.toUpperCase();
    const dmg = Math.round(car.damage || 0);
    if (els.damagefill) els.damagefill.style.width = dmg + '%';
    if (els.damageLabel) els.damageLabel.textContent = 'DAMAGE ' + dmg + '%';
  }

  function showCrosshair(show) {
    if (els.crosshair) els.crosshair.style.display = show ? 'block' : 'none';
  }

  function showMenu(show, info) {
    if (!els.menu) return;
    els.menu.style.display = show ? 'flex' : 'none';
    if (!show || !info) return;
    if (els.btnContinue) els.btnContinue.style.display = info.hasSave ? 'block' : 'none';
    if (els.jobsDone && info.completedIds) {
      els.jobsDone.textContent = 'JOBS DONE ' + info.completedIds.length + '/' + (info.defs ? info.defs.length : 0);
    }
    if (els.missionList && info.defs) {
      els.missionList.innerHTML = '';
      info.defs.forEach((def) => {
        const done = info.completedIds && info.completedIds.includes(def.id);
        const row = document.createElement('div');
        row.className = 'job' + (done ? ' done' : '');
        const mark = document.createElement('span');
        mark.className = 'job-mark';
        mark.textContent = done ? '✓' : String(def.id).padStart(2, '0');
        const name = document.createElement('span');
        name.className = 'job-name';
        name.textContent = def.name;
        const reward = document.createElement('span');
        reward.className = 'job-reward';
        reward.textContent = '$' + def.reward.toLocaleString('en-US');
        row.appendChild(mark);
        row.appendChild(name);
        row.appendChild(reward);
        els.missionList.appendChild(row);
      });
    }
  }

  function showPaused(show) {
    if (els.paused) els.paused.style.display = show ? 'flex' : 'none';
  }

  // The minimap: a 210px square of the whole bay. North is up (-z).
  function drawMinimap(ctx) {
    const canvas = els.minimap;
    if (!canvas || !ctx || !ctx.city || !ctx.player) return;
    const g = canvas.getContext('2d');
    const size = canvas.width;
    const b = ctx.city.bounds;
    const sx = size / (b.maxX - b.minX);
    const sz = size / (b.maxZ - b.minZ);
    const X = (x) => (x - b.minX) * sx;
    const Z = (z) => (z - b.minZ) * sz;
    g.clearRect(0, 0, size, size);
    g.fillStyle = '#101c26';
    g.fillRect(0, 0, size, size);
    // Sea and sand along the south edge.
    g.fillStyle = '#2e7f9e';
    g.fillRect(0, Z(252), size, size - Z(252));
    g.fillStyle = '#d9c28a';
    g.fillRect(0, Z(252) - 3, size, 3);
    // Roads.
    g.strokeStyle = '#3a3f4a';
    g.lineWidth = 4;
    for (const r of ctx.city.roads) {
      g.beginPath();
      g.moveTo(X(r), 0);
      g.lineTo(X(r), size);
      g.stroke();
      g.beginPath();
      g.moveTo(0, Z(r));
      g.lineTo(size, Z(r));
      g.stroke();
    }
    g.strokeStyle = '#5a6270';
    g.lineWidth = 1;
    for (const r of ctx.city.roads) {
      g.beginPath();
      g.moveTo(X(r), 0);
      g.lineTo(X(r), size);
      g.stroke();
      g.beginPath();
      g.moveTo(0, Z(r));
      g.lineTo(size, Z(r));
      g.stroke();
    }
    const dot = (x, z, color, r) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(X(x), Z(z), r, 0, Math.PI * 2);
      g.fill();
    };
    // Stash and drop markers first, under everything else.
    if (ctx.missions && typeof ctx.missions.markers === 'function') {
      for (const m of ctx.missions.markers()) {
        if (!m.collected) dot(m.x, m.z, '#ffd23e', 4);
      }
    }
    // Traffic, police and enemies.
    if (ctx.traffic) {
      for (const car of ctx.traffic.cars) {
        if (car.occupied) continue;
        dot(car.x, car.z, '#dfe6ee', 2);
      }
    }
    if (ctx.police) {
      for (const p of ctx.police.policePositions()) {
        dot(p.x, p.z, p.heli ? '#37c8e8' : '#4a90ff', p.heli ? 5 : 3);
      }
    }
    if (ctx.combat) {
      for (const e of ctx.combat.enemyPositions()) dot(e.x, e.z, '#ff5a4e', 2.5);
    }
    // The job beacon: a pulsing yellow diamond.
    if (ctx.city.beacon && ctx.city.beacon.visible) {
      const bx = ctx.city.beacon.position.x;
      const bz = ctx.city.beacon.position.z;
      const pulse = 4 + Math.sin(Date.now() / 300) * 1.5;
      g.fillStyle = '#ffd23e';
      g.beginPath();
      g.moveTo(X(bx), Z(bz) - pulse);
      g.lineTo(X(bx) + pulse, Z(bz));
      g.lineTo(X(bx), Z(bz) + pulse);
      g.lineTo(X(bx) - pulse, Z(bz));
      g.closePath();
      g.fill();
    }
    // The player: a yellow arrow pointing where they face. Forward is
    // (sin heading, cos heading) in world (x, z), which is (dx, dy) on the
    // map, so the clockwise angle from straight up is atan2(sin, -cos).
    const p = ctx.player;
    g.save();
    g.translate(X(p.x), Z(p.z));
    g.rotate(Math.atan2(Math.sin(p.heading), -Math.cos(p.heading)));
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 5);
    g.lineTo(-5, 5);
    g.closePath();
    g.fill();
    g.restore();
  }

  return {
    toast, dialogue, prompt, updateStats, updateWanted, updateObjective,
    updateSpeed, showCrosshair, showMenu, showPaused, announce, drawMinimap,
  };
}
