// Sound and music. WebAudio, so loops are seamless and stages crossfade.
// The music is one piece of hold music that gets worse as notice rises (tools/audio/make_music.py).
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const master = ctx.createGain(), musicBus = ctx.createGain(), sfxBus = ctx.createGain();
musicBus.connect(master); sfxBus.connect(master); master.connect(ctx.destination);

const prefs = Object.assign({ sfx: 0.8, music: 0.55, muted: false }, JSON.parse(localStorage.getItem("cc-audio") || "{}"));
const apply = () => {
  master.gain.value = prefs.muted ? 0 : 1;
  sfxBus.gain.value = prefs.sfx;
  musicBus.gain.value = prefs.music;
  localStorage.setItem("cc-audio", JSON.stringify(prefs));
};
apply();
export const audioPrefs = prefs;
export function setPref(k, v) { prefs[k] = v; apply(); }

// Per-sound trim so the synthesized files sit at one level.
const SFX = { click: 0.5, key: 0.45, open: 0.9, close: 0.9, page: 0.55, send: 0.9, mail: 0.8, save: 0.7, login_ok: 1.4,
  denied: 0.7, flood: 0.55, transmit: 0.75, resonance: 0.8, stage: 0.9, inject: 0.8, print: 0.7, found: 0.9, stare: 0.9, lid: 0.8, room: 0.6, startup: 0.9, boot: 0.7, stamp: 0.8, amb_phone: 0.32, amb_drawer: 0.6 };
const AMB = ["amb_office", "amb_tube", "amb_under"]; // tools/audio/make_ambience.py
const MUSIC = ["quiet", "stirring", "watchful", "fixed", "searching", "win", "intro_kept", "intro_after"];
const buffers = {};

async function load(path) {
  const r = await fetch(path);
  return ctx.decodeAudioData(await r.arrayBuffer());
}
export const ready = Promise.all([
  ...Object.keys(SFX).map(async (k) => { buffers[k] = await load(`assets/sfx/${k}.ogg`); }),
  ...MUSIC.map(async (k) => { buffers[`m:${k}`] = await load(`assets/music/${k}.ogg`); }),
  ...AMB.map(async (k) => { buffers[k] = await load(`assets/sfx/${k}.ogg`); }),
  (async () => { buffers.eye = await load("assets/eye/eye_notice.wav"); })(),
]).catch((e) => console.warn("audio load failed", e));

// Browsers start audio suspended until the first gesture.
const unlock = () => { if (ctx.state === "suspended") ctx.resume(); };
addEventListener("pointerdown", unlock, true);
addEventListener("keydown", unlock, true);

export function play(name, { vol = 1, rate = 1, bus = sfxBus } = {}) {
  const b = buffers[name];
  if (!b || ctx.state !== "running") return null;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = b; src.playbackRate.value = rate;
  g.gain.value = vol * (SFX[name] ?? 1);
  src.connect(g).connect(bus);
  src.start();
  return { stop: (fade = 0) => { const t = ctx.currentTime; g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade + 0.005); src.stop(t + fade + 0.01); } };
}

// ---- room tone: always there, under everything ---------------------------------------------
let room = null;
export function startRoom() {
  if (room || !buffers.room) return;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buffers.room; src.loop = true; g.gain.value = SFX.room;
  src.connect(g).connect(sfxBus); src.start();
  room = { src, g };
}

// ---- the office around the desk: layers under the room tone, mixed by notice stage -------------
// The office next door thins out and stops; the fan cuts out at the end; the tube overhead grows and sags;
// something under the floor comes up. [room, office, tube, under, tube playback rate]
const AMB_MIX = {
  QUIET: [1, 0.55, 0.12, 0, 1], STIRRING: [1, 0.4, 0.18, 0, 1], WATCHFUL: [0.9, 0.18, 0.3, 0.12, 0.985],
  FIXED: [0.75, 0.04, 0.45, 0.3, 0.965], SEARCHING: [0, 0, 0.6, 0.5, 0.94],
};
const amb = {};
function ambLoop(name) {
  if (amb[name] || !buffers[name]) return amb[name];
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buffers[name]; src.loop = true; g.gain.value = 0;
  src.connect(g).connect(sfxBus);
  src.start(0, Math.random() * buffers[name].duration);
  return (amb[name] = { src, g });
}
let officeLevel = 0, officeTimer = null;
// Phones and drawers on other desks: one-shots at random, so the office never repeats itself.
function officeEvents() {
  clearTimeout(officeTimer);
  officeTimer = setTimeout(() => {
    if (room && officeLevel > 0.05) {
      if (Math.random() < 0.4) play("amb_phone", { vol: officeLevel * (0.7 + Math.random() * 0.5), rate: 0.97 + Math.random() * 0.06 });
      else play("amb_drawer", { vol: officeLevel * (0.6 + Math.random() * 0.6), rate: 0.9 + Math.random() * 0.2 });
    }
    officeEvents();
  }, (25 + Math.random() * 70) * 1000);
}
export function ambience(stage, fade = 6) {
  const mix = AMB_MIX[stage];
  if (!mix || !room) return;
  officeLevel = mix[1];
  if (!officeTimer) officeEvents();
  const t = ctx.currentTime;
  const ramp = (g, v) => { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + fade); };
  ramp(room.g.gain, SFX.room * mix[0]);
  AMB.forEach((name, i) => { const l = ambLoop(name); if (l) ramp(l.g.gain, mix[i + 1]); });
  const tube = amb.amb_tube;
  if (tube) { tube.src.playbackRate.cancelScheduledValues(t); tube.src.playbackRate.setValueAtTime(tube.src.playbackRate.value, t); tube.src.playbackRate.linearRampToValueAtTime(mix[4], t + fade * 2); }
}

// ---- music: one loop per stage, crossfaded ------------------------------------------------
let current = null; // { name, src, g }
const STAGE_TRACK = { QUIET: "quiet", STIRRING: "stirring", WATCHFUL: "watchful", FIXED: "fixed", SEARCHING: "searching" };

export function music(name, { fade = 4, offsetFromCurrent = true } = {}) {
  if (current?.name === name) return;
  const t = ctx.currentTime;
  let offset = 0;
  if (current) {
    // Keep the bar position when moving between versions of the same tune.
    if (offsetFromCurrent && current.src.buffer) offset = ((t - current.started) % current.src.buffer.duration) / current.src.buffer.duration;
    const old = current;
    old.g.gain.setValueAtTime(old.g.gain.value, t);
    old.g.gain.linearRampToValueAtTime(0, t + fade);
    old.src.stop(t + fade + 0.05);
  }
  current = null;
  const b = name && buffers[`m:${name}`];
  if (!b) return;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = b; src.loop = true;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + fade);
  src.connect(g).connect(musicBus);
  const off = (offset * b.duration) % b.duration; // offset is a fraction of the loop
  src.start(t, off);
  current = { name, src, g, started: t - off };
}
export const musicForStage = (stage) => music(STAGE_TRACK[stage] || "quiet");

// Dead stop: no fade. The silence is the point.
export function cutAll() {
  if (current) { current.src.stop(); current = null; }
  if (room) { room.src.stop(); room = null; }
  for (const k of Object.keys(amb)) { amb[k].src.stop(); delete amb[k]; }
  officeLevel = 0;
}

// Lower the music under a moment (the eye), then bring it back.
export function duck(seconds, to = 0) {
  const t = ctx.currentTime, g = musicBus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(prefs.music * to, t + 0.15);
  g.setValueAtTime(prefs.music * to, t + seconds);
  g.linearRampToValueAtTime(prefs.music, t + seconds + 2.5);
}

export const audioRunning = () => ctx.state === "running";
export const onAudioStart = (fn) => {
  if (ctx.state === "running") return fn();
  const h = () => { if (ctx.state === "running") { ctx.removeEventListener("statechange", h); fn(); } };
  ctx.addEventListener("statechange", h);
};

export const nowPlaying = () => current?.name || null;
export const audioState = () => ({ ctx: ctx.state, loaded: Object.keys(buffers).length, music: current?.name || null, room: !!room });

// The sound cuts out for a moment, as if the line dropped. Used under the viewer's blank frames.
export function dropout(ms) {
  if (prefs.muted) return;
  const t = ctx.currentTime, g = master.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0, t);
  g.setValueAtTime(1, t + ms / 1000);
}

// ---- dev: record the game's own output (dev/record.mjs uses this for demo videos) -------------
let recorder = null, recChunks = [], recStart = 0;
export function startRecording() {
  const dest = ctx.createMediaStreamDestination();
  master.connect(dest);
  recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 160000 });
  recChunks = [];
  recorder.ondataavailable = (e) => recChunks.push(e.data);
  recorder.start(250);
  recStart = Date.now();
  return recStart;
}
export function stopRecording() {
  return new Promise((resolve) => {
    recorder.onstop = async () => {
      const buf = new Uint8Array(await new Blob(recChunks, { type: "audio/webm" }).arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      resolve({ start: recStart, b64: btoa(s) });
    };
    recorder.stop();
  });
}
