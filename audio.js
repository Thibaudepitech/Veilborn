// ═══════════════════════════════════════════════════════
// VEILBORN — SYSTÈME AUDIO v2
// Musique ambiante douce (pads + arpèges lents) + SFX stylés variés
// ═══════════════════════════════════════════════════════

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain  = null;
  let sfxGain    = null;
  let ambientGain= null;
  let initialized = false;
  let ambientNodes = [];
  let currentTrack = null;
  let _chordInterval = null;
  let _arpInterval   = null;
  let _trackCfg = null;
  let _chordIdx = 0;
  let _arpStep  = 0;

  const settings = {
    masterVol: 0.75, musicVol: 0.28, sfxVol: 0.55, ambientVol: 0.35, enabled: true,
  };
  try { const s = localStorage.getItem('veilborn_audio'); if (s) Object.assign(settings, JSON.parse(s)); } catch {}

  function saveSettings() {
    try { localStorage.setItem('veilborn_audio', JSON.stringify(settings)); } catch {}
    refreshSettingsUI();
  }

  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain  = ctx.createGain(); masterGain.gain.value  = settings.masterVol;
      musicGain   = ctx.createGain(); musicGain.gain.value   = settings.musicVol;
      sfxGain     = ctx.createGain(); sfxGain.gain.value     = settings.sfxVol;
      ambientGain = ctx.createGain(); ambientGain.gain.value = settings.ambientVol;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24; comp.ratio.value = 3;
      [musicGain, sfxGain, ambientGain].forEach(g => g.connect(comp));
      comp.connect(masterGain);
      masterGain.connect(ctx.destination);
      initialized = true;
      refreshSettingsUI();
    } catch(e) { console.warn('Audio init failed:', e); }
  }

  function resume() { if (ctx?.state === 'suspended') ctx.resume(); }
  function check()  { if (!settings.enabled || !initialized) return false; resume(); return true; }
  function midiFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ── Synthèse de base ─────────────────────────────────
  function makeGain(dest, val) {
    const g = ctx.createGain(); g.gain.value = val || 0.001;
    g.connect(dest || sfxGain); return g;
  }

  function tone(type, freq, gainVal, dur, dest, opts) {
    if (!check()) return;
    opts = opts || {};
    const g = makeGain(dest || sfxGain, 0.001);
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(opts.freqEnd, ctx.currentTime + dur * 0.8);
    o.connect(g);
    const now = ctx.currentTime;
    const atk = opts.atk || 0.008;
    g.gain.linearRampToValueAtTime(gainVal, now + atk);
    g.gain.setValueAtTime(gainVal, now + Math.max(atk + 0.01, dur * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + 0.05);
  }

  function noiseBurst(freq, gainVal, dur, dest) {
    if (!check()) return;
    const sz = Math.floor(ctx.sampleRate * Math.min(dur, 0.5));
    const buf = ctx.createBuffer(1, sz, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < sz; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sz, 1.5);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = 2;
    const g = makeGain(dest || sfxGain, gainVal);
    src.connect(filt); filt.connect(g); src.start();
  }

  function pad(freq, gainVal, dur, dest) {
    if (!check()) return;
    const g = makeGain(dest || musicGain, 0.001);
    const now = ctx.currentTime;
    g.gain.linearRampToValueAtTime(gainVal, now + 0.7);
    g.gain.setValueAtTime(gainVal, now + dur - 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    [0, 5, -4].forEach((det, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = freq; o.detune.value = det;
      o.connect(g); o.start(now); o.stop(now + dur + 0.15);
    });
  }

  // ── Pool d'attaques variées ───────────────────────────
  const ATKS = [
    function whip() { // Sifflement + impact
      tone('triangle', 720, 0.09, 0.10, null, {atk:0.002, freqEnd:350});
      tone('sine',     360, 0.05, 0.08, null, {atk:0.004});
    },
    function thud() { // Coup sourd grave
      tone('sine', 110, 0.16, 0.18, null, {atk:0.002, freqEnd:50});
      noiseBurst(180, 0.08, 0.06, null);
    },
    function slash() { // Tranchant + résonance
      noiseBurst(350, 0.10, 0.05, null);
      setTimeout(() => { if(check()) tone('sine', 520, 0.06, 0.10, null, {atk:0.003, freqEnd:300}); }, 25);
    },
    function chime() { // Cristallin léger
      tone('triangle', 880, 0.07, 0.12, null, {atk:0.003});
      tone('sine',     440, 0.04, 0.10, null, {atk:0.005});
      setTimeout(() => { if(check()) tone('triangle', 1320, 0.04, 0.07, null, {atk:0.002}); }, 40);
    },
    function arc() { // Arc magique
      tone('sine', 600, 0.08, 0.08, null, {atk:0.001, freqEnd:900});
      tone('triangle', 300, 0.05, 0.07, null, {atk:0.003});
    },
  ];
  let _lastAtk = -1;
  function randomAtk() {
    let v; do { v = Math.floor(Math.random() * ATKS.length); } while (v === _lastAtk && ATKS.length > 1);
    _lastAtk = v; return ATKS[v];
  }

  // ── SFX publics ──────────────────────────────────────
  const SFX = {
    basicAttack() { if (!check()) return; randomAtk()(); },

    enemyDeath() {
      if (!check()) return;
      noiseBurst(160, 0.18, 0.09, sfxGain);
      tone('sawtooth', 140, 0.14, 0.45, null, {atk:0.005, freqEnd:45});
      setTimeout(() => { if(check()) { tone('triangle', 880, 0.05, 0.12, null, {atk:0.003}); } }, 220);
    },

    hitReceived() {
      if (!check()) return;
      noiseBurst(220, 0.15, 0.06, sfxGain);
      tone('sawtooth', 160, 0.10, 0.14, null, {atk:0.002, freqEnd:80});
    },

    castSpell() {
      if (!check()) return;
      const g = makeGain(sfxGain, 0.001);
      const now = ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.18, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(260, now);
      o.frequency.exponentialRampToValueAtTime(720, now + 0.22);
      o.connect(g); o.start(now); o.stop(now + 0.55);
      [0.08, 0.17, 0.27].forEach((t, i) =>
        setTimeout(() => { if(check()) tone('triangle', 1100+i*150, 0.04, 0.09, null, {atk:0.002}); }, t*1000)
      );
    },

    heal() {
      if (!check()) return;
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => { if(check()) tone('sine', f, 0.09, 0.22, null, {atk:0.012, freqEnd:null}); }, i*55)
      );
    },

    lootPickup() {
      if (!check()) return;
      [880, 1108, 1318].forEach((f, i) =>
        setTimeout(() => { if(check()) tone('triangle', f, 0.11, 0.16, null, {atk:0.005}); }, i*42)
      );
    },

    purchase() {
      if (!check()) return;
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => { if(check()) tone('triangle', f, 0.09, 0.14, null, {atk:0.006}); }, i*36)
      );
    },

    levelUp() {
      if (!check()) return;
      const g = makeGain(sfxGain, 0.001);
      const now = ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.3, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      [261, 329, 392, 261, 329, 392, 523, 659, 784, 523, 784, 1046].forEach((f, i) =>
        setTimeout(() => { if(check()) tone('triangle', f, 0.20, 0.38, g, {atk:0.007}); }, i*55)
      );
    },

    portalEnter() {
      if (!check()) return;
      const g = makeGain(sfxGain, 0.001);
      const now = ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.25, now + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(55, now);
      o.frequency.exponentialRampToValueAtTime(260, now + 0.4);
      o.frequency.exponentialRampToValueAtTime(28, now + 1.3);
      o.connect(g); o.start(now); o.stop(now + 1.6);
      [0.08,0.3,0.55,0.8].forEach(t =>
        setTimeout(() => { if(check()) tone('sine', 700+Math.random()*450, 0.05, 0.12, null, {atk:0.005}); }, t*1000)
      );
    },

    victory() {
      if (!check()) return;
      const g = makeGain(sfxGain, 0.001);
      const now = ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.32, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
      [523,659,784,1046,1318,1046,1318,1568].forEach((f,i) =>
        setTimeout(() => { if(check()) tone('triangle', f, 0.22, 0.55, g, {atk:0.01}); }, i*88)
      );
    },

    bossPhase() {
      if (!check()) return;
      noiseBurst(75, 0.32, 0.14, sfxGain);
      tone('sawtooth', 50, 0.22, 0.85, null, {atk:0.01, freqEnd:28});
    },

    uiClick() {
      if (!check()) return;
      tone('sine', 660, 0.07, 0.07, null, {atk:0.002});
    },

    chatMessage() {
      if (!check()) return;
      tone('sine', 980, 0.05, 0.07, null, {atk:0.002});
      setTimeout(() => { if(check()) tone('sine', 1200, 0.04, 0.07, null, {atk:0.002}); }, 52);
    },

    equip() {
      if (!check()) return;
      tone('triangle', 440, 0.12, 0.18, null, {atk:0.004});
      setTimeout(() => { if(check()) tone('sine', 660, 0.09, 0.14, null, {atk:0.004}); }, 58);
    },

    cooldownFail() {
      if (!check()) return;
      tone('sawtooth', 175, 0.09, 0.10, null, {atk:0.003, freqEnd:120});
    },

    explosion() {
      if (!check()) return;
      noiseBurst(75, 0.38, 0.18, sfxGain);
      tone('sine', 50, 0.22, 0.75, null, {atk:0.005, freqEnd:22});
    },

    trade() {
      if (!check()) return;
      [659,784,987,784].forEach((f,i) =>
        setTimeout(() => { if(check()) tone('triangle', f, 0.10, 0.15, null, {atk:0.005}); }, i*48)
      );
    },

    footstep() {}, // Désactivé — trop répétitif
  };

  // ══════════════════════════════════════════════════════
  // MUSIQUE — Pads ambiants + Arpèges lents
  // ══════════════════════════════════════════════════════
  const SCALES = {
    eolien:   [0,2,3,5,7,8,10],
    phrygien: [0,1,3,5,7,8,10],
    lydien:   [0,2,4,6,7,9,11],
    dorien:   [0,2,3,5,7,9,10],
  };

  const TRACKS = {
    overworld: { root:45, scale:'eolien',   bpm:56, padDur:6.5, prog:[[0,3,7],[5,8,12],[3,7,10],[7,10,14]] },
    dungeon:   { root:41, scale:'phrygien', bpm:66, padDur:5.5, prog:[[0,3,6],[8,11,15],[5,8,12],[3,6,10]] },
    boss:      { root:38, scale:'phrygien', bpm:76, padDur:4.5, prog:[[0,3,7],[8,11,14],[5,8,12],[3,6,10]] },
    menu:      { root:52, scale:'lydien',   bpm:50, padDur:8.0, prog:[[0,4,7],[5,9,12],[7,11,14],[3,7,10]] },
  };

  function playMusic(trackId) {
    if (!settings.enabled) return;
    if (!initialized) init();
    if (!check()) return;
    if (currentTrack === trackId) return;
    stopMusic();
    currentTrack = trackId;
    _trackCfg = TRACKS[trackId];
    if (!_trackCfg) return;
    _chordIdx = 0; _arpStep = 0;

    // Pad initial immédiat
    _playChordPad(_chordIdx);
    _startDrone(_trackCfg);

    // Rotation accord
    _chordInterval = setInterval(() => {
      if (!check()) return;
      _chordIdx = (_chordIdx + 1) % _trackCfg.prog.length;
      _playChordPad(_chordIdx);
    }, _trackCfg.padDur * 1000);

    // Arpège
    const beatMs = (60 / _trackCfg.bpm) * 1000;
    _arpInterval = setInterval(_tickArp, beatMs);
  }

  function _playChordPad(idx) {
    if (!check() || !_trackCfg) return;
    const cfg = _trackCfg;
    const scale = SCALES[cfg.scale];
    cfg.prog[idx].slice(0, 2).forEach((deg, i) => {
      const note = cfg.root + (scale[deg % scale.length] || 0) + Math.floor(deg / scale.length) * 12;
      setTimeout(() => {
        if (check()) pad(midiFreq(note), 0.055 - i * 0.015, cfg.padDur * 0.92, musicGain);
      }, i * 130);
    });
  }

  function _tickArp() {
    if (!check() || !_trackCfg) return;
    if (Math.random() > 0.40) { _arpStep++; return; } // 40% de notes jouées
    const cfg = _trackCfg;
    const scale = SCALES[cfg.scale];
    const chord = cfg.prog[_chordIdx];
    const deg = chord[_arpStep % chord.length];
    const note = cfg.root + (scale[deg % scale.length] || 0) + 12 + Math.floor(deg / scale.length) * 12;
    tone('triangle', midiFreq(note), 0.030, 0.32, musicGain, {atk:0.018});
    _arpStep++;
  }

  function _startDrone(cfg) {
    stopAmbient();
    if (!check()) return;
    const r = midiFreq(cfg.root - 12);
    const now = ctx.currentTime;

    // Drone fondamental
    const o1 = ctx.createOscillator(); const g1 = makeGain(ambientGain, 0.001);
    o1.type = 'sine'; o1.frequency.value = r;
    const lfo = ctx.createOscillator(); const lg = ctx.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 1.2;
    lfo.connect(lg); lg.connect(o1.frequency);
    o1.connect(g1); o1.start(); lfo.start();
    g1.gain.linearRampToValueAtTime(0.11, now + 2.5);

    // Quinte douce
    const o2 = ctx.createOscillator(); const g2 = makeGain(ambientGain, 0.001);
    o2.type = 'triangle'; o2.frequency.value = r * 1.5;
    o2.connect(g2); o2.start();
    g2.gain.linearRampToValueAtTime(0.045, now + 3.5);

    // Shimmer aigu très faible
    const o3 = ctx.createOscillator(); const g3 = makeGain(ambientGain, 0.001);
    o3.type = 'sine'; o3.frequency.value = r * 8;
    const lfo2 = ctx.createOscillator(); const lg2 = ctx.createGain();
    lfo2.frequency.value = 0.18; lg2.gain.value = r * 0.1;
    lfo2.connect(lg2); lg2.connect(o3.frequency);
    o3.connect(g3); o3.start(); lfo2.start();
    g3.gain.linearRampToValueAtTime(0.014, now + 5);

    ambientNodes = [o1, o2, o3, lfo, lfo2];
  }

  function stopAmbient() {
    ambientNodes.forEach(n => { try { n.stop(); } catch {} });
    ambientNodes = [];
  }

  function stopMusic() {
    if (_chordInterval) { clearInterval(_chordInterval); _chordInterval = null; }
    if (_arpInterval)   { clearInterval(_arpInterval);   _arpInterval   = null; }
    stopAmbient();
    currentTrack = null; _trackCfg = null;
  }

  function setMasterVol(v)  { settings.masterVol  = +v; if(masterGain)  masterGain.gain.value  = +v; saveSettings(); }
  function setMusicVol(v)   { settings.musicVol   = +v; if(musicGain)   musicGain.gain.value   = +v; saveSettings(); }
  function setSfxVol(v)     { settings.sfxVol     = +v; if(sfxGain)     sfxGain.gain.value     = +v; saveSettings(); }
  function setAmbientVol(v) { settings.ambientVol = +v; if(ambientGain) ambientGain.gain.value = +v; saveSettings(); }

  function toggleEnabled() {
    settings.enabled = !settings.enabled;
    if (!settings.enabled) stopMusic();
    else { const t = currentTrack; currentTrack = null; if (t) playMusic(t); }
    saveSettings(); return settings.enabled;
  }

  function refreshSettingsUI() {
    const m = {'audio-master':settings.masterVol,'audio-music':settings.musicVol,'audio-sfx':settings.sfxVol,'audio-ambient':settings.ambientVol};
    for (const [id,val] of Object.entries(m)) {
      const el = document.getElementById(id); if(el) el.value = val;
      const lb = document.getElementById(id+'-val'); if(lb) lb.textContent = Math.round(val*100)+'%';
    }
    const b = document.getElementById('audio-toggle');
    if(b) b.textContent = settings.enabled ? '🔊 Son activé' : '🔇 Son désactivé';
  }

  return { init, resume, play: SFX, playMusic, stopMusic, setMasterVol, setMusicVol, setSfxVol, setAmbientVol, toggleEnabled, settings, refreshSettingsUI };
})();

document.addEventListener('click',  () => { AudioEngine.init(); AudioEngine.resume(); }, { once: true });
document.addEventListener('keydown', () => { AudioEngine.init(); AudioEngine.resume(); }, { once: true });