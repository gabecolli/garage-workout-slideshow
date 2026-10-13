# Garage Workout Slideshow

A dependency-free TV display and workout runner.

Live site: https://gabecolli.github.io/garage-workout-slideshow/

## Routine

Monday: strength A (squat, pull, cable press, Dopa power).
Tuesday: steady endurance and mobility.
Wednesday: strength B (trap bar, rings, carry).
Thursday: steady endurance and mobility.
Friday: strength C (single-leg strength, press, row, medicine-ball power).
Saturday: focused boxing, adjusted around actual BJJ class load.
Sunday: easy movement and mobility.

Main lifts repeat for measurable progress. Selected accessories, Dopa entries,
and boxing themes rotate every two weeks. Slow dummy study follows one technical
question; it is separate from class and never counted as conditioning.

`data/program.json` defines the program. `training-engine.js` generates a session
and applies dated reports about class, fatigue, pain, time limits and struggles.
No report means unknown. Only explicit, comparable completed exposures can earn
progression. The private coaching process owns history and reads actual reports;
this public repository never stores that journal.

## Display

The existing appearance and demonstration layout are retained. In preview mode,
slides rotate every 18 seconds while the large clock shows the prescribed movement
duration, explicitly labeled PREVIEW. **Start workout** runs actual work, side-switch and rest
timers. Warm-ups and endurance remain on screen for their prescribed durations.
Setup is counted only on the first round. **Pause**, Previous/Next and keyboard
controls remain available. The physical session stops before the separate dummy
lab. Timers and viewing slides never mark sets or sessions completed.

Choose **Today**, **10-min minimum**, or **BJJ class day**. **Log set** explicitly
records a set on this device. **Check-in** distinguishes physical work, BJJ class,
boxing and slow dummy study. Save locally or copy the report into the coach/Dot
conversation. Nothing is automatically uploaded, and local logs do not sync
between devices. Dot notification routing must be connected separately.

The display polls `data/today.json` every 60 seconds. Updates wait until an active
workout ends. A six-hour reload is suppressed during an active workout. On a
failed refresh the current plan remains; a cold start falls back to movement
posters. Video links retain library references; unavailable demonstrations show
an explicit fallback rather than an unrelated movement.

## Build and verify

Node has no package dependencies:

```sh
node scripts/generate.mjs 2026-10-13 /path/to/private-dated-feedback.json
node --test tests/*.test.cjs
node --check app.js
```

Omit the feedback argument for an unreported baseline. Do not commit private
feedback files. `targetDate` must match the requested day. The automation saves
its private plan and verifies it before publishing `data/today.json`.

Schema 4 supports one to five blocks, one to three movements per block, one to
five rounds, and explicit `restSeconds`. Total physical duration includes warm-up,
first-round setup, every work interval, side switches and every prescribed rest;
it excludes the dummy lab. Durations are estimates, not pressure to rush reps.

No analytics, ads, paid services, or server-side components.
