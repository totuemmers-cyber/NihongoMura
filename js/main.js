// Nihongo Mura — Start-up, the game loop and input handling

// ============================================================
//  INITIALIZATION
// ============================================================
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d', { alpha: false });

    // Build static vocabulary
    vocab = buildVocab();

    // Create world objects
    worldObjects = OBJECT_DEFS.map(d => ({ ...d }));

    // Cache frequently-looked-up objects
    cachedTeahouse = worldObjects.find(o => o.type === 'teahouse') || null;
    cachedBuildingObjects = worldObjects.filter(o => isObstacleType(o.type));

    // Try to load saved game
    const saveData = loadSaveData();
    if (saveData) {
        applySaveData(saveData);
        addLog('Spielstand geladen.', 'speak');
    } else {
        // Create fresh game
        const speakerPool = [...SPEAKER_NAMES];
        const learnerPool = [...LEARNER_NAMES];
        const npcPool = [...NPC_NAMES];
        const name1 = speakerPool.splice(randInt(0, speakerPool.length - 1), 1)[0];
        const name2 = learnerPool.splice(randInt(0, learnerPool.length - 1), 1)[0];

        const p1 = new Person(name1, 'speaker', '#5a8aaa');
        const p2 = new Person(name2, 'learner', '#aa7a4a');

        if (p2.geschick < p1.geschick) {
            p2.geschick = randInt(p1.geschick, 10);
        }

        persons = [p1, p2];

        const npcCount = randInt(2, 5);
        for (let i = 0; i < npcCount; i++) {
            const npcName = npcPool.splice(randInt(0, npcPool.length - 1), 1)[0];
            npcs.push(new NPC(npcName));
        }

        addLog(`${p1.name} (Einheimischer) — Ges:${p1.geschick} Neu:${p1.neugier} Soz:${p1.geselligkeit} Wah:${p1.wahrnehmung}`, 'speak');
        addLog(`${p2.name} (Reisender) — Ges:${p2.geschick} Neu:${p2.neugier} Soz:${p2.geselligkeit} Wah:${p2.wahrnehmung}`, 'learn');
        addLog(`${npcCount} weitere Stadtbewohner sind anwesend.`, 'speak');
        addLog('Willkommen in 日本語村 (Nihongo Mura)! Die Simulation beginnt …', 'speak');
    }

    // Nobody starts inside a building or the well (random spawns, older saves)
    for (const c of [...persons, ...npcs]) {
        const out = clampOutOfObstacles(c.x, c.y);
        if (out.x !== c.x || out.y !== c.y) {
            c.x = out.x; c.y = out.y;
            c.targetX = c.x; c.targetY = c.y;
            c.waypoints = [];
        }
    }

    // Japanese web fonts load in unicode slices: fetch the glyphs the tags use up front
    if (document.fonts && document.fonts.load) {
        const tagText = worldObjects.map(o => o.label).join('') + '台所庭園茶屋';
        const names = [...persons, ...npcs].map(c => c.name).join('') + SPEAKER_NAMES.join('') + NPC_NAMES.join('');
        Promise.all([
            document.fonts.load(`600 12px "Shippori Mincho"`, tagText),
            document.fonts.load(`700 12px "Shippori Mincho"`, tagText),
            document.fonts.load(`700 12px "Zen Maru Gothic"`, names + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzäöüÄÖÜß'),
            document.fonts.load(`500 12px "Zen Maru Gothic"`, 'abcdefghijklmnopqrstuvwxyz'),
        ]).catch(() => {});
    }

    // Spawn initial wildlife
    spawnWildlife();

    // Initialize discovery timer
    discoveryTimer = randFloat(5000, 12000);

    // Initial panel render
    renderCharPanel('char1-panel', persons[0]);
    renderCharPanel('char2-panel', persons[1]);
    renderVocabPanel();
    renderLog();

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    // Canvas follows its container (panel toggle, orientation, on-screen keyboard)
    if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(document.getElementById('canvas-wrap'));
    setupCameraInput();

    // Canvas click handler (objects + quiz)
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchend', function(e) {
        if (e.changedTouches && e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            handleCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
        }
    });

    // Start autosave
    setupAutosave();

    // Start game loop
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const wrap = document.getElementById('canvas-wrap');
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    dpr = effectiveDpr();
    _lastResizeAt = performance.now();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    configureCamera(rect.width, rect.height);
}

function togglePanel() {
    const panel = document.getElementById('panel');
    const open = panel.classList.toggle('open');
    document.getElementById('panel-toggle').setAttribute('aria-expanded', String(open));
}

// ============================================================
//  GAME LOOP
// ============================================================
let lastTime = 0;
let uiTimer = 0;
const _due = { mood: false, checks: false };
const _clocks = {};
function everyTicks(name, period, step) {
    const c = (_clocks[name] || 0) + step;
    if (c >= period) { _clocks[name] = c % period; return true; }
    _clocks[name] = c;
    return false;
}

// ---- Frame pacing, perf stats and adaptive resolution ----
const MAX_DPR = 2;                        // never more than 2 device pixels per CSS pixel
const QUALITY_LEVELS = [1, 0.8, 0.65];    // multipliers on the capped DPR, floored at 1 device px per CSS px
let qualityLevel = 0;
let _lastResizeAt = 0;
const perf = { lastRender: 0, avg: 0, slowSince: 0, fastSince: 0, drops: [0, 0, 0], ceiling: 0,
               work: [], frames: 0, windowStart: 0, hud: null, hudOn: false, hudLast: 0, fps: 0 };
function effectiveDpr() {
    const raw = window.devicePixelRatio || 1;
    return Math.max(Math.min(raw, 1), Math.min(raw, MAX_DPR) * QUALITY_LEVELS[qualityLevel]);
}
// Step resolution down when frames stay slow; back up after a long smooth stretch.
// A level we've had to leave twice becomes the ceiling, so it doesn't oscillate.
function adaptQuality(interval, now) {
    if (document.hidden || camera.drag || now - _lastResizeAt < 1500 || (window.devicePixelRatio || 1) <= 1) {
        perf.slowSince = perf.fastSince = 0;
        return;
    }
    perf.avg = perf.avg ? perf.avg * 0.94 + Math.min(interval, 100) * 0.06 : interval;
    if (perf.avg > 24 && qualityLevel < QUALITY_LEVELS.length - 1) {          // under ~42 fps
        perf.fastSince = 0;
        perf.slowSince = perf.slowSince || now;
        if (now - perf.slowSince > 2000) {
            if (++perf.drops[qualityLevel] >= 2) perf.ceiling = Math.max(perf.ceiling, qualityLevel + 1);
            qualityLevel++;
            perf.slowSince = 0; perf.avg = 0;
            resizeCanvas();
        }
    } else if (perf.avg < 18.5 && qualityLevel > perf.ceiling) {
        perf.slowSince = 0;
        perf.fastSince = perf.fastSince || now;
        if (now - perf.fastSince > 12000) {
            qualityLevel--;
            perf.fastSince = 0; perf.avg = 0;
            resizeCanvas();
        }
    } else {
        perf.slowSince = perf.fastSince = 0;
    }
}
function togglePerfHud(on) {
    perf.hudOn = on === undefined ? !perf.hudOn : on;
    if (perf.hudOn && !perf.hud) {
        perf.hud = document.createElement('div');
        perf.hud.id = 'perf-hud';
        perf.hud.setAttribute('aria-hidden', 'true');
        document.getElementById('canvas-wrap').appendChild(perf.hud);
    }
    if (perf.hud) perf.hud.style.display = perf.hudOn ? '' : 'none';
}
function updatePerfHud(now) {
    perf.frames++;
    if (!perf.windowStart) perf.windowStart = now;
    if (now - perf.windowStart < 500) return;
    perf.fps = perf.frames * 1000 / (now - perf.windowStart);
    perf.frames = 0; perf.windowStart = now;
    if (!perf.hudOn || !perf.hud) return;
    const w = perf.work.slice().sort((a, b) => a - b);
    const avg = w.reduce((a, b) => a + b, 0) / (w.length || 1), p95 = w[Math.floor(w.length * 0.95)] || 0;
    perf.hud.textContent =
        `${perf.fps.toFixed(0)} fps   script ${avg.toFixed(1)} ms (p95 ${p95.toFixed(1)})\n` +
        `res ${dpr.toFixed(2)}x  q${qualityLevel}  ${canvas.width}×${canvas.height}  scale ${canvasScale.toFixed(2)}\n` +
        `chars ${persons.length + npcs.length}  animals ${wildlife.length}  rain ${weatherParticles.length}  fx ${atmosParticles.length}`;
}

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop); // schedule next frame first, so exceptions don't kill the loop
    // On 90–144 Hz screens render at most ~60–72 fps (dragging the map stays at full rate)
    if (perf.lastRender && timestamp - perf.lastRender < 13.5 && !camera.drag) return;
    const frameInterval = perf.lastRender ? timestamp - perf.lastRender : 16.7;
    perf.lastRender = timestamp;
    const workStart = performance.now();
    _spriteBudgetEnd = workStart + 4;    // sprite builds this frame stop after ~4 ms
    // Cap the step: after the tab or app was in the background (no frames), carry on where it
    // stopped instead of simulating the whole gap in one go (needs dropped to 0, the clock raced ahead)
    const rawDt = lastTime ? Math.min(timestamp - lastTime, MAX_FRAME_MS) : 16;
    lastTime = timestamp;

    const dt = (rawDt / TICK_MS) * gameSpeed;

    gameTick += rawDt / TICK_MS;

    if (gameSpeed > 0) {
        // Periodic checks run on fixed real-time clocks (they used to depend on hitting exact tick numbers)
        _due.mood = everyTicks('mood', 30, rawDt / TICK_MS);
        _due.checks = everyTicks('checks', 100, rawDt / TICK_MS);

        // Update game time
        gameMinute += dt * 0.12;
        if (gameMinute >= 60) {
            gameMinute -= 60;
            gameHour++;
            if (gameHour >= 24) {
                gameHour = 0;
                gameDay++;
            }
        }

        // Update persons
        for (const p of persons) p.update(dt);
        // Update person moods periodically
        if (_due.mood) { for (const p of persons) p.mood = getMood(p); }

        // Update AI
        updateSpeakerAI(dt);
        updateLearnerAI(dt);

        // Update NPCs
        updateNPCs(dt);

        // Soft safety net: nudge characters out if stuck inside obstacles
        const allMovers = [...persons, ...npcs];
        for (const c of allMovers) {
            // River: push toward nearest bank decisively
            if (isInRiver(c.x) && Math.abs(c.y - BRIDGE.y) > BRIDGE.halfH + 35) {
                const pushDir = c.x < BRIDGE.x ? -1 : 1;
                c.x += pushDir * 4 * dt;
                // Snap out if close to edge to prevent oscillation
                if (pushDir < 0 && c.x > RIVER_LEFT && c.x < RIVER_LEFT + 12) c.x = RIVER_LEFT - 5;
                if (pushDir > 0 && c.x < RIVER_RIGHT && c.x > RIVER_RIGHT - 12) c.x = RIVER_RIGHT + 5;
            }
        }

        // Update wildlife
        updateWildlife(dt);

        // Update relationships
        updateRelationships(dt);

        // Update storytelling
        updateStorytelling(dt);

        // Update discoveries
        updateDiscoveries(dt);

        // Update speech bubbles
        speechBubbles = speechBubbles.filter(b => b.update(dt));

        // Update learn flashes and calligraphy overlays
        learnFlashes = learnFlashes.filter(f => f.update(dt));
        calligraphyOverlays = calligraphyOverlays.filter(c => c.update(dt));
        // Advance queue when current calligraphy finishes
        if (calligraphyOverlays.length === 0 && calligraphyQueue.length > 0) {
            _advanceCalligraphyQueue();
        }
        if (proverbOverlay && !proverbOverlay.update(dt)) proverbOverlay = null;

        // Update weather, atmospheric effects, boat, micro-events & NPC interactions
        updateWeather(dt);
        updateAtmospheric(dt);
        updateMicroEvents(dt);
        updateNpcInteractions(dt);

        // Check chengyu triggers (every ~100 ticks)
        if (_due.checks) { checkYojijukugoTriggers(); checkFestival(); }
        if (yojijukugoOverlay && !yojijukugoOverlay.update(dt)) yojijukugoOverlay = null;
        updateFestivalParticles(dt);

        // Update object tooltip
        updateObjectTooltip(dt);

        // Update object label glow
        if (activeObjectGlow) {
            activeObjectGlow.timer -= dt;
            if (activeObjectGlow.timer <= 0) activeObjectGlow = null;
        }
    }

    // Update quiz (uses rawDt for real-time timers)
    if (gameSpeed > 0) {
        updateQuiz(dt, rawDt);
    }

    // Render
    updateCamera(rawDt);
    // (no clear needed: the terrain layer covers the whole view)

    // --- World layer (camera transform) ---
    setWorldTransform(ctx);
    drawTerrain(ctx);
    drawShadows(ctx);

    // Y-sorted scene drawing — build draw list, sort by depth
    const drawList = [];
    for (const obj of worldObjects) {
        const isGround = GROUND_TYPES.includes(obj.type) || obj.type === 'bridge';
        drawList.push({ sortY: isGround ? -1e6 : obj.y + (VISUAL_BOTTOM[obj.type] || obj.h / 2), type: 'obj', ref: obj });
    }
    for (const d of campDecorations) drawList.push({ sortY: d.y + 8, type: 'camp', ref: d });
    for (const disc of discoveries) {
        if (!disc.found) drawList.push({ sortY: disc.y, type: 'disc', ref: disc });
    }
    for (const a of wildlife) drawList.push({ sortY: (a.type === 'magpie' || a.type === 'butterfly') ? 1e6 : a.y, type: 'wild', ref: a });
    for (const npc of npcs) drawList.push({ sortY: npc.y + CHAR_FOOT_Y, type: 'char', ref: npc });
    for (const p of persons) drawList.push({ sortY: p.y + CHAR_FOOT_Y, type: 'char', ref: p });
    drawList.sort((a, b) => a.sortY - b.sortY);
    _tagQueue = [];                       // tags are collected and drawn after the lighting
    for (const item of drawList) {
        switch (item.type) {
            case 'obj': drawObject(ctx, item.ref); break;
            case 'camp': drawCampDecoration(ctx, item.ref); break;
            case 'disc': drawDiscovery(ctx, item.ref); break;
            case 'wild': drawWildAnimal(ctx, item.ref); break;
            case 'char': drawPerson(ctx, item.ref); break;
        }
    }
    const deferredTags = _tagQueue;
    _tagQueue = null;
    drawMicroEventEffects(ctx);

    // Draw hearing range circle around speaker (subtle)
    ctx.beginPath();
    ctx.arc(persons[0].x * canvasScale, persons[0].y * canvasScale, persons[1].hearingRange * canvasScale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,140,180,0.12)';
    ctx.lineWidth = canvasScale;
    ctx.setLineDash([4 * canvasScale, 4 * canvasScale]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Atmosphere that should take on the light: mist, rain, snow
    drawAtmosphericEffects(ctx, 'ambient');
    drawMist(ctx);
    drawWeatherEffects(ctx);

    // Time-of-day colour grade + night light map, then what shines through it
    drawGrading(ctx);
    drawSky(ctx);
    drawRiverMoonlight(ctx);
    drawAtmosphericEffects(ctx, 'glow');
    drawFestivalEffects(ctx);

    // Readable UI over the world: tags, learn flashes, speech
    for (const t of deferredTags) drawTag(ctx, t[0], t[1], t[2], t[3], t[4]);
    drawFreezeIndicator(ctx, persons[1]);
    for (const f of learnFlashes) f.draw(ctx);
    for (const b of npcBubbles) b.draw(ctx);
    for (const b of speechBubbles) b.draw(ctx);

    // --- Screen layer ---
    setScreenTransform(ctx);

    // Calligraphy overlays (on top of weather/scene)
    for (const c of calligraphyOverlays) c.draw(ctx);
    if (proverbOverlay) proverbOverlay.draw(ctx);
    if (yojijukugoOverlay) yojijukugoOverlay.draw(ctx);

    // Object tooltip (anchored to a world object)
    setWorldTransform(ctx);
    drawObjectTooltip(ctx);

    // Quiz (UI layer, always visible)
    setScreenTransform(ctx);
    drawQuiz(ctx);

    // UI updates (throttled)
    // Fade command feedback
    if (commandFeedbackTimer > 0) {
        commandFeedbackTimer -= rawDt;
        if (commandFeedbackTimer <= 0) {
            const fb = document.getElementById('command-feedback');
            if (fb) fb.classList.remove('visible');
        }
    }

    uiTimer += rawDt;
    if (uiTimer > 250) {
        uiTimer = 0;
        renderCharPanel('char1-panel', persons[0]);
        renderCharPanel('char2-panel', persons[1]);
        renderVocabPanel();
        updateTimeDisplay();
    }

    perf.work.push(performance.now() - workStart);
    if (perf.work.length > 120) perf.work.shift();
    updatePerfHud(timestamp);
    adaptQuality(frameInterval, timestamp);
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.key === ' ') { setSpeed(gameSpeed === 0 ? 1 : 0); e.preventDefault(); }
    if (e.key === '1') setSpeed(1);
    if (e.key === '2') setSpeed(2);
    if (e.key === '3') setSpeed(3);
    if (e.key === 'm' || e.key === 'M') toggleSound();
    if (e.key === 'p' || e.key === 'P') togglePerfHud();
});
// Phones have no keyboard: ?perf or #perf in the URL turns the readout on
if (/[?&#]perf\b/.test(location.search + location.hash)) setTimeout(() => togglePerfHud(true), 0);

// iOS: prevent pinch-zoom, double-tap zoom, and bounce scrolling
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => {
    // Allow scrolling inside panel and scrollable lists
    const t = e.target;
    if (t.closest('#panel') || t.closest('.vocab-list') || t.closest('#event-log')) return;
    e.preventDefault();
}, { passive: false });

// Handle orientation change on iOS
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
    setTimeout(resizeCanvas, 300);
});

// Handle iOS visual viewport resize (keyboard, etc.)
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
}

// Start
init();
