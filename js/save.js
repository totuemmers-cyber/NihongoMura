// Nihongo Mura — Saving and loading (localStorage)

// ============================================================
//  SAVE / LOAD SYSTEM (localStorage)
// ============================================================
const SAVE_KEY = 'nihongomura_save';
const AUTOSAVE_INTERVAL = 60000; // 60 seconds

function buildSaveData() {
    return {
        version: 2,
        time: { gameDay, gameHour, gameMinute, gameTick },
        persons: persons.map(p => ({
            name: p.name, role: p.role, color: p.color,
            geschick: p.geschick, neugier: p.neugier,
            geselligkeit: p.geselligkeit, wahrnehmung: p.wahrnehmung,
            x: p.x, y: p.y, facing: p.facing,
            hunger: p.hunger, thirst: p.thirst, energy: p.energy,
            knownWords: [...p.knownWords],
            wordHistory: p.wordHistory.slice(),
            relationships: { ...p.relationships },
            skinTone: p.skinTone, hairColor: p.hairColor, clothColor: p.clothColor,
            actionHistory: p.actionHistory.slice(),
            followMode: p.followMode,
        })),
        npcs: npcs.map(n => ({
            name: n.name, x: n.x, y: n.y, speed: n.speed, facing: n.facing,
            relationships: { ...n.relationships },
            skinTone: n.skinTone, hairColor: n.hairColor, clothColor: n.clothColor, color: n.color,
            affinities: n.affinities,
        })),
        campProgress: { ...campProgress },
        campMilestonesHit: [...campMilestonesHit],
        proverbMilestonesHit: [...proverbMilestonesHit],
        discoveredTypes: [...discoveredTypes],
        weather: { currentWeather, weatherIntensity },
        storytellingCooldownDay: storytelling.cooldownDay,
        eventLog: eventLog.slice(0, 50),
        vocabHistory: vocabHistory,
        yojijukugoTriggered: [...yojijukugoTriggered],
        quizStats: quizStats,
        quizRecent: quizRecent.slice(),
    };
}

let _savingDisabled = false;   // set while a new game reloads the page, so nothing re-saves the old one
function saveGame() {
    if (_savingDisabled) return false;
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
        return true;
    } catch (e) {
        console.warn('Save failed:', e);
        addLog('Speichern fehlgeschlagen!', 'speak');
        return false;
    }
}

function loadSaveData() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !data.version || !data.persons || data.persons.length < 2) return null;
        return data;
    } catch (e) {
        console.warn('Load failed:', e);
        return null;
    }
}

function applySaveData(data) {
    const clampNum = (v, min, max, fallback) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    };
    const safeStr = (v, fallback) => typeof v === 'string' ? v : fallback;

    // Time
    gameDay = clampNum(data.time.gameDay, 0, 99999, 1);
    gameHour = clampNum(data.time.gameHour, 0, 23, 6);
    gameMinute = clampNum(data.time.gameMinute, 0, 59, 0);
    gameTick = clampNum(data.time.gameTick, 0, Infinity, 0);

    // Persons
    persons = [];
    for (const pd of data.persons) {
        const p = new Person(safeStr(pd.name, 'Person'), safeStr(pd.role, 'speaker'), safeStr(pd.color, '#aa7a4a'));
        p.geschick = clampNum(pd.geschick, 1, 10, 5);
        p.neugier = clampNum(pd.neugier, 1, 10, 5);
        p.geselligkeit = clampNum(pd.geselligkeit, 1, 10, 5);
        p.wahrnehmung = clampNum(pd.wahrnehmung, 1, 10, 5);
        p.x = clampNum(pd.x, 0, WORLD_W, 400);
        p.y = clampNum(pd.y, 0, WORLD_H, 300);
        p.targetX = p.x; p.targetY = p.y;
        p.facing = clampNum(pd.facing, -Math.PI, Math.PI, 0);
        p.hunger = clampNum(pd.hunger, 0, 100, 70);
        p.thirst = clampNum(pd.thirst, 0, 100, 70);
        p.energy = clampNum(pd.energy, 0, 100, 70);
        // Older saves may hold words that were merged since (shoes → shoe): map them, drop unknown ones
        const learnable = id => typeof id === 'string' && vocab[canonWord(id)] && vocab[canonWord(id)].type !== 'particle';
        p.knownWords = new Set((pd.knownWords || []).filter(learnable).map(canonWord));
        p.wordHistory = [...new Set((Array.isArray(pd.wordHistory) ? pd.wordHistory : []).filter(learnable).map(canonWord))];
        p.relationships = (pd.relationships && typeof pd.relationships === 'object') ? pd.relationships : {};
        p.skinTone = safeStr(pd.skinTone, p.skinTone);
        p.hairColor = safeStr(pd.hairColor, p.hairColor);
        p.clothColor = safeStr(pd.clothColor, p.clothColor);
        p.actionHistory = Array.isArray(pd.actionHistory) ? pd.actionHistory : [];
        p.followMode = safeStr(pd.followMode, 'following');
        persons.push(p);
    }

    // NPCs
    npcs = [];
    for (const nd of data.npcs) {
        const n = new NPC(safeStr(nd.name, 'NPC'));
        n.x = clampNum(nd.x, 0, WORLD_W, 400);
        n.y = clampNum(nd.y, 0, WORLD_H, 300);
        n.targetX = n.x; n.targetY = n.y;
        n.speed = clampNum(nd.speed, 0.1, 2.0, 0.6);
        n.facing = clampNum(nd.facing, -Math.PI, Math.PI, 0);
        n.relationships = (nd.relationships && typeof nd.relationships === 'object') ? nd.relationships : {};
        n.skinTone = safeStr(nd.skinTone, n.skinTone);
        n.hairColor = safeStr(nd.hairColor, n.hairColor);
        n.clothColor = safeStr(nd.clothColor, n.clothColor);
        n.color = safeStr(nd.color, n.color);
        if (nd.affinities && typeof nd.affinities === 'object') n.affinities = nd.affinities;
        npcs.push(n);
    }

    // Camp
    campProgress = (data.campProgress && typeof data.campProgress === 'object') ? data.campProgress : {};
    campMilestonesHit = new Set(data.campMilestonesHit || []);
    campDecorations = [];
    for (const m of CAMP_MILESTONES) {
        if (campMilestonesHit.has(m.id)) {
            campDecorations.push({ id: m.id, x: m.x, y: m.y });
        }
    }

    // Proverbs & discoveries
    proverbMilestonesHit = new Set(data.proverbMilestonesHit || []);
    discoveredTypes = new Set(data.discoveredTypes || []);

    // Weather
    if (data.weather) {
        currentWeather = safeStr(data.weather.currentWeather, 'clear');
        weatherIntensity = clampNum(data.weather.weatherIntensity, 0, 1, 0);
        targetWeatherIntensity = weatherIntensity;
    }

    // Storytelling
    storytelling.cooldownDay = clampNum(data.storytellingCooldownDay, -1, 99999, -1);

    // Event log
    eventLog = Array.isArray(data.eventLog) ? data.eventLog : [];
    vocabHistory = Array.isArray(data.vocabHistory) ? data.vocabHistory : [];
    yojijukugoTriggered = new Set(data.yojijukugoTriggered || []);
    quizStats = (data.quizStats && typeof data.quizStats === 'object') ? data.quizStats : {};
    quizRecent = Array.isArray(data.quizRecent) ? data.quizRecent.slice(-8) : [];
}

function deleteSave() {
    localStorage.removeItem(SAVE_KEY);
}

let _autosaveId = null;
function setupAutosave() {
    if (_autosaveId) clearInterval(_autosaveId);
    _autosaveId = setInterval(() => {
        if (gameSpeed > 0) saveGame();
    }, AUTOSAVE_INTERVAL);
    window.addEventListener('beforeunload', saveGame);
    // iPad / phones often close a backgrounded page without beforeunload: save whenever it is hidden
    window.addEventListener('pagehide', saveGame);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
}

function manualSave() {
    if (saveGame()) {
        addLog('Spielstand gespeichert.', 'speak');
        const btn = document.getElementById('btn-save');
        btn.classList.add('saved');
        setTimeout(() => btn.classList.remove('saved'), 900);
    }
}

function newGame() {
    if (!confirm('Neues Spiel starten? Der aktuelle Fortschritt geht verloren.')) return;
    // Nothing may re-save the old game while the page reloads (beforeunload, pagehide, visibilitychange)
    _savingDisabled = true;
    deleteSave();
    location.reload();
}
