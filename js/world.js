// Nihongo Mura — World objects, the river and pathfinding

// ============================================================
//  WORLD OBJECTS
// ============================================================
const OBJECT_DEFS = [
    { id: 'house1',     type: 'house',       x: 180, y: 200, w: 80, h: 60, label: '家',     romaji: 'ie' },
    { id: 'house2',     type: 'house',       x: 600, y: 180, w: 80, h: 60, label: '家',     romaji: 'ie' },
    { id: 'teahouse1',  type: 'teahouse',    x: 400, y: 250, w: 90, h: 65, label: '茶屋',   romaji: 'chaya' },
    { id: 'market1',    type: 'market',       x: 300, y: 340, w: 70, h: 50, label: '市場',   romaji: 'ichiba' },
    { id: 'well1',      type: 'well',         x: 480, y: 350, w: 35, h: 35, label: '井戸',   romaji: 'ido' },
    { id: 'bridge1',    type: 'bridge',       x: 750, y: 400, w: 90, h: 50, label: '橋',     romaji: 'hashi' },
    { id: 'pagoda1',    type: 'pagoda',       x: 835, y: 140, w: 50, h: 80, label: '五重塔', romaji: 'gojuunotou' },
    { id: 'gate1',      type: 'torii',        x: 100, y: 300, w: 50, h: 60, label: '鳥居',   romaji: 'torii' },
    { id: 'bamboo1',    type: 'bamboo',       x: 60,  y: 200, w: 40, h: 70, label: '竹',     romaji: 'take' },
    { id: 'bamboo2',    type: 'bamboo',       x: 850, y: 450, w: 40, h: 70, label: '竹',     romaji: 'take' },
    { id: 'garden1',    type: 'garden',        x: 300, y: 500, w: 60, h: 45, label: '庭園',   romaji: 'teien' },
    { id: 'kitchen1',   type: 'kitchen',      x: 350, y: 180, w: 50, h: 40, label: '台所',   romaji: 'daidokoro' },
    { id: 'workshop1',  type: 'workshop',     x: 500, y: 150, w: 55, h: 40, label: '書院',   romaji: 'shoin' },
    { id: 'fish_pond1', type: 'fish_pond',    x: 180, y: 520, w: 45, h: 35, label: '池',     romaji: 'ike' },
    { id: 'shrine1',    type: 'shrine',       x: 150, y: 450, w: 40, h: 50, label: '神社',   romaji: 'jinja' },
    { id: 'lantern1',   type: 'lantern_post', x: 440, y: 180, w: 15, h: 35, label: '灯籠',   romaji: 'tourou' },
    { id: 'rice1',      type: 'rice_paddy',   x: 560, y: 560, w: 60, h: 45, label: '田んぼ', romaji: 'tanbo' },
    { id: 'pond1',      type: 'fish_pond',    x: 420, y: 560, w: 70, h: 50, label: '池',     romaji: 'ike' },
    { id: 'dock1',      type: 'dock',         x: 720, y: 530, w: 40, h: 30, label: '船着場', romaji: 'funatsukiba' },
    { id: 'lotus1',     type: 'lotus_pond',   x: 120, y: 530, w: 50, h: 35, label: '蓮池',   romaji: 'hasuike' },
    { id: 'flower1',    type: 'flower',       x: 200, y: 380, w: 30, h: 30, label: '花',     romaji: 'hana' },
    { id: 'tree1',      type: 'willow',       x: 650, y: 350, w: 45, h: 65, label: '柳',     romaji: 'yanagi' },
    { id: 'tree2',      type: 'willow',       x: 130, y: 140, w: 45, h: 65, label: '柳',     romaji: 'yanagi' },
    // ── East bank (right of bridge) ──
    { id: 'school1',      type: 'school',       x: 920, y: 220, w: 60, h: 50, label: '寺子屋', romaji: 'terakoya' },
    { id: 'medicine1',    type: 'medicine_hut', x: 840, y: 300, w: 55, h: 45, label: '薬屋',   romaji: 'kusuriya' },
    { id: 'stable1',      type: 'stable',       x: 920, y: 380, w: 50, h: 40, label: '厩',     romaji: 'umaya' },
    { id: 'tea_terrace1', type: 'tea_terrace',  x: 920, y: 520, w: 50, h: 35, label: '茶畑',   romaji: 'chabatake' },
    { id: 'viewpoint1',   type: 'viewpoint',    x: 855, y: 590, w: 40, h: 35, label: '展望台', romaji: 'tenboudai' },
];

// ============================================================
//  RIVER BARRIER & PATHFINDING
// ============================================================
// River runs roughly x=705..800 (meandering bezier), full height
const RIVER_LEFT  = 705;
const RIVER_RIGHT = 800;
const BRIDGE = { x: 750, y: 400, halfW: 45, halfH: 50 };

function isInRiver(x) {
    return x > RIVER_LEFT && x < RIVER_RIGHT;
}

function crossesRiver(x1, x2) {
    // True if one point is left of river and the other is right (or inside)
    const left1  = x1 <= RIVER_LEFT;
    const right1 = x1 >= RIVER_RIGHT;
    const left2  = x2 <= RIVER_LEFT;
    const right2 = x2 >= RIVER_RIGHT;
    if (left1 && right2) return true;
    if (right1 && left2) return true;
    if (left1 && isInRiver(x2)) return true;
    if (right1 && isInRiver(x2)) return true;
    if (left2 && isInRiver(x1)) return true;
    if (right2 && isInRiver(x1)) return true;
    return false;
}

// Build waypoints for river crossing via bridge
function planWaypoints(fromX, fromY, toX, toY) {
    if (!crossesRiver(fromX, toX)) return null; // no waypoints needed
    const waypoints = [];
    // Approach bridge from the correct side (with generous margin from river edge)
    const comingFromLeft = fromX < RIVER_LEFT;
    const bridgeApproach = comingFromLeft
        ? { x: RIVER_LEFT - 15, y: BRIDGE.y }
        : { x: RIVER_RIGHT + 15, y: BRIDGE.y };
    const bridgeExit = comingFromLeft
        ? { x: RIVER_RIGHT + 15, y: BRIDGE.y }
        : { x: RIVER_LEFT - 15, y: BRIDGE.y };
    waypoints.push(bridgeApproach);
    waypoints.push(bridgeExit);
    return waypoints;
}

// Check if a point is inside any building (for avoidance)
const BUILDING_TYPES = ['house', 'teahouse', 'kitchen', 'workshop', 'market', 'pagoda', 'shrine', 'torii', 'school', 'medicine_hut', 'stable'];
const GROUND_TYPES = ['rice_paddy', 'river', 'lotus_pond', 'fish_pond', 'garden'];
// Distance from obj.y down to where each object meets the ground, measured from its drawing.
// This is the object's depth line: anything whose feet are below it is drawn in front.
const VISUAL_BOTTOM = {
    house: 19.5, teahouse: 20, market: 12, well: 10, bridge: 30,
    pagoda: 19, torii: 30, bamboo: 25, garden: 0, kitchen: 12,
    workshop: 18, fish_pond: 0, shrine: 13, lantern_post: 14,
    rice_paddy: 0, river: 0, dock: 13, lotus_pond: 0,
    flower: 11, willow: 20, school: 18, medicine_hut: 11,
    stable: 14, tea_terrace: 14, viewpoint: 11.5
};
// Characters are anchored at body centre; their feet meet the ground this far below it.
const CHAR_FOOT_Y = 8;

// Small solid props: elliptical ground footprints, measured from the drawings and expressed in
// character-anchor space (shifted up by CHAR_FOOT_Y, padded by a character's half-width/foot depth).
// Characters walk around these instead of through them, so their draw order always reads correctly.
const SOLID_PROPS = {
    well:         { cx: 0, cy: 2 - CHAR_FOOT_Y,  rx: 12 + 7, ry: 7 + 4 }, // stone base ellipse
    lantern_post: { cx: 0, cy: 14 - CHAR_FOOT_Y, rx: 2 + 6,  ry: 2 + 4 }, // foot of the pole
};
function isObstacleType(type) { return BUILDING_TYPES.includes(type) || !!SOLID_PROPS[type]; }
// Axis-aligned box (centre + size) covering an obstacle's blocked area, for path planning
function obstacleBox(obj) {
    const sp = SOLID_PROPS[obj.type];
    if (sp) return { x: obj.x + sp.cx, y: obj.y + sp.cy, w: sp.rx * 2, h: sp.ry * 2 };
    return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
}
function insideObstacle(obj, x, y) {
    const sp = SOLID_PROPS[obj.type];
    if (sp) {
        const dx = (x - obj.x - sp.cx) / sp.rx, dy = (y - obj.y - sp.cy) / sp.ry;
        return dx * dx + dy * dy < 1;
    }
    const hw = obj.w / 2, hh = obj.h / 2;
    return x > obj.x - hw && x < obj.x + hw && y > obj.y - hh && y < obj.y + hh;
}

// Where a character stands to use an object: just in front of its visible base,
// so it is always drawn in front of the object instead of half-inside it.
const STAND_ON_TYPES = new Set(['rice_paddy', 'garden', 'bridge', 'dock']);
const WATER_EDGE_TYPES = new Set(['fish_pond', 'lotus_pond']);
function standSpot(obj, spread) {
    const k = spread === undefined ? 1 : spread;
    const jx = randFloat(-obj.w * 0.32, obj.w * 0.32) * k;
    if (STAND_ON_TYPES.has(obj.type)) {
        return { x: obj.x + jx, y: obj.y + randFloat(-obj.h * 0.3, obj.h * 0.3) * k };
    }
    if (WATER_EDGE_TYPES.has(obj.type)) {
        return { x: obj.x + jx, y: obj.y + obj.h / 2 + randFloat(2, 6) };
    }
    const sp = SOLID_PROPS[obj.type];
    if (sp) return { x: obj.x + jx, y: obj.y + sp.cy + sp.ry + randFloat(6, 9) };
    const base = VISUAL_BOTTOM[obj.type] !== undefined ? VISUAL_BOTTOM[obj.type] : obj.h / 2;
    // Buildings block their whole w×h box, so stand just outside it — beyond the
    // 4-unit margin the path planner keeps around obstacles, so the last leg is clear
    if (BUILDING_TYPES.includes(obj.type)) return { x: obj.x + jx, y: obj.y + Math.max(obj.h / 2, base) + randFloat(6, 10) };
    return { x: obj.x + jx, y: obj.y + base + randFloat(3, 8) };
}
// Move a destination that falls inside a solid object to the nearest point just outside it,
// so nobody walks into a wall trying to reach an unreachable spot.
function clampOutOfObstacles(x, y) {
    for (let pass = 0; pass < 3; pass++) {
        const obj = isInsideBuilding(x, y);
        if (!obj) break;
        const sp = SOLID_PROPS[obj.type];
        if (sp) {
            const cx = obj.x + sp.cx, cy = obj.y + sp.cy;
            let dx = (x - cx) / sp.rx, dy = (y - cy) / sp.ry;
            const l = Math.hypot(dx, dy);
            if (l < 1e-3) { dx = 0; dy = 1; } else { dx /= l; dy /= l; }   // dead centre: step to the front
            x = cx + dx * (sp.rx + 6);
            y = cy + dy * (sp.ry + 6);
        } else {
            const hw = obj.w / 2 + 6, hh = obj.h / 2 + 6;
            const exits = [
                { d: x - (obj.x - hw), x: obj.x - hw, y },
                { d: (obj.x + hw) - x, x: obj.x + hw, y },
                { d: y - (obj.y - hh), x, y: obj.y - hh },
                { d: ((obj.y + hh) - y) * 0.8, x, y: obj.y + hh },   // slight preference for the front
            ];
            const best = exits.reduce((a, b) => (b.d < a.d ? b : a));
            x = best.x; y = best.y;
        }
    }
    return { x, y };
}

// Solid object containing (x, y), if any. Characters are never exempt from an object because
// it's their destination: standSpot() always puts them outside the footprint.
function isInsideBuilding(x, y) {
    for (const obj of cachedBuildingObjects) {
        if (insideObstacle(obj, x, y)) return obj;
    }
    return null;
}

// Check if a position is blocked (river without bridge, or building)
function isBlocked(x, y, targetType) {
    // River check (allow on bridge with generous corridor)
    if (isInRiver(x) && Math.abs(y - BRIDGE.y) > BRIDGE.halfH + 35) {
        return true;
    }
    // Building / solid prop check
    if (isInsideBuilding(x, y)) {
        return true;
    }
    return false;
}

// Steer around obstacles: try original direction, then alternate angles
// Always returns a direction — never leaves the character stuck
function steerAroundObstacles(x, y, dirX, dirY, step, targetType) {
    // Already inside an obstacle: head straight out, away from its centre
    const inside = isInsideBuilding(x, y);
    if (inside) {
        const b = obstacleBox(inside);
        const ox = x - b.x, oy = (y - b.y) * (b.w / b.h), ol = Math.hypot(ox, oy) || 1;
        return { dx: ox / ol, dy: oy / ol };
    }
    // Try original direction first
    if (!isBlocked(x + dirX * step, y + dirY * step, targetType)) {
        return { dx: dirX, dy: dirY };
    }
    // Try increasingly wider angles
    const baseAngle = Math.atan2(dirY, dirX);
    const offsets = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.2, -2.2, 2.8, -2.8];
    for (const off of offsets) {
        const angle = baseAngle + off;
        const sdx = Math.cos(angle);
        const sdy = Math.sin(angle);
        if (!isBlocked(x + sdx * step, y + sdy * step, targetType)) {
            return { dx: sdx, dy: sdy };
        }
    }
    // All angles blocked: nudge backward to unstick
    return { dx: -dirX * 0.3, dy: -dirY * 0.3 };
}

// Check if a line segment from (x1,y1) to (x2,y2) intersects a rectangle
function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    const hw = rw / 2 + 4, hh = rh / 2 + 4; // small margin
    const left = rx - hw, right = rx + hw, top = ry - hh, bot = ry + hh;
    // Liang-Barsky clipping
    const dx = x2 - x1, dy = y2 - y1;
    let tMin = 0, tMax = 1;
    const edges = [
        { p: -dx, q: x1 - left },
        { p: dx,  q: right - x1 },
        { p: -dy, q: y1 - top },
        { p: dy,  q: bot - y1 },
    ];
    for (const { p, q } of edges) {
        if (Math.abs(p) < 0.001) {
            if (q < 0) return false;
        } else {
            const t = q / p;
            if (p < 0) { if (t > tMin) tMin = t; }
            else       { if (t < tMax) tMax = t; }
            if (tMin > tMax) return false;
        }
    }
    return true;
}

// Plan waypoints around obstacles that lie in the path. For each obstacle crossed, take the
// shortest detour via one corner, or via two corners along one side when going from behind
// an obstacle to its front (or side to side), such that no leg cuts through it.
function planBuildingWaypoints(fromX, fromY, toX, toY, targetType) {
    const waypoints = [];
    const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
    for (const obj of cachedBuildingObjects) {
        const box = obstacleBox(obj);
        if (!lineIntersectsRect(fromX, fromY, toX, toY, box.x, box.y, box.w, box.h)) continue;
        const hw = box.w / 2 + 10, hh = box.h / 2 + 10;
        // Corners in ring order: TL, TR, BR, BL (neighbours share a side)
        const ring = [
            { x: box.x - hw, y: box.y - hh },
            { x: box.x + hw, y: box.y - hh },
            { x: box.x + hw, y: box.y + hh },
            { x: box.x - hw, y: box.y + hh },
        ];
        const usable = c => !isInRiver(c.x) && !isInsideBuilding(c.x, c.y) &&
                            c.x >= 20 && c.x <= WORLD_W - 20 && c.y >= 20 && c.y <= WORLD_H - 20;
        const clear = (ax, ay, bx, by) => !lineIntersectsRect(ax, ay, bx, by, box.x, box.y, box.w, box.h);
        let best = null, bestLen = Infinity;
        const consider = route => {
            if (!route.every(usable)) return;
            const pts = [{ x: fromX, y: fromY }, ...route, { x: toX, y: toY }];
            let len = 0;
            for (let i = 1; i < pts.length; i++) {
                if (!clear(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)) return;
                len += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
            }
            if (len < bestLen) { bestLen = len; best = route; }
        };
        for (let i = 0; i < 4; i++) {
            consider([ring[i]]);
            consider([ring[i], ring[(i + 1) % 4]]);
            consider([ring[(i + 1) % 4], ring[i]]);
        }
        if (!best) {
            // Fall back to the old single-corner choice (steering handles the rest)
            for (const c of ring) {
                if (!usable(c)) continue;
                const d = dist(fromX, fromY, c.x, c.y) + dist(toX, toY, c.x, c.y);
                if (d < bestLen) { bestLen = d; best = [c]; }
            }
        }
        if (best) {
            for (const c of best) waypoints.push({ x: c.x, y: c.y, _dist: dist(fromX, fromY, c.x, c.y) });
        }
    }
    // Sort by distance from start
    waypoints.sort((a, b) => a._dist - b._dist);
    return waypoints;
}

// Set target with automatic river-crossing and building-avoidance waypoints
function entityDistTo(entity, ox, oy) {
    return Math.sqrt((entity.x - ox) ** 2 + (entity.y - oy) ** 2);
}

function moveEntityToward(entity, tx, ty, dt, speed, speedMul, stuckThreshold, targetType) {
    // Navigate through waypoints first
    let goalX = tx, goalY = ty;
    if (entity.waypoints && entity.waypoints.length > 0) {
        goalX = entity.waypoints[0].x;
        goalY = entity.waypoints[0].y;
    }
    const dx = goalX - entity.x;
    const dy = goalY - entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 8 && entity.waypoints && entity.waypoints.length > 0) {
        entity.waypoints.shift();
        entity.stuckTimer = 0;
        entity.steerFrames = 0;
        entity.lastMoveX = entity.x;   // progress is measured toward the next goal from here
        entity.lastMoveY = entity.y;
        return false;
    }
    if (dist < 3 && (!entity.waypoints || entity.waypoints.length === 0)) {
        entity.stuckTimer = 0;
        entity.steerFrames = 0;
        return true;
    }
    // Stuck detection, once per window: no real progress toward the current goal counts as stuck —
    // standing still, but also jittering back and forth against the riverbank
    entity.stuckTimer += dt;
    if (entity.stuckTimer > stuckThreshold) {
        entity.stuckTimer = 0;
        const progress = Math.sqrt((entity.lastMoveX - goalX) ** 2 + (entity.lastMoveY - goalY) ** 2) - dist;
        entity.lastMoveX = entity.x;
        entity.lastMoveY = entity.y;
        if (progress < 5) {
            entity.steerFrames = 0;
            // Still on the wrong side of the river (a bridge waypoint got skipped): plan the way over the
            // bridge again instead of walking into the water forever
            const onBridge = isInRiver(entity.x) && Math.abs(entity.y - BRIDGE.y) <= BRIDGE.halfH + 25;
            if (!onBridge && crossesRiver(entity.x, tx) && (entity.replans || 0) < 3) {
                entity.replans = (entity.replans || 0) + 1;
                setTargetWithPath(entity, tx, ty, true);
                return false;
            }
            if (entity.waypoints && entity.waypoints.length > 0) {
                entity.waypoints.shift();
            } else {
                return true; // give up, treat as arrived
            }
        }
    }
    const spd = speed * dt * speedMul;
    const step = Math.min(spd, dist);
    const dirX = dx / dist, dirY = dy / dist;
    // Use cached steer direction if still active, otherwise recalculate
    if (entity.steerFrames > 0) {
        entity.steerFrames -= dt;
        if (!isBlocked(entity.x + entity.steerDx * step, entity.y + entity.steerDy * step, targetType)) {
            entity.x += entity.steerDx * step;
            entity.y += entity.steerDy * step;
            entity.facing = Math.atan2(entity.steerDy, entity.steerDx);
            return dist < 8 && (!entity.waypoints || entity.waypoints.length === 0);
        }
        entity.steerFrames = 0;
    }
    const steer = steerAroundObstacles(entity.x, entity.y, dirX, dirY, step, targetType);
    if (Math.abs(steer.dx - dirX) > 0.1 || Math.abs(steer.dy - dirY) > 0.1) {
        entity.steerDx = steer.dx;
        entity.steerDy = steer.dy;
        entity.steerFrames = 20;
    }
    entity.x += steer.dx * step;
    entity.y += steer.dy * step;
    entity.facing = Math.atan2(steer.dy, steer.dx);
    return dist < 8 && (!entity.waypoints || entity.waypoints.length === 0);
}

function setTargetWithPath(character, tx, ty, isReplan) {
    if (!isReplan) character.replans = 0;
    // Clamp target out of the river to prevent characters from targeting positions inside it
    tx = clampOutOfRiver(tx, ty);
    const outside = clampOutOfObstacles(tx, ty);
    tx = outside.x; ty = outside.y;
    character.targetX = tx;
    character.targetY = ty;
    // Determine what type of building the character is going to (so we don't avoid it)
    let targetType = null;
    if (character.currentAction) {
        const act = ACTION_DEFS.find(a => a.id === character.currentAction.id);
        if (act) targetType = act.target;
        if (character.currentAction.target && typeof character.currentAction.target === 'string') {
            targetType = character.currentAction.target;
        }
    }
    // River waypoints
    const riverWP = planWaypoints(character.x, character.y, tx, ty);
    // Building waypoints for non-river segments
    const buildingWP = planBuildingWaypoints(character.x, character.y, tx, ty, targetType);
    // Merge: building waypoints first (sorted by distance), then river waypoints
    const allWP = [];
    if (riverWP) {
        // Insert building waypoints that come before the first river waypoint
        const riverStartDist = Math.sqrt((character.x - riverWP[0].x) ** 2 + (character.y - riverWP[0].y) ** 2);
        for (const bw of buildingWP) {
            if (bw._dist < riverStartDist) allWP.push(bw);
        }
        allWP.push(...riverWP);
        // Insert building waypoints after river crossing
        for (const bw of planBuildingWaypoints(riverWP[riverWP.length - 1].x, riverWP[riverWP.length - 1].y, tx, ty, targetType)) {
            allWP.push(bw);
        }
    } else {
        allWP.push(...buildingWP);
    }
    character.waypoints = allWP;
    // Reset stuck tracking so new movement starts fresh
    character.stuckTimer = 0;
    character.lastMoveX = character.x;
    character.lastMoveY = character.y;
}

// Ensure positions don't land inside the river
function clampOutOfRiver(x, y) {
    // Allow targets on the bridge itself (within the bridge corridor)
    if (y !== undefined && Math.abs(y - BRIDGE.y) <= BRIDGE.halfH + 25) return x;
    if (x > RIVER_LEFT && x < BRIDGE.x) return RIVER_LEFT - 10;
    if (x >= BRIDGE.x && x < RIVER_RIGHT) return RIVER_RIGHT + 10;
    return x;
}
