const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.dataset = {};
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.listeners = new Map();
    this.textContent = '';
    this.className = '';
    this.hidden = false;
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: name => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
      remove: name => { this.className = this.className.split(/\s+/).filter(x => x !== name).join(' '); },
      toggle: (name, force) => {
        const add = force === undefined ? !this.classList.contains(name) : force;
        this.classList[add ? 'add' : 'remove'](name);
        return add;
      },
    };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  hasAttribute(key) { return key in this.attributes; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatch(type, event = {}) {
    for (const fn of this.listeners.get(type) || []) fn({target: this, preventDefault() {}, ...event});
  }
  click() { if (!this.disabled) this.dispatch('click'); }
  closest() { return this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch('close'); }
  querySelector(query) { return this.querySelectorAll(query)[0] || null; }
  querySelectorAll(query) {
    const key = query.startsWith('[data-') ? query.slice(6, -1).replace(/-([a-z])/g, (_, x) => x.toUpperCase()) : null;
    const cls = query[0] === '.' ? query.slice(1) : null;
    return this.children.flatMap(child => [
      (key && key in child.dataset) || (cls && child.classList.contains(cls)) ? child : null,
      ...child.querySelectorAll(query),
    ]).filter(Boolean);
  }
}
class ButtonElement extends Element { constructor() { super('button'); } }

function env() {
  const elements = new Map();
  const doc = new Element('document');
  doc.hidden = false;
  doc.querySelector = query => {
    if (!elements.has(query)) elements.set(query, new Element());
    return elements.get(query);
  };
  doc.querySelectorAll = () => [];
  doc.createElement = tag => tag === 'button' ? new ButtonElement() : new Element(tag);
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const schedule = (fn, ms, interval = false) => {
    const id = nextId++;
    timers.set(id, {fn, at: now + ms, interval: interval ? ms : 0});
    return id;
  };
  const window = new Element('window');
  Object.assign(window, {
    location: {origin: 'https://example.test', href: 'https://example.test', reload() {}},
    setTimeout: (fn, ms) => schedule(fn, ms),
    clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, true),
    clearInterval: id => timers.delete(id),
  });
  const advance = ms => {
    const target = now + ms;
    let count = 0;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(count++ < 50000, 'timer loop must terminate');
      const [id, timer] = next;
      now = timer.at;
      if (timer.interval) timer.at += timer.interval;
      else timers.delete(id);
      timer.fn();
    }
    now = target;
  };
  const storage = new Map();
  const src = fs.readFileSync('app.js', 'utf8')
    .replace(/Promise\.all\(\[fetch\('data\/program[\s\S]*?\.catch\(\(\)=>\{\}\);/, '')
    .replace(/^fetchWorkout\(\);/m, '')
    .replace(/^pollId = window\.setInterval\(fetchWorkout, POLL_INTERVAL_MS\);/m, '');
  const context = vm.createContext({
    window, document: doc, console, URL, URLSearchParams, Intl, Date, Number, Set, JSON, Math,
    performance: {now: () => now}, AbortController,
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
    HTMLButtonElement: ButtonElement,
  });
  vm.runInContext(src, context);
  return {context, doc, window, timers, advance, storage, click: query => doc.querySelector(query).click(), run: code => vm.runInContext(code, context)};
}

function timerSession() {
  const e = env();
  e.context.move = {
    id: 'selected', name: 'Selected exercise', category: 'strength', reps: 'TIMED', time: '0:05',
    timeSeconds: 5, setupSeconds: 2, restSeconds: 3,
  };
  e.context.sideMove = {
    ...e.context.move, id: 'side', name: 'Side exercise', time: '0:06', timeSeconds: 6,
    sideMode: 'per-side', sideCount: 2, sideSeconds: 3, sideTime: '0:03', switchSeconds: 1,
  };
  e.run(`
    slides = [createElement('section'), makeIgnitionSlide({...move, name:'Warm-up', timeSeconds:20}),
      makeExerciseSlide(move, {label:'A', rounds:2}, 1), makeExerciseSlide(sideMove, {label:'B', rounds:1}, 1),
      makeExerciseSlide(move, {label:'A', rounds:2}, 2), createElement('section')];
    slides[5].dataset.sessionEnd='true';
    activeWorkout={planId:'test-plan'};
    currentIndex=0; render();
  `);
  return e;
}

function clockText(e) { return e.run('activeCountdownOutput.textContent'); }
function timerAction(e) { e.run('activeCountdownAction.click()'); }

// Data/layout contract checks remain alongside event-driven timer regressions.
test('all generated sessions satisfy display schema, including 1-block minimum', () => {
  const {context, run} = env();
  const engine = require('../training-engine');
  const p = require('../data/program.json');
  for (const key of Object.keys(p.templates)) {
    const pc = JSON.parse(JSON.stringify(p));
    pc.weeklySchedule.Monday = key;
    context.plan = engine.generate(pc, '2026-10-12');
    run('validateWorkout(plan); buildSlides(plan)');
  }
});
test('endurance prep keeps its real 420-second timer', () => {
  const {context, run} = env();
  context.prep = require('../data/program.json').templates.minimum.ignition;
  assert.equal(run('makeIgnitionSlide(prep).dataset.countdownSeconds'), '420');
});
test('initial setup counted once, later rounds get no duplicate setup', () => {
  const {context, run} = env();
  context.move = require('../data/program.json').templates['strength-a'].deposits[0].exercises[0];
  assert.equal(run('makeExerciseSlide(move,{label:"A",rounds:3},1).dataset.setupSeconds'), '15');
  assert.equal(run('makeExerciseSlide(move,{label:"A",rounds:3},2).dataset.setupSeconds'), '0');
});
test('preview rotates every 18 seconds without running or logging work', () => {
  const e = timerSession();
  e.advance(18000);
  assert.equal(e.run('currentIndex'), 1);
  assert.equal(clockText(e), '0:20');
  assert.equal(e.run('activeCountdownLabel.textContent'), 'PREVIEW · TIMER NOT STARTED');
  e.advance(5000);
  assert.equal(clockText(e), '0:20');
  assert.equal(e.run('completedSets.size'), 0);
});
test('manual selection holds preview and Start starts selected exercise at clock time zero', () => {
  const e = timerSession();
  e.click('[data-next]');
  e.click('[data-next]');
  assert.equal(e.run('currentIndex'), 2);
  assert.equal(e.run('isPaused'), true);
  assert.equal(e.run('startButton.textContent'), 'Start this exercise');
  e.advance(19000);
  assert.equal(e.run('currentIndex'), 2);
  assert.equal(clockText(e), '0:05');
  e.click('[data-start]');
  assert.equal(e.run('currentIndex'), 2);
  assert.equal(e.run('activeTimerPhase'), 'setup');
  assert.equal(clockText(e), '0:02');
  e.advance(1000);
  assert.equal(clockText(e), '0:01');
  assert.equal(e.run('completedSets.size'), 0);
});
test('in-clock Start starts selected exercise immediately and ticks from performance.now() = 0', () => {
  const e = timerSession();
  e.click('[data-next]'); e.click('[data-next]');
  timerAction(e);
  assert.equal(e.run('currentIndex'), 2);
  e.advance(1000);
  assert.equal(clockText(e), '0:01');
  e.advance(1000);
  assert.equal(e.run('activeTimerPhase'), 'work');
  assert.equal(clockText(e), '0:05');
  e.advance(1000);
  assert.equal(clockText(e), '0:04');
});
test('Start from overview begins with movement prep', () => {
  const e = timerSession();
  e.click('[data-start]');
  assert.equal(e.run('currentIndex'), 1);
  e.advance(3000);
  assert.equal(e.run('activeTimerPhase'), 'work');
  assert.equal(clockText(e), '0:19');
});
test('pause holds exact remaining time and Resume continues without resetting', () => {
  const e = timerSession();
  e.click('[data-next]'); e.click('[data-next]'); timerAction(e);
  e.advance(3200);
  e.click('[data-toggle]');
  assert.equal(clockText(e), '0:04');
  assert.equal(e.run('slideRemainingMs'), 3800);
  assert.equal(e.run('activeCountdownLabel.textContent'), 'PAUSED · WORK');
  e.advance(10000);
  assert.equal(clockText(e), '0:04');
  timerAction(e);
  e.advance(1000);
  assert.equal(clockText(e), '0:03');
  assert.equal(e.run('activeTimerPhase'), 'work');
});
test('unilateral setup, left, switch, right and rest advance on scheduled events', () => {
  const e = timerSession();
  e.click('[data-next]'); e.click('[data-next]'); e.click('[data-next]');
  assert.equal(clockText(e), '0:03');
  timerAction(e);
  for (const [elapsed, phase, text] of [[2000,'left','0:03'],[3000,'switch','0:01'],[1000,'right','0:03'],[3000,'rest','0:03']]) {
    e.advance(elapsed);
    assert.equal(e.run('activeTimerPhase'), phase);
    assert.equal(clockText(e), text);
  }
  e.advance(3000);
  assert.equal(e.run('currentIndex'), 4);
  assert.equal(e.run('activeTimerPhase'), 'work');
  assert.equal(clockText(e), '0:05');
  assert.equal(e.run('completedSets.size'), 0);
  assert.equal(e.storage.size, 0);
});
test('running navigation starts selected interval and paused navigation clearly stays paused', () => {
  const e = timerSession();
  e.click('[data-start]');
  e.advance(500);
  e.click('[data-next]');
  assert.equal(e.run('currentIndex'), 2);
  e.advance(1000);
  assert.equal(clockText(e), '0:01');
  e.click('[data-toggle]');
  e.click('[data-next]');
  assert.equal(e.run('currentIndex'), 3);
  assert.equal(e.run('activeCountdownAction.textContent'), 'Resume timer');
  assert.equal(e.run('activeCountdownLabel.textContent'), 'PAUSED · GET READY');
  e.advance(10000);
  assert.equal(clockText(e), '0:02');
  e.click('[data-toggle]');
  e.advance(1000);
  assert.equal(clockText(e), '0:01');
});
test('keyboard selection and pause/resume use the same countdown controls', () => {
  const e = timerSession();
  e.doc.dispatch('keydown', {key:'ArrowRight'});
  e.doc.dispatch('keydown', {key:'ArrowRight'});
  e.click('[data-start]');
  e.advance(1000);
  e.doc.dispatch('keydown', {key:' '});
  e.advance(4000);
  assert.equal(clockText(e), '0:01');
  e.doc.dispatch('keydown', {key:' '});
  e.advance(1000);
  assert.equal(e.run('activeTimerPhase'), 'work');
  e.doc.dispatch('keydown', {key:'ArrowLeft'});
  assert.equal(e.run('currentIndex'), 1);
});
test('hiding pauses elapsed time and returning resumes without waiting for a fetch', () => {
  const e = timerSession();
  e.run('fetchWorkout = () => new Promise(() => {})');
  e.click('[data-next]'); e.click('[data-next]'); timerAction(e);
  e.advance(3000);
  e.doc.hidden = true;
  e.doc.dispatch('visibilitychange');
  e.advance(10000);
  assert.equal(clockText(e), '0:04');
  e.doc.hidden = false;
  e.doc.dispatch('visibilitychange');
  e.advance(1000);
  assert.equal(clockText(e), '0:03');
  e.click('[data-toggle]');
  e.doc.hidden = true; e.doc.dispatch('visibilitychange');
  e.doc.hidden = false; e.doc.dispatch('visibilitychange');
  e.advance(5000);
  assert.equal(clockText(e), '0:03');
});
test('restarting scheduler never adds time and pause at a deadline does not restart the phase', () => {
  const e = timerSession();
  e.click('[data-next]'); e.click('[data-next]'); timerAction(e);
  e.advance(600);
  e.run('startCurrentTimer(false)');
  e.advance(1400);
  assert.equal(e.run('activeTimerPhase'), 'work');
  e.run('setPaused(true); slideRemainingMs=0; setPaused(false)');
  assert.equal(e.run('activeTimerPhase'), 'rest');
  assert.equal(clockText(e), '0:03');
});
test('check-in freezes timer and closing resumes only if it was running', () => {
  const e = timerSession();
  e.click('[data-start]');
  e.advance(1000);
  e.click('[data-open-checkin]');
  e.advance(10000);
  assert.equal(clockText(e), '0:01');
  e.click('[data-close-checkin]');
  e.advance(1000);
  assert.equal(e.run('activeTimerPhase'), 'work');
  e.click('[data-toggle]');
  e.click('[data-open-checkin]');
  e.click('[data-close-checkin]');
  e.advance(3000);
  assert.equal(clockText(e), '0:20');
});
test('physical-session finish stops before the separate dummy lab and never logs sets', () => {
  const e = timerSession();
  e.run('slides.push(makeExerciseSlide(sideMove,{label:"M", rounds:1},1))');
  for (let i = 0; i < 4; i++) e.click('[data-next]');
  timerAction(e);
  e.advance(8000);
  assert.equal(e.run('currentIndex'), 5);
  assert.equal(e.run('isPaused'), true);
  assert.equal(e.run('toggleButton.disabled'), true);
  e.advance(60000);
  e.doc.dispatch('keydown', {key:' '});
  assert.equal(e.run('currentIndex'), 5);
  assert.equal(e.run('isPaused'), true);
  assert.equal(e.run('completedSets.size'), 0);
});
test('a single timed slide still counts down; only Log set writes completion', () => {
  const e = timerSession();
  e.run('slides=[makeExerciseSlide(move,{label:"A",rounds:1},1)];currentIndex=0;render()');
  timerAction(e);
  e.advance(3000);
  assert.equal(clockText(e), '0:04');
  assert.equal(e.storage.size, 0);
  e.click('[data-done]');
  assert.equal(e.run('completedSets.size'), 1);
  assert.equal(e.storage.size, 1);
});
