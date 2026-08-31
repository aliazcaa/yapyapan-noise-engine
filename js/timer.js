// ═══════════════════════════════════════════════════════════════
// PROCRASTINATION TIMER — starts on the first keystroke, shows a
// running stopwatch top-left, and pops up a reminder after the limit.
// While the popup is showing, ALL interaction is disabled: the word
// input is disabled outright (which also silences audio.js's keyboard
// drum trigger, since it listens on that same field), and a shared
// window.toolLocked flag is set to true — both sketch.js (grid
// click-to-toggle) and audio.js check this flag themselves.
// ═══════════════════════════════════════════════════════════════

const SESSION_LIMIT_SECONDS = 1 * 60; // currently 1 minute for testing — set to 30 * 60 for the real version
const REMINDER_MESSAGE = "Now get back to work! Enough for procrastinating :)";

let elapsedSeconds = 0;
let intervalId = null;
let hasStarted = false;

window.toolLocked = false;

function createStopwatchElement() {
    let el = document.createElement('div');
    el.id = 'procrastination-timer';
    el.style.position = 'fixed';
    el.style.top = '20px';
    el.style.left = '20px';
    el.style.zIndex = '20';
    el.style.fontFamily = 'Arial, sans-serif';
    el.style.fontSize = '14px';
    el.style.color = '#0c0c0c';
    el.style.background = '#ffffff';
    el.style.border = '1px solid rgba(12, 12, 12, 0.2)';
    el.style.borderRadius = '6px';
    el.style.padding = '6px 12px';
    el.style.boxShadow = '0 2px 8px rgba(12, 12, 12, 0.08)';
    el.textContent = '00:00';
    document.body.appendChild(el);
    return el;
}

function formatTime(totalSeconds) {
    let m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    let s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function createPopupElement() {
    let overlay = document.createElement('div');
    overlay.id = 'procrastination-popup-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(12, 12, 12, 0.6)';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '2147483647';

    let box = document.createElement('div');
    box.style.background = '#ffffff';
    box.style.borderRadius = '10px';
    box.style.padding = '32px 28px';
    box.style.maxWidth = 'min(360px, calc(100vw - 48px))';
    box.style.textAlign = 'center';
    box.style.fontFamily = 'Arial, sans-serif';
    box.style.boxShadow = '0 8px 24px rgba(12, 12, 12, 0.2)';

    let message = document.createElement('p');
    message.textContent = REMINDER_MESSAGE;
    message.style.fontSize = '16px';
    message.style.color = '#0c0c0c';
    message.style.marginBottom = '20px';
    message.style.lineHeight = '1.4';

    let button = document.createElement('button');
    button.textContent = 'Okay, back to work';
    button.style.background = '#fb002c';
    button.style.color = '#ffffff';
    button.style.border = 'none';
    button.style.borderRadius = '6px';
    button.style.padding = '10px 20px';
    button.style.fontSize = '14px';
    button.style.fontFamily = 'inherit';
    button.style.cursor = 'pointer';
    button.addEventListener('click', dismissPopupAndRestart);

    box.appendChild(message);
    box.appendChild(button);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return overlay;
}

let stopwatchEl = null;
let popupOverlayEl = null;
let wordInputEl = null;

function tick() {
    elapsedSeconds++;
    stopwatchEl.textContent = formatTime(elapsedSeconds);

    if (elapsedSeconds >= SESSION_LIMIT_SECONDS) {
        showPopup();
    }
}

function startTimer() {
    if (hasStarted) return;
    hasStarted = true;
    intervalId = setInterval(tick, 1000);
}

function showPopup() {
    clearInterval(intervalId);
    intervalId = null;

    window.toolLocked = true;
    if (wordInputEl) wordInputEl.disabled = true;

    popupOverlayEl.style.display = 'flex';
}

function dismissPopupAndRestart() {
    popupOverlayEl.style.display = 'none';

    window.toolLocked = false;
    if (wordInputEl) wordInputEl.disabled = false;

    elapsedSeconds = 0;
    stopwatchEl.textContent = formatTime(elapsedSeconds);
    intervalId = setInterval(tick, 1000);
}

window.addEventListener('load', function () {
    stopwatchEl = createStopwatchElement();
    popupOverlayEl = createPopupElement();
    wordInputEl = document.getElementById('word-input');

    if (wordInputEl) {
        wordInputEl.addEventListener('keydown', startTimer);
    }
});
