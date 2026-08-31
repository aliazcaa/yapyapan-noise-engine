# Textual Automaton (Yapyapan Jazz Engine)

Conway's Game of Life where every living cell is a word, pulled live from
whatever is typed into the field at the top of the page. Cells that are
about to die (per standard Life rules) glitch — bleeding characters from a
neighboring word if they're in contact with a different one, or falling
back to generic corruption symbols if they're dying in isolation.

Typing also triggers a drum hit per keystroke, velocity from typing
speed. The mouse doesn't trigger sound at all — it's a live effects
control surface for whatever the keyboard plays: X axis controls
playback rate (including genuine reverse playback on the left half of
the screen) and delay time simultaneously; Y axis controls delay wet/dry
mix. A session timer starts on your first keystroke and locks everything
— typing and all mouse interaction — once the limit is hit, until you
dismiss the reminder popup.

## Structure

```
textual-automaton/
├── index.html          — page shell: loads p5.js from CDN, then
│                          sketch.js, audio.js, and timer.js
├── css/
│   └── style.css       — page layout and the word-input box styling
├── js/
│   ├── sketch.js         — the Life simulation: grid, rules, glitch,
│   │                       font-size jitter, highlight system, live word input
│   ├── audio.js           — keyboard drums + mouse-driven rate/delay FX
│   │                       (see "Sound" below)
│   └── timer.js           — session stopwatch + lock/reminder popup
│                            (see "Timer" below)
└── assets/
    └── audio/
        ├── README.md      — exact filenames + key/FX mapping audio.js expects
        └── (your drum .wav samples go here)
```

## Running locally

Serve the folder over `http://localhost` rather than opening `index.html`
directly — `file://` pages block `fetch()` (used to load the drum
samples) under the Same-Origin Policy:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or with Node: `npx serve .`

## Deploying

Fully static, no build step beyond the p5.js CDN script already linked.
Drag-and-drop onto Netlify/Vercel, push to a repo for GitHub Pages, or
copy `index.html`, `css/`, `js/`, and `assets/` onto any web server.

## Tuning

Grid/visual parameters live at the top of `js/sketch.js` in the `params`
object. The default phrase in `index.html`'s input value attribute
becomes the initial word source.

## Sound

`js/audio.js` — "Yapyapan Jazz Engine" — is completely independent of
`js/sketch.js`. See `assets/audio/README.md` for the full key/FX mapping
and an explanation of how genuine reverse playback is achieved (a
negative `playbackRate` alone does not reverse audio in any browser — a
real reversed copy of each sample is built at load time instead).

Sound only originates from the keyboard; the mouse is purely a live
effects controller (rate + delay time from X, wet/dry mix from Y) applied
to whatever the keyboard is triggering.

**Autoplay note**: the `AudioContext` starts `suspended` and resumes on
the first real keystroke — a silent first trigger on page load is
expected, not a bug.

## Timer

`js/timer.js` is independent of both `sketch.js` and `audio.js`, but
coordinates with both through one shared flag: `window.toolLocked`.

The stopwatch starts on the first keystroke in the word field. After the
limit (`SESSION_LIMIT_SECONDS`, currently 1 minute for testing — change
to `30 * 60` for real use) a popup appears and **all interaction is
disabled**: `#word-input` is set to `disabled` (which also silences
`audio.js`'s keyboard trigger for free), and `window.toolLocked = true`
stops `sketch.js`'s grid clicks. Dismissing the popup re-enables
everything and immediately restarts the countdown.
