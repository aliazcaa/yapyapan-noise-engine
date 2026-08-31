# Drum samples

`js/audio.js` expects the following files in this folder, matching the
`KIT_FILES` object at the top of that file — cycled round-robin per
voice (never repeats the same variation twice in a row), and each
variation also has a genuinely reversed copy built automatically at load
time (see "Reverse playback" below).

```
kick   → 00_Kick_04_Big.wav, 00_Kick_05_Big.wav
snare  → 01_Snare_20_G.wav, 01_Snare_21_G.wav, 01_Snare_22_G.wav,
          02_Snare_Flam_01_E.wav, 02_Snare_Roll_01_Short.wav
rim    → 03_Misc_08_Rim.wav
hihatClosed → 04_Closed_Hat_01_Clean.wav, 04_Closed_Hat_09_Hard.wav,
               04_Closed_Hat_10_Hard.wav, 04_Closed_Hat_13_Pedal.wav,
               04_Closed_Hat_14_Pedal.wav
hihatOpen → 05_Open_Hat_01_Full_Open.wav, 05_Open_Hat_05_Hard.wav,
             05_Open_Hat_16_Open_and_Close.wav,
             05_Open_Hat_17_Roll_and_Close.wav
tom    → 08_Tom_02_Low_C.wav, 08_Tom_06_Low_E.wav,
          08_Tom_19_Low_Flam_A#.wav, 09_Tom_07_Medium_A.wav,
          09_Tom_08_Medium_A.wav, 09_Tom_21_Medium_Flam_B.wav
ride   → 07_Ride_01.wav through 07_Ride_08.wav (skipping 06)
crash  → 06_Crash_02.wav, 06_Crash_03.wav, 06_Crash_11.wav, 06_Crash_12.wav
```

## Key mapping (all in `js/audio.js`)

| Voice | Triggered by |
|---|---|
| kick | vowels: a e i o u |
| snare | common consonants: t n s r h l d |
| rim | b c f g k m |
| hihatClosed | p v w y |
| ride | rare letters: q x z j |
| crash / hihatOpen / ride | spacebar (3-voice cluster accent) |
| tom / ride / hihatOpen | Backspace/Delete (3-voice cluster accent) |
| hihatOpen / tom / crash / ride | random fallback for anything else |

**The mouse no longer triggers sound at all.** It's a live effects
control surface for whatever the keyboard triggers:

- **X axis → playback rate**, -0.9 to 1. Right side = forward, faster
  toward the right edge. Left side = **reverse** (a real reversed copy of
  the sample, not just a negative rate — see below).
- **X axis → also delay time**, simultaneously, 0.02–0.6 seconds.
- **Y axis → delay wet/dry mix**. Top of screen = more echo, bottom = dry.

## Reverse playback

Setting a negative `playbackRate` on a Web Audio buffer source does
**not** reverse playback in any current browser, despite the spec
technically allowing it. To get real reverse audio, `loadKit()` builds a
second, genuinely time-reversed copy of every sample at load time
(`reverseBuffer()` in `js/audio.js`) — moving the mouse to the left half
of the screen switches which buffer plays, not just which direction a
number points.

## Adding/changing variations

Each voice can have 1–4 variations. Edit the arrays in `KIT_FILES` at the
top of `js/audio.js` — loading, reversal, round-robin cycling, and jitter
all read straight from that object.

Keep samples short (a fraction of a second to ~1s each) — longer samples
will overlap heavily during fast typing.
