// Nihongo Mura — Procedural Japanese soundtrack, ambience and sound effects (Web Audio)

// ============================================================
//  AUDIO ENGINE (Web Audio API — procedural Japanese soundtrack)
//  Instruments: shakuhachi (尺八), koto (琴), shamisen (三味線),
//  Japanese percussion (太鼓 taiko, 鈴 suzu, 鉦 kane, 木魚 mokugyo)
// ============================================================
let audioCtx = null;
let audioMaster = null;
let soundEnabled = true;
let audioStarted = false;
let musicPlaying = false;
let musicGeneration = 0;
let musicNodes = [];

function ensureAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioMaster = audioCtx.createGain();
    audioMaster.gain.value = 0.5;
    audioMaster.connect(audioCtx.destination);
}

function resumeAudio() {
    if (!audioCtx) ensureAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!audioStarted) {
        audioStarted = true;
        startJapaneseMusic();
    }
}

// Start audio on first user interaction (autoplay policy)
['click','touchstart','keydown'].forEach(evt => {
    document.addEventListener(evt, resumeAudio, { once: true, passive: true });
});

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btn-sound');
    btn.classList.toggle('off', !soundEnabled);
    btn.setAttribute('aria-pressed', String(soundEnabled));
    if (soundEnabled) {
        resumeAudio();
        if (audioStarted && !musicPlaying) startJapaneseMusic();
    } else {
        stopJapaneseMusic();
    }
}

function stopJapaneseMusic() {
    if (!musicPlaying) return;
    musicPlaying = false;
    musicGeneration++;
    stopSeasonalAmbient();
    for (const node of musicNodes) {
        try {
            if (node.stop) node.stop();
        } catch (_) { /* already stopped */ }
        try {
            node.disconnect();
        } catch (_) {}
    }
    musicNodes = [];
    // Reset references so startJapaneseMusic can recreate them
    musicGainNode = null;
    droneOsc1 = null; droneOsc2 = null; droneFilt = null; droneGainNode = null; droneLfo = null;
    ambNoiseNode = null; ambFiltNode = null; ambGainNode = null; ambLfo = null; ambLfoGain = null;
    shakuhachiGainNode = null;
    kotoGainNode = null;
    shamisenGainNode = null;
}

// --- Utility: create noise buffer (cached by duration) ---
const _noiseBufferCache = {};
function createNoiseBuffer(duration) {
    // Round to nearest 0.01s to maximize cache hits
    const key = Math.round(duration * 100);
    if (_noiseBufferCache[key]) return _noiseBufferCache[key];
    const len = audioCtx.sampleRate * duration;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    _noiseBufferCache[key] = buf;
    return buf;
}

// --- ADAPTIVE MOOD-BASED JAPANESE MUSIC ENGINE ---
// Detects time-of-day + weather and smoothly transitions between musical moods
// Uses authentic Japanese scales and instrument simulations:
//   尺八 shakuhachi, 琴 koto, 三味線 shamisen

// Japanese scale definitions:
// In scale (陰音階 miyako-bushi): semitones 0,1,5,7,8 — e.g. C Db F G Ab
// Yo scale (陽音階): semitones 0,2,5,7,10 — e.g. C D F G Bb
// Hirajoshi scale: semitones 0,2,3,7,8 — e.g. C D Eb G Ab

// Helper: build scale from root frequency and semitone pattern across 2 octaves
function buildJapaneseScale(rootFreq, semitones) {
    const notes = [];
    for (let octave = 0; octave < 2; octave++) {
        for (const s of semitones) {
            notes.push(rootFreq * Math.pow(2, (s + octave * 12) / 12));
        }
    }
    return notes;
}

// Pre-built scales for each mood
const IN_SCALE_C4    = buildJapaneseScale(261.6, [0, 1, 5, 7, 8]);   // C4 root
const IN_SCALE_A3    = buildJapaneseScale(220,   [0, 1, 5, 7, 8]);   // A3 root (low register)
const IN_SCALE_E4    = buildJapaneseScale(329.6, [0, 1, 5, 7, 8]);   // E4 root (higher register)
const YO_SCALE_C4    = buildJapaneseScale(261.6, [0, 2, 5, 7, 10]);  // C4 root
const YO_SCALE_G3    = buildJapaneseScale(196,   [0, 2, 5, 7, 10]);  // G3 root (low register)
const HIRAJOSHI_C4   = buildJapaneseScale(261.6, [0, 2, 3, 7, 8]);   // C4 root
const HIRAJOSHI_C5   = buildJapaneseScale(523.3, [0, 2, 3, 7, 8]);   // C5 root (high crystalline)

// Mood definitions: each mood configures all music layers
const MUSIC_MOODS = {
    day: {
        bpm: 52, droneFreq: 65.4, droneDetune: 0.15, droneVol: 0.06, droneFilter: 200,
        // Yo scale (陽音階) — bright, positive, lively village
        scale: YO_SCALE_C4,
        shakuhachiVol: 0.22, shakuhachiInterval: [5, 10], noteDur: [0.3, 1.2], noteCount: [3, 6],
        kotoVol: 0.18, kotoInterval: [3, 7], kotoNotes: [3, 6],
        shamisenVol: 0.0, shamisenInterval: [20, 40], shamisenDur: [0, 0],
        percVol: 0.20, percPattern: 'village', hyoushigiVol: 0.08,
        ambVol: 0.04, ambFreq: 400, ambQ: 0.3, ambLfoRate: 0.10, ambLfoDepth: 0.02,
    },
    dawn: {
        bpm: 40, droneFreq: 82.4, droneDetune: 0.1, droneVol: 0.05, droneFilter: 160,
        // In scale (陰音階) higher register — serene morning
        scale: IN_SCALE_E4,
        shakuhachiVol: 0.26, shakuhachiInterval: [8, 16], noteDur: [0.8, 2.0], noteCount: [2, 4],
        kotoVol: 0.14, kotoInterval: [6, 14], kotoNotes: [2, 4],
        shamisenVol: 0.0, shamisenInterval: [30, 50], shamisenDur: [0, 0],
        percVol: 0.0, percPattern: 'none', hyoushigiVol: 0.0,
        ambVol: 0.06, ambFreq: 500, ambQ: 0.2, ambLfoRate: 0.05, ambLfoDepth: 0.02,
    },
    dusk: {
        bpm: 44, droneFreq: 55, droneDetune: 0.25, droneVol: 0.08, droneFilter: 140,
        // Hirajoshi scale — melancholic evening
        scale: HIRAJOSHI_C4,
        shakuhachiVol: 0.20, shakuhachiInterval: [7, 15], noteDur: [0.8, 2.0], noteCount: [2, 4],
        kotoVol: 0.16, kotoInterval: [5, 10], kotoNotes: [2, 5],
        shamisenVol: 0.16, shamisenInterval: [10, 20], shamisenDur: [2.0, 4.5],
        percVol: 0.08, percPattern: 'temple', hyoushigiVol: 0.0,
        ambVol: 0.05, ambFreq: 300, ambQ: 0.4, ambLfoRate: 0.07, ambLfoDepth: 0.02,
    },
    night: {
        bpm: 32, droneFreq: 55, droneDetune: 0.15, droneVol: 0.08, droneFilter: 100,
        // Sparse In scale low register — contemplative night
        scale: IN_SCALE_A3,
        shakuhachiVol: 0.0, shakuhachiInterval: [20, 40], noteDur: [1.5, 3.0], noteCount: [1, 2],
        kotoVol: 0.12, kotoInterval: [8, 18], kotoNotes: [1, 3],
        shamisenVol: 0.14, shamisenInterval: [12, 25], shamisenDur: [3.0, 6.0],
        percVol: 0.0, percPattern: 'none', hyoushigiVol: 0.0,
        ambVol: 0.05, ambFreq: 200, ambQ: 0.5, ambLfoRate: 0.03, ambLfoDepth: 0.03,
    },
    rain: {
        bpm: 46, droneFreq: 61.7, droneDetune: 0.35, droneVol: 0.07, droneFilter: 130,
        // In scale (陰音階) — wistful rain
        scale: IN_SCALE_C4,
        shakuhachiVol: 0.16, shakuhachiInterval: [8, 18], noteDur: [0.6, 1.8], noteCount: [2, 4],
        kotoVol: 0.20, kotoInterval: [4, 8], kotoNotes: [3, 6],
        shamisenVol: 0.12, shamisenInterval: [14, 28], shamisenDur: [2.0, 4.0],
        percVol: 0.06, percPattern: 'rain', hyoushigiVol: 0.12,
        ambVol: 0.035, ambFreq: 700, ambQ: 0.2, ambLfoRate: 0.20, ambLfoDepth: 0.025,
    },
    snow: {
        bpm: 30, droneFreq: 82.4, droneDetune: 0.1, droneVol: 0.06, droneFilter: 90,
        // High crystalline Hirajoshi — snowfall
        scale: HIRAJOSHI_C5,
        shakuhachiVol: 0.14, shakuhachiInterval: [14, 28], noteDur: [1.5, 3.5], noteCount: [1, 2],
        kotoVol: 0.16, kotoInterval: [10, 22], kotoNotes: [1, 3],
        shamisenVol: 0.10, shamisenInterval: [18, 35], shamisenDur: [3.0, 5.0],
        percVol: 0.0, percPattern: 'none', hyoushigiVol: 0.0,
        ambVol: 0.02, ambFreq: 280, ambQ: 0.6, ambLfoRate: 0.03, ambLfoDepth: 0.01,
    },
    fog: {
        bpm: 36, droneFreq: 55, droneDetune: 0.4, droneVol: 0.10, droneFilter: 100,
        // Sparse In scale — mysterious, like a Zen temple in mist
        scale: IN_SCALE_A3,
        shakuhachiVol: 0.10, shakuhachiInterval: [16, 30], noteDur: [2.0, 4.0], noteCount: [1, 2],
        kotoVol: 0.10, kotoInterval: [12, 24], kotoNotes: [1, 2],
        shamisenVol: 0.12, shamisenInterval: [15, 30], shamisenDur: [3.0, 6.0],
        percVol: 0.04, percPattern: 'temple', hyoushigiVol: 0.0,
        ambVol: 0.035, ambFreq: 180, ambQ: 0.8, ambLfoRate: 0.04, ambLfoDepth: 0.025,
    },
    wind: {
        bpm: 50, droneFreq: 65.4, droneDetune: 0.35, droneVol: 0.04, droneFilter: 160,
        // Yo scale (陽音階) — energetic, windswept
        scale: YO_SCALE_C4,
        shakuhachiVol: 0.12, shakuhachiInterval: [6, 14], noteDur: [0.2, 0.6], noteCount: [3, 5],
        kotoVol: 0.14, kotoInterval: [4, 9], kotoNotes: [3, 5],
        shamisenVol: 0.0, shamisenInterval: [20, 40], shamisenDur: [0, 0],
        percVol: 0.10, percPattern: 'wind', hyoushigiVol: 0.10,
        ambVol: 0.025, ambFreq: 450, ambQ: 0.15, ambLfoRate: 0.30, ambLfoDepth: 0.035,
    },
    storm: {
        bpm: 60, droneFreq: 49, droneDetune: 0.7, droneVol: 0.12, droneFilter: 220,
        // Low Yo scale — dramatic, thunderous matsuri drumming
        scale: YO_SCALE_G3,
        shakuhachiVol: 0.06, shakuhachiInterval: [5, 10], noteDur: [0.15, 0.4], noteCount: [3, 6],
        kotoVol: 0.10, kotoInterval: [3, 6], kotoNotes: [4, 8],
        shamisenVol: 0.0, shamisenInterval: [20, 40], shamisenDur: [0, 0],
        percVol: 0.45, percPattern: 'matsuri', hyoushigiVol: 0.15,
        ambVol: 0.04, ambFreq: 550, ambQ: 0.1, ambLfoRate: 0.45, ambLfoDepth: 0.045,
    },
};

let currentMood = 'day';
let musicGainNode = null;
// Adaptive nodes we can tweak at runtime
let droneOsc1 = null, droneOsc2 = null, droneFilt = null, droneGainNode = null, droneLfo = null;
let ambNoiseNode = null, ambFiltNode = null, ambGainNode = null, ambLfo = null, ambLfoGain = null;
let shakuhachiGainNode = null;
let kotoGainNode = null;
let shamisenGainNode = null;
let activeMoodParams = null;

function getMusicMood() {
    const h = gameHour;
    // Weather overrides (stronger weather = stronger mood)
    if (currentWeather !== 'clear' && weatherIntensity > 0.25) {
        if (currentWeather === 'rain' && weatherIntensity > 0.7) return 'storm';
        if (currentWeather === 'wind' && weatherIntensity > 0.7) return 'storm';
        if (currentWeather === 'rain') return 'rain';
        if (currentWeather === 'snow') return 'snow';
        if (currentWeather === 'fog') return 'fog';
        if (currentWeather === 'wind') return 'wind';
    }
    // Time of day
    if (h >= 21 || h < 4) return 'night';
    if (h >= 4 && h < 6) return 'dawn';
    if (h >= 18 && h < 21) return 'dusk';
    return 'day';
}

function startJapaneseMusic() {
    if (musicPlaying || !audioCtx) return;
    musicPlaying = true;

    currentMood = getMusicMood();
    activeMoodParams = { ...MUSIC_MOODS[currentMood] };

    // Master music gain
    musicGainNode = audioCtx.createGain();
    musicGainNode.gain.value = 0.20;
    musicGainNode.connect(audioMaster);
    musicNodes.push(musicGainNode);

    // Start all Japanese instrument layers
    startAdaptiveDrone(musicGainNode);
    startJapanesePercussion(musicGainNode);
    startShakuhachi(musicGainNode);
    startKoto(musicGainNode);
    startShamisen(musicGainNode);
    startAdaptiveAmbient(musicGainNode);

    // Mood check loop
    scheduleMoodCheck();
}

// === SEASONAL AMBIENT SOUNDSCAPE ===
let seasonalAmbientNodes = [];
let currentAmbientSeason = null;

function updateSeasonalAmbient() {
    if (!audioCtx || !musicPlaying || !soundEnabled) return;
    const season = getSeason ? getSeason() : 'spring';
    if (season === currentAmbientSeason) return;
    // Stop old seasonal sounds
    for (const n of seasonalAmbientNodes) {
        try { if (n.stop) n.stop(); } catch(_) {}
        try { n.disconnect(); } catch(_) {}
    }
    seasonalAmbientNodes = [];
    currentAmbientSeason = season;

    const dest = musicGainNode || audioMaster;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.06;
    gain.connect(dest);
    seasonalAmbientNodes.push(gain);

    if (season === 'spring') {
        // Bird chirps — high-freq filtered noise bursts (uguisu / Japanese bush warbler)
        const birdGain = audioCtx.createGain();
        birdGain.gain.value = 0.4;
        birdGain.connect(gain);
        seasonalAmbientNodes.push(birdGain);
        (function scheduleBirdChirp() {
            if (!musicPlaying || currentAmbientSeason !== 'spring') return;
            const t = audioCtx.currentTime;
            const freq = 2800 + Math.random() * 1200;
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.linearRampToValueAtTime(freq * 1.3, t + 0.05);
            osc.frequency.linearRampToValueAtTime(freq * 0.9, t + 0.12);
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.3, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(g);
            g.connect(birdGain);
            osc.start(t);
            osc.stop(t + 0.15);
            setTimeout(scheduleBirdChirp, 2000 + Math.random() * 5000);
        })();
    } else if (season === 'summer') {
        // === Enhanced Japanese summer: prominent cicadas (蝉 semi) ===
        // Primary cicada layer — loud sustained high-freq buzz (minminzemi)
        const cicada1 = audioCtx.createOscillator();
        cicada1.type = 'sawtooth';
        cicada1.frequency.value = 4200;
        const cicada1Filt = audioCtx.createBiquadFilter();
        cicada1Filt.type = 'bandpass';
        cicada1Filt.frequency.value = 4500;
        cicada1Filt.Q.value = 8;
        const cicada1Gain = audioCtx.createGain();
        cicada1Gain.gain.value = 0.14; // louder than before
        cicada1.connect(cicada1Filt);
        cicada1Filt.connect(cicada1Gain);
        cicada1Gain.connect(gain);
        // Pulsing LFO for cicada rhythm
        const lfo1 = audioCtx.createOscillator();
        lfo1.type = 'sine';
        lfo1.frequency.value = 0.3;
        const lfo1G = audioCtx.createGain();
        lfo1G.gain.value = 0.07;
        lfo1.connect(lfo1G);
        lfo1G.connect(cicada1Gain.gain);
        cicada1.start();
        lfo1.start();
        seasonalAmbientNodes.push(cicada1, cicada1Filt, cicada1Gain, lfo1, lfo1G);

        // Second cicada layer — slightly different frequency for realism (aburazemi)
        const cicada2 = audioCtx.createOscillator();
        cicada2.type = 'sawtooth';
        cicada2.frequency.value = 5800; // higher, different species
        const cicada2Filt = audioCtx.createBiquadFilter();
        cicada2Filt.type = 'bandpass';
        cicada2Filt.frequency.value = 6000;
        cicada2Filt.Q.value = 10;
        const cicada2Gain = audioCtx.createGain();
        cicada2Gain.gain.value = 0.10;
        cicada2.connect(cicada2Filt);
        cicada2Filt.connect(cicada2Gain);
        cicada2Gain.connect(gain);
        // Different pulse rate for this cicada species
        const lfo2 = audioCtx.createOscillator();
        lfo2.type = 'sine';
        lfo2.frequency.value = 0.18; // slower pulse
        const lfo2G = audioCtx.createGain();
        lfo2G.gain.value = 0.05;
        lfo2.connect(lfo2G);
        lfo2G.connect(cicada2Gain.gain);
        cicada2.start();
        lfo2.start();
        seasonalAmbientNodes.push(cicada2, cicada2Filt, cicada2Gain, lfo2, lfo2G);

        // 風鈴 fuurin (wind chime) — periodic high metallic ring
        const fuurinGain = audioCtx.createGain();
        fuurinGain.gain.value = 0.5;
        fuurinGain.connect(gain);
        seasonalAmbientNodes.push(fuurinGain);
        (function scheduleFuurin() {
            if (!musicPlaying || currentAmbientSeason !== 'summer') return;
            const t = audioCtx.currentTime;
            // High metallic sine with overtones
            const baseFreq = 2400 + Math.random() * 400;
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = baseFreq;
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.3, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
            osc.connect(g);
            g.connect(fuurinGain);
            osc.start(t);
            osc.stop(t + 1.5);
            // Metallic overtone
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = baseFreq * 2.7;
            const g2 = audioCtx.createGain();
            g2.gain.setValueAtTime(0, t);
            g2.gain.linearRampToValueAtTime(0.12, t + 0.005);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
            osc2.connect(g2);
            g2.connect(fuurinGain);
            osc2.start(t);
            osc2.stop(t + 0.8);
            // Schedule next fuurin ring (wind-driven, irregular)
            setTimeout(scheduleFuurin, 4000 + Math.random() * 10000);
        })();
    } else if (season === 'autumn') {
        // Wind through dry leaves — filtered noise
        const windNoise = audioCtx.createBufferSource();
        windNoise.buffer = createNoiseBuffer(10);
        windNoise.loop = true;
        const windFilt = audioCtx.createBiquadFilter();
        windFilt.type = 'bandpass';
        windFilt.frequency.value = 600;
        windFilt.Q.value = 0.5;
        const windGain = audioCtx.createGain();
        windGain.gain.value = 0.15;
        windNoise.connect(windFilt);
        windFilt.connect(windGain);
        windGain.connect(gain);
        // Slow sweep for rustling effect
        const sweepLfo = audioCtx.createOscillator();
        sweepLfo.type = 'sine';
        sweepLfo.frequency.value = 0.08;
        const sweepG = audioCtx.createGain();
        sweepG.gain.value = 300;
        sweepLfo.connect(sweepG);
        sweepG.connect(windFilt.frequency);
        windNoise.start();
        sweepLfo.start();
        seasonalAmbientNodes.push(windNoise, windFilt, windGain, sweepLfo, sweepG);

        // 鈴虫 suzumushi (bell cricket) — very high sine tone pulse
        const cricketGain = audioCtx.createGain();
        cricketGain.gain.value = 0.3;
        cricketGain.connect(gain);
        seasonalAmbientNodes.push(cricketGain);
        (function scheduleSuzumushi() {
            if (!musicPlaying || currentAmbientSeason !== 'autumn') return;
            const t = audioCtx.currentTime;
            // Bell cricket: rapid high-frequency pulse train (rin-rin-rin)
            const pulseCount = randInt(3, 6);
            for (let i = 0; i < pulseCount; i++) {
                const pt = t + i * 0.12;
                const freq = 4800 + Math.random() * 400; // very high sine
                const osc = audioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = freq;
                const pg = audioCtx.createGain();
                pg.gain.setValueAtTime(0, pt);
                pg.gain.linearRampToValueAtTime(0.2, pt + 0.01);
                pg.gain.exponentialRampToValueAtTime(0.001, pt + 0.08);
                osc.connect(pg);
                pg.connect(cricketGain);
                osc.start(pt);
                osc.stop(pt + 0.08);
            }
            setTimeout(scheduleSuzumushi, 3000 + Math.random() * 7000);
        })();
    }
    // Winter: intentional near-silence — just the existing music, no added ambient
}

function stopSeasonalAmbient() {
    for (const n of seasonalAmbientNodes) {
        try { if (n.stop) n.stop(); } catch(_) {}
        try { n.disconnect(); } catch(_) {}
    }
    seasonalAmbientNodes = [];
    currentAmbientSeason = null;
}

function scheduleMoodCheck() {
    if (!musicPlaying) return;
    updateSeasonalAmbient();
    const newMood = getMusicMood();
    if (newMood !== currentMood) {
        currentMood = newMood;
        transitionToMood(MUSIC_MOODS[newMood]);
    }
    setTimeout(scheduleMoodCheck, 2000);
}

function transitionToMood(m) {
    activeMoodParams = { ...m };
    const t = audioCtx.currentTime;
    const fade = 3.5; // seconds to cross-fade

    // Drone
    if (droneOsc1) {
        droneOsc1.frequency.linearRampToValueAtTime(m.droneFreq, t + fade);
        droneOsc2.frequency.linearRampToValueAtTime(m.droneFreq * 1.5, t + fade); // perfect 5th
        droneFilt.frequency.linearRampToValueAtTime(m.droneFilter, t + fade);
        droneGainNode.gain.linearRampToValueAtTime(m.droneVol, t + fade);
    }

    // Ambient
    if (ambFiltNode) {
        ambFiltNode.frequency.linearRampToValueAtTime(m.ambFreq, t + fade);
        ambFiltNode.Q.linearRampToValueAtTime(m.ambQ, t + fade);
        ambGainNode.gain.linearRampToValueAtTime(m.ambVol, t + fade);
        if (ambLfo) ambLfo.frequency.linearRampToValueAtTime(m.ambLfoRate, t + fade);
        if (ambLfoGain) ambLfoGain.gain.linearRampToValueAtTime(m.ambLfoDepth, t + fade);
    }

    // Shakuhachi volume
    if (shakuhachiGainNode) {
        shakuhachiGainNode.gain.linearRampToValueAtTime(m.shakuhachiVol, t + fade);
    }
    // Koto volume
    if (kotoGainNode) {
        kotoGainNode.gain.linearRampToValueAtTime(m.kotoVol, t + fade);
    }
    // Shamisen volume
    if (shamisenGainNode) {
        shamisenGainNode.gain.linearRampToValueAtTime(m.shamisenVol, t + fade);
    }
}

// === ADAPTIVE DRONE (ichigenkin-style open string resonance) ===
// Uses perfect 5th intervals, foundational Japanese tonal center
function startAdaptiveDrone(dest) {
    const m = activeMoodParams;
    droneGainNode = audioCtx.createGain();
    droneGainNode.gain.value = m.droneVol;
    droneGainNode.connect(dest);

    // Root tone — warm sine, like an open string resonance
    droneOsc1 = audioCtx.createOscillator();
    droneOsc1.type = 'sine';
    droneOsc1.frequency.value = m.droneFreq;
    droneFilt = audioCtx.createBiquadFilter();
    droneFilt.type = 'lowpass';
    droneFilt.frequency.value = m.droneFilter;
    droneFilt.Q.value = 1.5;
    droneOsc1.connect(droneFilt);
    droneFilt.connect(droneGainNode);
    droneOsc1.start();
    musicNodes.push(droneOsc1);

    // Perfect 5th above
    droneOsc2 = audioCtx.createOscillator();
    droneOsc2.type = 'triangle';
    droneOsc2.frequency.value = m.droneFreq * 1.5; // perfect 5th
    const filt2 = audioCtx.createBiquadFilter();
    filt2.type = 'lowpass';
    filt2.frequency.value = m.droneFilter * 0.7;
    filt2.Q.value = 1;
    const droneGain2 = audioCtx.createGain();
    droneGain2.gain.value = 0.4; // softer 5th
    droneOsc2.connect(filt2);
    filt2.connect(droneGain2);
    droneGain2.connect(droneGainNode);
    droneOsc2.start();
    musicNodes.push(droneOsc2);

    // Slow LFO for breathing quality (like shakuhachi long tone breath)
    droneLfo = audioCtx.createOscillator();
    droneLfo.type = 'sine';
    droneLfo.frequency.value = 0.06; // very slow breathing
    const lfoG = audioCtx.createGain();
    lfoG.gain.value = 30;
    droneLfo.connect(lfoG);
    lfoG.connect(droneFilt.frequency);
    droneLfo.start();
    musicNodes.push(droneLfo);
}

// === JAPANESE PERCUSSION (木魚 mokugyo, 拍子木 hyoushigi, 鉦 kane, 鈴 suzu, 太鼓 taiko) ===
function startJapanesePercussion(dest) {
    const percDest = audioCtx.createGain();
    percDest.gain.value = 1.0;
    percDest.connect(dest);
    musicNodes.push(percDest);
    schedulePercLoop(percDest, musicGeneration);
}

function schedulePercLoop(dest, gen) {
    if (gen !== musicGeneration) return;
    if (!audioCtx || !soundEnabled || !musicPlaying) { setTimeout(() => schedulePercLoop(dest, gen), 1000); return; }

    const m = activeMoodParams;
    const now = audioCtx.currentTime;
    const bpm = m.bpm;
    const beat = 60 / bpm;
    const barLen = beat * 4;
    const bars = 4;

    for (let bar = 0; bar < bars; bar++) {
        const bs = now + bar * barLen;

        if (m.percPattern === 'none') continue;

        if (m.percPattern === 'village') {
            // Lively village: mokugyo on beats, hyoushigi accents, occasional kane
            playMokugyo(bs, dest, m.percVol);
            playMokugyo(bs + beat * 2, dest, m.percVol);
            if (Math.random() < 0.4) playMokugyo(bs + beat, dest, m.percVol * 0.5);
            if (Math.random() < 0.3) playMokugyo(bs + beat * 3, dest, m.percVol * 0.5);
            playHyoushigi(bs + beat, dest, m.hyoushigiVol);
            playHyoushigi(bs + beat * 3, dest, m.hyoushigiVol);
            // Occasional kane on downbeat
            if (Math.random() < 0.15) playKane(bs, dest, m.percVol * 0.3);
            // Taiko on 1 and 3 softly
            playTaiko(bs, dest, m.percVol * 0.4);
            if (Math.random() < 0.6) playTaiko(bs + beat * 2, dest, m.percVol * 0.3);
            // Fill every 4th bar
            if (bar % 4 === 3 && Math.random() < 0.4) {
                playHyoushigi(bs + beat * 3.5, dest, m.hyoushigiVol * 0.7);
                playMokugyo(bs + beat * 3.25, dest, m.percVol * 0.4);
                playMokugyo(bs + beat * 3.75, dest, m.percVol * 0.4);
            }
        } else if (m.percPattern === 'temple') {
            // Contemplative: sparse mokugyo, occasional suzu (temple bell)
            if (Math.random() < 0.5) playMokugyo(bs, dest, m.percVol);
            if (Math.random() < 0.2) playMokugyo(bs + beat * 2, dest, m.percVol * 0.4);
            // Temple bell (suzu) every few bars
            if (bar % 4 === 0 && Math.random() < 0.4) playSuzu(bs, dest, m.percVol * 0.5);
        } else if (m.percPattern === 'rain') {
            // Rain on bamboo: gentle hyoushigi like raindrops, sparse mokugyo
            if (Math.random() < 0.4) playMokugyo(bs, dest, m.percVol * 0.5);
            for (let i = 0; i < 8; i++) {
                if (Math.random() < 0.35) playHyoushigi(bs + i * beat * 0.5, dest, m.hyoushigiVol * randFloat(0.3, 1.0));
            }
            if (bar % 4 === 0 && Math.random() < 0.3) playSuzu(bs, dest, m.percVol * 0.3);
        } else if (m.percPattern === 'wind') {
            // Driving wind: faster hyoushigi, energetic taiko
            playTaiko(bs, dest, m.percVol * 0.5);
            playTaiko(bs + beat * 2, dest, m.percVol * 0.4);
            if (Math.random() < 0.4) playTaiko(bs + beat * 1.5, dest, m.percVol * 0.25);
            playHyoushigi(bs + beat, dest, m.hyoushigiVol);
            playHyoushigi(bs + beat * 3, dest, m.hyoushigiVol);
            for (let i = 0; i < 4; i++) {
                if (Math.random() < 0.3) playHyoushigi(bs + i * beat + beat * 0.5, dest, m.hyoushigiVol * 0.5);
            }
        } else if (m.percPattern === 'matsuri') {
            // 祭り matsuri style: dramatic kane, rapid hyoushigi, heavy taiko
            playTaiko(bs, dest, m.percVol);
            playTaiko(bs + beat, dest, m.percVol * 0.7);
            playTaiko(bs + beat * 2, dest, m.percVol * 0.9);
            playTaiko(bs + beat * 3, dest, m.percVol * 0.6);
            playKane(bs, dest, m.percVol * 0.5);
            if (Math.random() < 0.5) playKane(bs + beat * 2, dest, m.percVol * 0.3);
            for (let i = 0; i < 8; i++) playHyoushigi(bs + i * beat * 0.5, dest, m.hyoushigiVol * (i % 2 === 0 ? 1.0 : 0.6));
            // Dramatic kane crash
            if (Math.random() < 0.2) {
                playKane(bs + beat * 3.5, dest, m.percVol * 0.7);
            }
            // Rapid taiko fill (連打 renda)
            if (bar % 4 === 3 && Math.random() < 0.5) {
                for (let j = 0; j < 6; j++) playTaiko(bs + beat * 3 + j * 0.08, dest, m.percVol * (0.4 + j * 0.1));
            }
        }
    }

    setTimeout(() => schedulePercLoop(dest, gen), (barLen * bars - 0.2) * 1000);
}

// 木魚 Mokugyo — wooden fish block (hollow, warm click — same instrument as muyu)
function playMokugyo(time, dest, vol) {
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol || 0.3, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    g.connect(dest);
    // Tuned wooden resonance
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 100, time);
    osc.frequency.exponentialRampToValueAtTime(400, time + 0.08);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 1200;
    filt.Q.value = 3;
    osc.connect(filt);
    filt.connect(g);
    osc.start(time);
    osc.stop(time + 0.12);
    osc.onended = () => { osc.disconnect(); filt.disconnect(); g.disconnect(); };
    // Click transient
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.4 * (vol || 0.3), time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 3000;
    nf.Q.value = 2;
    nf.connect(ng);
    ng.connect(dest);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.02);
    ns.connect(nf);
    ns.start(time);
    ns.stop(time + 0.02);
    ns.onended = () => { ns.disconnect(); nf.disconnect(); ng.disconnect(); };
}

// 拍子木 Hyoushigi — wooden clappers (bright, sharp crack)
function playHyoushigi(time, dest, vol) {
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol || 0.15, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    g.connect(dest);
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800 + Math.random() * 200, time);
    osc.frequency.exponentialRampToValueAtTime(1200, time + 0.03);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 2500;
    filt.Q.value = 4;
    osc.connect(filt);
    filt.connect(g);
    osc.start(time);
    osc.stop(time + 0.05);
    osc.onended = () => { osc.disconnect(); filt.disconnect(); g.disconnect(); };
}

// 鉦 Kane — hand bell (higher pitch than gong, brighter metallic ring)
function playKane(time, dest, vol) {
    const baseFreq = 580; // higher than Chinese gong, brighter
    const dur = 0.9;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol || 0.4, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    g.connect(dest);
    // Main tone — kane has less pitch bend than luo, brighter attack
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.05, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.1);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + dur);
    // Bright metallic overtones (higher and more prominent than gong)
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 3.2, time);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 3.0, time + 0.1);
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime((vol || 0.4) * 0.35, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.6);
    osc2.connect(g2);
    g2.connect(dest);
    osc2.start(time);
    osc2.stop(time + dur * 0.6);
    // High shimmer
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime((vol || 0.4) * 0.12, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.3);
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = baseFreq * 5;
    nf.Q.value = 3;
    nf.connect(ng);
    ng.connect(dest);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(dur * 0.3);
    ns.connect(nf);
    ns.start(time);
    ns.stop(time + dur * 0.3);
    osc.onended = () => { osc.disconnect(); g.disconnect(); osc2.disconnect(); g2.disconnect(); ns.disconnect(); nf.disconnect(); ng.disconnect(); };
}

// 鈴 Suzu — bright jingle bell (high, shimmering, quick decay)
function playSuzu(time, dest, vol) {
    const freq = 1800 + Math.random() * 400; // high, bright
    const dur = 1.8;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol || 0.3, time);
    g.gain.setValueAtTime((vol || 0.3) * 0.8, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    g.connect(dest);
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(g);
    osc.start(time);
    osc.stop(time + dur);
    // Bright overtone (jingle shimmer)
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.8;
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime((vol || 0.3) * 0.2, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.4);
    osc2.connect(g2);
    g2.connect(dest);
    osc2.start(time);
    osc2.stop(time + dur * 0.4);
    // Third overtone for bell character
    const osc3 = audioCtx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 4.2;
    const g3 = audioCtx.createGain();
    g3.gain.setValueAtTime((vol || 0.3) * 0.08, time);
    g3.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.2);
    osc3.connect(g3);
    g3.connect(dest);
    osc3.start(time);
    osc3.stop(time + dur * 0.2);
    osc.onended = () => { osc.disconnect(); g.disconnect(); osc2.disconnect(); g2.disconnect(); osc3.disconnect(); g3.disconnect(); };
}

// 太鼓 Taiko — Japanese drum (deep boom, longer sustain, characteristic "don" attack)
function playTaiko(time, dest, vol) {
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol || 0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.55); // longer sustain than gu
    g.connect(dest);
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, time); // deeper than Chinese gu
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.35);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.55);
    // "Don" attack — characteristic taiko strike transient (louder, wider band)
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.35 * (vol || 0.5), time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 300; // lower center for "don" character
    filt.Q.value = 0.8;
    filt.connect(ng);
    ng.connect(dest);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.06);
    ns.connect(filt);
    ns.start(time);
    ns.stop(time + 0.06);
    // Secondary body resonance (taiko has a deeper body hum)
    const bodyOsc = audioCtx.createOscillator();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(60, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(35, time + 0.4);
    const bodyG = audioCtx.createGain();
    bodyG.gain.setValueAtTime((vol || 0.5) * 0.3, time);
    bodyG.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    bodyOsc.connect(bodyG);
    bodyG.connect(dest);
    bodyOsc.start(time);
    bodyOsc.stop(time + 0.5);
    osc.onended = () => { osc.disconnect(); g.disconnect(); ns.disconnect(); filt.disconnect(); ng.disconnect(); bodyOsc.disconnect(); bodyG.disconnect(); };
}

// === 尺八 SHAKUHACHI (Japanese bamboo flute) ===
// Characterized by breathy tone, slow vibrato, wide pitch bends (meri/kari technique),
// and prominent breath/air noise component
function startShakuhachi(dest) {
    shakuhachiGainNode = audioCtx.createGain();
    shakuhachiGainNode.gain.value = activeMoodParams.shakuhachiVol;
    shakuhachiGainNode.connect(dest);
    musicNodes.push(shakuhachiGainNode);

    let lastNoteIdx = -1;
    const gen = musicGeneration;

    function playShakuhachiPhrase() {
        if (gen !== musicGeneration) return;
        if (!audioCtx || !musicPlaying) return;
        const m = activeMoodParams;
        if (m.shakuhachiVol <= 0) { setTimeout(playShakuhachiPhrase, 5000); return; }
        const scale = m.scale;
        const now = audioCtx.currentTime;
        const noteCount = randInt(m.noteCount[0], m.noteCount[1]);
        let t = now + randFloat(0.1, 0.4);

        // Shakuhachi melodic contours: contemplative, with space between notes
        const contours = ['asc', 'desc', 'arch', 'valley', 'step_down', 'random'];
        const contour = randEl(contours);

        for (let i = 0; i < noteCount; i++) {
            let noteIdx;
            if (contour === 'asc') {
                noteIdx = Math.min(scale.length - 1, Math.floor((i / noteCount) * scale.length));
            } else if (contour === 'desc') {
                noteIdx = Math.max(0, Math.floor(((noteCount - 1 - i) / noteCount) * scale.length));
            } else if (contour === 'arch') {
                const pos = i / (noteCount - 1 || 1);
                noteIdx = Math.floor((1 - Math.abs(pos * 2 - 1)) * (scale.length - 1));
            } else if (contour === 'valley') {
                const pos = i / (noteCount - 1 || 1);
                noteIdx = Math.floor(Math.abs(pos * 2 - 1) * (scale.length - 1));
            } else if (contour === 'step_down') {
                // Descending pattern with repeated notes
                noteIdx = Math.max(0, scale.length - 1 - Math.floor(i / 2));
            } else {
                do { noteIdx = randInt(0, scale.length - 1); } while (noteIdx === lastNoteIdx && scale.length > 2);
            }
            noteIdx = Math.max(0, Math.min(scale.length - 1, noteIdx + randInt(-1, 1)));
            lastNoteIdx = noteIdx;

            const freq = scale[noteIdx];
            const dur = randFloat(m.noteDur[0], m.noteDur[1]);

            // Grace note (less frequent than dizi — shakuhachi is more contemplative)
            if (i > 0 && Math.random() < 0.25) {
                const graceIdx = Math.max(0, noteIdx + randEl([-1, 1, -2]));
                const graceFreq = scale[Math.min(scale.length - 1, Math.max(0, graceIdx))];
                playShakuhachiNote(t, graceFreq, 0.08, shakuhachiGainNode, 0.25);
                t += 0.09;
            }

            // メリ/カリ meri/kari — wide pitch bend (characteristic shakuhachi technique, 40% chance)
            const slideFrom = (i > 0 && Math.random() < 0.4) ? freq * randFloat(0.85, 1.15) : freq;
            playShakuhachiNote(t, freq, dur, shakuhachiGainNode, 0.5, slideFrom);
            t += dur + randFloat(0.05, 0.2);
        }

        // Long sustained note with wide vibrato (ロビキ robiki — sustained tone)
        if (Math.random() < 0.3) {
            const holdFreq = scale[randInt(0, 2)];
            const holdDur = randFloat(2.0, 4.0);
            t += randFloat(0.3, 0.6);
            playShakuhachiNote(t, holdFreq, holdDur, shakuhachiGainNode, 0.35, null, true);
        }

        const nextDelay = randFloat(m.shakuhachiInterval[0], m.shakuhachiInterval[1]) * 1000;
        setTimeout(playShakuhachiPhrase, nextDelay);
    }

    setTimeout(playShakuhachiPhrase, 3000);
}

function playShakuhachiNote(t, freq, dur, dest, vol, slideFrom, wideVibrato) {
    const noteGain = audioCtx.createGain();
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(vol, t + 0.06); // slower attack than dizi (breathy onset)
    noteGain.gain.setValueAtTime(vol * 0.85, t + dur * 0.5);
    noteGain.gain.linearRampToValueAtTime(0, t + dur);
    noteGain.connect(dest);

    // Main tone — purer than dizi, more fundamental-heavy
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    if (slideFrom && slideFrom !== freq) {
        // Wider, slower pitch bend than dizi (meri/kari technique)
        osc.frequency.setValueAtTime(slideFrom, t);
        osc.frequency.linearRampToValueAtTime(freq, t + 0.18); // slower slide
    } else {
        osc.frequency.value = freq;
    }

    // Subtle overtone (shakuhachi has a more hollow tone than dizi, less membrane buzz)
    const overtoneOsc = audioCtx.createOscillator();
    overtoneOsc.type = 'sine';
    overtoneOsc.frequency.value = freq * 2.003; // very slightly detuned 2nd harmonic
    const overtoneGain = audioCtx.createGain();
    overtoneGain.gain.setValueAtTime(0, t);
    overtoneGain.gain.linearRampToValueAtTime(vol * 0.06, t + 0.06); // less overtone than dizi
    overtoneGain.gain.linearRampToValueAtTime(0, t + dur);
    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(dest);
    overtoneOsc.start(t);
    overtoneOsc.stop(t + dur + 0.05);

    // Vibrato — slower and wider than dizi (shakuhachi yuri ユリ vibrato)
    const vib = audioCtx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = wideVibrato ? 3.5 + Math.random() * 1.0 : 4.0 + Math.random() * 1.0; // slower than dizi
    const vibG = audioCtx.createGain();
    vibG.gain.value = freq * (wideVibrato ? 0.025 : 0.012); // wider bends
    // Vibrato fades in gradually
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(freq * (wideVibrato ? 0.025 : 0.012), t + dur * 0.35);
    vib.connect(vibG);
    vibG.connect(osc.frequency);
    vib.start(t);
    vib.stop(t + dur + 0.1);

    // Breath/air noise — MORE prominent than dizi (shakuhachi's defining quality)
    const breathGain = audioCtx.createGain();
    breathGain.gain.setValueAtTime(0, t);
    breathGain.gain.linearRampToValueAtTime(0.16, t + 0.04); // higher noise component
    breathGain.gain.setValueAtTime(0.12, t + dur * 0.3);
    breathGain.gain.linearRampToValueAtTime(0, t + dur);
    const breathFilt = audioCtx.createBiquadFilter();
    breathFilt.type = 'bandpass';
    breathFilt.frequency.value = freq * 1.5; // lower center than dizi for warmer breath
    breathFilt.Q.value = 0.8; // wider band for more diffuse breath sound
    breathFilt.connect(breathGain);
    breathGain.connect(dest);
    const breathSrc = audioCtx.createBufferSource();
    breathSrc.buffer = createNoiseBuffer(dur + 0.1);
    breathSrc.connect(breathFilt);
    breathSrc.start(t);
    breathSrc.stop(t + dur);

    osc.connect(noteGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => { osc.disconnect(); noteGain.disconnect(); overtoneOsc.disconnect(); overtoneGain.disconnect(); vib.disconnect(); vibG.disconnect(); breathSrc.disconnect(); breathFilt.disconnect(); breathGain.disconnect(); };
}

// === 琴 KOTO (13-string plucked zither) ===
// Harder pluck attack than guzheng, slightly less sustain,
// deliberate spacing in arpeggios
function startKoto(dest) {
    kotoGainNode = audioCtx.createGain();
    kotoGainNode.gain.value = activeMoodParams.kotoVol;
    kotoGainNode.connect(dest);
    musicNodes.push(kotoGainNode);

    const gen = musicGeneration;

    function playKotoPhrase() {
        if (gen !== musicGeneration) return;
        if (!audioCtx || !musicPlaying) return;
        const m = activeMoodParams;
        if (m.kotoVol <= 0) { setTimeout(playKotoPhrase, 5000); return; }
        const scale = m.scale;
        const now = audioCtx.currentTime;
        const noteCount = randInt(m.kotoNotes[0], m.kotoNotes[1]);
        let t = now + randFloat(0.1, 0.3);

        // Koto plays arpeggios, single plucks, tremolo, or glissando
        const style = randEl(['arpeggio', 'melody', 'tremolo', 'gliss']);

        if (style === 'gliss' && noteCount >= 3) {
            // 流し nagashi — glissando across strings (more deliberate spacing than guzheng)
            const ascending = Math.random() < 0.5;
            for (let i = 0; i < Math.min(noteCount, scale.length); i++) {
                const idx = ascending ? i : (scale.length - 1 - i);
                const safeIdx = Math.max(0, Math.min(scale.length - 1, idx));
                playKotoPluck(t, scale[safeIdx], kotoGainNode, 0.35);
                t += randFloat(0.08, 0.16); // slightly more deliberate than guzheng
            }
        } else if (style === 'tremolo') {
            // 連 ren — tremolo on single note
            const freq = scale[randInt(0, scale.length - 1)];
            const repeats = randInt(6, 12);
            for (let i = 0; i < repeats; i++) {
                playKotoPluck(t, freq, kotoGainNode, 0.25 * (1 - i * 0.03));
                t += randFloat(0.08, 0.12);
            }
        } else if (style === 'arpeggio') {
            // Broken chord arpeggio
            const startIdx = randInt(0, Math.max(0, scale.length - 3));
            for (let i = 0; i < Math.min(noteCount, 4); i++) {
                const idx = Math.min(scale.length - 1, startIdx + i);
                playKotoPluck(t, scale[idx], kotoGainNode, 0.4);
                t += randFloat(0.18, 0.40); // more deliberate spacing
            }
        } else {
            // Melodic single plucks
            for (let i = 0; i < noteCount; i++) {
                const idx = randInt(0, scale.length - 1);
                const freq = scale[idx];
                const bend = Math.random() < 0.25; // 押し手 oshide — press bend
                playKotoPluck(t, freq, kotoGainNode, 0.4, bend);
                t += randFloat(0.3, 0.8);
            }
        }

        const nextDelay = randFloat(m.kotoInterval[0], m.kotoInterval[1]) * 1000;
        setTimeout(playKotoPhrase, nextDelay);
    }

    setTimeout(playKotoPhrase, 4000);
}

function playKotoPluck(t, freq, dest, vol, bend) {
    const dur = randFloat(0.6, 1.4); // slightly less sustain than guzheng
    const noteGain = audioCtx.createGain();
    // Harder attack than guzheng, sharper transient
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(vol, t + 0.003); // faster attack
    noteGain.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.12);
    noteGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noteGain.connect(dest);

    // Fundamental
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (bend) {
        // 押し手 oshide — characteristic koto pitch bend (up then back)
        osc.frequency.linearRampToValueAtTime(freq * 1.06, t + 0.2);
        osc.frequency.linearRampToValueAtTime(freq, t + 0.5);
    }
    osc.connect(noteGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);

    // 2nd harmonic (bright koto character)
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(vol * 0.28, t + 0.003); // stronger 2nd harmonic
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.45);
    osc2.connect(g2);
    g2.connect(dest);
    osc2.start(t);
    osc2.stop(t + dur * 0.45);

    // 3rd harmonic (shimmer)
    const osc3 = audioCtx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 3;
    const g3 = audioCtx.createGain();
    g3.gain.setValueAtTime(0, t);
    g3.gain.linearRampToValueAtTime(vol * 0.10, t + 0.003);
    g3.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.25);
    osc3.connect(g3);
    g3.connect(dest);
    osc3.start(t);
    osc3.stop(t + dur * 0.25);

    // String noise (pluck transient — sharper than guzheng)
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(vol * 0.25, t); // louder transient
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = freq * 3;
    nf.Q.value = 1;
    nf.connect(ng);
    ng.connect(dest);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.025);
    ns.connect(nf);
    ns.start(t);
    ns.stop(t + 0.025);
    osc.onended = () => { osc.disconnect(); noteGain.disconnect(); osc2.disconnect(); g2.disconnect(); osc3.disconnect(); g3.disconnect(); ns.disconnect(); nf.disconnect(); ng.disconnect(); };
}

// === 三味線 SHAMISEN (3-string plucked lute with bachi pick) ===
// Sharp percussive bachi strike, short sustain, characteristic sawari buzz (distortion)
// Unlike erhu (bowed/sustained), shamisen is plucked with sharp transients
function startShamisen(dest) {
    shamisenGainNode = audioCtx.createGain();
    shamisenGainNode.gain.value = activeMoodParams.shamisenVol;
    shamisenGainNode.connect(dest);
    musicNodes.push(shamisenGainNode);

    const gen = musicGeneration;

    function playShamisenPhrase() {
        if (gen !== musicGeneration) return;
        if (!audioCtx || !musicPlaying) return;
        const m = activeMoodParams;
        if (m.shamisenVol <= 0 || m.shamisenDur[1] <= 0) { setTimeout(playShamisenPhrase, 8000); return; }
        const scale = m.scale;
        const now = audioCtx.currentTime;
        let t = now + randFloat(0.2, 0.6);

        // Shamisen plays percussive melodic lines (1-4 notes per phrase)
        const noteCount = randInt(1, 4);
        let prevFreq = null;

        for (let i = 0; i < noteCount; i++) {
            const idx = randInt(0, scale.length - 1);
            const freq = scale[idx];
            const dur = randFloat(m.shamisenDur[0], m.shamisenDur[1]);
            playShamisenNote(t, freq, dur, shamisenGainNode, 0.45, prevFreq);
            prevFreq = freq;
            t += dur * 0.7 + randFloat(0.1, 0.3); // notes overlap less — percussive style
        }

        const nextDelay = randFloat(m.shamisenInterval[0], m.shamisenInterval[1]) * 1000;
        setTimeout(playShamisenPhrase, nextDelay);
    }

    setTimeout(playShamisenPhrase, 6000);
}

function playShamisenNote(t, freq, dur, dest, vol, slideFrom) {
    const noteGain = audioCtx.createGain();
    // Sharp bachi strike attack — much faster than erhu's bow attack
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(vol, t + 0.008); // very fast attack
    noteGain.gain.exponentialRampToValueAtTime(vol * 0.4, t + 0.15);
    noteGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noteGain.connect(dest);

    // Main tone — sawtooth for string character
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    if (slideFrom) {
        // Quick slide between notes (shamisen slides are shorter than erhu portamento)
        osc.frequency.setValueAtTime(slideFrom, t);
        osc.frequency.linearRampToValueAtTime(freq, t + 0.06);
    } else {
        osc.frequency.value = freq;
    }

    // Filter to shape shamisen tone
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq * 4;
    filt.Q.value = 1.5;
    osc.connect(filt);

    // さわり sawari buzz — characteristic shamisen resonance/distortion
    // Simulated with waveshaper (slight distortion on the signal)
    const waveshaper = audioCtx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        // Soft clipping with asymmetry for sawari character
        curve[i] = Math.tanh(x * 1.8) + 0.05 * Math.sin(x * 12);
    }
    waveshaper.curve = curve;
    waveshaper.oversample = '2x';
    filt.connect(waveshaper);

    // Resonance peak (sawari buzz emphasis)
    const sawariResonance = audioCtx.createBiquadFilter();
    sawariResonance.type = 'peaking';
    sawariResonance.frequency.value = freq * 1.02; // very close to fundamental
    sawariResonance.Q.value = 8;
    sawariResonance.gain.value = 4;
    waveshaper.connect(sawariResonance);
    sawariResonance.connect(noteGain);

    // Light vibrato (shamisen vibrato is subtle compared to erhu)
    const vib = audioCtx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 5.0 + Math.random() * 1.5;
    const vibG = audioCtx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(freq * 0.008, t + dur * 0.3); // subtle vibrato
    vib.connect(vibG);
    vibG.connect(osc.frequency);
    vib.start(t);
    vib.stop(t + dur + 0.1);

    // Bachi strike noise (percussive pluck transient — louder and sharper than bow noise)
    const strikeGain = audioCtx.createGain();
    strikeGain.gain.setValueAtTime(vol * 0.3, t); // loud strike
    strikeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    const strikeFilt = audioCtx.createBiquadFilter();
    strikeFilt.type = 'bandpass';
    strikeFilt.frequency.value = freq * 3;
    strikeFilt.Q.value = 0.8;
    strikeFilt.connect(strikeGain);
    strikeGain.connect(dest);
    const strikeSrc = audioCtx.createBufferSource();
    strikeSrc.buffer = createNoiseBuffer(0.04);
    strikeSrc.connect(strikeFilt);
    strikeSrc.start(t);
    strikeSrc.stop(t + 0.04);

    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => { osc.disconnect(); filt.disconnect(); waveshaper.disconnect(); sawariResonance.disconnect(); noteGain.disconnect(); vib.disconnect(); vibG.disconnect(); strikeSrc.disconnect(); strikeFilt.disconnect(); strikeGain.disconnect(); };
}

// === ADAPTIVE AMBIENT (nature sounds — wind through bamboo, distant water) ===
function startAdaptiveAmbient(dest) {
    const m = activeMoodParams;
    ambGainNode = audioCtx.createGain();
    ambGainNode.gain.value = m.ambVol;
    ambGainNode.connect(dest);

    // Bamboo wind / nature ambient layer
    ambNoiseNode = audioCtx.createBufferSource();
    ambNoiseNode.buffer = createNoiseBuffer(8);
    ambNoiseNode.loop = true;
    ambFiltNode = audioCtx.createBiquadFilter();
    ambFiltNode.type = 'bandpass';
    ambFiltNode.frequency.value = m.ambFreq;
    ambFiltNode.Q.value = m.ambQ;
    ambNoiseNode.connect(ambFiltNode);
    ambFiltNode.connect(ambGainNode);
    ambNoiseNode.start();
    musicNodes.push(ambNoiseNode);

    // Slow breathing LFO (like wind through bamboo grove)
    ambLfo = audioCtx.createOscillator();
    ambLfo.type = 'sine';
    ambLfo.frequency.value = m.ambLfoRate;
    ambLfoGain = audioCtx.createGain();
    ambLfoGain.gain.value = m.ambLfoDepth;
    ambLfo.connect(ambLfoGain);
    ambLfoGain.connect(ambGainNode.gain);
    ambLfo.start();
    musicNodes.push(ambLfo);

    // Optional: distant water/stream sound (higher frequency band)
    const waterGain = audioCtx.createGain();
    waterGain.gain.value = m.ambVol * 0.3;
    waterGain.connect(dest);
    const waterNoise = audioCtx.createBufferSource();
    waterNoise.buffer = createNoiseBuffer(10);
    waterNoise.loop = true;
    const waterFilt = audioCtx.createBiquadFilter();
    waterFilt.type = 'bandpass';
    waterFilt.frequency.value = 2500;
    waterFilt.Q.value = 0.3;
    waterNoise.connect(waterFilt);
    waterFilt.connect(waterGain);
    waterNoise.start();
    musicNodes.push(waterNoise);

    // Water LFO (gentle babbling)
    const waterLfo = audioCtx.createOscillator();
    waterLfo.type = 'sine';
    waterLfo.frequency.value = 0.15;
    const waterLfoG = audioCtx.createGain();
    waterLfoG.gain.value = m.ambVol * 0.15;
    waterLfo.connect(waterLfoG);
    waterLfoG.connect(waterGain.gain);
    waterLfo.start();
    musicNodes.push(waterLfo);
}

// --- SOUND EFFECTS (Japanese-themed) ---
function sfx(type) {
    if (!audioCtx || !soundEnabled || !audioStarted) return;
    try {
        switch (type) {
            case 'speak': sfxSpeak(); break;
            case 'respond': sfxRespond(); break;
            case 'learn': sfxLearn(); break;
            case 'eat': sfxEat(); break;
            case 'drink': sfxDrink(); break;
            case 'sleep': sfxSleep(); break;
            case 'craft': sfxCraft(); break;
            case 'chop': sfxChop(); break;
            case 'fire': sfxFire(); break;
            case 'gather': sfxGather(); break;
            case 'fish': sfxFish(); break;
            case 'step': sfxStep(); break;
        }
    } catch(e) { /* ignore audio errors */ }
}

function sfxSpeak() {
    // Tonal Japanese-like vocal
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    g.connect(audioMaster);

    // Japanese pitch accent — simulate rising/falling patterns
    const baseF = randFloat(130, 180);
    const tone = randInt(1, 4);
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseF, t);
    if (tone === 1) { // high flat
        osc.frequency.linearRampToValueAtTime(baseF * 1.2, t + 0.05);
        osc.frequency.setValueAtTime(baseF * 1.2, t + 0.3);
    } else if (tone === 2) { // rising
        osc.frequency.linearRampToValueAtTime(baseF * 0.9, t + 0.05);
        osc.frequency.linearRampToValueAtTime(baseF * 1.35, t + 0.3);
    } else if (tone === 3) { // dipping
        osc.frequency.linearRampToValueAtTime(baseF * 0.75, t + 0.15);
        osc.frequency.linearRampToValueAtTime(baseF * 1.1, t + 0.3);
    } else { // falling
        osc.frequency.linearRampToValueAtTime(baseF * 1.3, t + 0.03);
        osc.frequency.linearRampToValueAtTime(baseF * 0.7, t + 0.3);
    }

    const f1 = audioCtx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = randEl([500, 700, 900]);
    f1.Q.value = 5;
    const f2 = audioCtx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = randEl([1400, 1800, 2200]);
    f2.Q.value = 5;

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(g);
    f2.connect(g);
    osc.start(t);
    osc.stop(t + 0.35);
}

function sfxRespond() {
    // Rising tone (acknowledging)
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    g.connect(audioMaster);

    const baseF = randFloat(200, 280);
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseF * 0.85, t);
    osc.frequency.linearRampToValueAtTime(baseF * 1.4, t + 0.25);

    const f1 = audioCtx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 800;
    f1.Q.value = 4;
    osc.connect(f1);
    f1.connect(g);
    osc.start(t);
    osc.stop(t + 0.3);

    // Small koto pluck accent
    const pluckOsc = audioCtx.createOscillator();
    pluckOsc.type = 'triangle';
    pluckOsc.frequency.value = randEl([523.3, 587.3, 392]);
    const pluckG = audioCtx.createGain();
    pluckG.gain.setValueAtTime(0.12, t);
    pluckG.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    pluckOsc.connect(pluckG);
    pluckG.connect(audioMaster);
    pluckOsc.start(t);
    pluckOsc.stop(t + 0.3);
}

function sfxLearn() {
    // Ascending chime — like temple bells (鈴 suzu)
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    g.connect(audioMaster);

    // In scale ascending chime
    [523.3, 554.4, 698.5, 784, 830.6].forEach((freq, i) => {
        if (i > 2) return; // just first 3 for brevity
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0, t + i * 0.12);
        ng.gain.linearRampToValueAtTime(0.35, t + i * 0.12 + 0.01);
        ng.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.8);
        osc.connect(ng);
        ng.connect(g);
        osc.start(t + i * 0.12);
        osc.stop(t + i * 0.12 + 0.8);
        // Overtone shimmer (bell quality)
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2.5;
        const ng2 = audioCtx.createGain();
        ng2.gain.setValueAtTime(0, t + i * 0.12);
        ng2.gain.linearRampToValueAtTime(0.08, t + i * 0.12 + 0.01);
        ng2.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.4);
        osc2.connect(ng2);
        ng2.connect(g);
        osc2.start(t + i * 0.12);
        osc2.stop(t + i * 0.12 + 0.4);
    });
}

function sfxEat() {
    // Chopstick clicks + chewing (箸 hashi)
    const t = audioCtx.currentTime;
    // Chopstick click first
    const cg = audioCtx.createGain();
    cg.gain.setValueAtTime(0.15, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    cg.connect(audioMaster);
    const cosc = audioCtx.createOscillator();
    cosc.type = 'triangle';
    cosc.frequency.setValueAtTime(2200, t);
    cosc.frequency.exponentialRampToValueAtTime(1800, t + 0.02);
    cosc.connect(cg);
    cosc.start(t);
    cosc.stop(t + 0.04);
    // Chewing sounds
    for (let i = 0; i < 3; i++) {
        const ct = t + 0.06 + i * 0.11;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.18, ct);
        g.gain.exponentialRampToValueAtTime(0.001, ct + 0.07);
        const filt = audioCtx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 1200 + Math.random() * 800;
        filt.Q.value = 1.5;
        filt.connect(g);
        g.connect(audioMaster);
        const ns = audioCtx.createBufferSource();
        ns.buffer = createNoiseBuffer(0.07);
        ns.connect(filt);
        ns.start(ct);
        ns.stop(ct + 0.07);
    }
}

function sfxDrink() {
    // Tea sipping (お茶 ocha) — ceramic cup clink + sip
    const t = audioCtx.currentTime;
    // Ceramic cup clink
    const clinkG = audioCtx.createGain();
    clinkG.gain.setValueAtTime(0.12, t);
    clinkG.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    clinkG.connect(audioMaster);
    const clinkOsc = audioCtx.createOscillator();
    clinkOsc.type = 'sine';
    clinkOsc.frequency.value = 1800 + Math.random() * 400;
    clinkOsc.connect(clinkG);
    clinkOsc.start(t);
    clinkOsc.stop(t + 0.2);
    // Sip sounds
    for (let i = 0; i < 2; i++) {
        const gt = t + 0.1 + i * 0.18;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.2, gt);
        g.gain.exponentialRampToValueAtTime(0.001, gt + 0.12);
        g.connect(audioMaster);
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280 + i * 30, gt);
        osc.frequency.exponentialRampToValueAtTime(160, gt + 0.08);
        osc.connect(g);
        osc.start(gt);
        osc.stop(gt + 0.12);
        // Liquid noise
        const ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0.08, gt);
        ng.gain.exponentialRampToValueAtTime(0.001, gt + 0.08);
        const filt = audioCtx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 600;
        filt.Q.value = 3;
        filt.connect(ng);
        ng.connect(audioMaster);
        const ns = audioCtx.createBufferSource();
        ns.buffer = createNoiseBuffer(0.08);
        ns.connect(filt);
        ns.start(gt);
        ns.stop(gt + 0.08);
    }
}

function sfxSleep() {
    // Soft descending lullaby tone
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    g.connect(audioMaster);
    // Descending In scale: G → F → Db
    [392, 349.2, 277.2].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0, t + i * 0.25);
        ng.gain.linearRampToValueAtTime(0.15, t + i * 0.25 + 0.05);
        ng.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.5);
        osc.connect(ng);
        ng.connect(g);
        osc.start(t + i * 0.25);
        osc.stop(t + i * 0.25 + 0.5);
    });
}

function sfxCraft() {
    // Calligraphy brush / crafting (書道 shodou) — soft circular grinding
    const t = audioCtx.currentTime;
    // Grinding sound
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 600;
    filt.Q.value = 2;
    filt.connect(g);
    g.connect(audioMaster);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.4);
    ns.connect(filt);
    ns.start(t);
    ns.stop(t + 0.4);
    // Stone clink accent
    const sg = audioCtx.createGain();
    sg.gain.setValueAtTime(0.15, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    sg.connect(audioMaster);
    const sosc = audioCtx.createOscillator();
    sosc.type = 'triangle';
    sosc.frequency.setValueAtTime(900, t);
    sosc.frequency.exponentialRampToValueAtTime(500, t + 0.05);
    sosc.connect(sg);
    sosc.start(t);
    sosc.stop(t + 0.08);
}

function sfxChop() {
    // Bamboo chopping (竹割り takezawari) — hollow bamboo impact
    const t = audioCtx.currentTime;
    // Bamboo resonance (hollow, higher than wood)
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    g.connect(audioMaster);
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.1);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 800;
    filt.Q.value = 3;
    osc.connect(filt);
    filt.connect(g);
    osc.start(t);
    osc.stop(t + 0.18);
    // Impact crack
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 2000;
    nf.connect(ng);
    ng.connect(audioMaster);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.05);
    ns.connect(nf);
    ns.start(t);
    ns.stop(t + 0.05);
}

function sfxFire() {
    // Cooking / charcoal crackling (料理 ryouri)
    const t = audioCtx.currentTime;
    // Sizzle
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 2500;
    filt.connect(g);
    g.connect(audioMaster);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.5);
    ns.connect(filt);
    ns.start(t);
    ns.stop(t + 0.5);
    // Charcoal pop
    const pg = audioCtx.createGain();
    pg.gain.setValueAtTime(0.1, t + 0.15);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    pg.connect(audioMaster);
    const posc = audioCtx.createOscillator();
    posc.type = 'sine';
    posc.frequency.setValueAtTime(400, t + 0.15);
    posc.frequency.exponentialRampToValueAtTime(100, t + 0.18);
    posc.connect(pg);
    posc.start(t + 0.15);
    posc.stop(t + 0.2);
}

function sfxGather() {
    // Leaf rustling / picking herbs (薬草摘み yakusou tsumi)
    const t = audioCtx.currentTime;
    // Leaf rustle
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 4000;
    filt.Q.value = 0.4;
    filt.connect(g);
    g.connect(audioMaster);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.3);
    ns.connect(filt);
    ns.start(t);
    ns.stop(t + 0.3);
    // Soft pluck (picking sound)
    const pg = audioCtx.createGain();
    pg.gain.setValueAtTime(0.1, t + 0.05);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    pg.connect(audioMaster);
    const posc = audioCtx.createOscillator();
    posc.type = 'triangle';
    posc.frequency.setValueAtTime(1200, t + 0.05);
    posc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
    posc.connect(pg);
    posc.start(t + 0.05);
    posc.stop(t + 0.15);
}

function sfxFish() {
    // Fishing splash + line (釣り tsuri)
    const t = audioCtx.currentTime;
    // Line cast whoosh
    const wg = audioCtx.createGain();
    wg.gain.setValueAtTime(0.1, t);
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const wf = audioCtx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.setValueAtTime(3000, t);
    wf.frequency.exponentialRampToValueAtTime(1000, t + 0.1);
    wf.Q.value = 0.5;
    wf.connect(wg);
    wg.connect(audioMaster);
    const wns = audioCtx.createBufferSource();
    wns.buffer = createNoiseBuffer(0.15);
    wns.connect(wf);
    wns.start(t);
    wns.stop(t + 0.15);
    // Water splash
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.22, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    g.connect(audioMaster);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.3);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(2000, t + 0.1);
    filt.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    filt.Q.value = 1;
    ns.connect(filt);
    filt.connect(g);
    ns.start(t + 0.1);
    ns.stop(t + 0.4);
}

function sfxStep() {
    // Soft footstep on stone/gravel path (石畳 ishidatami)
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 800;
    filt.connect(g);
    g.connect(audioMaster);
    const ns = audioCtx.createBufferSource();
    ns.buffer = createNoiseBuffer(0.07);
    ns.connect(filt);
    ns.start(t);
    ns.stop(t + 0.07);
    // Small gravel crunch
    const cg = audioCtx.createGain();
    cg.gain.setValueAtTime(0.04, t + 0.01);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    const cf = audioCtx.createBiquadFilter();
    cf.type = 'highpass';
    cf.frequency.value = 4000;
    cf.connect(cg);
    cg.connect(audioMaster);
    const cns = audioCtx.createBufferSource();
    cns.buffer = createNoiseBuffer(0.04);
    cns.connect(cf);
    cns.start(t + 0.01);
    cns.stop(t + 0.05);
}

// Map action IDs to SFX types
function sfxForAction(actionId) {
    if (!actionId) return;
    if (actionId.startsWith('eat')) sfx('eat');
    else if (actionId.startsWith('drink')) sfx('drink');
    else if (actionId.startsWith('sleep')) sfx('sleep');
    else if (actionId.startsWith('make') || actionId.startsWith('weave') || actionId === 'grind_ink') sfx('craft');
    else if (actionId === 'cut_bamboo') sfx('chop');
    else if (actionId.startsWith('pick') || actionId.startsWith('tend')) sfx('gather');
    else if (actionId.startsWith('cook') || actionId === 'brew_tea') sfx('fire');
    else if (actionId === 'fish_catch') sfx('fish');
    else if (actionId === 'carry_water') sfx('craft');
    else if (actionId.startsWith('write') || actionId.startsWith('paint') || actionId.startsWith('read')) sfx('craft');
}
