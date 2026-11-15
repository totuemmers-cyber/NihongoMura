// Nihongo Mura — Speaker and learner behaviour, storytelling and discoveries

// ============================================================
//  AI - SPEAKER (Person 1)
// ============================================================
function findClosestObject(type) {
    let best = null, bestDist = Infinity;
    for (const obj of worldObjects) {
        if (obj.type === type) {
            const d = persons[0].distTo(obj.x, obj.y);
            if (d < bestDist) { bestDist = d; best = obj; }
        }
    }
    return best;
}

// Spaced repetition: pick from candidates weighted by recency (recent = less likely)
function spacedPick(candidates, history, curiosity) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Score each candidate: the more recently used, the lower the weight
    const weights = candidates.map(c => {
        const idx = history.indexOf(c.id);
        // Curiosity boosts novelty: curious characters strongly prefer new actions
        const noveltyBonus = 6 + (curiosity || 5) * 0.8;
        if (idx === -1) return noveltyBonus; // never done = highest weight
        // idx 0 = most recent => weight 1, idx 11 => weight ~8
        return 1 + idx * 0.7;
    });

    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
        r -= weights[i];
        if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
}

function chooseSpeakerAction() {
    const p = persons[0];
    let candidates = [];
    let isNeedAction = false;

    // Critical needs
    if (p.hunger < 30) {
        candidates = ACTION_DEFS.filter(a => a.needCheck === 'hunger');
        isNeedAction = true;
    } else if (p.thirst < 30) {
        candidates = ACTION_DEFS.filter(a => a.needCheck === 'thirst');
        isNeedAction = true;
    } else if (p.energy < 20) {
        candidates = ACTION_DEFS.filter(a => a.needCheck === 'energy');
        isNeedAction = true;
    }

    if (candidates.length === 0) {
        const indoorTargets = ['house', 'teahouse', 'kitchen', 'workshop'];
        const isHarshWeather = (currentWeather === 'rain' || currentWeather === 'snow') && weatherIntensity > 0.4;
        const r = Math.random();

        // In harsh weather, prefer indoor/sheltered activities
        if (isHarshWeather && r < 0.6) {
            candidates = ACTION_DEFS.filter(a =>
                a.priority !== 'need' && indoorTargets.includes(a.target)
            );
        }

        if (candidates.length === 0) {
            // Sociability shifts the thresholds: social speakers do more social actions
            const socialThreshold = 0.85 - p.socialWeight * 0.12; // high geselligkeit → lower threshold → more social
            const productiveThreshold = socialThreshold - 0.15;

            if (r < productiveThreshold) {
                candidates = ACTION_DEFS.filter(a => a.priority === 'productive');
            } else if (r < socialThreshold) {
                candidates = ACTION_DEFS.filter(a => a.priority === 'social');
            } else {
                candidates = ACTION_DEFS.filter(a => a.priority === 'idle');
            }
        }
    }

    if (candidates.length === 0) candidates = ACTION_DEFS.filter(a => a.priority === 'productive');
    if (candidates.length === 0) candidates = ACTION_DEFS.slice(); // ultimate fallback: any action

    // Use spaced repetition: prefer actions not done recently
    // Curiosity boosts weight for never-done actions (more variety)
    const chosen = spacedPick(candidates, p.actionHistory, p.neugier);

    // Track in history
    if (chosen) {
        // Remove if already in history, then add to front
        const existIdx = p.actionHistory.indexOf(chosen.id);
        if (existIdx !== -1) p.actionHistory.splice(existIdx, 1);
        p.actionHistory.unshift(chosen.id);
        // Trim to max
        if (p.actionHistory.length > p.actionHistoryMax) {
            p.actionHistory.length = p.actionHistoryMax;
        }
    }

    return chosen;
}

function buildSentence(action) {
    // Meaning frame → natural Japanese (polite: the speaker talks to the learner)
    const templates = action.templates && action.templates.length ? action.templates : [['look','this','here']];
    return sayTemplate(action.id, randEl(templates), { polite: true });
}

function speakerSpeak(action) {
    const sentence = buildSentence(action);
    const bubble = new SpeechBubble(persons[0], sentence.kanjiText, sentence.words, false);
    bubble.kanjiText = sentence.kanjiText;
    bubble.kanaText = sentence.kanaText;
    speechBubbles.push(bubble);
    sfx('speak');
    addLog(`${persons[0].name}: "${sentence.kanjiText}" (${sentence.kanaText})`, 'speak');

    // Learner tries to learn (perception determines hearing range)
    const learner = persons[1];
    const dist = learner.distTo(persons[0].x, persons[0].y);
    if (dist <= learner.hearingRange) {
        learnerRespond(sentence, action);
    } else {
        // Too far away, no response
    }
}

// The speaker remarks on something (animal, weather, a find): bubble + log; the learner may pick up words
function speakerRemark(sentence, logNote, learnMult) {
    if (!sentence || !persons.length) return;
    const speaker = persons[0];
    const b = new SpeechBubble(speaker, sentence.kanjiText, sentence.words, false);
    b.kanjiText = sentence.kanjiText;
    b.kanaText = sentence.kanaText;
    speechBubbles.push(b);
    sfx('speak');
    addLog(logNote ? logNote(sentence.kanjiText) : `${speaker.name}: "${sentence.kanjiText}"`, 'speak');
    const learner = persons[1];
    if (learner && learner.distTo(speaker.x, speaker.y) <= learner.hearingRange) {
        for (const w of sentence.words) {
            if (!knowsWord(learner, w.conceptId) && Math.random() < learner.learnChance * (learnMult || 1)) learnWord(learner, w);
        }
    }
}

// The learner's German for something they heard: only the words they know, "..." for the rest
function buildGermanResponse(words, learner) {
    return germanFor(words, learner) || { text: '...', anyKnown: false };
}

function learnerRespond(sentence, action) {
    const learner = persons[1];
    const speaker = persons[0];

    // Try to learn each word (in hearing range = can also observe)
    for (const w of sentence.words) {
        if (!knowsWord(learner, w.conceptId)) {
            if (Math.random() < learner.learnChance) {
                learnWord(learner, w);
            }
        }
    }

    // Build response — German translation with grammar
    setTimeout(() => {
        const result = buildGermanResponse(sentence.words, learner);
        const anyKnown = result.anyKnown;
        const responseText = result.text;

        const bubble = new SpeechBubble(learner, responseText, [], true);
        speechBubbles.push(bubble);
        if (responseText !== '...') {
            sfx('respond');
            addLog(`${learner.name}: "${responseText}"`, 'speak');
        }
    }, 600 / Math.max(1, gameSpeed));
}

// ============================================================
//  NIGHTTIME STORYTELLING
// ============================================================
function canStartStorytelling() {
    if (storytelling.active) return false;
    if (storytelling.cooldownDay >= gameDay) return false;
    if (gameHour < 20 && gameHour >= 4) return false;
    const speaker = persons[0];
    if (speaker.state !== 'idle') return false;
    if (speaker.actionHistory.length < 3) return false;
    const fire = cachedTeahouse;
    if (!fire) return false;
    if (speaker.distTo(fire.x, fire.y) > 80) return false;
    return true;
}

function startStorytelling() {
    const speaker = persons[0];
    storytelling.active = true;
    storytelling.currentIdx = 0;
    storytelling.timer = 0;
    storytelling.cooldownDay = gameDay;

    // Build story from 3-5 recent actions
    const storyLen = Math.min(speaker.actionHistory.length, randInt(3, 5));
    const storyActions = speaker.actionHistory.slice(0, storyLen);
    storytelling.sentences = [];

    for (const actionId of storyActions) {
        const actionDef = ACTION_DEFS.find(a => a.id === actionId);
        if (actionDef && actionDef.templates && actionDef.templates.length > 0) {
            // Told by the fire: past tense ("I drank tea…")
            const tellable = actionDef.templates.filter(t => !frameFor(actionDef.id, t).fixed);   // fixed phrases don't shift to past
            const sent = sayTemplate(actionDef.id, randEl(tellable.length ? tellable : actionDef.templates), { polite: true, narrative: true });
            const { kanjiText, kanaText, words } = sent;
            storytelling.sentences.push({ text: kanjiText, kanjiText, kanaText, words });
        }
    }

    if (storytelling.sentences.length === 0) {
        storytelling.active = false;
        return;
    }

    addLog(`${speaker.name} beginnt eine Geschichte am Feuer...`, 'speak');

    // Make nearby NPCs face the teahouse
    const fire = cachedTeahouse;
    if (fire) {
        for (const npc of npcs) {
            if (npc.distTo(fire.x, fire.y) < 100) {
                npc.facing = Math.atan2(fire.y - npc.y, fire.x - npc.x);
                if (npc.state === 'idle') {
                    npc.state = 'moving';
                    setTargetWithPath(npc, Math.max(40, Math.min(WORLD_W - 40, fire.x + randFloat(-30, 30))), Math.max(40, Math.min(WORLD_H - 40, fire.y + randFloat(-30, 30))));
                }
            }
        }
    }
}

function updateStorytelling(dt) {
    if (!storytelling.active) return;

    storytelling.timer -= dt;
    if (storytelling.timer > 0) return;

    const speaker = persons[0];

    if (storytelling.currentIdx < storytelling.sentences.length) {
        const sentence = storytelling.sentences[storytelling.currentIdx];
        const stBubble = new SpeechBubble(speaker, sentence.kanjiText || sentence.text, sentence.words, false);
        stBubble.kanjiText = sentence.kanjiText || sentence.text;
        stBubble.kanaText = sentence.kanaText || '';
        speechBubbles.push(stBubble);
        sfx('speak');
        addLog(`${speaker.name}: "${sentence.kanjiText || sentence.text}"`, 'speak');

        // Learner tries to learn from story
        const learner = persons[1];
        if (learner.distTo(speaker.x, speaker.y) <= learner.hearingRange) {
            for (const w of sentence.words) {
                if (!knowsWord(learner, w.conceptId) && vocab[w.conceptId]) {
                    if (Math.random() < learner.learnChance) {
                        learnWord(learner, w);
                    }
                }
            }
        }

        storytelling.currentIdx++;
        storytelling.timer = randFloat(100, 180);
    } else {
        // Story ended — learner retells
        storytelling.active = false;
        learnerRetellStory();
    }
}

function learnerRetellStory() {
    const learner = persons[1];
    const speaker = persons[0];
    if (learner.distTo(speaker.x, speaker.y) > learner.hearingRange) return;

    // Pick 2-3 random sentences from the story and retell using known words
    const retellCount = Math.min(storytelling.sentences.length, randInt(1, 2));
    const retellIdxs = [];
    while (retellIdxs.length < retellCount && retellIdxs.length < storytelling.sentences.length) {
        const idx = randInt(0, storytelling.sentences.length - 1);
        if (!retellIdxs.includes(idx)) retellIdxs.push(idx);
    }

    const story = storytelling.sentences;   // a new story may have started by the time the learner answers
    setTimeout(() => {
        for (const idx of retellIdxs) {
            const sentence = story[idx];
            const rr = buildGermanResponse(sentence.words, learner);
            const responseText = rr.text;
            if (responseText.replace(/\.\.\./g, '').trim().length > 0) {
                speechBubbles.push(new SpeechBubble(learner, responseText, [], true));
                sfx('respond');
                addLog(`${learner.name}: "${responseText}" (Nacherzählung)`, 'speak');
            }
        }
        // Boost relationship from shared storytelling
        boostRelationshipsNearby(speaker, 5);
    }, 800 / Math.max(1, gameSpeed));
}

// ============================================================
//  DISCOVERY EVENTS
// ============================================================
const DISCOVERY_TYPES = [
    { type: 'ancient_scroll', speech: [['find','scroll','old'],['find','book','old'],['look','book','old']],              desc: 'eine alte Schriftrolle' },
    { type: 'lucky_charm',    speech: [['find','omamori'],['find','thing','beautiful'],['this','good','old']],       desc: 'einen Glücksbringer' },
    { type: 'old_coins',      speech: [['find','coin','old'],['find','money','old'],['money','many','here']],           desc: 'alte Münzen' },
    { type: 'hanko_seal',     speech: [['find','hanko','red'],['this','rare'],['find','thing','red'],['this','old','good']],             desc: 'ein Hanko-Siegel' },
    { type: 'pottery_shards', speech: [['find','shard','old'],['find','thing','old'],['look','this','here']],            desc: 'Keramikscherben' },
    { type: 'ikebana',        speech: [['ikebana','beautiful'],['flower','beautiful','many'],['look','flower','good']],   desc: 'ein Ikebana-Arrangement' },
];

function spawnDiscovery() {
    const available = DISCOVERY_TYPES.filter(d => !discoveredTypes.has(d.type));
    if (available.length === 0) return;
    const disc = randEl(available);
    const x = randFloat(60, WORLD_W - 60);
    const y = randFloat(60, WORLD_H - 60);
    discoveries.push({ ...disc, x, y, found: false });
    addLog('Etwas Ungewöhnliches ist aufgetaucht...', 'speak');
}

function updateDiscoveries(dt) {
    // Spawn timer (every 3-8 game days worth of ticks)
    discoveryTimer -= dt;
    if (discoveryTimer <= 0) {
        discoveryTimer = randFloat(8000, 22000); // roughly 3-8 game days
        spawnDiscovery();
    }

    // Speaker notices nearby undiscovered objects
    if (persons.length === 0) return;
    const speaker = persons[0];
    if (speaker.state !== 'idle' || storytelling.active) return;

    for (const disc of discoveries) {
        if (disc.found) continue;
        const d = speaker.distTo(disc.x, disc.y);
        const noticeRange = 40 + speaker.neugier * 6;
        if (d < noticeRange) {
            investigateDiscovery(disc);
            break;
        }
        // High curiosity speakers move toward discoveries
        if (d < noticeRange * 2 && speaker.neugier >= 6 && Math.random() < 0.001 * dt) {
            speaker.state = 'moving';
            speaker.currentAction = { id: 'investigate', duration: 200, templates: [['look','this','here']], effects: {}, activityDe: 'Untersucht etwas...', priority: 'idle' };
            speaker.targetX = disc.x + randFloat(-10, 10);
            speaker.targetY = disc.y + randFloat(-10, 10);
            speaker.activityDe = 'Untersucht etwas...';
            break;
        }
    }
}

function investigateDiscovery(disc) {
    disc.found = true;
    discoveredTypes.add(disc.type);
    const speaker = persons[0];

    // Speak about discovery
    const sent = pickLine(disc.speech, 'discover_' + disc.type, { polite: true });
    if (sent) speakerRemark(sent, t => `${speaker.name} entdeckt ${disc.desc}: "${t}"`, 1.3);

    // Remove after a short delay
    setTimeout(() => {
        discoveries = discoveries.filter(d => d !== disc);
    }, 3000 / Math.max(1, gameSpeed));
}

function drawDiscoveries(ctx) {
    for (const disc of discoveries) drawDiscovery(ctx, disc);
}
function drawDiscovery(ctx, disc) {
    {
        if (disc.found) return;
        const x = disc.x * canvasScale;
        const y = disc.y * canvasScale;
        const s = canvasScale;
        const t = gameTick * 0.03;

        // Subtle golden glow
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(t) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, 12*s, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(212,160,48,0.15)';
        ctx.fill();
        ctx.globalAlpha = 1;

        switch (disc.type) {
            case 'ancient_scroll':
                // Rolled scroll
                ctx.fillStyle = '#d8c898';
                ctx.fillRect(x - 8*s, y - 2*s, 16*s, 4*s);
                // Roll ends
                ctx.fillStyle = '#c8b080';
                ctx.beginPath();
                ctx.ellipse(x - 8*s, y, 1.5*s, 2.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(x + 8*s, y, 1.5*s, 2.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Red seal stamp
                ctx.fillStyle = '#cc3030';
                ctx.fillRect(x + 2*s, y - 1*s, 3*s, 2*s);
                // Faint ink characters
                ctx.fillStyle = 'rgba(30,30,30,0.3)';
                ctx.fillRect(x - 5*s, y - 0.5*s, 1*s, 1*s);
                ctx.fillRect(x - 2*s, y - 0.5*s, 1*s, 1*s);
                break;
            case 'lucky_charm':
                // Omamori lucky charm (fabric pouch)
                ctx.fillStyle = '#5aaa5a';
                ctx.globalAlpha = 0.85 + Math.sin(t * 2) * 0.15;
                ctx.beginPath();
                ctx.moveTo(x, y - 6*s);
                ctx.lineTo(x + 5*s, y - 2*s);
                ctx.lineTo(x + 4*s, y + 4*s);
                ctx.lineTo(x - 4*s, y + 4*s);
                ctx.lineTo(x - 5*s, y - 2*s);
                ctx.closePath();
                ctx.fill();
                // Shine highlight
                ctx.fillStyle = 'rgba(180,240,180,0.4)';
                ctx.beginPath();
                ctx.ellipse(x - 1*s, y - 1*s, 2*s, 1.5*s, -0.3, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            case 'old_coins':
                // Japanese coins
                ctx.fillStyle = '#b0a060';
                for (let i = 0; i < 4; i++) {
                    const cx = x + (i - 1.5) * 4*s;
                    const cy = y + Math.sin(i * 1.5) * 2*s;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 3*s, 0, Math.PI*2);
                    ctx.fill();
                    // Square hole
                    ctx.fillStyle = '#6a5a30';
                    ctx.fillRect(cx - 1*s, cy - 1*s, 2*s, 2*s);
                    ctx.fillStyle = '#b0a060';
                }
                break;
            case 'hanko_seal':
                // Hanko seal (Japanese name stamp)
                ctx.fillStyle = '#8a6a4a';
                ctx.fillRect(x - 3*s, y - 5*s, 6*s, 10*s);
                // Carved top
                ctx.fillStyle = '#9a7a5a';
                ctx.beginPath();
                ctx.arc(x, y - 5*s, 3*s, Math.PI, 0);
                ctx.fill();
                // Red ink on bottom
                ctx.fillStyle = '#cc3030';
                ctx.fillRect(x - 2.5*s, y + 3*s, 5*s, 2*s);
                break;
            case 'pottery_shards':
                // Broken pottery pieces
                ctx.fillStyle = '#b08050';
                ctx.beginPath();
                ctx.moveTo(x - 4*s, y - 3*s);
                ctx.lineTo(x + 2*s, y - 4*s);
                ctx.lineTo(x + 4*s, y + 1*s);
                ctx.lineTo(x - 1*s, y + 3*s);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#a07040';
                ctx.beginPath();
                ctx.moveTo(x + 3*s, y - 1*s);
                ctx.lineTo(x + 7*s, y - 2*s);
                ctx.lineTo(x + 6*s, y + 3*s);
                ctx.lineTo(x + 2*s, y + 2*s);
                ctx.closePath();
                ctx.fill();
                // Blue glaze fragments
                ctx.strokeStyle = '#4060a0';
                ctx.lineWidth = 0.5*s;
                ctx.beginPath();
                ctx.arc(x, y - 1*s, 2*s, 0.5, 2.5);
                ctx.stroke();
                break;
            case 'ikebana':
                // Ikebana flower arrangement
                ctx.fillStyle = '#c0a060';
                ctx.beginPath();
                ctx.ellipse(x, y + 3*s, 3*s, 4*s, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.fillRect(x - 2*s, y - 1*s, 4*s, 2*s);
                // Stems
                ctx.strokeStyle = '#3a7a2a';
                ctx.lineWidth = 0.8*s;
                ctx.beginPath();
                ctx.moveTo(x - 1*s, y - 1*s); ctx.lineTo(x - 3*s, y - 8*s);
                ctx.moveTo(x, y - 1*s); ctx.lineTo(x + 1*s, y - 10*s);
                ctx.moveTo(x + 1*s, y - 1*s); ctx.lineTo(x + 4*s, y - 7*s);
                ctx.stroke();
                // Flower heads
                const discFlowerColors = ['#e06080', '#e0a040', '#d060d0'];
                for (let i = 0; i < 3; i++) {
                    const fx = [x - 3*s, x + 1*s, x + 4*s][i];
                    const fy = [y - 8*s, y - 10*s, y - 7*s][i];
                    ctx.fillStyle = discFlowerColors[i];
                    ctx.beginPath();
                    ctx.arc(fx, fy, 2*s, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = '#e0d030';
                    ctx.beginPath();
                    ctx.arc(fx, fy, 0.8*s, 0, Math.PI*2);
                    ctx.fill();
                }
                break;
        }
        ctx.restore();
    }
}

// ============================================================
//  AI - MAIN LOOP
// ============================================================
function updateSpeakerAI(dt) {
    const p = persons[0];

    switch (p.state) {
        case 'idle':
            p.idleTimer -= dt;
            p.activityDe = 'Untätig';
            // Check storytelling trigger
            if (!storytelling.active && p.idleTimer <= 0 && canStartStorytelling()) {
                startStorytelling();
                p.idleTimer = 200; // wait during storytelling
                p.activityDe = 'Erzählt eine Geschichte';
                break;
            }
            if (storytelling.active) {
                p.activityDe = 'Erzählt eine Geschichte';
                break;
            }
            if (p.idleTimer <= 0) {
                // Choose next action
                const action = chooseSpeakerAction();
                p.currentAction = action;
                p.state = 'moving';
                p.activityDe = 'Geht zu ' + (action.activityDe || '...');

                // Find target
                let tx, ty;
                if (action.target) {
                    const obj = findClosestObject(action.target);
                    if (obj) {
                        const spot = standSpot(obj);
                        tx = spot.x;
                        ty = spot.y;
                    } else {
                        tx = p.x; ty = p.y;
                    }
                } else if (action.requiresOther) {
                    tx = persons[1].x + randFloat(-20, 20);
                    ty = persons[1].y + randFloat(-20, 20);
                } else {
                    tx = p.x + randFloat(-60, 60);
                    ty = p.y + randFloat(-40, 40);
                }
                // Clamp to world
                tx = Math.max(30, Math.min(WORLD_W - 30, tx));
                ty = Math.max(30, Math.min(WORLD_H - 30, ty));
                setTargetWithPath(p, tx, ty);
            }
            break;

        case 'moving':
            if (p.moveToward(p.targetX, p.targetY, dt)) {
                if (!p.currentAction) {
                    // Safety: if action was lost, return to idle
                    p.state = 'idle';
                    p.idleTimer = 60;
                    break;
                }
                p.state = 'acting';
                p.actionTimer = p.currentAction.duration / (0.5 + p.geschick * 0.08) + 240; // +4s pause after speaking
                p.activityDe = p.currentAction.activityDe;
                sfxForAction(p.currentAction.id);
                speakerSpeak(p.currentAction);
                // Trigger contextual object label glow
                if (p.currentAction.target) {
                    const glowObj = worldObjects.find(o => o.type === p.currentAction.target &&
                        Math.sqrt((o.x - p.x) ** 2 + (o.y - p.y) ** 2) < 80);
                    if (glowObj) activeObjectGlow = { objId: glowObj.id, timer: 180, maxTimer: 180 };
                }
            }
            break;

        case 'acting':
            p.actionTimer -= dt;
            if (p.actionTimer <= 0) {
                // Apply effects
                if (p.currentAction.effects) {
                    if (p.currentAction.effects.hunger) p.hunger = Math.min(100, p.hunger + p.currentAction.effects.hunger);
                    if (p.currentAction.effects.thirst) p.thirst = Math.min(100, p.thirst + p.currentAction.effects.thirst);
                    if (p.currentAction.effects.energy) p.energy = Math.min(100, p.energy + p.currentAction.effects.energy);
                }
                // Track camp progress
                if (p.currentAction.id) {
                    campProgress[p.currentAction.id] = (campProgress[p.currentAction.id] || 0) + 1;
                    checkCampMilestones();
                    // Boost relationships with nearby characters
                    boostRelationshipsNearby(p, 3);
                }
                p.state = 'idle';
                p.idleTimer = randInt(40, 140) / (0.5 + p.geschick * 0.05);
                p.currentAction = null;
            }
            break;
    }
}

function updateLearnerAI(dt) {
    const learner = persons[1];
    const speaker = persons[0];
    const distToSpeaker = learner.distTo(speaker.x, speaker.y);

    // --- Freeze (stunned from wrong quiz answer) ---
    if (learnerFreezeTimer > 0) {
        learnerFreezeTimer -= dt;
        learner.activityDe = 'Verwirrt...';
        return; // Skip all AI while frozen
    }

    // --- Critical needs override only when idle ---
    if (learner.state === 'idle') {
        let needAction = null;
        if (learner.hunger < 25) {
            const food = findClosestObjectFrom(learner, 'kitchen') || findClosestObjectFrom(learner, 'market');
            if (food) {
                needAction = { target: food, action: { id: 'eat_self', duration: 120, effects: { hunger: 38 }, activityDe: 'isst' }, label: 'Geht essen' };
            }
        } else if (learner.thirst < 25) {
            const water = findClosestObjectFrom(learner, 'well') || findClosestObjectFrom(learner, 'teahouse');
            if (water) {
                needAction = { target: water, action: { id: 'drink_self', duration: 80, effects: { thirst: 53 }, activityDe: 'trinkt' }, label: 'Geht trinken' };
            }
        } else if (learner.energy < 15) {
            const house = findClosestObjectFrom(learner, 'house');
            if (house) {
                needAction = { target: house, action: { id: 'sleep_self', duration: 300, effects: { energy: 45 }, activityDe: 'schläft' }, label: 'Geht schlafen' };
            }
        }

        if (needAction) {
            learner.state = 'moving';
            const spot = standSpot(needAction.target, 0.7);
            setTargetWithPath(learner, spot.x, spot.y);
            learner.currentAction = needAction.action;
            learner.activityDe = needAction.label;
            learner.followMode = 'returning'; // will return to speaker after
            return;
        }
    }

    // --- Follow mode management (only when idle) ---
    if (learner.state === 'idle') {
        switch (learner.followMode) {
            case 'following':
                learner.followTimer -= dt;
                // Curiosity drives wander probability: curious learners explore more
                if (learner.followTimer <= 0) {
                    if (Math.random() < learner.wanderChance) {
                        learner.followMode = 'wandering';
                        // Curious learners wander further and longer
                        const wanderRange = 80 + learner.neugier * 8;
                        learner.wanderTimer = randInt(100 + learner.neugier * 15, 300 + learner.neugier * 20);
                        let wtx = Math.max(40, Math.min(WORLD_W - 40, learner.x + randFloat(-wanderRange, wanderRange)));
                        let wty = Math.max(40, Math.min(WORLD_H - 40, learner.y + randFloat(-wanderRange * 0.8, wanderRange * 0.8)));
                        setTargetWithPath(learner, wtx, wty);
                        learner.activityDe = 'Schaut sich um';
                    }
                    // Sociable learners re-check sooner (shorter follow timer)
                    learner.followTimer = randInt(600, 1200) / (0.5 + learner.geselligkeit * 0.08);
                }
                break;

            case 'wandering':
                learner.wanderTimer -= dt;
                // Sociable learners return sooner; hearing range determines awareness of distance
                const maxWanderDist = learner.hearingRange * (2.0 - learner.geselligkeit * 0.08);
                if (learner.wanderTimer <= 0 || distToSpeaker > maxWanderDist) {
                    learner.followMode = 'returning';
                    learner.activityDe = 'Kehrt zurück zu ' + speaker.name;
                }
                break;

            case 'returning':
                // Sociable learners come back closer
                if (distToSpeaker < learner.hearingRange * 0.5) {
                    learner.followMode = 'following';
                    learner.followTimer = randInt(600, 1200) / (0.5 + learner.geselligkeit * 0.08);
                }
                break;
        }
    }

    // --- Movement and actions ---
    switch (learner.state) {
        case 'idle': {
            if (learner.followMode === 'following' || learner.followMode === 'returning') {
                learner.activityDe = learner.followMode === 'returning'
                    ? 'Kehrt zurück zu ' + speaker.name
                    : 'Folgt ' + speaker.name;

                if (distToSpeaker > learner.hearingRange * 0.6) {
                    // Move toward speaker — recalculate only when speaker moved far
                    const angle = Math.atan2(speaker.y - learner.y, speaker.x - learner.x);
                    const followDist = 40;
                    let ftx = Math.max(30, Math.min(WORLD_W - 30, speaker.x - Math.cos(angle) * followDist));
                    let fty = Math.max(30, Math.min(WORLD_H - 30, speaker.y - Math.sin(angle) * followDist));
                    const targetChanged = Math.abs(ftx - learner.targetX) > 50 || Math.abs(fty - learner.targetY) > 50;
                    if (targetChanged || learner.waypoints.length === 0) {
                        setTargetWithPath(learner, ftx, fty);
                    }
                    learner.moveToward(learner.targetX, learner.targetY, dt);
                    learner.facing = angle;
                } else if (distToSpeaker > 20) {
                    // Near speaker: face them and stand calmly (no jittering)
                    learner.facing = Math.atan2(speaker.y - learner.y, speaker.x - learner.x);
                    learner.activityDe = 'Hört zu';
                }
                // Within 20px: fully idle, do nothing
            } else if (learner.followMode === 'wandering') {
                learner.activityDe = 'Schaut sich um';
                // Move to wander target; pick new one only when reached
                if (learner.distTo(learner.targetX, learner.targetY) < 12) {
                    let wtx2 = Math.max(40, Math.min(WORLD_W - 40, learner.x + randFloat(-60, 60)));
                    let wty2 = Math.max(40, Math.min(WORLD_H - 40, learner.y + randFloat(-40, 40)));
                    setTargetWithPath(learner, wtx2, wty2);
                }
                learner.moveToward(learner.targetX, learner.targetY, dt);
            }
            break;
        }

        case 'moving':
            if (learner.moveToward(learner.targetX, learner.targetY, dt)) {
                if (learner.currentAction && learner.currentAction._isCommand) {
                    // Player-issued command: use dedicated handler
                    handleLearnerCommandArrival(learner);
                } else if (learner.currentAction) {
                    learner.state = 'acting';
                    learner.actionTimer = learner.currentAction.duration / (0.5 + learner.geschick * 0.08);
                    learner.activityDe = learner.currentAction.activityDe;
                    sfxForAction(learner.currentAction.id);
                } else {
                    learner.state = 'idle';
                }
            }
            break;

        case 'acting':
            learner.actionTimer -= dt;
            if (learner.actionTimer <= 0) {
                if (learner.currentAction && learner.currentAction.effects) {
                    if (learner.currentAction.effects.hunger) learner.hunger = Math.min(100, learner.hunger + learner.currentAction.effects.hunger);
                    if (learner.currentAction.effects.thirst) learner.thirst = Math.min(100, learner.thirst + learner.currentAction.effects.thirst);
                    if (learner.currentAction.effects.energy) learner.energy = Math.min(100, learner.energy + learner.currentAction.effects.energy);
                }
                learner.state = 'idle';
                learner.currentAction = null;
                // After need action, return to speaker
                learner.followMode = 'returning';
            }
            break;
    }
}

function findClosestObjectFrom(person, type) {
    let best = null, bestDist = Infinity;
    for (const obj of worldObjects) {
        if (obj.type === type) {
            const d = person.distTo(obj.x, obj.y);
            if (d < bestDist) { bestDist = d; best = obj; }
        }
    }
    return best;
}
