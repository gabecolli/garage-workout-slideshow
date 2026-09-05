const DATA_URL = "data/today.json";
const SLIDE_INTERVAL_MS = 18_000;
const POLL_INTERVAL_MS = 60_000;
const AUTO_RELOAD_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const TIMER_TICK_MS = 200;

const slideshow = document.querySelector("[data-slideshow]");
const previousButton = document.querySelector("[data-previous]");
const toggleButton = document.querySelector("[data-toggle]");
const nextButton = document.querySelector("[data-next]");
const counter = document.querySelector("[data-counter]");
const progress = document.querySelector("[data-progress]");
const liveStatus = document.querySelector("[data-live-status]");

let slides = Array.from(document.querySelectorAll("[data-slide]"));
let currentIndex = 0;
let timerId;
let pollId;
let isPaused = false;
let currentRevision = "";
let hasWorkout = false;
let youtubeSequence = 0;
let timerTickId;
let slideStartedAt = 0;
let slideRemainingMs = 0;
let slideTotalMs = 0;
let activeCountdownOutput = null;
let activeCountdownLabel = null;
let activeCountdownPanel = null;
let activeTimerPhase = "slide";

const CATEGORY_LABELS = {
  "rings-calisthenics": "RINGS / CALISTHENICS",
  kettlebell: "KETTLEBELL",
  dopamineo: "DOPAMINEO",
  conditioning: "CONDITIONING",
  power: "POWER",
  strength: "STRENGTH",
  mobility: "MOBILITY",
  martial: "MARTIAL SUPPLEMENT",
};

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getTimeSeconds(item) {
  const seconds = Number(item?.timeSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
}

function getSetupSeconds(item) {
  const seconds = Number(item?.setupSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

function isPerSide(item) {
  return item?.sideMode === "per-side" && Number(item?.sideCount) === 2;
}

function getSideSeconds(item) {
  const seconds = Number(item?.sideSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
}

function getSwitchSeconds(item) {
  const seconds = Number(item?.switchSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
}

function getTimeLabel(item) {
  if (isPerSide(item)) {
    return `${safeText(item?.sideTime, formatDuration(getSideSeconds(item)))} / SIDE`;
  }
  return safeText(item?.time, formatDuration(getTimeSeconds(item)));
}

function isCardioExempt(item) {
  return item?.timerMode === "cardio-exempt" || item?.cardioExempt === true;
}

function makeExerciseClock(item) {
  const clock = createElement("div", "exercise-clock");
  const fields = createElement("div", "exercise-timing");
  for (const [label, value] of [
    ["REPS", safeText(item?.reps, "TIMED")],
    ["TIME", getTimeLabel(item)],
    ["SETUP", formatDuration(getSetupSeconds(item))],
  ]) {
    const field = createElement("div", "timing-field");
    field.append(
      createElement("span", "timing-field__label", label),
      createElement("strong", "timing-field__value", value),
    );
    fields.append(field);
  }
  const setupSeconds = getSetupSeconds(item);
  const countdown = createElement("div", `exercise-countdown ${setupSeconds ? "is-setup" : "is-work"}`);
  countdown.dataset.timerPhasePanel = "";
  const phaseLabel = createElement("span", "exercise-countdown__label", setupSeconds ? "GET READY" : "WORK");
  phaseLabel.dataset.timerPhaseLabel = "";
  countdown.append(phaseLabel);
  const output = createElement(
    "output",
    "exercise-countdown__value",
    formatDuration(setupSeconds || (isPerSide(item) ? getSideSeconds(item) : getTimeSeconds(item))),
  );
  output.dataset.exerciseCountdown = "";
  countdown.append(output);
  clock.append(fields, countdown);
  return clock;
}

function makeCardioDuration(item) {
  const panel = createElement("div", "cardio-duration");
  panel.append(
    createElement("span", "cardio-duration__label", "DURATION"),
    createElement("strong", "cardio-duration__value", safeText(item?.time || item?.prescription, formatDuration(getTimeSeconds(item)))),
    createElement("span", "cardio-duration__note", "CARDIO • NO EXERCISE COUNTDOWN"),
  );
  return panel;
}

function getChicagoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatPlanDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "TODAY";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(`${value}T12:00:00-05:00`));
}

function categoryClass(category) {
  const known = Object.hasOwn(CATEGORY_LABELS, category) ? category : "strength";
  return `category--${known}`;
}

function makeCategory(category) {
  const badge = createElement(
    "span",
    `category ${categoryClass(category)}`,
    CATEGORY_LABELS[category] || CATEGORY_LABELS.strength,
  );
  return badge;
}

function makeMedia(exercise) {
  const media = exercise?.media || {};
  const shell = createElement("div", "media-shell");
  const sourceUrl = safeText(media.sourceUrl || media.url);
  const thumbnail = safeText(media.thumbnailUrl || media.thumbnail);

  if (media.type === "youtube" && safeText(media.videoId)) {
    const videoId = media.videoId.trim();
    const start = Number.isFinite(media.startSeconds)
      ? Math.max(0, Math.floor(media.startSeconds))
      : 0;
    const end = Number.isFinite(media.endSeconds)
      ? Math.max(start + 1, Math.floor(media.endSeconds))
      : null;
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: "1",
      playlist: videoId,
      controls: "0",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      iv_load_policy: "3",
      disablekb: "1",
      enablejsapi: "1",
      origin: window.location.origin,
      start: String(start),
    });
    if (end) params.set("end", String(end));

    const fallback = createElement("img", "media-shell__fallback");
    fallback.src =
      thumbnail || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
    fallback.alt = `${safeText(exercise.name, "Exercise")} demonstration`;
    shell.append(fallback);

    const frame = createElement("iframe", "media-shell__video");
    frame.id = `fighter-youtube-${++youtubeSequence}`;
    frame.title = `${safeText(exercise.name, "Exercise")} video demonstration`;
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.setAttribute("allowfullscreen", "");
    frame.dataset.youtube = "true";
    frame.dataset.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
    frame.addEventListener("load", () => connectYouTubeFrame(frame));
    shell.append(frame);
  } else if (thumbnail) {
    const image = createElement("img", "media-shell__image");
    image.src = thumbnail;
    image.alt = `${safeText(exercise.name, "Exercise")} demonstration`;
    shell.append(image);
  } else {
    const placeholder = createElement("div", "media-shell__placeholder");
    placeholder.append(
      createElement("span", "media-shell__mark", "F"),
      createElement("p", "", "Visual demo unavailable"),
    );
    shell.append(placeholder);
  }

  const source = createElement("div", "media-source");
  source.append(
    createElement("span", "media-source__label", "DEMO"),
    createElement(
      "span",
      "media-source__name",
      safeText(media.sourceName || media.title, "Verified exercise reference"),
    ),
  );
  if (sourceUrl) {
    const link = createElement("a", "media-source__link", "Open source ↗");
    link.href = sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    source.append(link);
  }
  shell.append(source);
  return shell;
}

function makeOverview(workout, deposits, pageIndex = 0, pageCount = 1) {
  const slide = createElement("section", "slide slide--overview");
  if (deposits.some((deposit) => (deposit.exercises || []).length > 2)) {
    slide.classList.add("slide--overview-dense");
  }
  slide.dataset.slide = "";
  slide.setAttribute("aria-hidden", "true");

  const header = createElement("header", "overview-header");
  const titleBlock = createElement("div");
  titleBlock.append(
    createElement(
      "p",
      "eyebrow",
      `DAILY FIGHTER DEPOSITS • ${formatPlanDate(workout.date).toUpperCase()}${
        pageCount > 1 ? ` • OVERVIEW ${pageIndex + 1}/${pageCount}` : ""
      }`,
    ),
    createElement(
      "h1",
      "overview-title",
      pageIndex === 0
        ? safeText(workout.title, "TODAY’S WORKOUT")
        : safeText(workout.additionalTitle, "MORE DEPOSITS"),
    ),
    createElement("p", "overview-emphasis", safeText(workout.emphasis)),
  );
  const mode = createElement("div", "featured-mode");
  mode.append(
    createElement("span", "featured-mode__label", "TODAY’S MIX"),
    createElement("strong", "", safeText(workout.featuredMode, "MIXED MODALITY")),
  );
  header.append(titleBlock, mode);

  const levels = createElement("div", "level-strip");
  for (const [key, label] of [
    ["floor", "FLOOR"],
    ["standard", "STANDARD"],
    ["bonus", "BONUS"],
  ]) {
    const card = createElement("div", `level level--${key}`);
    card.append(
      createElement("span", "level__label", label),
      createElement("strong", "level__value", safeText(workout.levels?.[key], "—")),
    );
    levels.append(card);
  }

  const grid = createElement("div", "deposit-grid");
  for (const deposit of deposits) {
    const card = createElement("article", "deposit-card");
    const top = createElement("div", "deposit-card__top");
    top.append(
      createElement("span", "deposit-card__letter", safeText(deposit.label, "•")),
      createElement("h2", "", safeText(deposit.title, "Deposit")),
      createElement("span", "deposit-card__rounds", `×${deposit.rounds || 1}`),
    );
    const list = createElement("div", "deposit-card__moves");
    for (const exercise of deposit.exercises || []) {
      const move = createElement("div", "deposit-card__move");
      move.append(
        makeCategory(exercise.category),
        createElement("strong", "", safeText(exercise.name, "Exercise")),
        createElement("span", "", `REPS: ${safeText(exercise.reps, "TIMED")} • TIME: ${getTimeLabel(exercise)}`),
      );
      list.append(move);
    }
    card.append(top, list, createElement("p", "deposit-card__effort", safeText(deposit.effort)));
    grid.append(card);
  }

  const ignition = createElement("div", "overview-footer__item");
  ignition.append(
    createElement("span", "overview-footer__label", "10-MIN IGNITION"),
    createElement(
      "strong",
      "",
      `${safeText(workout.ignition?.name, "Movement prep")} • ${safeText(workout.ignition?.prescription, "10 min")}`,
    ),
  );
  const supplement = createElement("div", "overview-footer__item overview-footer__item--muted");
  supplement.append(
    createElement("span", "overview-footer__label", "MARTIAL SUPPLEMENT • SEPARATE"),
    createElement("strong", "", safeText(workout.martialSupplement?.text, "Optional")),
  );
  const footer = createElement("footer", "overview-footer");
  footer.append(ignition, supplement);

  slide.append(header, levels, grid, footer);
  return slide;
}

function makeIgnitionSlide(ignition) {
  if (!ignition) return null;
  const slide = createElement("section", "slide slide--exercise");
  slide.dataset.slide = "";
  slide.dataset.timerMode = safeText(ignition.timerMode, "cardio-exempt");
  slide.setAttribute("aria-hidden", "true");

  const mediaExercise = {
    name: ignition.name,
    media: ignition.media,
  };
  const detail = createElement("article", "exercise-detail");
  detail.append(
    makeCategory(ignition.category || "conditioning"),
    createElement("p", "exercise-kicker", "10-MIN IGNITION"),
    createElement("h1", "exercise-title", safeText(ignition.name, "Movement prep")),
  );
  if (isCardioExempt(ignition)) {
    detail.append(makeCardioDuration(ignition));
  } else {
    slide.dataset.countdownSeconds = String(getTimeSeconds(ignition));
    detail.append(makeExerciseClock(ignition));
  }
  const routes = createElement("div", "routes");
  routes.append(
    makeRoute("HOME", safeText(ignition.home, "As prescribed"), true),
    makeRoute("AWAY", safeText(ignition.away, "Same training purpose"), false),
  );
  detail.append(routes, makeCue(safeText(ignition.cue)));
  slide.append(makeMedia(mediaExercise), detail);
  return slide;
}

function makeRoute(label, text, primary) {
  const route = createElement("div", `route${primary ? " route--primary" : ""}`);
  route.append(
    createElement("span", "route__label", label),
    createElement("strong", "route__text", text),
  );
  return route;
}

function makeCue(text) {
  const cue = createElement("div", "cue");
  cue.append(
    createElement("span", "cue__label", "ONE CUE"),
    createElement("strong", "", text || "Move cleanly; stop before quality drops."),
  );
  return cue;
}

function makeExerciseSlide(exercise, deposit, roundNumber = 1) {
  const slide = createElement("section", "slide slide--exercise");
  slide.dataset.slide = "";
  slide.dataset.timerMode = "exercise";
  slide.dataset.countdownSeconds = String(getTimeSeconds(exercise));
  slide.dataset.setupSeconds = String(getSetupSeconds(exercise));
  if (isPerSide(exercise)) {
    slide.dataset.sideMode = "per-side";
    slide.dataset.sideSeconds = String(getSideSeconds(exercise));
    slide.dataset.switchSeconds = String(getSwitchSeconds(exercise));
  }
  slide.setAttribute("aria-hidden", "true");

  const detail = createElement("article", "exercise-detail");
  detail.append(
    makeCategory(exercise.category),
    createElement(
      "p",
      "exercise-kicker",
      `DEPOSIT ${safeText(deposit.label, "•")} • ROUND ${roundNumber}/${deposit.rounds || 1} • ${safeText(deposit.title, "WORK")}`,
    ),
    createElement("h1", "exercise-title", safeText(exercise.name, "Exercise")),
    makeExerciseClock(exercise),
  );

  const routes = createElement("div", "routes");
  routes.append(
    makeRoute("HOME", safeText(exercise.home, exercise.name), true),
    makeRoute("AWAY", safeText(exercise.away, "Equivalent route"), false),
  );
  const effort = createElement("div", "effort-row");
  effort.append(
    createElement("span", "effort-pill", `ROUND ${roundNumber} / ${deposit.rounds || 1}`),
    createElement("span", "effort-pill effort-pill--muted", safeText(deposit.effort, "QUALITY REPS")),
  );
  detail.append(routes, makeCue(safeText(exercise.cue)), effort);
  slide.append(makeMedia(exercise), detail);
  return slide;
}

function makeMartialSupplementSlide(supplement) {
  if (!supplement?.name) return null;
  const deposit = { label: "M", title: "MARTIAL SUPPLEMENT", rounds: 1, effort: "SEPARATE — NOT COUNTED" };
  const slide = makeExerciseSlide(supplement, deposit, 1);
  slide.classList.add("slide--martial");
  const kicker = slide.querySelector(".exercise-kicker");
  if (kicker) kicker.textContent = "MARTIAL SUPPLEMENT • SEPARATE — NOT COUNTED";
  return slide;
}

function buildSlides(workout) {
  const deposits = workout.deposits || [];
  const overviewPages = [];
  for (let index = 0; index < deposits.length; index += 3) {
    overviewPages.push(deposits.slice(index, index + 3));
  }
  const nextSlides = overviewPages.map((page, index) =>
    makeOverview(workout, page, index, overviewPages.length),
  );
  const ignitionSlide = makeIgnitionSlide(workout.ignition);
  if (ignitionSlide) nextSlides.push(ignitionSlide);
  for (const deposit of deposits) {
    for (let round = 1; round <= deposit.rounds; round += 1) {
      for (const exercise of deposit.exercises || []) {
        nextSlides.push(makeExerciseSlide(exercise, deposit, round));
      }
    }
  }
  const martialSlide = makeMartialSupplementSlide(workout.martialSupplement);
  if (martialSlide) nextSlides.push(martialSlide);
  return nextSlides;
}

function validateTimedMovement(item, label) {
  if (isCardioExempt(item)) return;
  if (!safeText(item?.reps)) throw new Error(`${label} must include REPS or TIMED`);
  const seconds = getTimeSeconds(item);
  if (!Number.isInteger(seconds) || seconds < 1) throw new Error(`${label} must include a positive timeSeconds value`);
  if (!safeText(item?.time) || item.time !== formatDuration(seconds)) throw new Error(`${label} TIME must match timeSeconds in m:ss format`);
  const setupSeconds = getSetupSeconds(item);
  if (![15, 20, 30].includes(setupSeconds)) throw new Error(`${label} setupSeconds must be 15, 20, or 30`);
  if (item?.sideMode === "per-side") {
    if (Number(item?.sideCount) !== 2) throw new Error(`${label} sideCount must equal 2`);
    const sideSeconds = getSideSeconds(item);
    if (!Number.isInteger(sideSeconds) || sideSeconds < 1) throw new Error(`${label} sideSeconds must be positive`);
    if (!safeText(item?.sideTime) || item.sideTime !== formatDuration(sideSeconds)) {
      throw new Error(`${label} sideTime must match sideSeconds in m:ss format`);
    }
    if (seconds !== sideSeconds * 2) throw new Error(`${label} timeSeconds must equal both sides combined`);
    const switchSeconds = getSwitchSeconds(item);
    if (!Number.isInteger(switchSeconds) || switchSeconds < 1 || switchSeconds > 30) {
      throw new Error(`${label} switchSeconds must be between 1 and 30`);
    }
  }
}

function validateWorkout(workout) {
  if (!workout || typeof workout !== "object") throw new Error("Workout data is missing");
  if (workout.schemaVersion < 3) throw new Error("Workout timing schema v3 is required");
  if (!Array.isArray(workout.deposits) || workout.deposits.length < 3 || workout.deposits.length > 5) {
    throw new Error("Workout must contain three to five deposits");
  }
  if (workout.ignition) validateTimedMovement(workout.ignition, "Ignition");
  for (const deposit of workout.deposits) {
    if (!Array.isArray(deposit.exercises) || deposit.exercises.length < 1 || deposit.exercises.length > 3) {
      throw new Error("Each deposit must contain two or three exercises");
    }
    if (!Number.isInteger(deposit.rounds) || deposit.rounds < 1 || deposit.rounds > 5) {
      throw new Error("Deposit rounds must be between one and five");
    }
    for (const exercise of deposit.exercises) validateTimedMovement(exercise, exercise.name || "Exercise");
  }
  if (workout.martialSupplement?.name) validateTimedMovement(workout.martialSupplement, "Martial supplement");
}

function setWorkout(workout) {
  validateWorkout(workout);
  const nextSlides = buildSlides(workout);
  slideshow.replaceChildren(...nextSlides);
  slides = nextSlides;
  currentIndex = 0;
  hasWorkout = true;
  render();

  const stale = workout.date !== getChicagoDate();
  liveStatus.classList.toggle("live-badge--stale", stale);
  liveStatus.textContent = `${stale ? "LAST PLAN" : "LIVE"} • ${formatPlanDate(workout.date).toUpperCase()}`;
}

function renderFallback() {
  if (hasWorkout) return;
  const sources = [
    ["assets/slides/slide-1.png", "Rings and calisthenics movement poster"],
    ["assets/slides/slide-2.png", "Kettlebell movement poster"],
    ["assets/slides/slide-3.png", "Resistance-band movement poster"],
  ];
  slides = sources.map(([src, alt]) => {
    const slide = createElement("figure", "slide slide--poster");
    slide.dataset.slide = "";
    slide.setAttribute("aria-hidden", "true");
    const image = createElement("img");
    image.src = src;
    image.alt = alt;
    slide.append(image);
    return slide;
  });
  slideshow.replaceChildren(...slides);
  currentIndex = 0;
  liveStatus.classList.add("live-badge--offline");
  liveStatus.textContent = "RETRYING LIVE PLAN";
  render();
}

function activateMedia() {
  slides.forEach((slide, index) => {
    for (const frame of slide.querySelectorAll("[data-youtube]")) {
      if (index === currentIndex) {
        if (!frame.src) frame.src = frame.dataset.src;
      } else if (frame.hasAttribute("src")) {
        frame.closest(".media-shell")?.classList.remove("is-playing");
        frame.removeAttribute("src");
      }
    }
  });
}

function connectYouTubeFrame(frame) {
  let attempts = 0;
  const listen = () => {
    if (!frame.isConnected || !frame.hasAttribute("src")) return;
    const target = frame.contentWindow;
    if (!target) return;
    target.postMessage(
      JSON.stringify({ event: "listening", id: frame.id }),
      "https://www.youtube-nocookie.com",
    );
    target.postMessage(
      JSON.stringify({
        event: "command",
        func: "addEventListener",
        args: ["onStateChange"],
        id: frame.id,
      }),
      "https://www.youtube-nocookie.com",
    );
    attempts += 1;
    if (attempts < 4) window.setTimeout(listen, 750);
  };
  listen();
}

window.addEventListener("message", (event) => {
  if (
    event.origin !== "https://www.youtube-nocookie.com" &&
    event.origin !== "https://www.youtube.com"
  ) {
    return;
  }
  let payload;
  try {
    payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch {
    return;
  }
  const frame = Array.from(document.querySelectorAll("[data-youtube]")).find(
    (candidate) => candidate.contentWindow === event.source,
  );
  if (!frame) return;
  const state =
    payload?.event === "onStateChange"
      ? payload.info
      : payload?.info?.playerState;
  if (state === 1) {
    frame.closest(".media-shell")?.classList.add("is-playing");
  }
});

function getActiveWorkDurationMs() {
  const seconds = Number(slides[currentIndex]?.dataset.countdownSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  return 0;
}

function getActiveSetupDurationMs() {
  const seconds = Number(slides[currentIndex]?.dataset.setupSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  return 0;
}

function isActivePerSide() {
  return slides[currentIndex]?.dataset.sideMode === "per-side";
}

function getActiveSideDurationMs() {
  const seconds = Number(slides[currentIndex]?.dataset.sideSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  return 0;
}

function getActiveSwitchDurationMs() {
  const seconds = Number(slides[currentIndex]?.dataset.switchSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  return 0;
}

function getActiveSlideDurationMs() {
  if (activeTimerPhase === "setup") return getActiveSetupDurationMs();
  if (activeTimerPhase === "left" || activeTimerPhase === "right") return getActiveSideDurationMs();
  if (activeTimerPhase === "switch") return getActiveSwitchDurationMs();
  if (activeTimerPhase === "work") return getActiveWorkDurationMs();
  return SLIDE_INTERVAL_MS;
}

function clearTimerHandles() {
  window.clearTimeout(timerId);
  window.clearInterval(timerTickId);
  timerId = undefined;
  timerTickId = undefined;
}

function setActiveTimerPhase(phase) {
  activeTimerPhase = phase;
  const phaseLabels = {
    setup: "GET READY",
    work: "WORK",
    left: "LEFT SIDE",
    switch: "SWITCH SIDES",
    right: "RIGHT SIDE",
  };
  if (activeCountdownLabel) {
    activeCountdownLabel.textContent = phaseLabels[phase] || "WORK";
  }
  if (activeCountdownPanel) {
    activeCountdownPanel.classList.toggle("is-setup", phase === "setup" || phase === "switch");
    activeCountdownPanel.classList.toggle("is-work", ["work", "left", "right"].includes(phase));
  }
}

function resetActiveTimerPhase() {
  const hasWorkTimer = getActiveWorkDurationMs() > 0;
  const hasSetupTimer = getActiveSetupDurationMs() > 0;
  let nextPhase = "slide";
  if (hasWorkTimer) {
    nextPhase = hasSetupTimer ? "setup" : (isActivePerSide() ? "left" : "work");
  }
  setActiveTimerPhase(nextPhase);
  slideTotalMs = getActiveSlideDurationMs();
  slideRemainingMs = slideTotalMs;
  slideStartedAt = 0;
}

function currentRemainingMs() {
  if (!slideStartedAt) return slideRemainingMs;
  return Math.max(0, slideRemainingMs - (performance.now() - slideStartedAt));
}

function updateTimerVisual() {
  const remaining = currentRemainingMs();
  const ratio = slideTotalMs > 0 ? 1 - remaining / slideTotalMs : 0;
  progress.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
  if (activeCountdownOutput) activeCountdownOutput.textContent = formatDuration(Math.ceil(remaining / 1000));
}

function pauseCurrentTimer() {
  slideRemainingMs = currentRemainingMs();
  slideStartedAt = 0;
  clearTimerHandles();
  updateTimerVisual();
}

function finishCurrentTimerPhase() {
  slideRemainingMs = 0;
  slideStartedAt = 0;
  clearTimerHandles();
  updateTimerVisual();

  let nextPhase = "";
  if (activeTimerPhase === "setup") {
    nextPhase = isActivePerSide() ? "left" : "work";
  } else if (activeTimerPhase === "left") {
    nextPhase = getActiveSwitchDurationMs() > 0 ? "switch" : "right";
  } else if (activeTimerPhase === "switch") {
    nextPhase = "right";
  }

  if (nextPhase) {
    setActiveTimerPhase(nextPhase);
    slideTotalMs = getActiveSlideDurationMs();
    slideRemainingMs = slideTotalMs;
    updateTimerVisual();
    startCurrentTimer(false);
    return;
  }

  timerId = window.setTimeout(() => showSlide(currentIndex + 1), TIMER_TICK_MS);
}

function startCurrentTimer(reset = false) {
  clearTimerHandles();
  const activeSlide = slides[currentIndex];
  activeCountdownOutput = activeSlide?.querySelector("[data-exercise-countdown]") || null;
  activeCountdownLabel = activeSlide?.querySelector("[data-timer-phase-label]") || null;
  activeCountdownPanel = activeSlide?.querySelector("[data-timer-phase-panel]") || null;

  if (reset) {
    resetActiveTimerPhase();
  } else if (!slideRemainingMs || slideRemainingMs < 1) {
    slideTotalMs = getActiveSlideDurationMs();
    slideRemainingMs = slideTotalMs;
  }

  setActiveTimerPhase(activeTimerPhase);
  updateTimerVisual();
  if (isPaused || document.hidden || slides.length < 2) return;

  slideStartedAt = performance.now();
  timerTickId = window.setInterval(updateTimerVisual, TIMER_TICK_MS);
  timerId = window.setTimeout(finishCurrentTimerPhase, slideRemainingMs);
}

function render({ resetTimer = true } = {}) {
  if (!slides.length) return;
  slides.forEach((slide, index) => {
    const isActive = index === currentIndex;
    slide.classList.toggle("is-active", isActive);
    slide.setAttribute("aria-hidden", String(!isActive));
  });
  counter.textContent = `${currentIndex + 1} / ${slides.length}`;
  activateMedia();
  startCurrentTimer(resetTimer);
}

function showSlide(index) {
  if (!slides.length) return;
  currentIndex = (index + slides.length) % slides.length;
  render({ resetTimer: true });
}

function setPaused(paused) {
  if (paused === isPaused) return;
  if (paused) pauseCurrentTimer();
  isPaused = paused;
  toggleButton.textContent = paused ? "Play" : "Pause";
  toggleButton.setAttribute("aria-pressed", String(paused));
  if (!paused) startCurrentTimer(false);
}

async function fetchWorkout() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const url = new URL(DATA_URL, window.location.href);
    url.searchParams.set("_", String(Date.now()));
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Workout request failed: ${response.status}`);
    const workout = await response.json();
    const revision = safeText(workout.generatedAt, `${workout.date}:${JSON.stringify(workout).length}`);
    if (revision !== currentRevision) {
      setWorkout(workout);
      currentRevision = revision;
    }
    if (hasWorkout) {
      liveStatus.classList.remove("live-badge--offline");
    }
  } catch (error) {
    console.warn("Unable to refresh workout data", error);
    renderFallback();
    if (hasWorkout) {
      liveStatus.classList.add("live-badge--offline");
      liveStatus.textContent = "OFFLINE • SHOWING LAST PLAN";
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

previousButton.addEventListener("click", () => showSlide(currentIndex - 1));
nextButton.addEventListener("click", () => showSlide(currentIndex + 1));
toggleButton.addEventListener("click", () => setPaused(!isPaused));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showSlide(currentIndex - 1);
  if (event.key === "ArrowRight") showSlide(currentIndex + 1);
  if (event.key === " " && !(event.target instanceof HTMLButtonElement)) {
    event.preventDefault();
    setPaused(!isPaused);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseCurrentTimer();
    activateMedia();
  } else {
    fetchWorkout().finally(() => {
      if (!isPaused) startCurrentTimer(false);
    });
  }
});

window.addEventListener("online", fetchWorkout);
window.addEventListener("pageshow", fetchWorkout);

fetchWorkout();
pollId = window.setInterval(fetchWorkout, POLL_INTERVAL_MS);
window.setTimeout(() => window.location.reload(), AUTO_RELOAD_INTERVAL_MS);

window.addEventListener("pagehide", () => {
  clearTimerHandles();
  window.clearInterval(pollId);
});
