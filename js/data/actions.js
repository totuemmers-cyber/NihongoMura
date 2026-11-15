// Nihongo Mura — Actions the speaker performs, with the sentences that go with them

// ============================================================
//  ACTION DEFINITIONS
// ============================================================
const ACTION_DEFS = [
    // === NEEDS ===
    {
        id: 'eat_rice', target: 'kitchen', duration: 180,
        templates: [['me','eat','food'],['eat','food','good'],['food','hot','good'],['me','eat','already'],['me','full2','now'],['itadakimasu'],['me','use','chopsticks'],['me','drink','misosoup']],
        effects: { hunger: 45 }, needCheck: 'hunger', priority: 'need',
        activityDe: 'isst Reis', visibleConcepts: ['eat','food','rice','hot','hungry','salt','taste','fragrant','full2']
    },
    {
        id: 'eat_noodles', target: 'market', duration: 160,
        templates: [['me','eat','food'],['food','good','hot'],['this','food','good'],['me','eat','meat'],['me','hungry','very'],['gochisousama'],['me','eat','potato'],['noon','eat','noodle']],
        effects: { hunger: 40 }, needCheck: 'hunger', priority: 'need',
        activityDe: 'isst Nudeln', visibleConcepts: ['eat','food','hot','mouth','howmany','taste','warm']
    },
    {
        id: 'drink_tea', target: 'teahouse', duration: 120,
        templates: [['me','drink','tea'],['tea','good','hot'],['drink','tea','here'],['me','always','drink','tea'],['tea','bitter'],['cup','empty']],
        effects: { thirst: 50 }, needCheck: 'thirst', priority: 'need',
        activityDe: 'trinkt Tee', visibleConcepts: ['drink','tea','hot','good','thirsty','warm','cup','fragrant']
    },
    {
        id: 'drink_water', target: 'well', duration: 100,
        templates: [['me','drink','water'],['water','good','cold'],['drink','water','here'],['me','thirsty']],
        effects: { thirst: 53 }, needCheck: 'thirst', priority: 'need',
        activityDe: 'trinkt Wasser', visibleConcepts: ['drink','water','cold','thirsty','hand','pull']
    },
    {
        id: 'sleep_house', target: 'house', duration: 400,
        templates: [['me','sleep','home'],['sleep','here','good'],['me','sleep','now'],['sleep','bed']],
        effects: { energy: 50 }, needCheck: 'energy', priority: 'need',
        activityDe: 'schläft im Haus', visibleConcepts: ['sleep','home','house','night','sleepy','bed','dream','door','gotosleep']
    },
    // === PRODUCTIVE ===
    {
        id: 'write_calligraphy', target: 'workshop', duration: 280,
        templates: [['me','write','book'],['write','brush','good'],['brush','ink','paper'],['me','write','letter'],['workshop','quiet'],['me','use','hanko'],['finish','work','now']],
        effects: {}, priority: 'productive',
        activityDe: 'schreibt Kalligrafie', visibleConcepts: ['write','book','brush','ink','paper','hand','character','meaning','try','careful']
    },
    {
        id: 'paint_picture', target: 'workshop', duration: 300,
        templates: [['me','paint','picture'],['picture','beautiful'],['paint','mountain','water'],['sky','blue','beautiful']],
        effects: {}, priority: 'productive',
        activityDe: 'malt ein Bild', visibleConcepts: ['paint','picture','beautiful','mountain','eye','hand','yellow','blue','black']
    },
    {
        id: 'make_pottery', target: 'kitchen', duration: 260,
        templates: [['me','make','pot'],['pot','good','new'],['make','bowl','here'],['bowl','round','beautiful'],['carry','pot','careful'],['me','pickup','shard']],
        effects: {}, priority: 'productive',
        activityDe: 'töpfert', visibleConcepts: ['make','pot','bowl','new','round','hard','hand','earth']
    },
    {
        id: 'weave_silk', target: 'workshop', duration: 320,
        templates: [['me','make','silk'],['silk','beautiful','long'],['silk','red','good']],
        effects: {}, priority: 'productive',
        activityDe: 'webt Seide', visibleConcepts: ['make','silk','beautiful','red','soft','clothes','hand','thin2']
    },
    {
        id: 'cook_rice', target: 'kitchen', duration: 220,
        templates: [['me','cook','food'],['cook','rice','hot'],['food','good','hot'],['me','carry','firewood'],['kitchen','warm'],['me','cook','bean']],
        effects: { hunger: 25 }, priority: 'productive',
        activityDe: 'kocht Reis', visibleConcepts: ['cook','food','rice','hot','fire','salt','oil','taste','burn','fragrant']
    },
    {
        id: 'make_onigiri', target: 'kitchen', duration: 250,
        templates: [['me','make','food'],['food','good','small'],['make','rice','food'],['this','method','good'],['me','make','bento']],
        effects: { hunger: 30 }, priority: 'productive',
        activityDe: 'macht Onigiri', visibleConcepts: ['make','food','rice','small','hand','full2','method']
    },
    {
        id: 'brew_tea', target: 'teahouse', duration: 200,
        templates: [['me','make','tea'],['tea','hot','good'],['water','hot','tea'],['teahouse','quiet','good']],
        effects: { thirst: 20 }, priority: 'productive',
        activityDe: 'brüht Tee auf', visibleConcepts: ['make','tea','hot','water','fragrant','cup','warm','taste','sundry']
    },
    {
        id: 'grind_ink', target: 'workshop', duration: 180,
        templates: [['me','make','ink'],['ink','good'],['make','ink','now'],['ink','black']],
        effects: {}, priority: 'productive',
        activityDe: 'reibt Tusche', visibleConcepts: ['make','ink','hand','hard','dark','strength']
    },
    {
        id: 'fish_catch', target: 'fish_pond', duration: 260,
        templates: [['me','catch','fish'],['fish','water','good'],['catch','fish','here'],['me','fish_v','here'],['fish','few','today'],['fisherman','catch','fish'],['me','grill','fish']],
        effects: { hunger: 38 }, priority: 'productive',
        activityDe: 'fängt Fisch', visibleConcepts: ['catch','fish','water','rope','person','lake']
    },
    {
        id: 'cut_bamboo', target: 'bamboo', duration: 220,
        templates: [['me','cut','bamboo'],['bamboo','tall','long'],['cut','bamboo','good']],
        effects: {}, priority: 'productive',
        activityDe: 'schneidet Bambus', visibleConcepts: ['cut','bamboo','tall','long','knife','hand','strength']
    },
    {
        id: 'pick_tea', target: 'garden', duration: 200,
        templates: [['me','find','tea'],['tea','new','good'],['find','tea','here']],
        effects: {}, priority: 'productive',
        activityDe: 'pflückt Tee', visibleConcepts: ['find','tea','new','leaf','morning','hand','sundry']
    },
    {
        id: 'tend_garden', target: 'garden', duration: 180,
        templates: [['me','look','flower'],['flower','beautiful','many'],['garden','good'],['me','grow','vegetable'],['insect','here'],['radish','big','white'],['sakura','beautiful','spring']],
        effects: {}, priority: 'productive',
        activityDe: 'pflegt den Garten', visibleConcepts: ['look','flower','beautiful','garden','insect','earth','green']
    },
    {
        id: 'make_lantern', target: 'workshop', duration: 280,
        templates: [['me','make','lantern'],['lantern','red','beautiful'],['make','lantern','good']],
        effects: {}, priority: 'productive',
        activityDe: 'bastelt Laterne', visibleConcepts: ['make','lantern','red','beautiful','fire','night','bright','hangup']
    },
    {
        id: 'buy_at_market', target: 'market', duration: 160,
        templates: [['me','buy','thing'],['buy','this','good'],['money','buy','food'],['take','this'],['shop','many'],['me','drop','money']],
        effects: { hunger: 15 }, priority: 'productive',
        activityDe: 'kauft auf dem Markt', visibleConcepts: ['buy','thing','money','food','howmany','expensive','cheap','person','shop']
    },
    {
        id: 'sell_at_market', target: 'market', duration: 160,
        templates: [['me','sell','thing'],['sell','this','good'],['sell','silk','money'],['me','busy','today'],['merchant','sell','fish']],
        effects: {}, priority: 'productive',
        activityDe: 'verkauft auf dem Markt', visibleConcepts: ['sell','thing','money','silk','expensive','cheap','person','shop']
    },
    {
        id: 'carry_water', target: 'well', duration: 150,
        templates: [['me','carry','water'],['water','good'],['carry','water','home'],['bucket','heavy'],['me','go','well2'],['me','strength','have'],['pull','rope']],
        effects: {}, priority: 'productive',
        activityDe: 'trägt Wasser', visibleConcepts: ['carry','water','home','heavy','hand','strength','haul']
    },
    {
        id: 'read_book', target: 'workshop', duration: 240,
        templates: [['me','read','book'],['book','good','old'],['read','book','here'],['me','everyday','read','book'],['book','thick'],['me','read','scroll']],
        effects: { energy: 5 }, priority: 'productive',
        activityDe: 'liest ein Buch', visibleConcepts: ['read','book','old','eye','meaning','character','quiet']
    },
    {
        id: 'make_fan', target: 'workshop', duration: 200,
        templates: [['me','make','fan'],['fan','beautiful'],['make','fan','bamboo']],
        effects: {}, priority: 'productive',
        activityDe: 'macht einen Fächer', visibleConcepts: ['make','fan','beautiful','bamboo','wind','hand']
    },
    {
        id: 'make_paper', target: 'workshop', duration: 260,
        templates: [['me','make','paper'],['paper','white','new'],['make','paper','good'],['paper','thin2']],
        effects: {}, priority: 'productive',
        activityDe: 'macht Papier', visibleConcepts: ['make','paper','white','new','thin2','soft','hand']
    },
    {
        id: 'make_basket', target: 'workshop', duration: 220,
        templates: [['me','make','basket'],['basket','bamboo','good'],['make','basket','big'],['basket','light'],['me','hold','basket']],
        effects: {}, priority: 'productive',
        activityDe: 'flicht Korb', visibleConcepts: ['make','basket','bamboo','big','hand','full2','heavy']
    },
    {
        id: 'wash_clothes', target: 'river', duration: 180,
        templates: [['me','wash','this'],['wash','water','good'],['water','cold'],['clothes','dirty'],['me','wash','clothes','shore']],
        effects: {}, priority: 'productive',
        activityDe: 'wäscht Kleidung', visibleConcepts: ['wash','water','cold','clothes','hand','shore','river']
    },
    // === SOCIAL ===
    {
        id: 'give_tea', target: null, duration: 120,
        templates: [['me','give','you','tea'],['tea','good','hot'],['give','you','this'],['me','give','you','cup'],['yourewelcome']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'gibt Tee', visibleConcepts: ['give','you','tea','hot','please','thanks','warm','friend']
    },
    {
        id: 'tell_story', target: 'teahouse', duration: 200,
        templates: [['me','tell','story'],['story','old','good'],['listen','me','tell'],['story','end','now'],['story','interesting']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'erzählt Geschichte', visibleConcepts: ['tell','story','old','listen','child','night','dream','secret','person']
    },
    {
        id: 'teach_friend', target: null, duration: 200,
        templates: [['me','teach','you'],['teach','learn','good'],['we','learn','now'],['you','skilled','very'],['me','unskilled'],['this','easy']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'lehrt Freund', visibleConcepts: ['teach','learn','friend','we','student','meaning','should','understand','right']
    },
    // === IDLE ===
    {
        id: 'sit_teahouse', target: 'teahouse', duration: 150,
        templates: [['me','sit','here'],['sit','good'],['tea','hot','good'],['sit','tatami'],['tatami','comfy'],['tea','please'],['tea','want'],['guest','come','teahouse'],['sit','chair']],
        effects: { energy: 10 }, priority: 'idle',
        activityDe: 'sitzt im Teehaus', visibleConcepts: ['sit','tea','good','warm','comfy','quiet','chair']
    },
    {
        id: 'look_sky', target: null, duration: 80,
        templates: [['me','look','sky'],['sky','big','beautiful'],['look','there'],['look','rainbow','beautiful']],
        effects: {}, priority: 'idle',
        activityDe: 'betrachtet den Himmel', visibleConcepts: ['look','sky','big','beautiful','wind','far','day','cloud']
    },
    {
        id: 'smell_flower', target: 'flower', duration: 60,
        templates: [['me','smell','flower'],['flower','good','beautiful'],['smell','beautiful'],['nose','smell','flower']],
        effects: {}, priority: 'idle',
        activityDe: 'riecht an Blumen', visibleConcepts: ['smell','flower','beautiful','fragrant','insect']
    },
    {
        id: 'play_music', target: 'teahouse', duration: 180,
        templates: [['me','play','music'],['music','good','beautiful'],['listen','music','good'],['koto','playinst'],['me','hit','drum']],
        effects: { energy: 5 }, priority: 'idle',
        activityDe: 'spielt Musik', visibleConcepts: ['play','music','beautiful','listen','sound','glad','heart','ear']
    },
    {
        id: 'look_at_lotus', target: 'lotus_pond', duration: 80,
        templates: [['me','look','lotus'],['lotus','beautiful'],['look','water','beautiful'],['lotus','float','water'],['duck','swim','water']],
        effects: {}, priority: 'idle',
        activityDe: 'betrachtet Lotus', visibleConcepts: ['look','lotus','beautiful','water','shadow','quiet']
    },
    {
        id: 'sing_song', target: null, duration: 160,
        templates: [['me','sing','song'],['sing','good'],['we','sing','now'],['me','sometimes','sing','song']],
        effects: { energy: 5 }, priority: 'idle',
        activityDe: 'singt ein Lied', visibleConcepts: ['sing','song','we','sound','glad','heart','together']
    },
    {
        id: 'cross_bridge', target: 'bridge', duration: 60,
        templates: [['me','walk','bridge'],['bridge','big'],['walk','river','bridge'],['me','cross','bridge']],
        effects: {}, priority: 'idle',
        activityDe: 'überquert die Brücke', visibleConcepts: ['walk','bridge','river','foot','road','wide']
    },
    {
        id: 'look_bird', target: null, duration: 80,
        templates: [['me','look','bird'],['bird','beautiful','fast'],['look','bird','sky'],['sparrow','small'],['crow','black']],
        effects: {}, priority: 'idle',
        activityDe: 'beobachtet Vögel', visibleConcepts: ['look','bird','sky','fast','beautiful','sound','tree','wind','fly']
    },
    {
        id: 'find_egg', target: null, duration: 120,
        templates: [['me','find','egg'],['egg','small','good'],['find','egg','here'],['egg','eight']],
        effects: { hunger: 15 }, priority: 'idle',
        activityDe: 'findet Eier', visibleConcepts: ['find','egg','small','chicken','morning']
    },
    // === EXPANSION: PRODUCTIVE ===
    {
        id: 'plant_flower', target: 'garden', duration: 220,
        templates: [['me','plant','flower'],['flower','beautiful','red'],['plant','flower','here'],['earth','soft'],['flower','bloom','spring']],
        effects: {}, priority: 'productive',
        activityDe: 'pflanzt Blumen', visibleConcepts: ['plant','flower','beautiful','red','garden','earth','hand','insect']
    },
    {
        id: 'sweep_yard', target: 'house', duration: 160,
        templates: [['me','sweep','home'],['home','clean','good'],['sweep','here','now'],['sweep','broom','road'],['me','clean_v','room'],['room','cleanup'],['repair','roof']],
        effects: {}, priority: 'productive',
        activityDe: 'fegt den Hof', visibleConcepts: ['sweep','home','clean','broom','dirty','cleanup','morning']
    },
    {
        id: 'repair_boat', target: 'dock', duration: 280,
        templates: [['me','repair','boat'],['boat','old'],['repair','boat','good'],['me','sail','boat'],['me','push','boat']],
        effects: {}, priority: 'productive',
        activityDe: 'repariert Boot', visibleConcepts: ['repair','boat','old','hand','rope','shore']
    },
    {
        id: 'dry_clothes', target: null, duration: 150,
        templates: [['me','wash','clothes'],['clothes','clean','good'],['sun','hot']],
        effects: {}, priority: 'productive',
        activityDe: 'trocknet Kleidung', visibleConcepts: ['wash','clothes','clean','sun','hot','wind','hangup','sundry']
    },
    {
        id: 'pick_fruit', target: 'garden', duration: 180,
        templates: [['me','pick','fruit'],['fruit','sweet','good'],['pick','fruit','here'],['persimmon','sweet','autumn'],['me','pickup','chestnut']],
        effects: { hunger: 20 }, priority: 'productive',
        activityDe: 'pflückt Obst', visibleConcepts: ['pick','fruit','sweet','hand','tree','apple']
    },
    {
        id: 'feed_chicken', target: null, duration: 140,
        templates: [['me','feed','chicken'],['chicken','eat','rice'],['feed','chicken','now']],
        effects: {}, priority: 'productive',
        activityDe: 'füttert Hühner', visibleConcepts: ['feed','chicken','eat','rice','morning']
    },
    {
        id: 'cook_soup', target: 'kitchen', duration: 240,
        templates: [['me','cook','soup'],['soup','hot','good'],['cook','soup','now'],['me','cook','vegetable'],['cut','vegetable','knife'],['tofu','soft','good'],['soup','salt','putin'],['me','mix','soup'],['me','use','soysauce']],
        effects: { hunger: 35 }, priority: 'productive',
        activityDe: 'kocht Suppe', visibleConcepts: ['cook','soup','hot','vegetable','salt','oil','taste','warm']
    },
    {
        id: 'cook_noodle', target: 'kitchen', duration: 230,
        templates: [['me','cook','noodle'],['noodle','hot','good'],['cook','noodle','now'],['oil','hot']],
        effects: { hunger: 40 }, priority: 'productive',
        activityDe: 'kocht Nudeln', visibleConcepts: ['cook','noodle','hot','salt','taste','fire']
    },
    {
        id: 'pour_wine', target: 'teahouse', duration: 100,
        templates: [['me','pour','wine'],['wine','good'],['pour','wine','here']],
        effects: { thirst: 25 }, priority: 'productive',
        activityDe: 'schenkt Wein ein', visibleConcepts: ['pour','wine','cup','full2','fragrant']
    },
    {
        id: 'climb_mountain', target: null, duration: 350,
        templates: [['me','climb','mountain'],['mountain','tall','big'],['climb','mountain','far']],
        effects: { energy: -15 }, priority: 'productive',
        activityDe: 'besteigt den Berg', visibleConcepts: ['climb','mountain','tall','far','foot','strength','wind','forest']
    },
    {
        id: 'mend_clothes', target: 'house', duration: 200,
        templates: [['me','repair','clothes'],['use','needle'],['clothes','old']],
        effects: {}, priority: 'productive',
        activityDe: 'flickt Kleidung', visibleConcepts: ['repair','clothes','needle','old','use','hand','shoes','hat']
    },
    {
        id: 'plant_rice', target: 'rice_paddy', duration: 300,
        templates: [['me','plant','rice'],['rice','field','good'],['plant','rice','here']],
        effects: {}, priority: 'productive',
        activityDe: 'pflanzt Reis', visibleConcepts: ['plant','rice','field','earth','morning','water','hand','foot']
    },
    {
        id: 'light_candle', target: 'shrine', duration: 80,
        templates: [['me','open','candle'],['candle','bright'],['candle','beautiful'],['candle','six']],
        effects: {}, priority: 'productive',
        activityDe: 'zündet Kerze an', visibleConcepts: ['candle','bright','beautiful','fire','night','burn','quiet']
    },
    {
        id: 'collect_stone', target: null, duration: 160,
        templates: [['me','find','stone'],['stone','hard','heavy'],['find','stone','here']],
        effects: {}, priority: 'productive',
        activityDe: 'sammelt Steine', visibleConcepts: ['find','stone','hard','heavy','hand','strength','haul']
    },
    {
        id: 'cut_grass', target: 'garden', duration: 170,
        templates: [['me','cut','grass'],['grass','green','long'],['cut','grass','good']],
        effects: {}, priority: 'productive',
        activityDe: 'schneidet Gras', visibleConcepts: ['cut','grass','green','long','knife','insect']
    },
    {
        id: 'clean_table', target: 'teahouse', duration: 120,
        templates: [['me','wash','table'],['table','clean','good'],['wash','table','now']],
        effects: {}, priority: 'productive',
        activityDe: 'putzt den Tisch', visibleConcepts: ['wash','table','clean','dirty','cleanup']
    },
    // === EXPANSION: SOCIAL ===
    {
        id: 'help_friend', target: null, duration: 180,
        templates: [['me','help','you'],['help','friend','good'],['we','help','now'],['why','cry'],['me','assist','mother']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'hilft Freund', visibleConcepts: ['help','friend','we','thanks','together','glad','please']
    },
    {
        id: 'ask_question', target: null, duration: 120,
        templates: [['me','ask','you'],['ask','what','this'],['you','answer','me'],['this','right']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'stellt eine Frage', visibleConcepts: ['ask','answer','what','you','why','how','know','understand','yes']
    },
    {
        id: 'share_fruit', target: null, duration: 100,
        templates: [['me','give','you','fruit'],['fruit','sweet','good'],['give','you','this'],['apple','red','sweet']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'teilt Obst', visibleConcepts: ['give','fruit','sweet','you','please','thanks','together','glad']
    },
    {
        id: 'send_gift', target: null, duration: 140,
        templates: [['me','send','you','thing'],['send','friend','thing'],['friend','happy'],['me','wrap','gift'],['send','letter','mother'],['friend','rejoice']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'sendet Geschenk', visibleConcepts: ['send','friend','thing','happy','gift','glad','thanks','love']
    },
    // === EXPANSION: IDLE ===
    {
        id: 'dance_music', target: 'teahouse', duration: 200,
        templates: [['me','dance','music'],['dance','happy'],['music','good','beautiful']],
        effects: { energy: -5 }, priority: 'idle',
        activityDe: 'tanzt zur Musik', visibleConcepts: ['dance','music','happy','beautiful','foot','glad','together','sound']
    },
    {
        id: 'laugh_together', target: null, duration: 100,
        templates: [['me','laugh','happy'],['we','laugh','now'],['laugh','good']],
        effects: {}, priority: 'idle',
        activityDe: 'lacht', visibleConcepts: ['laugh','happy','we','glad','friend','together','sound']
    },
    {
        id: 'look_star', target: null, duration: 100,
        templates: [['me','look','star'],['star','bright','beautiful'],['look','sky','star'],['moon','beautiful','night'],['firefly','shine','night'],['star','seven']],
        effects: {}, priority: 'idle',
        activityDe: 'betrachtet Sterne', visibleConcepts: ['look','star','bright','sky','beautiful','night','moon','dark','quiet']
    },
    {
        id: 'rest_tree', target: 'willow', duration: 140,
        templates: [['me','rest','here'],['rest','tree','quiet'],['me','tired','rest'],['me','rest','alittle'],['leaf','green'],['pine','tall','old'],['shadow','cool'],['cicada','noisy']],
        effects: { energy: 15 }, priority: 'idle',
        activityDe: 'ruht unter dem Baum', visibleConcepts: ['rest','tree','quiet','tired','shadow','sleepy','comfy','wind','leaf']
    },
    {
        id: 'watch_butterfly', target: 'flower', duration: 70,
        templates: [['me','look','butterfly'],['butterfly','beautiful'],['look','butterfly','fly']],
        effects: {}, priority: 'idle',
        activityDe: 'beobachtet Schmetterlinge', visibleConcepts: ['look','butterfly','beautiful','fly','insect','wind']
    },
    {
        id: 'watch_frog', target: 'lotus_pond', duration: 80,
        templates: [['me','look','frog'],['frog','small','green'],['frog','water']],
        effects: {}, priority: 'idle',
        activityDe: 'beobachtet Frösche', visibleConcepts: ['look','frog','small','green','water','sound','night','insect']
    },
    {
        id: 'stand_bridge', target: 'bridge', duration: 90,
        templates: [['me','stand','bridge'],['look','river','deep'],['stand','here','quiet'],['river','dangerous']],
        effects: {}, priority: 'idle',
        activityDe: 'steht auf der Brücke', visibleConcepts: ['stand','bridge','river','deep','quiet','wind','road','shore','wide','shadow']
    },
    {
        id: 'think_home', target: null, duration: 100,
        templates: [['me','think','home'],['think','mother','father'],['home','far'],['country','far'],['me','sad','cry']],
        effects: {}, priority: 'idle',
        activityDe: 'denkt an Zuhause', visibleConcepts: ['think','home','mother','father','far','sad','worried','dream','village','love','head']
    },
    {
        id: 'wait_friend', target: 'torii', duration: 120,
        templates: [['me','wait','friend'],['wait','here','now'],['friend','come'],['torii','tall','red'],['open','gate'],['call','friend'],['me','search','friend']],
        effects: {}, priority: 'idle',
        activityDe: 'wartet auf Freund', visibleConcepts: ['wait','friend','come','anxious','road','person','arrive','where']
    },
    {
        id: 'watch_cloud', target: null, duration: 80,
        templates: [['me','look','cloud'],['cloud','white','big'],['look','sky','cloud']],
        effects: {}, priority: 'idle',
        activityDe: 'betrachtet Wolken', visibleConcepts: ['look','cloud','white','sky','wind','slow','change']
    },
    // === EAST BANK: MEDICINE HUT ===
    {
        id: 'prepare_medicine', target: 'medicine_hut', duration: 260,
        templates: [['me','prepare','medicine'],['medicine','good'],['prepare','medicine','now']],
        effects: {}, priority: 'productive',
        activityDe: 'bereitet Medizin vor', visibleConcepts: ['prepare','medicine','flower','make','hand','method','burn','fragrant']
    },
    {
        id: 'heal_friend', target: 'medicine_hut', duration: 180,
        templates: [['me','give','you','medicine'],['medicine','good'],['body','good'],['doctor','help','friend'],['head','painful'],['open','mouth']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'heilt einen Freund', visibleConcepts: ['give','medicine','friend','body','doctor','worried','thanks']
    },
    {
        id: 'dry_herbs', target: 'medicine_hut', duration: 200,
        templates: [['me','make','medicine'],['sun','hot','good'],['flower','hot']],
        effects: {}, priority: 'productive',
        activityDe: 'trocknet Kräuter', visibleConcepts: ['make','medicine','sun','hot','flower','sundry','leaf','hangup','fragrant']
    },
    // === EAST BANK: SCHOOL ===
    {
        id: 'study_characters', target: 'school', duration: 280,
        templates: [['me','learn','character'],['character','many'],['learn','character','good'],['character','meaning','understand'],['me','study','character'],['character','difficult']],
        effects: {}, priority: 'productive',
        activityDe: 'lernt Zeichen', visibleConcepts: ['learn','character','write','brush','book','hand','meaning','try','eye']
    },
    {
        id: 'teach_class', target: 'school', duration: 240,
        templates: [['me','teach','student'],['teach','lesson','good'],['student','learn','now'],['teacher','gentle'],['teacher','young']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'unterrichtet', visibleConcepts: ['teach','student','lesson','book','listen','character','meaning','why','should','allow']
    },
    {
        id: 'ask_teacher2', target: 'school', duration: 140,
        templates: [['me','ask','teacher'],['question','what','this'],['teacher','answer','me']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'fragt den Lehrer', visibleConcepts: ['ask','teacher','question','answer','why','how','meaning','understand']
    },
    // === EAST BANK: STABLE ===
    {
        id: 'feed_horse', target: 'stable', duration: 200,
        templates: [['me','feed','horse'],['horse','eat','grass'],['feed','horse','now'],['cow','eat','grass'],['sheep','eat','grass'],['cow','slow'],['stable','stinky']],
        effects: {}, priority: 'productive',
        activityDe: 'füttert das Pferd', visibleConcepts: ['feed','horse','grass','eat','morning','cow','sheep']
    },
    {
        id: 'brush_horse', target: 'stable', duration: 180,
        templates: [['me','wash','horse'],['horse','clean','good'],['wash','horse','now'],['stable','warm']],
        effects: {}, priority: 'productive',
        activityDe: 'striegelt das Pferd', visibleConcepts: ['wash','horse','clean','good','busy','hand','dirty']
    },
    {
        id: 'ride_horse', target: 'stable', duration: 160,
        templates: [['me','run','horse'],['horse','fast','good'],['run','horse','happy']],
        effects: { energy: -10 }, priority: 'idle',
        activityDe: 'reitet ein Pferd', visibleConcepts: ['horse','fast','run','happy','exercise','foot','road','wind','strength']
    },
    // === EAST BANK: TEA TERRACE ===
    {
        id: 'dry_tea', target: 'tea_terrace', duration: 240,
        templates: [['me','make','tea'],['tea','sun','hot'],['wait','time','good']],
        effects: {}, priority: 'productive',
        activityDe: 'trocknet Tee', visibleConcepts: ['make','tea','sun','hot','wait','time','sundry','leaf','wind','fragrant']
    },
    {
        id: 'sort_tea', target: 'tea_terrace', duration: 200,
        templates: [['me','look','tea'],['tea','good','clean'],['find','tea','good']],
        effects: {}, priority: 'productive',
        activityDe: 'sortiert Tee', visibleConcepts: ['look','tea','good','clean','find','hand','eye','taste']
    },
    {
        id: 'tell_about_tea', target: 'tea_terrace', duration: 180,
        templates: [['me','inform','you','tea'],['tea','time','good'],['inform','you','this']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'erzählt über Tee', visibleConcepts: ['inform','tea','time','listen','taste','fragrant','method','sound']
    },
    // === EAST BANK: VIEWPOINT ===
    {
        id: 'meditate_rocks', target: 'viewpoint', duration: 200,
        templates: [['me','sit','quiet'],['quiet','good'],['sit','here','quiet'],['moss','green','soft'],['rock','big','hard']],
        effects: { energy: 15 }, priority: 'idle',
        activityDe: 'meditiert', visibleConcepts: ['sit','quiet','mountain','stone','think','heart','comfy','dream']
    },
    {
        id: 'watch_sunset', target: 'viewpoint', duration: 120,
        templates: [['me','look','sun'],['sun','beautiful','far'],['look','here','beautiful'],['summer','hot','very'],['winter','cold','very'],['summer','extremely','hot'],['autumn','momiji','beautiful'],['evening','sky','beautiful']],
        effects: {}, priority: 'idle',
        activityDe: 'betrachtet den Sonnenuntergang', visibleConcepts: ['look','sun','beautiful','far','glad','warm','shadow','day']
    },
    {
        id: 'enjoy_view', target: 'viewpoint', duration: 100,
        templates: [['me','feel','glad'],['mountain','river','beautiful'],['hope','good','tomorrow'],['me','love','village'],['me','lucky'],['sea','far'],['really','beautiful','this']],
        effects: {}, priority: 'idle',
        activityDe: 'genießt die Aussicht', visibleConcepts: ['feel','glad','hope','mountain','river','beautiful','wide','wind','sound','comfy','pine']
    },
    // === EXPANSION: DAILY ROUTINES ===
    {
        id: 'wake_up', target: 'house', duration: 100,
        templates: [['me','getup','now'],['getup','early','good'],['morning','getup','now'],['goodmorning'],['open','window'],['morning','exercise'],['wake','grandfather'],['now','nine']],
        effects: { energy: 10 }, priority: 'idle',
        activityDe: 'steht auf', visibleConcepts: ['getup','early','morning','bed','room','door','open','up']
    },
    {
        id: 'go_sleep', target: 'house', duration: 120,
        templates: [['me','gotosleep','now'],['night','sleep','home'],['me','sleepy','now'],['goodnight'],['good','dream'],['me','sleepy','still']],
        effects: {}, priority: 'idle',
        activityDe: 'geht schlafen', visibleConcepts: ['gotosleep','late','night','close','door','bed','room','down']
    },
    {
        id: 'enter_house', target: 'house', duration: 60,
        templates: [['me','enter','home'],['enter','room','inside'],['come','home','now'],['tadaima'],['open','door'],['shoe','takeoff'],['evening','return','home']],
        effects: {}, priority: 'idle',
        activityDe: 'betritt das Haus', visibleConcepts: ['enter','inside','room','door','home','close']
    },
    {
        id: 'leave_house', target: 'house', duration: 60,
        templates: [['me','go','outside'],['go','outside','now'],['exit2','home','now'],['ittekimasu'],['close','door'],['shoe','puton2'],['me','puton2','sandals']],
        effects: {}, priority: 'idle',
        activityDe: 'verlässt das Haus', visibleConcepts: ['exit2','outside','door','open','go','front','road']
    },
    // === EXPANSION: SOCIAL — GREETINGS & CONVERSATION ===
    {
        id: 'greet_friend', target: null, duration: 80,
        templates: [['me','hello','you'],['hello','friend','good'],['you','name','what'],['me','meet','neighbor'],['you','meetknow','happy'],['you','traveler'],['neighbor','kind']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'begrüßt Freund', visibleConcepts: ['hello','name','meetknow','call','glad','welcome']
    },
    {
        id: 'say_goodbye', target: 'torii', duration: 80,
        templates: [['me','goodbye','you'],['goodbye','friend'],['we','goodbye','now'],['me','come','also','tomorrow']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'verabschiedet sich', visibleConcepts: ['goodbye','friend','go','return','tomorrow','sad']
    },
    {
        id: 'chat_weather', target: null, duration: 120,
        templates: [['me','say','weather'],['today','weather','good'],['rain','come','tomorrow'],['today','weather','bad'],['weather','change'],['rain','anxious'],['thunder','afraid']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'redet übers Wetter', visibleConcepts: ['weather','rain','snow','wind','ice','mist','cold','hot','today','change','say','cloud']
    },
    {
        id: 'talk_family', target: null, duration: 140,
        templates: [['me','say','home'],['son','daughter','good'],['brother','sister','come'],['boy','girl','play'],['grandfather','sleep','still'],['baby','cry'],['grandmother','cook','food']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'spricht über Familie', visibleConcepts: ['son','daughter','brother','sister','boy','girl','child','home','love','say']
    },
    {
        id: 'apologize', target: null, duration: 80,
        templates: [['me','sorry','you'],['sorry','me','wrong'],['nevermind','good'],['allow']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'entschuldigt sich', visibleConcepts: ['sorry','nevermind','yourewelcome','wrong','drop','careful']
    },
    {
        id: 'borrow_thing', target: null, duration: 120,
        templates: [['me','borrow','you'],['borrow','this','may'],['me','giveback','tomorrow']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'leiht sich etwas', visibleConcepts: ['borrow','giveback','neighbor','please','thanks','may','have','thing']
    },
    {
        id: 'gossip', target: 'teahouse', duration: 160,
        templates: [['me','say','you'],['he','she','who'],['this','news','have'],['me','know','this'],['this','secret'],['they','come','here'],['samurai','strong']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'tratscht', visibleConcepts: ['say','he','she','they','who','news','secret','neighbor','also','but','because']
    },
    {
        id: 'discuss_plan', target: null, duration: 140,
        templates: [['we','should','go'],['if','rain','no'],['because','today','good'],['yes','we','go'],['rain','therefore','home'],['me','go','will','tomorrow'],['go','onsen','tomorrow']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'bespricht Pläne', visibleConcepts: ['if','because','therefore','should','may','will','want','can','and','but','today','tomorrow']
    },
    // === EXPANSION: MARKET ACTIVITIES ===
    {
        id: 'haggle_market', target: 'market', duration: 180,
        templates: [['this','howmany','money'],['expensive','no','cheap'],['buy','this','good'],['ten'],['hundred','expensive'],['sumimasen'],['market','lively']],
        effects: {}, priority: 'productive',
        activityDe: 'feilscht auf dem Markt', visibleConcepts: ['howmany2','one','two','three','four','five','six','seven','eight','nine','ten','hundred','few','expensive','cheap','money','have']
    },
    {
        id: 'count_goods', target: 'market', duration: 120,
        templates: [['me','look','thing'],['one','two','three'],['howmany','this','have'],['me','count','money'],['fish','five'],['person','four'],['me','count','coin']],
        effects: {}, priority: 'productive',
        activityDe: 'zählt Waren', visibleConcepts: ['one','two','three','four','five','six','seven','eight','nine','ten','hundred','few','many','howmany2','every']
    },
    // === EXPANSION: NATURE & ANIMALS ===
    {
        id: 'watch_dog', target: null, duration: 90,
        templates: [['me','look','dog'],['dog','run','fast'],['dog','play','happy']],
        effects: {}, priority: 'idle',
        activityDe: 'beobachtet Hund', visibleConcepts: ['dog','cat','rabbit','run','play','fast','near','who']
    },
    {
        id: 'see_snake', target: 'bamboo', duration: 80,
        templates: [['me','look','snake'],['snake','there'],['me','afraid','run'],['tanuki','there'],['fox','there'],['deer','eat','grass'],['monkey','tree','climb']],
        effects: {}, priority: 'idle',
        activityDe: 'sieht eine Schlange', visibleConcepts: ['snake','afraid','careful','run','there','near']
    },
    {
        id: 'swim_river', target: 'river', duration: 200,
        templates: [['me','swim','water'],['water','cold','deep'],['swim','river','good'],['me','swim','can'],['lake','deep','cold'],['river','shallow']],
        effects: { energy: -10 }, priority: 'idle',
        activityDe: 'schwimmt im Fluss', visibleConcepts: ['swim','river','water','cold','deep','shore','foot','wet']
    },
    // === EXPANSION: EMOTIONAL & REFLECTIVE ===
    {
        id: 'feel_bored', target: null, duration: 80,
        templates: [['me','bored','here'],['bored','want','play'],['no','thing','make']],
        effects: {}, priority: 'idle',
        activityDe: 'langweilt sich', visibleConcepts: ['bored','empty','no','want','play','already','still']
    },
    {
        id: 'feel_angry', target: null, duration: 100,
        templates: [['me','angry','this'],['angry','wrong','no'],['no','good','this']],
        effects: {}, priority: 'idle',
        activityDe: 'ist verärgert', visibleConcepts: ['angry','wrong','no','that','this','cry','stinky']
    },
    {
        id: 'remember_past', target: null, duration: 120,
        templates: [['me','remember','yesterday'],['remember','year','old'],['forget','no','this'],['nostalgic']],
        effects: {}, priority: 'idle',
        activityDe: 'erinnert sich', visibleConcepts: ['remember','forget','yesterday','year','already','still','old','very','love']
    },
    // === EXPANSION: WORK & CHORES ===
    {
        id: 'move_things', target: null, duration: 160,
        templates: [['me','haul','thing'],['putdown','here','good'],['this','heavy','very']],
        effects: { energy: -5 }, priority: 'productive',
        activityDe: 'räumt Sachen um', visibleConcepts: ['putdown','push','drop','haul','heavy','light','empty','full','up','down','behind','front']
    },
    {
        id: 'hang_laundry', target: null, duration: 140,
        templates: [['me','hangup','clothes'],['clothes','sundry','sun'],['wear','clothes','tomorrow'],['fold','clothes'],['clothes','dry','now']],
        effects: {}, priority: 'productive',
        activityDe: 'hängt Wäsche auf', visibleConcepts: ['hangup','sundry','clothes','wear','sun','wind','dry','clean']
    },
    {
        id: 'taste_food', target: 'kitchen', duration: 100,
        templates: [['me','try','food'],['food','sour','no'],['taste','good','very'],['food','spicy'],['this','how']],
        effects: {}, priority: 'productive',
        activityDe: 'probiert das Essen', visibleConcepts: ['try','taste','sour','bitter','spicy','sweet','sugar','salt','mouth','smell','fragrant','stinky']
    },
    {
        id: 'arrive_village', target: 'torii', duration: 80,
        templates: [['me','arrive','here'],['arrive','village','now'],['me','come','here'],['welcome','village'],['me','live','village'],['month','here','live']],
        effects: {}, priority: 'idle',
        activityDe: 'kommt im Dorf an', visibleConcepts: ['arrive','village','come','return','road','gate','welcome','hello','near']
    },
    {
        id: 'race_friend', target: null, duration: 180,
        templates: [['we','compete','now'],['run','fast','goforit'],['begin','compete','now']],
        effects: { energy: -10 }, priority: 'idle', requiresOther: true,
        activityDe: 'macht ein Wettrennen', visibleConcepts: ['compete','goforit','begin','finish','fast','slow','run','foot','happy','together','extremely','who']
    },
    {
        id: 'late_school', target: 'school', duration: 100,
        templates: [['me','belate','now'],['belate','sorry','run'],['me','run','fast'],['go','school','now']],
        effects: {}, priority: 'idle',
        activityDe: 'kommt zu spät', visibleConcepts: ['belate','anxious','sorry','run','fast','school','student','early','late']
    },
    {
        id: 'drink_milk', target: 'house', duration: 100,
        templates: [['me','drink','milk'],['milk','warm','good'],['drink','milk','morning']],
        effects: { thirst: 15 }, priority: 'idle',
        activityDe: 'trinkt Milch', visibleConcepts: ['milk','warm','drink','morning','cup','white','like','cow']
    },
    {
        id: 'make_sugar_snack', target: 'kitchen', duration: 160,
        templates: [['me','make','sugar'],['sugar','sweet','good'],['child','like','sugar']],
        effects: {}, priority: 'productive',
        activityDe: 'macht Süßigkeit', visibleConcepts: ['sugar','sweet','make','child','like','want','give']
    },
    {
        id: 'look_pagoda', target: 'pagoda', duration: 90,
        templates: [['me','look','pagoda'],['pagoda','tall','old'],['look','up','beautiful'],['pagoda','famous']],
        effects: {}, priority: 'idle',
        activityDe: 'betrachtet die Pagode', visibleConcepts: ['pagoda','tall','old','up','look','beautiful','quiet','every','year']
    },
    {
        id: 'walk_path', target: null, duration: 100,
        templates: [['me','walk','road'],['walk','front','go'],['road','long','far'],['village','near'],['forest','quiet'],['road','narrow'],['walk','slowly'],['look','map'],['where','go'],['me','stroll','road'],['find','mushroom','forest'],['foot','tired']],
        effects: {}, priority: 'idle',
        activityDe: 'spaziert auf dem Weg', visibleConcepts: ['walk','road','front','behind','near','far','go','return','foot','also','narrow','shallow']
    },
    {
        id: 'dress_up', target: 'house', duration: 120,
        templates: [['me','wear','clothes'],['clothes','new','beautiful'],['wear','hat','good'],['look','mirror'],['me','wear','kimono'],['me','wear','yukata'],['me','tie','obi'],['me','polish','mirror']],
        effects: {}, priority: 'productive',
        activityDe: 'kleidet sich an', visibleConcepts: ['wear','clothes','shoes','hat','new','beautiful','like','live','room','thick']
    },
    {
        id: 'receive_gift', target: null, duration: 100,
        templates: [['me','receive','gift'],['gift','beautiful','good'],['thanks','you','very']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'bekommt ein Geschenk', visibleConcepts: ['receive','gift','thanks','yourewelcome','glad','happy','love','very','extremely']
    },
    {
        id: 'explain_habit', target: null, duration: 130,
        templates: [['me','say','habit'],['every','day','make'],['habit','good','very'],['this','important']],
        effects: {}, priority: 'social', requiresOther: true,
        activityDe: 'erklärt Gewohnheiten', visibleConcepts: ['habit','every','day','year','today','yesterday','already','still','also','really','joyful']
    },
    // === FESTIVAL ACTIONS ===
    {
        id: 'hang_festival_lantern', target: 'lantern_post', duration: 120,
        templates: [['celebrate','festival','lantern'],['lantern','red','beautiful'],['festival','happy','together'],['festival','joyful']],
        effects: {}, priority: 'productive',
        activityDe: 'hängt Festlaternen auf', visibleConcepts: ['celebrate','festival','lantern','red','beautiful','hang','happy','lucky','night']
    },
    {
        id: 'eat_mochi', target: 'teahouse', duration: 100,
        templates: [['eat','mochi','good'],['mochi','sweet','good'],['festival','together2','happy'],['dango','sweet','good']],
        effects: { hunger: 20 }, priority: 'idle',
        activityDe: 'isst Mochi', visibleConcepts: ['eat','mochi','sweet','round','moon','festival','together2','happy','tea']
    },
    {
        id: 'fold_origami', target: 'workshop', duration: 200,
        templates: [['me','make','paper'],['paper','beautiful','small'],['make','bird','paper']],
        effects: {}, priority: 'idle',
        activityDe: 'faltet Origami', visibleConcepts: ['make','paper','bird','beautiful','small','hand']
    },
    // === EXPANSION: UNDERUTILIZED OBJECT ACTIONS ===
    // lantern_post (was 0 actions)
    {
        id: 'light_lantern', target: 'lantern_post', duration: 100,
        templates: [['me','make','fire'],['lantern','bright','night'],['fire','good','night'],['night','dark','very'],['fire','burn','bright'],['goodevening']],
        effects: {}, priority: 'productive',
        activityDe: 'zündet die Laterne an', visibleConcepts: ['lantern','fire','bright','night','hang','candle','dark','burn']
    },
    {
        id: 'hang_lantern', target: 'lantern_post', duration: 140,
        templates: [['me','hang','lantern'],['lantern','red','beautiful'],['hang','lantern','here'],['hang','windchime'],['windchime','sound','good']],
        effects: {}, priority: 'productive',
        activityDe: 'hängt eine Laterne auf', visibleConcepts: ['hang','lantern','red','beautiful','up','hand','night','new']
    },
    {
        id: 'watch_lantern', target: 'lantern_post', duration: 100,
        templates: [['look','lantern','beautiful'],['lantern','red','bright'],['night','lantern','good']],
        effects: {}, priority: 'idle',
        activityDe: 'bewundert die Laternen', visibleConcepts: ['look','lantern','red','bright','beautiful','night','warm','quiet','fire']
    },
    // shrine (was 1 action)
    {
        id: 'pray_shrine', target: 'shrine', duration: 200,
        templates: [['me','pray','god'],['pray','quiet','good'],['wish','good','heart'],['go','shrine','now'],['monk','pray','quiet'],['buy','omamori']],
        effects: {}, priority: 'idle',
        activityDe: 'betet am Schrein', visibleConcepts: ['pray','god','wish','quiet','heart','hope','candle','incense','good']
    },
    {
        id: 'burn_incense', target: 'shrine', duration: 120,
        templates: [['me','burn','incense'],['incense','fragrant','good'],['burn','incense','here']],
        effects: {}, priority: 'productive',
        activityDe: 'zündet Räucherstäbchen an', visibleConcepts: ['burn','incense','fragrant','fire','quiet','god','smell','hand']
    },
    // pagoda (was 1 action)
    {
        id: 'climb_pagoda', target: 'pagoda', duration: 250,
        templates: [['me','climb','pagoda'],['pagoda','tall','beautiful'],['up','look','far'],['look','down'],['look','behind']],
        effects: {}, priority: 'idle',
        activityDe: 'besteigt die Pagode', visibleConcepts: ['climb','pagoda','tall','up','far','look','foot','strength','beautiful','every']
    },
    {
        id: 'ring_bell', target: 'pagoda', duration: 100,
        templates: [['me','play','bell'],['bell','sound','big'],['listen','bell','good']],
        effects: {}, priority: 'idle',
        activityDe: 'läutet die Tempelglocke', visibleConcepts: ['bell','sound','big','listen','quiet','old','beautiful','heart']
    },
    // fish_pond (was 1 action)
    {
        id: 'feed_fish', target: 'fish_pond', duration: 120,
        templates: [['me','feed','fish'],['fish','eat','food'],['look','fish','water']],
        effects: {}, priority: 'productive',
        activityDe: 'füttert die Fische', visibleConcepts: ['feed','fish','water','food','look','many','small','hand','rice']
    },
    {
        id: 'watch_fish', target: 'fish_pond', duration: 140,
        templates: [['look','fish','water'],['fish','beautiful','red'],['water','quiet','good'],['turtle','slow'],['fish_pond','deep']],
        effects: {}, priority: 'idle',
        activityDe: 'beobachtet die Fische', visibleConcepts: ['look','fish','water','red','beautiful','quiet','slow','many','deep']
    },
    // dock (was 1 action)
    {
        id: 'watch_river_dock', target: 'dock', duration: 120,
        templates: [['look','river','far'],['water','go','far'],['boat','river','go']],
        effects: {}, priority: 'idle',
        activityDe: 'beobachtet den Fluss vom Steg', visibleConcepts: ['look','river','water','boat','far','shore','deep','quiet','wind','sail']
    },
    {
        id: 'tie_boat', target: 'dock', duration: 100,
        templates: [['me','make','rope'],['boat','here','good'],['rope','boat','hand']],
        effects: {}, priority: 'productive',
        activityDe: 'vertäut das Boot', visibleConcepts: ['boat','rope','hand','shore','water','pull','near','strength']
    },
    // rice_paddy (was 1 action)
    {
        id: 'harvest_rice', target: 'rice_paddy', duration: 250,
        templates: [['me','harvest','rice'],['rice','many','good'],['harvest','grain','field'],['field','wide'],['basket','full'],['farmer','work_v','field'],['farmer','busy'],['otsukare']],
        effects: {}, priority: 'productive',
        activityDe: 'erntet Reis', visibleConcepts: ['harvest','rice','grain','field','hand','many','knife','earth','foot','hot']
    },
    {
        id: 'tend_rice', target: 'rice_paddy', duration: 180,
        templates: [['me','look','rice'],['water','field','good'],['rice','green','new']],
        effects: {}, priority: 'productive',
        activityDe: 'pflegt das Reisfeld', visibleConcepts: ['look','rice','field','water','earth','green','insect','hand','foot','busy']
    },
    // willow (was 1 action)
    {
        id: 'read_under_willow', target: 'willow', duration: 200,
        templates: [['me','read','book'],['tree','quiet','good'],['sit','read','here']],
        effects: {}, priority: 'idle',
        activityDe: 'liest unter dem Weidenbaum', visibleConcepts: ['read','book','tree','quiet','shadow','leaf','wind','sit','comfy']
    },
    {
        id: 'write_poem_willow', target: 'willow', duration: 220,
        templates: [['me','write','poem'],['tree','beautiful','quiet'],['poem','tree','wind']],
        effects: {}, priority: 'productive',
        activityDe: 'schreibt ein Gedicht', visibleConcepts: ['write','poem','tree','beautiful','wind','leaf','shadow','heart','think','quiet']
    },
    // well (was 2 actions)
    {
        id: 'wash_face_well', target: 'well', duration: 80,
        templates: [['me','wash','water'],['water','cold','good'],['wash','hand','eye'],['me','wash','face'],['wash','hand','foot']],
        effects: {}, priority: 'idle',
        activityDe: 'wäscht das Gesicht am Brunnen', visibleConcepts: ['wash','water','cold','hand','eye','morning','clean','well2','wet']
    },
    // bridge (was 2 actions)
    {
        id: 'listen_river_bridge', target: 'bridge', duration: 120,
        templates: [['listen','water','sound'],['river','quiet','good'],['bridge','river','beautiful'],['ear','good']],
        effects: {}, priority: 'idle',
        activityDe: 'lauscht dem Fluss von der Brücke', visibleConcepts: ['listen','water','river','bridge','sound','quiet','deep','wind','comfy']
    },
    // bamboo (was 2 actions)
    {
        id: 'play_bamboo_flute', target: 'bamboo', duration: 180,
        templates: [['me','play','music'],['bamboo','music','beautiful'],['blow','bamboo','sound'],['flute','blow']],
        effects: {}, priority: 'idle',
        activityDe: 'spielt Bambusflöte', visibleConcepts: ['play','music','bamboo','blow','sound','beautiful','wind','quiet','heart','song']
    },
    // river (was 2 actions)
    {
        id: 'skip_stones', target: 'river', duration: 100,
        templates: [['me','play','stone'],['stone','water','far'],['play','river','good']],
        effects: {}, priority: 'idle',
        activityDe: 'lässt Steine springen', visibleConcepts: ['play','stone','water','river','hand','far','small','round','happy']
    },
    // flower (was 2 actions)
    {
        id: 'pick_flower', target: 'flower', duration: 80,
        templates: [['me','pick','flower'],['flower','beautiful','red'],['give','flower','friend'],['flower','yellow','small'],['me','make','ikebana']],
        effects: {}, priority: 'productive',
        activityDe: 'pflückt eine Blume', visibleConcepts: ['pick','flower','beautiful','red','hand','give','friend','fragrant','happy']
    },
    // lotus_pond (was 2 actions)
    {
        id: 'paint_lotus', target: 'lotus_pond', duration: 200,
        templates: [['me','paint','lotus'],['lotus','beautiful','water'],['paint','picture','good']],
        effects: {}, priority: 'productive',
        activityDe: 'malt den Lotus', visibleConcepts: ['paint','lotus','beautiful','water','picture','quiet','float','red']
    },
];
