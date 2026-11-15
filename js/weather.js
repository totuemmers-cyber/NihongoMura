// Nihongo Mura — Weather, seasons, light and atmosphere

// ============================================================
//  WEATHER & DAY/NIGHT SYSTEM
// ============================================================
function getSeason() {
    const seasonIdx = Math.floor((gameDay - 1) / 10) % 4;
    return ['spring', 'summer', 'autumn', 'winter'][seasonIdx];
}

function getWeatherPool() {
    switch(getSeason()) {
        case 'spring': return ['clear','clear','rain','rain','wind','fog'];
        case 'summer': return ['clear','clear','clear','clear','rain'];
        case 'autumn': return ['clear','rain','rain','wind','wind','fog'];
        case 'winter': return ['clear','snow','snow','snow','wind','fog'];
        default: return ['clear'];
    }
}

function changeWeather() {
    previousWeather = currentWeather;
    const pool = getWeatherPool();
    currentWeather = randEl(pool);
    targetWeatherIntensity = currentWeather === 'clear' ? 0 : randFloat(0.3, 1.0);
    nextWeatherChange = randFloat(1500, 3500);

    // Speaker comments on weather change
    if (currentWeather !== previousWeather && currentWeather !== 'clear' && persons.length > 0) {
        const sent = pickLine(WEATHER_LINES[currentWeather], 'weather_' + currentWeather, { polite: true });
        if (sent) speakerRemark(sent, t => `${persons[0].name}: "${t}" (Wetter)`);
    }
}

// Is this world point on open water (the river or a pond)?
function isWaterAt(x, y) {
    if (y > HORIZON_Y) { const b = riverBanksAt(y); if (x > b.l + 1 && x < b.r - 1) return true; }
    for (const o of worldObjects) {
        if (o.type !== 'fish_pond' && o.type !== 'lotus_pond') continue;
        const dx = (x - o.x) / (o.w / 2), dy = (y - o.y) / (o.h / 2);
        if (dx * dx + dy * dy < 0.85) return true;
    }
    return false;
}

function updateWeather(dt) {
    nextWeatherChange -= dt;
    if (nextWeatherChange <= 0) changeWeather();

    // Smooth intensity transition
    const step = 0.002 * dt;
    if (weatherIntensity < targetWeatherIntensity) {
        weatherIntensity = Math.min(targetWeatherIntensity, weatherIntensity + step);
    } else if (weatherIntensity > targetWeatherIntensity) {
        weatherIntensity = Math.max(targetWeatherIntensity, weatherIntensity - step);
    }

    // Spawn & update particles
    if (currentWeather === 'clear' && weatherIntensity < 0.05) { weatherParticles = []; return; }

    const vw = viewWorldRect();
    const spawnRate = weatherIntensity * (currentWeather === 'rain' ? 9 : currentWeather === 'snow' ? 2 : 1);
    for (let i = 0; i < spawnRate * dt * 0.3; i++) {
        if (weatherParticles.length > (currentWeather === 'rain' ? 520 : 300)) break;
        switch(currentWeather) {
            case 'rain':
                weatherParticles.push({ x: randFloat(vw.x0-20, vw.x1+20), y: randFloat(vw.y0-40, vw.y0-5), vx: randFloat(-0.5,-0.2), vy: randFloat(3,5), size: randFloat(1,2) , gy: randFloat(Math.max(vw.y0, HORIZON_Y) + 4, vw.y1)});
                break;
            case 'snow':
                weatherParticles.push({ x: randFloat(vw.x0-20, vw.x1+20), y: randFloat(vw.y0-20, vw.y0-5), vx: randFloat(-0.3,0.3), vy: randFloat(0.3,0.8), size: randFloat(1.5,3.5), phase: randFloat(0,Math.PI*2) });
                break;
            case 'wind':
                weatherParticles.push({ x: randFloat(vw.x0-20, vw.x0), y: randFloat(vw.y0, vw.y1), vx: randFloat(2,4), vy: randFloat(-0.5,0.5), life: randFloat(40,100), size: randFloat(0.5,1.5) });
                break;
            case 'fog':
                if (weatherParticles.length < 40)
                    weatherParticles.push({ x: randFloat(vw.x0, vw.x1), y: randFloat(vw.y0, vw.y1), size: randFloat(30,80), phase: randFloat(0,Math.PI*2), vx: randFloat(-0.1,0.1), alpha: randFloat(0.03,0.08) });
                break;
        }
    }

    for (const p of weatherParticles) {
        if (currentWeather === 'rain') { p.x += p.vx * dt; p.y += p.vy * dt; }
        else if (currentWeather === 'snow') { p.x += Math.sin(gameTick*0.02 + p.phase)*0.3*dt + p.vx*dt; p.y += p.vy * dt; }
        else if (currentWeather === 'wind') { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
        else if (currentWeather === 'fog') { p.x += p.vx * dt; p.phase += 0.01 * dt; }
    }

    weatherParticles = weatherParticles.filter(p => {
        if (p.life !== undefined && p.life <= 0) return false;
        if (p.x < vw.x0-30 || p.x > vw.x1+30 || p.y < vw.y0-40) return false;
        // Rain splash on ground
        if (currentWeather === 'rain' && p.gy !== undefined && p.y >= p.gy) {
            if (rainSplashes.length < 90) {
                const water = isWaterAt(p.x, p.gy);
                rainSplashes.push({ x: p.x, y: p.gy, water, life: water ? 34 : 12, maxLife: water ? 34 : 12 });
            }
            return false;
        }
        return p.y <= vw.y1 + 20;
    });

    // Update rain splashes
    for (const sp of rainSplashes) sp.life -= dt;
    rainSplashes = rainSplashes.filter(sp => sp.life > 0);
}

function drawWeatherEffects(ctx) {
    if (weatherIntensity < 0.02) return;
    ctx.save();
    ctx.globalAlpha = weatherIntensity;
    switch(currentWeather) {
        case 'rain':
            ctx.strokeStyle = 'rgba(196,214,236,0.55)';
            ctx.lineWidth = canvasScale * 0.75;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const p of weatherParticles) {
                ctx.moveTo(p.x*canvasScale, p.y*canvasScale);
                ctx.lineTo((p.x+p.vx*3.2)*canvasScale, (p.y+p.vy*3.2)*canvasScale);
            }
            ctx.stroke();
            break;
        case 'snow':
            ctx.fillStyle = '#fff';
            for (const p of weatherParticles) {
                ctx.globalAlpha = weatherIntensity * 0.8;
                ctx.beginPath();
                ctx.arc(p.x*canvasScale, p.y*canvasScale, p.size*canvasScale, 0, Math.PI*2);
                ctx.fill();
            }
            break;
        case 'wind':
            ctx.strokeStyle = 'rgba(180,180,150,0.4)';
            ctx.lineWidth = canvasScale * 0.5;
            for (const p of weatherParticles) {
                const a = p.life > 20 ? 0.4 : p.life / 50;
                ctx.globalAlpha = weatherIntensity * a;
                ctx.beginPath();
                ctx.moveTo(p.x*canvasScale, p.y*canvasScale);
                ctx.lineTo((p.x - p.vx*4)*canvasScale, (p.y - p.vy*4)*canvasScale);
                ctx.stroke();
            }
            break;
        case 'fog':
            for (const p of weatherParticles) {
                ctx.globalAlpha = p.alpha * weatherIntensity;
                ctx.fillStyle = 'rgba(200,200,190,1)';
                ctx.beginPath();
                ctx.ellipse(p.x*canvasScale, p.y*canvasScale, p.size*canvasScale, p.size*0.5*canvasScale, 0, 0, Math.PI*2);
                ctx.fill();
            }
            break;
    }

    // Rain landing: expanding rings on water, little crowns of spray on the ground
    if (rainSplashes.length > 0) {
        const s = canvasScale;
        ctx.lineCap = 'round';
        for (const sp of rainSplashes) {
            const k = 1 - sp.life / sp.maxLife;
            if (sp.water) {
                ctx.strokeStyle = `rgba(225,238,250,${(1 - k) * 0.6 * weatherIntensity})`;
                ctx.lineWidth = 0.6 * s;
                ctx.beginPath();
                ctx.ellipse(sp.x * s, sp.y * s, (1.2 + k * 7) * s, (0.5 + k * 3) * s, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeStyle = `rgba(210,225,240,${(1 - k) * 0.7 * weatherIntensity})`;
                ctx.lineWidth = 0.55 * s;
                ctx.beginPath();
                for (const ang of [-2.3, -1.57, -0.84]) {
                    const r0 = k * 1.2, r1 = 1 + k * 3;
                    ctx.moveTo((sp.x + Math.cos(ang) * r0) * s, (sp.y + Math.sin(ang) * r0 * 0.7) * s);
                    ctx.lineTo((sp.x + Math.cos(ang) * r1) * s, (sp.y + Math.sin(ang) * r1 * 0.7) * s);
                }
                ctx.stroke();
            }
        }
    }

    ctx.restore();
}

// ============================================================
//  LIGHT & ATMOSPHERE — time-of-day colour grade, night light map, sky, mist
// ============================================================
// Multiply colour through the day (white = untouched) and how "night" it is (drives lamps).
const GRADE_KEYS = [
    [0.0,  [62, 72, 122],  1.0],
    [4.3,  [62, 72, 122],  1.0],
    [5.2,  [122, 120, 162], 0.6],   // cool dawn
    [6.2,  [238, 198, 172], 0.12],  // warm sunrise
    [7.3,  [255, 238, 216], 0],
    [8.6,  [255, 255, 255], 0],     // neutral day
    [16.0, [255, 255, 255], 0],
    [17.2, [255, 236, 202], 0],     // golden hour
    [18.2, [242, 192, 168], 0.15],  // rose dusk
    [19.2, [128, 118, 166], 0.6],   // blue hour
    [20.3, [70, 78, 128],  0.95],
    [24.0, [62, 72, 122],  1.0],
];
const _gradeMemo = { t: NaN, w: '', wi: NaN, d: NaN, r: null };
function gradeAt(t) {
    const m = _gradeMemo;
    if (t === m.t && currentWeather === m.w && weatherIntensity === m.wi && gameDay === m.d) return m.r;
    m.t = t; m.w = currentWeather; m.wi = weatherIntensity; m.d = gameDay;
    return (m.r = _gradeAtUncached(t));
}
function _gradeAtUncached(t) {
    let i = 0;
    while (i < GRADE_KEYS.length - 2 && t >= GRADE_KEYS[i + 1][0]) i++;
    const [t0, c0, n0] = GRADE_KEYS[i], [t1, c1, n1] = GRADE_KEYS[i + 1];
    let k = (t - t0) / ((t1 - t0) || 1);
    k = Math.max(0, Math.min(1, k));
    k = k * k * (3 - 2 * k);                     // smoothstep
    let col = c0.map((v, j) => v + (c1[j] - v) * k);
    let night = n0 + (n1 - n0) * k;
    // Moonlight: a full moon lifts the night a little, a new moon deepens it
    if (night > 0) {
        const phase = gameDay % 8, moonLight = 1 - Math.abs(phase - 4) / 4;   // 0 new … 1 full
        const lift = (moonLight - 0.5) * 22 * night;
        col = col.map((v, j) => v + lift * (j === 2 ? 0.8 : 1));
    }
    // Overcast skies flatten and cool the light
    const overcast = currentWeather === 'rain' || currentWeather === 'fog' ? weatherIntensity * 0.42
                   : currentWeather === 'snow' ? weatherIntensity * 0.2 : 0;
    if (overcast > 0) col = col.map((v, j) => v + ([168, 174, 188][j] * (v / 255) - v) * overcast);
    return { col: col.map(v => Math.max(0, Math.min(255, Math.round(v)))), night };
}

// Light sources (world units); flicker for flames
function nightLights() {
    const L = [];
    for (const o of worldObjects) {
        switch (o.type) {
            case 'lantern_post': L.push({ x: o.x + 8, y: o.y - o.h / 3 + 4, r: 62, i: 0.95, c: [255, 196, 130], flame: true }); break;
            case 'kitchen':      L.push({ x: o.x, y: o.y + 6, r: 66, i: 1.0, c: [255, 168, 96], flame: true }); break;
            case 'teahouse':     L.push({ x: o.x, y: o.y, r: 80, i: 0.85, c: [255, 206, 140] }); break;
            case 'house':        L.push({ x: o.x, y: o.y + 4, r: 52, i: 0.62, c: [255, 200, 130] }); break;
            case 'school':       L.push({ x: o.x, y: o.y - 2, r: 46, i: 0.5, c: [255, 210, 150] }); break;
            case 'shrine':       L.push({ x: o.x, y: o.y, r: 44, i: 0.55, c: [255, 184, 110], flame: true }); break;
        }
    }
    for (const d of campDecorations) if (d.id === 'lantern_circle') L.push({ x: d.x, y: d.y, r: 56, i: 0.8, c: [255, 170, 110], flame: true });
    return L;
}

const _lightMap = { canvas: null, ctx: null };
function drawGrading(ctx) {
    const g = gradeAt(gameHour + gameMinute / 60);
    const [r, gg, b] = g.col;
    if (r > 252 && gg > 252 && b > 252 && g.night < 0.01) return;
    const vr = viewPxRect(), s = canvasScale;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    if (g.night < 0.02) {
        ctx.fillStyle = `rgb(${r},${gg},${b})`;
        ctx.fillRect(vr.x, vr.y, vr.w, vr.h);
        ctx.restore();
        return;
    }
    // Light map at quarter resolution: the night colour with warm pools punched in by the lamps
    const q = 4, lw = Math.ceil(vr.w / q), lh = Math.ceil(vr.h / q);
    if (!_lightMap.canvas) { _lightMap.canvas = document.createElement('canvas'); _lightMap.ctx = _lightMap.canvas.getContext('2d'); }
    const lc = _lightMap.ctx;
    if (_lightMap.canvas.width !== lw || _lightMap.canvas.height !== lh) { _lightMap.canvas.width = lw; _lightMap.canvas.height = lh; }
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = `rgb(${r},${gg},${b})`;
    lc.fillRect(0, 0, lw, lh);
    lc.globalCompositeOperation = 'lighter';
    const lights = nightLights();
    for (let n = 0; n < lights.length; n++) {
        const L = lights[n];
        const flick = L.flame ? 0.9 + Math.sin(gameTick * 0.21 + n * 1.7) * 0.06 + Math.sin(gameTick * 0.53 + n) * 0.04 : 1;
        const cx = (L.x * s - vr.x) / q, cy = (L.y * s - vr.y) / q, rad = L.r * s * flick / q;
        if (cx < -rad || cy < -rad || cx > lw + rad || cy > lh + rad) continue;
        const a = L.i * g.night * flick;
        const grd = lc.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grd.addColorStop(0, `rgba(${L.c[0]},${L.c[1]},${L.c[2]},${a})`);
        grd.addColorStop(0.45, `rgba(${L.c[0]},${L.c[1] * 0.9 | 0},${L.c[2] * 0.75 | 0},${a * 0.45})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = grd;
        lc.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(_lightMap.canvas, 0, 0, lw, lh, vr.x, vr.y, lw * q, lh * q);
    // A soft bloom right at each flame / window
    ctx.globalCompositeOperation = 'lighter';
    for (let n = 0; n < lights.length; n++) {
        const L = lights[n];
        const flick = L.flame ? 0.85 + Math.sin(gameTick * 0.27 + n * 2.3) * 0.15 : 1;
        const rad = (L.flame ? 16 : 22) * s;
        const grd = ctx.createRadialGradient(L.x * s, L.y * s, 0, L.x * s, L.y * s, rad);
        grd.addColorStop(0, `rgba(${L.c[0]},${L.c[1] * 0.85 | 0},${L.c[2] * 0.6 | 0},${0.22 * g.night * L.i * flick})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(L.x * s - rad, L.y * s - rad, rad * 2, rad * 2);
    }
    ctx.restore();
}

// Stars are scattered over a fixed sky area; only those above the horizon are ever drawn
const SKY_STARS = (() => {
    const rnd = mulberry32(4242), out = [];
    for (let i = 0; i < 170; i++) out.push([-300 + rnd() * 1600, -160 + rnd() * (HORIZON_Y - 12 + 160), rnd(), rnd() < 0.06]);
    return out;
})();
function drawSky(ctx) {
    const g = gradeAt(gameHour + gameMinute / 60);
    if (g.night < 0.25) return;
    const vis = Math.min(1, (g.night - 0.25) / 0.5);
    const s = canvasScale, vw = viewWorldRect();
    ctx.save();
    // Clip to the sky above the hills
    ctx.beginPath();
    ctx.rect(vw.x0 * s, vw.y0 * s, (vw.x1 - vw.x0) * s, (HORIZON_Y - 10 - vw.y0) * s);
    ctx.clip();
    // Milky Way haze
    ctx.globalAlpha = vis * 0.07;
    ctx.fillStyle = '#c8d0ec';
    ctx.beginPath();
    ctx.ellipse(560 * s, -10 * s, 620 * s, 26 * s, -0.12, 0, Math.PI * 2);
    ctx.fill();
    // Stars
    ctx.fillStyle = '#fffaf0';
    for (let i = 0; i < SKY_STARS.length; i++) {
        const [sx, sy, m, bright] = SKY_STARS[i];
        if (sx < vw.x0 || sx > vw.x1 || sy < vw.y0) continue;
        const tw = Math.sin(gameTick * 0.03 + i * 1.37) * 0.5 + 0.5;
        ctx.globalAlpha = vis * (bright ? 0.9 : 0.35 + m * 0.35) * (0.55 + tw * 0.45);
        ctx.beginPath();
        ctx.arc(sx * s, sy * s, (bright ? 1.4 : 0.6 + m * 0.5) * s, 0, Math.PI * 2);
        ctx.fill();
    }
    // Moon with phase, a halo, and a clean crescent cut
    const phase = gameDay % 8;
    if (phase !== 0) {
        const mx = 170 * s, my = 14 * s, mr = 7 * s;
        const halo = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 5);
        halo.addColorStop(0, `rgba(230,232,250,${0.22 * vis})`);
        halo.addColorStop(1, 'rgba(230,232,250,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = halo;
        ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
        ctx.save();
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = vis;
        ctx.fillStyle = '#f4f0dc';
        ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
        if (phase !== 4) {
            const off = (phase < 4 ? -1 : 1) * mr * (2 - Math.abs(phase - 4) / 2) * 0.9;
            ctx.fillStyle = 'rgba(28,34,70,0.92)';
            ctx.beginPath();
            ctx.arc(mx + off, my - mr * 0.1, mr * 1.02, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();
}

// Moonlight breaking on the river: shimmering horizontal glints in a loose column
function drawRiverMoonlight(ctx) {
    const g = gradeAt(gameHour + gameMinute / 60);
    const phase = gameDay % 8;
    if (g.night < 0.3 || phase === 0) return;
    const vis = Math.min(1, (g.night - 0.3) / 0.4) * (0.45 + 0.55 * (1 - Math.abs(phase - 4) / 4));
    const s = canvasScale;
    ctx.save();
    ctx.scale(s, s);
    if (_riverAnimPath) ctx.clip(_riverAnimPath);
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
        const y = 70 + i * 9 + Math.sin(i * 2.7) * 3;
        const b = riverBanksAt(y);
        const mid = (b.l + b.r) / 2 + Math.sin(i * 1.9 + gameTick * 0.01) * 6;
        const spread = 1 - i / 30;
        const len = (5 + (i * 7) % 9) * spread;
        const a = vis * (0.25 + 0.55 * (Math.sin(gameTick * 0.09 + i * 1.3) * 0.5 + 0.5)) * spread;
        ctx.strokeStyle = `rgba(255,246,214,${a})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(mid - len, y);
        ctx.lineTo(mid + len, y);
        ctx.stroke();
    }
    ctx.restore();
}

// Mist: soft horizontal bands that drift; thick at dawn, gone by mid-morning, faint at dusk, heavy in fog
let _mistTex = null;
function _getMistTexture() {
    if (_mistTex) return _mistTex;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const g = c.getContext('2d');
    const rnd = mulberry32(99);
    for (let i = 0; i < 46; i++) {
        const x = rnd() * 512, y = 34 + rnd() * 28, rx = 26 + rnd() * 60, ry = 14 + rnd() * 16;
        if (rnd() < 0.35) continue;   // leave gaps so the band breaks up
        for (const dx of [-512, 0, 512]) {          // wrap so the band tiles seamlessly
            const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
            grd.addColorStop(0, 'rgba(255,255,255,0.32)');
            grd.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grd;
            g.save();
            g.translate(x + dx, y); g.scale(1, ry / rx); g.translate(-(x + dx), -y);
            g.fillRect(x + dx - rx, y - rx, rx * 2, rx * 2);
            g.restore();
        }
    }
    _mistTex = c;
    return c;
}
function mistAmount() {
    const t = gameHour + gameMinute / 60;
    const dawn = t >= 3.5 && t < 9.5 ? (t < 5 ? (t - 3.5) / 1.5 : t < 7 ? 1 : 1 - (t - 7) / 2.5) : 0;
    const dusk = t >= 19 && t < 23.5 ? 0.35 * Math.min(1, (t - 19) / 1.5, (23.5 - t) / 1.5) : 0;
    const fog = currentWeather === 'fog' ? weatherIntensity * 0.9 : 0;
    return Math.min(1, Math.max(dawn, dusk) + fog);
}
function drawMist(ctx) {
    const amt = mistAmount();
    if (amt < 0.02) return;
    // Drawn before the colour grade, so the mist takes on the light (warm at sunrise, blue at night)
    const tex = _getMistTexture(), s = canvasScale, vw = viewWorldRect();
    const bands = [ // world y, height, drift speed, opacity, tile offset
        [HORIZON_Y + 26, 64, 0.05, 0.75, 0],
        [300, 150, -0.03, 0.42, 190],
        [540, 170, 0.022, 0.5, 377],
    ];
    ctx.save();
    for (const [by, bh, sp, op, off] of bands) {
        const tileW = 512 * (bh / 96) * 1.6;
        let x = vw.x0 - ((gameTick * sp + off) % tileW + tileW) % tileW;
        ctx.globalAlpha = amt * op;
        for (; x < vw.x1; x += tileW) ctx.drawImage(tex, x * s, (by - bh / 2) * s, tileW * s, bh * s);
    }
    ctx.restore();
}

// ============================================================
//  ATMOSPHERIC PARTICLES (decorative season/time effects)
// ============================================================
function updateAtmospheric(dt) {
    const season = getSeason();
    const kinds = {};
    for (const p of atmosParticles) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
    const isNight = gameHour >= 20 || gameHour < 5;
    const isDusk  = gameHour >= 18 && gameHour < 20;
    const isDawn  = gameHour >= 5 && gameHour < 7;

    // --- Fireflies (night, near water) ---
    if (isNight && (kinds.firefly || 0) < 18) {
        if (Math.random() < 0.04 * dt) {
            // Spawn near water features: lotus pond (120,530), fish pond (180,520), river area
            const spots = [[120,530],[180,520],[420,560],[650,400],[850,450]];
            const [sx,sy] = spots[Math.floor(Math.random()*spots.length)];
            atmosParticles.push({
                kind: 'firefly', x: sx + randFloat(-40,40), y: sy + randFloat(-30,30),
                phase: randFloat(0, Math.PI*2), speed: randFloat(0.15, 0.35),
                drift: randFloat(-0.3, 0.3), radius: randFloat(15, 30),
                life: randFloat(300, 600), maxLife: 0
            });
            const p = atmosParticles[atmosParticles.length-1];
            p.maxLife = p.life;
        }
    }

    // --- Cherry blossom petals (spring) ---
    if (season === 'spring' && (kinds.blossom || 0) < 25) {
        if (Math.random() < 0.06 * dt) {
            atmosParticles.push({
                kind: 'blossom', x: randFloat(-20, WORLD_W + 20), y: randFloat(-20, -5),
                vx: randFloat(-0.3, -0.1), vy: randFloat(0.3, 0.7),
                rot: randFloat(0, Math.PI*2), rotSpeed: randFloat(-0.03, 0.03),
                size: randFloat(2, 4), phase: randFloat(0, Math.PI*2),
                color: randEl(['#f0a0b0','#e890a0','#f5b0c0','#e8a0b8'])
            });
        }
    }

    // --- Autumn leaves ---
    if (season === 'autumn' && (kinds.leaf || 0) < 15) {
        if (Math.random() < 0.03 * dt) {
            atmosParticles.push({
                kind: 'leaf', x: randFloat(-20, WORLD_W + 20), y: randFloat(-20, -5),
                vx: randFloat(0.5, 1.5), vy: randFloat(0.4, 0.8),
                rot: randFloat(0, Math.PI*2), rotSpeed: randFloat(-0.04, 0.04),
                size: randFloat(3, 5), color: randEl(['#c86830','#d89040','#b84020','#c8a030','#a06028'])
            });
        }
    }

    // --- Dusk embers / warm dust (dusk) ---
    if (isDusk && (kinds.ember || 0) < 20) {
        if (Math.random() < 0.06 * dt) {
            atmosParticles.push({
                kind: 'ember', x: randFloat(0, WORLD_W), y: randFloat(WORLD_H * 0.2, WORLD_H * 0.8),
                vx: randFloat(-0.1, 0.3), vy: randFloat(-0.3, -0.1),
                size: randFloat(1, 2.5), alpha: randFloat(0.2, 0.5),
                life: randFloat(100, 250), maxLife: 0
            });
            const p = atmosParticles[atmosParticles.length-1];
            p.maxLife = p.life;
        }
    }

    // Update all particles
    for (const p of atmosParticles) {
        switch (p.kind) {
            case 'firefly':
                p.phase += p.speed * dt * 0.05;
                p.x += Math.cos(p.phase * 2.3) * p.radius * 0.008 * dt + p.drift * dt * 0.3;
                p.y += Math.sin(p.phase * 1.7) * p.radius * 0.006 * dt;
                p.life -= dt;
                break;
            case 'blossom':
                p.x += (p.vx + Math.sin(gameTick * 0.015 + p.phase) * 0.2) * dt;
                p.y += p.vy * dt;
                p.rot += p.rotSpeed * dt;
                break;
            case 'leaf':
                p.x += (p.vx + Math.sin(gameTick * 0.01 + p.rot) * 0.5) * dt;
                p.y += p.vy * dt;
                p.rot += p.rotSpeed * dt;
                break;
            case 'mist':
                p.x += p.vx * dt;
                p.phase += 0.008 * dt;
                p.life -= dt;
                break;
            case 'ember':
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                break;
        }
    }

    // Remove dead / out-of-bounds
    atmosParticles = atmosParticles.filter(p => {
        if (p.life !== undefined && p.life <= 0) return false;
        if (p.kind === 'blossom' || p.kind === 'leaf') {
            return p.y < WORLD_H + 20 && p.x > -40 && p.x < WORLD_W + 40;
        }
        return true;
    });
}

// layer 'ambient' = petals & leaves (drawn before the colour grade, so night darkens them);
// layer 'glow' = fireflies & embers (drawn after it, so they shine in the dark)
function drawAtmosphericEffects(ctx, layer) {
    const s = canvasScale;
    const glowLayer = layer === 'glow';
    const season = getSeason();
    const isNight = gameHour >= 20 || gameHour < 5;
    const isDusk  = gameHour >= 18 && gameHour < 20;

    ctx.save();

    // --- Fireflies ---
    for (const p of atmosParticles) {
        if (p.kind !== 'firefly' || !glowLayer) continue;
        const glow = Math.sin(p.phase * 3.5) * 0.5 + 0.5; // pulsing
        const fadeIn = Math.min(1, (p.maxLife - p.life) / 60);
        const fadeOut = Math.min(1, p.life / 60);
        const a = glow * 0.7 * fadeIn * fadeOut;
        if (a < 0.01) continue;
        // Outer glow
        const grad = ctx.createRadialGradient(
            p.x*s, p.y*s, 0, p.x*s, p.y*s, 8*s
        );
        grad.addColorStop(0, `rgba(180,220,80,${a * 0.3})`);
        grad.addColorStop(1, 'rgba(180,220,80,0)');
        ctx.fillStyle = grad;
        ctx.fillRect((p.x-10)*s, (p.y-10)*s, 20*s, 20*s);
        // Core
        ctx.fillStyle = `rgba(220,255,120,${a})`;
        ctx.beginPath();
        ctx.arc(p.x*s, p.y*s, (1.2 + glow*0.8)*s, 0, Math.PI*2);
        ctx.fill();
    }

    // --- Cherry blossoms ---
    for (const p of atmosParticles) {
        if (p.kind !== 'blossom' || glowLayer) continue;
        ctx.save();
        ctx.translate(p.x*s, p.y*s);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.6;
        // Petal shape (elongated ellipse)
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size*s, p.size*0.5*s, 0, 0, Math.PI*2);
        ctx.fill();
        // Slight white highlight
        ctx.fillStyle = 'rgba(255,230,240,0.4)';
        ctx.beginPath();
        ctx.ellipse(-p.size*0.2*s, -p.size*0.1*s, p.size*0.4*s, p.size*0.2*s, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    // --- Autumn leaves ---
    for (const p of atmosParticles) {
        if (p.kind !== 'leaf' || glowLayer) continue;
        ctx.save();
        ctx.translate(p.x*s, p.y*s);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = p.color;
        // Leaf shape
        ctx.beginPath();
        ctx.moveTo(0, -p.size*s);
        ctx.quadraticCurveTo(p.size*0.7*s, -p.size*0.3*s, 0, p.size*s);
        ctx.quadraticCurveTo(-p.size*0.7*s, -p.size*0.3*s, 0, -p.size*s);
        ctx.fill();
        // Vein
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5*s;
        ctx.beginPath();
        ctx.moveTo(0, -p.size*s);
        ctx.lineTo(0, p.size*s);
        ctx.stroke();
        ctx.restore();
    }

    // --- Dusk embers ---
    for (const p of atmosParticles) {
        if (p.kind !== 'ember' || !glowLayer) continue;
        const fadeOut = Math.min(1, p.life / 40);
        const a = p.alpha * fadeOut;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#e8a050';
        ctx.beginPath();
        ctx.arc(p.x*s, p.y*s, p.size*s, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();

}

function getWeatherLabel() {
    switch(currentWeather) {
        case 'rain': return 'Regen'; case 'snow': return 'Schnee';
        case 'wind': return 'Wind'; case 'fog': return 'Nebel';
        default: return 'Klar';
    }
}

function getSeasonLabel() {
    switch(getSeason()) {
        case 'spring': return 'Frühling'; case 'summer': return 'Sommer';
        case 'autumn': return 'Herbst'; case 'winter': return 'Winter';
    }
}
