// Nihongo Mura — Rendering: palette, camera, terrain, sprites, shadows, objects and characters

// ============================================================
//  RENDERING
// ============================================================
// ============================================================
//  PALETTE — woodblock / washi colour tokens (CSS mirrors these in :root)
// ============================================================
const PALETTE = {
    sumi: '#2b2622',
    washi: '#f3ead8',
    washiDeep: '#e6d8bb',
    ai: '#2e4a6b',
    aiDeep: '#1f3550',
    aiLight: '#6f93b5',
    shu: '#c8442f',
    kin: '#c99a3a',
    matsu: '#3f5a3a',
    stone: '#9c978b',
    stoneLight: '#cfc9bb',
};
const FONT_MINCHO = "'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif";
const FONT_UI = "'Zen Maru Gothic','Hiragino Maru Gothic ProN','Hiragino Sans','Noto Sans JP',system-ui,sans-serif";

// Per-season landscape colours. Everything the terrain painter uses lives here.
const SEASON_PALETTES = {
    spring: {
        skyTop: '#5b80a6', skyHorizon: '#efe3ca', cloud: '#f6eedc',
        mountFar: '#a3b3c0', mountNear: '#76918b', peak: '#8fa2b4', peakSnow: 0.42, treeline: '#4e6a48',
        groundTop: '#86a160', groundBottom: '#93ad69',
        blotches: ['#9cb675', '#77945a', '#8aa665', '#a7bd80', '#6f8c54'],
        tuft: '#53703c', sand: '#dccaa2', sandEdge: '#c3ad84', path: '#c6b08a',
        bank: '#7a7a58', reed: '#55703f', reedHead: '#7a5a3a',
        water: ['#5f8db0', '#3c6a90', '#2a5276'],
        scatter: { kind: 'petal', colors: ['#f1c6ce', '#f8e1e5', '#e8a9b7'], count: 150 },
    },
    summer: {
        skyTop: '#3d6fa3', skyHorizon: '#f1e7cf', cloud: '#fbf5e8',
        mountFar: '#8ea8ba', mountNear: '#5a7f6e', peak: '#7e97ab', peakSnow: 0.22, treeline: '#3d5c39',
        groundTop: '#6c9449', groundBottom: '#7aa253',
        blotches: ['#82aa5b', '#5c8440', '#719a4c', '#8db463', '#567d3c'],
        tuft: '#42632f', sand: '#ddc99c', sandEdge: '#c2aa7c', path: '#c5ad84',
        bank: '#6c6e4a', reed: '#47662f', reedHead: '#6e4e30',
        water: ['#4f86ad', '#2f6189', '#214b70'],
        scatter: { kind: 'flower', colors: ['#f4e3a1', '#ffffff', '#e9c5e8', '#f2b65c'], count: 90 },
    },
    autumn: {
        skyTop: '#687ea0', skyHorizon: '#f2dcc0', cloud: '#f7ecdc',
        mountFar: '#a9a2a6', mountNear: '#8b6c52', peak: '#9a9aa6', peakSnow: 0.35, treeline: '#7a4e32',
        groundTop: '#93955c', groundBottom: '#9f9f64',
        blotches: ['#b09c5c', '#7d8a50', '#a5884f', '#b8a86c', '#86904f'],
        tuft: '#6f6a38', sand: '#dec79c', sandEdge: '#c4aa7e', path: '#c9ae86',
        bank: '#7d6b4c', reed: '#8a7a45', reedHead: '#6a4a2c',
        water: ['#5d849f', '#3d6382', '#2c4e6c'],
        scatter: { kind: 'leaf', colors: ['#c9582f', '#d98a2f', '#a8402a', '#e0b048'], count: 170 },
    },
    winter: {
        skyTop: '#7489a0', skyHorizon: '#ebe8e2', cloud: '#f4f2ee',
        mountFar: '#bcc5ce', mountNear: '#8794a0', peak: '#aab6c2', peakSnow: 0.62, treeline: '#4b5a52',
        groundTop: '#aab2a2', groundBottom: '#b7beac',
        blotches: ['#c2c8ba', '#9ca690', '#b0b8a4', '#d6dad0', '#949e8a'],
        tuft: '#7c8670', sand: '#d9d0bc', sandEdge: '#bfb39a', path: '#c6bca6',
        bank: '#7f8070', reed: '#9a9070', reedHead: '#6e5a42',
        water: ['#6c8aa3', '#4b6a86', '#36536e'],
        scatter: { kind: 'snow', colors: ['#f6f7f8', '#e9edf0'], count: 46 },
    },
};

function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Deterministic PRNG so the landscape is identical every rebuild
function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ============================================================
//  CAMERA — fits the world on wide screens, follows + drags on narrow ones
// ============================================================
// World point (wx, wy) appears on screen at (wx * canvasScale + camera.offX, wy * canvasScale + camera.offY).
const camera = {
    mode: 'fit',          // 'fit' = whole world centred, 'pan' = zoomed in, follows learner, draggable
    x: WORLD_W / 2,       // world-space point at the centre of the view
    y: WORLD_H / 2,
    offX: 0, offY: 0,     // CSS-pixel translation applied to the world layer
    viewW: 1, viewH: 1,   // canvas size in CSS pixels
    manualUntil: 0,       // after a drag, hold the manual position until this time
    drag: null,
    suppressClickUntil: 0,
};
const HORIZON_Y = 46;     // world y where the sky/mountain band meets the ground

function configureCamera(w, h) {
    camera.viewW = w;
    camera.viewH = h;
    const contain = Math.min(w / WORLD_W, h / WORLD_H);
    const cover = Math.max(w / WORLD_W, h / WORLD_H);
    if (cover / contain <= 1.5) {
        camera.mode = 'fit';
        canvasScale = contain;
    } else {
        camera.mode = 'pan';
        canvasScale = Math.min(cover, Math.max(contain, 1.4));
    }
    canvas.classList.toggle('pannable', camera.mode === 'pan');
    if (camera.mode === 'pan' && persons.length > 1) {
        const f = cameraFocus();
        camera.x = f.x; camera.y = f.y;
    }
    applyCamera();
}

function applyCamera() {
    const s = canvasScale;
    const halfW = camera.viewW / (2 * s), halfH = camera.viewH / (2 * s);
    if (camera.mode === 'fit' || halfW * 2 >= WORLD_W) camera.x = WORLD_W / 2;
    else camera.x = Math.max(halfW, Math.min(WORLD_W - halfW, camera.x));
    if (camera.mode === 'fit' || halfH * 2 >= WORLD_H) camera.y = WORLD_H / 2;
    else camera.y = Math.max(halfH, Math.min(WORLD_H - halfH, camera.y));
    // Snap to device pixels so the cached terrain blits crisply
    camera.offX = Math.round((camera.viewW / 2 - camera.x * s) * dpr) / dpr;
    camera.offY = Math.round((camera.viewH / 2 - camera.y * s) * dpr) / dpr;
}

function cameraFocus() {
    const learner = persons[1], speaker = persons[0];
    if (!learner) return { x: WORLD_W / 2, y: WORLD_H / 2 };
    if (speaker) {
        const span = Math.min(camera.viewW, camera.viewH) / canvasScale * 0.55;
        if (Math.hypot(speaker.x - learner.x, speaker.y - learner.y) < span) {
            return { x: (speaker.x + learner.x) / 2, y: (speaker.y + learner.y) / 2 - 10 };
        }
    }
    return { x: learner.x, y: learner.y - 10 };
}

function updateCamera(rawDt) {
    if (camera.mode !== 'pan' || camera.drag || performance.now() < camera.manualUntil) return;
    const f = cameraFocus();
    const k = 1 - Math.exp(-rawDt / 450);
    camera.x += (f.x - camera.x) * k;
    camera.y += (f.y - camera.y) * k;
    applyCamera();
}

function screenToWorld(cssX, cssY) {
    return { x: (cssX - camera.offX) / canvasScale, y: (cssY - camera.offY) / canvasScale };
}
// Visible area in world units
function viewWorldRect() {
    const s = canvasScale;
    return { x0: -camera.offX / s, y0: -camera.offY / s,
             x1: (camera.viewW - camera.offX) / s, y1: (camera.viewH - camera.offY) / s };
}
// Visible area in scaled-world pixels (what fillRect needs while the world transform is active)
function viewPxRect() {
    return { x: -camera.offX, y: -camera.offY, w: camera.viewW, h: camera.viewH };
}
function setWorldTransform(c) { c.setTransform(dpr, 0, 0, dpr, camera.offX * dpr, camera.offY * dpr); }
function setScreenTransform(c) { c.setTransform(dpr, 0, 0, dpr, 0, 0); }

function setupCameraInput() {
    canvas.addEventListener('pointerdown', e => {
        if (camera.mode !== 'pan' || (e.pointerType === 'mouse' && e.button !== 0)) return;
        camera.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y, moved: false };
    });
    canvas.addEventListener('pointermove', e => {
        const d = camera.drag;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.moved) {
            if (Math.hypot(dx, dy) < 8) return;
            d.moved = true;
            canvas.classList.add('dragging');
            try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        }
        camera.x = d.camX - dx / canvasScale;
        camera.y = d.camY - dy / canvasScale;
        camera.manualUntil = performance.now() + 8000;
        applyCamera();
    });
    const endDrag = e => {
        const d = camera.drag;
        if (!d || d.id !== e.pointerId) return;
        if (d.moved) camera.suppressClickUntil = performance.now() + 400;
        camera.drag = null;
        canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
}

// ============================================================
//  TERRAIN — painted once into an offscreen canvas, rebuilt on resize / season change
// ============================================================
const terrainCache = { canvas: null, key: '', res: 1, x0: 0, y0: 0 };
let _grainTile = null;

// River banks as cubic Béziers (world units) — same course the collision code assumes (x≈705..800)
const RIVER_LEFT_CURVES = [
    [[725, 0], [720, 120], [715, 280], [710, 400]],
    [[710, 400], [705, 500], [708, 560], [705, 640]],
];
const RIVER_RIGHT_CURVES = [
    [[785, 0], [790, 80], [797, 180], [795, 300]],
    [[795, 300], [793, 420], [798, 540], [800, 640]],
];
function _sampleCurves(curves) {
    const pts = [];
    for (const [p0, p1, p2, p3] of curves) {
        for (let i = 0; i <= 24; i++) {
            const t = i / 24, u = 1 - t;
            pts.push([
                u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
                u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
            ]);
        }
    }
    return pts;
}
const _riverLeftPts = _sampleCurves(RIVER_LEFT_CURVES);
const _riverRightPts = _sampleCurves(RIVER_RIGHT_CURVES);
function _bankXAt(pts, y) {
    if (y <= pts[0][1]) return pts[0][0];
    for (let i = 1; i < pts.length; i++) {
        if (y <= pts[i][1]) {
            const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
            return x0 + (x1 - x0) * ((y - y0) / ((y1 - y0) || 1));
        }
    }
    return pts[pts.length - 1][0];
}
function riverBanksAt(y) { return { l: _bankXAt(_riverLeftPts, y), r: _bankXAt(_riverRightPts, y) }; }

// Closed river outline from yTop to yBottom (extends straight past the world edge into letterbox space)
function riverPath(yTop, yBottom) {
    const p = new Path2D();
    p.moveTo(_bankXAt(_riverLeftPts, yTop), yTop);
    for (const [x, y] of _riverLeftPts) if (y > yTop) p.lineTo(x, y);
    p.lineTo(705, Math.max(640, yBottom));
    p.lineTo(800, Math.max(640, yBottom));
    for (let i = _riverRightPts.length - 1; i >= 0; i--) {
        const [x, y] = _riverRightPts[i];
        if (y > yTop) p.lineTo(x, y);
    }
    p.lineTo(_bankXAt(_riverRightPts, yTop), yTop);
    p.closePath();
    return p;
}
function riverBankPath(pts, yTop, yBottom, xBottom) {
    const p = new Path2D();
    p.moveTo(_bankXAt(pts, yTop), yTop);
    for (const [x, y] of pts) if (y > yTop) p.lineTo(x, y);
    p.lineTo(xBottom, Math.max(640, yBottom));
    return p;
}
let _riverAnimPath = null, _riverAnimKey = '';

// Village footpaths (world units). Purely visual — characters path-find independently.
const VILLAGE_PATHS = [
    [[96, 336], [160, 322], [210, 308], [250, 302]],                 // torii → plaza
    [[250, 300], [330, 298], [420, 300], [510, 301], [592, 302]],   // plaza east–west
    [[420, 184], [421, 240], [420, 300], [419, 360], [420, 420]],   // plaza north–south
    [[592, 304], [640, 322], [676, 360], [700, 396], [712, 402]],   // plaza → bridge
    [[420, 420], [418, 470], [420, 512]],                            // plaza → koi pond
    [[318, 392], [262, 420], [205, 448], [168, 474]],               // plaza → shrine
    [[446, 196], [478, 182], [500, 174]],                            // lantern → shoin
    [[548, 232], [578, 218], [600, 214]],                            // plaza → house
    [[268, 232], [232, 236], [196, 234]],                            // plaza → house
    [[792, 402], [826, 384], [846, 352], [842, 326]],               // bridge → medicine hut
    [[826, 384], [866, 318], [900, 270], [918, 250]],               // → terakoya
    [[796, 406], [850, 404], [898, 402]],                            // → stable
    [[800, 418], [826, 470], [846, 530], [856, 574]],               // → viewpoint
    [[836, 500], [870, 512], [902, 520]],                            // → tea field
];
const PLAZA = { x: 420, y: 300, rx: 182, ry: 122 };

function _plazaRadius(a, inset) {
    // Gently irregular rim
    return 1 - inset + Math.sin(a * 3 + 0.7) * 0.025 + Math.sin(a * 7 + 2.1) * 0.015 + Math.sin(a * 13) * 0.008;
}
function _plazaShape(g, inset) {
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const k = _plazaRadius(a, inset);
        const x = PLAZA.x + Math.cos(a) * PLAZA.rx * k;
        const y = PLAZA.y + Math.sin(a) * PLAZA.ry * k;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
}
function _inPlaza(x, y, inset) {
    const dx = (x - PLAZA.x) / PLAZA.rx, dy = (y - PLAZA.y) / PLAZA.ry;
    return Math.hypot(dx, dy) < _plazaRadius(Math.atan2(dy, dx), inset || 0);
}

// Draw a shape as a soft-edged blob using the shadow-offset trick (works everywhere, unlike ctx.filter).
function _soft(g, res, color, blur, drawFn) {
    const OFF = 20000;
    g.save();
    g.shadowColor = color;
    g.shadowBlur = blur * res;
    g.shadowOffsetX = OFF * res;
    g.shadowOffsetY = 0;
    g.translate(-OFF, 0);
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    drawFn(g);
    g.restore();
}

function _traceSmooth(g, pts) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    g.lineTo(last[0], last[1]);
}

function _getGrainTile() {
    if (_grainTile) return _grainTile;
    const n = 128;
    const src = document.createElement('canvas');
    src.width = src.height = n;
    const sc = src.getContext('2d');
    const img = sc.createImageData(n, n);
    const rnd = mulberry32(77);
    for (let i = 0; i < n * n; i++) {
        const v = 128 + (rnd() - 0.5) * 70;
        img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    sc.putImageData(img, 0, 0);
    // Washi fibres
    sc.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
        const x = rnd() * n, y = rnd() * n, a = rnd() * Math.PI, len = 8 + rnd() * 22;
        sc.strokeStyle = rnd() < 0.6 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)';
        sc.lineWidth = 0.6;
        sc.beginPath();
        sc.moveTo(x, y);
        sc.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * 6, y + Math.sin(a) * len * 0.5 + (rnd() - 0.5) * 6,
                            x + Math.cos(a) * len, y + Math.sin(a) * len);
        sc.stroke();
    }
    // Upscale ×2 with smoothing → softer, paper-like grain
    const tile = document.createElement('canvas');
    tile.width = tile.height = n * 2;
    const tc = tile.getContext('2d');
    tc.imageSmoothingEnabled = true;
    tc.drawImage(src, 0, 0, n * 2, n * 2);
    _grainTile = tile;
    return tile;
}

function terrainRegion() {
    // World area plus any letterbox margin around it (fit mode, or the short axis in pan mode)
    const s = canvasScale;
    const mx = Math.max(0, (camera.viewW / s - WORLD_W) / 2);
    const my = Math.max(0, (camera.viewH / s - WORLD_H) / 2);
    return { x0: -mx - 4, y0: -my - 4, x1: WORLD_W + mx + 4, y1: WORLD_H + my + 4 };
}

function buildTerrainCache(season, r, key) {
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    let res = canvasScale * Math.min(dpr, 2);
    res = Math.min(res, 4096 / w, 4096 / h);
    const c = terrainCache.canvas || document.createElement('canvas');
    c.width = Math.ceil(w * res);
    c.height = Math.ceil(h * res);
    const g = c.getContext('2d');
    g.setTransform(res, 0, 0, res, -r.x0 * res, -r.y0 * res);
    paintTerrain(g, SEASON_PALETTES[season] || SEASON_PALETTES.spring, r, res);
    // Washi grain over everything
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.55;
    g.fillStyle = g.createPattern(_getGrainTile(), 'repeat');
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    Object.assign(terrainCache, { canvas: c, key, res, x0: r.x0, y0: r.y0 });
}

function paintTerrain(g, P, r, res) {
    const rnd = mulberry32(20240611);

    // 1 — Ground base, a gentle bokashi from distance to foreground
    const base = g.createLinearGradient(0, HORIZON_Y, 0, Math.max(WORLD_H, r.y1));
    base.addColorStop(0, P.groundTop);
    base.addColorStop(1, P.groundBottom);
    g.fillStyle = base;
    g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);

    // 2 — Painterly colour blotches (fixed positions across a generous area so resizes don't reshuffle)
    for (let i = 0; i < 170; i++) {
        const x = -400 + rnd() * 1800, y = HORIZON_Y + rnd() * 1000 - 120;
        const rad = 28 + rnd() * 70, col = P.blotches[i % P.blotches.length], a = 0.35 + rnd() * 0.3;
        if (x + rad < r.x0 || x - rad > r.x1 || y + rad < r.y0 || y - rad > r.y1) continue;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, hexToRgba(col, a));
        gr.addColorStop(0.6, hexToRgba(col, a * 0.55));
        gr.addColorStop(1, hexToRgba(col, 0));
        g.fillStyle = gr;
        g.save();
        g.translate(x, y); g.scale(1, 0.62); g.translate(-x, -y);
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        g.restore();
    }

    // 3 — River: banks, water, flow lines, pebbles, reeds
    const riverTop = HORIZON_Y - 4, riverBottom = r.y1 + 2;
    const river = riverPath(riverTop, riverBottom);
    const banks = [riverBankPath(_riverLeftPts, riverTop + 4, riverBottom, 705),
                   riverBankPath(_riverRightPts, riverTop + 4, riverBottom, 800)];
    g.save();
    g.lineJoin = 'round';
    _soft(g, res, hexToRgba(P.bank, 0.75), 5, s => { s.lineWidth = 12; for (const b of banks) s.stroke(b); });
    const water = g.createLinearGradient(700, 0, 805, 0);
    water.addColorStop(0, P.water[0]);
    water.addColorStop(0.22, P.water[1]);
    water.addColorStop(0.5, P.water[2]);
    water.addColorStop(0.78, P.water[1]);
    water.addColorStop(1, P.water[0]);
    g.fillStyle = water;
    g.fill(river);
    g.clip(river);
    // Shallows: pale band hugging each bank
    g.strokeStyle = hexToRgba(PALETTE.washi, 0.16);
    g.lineWidth = 7;
    for (const b of banks) g.stroke(b);
    // Long woodblock-style flow lines
    g.lineCap = 'round';
    for (let lane = 0; lane < 7; lane++) {
        const u = 0.12 + lane * 0.127;
        g.strokeStyle = hexToRgba(lane % 2 ? PALETTE.aiLight : PALETTE.washi, lane % 2 ? 0.28 : 0.12);
        g.lineWidth = lane % 2 ? 0.9 : 0.7;
        g.beginPath();
        let started = false;
        for (let y = riverTop; y <= riverBottom; y += 6) {
            const b = riverBanksAt(y);
            const x = b.l + (b.r - b.l) * u + Math.sin(y * 0.045 + lane * 1.7) * 3;
            if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
        }
        g.setLineDash([22 + lane * 3, 10 + lane * 2]);
        g.lineDashOffset = lane * 9;
        g.stroke();
    }
    g.setLineDash([]);
    g.restore();
    // Ink outline of the banks
    g.save();
    g.strokeStyle = hexToRgba(PALETTE.sumi, 0.35);
    g.lineWidth = 0.9;
    g.lineJoin = 'round';
    for (const b of banks) g.stroke(b);
    g.restore();
    // Pebbles & reeds along both banks (kept clear of the bridge and dock)
    for (let y = HORIZON_Y + 6; y < riverBottom; y += 7 + rnd() * 9) {
        if (Math.abs(y - BRIDGE.y) < 58 || Math.abs(y - 530) < 24) continue;
        const b = riverBanksAt(y);
        for (const side of [-1, 1]) {
            const bx = side < 0 ? b.l : b.r;
            if (rnd() < 0.55) {
                const px = bx + side * (2 + rnd() * 5), pr = 1.2 + rnd() * 2;
                g.fillStyle = rnd() < 0.5 ? PALETTE.stone : PALETTE.stoneLight;
                g.beginPath();
                g.ellipse(px, y, pr * 1.3, pr, rnd() * 3, 0, Math.PI * 2);
                g.fill();
            }
            if (rnd() < 0.16) _drawReeds(g, bx + side * 4, y, side, P, rnd);
        }
    }

    // 4 — Footpaths: soft beaten earth
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    _soft(g, res, hexToRgba(P.path, 0.55), 6, s => {
        s.lineWidth = 15;
        for (const pts of VILLAGE_PATHS) { s.beginPath(); _traceSmooth(s, pts); s.stroke(); }
    });
    g.restore();

    // 5 — Plaza: soft-edged sand with raked-gravel rings (karesansui)
    _soft(g, res, P.sandEdge, 9, s => { _plazaShape(s, 0); s.fill(); });
    _soft(g, res, P.sand, 6, s => { _plazaShape(s, 0.07); s.fill(); });
    g.save();
    _plazaShape(g, 0.08);
    g.clip();
    g.lineWidth = 1.1;
    for (let k = 0.06; k < 1; k += 0.042) {
        g.beginPath();
        g.ellipse(PLAZA.x, PLAZA.y + 1, PLAZA.rx * k, PLAZA.ry * k, 0, 0, Math.PI * 2);
        g.strokeStyle = hexToRgba(PALETTE.sumi, 0.07);
        g.stroke();
        g.beginPath();
        g.ellipse(PLAZA.x, PLAZA.y, PLAZA.rx * k, PLAZA.ry * k, 0, 0, Math.PI * 2);
        g.strokeStyle = hexToRgba('#ffffff', 0.2);
        g.stroke();
    }
    g.restore();

    // 6 — Stepping stones (tobi-ishi) along every path
    for (const pts of VILLAGE_PATHS) {
        let carry = 0, flip = 1;
        for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
            const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
            for (let d = carry; d < len; d += 15) {
                const t = d / len;
                const sx = ax + (bx - ax) * t + nx * flip * 2.5, sy = ay + (by - ay) * t + ny * flip * 2.5;
                flip = -flip;
                _drawStone(g, sx, sy, 3.6 + rnd() * 1.6, rnd);
                carry = d + 15 - len;
            }
        }
    }

    // 7 — Grass tufts (brush flicks)
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = hexToRgba(P.tuft, 0.55);
    g.lineWidth = 0.7;
    for (let i = 0; i < 520; i++) {
        const x = -400 + rnd() * 1800, y = HORIZON_Y + 8 + rnd() * 1000 - 120, sz = 2.6 + rnd() * 2.4;
        if (x < r.x0 || x > r.x1 || y < HORIZON_Y + 8 || y > r.y1) continue;
        if (x > 696 && x < 810) continue;
        if (_inPlaza(x, y, -0.04)) continue;
        g.beginPath();
        for (let b = -1; b <= 1; b++) {
            g.moveTo(x + b * 0.9, y);
            g.quadraticCurveTo(x + b * 1.6, y - sz * 0.6, x + b * 2.6 + (rnd() - 0.5), y - sz);
        }
        g.stroke();
    }
    g.restore();

    // 8 — Seasonal scatter: petals, wildflowers, fallen leaves or snow
    _paintSeasonScatter(g, P, r, res, rnd);

    // 9 — Aerial perspective: distant ground fades toward the horizon colour
    const haze = g.createLinearGradient(0, HORIZON_Y, 0, HORIZON_Y + 130);
    haze.addColorStop(0, hexToRgba(P.skyHorizon, 0.45));
    haze.addColorStop(1, hexToRgba(P.skyHorizon, 0));
    g.fillStyle = haze;
    g.fillRect(r.x0, HORIZON_Y - 2, r.x1 - r.x0, 132);

    // 10 — Sky, mountains and mist above the horizon
    _paintHorizon(g, P, r, res, rnd);
}

function _drawStone(g, x, y, rad, rnd) {
    const pts = [];
    const n = 7, rot = rnd() * Math.PI;
    for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        const k = 0.78 + rnd() * 0.3;
        pts.push([x + Math.cos(a) * rad * k * 1.25, y + Math.sin(a) * rad * k * 0.8]);
    }
    const shape = () => {
        g.beginPath();
        g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
        for (let i = 0; i < n; i++) {
            const p = pts[i], q = pts[(i + 1) % n];
            g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
        }
        g.closePath();
    };
    g.save();
    g.translate(0.5, 0.9);
    shape();
    g.fillStyle = 'rgba(40,32,20,0.22)';
    g.fill();
    g.restore();
    shape();
    g.fillStyle = PALETTE.stone;
    g.fill();
    g.lineWidth = 0.45;
    g.strokeStyle = hexToRgba(PALETTE.sumi, 0.4);
    g.stroke();
    g.save();
    g.clip();
    g.fillStyle = hexToRgba(PALETTE.stoneLight, 0.85);
    g.beginPath();
    g.ellipse(x - rad * 0.25, y - rad * 0.3, rad * 0.8, rad * 0.4, -0.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
}

function _drawReeds(g, x, y, side, P, rnd) {
    g.save();
    g.lineCap = 'round';
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
        const h = 7 + rnd() * 6, lean = side * (0.5 + rnd() * 2) + (rnd() - 0.5) * 2;
        const bx = x + (i - n / 2) * 1.1;
        g.strokeStyle = P.reed;
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(bx, y);
        g.quadraticCurveTo(bx + lean * 0.3, y - h * 0.6, bx + lean, y - h);
        g.stroke();
        if (rnd() < 0.45) {
            g.strokeStyle = P.reedHead;
            g.lineWidth = 1.5;
            g.beginPath();
            g.moveTo(bx + lean * 0.85, y - h * 0.82);
            g.lineTo(bx + lean, y - h);
            g.stroke();
        }
    }
    g.restore();
}

function _paintSeasonScatter(g, P, r, res, rnd) {
    const sc = P.scatter;
    const ok = (x, y) => x >= r.x0 && x <= r.x1 && y >= HORIZON_Y + 10 && y <= r.y1 && !(x > 696 && x < 810);
    if (sc.kind === 'snow') {
        for (let i = 0; i < sc.count; i++) {
            const x = -300 + rnd() * 1600, y = HORIZON_Y + 20 + rnd() * 860 - 60, rad = 14 + rnd() * 34;
            if (!ok(x, y) || _inPlaza(x, y, -0.05)) continue;
            const lobes = [];
            for (let k = 0; k < 4; k++) lobes.push([x + (rnd() - 0.5) * rad * 1.6, y + (rnd() - 0.5) * rad * 0.5, rad * (0.35 + rnd() * 0.35)]);
            _soft(g, res, hexToRgba(sc.colors[0], 0.5), 5, s => {
                s.beginPath();
                for (const [lx, ly, lr] of lobes) { s.moveTo(lx + lr, ly); s.ellipse(lx, ly, lr, lr * 0.45, 0, 0, Math.PI * 2); }
                s.fill();
            });
        }
        g.fillStyle = hexToRgba('#ffffff', 0.7);
        for (let i = 0; i < 260; i++) {
            const x = -300 + rnd() * 1600, y = HORIZON_Y + rnd() * 900 - 60;
            if (!ok(x, y)) continue;
            g.fillRect(x, y, 0.8, 0.8);
        }
        return;
    }
    for (let i = 0; i < sc.count * 1.5; i++) {
        const x = -300 + rnd() * 1600, y = HORIZON_Y + rnd() * 900 - 60;
        const col = sc.colors[Math.floor(rnd() * sc.colors.length)], rot = rnd() * Math.PI * 2;
        if (!ok(x, y)) continue;
        const inPlaza = _inPlaza(x, y, 0);
        if (inPlaza && sc.kind === 'flower') continue;
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        if (sc.kind === 'petal') {
            g.fillStyle = hexToRgba(col, 0.85);
            g.beginPath();
            g.ellipse(0, 0, 1.6, 0.9, 0, 0, Math.PI * 2);
            g.fill();
        } else if (sc.kind === 'flower') {
            g.fillStyle = hexToRgba(col, 0.9);
            for (let p = 0; p < 5; p++) {
                g.beginPath();
                g.arc(Math.cos(p * 1.2566) * 1.1, Math.sin(p * 1.2566) * 1.1, 0.75, 0, Math.PI * 2);
                g.fill();
            }
            g.fillStyle = '#e8b030';
            g.beginPath(); g.arc(0, 0, 0.55, 0, Math.PI * 2); g.fill();
        } else if (sc.kind === 'leaf') {
            g.fillStyle = hexToRgba(col, 0.85);
            g.beginPath();
            g.moveTo(-2.4, 0);
            g.quadraticCurveTo(0, -1.6, 2.4, 0);
            g.quadraticCurveTo(0, 1.6, -2.4, 0);
            g.fill();
        }
        g.restore();
    }
}

function _ridge(g, x0, x1, baseY, seed, amp, freq, peakY) {
    // Layered sine ridge; returns nothing, leaves an open path ready to fill
    g.beginPath();
    g.moveTo(x0, baseY);
    for (let x = x0; x <= x1 + 6; x += 6) {
        const y = peakY + amp * (0.5 + 0.5 * Math.sin(x * freq + seed))
                + amp * 0.45 * Math.sin(x * freq * 2.3 + seed * 1.7)
                + amp * 0.2 * Math.sin(x * freq * 5.1 + seed * 0.3);
        g.lineTo(x, Math.min(baseY, y));
    }
    g.lineTo(x1 + 6, baseY);
    g.closePath();
}

function _paintHorizon(g, P, r, res, rnd) {
    const x0 = r.x0, x1 = r.x1, skyTop = Math.min(r.y0, -60);

    // Sky — strong bokashi from indigo down to warm paper at the horizon
    const sky = g.createLinearGradient(0, skyTop, 0, HORIZON_Y);
    sky.addColorStop(0, P.skyTop);
    sky.addColorStop(0.55, _mix(P.skyTop, P.skyHorizon, 0.55));
    sky.addColorStop(1, P.skyHorizon);
    g.fillStyle = sky;
    g.fillRect(x0, r.y0, x1 - x0, HORIZON_Y + 2 - r.y0);

    // Kasumi — long rounded mist bands, a woodblock signature
    const band = (cx, cy, len, th, a) => {
        _soft(g, res, hexToRgba(P.cloud, a), 2.5, s => {
            s.beginPath();
            s.moveTo(cx - len / 2 + th / 2, cy - th / 2);
            s.lineTo(cx + len / 2 - th / 2, cy - th / 2);
            s.arc(cx + len / 2 - th / 2, cy, th / 2, -Math.PI / 2, Math.PI / 2);
            s.lineTo(cx - len / 2 + th / 2, cy + th / 2);
            s.arc(cx - len / 2 + th / 2, cy, th / 2, Math.PI / 2, Math.PI * 1.5);
            s.fill();
        });
    };
    if (r.y0 < -10) {
        band(160, -24, 260, 9, 0.75);
        band(820, -38, 340, 10, 0.7);
        band(-80, -48, 220, 8, 0.6);
        band(1120, -14, 220, 8, 0.6);
    }
    band(300, 10, 200, 5, 0.55);
    band(905, 4, 170, 5, 0.5);

    // Distant volcano (snow-capped), echoing classic landscape prints
    const fx = 600, fBase = HORIZON_Y - 2, fTop = 10, fHalf = 116;
    const fGrad = g.createLinearGradient(0, fTop, 0, fBase);
    fGrad.addColorStop(0, P.peak);
    fGrad.addColorStop(1, hexToRgba(P.skyHorizon, 0.2));
    g.fillStyle = fGrad;
    g.beginPath();
    g.moveTo(fx - fHalf, fBase);
    g.quadraticCurveTo(fx - fHalf * 0.35, fTop + 18, fx - 12, fTop);
    g.lineTo(fx + 12, fTop);
    g.quadraticCurveTo(fx + fHalf * 0.35, fTop + 18, fx + fHalf, fBase);
    g.closePath();
    g.fill();
    // Snow cap with jagged melt line
    const capY = fTop + (fBase - fTop) * P.peakSnow;
    g.save();
    g.clip();
    g.fillStyle = hexToRgba('#ffffff', 0.92);
    g.beginPath();
    g.moveTo(fx - fHalf, fTop - 2);
    g.lineTo(fx + fHalf, fTop - 2);
    for (let i = 0; i <= 12; i++) {
        const x = fx + fHalf - (i / 12) * fHalf * 2;
        g.lineTo(x, capY + (i % 2 ? 4 : -1) + Math.sin(i * 2.1) * 1.5);
    }
    g.closePath();
    g.fill();
    g.restore();

    // Far range — pale, fading into mist at its foot
    const farGrad = g.createLinearGradient(0, 10, 0, HORIZON_Y);
    farGrad.addColorStop(0, P.mountFar);
    farGrad.addColorStop(1, hexToRgba(P.skyHorizon, 0.4));
    g.fillStyle = farGrad;
    _ridge(g, x0, x1, HORIZON_Y, 1.3, 13, 0.011, 14);
    g.fill();

    // Near hills — darker, rounder
    const nearGrad = g.createLinearGradient(0, 24, 0, HORIZON_Y + 4);
    nearGrad.addColorStop(0, P.mountNear);
    nearGrad.addColorStop(1, _mix(P.mountNear, P.groundTop, 0.7));
    g.fillStyle = nearGrad;
    _ridge(g, x0, x1, HORIZON_Y + 4, 4.2, 9, 0.017, 27);
    g.fill();
    g.strokeStyle = hexToRgba(PALETTE.sumi, 0.18);
    g.lineWidth = 0.6;
    g.stroke();

    // Distant treeline — small brush dabs along the horizon
    g.fillStyle = hexToRgba(P.treeline, 0.75);
    for (let x = x0; x < x1; x += 4 + rnd() * 6) {
        if (x > 712 && x < 795) continue; // river gap
        const h = 3 + rnd() * 5, y = HORIZON_Y + 1 + rnd() * 2;
        g.beginPath();
        if (rnd() < 0.5) {
            g.moveTo(x - 2.2, y); g.lineTo(x, y - h); g.lineTo(x + 2.2, y);
        } else {
            g.ellipse(x, y - h * 0.45, 2.4, h * 0.55, 0, 0, Math.PI * 2);
        }
        g.fill();
    }

    // Low mist where hills meet the village
    const mist = g.createLinearGradient(0, HORIZON_Y - 6, 0, HORIZON_Y + 12);
    mist.addColorStop(0, hexToRgba(P.skyHorizon, 0));
    mist.addColorStop(0.45, hexToRgba(P.skyHorizon, 0.55));
    mist.addColorStop(1, hexToRgba(P.skyHorizon, 0));
    g.fillStyle = mist;
    g.fillRect(x0, HORIZON_Y - 6, x1 - x0, 18);
    band(130, HORIZON_Y + 1, 230, 4, 0.45);
    band(520, HORIZON_Y - 1, 300, 4, 0.4);
    band(960, HORIZON_Y + 2, 210, 4, 0.4);
    // River mouth dissolves into a feathered pool of mist
    _soft(g, res, hexToRgba(P.skyHorizon, 0.8), 10, s => {
        s.beginPath(); s.ellipse(754, HORIZON_Y + 2, 62, 9, 0, 0, Math.PI * 2); s.fill();
    });
    band(760, HORIZON_Y + 6, 120, 4, 0.45);
}

function _mix(a, b, t) {
    const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
    const ch = sh => Math.round(((na >> sh) & 255) * (1 - t) + ((nb >> sh) & 255) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function drawTerrain(ctx) {
    const season = getSeason();
    const r = terrainRegion();
    const key = [season, canvasScale.toFixed(4), Math.min(dpr, 2), r.x0.toFixed(1), r.y0.toFixed(1), r.x1.toFixed(1), r.y1.toFixed(1)].join('|');
    if (terrainCache.key !== key) {
        if (terrainCache.canvas && performance.now() - _lastResizeAt < 250) {
            // Mid-resize: reuse the old cache (it may not reach the new edges, so back it with a fill)
            const vr = viewPxRect();
            ctx.fillStyle = '#20242a';
            ctx.fillRect(vr.x, vr.y, vr.w, vr.h);
        } else {
            buildTerrainCache(season, r, key);
        }
    }
    const s = canvasScale, c = terrainCache.canvas, res = terrainCache.res;
    ctx.drawImage(c, terrainCache.x0 * s, terrainCache.y0 * s, c.width / res * s, c.height / res * s);
    drawRiverShimmer(ctx, r);
}

// Per-frame river animation: drifting highlight strokes, clipped to the water
function drawRiverShimmer(ctx, r) {
    const s = canvasScale;
    const top = HORIZON_Y - 4, bottom = r.y1 + 2;
    const key = top + '|' + bottom;
    if (_riverAnimKey !== key) { _riverAnimPath = riverPath(top, bottom); _riverAnimKey = key; }
    const span = bottom - top;
    ctx.save();
    ctx.scale(s, s);
    ctx.clip(_riverAnimPath);
    ctx.lineCap = 'round';
    for (let i = 0; i < 42; i++) {
        const seed = i * 97.31;
        const u = 0.12 + ((seed * 7.13) % 0.76);
        const speed = 0.28 + (i % 5) * 0.04;
        const travel = (seed * 13.7 + gameTick * speed) % span;
        const y = top + travel;
        const b = riverBanksAt(y);
        const x = b.l + (b.r - b.l) * u + Math.sin(y * 0.05 + i) * 2;
        const fade = Math.min(1, Math.sin(Math.PI * travel / span) * 4);
        const pulse = 0.5 + 0.5 * Math.sin(gameTick * 0.03 + i * 1.9);
        const a = (0.16 + (i % 3) * 0.08) * fade * (0.5 + pulse * 0.5);
        const w = 4 + (i % 4) * 2;
        ctx.strokeStyle = i % 3 === 0 ? `rgba(255,250,235,${a})` : `rgba(195,220,238,${a})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.quadraticCurveTo(x, y + 2.4, x + w, y);
        ctx.stroke();
    }
    ctx.restore();
}

// ============================================================
//  OBJECT SPRITES — each type's static drawing is rendered once, then given the
//  woodblock treatment (ink outline, one light direction, ground contact shade, washi grain)
// ============================================================
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let _swayK = 1;                    // multiplies built-in sway; 0 while a sprite is being rendered
const SWAY_TYPES = {               // whole-sprite sway (amplitude in world units at the top)
    bamboo: { amp: wind => 2 + wind * 6, f: 0.02,  k: 0.05, h: 62 },
    willow: { amp: wind => 3 + wind * 8, f: 0.02,  k: 0.03, h: 46 },
    flower: { amp: () => 1.5,            f: 0.025, k: 0.1,  h: 16 },
};
const FLAT_TYPES = new Set([...GROUND_TYPES, 'bridge', 'dock']);
// Plants get an outline in a deep shade of their own colour instead of black ink
const OUTLINE_INK = { willow: '#25381f', bamboo: '#1e3a1c', flower: '#3a3020' };
const _spriteCache = new Map();
let _spriteKey = '';
let _spriteStale = null;          // previous-resolution sprites, shown (stretched) until replacements exist
let _spriteBudgetEnd = Infinity;  // the game loop sets this each frame; builds stop once it passes

// Returns the styled sprite, or null when it isn't built yet (callers then draw the object directly)
function getObjectSprite(obj) {
    const res = canvasScale * Math.min(dpr, 3);
    const key = res.toFixed(4);
    const k = obj.type === 'willow' ? 'willow|' + getSeason() : obj.type;
    if (_spriteKey !== key) {
        if (_spriteCache.size && performance.now() - _lastResizeAt < 250) return _spriteCache.get(k) || null;  // mid-resize
        if (_spriteCache.size) _spriteStale = new Map(_spriteCache);
        _spriteCache.clear();
        _spriteKey = key;
    }
    let spr = _spriteCache.get(k);
    if (spr === undefined) {
        if (performance.now() > _spriteBudgetEnd) return (_spriteStale && _spriteStale.get(k)) || null;
        spr = buildObjectSprite(obj, res);
        _spriteCache.set(k, spr);
        if (_spriteStale && _spriteCache.size >= _spriteStale.size) _spriteStale = null;
    }
    return spr;
}

function buildObjectSprite(obj, res) {
    // 1 — render the static drawing into a generous scratch canvas
    const padX = obj.w / 2 + 50, padTop = obj.h / 2 + 90, padBot = obj.h / 2 + 30;
    const W = Math.ceil(padX * 2 * res), H = Math.ceil((padTop + padBot) * res);
    const scratch = document.createElement('canvas');
    scratch.width = W; scratch.height = H;
    const sc = scratch.getContext('2d', { willReadFrequently: true });
    const keepScale = canvasScale;
    canvasScale = res; _swayK = 0;
    try { drawObjectBody(sc, Object.assign({}, obj, { x: padX, y: padTop })); }
    finally { canvasScale = keepScale; _swayK = 1; }

    // 2 — crop to the drawn pixels
    const px = sc.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let yy = 0; yy < H; yy++) {
        const row = yy * W * 4;
        for (let xx = 0; xx < W; xx++) {
            if (px[row + xx * 4 + 3] > 6) {
                if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
                if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
            }
        }
    }
    if (x1 < 0) return null;
    const r = Math.max(1, Math.round(res * 0.8));     // ink outline radius in pixels
    const pad = r + 2;
    const cw = x1 - x0 + 1 + pad * 2, ch = y1 - y0 + 1 + pad * 2;
    const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };

    // 3 — body with light, contact shade and grain (all kept inside the body's own alpha)
    const body = mk(), bc = body.getContext('2d');
    bc.drawImage(scratch, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
    const mask = mk();
    mask.getContext('2d').drawImage(body, 0, 0);
    bc.globalCompositeOperation = 'source-atop';
    const light = bc.createLinearGradient(0, 0, cw, ch);
    light.addColorStop(0, 'rgba(255,244,214,0.20)');
    light.addColorStop(0.5, 'rgba(255,244,214,0)');
    light.addColorStop(1, 'rgba(24,22,52,0.22)');
    bc.fillStyle = light;
    bc.fillRect(0, 0, cw, ch);
    if (!FLAT_TYPES.has(obj.type)) {
        const ao = bc.createLinearGradient(0, ch, 0, ch * 0.72);
        ao.addColorStop(0, 'rgba(20,16,34,0.26)');
        ao.addColorStop(1, 'rgba(20,16,34,0)');
        bc.fillStyle = ao;
        bc.fillRect(0, 0, cw, ch);
    }
    bc.globalCompositeOperation = 'soft-light';
    bc.globalAlpha = 0.6;
    bc.fillStyle = bc.createPattern(_getGrainTile(), 'repeat');
    bc.fillRect(0, 0, cw, ch);
    bc.globalAlpha = 1;
    bc.globalCompositeOperation = 'destination-in';
    bc.drawImage(mask, 0, 0);

    // 4 — ink outline: the silhouette stamped around the body
    // Only solid pixels count, so faint glows and translucent foliage don't pile up into dark halos
    const sil = mk(), sl = sil.getContext('2d', { willReadFrequently: true });
    sl.drawImage(mask, 0, 0);
    const sd = sl.getImageData(0, 0, cw, ch);
    for (let i = 3; i < sd.data.length; i += 4) sd.data[i] = sd.data[i] > 110 ? 255 : 0;
    sl.putImageData(sd, 0, 0);
    sl.globalCompositeOperation = 'source-in';
    sl.fillStyle = OUTLINE_INK[obj.type] || PALETTE.sumi;
    sl.fillRect(0, 0, cw, ch);
    const out = mk(), oc = out.getContext('2d');
    oc.globalAlpha = OUTLINE_INK[obj.type] ? 0.7 : 0.85;
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        oc.drawImage(sil, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r));
    }
    oc.globalAlpha = 1;
    oc.drawImage(body, 0, 0);

    return { canvas: out, ox: (x0 - pad) / res - padX, oy: (y0 - pad) / res - padTop, w: cw / res, h: ch / res };
}

function drawObjectSprite(ctx, obj) {
    const spr = getObjectSprite(obj);
    if (!spr) { drawObjectBody(ctx, obj); return; }      // not built yet: plain drawing for a frame or two
    const s = canvasScale;
    const dx = (obj.x + spr.ox) * s, dy = (obj.y + spr.oy) * s, dw = spr.w * s, dh = spr.h * s;
    const sw = SWAY_TYPES[obj.type];
    if (!sw || REDUCED_MOTION) { ctx.drawImage(spr.canvas, dx, dy, dw, dh); return; }
    // Bend the sprite about its base: the top moves by `sway`, the base stays planted
    const wind = currentWeather === 'wind' ? weatherIntensity : 0;
    const sway = Math.sin(gameTick * sw.f + obj.x * sw.k) * sw.amp(wind);
    const baseY = (obj.y + (VISUAL_BOTTOM[obj.type] !== undefined ? VISUAL_BOTTOM[obj.type] : obj.h / 2)) * s;
    ctx.save();
    ctx.translate(0, baseY);
    ctx.transform(1, 0, -sway / sw.h, 1, 0, 0);
    ctx.translate(0, -baseY);
    ctx.drawImage(spr.canvas, dx, dy, dw, dh);
    ctx.restore();
}

// ============================================================
//  SHADOWS — flat ink-blue cast shadows that follow the sun, drawn before anything stands on them
// ============================================================
// fw/fd: footprint half-width and depth (world units, measured from the drawings); h: height
const SHADOW_SPECS = {
    house:        { kind: 'box',   fw: 40, fd: 14, h: 50 },
    teahouse:     { kind: 'box',   fw: 45, fd: 14, h: 54 },
    market:       { kind: 'box',   fw: 35, fd: 10, h: 34 },
    well:         { kind: 'box',   fw: 12, fd: 6,  h: 30 },
    pagoda:       { kind: 'tower', fw: 24, fd: 14, h: 78 },
    torii:        { kind: 'gate',  fw: 22.5, fd: 3, h: 52 },
    bamboo:       { kind: 'tree',  fw: 6,  trunk: 44, r: 11 },
    willow:       { kind: 'tree',  fw: 4,  trunk: 20, r: 18 },
    kitchen:      { kind: 'box',   fw: 12, fd: 6,  h: 12 },
    workshop:     { kind: 'box',   fw: 27, fd: 8,  h: 20 },
    shrine:       { kind: 'box',   fw: 18, fd: 10, h: 34 },
    lantern_post: { kind: 'post',  fw: 2,  h: 28, blob: 5, blobX: 8 },
    dock:         { kind: 'box',   fw: 20, fd: 12, h: 3 },
    flower:       { kind: 'blob',  fw: 10, fd: 6,  h: 10 },
    school:       { kind: 'box',   fw: 33, fd: 12, h: 36 },
    medicine_hut: { kind: 'box',   fw: 30, fd: 12, h: 36 },
    stable:       { kind: 'box',   fw: 28, fd: 10, h: 28 },
    tea_terrace:  { kind: 'box',   fw: 24, fd: 10, h: 12 },
    viewpoint:    { kind: 'box',   fw: 20, fd: 8,  h: 14 },
};

// Sun position → shadow offset per unit of height. Morning shadows fall west (left), evening
// east (right), always tipped slightly toward the viewer; long at dawn/dusk, short at noon.
function sunState() {
    const t = gameHour + gameMinute / 60;
    const pc = Math.max(0, Math.min(1, (t - 6) / 12));
    const elev = Math.sin(Math.PI * pc);
    const L = 0.3 + 1.05 * Math.pow(1 - elev, 1.6);
    const fade = (t > 5 && t < 19) ? Math.min(1, (t - 5) / 1.2, (19 - t) / 1.2) : 0;
    const overcast = (currentWeather === 'rain' || currentWeather === 'fog' || currentWeather === 'snow') ? weatherIntensity : 0;
    return { vx: -Math.cos(Math.PI * pc) * L, vy: 0.2 * L + 0.04, alpha: 0.2 * fade * (1 - 0.7 * overcast) };
}

function _hull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
}
function _fillPoly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
}
// Box footprint swept along the sun vector (top optionally narrowed, e.g. a tapering pagoda)
function _sweptBox(ctx, cx, b, fw, fd, ox, oy, topScale) {
    const foot = [[cx - fw, b - fd], [cx + fw, b - fd], [cx + fw, b], [cx - fw, b]];
    const k = topScale || 1, my = b - fd / 2;
    const top = foot.map(([px, py]) => [cx + (px - cx) * k + ox, my + (py - my) * k + oy]);
    _fillPoly(ctx, _hull(foot.concat(top)));
}
function _ellipse(ctx, cx, cy, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawShadows(ctx) {
    const sun = sunState();
    const s = canvasScale;
    ctx.save();
    ctx.scale(s, s);                       // everything below is in world units
    ctx.fillStyle = 'rgb(28,30,60)';
    for (const obj of worldObjects) {
        const sp = SHADOW_SPECS[obj.type];
        if (!sp) continue;
        const b = obj.y + (VISUAL_BOTTOM[obj.type] !== undefined ? VISUAL_BOTTOM[obj.type] : obj.h / 2);
        // Contact shade where the object meets the ground — present day and night
        ctx.globalAlpha = 0.14;
        _ellipse(ctx, obj.x, b - (sp.fd || 3) * 0.35, sp.fw * 1.05 + 2, Math.max(2.4, (sp.fd || 4) * 0.55));
        if (sun.alpha < 0.01) continue;
        ctx.globalAlpha = sun.alpha;
        const H = Math.min(sp.h || sp.trunk || 0, 80);
        const len = Math.min(1, 90 / Math.max(1, Math.hypot(sun.vx, sun.vy) * (H || 1))); // cap very long shadows
        const vx = sun.vx * len, vy = sun.vy * len;
        switch (sp.kind) {
            case 'box':   _sweptBox(ctx, obj.x, b, sp.fw, sp.fd, vx * sp.h, vy * sp.h, 1); break;
            case 'tower': _sweptBox(ctx, obj.x, b, sp.fw, sp.fd, vx * sp.h, vy * sp.h, 0.3); break;
            case 'gate': {
                for (const side of [-1, 1]) _sweptBox(ctx, obj.x + side * sp.fw, b, 2.6, 2, vx * sp.h, vy * sp.h, 1);
                const tx = obj.x + vx * sp.h, ty = b + vy * sp.h;
                _fillPoly(ctx, [[tx - sp.fw - 9, ty - 2], [tx + sp.fw + 9, ty - 2], [tx + sp.fw + 9, ty + 2], [tx - sp.fw - 9, ty + 2]]);
                const nx = obj.x + vx * sp.h * 0.72, ny = b + vy * sp.h * 0.72;
                _fillPoly(ctx, [[nx - sp.fw, ny - 1], [nx + sp.fw, ny - 1], [nx + sp.fw, ny + 1], [nx - sp.fw, ny + 1]]);
                break;
            }
            case 'post':
                _sweptBox(ctx, obj.x, b, sp.fw, 1.5, vx * sp.h, vy * sp.h, 1);
                _ellipse(ctx, obj.x + sp.blobX + vx * sp.h * 0.85, b + vy * sp.h * 0.85, sp.blob + Math.abs(vx) * 2, sp.blob * 0.6);
                break;
            case 'tree': {
                _sweptBox(ctx, obj.x, b, sp.fw * 0.5, 1.5, vx * sp.trunk, vy * sp.trunk, 1);
                const reach = sp.trunk + sp.r * 0.4;
                _ellipse(ctx, obj.x + vx * reach, b + vy * reach, sp.r * (1 + Math.abs(vx) * 0.45), sp.r * 0.55);
                break;
            }
            case 'blob':
                _ellipse(ctx, obj.x + vx * sp.h * 0.5, b + vy * sp.h * 0.5 - sp.fd * 0.3, sp.fw + Math.abs(vx) * sp.h * 0.4, sp.fd * 0.8);
                break;
        }
    }
    // Characters: contact shade at the feet + a short cast shadow
    for (const c of persons.concat(npcs)) {
        const fx = c.x, fy = c.y + 6;
        ctx.globalAlpha = 0.24;
        _ellipse(ctx, fx, fy, 7.5, 2.6);
        if (sun.alpha < 0.01) continue;
        ctx.globalAlpha = sun.alpha * 1.1;
        const ch = 24;
        _ellipse(ctx, fx + sun.vx * ch * 0.5, fy + sun.vy * ch * 0.5, 3.5 + Math.abs(sun.vx) * ch * 0.5, 2.4 + sun.vy * 4, 0);
    }
    ctx.restore();
}

// Texture a roof that was just filled: clips to the current path (the roof outline).
// 'kawara' = rows of round glazed tiles, 'thatch' = layered straw, 'plank' = board seams.
function roofTexture(ctx, kind, cx, cy, w, h) {
    const s = canvasScale;
    const x0 = cx - w, x1 = cx + w, y0 = cy - h, y1 = cy + h;
    ctx.save();
    ctx.clip();
    if (kind === 'kawara') {
        ctx.fillStyle = 'rgba(64,86,118,0.22)';            // blue-grey glaze
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        for (let x = x0; x < x1; x += 2.8 * s) {
            ctx.fillStyle = 'rgba(255,255,255,0.13)';      // lit crest of each tile row
            ctx.fillRect(x, y0, 1.0 * s, y1 - y0);
            ctx.fillStyle = 'rgba(0,0,0,0.28)';            // channel between rows
            ctx.fillRect(x + 1.7 * s, y0, 0.55 * s, y1 - y0);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 0.45 * s;
        ctx.beginPath();
        for (let y = y0; y < y1; y += 3.4 * s) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        ctx.stroke();
    } else if (kind === 'thatch') {
        ctx.lineCap = 'round';
        ctx.lineWidth = 0.55 * s;
        let row = 0;
        for (let y = y0; y < y1; y += 2.2 * s, row++) {
            for (let x = x0 + (row % 2) * 0.8 * s; x < x1; x += 1.6 * s) {
                const lean = ((x / s + row * 3) % 5 - 2.5) * 0.12 * s;
                ctx.strokeStyle = (row + Math.floor(x / s)) % 3 === 0 ? 'rgba(255,236,170,0.32)' : 'rgba(60,44,10,0.22)';
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + lean, y + 2.8 * s);
                ctx.stroke();
            }
        }
    } else if (kind === 'plank') {
        ctx.strokeStyle = 'rgba(40,26,8,0.35)';
        ctx.lineWidth = 0.5 * s;
        ctx.beginPath();
        for (let x = x0; x < x1; x += 4 * s) { ctx.moveTo(x, y0); ctx.lineTo(x + 2 * s, y1); }
        ctx.stroke();
    }
    ctx.restore();
}

// Static drawing of an object (cached into a styled sprite by getObjectSprite)
function drawObjectBody(ctx, obj) {
    const x = obj.x * canvasScale;
    const y = obj.y * canvasScale;
    const w = obj.w * canvasScale;
    const h = obj.h * canvasScale;

    switch (obj.type) {
        case 'house': {
            // Japanese wooden house with shoji screens and gable roof
            // Wooden walls (light wood color)
            ctx.fillStyle = '#C4A56A';
            ctx.fillRect(x - w/2 + 2*canvasScale, y - h/4, w - 4*canvasScale, h/2 + 4*canvasScale);
            // Engawa (veranda) — wooden platform at base
            ctx.fillStyle = '#B09050';
            ctx.fillRect(x - w/2 - 3*canvasScale, y + h/4 + 1*canvasScale, w + 6*canvasScale, 4*canvasScale);
            // Shoji screens (白い障子 — white paper panels with grid)
            ctx.fillStyle = '#f0e8d8';
            const panelW = (w - 8*canvasScale) / 3;
            for (let i = 0; i < 3; i++) {
                const px = x - w/2 + 4*canvasScale + i * (panelW + 1*canvasScale);
                ctx.fillRect(px, y - h/4 + 4*canvasScale, panelW, h/2 - 2*canvasScale);
                // Grid lines
                ctx.strokeStyle = '#a09070';
                ctx.lineWidth = canvasScale * 0.3;
                ctx.beginPath();
                ctx.moveTo(px + panelW/2, y - h/4 + 4*canvasScale);
                ctx.lineTo(px + panelW/2, y + h/4 + 2*canvasScale);
                ctx.moveTo(px, y + 2*canvasScale);
                ctx.lineTo(px + panelW, y + 2*canvasScale);
                ctx.stroke();
            }
            // Gable roof (入母屋 irimoya — Japanese hip-and-gable, dark grey)
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.moveTo(x - w/2 - 8*canvasScale, y - h/4 + 2*canvasScale);
            ctx.lineTo(x, y - h/2 - 8*canvasScale);
            ctx.lineTo(x + w/2 + 8*canvasScale, y - h/4 + 2*canvasScale);
            ctx.closePath();
            ctx.fill();
            roofTexture(ctx, 'kawara', x, y - h/3, w/2 + 10*canvasScale, h/3);
            // Roof ridge line
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = canvasScale * 1.2;
            ctx.beginPath();
            ctx.moveTo(x - 12*canvasScale, y - h/2 - 3*canvasScale);
            ctx.lineTo(x + 12*canvasScale, y - h/2 - 3*canvasScale);
            ctx.stroke();
            break;
        }

        case 'teahouse': {
            // Japanese chaya (茶屋) with noren curtains and steam
            // Back wall (warm wood)
            ctx.fillStyle = '#B09050';
            ctx.fillRect(x - w/2, y - h/4, w, h/2 + 4*canvasScale);
            // Open front (darker interior with tatami hint)
            ctx.fillStyle = '#5a4a20';
            ctx.fillRect(x - w/2 + 2*canvasScale, y - h/4 + 2*canvasScale, w - 4*canvasScale, h/3);
            // Support posts (dark wood)
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x - w/2 + 1*canvasScale, y - h/4, 3*canvasScale, h/2 + 4*canvasScale);
            ctx.fillRect(x + w/2 - 4*canvasScale, y - h/4, 3*canvasScale, h/2 + 4*canvasScale);
            ctx.fillRect(x - 1.5*canvasScale, y - h/4, 3*canvasScale, h/2 + 4*canvasScale);
            // Gable roof
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.moveTo(x - w/2 - 6*canvasScale, y - h/4);
            ctx.lineTo(x, y - h/2 - 10*canvasScale);
            ctx.lineTo(x + w/2 + 6*canvasScale, y - h/4);
            ctx.closePath();
            ctx.fill();
            roofTexture(ctx, 'kawara', x, y - h/3, w/2 + 8*canvasScale, h/3);
            break;
        }

        case 'market': {
            // Market stalls with red awnings and items
            // Counter/table
            ctx.fillStyle = '#7a5a2a';
            ctx.fillRect(x - w/2, y, w, h/4);
            // Items on counter
            ctx.fillStyle = '#d0a040';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(x - w/3 + i * w/5, y - 2*canvasScale, 2.5*canvasScale, 0, Math.PI*2);
                ctx.fill();
            }
            ctx.fillStyle = '#40a040';
            ctx.fillRect(x + w/5, y - 4*canvasScale, 6*canvasScale, 4*canvasScale);
            // Posts
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x - w/2, y - h/2, 3*canvasScale, h/2);
            ctx.fillRect(x + w/2 - 3*canvasScale, y - h/2, 3*canvasScale, h/2);
            // Red awning
            ctx.fillStyle = '#c03020';
            ctx.beginPath();
            ctx.moveTo(x - w/2 - 4*canvasScale, y - h/3);
            ctx.lineTo(x - w/2 + 3*canvasScale, y - h/2 - 2*canvasScale);
            ctx.lineTo(x + w/2 - 3*canvasScale, y - h/2 - 2*canvasScale);
            ctx.lineTo(x + w/2 + 4*canvasScale, y - h/3);
            ctx.fill();
            // Awning scallops
            ctx.fillStyle = '#a02818';
            for (let i = 0; i < 3; i++) {
                const sx = x - w/2 + 2*canvasScale + i * (w - 4*canvasScale)/2.5;
                ctx.beginPath();
                ctx.arc(sx + w/6, y - h/3 + 2*canvasScale, w/7, Math.PI, 0);
                ctx.fill();
            }
            break;
        }

        case 'well': {
            // Stone well with wooden frame and rope
            // Stone base (circular)
            ctx.fillStyle = '#7a7a6a';
            ctx.beginPath();
            ctx.ellipse(x, y + 2*canvasScale, w/3, h/5, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#5a5a4a';
            ctx.lineWidth = 2*canvasScale;
            ctx.stroke();
            // Stone wall (cylinder effect)
            ctx.fillStyle = '#8a8a7a';
            ctx.fillRect(x - w/3, y - h/4, w*2/3, h/4 + 2*canvasScale);
            ctx.strokeStyle = '#6a6a5a';
            ctx.lineWidth = canvasScale;
            // Stone rows
            for (let i = 0; i < 3; i++) {
                const sy = y - h/4 + i * h/10;
                ctx.beginPath();
                ctx.moveTo(x - w/3, sy);
                ctx.lineTo(x + w/3, sy);
                ctx.stroke();
            }
            // Top rim
            ctx.fillStyle = '#6a6a5a';
            ctx.beginPath();
            ctx.ellipse(x, y - h/4, w/3 + 2*canvasScale, h/7, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#5a5a4a';
            ctx.stroke();
            // Dark water inside
            ctx.fillStyle = '#1a3a5a';
            ctx.beginPath();
            ctx.ellipse(x, y - h/4, w/3 - 2*canvasScale, h/8, 0, 0, Math.PI*2);
            ctx.fill();
            // Wooden frame above
            ctx.fillStyle = '#6a4a2a';
            ctx.fillRect(x - w/3 - 2*canvasScale, y - h/2 - 10*canvasScale, 3*canvasScale, h/3 + 6*canvasScale);
            ctx.fillRect(x + w/3 - 1*canvasScale, y - h/2 - 10*canvasScale, 3*canvasScale, h/3 + 6*canvasScale);
            // Cross beam
            ctx.fillRect(x - w/3 - 2*canvasScale, y - h/2 - 10*canvasScale, w*2/3 + 4*canvasScale, 3*canvasScale);
            // Rope
            ctx.strokeStyle = '#8a7a5a';
            ctx.lineWidth = canvasScale;
            ctx.beginPath();
            ctx.moveTo(x, y - h/2 - 8*canvasScale);
            ctx.lineTo(x, y - h/4 - 2*canvasScale);
            ctx.stroke();
            // Bucket
            ctx.fillStyle = '#5a4a2a';
            ctx.fillRect(x - 3*canvasScale, y - h/4 - 6*canvasScale, 6*canvasScale, 5*canvasScale);
            break;
        }

        case 'bridge': {
            // Wooden bridge over river
            const bw = w, bh = h;
            const s2 = canvasScale;
            // Wooden deck (main surface, above water)
            ctx.fillStyle = '#8a6a3a';
            ctx.fillRect(x - bw/2, y - bh/3, bw, bh * 0.6);
            // Plank lines
            ctx.strokeStyle = '#6a4a2a';
            ctx.lineWidth = s2 * 0.5;
            const plankCount = 8;
            for (let i = 1; i < plankCount; i++) {
                const px = x - bw/2 + i * bw / plankCount;
                ctx.beginPath();
                ctx.moveTo(px, y - bh/3);
                ctx.lineTo(px, y - bh/3 + bh * 0.6);
                ctx.stroke();
            }
            // Support posts (visible below deck)
            ctx.fillStyle = '#6a4a20';
            const postW = 4 * s2;
            ctx.fillRect(x - bw/3 - postW/2, y - bh/3 + bh*0.5, postW, bh * 0.45);
            ctx.fillRect(x + bw/3 - postW/2, y - bh/3 + bh*0.5, postW, bh * 0.45);
            ctx.fillRect(x - postW/2, y - bh/3 + bh*0.5, postW, bh * 0.45);
            // Railings
            ctx.strokeStyle = '#7a5a2a';
            ctx.lineWidth = 2 * s2;
            ctx.beginPath();
            ctx.moveTo(x - bw/2, y - bh/3 - 2*s2);
            ctx.lineTo(x + bw/2, y - bh/3 - 2*s2);
            ctx.stroke();
            ctx.moveTo(x - bw/2, y - bh/3 + bh*0.6 + 2*s2);
            ctx.lineTo(x + bw/2, y - bh/3 + bh*0.6 + 2*s2);
            ctx.stroke();
            // Railing posts
            ctx.lineWidth = 1.5 * s2;
            for (let i = 0; i <= 4; i++) {
                const rpx = x - bw/2 + i * bw/4;
                ctx.beginPath();
                ctx.moveTo(rpx, y - bh/3 - 3*s2);
                ctx.lineTo(rpx, y - bh/3);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(rpx, y - bh/3 + bh*0.6);
                ctx.lineTo(rpx, y - bh/3 + bh*0.6 + 3*s2);
                ctx.stroke();
            }
            break;
        }

        case 'pagoda': {
            // 3-tier pagoda with upturned edges
            // Base pillar
            ctx.fillStyle = '#7a5a2a';
            ctx.fillRect(x - w/4, y - h/6, w/2, h/3 + 6*canvasScale);
            // Door
            ctx.fillStyle = '#3a2a10';
            ctx.beginPath();
            ctx.moveTo(x - 4*canvasScale, y + h/6 + 4*canvasScale);
            ctx.lineTo(x - 4*canvasScale, y);
            ctx.arc(x, y, 4*canvasScale, Math.PI, 0);
            ctx.lineTo(x + 4*canvasScale, y + h/6 + 4*canvasScale);
            ctx.fill();
            // 3 stacked roofs (trapezoids with upturned tips)
            for (let tier = 0; tier < 3; tier++) {
                const tw = w/2 - tier * w/7;
                const ty = y - h/6 - tier * h/5;
                ctx.fillStyle = tier % 2 === 0 ? '#3a3a3a' : '#4a4a4a';
                ctx.beginPath();
                ctx.moveTo(x - tw - 4*canvasScale, ty + 4*canvasScale);
                // Upturned left edge
                ctx.quadraticCurveTo(x - tw - 6*canvasScale, ty - 2*canvasScale, x - tw - 3*canvasScale, ty - 4*canvasScale);
                ctx.lineTo(x, ty - 6*canvasScale - tier*2*canvasScale);
                ctx.lineTo(x + tw + 3*canvasScale, ty - 4*canvasScale);
                // Upturned right edge
                ctx.quadraticCurveTo(x + tw + 6*canvasScale, ty - 2*canvasScale, x + tw + 4*canvasScale, ty + 4*canvasScale);
                ctx.closePath();
                ctx.fill();
                roofTexture(ctx, 'kawara', x, ty, tw + 8*canvasScale, 14*canvasScale);
                // Tier body
                ctx.fillStyle = '#8a6a30';
                ctx.fillRect(x - tw + 2*canvasScale, ty + 4*canvasScale, tw*2 - 4*canvasScale, h/6);
            }
            // Spire
            ctx.fillStyle = '#c8a030';
            ctx.beginPath();
            ctx.moveTo(x, y - h/2 - h/4 - 4*canvasScale);
            ctx.lineTo(x - 3*canvasScale, y - h/6 - 2*h/5);
            ctx.lineTo(x + 3*canvasScale, y - h/6 - 2*h/5);
            ctx.closePath();
            ctx.fill();
            break;
        }

        case 'gate':
        case 'torii': {
            // Torii gate (鳥居) — vermillion red, two pillars + two crossbars
            const pillarW = 5 * canvasScale;
            const pillarH = h * 0.85;
            // Main pillars
            ctx.fillStyle = '#c83030';
            ctx.fillRect(x - w/2, y - h/3, pillarW, pillarH);
            ctx.fillRect(x + w/2 - pillarW, y - h/3, pillarW, pillarH);
            // Top crossbar (kasagi) — extends beyond pillars, slight upward curve at ends
            ctx.fillStyle = '#b82828';
            ctx.beginPath();
            ctx.moveTo(x - w/2 - 8*canvasScale, y - h/3 + 2*canvasScale);
            ctx.quadraticCurveTo(x - w/2 - 6*canvasScale, y - h/3 - 4*canvasScale, x - w/2, y - h/3 - 2*canvasScale);
            ctx.lineTo(x + w/2, y - h/3 - 2*canvasScale);
            ctx.quadraticCurveTo(x + w/2 + 6*canvasScale, y - h/3 - 4*canvasScale, x + w/2 + 8*canvasScale, y - h/3 + 2*canvasScale);
            ctx.lineTo(x + w/2 + 8*canvasScale, y - h/3 + 5*canvasScale);
            ctx.lineTo(x - w/2 - 8*canvasScale, y - h/3 + 5*canvasScale);
            ctx.closePath();
            ctx.fill();
            // Lower crossbar (nuki) — between pillars
            ctx.fillStyle = '#c83030';
            const nukiY = y - h/3 + h * 0.2;
            ctx.fillRect(x - w/2 + pillarW, nukiY, w - pillarW * 2, 3*canvasScale);
            // Pillar caps (daiwa)
            ctx.fillStyle = '#a02020';
            ctx.fillRect(x - w/2 - 2*canvasScale, y - h/3 - 2*canvasScale, pillarW + 4*canvasScale, 3*canvasScale);
            ctx.fillRect(x + w/2 - pillarW - 2*canvasScale, y - h/3 - 2*canvasScale, pillarW + 4*canvasScale, 3*canvasScale);
            break;
        }

        case 'bamboo': {
            // 2-3 tall green bamboo stems with leaves — wind responsive
            const windStr = currentWeather === 'wind' ? weatherIntensity : 0;
            const bamSway = _swayK * Math.sin(gameTick * 0.02 + obj.x * 0.05) * (2 + windStr * 6) * canvasScale;
            const stems = [-5, 0, 5];
            for (let si = 0; si < stems.length; si++) {
                const sx = x + stems[si] * canvasScale;
                // Stem — with sway at top
                ctx.strokeStyle = '#2a7a2a';
                ctx.lineWidth = 3*canvasScale;
                ctx.beginPath();
                ctx.moveTo(sx, y + h/3);
                ctx.quadraticCurveTo(sx + bamSway * 0.3, y - h/6, sx + bamSway, y - h/2 - 5*canvasScale);
                ctx.stroke();
                // Nodes (joints)
                ctx.strokeStyle = '#1a6a1a';
                ctx.lineWidth = 4*canvasScale;
                for (let j = 0; j < 4; j++) {
                    const ny = y + h/3 - j * h/4;
                    ctx.beginPath();
                    ctx.moveTo(sx - 2*canvasScale, ny);
                    ctx.lineTo(sx + 2*canvasScale, ny);
                    ctx.stroke();
                }
                // Leaves at joints
                ctx.fillStyle = si % 2 === 0 ? '#3a8a2a' : '#4a9a3a';
                for (let j = 1; j < 4; j++) {
                    const ly = y + h/3 - j * h/4;
                    const dir = (si + j) % 2 === 0 ? 1 : -1;
                    ctx.beginPath();
                    ctx.moveTo(sx, ly);
                    ctx.quadraticCurveTo(sx + dir*8*canvasScale, ly - 4*canvasScale, sx + dir*12*canvasScale, ly - 2*canvasScale);
                    ctx.quadraticCurveTo(sx + dir*8*canvasScale, ly + 1*canvasScale, sx, ly);
                    ctx.fill();
                }
            }
            break;
        }

        case 'garden': {
            // Cultivated garden with flowering plants in rows, stone border
            // Stone border
            ctx.strokeStyle = '#7a7a6a';
            ctx.lineWidth = 2*canvasScale;
            ctx.strokeRect(x - w/2, y - h/2, w, h);
            // Soil
            ctx.fillStyle = '#5a4a2a';
            ctx.fillRect(x - w/2 + 2*canvasScale, y - h/2 + 2*canvasScale, w - 4*canvasScale, h - 4*canvasScale);
            // Corner stones
            const corners = [[-1,-1],[1,-1],[-1,1],[1,1]];
            for (const [cx,cy] of corners) {
                ctx.fillStyle = '#8a8a7a';
                ctx.beginPath();
                ctx.arc(x + cx*w/2, y + cy*h/2, 3*canvasScale, 0, Math.PI*2);
                ctx.fill();
            }
            // Rows of plants
            for (let row = 0; row < 3; row++) {
                const ry = y - h/3 + row * h/3;
                for (let col = 0; col < 4; col++) {
                    const px = x - w/3 + col * w/4;
                    // Stem
                    ctx.strokeStyle = '#3a7a2a';
                    ctx.lineWidth = canvasScale;
                    ctx.beginPath();
                    ctx.moveTo(px, ry + 4*canvasScale);
                    ctx.lineTo(px, ry - 2*canvasScale);
                    ctx.stroke();
                    // Flower
                    const fColors = ['#e84060','#e8a020','#c060e0','#e0e040'];
                    ctx.fillStyle = fColors[(row + col) % fColors.length];
                    ctx.beginPath();
                    ctx.arc(px, ry - 3*canvasScale, 2*canvasScale, 0, Math.PI*2);
                    ctx.fill();
                }
            }
            break;
        }

        case 'kitchen': {
            // Wok on stand with fire underneath + steam
            // Fire stand legs
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(x - 8*canvasScale, y + 2*canvasScale, 3*canvasScale, 10*canvasScale);
            ctx.fillRect(x + 5*canvasScale, y + 2*canvasScale, 3*canvasScale, 10*canvasScale);
            // Wok (half circle)
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.arc(x, y + 2*canvasScale, 10*canvasScale, 0, Math.PI);
            ctx.fill();
            // Wok rim
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 2*canvasScale;
            ctx.beginPath();
            ctx.moveTo(x - 12*canvasScale, y + 2*canvasScale);
            ctx.lineTo(x + 12*canvasScale, y + 2*canvasScale);
            ctx.stroke();
            // Food in wok
            ctx.fillStyle = '#8a6a2a';
            ctx.beginPath();
            ctx.ellipse(x, y + 4*canvasScale, 7*canvasScale, 3*canvasScale, 0, 0, Math.PI*2);
            ctx.fill();
            break;
        }

        case 'workshop': {
            // Desk/table with calligraphy supplies
            // Table
            ctx.fillStyle = '#6a4a2a';
            ctx.fillRect(x - w/2, y - 2*canvasScale, w, h/4);
            // Table legs
            ctx.fillRect(x - w/2 + 2*canvasScale, y + h/4 - 2*canvasScale, 3*canvasScale, h/4);
            ctx.fillRect(x + w/2 - 5*canvasScale, y + h/4 - 2*canvasScale, 3*canvasScale, h/4);
            // Paper (white rectangle)
            ctx.fillStyle = '#e8e0d0';
            ctx.fillRect(x - 8*canvasScale, y - 6*canvasScale, 12*canvasScale, 8*canvasScale);
            ctx.strokeStyle = '#c0b8a0';
            ctx.lineWidth = canvasScale * 0.5;
            ctx.strokeRect(x - 8*canvasScale, y - 6*canvasScale, 12*canvasScale, 8*canvasScale);
            // Ink marks on paper
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x - 5*canvasScale, y - 4*canvasScale, 1*canvasScale, 4*canvasScale);
            ctx.fillRect(x - 3*canvasScale, y - 3*canvasScale, 3*canvasScale, 1*canvasScale);
            // Ink stone (dark oval)
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.ellipse(x + 10*canvasScale, y - 3*canvasScale, 4*canvasScale, 3*canvasScale, 0.2, 0, Math.PI*2);
            ctx.fill();
            // Brush (thin line)
            ctx.strokeStyle = '#5a3a1a';
            ctx.lineWidth = 1.5*canvasScale;
            ctx.beginPath();
            ctx.moveTo(x - 12*canvasScale, y - 8*canvasScale);
            ctx.lineTo(x - 4*canvasScale, y - 1*canvasScale);
            ctx.stroke();
            // Brush tip
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(x - 4*canvasScale, y - 1*canvasScale, 1.2*canvasScale, 0, Math.PI*2);
            ctx.fill();
            break;
        }

        case 'fish_pond': {
            // Blue oval with lily pads and koi
            // Water
            ctx.fillStyle = '#2a5a8a';
            ctx.beginPath();
            ctx.ellipse(x, y, w/2, h/2, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#1a4a7a';
            ctx.lineWidth = 2*canvasScale;
            ctx.stroke();
            // Lily pads
            const pads = [[-8,-4],[6,-2],[-3,5]];
            for (const [px,py] of pads) {
                ctx.fillStyle = '#2a7a2a';
                ctx.beginPath();
                ctx.ellipse(x+px*canvasScale, y+py*canvasScale, 4*canvasScale, 3*canvasScale, 0.3, 0, Math.PI*2);
                ctx.fill();
                // V-notch
                ctx.strokeStyle = '#2a5a8a';
                ctx.lineWidth = canvasScale;
                ctx.beginPath();
                ctx.moveTo(x+px*canvasScale, y+py*canvasScale);
                ctx.lineTo(x+(px+3)*canvasScale, y+(py-2)*canvasScale);
                ctx.stroke();
            }
            break;
        }

        case 'shrine': {
            // Shinto shrine (神社) with shimenawa rope and offering box
            // Stone base platform (wider)
            ctx.fillStyle = '#8a8a7a';
            ctx.fillRect(x - w/3 - 4*canvasScale, y + h/6, w*2/3 + 8*canvasScale, 5*canvasScale);
            // Shrine body (warm wood, not red)
            ctx.fillStyle = '#C4A56A';
            ctx.fillRect(x - w/3, y - h/4, w*2/3, h/4 + h/6);
            // Dark interior (offering area)
            ctx.fillStyle = '#3a2a10';
            ctx.fillRect(x - w/4, y - h/6, w/2, h/4);
            // Offering box (賽銭箱 saisen-bako)
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x - 4*canvasScale, y + h/6 - 3*canvasScale, 8*canvasScale, 3*canvasScale);
            // Gable roof
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.moveTo(x - w/3 - 6*canvasScale, y - h/4 + 2*canvasScale);
            ctx.lineTo(x, y - h/3 - 6*canvasScale);
            ctx.lineTo(x + w/3 + 6*canvasScale, y - h/4 + 2*canvasScale);
            ctx.closePath();
            ctx.fill();
            roofTexture(ctx, 'kawara', x, y - h/3, w/2, h/3);
            // Chigi (千木) — crossed beams on roof ridge
            ctx.strokeStyle = '#C4A56A';
            ctx.lineWidth = canvasScale * 1.2;
            ctx.beginPath();
            ctx.moveTo(x - 3*canvasScale, y - h/3 - 2*canvasScale);
            ctx.lineTo(x - 1*canvasScale, y - h/3 - 10*canvasScale);
            ctx.moveTo(x + 3*canvasScale, y - h/3 - 2*canvasScale);
            ctx.lineTo(x + 1*canvasScale, y - h/3 - 10*canvasScale);
            ctx.stroke();
            // Shimenawa (注連縄) — sacred rope across front
            ctx.strokeStyle = '#c8b060';
            ctx.lineWidth = canvasScale * 2;
            ctx.beginPath();
            ctx.moveTo(x - w/3 + 2*canvasScale, y - h/4 + 4*canvasScale);
            ctx.quadraticCurveTo(x, y - h/4 + 8*canvasScale, x + w/3 - 2*canvasScale, y - h/4 + 4*canvasScale);
            ctx.stroke();
            // Shide (紙垂) — zigzag paper strips on shimenawa
            ctx.fillStyle = '#f0e8d8';
            for (let i = -1; i <= 1; i++) {
                const sx = x + i * 8*canvasScale;
                const sy = y - h/4 + 6*canvasScale + Math.abs(i)*2*canvasScale;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx - 1.5*canvasScale, sy + 4*canvasScale);
                ctx.lineTo(sx + 0.5*canvasScale, sy + 4*canvasScale);
                ctx.lineTo(sx - 1*canvasScale, sy + 8*canvasScale);
                ctx.lineTo(sx + 1*canvasScale, sy + 8*canvasScale);
                ctx.closePath();
                ctx.fill();
            }
            break;
        }

        case 'lantern_post': {
            // Wooden pole with red paper lantern (glowing)
            // Pole
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x - 2*canvasScale, y - h/3, 4*canvasScale, h/2 + h/4);
            // Cross arm
            ctx.fillRect(x - 1*canvasScale, y - h/3 - 2*canvasScale, 10*canvasScale, 2*canvasScale);
            // Lantern body (red oval)
            const lx = x + 8*canvasScale;
            const ly = y - h/3 + 4*canvasScale;
            ctx.fillStyle = '#c83020';
            ctx.beginPath();
            ctx.ellipse(lx, ly, 5*canvasScale, 7*canvasScale, 0, 0, Math.PI*2);
            ctx.fill();
            // Lantern top/bottom caps
            ctx.fillStyle = '#c8a030';
            ctx.fillRect(lx - 3*canvasScale, ly - 7*canvasScale, 6*canvasScale, 2*canvasScale);
            ctx.fillRect(lx - 3*canvasScale, ly + 5*canvasScale, 6*canvasScale, 2*canvasScale);
            // Lantern ribs
            ctx.strokeStyle = '#a02018';
            ctx.lineWidth = canvasScale * 0.5;
            ctx.beginPath();
            ctx.moveTo(lx, ly - 7*canvasScale);
            ctx.lineTo(lx, ly + 7*canvasScale);
            ctx.stroke();
            // Hanging string
            ctx.strokeStyle = '#8a7a5a';
            ctx.lineWidth = canvasScale;
            ctx.beginPath();
            ctx.moveTo(lx, ly - 7*canvasScale);
            ctx.lineTo(lx, y - h/3 - 1*canvasScale);
            ctx.stroke();
            // Tassel
            ctx.strokeStyle = '#c83020';
            ctx.lineWidth = canvasScale;
            ctx.beginPath();
            ctx.moveTo(lx, ly + 7*canvasScale);
            ctx.lineTo(lx, ly + 11*canvasScale);
            ctx.stroke();
            // Glow
            const lGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 16*canvasScale);
            lGrad.addColorStop(0, 'rgba(255,100,40,0.15)');
            lGrad.addColorStop(1, 'rgba(255,100,40,0)');
            ctx.fillStyle = lGrad;
            ctx.fillRect(lx - 20*canvasScale, ly - 20*canvasScale, 40*canvasScale, 40*canvasScale);
            break;
        }

        case 'rice_paddy': {
            // Green grid of rice plants in water
            // Water base
            ctx.fillStyle = '#3a6a5a';
            ctx.fillRect(x - w/2, y - h/2, w, h);
            // Water sheen
            ctx.fillStyle = 'rgba(100,180,200,0.15)';
            ctx.fillRect(x - w/2, y - h/2, w, h);
            // Grid lines (paddy borders)
            ctx.strokeStyle = '#4a5a3a';
            ctx.lineWidth = canvasScale;
            for (let i = 0; i <= 3; i++) {
                const gx = x - w/2 + i * w/3;
                ctx.beginPath();
                ctx.moveTo(gx, y - h/2);
                ctx.lineTo(gx, y + h/2);
                ctx.stroke();
            }
            for (let i = 0; i <= 3; i++) {
                const gy = y - h/2 + i * h/3;
                ctx.beginPath();
                ctx.moveTo(x - w/2, gy);
                ctx.lineTo(x + w/2, gy);
                ctx.stroke();
            }
            // Rice plants (small green tufts)
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    const px = x - w/3 + col * w/3;
                    const py = y - h/3 + row * h/3;
                    ctx.fillStyle = '#4a9a3a';
                    // Small grass-like strokes
                    ctx.strokeStyle = '#3a8a2a';
                    ctx.lineWidth = canvasScale;
                    for (let s = 0; s < 3; s++) {
                        ctx.beginPath();
                        ctx.moveTo(px + (s-1)*2*canvasScale, py + 3*canvasScale);
                        ctx.lineTo(px + (s-1)*3*canvasScale, py - 3*canvasScale);
                        ctx.stroke();
                    }
                }
            }
            break;
        }

        case 'river': {
            // River/water body
            ctx.fillStyle = '#2a5a8a';
            ctx.beginPath();
            ctx.ellipse(x, y, w/2, h/2, 0.1, 0, Math.PI * 2);
            ctx.fill();
            // Lighter inner highlight
            ctx.fillStyle = 'rgba(60,130,190,0.25)';
            ctx.beginPath();
            ctx.ellipse(x - w*0.08, y - h*0.08, w*0.32, h*0.28, 0.1, 0, Math.PI * 2);
            ctx.fill();
            // Animated ripples
            const rvt = gameTick * 0.03;
            ctx.strokeStyle = 'rgba(100,180,220,0.3)';
            ctx.lineWidth = canvasScale;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                const rx = x + Math.sin(rvt + i * 2.1) * w * 0.15;
                const ry = y + Math.cos(rvt + i * 1.7) * h * 0.15;
                ctx.ellipse(rx, ry, (4 + Math.sin(rvt+i)*1.5)*canvasScale, (1.5+Math.sin(rvt+i)*0.5)*canvasScale, 0, 0, Math.PI*2);
                ctx.stroke();
            }
            // Earthy shore edge
            ctx.strokeStyle = '#6a8a5a';
            ctx.lineWidth = 1.5*canvasScale;
            ctx.beginPath();
            ctx.ellipse(x, y, w/2 + canvasScale, h/2 + canvasScale, 0.1, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }

        case 'dock': {
            // Wooden dock — transparent so ground/water show through
            // Support posts
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x - w/3, y - h/6, 3*canvasScale, h/2);
            ctx.fillRect(x + w/3 - 3*canvasScale, y - h/6, 3*canvasScale, h/2);
            // Platform planks
            ctx.fillStyle = '#7a5a2a';
            for (let i = 0; i < 5; i++) {
                const py = y - h/3 + i * h/6;
                ctx.fillRect(x - w/2, py, w, h/7 - canvasScale);
            }
            // Plank gaps
            ctx.strokeStyle = 'rgba(40,30,15,0.3)';
            ctx.lineWidth = canvasScale * 0.5;
            for (let i = 0; i < 5; i++) {
                const py = y - h/3 + i * h/6;
                ctx.strokeRect(x - w/2, py, w, h/7 - canvasScale);
            }
            // Mooring post
            ctx.fillStyle = '#4a2a10';
            ctx.fillRect(x + w/2 - 4*canvasScale, y - h/3 - 4*canvasScale, 4*canvasScale, 8*canvasScale);
            // Rope
            ctx.strokeStyle = '#8a7a5a';
            ctx.lineWidth = canvasScale;
            ctx.beginPath();
            ctx.moveTo(x + w/2 - 2*canvasScale, y - h/3);
            ctx.quadraticCurveTo(x + w/2 + 4*canvasScale, y - h/4, x + w/2 - 2*canvasScale, y - h/6);
            ctx.stroke();
            break;
        }

        case 'lotus_pond': {
            // Blue oval with lotus flowers and lily pads
            // Water
            ctx.fillStyle = '#2a5a8a';
            ctx.beginPath();
            ctx.ellipse(x, y, w/2, h/2, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#1a4a7a';
            ctx.lineWidth = 2*canvasScale;
            ctx.stroke();
            // Lily pads
            const lpPads = [[-10,-3],[8,4],[-4,6],[10,-5]];
            for (const [px,py] of lpPads) {
                ctx.fillStyle = '#2a7a2a';
                ctx.beginPath();
                ctx.ellipse(x+px*canvasScale, y+py*canvasScale, 4*canvasScale, 3*canvasScale, 0.5, 0, Math.PI*2);
                ctx.fill();
            }
            // Lotus flowers (pink)
            const lotusPos = [[-5,-5],[7,2]];
            for (let li = 0; li < lotusPos.length; li++) {
                const [lx2, ly2] = lotusPos[li];
                const lfx = x + lx2*canvasScale;
                const lfy = y + ly2*canvasScale;
                // Petals (5 around center)
                for (let p = 0; p < 5; p++) {
                    const angle = p * Math.PI * 2 / 5 - Math.PI/2;
                    const px2 = lfx + Math.cos(angle) * 3*canvasScale;
                    const py2 = lfy + Math.sin(angle) * 3*canvasScale;
                    ctx.fillStyle = li === 0 ? '#e88090' : '#e890a0';
                    ctx.beginPath();
                    ctx.ellipse(px2, py2, 2.5*canvasScale, 1.5*canvasScale, angle, 0, Math.PI*2);
                    ctx.fill();
                }
                // Center
                ctx.fillStyle = '#e8d040';
                ctx.beginPath();
                ctx.arc(lfx, lfy, 1.5*canvasScale, 0, Math.PI*2);
                ctx.fill();
            }
            break;
        }

        case 'flower': {
            // Cluster of colorful flowers — gentle sway
            const flowerSway = _swayK * Math.sin(gameTick * 0.025 + obj.x * 0.1) * 1.5 * canvasScale;
            const flowerColors = ['#e84060','#e8a020','#c060e0','#e86040','#e0e040'];
            for (let i = 0; i < 6; i++) {
                const fx2 = x + (Math.cos(i*1.05) * 8)*canvasScale;
                const fy2 = y + (Math.sin(i*1.05) * 6)*canvasScale;
                const iSway = flowerSway * (0.5 + i * 0.1);
                // Stem
                ctx.beginPath();
                ctx.moveTo(fx2, fy2 + 6*canvasScale);
                ctx.quadraticCurveTo(fx2 + iSway * 0.5, fy2 + 3*canvasScale, fx2 + iSway, fy2);
                ctx.strokeStyle = '#3a7a2a';
                ctx.lineWidth = canvasScale;
                ctx.stroke();
                // Petals
                ctx.beginPath();
                ctx.arc(fx2 + iSway, fy2, 3*canvasScale, 0, Math.PI*2);
                ctx.fillStyle = flowerColors[i % flowerColors.length];
                ctx.fill();
                // Center
                ctx.beginPath();
                ctx.arc(fx2 + iSway, fy2, 1.2*canvasScale, 0, Math.PI*2);
                ctx.fillStyle = '#e8d040';
                ctx.fill();
            }
            break;
        }

        case 'willow': {
            // Weeping willow (柳): leaning trunk, rounded crown, a curtain of hanging strands.
            // Foliage follows the season; bare twigs in winter.
            const wWind = currentWeather === 'wind' ? weatherIntensity : 0;
            const wSway = _swayK * Math.sin(gameTick * 0.02 + obj.x * 0.03) * (3 + wWind * 8) * canvasScale;
            const sc = canvasScale;
            const leaf = { spring: ['#a6cf6c', '#79ad50', '#c8e290'], summer: ['#5d9a43', '#3f7c34', '#7cb35a'],
                           autumn: ['#c4b04c', '#a0923c', '#ddc868'], winter: null }[getSeason()];
            // Trunk with root flare
            ctx.fillStyle = '#4a3322';
            ctx.beginPath();
            ctx.moveTo(x - 6*sc, y + 20*sc);
            ctx.quadraticCurveTo(x - 3*sc, y + 14*sc, x - 3.5*sc, y - 4*sc);
            ctx.lineTo(x - 1*sc, y - 14*sc);
            ctx.lineTo(x + 2.5*sc, y - 14*sc);
            ctx.quadraticCurveTo(x + 3*sc, y + 2*sc, x + 4*sc, y + 14*sc);
            ctx.quadraticCurveTo(x + 5*sc, y + 18*sc, x + 7*sc, y + 20*sc);
            ctx.closePath();
            ctx.fill();
            // Limbs
            ctx.strokeStyle = '#4a3322';
            ctx.lineCap = 'round';
            ctx.lineWidth = 2*sc;
            ctx.beginPath();
            for (const [ex, ey] of [[-13, -18], [12, -19], [-4, -24], [5, -25]]) {
                ctx.moveTo(x, y - 10*sc);
                ctx.quadraticCurveTo(x + ex*0.3*sc, y + (ey + 4)*sc, x + ex*sc + wSway*0.2, y + ey*sc);
            }
            ctx.stroke();
            const strands = 26;
            if (!leaf) {
                ctx.strokeStyle = '#6e5c42';
                ctx.lineWidth = 0.6*sc;
                ctx.beginPath();
                for (let i = 0; i < strands; i++) {
                    const t = i / (strands - 1), a2 = -1.25 + t * 2.5;
                    const sx = x + Math.sin(a2) * 15*sc, sy = y - 22*sc + Math.abs(Math.sin(a2)) * 7*sc;
                    const len = (15 + (i * 7) % 10) * sc;
                    ctx.moveTo(sx, sy);
                    ctx.quadraticCurveTo(sx + Math.sin(a2) * 4*sc + wSway*0.5, sy + len*0.5, sx + Math.sin(a2) * 5*sc + wSway, sy + len);
                }
                ctx.stroke();
                break;
            }
            // Crown mass
            ctx.fillStyle = leaf[1];
            for (const [cx2, cy2, rx2, ry2] of [[0, -19, 17, 9], [-10, -15, 10, 7], [10, -15, 10, 7]]) {
                ctx.beginPath();
                ctx.ellipse(x + cx2*sc + wSway*0.2, y + cy2*sc, rx2*sc, ry2*sc, 0, 0, Math.PI*2);
                ctx.fill();
            }
            // Hanging strands — back layer darker, front layer lighter
            ctx.lineCap = 'round';
            for (let layer = 0; layer < 2; layer++) {
                for (let i = layer; i < strands; i += 2) {
                    const t = i / (strands - 1), a2 = -1.3 + t * 2.6;
                    const sx = x + Math.sin(a2) * 16*sc, sy = y - 20*sc + Math.abs(Math.sin(a2)) * 6*sc;
                    const len = (14 + (i * 7) % 11 - layer * 2) * sc;
                    ctx.strokeStyle = layer === 0 ? leaf[1] : leaf[i % 3 === 0 ? 2 : 0];
                    ctx.lineWidth = (layer === 0 ? 2.4 : 1.7) * sc;
                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    ctx.quadraticCurveTo(sx + Math.sin(a2) * 4*sc + wSway*0.5, sy + len*0.55, sx + Math.sin(a2) * 5.5*sc + wSway, sy + len);
                    ctx.stroke();
                }
            }
            // Sunlit dabs on the upper left of the crown
            ctx.fillStyle = leaf[2];
            for (const [dx2, dy2] of [[-8, -23], [-2, -25], [-12, -19], [3, -22], [-5, -20]]) {
                ctx.beginPath();
                ctx.ellipse(x + dx2*sc, y + dy2*sc, 2.6*sc, 1.4*sc, -0.4, 0, Math.PI*2);
                ctx.fill();
            }
            break;
        }

        case 'school': {
            // Open-air school with teaching platform and mat seats
            // Platform base
            ctx.fillStyle = '#7a7a6a';
            ctx.fillRect(x - w/2, y + h/6, w, h/5);
            // Wooden walls (low, open front)
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(x - w/2 + 2*canvasScale, y - h/4, w - 4*canvasScale, h/3);
            // Open front (dark interior)
            ctx.fillStyle = '#4a3a10';
            ctx.fillRect(x - w/2 + 4*canvasScale, y - h/4 + 2*canvasScale, w - 8*canvasScale, h/4);
            // Support posts
            ctx.fillStyle = '#6a4a1a';
            ctx.fillRect(x - w/2 + 1*canvasScale, y - h/4, 3*canvasScale, h/3 + h/5);
            ctx.fillRect(x + w/2 - 4*canvasScale, y - h/4, 3*canvasScale, h/3 + h/5);
            ctx.fillRect(x - 1.5*canvasScale, y - h/4, 3*canvasScale, h/3 + h/5);
            // Curved tiled roof
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.moveTo(x - w/2 - 5*canvasScale, y - h/4 + 2*canvasScale);
            ctx.quadraticCurveTo(x, y - h/2 - 8*canvasScale, x + w/2 + 5*canvasScale, y - h/4 + 2*canvasScale);
            ctx.fill();
            roofTexture(ctx, 'kawara', x, y - h/3, w/2 + 7*canvasScale, h/3);
            // Signboard with character
            ctx.fillStyle = '#c8a030';
            ctx.fillRect(x - 6*canvasScale, y - h/4 + 4*canvasScale, 12*canvasScale, 8*canvasScale);
            ctx.fillStyle = '#1a1a1a';
            ctx.font = `${Math.round(6*canvasScale)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('学', x, y - h/4 + 10*canvasScale);
            // Mat seats (small rectangles)
            ctx.fillStyle = '#8a6a3a';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(x - w/3 + i * w/4, y + h/6 + 2*canvasScale, 6*canvasScale, 4*canvasScale);
            }
            break;
        }

        case 'medicine_hut': {
            // Thatched-roof hut with hanging herbs
            // Walls
            ctx.fillStyle = '#7a6a4a';
            ctx.fillRect(x - w/2 + 2*canvasScale, y - h/6, w - 4*canvasScale, h/3 + 4*canvasScale);
            // Door
            ctx.fillStyle = '#4a3a20';
            ctx.fillRect(x - 3*canvasScale, y - h/8, 6*canvasScale, h/4 + 2*canvasScale);
            // Thatched roof (golden-brown, thicker)
            ctx.fillStyle = '#9a8a3a';
            ctx.beginPath();
            ctx.moveTo(x - w/2 - 6*canvasScale, y - h/6 + 2*canvasScale);
            ctx.lineTo(x, y - h/2 - 6*canvasScale);
            ctx.lineTo(x + w/2 + 6*canvasScale, y - h/6 + 2*canvasScale);
            ctx.closePath();
            ctx.fill();
            roofTexture(ctx, 'thatch', x, y - h/3, w/2 + 8*canvasScale, h/3);
            // Thatch texture lines
            ctx.strokeStyle = '#8a7a30';
            ctx.lineWidth = canvasScale * 0.7;
            for (let i = 0; i < 4; i++) {
                const ty = y - h/6 + 2*canvasScale - i * h/8;
                const spread = w/2 + 6*canvasScale - i * 8*canvasScale;
                ctx.beginPath();
                ctx.moveTo(x - spread, ty + i*2*canvasScale);
                ctx.lineTo(x + spread, ty + i*2*canvasScale);
                ctx.stroke();
            }
            // Hanging herb bundles (from eaves)
            const herbColors = ['#3a7a2a','#6a8a3a','#4a6a2a'];
            for (let i = 0; i < 3; i++) {
                const hx = x - w/3 + i * w/3;
                const hy = y - h/6 + 4*canvasScale;
                // String
                ctx.strokeStyle = '#8a7a5a';
                ctx.lineWidth = canvasScale * 0.5;
                ctx.beginPath();
                ctx.moveTo(hx, y - h/6);
                ctx.lineTo(hx, hy + 6*canvasScale);
                ctx.stroke();
                // Herb bundle
                ctx.fillStyle = herbColors[i];
                ctx.beginPath();
                ctx.ellipse(hx, hy + 4*canvasScale, 3*canvasScale, 5*canvasScale, 0, 0, Math.PI*2);
                ctx.fill();
            }
            // Mortar and pestle (side)
            ctx.fillStyle = '#6a6a5a';
            ctx.beginPath();
            ctx.arc(x + w/3, y + h/6, 4*canvasScale, 0, Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#5a3a1a';
            ctx.lineWidth = 1.5*canvasScale;
            ctx.beginPath();
            ctx.moveTo(x + w/3 + 2*canvasScale, y + h/6 - 6*canvasScale);
            ctx.lineTo(x + w/3, y + h/6 - 1*canvasScale);
            ctx.stroke();
            break;
        }

        case 'stable': {
            // Lean-to wooden stable with fence
            // Back wall
            ctx.fillStyle = '#7a5a2a';
            ctx.fillRect(x - w/2, y - h/4, w, h/3);
            // Support beams
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x - w/2, y - h/4, 3*canvasScale, h/2 + 4*canvasScale);
            ctx.fillRect(x + w/2 - 3*canvasScale, y - h/4, 3*canvasScale, h/2 + 4*canvasScale);
            // Slanted roof (lean-to)
            ctx.fillStyle = '#8a7a3a';
            ctx.beginPath();
            ctx.moveTo(x - w/2 - 4*canvasScale, y - h/4 - 2*canvasScale);
            ctx.lineTo(x + w/2 + 4*canvasScale, y - h/4 + 4*canvasScale);
            ctx.lineTo(x + w/2 + 4*canvasScale, y - h/4 - 2*canvasScale);
            ctx.lineTo(x - w/2 - 4*canvasScale, y - h/4 - 8*canvasScale);
            ctx.closePath();
            ctx.fill();
            roofTexture(ctx, 'plank', x, y - h/4, w/2 + 6*canvasScale, 8*canvasScale);
            // Fence rails
            ctx.strokeStyle = '#6a4a2a';
            ctx.lineWidth = 2*canvasScale;
            ctx.beginPath();
            ctx.moveTo(x - w/2, y + h/6);
            ctx.lineTo(x + w/2, y + h/6);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - w/2, y);
            ctx.lineTo(x + w/2, y);
            ctx.stroke();
            // Fence posts
            ctx.fillStyle = '#5a3a1a';
            for (let i = 0; i <= 3; i++) {
                ctx.fillRect(x - w/2 + i * w/3 - 1.5*canvasScale, y - 2*canvasScale, 3*canvasScale, h/4 + 2*canvasScale);
            }
            // Hay bale
            ctx.fillStyle = '#c8a840';
            ctx.fillRect(x + w/4, y + h/8, 8*canvasScale, 6*canvasScale);
            ctx.strokeStyle = '#a88a30';
            ctx.lineWidth = canvasScale * 0.5;
            ctx.strokeRect(x + w/4, y + h/8, 8*canvasScale, 6*canvasScale);
            break;
        }

        case 'tea_terrace': {
            // Flat bamboo trays on wooden frames for drying tea
            // Wooden frame base
            ctx.fillStyle = '#6a4a2a';
            ctx.fillRect(x - w/2, y + h/6, w, 3*canvasScale);
            // Frame legs
            ctx.fillRect(x - w/2 + 2*canvasScale, y + h/6, 2*canvasScale, h/4);
            ctx.fillRect(x + w/2 - 4*canvasScale, y + h/6, 2*canvasScale, h/4);
            ctx.fillRect(x - 1*canvasScale, y + h/6, 2*canvasScale, h/4);
            // Bamboo drying trays (3 round trays)
            for (let i = 0; i < 3; i++) {
                const tx = x - w/3 + i * w/3;
                const ty = y + h/6 - 1*canvasScale;
                // Tray (light bamboo color)
                ctx.fillStyle = '#c8b870';
                ctx.beginPath();
                ctx.ellipse(tx, ty, 7*canvasScale, 4*canvasScale, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.strokeStyle = '#a89850';
                ctx.lineWidth = canvasScale * 0.5;
                ctx.stroke();
                // Tea leaves on tray (small dark green dots)
                ctx.fillStyle = '#3a6a2a';
                for (let j = 0; j < 5; j++) {
                    const lx = tx + (Math.cos(j*1.3 + i)*4)*canvasScale;
                    const ly = ty + (Math.sin(j*1.3 + i)*2)*canvasScale;
                    ctx.fillRect(lx, ly, 2*canvasScale, 1*canvasScale);
                }
            }
            // Simple canopy poles
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x - w/2 + 2*canvasScale, y - h/3, 2*canvasScale, h/2);
            ctx.fillRect(x + w/2 - 4*canvasScale, y - h/3, 2*canvasScale, h/2);
            // Canopy beam
            ctx.fillRect(x - w/2 + 2*canvasScale, y - h/3, w - 4*canvasScale, 2*canvasScale);
            // Cloth cover (partial shade)
            ctx.fillStyle = 'rgba(160,140,100,0.3)';
            ctx.fillRect(x - w/2 + 4*canvasScale, y - h/3 + 2*canvasScale, w/2, h/4);
            break;
        }

        case 'viewpoint': {
            // Stone platform with flat rocks overlooking the river
            // Large flat stone base
            ctx.fillStyle = '#7a7a6a';
            ctx.beginPath();
            ctx.moveTo(x - w/2, y + h/4);
            ctx.lineTo(x - w/2 + 4*canvasScale, y - h/6);
            ctx.lineTo(x + w/2 - 4*canvasScale, y - h/6);
            ctx.lineTo(x + w/2, y + h/4);
            ctx.closePath();
            ctx.fill();
            // Stone texture
            ctx.strokeStyle = '#6a6a5a';
            ctx.lineWidth = canvasScale * 0.5;
            ctx.beginPath();
            ctx.moveTo(x - w/4, y);
            ctx.lineTo(x + w/4, y - 2*canvasScale);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - w/3, y + h/8);
            ctx.lineTo(x + w/6, y + h/10);
            ctx.stroke();
            // Seat stone (smaller, on top)
            ctx.fillStyle = '#8a8a7a';
            ctx.beginPath();
            ctx.ellipse(x - w/6, y - h/8, 6*canvasScale, 3*canvasScale, 0.1, 0, Math.PI*2);
            ctx.fill();
            // Small cypress tree beside
            ctx.fillStyle = '#2a5a2a';
            ctx.beginPath();
            ctx.moveTo(x + w/3, y - h/6);
            ctx.lineTo(x + w/3 - 4*canvasScale, y + h/6);
            ctx.lineTo(x + w/3 + 4*canvasScale, y + h/6);
            ctx.closePath();
            ctx.fill();
            // Trunk
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(x + w/3 - 1.5*canvasScale, y + h/6, 3*canvasScale, h/6);
            break;
        }
    }

}

// Animated details, drawn live around the cached sprite: 'under' sits beneath it, 'over' on top
function drawObjectAnim(ctx, obj, layer) {
    const x = obj.x * canvasScale;
    const y = obj.y * canvasScale;
    const w = obj.w * canvasScale;
    const h = obj.h * canvasScale;
    switch (obj.type) {
        case 'house':
            if (layer !== 'over') break;
            // Chimney smoke (not during rain)
            if (currentWeather !== 'rain') {
                ctx.save();
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = '#b0a890';
                const smokeT = gameTick * 0.02;
                for (let si = 0; si < 3; si++) {
                    const sx = x + w/4 + Math.sin(smokeT + si * 2) * 3 * canvasScale;
                    const sy = y - h/2 - 10*canvasScale - si * 8 * canvasScale;
                    const sr = (2 + si * 1.5) * canvasScale;
                    ctx.globalAlpha = 0.15 - si * 0.04;
                    ctx.beginPath();
                    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
            break;
        case 'teahouse': {
            if (layer !== 'over') break;
            // Noren curtains (暖簾) — hanging fabric strips, navy blue with white circle
            const norenSway = Math.sin(gameTick * 0.025) * 1.5 * canvasScale;
            const norenW = (w - 10*canvasScale) / 4;
            ctx.fillStyle = '#2a3a6a';
            for (let i = 0; i < 4; i++) {
                const nx = x - w/2 + 4*canvasScale + i * (norenW + 1*canvasScale);
                const sway = Math.sin(gameTick * 0.025 + i * 0.8) * 1.5 * canvasScale;
                ctx.beginPath();
                ctx.moveTo(nx, y - h/4 + 2*canvasScale);
                ctx.lineTo(nx + norenW, y - h/4 + 2*canvasScale);
                ctx.lineTo(nx + norenW + sway, y - h/4 + h/3 - 2*canvasScale);
                ctx.lineTo(nx + sway, y - h/4 + h/3 - 2*canvasScale);
                ctx.closePath();
                ctx.fill();
            }
            // White circle on center noren (mon crest)
            ctx.fillStyle = 'rgba(240,235,220,0.7)';
            ctx.beginPath();
            ctx.arc(x, y - h/4 + h/6, 4*canvasScale, 0, Math.PI*2);
            ctx.fill();
            // Steam wisps rising from teahouse (animated)
            const st = gameTick * 0.03;
            for (let i = 0; i < 3; i++) {
                const sx = x + (i - 1) * 5 * canvasScale;
                const rise = (st + i * 2.5) % 6;
                const fadeAlpha = rise < 1 ? rise * 0.25 : Math.max(0, 0.25 - (rise - 1) * 0.06);
                if (fadeAlpha <= 0) continue;
                ctx.globalAlpha = fadeAlpha;
                ctx.fillStyle = '#e8e4e0';
                const wy = y - h/3 - (6 + rise * 5) * canvasScale;
                const wobble = Math.sin(st * 2 + i * 1.8) * 3 * canvasScale;
                ctx.beginPath();
                ctx.ellipse(sx + wobble, wy, (2.5 + rise * 0.4) * canvasScale, (1.5 + rise * 0.3) * canvasScale, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
            break;
        }
        case 'kitchen': {
            const kt = gameTick * 0.06;
            if (layer === 'under') {
                // Fire underneath (animated)
                for (let i = 0; i < 4; i++) {
                    const fx = x + Math.sin(kt + i * 1.5) * 4 * canvasScale;
                    const fy = y + 6*canvasScale - Math.sin(kt * 1.3 + i) * 2 * canvasScale;
                    ctx.beginPath();
                    ctx.arc(fx, fy, (3 + Math.sin(kt + i)*1)*canvasScale, 0, Math.PI*2);
                    ctx.fillStyle = i < 2 ? '#e8a020' : '#e85020';
                    ctx.fill();
                }
                // Glow
                const kGrad = ctx.createRadialGradient(x, y + 6*canvasScale, 0, x, y + 6*canvasScale, 14*canvasScale);
                kGrad.addColorStop(0, 'rgba(255,160,40,0.12)');
                kGrad.addColorStop(1, 'rgba(255,160,40,0)');
                ctx.fillStyle = kGrad;
                ctx.fillRect(x - 16*canvasScale, y - 4*canvasScale, 32*canvasScale, 24*canvasScale);
            } else {
                // Steam puffs rising from wok (animated)
                for (let i = 0; i < 3; i++) {
                    const sx = x + (i - 1) * 4 * canvasScale;
                    const rise = (kt * 0.5 + i * 2.5) % 6;
                    const fadeAlpha = rise < 1 ? rise * 0.25 : Math.max(0, 0.25 - (rise - 1) * 0.06);
                    if (fadeAlpha <= 0) continue;
                    ctx.globalAlpha = fadeAlpha;
                    ctx.fillStyle = '#e8e4e0';
                    const wy = y - (6 + rise * 5) * canvasScale;
                    const wobble = Math.sin(kt + i * 1.8) * 3 * canvasScale;
                    ctx.beginPath();
                    ctx.ellipse(sx + wobble, wy, (2.5 + rise * 0.4) * canvasScale, (1.5 + rise * 0.3) * canvasScale, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1.0;
            }
            break;
        }
        case 'fish_pond': {
            if (layer !== 'over') break;
            // Ripples (animated)
            const fpt = gameTick * 0.03;
            ctx.strokeStyle = 'rgba(100,180,220,0.3)';
            ctx.lineWidth = canvasScale;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                const rx = x + Math.cos(fpt + i*3) * w/5;
                const ry = y + Math.sin(fpt + i*3) * h/5;
                ctx.ellipse(rx, ry, 4*canvasScale, 2*canvasScale, 0, 0, Math.PI*2);
                ctx.stroke();
            }
            // Koi fish (natural lazy swimming)
            const koiColors = ['#e86030','#e8c040'];
            for (let i = 0; i < 2; i++) {
                // Figure-8 with varying speed and drift
                const t1 = fpt * (0.35 + i * 0.12);
                const t2 = fpt * (0.23 + i * 0.09);
                const kx = x + Math.cos(t1 + i * 2.1) * w * 0.28
                          + Math.sin(t2 * 0.7 + i) * w * 0.08;
                const ky = y + Math.sin(t1 * 0.8 + i * 1.7) * h * 0.25
                          + Math.cos(t2 * 0.5 + i * 0.9) * h * 0.06;
                // Facing direction from movement delta
                const prevX = x + Math.cos((t1 - 0.05) + i * 2.1) * w * 0.28
                            + Math.sin(((t2 - 0.05) * 0.7) + i) * w * 0.08;
                const prevY = y + Math.sin(((t1 - 0.05) * 0.8) + i * 1.7) * h * 0.25
                            + Math.cos(((t2 - 0.05) * 0.5) + i * 0.9) * h * 0.06;
                const kAngle = Math.atan2(ky - prevY, kx - prevX);
                ctx.save();
                ctx.translate(kx, ky);
                ctx.rotate(kAngle + Math.PI / 2);
                ctx.fillStyle = koiColors[i];
                // Body
                ctx.beginPath();
                ctx.moveTo(0, -4*canvasScale);
                ctx.quadraticCurveTo(3*canvasScale, 0, 0, 4*canvasScale);
                ctx.quadraticCurveTo(-2*canvasScale, 0, 0, -4*canvasScale);
                ctx.fill();
                // Tail (wags)
                const tailWag = Math.sin(fpt * 3 + i * 2) * 1.5 * canvasScale;
                ctx.beginPath();
                ctx.moveTo(0, 3*canvasScale);
                ctx.lineTo(-2*canvasScale + tailWag, 6*canvasScale);
                ctx.lineTo(2*canvasScale + tailWag, 6*canvasScale);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            break;
        }
        case 'shrine':
            if (layer !== 'over') break;
            // Incense smoke (animated)
            const it = gameTick * 0.04;
            ctx.strokeStyle = 'rgba(180,180,180,0.25)';
            ctx.lineWidth = canvasScale;
            for (let i = 0; i < 2; i++) {
                const ix = x + (i*4 - 2)*canvasScale;
                const sOff = Math.sin(it + i*2) * 2*canvasScale;
                ctx.beginPath();
                ctx.moveTo(ix, y - h/3 - 6*canvasScale);
                ctx.quadraticCurveTo(ix + sOff, y - h/3 - 12*canvasScale, ix - sOff, y - h/3 - 18*canvasScale);
                ctx.stroke();
            }
            break;
        case 'lotus_pond':
            if (layer !== 'over') break;
            // Ripples
            const lpt = gameTick * 0.025;
            ctx.strokeStyle = 'rgba(100,180,220,0.25)';
            ctx.lineWidth = canvasScale;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.ellipse(x + Math.sin(lpt+i*2)*6*canvasScale, y + Math.cos(lpt+i*2)*3*canvasScale, 5*canvasScale, 2*canvasScale, 0, 0, Math.PI*2);
                ctx.stroke();
            }
            break;
    }
}

function drawObject(ctx, obj) {
    const x = obj.x * canvasScale;
    const y = obj.y * canvasScale;
    const w = obj.w * canvasScale;
    const h = obj.h * canvasScale;

    drawObjectAnim(ctx, obj, 'under');
    drawObjectSprite(ctx, obj);
    drawObjectAnim(ctx, obj, 'over');

    // Window glow at night
    const nightF = gradeAt(gameHour + gameMinute / 60).night;
    if (nightF > 0.05 && (obj.type === 'house' || obj.type === 'teahouse' || obj.type === 'school')) {
        const glowA = 0.6 * nightF;
        ctx.fillStyle = `rgba(255,196,110,${glowA})`;
        if (obj.type === 'house') {
            // Door glow
            ctx.fillRect(x - 4*canvasScale, y - h/4 + 6*canvasScale, 8*canvasScale, h/2 - 2*canvasScale);
        } else if (obj.type === 'teahouse') {
            // Open front interior glow
            ctx.fillRect(x - w/2 + 4*canvasScale, y - h/4 + 2*canvasScale, w - 8*canvasScale, h/3);
        } else if (obj.type === 'school') {
            // Window glow
            ctx.fillRect(x - w/4, y - h/4 + 4*canvasScale, w/2, h/4);
        }
    }

    // Snow accumulation on rooftops
    if (currentWeather === 'snow' && weatherIntensity > 0.3 && BUILDING_TYPES.includes(obj.type)) {
        ctx.fillStyle = `rgba(240,240,250,${weatherIntensity * 0.5})`;
        const snowY = y - h/4 - (obj.type === 'pagoda' ? h/3 : h/8);
        const snowW = w * 0.8;
        ctx.beginPath();
        ctx.ellipse(x, snowY, snowW / 2, 2.5 * canvasScale, 0, Math.PI, 0);
        ctx.fill();
    }

    // Place tag just below the object's drawn bottom (taken from its sprite, so it never sits
    // inside a pond, bed or tree); it lights up while the speaker uses the object
    const spr = getObjectSprite(obj);
    const drawnBottom = spr ? spr.oy + spr.h : (VISUAL_BOTTOM[obj.type] !== undefined ? VISUAL_BOTTOM[obj.type] : obj.h/2);
    const tagY = y + (drawnBottom + 7.5) * canvasScale;
    if (activeObjectGlow && activeObjectGlow.objId === obj.id) {
        const glowAlpha = Math.min(1, activeObjectGlow.timer / 30);
        const pulse = 0.75 + Math.sin(gameTick * 0.08) * 0.25;
        drawTag(ctx, obj.label, x, tagY, PLACE_TAG_ACTIVE, glowAlpha * pulse + (1 - glowAlpha) * 0.9);
        if (obj.romaji) drawTag(ctx, obj.romaji, x, tagY + 12 * canvasScale, ROMAJI_TAG, glowAlpha);
    } else {
        drawTag(ctx, obj.label, x, tagY, PLACE_TAG);
    }
}

// Small paper tags for place labels and names
// Translucent ink tags with warm light text: calm against the ground, no glare
const PLACE_TAG = { font: `600 9.5px ${FONT_MINCHO}`, h: 12, bg: 'rgba(36,30,24,0.52)', border: null, fg: '#efe3c8', accent: 'rgba(200,68,47,0.85)' };
const PLACE_TAG_ACTIVE = { font: `700 10.5px ${FONT_MINCHO}`, h: 13.5, bg: 'rgba(58,42,16,0.82)', border: 'rgba(201,154,58,0.9)', fg: '#ffe6a8', accent: '#c99a3a', glow: true };
const ROMAJI_TAG = { font: `500 8px ${FONT_UI}`, h: 10, bg: 'rgba(43,38,34,0.75)', border: null, fg: '#f3ead8' };
const NAME_TAG = {
    speaker:  { font: `700 8.5px ${FONT_UI}`, h: 11, bg: 'rgba(46,74,107,0.92)', border: 'rgba(20,30,48,0.8)', fg: '#f6efe0' },
    learner:  { font: `700 8.5px ${FONT_UI}`, h: 11, bg: 'rgba(168,58,40,0.92)', border: 'rgba(70,20,12,0.8)', fg: '#f6efe0' },
    villager: { font: `700 8px ${FONT_UI}`,   h: 10, bg: 'rgba(43,38,34,0.55)',  border: null, fg: '#f3ead8' },
};
// Draws `text` on a tag centred at (cx, cy) in canvas pixels; sizes in the style are world units
let _tagQueue = null;     // while non-null, tags are queued instead of drawn (see game loop)
const _tagWidths = new Map();   // measured text widths; cleared when web fonts arrive (metrics change)
if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => _tagWidths.clear());
function drawTag(ctx, text, cx, cy, st, alpha) {
    if (!text) return;
    if (_tagQueue) { _tagQueue.push([text, cx, cy, st, alpha]); return; }
    const s = canvasScale;
    if (st._s !== s) {                          // scaled font string, rebuilt only when the zoom changes
        st._s = s;
        st._font = st.font.replace(/[\d.]+px/, (parseFloat(st.font.match(/([\d.]+)px/)[1]) * s).toFixed(1) + 'px');
    }
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.font = st._font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mk = st._font + '\u0000' + text;
    let tw = _tagWidths.get(mk);
    if (tw === undefined) {
        tw = ctx.measureText(text).width;
        if (_tagWidths.size > 3000) _tagWidths.clear();
        _tagWidths.set(mk, tw);
    }
    const accentW = st.accent ? 1.6 * s : 0;
    const w = tw + 7 * s + accentW, hh = st.h * s;
    const x0 = cx - w / 2, y0 = cy - hh / 2;
    if (st.glow) { ctx.shadowColor = 'rgba(201,154,58,0.8)'; ctx.shadowBlur = 8 * s * dpr; }
    ctx.fillStyle = st.bg;
    roundRect(ctx, x0, y0, w, hh, 2 * s);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    if (st.border) { ctx.strokeStyle = st.border; ctx.lineWidth = 0.6 * s; ctx.stroke(); }
    if (st.accent) { ctx.fillStyle = st.accent; ctx.fillRect(x0 + 1 * s, y0 + 2 * s, accentW, hh - 4 * s); }
    ctx.fillStyle = st.fg;
    ctx.fillText(text, cx + accentW / 2 + 0.5 * s, cy + 0.6 * s);
    ctx.restore();
}

// Per-person look, derived from the name so it's stable across frames and reloads
const KIMONO_PATTERNS = ['stripes', 'dots', 'checks', 'waves', 'plain'];
const OBI_COLORS = ['#c8442f', '#c99a3a', '#6f93b5', '#e6d8bb', '#5f8a4f', '#8a3b5a'];
function personLook(person) {
    if (person._look) return person._look;
    let hsh = 7;
    for (const ch of person.name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    person._look = person.role === 'learner'
        ? { pattern: 'plain', obi: '#5a3e24' }
        : { pattern: KIMONO_PATTERNS[hsh % KIMONO_PATTERNS.length], obi: OBI_COLORS[(hsh >> 3) % OBI_COLORS.length] };
    return person._look;
}
// Pattern inside the current robe path (caller has built the path); colours derive from the cloth
function kimonoPattern(ctx, kind, cx, cy, rx, ry, s) {
    if (kind === 'plain') return;
    ctx.save();
    ctx.clip();
    const light = 'rgba(255,248,232,0.30)', dark = 'rgba(20,18,30,0.22)';
    if (kind === 'stripes') {
        ctx.fillStyle = light;
        for (let x = cx - rx; x < cx + rx; x += 2.6 * s) ctx.fillRect(x, cy - ry, 0.9 * s, ry * 2);
    } else if (kind === 'dots') {
        ctx.fillStyle = light;
        let row = 0;
        for (let y = cy - ry; y < cy + ry; y += 3 * s, row++) {
            for (let x = cx - rx + (row % 2) * 1.5 * s; x < cx + rx; x += 3 * s) {
                ctx.beginPath(); ctx.arc(x, y, 0.65 * s, 0, Math.PI * 2); ctx.fill();
            }
        }
    } else if (kind === 'checks') {
        ctx.fillStyle = dark;
        const q = 3.2 * s;
        for (let y = cy - ry, r = 0; y < cy + ry; y += q, r++)
            for (let x = cx - rx + (r % 2) * q, c = 0; x < cx + rx; x += q * 2, c++) ctx.fillRect(x, y, q, q);
    } else if (kind === 'waves') {      // seigaiha-like arcs
        ctx.strokeStyle = light;
        ctx.lineWidth = 0.5 * s;
        let row = 0;
        for (let y = cy - ry; y < cy + ry + 3 * s; y += 2.4 * s, row++) {
            for (let x = cx - rx + (row % 2) * 2 * s; x < cx + rx + 3 * s; x += 4 * s) {
                ctx.beginPath(); ctx.arc(x, y, 2 * s, Math.PI, 0); ctx.stroke();
            }
        }
    }
    ctx.restore();
}

function drawPerson(ctx, person) {
    const x = person.x * canvasScale;
    const y = person.y * canvasScale;
    const s = canvasScale;
    const facing = person.facing;
    const isMoving = person.state === 'moving' || (person.state === 'idle' && person.distTo(person.targetX, person.targetY) > 5);
    const walkCycle = isMoving ? Math.sin(gameTick * 0.15) : 0;
    const skin = person.skinTone;
    const cloth = person.clothColor;
    const isLearner = person.role === 'learner';
    const isSleeping = person.state === 'acting' && person.currentAction &&
        (person.currentAction.id === 'sleep_house' || person.currentAction.id === 'sleep_self');
    const isActing = person.state === 'acting' && person.currentAction && !isSleeping;
    const actionId = (person.currentAction && person.currentAction.id) || '';

    // Breathing animation (idle only)
    const breathPhase = Math.sin(gameTick * 0.04 + person.x * 0.1);
    const breathOff = isMoving ? 0 : breathPhase * 0.3 * s;
    // Idle fidget — subtle weight shift every few seconds
    const fidgetPhase = Math.sin(gameTick * 0.008 + person.y * 0.2);
    const fidgetX = (!isMoving && !isSleeping) ? fidgetPhase * 0.5 * s : 0;
    // Head bob when walking
    const headBob = isMoving ? Math.abs(Math.sin(gameTick * 0.30)) * 0.8 * s : breathOff * 0.5;
    // Body lean when walking
    const leanX = isMoving ? Math.cos(facing) * 1.0 * s : fidgetX;
    const leanY = isMoving ? Math.sin(facing) * 1.0 * s : 0;

    ctx.save();
    ctx.translate(x, y);

    // Feet / cloth shoes
    const legSpread = 4 * s;
    const leftLegOff = walkCycle * 3 * s;
    const rightLegOff = -walkCycle * 3 * s;
    ctx.fillStyle = isLearner ? '#4a3020' : '#2a2a2a';
    // Left foot
    ctx.save();
    ctx.translate(Math.cos(facing + 1.8) * legSpread, Math.sin(facing + 1.8) * legSpread);
    ctx.beginPath();
    ctx.ellipse(Math.cos(facing) * leftLegOff, Math.sin(facing) * leftLegOff, 3*s, 2.5*s, facing, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    // Right foot
    ctx.save();
    ctx.translate(Math.cos(facing - 1.8) * legSpread, Math.sin(facing - 1.8) * legSpread);
    ctx.beginPath();
    ctx.ellipse(Math.cos(facing) * rightLegOff, Math.sin(facing) * rightLegOff, 3*s, 2.5*s, facing, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Body / robe (longer for Song Dynasty) — with breathing
    const look = personLook(person);
    ctx.beginPath();
    ctx.ellipse(leanX, -2*s + leanY, 9*s, 12*s + breathOff, 0, 0, Math.PI*2);
    ctx.fillStyle = cloth;
    ctx.fill();
    kimonoPattern(ctx, look.pattern, leanX, -2*s + leanY, 9*s, 12*s + breathOff, s);
    ctx.strokeStyle = PALETTE.sumi;
    ctx.lineWidth = 0.9*s;
    ctx.stroke();

    // V-collar on robe
    ctx.strokeStyle = isLearner ? '#d0c8b0' : '#f6efe0';
    ctx.lineWidth = 1.4*s;
    ctx.beginPath();
    const collarFwd = Math.cos(facing) * 4 * s;
    const collarSide = Math.sin(facing) * 4 * s;
    ctx.moveTo(leanX + Math.cos(facing + 0.8) * 6*s, leanY + Math.sin(facing + 0.8) * 6*s - 8*s);
    ctx.lineTo(leanX + collarFwd, leanY + collarSide - 2*s);
    ctx.lineTo(leanX + Math.cos(facing - 0.8) * 6*s, leanY + Math.sin(facing - 0.8) * 6*s - 8*s);
    ctx.stroke();

    // Belt / sash
    ctx.beginPath();
    ctx.ellipse(leanX, 2*s + leanY, 9*s, 2*s, 0, 0, Math.PI*2);
    ctx.fillStyle = look.obi;
    ctx.fill();

    // Arms with sleeves — action-specific poses
    let leftArmSwing = walkCycle * 2 * s;
    let rightArmSwing = -walkCycle * 2 * s;
    let leftArmYOff = -3 * s;
    let rightArmYOff = -3 * s;
    const sleeveW = isLearner ? 3.5*s : 5*s;
    const sleeveH = isLearner ? 5*s : 6*s;

    if (isActing) {
        if (actionId.startsWith('cook') || actionId === 'make_soup' || actionId === 'brew_tea') {
            // Both arms forward (stirring)
            leftArmSwing = 4 * s + Math.sin(gameTick * 0.1) * 1.5 * s;
            rightArmSwing = 3 * s + Math.cos(gameTick * 0.1) * 1.5 * s;
            leftArmYOff = -5 * s;
            rightArmYOff = -5 * s;
        } else if (actionId.startsWith('write') || actionId === 'grind_ink' || actionId.startsWith('paint') || actionId.startsWith('read')) {
            // One arm extended (writing/reading)
            leftArmSwing = 5 * s + Math.sin(gameTick * 0.06) * 0.5 * s;
            rightArmSwing = -1 * s;
            leftArmYOff = -6 * s;
        } else if (actionId === 'fish_catch') {
            // Arm extended to side (holding rod)
            rightArmSwing = -6 * s;
            rightArmYOff = -6 * s;
        } else if (actionId.startsWith('eat') || actionId.startsWith('drink')) {
            // One arm raised to mouth
            leftArmSwing = 3 * s;
            leftArmYOff = -8 * s + Math.sin(gameTick * 0.08) * s;
        } else if (actionId === 'cut_bamboo') {
            // Chopping motion
            rightArmSwing = -4 * s;
            rightArmYOff = -4 * s + Math.sin(gameTick * 0.2) * 3 * s;
        }
    } else if (isSleeping) {
        leftArmSwing = 0;
        rightArmSwing = 0;
        leftArmYOff = 0;
        rightArmYOff = 0;
    }

    // Left arm
    ctx.save();
    ctx.translate(leanX + Math.cos(facing + 1.5) * 9*s, leanY + Math.sin(facing + 1.5) * 9*s);
    ctx.beginPath();
    ctx.ellipse(Math.cos(facing) * leftArmSwing, Math.sin(facing) * leftArmSwing + leftArmYOff, sleeveW, sleeveH, facing + 0.3, 0, Math.PI*2);
    ctx.fillStyle = cloth;
    ctx.fill();
    ctx.strokeStyle = PALETTE.sumi;
    ctx.lineWidth = 0.7*s;
    ctx.stroke();
    // Hand
    ctx.beginPath();
    ctx.arc(Math.cos(facing) * (leftArmSwing + 2*s), Math.sin(facing) * (leftArmSwing + 2*s) + leftArmYOff, 2*s, 0, Math.PI*2);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.restore();
    // Right arm
    ctx.save();
    ctx.translate(leanX + Math.cos(facing - 1.5) * 9*s, leanY + Math.sin(facing - 1.5) * 9*s);
    ctx.beginPath();
    ctx.ellipse(Math.cos(facing) * rightArmSwing, Math.sin(facing) * rightArmSwing + rightArmYOff, sleeveW, sleeveH, facing - 0.3, 0, Math.PI*2);
    ctx.fillStyle = cloth;
    ctx.fill();
    ctx.strokeStyle = PALETTE.sumi;
    ctx.lineWidth = 0.7*s;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(Math.cos(facing) * (rightArmSwing + 2*s), Math.sin(facing) * (rightArmSwing + 2*s) + rightArmYOff, 2*s, 0, Math.PI*2);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.restore();

    // Head — with breathing bob and walk bob
    const headX = leanX + Math.cos(facing) * 3 * s;
    const headY = leanY + Math.sin(facing) * 3 * s - 12 * s - headBob;
    ctx.beginPath();
    ctx.arc(headX, headY, 6*s, 0, Math.PI*2);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.strokeStyle = PALETTE.sumi;
    ctx.lineWidth = 0.8*s;
    ctx.stroke();

    // Hair
    ctx.save();
    ctx.translate(headX, headY);
    ctx.fillStyle = '#1a1a1a';
    if (isLearner) {
        // German traveler: shorter hair, no topknot, maybe a cap
        ctx.beginPath();
        ctx.arc(0, -2*s, 6.5*s, Math.PI, 0);
        ctx.fill();
        // Simple cap/hat brim
        ctx.fillStyle = '#5a4030';
        ctx.beginPath();
        ctx.ellipse(0, -4*s, 8*s, 2*s, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#6a5040';
        ctx.beginPath();
        ctx.arc(0, -5*s, 5*s, Math.PI, 0);
        ctx.fill();
    } else {
        // Japanese: black hair with topknot (丁髷 chonmage)
        ctx.beginPath();
        ctx.arc(0, -2*s, 6.5*s, Math.PI, 0);
        ctx.fill();
        // Topknot bun (髷 mage)
        ctx.beginPath();
        ctx.arc(0, -8*s, 3*s, 0, Math.PI*2);
        ctx.fill();
        // Topknot pin (small line through bun)
        ctx.strokeStyle = '#8a7060';
        ctx.lineWidth = 0.8*s;
        ctx.beginPath();
        ctx.moveTo(-4*s, -8*s);
        ctx.lineTo(4*s, -8*s);
        ctx.stroke();
    }
    ctx.restore();

    // Eyes — with blinking
    const eyeDist = 2.5 * s;
    const eyeFwd = 3 * s;
    const lEx = headX + Math.cos(facing) * eyeFwd + Math.cos(facing + 1.3) * eyeDist;
    const lEy = headY + Math.sin(facing) * eyeFwd + Math.sin(facing + 1.3) * eyeDist;
    const rEx = headX + Math.cos(facing) * eyeFwd + Math.cos(facing - 1.3) * eyeDist;
    const rEy = headY + Math.sin(facing) * eyeFwd + Math.sin(facing - 1.3) * eyeDist;
    ctx.fillStyle = '#1a1a10';
    // Blink cycle: deterministic per-character, blinks for 3 ticks every ~150 ticks
    const blinkSeed = (person.name.charCodeAt(0) || 65) * 137;
    const blinkCycle = (gameTick * 0.5 + blinkSeed) % 150;
    const isBlinking = blinkCycle < 3 || isSleeping;
    if (isBlinking) {
        // Closed eyes — horizontal lines
        ctx.strokeStyle = '#1a1a10';
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(lEx - 1.2*s, lEy); ctx.lineTo(lEx + 1.2*s, lEy);
        ctx.moveTo(rEx - 1.2*s, rEy); ctx.lineTo(rEx + 1.2*s, rEy);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(lEx, lEy, 1.2*s, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rEx, rEy, 1.2*s, 0, Math.PI*2);
        ctx.fill();
    }

    // Sleeping indicator
    if (isSleeping) {
        const zt = gameTick * 0.04;
        ctx.font = `bold ${Math.round(12*s)}px 'Courier New','Noto Sans JP','Hiragino Kaku Gothic Pro','Yu Gothic',monospace`;
        ctx.fillStyle = `rgba(150,180,220,${0.5+Math.sin(zt)*0.3})`;
        ctx.textAlign = 'center';
        ctx.fillText('z Z', 14*s, (-24 + Math.sin(zt)*4)*s);
    }

    // Acting indicator
    if (isActing) {
        const at = gameTick * 0.08;
        const sparkX = Math.cos(at) * 12 * s;
        const sparkY = Math.sin(at * 1.3) * 8 * s - 6 * s;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 1.5*s, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,220,100,0.6)';
        ctx.fill();
    }


    ctx.restore();

    // Name tag: indigo for the speaker, vermilion for the learner, quiet ink for villagers
    const tagStyle = person.role === 'speaker' ? NAME_TAG.speaker : person.role === 'learner' ? NAME_TAG.learner : NAME_TAG.villager;
    drawTag(ctx, person.name, x, y + 17*s, tagStyle);
}
