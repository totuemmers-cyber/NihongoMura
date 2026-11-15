// Nihongo Mura — Background villagers, wildlife and relationships

// ============================================================
//  BACKGROUND NPCs (non-learning villagers)
// ============================================================
class NPC {
    constructor(name) {
        this.name = name;
        this.x = clampOutOfRiver(randFloat(80, WORLD_W - 80));
        this.y = randFloat(80, WORLD_H - 80);
        this.targetX = this.x;
        this.targetY = this.y;
        this.facing = randFloat(0, Math.PI * 2);
        this.speed = randFloat(0.4, 1.0);
        this.state = 'idle'; // idle, moving, chatting
        this.idleTimer = randFloat(60, 300);
        this.chatTimer = 0;
        this.chatPartner = null;
        this.currentAction = null;
        this.activityDe = 'Untätig';
        this.role = 'npc';

        // Appearance
        const skinTones = ['#e8c8a0','#d4b088','#e0c098','#dab890','#e8d0a8','#d0a880'];
        const hairColors = ['#1a1008','#0a0a08','#1a1a10','#2a1a10'];
        const clothColors = ['#5a5a6a','#6a5040','#4a6a5a','#7a5a3a','#5a4a60','#6a6a4a'];
        this.skinTone = randEl(skinTones);
        this.hairColor = randEl(hairColors);
        this.clothColor = randEl(clothColors);
        this.color = '#8a8070';

        // Relationships
        this.relationships = {};

        // Waypoint navigation
        this.waypoints = [];
        this.stuckTimer = 0;
        this.lastMoveX = this.x;
        this.lastMoveY = this.y;
        // Steer memory
        this.steerDx = 0;
        this.steerDy = 0;
        this.steerFrames = 0;

        // Affinities — preferred routine locations
        const affinityPool = ['kitchen','garden','market','teahouse','well','workshop','school','shrine','pagoda'];
        const shuffled = affinityPool.slice().sort(() => Math.random() - 0.5);
        this.affinities = shuffled.slice(0, randInt(2, 3));

        // Watching (react to nearby events)
        this.watchTarget = null;
        this.watchTimer = 0;

        // Mood
        this.mood = null;
        this.moodTimer = 0;
    }

    distTo(ox, oy) {
        return entityDistTo(this, ox, oy);
    }

    moveToward(tx, ty, dt) {
        return moveEntityToward(this, tx, ty, dt, this.speed, 0.35, 30, null);
    }
}

// ============================================================
//  SEASONAL WILDLIFE & MIGRATION
// ============================================================
let wildlife = [];
let lastWildlifeSeason = null;

const ANIMAL_TYPES = [
    { type: 'crane',     seasons: ['spring','summer','autumn'], speed: 0.5, fleeRange: 90, zonePref: 'river', flockSize: 1 },
    { type: 'magpie',    seasons: ['spring','summer'],          speed: 1.2, fleeRange: 70, zonePref: 'sky',   flockSize: 3 },
    { type: 'rabbit',    seasons: ['spring','summer','autumn','winter'], speed: 1.0, fleeRange: 60, zonePref: 'land', flockSize: 1 },
    { type: 'koi',       seasons: ['spring','summer','autumn'], speed: 0.3, fleeRange: 20, zonePref: 'water', flockSize: 2 },
    { type: 'cat',       seasons: ['spring','summer','autumn','winter'], speed: 0.6, fleeRange: 50, zonePref: 'land', flockSize: 1 },
    { type: 'butterfly', seasons: ['spring','summer'],          speed: 0.8, fleeRange: 60, zonePref: 'sky',   flockSize: 2 },
    { type: 'tanuki',    seasons: ['spring','summer','autumn'], speed: 0.7, fleeRange: 80, zonePref: 'land', flockSize: 1 },
];

// Water zone near the pond south of village
const WATER_ZONE = { x: 420, y: 560, r: 40 };

// Land animals must avoid the river
const LAND_ANIMAL_TYPES = new Set(['rabbit', 'cat', 'tanuki']);

function clampLandAnimal(x, y) {
    // Push out of river zone (RIVER_LEFT..RIVER_RIGHT), except near bridge (wide tolerance)
    if (x > RIVER_LEFT && x < RIVER_RIGHT) {
        if (y > BRIDGE.y - BRIDGE.halfH - 35 && y < BRIDGE.y + BRIDGE.halfH + 35) return { x, y }; // bridge corridor OK
        // Push to nearest bank
        x = (x - RIVER_LEFT < RIVER_RIGHT - x) ? RIVER_LEFT - 5 : RIVER_RIGHT + 5;
    }
    return { x, y };
}

class WildAnimal {
    constructor(type, x, y, speed, fleeRange) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.fleeRange = fleeRange;
        this.targetX = x;
        this.targetY = y;
        this.wanderTimer = randFloat(60, 200);
        this.fleeing = false;
        this.animPhase = randFloat(0, Math.PI * 2);
        this.facing = randFloat(0, Math.PI * 2);
        this.alive = true;
        // Reaction state
        this.reactAngle = this.facing;
        this.reactTimer = 0;
        this.approaching = false;
    }

    update(dt) {
        this.animPhase += dt * 0.05;

        // Check flee from all characters
        let closestDist = Infinity;
        let fleeFromX = 0, fleeFromY = 0;
        const allChars = [...persons, ...npcs];
        for (const c of allChars) {
            const d = Math.sqrt((this.x - c.x) ** 2 + (this.y - c.y) ** 2);
            if (d < closestDist) {
                closestDist = d;
                fleeFromX = c.x;
                fleeFromY = c.y;
            }
        }

        if (closestDist < this.fleeRange) {
            this.fleeing = true;
            const angle = Math.atan2(this.y - fleeFromY, this.x - fleeFromX);
            this.targetX = this.x + Math.cos(angle) * 80;
            this.targetY = this.y + Math.sin(angle) * 80;
            if (this.type === 'koi') {
                this.targetX = Math.max(WATER_ZONE.x - WATER_ZONE.r, Math.min(WATER_ZONE.x + WATER_ZONE.r, this.targetX));
                this.targetY = Math.max(WATER_ZONE.y - WATER_ZONE.r * 0.6, Math.min(WATER_ZONE.y + WATER_ZONE.r * 0.6, this.targetY));
            }
            this.targetX = Math.max(10, Math.min(WORLD_W - 10, this.targetX));
            this.targetY = Math.max(10, Math.min(WORLD_H - 10, this.targetY));
            // Land animals: don't flee into the river
            if (LAND_ANIMAL_TYPES.has(this.type)) {
                const c = clampLandAnimal(this.targetX, this.targetY);
                this.targetX = c.x; this.targetY = c.y;
            }
        } else {
            this.fleeing = false;
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = randFloat(80, 250);
                if (this.type === 'koi') {
                    // Stay in pond
                    this.targetX = WATER_ZONE.x + randFloat(-WATER_ZONE.r, WATER_ZONE.r);
                    this.targetY = WATER_ZONE.y + randFloat(-WATER_ZONE.r * 0.6, WATER_ZONE.r * 0.6);
                } else if (this.type === 'crane') {
                    // Stay near river
                    this.targetX = randFloat(690, 790);
                    this.targetY = Math.max(60, Math.min(580, this.y + randFloat(-80, 80)));
                } else {
                    this.targetX = Math.max(20, Math.min(WORLD_W - 20, this.x + randFloat(-100, 100)));
                    this.targetY = Math.max(20, Math.min(WORLD_H - 20, this.y + randFloat(-60, 60)));
                    // Land animals: avoid the river
                    if (LAND_ANIMAL_TYPES.has(this.type)) {
                        const c = clampLandAnimal(this.targetX, this.targetY);
                        this.targetX = c.x; this.targetY = c.y;
                    }
                }
            }
        }

        // Ambient reactions (non-fleeing)
        if (!this.fleeing) {
            const speaker = persons[0], learner = persons[1];
            const dSpeaker = Math.sqrt((this.x - speaker.x) ** 2 + (this.y - speaker.y) ** 2);
            const dLearner = Math.sqrt((this.x - learner.x) ** 2 + (this.y - learner.y) ** 2);

            if (this.type === 'crane' && dSpeaker < 120 && speechBubbles.length > 0) {
                // Crane turns head toward speaker
                const targetAngle = Math.atan2(speaker.y - this.y, speaker.x - this.x);
                this.reactAngle += (targetAngle - this.reactAngle) * 0.03 * dt;
                this.reactTimer = 60;
            } else if (this.type === 'cat' && dLearner < 80 && learner.state !== 'moving') {
                // Cat approaches idle learner
                if (!this.approaching && Math.random() < 0.002 * dt) this.approaching = true;
                if (this.approaching && dLearner > 20) {
                    this.targetX = learner.x + randFloat(-15, 15);
                    this.targetY = learner.y + randFloat(-15, 15);
                }
                if (learner.state === 'moving') this.approaching = false;
            } else if (this.type === 'magpie' && dSpeaker < 100 && speechBubbles.length > 0) {
                // Magpie flaps faster when speaker talks
                this.animPhase += dt * 0.08; // extra flap speed
            }

            // Decay reaction
            if (this.reactTimer > 0) {
                this.reactTimer -= dt;
            } else {
                this.reactAngle += (this.facing - this.reactAngle) * 0.02 * dt;
                this.approaching = false;
            }
        }

        // Move toward target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
            const spd = this.speed * (this.fleeing ? 2.0 : 0.6) * dt * 0.4;
            const step = Math.min(spd, dist);
            this.x += (dx / dist) * step;
            this.y += (dy / dist) * step;
            this.facing = Math.atan2(dy, dx);
        }
        // Koi: hard clamp position to pond every frame
        if (this.type === 'koi') {
            this.x = Math.max(WATER_ZONE.x - WATER_ZONE.r, Math.min(WATER_ZONE.x + WATER_ZONE.r, this.x));
            this.y = Math.max(WATER_ZONE.y - WATER_ZONE.r * 0.6, Math.min(WATER_ZONE.y + WATER_ZONE.r * 0.6, this.y));
        }
        // Land animals: hard clamp out of river every frame
        if (LAND_ANIMAL_TYPES.has(this.type)) {
            const c = clampLandAnimal(this.x, this.y);
            this.x = c.x; this.y = c.y;
        }

        // Despawn if off screen
        if (this.x < -30 || this.x > WORLD_W + 30 || this.y < -30 || this.y > WORLD_H + 30) {
            this.alive = false;
        }
    }
}

function spawnWildlife() {
    const season = getSeason();
    wildlife = [];
    for (const def of ANIMAL_TYPES) {
        if (!def.seasons.includes(season)) continue;
        let count = def.flockSize + (season === 'spring' ? 1 : 0);
        if (def.type === 'koi') count = Math.min(count, 2); // pond is small
        for (let i = 0; i < count; i++) {
            let x, y;
            if (def.zonePref === 'water') {
                x = WATER_ZONE.x + randFloat(-WATER_ZONE.r, WATER_ZONE.r);
                y = WATER_ZONE.y + randFloat(-WATER_ZONE.r * 0.5, WATER_ZONE.r * 0.5);
            } else if (def.zonePref === 'river') {
                // Along the drawn river (x ~710-790)
                x = randFloat(710, 780);
                y = randFloat(100, 550);
            } else if (def.zonePref === 'sky') {
                x = randFloat(50, WORLD_W - 50);
                y = randFloat(30, WORLD_H * 0.4);
            } else {
                x = randFloat(50, WORLD_W - 50);
                y = randFloat(50, WORLD_H - 50);
            }
            wildlife.push(new WildAnimal(def.type, x, y, def.speed, def.fleeRange));
        }
    }
    lastWildlifeSeason = season;
}

function updateWildlife(dt) {
    // Check for season change
    const season = getSeason();
    if (season !== lastWildlifeSeason) {
        spawnWildlife();
    }

    for (const a of wildlife) a.update(dt);
    wildlife = wildlife.filter(a => a.alive);

    // Speaker occasionally notices nearby animal
    if (persons.length > 0 && Math.random() < 0.0004 * dt) {
        const speaker = persons[0];
        if (speaker.state === 'idle') {
            for (const a of wildlife) {
                const d = speaker.distTo(a.x, a.y);
                const noticeRange = 60 + speaker.neugier * 8;
                if (d < noticeRange) {
                    speakerReactToAnimal(a.type);
                    break;
                }
            }
        }
    }
}

function speakerReactToAnimal(animalType) {
    const sent = pickLine(ANIMAL_LINES[animalType] || [['look','this']], 'animal_' + animalType, { polite: true });
    if (sent) speakerRemark(sent, t => `${persons[0].name}: "${t}" (${animalType})`);
}

function drawWildlife(ctx) {
    for (const a of wildlife) drawWildAnimal(ctx, a);
}
function drawWildAnimal(ctx, a) {
    {
        const x = a.x * canvasScale;
        const y = a.y * canvasScale;
        const s = canvasScale;
        const t = a.animPhase;

        ctx.save();
        ctx.translate(x, y);

        switch (a.type) {
            case 'crane': {
                // Long legs
                ctx.strokeStyle = '#2a2a2a';
                ctx.lineWidth = 1.2*s;
                const legBob = Math.sin(t * 2) * 2 * s;
                ctx.beginPath();
                ctx.moveTo(-3*s, 4*s); ctx.lineTo(-3*s, 14*s + legBob);
                ctx.moveTo(3*s, 4*s); ctx.lineTo(3*s, 14*s - legBob);
                ctx.stroke();
                // White body
                ctx.fillStyle = '#f0ece0';
                ctx.beginPath();
                ctx.ellipse(0, 0, 8*s, 5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Long neck — uses reactAngle for head turning
                const neckAngle = a.reactTimer > 0 ? a.reactAngle : a.facing;
                ctx.strokeStyle = '#f0ece0';
                ctx.lineWidth = 3*s;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a.facing) * 6*s, -2*s);
                ctx.quadraticCurveTo(Math.cos(neckAngle) * 10*s, -10*s, Math.cos(neckAngle) * 8*s, -16*s);
                ctx.stroke();
                // Head
                const hx = Math.cos(neckAngle) * 8*s;
                ctx.beginPath();
                ctx.arc(hx, -16*s, 3*s, 0, Math.PI*2);
                ctx.fillStyle = '#f0ece0';
                ctx.fill();
                // Red crown
                ctx.beginPath();
                ctx.arc(hx, -18*s, 1.5*s, 0, Math.PI*2);
                ctx.fillStyle = '#cc3030';
                ctx.fill();
                // Beak
                ctx.fillStyle = '#6a6a40';
                ctx.beginPath();
                ctx.moveTo(hx + Math.cos(a.facing) * 3*s, -16*s);
                ctx.lineTo(hx + Math.cos(a.facing) * 7*s, -15.5*s);
                ctx.lineTo(hx + Math.cos(a.facing) * 3*s, -15*s);
                ctx.closePath();
                ctx.fill();
                // Eye
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(hx + Math.cos(a.facing) * 1.5*s, -16.5*s, 0.7*s, 0, Math.PI*2);
                ctx.fill();
                // Black tail feathers
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath();
                ctx.moveTo(-6*s, -1*s);
                ctx.lineTo(-12*s, -4*s);
                ctx.lineTo(-10*s, 2*s);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'magpie': {
                // Body (black and white)
                ctx.fillStyle = '#1a1a2a';
                ctx.beginPath();
                ctx.ellipse(0, 0, 4*s, 2.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // White belly
                ctx.fillStyle = '#f0f0f0';
                ctx.beginPath();
                ctx.ellipse(0, 1*s, 2.5*s, 1.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Wings flapping
                ctx.fillStyle = '#2a2a3a';
                const wingUp = Math.sin(t * 6) * 4;
                ctx.beginPath();
                ctx.moveTo(-1*s, -1*s);
                ctx.lineTo(-7*s, (-3 - wingUp)*s);
                ctx.lineTo(-5*s, 1*s);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(1*s, -1*s);
                ctx.lineTo(7*s, (-3 - wingUp)*s);
                ctx.lineTo(5*s, 1*s);
                ctx.closePath();
                ctx.fill();
                // Long tail
                ctx.fillStyle = '#1a1a2a';
                ctx.beginPath();
                ctx.moveTo(-3*s, 1*s);
                ctx.lineTo(-9*s, 5*s);
                ctx.lineTo(-8*s, 3*s);
                ctx.closePath();
                ctx.fill();
                // Head
                ctx.fillStyle = '#1a1a2a';
                ctx.beginPath();
                ctx.arc(Math.cos(a.facing) * 3*s, -2*s, 2*s, 0, Math.PI*2);
                ctx.fill();
                // Eye
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(Math.cos(a.facing) * 4*s, -2.5*s, 0.6*s, 0, Math.PI*2);
                ctx.fill();
                break;
            }
            case 'rabbit': {
                // Body
                ctx.fillStyle = '#c8b890';
                ctx.beginPath();
                ctx.ellipse(0, 0, 5*s, 3.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Head
                ctx.beginPath();
                ctx.arc(Math.cos(a.facing) * 4*s, -2*s, 3*s, 0, Math.PI*2);
                ctx.fill();
                // Ears
                ctx.fillStyle = '#d0c0a0';
                ctx.beginPath();
                ctx.ellipse(Math.cos(a.facing) * 3*s - 1.5*s, -7*s, 1.2*s, 3.5*s, -0.2, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(Math.cos(a.facing) * 3*s + 1.5*s, -7*s, 1.2*s, 3.5*s, 0.2, 0, Math.PI*2);
                ctx.fill();
                // Inner ears (pink)
                ctx.fillStyle = '#e0a0a0';
                ctx.beginPath();
                ctx.ellipse(Math.cos(a.facing) * 3*s - 1.5*s, -7*s, 0.6*s, 2*s, -0.2, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(Math.cos(a.facing) * 3*s + 1.5*s, -7*s, 0.6*s, 2*s, 0.2, 0, Math.PI*2);
                ctx.fill();
                // Tail
                ctx.fillStyle = '#e0d8c0';
                ctx.beginPath();
                ctx.arc(-4*s, 0, 2*s, 0, Math.PI*2);
                ctx.fill();
                // Eye
                ctx.fillStyle = '#3a1a1a';
                ctx.beginPath();
                ctx.arc(Math.cos(a.facing) * 5.5*s, -2.5*s, 0.8*s, 0, Math.PI*2);
                ctx.fill();
                break;
            }
            case 'koi': {
                // Golden koi fish
                ctx.fillStyle = '#e8a030';
                ctx.beginPath();
                ctx.ellipse(0, 0, 6*s, 3*s, a.facing, 0, Math.PI*2);
                ctx.fill();
                // White patches
                ctx.fillStyle = '#f0e8d0';
                ctx.beginPath();
                ctx.ellipse(2*s, -0.5*s, 2*s, 1.5*s, a.facing + 0.3, 0, Math.PI*2);
                ctx.fill();
                // Tail fin
                ctx.fillStyle = '#d08020';
                const tailWag = Math.sin(t * 4) * 0.3;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a.facing + Math.PI) * 5*s, Math.sin(a.facing + Math.PI) * 5*s);
                ctx.lineTo(Math.cos(a.facing + Math.PI + 0.5 + tailWag) * 9*s, Math.sin(a.facing + Math.PI + 0.5 + tailWag) * 9*s);
                ctx.lineTo(Math.cos(a.facing + Math.PI - 0.5 + tailWag) * 9*s, Math.sin(a.facing + Math.PI - 0.5 + tailWag) * 9*s);
                ctx.closePath();
                ctx.fill();
                // Eye
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(Math.cos(a.facing) * 3*s, Math.sin(a.facing) * 3*s - 0.5*s, 0.8*s, 0, Math.PI*2);
                ctx.fill();
                // Water ripple
                ctx.strokeStyle = 'rgba(100,160,210,0.25)';
                ctx.lineWidth = s * 0.5;
                ctx.beginPath();
                ctx.arc(0, 0, (7 + Math.sin(t * 2) * 2)*s, 0, Math.PI*2);
                ctx.stroke();
                break;
            }
            case 'cat': {
                // Body
                ctx.fillStyle = '#8a7050';
                ctx.beginPath();
                ctx.ellipse(0, 0, 5*s, 3*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Head
                const catHx = Math.cos(a.facing) * 4*s;
                ctx.beginPath();
                ctx.arc(catHx, -2*s, 3*s, 0, Math.PI*2);
                ctx.fillStyle = '#8a7050';
                ctx.fill();
                // Ears (triangles)
                ctx.fillStyle = '#7a6040';
                ctx.beginPath();
                ctx.moveTo(catHx - 2.5*s, -4*s);
                ctx.lineTo(catHx - 1*s, -7*s);
                ctx.lineTo(catHx + 0.5*s, -4*s);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(catHx + 0.5*s, -4*s);
                ctx.lineTo(catHx + 2*s, -7*s);
                ctx.lineTo(catHx + 3.5*s, -4*s);
                ctx.closePath();
                ctx.fill();
                // Eyes
                ctx.fillStyle = '#aac030';
                ctx.beginPath();
                ctx.ellipse(catHx - 1*s, -2.5*s, 1*s, 0.8*s, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(catHx + 2*s, -2.5*s, 1*s, 0.8*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Pupils
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.ellipse(catHx - 1*s, -2.5*s, 0.4*s, 0.7*s, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(catHx + 2*s, -2.5*s, 0.4*s, 0.7*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Tail (curved — raised when approaching learner)
                ctx.strokeStyle = '#8a7050';
                ctx.lineWidth = 1.5*s;
                ctx.beginPath();
                ctx.moveTo(-4*s, 0);
                if (a.approaching) {
                    // Tail up, friendly posture
                    ctx.quadraticCurveTo(-6*s, -10*s, -3*s, -12*s);
                } else {
                    ctx.quadraticCurveTo(-8*s, -6*s, -5*s + Math.sin(t * 2)*2*s, -8*s);
                }
                ctx.stroke();
                break;
            }
            case 'butterfly': {
                // Wings (colorful, flapping)
                const wingFlap = Math.sin(t * 8) * 0.5;
                const colors = ['#e06060', '#e08040', '#d0a030', '#e06080'];
                const ci = Math.abs(Math.floor(a.x + a.y)) % colors.length;
                ctx.fillStyle = colors[ci];
                ctx.globalAlpha = 0.8;
                // Left wing
                ctx.beginPath();
                ctx.ellipse(-2*s, -1*s, 3*s, (2 + wingFlap)*s, -0.4, 0, Math.PI*2);
                ctx.fill();
                // Right wing
                ctx.beginPath();
                ctx.ellipse(2*s, -1*s, 3*s, (2 + wingFlap)*s, 0.4, 0, Math.PI*2);
                ctx.fill();
                // Wing dots
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(-2*s, -1*s, 1*s, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(2*s, -1*s, 1*s, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
                // Body
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.ellipse(0, 0, 0.8*s, 2.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Antennae
                ctx.strokeStyle = '#2a2a2a';
                ctx.lineWidth = 0.4*s;
                ctx.beginPath();
                ctx.moveTo(0, -2*s);
                ctx.lineTo(-2*s, -4*s);
                ctx.moveTo(0, -2*s);
                ctx.lineTo(2*s, -4*s);
                ctx.stroke();
                break;
            }
            case 'tanuki': {
                // Tanuki (raccoon dog) — round body, dark mask, bushy tail
                // Body
                ctx.fillStyle = '#7a6040';
                ctx.beginPath();
                ctx.ellipse(0, 0, 6*s, 4*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Head
                const tnkHx = Math.cos(a.facing) * 4*s;
                ctx.beginPath();
                ctx.arc(tnkHx, -3*s, 3.5*s, 0, Math.PI*2);
                ctx.fillStyle = '#7a6040';
                ctx.fill();
                // Face mask (dark patches around eyes)
                ctx.fillStyle = '#3a2a18';
                ctx.beginPath();
                ctx.ellipse(tnkHx - 1.5*s, -3.5*s, 1.5*s, 1.2*s, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(tnkHx + 1.5*s, -3.5*s, 1.5*s, 1.2*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Eyes
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(tnkHx - 1.5*s, -3.5*s, 0.7*s, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(tnkHx + 1.5*s, -3.5*s, 0.7*s, 0, Math.PI*2);
                ctx.fill();
                // Nose
                ctx.fillStyle = '#2a1a0a';
                ctx.beginPath();
                ctx.arc(tnkHx, -2*s, 0.8*s, 0, Math.PI*2);
                ctx.fill();
                // Belly (lighter)
                ctx.fillStyle = '#b09a70';
                ctx.beginPath();
                ctx.ellipse(0, 1*s, 4*s, 2.5*s, 0, 0, Math.PI*2);
                ctx.fill();
                // Bushy tail
                ctx.fillStyle = '#5a4a30';
                ctx.beginPath();
                ctx.moveTo(-5*s, 0);
                ctx.quadraticCurveTo(-9*s, -4*s + Math.sin(t * 1.5)*2*s, -6*s, -8*s);
                ctx.quadraticCurveTo(-4*s, -6*s, -4*s, -1*s);
                ctx.closePath();
                ctx.fill();
                break;
            }
        }
        ctx.restore();
    }
}

// NPC chatter — contextual phrases based on location, weather, time, relationship
function npcContextualChatter(npc, partner) {
    if (Object.keys(vocab).length === 0) return '...';
    // Villagers talk among themselves in plain speech (だ / る-form, ね / よ), about where they are,
    // the weather, the time of day and each other.
    const topics = [];
    for (const o of worldObjects) {
        if (npc.distTo(o.x, o.y) > 80) continue;
        if (CHAT_LINES[o.type]) { topics.push(o.type, o.type); break; }
    }
    if (CHAT_LINES[currentWeather]) topics.push(currentWeather);
    if (gameHour >= 5 && gameHour < 9)        topics.push('morning');
    else if (gameHour >= 11 && gameHour < 14)  topics.push('noon');
    else if (gameHour >= 18 && gameHour < 21)  topics.push('evening');
    else if (gameHour >= 21 || gameHour < 5)   topics.push('late');
    if (partner) {
        const rel = npc.relationships[partner.name] || 0;
        if (rel >= 60) topics.push('friend', 'friend');
        else if (rel >= 30) topics.push('warm');
    }
    if (topics.length && Math.random() < 0.85) {
        const topic = randEl(topics);
        const sent = pickLine(CHAT_LINES[topic], 'chat_' + topic, { polite: false });
        if (sent) return sent.kanjiText;
    }
    // Short natural fillers
    return randEl(['いいね！','うん。','そうだね。','ははは！','そう！','すごい！','いいよ。','行こう。']);
}

// Get routine target based on time of day and NPC affinities
function getRoutineTarget(npc) {
    let targetType;
    if (gameHour >= 5 && gameHour < 11)       targetType = npc.affinities[0];
    else if (gameHour >= 11 && gameHour < 17)  targetType = npc.affinities[1] || 'market';
    else if (gameHour >= 17 && gameHour < 21)  targetType = 'teahouse';
    else                                        targetType = 'house';
    const obj = worldObjects.find(o => o.type === targetType);
    if (!obj) return null;
    return standSpot(obj);
}

// Mood calculation
function getMood(person) {
    // Sleeping
    if (person.state === 'acting' && person.currentAction &&
        (person.currentAction.id === 'sleep_house' || person.currentAction.id === 'sleep_self')) return null;
    // Night + low energy → tired
    if ((gameHour >= 22 || gameHour < 5) && (!person.energy || person.energy < 30)) return 'tired';
    // Cold weather
    if ((currentWeather === 'snow' || currentWeather === 'wind') && getSeason() === 'winter') return 'cold';
    // Chatting with high-rel partner → happy
    if (person.state === 'chatting' && person.chatPartner) {
        const rel = person.relationships[person.chatPartner.name] || 0;
        if (rel >= 40) return 'happy';
    }
    // Near a friend → happy
    const allChars = [...persons, ...npcs];
    for (const c of allChars) {
        if (c === person) continue;
        if ((person.relationships[c.name] || 0) >= 60 && person.distTo(c.x, c.y) < 60) return 'happy';
    }
    // Near micro event → surprised
    if (activeMicroEvent) {
        const ev = activeMicroEvent;
        const evX = ev.npc ? ev.npc.x : (ev.cat ? ev.cat.x : 0);
        const evY = ev.npc ? ev.npc.y : (ev.cat ? ev.cat.y : 0);
        if (person.distTo(evX, evY) < 80 && person !== ev.npc) return 'surprised';
    }
    // Default — content when weather is nice
    if (currentWeather === 'clear' && gameHour >= 6 && gameHour < 20) return 'content';
    return null;
}

// Alert nearby NPCs to look at an event
function alertNearbyNPCs(x, y, radius, duration) {
    for (const npc of npcs) {
        if (npc.distTo(x, y) < radius && npc.state !== 'chatting') {
            npc.watchTarget = { x, y };
            npc.watchTimer = duration;
            npc.facing = Math.atan2(y - npc.y, x - npc.x);
        }
    }
}

// NPC reaction bubbles
const NPC_REACTIONS = ['わあ！','いいね！','ははは！','ん？','見て！','おお！','すごい！'];

// ── Multi-step NPC Interactions ──
const NPC_INTERACTION_DEFS = [
    { id: 'share_tea', label: 'Tee teilen', minRel: 20, phases: [
        { action: 'move_kitchen', duration: 80, chat: 'お茶を取ってくる。' },
        { action: 'move_partner', duration: 80, chat: 'はい、お茶どうぞ！' },
        { action: 'drink_together', duration: 100, chat: null },
    ]},
    { id: 'walk_together', label: 'Spaziergang', minRel: 40, phases: [
        { action: 'greet', duration: 40, chat: '一緒に歩こう！' },
        { action: 'walk_garden', duration: 120, chat: null },
        { action: 'arrive', duration: 60, chat: '気持ちいいね。' },
    ]},
    { id: 'show_item', label: 'Etwas zeigen', minRel: 10, phases: [
        { action: 'find', duration: 60, chat: '見て！' },
        { action: 'show', duration: 80, chat: 'これ、きれいでしょう！' },
        { action: 'react', duration: 60, chat: null },
    ]},
    { id: 'quarrel_reconcile', label: 'Streit & Versöhnung', minRel: 30, phases: [
        { action: 'argue', duration: 60, chat: '違うよ！' },
        { action: 'walk_away', duration: 100, chat: 'ふん！' },
        { action: 'return', duration: 80, chat: null },
        { action: 'reconcile', duration: 60, chat: 'ごめんね。' },
    ]},
];

let activeNpcInteraction = null;
let npcInteractionTimer = randFloat(500, 1000);


function updateNPCs(dt) {
    for (const npc of npcs) {
        // Update watching timer
        if (npc.watchTimer > 0) {
            npc.watchTimer -= dt;
            if (npc.watchTarget) npc.facing = Math.atan2(npc.watchTarget.y - npc.y, npc.watchTarget.x - npc.x);
            if (npc.watchTimer <= 0) { npc.watchTarget = null; }
        }

        // Update mood periodically
        if (_due.mood) npc.mood = getMood(npc);

        switch (npc.state) {
            case 'idle':
                npc.idleTimer -= dt;
                npc.activityDe = 'Untätig';

                // Glance toward high-rel character nearby (~0.1% per tick)
                if (Math.random() < 0.001 * dt) {
                    const allChars = [...persons, ...npcs];
                    for (const c of allChars) {
                        if (c === npc) continue;
                        if ((npc.relationships[c.name] || 0) >= 30 && npc.distTo(c.x, c.y) < 100) {
                            npc.facing = Math.atan2(c.y - npc.y, c.x - npc.x);
                            break;
                        }
                    }
                }

                if (npc.idleTimer <= 0) {
                    // Decide: wander or try to chat
                    const chatChance = 0.35;
                    let startedChat = false;

                    if (Math.random() < chatChance) {
                        // Find another NPC nearby to chat with (weighted by relationship)
                        const candidates = npcs.filter(other =>
                            other !== npc &&
                            other.state === 'idle' &&
                            npc.distTo(other.x, other.y) < 120
                        );
                        let partner = null;
                        if (candidates.length > 0) {
                            const weights = candidates.map(c => 1 + (npc.relationships[c.name] || 0) * 0.05);
                            const total = weights.reduce((s, w) => s + w, 0);
                            let r = Math.random() * total;
                            for (let ci = 0; ci < candidates.length; ci++) {
                                r -= weights[ci];
                                if (r <= 0) { partner = candidates[ci]; break; }
                            }
                            if (!partner) partner = candidates[candidates.length - 1];
                        }
                        if (partner) {
                            npc.state = 'chatting';
                            npc.chatTimer = randFloat(80, 200);
                            npc.chatPartner = partner;
                            partner.state = 'chatting';
                            partner.chatTimer = npc.chatTimer;
                            partner.chatPartner = npc;
                            npc.activityDe = 'Redet';
                            partner.activityDe = 'Redet';

                            // Face each other
                            npc.facing = Math.atan2(partner.y - npc.y, partner.x - npc.x);
                            partner.facing = Math.atan2(npc.y - partner.y, npc.x - partner.x);

                            // First bubble — contextual
                            const text = npcContextualChatter(npc, partner);
                            npcBubbles.push(new SpeechBubble(npc, text, [], false));
                            // Boost relationship
                            const oldRel = npc.relationships[partner.name] || 0;
                            npc.relationships[partner.name] = Math.min(100, oldRel + 3);
                            partner.relationships[npc.name] = Math.min(100, (partner.relationships[npc.name] || 0) + 3);
                            startedChat = true;
                        }
                    }

                    if (!startedChat) {
                        // 40% chance: routine target, 60%: random wander
                        if (Math.random() < 0.4 && npc.affinities) {
                            const target = getRoutineTarget(npc);
                            if (target) {
                                npc.state = 'moving';
                                setTargetWithPath(npc, Math.max(40, Math.min(WORLD_W - 40, target.x)), Math.max(40, Math.min(WORLD_H - 40, target.y)));
                                npc.activityDe = 'Geht zum Ziel';
                            } else {
                                npc.state = 'moving';
                                setTargetWithPath(npc, Math.max(40, Math.min(WORLD_W - 40, npc.x + randFloat(-120, 120))), Math.max(40, Math.min(WORLD_H - 40, npc.y + randFloat(-120, 120))));
                                npc.activityDe = 'Geht umher';
                            }
                        } else {
                            npc.state = 'moving';
                            setTargetWithPath(npc, Math.max(40, Math.min(WORLD_W - 40, npc.x + randFloat(-120, 120))), Math.max(40, Math.min(WORLD_H - 40, npc.y + randFloat(-120, 120))));
                            npc.activityDe = 'Geht umher';
                        }
                    }
                }
                break;

            case 'moving':
                if (npc.moveToward(npc.targetX, npc.targetY, dt)) {
                    npc.state = 'idle';
                    npc.idleTimer = randFloat(80, 400);
                }
                break;

            case 'chatting':
                npc.chatTimer -= dt;
                // Alternating contextual bubbles while chatting
                if (Math.random() < 0.003 * dt) {
                    // Alternate: sometimes the partner responds instead
                    const speaker = (npc.chatPartner && Math.random() < 0.5) ? npc.chatPartner : npc;
                    const listener = speaker === npc ? npc.chatPartner : npc;
                    const text = npcContextualChatter(speaker, listener);
                    npcBubbles.push(new SpeechBubble(speaker, text, [], false));
                }
                if (npc.chatTimer <= 0) {
                    npc.state = 'idle';
                    npc.idleTimer = randFloat(100, 350);
                    npc.chatPartner = null;
                    // Wander away after chat
                    if (Math.random() < 0.5) {
                        npc.state = 'moving';
                        setTargetWithPath(npc, Math.max(40, Math.min(WORLD_W - 40, npc.x + randFloat(-100, 100))), Math.max(40, Math.min(WORLD_H - 40, npc.y + randFloat(-100, 100))));
                    }
                }
                break;
        }
    }

    // Update NPC bubbles
    npcBubbles = npcBubbles.filter(b => b.update(dt));
}

// ============================================================
//  EMERGENT RELATIONSHIPS
// ============================================================
function updateRelationships(dt) {
    const allChars = [...persons, ...npcs];
    const fire = cachedTeahouse;

    // Near-teahouse bonding: characters near the same fire grow closer
    if (fire) {
        const nearFire = allChars.filter(c => {
            const d = Math.sqrt((c.x - fire.x) ** 2 + (c.y - fire.y) ** 2);
            return d < 60;
        });
        for (let i = 0; i < nearFire.length; i++) {
            for (let j = i + 1; j < nearFire.length; j++) {
                const a = nearFire[i], b = nearFire[j];
                const aName = a.name, bName = b.name;
                a.relationships[bName] = Math.min(100, (a.relationships[bName] || 0) + 0.3 * dt * 0.016);
                b.relationships[aName] = Math.min(100, (b.relationships[aName] || 0) + 0.3 * dt * 0.016);
            }
        }
    }

    // NPC follow behavior: NPCs with high relationship to speaker occasionally drift toward them
    const speaker = persons[0];
    for (const npc of npcs) {
        const rel = npc.relationships[speaker.name] || 0;
        if (rel > 50 && npc.state === 'idle' && Math.random() < 0.0003 * dt * (rel / 100)) {
            npc.state = 'moving';
            setTargetWithPath(npc, Math.max(40, Math.min(WORLD_W - 40, speaker.x + randFloat(-40, 40))), Math.max(40, Math.min(WORLD_H - 40, speaker.y + randFloat(-40, 40))));
            npc.activityDe = 'Folgt ' + speaker.name;
        }
    }

    // Learner return speed influenced by relationship
    const learner = persons[1];
    const relToSpeaker = learner.relationships[speaker.name] || 0;
    if (learner.followMode === 'returning' && relToSpeaker > 40) {
        // Slightly faster return (processed in learner AI via relationship boost)
    }
}

function boostRelationshipsNearby(actor, amount) {
    const allChars = [...persons, ...npcs];
    for (const c of allChars) {
        if (c === actor) continue;
        const d = Math.sqrt((c.x - actor.x) ** 2 + (c.y - actor.y) ** 2);
        if (d < 80) {
            actor.relationships[c.name] = Math.min(100, (actor.relationships[c.name] || 0) + amount);
            c.relationships[actor.name] = Math.min(100, (c.relationships[actor.name] || 0) + amount * 0.5);
        }
    }
}
