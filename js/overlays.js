// Nihongo Mura — Speech bubbles, learn flashes, calligraphy and proverb overlays; learning a word

// ============================================================
//  SPEECH BUBBLE
// ============================================================
class SpeechBubble {
    constructor(person, text, conceptWords, isResponse) {
        this.person = person;
        this.text = text;
        this.kanjiText = text; // may be overridden
        this.kanaText = '';  // may be set
        this.conceptWords = conceptWords || [];
        this.isResponse = isResponse || false;
        this.life = 240;
        this.maxLife = 240;
        this.alpha = 0;
    }
    update(dt) {
        this.life -= dt * 0.5;
        if (this.life > this.maxLife - 30) {
            this.alpha = Math.min(1, this.alpha + 0.08 * dt);
        } else if (this.life < 40) {
            this.alpha = Math.max(0, this.life / 40);
        } else {
            this.alpha = 1;
        }
        return this.life > 0;
    }
    draw(ctx) {
        if (this.alpha <= 0) return;
        const s = canvasScale;
        const isVillager = !this.person.role;              // background chatter: smaller, quieter
        const hasKana = this.kanaText && !this.isResponse;
        const age = this.maxLife - this.life;
        const pop = Math.min(1, age / 9);
        const scale = REDUCED_MOTION ? 1 : 0.8 + 0.2 * easeOutBack(pop);
        const x = this.person.x * s;
        const y = (this.person.y + (this.isResponse ? -60 : -48)) * s + (REDUCED_MOTION ? 0 : (1 - pop) * 5 * s);

        const kanjiPx = Math.round((isVillager ? 11 : 13.5) * s);
        const kanaPx = Math.round(8.5 * s);
        const respPx = Math.round(10.5 * s);
        ctx.save();
        ctx.globalAlpha = this.alpha;
        let textW;
        if (this.isResponse) {
            ctx.font = `500 ${respPx}px ${UI_FONT}`;
            textW = ctx.measureText(this.text).width;
        } else {
            const coded = hasKana && this.conceptWords && this.conceptWords.length > 0;   // drawn word by word in the grammar font
            ctx.font = coded ? `bold ${kanjiPx}px ${CJK_FONT_GRAMMAR}` : `700 ${kanjiPx}px ${CJK_FONT}`;
            textW = coded ? this.conceptWords.reduce((w, cw) => w + ctx.measureText(cw.kanji || '').width, 0) : ctx.measureText(this.kanjiText).width;
            if (hasKana) { ctx.font = `500 ${kanaPx}px ${UI_FONT}`; textW = Math.max(textW, ctx.measureText(this.kanaText).width); }
        }
        const padX = 8 * s, accent = isVillager ? 0 : 2.2 * s;
        const bw = textW + padX * 2 + accent, bh = (hasKana ? 34 : isVillager ? 19 : 21) * s;
        const r = 6 * s, tail = 6 * s;

        ctx.translate(x, y);
        ctx.scale(scale, scale);
        const bx = -bw / 2, by = -bh;
        const shape = () => {                               // rounded box with a soft tail
            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.lineTo(bx + bw - r, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
            ctx.lineTo(bx + bw, by + bh - r);
            ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
            ctx.lineTo(4.5 * s, by + bh);
            ctx.quadraticCurveTo(1 * s, by + bh + tail * 0.4, -0.5 * s, by + bh + tail);
            ctx.quadraticCurveTo(-1.5 * s, by + bh + tail * 0.3, -4.5 * s, by + bh);
            ctx.lineTo(bx + r, by + bh);
            ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
            ctx.lineTo(bx, by + r);
            ctx.quadraticCurveTo(bx, by, bx + r, by);
            ctx.closePath();
        };
        // shadow, body, edge
        ctx.save(); ctx.translate(1.2 * s, 2 * s); shape(); ctx.fillStyle = 'rgba(20,14,8,0.22)'; ctx.fill(); ctx.restore();
        shape();
        ctx.fillStyle = this.isResponse ? 'rgba(30,26,22,0.92)' : isVillager ? 'rgba(232,222,198,0.9)' : '#e9dec4';
        ctx.fill();
        ctx.strokeStyle = this.isResponse ? 'rgba(243,234,216,0.16)' : 'rgba(60,44,26,0.4)';
        ctx.lineWidth = 0.8 * s;
        ctx.stroke();
        if (accent) {                                        // indigo for the speaker, vermilion for the learner
            ctx.save(); shape(); ctx.clip();
            ctx.fillStyle = this.isResponse ? '#c0503a' : '#3d5f86';
            ctx.fillRect(bx, by, accent, bh);
            ctx.restore();
        }
        const cx = accent / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (hasKana) {
            if (this.conceptWords && this.conceptWords.length > 0) {
                _drawColorCodedKanji(ctx, this.conceptWords, cx, by + bh * 0.37, kanjiPx, true);
            } else {
                ctx.font = `700 ${kanjiPx}px ${CJK_FONT}`;
                ctx.fillStyle = '#2b2018';
                ctx.fillText(this.kanjiText, cx, by + bh * 0.37);
            }
            ctx.font = `500 ${kanaPx}px ${UI_FONT}`;
            ctx.fillStyle = '#7a6a54';
            ctx.textAlign = 'center';
            ctx.fillText(this.kanaText, cx, by + bh * 0.75);
        } else if (this.isResponse) {
            ctx.font = `500 ${respPx}px ${UI_FONT}`;
            ctx.fillStyle = '#ece2cb';
            ctx.fillText(this.text, cx, by + bh / 2 + 0.5 * s);
        } else {
            ctx.font = `700 ${kanjiPx}px ${CJK_FONT}`;
            ctx.fillStyle = '#2b2018';
            ctx.fillText(this.text, cx, by + bh / 2 + 0.5 * s);
        }
        ctx.restore();
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ============================================================
//  LEARN FLASH (visual feedback)
// ============================================================
class LearnFlash {
    constructor(x, y, word) {
        this.x = x;
        this.y = y;
        const m = /^(.*?)\s*\((.*)\)$/.exec(word);
        this.kanji = m ? m[1] : word;
        this.kana = m ? m[2] : '';
        this.life = 120;
        this.maxLife = 120;
        this.vy = -0.32;
        this.drops = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2 + Math.random() * 0.5, d: 6 + Math.random() * 9, r: 0.8 + Math.random() * 1.6 }));
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
        return this.life > 0;
    }
    draw(ctx) {
        const s = canvasScale;
        const t = 1 - this.life / this.maxLife;
        ctx.save();
        // Ink splash where the word lands
        if (t < 0.3) {
            const k = t / 0.3;
            ctx.fillStyle = `rgba(31,23,18,${0.55 * (1 - k)})`;
            ctx.beginPath();
            ctx.arc(this.x * s, (this.y + 14) * s, (3 + k * 6) * s, 0, Math.PI * 2);
            ctx.fill();
            for (const d of this.drops) {
                ctx.beginPath();
                ctx.arc((this.x + Math.cos(d.a) * d.d * (0.4 + k)) * s, (this.y + 14 + Math.sin(d.a) * d.d * 0.6 * (0.4 + k)) * s, d.r * s * (1 - k * 0.5), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // Tag: vermilion seal + the word, rising and fading
        const a = Math.min(1, t / 0.1) * Math.min(1, this.life / 30);
        ctx.globalAlpha = a;
        const kanjiPx = Math.round(12 * s), kanaPx = Math.round(8 * s);
        ctx.font = `700 ${kanjiPx}px ${CJK_FONT}`;
        const kw = ctx.measureText(this.kanji).width;
        ctx.font = `500 ${kanaPx}px ${UI_FONT}`;
        const nw = this.kana ? ctx.measureText(this.kana).width + 5 * s : 0;
        const seal = 13 * s, h = 18 * s, w = seal + 6 * s + kw + nw + 8 * s;
        const x0 = this.x * s - w / 2, y0 = this.y * s - h / 2;
        inkCard(ctx, x0, y0, w, h, 5 * s, 'rgba(134,171,111,0.55)');
        hanko(ctx, x0 + 3 * s + seal / 2, y0 + h / 2, seal, '覚', -0.06);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = `700 ${kanjiPx}px ${CJK_FONT}`;
        ctx.fillStyle = '#f3ead8';
        ctx.fillText(this.kanji, x0 + seal + 7 * s, y0 + h / 2 + 0.5 * s);
        if (this.kana) {
            ctx.font = `500 ${kanaPx}px ${UI_FONT}`;
            ctx.fillStyle = '#9fc08a';
            ctx.fillText(this.kana, x0 + seal + 7 * s + kw + 5 * s, y0 + h / 2 + 0.5 * s);
        }
        ctx.restore();
    }
}

// ============================================================
//  CALLIGRAPHY OVERLAY (書道 shodō — brush stroke animation)
// ============================================================
const CJK_FONT = "'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif";
const UI_FONT = "'Zen Maru Gothic','Hiragino Maru Gothic ProN','Hiragino Sans','Noto Sans JP',system-ui,sans-serif";
const INK_COLOR = '#1f1712';
const PARCHMENT_BG = '#e6d9bd';       // toned washi — warm, never glaring white
const PARCHMENT_BORDER = '#b89a68';

// ---- Shared overlay pieces: toned paper card, ink card, hanko seal ----
let _cardGrain = null;
function paperCard(ctx, x, y, w, h, r) {
    const s = canvasScale;
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,8,0.28)';
    roundRect(ctx, x + 1.5 * s, y + 2.5 * s, w, h, r);
    ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#ebdfc4');
    g.addColorStop(1, '#ddcdab');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (!_cardGrain) _cardGrain = ctx.createPattern(_getGrainTile(), 'repeat');
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha *= 0.18;
    ctx.fillStyle = _cardGrain;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,44,26,0.35)';
    ctx.lineWidth = 0.8 * s;
    roundRect(ctx, x + 0.5 * s, y + 0.5 * s, w - s, h - s, r);
    ctx.stroke();
    ctx.restore();
}
function inkCard(ctx, x, y, w, h, r, edge) {
    const s = canvasScale;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, x + 1.5 * s, y + 3 * s, w, h, r);
    ctx.fill();
    ctx.fillStyle = 'rgba(29,25,20,0.95)';
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = edge || 'rgba(243,234,216,0.14)';
    ctx.lineWidth = s;
    ctx.stroke();
    ctx.restore();
}
function hanko(ctx, cx, cy, size, ch, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot === undefined ? -0.08 : rot);
    ctx.fillStyle = 'rgba(190,52,36,0.92)';
    roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,220,0.35)';
    ctx.lineWidth = size * 0.05;
    roundRect(ctx, -size * 0.38, -size * 0.38, size * 0.76, size * 0.76, size * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#fbefe2';
    ctx.font = `800 ${Math.round(size * 0.58)}px ${CJK_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, size * 0.04);
    ctx.restore();
}
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

class CalligraphyOverlay {
    constructor(kanji, kana, german) {
        this.kanji = kanji;
        this.kana = kana;
        this.german = german;
        this.life = 300; // ~5 seconds at 60fps
        this.maxLife = 300;
        this.revealProgress = 0;
        this.inkDrops = [];
        // Position in world coords (flush right with small margin to panel)
        this.ww = 160;
        this.wh = 200;
        this.wx = WORLD_W - this.ww - 5;
        this.wy = 15;
        // Pre-render character to offscreen canvas
        this.offCanvas = document.createElement('canvas');
        this.offCanvas.width = 192;
        this.offCanvas.height = 192;
        this.offCtx = this.offCanvas.getContext('2d');
        this._renderCharacter();
        // Generate ink drops for decoration
        for (let i = 0; i < 6; i++) {
            this.inkDrops.push({
                x: Math.random() * 0.8 + 0.1,
                y: Math.random() * 0.8 + 0.1,
                r: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.15 + 0.05,
                delay: Math.random() * 0.6,
            });
        }
    }

    _renderCharacter() {
        const c = this.offCtx;
        const s = 192;
        c.clearRect(0, 0, s, s);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        // Auto-scale font size based on character count
        const len = this.kanji.length;
        let fontSize = len <= 1 ? 130 : len === 2 ? 85 : len === 3 ? 65 : Math.max(38, Math.floor(160 / len));
        // Measure and shrink further if needed
        c.font = `bold ${fontSize}px ${CJK_FONT}`;
        const measured = c.measureText(this.kanji).width;
        if (measured > s * 0.9) {
            fontSize = Math.floor(fontSize * (s * 0.9) / measured);
            c.font = `bold ${fontSize}px ${CJK_FONT}`;
        }
        // Ink bleed: draw twice with offset (heavy mincho reads like a brushed character)
        c.font = c.font.replace('bold', '800');
        c.fillStyle = INK_COLOR;
        c.globalAlpha = 0.25;
        c.fillText(this.kanji, s / 2 + 1, s / 2 + 1);
        c.globalAlpha = 1.0;
        c.fillText(this.kanji, s / 2, s / 2);
    }

    update(dt) {
        this.life -= dt;
        // Reveal: ramps 0→1 over first 60% of life
        const revealEnd = this.maxLife * 0.6;
        const elapsed = this.maxLife - this.life;
        this.revealProgress = Math.min(1, elapsed / revealEnd);
        return this.life > 0;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const s = canvasScale;
        // Fade in/out
        let alpha = 1;
        const elapsed = this.maxLife - this.life;
        if (elapsed < this.maxLife * 0.12) alpha = elapsed / (this.maxLife * 0.12);
        if (this.life < this.maxLife * 0.18) alpha = this.life / (this.maxLife * 0.18);

        ctx.save();
        ctx.globalAlpha = alpha * 0.95;

        // Use actual canvas width so overlay sits flush-right even on wide screens
        const cw = canvas.width / dpr;
        const w = this.ww * s;
        const h = this.wh * s;
        const x = cw - w - 10 * s;
        const y = this.wy * s;

        // Toned washi card
        paperCard(ctx, x, y, w, h, 6 * s);
        ctx.globalAlpha = alpha * 0.95;

        // Character area (centered in upper portion of parchment)
        const charAreaX = x + (w - 100 * s) / 2;
        const charAreaY = y + 20 * s;
        const charAreaW = 100 * s;
        const charAreaH = 100 * s;

        // Progressive brush reveal with clipping
        ctx.save();
        ctx.beginPath();
        const rp = this.revealProgress;

        if (rp < 0.25) {
            // Phase 1: Top-left vertical stroke downward
            const ph = rp / 0.25;
            const clipW = charAreaW * 0.4;
            const clipH = charAreaH * ph;
            this._brushClip(ctx, charAreaX, charAreaY, clipW, clipH, s);
        } else if (rp < 0.55) {
            // Phase 2: Expand rightward
            const ph = (rp - 0.25) / 0.3;
            const clipW = charAreaW * (0.4 + 0.6 * ph);
            const clipH = charAreaH * (0.6 + 0.2 * ph);
            this._brushClip(ctx, charAreaX, charAreaY, clipW, clipH, s);
        } else if (rp < 0.8) {
            // Phase 3: Fill bottom
            const ph = (rp - 0.55) / 0.25;
            const clipW = charAreaW;
            const clipH = charAreaH * (0.8 + 0.2 * ph);
            this._brushClip(ctx, charAreaX, charAreaY, clipW, clipH, s);
        } else {
            // Phase 4: Full character
            ctx.rect(charAreaX - 2 * s, charAreaY - 2 * s, charAreaW + 4 * s, charAreaH + 4 * s);
        }
        ctx.clip();

        // Draw the pre-rendered character
        ctx.drawImage(this.offCanvas, charAreaX, charAreaY, charAreaW, charAreaH);

        // Ink drops that appear during reveal
        for (const drop of this.inkDrops) {
            if (rp > drop.delay) {
                ctx.globalAlpha = alpha * drop.alpha * Math.min(1, (rp - drop.delay) * 3);
                ctx.beginPath();
                ctx.arc(
                    charAreaX + drop.x * charAreaW,
                    charAreaY + drop.y * charAreaH,
                    drop.r * s, 0, Math.PI * 2
                );
                ctx.fillStyle = INK_COLOR;
                ctx.fill();
            }
        }
        ctx.restore();

        // Reading and meaning
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `500 ${Math.round(12 * s)}px ${UI_FONT}`;
        ctx.fillStyle = '#4a3828';
        ctx.fillText(this.kana, x + w / 2, y + 134 * s);
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 22 * s, y + 147 * s);
        ctx.lineTo(x + w / 2 + 22 * s, y + 147 * s);
        ctx.strokeStyle = 'rgba(90,64,40,0.3)';
        ctx.lineWidth = 0.7 * s;
        ctx.stroke();
        ctx.font = `700 ${Math.round(11 * s)}px ${UI_FONT}`;
        ctx.fillStyle = '#7a5434';
        ctx.fillText(this.german, x + w / 2, y + 160 * s);
        // Seal: "learned"
        hanko(ctx, x + w - 17 * s, y + h - 17 * s, 18 * s, '覚');

        ctx.restore();
    }

    _brushClip(ctx, bx, by, bw, bh, s) {
        // Create ragged brush-edge clipping path using overlapping circles
        ctx.rect(bx, by, bw - 4 * s, bh - 4 * s);
        // Ragged right edge
        const steps = 8;
        for (let i = 0; i <= steps; i++) {
            const cy = by + (bh - 4 * s) * (i / steps);
            const cx = bx + bw - 4 * s + (Math.sin(i * 2.3 + bw * 0.1) * 3) * s;
            ctx.moveTo(cx + 4 * s, cy);
            ctx.arc(cx, cy, 4 * s, 0, Math.PI * 2);
        }
        // Ragged bottom edge
        for (let i = 0; i <= steps; i++) {
            const cx = bx + (bw - 4 * s) * (i / steps);
            const cy = by + bh - 4 * s + (Math.cos(i * 1.7 + bh * 0.1) * 3) * s;
            ctx.moveTo(cx + 4 * s, cy);
            ctx.arc(cx, cy, 4 * s, 0, Math.PI * 2);
        }
    }
}

// ============================================================
//  PROVERB OVERLAY (ことわざ kotowaza — milestone calligraphy)
// ============================================================
class ProverbOverlay {
    constructor(proverb) {
        this.chars = [...proverb.chars]; // Array of individual characters
        this.kana = proverb.kana;
        this.german = proverb.german;
        this.milestone = proverb.words;
        this.charCount = this.chars.length;
        // Timing: ~0.8s per char reveal + 3s hold + 2s fade
        this.revealPerChar = 48; // frames per character reveal
        this.holdTime = 180; // frames to hold fully revealed
        this.fadeOutTime = 120; // frames to fade out
        this.totalLife = this.charCount * this.revealPerChar + this.holdTime + this.fadeOutTime;
        this.life = this.totalLife;
        this.maxLife = this.totalLife;
        // Pre-render each character
        this.offCanvases = this.chars.map(ch => {
            const oc = document.createElement('canvas');
            oc.width = 96;
            oc.height = 96;
            const octx = oc.getContext('2d');
            octx.textAlign = 'center';
            octx.textBaseline = 'middle';
            octx.font = `800 72px ${CJK_FONT}`;
            octx.fillStyle = INK_COLOR;
            octx.globalAlpha = 0.2;
            octx.fillText(ch, 49, 49);
            octx.globalAlpha = 1.0;
            octx.fillText(ch, 48, 48);
            return oc;
        });
    }

    update(dt) {
        this.life -= dt;
        return this.life > 0;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const s = canvasScale;
        const elapsed = this.maxLife - this.life;

        // Overall alpha: fade in first 60 frames, fade out last fadeOutTime frames
        let alpha = 1;
        if (elapsed < 60) alpha = elapsed / 60;
        if (this.life < this.fadeOutTime) alpha = this.life / this.fadeOutTime;

        ctx.save();

        // Semi-transparent backdrop (full canvas, not just world area)
        const cw = canvas.width / dpr;
        const ch = canvas.height / dpr;
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = '#0d0b09';
        ctx.fillRect(0, 0, cw, ch);

        ctx.globalAlpha = alpha;

        // Silk banner background (centered on full canvas)
        const charSize = 42 * s;
        const charGap = 6 * s;
        const totalCharsW = this.charCount * (charSize + charGap) - charGap;
        const bannerW = Math.min(totalCharsW + 60 * s, cw - 40 * s);
        const bannerH = 160 * s;
        const bannerX = (cw - bannerW) / 2;
        const bannerY = (ch - bannerH) / 2 - 20 * s;

        // Hanging-scroll mount: indigo silk border around toned paper
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(ctx, bannerX - 8 * s + 2 * s, bannerY - 8 * s + 4 * s, bannerW + 16 * s, bannerH + 16 * s, 8 * s);
        ctx.fill();
        ctx.fillStyle = '#26344a';
        roundRect(ctx, bannerX - 8 * s, bannerY - 8 * s, bannerW + 16 * s, bannerH + 16 * s, 8 * s);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201,154,58,0.6)';
        ctx.lineWidth = 0.8 * s;
        ctx.stroke();
        paperCard(ctx, bannerX, bannerY, bannerW, bannerH, 3 * s);
        ctx.globalAlpha = alpha;

        // Milestone label
        ctx.font = `700 ${Math.round(9.5 * s)}px ${UI_FONT}`;
        ctx.fillStyle = '#a2402c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.milestone} Wörter gelernt`, cw / 2, bannerY + 17 * s);

        // Draw characters sequentially
        const charsStartX = (cw - totalCharsW) / 2;
        const charsY = bannerY + 32 * s;

        for (let i = 0; i < this.charCount; i++) {
            const charElapsed = elapsed - i * this.revealPerChar;
            if (charElapsed <= 0) continue; // Not yet revealed

            const charProgress = Math.min(1, charElapsed / this.revealPerChar);
            const cx = charsStartX + i * (charSize + charGap);

            ctx.save();

            // Clip for progressive reveal (top-to-bottom sweep)
            ctx.beginPath();
            const revealH = charSize * charProgress;
            ctx.rect(cx - 2 * s, charsY - 2 * s, charSize + 4 * s, revealH + 4 * s);
            // Ragged bottom edge
            for (let j = 0; j < 5; j++) {
                const bx = cx + charSize * (j / 4);
                const by = charsY + revealH + Math.sin(j * 2.1 + i) * 3 * s;
                ctx.moveTo(bx + 3 * s, by);
                ctx.arc(bx, by, 3 * s, 0, Math.PI * 2);
            }
            ctx.clip();

            // Draw pre-rendered character
            ctx.globalAlpha = alpha;
            ctx.drawImage(this.offCanvases[i], cx, charsY, charSize, charSize);

            ctx.restore();
        }

        // Kana (below characters, appears after all revealed)
        const allRevealed = elapsed > this.charCount * this.revealPerChar;
        if (allRevealed) {
            const textAlpha = Math.min(1, (elapsed - this.charCount * this.revealPerChar) / 40);
            ctx.globalAlpha = alpha * textAlpha;
            ctx.font = `500 ${Math.round(11 * s)}px ${UI_FONT}`;
            ctx.fillStyle = '#4a3828';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.kana, cw / 2, bannerY + 88 * s);

            // German translation
            ctx.font = `700 ${Math.round(11 * s)}px ${UI_FONT}`;
            ctx.fillStyle = '#7a5434';
            ctx.fillText(this.german, cw / 2, bannerY + 105 * s);

            // Decorative divider
            ctx.beginPath();
            ctx.moveTo(bannerX + 30 * s, bannerY + 118 * s);
            ctx.lineTo(bannerX + bannerW - 30 * s, bannerY + 118 * s);
            ctx.strokeStyle = 'rgba(180,140,80,0.3)';
            ctx.lineWidth = 0.5 * s;
            ctx.stroke();

            // Source attribution
            ctx.font = `500 ${Math.round(9 * s)}px ${UI_FONT}`;
            ctx.fillStyle = '#8a7660';
            ctx.fillText('— Japanisches Sprichwort (ことわざ)', cw / 2, bannerY + 132 * s);
            hanko(ctx, bannerX + bannerW - 20 * s, bannerY + bannerH - 20 * s, 20 * s, '諺');
        }

        ctx.restore();
    }
}

// --- Calligraphy trigger functions ---
function triggerCalligraphy(kanji, kana, german) {
    // Queue words for sequential display (one at a time)
    calligraphyQueue.push({ kanji, kana, german });
    // If nothing is currently showing, start immediately
    if (calligraphyOverlays.length === 0) {
        _advanceCalligraphyQueue();
    }
}

function _advanceCalligraphyQueue() {
    if (calligraphyQueue.length === 0) return;
    const next = calligraphyQueue.shift();
    calligraphyOverlays = [new CalligraphyOverlay(next.kanji, next.kana, next.german)];
}

function checkProverbMilestone(wordCount) {
    for (const p of PROVERBS) {
        if (p.words === wordCount && !proverbMilestonesHit.has(p.words)) {
            proverbMilestonesHit.add(p.words);
            proverbOverlay = new ProverbOverlay(p);
            addLog(`Meilenstein: ${p.chars} — ${p.german}`, 'learn');
            sfx('learn');
            break;
        }
    }
}

// --- Consolidated learn-word helper ---
function learnWord(learner, w) {
    // Grammar particles are structural, not learnable content
    if (w.type === 'particle' || !vocab[w.conceptId] || vocab[w.conceptId].type === 'particle') return;
    const id = canonWord(w.conceptId);                                    // 聞く heard as "fragen" is the same word as "hören"
    if (learner.knownWords.has(id)) return;
    w = Object.assign({ conceptId: id }, vocab[id]);   // dictionary form (食べる), not the inflected one (食べて)
    learner.knownWords.add(w.conceptId);
    learner.wordHistory.push(w.conceptId);
    vocabHistory.push({ day: gameDay, tick: gameTick });
    sfx('learn');
    learnFlashes.push(new LearnFlash(
        learner.x + randFloat(-10, 10), learner.y - 25,
        w.kanji + ' (' + w.kana + ')'
    ));
    addLog(`${learner.name} lernt: ${w.kanji} [${w.kana}] (${w.de})`, 'learn');
    triggerCalligraphy(w.kanji, w.kana, w.de);
    checkProverbMilestone(learner.knownWords.size);
}
