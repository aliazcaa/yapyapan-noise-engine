// ═══════════════════════════════════════════════════════════════
// YAPYAPAN JAZZ ENGINE — keyboard-triggered drums, mouse-controlled FX
// Pure Web Audio API (no Tone.js) — decoded sample playback with a
// thin layer of per-hit pitch/gain jitter so nothing repeats identically.
// Each voice can have up to 4 sample variations, cycled round-robin so
// the same variation never plays twice in a row.
//
// SOUND ORIGINATES FROM THE KEYBOARD ONLY. The mouse no longer triggers
// anything by itself — it's a live effects control surface instead:
//   X axis → playback RATE, -0.9 to 1. Negative = plays a pre-reversed
//            copy of the buffer (real reverse playback — see note below).
//            Positive = forward, at that speed.
//   X axis → ALSO drives DELAY TIME simultaneously (same raw position,
//            two different mapped outputs, no conflict).
//   Y axis → DELAY WET/DRY MIX — top of screen = more delay, bottom = dry.
//
// Fully decoupled from sketch.js: this file only listens to the same
// #word-input field the p5 sketch already reads from, plus its own raw
// mousemove listener on window. It deliberately never declares global
// p5-style functions like mousePressed() — sketch.js already owns those
// for the grid click-to-toggle feature.
//
// Respects window.toolLocked (set by timer.js when the session-limit
// popup is showing) — the keyboard handler checks it and does nothing
// while locked.
// ═══════════════════════════════════════════════════════════════

// ---- 1. Your drum kit — each voice can have 1–4 sample variations.
// Round-robin cycling (below) steps through them in order per trigger,
// so you get even coverage and never hear the same variation twice in a
// row — more reliable than pure random with only a few options each.
const KIT_FILES = {
    kick:        ['assets/audio/00_Kick_04_Big.wav', 'assets/audio/00_Kick_05_Big.wav'],
    snare:       ['assets/audio/01_Snare_20_G.wav', 'assets/audio/01_Snare_21_G.wav', 'assets/audio/01_Snare_22_G.wav', 'assets/audio/02_Snare_Flam_01_E.wav', 'assets/audio/02_Snare_Roll_01_Short.wav'],
    rim:         ['assets/audio/03_Rim.wav', 'assets/audio/03_Rim_Flam.wav'],
    hihatClosed: ['assets/audio/04_Closed_Hat_01_Clean.wav', 'assets/audio/04_Closed_Hat_09_Hard.wav', 'assets/audio/04_Closed_Hat_10_Hard.wav', 'assets/audio/04_Closed_Hat_13_Pedal.wav', 'assets/audio/04_Closed_Hat_14_Pedal.wav'],
    hihatOpen:   ['assets/audio/05_Open_Hat_01_Full_Open.wav', 'assets/audio/05_Open_Hat_05_Hard.wav', 'assets/audio/05_Open_Hat_16_Open_and_Close.wav', 'assets/audio/05_Open_Hat_17_Roll_and_Close.wav'],
    tom:         ['assets/audio/08_Tom_02_Low_C.wav', 'assets/audio/08_Tom_06_Low_E.wav', 'assets/audio/08_Tom_19_Low_Flam_A#.wav', 'assets/audio/09_Tom_07_Medium_A.wav', 'assets/audio/09_Tom_08_Medium_A.wav', 'assets/audio/09_Tom_21_Medium_Flam_B.wav'],
    ride:        ['assets/audio/07_Ride_01.wav', 'assets/audio/07_Ride_02.wav', 'assets/audio/07_Ride_03.wav', 'assets/audio/07_Ride_04.wav', 'assets/audio/07_Ride_05.wav', 'assets/audio/07_Ride_07.wav', 'assets/audio/07_Ride_08.wav'],
    crash:       ['assets/audio/06_Crash_02.wav', 'assets/audio/06_Crash_03.wav', 'assets/audio/06_Crash_11.wav', 'assets/audio/06_Crash_12.wav']
};

// ---- 2. Key → drum-voice zones (deterministic, not random) ----
const KEY_ZONES = {
    kick:        'aeiou',       // vowels — the steady pulse
    snare:       'tnsrhld',     // common consonants — the backbeat
    rim:         'bcfgkm',
    hihatClosed: 'pvwy',        // remaining common letters — texture
    ride:        'qxzj'         // rare letters — accents
};

const FALLBACK_VOICE = ['hihatOpen', 'tom', 'crash', 'ride'];
const SPACE_VOICES = ['crash', 'hihatOpen', 'ride'];       // end-of-word accent
const DEL_VOICES = ['tom', 'ride', 'hihatOpen'];             // erasing accent

const IGNORED_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
                      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                      'Home', 'End', 'Escape', 'Enter'];

function voiceForKey(rawKey) {
    if (IGNORED_KEYS.includes(rawKey)) return null;

    let char = rawKey.toLowerCase();
    for (let voice in KEY_ZONES) {
        if (KEY_ZONES[voice].includes(char)) return voice;
    }
    return FALLBACK_VOICE[Math.floor(Math.random() * FALLBACK_VOICE.length)];
}

// ---- 3. Audio context + sample loading (forward AND reversed) ----
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let kitBuffers = {};          // voiceName -> array of decoded AudioBuffers, forward
let kitBuffersReversed = {};  // voiceName -> array of decoded AudioBuffers, reversed
let voiceCursor = {};         // voiceName -> shared round-robin index into both arrays above
let kitReady = false;

// Real reverse playback needs the actual sample data flipped — setting a
// negative playbackRate on AudioBufferSourceNode does NOT reverse audio
// in any current browser, despite the Web Audio spec technically allowing
// negative values there. This builds a genuinely reversed copy once at
// load time so reverse mode is just "play this other buffer forward."
function reverseBuffer(buffer) {
    let reversed = audioCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        let data = buffer.getChannelData(ch).slice(); // copy, so the original is untouched
        Array.prototype.reverse.call(data);
        reversed.copyToChannel(data, ch);
    }
    return reversed;
}

async function loadKit() {
    let voiceNames = Object.keys(KIT_FILES);

    await Promise.all(
        voiceNames.map(async (voiceName) => {
            let paths = KIT_FILES[voiceName];
            let buffers = await Promise.all(
                paths.map(async (path) => {
                    try {
                        let response = await fetch(path);
                        let arrayBuffer = await response.arrayBuffer();
                        return await audioCtx.decodeAudioData(arrayBuffer);
                    } catch (err) {
                        console.warn(`Textual Automaton audio: couldn't load "${voiceName}" variation from ${path}`, err);
                        return null;
                    }
                })
            );
            let forward = buffers.filter(b => b !== null);
            kitBuffers[voiceName] = forward;
            kitBuffersReversed[voiceName] = forward.map(reverseBuffer);
            voiceCursor[voiceName] = 0;
        })
    );

    kitReady = true;
}
loadKit();

// ---- 4. Delay effect chain — persistent, shared by every hit ----
// dryGain carries the untouched signal; delayNode → feedbackGain (looped
// back into the delay for repeats) → wetGain carries the echoed signal.
// Both sum at audioCtx.destination. Every playHit() routes through both
// paths simultaneously; the Y-axis mix control (section 5) just adjusts
// the balance between the two gains, live.
const delayNode = audioCtx.createDelay(1.0); // max 1s delay time
const feedbackGain = audioCtx.createGain();
const dryGain = audioCtx.createGain();
const wetGain = audioCtx.createGain();

feedbackGain.gain.value = 0.35; // how many repeats before an echo fades out
dryGain.gain.value = 1;
wetGain.gain.value = 0; // starts fully dry until the mouse moves

delayNode.connect(feedbackGain);
feedbackGain.connect(delayNode); // the actual feedback loop
delayNode.connect(wetGain);
wetGain.connect(audioCtx.destination);
dryGain.connect(audioCtx.destination);

// ---- 5. Mouse position → rate, delay time, and mix (continuous, live) ----
let currentMouseX = window.innerWidth / 2;
let currentMouseY = window.innerHeight / 2;

function mapRange(value, inMin, inMax, outMin, outMax) {
    let t = (value - inMin) / (inMax - inMin);
    t = Math.max(0, Math.min(1, t));
    return outMin + t * (outMax - outMin);
}

// Left of screen = reverse (negative), right = forward (positive) — reads
// like rewind vs. fast-forward. Sampled fresh at the moment each hit fires.
function currentPlaybackRate() {
    return mapRange(currentMouseX, 0, window.innerWidth, -0.9, 1);
}

window.addEventListener('load', function () {
    window.addEventListener('mousemove', function (e) {
        if (window.toolLocked) return; // session-limit popup showing — freeze FX where they are

        currentMouseX = e.clientX;
        currentMouseY = e.clientY;

        // X → delay time. setTargetAtTime ramps smoothly instead of jumping
        // instantly, which avoids the audible "zipper" click a hard .value
        // assignment would cause on a live-flowing delay signal.
        let delayTime = mapRange(currentMouseX, 0, window.innerWidth, 0.02, 0.6);
        delayNode.delayTime.setTargetAtTime(delayTime, audioCtx.currentTime, 0.05);

        // Y → wet/dry mix. Top of screen = more delay, bottom = dry.
        let wetAmount = mapRange(currentMouseY, 0, window.innerHeight, 1, 0);
        wetGain.gain.setTargetAtTime(wetAmount, audioCtx.currentTime, 0.05);
        dryGain.gain.setTargetAtTime(1 - wetAmount, audioCtx.currentTime, 0.05);
    });
});

// ---- 6. One-shot playback: round-robin variation + forward/reverse + FX send ----
function playHit(voiceName, velocity = 1) {
    if (!voiceName) return;
    if (!kitReady) return;

    let rate = currentPlaybackRate();
    let useReversed = rate < 0;
    let rateMagnitude = Math.max(0.05, Math.abs(rate)); // clamp away from 0 — true 0 would freeze/silence the node

    let buffers = useReversed ? kitBuffersReversed[voiceName] : kitBuffers[voiceName];
    if (!buffers || buffers.length === 0) return;

    let idx = voiceCursor[voiceName] || 0;
    let buffer = buffers[idx];
    voiceCursor[voiceName] = (idx + 1) % buffers.length; // shared cursor — forward/reversed stay in sync

    let source = audioCtx.createBufferSource();
    let gainNode = audioCtx.createGain();

    source.buffer = buffer;
    source.playbackRate.value = rateMagnitude * (1 + (Math.random() - 0.5) * 0.06); // mouse rate + a touch of jitter
    gainNode.gain.value = velocity * (0.85 + Math.random() * 0.15);

    source.connect(gainNode);
    gainNode.connect(dryGain);   // straight to output
    gainNode.connect(delayNode); // also feeds the delay send
    source.start(0);
}

// ---- 7. The keyboard trigger: typing speed → velocity ----
let lastKeyTime = 0;

function handleDrumKeydown(e) {
    if (window.toolLocked) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    let now = performance.now();
    let gap = now - lastKeyTime;
    lastKeyTime = now;

    let velocity = mapRange(gap, 30, 400, 1.0, 0.4);
    velocity = Math.max(0.4, Math.min(1.0, velocity));

    if (e.key === ' ') {
        for (let voice of SPACE_VOICES) playHit(voice, velocity);
        return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
        for (let voice of DEL_VOICES) playHit(voice, velocity);
        return;
    }

    let voice = voiceForKey(e.key);
    playHit(voice, velocity);
}

window.addEventListener('load', function () {
    let input = document.getElementById('word-input');
    if (input) {
        input.addEventListener('keydown', handleDrumKeydown);
    }
});
