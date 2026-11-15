// Nihongo Mura — Clicking places, the quiz and typed commands

// ============================================================
//  OBJECT CLICK TOOLTIP
// ============================================================
// German names for the places, shown when a place is clicked
const OBJECT_DE = {
    house: 'Wohnhaus', teahouse: 'Teehaus', market: 'Markt', well: 'Brunnen', bridge: 'Brücke',
    pagoda: 'Fünfstöckige Pagode', torii: 'Schreintor', bamboo: 'Bambus', garden: 'Garten', kitchen: 'Kochstelle',
    workshop: 'Schreibstube', fish_pond: 'Teich', shrine: 'Schrein', lantern_post: 'Steinlaterne',
    rice_paddy: 'Reisfeld', dock: 'Anlegestelle', lotus_pond: 'Lotusteich', flower: 'Blumen', willow: 'Trauerweide',
    school: 'Dorfschule', medicine_hut: 'Apotheke', stable: 'Pferdestall', tea_terrace: 'Teefeld', viewpoint: 'Aussichtspunkt',
};
function showObjectTooltip(obj) {
    // Map object types to vocab IDs
    const typeToVocab = {
        house: 'house', teahouse: 'tea', market: 'money', well: 'water',
        bridge: 'bridge', pagoda: 'pagoda', gate: 'door', bamboo: 'bamboo',
        garden: 'garden', kitchen: 'food', workshop: 'book', fish_pond: 'fish',
        shrine: 'home', lantern_post: 'lantern', rice_paddy: 'rice',
        river: 'river', dock: 'boat', lotus_pond: 'lotus', flower: 'flower',
        willow: 'tree',
        school: 'student', medicine_hut: 'medicine', stable: 'horse',
        tea_terrace: 'tea', viewpoint: 'mountain'
    };
    void typeToVocab;
    objectTooltip = {
        obj: obj,
        kanji: obj.label,
        romaji: obj.romaji || '',
        german: OBJECT_DE[obj.type] || '',
        timer: 180,
        maxTimer: 180
    };
    sfx('speak');
}

function updateObjectTooltip(dt) {
    if (objectTooltip) {
        objectTooltip.timer -= dt;
        if (objectTooltip.timer <= 0) objectTooltip = null;
    }
}

function drawObjectTooltip(ctx) {
    if (!objectTooltip) return;
    const t = objectTooltip, obj = t.obj, s = canvasScale;
    const alpha = t.timer < 40 ? t.timer / 40 : t.timer > t.maxTimer - 20 ? (t.maxTimer - t.timer) / 20 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Ground ring around the place
    const pulse = Math.sin(gameTick * 0.1) * 0.2 + 0.8;
    ctx.strokeStyle = `rgba(201,154,58,${pulse})`;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.ellipse(obj.x * s, (obj.y + obj.h * 0.25) * s, (obj.w / 2 + 8) * s, (obj.h / 3 + 5) * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Card above the object: big kanji, romaji, German
    const kanjiPx = Math.round(16 * s), smallPx = Math.round(9.5 * s);
    ctx.font = `700 ${kanjiPx}px ${CJK_FONT}`;
    const kw = ctx.measureText(t.kanji).width;
    ctx.font = `500 ${smallPx}px ${UI_FONT}`;
    const lw = Math.max(ctx.measureText(t.romaji).width, ctx.measureText(t.german).width);
    const w = kw + lw + 34 * s, h = 34 * s;
    const spr = getObjectSprite(obj);
    const top = obj.y + (spr ? spr.oy : -obj.h / 2);
    const x0 = obj.x * s - w / 2, y0 = (top - 8) * s - h;
    inkCard(ctx, x0, y0, w, h, 8 * s, 'rgba(201,154,58,0.55)');
    ctx.fillStyle = 'rgba(29,25,20,0.95)';
    ctx.beginPath();
    ctx.moveTo(obj.x * s - 5 * s, y0 + h - 0.5);
    ctx.lineTo(obj.x * s, y0 + h + 5 * s);
    ctx.lineTo(obj.x * s + 5 * s, y0 + h - 0.5);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 ${kanjiPx}px ${CJK_FONT}`;
    ctx.fillStyle = '#f3ead8';
    ctx.fillText(t.kanji, x0 + 11 * s, y0 + h / 2 + 0.5 * s);
    ctx.fillStyle = 'rgba(243,234,216,0.16)';
    ctx.fillRect(x0 + kw + 17 * s, y0 + 7 * s, 1 * s, h - 14 * s);
    ctx.font = `500 ${smallPx}px ${UI_FONT}`;
    ctx.fillStyle = '#c99a3a';
    ctx.fillText(t.romaji, x0 + kw + 23 * s, y0 + h * 0.33);
    ctx.fillStyle = '#ece2cb';
    ctx.fillText(t.german, x0 + kw + 23 * s, y0 + h * 0.7);
    ctx.restore();
}

// ============================================================
//  QUIZ SYSTEM
// ============================================================
const QUIZ_DURATION = 5000;   // ms real time
const QUIZ_RESULT_SHOW = 1500; // ms
const QUIZ_COOLDOWN_MIN = 1800;
const QUIZ_COOLDOWN_MAX = 3600;

function canTriggerQuiz() {
    return !quizActive && quizCooldown <= 0 && persons[1].knownWords.size >= 3 && gameSpeed > 0;
}

function triggerQuiz() {
    const learner = persons[1];
    const knownIds = [...learner.knownWords].filter(id => vocab[id]);
    if (knownIds.length === 0) return;
    const targetId = pickQuizWord(knownIds);
    const targetVocab = vocab[targetId];

    // 1 correct + 2 wrong — distractors must look different from the answer and each other
    const label = v => v.kanji + ' (' + v.kana + ')';
    const options = [{ word: label(targetVocab), kanji: targetVocab.kanji, kana: targetVocab.kana, correct: true }];
    const used = new Set([label(targetVocab), targetVocab.de]);
    const otherIds = LEARNABLE_WORDS.filter(id => id !== targetId);
    while (options.length < 3 && otherIds.length > 0) {
        const wrongId = otherIds.splice(randInt(0, otherIds.length - 1), 1)[0];
        const v = vocab[wrongId];
        if (used.has(label(v)) || v.de === targetVocab.de) continue;
        used.add(label(v));
        options.push({ word: label(v), kanji: v.kanji, kana: v.kana, correct: false });
    }
    // Shuffle
    for (let i = options.length - 1; i > 0; i--) {
        const j = randInt(0, i);
        [options[i], options[j]] = [options[j], options[i]];
    }

    // Find related world object
    let highlightObj = null;
    const relatedObj = worldObjects.find(o => o.type === targetId || o.id.startsWith(targetId));
    if (relatedObj) highlightObj = relatedObj;

    quizData = { germanWord: targetVocab.de, conceptId: targetId, options, highlightObj };
    const st = quizStats[targetId] || (quizStats[targetId] = { asked: 0, misses: 0, lastTick: -1e9 });
    st.asked++;
    st.lastTick = gameTick;
    quizRecent.push(targetId);
    if (quizRecent.length > 8) quizRecent.shift();
    quizActive = true;
    quizTimer = QUIZ_DURATION;
    quizResult = null;
    quizOptionRects = [];
}

// Choose the quiz word: never one of the last few, prefer words asked less often or
// not seen for a while, and bring back words the learner got wrong.
function pickQuizWord(knownIds) {
    const holdBack = Math.min(quizRecent.length, Math.max(0, Math.floor(knownIds.length / 2)), 6);
    const recent = new Set(quizRecent.slice(quizRecent.length - holdBack));
    let pool = knownIds.filter(id => !recent.has(id));
    if (pool.length === 0) pool = knownIds.filter(id => id !== quizRecent[quizRecent.length - 1]);
    if (pool.length === 0) pool = knownIds;
    const weights = pool.map(id => {
        const st = quizStats[id];
        if (!st) return 4;                                         // never asked: strong preference
        const age = Math.min(4, Math.max(1, 1 + (gameTick - st.lastTick) / 6000)); // longer unseen → more likely
        return age * (1 + 2 * st.misses) / Math.pow(1 + st.asked, 1.3);
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
}

function updateQuiz(dt, rawDt) {
    if (quizCooldown > 0) quizCooldown -= dt;
    if (canTriggerQuiz() && Math.random() < 0.001 * dt) triggerQuiz();

    if (quizActive && quizResult === null) {
        quizTimer -= rawDt;
        if (quizTimer <= 0) dismissQuiz();
    }
    if (quizResult) {
        quizResultTimer -= rawDt;
        if (quizResultTimer <= 0) {
            quizActive = false;
            quizResult = null;
            quizData = null;
            quizCooldown = randFloat(QUIZ_COOLDOWN_MIN, QUIZ_COOLDOWN_MAX);
        }
    }
    if (learnerFreezeTimer > 0) learnerFreezeTimer -= rawDt;
}

function dismissQuiz() {
    quizActive = false;
    quizResult = null;
    quizData = null;
    quizCooldown = randFloat(QUIZ_COOLDOWN_MIN, QUIZ_COOLDOWN_MAX);
}

function answerQuiz(optionIndex) {
    if (!quizActive || quizResult !== null) return;
    const option = quizData.options[optionIndex];
    const st = quizStats[quizData.conceptId];
    if (st) st.misses = option.correct ? Math.max(0, st.misses - 1) : st.misses + 1;
    if (option.correct) {
        quizResult = 'correct';
        persons[1].hunger = 100;
        persons[1].thirst = 100;
        persons[1].energy = 100;
        sfx('learn');
        addLog(`Quiz richtig! ${persons[1].name} fühlt sich großartig!`, 'learn');
    } else {
        quizResult = 'wrong';
        learnerFreezeTimer = 5000;
        sfx('craft');
        addLog(`Quiz falsch! ${persons[1].name} ist verwirrt.`, 'speak');
    }
    quizResultTimer = QUIZ_RESULT_SHOW;
}

function drawQuiz(ctx) {
    if (!quizActive || !quizData) return;
    const s = canvasScale;

    // Highlight the related object on the ground
    if (quizData.highlightObj && quizResult === null) {
        const obj = quizData.highlightObj;
        const pulse = Math.sin(gameTick * 0.1) * 0.3 + 0.7;
        ctx.save();
        setWorldTransform(ctx);
        ctx.strokeStyle = `rgba(201,154,58,${pulse * 0.85})`;
        ctx.lineWidth = 2 * s;
        ctx.setLineDash([5 * s, 4 * s]);
        ctx.beginPath();
        ctx.ellipse(obj.x * s, (obj.y + obj.h * 0.25) * s, (obj.w / 2 + 10) * s, (obj.h / 3 + 6) * s, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    const opts = quizData.options;
    const optCount = opts.length;
    const kanjiPx = Math.round(17 * s), kanaPx = Math.round(9 * s);
    ctx.save();
    let maxW = 0;
    for (const o of opts) {
        ctx.font = `700 ${kanjiPx}px ${CJK_FONT}`;
        const kw = ctx.measureText(o.kanji || o.word).width;
        ctx.font = `500 ${kanaPx}px ${UI_FONT}`;
        maxW = Math.max(maxW, kw, ctx.measureText(o.kana || '').width);
    }
    ctx.restore();
    const gap = 8 * s, pad = 14 * s;
    const optW = Math.max(74 * s, maxW + 22 * s), optH = 50 * s;
    const panelW = Math.min(camera.viewW - 16, Math.max(300 * s, optCount * optW + (optCount - 1) * gap + pad * 2));
    const panelH = (quizResult ? 58 : 122) * s;
    const panelX = (camera.viewW - panelW) / 2;
    const panelY = camera.viewH - panelH - 16 * s;
    const edge = quizResult === 'correct' ? 'rgba(134,171,111,0.8)' : quizResult === 'wrong' ? 'rgba(201,105,79,0.8)' : 'rgba(201,154,58,0.6)';
    ctx.save();
    inkCard(ctx, panelX, panelY, panelW, panelH, 12 * s, edge);
    const cx = panelX + panelW / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (quizResult) {
        const ok = quizResult === 'correct';
        const right = opts.find(o => o.correct);
        hanko(ctx, panelX + 30 * s, panelY + panelH / 2, 26 * s, ok ? '正' : '誤', ok ? -0.08 : 0.08);
        ctx.textAlign = 'left';
        ctx.font = `700 ${Math.round(14 * s)}px ${UI_FONT}`;
        ctx.fillStyle = ok ? '#a8cf90' : '#e48b72';
        ctx.fillText(ok ? 'Richtig! 正解' : 'Leider falsch', panelX + 54 * s, panelY + panelH / 2 - 8 * s);
        ctx.font = `500 ${Math.round(10.5 * s)}px ${UI_FONT}`;
        ctx.fillStyle = '#ad9f86';
        ctx.fillText(ok ? `${persons[1].name} fühlt sich großartig.` : `„${quizData.germanWord}“ = ${right ? right.kanji + ' (' + right.kana + ')' : ''}`, panelX + 54 * s, panelY + panelH / 2 + 9 * s);
    } else {
        // Timer: a thin line along the top edge
        const pct = Math.max(0, quizTimer / QUIZ_DURATION);
        ctx.save();
        roundRect(ctx, panelX, panelY, panelW, panelH, 12 * s);
        ctx.clip();
        ctx.fillStyle = 'rgba(243,234,216,0.08)';
        ctx.fillRect(panelX, panelY, panelW, 3 * s);
        ctx.fillStyle = pct > 0.3 ? '#c99a3a' : '#c9694f';
        ctx.fillRect(panelX, panelY, panelW * pct, 3 * s);
        ctx.restore();
        // Prompt
        ctx.font = `500 ${Math.round(9.5 * s)}px ${UI_FONT}`;
        ctx.fillStyle = '#ad9f86';
        ctx.fillText('Welches Wort bedeutet', cx, panelY + 18 * s);
        ctx.font = `700 ${Math.round(16 * s)}px ${UI_FONT}`;
        ctx.fillStyle = '#f3ead8';
        ctx.fillText(`„${quizData.germanWord}“?`, cx, panelY + 36 * s);
        // Options
        quizOptionRects = [];
        const totalW = optCount * optW + (optCount - 1) * gap;
        const startX = panelX + (panelW - totalW) / 2, oy = panelY + 56 * s;
        for (let i = 0; i < optCount; i++) {
            const o = opts[i], ox = startX + i * (optW + gap);
            quizOptionRects.push({ x: ox, y: oy, w: optW, h: optH });
            ctx.fillStyle = '#2e2922';
            roundRect(ctx, ox, oy, optW, optH, 8 * s);
            ctx.fill();
            ctx.strokeStyle = 'rgba(243,234,216,0.12)';
            ctx.lineWidth = s;
            ctx.stroke();
            ctx.font = `700 ${kanjiPx}px ${CJK_FONT}`;
            ctx.fillStyle = '#f3ead8';
            ctx.fillText(o.kanji || o.word, ox + optW / 2, oy + optH * 0.42);
            if (o.kana) {
                ctx.font = `500 ${kanaPx}px ${UI_FONT}`;
                ctx.fillStyle = '#c99a3a';
                ctx.fillText(o.kana, ox + optW / 2, oy + optH * 0.78);
            }
        }
    }
    ctx.restore();
}

function drawFreezeIndicator(ctx, person) {
    if (learnerFreezeTimer <= 0) return;
    const s = canvasScale;
    const x = person.x * s, y = (person.y - 30) * s;
    const t = gameTick * 0.07;
    ctx.save();
    ctx.font = `800 ${Math.round(13 * s)}px ${CJK_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6 * s;
    ctx.strokeStyle = 'rgba(29,25,20,0.85)';
    for (let i = 0; i < 3; i++) {
        const a = t + i * (Math.PI * 2 / 3);
        const depth = Math.sin(a) * 0.5 + 0.5;
        ctx.globalAlpha = 0.55 + depth * 0.45;
        ctx.fillStyle = i === 0 ? '#ef9a7e' : '#f3ead8';
        const qx = x + Math.cos(a) * 14 * s, qy = y + Math.sin(a) * 4.5 * s;
        ctx.strokeText('？', qx, qy);
        ctx.fillText('？', qx, qy);
    }
    ctx.restore();
}

// ============================================================
//  CANVAS CLICK HANDLER
// ============================================================
function handleCanvasClick(e) {
    if (performance.now() < camera.suppressClickUntil) return; // this "click" ended a drag
    const rect = canvas.getBoundingClientRect();
    const clickCSSX = (e.clientX || e.pageX) - rect.left;
    const clickCSSY = (e.clientY || e.pageY) - rect.top;

    // Check quiz options first
    if (quizActive && quizResult === null && quizOptionRects.length > 0) {
        for (let i = 0; i < quizOptionRects.length; i++) {
            const r = quizOptionRects[i];
            if (clickCSSX >= r.x && clickCSSX <= r.x + r.w && clickCSSY >= r.y && clickCSSY <= r.y + r.h) {
                answerQuiz(i);
                return;
            }
        }
    }

    // Check world objects
    const clickWorld = screenToWorld(clickCSSX, clickCSSY);
    const clickWorldX = clickWorld.x;
    const clickWorldY = clickWorld.y;
    for (const obj of worldObjects) {
        const dx = clickWorldX - obj.x;
        const dy = clickWorldY - obj.y;
        const hitRadius = Math.max(obj.w, obj.h) / 2 + 10;
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
            showObjectTooltip(obj);
            return;
        }
    }
}

// ============================================================
//  COMMAND SYSTEM — player gives orders to the learner
// ============================================================
let commandFeedbackTimer = 0;

// Normalize romaji for fuzzy matching (long vowels, macrons)
function normalizeRomaji(str) {
    return str.toLowerCase()
        .replace(/ō/g,'ou').replace(/ū/g,'uu').replace(/ā/g,'aa')
        .replace(/ē/g,'ee').replace(/ī/g,'ii')
        .replace(/ou/g,'o').replace(/uu/g,'u') // also collapse for matching
        .replace(/shi/g,'si').replace(/chi/g,'ti').replace(/tsu/g,'tu')
        .replace(/fu/g,'hu').replace(/ji/g,'zi');
}

// Parse input into matching vocab concept IDs
function parseCommandInput(input) {
    const learner = persons[1];
    const raw = input.trim();
    if (!raw) return [];
    const lower = raw.toLowerCase();
    const normalized = normalizeRomaji(raw);

    const matched = [];
    // Try matching each known word against input
    for (const cid of learner.knownWords) {
        const v = vocab[cid];
        if (!v || v.type === 'particle') continue;
        // Match by kanji substring
        if (raw.includes(v.kanji)) { matched.push({ cid, score: 3 }); continue; }
        // Match by kana (hiragana) substring
        if (raw.includes(v.kana)) { matched.push({ cid, score: 3 }); continue; }
        // Match by romaji
        const vRomaji = (v.romaji || '').toLowerCase();
        const vNorm = normalizeRomaji(vRomaji);
        if (lower.includes(vRomaji) || normalized.includes(vNorm)) { matched.push({ cid, score: 2 }); continue; }
        // Match by German
        if (lower.includes(v.de.toLowerCase())) { matched.push({ cid, score: 1 }); continue; }
    }
    // Sort by score (best matches first), deduplicate
    matched.sort((a, b) => b.score - a.score);
    const seen = new Set();
    return matched.filter(m => { if (seen.has(m.cid)) return false; seen.add(m.cid); return true; }).map(m => m.cid);
}

// Find the best ACTION_DEFS match for a set of concept IDs
function findActionForConcepts(conceptIds) {
    if (conceptIds.length === 0) return null;
    // A learned word also stands for its merged senses (聞く: listen + ask)
    const cidSet = new Set(conceptIds.flatMap(c => [c, ...Object.keys(WORD_CANON).filter(a => WORD_CANON[a] === c)]));
    let bestAction = null, bestScore = 0;

    for (const action of ACTION_DEFS) {
        // Skip need-only actions (sleep, urgent eat/drink)
        if (action.priority === 'need' && !action.id.includes('eat') && !action.id.includes('drink')) continue;

        // Score by how many template words or visibleConcepts overlap
        let score = 0;
        if (action.templates) {
            for (const tmpl of action.templates) {
                let tmplScore = 0;
                for (const cid of tmpl) { if (cidSet.has(cid)) tmplScore++; }
                score = Math.max(score, tmplScore);
            }
        }
        if (action.visibleConcepts) {
            let visScore = 0;
            for (const cid of action.visibleConcepts) { if (cidSet.has(cid)) visScore++; }
            score = Math.max(score, visScore * 0.5); // visibleConcepts are weaker matches
        }
        if (score > bestScore) { bestScore = score; bestAction = action; }
    }
    return bestScore >= 1 ? bestAction : null;
}

function submitCommand() {
    const inputEl = document.getElementById('command-input');
    const raw = inputEl.value.trim();
    if (!raw || persons.length < 2) return;

    // Help command
    const lower = raw.toLowerCase();
    if (lower === 'hilfe' || lower === 'help' || lower === '?') {
        showCommandFeedback('Gelernte Wörter als Befehl eingeben (Romaji, Kana oder Kanji). Beispiele: "mizu", "cha nomu", "hon yomu"');
        addLog('Hilfe: Gelernte Wörter als Befehle eingeben (Romaji, Kana oder Kanji).', 'speak');
        inputEl.value = '';
        return;
    }

    const learner = persons[1];

    // Check learner has learned words
    if (learner.knownWords.size < 3) {
        showCommandFeedback('Noch zu wenige Wörter gelernt...');
        return;
    }

    // Parse input
    const conceptIds = parseCommandInput(raw);
    if (conceptIds.length === 0) {
        showCommandFeedback('Nicht verstanden — nur gelernte Wörter verwenden!');
        return;
    }

    // Find matching action
    const action = findActionForConcepts(conceptIds);
    if (!action) {
        // Show what was understood but no action found
        const understood = conceptIds.slice(0, 3).map(c => vocab[c] ? vocab[c].kanji : c).join('');
        showCommandFeedback(`Verstanden: "${understood}" — aber was soll ich tun?`);
        // Learner shows confused response
        const confBubble = new SpeechBubble(learner, '...?', [], true);
        speechBubbles.push(confBubble);
        return;
    }

    // Execute: force learner to do this action
    learner.state = 'moving';
    learner.followMode = 'returning';
    learner.currentAction = { ...action, _isCommand: true };
    learner.activityDe = action.activityDe;

    // Find target location
    let tx, ty;
    if (action.target) {
        const obj = findClosestObjectFrom(learner, action.target);
        if (obj) {
            const spot = standSpot(obj, 0.7);
            tx = spot.x;
            ty = spot.y;
        } else {
            tx = learner.x; ty = learner.y;
        }
    } else {
        tx = learner.x + randFloat(-20, 20);
        ty = learner.y + randFloat(-15, 15);
    }
    tx = Math.max(30, Math.min(WORLD_W - 30, tx));
    ty = Math.max(30, Math.min(WORLD_H - 30, ty));
    setTargetWithPath(learner, tx, ty);

    // Learner acknowledges — build German sentence from the matched action
    const ackSentence = buildSentence(action);
    const ackResult = buildGermanResponse(ackSentence.words, learner);
    const responseText = ackResult.anyKnown ? ackResult.text : 'Ja!';
    setTimeout(() => {
        const ackBubble = new SpeechBubble(learner, responseText, [], true);
        speechBubbles.push(ackBubble);
        sfx('respond');
        addLog(`${learner.name} führt Befehl aus: ${action.activityDe}`, 'learn');
    }, 300);

    // Show feedback
    const cmdHanzi = conceptIds.slice(0, 4).map(c => vocab[c] ? vocab[c].kanji : '').join('');
    showCommandFeedback(`→ ${cmdHanzi} → ${action.activityDe}`);
    inputEl.value = '';
}

function showCommandFeedback(text) {
    let fb = document.getElementById('command-feedback');
    if (!fb) {
        fb = document.createElement('div');
        fb.id = 'command-feedback';
        const cmdBar = document.getElementById('command-bar');
        cmdBar.parentNode.insertBefore(fb, cmdBar.nextSibling);
    }
    fb.textContent = text;
    fb.classList.add('visible');
    commandFeedbackTimer = 4000;
}

// Handle learner arriving at command target
function handleLearnerCommandArrival(learner) {
    if (!learner.currentAction || !learner.currentAction._isCommand) return false;
    const action = learner.currentAction;

    // Apply effects
    if (action.effects) {
        if (action.effects.hunger) learner.hunger = Math.min(100, learner.hunger + action.effects.hunger);
        if (action.effects.thirst) learner.thirst = Math.min(100, learner.thirst + action.effects.thirst);
        if (action.effects.energy) learner.energy = Math.min(100, learner.energy + action.effects.energy);
    }

    // Show action speech bubble (using the action's template, with grammar)
    const sentence = buildSentence(action);
    const actBubble = new SpeechBubble(learner, sentence.kanjiText, sentence.words, true);
    speechBubbles.push(actBubble);
    sfxForAction(action.id);

    // Enter acting state briefly
    learner.state = 'acting';
    learner.actionTimer = Math.min(action.duration || 120, 180);
    learner.activityDe = action.activityDe;

    // Glow target object
    if (action.target) {
        const glowObj = worldObjects.find(o => o.type === action.target &&
            Math.sqrt((o.x - learner.x) ** 2 + (o.y - learner.y) ** 2) < 80);
        if (glowObj) activeObjectGlow = { objId: glowObj.id, timer: 180, maxTimer: 180 };
    }

    return true;
}
