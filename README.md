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
and boxing themes rotate every two weeks. Mobility bundles and familiar dummy-study
contexts rotate daily, avoiding the previous two days. Slow dummy study follows one
shared weekly technical question; it is separate from class and never counted as conditioning.

`data/program.json` defines the program. `training-engine.js` generates a session
and applies dated reports about class, fatigue, pain, time limits and struggles.
The optional dated feedback input may include recentPlans with date, exerciseIds and
dummyThemeId to avoid repeated optional slots after a moved plan. No report means unknown. Only explicit, comparable completed exposures can earn
progression. The private coaching process owns history and reads actual reports;
this public repository never stores that journal.

## Display

The always-on display starts the first movement countdown automatically on page
load. Every selected or automatically displayed exercise runs its real setup,
work, side-switch and rest timers without a Start click. **Pause timer** /
**Resume timer** preserve remaining time; an explicit pause survives navigation,
plan changes and reload. Background throttling is reconciled against wall-clock
time when callbacks or visibility resume. Reload starts a fresh display pass
unless paused; neither reload nor timer progress records training.

At the end of physical movements, an 18-second **PHYSICAL DISPLAY CYCLE ENDED**
boundary counts down before looping the physical display. This is screen playback,
not a prescription for another workout. The optional dummy lab stays outside the
automatic loop and can be reached with Next at that boundary. Nothing is marked
completed automatically. **Preview slides** is an optional static-clock preview;
**Run timers** returns to the selected exercise with a running timer.

Choose **Today**, **10-min minimum**, or **BJJ class day**. **Log set** explicitly
records a set on this device. **Check-in** distinguishes physical work, BJJ class,
boxing and slow dummy study. Save locally or copy the report into the coach/Dot
conversation, or tell your Dot naturally what you did. Dot now has an enabled daily
check-in around 7pm America/Chicago and instructions to save reports to the private
journal read by the nightly builder. Local page logs are not automatically uploaded
and do not sync between devices.

The display polls `data/today.json` every 60 seconds. Updated plans wait until the
physical display boundary, then load automatically. Explicit Pause is respected.
A six-hour reload is suppressed while timers are running. On a
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
