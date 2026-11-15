// Nihongo Mura — Micro-events and multi-step villager interactions

// ============================================================
//  MICRO-EVENTS (random, routine-breaking happenings)
// ============================================================
let microEventTimer = randFloat(300, 600);
let activeMicroEvent = null;

const MICRO_EVENTS = [
    { id: 'chicken_chase',  weight: 3, minNpcs: 1 },
    { id: 'dropped_basket', weight: 3, minNpcs: 1 },
    { id: 'rare_stone',     weight: 2, minNpcs: 1 },
    { id: 'splash_well',    weight: 2, minNpcs: 1 },
    { id: 'cat_nap',        weight: 2, minNpcs: 0 },
    { id: 'big_fish',       weight: 2, minNpcs: 1 },
    { id: 'child_hide',     weight: 2, minNpcs: 2 },
];

function pickIdleNpc() {
    const idle = npcs.filter(n => n.state === 'idle');
    return idle.length > 0 ? idle[Math.floor(Math.random() * idle.length)] : null;
}

function triggerMicroEvent() {
    // Weighted random pick
    const totalW = MICRO_EVENTS.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * totalW;
    let chosen = MICRO_EVENTS[0];
    for (const e of MICRO_EVENTS) {
        roll -= e.weight;
        if (roll <= 0) { chosen = e; break; }
    }

    const idleCount = npcs.filter(n => n.state === 'idle').length;
    if (idleCount < chosen.minNpcs) return; // not enough idle NPCs

    switch (chosen.id) {
        case 'chicken_chase': {
            // An NPC chases a chicken — chicken runs away, NPC follows
            const npc = pickIdleNpc();
            if (!npc) return;
            const chicken = wildlife.find(w => w.type === 'rabbit' || w.type === 'crane'); // use any land animal
            npcBubbles.push(new SpeechBubble(npc, 'つかまえて！', [], false));
            // NPC runs around erratically
            activeMicroEvent = { id: 'chicken_chase', npc, timer: 180, phase: 0 };
            alertNearbyNPCs(npc.x, npc.y, 100, 80);
            break;
        }
        case 'dropped_basket': {
            // NPC drops something, makes a surprised sound, picks it up
            const npc = pickIdleNpc();
            if (!npc) return;
            npcBubbles.push(new SpeechBubble(npc, 'あっ！', [], false));
            activeMicroEvent = { id: 'dropped_basket', npc, timer: 160,
                itemX: npc.x + randFloat(-8, 8), itemY: npc.y + randFloat(5, 12), phase: 0 };
            alertNearbyNPCs(npc.x, npc.y, 80, 60);
            break;
        }
        case 'rare_stone': {
            // NPC finds a pretty stone and shows it around
            const npc = pickIdleNpc();
            if (!npc) return;
            npcBubbles.push(new SpeechBubble(npc, '見て！いい石だ！', [], false));
            activeMicroEvent = { id: 'rare_stone', npc, timer: 200, phase: 0 };
            // Nearby NPCs turn toward finder and react
            alertNearbyNPCs(npc.x, npc.y, 100, 100);
            for (const other of npcs) {
                if (other !== npc && Math.abs(other.x - npc.x) < 100 && Math.abs(other.y - npc.y) < 80) {
                    setTargetWithPath(other, npc.x + randFloat(-20, 20), npc.y + randFloat(-15, 15));
                    other.state = 'moving';
                    if (Math.random() < 0.4) npcBubbles.push(new SpeechBubble(other, randEl(NPC_REACTIONS), [], false));
                }
            }
            break;
        }
        case 'splash_well': {
            // NPC at the well — bucket falls, splash
            const npc = pickIdleNpc();
            if (!npc) return;
            const well = worldObjects.find(o => o.id === 'well1');
            if (!well) return;
            { const spot = standSpot(well, 0.5); setTargetWithPath(npc, spot.x, spot.y); }
            npc.state = 'moving';
            activeMicroEvent = { id: 'splash_well', npc, well, timer: 200, phase: 0 };
            alertNearbyNPCs(well.x, well.y, 90, 80);
            break;
        }
        case 'cat_nap': {
            // Cat finds a warm spot and naps — purely visual
            const cat = wildlife.find(w => w.type === 'cat');
            if (!cat) return;
            // Cat goes to a sunny spot near a building
            const spot = randEl(worldObjects.filter(o => o.type === 'house' || o.type === 'market'));
            if (!spot) return;
            cat.targetX = spot.x + randFloat(-15, 15);
            cat.targetY = spot.y + spot.h/2 + 5;
            activeMicroEvent = { id: 'cat_nap', cat, timer: 300, phase: 0 };
            break;
        }
        case 'big_fish': {
            // NPC at the fish pond gets excited about a big fish
            const npc = pickIdleNpc();
            if (!npc) return;
            const pond = worldObjects.find(o => o.id === 'fish_pond1');
            if (!pond) return;
            { const spot = standSpot(pond); setTargetWithPath(npc, spot.x, spot.y); }
            npc.state = 'moving';
            activeMicroEvent = { id: 'big_fish', npc, pond, timer: 200, phase: 0 };
            alertNearbyNPCs(pond.x, pond.y, 80, 70);
            break;
        }
        case 'child_hide': {
            // Two NPCs — one "hides" behind bamboo, other "seeks"
            const seeker = pickIdleNpc();
            if (!seeker) return;
            const hider = npcs.find(n => n !== seeker && n.state === 'idle');
            if (!hider) return;
            const bamboo = worldObjects.find(o => o.type === 'bamboo');
            if (!bamboo) return;
            setTargetWithPath(hider, bamboo.x + randFloat(-5, 5), bamboo.y + randFloat(-5, 5));
            hider.state = 'moving';
            npcBubbles.push(new SpeechBubble(seeker, 'どこにいるの？', [], false));
            activeMicroEvent = { id: 'child_hide', seeker, hider, bamboo, timer: 250, phase: 0 };
            break;
        }
    }
}

function updateMicroEvents(dt) {
    microEventTimer -= dt;
    if (microEventTimer <= 0 && !activeMicroEvent) {
        triggerMicroEvent();
        microEventTimer = randFloat(350, 700);
    }

    if (!activeMicroEvent) return;
    const ev = activeMicroEvent;
    ev.timer -= dt;

    switch (ev.id) {
        case 'chicken_chase':
            ev.phase += dt;
            if (ev.phase > 30 && Math.floor(ev.phase) % 40 < 2) {
                // NPC runs to random nearby spot
                const tx = ev.npc.x + randFloat(-60, 60);
                const ty = ev.npc.y + randFloat(-40, 40);
                setTargetWithPath(ev.npc, Math.max(40, Math.min(WORLD_W-40, tx)), Math.max(40, Math.min(WORLD_H-40, ty)));
                ev.npc.state = 'moving';
            }
            if (ev.timer <= 30 && ev.phase < 1000) {
                npcBubbles.push(new SpeechBubble(ev.npc, '速すぎる…', [], false));
                ev.phase = 1000; // prevent re-trigger
            }
            break;
        case 'dropped_basket':
            ev.phase += dt;
            // After a pause, NPC walks to dropped item
            if (ev.phase > 60 && ev.phase < 62) {
                setTargetWithPath(ev.npc, ev.itemX, ev.itemY);
                ev.npc.state = 'moving';
            }
            if (ev.phase > 120 && ev.phase < 122) {
                npcBubbles.push(new SpeechBubble(ev.npc, 'できた！', [], false));
            }
            break;
        case 'rare_stone':
            ev.phase += dt;
            if (ev.phase > 100 && ev.phase < 102) {
                // Finder shows stone — a nearby NPC reacts
                const watcher = npcs.find(n => n !== ev.npc && Math.abs(n.x - ev.npc.x) < 60);
                if (watcher) npcBubbles.push(new SpeechBubble(watcher, 'きれいだね！', [], false));
            }
            break;
        case 'splash_well':
            ev.phase += dt;
            if (ev.phase > 80 && ev.phase < 82) {
                npcBubbles.push(new SpeechBubble(ev.npc, 'あっ！水が！', [], false));
                sfx('drink');
            }
            break;
        case 'big_fish':
            ev.phase += dt;
            if (ev.phase > 80 && ev.phase < 82) {
                npcBubbles.push(new SpeechBubble(ev.npc, '大きい魚だ！', [], false));
            }
            if (ev.phase > 140 && ev.phase < 142) {
                npcBubbles.push(new SpeechBubble(ev.npc, '逃げられた…', [], false));
            }
            break;
        case 'cat_nap':
            // Purely visual, just let timer run down
            break;
        case 'child_hide':
            ev.phase += dt;
            if (ev.phase > 100 && ev.phase < 102) {
                setTargetWithPath(ev.seeker, ev.bamboo.x + randFloat(-20, 20), ev.bamboo.y + randFloat(-10, 10));
                ev.seeker.state = 'moving';
            }
            if (ev.phase > 170 && ev.phase < 172) {
                npcBubbles.push(new SpeechBubble(ev.seeker, '見つけた！', [], false));
                npcBubbles.push(new SpeechBubble(ev.hider, 'ははは！', [], false));
            }
            break;
    }

    if (ev.timer <= 0) activeMicroEvent = null;
}

function drawMicroEventEffects(ctx) {
    if (!activeMicroEvent) return;
    const ev = activeMicroEvent;
    const s = canvasScale;

    switch (ev.id) {
        case 'dropped_basket': {
            // Draw dropped basket on ground
            if (ev.phase < 120) {
                const ix = ev.itemX * s, iy = ev.itemY * s;
                ctx.fillStyle = '#c8b870';
                ctx.beginPath();
                ctx.arc(ix, iy, 4*s, Math.PI, 0);
                ctx.fill();
                ctx.strokeStyle = '#a89850';
                ctx.lineWidth = 0.5*s;
                ctx.stroke();
                // Scattered items
                ctx.fillStyle = '#d89040';
                ctx.beginPath(); ctx.arc(ix - 4*s, iy + 2*s, 1.5*s, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(ix + 3*s, iy + 3*s, 1.5*s, 0, Math.PI*2); ctx.fill();
            }
            break;
        }
        case 'rare_stone': {
            // Draw glittering stone above NPC's hand
            if (ev.npc) {
                const sx = ev.npc.x * s, sy = (ev.npc.y - 30) * s;
                const sparkle = Math.sin(gameTick * 0.1) * 0.4 + 0.6;
                ctx.fillStyle = `rgba(200,180,140,${sparkle})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 3*s, 0, Math.PI*2);
                ctx.fill();
                // Sparkle rays
                ctx.strokeStyle = `rgba(255,230,150,${sparkle * 0.5})`;
                ctx.lineWidth = 0.5*s;
                for (let i = 0; i < 4; i++) {
                    const a = gameTick * 0.05 + i * Math.PI/2;
                    ctx.beginPath();
                    ctx.moveTo(sx + Math.cos(a)*4*s, sy + Math.sin(a)*4*s);
                    ctx.lineTo(sx + Math.cos(a)*7*s, sy + Math.sin(a)*7*s);
                    ctx.stroke();
                }
            }
            break;
        }
        case 'splash_well': {
            // Water splash particles at well
            if (ev.phase > 78 && ev.phase < 120 && ev.well) {
                const wx = ev.well.x * s, wy = (ev.well.y - 10) * s;
                const splashT = ev.phase - 78;
                ctx.fillStyle = 'rgba(80,150,200,0.5)';
                for (let i = 0; i < 5; i++) {
                    const angle = i * Math.PI * 2 / 5 + splashT * 0.05;
                    const dist = splashT * 0.5;
                    const dx = Math.cos(angle) * dist * s;
                    const dy = Math.sin(angle) * dist * 0.6 * s - splashT * 0.2 * s;
                    const size = Math.max(0.5, (2 - splashT * 0.04)) * s;
                    ctx.beginPath();
                    ctx.arc(wx + dx, wy + dy, size, 0, Math.PI*2);
                    ctx.fill();
                }
            }
            break;
        }
        case 'big_fish': {
            // Draw fish jumping out of pond
            if (ev.phase > 75 && ev.phase < 110 && ev.pond) {
                const jumpT = (ev.phase - 75) / 35;
                const fx = ev.pond.x * s + 5*s;
                const fy = (ev.pond.y - 15 * Math.sin(jumpT * Math.PI)) * s;
                ctx.save();
                ctx.translate(fx, fy);
                ctx.rotate(-0.3 + jumpT * 0.6);
                ctx.fillStyle = '#e86030';
                ctx.beginPath();
                ctx.moveTo(0, -3*s);
                ctx.quadraticCurveTo(4*s, 0, 0, 3*s);
                ctx.quadraticCurveTo(-3*s, 0, 0, -3*s);
                ctx.fill();
                // Tail
                ctx.beginPath();
                ctx.moveTo(0, 2.5*s);
                ctx.lineTo(-2*s, 5*s);
                ctx.lineTo(2*s, 5*s);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                // Splash drops
                ctx.fillStyle = 'rgba(80,150,200,0.4)';
                for (let i = 0; i < 3; i++) {
                    const dx = Math.sin(i*2.1 + ev.phase*0.1) * 6*s;
                    const dy = -Math.abs(Math.sin(jumpT*Math.PI)) * 8*s + i*3*s;
                    ctx.beginPath();
                    ctx.arc(ev.pond.x*s + dx, ev.pond.y*s + dy, 1.5*s, 0, Math.PI*2);
                    ctx.fill();
                }
            }
            break;
        }
        case 'cat_nap': {
            // Draw Zzz above sleeping cat
            if (ev.cat) {
                const cx = ev.cat.x * s, cy = (ev.cat.y - 12) * s;
                const zPhase = gameTick * 0.03;
                ctx.save();
                ctx.font = `${Math.round(7*s)}px sans-serif`;
                ctx.fillStyle = 'rgba(200,200,220,0.5)';
                ctx.textAlign = 'center';
                for (let i = 0; i < 3; i++) {
                    const rise = (zPhase + i * 1.5) % 4;
                    const a = rise < 0.5 ? rise * 2 : rise > 3 ? (4-rise)*2 : 1;
                    ctx.globalAlpha = a * 0.4;
                    ctx.fillText('z', cx + i*4*s, cy - rise*4*s);
                }
                ctx.restore();
            }
            break;
        }
    }
}

// ============================================================
//  MULTI-STEP NPC INTERACTIONS
// ============================================================
function triggerNpcInteraction() {
    if (activeNpcInteraction) return;
    const idle = npcs.filter(n => n.state === 'idle');
    if (idle.length < 2) return;

    const npc1 = randEl(idle);
    // Pick partner weighted by relationship
    const candidates = idle.filter(n => n !== npc1);
    if (candidates.length === 0) return;
    const npc2 = randEl(candidates);
    const rel = npc1.relationships[npc2.name] || 0;

    // Pick a valid interaction
    const valid = NPC_INTERACTION_DEFS.filter(d => rel >= d.minRel);
    if (valid.length === 0) return;
    const def = randEl(valid);

    activeNpcInteraction = {
        id: def.id, npc1, npc2, def,
        phaseIdx: 0, phaseTimer: def.phases[0].duration,
        started: false
    };
}

function updateNpcInteractions(dt) {
    npcInteractionTimer -= dt;
    if (npcInteractionTimer <= 0 && !activeNpcInteraction) {
        triggerNpcInteraction();
        npcInteractionTimer = randFloat(500, 1000);
    }
    if (!activeNpcInteraction) return;
    const ia = activeNpcInteraction;
    const phase = ia.def.phases[ia.phaseIdx];

    // Init phase
    if (!ia.started) {
        ia.started = true;
        ia.npc1.activityDe = ia.def.label;
        ia.npc2.activityDe = ia.def.label;

        if (phase.chat) {
            npcBubbles.push(new SpeechBubble(ia.npc1, phase.chat, [], false));
        }

        switch (phase.action) {
            case 'move_kitchen': {
                const kitchen = worldObjects.find(o => o.type === 'kitchen');
                if (kitchen) { const spot = standSpot(kitchen, 0.6); setTargetWithPath(ia.npc1, spot.x, spot.y); ia.npc1.state = 'moving'; }
                break;
            }
            case 'move_partner':
                setTargetWithPath(ia.npc1, ia.npc2.x + randFloat(-15,15), ia.npc2.y + randFloat(-10,10));
                ia.npc1.state = 'moving';
                break;
            case 'greet':
                ia.npc1.facing = Math.atan2(ia.npc2.y - ia.npc1.y, ia.npc2.x - ia.npc1.x);
                ia.npc2.facing = Math.atan2(ia.npc1.y - ia.npc2.y, ia.npc1.x - ia.npc2.x);
                break;
            case 'walk_garden': {
                const garden = worldObjects.find(o => o.type === 'garden');
                const tx = garden ? garden.x + randFloat(-20,20) : ia.npc1.x + randFloat(-80,80);
                const ty = garden ? garden.y + randFloat(-15,15) : ia.npc1.y + randFloat(-60,60);
                setTargetWithPath(ia.npc1, Math.max(40, Math.min(WORLD_W-40, tx)), Math.max(40, Math.min(WORLD_H-40, ty)));
                setTargetWithPath(ia.npc2, Math.max(40, Math.min(WORLD_W-40, tx + randFloat(-15,15))), Math.max(40, Math.min(WORLD_H-40, ty + randFloat(-10,10))));
                ia.npc1.state = 'moving'; ia.npc2.state = 'moving';
                break;
            }
            case 'find': case 'show':
                ia.npc1.facing = Math.atan2(ia.npc2.y - ia.npc1.y, ia.npc2.x - ia.npc1.x);
                break;
            case 'argue':
                ia.npc1.facing = Math.atan2(ia.npc2.y - ia.npc1.y, ia.npc2.x - ia.npc1.x);
                ia.npc2.facing = Math.atan2(ia.npc1.y - ia.npc2.y, ia.npc1.x - ia.npc2.x);
                break;
            case 'walk_away':
                setTargetWithPath(ia.npc1, Math.max(40, Math.min(WORLD_W-40, ia.npc1.x + randFloat(-80,80))), Math.max(40, Math.min(WORLD_H-40, ia.npc1.y + randFloat(-60,60))));
                ia.npc1.state = 'moving';
                break;
            case 'return':
                setTargetWithPath(ia.npc1, ia.npc2.x + randFloat(-15,15), ia.npc2.y + randFloat(-10,10));
                ia.npc1.state = 'moving';
                break;
            case 'reconcile':
                ia.npc1.facing = Math.atan2(ia.npc2.y - ia.npc1.y, ia.npc2.x - ia.npc1.x);
                ia.npc2.facing = Math.atan2(ia.npc1.y - ia.npc2.y, ia.npc1.x - ia.npc2.x);
                npcBubbles.push(new SpeechBubble(ia.npc2, '大丈夫だよ。', [], false));
                break;
            case 'drink_together': case 'arrive': case 'react':
                if (phase.chat) npcBubbles.push(new SpeechBubble(ia.npc2, npcContextualChatter(ia.npc2, ia.npc1), [], false));
                break;
        }
    }

    ia.phaseTimer -= dt;
    if (ia.phaseTimer <= 0) {
        ia.phaseIdx++;
        if (ia.phaseIdx >= ia.def.phases.length) {
            // Interaction complete — boost relationship
            const oldRel = ia.npc1.relationships[ia.npc2.name] || 0;
            ia.npc1.relationships[ia.npc2.name] = Math.min(100, oldRel + 5);
            ia.npc2.relationships[ia.npc1.name] = Math.min(100, (ia.npc2.relationships[ia.npc1.name] || 0) + 5);
            ia.npc1.state = 'idle'; ia.npc1.idleTimer = randFloat(60, 200);
            ia.npc2.state = 'idle'; ia.npc2.idleTimer = randFloat(60, 200);
            ia.npc1.activityDe = 'Untätig'; ia.npc2.activityDe = 'Untätig';
            activeNpcInteraction = null;
        } else {
            ia.phaseTimer = ia.def.phases[ia.phaseIdx].duration;
            ia.started = false; // trigger next phase init
        }
    }
}
