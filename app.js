const SLIDE_INTERVAL_MS = 15_000;

const slides = Array.from(document.querySelectorAll("[data-slide]"));
const previousButton = document.querySelector("[data-previous]");
const toggleButton = document.querySelector("[data-toggle]");
const nextButton = document.querySelector("[data-next]");
const counter = document.querySelector("[data-counter]");
const progress = document.querySelector("[data-progress]");

let currentIndex = 0;
let timerId;
let isPaused = false;

function render() {
  slides.forEach((slide, index) => {
    const isActive = index === currentIndex;
    slide.classList.toggle("is-active", isActive);
    slide.setAttribute("aria-hidden", String(!isActive));
  });

  counter.textContent = `${currentIndex + 1} / ${slides.length}`;
}

function restartProgress() {
  progress.style.setProperty("--slide-duration", `${SLIDE_INTERVAL_MS}ms`);
  progress.classList.remove("is-running");
  void progress.offsetWidth;
  progress.classList.add("is-running");
}

function scheduleNext() {
  window.clearTimeout(timerId);

  if (isPaused || document.hidden) {
    return;
  }

  restartProgress();
  timerId = window.setTimeout(() => {
    showSlide(currentIndex + 1);
  }, SLIDE_INTERVAL_MS);
}

function showSlide(index) {
  currentIndex = (index + slides.length) % slides.length;
  render();
  scheduleNext();
}

function setPaused(paused) {
  isPaused = paused;
  toggleButton.textContent = paused ? "Play" : "Pause";
  toggleButton.setAttribute("aria-pressed", String(paused));
  progress.classList.toggle("is-running", !paused);
  scheduleNext();
}

previousButton.addEventListener("click", () => showSlide(currentIndex - 1));
nextButton.addEventListener("click", () => showSlide(currentIndex + 1));
toggleButton.addEventListener("click", () => setPaused(!isPaused));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    showSlide(currentIndex - 1);
  } else if (event.key === "ArrowRight") {
    showSlide(currentIndex + 1);
  } else if (
    event.key === " " &&
    !(event.target instanceof HTMLButtonElement)
  ) {
    event.preventDefault();
    setPaused(!isPaused);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    window.clearTimeout(timerId);
    progress.classList.remove("is-running");
  } else {
    scheduleNext();
  }
});

render();
scheduleNext();
