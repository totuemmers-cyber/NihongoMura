// Nihongo Mura — Side panel, event log, clock and speed control

// ============================================================
//  UI PANEL
// ============================================================
const _panelFingerprints = {};
function renderCharPanel(panelId, person) {
    const el = document.getElementById(panelId);
    const isLearner = person.role === 'learner';
    const roleLabel = isLearner ? 'Reisender' : 'Einheimischer';
    const portraitBg = person.color;

    // Skip DOM update if nothing changed
    const fp = `${person.geschick}|${person.neugier}|${person.geselligkeit}|${person.wahrnehmung}|${Math.round(person.hunger)}|${Math.round(person.thirst)}|${Math.round(person.energy)}|${person.activityDe}`;
    if (_panelFingerprints[panelId] === fp) return;
    _panelFingerprints[panelId] = fp;

    const tier = v => v >= 7 ? 'hi' : v >= 4 ? 'mid' : 'lo';
    const needColor = v => v >= 50 ? 'var(--good)' : v >= 25 ? 'var(--warn)' : 'var(--bad)';
    const stat = (label, v) => `
        <div class="stat-row">
            <span class="stat-label">${label}</span>
            <span class="pips ${tier(v)}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${v}">${
                Array.from({ length: 10 }, (_, i) => `<i${i < v ? ' class="on"' : ''}></i>`).join('')}</span>
            <span class="stat-val">${v}</span>
        </div>`;
    const need = (k, label, v) => `
        <div class="need" title="${label}: ${Math.round(v)}%">
            <span class="need-k" aria-hidden="true">${k}</span>
            <span class="need-bar" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v)}"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${needColor(v)}"></i></span>
        </div>`;

    el.innerHTML = `
        <div class="char-header">
            <div class="char-portrait ${isLearner ? 'role-learner' : 'role-speaker'}" aria-hidden="true">${person.name.charAt(0)}</div>
            <div class="char-id">
                <div class="char-name">${person.name}<span class="seal-stamp" title="${isLearner ? 'Lernender' : 'Lehrer'}">${isLearner ? '学' : '師'}</span></div>
                <div class="char-role">${roleLabel}</div>
            </div>
        </div>
        ${stat('Geschick', person.geschick)}
        ${stat('Neugier', person.neugier)}
        ${stat('Geselligkeit', person.geselligkeit)}
        ${stat('Wahrnehmung', person.wahrnehmung)}
        <div class="needs">
            ${need('食', 'Hunger', person.hunger)}
            ${need('水', 'Durst', person.thirst)}
            ${need('気', 'Energie', person.energy)}
        </div>
        <div class="activity">${person.activityDe}</div>
    `;
}

let _vocabPanelFp = '';
function renderVocabPanel() {
    const learner = persons[1];
    const total = LEARNABLE_WORDS.length;
    const known = learner.knownWords.size;
    const searchEl0 = document.getElementById('vocab-search');
    const fp = known + '|' + learner.wordHistory.length + '|' + vocabHistory.length + '|' + total + '|' + (searchEl0 ? searchEl0.value : '');
    if (fp === _vocabPanelFp) return;          // nothing it shows has changed
    _vocabPanelFp = fp;
    const pct = total > 0 ? Math.round(known / total * 100) : 0;

    document.getElementById('vocab-progress').innerHTML = `<span><b>${known}</b> / ${total} Wörter gelernt</span><span>${pct}%</span>`;
    document.getElementById('vocab-bar').style.width = pct + '%';

    // Sparkline — words learned per game-day
    let sparkCanvas = document.getElementById('vocab-sparkline');
    if (!sparkCanvas) {
        sparkCanvas = document.createElement('canvas');
        sparkCanvas.id = 'vocab-sparkline';
        sparkCanvas.width = 600;
        sparkCanvas.height = 64;
        sparkCanvas.style.cssText = 'width:100%;height:32px;margin:8px 0 0;display:block;';
        sparkCanvas.setAttribute('aria-hidden', 'true');
        const barBg = document.querySelector('#vocab-panel .progress-bar-bg');
        if (barBg) barBg.parentNode.insertBefore(sparkCanvas, barBg.nextSibling);
    }
    if (vocabHistory.length > 1) {
        const sCtx = sparkCanvas.getContext('2d');
        const sw = sparkCanvas.width, sh = sparkCanvas.height;
        sCtx.clearRect(0, 0, sw, sh);
        // Aggregate by game day
        const dayCounts = {};
        for (const h of vocabHistory) dayCounts[h.day] = (dayCounts[h.day] || 0) + 1;
        const days = Object.keys(dayCounts).map(Number).sort((a, b) => a - b);
        if (days.length >= 2) {
            const maxC = Math.max(...days.map(d => dayCounts[d]), 1);
            const pad = 6;
            sCtx.strokeStyle = '#86ab6f';
            sCtx.lineWidth = 3;
            sCtx.lineJoin = 'round';
            sCtx.beginPath();
            for (let i = 0; i < days.length; i++) {
                const px = pad + (i / (days.length - 1)) * (sw - pad * 2);
                const py = sh - pad - ((dayCounts[days[i]] / maxC) * (sh - pad * 2));
                if (i === 0) sCtx.moveTo(px, py); else sCtx.lineTo(px, py);
            }
            sCtx.stroke();
            // Fill under curve
            sCtx.lineTo(pad + (sw - pad * 2), sh - pad);
            sCtx.lineTo(pad, sh - pad);
            sCtx.closePath();
            sCtx.fillStyle = 'rgba(134,171,111,0.16)';
            sCtx.fill();
        }
    }

    const listEl = document.getElementById('vocab-list');
    const searchEl = document.getElementById('vocab-search');
    const query = (searchEl ? searchEl.value : '').toLowerCase().trim();
    let html = '';
    for (const cid of learner.wordHistory) {
        const v = vocab[cid];
        if (!v) continue;
        if (query) {
            const matchKana = v.kana.includes(query) || (v.romaji || '').toLowerCase().includes(query);
            const matchDe = v.de.toLowerCase().includes(query);
            const matchKanji = v.kanji.includes(query);
            if (!matchKana && !matchDe && !matchKanji) continue;
        }
        html += `<div class="vocab-word" data-cid="${cid}" title="Klicken für Kalligraphie"><span class="vw-kanji">${v.kanji}</span><span class="vw-reading">${v.kana}</span><span class="vw-meaning">${v.de}</span></div>`;
    }
    if (known === 0) {
        html = '<div class="empty">Noch keine Wörter gelernt — hör den Dorfbewohnern zu.</div>';
    } else if (query && !html) {
        html = '<div class="empty">Keine Treffer</div>';
    }
    listEl.innerHTML = html;
}

// Search field: filter vocab list on input, prevent game keyboard shortcuts
document.getElementById('vocab-search').addEventListener('input', function() {
    renderVocabPanel();
});
document.getElementById('vocab-search').addEventListener('keydown', function(e) {
    e.stopPropagation(); // prevent space/1/2/3/m from triggering game controls
});

// Command input: Enter to submit, prevent game shortcuts while typing
document.getElementById('command-input').addEventListener('keydown', function(e) {
    e.stopPropagation();
    if (e.key === 'Enter') { submitCommand(); e.preventDefault(); }
});

// Click on learned word in vocab panel → show calligraphy popup
document.getElementById('vocab-list').addEventListener('click', function(e) {
    const wordEl = e.target.closest('.vocab-word[data-cid]');
    if (!wordEl) return;
    const cid = wordEl.dataset.cid;
    const v = vocab[cid];
    if (!v) return;
    // Priority display: push to front of queue so it shows next
    calligraphyQueue.unshift({ kanji: v.kanji, kana: v.kana, german: v.de });
    // If nothing currently showing, start immediately
    if (calligraphyOverlays.length === 0) {
        _advanceCalligraphyQueue();
    }
});

function addLog(text, type) {
    const h = Math.floor(gameHour).toString().padStart(2, '0');
    const m = Math.floor(gameMinute).toString().padStart(2, '0');
    eventLog.unshift({ text, type, time: `T${gameDay} ${h}:${m}` });
    if (eventLog.length > 80) eventLog.pop();
    renderLog();
}

function renderLog() {
    const el = document.getElementById('event-log');
    el.innerHTML = eventLog.slice(0, 30).map(e =>
        `<div class="log-entry ${e.type}"><span class="log-time">${e.time}</span>${e.text}</div>`
    ).join('');
}

const TIME_ICONS = {
    sun:  '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
    dawn: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 16a4.5 4.5 0 0 1 9 0"/><path d="M3 19.5h18M12 6.5v3M5.6 10.6l1.8 1.8M18.4 10.6l-1.8 1.8"/></svg>',
    moon: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/></svg>',
};
let _timeFp = '';
function updateTimeDisplay() {
    const h = Math.floor(gameHour).toString().padStart(2, '0');
    const m = Math.floor(gameMinute).toString().padStart(2, '0');
    const weather = getWeatherLabel();
    const season = getSeasonLabel();
    const t = gameHour + gameMinute / 60;
    const phase = t >= 5 && t < 7.5 ? 'dawn' : t >= 7.5 && t < 17.5 ? 'sun' : t >= 17.5 && t < 19.5 ? 'dusk' : 'moon';
    const fp = [gameDay, h, m, weather, season, phase].join('|');
    if (fp === _timeFp) return;
    _timeFp = fp;
    const el = document.getElementById('time-display');
    el.dataset.phase = phase;
    el.setAttribute('aria-label', `Tag ${gameDay}, ${h}:${m} Uhr, ${season}, ${weather}`);
    el.innerHTML = `${TIME_ICONS[phase === 'dusk' ? 'dawn' : phase]}<span><b>Tag ${gameDay}</b> · ${h}:${m}</span><span class="tc-meta">${season} · ${weather}</span>`;
}

// ============================================================
//  SPEED CONTROL
// ============================================================
function setSpeed(s) {
    gameSpeed = s;
    document.querySelectorAll('#speed-group button').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const btn = document.getElementById(`btn-${s === 0 ? 'pause' : s + 'x'}`);
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
}
