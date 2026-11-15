// Nihongo Mura — Configuration and small random helpers

// ============================================================
//  CONFIGURATION
// ============================================================
const WORLD_W = 1000;
const WORLD_H = 640;
const HEARING_RANGE = 180; // base reference; actual range is per-learner via wahrnehmung
const TICK_MS = 16;
const MAX_FRAME_MS = 100;   // longest real-time step one frame may simulate
const SPEAKER_NAMES = ["明","花","健","美","太郎","桜","翔","葵","蓮","凛","陸","結","悠","愛","大","智"];
const LEARNER_NAMES = ["Hans","Lena","Fritz","Greta","Karl","Anna","Otto","Helga","Klaus","Ingrid","Max","Elsa"];
const NPC_NAMES = ["誠","真","優","和","幸","信","義","勇","恵","雅","光","清","福","寿","康","宝"];

function randEl(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }
function randFloat(a,b) { return Math.random()*(b-a)+a; }
