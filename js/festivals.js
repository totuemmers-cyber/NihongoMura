// Nihongo Mura — Four-character idioms and seasonal festivals

// ============================================================
//  YOJIJUKUGO (四字熟語) SYSTEM — situational four-character idioms
// ============================================================
const YOJIJUKUGO_TRIGGERS = [
    { id: 'friendship',  chars: '以心伝心', kana: 'いしんでんしん',     de: 'Herz-zu-Herz-Kommunikation', check: () => { const r = persons[0].relationships[persons[1].name] || 0; return r >= 60; } },
    { id: 'hardwork',    chars: '一所懸命', kana: 'いっしょけんめい',   de: 'Mit aller Kraft arbeiten', check: () => campMilestonesHit.size >= 5 },
    { id: 'nature',      chars: '花鳥風月', kana: 'かちょうふうげつ',   de: 'Blumen, Vögel, Wind und Mond', check: () => gameHour >= 6 && gameHour < 8 && currentWeather === 'clear' && Math.random() < 0.0001 },
    { id: 'persevere',   chars: '七転八起', kana: 'ななころびやおき',   de: 'Sieben Mal fallen, acht Mal aufstehen', check: () => persons[1].knownWords.size >= 80 },
    { id: 'harmony',     chars: '和気藹藹', kana: 'わきあいあい',       de: 'Harmonische Atmosphäre', check: () => npcs.filter(n => (n.relationships[persons[0].name] || 0) > 30).length >= 3 },
    { id: 'moonlight',   chars: '風光明媚', kana: 'ふうこうめいび',     de: 'Wunderschöne Landschaft', check: () => gameHour >= 21 && gameDay % 8 === 4 && currentWeather === 'clear' },
    { id: 'rain',        chars: '晴耕雨読', kana: 'せいこううどく',     de: 'Bei Sonne arbeiten, bei Regen lesen', check: () => currentWeather === 'rain' && weatherIntensity > 0.5 && Math.random() < 0.0002 },
    { id: 'village',     chars: '一期一会', kana: 'いちごいちえ',       de: 'Einmalige Begegnung', check: () => gameDay >= 15 && persons[1].knownWords.size >= 40 },
];
let yojijukugoTriggered = new Set();
let yojijukugoOverlay = null;

// ============================================================
//  SEASONAL FESTIVALS (祭り)
// ============================================================
const FESTIVALS = [
    { id: 'hanami',   name: '花見',   kana: 'はなみ',     romaji: 'Hanami',   de: 'Kirschblütenfest',  dayInCycle: 5,  season: 'spring' },
    { id: 'tanabata', name: '七夕',   kana: 'たなばた',   romaji: 'Tanabata', de: 'Sternenfest',        dayInCycle: 15, season: 'summer' },
    { id: 'tsukimi',  name: '月見',   kana: 'つきみ',     romaji: 'Tsukimi',  de: 'Mondschaufest',      dayInCycle: 25, season: 'autumn' },
];

let activeFestival = null;
let festivalParticles = [];

function checkFestival() {
    const dayInCycle = ((gameDay - 1) % 40) + 1;
    const prev = activeFestival;
    activeFestival = FESTIVALS.find(f => f.dayInCycle === dayInCycle) || null;
    if (activeFestival && activeFestival !== prev) {
        addLog(`🎌 ${activeFestival.name} (${activeFestival.de}) beginnt!`, 'speak');
        festivalParticles = [];
    }
    if (!activeFestival) festivalParticles = [];
}

function updateFestivalParticles(dt) {
    if (!activeFestival) return;
    const maxP = 20;
    // Spawn festival-specific particles
    if (festivalParticles.length < maxP && Math.random() < 0.03 * dt) {
        if (activeFestival.id === 'hanami') {
            // Falling cherry blossom petals
            festivalParticles.push({
                type: 'sakura', x: randFloat(50, WORLD_W - 50), y: -10,
                vx: randFloat(-0.3, 0.3), vy: randFloat(0.2, 0.5),
                size: randFloat(2, 5), rot: randFloat(0, Math.PI * 2), rotSpeed: randFloat(-0.02, 0.02),
                life: randFloat(400, 700)
            });
        } else if (activeFestival.id === 'tanabata') {
            // Tanzaku paper strips swaying
            festivalParticles.push({
                type: 'tanzaku', x: randFloat(50, WORLD_W - 50), y: randFloat(20, 60),
                phase: randFloat(0, Math.PI * 2), size: randFloat(3, 6),
                color: randEl(['#e84040','#4080e8','#40c040','#e8c040','#c040c0']),
                life: randFloat(300, 600), maxLife: 0
            });
            festivalParticles[festivalParticles.length - 1].maxLife = festivalParticles[festivalParticles.length - 1].life;
        } else if (activeFestival.id === 'tsukimi') {
            // Glowing moon orbs
            festivalParticles.push({
                type: 'moonorb', x: randFloat(50, WORLD_W - 50), y: randFloat(20, 80),
                phase: randFloat(0, Math.PI * 2), size: randFloat(2, 4),
                life: randFloat(200, 400), maxLife: 0
            });
            festivalParticles[festivalParticles.length - 1].maxLife = festivalParticles[festivalParticles.length - 1].life;
        }
    }
    // Update particles
    for (const p of festivalParticles) {
        p.life -= dt;
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        if (p.type === 'sakura') { p.vx += Math.sin(gameTick * 0.01 + p.x * 0.05) * 0.003 * dt; p.rot += p.rotSpeed * dt; }
        if (p.type === 'tanzaku') p.vx = Math.sin(gameTick * 0.008 + p.phase) * 0.05;
    }
    festivalParticles = festivalParticles.filter(p => p.life > 0 && p.y > -30 && p.y < WORLD_H + 30);
}

function drawFestivalEffects(ctx) {
    if (!activeFestival || festivalParticles.length === 0) return;
    const s = canvasScale;
    ctx.save();
    for (const p of festivalParticles) {
        if (p.type === 'sakura') {
            // Cherry blossom petal
            const a = Math.min(1, p.life / 60);
            ctx.save();
            ctx.translate(p.x*s, p.y*s);
            ctx.rotate(p.rot);
            ctx.globalAlpha = a * 0.8;
            ctx.fillStyle = `rgba(255,180,200,0.9)`;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size*0.6*s, p.size*0.3*s, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = `rgba(255,220,230,0.6)`;
            ctx.beginPath();
            ctx.ellipse(p.size*0.2*s, 0, p.size*0.3*s, p.size*0.2*s, 0.3, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
        } else if (p.type === 'tanzaku') {
            // Tanabata paper strip
            const fadeIn = Math.min(1, (p.maxLife - p.life) / 40);
            const fadeOut = Math.min(1, p.life / 40);
            const a = fadeIn * fadeOut;
            ctx.globalAlpha = a * 0.7;
            ctx.fillStyle = p.color;
            const sway = Math.sin(gameTick * 0.01 + p.phase) * 3;
            ctx.fillRect((p.x + sway)*s, p.y*s, p.size*0.3*s, p.size*2*s);
            ctx.globalAlpha = 1;
        } else if (p.type === 'moonorb') {
            const fadeIn = Math.min(1, (p.maxLife - p.life) / 40);
            const fadeOut = Math.min(1, p.life / 40);
            const a = fadeIn * fadeOut * (0.3 + Math.sin(p.phase + gameTick * 0.02) * 0.15);
            ctx.fillStyle = `rgba(255,230,180,${a})`;
            ctx.beginPath();
            ctx.arc((p.x + Math.sin(gameTick*0.008 + p.phase)*15)*s, p.y*s, p.size*s, 0, Math.PI*2);
            ctx.fill();
        }
    }

    // Festival banner at top
    if (activeFestival) {
        const bannerAlpha = 0.6 + Math.sin(gameTick * 0.03) * 0.1;
        const cw = camera.viewW;
        setScreenTransform(ctx);
        void bannerAlpha;
        const label = activeFestival.name, sub = activeFestival.romaji;
        const px = Math.round(11 * s), spx = Math.round(9 * s);
        ctx.font = `700 ${px}px ${CJK_FONT}`;
        const lw = ctx.measureText(label).width;
        ctx.font = `500 ${spx}px ${UI_FONT}`;
        const sw = ctx.measureText(sub).width;
        // Sits under the time chip (top-left); the top centre belongs to the idiom banner
        const w = lw + sw + 34 * s, h = 22 * s, x0 = cw < 560 ? 8 : 12, y0 = cw < 560 ? 44 : 52;
        ctx.globalAlpha = 0.95;
        inkCard(ctx, x0, y0, w, h, h / 2, 'rgba(200,68,47,0.6)');
        const glow = 0.7 + Math.sin(gameTick * 0.06) * 0.3;
        ctx.fillStyle = `rgba(232,96,60,${glow})`;
        ctx.beginPath(); ctx.arc(x0 + 11 * s, y0 + h / 2, 3.2 * s, 0, Math.PI * 2); ctx.fill();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = `700 ${px}px ${CJK_FONT}`;
        ctx.fillStyle = '#f3ead8';
        ctx.fillText(label, x0 + 20 * s, y0 + h / 2 + 0.5 * s);
        ctx.font = `500 ${spx}px ${UI_FONT}`;
        ctx.fillStyle = '#c99a3a';
        ctx.fillText(sub, x0 + 26 * s + lw, y0 + h / 2 + 0.5 * s);
        ctx.globalAlpha = 1;
    }
    ctx.restore();
}

class YojijukugoCloud {
    constructor(yoji) {
        this.chars = yoji.chars;
        this.kana = yoji.kana;
        this.de = yoji.de;
        this.life = 300;
        this.maxLife = 300;
    }
    update(dt) {
        this.life -= dt;
        return this.life > 0;
    }
    draw(ctx) {
        const cw = canvas.width / dpr;
        const s = canvasScale;
        const fadeIn = Math.min(1, (this.maxLife - this.life) / 40);
        const fadeOut = Math.min(1, this.life / 40);
        const alpha = fadeIn * fadeOut;
        const drop = REDUCED_MOTION ? 0 : (1 - fadeIn) * -10 * s;
        ctx.save();
        ctx.globalAlpha = alpha;
        const charsPx = Math.round(19 * s), subPx = Math.round(9.5 * s);
        ctx.font = `800 ${charsPx}px ${CJK_FONT}`;
        const cwid = ctx.measureText(this.chars).width + this.chars.length * 4 * s;
        ctx.font = `500 ${subPx}px ${UI_FONT}`;
        const sub = this.kana + ' — ' + this.de;
        const w = Math.max(cwid, ctx.measureText(sub).width) + 54 * s, h = 52 * s;
        // Top centre on wide screens; on phones the top is taken (time chip, calligraphy card),
        // so it sits near the bottom, above the panel button
        const narrow = cw < 560;
        const x0 = (cw - w) / 2, y0 = narrow ? camera.viewH - h - 84 - drop : 14 * s + drop;
        inkCard(ctx, x0, y0, w, h, 6 * s, 'rgba(201,154,58,0.6)');
        ctx.fillStyle = '#c99a3a';                              // gilt rods, like a hanging scroll
        ctx.fillRect(x0 + 6 * s, y0 - 1.5 * s, w - 12 * s, 2.5 * s);
        ctx.fillRect(x0 + 6 * s, y0 + h - 1 * s, w - 12 * s, 2.5 * s);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${charsPx}px ${CJK_FONT}`;
        ctx.fillStyle = '#f3ead8';
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${4 * s}px`;
        ctx.fillText(this.chars, (cw) / 2 + 2 * s, y0 + h * 0.4);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        ctx.font = `500 ${subPx}px ${UI_FONT}`;
        ctx.fillStyle = '#c99a3a';
        ctx.fillText(sub, cw / 2, y0 + h * 0.78);
        hanko(ctx, x0 + w - 14 * s, y0 + 14 * s, 14 * s, '熟', 0.1);
        ctx.restore();
    }
}

function checkYojijukugoTriggers() {
    if (yojijukugoOverlay) return; // one at a time
    for (const c of YOJIJUKUGO_TRIGGERS) {
        if (yojijukugoTriggered.has(c.id)) continue;
        if (c.check()) {
            yojijukugoTriggered.add(c.id);
            yojijukugoOverlay = new YojijukugoCloud(c);
            addLog(`四字熟語: ${c.chars} — ${c.de}`, 'learn');
            break;
        }
    }
}
