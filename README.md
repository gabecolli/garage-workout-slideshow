# Garage Workout Slideshow

A dependency-free, TV-first display for the current Daily FIGHTER Deposits
workout.

**Live site:** <https://gabecolli.github.io/garage-workout-slideshow/>

## How it stays current

- The daily workout automation replaces `data/today.json` after it builds and
  logs the day’s plan.
- An already-open display polls that file every 60 seconds with cache-busting.
- When `generatedAt` changes, the slideshow rebuilds itself without a manual
  browser refresh.
- The page also reloads itself every six hours to recover cleanly from long TV
  browser sessions.
- If the live JSON cannot be reached, the page keeps showing the last loaded
  workout; on a cold start it falls back to the three static movement posters.

## Display behavior

- One overview page per three deposits, followed by ignition and one
  demonstration slide per HOME movement. The display supports three to five
  deposits, two or three exercises per deposit, and independently prescribed
  round counts.
- YouTube videos use privacy-enhanced embeds, autoplay muted, and restart when
  their slide returns. Exact, reputable YouTube Shorts are preferred; a
  thumbnail remains available as a visual fallback until playback begins.
- Overview and cardio-only slides rotate every 18 seconds. Each non-cardio
  exercise expands into one slide per prescribed round, displays REPS and TIME,
  and stays visible for its full exercise countdown before advancing.
- Pause freezes the active countdown and resume continues it. Previous/next,
  arrow keys, or revisiting an exercise reset that exercise timer. The separate
  martial supplement uses the same timer but never counts as physical work.
- Previous, pause/play, next, arrow keys, and spacebar remain available.

There are no analytics, ads, paid services, or server-side components.
