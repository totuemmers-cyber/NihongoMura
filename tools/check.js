#!/usr/bin/env node
// Nihongo Mura — quick checks (no dependencies, a few seconds).
//   node tools/check.js         run every check
//   node tools/check.js --fix   also regenerate js/glyphs.js (the font subset list)
// The game runs headless: the scripts from index.html are loaded in order into a Node VM with a
// stubbed DOM/canvas and a seeded Math.random, so every run sees the same game.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CJK = /[　-ヿ一-鿿＀-￯]/g;

// ---------------------------------------------------------------- headless game
function rng(seed) {                       // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function stub(kind) {                      // anything the game might touch on the DOM or a canvas
    const store = {}, kids = new Map();
    let self;
    const fn = function () { return self; };
    self = new Proxy(fn, {
        get(t, k) {
            if (k in store) return store[k];
            if (k === Symbol.toPrimitive) return () => 0;
            if (k === 'then' || typeof k === 'symbol') return undefined;
            if (k === 'value' || k === 'textContent' || k === 'innerHTML') return '';
            if (k === 'measureText') return s => ({ width: String(s).length * 8 });
            if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 1280, height: 720 });
            if (k === 'closest' || k === 'querySelector') return () => null;
            if (k === 'width' || k === 'height') return kind === 'canvas' ? 0 : 0;
            if (!kids.has(k)) kids.set(k, stub());
            return kids.get(k);
        },
        set(t, k, v) { store[k] = v; return true; },
        apply() { return self; },
        construct() { return stub(); },
    });
    return self;
}
function scriptsOf(root) {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const list = [];
    html.replace(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g, (m, src, inline) => {
        list.push(src ? { file: src, code: fs.readFileSync(path.join(root, src), 'utf8') } : { file: 'index.html', code: inline });
    });
    return { html, list };
}
function loadGame(root = ROOT, seed = 1) {
    const { html, list } = scriptsOf(root);
    const bodyText = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');
    const els = {}, listeners = {}, timers = [], errors = [];
    let now = 0, raf = null;
    const on = (k, f) => (listeners[k] = listeners[k] || []).push(f);
    const document = {
        currentScript: null, hidden: false, fonts: undefined,
        body: { textContent: bodyText },
        head: { appendChild(el) { sandbox.__fontHref = el.href; } },
        getElementById: id => els[id] || (els[id] = stub()),
        querySelector: () => stub(), querySelectorAll: () => [],
        createElement: tag => (tag === 'link' ? {} : stub(tag)),
        addEventListener: on, removeEventListener() {},
    };
    const store = {};
    const sandbox = {
        document, console,
        Math: Object.assign(Object.create(Math), { random: rng(seed) }),
        performance: { now: () => now },
        requestAnimationFrame: cb => { raf = cb; return 1; },
        setTimeout: (f, ms) => { timers.push({ at: now + (+ms || 0), f }); return timers.length; },
        clearTimeout() {}, setInterval: () => 0, clearInterval() {},
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        location: { search: '', hash: '', reload() {} },
        navigator: { userAgent: 'node', maxTouchPoints: 0 },
        confirm: () => true, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
        matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
        Path2D: function () { return stub(); },
        addEventListener: on, removeEventListener() {},
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    for (const s of list) new vm.Script(s.code, { filename: s.file }).runInContext(sandbox);
    const game = {
        sandbox, store, listeners, errors, scripts: list,
        run: code => vm.runInContext(code, sandbox),
        // advance real time by ms in 60 fps frames (or a single jump)
        frames(ms, step = 1000 / 60) {
            for (let t = 0; t < ms; t += step) {
                now += step;
                for (let i = 0; i < timers.length; i++) if (timers[i].at <= now) { const f = timers[i].f; timers.splice(i--, 1); f(); }
                const cb = raf; raf = null;
                if (cb) try { cb(now); } catch (e) { errors.push(e); }
            }
        },
        fire(type) { for (const f of listeners[type] || []) f({ type }); },
    };
    return game;
}

// ---------------------------------------------------------------- checks
const results = [];
function check(name, fn) {
    const t0 = Date.now();
    let problems;
    try { problems = fn() || []; } catch (e) { problems = [e.stack || String(e)]; }
    results.push({ name, problems, ms: Date.now() - t0 });
}
const fmt = list => list.slice(0, 12).map(p => '      ' + p).join('\n') + (list.length > 12 ? `\n      … and ${list.length - 12} more` : '');

// Every line the speaker can say, with how the game says it (see ai.js / villagers.js / overlays.js)
function speakerLines(g) {
    return JSON.parse(g.run(`JSON.stringify([
        ...ACTION_DEFS.flatMap(a => (a.templates || []).map(t => ({ ctx: a.id, ids: t, narrative: true }))),
        ...Object.entries(ANIMAL_LINES).flatMap(([k, ls]) => ls.map(t => ({ ctx: 'animal_' + k, ids: t }))),
        ...Object.entries(WEATHER_LINES).flatMap(([k, ls]) => ls.map(t => ({ ctx: 'weather_' + k, ids: t }))),
        ...DISCOVERY_TYPES.flatMap(d => d.speech.map(t => ({ ctx: 'discover_' + d.type, ids: t }))),
    ])`));
}

function main() {
    const fix = process.argv.includes('--fix');
    const g = loadGame();
    g.frames(200);
    const R = code => g.run(code);

    check('game loads and runs', () => {
        g.frames(1000);
        return g.errors.map(e => e.stack.split('\n').slice(0, 2).join(' '));
    });

    check('vocabulary is consistent', () => {
        const p = [];
        const V = JSON.parse(R('JSON.stringify(VOCABULARY)'));
        const ids = new Set();
        for (const w of V) {
            if (ids.has(w.id)) p.push(`duplicate id ${w.id}`);
            ids.add(w.id);
            for (const f of ['kanji', 'kana', 'romaji', 'de', 'type']) if (!w[f]) p.push(`${w.id}: missing ${f}`);
            if (!['noun', 'verb', 'mod', 'pronoun', 'particle'].includes(w.type)) p.push(`${w.id}: unknown type ${w.type}`);
            if (w.type === 'verb' && !['godan', 'ichidan', 'irregular'].includes(w.vclass)) p.push(`${w.id}: verb without vclass`);
            if (!/^[぀-ヿー]+$/.test(w.kana)) p.push(`${w.id}: kana "${w.kana}" is not plain kana`);
            if (/[A-Z]/.test(w.romaji) || /[ÄÖÜäöü]/.test(w.romaji)) p.push(`${w.id}: odd romaji "${w.romaji}"`);
            if (/ue|oe|ae/i.test(w.de) && /Oel|Uebung|ueber|Ae|Oe/.test(w.de)) p.push(`${w.id}: umlaut written out in "${w.de}"`);
            if (w.same && !V.some(o => o.id === w.same && !o.same)) p.push(`${w.id}: same → unknown word ${w.same}`);
        }
        const forms = {};
        for (const w of V) if (w.type !== 'particle' && !w.same) (forms[w.kanji + '/' + w.kana] = forms[w.kanji + '/' + w.kana] || []).push(w.id);
        for (const [f, list] of Object.entries(forms)) if (list.length > 1) p.push(`same word twice: ${f} (${list.join(', ')}) — merge them or mark one with same:`);
        for (const w of V) {
            if (w.type === 'noun' && !R(`'${w.id}' in DE_NOUN`)) p.push(`${w.id}: no German gender in DE_NOUN`);
            if (w.type === 'verb' && !R(`'${w.id}' in DE_VERB`)) p.push(`${w.id}: no German verb in DE_VERB`);
        }
        const used = JSON.parse(R(`JSON.stringify([...ACTION_DEFS.flatMap(a => [...(a.templates || []).flat(), ...(a.visibleConcepts || [])]),
            ...Object.values(CHAT_LINES).flat(2), ...Object.values(ANIMAL_LINES).flat(2), ...Object.values(WEATHER_LINES).flat(2),
            ...DISCOVERY_TYPES.flatMap(d => d.speech.flat())])`));
        for (const id of new Set(used)) if (!ids.has(id)) p.push(`template uses unknown word "${id}"`);
        return p;
    });

    let utterances = [];
    check('every sentence comes out clean (all templates × tiers)', () => {
        const p = [];
        const lines = speakerLines(g);
        const chat = JSON.parse(R(`JSON.stringify(Object.entries(CHAT_LINES).flatMap(([k, ls]) => ls.map(t => ({ ctx: 'chat_' + k, ids: t, plain: true }))))`));
        R(`var __all = { knownWords: { has: () => true } };`);
        const bad = /undefined|NaN|null|\[object|\s{2,}|\s[.,!?]|^\s|\s$/;
        for (const L of [...lines, ...chat]) for (let tier = 0; tier <= 4; tier++) for (let rep = 0; rep < 3; rep++) {
            const modes = L.narrative ? [false, true] : [false];
            for (const narrative of modes) {
                let u;
                try { u = JSON.parse(R(`(() => { const u = sayTemplate(${JSON.stringify(L.ctx)}, ${JSON.stringify(L.ids)}, { tier: ${tier}, polite: ${!L.plain}, narrative: ${narrative} });
                    const de = germanFor(u.words, __all); return JSON.stringify({ jp: u.kanjiText, kana: u.kanaText, de: de && de.text, ids: u.words.map(w => w.conceptId).filter(c => c && c !== '_p') }); })()`)); }
                catch (e) { p.push(`${L.ctx} [${L.ids}] tier ${tier}: ${e.message}`); break; }
                const where = `${L.ctx} [${L.ids.join(' ')}] t${tier}${narrative ? ' story' : ''}`;
                if (!u.jp || bad.test(u.jp) || /[a-zA-Z]/.test(u.jp)) p.push(`${where}: Japanese "${u.jp}"`);
                if (!u.de || bad.test(u.de) || u.de.includes('...') || /_/.test(u.de)) p.push(`${where}: German "${u.de}" (learner knows every word)`);
                if (!L.plain) utterances.push(u);
            }
        }
        return [...new Set(p)];
    });

    check('every learnable word can be heard from the speaker', () => {
        const heard = new Set(utterances.flatMap(u => u.ids).map(id => R(`canonWord(${JSON.stringify(id)})`)));
        const learnable = JSON.parse(R('JSON.stringify(LEARNABLE_WORDS)'));
        const missing = learnable.filter(id => !heard.has(id));
        return missing.length ? [`never said (${missing.length} of ${learnable.length}): ${missing.join(' ')}`] : [];
    });

    check('sample sentences stay the same', () => {
        const p = [];
        R(`var __knows = ids => ({ knownWords: { has: id => ids.includes(id) } });`);
        const cases = [
            // [action, template, opts, learner knows (null = all), Japanese, German]
            ['eat_rice', ['me', 'eat', 'food'], {}, null, '私は食べ物を食べます。', 'Ich esse Essen.'],
            ['drink_tea', ['tea', 'good', 'hot'], {}, null, 'お茶は美味しくて熱いです。', 'Der Tee ist lecker und heiß.'],
            ['tend_garden', ['flower', 'beautiful', 'many'], {}, null, '花が多いです。美しいですね。', 'Es gibt viele Blumen. Das ist schön.'],
            ['buy_at_market', ['money', 'buy', 'food'], {}, null, 'お金で食べ物を買います。', 'Ich kaufe mit Geld Essen.'],
            ['think_home', ['think', 'mother', 'father'], {}, null, '母と父のことを考えます。', 'Ich denke an meine Mutter und meinen Vater.'],
            ['feed_horse', ['feed', 'horse', 'now'], {}, null, '今馬に餌をやります。', 'Ich füttere jetzt das Pferd.'],
            ['cut_bamboo', ['me', 'cut', 'bamboo'], { narrative: true }, null, '私は竹を切りました。', 'Ich habe Bambus geschnitten.'],
            ['drink_tea', ['tea', 'good', 'hot'], {}, ['tea', 'tasty'], 'お茶は美味しくて熱いです。', 'Der Tee ist lecker ...'],
            ['chat_kitchen', ['food', 'hot', 'good'], { polite: false }, null, '食べ物は熱くていい。', 'Das Essen ist heiß und gut.'],
            ['drink_tea', ['me', 'always', 'drink', 'tea'], {}, null, '私はいつもお茶を飲みます。', 'Ich trinke immer Tee.'],
            ['eat_rice', ['me', 'eat', 'already'], {}, null, '私はもう食べました。', 'Ich habe schon gegessen.'],
            ['go_sleep', ['me', 'sleepy', 'still'], {}, null, '私はまだ眠いです。', 'Ich bin noch müde.'],
            ['drink_water', ['me', 'thirsty'], {}, null, '私は喉が渇きました。', 'Ich bin durstig.'],
            ['greet_friend', ['me', 'meet', 'neighbor'], {}, null, '私は隣人に会います。', 'Ich treffe einen Nachbarn.'],
            ['buy_at_market', ['shop', 'many'], { narrative: true }, null, '店が多かったです。', 'Es gab viele Läden.'],
            ['wake_up', ['goodmorning'], {}, null, 'おはようございます！', 'Guten Morgen!'],
        ];
        for (const [ctx, ids, opts, knows, jp, de] of cases) {
            const u = JSON.parse(R(`(() => { const u = sayTemplate(${JSON.stringify(ctx)}, ${JSON.stringify(ids)}, Object.assign({ tier: 0 }, ${JSON.stringify(opts)}));
                return JSON.stringify({ jp: u.kanjiText, de: germanFor(u.words, ${knows ? `__knows(${JSON.stringify(knows)})` : '__all'}).text }); })()`));
            if (u.jp !== jp) p.push(`${ctx} [${ids.join(' ')}]: Japanese "${u.jp}", expected "${jp}"`);
            if (u.de !== de) p.push(`${ctx} [${ids.join(' ')}]: German "${u.de}", expected "${de}"`);
        }
        return p;
    });

    check('a simulated game day', () => {
        const s = loadGame(ROOT, 7);
        s.run('setSpeed(3)');
        s.frames(64 * 1000, 100);   // one game day at 3× speed, in the longest steps a frame may take
        const p = s.errors.map(e => e.stack.split('\n').slice(0, 2).join(' '));
        const st = JSON.parse(s.run('JSON.stringify({ day: gameDay, known: persons[1].knownWords.size, log: eventLog.length })'));
        if (st.known === 0) p.push('learner learned nothing');
        if (st.log < 5) p.push('almost nothing happened');
        return p;
    });

    check('characters find the bridge instead of getting stuck at the river', () => {
        const s = loadGame(ROOT, 2);
        s.frames(200);
        // the speaker on the east bank, heading for the kitchen in the west, with the bridge waypoints lost
        const r = JSON.parse(s.run(`(() => { const p = persons[0];
            Object.assign(p, { x: 802, y: 198, currentAction: null, waypoints: [], stuckTimer: 0, lastMoveX: 802, lastMoveY: 198, replans: 0 });
            let t = 0; for (; t < 6000 && !p.moveToward(350, 200, 3); t += 3);
            return JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y), t }); })()`));
        return r.x < 705 ? [] : [`still on the east bank at ${r.x},${r.y} after ${r.t} ticks`];
    });

    check('pausing in the background does not fast-forward the game', () => {
        const s = loadGame(ROOT, 3);
        s.frames(2000);
        const before = JSON.parse(s.run('JSON.stringify({ t: gameDay * 1440 + gameHour * 60 + gameMinute, h: persons.map(p => p.hunger) })'));
        s.frames(10 * 60 * 1000, 10 * 60 * 1000);           // tab hidden for 10 minutes: one frame with a huge gap
        s.frames(100);
        const after = JSON.parse(s.run('JSON.stringify({ t: gameDay * 1440 + gameHour * 60 + gameMinute, h: persons.map(p => p.hunger) })'));
        const p = [];
        if (after.t - before.t > 5) p.push(`clock jumped ${Math.round(after.t - before.t)} game minutes`);
        after.h.forEach((h, i) => { if (before.h[i] - h > 2) p.push(`hunger dropped ${Math.round(before.h[i] - h)} points`); });
        s.run('document.hidden = true');
        s.fire('visibilitychange');
        if (!s.store.nihongomura_save) p.push('game is not saved when the page is hidden');
        return p;
    });

    check('save → load keeps progress (and maps merged words)', () => {
        const s = loadGame(ROOT, 5);
        s.frames(500);
        const p = [];
        s.run(`for (const id of LEARNABLE_WORDS.slice(0, 40)) learnWord(persons[1], { conceptId: id });`);
        const data = s.run('JSON.stringify(buildSaveData())');
        const merged = JSON.parse(s.run(`JSON.stringify(VOCABULARY.filter(w => w.same).map(w => [w.id, w.same]))`));
        const old = JSON.parse(data);
        if (merged.length) old.persons[1].knownWords.push(merged[0][0]);   // a save from before the merge
        s.run(`applySaveData(${JSON.stringify(old)})`);
        const back = JSON.parse(s.run('JSON.stringify(buildSaveData())'));
        const a = JSON.parse(data).persons[1].knownWords, b = back.persons[1].knownWords;
        for (const id of a) if (!b.includes(id)) p.push(`lost word ${id}`);
        if (merged.length && (!b.includes(merged[0][1]) || b.includes(merged[0][0]))) p.push(`old id ${merged[0][0]} not mapped to ${merged[0][1]}`);
        if (new Set(b).size !== b.length) p.push('duplicate words after load');
        return p;
    });

    check('font subset covers every character (js/glyphs.js)', () => {
        const chars = new Set();
        for (const s of g.scripts) if (s.file !== 'js/glyphs.js') for (const c of s.code.match(CJK) || []) chars.add(c);
        for (const c of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(CJK) || []) chars.add(c);
        const want = [...chars].sort().join('');
        const file = path.join(ROOT, 'js/glyphs.js');
        const have = fs.existsSync(file) ? (fs.readFileSync(file, 'utf8').match(/FONT_GLYPHS = '([^']*)'/) || [])[1] : null;
        if (have === want) return [];
        if (fix) {
            fs.writeFileSync(file, `// Nihongo Mura — every CJK character used in the game (generated by \`node tools/check.js --fix\`; do not edit).\n// js/fonts.js asks Google Fonts for a subset with just these glyphs.\nconst FONT_GLYPHS = '${want}';\n`);
            return [];
        }
        return ['js/glyphs.js is out of date — run: node tools/check.js --fix'];
    });

    let failed = 0;
    for (const r of results) {
        const ok = !r.problems.length;
        if (!ok) failed++;
        console.log(`${ok ? '✓' : '✗'} ${r.name}  (${r.ms} ms)${ok ? '' : '\n' + fmt(r.problems)}`);
    }
    console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} checks passed.`);
    process.exitCode = failed ? 1 : 0;
}

module.exports = { loadGame };
if (require.main === module) main();
