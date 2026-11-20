// Every sound is synthesised with WebAudio — no audio files, no network.
// A small music loop (bass + hats + a lazy lead) keeps the city feeling alive.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // Bass line in A minor, one bar of eight eighth-notes, looped by a timer.
  const BASS = [55, 0, 55, 65.41, 55, 0, 49, 58.27];
  const LEAD = [220, 0, 261.63, 0, 329.63, 0, 293.66, 246.94];

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const step = musicStep % 8;
      const bass = BASS[step];
      if (bass) tone(bass, 0.22, 'triangle', 0.16);
      const lead = LEAD[step];
      if (lead && musicStep % 16 >= 8) tone(lead, 0.2, 'sine', 0.05);
      if (step % 2 === 0) noise(0.03, 0.05, 6000);
      musicStep += 1;
    }, 240);
  }

  function stopMusic() {
    if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
  }

  function setEngine(on, speedRatio) {
    if (!ensure()) return;
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    if (engineOsc) {
      engineOsc.frequency.value = 55 + speedRatio * 130;
      engineGain.gain.value = muted ? 0 : 0.05 + speedRatio * 0.05;
    }
    if (!on && engineOsc) {
      try { engineOsc.stop(); } catch { /* already stopped */ }
      engineOsc = null;
      engineGain = null;
    }
  }

  function setSiren(on) {
    if (!ensure()) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = muted ? 0 : 0.035;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let high = false;
      sirenOsc._wail = window.setInterval(() => {
        if (!sirenOsc) return;
        high = !high;
        sirenOsc.frequency.value = high ? 920 : 660;
      }, 380);
    }
    if (!on && sirenOsc) {
      window.clearInterval(sirenOsc._wail);
      try { sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc = null;
      sirenGain = null;
    }
  }

  return {
    unlock() { resume(); startMusic(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) { setEngine(false, 0); setSiren(false); }
    },
    isMuted() { return muted; },
    setEngine,
    setSiren,
    shoot() { noise(0.14, 0.5, 2800); tone(160, 0.1, 'square', 0.2, 60); },
    punch() { noise(0.09, 0.4, 500); },
    pickup() { tone(660, 0.09, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25); },
    cash() { tone(880, 0.08, 'sine', 0.22); tone(1174, 0.08, 'sine', 0.22); tone(1568, 0.2, 'sine', 0.22); },
    crash() { noise(0.3, 0.5, 900); },
    busted() { tone(392, 0.18, 'square', 0.2); tone(311, 0.18, 'square', 0.2); tone(233, 0.4, 'square', 0.2); },
    mission() { tone(523, 0.12, 'sine', 0.22); tone(659, 0.12, 'sine', 0.22); tone(784, 0.26, 'sine', 0.22); },
    click() { tone(700, 0.05, 'sine', 0.15); },
    stopMusic,
  };
}
