// Nihongo Mura — Web fonts: one small subset file per weight, containing only the glyphs this game uses.
// FONT_GLYPHS (js/glyphs.js) lists every CJK character in the source; `node tools/check.js --fix` regenerates it.
// Added without blocking first paint; the system fallbacks apply until (or unless) the fonts arrive.
(function loadWebFonts() {
    try {
        const src = (typeof FONT_GLYPHS === 'string' ? FONT_GLYPHS : '') + document.body.textContent;
        const set = new Set(src.match(/[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]/g) || []);
        for (let c = 0x3041; c <= 0x3096; c++) set.add(String.fromCharCode(c));   // every kana: conjugation can produce any
        for (let c = 0x30a1; c <= 0x30fa; c++) set.add(String.fromCharCode(c));
        set.add('ー');
        let latin = '';
        for (let c = 32; c < 127; c++) latin += String.fromCharCode(c);
        const text = [...set].sort().join('') + latin + 'äöüÄÖÜß„“”‘’–—…·×→';
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@700;800&family=Zen+Maru+Gothic:wght@400;500;700&display=swap&text=' + encodeURIComponent(text);
        document.head.appendChild(link);
    } catch (e) { /* fonts are decorative; system fallbacks apply */ }
})();
