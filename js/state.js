// Nihongo Mura — Game state, village milestones, proverbs and the Person class

// ============================================================
//  GAME STATE
// ============================================================
let gameSpeed = 1;
let gameTick = 0;
let gameDay = 1;
let gameHour = 6;
let gameMinute = 0;
let vocab = {};
let persons = [];
let worldObjects = [];
let cachedTeahouse = null;
let cachedBuildingObjects = [];
let speechBubbles = [];
let eventLog = [];
let learnFlashes = [];
let calligraphyOverlays = [];
let calligraphyQueue = [];
let proverbOverlay = null;
let proverbMilestonesHit = new Set();
let npcs = [];
let npcBubbles = [];
let canvas, ctx;
let canvasScale = 1;
let dpr = 1;

// Weather system
let currentWeather = 'clear';
let previousWeather = 'clear';
let nextWeatherChange = 800;
let weatherParticles = [];
let rainSplashes = [];
let weatherIntensity = 0;
let targetWeatherIntensity = 0;

// Atmospheric particle system (decorative, season/time-dependent)
let atmosParticles = [];

// Object click tooltip
let objectTooltip = null;

// Contextual object label glow
let activeObjectGlow = null;

// Vocab learning history for sparkline
let vocabHistory = [];

// Quiz system
let quizActive = false;
let quizTimer = 0;
let quizCooldown = 2400;
let quizData = null;
let quizResult = null;
let quizResultTimer = 0;
let learnerFreezeTimer = 0;
let quizOptionRects = [];
// Per-word quiz memory: { [conceptId]: { asked, misses, lastTick } } plus the most recent targets
let quizStats = {};
let quizRecent = [];

// Camp progression
let campProgress = {};
let campDecorations = [];
let campMilestonesHit = new Set();

// Storytelling state
let storytelling = { active: false, sentences: [], currentIdx: 0, timer: 0, cooldownDay: -1 };

// Discovery state
let discoveries = [];
let discoveryTimer = 0;
let discoveredTypes = new Set();

const CAMP_MILESTONES = [
    { id: 'bamboo_stack',   req: { cut_bamboo: 3 },          x: 75,  y: 215, desc: 'Bambusstangen stehen bereit.' },
    { id: 'brush_rack',     req: { write_calligraphy: 3 },   x: 515, y: 160, desc: 'Pinsel hängen am Gestell.' },
    { id: 'tea_drying',     req: { pick_tea: 3 },            x: 352, y: 492, desc: 'Teeblätter trocknen in der Sonne.' },
    { id: 'fish_basket',    req: { fish_catch: 3 },          x: 675, y: 510, desc: 'Körbe voller Fisch stehen bereit.' },
    { id: 'ink_set',        req: { grind_ink: 3 },           x: 510, y: 165, desc: 'Ein Tusche-Set liegt bereit.' },
    { id: 'lantern_circle', req: { make_lantern: 2 },        x: 450, y: 195, desc: 'Rote Laternen schmücken den Platz.' },
    { id: 'roof_tiles',     req: { make_pottery: 3 },        x: 195, y: 215, desc: 'Neue Dachziegel liegen bereit.' },
    { id: 'rice_sacks',     req: { cook_rice: 5 },           x: 365, y: 195, desc: 'Reissäcke stehen neben der Küche.' },
    { id: 'origami_display', req: { fold_origami: 2 },        x: 415, y: 265, desc: 'Origami-Figuren schmücken den Raum.' },
    { id: 'ceramic_set',    req: { make_pottery: 2 },        x: 355, y: 195, desc: 'Keramikschalen stehen aufgereiht.' },
];

const PROVERBS = [
    { words: 25,  chars: '千里の道も一歩から',         kana: 'せんりのみちもいっぽから',               german: 'Auch eine Reise von tausend Meilen beginnt mit einem Schritt' },
    { words: 50,  chars: '習うより慣れよ',             kana: 'ならうよりなれよ',                       german: 'Übung macht den Meister' },
    { words: 75,  chars: '継続は力なり',               kana: 'けいぞくはちからなり',                   german: 'Beständigkeit ist Kraft' },
    { words: 100, chars: '猿も木から落ちる',           kana: 'さるもきからおちる',                     german: 'Selbst Affen fallen vom Baum' },
    { words: 125, chars: '石の上にも三年',             kana: 'いしのうえにもさんねん',                 german: 'Drei Jahre auf dem Stein — Geduld führt zum Erfolg' },
    { words: 150, chars: '七転び八起き',               kana: 'ななころびやおき',                       german: 'Sieben Mal fallen, acht Mal aufstehen' },
    { words: 175, chars: '塵も積もれば山となる',       kana: 'ちりもつもればやまとなる',               german: 'Auch Staub wird zum Berg, wenn er sich anhäuft' },
    { words: 200, chars: '百聞は一見に如かず',         kana: 'ひゃくぶんはいっけんにしかず',           german: 'Einmal sehen ist besser als hundertmal hören' },
    { words: 225, chars: '花は桜木人は武士',           kana: 'はなはさくらぎひとはぶし',               german: 'Unter Blumen die Kirschblüte, unter Menschen der Samurai' },
    { words: 250, chars: '初心忘るべからず',           kana: 'しょしんわするべからず',                 german: 'Vergiss niemals deinen Anfängergeist' },
];

function checkCampMilestones() {
    for (const m of CAMP_MILESTONES) {
        if (campMilestonesHit.has(m.id)) continue;
        let met = true;
        for (const [action, count] of Object.entries(m.req)) {
            if ((campProgress[action] || 0) < count) { met = false; break; }
        }
        if (met) {
            campMilestonesHit.add(m.id);
            campDecorations.push({ id: m.id, x: m.x, y: m.y });
            addLog(`Die Stadt wächst: ${m.desc}`, 'speak');
        }
    }
}

function drawCampDecorations(ctx) {
    for (const d of campDecorations) drawCampDecoration(ctx, d);
}
function drawCampDecoration(ctx, d) {
    {
        const x = d.x * canvasScale;
        const y = d.y * canvasScale;
        const s = canvasScale;

        ctx.save();
        switch (d.id) {
            case 'bamboo_stack':
                // Bundled bamboo poles
                ctx.fillStyle = '#4a8a3a';
                for (let i = 0; i < 5; i++) {
                    ctx.fillRect(x + (i*3 - 6)*s, y - 12*s, 2.5*s, 18*s);
                }
                ctx.fillStyle = '#3a7a2a';
                for (let i = 0; i < 5; i++) {
                    ctx.beginPath();
                    ctx.arc(x + (i*3 - 5)*s, y - 12*s, 1.2*s, 0, Math.PI*2);
                    ctx.fill();
                }
                // Binding rope
                ctx.strokeStyle = '#8a7050';
                ctx.lineWidth = 1*s;
                ctx.beginPath();
                ctx.moveTo(x - 7*s, y - 4*s);
                ctx.lineTo(x + 10*s, y - 4*s);
                ctx.stroke();
                break;
            case 'brush_rack':
                // Wooden rack with hanging brushes
                ctx.strokeStyle = '#5a3a1a';
                ctx.lineWidth = 1.5*s;
                ctx.beginPath();
                ctx.moveTo(x - 10*s, y + 5*s); ctx.lineTo(x - 8*s, y - 10*s);
                ctx.moveTo(x + 10*s, y + 5*s); ctx.lineTo(x + 8*s, y - 10*s);
                ctx.moveTo(x - 9*s, y - 8*s); ctx.lineTo(x + 9*s, y - 8*s);
                ctx.stroke();
                // Brushes hanging down
                for (let i = -2; i <= 2; i++) {
                    ctx.fillStyle = '#5a3a1a';
                    ctx.fillRect(x + i*4*s - 0.5*s, y - 8*s, 1*s, 8*s);
                    ctx.fillStyle = '#2a2a2a';
                    ctx.beginPath();
                    ctx.moveTo(x + i*4*s - 1*s, y);
                    ctx.lineTo(x + i*4*s, y + 3*s);
                    ctx.lineTo(x + i*4*s + 1*s, y);
                    ctx.closePath();
                    ctx.fill();
                }
                break;
            case 'tea_drying':
                // Flat bamboo trays with tea leaves
                ctx.fillStyle = '#a08a50';
                ctx.beginPath();
                ctx.ellipse(x, y, 12*s, 4*s, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.strokeStyle = '#8a7040';
                ctx.lineWidth = 0.5*s;
                ctx.stroke();
                // Tea leaves
                ctx.fillStyle = '#3a6a2a';
                for (let i = 0; i < 8; i++) {
                    const lx = x + (Math.sin(i * 2.7) * 8)*s;
                    const ly = y + (Math.cos(i * 3.1) * 2)*s;
                    ctx.beginPath();
                    ctx.ellipse(lx, ly, 1.5*s, 0.8*s, i * 0.5, 0, Math.PI*2);
                    ctx.fill();
                }
                break;
            case 'fish_basket':
                // Woven basket with fish
                ctx.fillStyle = '#8a7040';
                ctx.beginPath();
                ctx.ellipse(x, y + 2*s, 7*s, 5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Weave pattern
                ctx.strokeStyle = '#7a6030';
                ctx.lineWidth = 0.5*s;
                for (let i = -2; i <= 2; i++) {
                    ctx.beginPath();
                    ctx.moveTo(x + i*3*s, y - 3*s);
                    ctx.lineTo(x + i*3*s, y + 7*s);
                    ctx.stroke();
                }
                // Fish poking out
                ctx.fillStyle = '#7a9aaa';
                ctx.beginPath();
                ctx.ellipse(x - 2*s, y - 2*s, 3*s, 1.5*s, -0.3, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(x + 3*s, y - 1*s, 2.5*s, 1.2*s, 0.2, 0, Math.PI*2);
                ctx.fill();
                break;
            case 'ink_set':
                // Ink stone (black rectangle) + ink stick
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(x - 5*s, y - 2*s, 10*s, 6*s);
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(x - 4*s, y - 1*s, 8*s, 4*s);
                // Ink pool
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath();
                ctx.ellipse(x + 1*s, y + 1*s, 3*s, 1.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Ink stick
                ctx.fillStyle = '#1a1a2a';
                ctx.save();
                ctx.translate(x + 8*s, y);
                ctx.rotate(0.3);
                ctx.fillRect(-1*s, -4*s, 2*s, 8*s);
                ctx.restore();
                break;
            case 'lantern_circle':
                // Circle of red lanterns on poles
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const lx = x + Math.cos(angle) * 16*s;
                    const ly = y + Math.sin(angle) * 12*s;
                    // Pole
                    ctx.strokeStyle = '#5a3a1a';
                    ctx.lineWidth = 1*s;
                    ctx.beginPath();
                    ctx.moveTo(lx, ly + 3*s);
                    ctx.lineTo(lx, ly - 8*s);
                    ctx.stroke();
                    // Lantern
                    ctx.fillStyle = '#cc3030';
                    ctx.beginPath();
                    ctx.ellipse(lx, ly - 10*s, 2.5*s, 3.5*s, 0, 0, Math.PI*2);
                    ctx.fill();
                    // Gold trim
                    ctx.strokeStyle = '#d4a030';
                    ctx.lineWidth = 0.5*s;
                    ctx.beginPath();
                    ctx.moveTo(lx - 2.5*s, ly - 10*s);
                    ctx.lineTo(lx + 2.5*s, ly - 10*s);
                    ctx.stroke();
                }
                break;
            case 'roof_tiles':
                // Stack of curved roof tiles
                ctx.fillStyle = '#5a5a5a';
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 4 - row; col++) {
                        const tx = x + (col - (3 - row) / 2) * 5*s;
                        const ty = y + (row * 4 - 2)*s;
                        ctx.beginPath();
                        ctx.arc(tx, ty, 2.5*s, Math.PI, 0);
                        ctx.fill();
                        ctx.fillStyle = '#4a4a4a';
                        ctx.fillRect(tx - 2.5*s, ty, 5*s, 1.5*s);
                        ctx.fillStyle = '#5a5a5a';
                    }
                }
                break;
            case 'rice_sacks':
                // Burlap sacks of rice
                ctx.fillStyle = '#b0a070';
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.ellipse(x + i*7*s, y + 2*s, 4*s, 5*s, 0, 0, Math.PI*2);
                    ctx.fill();
                }
                // Tied tops
                ctx.strokeStyle = '#8a7050';
                ctx.lineWidth = 1*s;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(x + i*7*s - 2*s, y - 3*s);
                    ctx.lineTo(x + i*7*s, y - 5*s);
                    ctx.lineTo(x + i*7*s + 2*s, y - 3*s);
                    ctx.stroke();
                }
                break;
            case 'origami_display':
                // Origami figures on a wooden shelf
                // Shelf
                ctx.fillStyle = '#8a6a3a';
                ctx.fillRect(x - 14*s, y + 2*s, 28*s, 2*s);
                // Origami crane (left)
                ctx.fillStyle = '#e0d0b0';
                ctx.beginPath();
                ctx.moveTo(x - 8*s, y + 1*s);
                ctx.lineTo(x - 5*s, y - 6*s);
                ctx.lineTo(x - 2*s, y - 2*s);
                ctx.lineTo(x - 4*s, y + 1*s);
                ctx.closePath();
                ctx.fill();
                // Wing
                ctx.beginPath();
                ctx.moveTo(x - 5*s, y - 4*s);
                ctx.lineTo(x - 10*s, y - 3*s);
                ctx.lineTo(x - 6*s, y - 1*s);
                ctx.closePath();
                ctx.fill();
                // Origami boat (center)
                ctx.fillStyle = '#c8a0a0';
                ctx.beginPath();
                ctx.moveTo(x - 3*s, y + 1*s);
                ctx.lineTo(x, y - 4*s);
                ctx.lineTo(x + 3*s, y + 1*s);
                ctx.closePath();
                ctx.fill();
                // Origami frog (right)
                ctx.fillStyle = '#80c060';
                ctx.beginPath();
                ctx.moveTo(x + 5*s, y + 1*s);
                ctx.lineTo(x + 7*s, y - 4*s);
                ctx.lineTo(x + 10*s, y - 2*s);
                ctx.lineTo(x + 9*s, y + 1*s);
                ctx.closePath();
                ctx.fill();
                break;
            case 'ceramic_set':
                // Row of ceramic pots and vases
                // Large pot
                ctx.fillStyle = '#b08050';
                ctx.beginPath();
                ctx.ellipse(x - 6*s, y + 2*s, 4*s, 4*s, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = '#a07040';
                ctx.fillRect(x - 8*s, y - 2*s, 4*s, 1.5*s);
                // Medium vase
                ctx.fillStyle = '#c0a060';
                ctx.beginPath();
                ctx.ellipse(x + 2*s, y + 1*s, 3*s, 4*s, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.fillRect(x + 0.5*s, y - 4*s, 3*s, 2*s);
                // Small cup
                ctx.fillStyle = '#d0b070';
                ctx.beginPath();
                ctx.ellipse(x + 9*s, y + 3*s, 2.5*s, 2.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Blue glaze pattern on large pot
                ctx.strokeStyle = '#4060a0';
                ctx.lineWidth = 0.5*s;
                ctx.beginPath();
                ctx.arc(x - 6*s, y + 2*s, 2.5*s, 0, Math.PI*2);
                ctx.stroke();
                break;
        }
        ctx.restore();
    }
}

// ============================================================
//  PERSON CLASS
// ============================================================
class Person {
    constructor(name, role, color) {
        this.name = name;
        this.role = role; // 'speaker' or 'learner'
        this.color = color;

        // Random attributes 1-10
        this.geschick = randInt(1, 10);      // Dexterity: movement speed + action speed
        this.neugier = randInt(1, 10);       // Curiosity: wander tendency + action variety
        this.geselligkeit = randInt(1, 10);  // Sociability: social actions + staying close
        this.wahrnehmung = randInt(1, 10);   // Perception: hearing range + learn chance

        // Appearance — Edo period Japanese / German traveler
        const skinTones = ['#e8c8a0','#d4b088','#e0c098','#dab890','#e8d0a8','#d0a880'];
        const hairColors = ['#1a1008','#0a0a08','#1a1a10','#2a1a10'];
        const clothColors_s = ['#4a6a8a','#6a3030','#3a5a3a','#8a6a30']; // Japanese robes
        const clothColors_l = ['#6a5a40','#5a4a30','#7a6a50']; // German traveler clothing
        this.skinTone = randEl(skinTones);
        this.hairColor = randEl(hairColors);
        this.clothColor = randEl(role === 'speaker' ? clothColors_s : clothColors_l);

        // Position
        this.x = role === 'speaker' ? 400 : 440;
        this.y = role === 'speaker' ? 300 : 320;
        this.targetX = this.x;
        this.targetY = this.y;
        this.facing = 0; // angle

        // Needs (0-100, 100 = full)
        this.hunger = 70 + randInt(0, 30);
        this.thirst = 70 + randInt(0, 30);
        this.energy = 60 + randInt(0, 40);

        // State
        this.state = 'idle'; // idle, moving, acting, speaking
        this.currentAction = null;
        this.actionTimer = 0;
        this.idleTimer = randInt(30, 120);
        this.activityDe = 'Untätig';

        // Spaced repetition: track action history for variety
        this.actionHistory = []; // recent action IDs (newest first)
        this.actionHistoryMax = 12; // remember last N actions

        // Learner follow behavior
        this.followMode = 'following'; // 'following', 'wandering', 'returning'
        this.wanderTimer = 0;
        this.followTimer = randInt(300, 800);  // time before considering a wander
        this.returnUrgency = 0;

        // Learning (only for learner)
        this.knownWords = new Set();
        this.wordHistory = []; // for UI display order

        // Relationships (name → score 0-100)
        this.relationships = {};

        // Mood (computed periodically)
        this.mood = null;

        // Waypoint navigation
        this.waypoints = [];
        this.stuckTimer = 0;
        this.lastMoveX = this.x;
        this.lastMoveY = this.y;
        // Steer memory: keep a chosen avoidance direction for several frames to prevent jitter
        this.steerDx = 0;
        this.steerDy = 0;
        this.steerFrames = 0;
    }

    get moveSpeed() {
        return 0.6 + this.geschick * 0.18;
    }

    get needDecayRate() {
        // Higher geschick = slightly slower decay (skilled people are more efficient)
        return 0.005 / (0.5 + this.geschick * 0.06);
    }

    get learnChance() {
        // Perception is the primary driver of learning ability (reduced by 1/3)
        return (this.wahrnehmung * 0.08 + 0.05) * 0.667;
    }

    get hearingRange() {
        // Perception affects how far the learner can hear the speaker
        return 120 + this.wahrnehmung * 12;
    }

    get wanderChance() {
        // Curiosity drives how often the learner wanders off
        return 0.04 + this.neugier * 0.016;
    }

    get socialWeight() {
        // Sociability affects social action preference (0.5 - 2.0 range)
        return 0.5 + this.geselligkeit * 0.15;
    }

    update(dt) {
        // Decay needs
        this.hunger -= this.needDecayRate * dt;
        this.thirst -= this.needDecayRate * dt * 1.2;
        if (this.state === 'acting' && this.currentAction && this.currentAction.id !== 'sleep_house') {
            this.energy -= this.needDecayRate * dt * 0.8;
        } else if (this.state === 'idle') {
            this.energy += 0.003 * dt;
        }
        this.hunger = Math.max(0, Math.min(100, this.hunger));
        this.thirst = Math.max(0, Math.min(100, this.thirst));
        this.energy = Math.max(0, Math.min(100, this.energy));
    }

    distTo(ox, oy) {
        return entityDistTo(this, ox, oy);
    }

    moveToward(tx, ty, dt) {
        let tType = null;
        if (this.currentAction) {
            if (this.currentAction.target && typeof this.currentAction.target === 'string') tType = this.currentAction.target;
            else { const a = ACTION_DEFS.find(a => a.id === this.currentAction.id); if (a) tType = a.target; }
        }
        return moveEntityToward(this, tx, ty, dt, this.moveSpeed, 0.45, 120, tType);
    }
}
