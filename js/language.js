// Nihongo Mura — Language engine: meaning frames → natural Japanese and German

// ============================================================
//  GRAMMAR SYSTEM — Japanese SOV, verb conjugation, particles
// ============================================================
const CJK_FONT_GRAMMAR = "'Shippori Mincho','Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif";
const ROLE_COLORS = {
    noun:     '#d4a030', // gold
    verb:     '#5aaa5a', // green
    mod:      '#6a9fd8', // blue
    pronoun:  '#c8b888', // warm beige
    particle: '#9a88bb', // muted lavender
    unknown:  '#2a2010', // default dark
};
// Bubble-on-light colors (speaker bubble has light bg)
const ROLE_COLORS_LIGHT = {
    noun:     '#9a6a00', // darker gold
    verb:     '#2a7a2a', // darker green
    mod:      '#3060a8', // darker blue
    pronoun:  '#5a4a2a', // dark beige
    particle: '#6050a0', // darker lavender
    unknown:  '#2a2010',
};

function getGrammarTier() {
    if (persons.length < 2) return 0;
    const known = persons[1].knownWords.size;
    const day = gameDay;
    if (known < 15 || day <= 2) return 0;
    if (known < 40 || day <= 5) return 1;
    if (known < 80 || day <= 10) return 2;
    if (known < 130 || day <= 20) return 3;
    return 4;
}

// ============================================================
//  VERB CONJUGATION ENGINE (Japanese)
// ============================================================

// Godan ending kana → row mappings
// Each entry: [i-row (masu stem), a-row (nai stem), te/ta ending, potential ending, volitional ending]
const GODAN_MAP = {
    // kana:  [ i-row,  a-row,  te,     ta,     potential, volitional ]
    'う': { i: 'い', a: 'わ', te: 'って', ta: 'った', pot: 'える', vol: 'おう' },
    'く': { i: 'き', a: 'か', te: 'いて', ta: 'いた', pot: 'ける', vol: 'こう' },
    'ぐ': { i: 'ぎ', a: 'が', te: 'いで', ta: 'いだ', pot: 'げる', vol: 'ごう' },
    'す': { i: 'し', a: 'さ', te: 'して', ta: 'した', pot: 'せる', vol: 'そう' },
    'つ': { i: 'ち', a: 'た', te: 'って', ta: 'った', pot: 'てる', vol: 'とう' },
    'ぬ': { i: 'に', a: 'な', te: 'んで', ta: 'んだ', pot: 'ねる', vol: 'のう' },
    'ぶ': { i: 'び', a: 'ば', te: 'んで', ta: 'んだ', pot: 'べる', vol: 'ぼう' },
    'む': { i: 'み', a: 'ま', te: 'んで', ta: 'んだ', pot: 'める', vol: 'もう' },
    'る': { i: 'り', a: 'ら', te: 'って', ta: 'った', pot: 'れる', vol: 'ろう' },
};

// Romaji ending → conjugation stem mappings for godan
const GODAN_ROMAJI_MAP = {
    'u':  { i: 'i',   a: 'wa',  te: 'tte',  ta: 'tta',  pot: 'eru',  vol: 'ou' },
    'ku': { i: 'ki',  a: 'ka',  te: 'ite',  ta: 'ita',  pot: 'keru', vol: 'kou' },
    'gu': { i: 'gi',  a: 'ga',  te: 'ide',  ta: 'ida',  pot: 'geru', vol: 'gou' },
    'su': { i: 'shi', a: 'sa',  te: 'shite', ta: 'shita', pot: 'seru', vol: 'sou' },
    'tsu':{ i: 'chi', a: 'ta',  te: 'tte',  ta: 'tta',  pot: 'teru', vol: 'tou' },
    'nu': { i: 'ni',  a: 'na',  te: 'nde',  ta: 'nda',  pot: 'neru', vol: 'nou' },
    'bu': { i: 'bi',  a: 'ba',  te: 'nde',  ta: 'nda',  pot: 'beru', vol: 'bou' },
    'mu': { i: 'mi',  a: 'ma',  te: 'nde',  ta: 'nda',  pot: 'meru', vol: 'mou' },
    'ru': { i: 'ri',  a: 'ra',  te: 'tte',  ta: 'tta',  pot: 'reru', vol: 'rou' },
};

// Helper: get the romaji ending key for a godan verb
function _godanRomajiEnding(romaji) {
    if (romaji.endsWith('tsu')) return 'tsu';
    if (romaji.endsWith('su')) return 'su';
    if (romaji.endsWith('ku')) return 'ku';
    if (romaji.endsWith('gu')) return 'gu';
    if (romaji.endsWith('nu')) return 'nu';
    if (romaji.endsWith('bu')) return 'bu';
    if (romaji.endsWith('mu')) return 'mu';
    if (romaji.endsWith('ru')) return 'ru';
    if (romaji.endsWith('u')) return 'u';
    return 'u'; // fallback
}

// Helper: length of romaji ending to strip
function _godanRomajiStripLen(ending) {
    return ending.length; // 'tsu' → 3, 'ku' → 2, 'u' → 1, etc.
}

function conjugateIchidan(verbEntry, form) {
    // Ichidan: drop final る (kana), last char (kanji), 'ru' (romaji), then add suffix
    const kanjiStem = verbEntry.kanji.slice(0, -1);
    const kanaStem = verbEntry.kana.slice(0, -1); // drop る
    const romajiStem = verbEntry.romaji.endsWith('ru') ? verbEntry.romaji.slice(0, -2) : verbEntry.romaji;

    const suffixes = {
        masu:           { kanji: 'ます',         kana: 'ます',         romaji: 'masu' },
        masen:          { kanji: 'ません',       kana: 'ません',       romaji: 'masen' },
        te:             { kanji: 'て',           kana: 'て',           romaji: 'te' },
        ta:             { kanji: 'た',           kana: 'た',           romaji: 'ta' },
        nai:            { kanji: 'ない',         kana: 'ない',         romaji: 'nai' },
        mashita:        { kanji: 'ました',       kana: 'ました',       romaji: 'mashita' },
        masendeshita:   { kanji: 'ませんでした', kana: 'ませんでした', romaji: 'masendeshita' },
        potential:      { kanji: 'られる',       kana: 'られる',       romaji: 'rareru' },
        volitional:     { kanji: 'よう',         kana: 'よう',         romaji: 'you' },
    };

    const suf = suffixes[form];
    if (!suf) return { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };

    return {
        kanji:  kanjiStem + suf.kanji,
        kana:   kanaStem + suf.kana,
        romaji: romajiStem + suf.romaji,
    };
}

function conjugateGodan(verbEntry, form) {
    // Godan: final kana determines conjugation row
    const lastKana = verbEntry.kana.slice(-1);
    const row = GODAN_MAP[lastKana];
    if (!row) return { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };

    const kanjiStem = verbEntry.kanji.slice(0, -1);
    const kanaStem = verbEntry.kana.slice(0, -1);

    // Romaji stem
    const rEnding = _godanRomajiEnding(verbEntry.romaji);
    const rMap = GODAN_ROMAJI_MAP[rEnding];
    const romajiStem = verbEntry.romaji.slice(0, -_godanRomajiStripLen(rEnding));

    // Special case: 行く (iku) → 行って (itte), not 行いて
    const isIku = (verbEntry.kana === 'いく' || verbEntry.kana === 'ゆく');

    switch (form) {
        case 'masu':
            return { kanji: kanjiStem + row.i + 'ます', kana: kanaStem + row.i + 'ます', romaji: romajiStem + rMap.i + 'masu' };
        case 'masen':
            return { kanji: kanjiStem + row.i + 'ません', kana: kanaStem + row.i + 'ません', romaji: romajiStem + rMap.i + 'masen' };
        case 'mashita':
            return { kanji: kanjiStem + row.i + 'ました', kana: kanaStem + row.i + 'ました', romaji: romajiStem + rMap.i + 'mashita' };
        case 'masendeshita':
            return { kanji: kanjiStem + row.i + 'ませんでした', kana: kanaStem + row.i + 'ませんでした', romaji: romajiStem + rMap.i + 'masendeshita' };
        case 'te':
            if (isIku) return { kanji: kanjiStem + 'って', kana: 'いって', romaji: 'itte' };
            return { kanji: kanjiStem + row.te, kana: kanaStem + row.te, romaji: romajiStem + rMap.te };
        case 'ta':
            if (isIku) return { kanji: kanjiStem + 'った', kana: 'いった', romaji: 'itta' };
            return { kanji: kanjiStem + row.ta, kana: kanaStem + row.ta, romaji: romajiStem + rMap.ta };
        case 'nai':
            return { kanji: kanjiStem + row.a + 'ない', kana: kanaStem + row.a + 'ない', romaji: romajiStem + rMap.a + 'nai' };
        case 'potential':
            return { kanji: kanjiStem + row.pot, kana: kanaStem + row.pot, romaji: romajiStem + rMap.pot };
        case 'volitional':
            return { kanji: kanjiStem + row.vol, kana: kanaStem + row.vol, romaji: romajiStem + rMap.vol };
        default:
            return { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };
    }
}

function conjugateIrregular(verbEntry, form) {
    const isSuru = (verbEntry.kana === 'する' || verbEntry.kana.endsWith('する'));
    const isKuru = (verbEntry.kana === 'くる' || verbEntry.kana === 'きます');

    if (isSuru) {
        // Handle compound する verbs (e.g. 勉強する benkyou suru)
        const isCompound = verbEntry.kana.length > 2 && verbEntry.kana.endsWith('する');
        const kanjiPrefix = isCompound ? verbEntry.kanji.slice(0, -2) : '';
        const kanaPrefix = isCompound ? verbEntry.kana.slice(0, -2) : '';
        const romajiPrefix = isCompound ? verbEntry.romaji.replace(/suru$/, '') : '';

        const forms = {
            masu:           { kanji: kanjiPrefix + 'します',         kana: kanaPrefix + 'します',         romaji: romajiPrefix + 'shimasu' },
            masen:          { kanji: kanjiPrefix + 'しません',       kana: kanaPrefix + 'しません',       romaji: romajiPrefix + 'shimasen' },
            te:             { kanji: kanjiPrefix + 'して',           kana: kanaPrefix + 'して',           romaji: romajiPrefix + 'shite' },
            ta:             { kanji: kanjiPrefix + 'した',           kana: kanaPrefix + 'した',           romaji: romajiPrefix + 'shita' },
            nai:            { kanji: kanjiPrefix + 'しない',         kana: kanaPrefix + 'しない',         romaji: romajiPrefix + 'shinai' },
            mashita:        { kanji: kanjiPrefix + 'しました',       kana: kanaPrefix + 'しました',       romaji: romajiPrefix + 'shimashita' },
            masendeshita:   { kanji: kanjiPrefix + 'しませんでした', kana: kanaPrefix + 'しませんでした', romaji: romajiPrefix + 'shimasendeshita' },
            potential:      { kanji: kanjiPrefix + 'できる',         kana: kanaPrefix + 'できる',         romaji: romajiPrefix + 'dekiru' },
            volitional:     { kanji: kanjiPrefix + 'しよう',         kana: kanaPrefix + 'しよう',         romaji: romajiPrefix + 'shiyou' },
        };
        return forms[form] || { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };
    }

    if (isKuru) {
        const forms = {
            masu:           { kanji: '来ます',         kana: 'きます',         romaji: 'kimasu' },
            masen:          { kanji: '来ません',       kana: 'きません',       romaji: 'kimasen' },
            te:             { kanji: '来て',           kana: 'きて',           romaji: 'kite' },
            ta:             { kanji: '来た',           kana: 'きた',           romaji: 'kita' },
            nai:            { kanji: '来ない',         kana: 'こない',         romaji: 'konai' },
            mashita:        { kanji: '来ました',       kana: 'きました',       romaji: 'kimashita' },
            masendeshita:   { kanji: '来ませんでした', kana: 'きませんでした', romaji: 'kimasendeshita' },
            potential:      { kanji: '来られる',       kana: 'こられる',       romaji: 'korareru' },
            volitional:     { kanji: '来よう',         kana: 'こよう',         romaji: 'koyou' },
        };
        return forms[form] || { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };
    }

    // Unknown irregular — return dictionary form
    return { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };
}

function conjugateVerb(verbEntry, form) {
    // verbEntry: { kanji, kana, romaji, vclass }
    // form: 'dict', 'masu', 'masen', 'te', 'ta', 'nai', 'mashita', 'masendeshita', 'potential', 'volitional'
    // Returns: { kanji, kana, romaji }
    const vc = verbEntry.vclass;
    if (!vc) return { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };
    if (form === 'dict') return { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };

    if (vc === 'ichidan') return conjugateIchidan(verbEntry, form);
    if (vc === 'godan') return conjugateGodan(verbEntry, form);
    if (vc === 'irregular') return conjugateIrregular(verbEntry, form);
    return { kanji: verbEntry.kanji, kana: verbEntry.kana, romaji: verbEntry.romaji };
}

// ============================================================
//  LANGUAGE ENGINE — meaning frames → natural Japanese + German
// ============================================================
// Every utterance is planned as a meaning frame (who does what, to whom, where, when, how),
// then realised separately in Japanese (for the bubble and for learning) and in German
// (for the learner's reply). Grammar tiers add complexity; they never remove correctness.

// ---- Word classes for the catch-all 'mod' type ----
const LX_CLASS = {};
for (const id of ['very','really','extremely','together','together2']) LX_CLASS[id] = 'adv';
// sentence adverbs: stand before the verb or adjective (私はいつもお茶を飲みます · まだ眠いです)
for (const id of ['also','already','still','always','sometimes','alittle','slowly']) LX_CLASS[id] = 'sadv';
for (const id of ['now','today','tomorrow','yesterday','everyday']) LX_CLASS[id] = 'time';
for (const id of ['here','there','up','down','front','behind','inside','outside']) LX_CLASS[id] = 'place';
for (const id of ['yes','no','hello','goodbye','please','thanks','sorry','welcome','yourewelcome','nevermind','goforit',
    'goodmorning','goodevening','goodnight','itadakimasu','gochisousama','ittekimasu','tadaima','sumimasen','otsukare']) LX_CLASS[id] = 'intj';
for (const id of ['should','can','may','will','want','like','have']) LX_CLASS[id] = 'modal';
for (const id of ['one','two','three','four','five','six','seven','eight','nine','ten','hundred']) LX_CLASS[id] = 'num';
for (const id of ['howmany','howmany2']) LX_CLASS[id] = 'qw';
for (const id of ['if','because','therefore']) LX_CLASS[id] = 'conj';
for (const id of ['every','sundry','cleanup','exercise','belate']) LX_CLASS[id] = 'misc';
const TIME_NOUNS = new Set(['morning','night','day','spring','summer','autumn','winter','year','month','evening','noon']);
const SEASONS = new Set(['spring','summer','autumn','winter']);
const TIME_NI = new Set(['night','noon','evening','spring','summer','autumn','winter']);   // 夜に / 春に before a verb (朝 stands alone)
const ANIMATE = new Set(['dog','cat','bird','chicken','rabbit','frog','butterfly','horse','cow','crane','insect','sheep','snake','tanuki',
    'person','friend','child','teacher','student','doctor','neighbor','boy','girl','mother','father','brother','sister','son','daughter','fish','god',
    'fox','monkey','deer','turtle','sparrow','crow','duck','firefly','cicada','samurai','merchant','farmer','fisherman','monk','traveler','grandmother','grandfather','baby','guest'
]);
const PLACE_NOUNS = new Set(['home','house','garden','village','road','country','field','forest','river','lake','mountain','bridge','sky','water',
    'room','kitchen','teahouse','market','shrine','school','shop','shore','pagoda','stable','well2','fish_pond','onsen','workshop','tree','sun',
    'sea'
]);
function lxClass(id) {
    const v = vocab[id];
    if (!v) return '?';
    if (v.type === 'mod') return LX_CLASS[id] || 'adj';
    if (v.type === 'pronoun') return ['who','what','where','how','why'].includes(id) ? 'qw' : 'pro';
    if (v.type === 'noun') return TIME_NOUNS.has(id) ? 'tnoun' : 'noun';
    return v.type;            // verb, particle
}

// ---- Japanese adjectives ----
// i: regular い-adjective · na: な-adjective · no: noun-like (の when attributive) · ta: state verb (疲れた)
// yoi: 良い (いい / よく…) · kaori: 香り → いい香りがします
const JP_ADJ = {
    quiet: 'na', clean: 'na', green: 'no', hungry: 'na', anxious: 'na', worried: 'na', bored: 'na', comfy: 'na',
    lucky: 'na', full: 'na', full2: 'na', empty: 'na', careful: 'na', wrong: 'no', sundry: 'na',
    tired: 'ta', angry: 'ta', dry: 'ta', wet: 'ta', thirsty: 'ta', good: 'yoi', fragrant: 'kaori',
    famous: 'na', important: 'na', skilled: 'na', unskilled: 'na', easy: 'na', lively: 'na', kind: 'na',
};
const JP_TA_POL = { angry: ['怒っています','おこっています'], dry: ['乾いています','かわいています'], thirsty: ['喉が渇きました','のどがかわきました'] };
const JP_TA_TE = { tired: ['疲れて','つかれて'], angry: ['怒って','おこって'], dry: ['乾いて','かわいて'], wet: ['濡れて','ぬれて'], thirsty: ['喉が渇いて','のどがかわいて'] };
function jpAdjClass(id) { return JP_ADJ[id] || 'i'; }
// form: pred | te | neg | past | adv | attr ; polite adds です / ます where Japanese needs it
function jpAdjForm(id, form, polite) {
    const v = vocab[id], c = jpAdjClass(id);
    const K = v.kanji, R = v.kana;
    const cop = polite ? ['です','です'] : ['',''];
    if (c === 'i' || c === 'yoi') {
        const ks = c === 'yoi' ? 'よ' : K.slice(0, -1), rs = c === 'yoi' ? 'よ' : R.slice(0, -1);
        const plainK = c === 'yoi' ? 'いい' : K, plainR = c === 'yoi' ? 'いい' : R;
        switch (form) {
            case 'pred': return [plainK + cop[0], plainR + cop[1]];
            case 'attr': return [plainK, plainR];
            case 'te':   return [ks + 'くて', rs + 'くて'];
            case 'adv':  return [ks + 'く', rs + 'く'];
            case 'neg':  return [ks + 'くない' + cop[0], rs + 'くない' + cop[1]];
            case 'past': return [ks + 'かった' + cop[0], rs + 'かった' + cop[1]];
        }
    }
    if (c === 'na' || c === 'no') {
        switch (form) {
            case 'pred': return polite ? [K + 'です', R + 'です'] : [K + 'だ', R + 'だ'];
            case 'attr': return c === 'no' ? [K + 'の', R + 'の'] : [K + 'な', R + 'な'];
            case 'te':   return [K + 'で', R + 'で'];
            case 'adv':  return [K + 'に', R + 'に'];
            case 'neg':  return polite ? [K + 'ではありません', R + 'ではありません'] : [K + 'じゃない', R + 'じゃない'];
            case 'past': return polite ? [K + 'でした', R + 'でした'] : [K + 'だった', R + 'だった'];
        }
    }
    if (c === 'ta') {
        const te = JP_TA_TE[id];
        switch (form) {
            case 'pred': case 'past': case 'attr':
                if (!polite || form === 'attr') return [K, R];
                return JP_TA_POL[id] || [K.slice(0, -1) + 'ました', R.slice(0, -1) + 'ました'];
            case 'te':   return te;
            case 'adv':  return te;
            case 'neg':  return polite ? [te[0] + 'いません', te[1] + 'いません'] : [te[0] + 'いない', te[1] + 'いない'];
        }
    }
    if (c === 'kaori') {
        switch (form) {
            case 'pred': case 'past': return polite ? ['いい香りがします', 'いいかおりがします'] : ['いい香りがする', 'いいかおりがする'];
            case 'te':   return ['いい香りがして', 'いいかおりがして'];
            default:     return ['いい香りの', 'いいかおりの'];
        }
    }
    return [K, R];
}

// ---- Japanese surfaces that differ from the dictionary entry in speech ----
const JP_NOUN_SURFACE = { tea: ['お茶','おちゃ'], wine: ['お酒','おさけ'], god: ['神様','かみさま'] };
const JP_PLACE = {           // [kanji, kana]
    here: ['ここ','ここ'], there: ['あそこ','あそこ'], up: ['上','うえ'], down: ['下','した'],
    front: ['前','まえ'], behind: ['後ろ','うしろ'], inside: ['中','なか'], outside: ['外','そと'],
};
const JP_INTJ = {            // polite, plain
    yes: [['はい','はい'], ['うん','うん']], no: [['いいえ','いいえ'], ['ううん','ううん']],
    hello: [['こんにちは','こんにちは']], goodbye: [['さようなら','さようなら'], ['じゃあね','じゃあね']],
    please: [['お願いします','おねがいします'], ['お願い','おねがい']], thanks: [['ありがとうございます','ありがとうございます'], ['ありがとう','ありがとう']],
    sorry: [['ごめんなさい','ごめんなさい'], ['ごめん','ごめん']], welcome: [['ようこそ','ようこそ']],
    yourewelcome: [['どういたしまして','どういたしまして']], nevermind: [['気にしないでください','きにしないでください'], ['気にしないで','きにしないで']],
    goforit: [['頑張って','がんばって'], ['頑張れ','がんばれ']],
    goodmorning: [['おはようございます','おはようございます'], ['おはよう','おはよう']], goodevening: [['こんばんは','こんばんは']],
    goodnight: [['おやすみなさい','おやすみなさい'], ['おやすみ','おやすみ']], itadakimasu: [['いただきます','いただきます']],
    gochisousama: [['ごちそうさまでした','ごちそうさまでした'], ['ごちそうさま','ごちそうさま']], ittekimasu: [['いってきます','いってきます']],
    tadaima: [['ただいま','ただいま']], sumimasen: [['すみません','すみません']], otsukare: [['お疲れ様です','おつかれさまです'], ['お疲れ','おつかれ']],
};

// ---- German nouns: gender (m/f/n/pl) + flags: M mass (no article as object), U unique (definite) ----
const DE_NOUN = {
    water:'n M', fire:'n M', sky:'m U', mountain:'m', flower:'f', tree:'m', fish:'m', tea:'m M', rice:'m M', food:'n M',
    vegetable:'n M', meat:'n M', egg:'n', dog:'m', cat:'f', bird:'m', chicken:'n', rabbit:'n', frog:'m', butterfly:'m',
    horse:'n', cow:'f', crane:'m', insect:'n', sheep:'n', snake:'f', tanuki:'m', person:'f', friend:'m', child:'n',
    teacher:'m', student:'m', doctor:'m', neighbor:'m', boy:'m', girl:'n', mother:'f', father:'m', brother:'m', sister:'f',
    son:'m', daughter:'f', head:'m', hand:'f', eye:'n', mouth:'m', ear:'n', nose:'f', body:'m', face:'n', heart:'n', foot:'m',
    book:'n', cup:'f', bowl:'f', knife:'n', door:'f U', bridge:'f U', boat:'n', money:'n M', clothes:'f M', shoe:'m', hat:'m',
    chair:'m', table:'m U', bed:'n', broom:'m', stone:'m', rope:'n', candle:'f', mirror:'m', umbrella:'m', noodle:'pl M',
    soup:'f', wine:'m M', milk:'f M', salt:'n M', sugar:'m M', oil:'n M', apple:'m', onigiri:'n', mochi:'m', tofu:'m M',
    home:'n U', house:'n U', garden:'m U', village:'n U', road:'m U', country:'n U', day:'m', night:'f', morning:'m', year:'n',
    month:'m', spring:'m', summer:'m', autumn:'m', winter:'m', music:'f M', picture:'n', story:'f', song:'n', dream:'m',
    name:'m', meaning:'f', sound:'m', brush:'m', ink:'f M', paper:'n M', silk:'f M', bamboo:'m M', lantern:'f', basket:'m',
    fan:'m', pot:'m', lotus:'m', tatami:'f', kimono:'m', torii:'n U', onsen:'f U', shrine:'m U', hope:'f', rain:'m U M', snow:'m U M',
    wind:'m U', cloud:'f', sun:'f U', moon:'m U', star:'m', river:'m U', lake:'m U', earth:'f M', field:'n U', forest:'m U',
    leaf:'n', grass:'n M', pine:'f', fruit:'n M', grain:'n M', ice:'n M', mist:'m U', weather:'n U', shadow:'m', shore:'n U',
    room:'n U', thing:'n', time:'f M', god:'m', gift:'n', bell:'f U', incense:'pl M', medicine:'f M', needle:'f', poem:'n',
    character:'pl M', lesson:'m M', news:'f', school:'f U', pagoda:'f U', shop:'m U', gate:'n U', well2:'m U', shoes:'pl M',
    festival:'n U', habit:'f', strength:'f M', wish:'m', secret:'n', question:'f', answer:'f', method:'f', kitchen:'f U',
    teahouse:'n U', workshop:'f U', market:'m U', fish_pond:'m U', stable:'m U',
    // added words
    sakura:'f', momiji:'n M', sea:'n U', rainbow:'m', thunder:'m U M', moss:'n M', rock:'m', mushroom:'m', evening:'m', noon:'m',
    fox:'m', monkey:'m', deer:'m', turtle:'f', sparrow:'m', crow:'f', duck:'f', firefly:'n', cicada:'f',
    samurai:'m', merchant:'m', farmer:'m', fisherman:'m', monk:'m', traveler:'m', grandmother:'f', grandfather:'m', baby:'n', guest:'m',
    misosoup:'f M', dango:'pl M', bento:'n', soysauce:'f M', bean:'pl M', radish:'m', potato:'f', persimmon:'f', chestnut:'pl M', chopsticks:'pl M',
    letter:'m', map:'f', window:'n', roof:'n U', bucket:'m', firewood:'n M', work:'f U', drum:'f', flute:'f', koto:'f', windchime:'n',
    yukata:'m', obi:'m', sandals:'pl M', omamori:'m', scroll:'f', coin:'pl M', hanko:'n', shard:'f', ikebana:'n M',
};
// German word where it differs from the vocabulary gloss (plurals, nicer words)
const DE_WORD = { noodle: 'Nudeln', incense: 'Räucherstäbchen', character: 'Schriftzeichen', shoes: 'Schuhe', oil: 'Öl',
    tatami: 'Tatami-Matte', onigiri: 'Reisbällchen', mochi: 'Reiskuchen', tanuki: 'Marderhund', wine: 'Sake', lesson: 'Unterricht',
    workshop: 'Schreibstube', home: 'Zuhause', thing: 'Ding', exercise: 'Übung', table: 'Tisch', brother: 'Bruder', sister: 'Schwester',
    month: 'Monat', cup: 'Tasse', fragrant: 'Duft',
    dango: 'Dango', bento: 'Bento', bean: 'Bohnen', chestnut: 'Kastanien', koto: 'Koto', yukata: 'Sommerkimono', obi: 'Obi', coin: 'Goldmünzen',
    ikebana: 'Ikebana', hanko: 'Siegel', duck: 'Ente', bed: 'Bett',
};
// Location (dative) and direction (accusative) phrases
const DE_PLACE = {
    home: ['zu Hause', 'nach Hause'], house: ['im Haus', 'ins Haus'], garden: ['im Garten', 'in den Garten'],
    village: ['im Dorf', 'ins Dorf'], road: ['auf dem Weg', 'auf den Weg'], field: ['auf dem Feld', 'aufs Feld'],
    forest: ['im Wald', 'in den Wald'], river: ['im Fluss', 'in den Fluss'], lake: ['im See', 'in den See'],
    mountain: ['auf dem Berg', 'auf den Berg'], bridge: ['auf der Brücke', 'auf die Brücke'], sky: ['am Himmel', 'in den Himmel'],
    water: ['im Wasser', 'ins Wasser'], room: ['im Zimmer', 'ins Zimmer'], kitchen: ['in der Küche', 'in die Küche'],
    teahouse: ['im Teehaus', 'ins Teehaus'], market: ['auf dem Markt', 'auf den Markt'], shrine: ['am Schrein', 'zum Schrein'],
    school: ['in der Schule', 'in die Schule'], shop: ['im Laden', 'in den Laden'], tree: ['unter dem Baum', 'unter den Baum'],
    shore: ['am Ufer', 'ans Ufer'], pagoda: ['auf der Pagode', 'auf die Pagode'], stable: ['im Stall', 'in den Stall'],
    well2: ['am Brunnen', 'zum Brunnen'], fish_pond: ['am Teich', 'zum Teich'], country: ['im Land', 'ins Land'],
    onsen: ['in der Thermalquelle', 'in die Thermalquelle'], workshop: ['in der Schreibstube', 'in die Schreibstube'],
    sun: ['in der Sonne', 'in die Sonne'], night: ['in der Nacht', 'in die Nacht'], morning: ['am Morgen', 'am Morgen'],
    day: ['am Tag', 'am Tag'], hand: ['in der Hand', 'in die Hand'], heart: ['im Herzen', 'ins Herz'], field2: ['', ''],
    chair: ['auf dem Stuhl', 'auf den Stuhl'], tatami: ['auf der Tatami-Matte', 'auf die Tatami-Matte'], bed: ['im Bett', 'ins Bett'],
    sea: ['am Meer', 'ans Meer'],
};
const DE_PLACE_ADV = { here: ['hier', 'hierher'], there: ['dort', 'dorthin'], up: ['oben', 'nach oben'], down: ['unten', 'nach unten'],
    front: ['vorne', 'nach vorne'], behind: ['hinten', 'nach hinten'], inside: ['drinnen', 'hinein'], outside: ['draußen', 'nach draußen'] };
const DE_TIME = { now: 'jetzt', today: 'heute', tomorrow: 'morgen', yesterday: 'gestern', morning: 'am Morgen', night: 'in der Nacht',
    day: 'am Tag', spring: 'im Frühling', summer: 'im Sommer', autumn: 'im Herbst', winter: 'im Winter',
    evening: 'am Abend', noon: 'am Mittag', everyday: 'jeden Tag',
};
const DE_ADJ = { happy: 'fröhlich', joyful: 'lustig', fragrant: 'duftend', sleepy: 'müde', bored: 'gelangweilt', far: 'weit weg',
    sundry: 'bunt', lucky: 'glücklich', tasty: 'lecker', hot: 'heiß', hot2: 'heiß', cold: 'kalt', cold2: 'kalt', tall: 'hoch',
    slow: 'langsam', clean: 'sauber', wrong: 'falsch',
    wide: 'weit', gentle: 'nett', stinky: 'stinkig', interesting: 'interessant', noisy: 'laut', kind: 'freundlich', lucky: 'glücklich',
};
const DE_SADV = { also: 'wieder', already: 'schon', still: 'noch', always: 'immer', sometimes: 'manchmal', alittle: 'ein bisschen', slowly: 'langsam' };
const DE_INTJ = { yes: 'Ja', no: 'Nein', hello: 'Hallo', goodbye: 'Auf Wiedersehen', please: 'Bitte', thanks: 'Danke',
    sorry: 'Entschuldigung', welcome: 'Willkommen', yourewelcome: 'Gern geschehen', nevermind: 'Macht nichts', goforit: 'Gib dein Bestes',
    goodmorning: 'Guten Morgen', goodevening: 'Guten Abend', goodnight: 'Gute Nacht', itadakimasu: 'Guten Appetit',
    gochisousama: 'Danke für das Essen', ittekimasu: 'Bis später', tadaima: 'Ich bin wieder da', sumimasen: 'Verzeihung', otsukare: 'Gute Arbeit',
};

// ---- German verbs: infinitive | 3rd sg | participle | aux (h/s) | separable part | flags (R reflexive, I e→i imperative) ----
const DE_VERB = {
    eat:'essen|isst|gegessen|h||I', drink:'trinken|trinkt|getrunken|h', sleep:'schlafen|schläft|geschlafen|h',
    walk:'gehen|geht|gegangen|s', run:'laufen|läuft|gelaufen|s', sit:'sitzen|sitzt|gesessen|h', stand:'stehen|steht|gestanden|h',
    go:'gehen|geht|gegangen|s', come:'kommen|kommt|gekommen|s', return:'kehren|kehrt|zurückgekehrt|s|zurück',
    look:'schauen|schaut|angeschaut|h|an', listen:'hören|hört|gehört|h', say:'sagen|sagt|gesagt|h', read:'lesen|liest|gelesen|h||I',
    write:'schreiben|schreibt|geschrieben|h', think:'denken|denkt|gedacht|h', know:'kennen|kennt|gekannt|h',
    buy:'kaufen|kauft|gekauft|h', sell:'verkaufen|verkauft|verkauft|h', give:'geben|gibt|gegeben|h||I', take:'nehmen|nimmt|genommen|h||I',
    make:'machen|macht|gemacht|h', use:'benutzen|benutzt|benutzt|h', open:'öffnen|öffnet|geöffnet|h', close:'schließen|schließt|geschlossen|h',
    hold:'halten|hält|gehalten|h', put:'legen|legt|gelegt|h', cut:'schneiden|schneidet|geschnitten|h', meet:'treffen|trifft|getroffen|h||I',
    wait:'warten|wartet|gewartet|h', begin:'beginnen|beginnt|begonnen|h', end:'enden|endet|geendet|h', cook:'kochen|kocht|gekocht|h',
    plant:'pflanzen|pflanzt|gepflanzt|h', fish_v:'angeln|angelt|geangelt|h', wash:'waschen|wäscht|gewaschen|h', paint:'malen|malt|gemalt|h',
    teach:'unterrichten|unterrichtet|unterrichtet|h', learn:'lernen|lernt|gelernt|h', help:'helfen|hilft|geholfen|h||I',
    carry:'tragen|trägt|getragen|h', pull:'ziehen|zieht|gezogen|h', push:'schieben|schiebt|geschoben|h', catch:'fangen|fängt|gefangen|h',
    hang:'hängen|hängt|aufgehängt|h|auf', repair:'reparieren|repariert|repariert|h', fold:'falten|faltet|gefaltet|h',
    feel:'fühlen|fühlt|gefühlt|h||R', smell:'riechen|riecht|gerochen|h', laugh:'lachen|lacht|gelacht|h', cry:'weinen|weint|geweint|h',
    sing:'singen|singt|gesungen|h', dance:'tanzen|tanzt|getanzt|h', play:'spielen|spielt|gespielt|h', pray:'beten|betet|gebetet|h',
    forget:'vergessen|vergisst|vergessen|h||I', remember:'erinnern|erinnert|erinnert|h||R', understand:'verstehen|versteht|verstanden|h',
    find:'finden|findet|gefunden|h', climb:'steigen|steigt|gestiegen|s', swim:'schwimmen|schwimmt|geschwommen|s',
    fly:'fliegen|fliegt|geflogen|s', burn:'brennen|brennt|gebrannt|h', allow:'erlauben|erlaubt|erlaubt|h', ask:'fragen|fragt|gefragt|h',
    arrive:'kommen|kommt|angekommen|s|an', blow:'blasen|bläst|geblasen|h', borrow:'leihen|leiht|ausgeliehen|h|aus',
    call:'rufen|ruft|gerufen|h', celebrate:'feiern|feiert|gefeiert|h', change:'ändern|ändert|geändert|h||R',
    compete:'laufen|läuft|um die Wette gelaufen|s|um die Wette ', drop:'lassen|lässt|fallen gelassen|h|fallen ',
    enter:'gehen|geht|gegangen|s', exit2:'gehen|geht|gegangen|s', feed:'füttern|füttert|gefüttert|h', finish:'beenden|beendet|beendet|h',
    float:'treiben|treibt|getrieben|h', getup:'stehen|steht|aufgestanden|s|auf', giveback:'geben|gibt|zurückgegeben|h|zurück|I',
    gotosleep:'gehen|geht|schlafen gegangen|s|schlafen ', hangup:'hängen|hängt|aufgehängt|h|auf', harvest:'ernten|erntet|geerntet|h',
    haul:'schleppen|schleppt|geschleppt|h', inform:'erzählen|erzählt|erzählt|h', pick:'pflücken|pflückt|gepflückt|h',
    pour:'schenken|schenkt|eingeschenkt|h|ein', prepare:'bereiten|bereitet|vorbereitet|h|vor', putdown:'stellen|stellt|abgestellt|h|ab',
    receive:'bekommen|bekommt|bekommen|h', rest:'ruhen|ruht|ausgeruht|h|aus|R', sail:'rudern|rudert|gerudert|h',
    send:'schicken|schickt|geschickt|h', sweep:'fegen|fegt|gefegt|h', taste:'probieren|probiert|probiert|h', tell:'erzählen|erzählt|erzählt|h',
    try:'probieren|probiert|probiert|h', wear:'ziehen|zieht|angezogen|h|an', live:'wohnen|wohnt|gewohnt|h', love:'lieben|liebt|geliebt|h',
    meetknow:'lernen|lernt|kennengelernt|h|kennen',
    takeoff:'ziehen|zieht|ausgezogen|h|aus', puton2:'ziehen|zieht|angezogen|h|an', putin:'geben|gibt|hineingegeben|h|hinein|I',
    hit:'schlagen|schlägt|geschlagen|h', playinst:'spielen|spielt|gespielt|h', tie:'binden|bindet|gebunden|h', pickup:'sammeln|sammelt|gesammelt|h',
    search:'suchen|sucht|gesucht|h', bloom:'blühen|blüht|geblüht|h', shine:'leuchten|leuchtet|geleuchtet|h', hide:'verstecken|versteckt|versteckt|h||R',
    count:'zählen|zählt|gezählt|h', cross:'überqueren|überquert|überquert|h', work_v:'arbeiten|arbeitet|gearbeitet|h', assist:'helfen|hilft|geholfen|h||I',
    polish:'polieren|poliert|poliert|h', wrap:'packen|packt|eingepackt|h|ein', rejoice:'freuen|freut|gefreut|h||R', wake:'wecken|weckt|geweckt|h',
    grow:'bauen|baut|angebaut|h|an', stroll:'gehen|geht|spazieren gegangen|s|spazieren ', clean_v:'putzen|putzt|geputzt|h', study:'lernen|lernt|gelernt|h',
    grill:'grillen|grillt|gegrillt|h', mix:'rühren|rührt|umgerührt|h|um',
};

// ---- Verb argument frames: which Japanese particle and German case/preposition each role takes ----
// o: object slot   g: goal   l: location   w: with   i: instrument   d: recipient
// jp: particle for the primary noun; de: 'acc' | 'dat' | 'prep:<prep> <case>' | 'loc' | 'goal'
const VFRAME = {
    sleep: { slot: 'l' }, sit: { slot: 'l', jl: 'に' }, stand: { slot: 'l', jl: 'に' }, live: { slot: 'l', jl: 'に' },
    swim: { slot: 'l' }, rest: { slot: 'l' }, play: { slot: 'i' }, dance: { slot: 'w', jw: 'に合わせて', jwr: 'にあわせて', dw: 'zur' },
    go: { slot: 'g' }, come: { slot: 'g' }, return: { slot: 'g' }, arrive: { slot: 'g' }, enter: { slot: 'g' }, climb: { slot: 'g', dg: 'auf' },
    exit2: { slot: 'src' }, walk: { slot: 'path' }, run: { slot: 'path' }, fly: { slot: 'path' },
    look: { slot: 'o' }, listen: { slot: 'o' }, smell: { slot: 'o', de: 'prep:an dat' }, think: { slot: 'o', jo: 'のことを', jor: 'のことを', de: 'prep:an acc' },
    wait: { slot: 'o', de: 'prep:auf acc' }, meet: { slot: 'o', jo: 'に' }, help: { slot: 'o', de: 'dat', ddet: 'def' }, pray: { slot: 'o', jo: 'に', de: 'prep:zu dat' },
    feed: { slot: 'o', jo: 'に', ddet: 'def' }, ask: { slot: 'd', jd: 'に', de: 'acc' }, teach: { slot: 'o', dat: true, jd: 'に', ddat: 'acc' },
    give: { slot: 'o', dat: true }, send: { slot: 'o', dat: true }, inform: { slot: 'o', dat: true, jo: 'のことを', de: 'prep:von dat' }, giveback: { slot: 'o', dat: true },
    tell: { slot: 'o', dat: true }, borrow: { slot: 'o', dat: true, jd: 'に' },
    remember: { slot: 'o', de: 'prep:an acc' }, burn: { slot: 'o' },
    carry: { slot: 'o', placeAs: 'g' }, haul: { slot: 'o', placeAs: 'g' }, make: { slot: 'o', di: 'aus' },
    say: { slot: 'o', jo: 'のことを', joPro: true, de: 'prep:über acc', deFill: 'etwas' },
    laugh: { slot: '-' }, cry: { slot: '-' }, getup: { slot: '-' }, gotosleep: { slot: '-' }, compete: { slot: '-' }, change: { slot: '-' },
    float: { slot: 'l', jl: 'に' }, feel: { slot: '-' },
    understand: { slot: 'o', jo: 'が' }, work_v: { slot: 'l' }, assist: { slot: 'o', de: 'dat', ddet: 'def' }, rejoice: { slot: '-' },
    bloom: { slot: '-' }, shine: { slot: '-' }, hide: { slot: 'l', jl: 'に' }, stroll: { slot: 'path' },
};
function vframe(v) { return VFRAME[v] || { slot: 'o' }; }

// Verbs whose ongoing form is the normal one (知っています, 住んでいます) and verbs that are momentary (no ている)
const JP_ALWAYS_TEIRU = new Set(['know', 'live', 'remember']);
const PUNCTUAL = new Set(['arrive','find','getup','enter','exit2','catch','drop','receive','meet','begin','finish','end','forget',
    'understand','giveback','putdown','go','come','return','gotosleep','meetknow','allow','open','close',
    'wake','takeoff','puton2','putin'
]);

// ============================================================
//  FRAMES — template word lists → meaning frames
// ============================================================
// Frame fields:
//   a agent (null = implied "I") · aAnd second agent · ga mark subject with が · v verb
//   o objects[] · d recipient · g goal · l location · w with · i instrument/material · src source · path
//   t time · p place word · m manner adjectives[] · int intensifier · oAttr {obj: adj}
//   of {noun: owner} (竹の籠 / Korb aus Bambus, 鐘の音 / Klang der Glocke) · at {noun: place} (空の鳥 / Vogel am Himmel)
//   s subject of a verbless clause · sAnd · sHide (implied 私) · pr predicate adjectives[] · n noun predicate
//   ex existence nouns[] (exLoc place noun) · mod modal · imp request · q question · neg · pre interjection
//   c short comment ("いいですね。" / "Das ist gut.") · cint · then a second verb sharing the subject (て-form)
//   next a following sentence (pro: refers back to the previous subject) · fixed hand-written phrase
const FOODISH = new Set(['food','tea','water','soup','noodle','rice','milk','wine','fruit','mochi','onigiri','sugar','vegetable','meat','egg','apple','tofu',
    'misosoup','dango','bento','bean','radish','potato','persimmon','chestnut','mushroom'
]);
const FOOD_ACTION = /^(eat_|drink_|cook_|brew_tea|give_tea|sit_teahouse|share_fruit|pick_fruit|make_onigiri|make_sugar|pour_wine|taste_food)/;
const WEATHERISH = new Set(['sun','summer','day','weather','today','wind','spring','winter','autumn','morning','night','here']);
const ANIMAL = new Set(['dog','cat','bird','chicken','rabbit','frog','butterfly','horse','cow','crane','insect','sheep','snake','tanuki','fish',
    'fox','monkey','deer','turtle','sparrow','crow','duck','firefly','cicada'
]);
const FAMILY_BODY = new Set(['mother','father','brother','sister','son','daughter','head','hand','eye','mouth','ear','nose','body','face','heart','foot',
    'grandmother','grandfather'
]);

function autoFrame(ids) {
    const F = {};
    const vIdx = ids.findIndex(id => lxClass(id) === 'verb');
    let pendingInt = null;
    const put = (k, id) => { if (F[k] === undefined) F[k] = id; };
    const addArr = (k, id) => { (F[k] = F[k] || []).push(id); };
    const isInt = id => id === 'very' || id === 'extremely' || id === 'really';
    if (vIdx >= 0) {
        F.v = ids[vIdx];
        const vf = vframe(F.v);
        ids.forEach((id, i) => {
            if (i === vIdx) return;
            const c = lxClass(id), before = i < vIdx;
            if (c === 'time' || c === 'tnoun') return put('t', id);
            if (c === 'place') return put('p', id);
            if (c === 'intj') return put('pre', id);
            if (c === 'modal') return put('mod', id);
            if (c === 'sadv') return addArr('adv', id);
            if (c === 'adv') {
                if (id === 'together' || id === 'together2') return addArr('m', id);
                if (isInt(id) && (F.c || F.m)) { if (F.c) F.cint = id; else F.int = id; return; }
                pendingInt = id; return;
            }
            if (c === 'adj') {
                if (before) return addArr('m', id);
                if ((id === 'good' || id === 'tasty') && (i === ids.length - 1 || isInt(ids[i + 1]))) { F.c = id; if (pendingInt) { F.cint = pendingInt; pendingInt = null; } return; }
                if (pendingInt) { F.int = pendingInt; pendingInt = null; }
                return addArr('m', id);
            }
            if (id === 'this' && ids[i + 1] && lxClass(ids[i + 1]) === 'noun') { F.thisDet = ids[i + 1]; return; }
            if (before && (c === 'pro' || c === 'noun') && F.a === undefined) return (F.a = id);
            if (c === 'pro' || c === 'noun') {
                if (vf.dat && F.d === undefined && (c === 'pro' || ANIMATE.has(id))) return (F.d = id);
                const slot = vf.slot;
                if (slot === '-') return addArr('o', id);
                if (slot === 'o') {
                    if (!F.o) return addArr('o', id);
                    if (PLACE_NOUNS.has(id)) return put(vf.placeAs || 'l', id);
                    return addArr('o', id);
                }
                if (F[slot] === undefined) return (F[slot] = id);
                if (PLACE_NOUNS.has(id)) return put('l', id);
                return addArr('o', id);
            }
        });
    } else {
        const nounsHere = ids.filter(id => ['pro','noun'].includes(lxClass(id)));
        ids.forEach((id, i) => {
            const c = lxClass(id);
            if (c === 'time') return put('t', id);
            if (c === 'tnoun' && nounsHere.length) return put('t', id);
            if (c === 'place') return put('p', id);
            if (c === 'intj') return put('pre', id);
            if (c === 'sadv') return addArr('adv', id);
            if (c === 'adv') {
                if (isInt(id) && F.pr) { F.int = id; return; }
                pendingInt = id; return;
            }
            if (c === 'adj') { if (pendingInt) { F.int = pendingInt; pendingInt = null; } return addArr('pr', id); }
            if (id === 'this' && ids[i + 1] && lxClass(ids[i + 1]) === 'noun') { F.thisDet = ids[i + 1]; return; }
            if ((c === 'pro' || c === 'noun' || c === 'tnoun') && F.s === undefined) return (F.s = id);
            if (c === 'noun' || c === 'pro' || c === 'qw') return put('n', id);
        });
    }
    if (F.pr && (F.pr.includes('many') || F.pr.includes('few'))) F.ga = true;
    return F;
}

// Swap weather-only words for the right ones when they describe food, drink or things
function refineFrame(F, actionId) {
    const fix = (list, subj) => list && list.map(adj => {
        const feels = subj && vocab[subj] && ((vocab[subj].type === 'pronoun' && !['this','that','what','who','where'].includes(subj)) || ANIMATE.has(subj));   // 私は寒い (I feel cold)
        if (adj === 'hot' && subj && !WEATHERISH.has(subj) && !feels) return 'hot2';
        if (adj === 'cold' && subj && !WEATHERISH.has(subj) && !feels) return 'cold2';
        if (adj === 'good' && subj && FOODISH.has(subj) && FOOD_ACTION.test(actionId || '')) return 'tasty';
        return adj;
    });
    if (F.pr) F.pr = fix(F.pr, F.s);
    if (F.m) F.m = fix(F.m, F.o && F.o[0]);
    if (F.c === 'good' && F.o && F.o.some(o => FOODISH.has(o)) && FOOD_ACTION.test(actionId || '') && ['eat','drink','taste','try'].includes(F.v)) F.c = 'tasty';
    if (F.next) refineFrame(F.next, actionId);
    if (F.then) refineFrame(F.then, actionId);
    return F;
}

// Hand-written frames for templates the rules can't read (keys: "action|w1 w2 w3"; '*' matches any action)
const FRAME_OVERRIDES = {};
const _frameCache = new Map();
function frameFor(actionId, ids) {
    const key = ids.join(' ');
    const ck = actionId + '|' + key;
    if (_frameCache.has(ck)) return _frameCache.get(ck);
    const ov = FRAME_OVERRIDES[ck] || FRAME_OVERRIDES['*|' + key];
    const f = refineFrame(ov ? JSON.parse(JSON.stringify(ov)) : autoFrame(ids), actionId);
    _frameCache.set(ck, f);
    return f;
}

// ============================================================
//  PLANNING — choose tense / aspect / mood for this utterance (by grammar tier)
// ============================================================
// Tier 0: present statements · 1: + ね/よ, とても · 2: + ongoing (ている) and past · 3: + questions to the learner,
// "let's…" (ましょう) · 4: + counters (お茶を一杯). Every tier is grammatical; tiers only add variety.
const COUNT_VERBS = new Set(['eat','drink','make','buy','sell','find','pick','catch','give','carry']);
function planUtterance(frame, tier, opts) {
    opts = opts || {};
    const inst = JSON.parse(JSON.stringify(frame));
    inst.polite = opts.polite !== false;
    inst.tier = tier;
    const chance = p => Math.random() < p;
    const plan = (F, isMain) => {
        if (F.fixed) return;
        const verbal = !!F.v;
        if (F.t === 'yesterday') F.past = true;
        // The adverb decides the aspect: もう → done (past), まだ → still going on, いつも / 時々 / 毎日 → habit
        const advs = F.adv || [];
        if (verbal && advs.includes('already') && !F.imp && !F.mod) F.past = true;
        if (verbal && advs.includes('still') && !F.imp && !F.mod && !PUNCTUAL.has(F.v)) F.prog = true;
        const settled = advs.length > 0 || F.t === 'everyday' || SEASONS.has(F.t);   // 花は春に咲きます: a habit, not "right now"
        const free = verbal && !F.imp && !F.vol && !F.mod && !F.q && !F.neg && !F.then && !settled;
        if (opts.narrative && verbal && !F.imp && !F.vol && !F.mod && F.t !== 'tomorrow' && F.t !== 'now') F.past = true;
        if (opts.narrative && !verbal && (F.pr || F.n) && F.t !== 'tomorrow' && F.t !== 'now') F.past = true;
        if (free && !F.past && tier >= 2 && F.t !== 'now' && F.t !== 'tomorrow' && !opts.noPast && chance(0.22)) F.past = true;
        if (free && !F.past && tier >= 2 && !PUNCTUAL.has(F.v) && F.t !== 'tomorrow' && chance(0.35)) F.prog = true;
        if (verbal && JP_ALWAYS_TEIRU.has(F.v) && !F.mod && !F.imp && !F.vol) F.prog = true;
        if (isMain && free && !F.past && tier >= 3 && !opts.narrative && F.a === 'we' && chance(0.5)) { F.vol = true; F.prog = false; }
        if (isMain && free && !F.past && !F.vol && tier >= 3 && !opts.narrative && F.a == null && F.d !== 'you' && !F.c && !(F.o || []).some(o => FAMILY_BODY.has(o)) && chance(0.18)) { F.q2you = true; F.prog = false; }
        if (!verbal && F.pr && F.pr.length === 1 && !F.int && !F.q && !F.neg && !F.ex && F.s !== 'me' && F.s !== 'we' && !['many','few'].includes(F.pr[0]) && isMain && tier >= 3 && !opts.narrative && !F.next && !F.c && chance(0.12)) F.q = true;
        const greetingOnly = F.pre && !F.v && !F.s && !F.ex && !F.n && !F.pr;              // おはようございます！ takes no よ
        if (tier >= 1 && !greetingOnly && !F.q && !F.q2you && !F.imp && !F.vol && !F.mod && !opts.narrative && !F.next && !F.c && chance(0.2)) F.sfp = (F.pr && !F.past) ? 'ね' : 'よ';
        if (tier >= 1 && F.pr && F.pr.length === 1 && !F.int && !F.q && !['many','few','tired','angry','dry','wet','thirsty','fragrant','empty','full','full2','right','wrong'].includes(F.pr[0]) && chance(0.25)) F.int = 'very';
        if (tier >= 4 && verbal && COUNT_VERBS.has(F.v) && F.o && F.o.length === 1 && JP_COUNTERS[F.o[0]] && !F.q2you && !F.thisDet && !(F.oAttr && F.oAttr[F.o[0]]) && chance(0.3)) F.count = 'one';
        if (F.next) plan(F.next, false);
        if (F.then) { F.then.past = F.past; F.then.prog = false; F.then.polite = F.polite; }
    };
    plan(inst, true);
    return inst;
}

// ============================================================
//  JAPANESE REALISATION
// ============================================================
const JP_COUNTERS = { tea: ['杯','いっぱい','eine Tasse'], water: ['杯','いっぱい','ein Glas'], soup: ['杯','いっぱい','eine Schale'],
    milk: ['杯','いっぱい','ein Glas'], wine: ['杯','いっぱい','ein Glas'], book: ['冊','いっさつ',''], fish: ['匹','いっぴき',''],
    egg: ['個','いっこ',''], apple: ['個','いっこ',''], picture: ['枚','いちまい',''], paper: ['枚','いちまい','ein Blatt'],
    flower: ['本','いっぽん',''], candle: ['本','いっぽん',''], brush: ['本','いっぽん',''], lantern: ['個','いっこ',''],
    basket: ['個','いっこ',''], pot: ['個','いっこ',''], bowl: ['個','いっこ',''] };
const JP_AT = { water: ['水の中の','みずのなかの'], tree: ['木の下の','きのしたの'] };   // "the X in the water"
const JP_LOC_SUFFIX = { tree: ['の下','のした'] };                                    // 木の下で (under the tree)

function T(conceptId, kanji, kana, type) {
    const v = vocab[conceptId];
    return { conceptId, kanji, kana, type: type || (v ? v.type : 'particle'), de: v ? v.de : '' };
}
const P = (ch, kana) => ({ conceptId: '_p', kanji: ch, kana: kana || ch, type: 'particle', de: '' });
const JP_PRO = { this: ['これ','これ'], that: ['それ','それ'], what: ['何','なに'], who: ['誰','だれ'], where: ['どこ','どこ'] };
function nounTok(id) {
    const v = vocab[id];
    if (v && v.type === 'pronoun' && JP_PRO[id]) return T(id, JP_PRO[id][0], JP_PRO[id][1]);
    const s = JP_NOUN_SURFACE[id];
    return T(id, s ? s[0] : v.kanji, s ? s[1] : v.kana);
}
// A noun with what belongs in front of it: この / owner の / place の / adjective
function nounPhraseJP(F, id, toks) {
    if (F.at && F.at[id]) {
        const sp = JP_AT[F.at[id]];
        if (sp) { const v = vocab[F.at[id]]; toks.push(T(F.at[id], v.kanji, v.kana), P(sp[0].slice(v.kanji.length), sp[1].slice(v.kana.length))); }
        else toks.push(nounTok(F.at[id]), P('の'));
    }
    if (F.of && F.of[id]) toks.push(nounTok(F.of[id]), P('の'));
    if (F.mat && F.mat[id]) toks.push(nounTok(F.mat[id]), P('の'));
    if (F.oAttr && F.oAttr[id]) { const f = jpAdjForm(F.oAttr[id], 'attr'); toks.push(T(F.oAttr[id], f[0], f[1])); }
    if (F.thisDet === id) toks.push(T('this', 'この', 'この'));
    toks.push(nounTok(id));
}
// Verb + endings as tokens (modal words keep their own concept so the learner can pick them up)
function verbTokensJP(F) {
    const ve = vocab[F.v];
    const pol = F.polite !== false;
    const cv = f => conjugateVerb(ve, f);
    const stem = () => { const m = cv('masu'); return [m.kanji.slice(0, -2), m.kana.slice(0, -2)]; };
    const te = () => { const t = cv('te'); return [t.kanji, t.kana]; };
    const V = (k, r) => T(F.v, k, r, 'verb');
    const dict = [ve.kanji, ve.kana];
    if (F.burnObj) {           // 線香に火をつけます — "light it"
        const end = F.imp ? (pol ? 'つけてください' : 'つけて') : F.past ? (pol ? 'つけました' : 'つけた') : F.prog ? (pol ? 'つけています' : 'つけている') : (pol ? 'つけます' : 'つける');
        return [T('fire', '火', 'ひ'), P('を'), P(end)];
    }
    if (F.then) { const t = te(); return [V(t[0], t[1])]; }
    if (F.imp) { const t = te(); return [V(t[0], t[1]), P(pol ? 'ください' : '')].filter(x => x.kanji); }
    if (F.vol) {
        if (pol) { const s = stem(); return [V(s[0] + 'ましょう', s[1] + 'ましょう')]; }
        const v = cv('volitional'); return [V(v.kanji, v.kana)];
    }
    switch (F.mod) {
        case 'should': return [V(dict[0], dict[1]), T('should', 'べき', 'べき'), P(pol ? 'です' : 'だ')];
        case 'can':    return [V(dict[0], dict[1]), P('ことが'), T('can', pol ? 'できます' : 'できる', pol ? 'できます' : 'できる')];
        case 'may':    { const t = te(); return [V(t[0], t[1]), P('も'), T('may', 'いい', 'いい'), ...(pol ? [P('ですか')] : [])]; }
        case 'will':   return [V(dict[0], dict[1]), T('will', 'つもり', 'つもり'), P(pol ? 'です' : 'だ')];
        case 'want':   { const s = stem(); return [V(s[0] + (pol ? 'たいです' : 'たい'), s[1] + (pol ? 'たいです' : 'たい'))]; }
        case 'like':   return [V(dict[0], dict[1]), P('のが'), T('like', '好き', 'すき'), P(pol ? 'です' : 'だ')];
    }
    if (F.prog) {
        const aux = F.past ? (pol ? 'いました' : 'いた') : F.neg ? (pol ? 'いません' : 'いない') : (pol ? 'います' : 'いる');
        const t = te(); return [V(t[0] + aux, t[1] + aux)];
    }
    if (pol) {
        const r = cv(F.past ? (F.neg ? 'masendeshita' : 'mashita') : (F.neg ? 'masen' : 'masu'));
        return [V(r.kanji, r.kana)];
    }
    if (F.past && F.neg) { const n = cv('nai'); return [V(n.kanji.slice(0, -1) + 'かった', n.kana.slice(0, -1) + 'かった')]; }
    const r = cv(F.past ? 'ta' : F.neg ? 'nai' : 'dict');
    return [V(r.kanji, r.kana)];
}
// Polite fixed phrase → plain speech (villagers among themselves)
const JP_PLAIN_VERB = {
    'みます':['る','みる'], 'いきます':['く','いく'], 'いいます':['う','いう'], 'おぼえています':['いる','おぼえている'], 'います':['いる','いる'],
    'あります':['ある','ある'], 'ならします':['す','ならす'], 'とびます':['ぶ','とぶ'], 'ふります':['る','ふる'], 'はしります':['る','はしる'],
    'いきません':['かない','いかない'], 'たきます':['く','たく'], 'あるきます':['く','あるく'], 'おしえます':['える','おしえる'], 'かけます':['ける','かける'],
    'まちます':['つ','まつ'], 'ほします':['す','ほす'], 'はじめましょう':['めよう','はじめよう'], 'ふきます':['く','ふく'], 'かります':['りる','かりる'],
    'つくります':['る','つくる'], 'もらいます':['もらう','もらう'], 'なります':['なる','なる'], 'つけます':['つける','つける'], 'します':['する','する'],
    'しています':['している','している'], 'くれます':['くれる','くれる'], 'かぶります':['かぶる','かぶる'], 'ありません':['ない','ない'], 'だからです':['だから','だから'],
    'ありがとうございます':['ありがとう','ありがとう']
};
function plainifyJP(toks) {
    const out = [];
    const isIAdj = t => t && vocab[t.conceptId] && vocab[t.conceptId].type === 'mod' && (jpAdjClass(t.conceptId) === 'i' || jpAdjClass(t.conceptId) === 'yoi') && /い$/.test(t.kana);
    for (let i = 0; i < toks.length; i++) {
        const t = toks[i], prev = out[out.length - 1];
        const pv = JP_PLAIN_VERB[t.kana];
        if (pv) {
            const kanji = t.kanji !== t.kana ? jpSwapTail(t.kanji, t.kana, pv[1]) : pv[1];
            out.push(Object.assign({}, t, { kanji, kana: pv[1] }));
            continue;
        }
        if (t.conceptId === '_p') {
            const k = t.kanji;
            if (k === 'です' || k === 'ですね' || k === 'ですよ' || k === 'ですか') {
                const sfp = k.slice(2); // '', 'ね', 'よ', 'か'
                const after = isIAdj(prev) ? '' : (sfp === 'か' ? '' : 'だ');
                const surf = after + (sfp === 'か' ? '' : sfp);
                if (surf) out.push(P(surf));
                continue;
            }
            if (k === 'ください') { if (prev && prev.kanji === 'を') out.push(P('ちょうだい')); continue; }
        }
        out.push(t);
    }
    return out;
}
// Replace the polite tail of a kanji surface given its kana and the plain kana
function jpSwapTail(kanji, kana, plainKana) {
    // shared kana prefix of polite and plain forms (the part kept as written)
    let n = 0; while (n < kana.length && n < plainKana.length && kana[n] === plainKana[n]) n++;
    const dropKana = kana.length - n;                      // kana dropped from the end of the polite form
    if (kanji.length < dropKana) return plainKana;
    return kanji.slice(0, kanji.length - dropKana) + plainKana.slice(n);
}

// Tokens for one clause (no final punctuation)
function clauseJP(F) {
    const toks = [];
    const pol = F.polite !== false;
    if (F.fixed) {
        for (const t of F.fixed.jp) toks.push(t[2] ? T(t[2], t[0], t[1] || t[0], t[3]) : P(t[0], t[1] || t[0]));
        return pol ? toks : plainifyJP(toks);
    }
    if (F.pre) {
        const forms = JP_INTJ[F.pre] || [[vocab[F.pre].kanji, vocab[F.pre].kana]];
        const f = (!pol && forms[1]) ? forms[1] : forms[0];
        toks.push(T(F.pre, f[0], f[1]));
        if (!F.v && !F.s && !F.ex && !F.n) return toks;
        toks.push(P('、'));
    }
    const timeToks = topic => {
        if (!F.t) return [];
        if (lxClass(F.t) === 'time') return [T(F.t, vocab[F.t].kanji, vocab[F.t].kana)];
        return TIME_NI.has(F.t) && !topic ? [nounTok(F.t), P('に')] : [nounTok(F.t)];   // 夜に寝ます · 夜は静かです
    };
    // ---- topic / subject ----
    const subjId = F.v ? F.a : F.s;
    const subjAnd = F.v ? F.aAnd : F.sAnd;
    const timeTopic = !F.v && F.t && subjId && !F.pro && vocab[subjId].type !== 'pronoun';   // 今日は天気がいいです
    if (timeTopic) { toks.push(...timeToks(true), P('は')); }
    if (F.q2you) { toks.push(T('you', 'あなた', 'あなた')); toks.push(P('も')); }
    else if (subjId && !F.sHide && !F.pro) {
        nounPhraseJP(F, subjId, toks);
        if (subjAnd) { toks.push(P('と')); nounPhraseJP(F, subjAnd, toks); }
        toks.push(P(timeTopic || F.ga ? 'が' : (F.also ? 'も' : 'は')));
    }
    if (!timeTopic) toks.push(...timeToks());
    for (const a of F.adv || []) toks.push(T(a, vocab[a].kanji, vocab[a].kana));
    if (!F.v) {
        // ---- predicate clause: adjectives, a noun, or existence ----
        if (F.ex) {
            if (F.exLoc) { toks.push(nounTok(F.exLoc)); toks.push(P(JP_LOC_SUFFIX[F.exLoc] ? JP_LOC_SUFFIX[F.exLoc][0] + 'に' : 'に')); }
            if (F.p) { const pl = JP_PLACE[F.p]; toks.push(T(F.p, pl[0], pl[1]), P('に')); }
            F.ex.forEach((e, i) => { if (i) toks.push(P('と')); toks.push(nounTok(e)); });
            toks.push(P('が'));
            const animate = F.ex.some(e => ANIMATE.has(e));
            const surf = animate ? (pol ? (F.past ? 'いました' : F.neg ? 'いません' : 'います') : (F.past ? 'いた' : F.neg ? 'いない' : 'いる'))
                                 : (pol ? (F.past ? 'ありました' : F.neg ? 'ありません' : 'あります') : (F.past ? 'あった' : F.neg ? 'ない' : 'ある'));
            toks.push(T('have', surf, surf, 'verb'));
            if (F.q) toks.push(P(pol ? 'か' : 'の'));
            return toks;
        }
        if (F.p) { const pl = JP_PLACE[F.p]; toks.push(T(F.p, pl[0], pl[1]), P(subjId ? 'で' : 'は')); }
        if (F.n) {
            const qn = F.n === 'what';
            toks.push(qn ? T('what', '何', 'なん') : nounTok(F.n));
            toks.push(P(F.q || qn || F.n === 'who' ? (pol ? 'ですか' : 'なの') : F.past ? (pol ? 'でした' : 'だった') : (pol ? 'です' : 'だ')));
            return toks;
        }
        const pr = F.pr || [];
        pr.forEach((adj, i) => {
            const last = i === pr.length - 1;
            if (i === 0 && F.int) toks.push(T(F.int, vocab[F.int].kanji, vocab[F.int].kana));
            const form = last ? (F.neg ? 'neg' : F.past ? 'past' : 'pred') : 'te';
            const f = jpAdjForm(adj, form, pol);
            toks.push(T(adj, f[0], f[1]));
        });
        if (F.q) toks.push(P(pol ? 'か' : 'の'));
        return toks;
    }
    // ---- verbal clause ----
    const vf = vframe(F.v);
    if (F.p && !F.g && !F.l) {
        const pl = JP_PLACE[F.p];
        const part = (F.v === 'look' && !F.o) ? 'を' : ['walk'].includes(F.v) ? 'を'
                   : ['sit','stand','live','put','putdown','hang','hangup','plant','float','hide','go','come','return','arrive','enter','climb'].includes(F.v) ? 'に' : 'で';
        toks.push(T(F.p, pl[0], pl[1]), P(part));
    }
    if (F.l) {
        toks.push(nounTok(F.l));
        if (JP_LOC_SUFFIX[F.l]) toks.push(P(JP_LOC_SUFFIX[F.l][0], JP_LOC_SUFFIX[F.l][1]));
        if (F.p) { const pl = JP_PLACE[F.p]; toks.push(P('の'), T(F.p, pl[0], pl[1])); }
        toks.push(P(vf.jl || (['put','putdown','hang','hangup','plant'].includes(F.v) ? 'に' : 'で')));
    }
    if (F.src) toks.push(nounTok(F.src), P('を'));
    if (F.path) toks.push(nounTok(F.path), P('を'));
    if (F.w) { nounPhraseJP(F, F.w, toks); toks.push(P(vf.jw || 'と', vf.jwr || vf.jw || 'と')); }
    if (F.i) { nounPhraseJP(F, F.i, toks); toks.push(P('で')); }
    if (F.d) { nounPhraseJP(F, F.d, toks); toks.push(P(vf.jd || 'に')); }
    (F.m || []).filter(m => m === 'together' || m === 'together2').forEach(m => toks.push(T(m, vocab[m].kanji, vocab[m].kana)));
    if (F.o) {
        F.o.forEach((o, i) => { if (i) toks.push(P('と')); nounPhraseJP(F, o, toks); });
        const isPro = vocab[F.o[0]].type === 'pronoun';
        const jo = F.v === 'burn' ? 'に' : (vf.jo && (!isPro || vf.joPro)) ? vf.jo : 'を';
        toks.push(P(jo));
        if (F.count) { const c = JP_COUNTERS[F.o[0]]; toks.push(T('one', '一' + c[0], c[1], 'mod')); }
    }
    if (F.g) {
        toks.push(nounTok(F.g));
        if (F.p) { const pl = JP_PLACE[F.p]; toks.push(P('の'), T(F.p, pl[0], pl[1])); }
        toks.push(P('に'));
    }
    (F.m || []).filter(m => m !== 'together' && m !== 'together2').forEach((m, i) => {
        if (i === 0 && F.int) toks.push(T(F.int, vocab[F.int].kanji, vocab[F.int].kana));
        const f = m === 'happy' ? ['嬉しそうに', 'うれしそうに'] : jpAdjForm(m, 'adv', pol);
        toks.push(T(m, f[0], f[1]));
    });
    toks.push(...verbTokensJP(Object.assign({}, F, { burnObj: F.v === 'burn' && !!F.o })));
    if (F.then) {
        toks.push(P('、'));
        const T2 = Object.assign({}, F.then, { polite: pol, a: undefined });
        const sub = clauseJP(Object.assign(T2, { pro: true }));
        toks.push(...sub);
    }
    if (F.q2you || F.q) toks.push(P(pol ? 'か' : 'の'));
    return toks;
}
function punctJP(F) {
    if (F.fixed) return '';
    if (F.q || F.q2you || F.n === 'what' || F.n === 'who' || F.mod === 'may') return '？';
    if (F.imp || F.vol || (F.pre && !F.v && !F.s && !F.ex && !F.n)) return '！';
    return '。';
}
function commentJP(F, toks) {
    const pol = F.polite !== false;
    if (F.cint) toks.push(T(F.cint, vocab[F.cint].kanji, vocab[F.cint].kana));
    const f = jpAdjForm(F.c, F.past ? 'past' : 'pred', pol);
    toks.push(T(F.c, f[0], f[1]));
    toks.push(P('ね'));
}
// Realise a whole utterance: tokens (for colour coding + learning), kanji text, kana text
function realizeJP(inst) {
    const words = [];
    const sentences = [];
    for (let F = inst; F; F = F.next) {
        F.polite = inst.polite;
        const toks = clauseJP(F);
        if (F.sfp) toks.push(P(F.sfp));
        const pj = punctJP(F);
        if (pj) toks.push(P(pj));
        if (F.c) { commentJP(F, toks); toks.push(P('。')); }
        words.push(...toks);
        sentences.push(toks);
    }
    const kanjiText = words.map(w => w.kanji).join('');
    const isPunct = k => /^[。、！？…]+$/.test(k);
    const kanaText = sentences.map(s => {
        let out = '';
        for (const w of s) {
            if (isPunct(w.kanji)) out += w.kanji;
            else out += (out && !/[、。！？]$/.test(out) ? ' ' : (out ? ' ' : '')) + w.kana;
        }
        return out;
    }).join(' ');
    return { words, kanjiText, kanaText };
}

// ============================================================
//  GERMAN REALISATION (from the same frame; only what the learner understood)
// ============================================================
const DE_PRO = { me: ['ich','mich','mir','1s'], you: ['du','dich','dir','2s'], he: ['er','ihn','ihm','3s'], she: ['sie','sie','ihr','3s'],
    we: ['wir','uns','uns','1p'], they: ['sie','sie','ihnen','3p'], this: ['das','das','dem','3s'], that: ['das','das','dem','3s'],
    who: ['wer','wen','wem','3s'], what: ['was','was','was','3s'], where: ['wo','wo','wo','3s'] };
const DE_REFL = { '1s': 'mich', '2s': 'dich', '3s': 'sich', '1p': 'uns', '3p': 'sich' };
const DE_ART = {
    def:   { m: ['der','den','dem'], f: ['die','die','der'], n: ['das','das','dem'], pl: ['die','die','den'] },
    indef: { m: ['ein','einen','einem'], f: ['eine','eine','einer'], n: ['ein','ein','einem'], pl: ['','',''] },
    dies:  { m: ['dieser','diesen','diesem'], f: ['diese','diese','dieser'], n: ['dieses','dieses','diesem'], pl: ['diese','diese','diesen'] },
    kein:  { m: ['kein','keinen','keinem'], f: ['keine','keine','keiner'], n: ['kein','kein','keinem'], pl: ['keine','keine','keinen'] },
    mein:  { m: ['mein','meinen','meinem'], f: ['meine','meine','meiner'], n: ['mein','mein','meinem'], pl: ['meine','meine','meinen'] },
    zero:  { m: ['','',''], f: ['','',''], n: ['','',''], pl: ['','',''] },
};
const DE_ADJ_END = {
    weak:   { m: ['e','en','en'], f: ['e','e','en'], n: ['e','e','en'], pl: ['en','en','en'] },
    mixed:  { m: ['er','en','en'], f: ['e','e','en'], n: ['es','es','en'], pl: ['en','en','en'] },
    strong: { m: ['er','en','em'], f: ['e','e','er'], n: ['es','es','em'], pl: ['e','e','en'] },
};
const DE_PLURAL = { flower: 'Blumen', fish: 'Fische', star: 'Sterne', bird: 'Vögel', stone: 'Steine', cloud: 'Wolken', tree: 'Bäume',
    lantern: 'Laternen', thing: 'Dinge', book: 'Bücher', egg: 'Eier', insect: 'Insekten', butterfly: 'Schmetterlinge', child: 'Kinder',
    person: 'Leute', friend: 'Freunde', character: 'Schriftzeichen', apple: 'Äpfel', candle: 'Kerzen', leaf: 'Blätter', boat: 'Boote',
    shop: 'Läden', mushroom: 'Pilze', sparrow: 'Spatzen', duck: 'Enten',
};
const CASE = { nom: 0, acc: 1, dat: 2 };
const DE_WEAK = { neighbor: 'Nachbarn', boy: 'Jungen', monkey: 'Affen', farmer: 'Bauern', sparrow: 'Spatzen', person: 'Person' };   // n-declension (den Nachbarn)
function deNounInfo(id) {
    const spec = (DE_NOUN[id] || 'n').split(' ');
    const v = vocab[id];
    return { g: spec[0], mass: spec.includes('M'), uniq: spec.includes('U'), word: DE_WORD[id] || (v ? v.de : id) };
}
// Predicate / adverb word; attributive stem
function deAdjWord(id, mode) {
    if (mode === 'pred' && id === 'happy') return 'glücklich';
    return DE_ADJ[id] || (vocab[id] ? vocab[id].de : id);
}
function deAdjStem(w) {
    if (w === 'hoch') return 'hoh';
    if (/[^aeiou]el$/.test(w)) return w.slice(0, -2) + 'l';
    if (/euer$|auer$/.test(w)) return w.slice(0, -2) + 'r';
    return w;
}
// Noun phrase in a case; det: def | indef | dies | kein | mein | zero | auto (mass/plural → none, unique → der, else ein)
function deNP(id, kase, det, adj) {
    const ci = CASE[kase];
    if (vocab[id] && vocab[id].type === 'pronoun' && DE_PRO[id]) return DE_PRO[id][ci];
    if (id === 'home') return ['das Haus', 'das Haus', 'dem Haus'][ci];
    if (id === 'god') return 'Gott';
    if (lxClass(id) === 'time') return vocab[id].de;
    const N = deNounInfo(id);
    if (id === 'thing' && det === 'auto' && kase !== 'nom' && !adj) return 'etwas';
    if (det === 'auto') det = FAMILY_BODY.has(id) ? 'mein' : (N.mass || N.g === 'pl') ? 'zero' : N.uniq ? 'def' : 'indef';
    if (det === 'plural') {
        const pw = DE_PLURAL[id];
        if (!pw || N.mass) return (adj ? deAdjStem(deAdjWord(adj)) + 'e ' : '') + N.word;
        return (adj ? deAdjStem(deAdjWord(adj)) + (kase === 'dat' ? 'en ' : 'e ') : '') + pw + (kase === 'dat' && !/[ns]$/.test(pw) ? 'n' : '');
    }
    const art = DE_ART[det][N.g][ci];
    let a = '';
    if (adj) {
        const decl = det === 'def' || det === 'dies' ? 'weak' : (det === 'zero' || (det === 'indef' && N.g === 'pl')) ? 'strong' : 'mixed';
        a = deAdjStem(deAdjWord(adj)) + DE_ADJ_END[decl][N.g][ci] + ' ';
    }
    let word = N.word;
    if (kase !== 'nom' && DE_WEAK[id]) word = DE_WEAK[id];
    if (kase === 'dat' && N.g === 'pl' && !/[ns]$/.test(word)) word += 'n';
    return ((art ? art + ' ' : '') + a + word).trim();
}
// Contract preposition + article: an dem → am, in dem → im, zu dem → zum, zu der → zur, von dem → vom
function dePrep(prep, np) {
    const m = /^(dem|der|das) (.*)$/.exec(np);
    if (m) {
        const k = prep + ' ' + m[1];
        const c = { 'an dem': 'am', 'in dem': 'im', 'zu dem': 'zum', 'zu der': 'zur', 'von dem': 'vom', 'in das': 'ins', 'an das': 'ans', 'bei dem': 'beim' }[k];
        if (c) return c + ' ' + m[2];
    }
    return prep + ' ' + np;
}
function personOf(id, andId) {
    if (andId) return '3p';
    if (!id) return '1s';
    if (vocab[id] && vocab[id].type === 'pronoun' && DE_PRO[id]) return DE_PRO[id][3];
    return deNounInfo(id).g === 'pl' ? '3p' : '3s';
}
function dePronFor(id) { const g = deNounInfo(id).g; return { m: 'er', f: 'sie', n: 'es', pl: 'sie' }[g]; }
// ---- verbs ----
function deVerbInfo(id) {
    const [inf, er, part, aux, sep, flags] = DE_VERB[id].split('|');
    return { inf, er, part, aux: aux || 'h', sep: sep || '', refl: (flags || '').includes('R'), eToI: (flags || '').includes('I') };
}
function dePresent(V, person) {
    const { inf, er } = V;
    const stem = inf.slice(0, -2);
    switch (person) {
        case '1s': return /eln$/.test(inf) ? inf.slice(0, -3) + 'le' : /ern$/.test(inf) ? inf.slice(0, -1) + 'e' : stem + 'e';
        case '2s':
            if (/[td]$/.test(stem)) return /et$/.test(er) ? er.slice(0, -1) + 'st' : er + 'st';
            if (/st$/.test(er) || /[sßzx]t$/.test(er)) return er;
            return er.slice(0, -1) + 'st';
        case '3s': return er;
        default: return inf;
    }
}
const DE_AUX = {
    sein:   { '1s': 'bin', '2s': 'bist', '3s': 'ist', '1p': 'sind', '3p': 'sind' },
    haben:  { '1s': 'habe', '2s': 'hast', '3s': 'hat', '1p': 'haben', '3p': 'haben' },
    war:    { '1s': 'war', '2s': 'warst', '3s': 'war', '1p': 'waren', '3p': 'waren' },
    should: { '1s': 'sollte', '2s': 'solltest', '3s': 'sollte', '1p': 'sollten', '3p': 'sollten' },
    can:    { '1s': 'kann', '2s': 'kannst', '3s': 'kann', '1p': 'können', '3p': 'können' },
    may:    { '1s': 'darf', '2s': 'darfst', '3s': 'darf', '1p': 'dürfen', '3p': 'dürfen' },
    will:   { '1s': 'werde', '2s': 'wirst', '3s': 'wird', '1p': 'werden', '3p': 'werden' },
    want:   { '1s': 'will', '2s': 'willst', '3s': 'will', '1p': 'wollen', '3p': 'wollen' },
};
function deImperative(V) {
    if (V.eToI) return V.er.slice(0, -1);
    const stem = /eln$/.test(V.inf) ? V.inf.slice(0, -3) + 'le' : /ern$/.test(V.inf) ? V.inf.slice(0, -1) : V.inf.slice(0, -2);
    return /[td]$/.test(stem) ? stem + 'e' : stem;
}
const DE_PATH = { bridge: 'über die Brücke', road: 'den Weg entlang', sky: 'am Himmel', river: 'auf dem Fluss', mountain: 'auf den Berg', field: 'über das Feld' };
const DE_SRC = { home: 'aus dem Haus', house: 'aus dem Haus', room: 'aus dem Zimmer', village: 'aus dem Dorf' };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const LOWER_AFTER_INTJ = /^(Ich|Du|Er|Sie|Es|Wir|Das|Der|Die|Dies\w*|Mein\w*|Mir|Hier|Dort|Jetzt|Heute|Morgen|Gestern|Lass|Ein\w*)\b/;
function joinIntro(intro, clause) {
    if (!intro) return clause;
    if (!clause) return intro;
    return intro + ', ' + clause.replace(LOWER_AFTER_INTJ, w => w === 'Sie' ? 'sie' : w.charAt(0).toLowerCase() + w.slice(1));
}

// NP for a frame noun, with the extras attached to it (owner/material, place, adjective, この)
function deNounPhrase(F, id, kase, det, known) {
    const adj = F.oAttr && F.oAttr[id] && known(F.oAttr[id]) ? F.oAttr[id] : null;
    let d = det;
    if (F.thisDet === id && known('this')) d = 'dies';
    let np = deNP(id, kase, d, adj);
    if (F.mat && F.mat[id] && known(F.mat[id])) np += ' aus ' + deNounInfo(F.mat[id]).word;      // Korb aus Bambus
    if (F.of && F.of[id] && known(F.of[id])) np += ' ' + deGen(F.of[id]);                            // Klang des Wassers
    if (F.at && F.at[id] && known(F.at[id])) { const ph = DE_PLACE[F.at[id]]; np += ' ' + (ph ? ph[0] : dePrep('bei', deNP(F.at[id], 'dat', 'def'))); }
    return np;
}
function deGen(id) {
    const N = deNounInfo(id);
    if (N.g === 'f' || N.g === 'pl') return 'der ' + N.word;
    return 'des ' + N.word + (/[sßzx]$/.test(N.word) ? 'es' : 's');
}

// Build the German for one frame. known(id) says whether the learner understands a word.
function clauseDE(F, known) {
    let unknown = false;
    const K = id => { if (!id) return false; if (known(id)) return true; unknown = true; return false; };
    if (F.fixed) {
        const ids = F.fixed.ids || [];
        const ok = ids.filter(id => K(id));
        if (ok.length === ids.length) return { text: F.fixed.de, unknown, any: true, raw: true };
        if (!ok.length) return { text: '', unknown: true, any: false };
        return { text: cap(ok.map(id => (F.fixed.gloss && F.fixed.gloss[id]) || deWordFor(id)).join(' ')), unknown: true, any: true };
    }
    const intro = F.pre && K(F.pre) ? (DE_INTJ[F.pre] || vocab[F.pre].de) : null;
    if (F.pre && !F.v && !F.s && !F.ex && !F.n) return { text: intro || '', unknown, any: !!intro, excl: true };

    const subjId = F.v ? F.a : F.s, subjAnd = F.v ? F.aAnd : F.sAnd;
    const person = F.q2you ? '2s' : personOf(subjId, subjAnd);
    let subj = null;
    if (F.q2you) subj = 'du';
    else if (F.v && F.a == null) subj = F.pro ? null : 'ich';
    else if (F.pro && subjId) subj = vocab[subjId].type === 'pronoun' ? DE_PRO[subjId][0] : dePronFor(subjId);
    else if (subjId && K(subjId)) {
        subj = deNounPhrase(F, subjId, 'nom', FAMILY_BODY.has(subjId) ? 'mein' : 'def', known);
        if (subjAnd && K(subjAnd)) subj += ' und ' + deNounPhrase(F, subjAnd, 'nom', FAMILY_BODY.has(subjAnd) ? 'mein' : 'def', known);
    }
    let any = !!subj && subj !== 'ich' && subj !== 'du';
    const isQ = !!(F.q || F.q2you || F.mod === 'may');

    if (!F.v) {
        // ---- verbless clauses ----
        const time = F.t && K(F.t) ? DE_TIME[F.t] : null;
        const where = F.p && K(F.p) ? DE_PLACE_ADV[F.p][0] : null;
        if (F.ex) {
            const nps = F.ex.filter(e => K(e)).map(e => deNP(e, 'nom', 'auto'));
            const locPh = F.exLoc && K(F.exLoc) ? (DE_PLACE[F.exLoc] ? DE_PLACE[F.exLoc][0] : dePrep('bei', deNP(F.exLoc, 'dat', 'def'))) : null;
            if (!nps.length) return { text: joinIntro(intro, [where, locPh, time].filter(Boolean).join(' ')), unknown: true, any: !!(where || locPh || time || intro) };
            const list = nps.length > 1 ? nps.slice(0, -1).join(', ') + ' und ' + nps[nps.length - 1] : nps[0];
            const plural = nps.length > 1 || F.ex.every(e => deNounInfo(e).g === 'pl');
            const cop = F.past ? (plural ? 'waren' : 'war') : (plural ? 'sind' : 'ist');
            const front = where || locPh;
            let s;
            if (isQ) s = `${F.past ? 'Gab' : 'Gibt'} es ${[front, time].filter(Boolean).join(' ')} ${list}`;
            else if (front) s = `${cap(front)} ${cop} ${time ? time + ' ' : ''}${F.neg ? list.replace(/^(ein|eine) /, 'kein$1 '.replace('keinein', 'kein').replace('keineine', 'keine')) : list}`;
            else s = `Es ${F.past ? 'gab' : 'gibt'} ${time ? time + ' ' : ''}${F.neg ? 'kein ' : ''}${nps.map((x, i) => deNP(F.ex[i], 'acc', 'auto')).join(' und ')}`;
            return { text: joinIntro(intro, s.replace(/\s+/g, ' ').trim()), unknown, any: true, q: isQ };
        }
        if (F.n) {
            if (F.n === 'what' || F.n === 'who') {
                const ok = K(F.n);
                return { text: ok ? joinIntro(intro, `${F.n === 'what' ? 'Was' : 'Wer'} ist ${subj || 'das'}`) : (intro || ''), unknown, any: ok || !!intro, q: ok };
            }
            const nk = K(F.n);
            const np = nk ? deNP(F.n, 'nom', lxClass(F.n) === 'tnoun' ? 'zero' : 'auto') : null;
            const cop = (F.past ? DE_AUX.war : DE_AUX.sein)[personOf(subjId)];
            const s = subj ? [cap(subj), cop, np].filter(Boolean).join(' ') : (np ? `Es ${F.past ? 'war' : 'ist'} ${np}` : '');
            return { text: joinIntro(intro, s), unknown, any: any || !!np || !!intro };
        }
        const adjs = (F.pr || []).filter(a => K(a));
        if (F.int && adjs.length) K(F.int);
        const extras = [time, where].filter(Boolean);
        if (adjs.length === 1 && subjId === 'me' && adjs[0] === 'bored') return { text: joinIntro(intro, `Mir ${F.past ? 'war' : 'ist'} ${extras.join(' ')} langweilig`.replace(/\s+/g, ' ')), unknown, any: true };
        if (adjs.length === 1 && DE_PRO[subjId] && subjId !== 'this' && subjId !== 'that' && (adjs[0] === 'cold' || adjs[0] === 'hot')) {
            const dat = DE_PRO[subjId][2];   // mir / dir / ihm … ist kalt
            return { text: joinIntro(intro, `${cap(dat)} ${F.past ? 'war' : 'ist'} ${extras.join(' ')} ${deAdjWord(adjs[0], 'pred')}`.replace(/\s+/g, ' ')), unknown, any: true };
        }
        if (adjs.length === 1 && subjId === 'me' && adjs[0] === 'afraid') return { text: joinIntro(intro, `Ich ${F.past ? 'hatte' : 'habe'} Angst`), unknown, any: true };
        if (adjs.includes('many') || adjs.includes('few')) {       // 花が多いです → Es gibt viele Blumen
            const q = adjs.includes('many') ? 'viel' : 'wenig';
            const N = F.s ? deNounInfo(F.s) : null;
            const np = F.s && known(F.s) ? (N.mass && N.g !== 'pl' ? `${q} ${N.word}` : `${q}e ${DE_PLURAL[F.s] || N.word}`) : null;
            const rest = adjs.filter(a => a !== 'many' && a !== 'few');
            const gibt = F.past ? 'gab' : 'gibt';
            let s = np ? `${where ? cap(where) + ' ' + gibt + ' es' : 'Es ' + gibt} ${time ? time + ' ' : ''}${np}` : '';
            if (rest.length) s += (s ? '. ' : '') + `${s ? (N && !N.mass && DE_PLURAL[F.s] ? (F.past ? 'Sie waren' : 'Sie sind') : (N ? cap(dePronFor(F.s)) + (F.past ? ' war' : ' ist') : (F.past ? 'Es war' : 'Es ist'))) : (F.past ? 'Es war' : 'Es ist')} ${rest.map(a => deAdjWord(a, 'pred')).join(' und ')}`;
            return { text: joinIntro(intro, s), unknown, any: !!s };
        }
        if (adjs.includes('fragrant')) {
            const rest = adjs.filter(a => a !== 'fragrant' && a !== 'good');
            const pl = personOf(subjId) === '3p';
            const s = `${cap(subj || 'es')} ${pl ? 'duften' : 'duftet'} gut${rest.length ? ' und ' + (pl ? 'sind ' : 'ist ') + rest.map(a => deAdjWord(a, 'pred')).join(' und ') : ''}`;
            return { text: joinIntro(intro, s), unknown, any: true };
        }
        if (!adjs.length) {
            const rest = [subj, ...extras].filter(Boolean);
            return { text: joinIntro(intro, rest.length ? cap(rest.join(' ')) : ''), unknown: true, any: rest.length > 0 || !!intro };
        }
        const sSubj = subj || (F.sHide ? 'ich' : (subjId ? null : 'es'));
        const pPerson = sSubj === 'es' ? '3s' : F.sHide ? '1s' : person;
        const cop = (F.past ? DE_AUX.war : DE_AUX.sein)[pPerson];
        const words = adjs.map(a => deAdjWord(a, 'pred'));
        if (F.int && known(F.int)) words[0] = (F.int === 'very' ? 'sehr ' : vocab[F.int].de + ' ') + words[0];
        const predStr = words.length > 1 ? words.slice(0, -1).join(', ') + ' und ' + words[words.length - 1] : words[0];
        const mid = [...extras, ...(F.adv || []).filter(a => K(a)).map(a => DE_SADV[a]), F.neg ? 'nicht' : null].filter(Boolean);
        const clause = isQ ? [cap(cop), sSubj, ...mid, predStr] : [sSubj ? cap(sSubj) : null, sSubj ? cop : cap(cop), ...mid, predStr];
        return { text: joinIntro(intro, clause.filter(Boolean).join(' ')), unknown, any: true, q: isQ };
    }

    // ---- verbal clause ----
    const V0 = deVerbInfo(F.v);
    const animalEats = F.v === 'eat' && F.a && ANIMAL.has(F.a);
    const V = animalEats ? { inf: 'fressen', er: 'frisst', part: 'gefressen', aux: 'h', sep: '', refl: false, eToI: true } : V0;
    const vKnown = K(F.v);
    const vf = vframe(F.v);
    const noObjLook = F.v === 'look' && !F.o;
    const lightIt = F.v === 'burn' && F.o;
    const sep = noObjLook ? '' : lightIt ? 'an' : V.sep;
    const inf = lightIt ? 'zünden' : V.inf, er = lightIt ? 'zündet' : V.er;
    const part = noObjLook ? 'geschaut' : lightIt ? 'angezündet' : V.part;
    const VV = { inf, er, eToI: V.eToI };
    const infFull = sep ? (sep.endsWith(' ') ? sep + inf : sep + inf) : inf;
    let fin = null, lead = null;
    const endVerb = [];
    if (vKnown) {
        if (F.vol) { lead = 'Lass uns'; endVerb.push(infFull); }
        else if (F.imp) { fin = deImperative(VV); if (sep) endVerb.push(sep.trim()); }
        else if (F.mod === 'like') { fin = dePresent(VV, person); if (sep) endVerb.push(sep.trim()); }
        else if (F.mod && K(F.mod)) { fin = DE_AUX[F.mod][person]; endVerb.push(infFull); }
        else if (F.mod) { fin = dePresent(VV, person); if (sep) endVerb.push(sep.trim()); }
        else if (F.past) { fin = (V.aux === 's' ? DE_AUX.sein : DE_AUX.haben)[person]; endVerb.push(part); }
        else { fin = dePresent(VV, person); if (sep) endVerb.push(sep.trim()); }
        any = true;
    } else if (F.mod && K(F.mod) && F.mod !== 'like') { fin = DE_AUX[F.mod][person]; any = true; }
    const refl = V.refl && vKnown ? DE_REFL[person] : null;

    const prons = [], timeGrp = [], defObjs = [], manner = [], placeGrp = [], indefObjs = [], dirGrp = [];
    if (refl) prons.push(refl);
    if (F.d && K(F.d)) {
        const dcase = vf.ddat === 'acc' || F.v === 'ask' ? 'acc' : 'dat';
        const np = deNounPhrase(F, F.d, dcase, FAMILY_BODY.has(F.d) ? 'mein' : 'def', known);
        (vocab[F.d].type === 'pronoun' ? prons : defObjs).push(np);
    }
    if (F.t && K(F.t)) timeGrp.push(DE_TIME[F.t] || vocab[F.t].de);
    if (F.q2you || F.also) timeGrp.push('auch');
    if (F.mod === 'like' && known('like')) timeGrp.push('gern');
    if (F.w && K(F.w)) timeGrp.push(vf.dw === 'zur' ? 'zur ' + deNounInfo(F.w).word : 'mit ' + deNounPhrase(F, F.w, 'dat', 'def', known));
    (F.m || []).filter(m => m === 'together' || m === 'together2').forEach(m => { if (K(m)) timeGrp.push(m === 'together' ? 'zusammen' : 'alle zusammen'); });
    for (const a of F.adv || []) if (K(a)) timeGrp.push(DE_SADV[a]);
    if (F.prog && !F.past && vKnown && !F.mod && !F.t && !JP_ALWAYS_TEIRU.has(F.v) && !(F.adv || []).includes('still')) timeGrp.push('gerade');
    // objects
    let negDone = false;
    const objs = (F.o || []).filter(o => K(o));
    const deCase = vf.de || 'acc';
    const defVerb = vf.ddet === 'def' || F.v === 'look' || (ANIMAL.has(F.o && F.o[0]) && ['wash','help','feed'].includes(F.v)) || !!(F.of && F.o && F.of[F.o[0]]);
    const objDet = o => FAMILY_BODY.has(o) ? 'mein' : defVerb && !(deNounInfo(o).mass && F.v !== 'look' && !(F.of && F.of[o])) ? 'def' : 'auto';
    if (objs.length) {
        if (deCase.startsWith('prep:') && (vocab[objs[0]].type !== 'pronoun' || vf.joPro)) {
            const [prep, c] = deCase.slice(5).split(' ');
            const nps = objs.map(o => deNounPhrase(F, o, c, o === 'home' ? 'mein' : (FAMILY_BODY.has(o) ? 'mein' : 'def'), known).replace(/^das Haus$/, 'mein Zuhause').replace(/^dem Haus$/, 'meinem Zuhause'));
            const first = dePrep(prep, nps[0]);
            defObjs.push((vf.deFill ? vf.deFill + ' ' : '') + [first, ...nps.slice(1)].join(' und '));
        } else {
            const parts = [];
            let allDef = true;
            objs.forEach((o, idx) => {
                const N = deNounInfo(o);
                const isPron = vocab[o].type === 'pronoun';
                if (F.count && idx === 0 && JP_COUNTERS[o] && JP_COUNTERS[o][2] && known('one')) { parts.push(JP_COUNTERS[o][2] + ' ' + N.word); allDef = false; return; }
                let det = isPron ? 'def' : objDet(o);
                if (animalEats && o === 'food') { parts.push('Futter'); allDef = false; return; }
                if (F.neg && !negDone && det === 'auto' && !N.uniq) { det = 'kein'; negDone = true; }
                const np = deNounPhrase(F, o, deCase === 'dat' ? 'dat' : 'acc', det, known);
                if (!(det === 'def' || det === 'dies' || det === 'mein' || (det === 'auto' && N.uniq) || isPron || F.thisDet === o)) allDef = false;
                parts.push(np);
            });
            const joined = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' und ' + parts[parts.length - 1] : parts[0];
            if (objs.length === 1 && vocab[objs[0]].type === 'pronoun') prons.push(joined);
            else (allDef ? defObjs : indefObjs).push(joined);
        }
    }
    const mWords = (F.m || []).filter(m => m !== 'together' && m !== 'together2' && K(m)).map(m => deAdjWord(m));
    if (mWords.length && F.int && known(F.int)) mWords[0] = 'sehr ' + mWords[0];
    manner.push(...mWords);
    const dirVerb = ['go','come','return','enter','climb','arrive'].includes(F.v) || (F.v === 'look' && !F.o);
    const placeWord = F.p && K(F.p) ? DE_PLACE_ADV[F.p][dirVerb && F.v !== 'arrive' ? 1 : 0] : null;
    if (F.l && K(F.l)) {
        let ph = DE_PLACE[F.l] ? DE_PLACE[F.l][0] : dePrep('bei', deNP(F.l, 'dat', 'def'));
        if ((F.l === 'river' || F.l === 'lake') && F.v !== 'swim') ph = F.l === 'river' ? 'am Fluss' : 'am See';
        placeGrp.push(ph);
    } else if (placeWord && !F.g && !dirVerb) placeGrp.push(placeWord);
    if (F.i && K(F.i)) {
        const N = deNounInfo(F.i);
        const prep = vf.di || 'mit';
        const np = prep === 'aus' || N.mass ? N.word : (DE_PLURAL[F.i] && F.v === 'celebrate' ? DE_PLURAL[F.i] + 'n'.slice(DE_PLURAL[F.i].endsWith('n') ? 1 : 0) : deNounPhrase(F, F.i, 'dat', 'def', known));
        placeGrp.push(prep + ' ' + np);
    }
    if (F.g && K(F.g)) {
        const ph = DE_PLACE[F.g];
        let g = F.v === 'arrive' ? (ph ? ph[0] : dePrep('bei', deNP(F.g, 'dat', 'def'))) : (ph ? ph[1] : dePrep('zu', deNP(F.g, 'dat', 'def')));
        if (F.v === 'enter' && F.g === 'home') g = 'ins Haus';
        if (vf.dg === 'auf') g = 'auf ' + deNP(F.g, 'acc', 'def');
        dirGrp.push(g);
    } else if (placeWord && (F.g || dirVerb)) dirGrp.push(placeWord);
    if (F.src && K(F.src)) dirGrp.push(DE_SRC[F.src] || dePrep('aus', deNP(F.src, 'dat', 'def')));
    if (F.path && K(F.path)) dirGrp.push(DE_PATH[F.path] || 'über ' + deNP(F.path, 'acc', 'def'));
    const negWord = F.neg && !negDone ? ['nicht'] : [];
    const tailGroups = placeGrp.length || dirGrp.length;
    const middle = [...prons, ...timeGrp, ...defObjs, ...manner, ...(tailGroups ? negWord : []), ...placeGrp, ...indefObjs, ...dirGrp, ...(tailGroups ? [] : negWord)];
    if (middle.length) any = true;

    let words;
    if (lead) words = [lead, ...middle, ...endVerb];
    else if (F.imp) words = fin ? [fin, ...middle, ...endVerb] : middle;
    else if (isQ && fin) words = [fin, subj, ...middle, ...endVerb];
    else words = [subj, fin, ...middle, ...endVerb];
    words = words.filter(Boolean);
    if (!fin && !lead) words = words.filter(w => w !== 'gerade');
    let text = words.length ? cap(words.join(' ')) : '';
    // て-chain: same subject, second verb → "… und lese"
    if (F.then && known(F.then.v)) {
        const T2 = Object.assign({}, F.then, { a: F.a, pro: true, past: F.past });
        const r2 = clauseDE(T2, known);
        let t2 = r2.text ? r2.text.charAt(0).toLowerCase() + r2.text.slice(1) : '';
        if (F.past && fin && T2.past && t2.startsWith(fin + ' ')) t2 = t2.slice(fin.length + 1);   // "… gesessen und gelesen"
        if (t2) text += (text ? ' und ' : '') + t2;
        unknown = unknown || r2.unknown;
    } else if (F.then) unknown = true;
    return { text: joinIntro(intro, text), unknown, any: any || !!intro, q: isQ && !!fin, excl: !!(F.imp || F.vol) && !!(fin || lead) };
}
function deWordFor(id) {
    const c = lxClass(id);
    if (c === 'noun' || c === 'tnoun') return deNounInfo(id).word;
    if (c === 'adj') return deAdjWord(id, 'pred');
    if (c === 'intj') return DE_INTJ[id] || vocab[id].de;
    if (c === 'verb' && DE_VERB[id]) { const V = deVerbInfo(id); return V.sep + V.inf; }   // zurückkehren, um die Wette laufen
    return vocab[id] ? vocab[id].de : id;
}
function commentDE(F, known) {
    if (!known(F.c)) return { text: '', unknown: true, any: false };
    const evaluative = ['good','tasty','beautiful','bad'].includes(F.c);
    const o = F.o && F.o[0];
    const subj = !evaluative && o && vocab[o].type !== 'pronoun' ? cap(dePronFor(o)) : 'Das';
    const pl = subj === 'Sie' && o && deNounInfo(o).g === 'pl';
    const cop = F.past ? (pl ? 'waren' : 'war') : (pl ? 'sind' : 'ist');
    return { text: `${subj} ${cop} ${F.cint && known(F.cint) ? 'sehr ' : ''}${deAdjWord(F.c, 'pred')}`, unknown: !!(F.cint && !known(F.cint)), any: true };
}
// Whole utterance → the learner's German (known parts only; '...' marks what wasn't understood)
function realizeDE(inst, learner) {
    const known = id => !id || id.startsWith('_') || knowsWord(learner, id);
    const out = [];
    let anyKnown = false, anyUnknown = false;
    for (let F = inst; F; F = F.next) {
        const r = clauseDE(F, known);
        anyUnknown = anyUnknown || r.unknown;
        if (r.text && r.any) {
            anyKnown = true;
            out.push(r.raw ? r.text : r.text + (r.q ? '?' : r.excl ? '!' : '.'));
        }
        if (F.c) {
            const c = commentDE(F, known);
            anyUnknown = anyUnknown || c.unknown;
            if (c.any) { anyKnown = true; out.push(c.text + '.'); }
        }
    }
    if (!anyKnown) return { text: '...', anyKnown: false };
    let text = out.join(' ');
    if (anyUnknown) text = text.replace(/[.!]$/, '') + ' ...';
    return { text: cap(text), anyKnown: true };
}

// ---- Hand-written frames (templates the general rules can't read) ----
// FX: a fixed phrase. Tokens are "kanji|kana|conceptId|type" (grammar pieces just "kanji").
// ids: the words the learner must know to understand it all (partial understanding shows their glosses).
function FX(tokens, de, ids, gloss) {
    return { fixed: { jp: tokens.map(t => t.split('|')), de, ids, gloss } };
}
Object.assign(FRAME_OVERRIDES, {
    // food & drink
    'cook_rice|cook rice hot': FX(['ご飯|ごはん','を','炊きます|たきます','。','熱い|あつい|hot2','ですね','。'], 'Ich koche Reis. Er ist heiß.', ['hot2'], { hot2: 'heiß' }),
    'make_onigiri|make rice food': { v: 'make', o: ['onigiri'], i: 'rice' },
    'brew_tea|water hot tea': { s: 'water', pr: ['hot2'], next: { v: 'make', o: ['tea'] } },
    'dry_tea|tea sun hot': FX(['お茶|おちゃ|tea','は','太陽|たいよう|sun','の下で|のしたで','熱く|あつく|hot2','なります','。'], 'Der Tee wird in der Sonne heiß.', ['tea','sun','hot2']),
    'dry_tea|wait time good': FX(['時|とき|time','が','来る|くる|come|verb','のを','待ちます|まちます|wait|verb','。'], 'Ich warte, bis es Zeit ist.', ['time','come','wait']),
    'tell_about_tea|tea time good': FX(['お茶|おちゃ|tea','の','時|とき|time','は','いい|いい|good','ですね','。'], 'Die Teezeit ist schön.', ['tea','time','good']),
    'make_sugar_snack|child like sugar': FX(['子供|こども|child','は','砂糖|さとう|sugar','が','好き|すき|like','です','。'], 'Kinder mögen Zucker.', ['child','like','sugar']),
    'taste_food|taste good very': { v: 'taste', c: 'good', cint: 'very' },
    // making things
    'write_calligraphy|write brush good': { v: 'write', i: 'brush', c: 'good' },
    'write_calligraphy|brush ink paper': { ex: ['brush','ink','paper'], p: 'here' },
    'paint_picture|paint mountain water': { v: 'paint', o: ['mountain','water'] },
    'make_fan|make fan bamboo': { v: 'make', o: ['fan'], i: 'bamboo' },
    'make_basket|basket bamboo good': { s: 'basket', mat: { basket: 'bamboo' }, pr: ['good'] },
    'think_home|home far': FX(['家|いえ|home','は','遠い|とおい|far','です','。'], 'Mein Zuhause ist weit weg.', ['home','far']),
    'make_basket|make basket big': { v: 'make', o: ['basket'], oAttr: { basket: 'big' } },
    'fold_origami|make bird paper': { v: 'make', o: ['bird'], i: 'paper' },
    'play_music|me play music': { a: 'me', v: 'make', o: ['music'] },
    'play_bamboo_flute|me play music': { a: 'me', v: 'make', o: ['music'] },
    'play_bamboo_flute|bamboo music beautiful': FX(['竹|たけ|bamboo','の','音楽|おんがく|music','は','美しい|うつくしい|beautiful','です','。'], 'Die Bambusmusik ist schön.', ['bamboo','music','beautiful']),
    'play_bamboo_flute|blow bamboo sound': FX(['竹|たけ|bamboo','を','吹きます|ふきます|blow|verb','。','いい|いい|good','音|おと|sound','ですね','。'], 'Ich blase in den Bambus. Ein schöner Klang.', ['blow','bamboo','sound']),
    'ring_bell|me play bell': FX(['私|わたし|me','は','鐘|かね|bell','を','鳴らします|ならします','。'], 'Ich läute die Glocke.', ['me','bell']),
    'ring_bell|bell sound big': FX(['鐘|かね|bell','の','音|おと|sound','は','大きい|おおきい|big','です','。'], 'Der Klang der Glocke ist laut.', ['bell','sound','big'], { big: 'laut' }),
    'light_candle|me open candle': { a: 'me', v: 'burn', o: ['candle'] },
    'light_lantern|me make fire': FX(['私|わたし|me','は','火|ひ|fire','を','つけます','。'], 'Ich mache Feuer.', ['me','fire']),
    'hang_laundry|clothes sundry sun': FX(['色々な|いろいろな|sundry','服|ふく|clothes','を','太陽|たいよう|sun','の下に|のしたに','干します|ほします|hangup|verb','。'], 'Ich hänge verschiedene Kleidung in der Sonne auf.', ['sundry','clothes','sun','hangup']),
    'dress_up|wear hat good': FX(['帽子|ぼうし|hat','を','かぶります','。','いい|いい|good','ですね','。'], 'Ich setze den Hut auf. Das ist gut.', ['hat','good']),
    'tie_boat|rope boat hand': FX(['手|て|hand','で','縄|なわ|rope','を','船|ふね|boat','に','掛けます|かけます|hang|verb','。'], 'Ich binde das Seil mit der Hand an das Boot.', ['hand','rope','boat','hang']),
    'teach_class|teach lesson good': FX(['授業|じゅぎょう|lesson','を','教えます|おしえます|teach|verb','。','いい|いい|good','ですね','。'], 'Ich gebe Unterricht. Das ist gut.', ['teach','lesson','good']),
    'explain_habit|every day make': FX(['毎|まい|every','日|にち|day','作ります|つくります|make|verb','。'], 'Ich mache das jeden Tag.', ['every','day','make']),
    'tell_story|me tell story': FX(['私|わたし|me','は','話|はなし|story','を','します','。'], 'Ich erzähle eine Geschichte.', ['me','story']),
    'tell_story|listen me tell': FX(['私|わたし|me','が','話す|はなす|tell|verb','のを','聞いて|きいて|listen|verb','ください','！'], 'Hör zu, wenn ich erzähle!', ['listen','me','tell']),
    'tell_about_tea|me inform you tea': { a: 'me', v: 'inform', d: 'you', o: ['tea'] },
    // looking, places
    'look_sky|look there': { v: 'look', p: 'there', imp: true },
    'look_pagoda|look up beautiful': { v: 'look', p: 'up', imp: true, c: 'beautiful' },
    'smell_flower|smell beautiful': { v: 'smell', o: ['flower'], c: 'beautiful' },
    'look_at_lotus|look water beautiful': { v: 'look', o: ['water'], c: 'beautiful' },
    'watch_lantern|look lantern beautiful': { v: 'look', o: ['lantern'], c: 'beautiful' },
    'look_bird|look bird sky': { v: 'look', o: ['bird'], at: { bird: 'sky' } },
    'look_star|look sky star': { v: 'look', o: ['star'], at: { star: 'sky' } },
    'watch_cloud|look sky cloud': { v: 'look', o: ['cloud'], at: { cloud: 'sky' } },
    'feed_fish|look fish water': { v: 'look', o: ['fish'], at: { fish: 'water' } },
    'watch_fish|look fish water': { v: 'look', o: ['fish'], at: { fish: 'water' } },
    'watch_butterfly|look butterfly fly': FX(['蝶|ちょう|butterfly','が','飛ぶ|とぶ|fly|verb','のを','見ます|みます|look|verb','。'], 'Ich sehe den Schmetterling fliegen.', ['butterfly','fly','look']),
    'stand_bridge|look river deep': { v: 'look', o: ['river'], c: 'deep' },
    'watch_sunset|look here beautiful': FX(['ここ|ここ|here','から','見る|みる|look|verb','と','、','美しい|うつくしい|beautiful','ですね','。'], 'Von hier aus ist es schön.', ['here','look','beautiful']),
    'climb_pagoda|up look far': FX(['上|うえ|up','から','遠く|とおく|far','を','見ます|みます|look|verb','。'], 'Von oben schaue ich in die Ferne.', ['up','far','look']),
    'climb_mountain|climb mountain far': { v: 'climb', g: 'mountain', next: { s: 'mountain', pro: true, pr: ['far'] } },
    'watch_river_dock|look river far': FX(['遠く|とおく|far','の','川|かわ|river','を','見ます|みます|look|verb','。'], 'Ich schaue auf den Fluss in der Ferne.', ['far','river','look']),
    'watch_river_dock|water go far': FX(['水|みず|water','は','遠く|とおく|far','へ','行きます|いきます|go|verb','。'], 'Das Wasser fließt in die Ferne.', ['water','far','go']),
    'watch_river_dock|boat river go': FX(['船|ふね|boat','は','川|かわ|river','を','行きます|いきます|go|verb','。'], 'Das Boot fährt auf dem Fluss.', ['boat','river','go']),
    'cross_bridge|walk river bridge': FX(['川|かわ|river','の','橋|はし|bridge','を','歩きます|あるきます|walk|verb','。'], 'Ich gehe über die Brücke am Fluss.', ['river','bridge','walk']),
    'walk_path|walk front go': FX(['前|まえ|front','へ','歩いて|あるいて|walk|verb','行きます|いきます|go|verb','。'], 'Ich gehe nach vorne.', ['front','walk','go']),
    'listen_river_bridge|listen water sound': { v: 'listen', o: ['sound'], of: { sound: 'water' } },
    'listen_river_bridge|bridge river beautiful': FX(['川|かわ|river','の','橋|はし|bridge','は','美しい|うつくしい|beautiful','です','。'], 'Die Brücke über den Fluss ist schön.', ['river','bridge','beautiful']),
    'paint_lotus|lotus beautiful water': FX(['水|みず|water','の上の|のうえの','蓮|はす|lotus','は','美しい|うつくしい|beautiful','です','。'], 'Der Lotus auf dem Wasser ist schön.', ['water','lotus','beautiful']),
    'skip_stones|stone water far': FX(['石|いし|stone','は','水|みず|water','の上を|のうえを','遠く|とおく|far','へ','飛びます|とびます|fly|verb','。'], 'Der Stein springt weit über das Wasser.', ['stone','water','far','fly']),
    'skip_stones|play river good': { v: 'play', l: 'river', c: 'good' },
    'write_poem_willow|poem tree wind': FX(['木|き|tree','と','風|かぜ|wind','の','俳句|はいく|poem','です','。'], 'Ein Haiku über den Baum und den Wind.', ['tree','wind','poem']),
    'plant_rice|rice field good': { s: 'rice', at: { rice: 'field' }, pr: ['good'] },
    'tend_rice|water field good': { s: 'water', at: { water: 'field' }, pr: ['good'] },
    'fish_catch|fish water good': { ex: ['fish'], exLoc: 'water', c: 'good' },
    'watch_frog|frog water': { ex: ['frog'], exLoc: 'water' },
    'see_snake|snake there': { ex: ['snake'], p: 'there' },
    'tend_garden|flower beautiful many': { s: 'flower', pr: ['many'], ga: true, c: 'beautiful' },
    'study_characters|character many': { s: 'character', pr: ['many'], ga: true },
    'harvest_rice|rice many good': { s: 'rice', pr: ['many','good'], ga: true },
    'enjoy_view|mountain river beautiful': { s: 'mountain', sAnd: 'river', pr: ['beautiful'] },
    'enjoy_view|hope good tomorrow': FX(['明日|あした|tomorrow','に','希望|きぼう|hope','が','あります','。','いい|いい|good','ですね','。'], 'Es gibt Hoffnung für morgen. Das ist gut.', ['tomorrow','hope','good']),
    'pray_shrine|wish good heart': FX(['心|こころ|heart','に','いい|いい|good','願い|ねがい|wish','が','あります','。'], 'In meinem Herzen ist ein guter Wunsch.', ['heart','good','wish']),
    'heal_friend|body good': FX(['体|からだ|body','に','いい|いい|good','です','。'], 'Das ist gut für den Körper.', ['body','good']),
    // people, actions
    'buy_at_market|money buy food': { v: 'buy', o: ['food'], i: 'money' },
    'sell_at_market|sell silk money': FX(['絹|きぬ|silk','を','売って|うって|sell|verb','、','お金|おかね|money','を','もらいます','。'], 'Ich verkaufe Seide und bekomme Geld.', ['silk','sell','money']),
    'wash_clothes|wash water good': { v: 'wash', i: 'water', c: 'good' },
    'wash_face_well|me wash water': { a: 'me', v: 'wash', i: 'water' },
    'teach_friend|teach learn good': { v: 'teach', d: 'you', next: { a: 'you', v: 'learn', c: 'good' } },
    'ask_question|ask what this': { v: 'ask', next: { s: 'this', n: 'what' } },
    'ask_question|you answer me': FX(['私|わたし|me','に','答え|こたえ|answer','を','ください','！'], 'Gib mir eine Antwort!', ['me','answer']),
    'ask_teacher2|question what this': FX(['質問|しつもん|question','です','。','これ|これ|this','は','何|なん|what','ですか','？'], 'Eine Frage: Was ist das?', ['question','this','what']),
    'ask_teacher2|teacher answer me': FX(['先生|せんせい|teacher','は','私|わたし|me','に','答え|こたえ|answer','を','くれます','。'], 'Der Lehrer gibt mir eine Antwort.', ['teacher','me','answer']),
    'wait_friend|friend come': { a: 'friend', v: 'come', ga: true },
    'ride_horse|me run horse': { a: 'me', v: 'run', w: 'horse' },
    'ride_horse|run horse happy': { v: 'run', w: 'horse', m: ['happy'] },
    'rest_tree|rest tree quiet': { v: 'rest', l: 'tree', m: ['quiet'] },
    'rest_tree|me tired rest': { s: 'me', pr: ['tired'], next: { v: 'rest' } },
    'see_snake|me afraid run': { s: 'me', pr: ['afraid'], next: { v: 'run' } },
    'read_under_willow|sit read here': { v: 'sit', p: 'here', then: { v: 'read' } },
    'move_things|putdown here good': { v: 'putdown', o: ['this'], p: 'here', c: 'good' },
    'borrow_thing|me borrow you': FX(['私|わたし|me','は','あなた|あなた|you','から','借ります|かります|borrow|verb','。'], 'Ich leihe mir etwas von dir.', ['me','borrow','you']),
    'borrow_thing|borrow this may': { v: 'borrow', o: ['this'], mod: 'may' },
    'borrow_thing|me giveback tomorrow': { a: 'me', v: 'giveback', o: ['that'], t: 'tomorrow' },
    'enter_house|come home now': { v: 'return', g: 'home', t: 'now' },
    'wake_up|morning getup now': { n: 'morning', next: { v: 'getup', t: 'now' } },
    'race_friend|run fast goforit': { v: 'run', m: ['fast'], imp: true, next: { pre: 'goforit' } },
    'race_friend|begin compete now': FX(['今|いま|now','、','競い|きそい|compete|verb','始めましょう|はじめましょう|begin|verb','！'], 'Lass uns jetzt mit dem Wettrennen beginnen!', ['now','compete','begin']),
    'late_school|me belate now': FX(['私|わたし|me','は','今|いま|now','遅刻|ちこく|belate','しています','！'], 'Ich bin jetzt zu spät!', ['me','now','belate'], { belate: 'zu spät' }),
    'late_school|belate sorry run': FX(['遅刻|ちこく|belate','です','、','ごめんなさい|ごめんなさい|sorry','！','走ります|はしります|run|verb','。'], 'Ich bin zu spät, Entschuldigung! Ich laufe.', ['belate','sorry','run'], { belate: 'zu spät' }),
    'feel_bored|bored want play': { s: 'me', sHide: true, pr: ['bored'], next: { v: 'play', mod: 'want' } },
    'feel_bored|no thing make': FX(['作る|つくる|make|verb','物|もの|thing','が','ありません','。'], 'Es gibt nichts zu machen.', ['make','thing']),
    'feel_angry|me angry this': FX(['私|わたし|me','は','これ|これ|this','に','怒って|おこって|angry','います','。'], 'Ich bin wütend darüber.', ['me','this','angry']),
    'feel_angry|angry wrong no': FX(['怒って|おこって|angry','います','。','これ|これ','は','間違い|まちがい|wrong','です','！'], 'Ich bin wütend. Das ist falsch!', ['angry','wrong']),
    'feel_angry|no good this': { pre: 'no', s: 'this', pr: ['good'], neg: true },
    'remember_past|me remember yesterday': FX(['私|わたし|me','は','昨日|きのう|yesterday','のことを','覚えています|おぼえています|remember|verb','。'], 'Ich erinnere mich an gestern.', ['me','remember','yesterday']),
    'remember_past|remember year old': FX(['古い|ふるい|old','年|とし|year','のことを','覚えています|おぼえています|remember|verb','。'], 'Ich erinnere mich an alte Jahre.', ['remember','year','old']),
    'remember_past|forget no this': { v: 'forget', o: ['this'], neg: true },
    'hang_festival_lantern|celebrate festival lantern': { v: 'celebrate', o: ['festival'], i: 'lantern' },
    'hang_festival_lantern|festival happy together': FX(['一緒に|いっしょに|together','祭り|まつり|festival','を','祝う|いわう|celebrate|verb','のは','嬉しい|うれしい|happy','です','。'], 'Es macht mich glücklich, das Fest zusammen zu feiern.', ['together','festival','celebrate','happy']),
    'eat_mochi|festival together2 happy': FX(['皆で|みんなで|together2','祭り|まつり|festival','です','。','嬉しい|うれしい|happy','ですね','！'], 'Alle zusammen beim Fest – wie schön!', ['together2','festival','happy']),
    // greetings, small talk
    'greet_friend|me hello you': FX(['こんにちは|こんにちは|hello','！','あなた|あなた|you','は','元気|げんき','ですか','？'], 'Hallo! Wie geht es dir?', ['hello','you']),
    'greet_friend|hello friend good': FX(['こんにちは|こんにちは|hello','、','友達|ともだち|friend','！','会えて|あえて','いい|いい|good','ですね','。'], 'Hallo, mein Freund! Schön, dich zu sehen.', ['hello','friend','good']),
    'greet_friend|you name what': FX(['あなた|あなた|you','の','名前|なまえ|name','は','何|なん|what','ですか','？'], 'Wie heißt du?', ['you','name','what']),
    'say_goodbye|me goodbye you': FX(['私|わたし|me','は','あなた|あなた|you','に','さようなら|さようなら|goodbye','を','言います|いいます|say|verb','。'], 'Ich sage dir auf Wiedersehen.', ['me','you','goodbye']),
    'say_goodbye|goodbye friend': FX(['さようなら|さようなら|goodbye','、','友達|ともだち|friend','！'], 'Auf Wiedersehen, mein Freund!', ['goodbye','friend']),
    'say_goodbye|we goodbye now': FX(['私達|わたしたち|we','は','今|いま|now','さようなら|さようなら|goodbye','を','言います|いいます|say|verb','。'], 'Wir verabschieden uns jetzt.', ['we','now','goodbye']),
    'chat_weather|rain come tomorrow': FX(['明日|あした|tomorrow','は','雨|あめ|rain','が','降ります|ふります','。'], 'Morgen regnet es.', ['tomorrow','rain']),
    'talk_family|son daughter good': FX(['息子|むすこ|son','と','娘|むすめ|daughter','は','いい|いい|good','子|こ','です','。'], 'Mein Sohn und meine Tochter sind gute Kinder.', ['son','daughter','good']),
    'talk_family|brother sister come': { a: 'brother', aAnd: 'sister', v: 'come', ga: true },
    'apologize|me sorry you': FX(['ごめんなさい|ごめんなさい|sorry','。'], 'Entschuldigung.', ['sorry']),
    'apologize|sorry me wrong': FX(['ごめんなさい|ごめんなさい|sorry','、','私|わたし|me','の','間違い|まちがい|wrong','です','。'], 'Entschuldigung, das war mein Fehler.', ['sorry','me','wrong']),
    'apologize|nevermind good': FX(['気にしないで|きにしないで|nevermind','。','いい|いい|good','ですよ','。'], 'Macht nichts. Ist schon gut.', ['nevermind','good']),
    'gossip|he she who': FX(['彼|かれ|he','と','彼女|かのじょ|she','は','誰|だれ|who','ですか','？'], 'Wer sind er und sie?', ['he','she','who']),
    'gossip|this news have': FX(['知らせ|しらせ|news','が','あります|あります|have|verb','。','これ|これ|this','を','見て|みて','ください','！'], 'Es gibt Neuigkeiten. Schau dir das an!', ['news','have','this']),
    'discuss_plan|if rain no': FX(['もし|もし|if','雨|あめ|rain','なら','、','行きません|いきません','。'], 'Wenn es regnet, gehen wir nicht.', ['if','rain']),
    'discuss_plan|because today good': FX(['なぜなら|なぜなら|because','、','今日|きょう|today','は','いい|いい|good','天気|てんき','だからです','。'], 'Weil heute schönes Wetter ist.', ['because','today','good']),
    'haggle_market|this howmany money': FX(['これ|これ|this','は','いくら|いくら|howmany2','ですか','？'], 'Wie viel kostet das?', ['this','howmany2']),
    'haggle_market|expensive no cheap': FX(['高い|たかい|expensive','ですか','？','いいえ|いいえ|no','、','安い|やすい|cheap','です','。'], 'Teuer? Nein, billig.', ['expensive','no','cheap']),
    'count_goods|one two three': FX(['一|いち|one','、','二|に|two','、','三|さん|three','…'], 'Eins, zwei, drei …', ['one','two','three']),
    'count_goods|howmany this have': FX(['これ|これ|this','は','いくつ|いくつ|howmany','あります|あります|have|verb','か','？'], 'Wie viele sind das?', ['this','howmany','have']),
    'receive_gift|thanks you very': FX(['どうも','ありがとうございます|ありがとうございます|thanks','！'], 'Vielen Dank!', ['thanks']),
    'discuss_plan|we should go': { a: 'we', v: 'go', mod: 'should' },
});

// ---- Common fixed lines (any context) ----
Object.assign(FRAME_OVERRIDES, {
    '*|we friend': FX(['私達|わたしたち|we','は','友達|ともだち|friend','です','。'], 'Wir sind Freunde.', ['we','friend']),
    // finds (discoveries): "I found an old book!"
    '*|find book old':        { v: 'find', o: ['book'], oAttr: { book: 'old' }, past: true },
    '*|look book old':        { v: 'look', o: ['book'], oAttr: { book: 'old' }, thisDet: true },
    '*|find thing beautiful': { v: 'find', o: ['thing'], oAttr: { thing: 'beautiful' }, past: true },
    '*|find money old':       { v: 'find', o: ['money'], oAttr: { money: 'old' }, past: true },
    '*|money many here':      FX(['ここ|ここ|here','に','お金|おかね|money','が','たくさん|たくさん|many','あります','。'], 'Hier gibt es viel Geld.', ['here','money','many']),
    '*|find thing red':       { v: 'find', o: ['thing'], oAttr: { thing: 'red' }, past: true },
    '*|find thing old':       { v: 'find', o: ['thing'], oAttr: { thing: 'old' }, past: true },
    '*|flower beautiful many':FX(['たくさんの|たくさんの|many','花|はな|flower','は','美しい|うつくしい|beautiful','です','。'], 'Die vielen Blumen sind schön.', ['many','flower','beautiful']),
});

// ---- Sentences for the wider vocabulary (every word should be heard somewhere) ----
Object.assign(FRAME_OVERRIDES, {
    'tend_garden|insect here': { ex: ['insect'], p: 'here' },
    'gossip|this secret': { s: 'this', n: 'secret' },
    'sweep_yard|sweep broom road': { v: 'sweep', o: ['road'], i: 'broom' },
    'cook_soup|cut vegetable knife': { v: 'cut', o: ['vegetable'], i: 'knife' },
    'look_sky|look rainbow beautiful': { v: 'look', o: ['rainbow'], c: 'beautiful' },
    'think_home|me sad cry': { s: 'me', pr: ['sad'], next: { v: 'cry' } },
    'talk_family|boy girl play': { a: 'boy', aAnd: 'girl', v: 'play', ga: true },
    'see_snake|tanuki there': { ex: ['tanuki'], p: 'there' },
    'see_snake|fox there': { ex: ['fox'], p: 'there' },
    '*|find scroll old': { v: 'find', o: ['scroll'], oAttr: { scroll: 'old' }, past: true },
    '*|find omamori': { v: 'find', o: ['omamori'], past: true },
    '*|find coin old': { v: 'find', o: ['coin'], oAttr: { coin: 'old' }, past: true },
    '*|find hanko red': { v: 'find', o: ['hanko'], oAttr: { hanko: 'red' }, past: true },
    '*|find shard old': { v: 'find', o: ['shard'], oAttr: { shard: 'old' }, past: true },
    'smell_flower|nose smell flower': FX(['鼻|はな|nose','で','花|はな|flower','の','香り|かおり|fragrant','を','嗅ぎます|かぎます|smell|verb','。'], 'Ich rieche mit der Nase den Duft der Blume.', ['nose','flower','fragrant','smell']),
    'walk_path|foot tired': FX(['足|あし|foot','が','疲れました|つかれました|tired','。'], 'Meine Füße sind müde.', ['foot','tired']),
    'go_sleep|good dream': FX(['いい|いい|good','夢|ゆめ|dream','を','見ます|みます|look|verb','。'], 'Ich habe einen schönen Traum.', ['good','dream']),
    'study_characters|character meaning understand': FX(['この','文字|もじ|character','の','意味|いみ|meaning','が','分かります|わかります|understand|verb','。'], 'Ich verstehe die Bedeutung dieses Schriftzeichens.', ['character','meaning','understand']),
    'dress_up|look mirror': FX(['鏡|かがみ|mirror','を','見ます|みます|look|verb','。'], 'Ich schaue in den Spiegel.', ['mirror','look']),
    'weather_rain|umbrella': FX(['傘|かさ|umbrella','を','さします','。'], 'Ich spanne den Schirm auf.', ['umbrella']),
    'cook_soup|soup salt putin': FX(['汁|しる|soup','に','塩|しお|salt','を','入れます|いれます|putin|verb','。'], 'Ich gebe Salz in die Suppe.', ['soup','salt','putin']),
    'arrive_village|month here live': FX(['ひと月|ひとつき|month','ここ|ここ|here','に','住みます|すみます|live|verb','。'], 'Ich wohne einen Monat hier.', ['month','here','live']),
    'sit_teahouse|tea please': FX(['お茶|おちゃ|tea','を','お願いします|おねがいします|please','。'], 'Tee, bitte.', ['tea','please']),
    'sit_teahouse|tea want': FX(['お茶|おちゃ|tea','が','欲しい|ほしい|want','です','。'], 'Ich möchte Tee.', ['tea','want']),
    'arrive_village|welcome village': FX(['ようこそ|ようこそ|welcome','、','村|むら|village','へ','！'], 'Willkommen im Dorf!', ['welcome','village']),
    'discuss_plan|rain therefore home': FX(['雨|あめ|rain','です','。','だから|だから|therefore','、','家|いえ|home','に','います','。'], 'Es regnet. Deshalb bleibe ich zu Hause.', ['rain','therefore','home']),
    'apologize|allow': FX(['許して|ゆるして|allow|verb','ください','。'], 'Bitte verzeih mir.', ['allow']),
    'walk_path|where go': FX(['どこ|どこ|where','に','行きますか|いきますか|go|verb','？'], 'Wohin gehst du?', ['where','go']),
    'taste_food|this how': FX(['これ|これ|this','は','どう|どう|how','ですか','？'], 'Wie findest du das?', ['this','how']),
    'help_friend|why cry': FX(['なぜ|なぜ|why','泣いて|ないて|cry|verb','いますか','？'], 'Warum weinst du?', ['why','cry']),
    'carry_water|me strength have': FX(['私|わたし|me','は','力|ちから|strength','が','あります|あります|have|verb','。'], 'Ich habe Kraft.', ['me','strength','have']),
    'enjoy_view|me love village': FX(['私|わたし|me','は','この','村|むら|village','を','愛しています|あいしています|love|verb','。'], 'Ich liebe dieses Dorf.', ['me','village','love']),
    'greet_friend|you meetknow happy': FX(['あなた|あなた|you','と','知り合えて|しりあえて|meetknow|verb','嬉しい|うれしい|happy','です','。'], 'Schön, dich kennenzulernen.', ['you','meetknow','happy']),
    'chat_weather|rain anxious': FX(['雨|あめ|rain','が','心配|しんぱい|anxious','です','。'], 'Ich mache mir Sorgen wegen des Regens.', ['rain','anxious']),
    'chat_weather|thunder afraid': FX(['雷|かみなり|thunder','が','怖い|こわい|afraid','です','。'], 'Ich habe Angst vor dem Donner.', ['thunder','afraid']),
    'sweep_yard|room cleanup': FX(['部屋|へや|room','の','片付け|かたづけ|cleanup','を','します','。'], 'Ich räume das Zimmer auf.', ['room','cleanup']),
    'wake_up|morning exercise': FX(['朝|あさ|morning','は','運動|うんどう|exercise','を','します','。'], 'Am Morgen mache ich Übungen.', ['morning','exercise']),
    'heal_friend|head painful': FX(['頭|あたま|head','が','痛い|いたい|painful','です','。'], 'Ich habe Kopfschmerzen.', ['head','painful']),
    'listen_river_bridge|ear good': FX(['耳|みみ|ear','が','いい|いい|good','です','よ','。'], 'Ich habe gute Ohren.', ['ear','good']),
    'play_bamboo_flute|flute blow': FX(['笛|ふえ|flute','を','吹きます|ふきます|blow|verb','。'], 'Ich spiele Flöte.', ['flute','blow']),
    'play_music|koto playinst': FX(['琴|こと|koto','を','弾きます|ひきます|playinst|verb','。'], 'Ich spiele Koto.', ['koto','playinst']),
    'hang_lantern|windchime sound good': FX(['風鈴|ふうりん|windchime','の','音|おと|sound','が','いい|いい|good','ですね','。'], 'Das Windspiel klingt schön.', ['windchime','sound','good']),
    'enter_house|shoe takeoff': FX(['靴|くつ|shoe','を','脱ぎます|ぬぎます|takeoff|verb','。'], 'Ich ziehe die Schuhe aus.', ['shoe','takeoff']),
    'leave_house|shoe puton2': FX(['靴|くつ|shoe','を','履きます|はきます|puton2|verb','。'], 'Ich ziehe die Schuhe an.', ['shoe','puton2']),
    'remember_past|nostalgic': FX(['懐かしい|なつかしい|nostalgic','ですね','。'], 'Das weckt Erinnerungen.', ['nostalgic']),
    'count_goods|person four': FX(['人|ひと|person','が','四|よ|four','人|にん','います','。'], 'Hier sind vier Leute.', ['person','four']),
    'count_goods|fish five': FX(['魚|さかな|fish','が','五|ご|five','匹|ひき','います','。'], 'Hier sind fünf Fische.', ['fish','five']),
    'light_candle|candle six': FX(['蝋燭|ろうそく|candle','が','六|ろっ|six','本|ぽん','あります','。'], 'Hier sind sechs Kerzen.', ['candle','six']),
    'look_star|star seven': FX(['星|ほし|star','が','七|なな|seven','つ','見えます|みえます','。'], 'Ich sehe sieben Sterne.', ['star','seven']),
    'find_egg|egg eight': FX(['卵|たまご|egg','が','八|はっ|eight','個|こ','あります','。'], 'Hier sind acht Eier.', ['egg','eight']),
    'wake_up|now nine': FX(['今|いま|now','は','九|く|nine','時|じ','です','。'], 'Es ist jetzt neun Uhr.', ['now','nine']),
    'haggle_market|ten': FX(['十|じゅう|ten','文|もん','です','。'], 'Das kostet zehn Mon.', ['ten']),
    'haggle_market|hundred expensive': FX(['百|ひゃく|hundred','文|もん','は','高い|たかい|expensive','です','！'], 'Hundert Mon ist teuer!', ['hundred','expensive']),
});

// ============================================================
//  ENTRY POINTS — what the game calls
// ============================================================
// An utterance: { words (tokens; .inst = the planned frame), text, kanjiText, kanaText, inst }
// opts: polite (default true: the speaker talks to the learner in です/ます; villagers use plain form),
//       narrative (story by the fire: past tense), tier (defaults to the learner's grammar tier)
function langUtter(frame, opts) {
    opts = opts || {};
    const tier = opts.tier != null ? opts.tier : getGrammarTier();
    const inst = planUtterance(frame, tier, { polite: opts.polite !== false, narrative: !!opts.narrative, noPast: !!opts.noPast });
    const jp = realizeJP(inst);
    const words = jp.words.filter(w => w.kanji);
    words.inst = inst;
    return { words, text: jp.kanjiText, kanjiText: jp.kanjiText, kanaText: jp.kanaText, inst };
}
function sayTemplate(actionId, ids, opts) { return langUtter(frameFor(actionId, ids), opts); }
// The learner's German for an utterance (only what they understood; "..." for the rest)
function germanFor(words, learner) {
    if (words && words.inst) return realizeDE(words.inst, learner);
    return null;
}

// ---- Lines for situations outside the action list ----
const CHAT_LINES = {
    kitchen:  [['food','hot','good'], ['me','eat','rice'], ['we','eat','together'], ['food','good']],
    well:     [['water','cold'], ['me','drink','water'], ['water','good']],
    teahouse: [['tea','good'], ['we','drink','tea'], ['sit','here'], ['tea','warm','good']],
    garden:   [['flower','beautiful'], ['look','flower'], ['garden','green','beautiful']],
    market:   [['thing','many'], ['buy','this'], ['money','few'], ['this','expensive'], ['this','cheap']],
    rain:     [['rain','cold'], ['rain','many'], ['me','wet']],
    snow:     [['snow','white','beautiful'], ['cold','very'], ['snow','many']],
    wind:     [['wind','strong'], ['wind','cold']],
    clear:    [['today','weather','good'], ['sun','warm'], ['sky','beautiful']],
    morning:  [['morning','quiet'], ['today','weather','good'], ['hello']],
    noon:     [['me','hungry'], ['eat','food','now']],
    evening:  [['moon','beautiful'], ['night','quiet'], ['star','beautiful']],
    late:     [['me','tired'], ['me','sleep','now'], ['night','dark']],
    friend:   [['we','friend'], ['me','happy'], ['we','go','together']],
    warm:     [['you','good'], ['me','happy']],
};
const ANIMAL_LINES = {
    crane:     [['look','crane'], ['crane','beautiful'], ['crane','white','beautiful']],
    magpie:    [['look','bird'], ['bird','fly'], ['bird','sky','fly']],
    rabbit:    [['rabbit','cute'], ['look','rabbit'], ['rabbit','small'], ['rabbit','fast']],
    koi:       [['look','fish'], ['fish','beautiful'], ['fish','swim']],
    cat:       [['cat','cute'], ['cat','hide','there'], ['look','cat'], ['cat','small'], ['cat','sleep']],
    butterfly: [['butterfly','beautiful'], ['butterfly','fly']],
};
const WEATHER_LINES = {
    rain: [['umbrella'], ['me','wet'], ['today','weather','bad'], ['rain','cold'], ['rain','many']],
    snow: [['snow','white','beautiful'], ['cold','very'], ['snow','many'], ['ice','cold']],
    wind: [['wind','strong'], ['wind','cold']],
    fog:  [['mist','white'], ['quiet','very']],
};
function pickLine(lines, ctx, opts) {
    const ok = (lines || []).filter(ids => ids.every(id => vocab[id]));
    return ok.length ? sayTemplate(ctx, randEl(ok), opts) : null;
}

// Shared helper: draw color-coded kanji characters with optional furigana
function _drawColorCodedKanji(ctx, words, cx, cy, fontSize, lightBg) {
    if (!words || words.length === 0) return;
    const colors = lightBg ? ROLE_COLORS_LIGHT : ROLE_COLORS;
    ctx.font = `bold ${fontSize}px ${CJK_FONT_GRAMMAR}`;
    ctx.textBaseline = 'middle';
    // Measure total width
    let totalW = 0;
    const segs = words.map(w => {
        const kj = w.kanji || '';
        const width = ctx.measureText(kj).width;
        totalW += width;
        return { kanji: kj, kana: w.kana || '', width, color: colors[w.type] || colors.unknown };
    });
    // Draw left-to-right
    ctx.textAlign = 'left';
    let drawX = cx - totalW / 2;
    for (const seg of segs) {
        ctx.fillStyle = seg.color;
        ctx.font = `bold ${fontSize}px ${CJK_FONT_GRAMMAR}`;
        ctx.fillText(seg.kanji, drawX, cy);
        drawX += seg.width;
    }
    ctx.textAlign = 'center'; // restore
}
