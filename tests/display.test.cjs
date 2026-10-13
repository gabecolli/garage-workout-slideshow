const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.children=[];this.style={};this.attributes={};this.classList={add(){},remove(){},toggle(){}};this.textContent='';this.hidden=false;}
 append(...nodes){this.children.push(...nodes)} replaceChildren(...nodes){this.children=nodes} setAttribute(k,v){this.attributes[k]=v}getAttribute(k){return this.attributes[k]}hasAttribute(k){return k in this.attributes}removeAttribute(k){delete this.attributes[k]} addEventListener(){} closest(){return this} 
 querySelector(q){return this.querySelectorAll(q)[0]||null}
 querySelectorAll(q){const key=q.startsWith('[data-')?q.slice(6,-1).replace(/-([a-z])/g,(_,x)=>x.toUpperCase()):null;const cls=q[0]==='.'?q.slice(1):null;return this.children.flatMap(c=>[(key && key in c.dataset)||(cls && c.className?.split(' ').includes(cls))?c:null,...c.querySelectorAll(q)]).filter(Boolean)}
}
function env(){const elements=new Map;const doc={hidden:false,querySelector(q){if(!elements.has(q))elements.set(q,new Element);return elements.get(q)},querySelectorAll(){return []},createElement(t){return new Element(t)},addEventListener(){}};let timers=[];const window={location:{origin:'https://example.test',href:'https://example.test',reload(){}},setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},clearInterval(){},addEventListener(){}};let src=fs.readFileSync('app.js','utf8').replace(/Promise\.all\(\[fetch\('data\/program[\s\S]*?\.catch\(\(\)=>\{\}\);/,'').replace(/^fetchWorkout\(\);/m,'');const context=vm.createContext({window,document:doc,console,URL,URLSearchParams,Intl,Date,Number,Set,JSON,Math,performance:{now:()=>100},AbortController,localStorage:{getItem(){return null},setItem(){}},HTMLButtonElement:Element});vm.runInContext(src,context);return {context,timers,run:s=>vm.runInContext(s,context)};}
test('all generated sessions satisfy display schema, including 1-block minimum',()=>{let {context,run}=env();const engine=require('../training-engine');const p=require('../data/program.json');for(const key of Object.keys(p.templates)){const pc=JSON.parse(JSON.stringify(p));pc.weeklySchedule.Monday=key;context.plan=engine.generate(pc,'2026-10-12');run('validateWorkout(plan);buildSlides(plan)');} });
test('endurance prep keeps its real 420-second timer',()=>{const {context,run}=env();context.prep=require('../data/program.json').templates.minimum.ignition;assert.equal(run('makeIgnitionSlide(prep).dataset.countdownSeconds'),'420');});
test('initial setup counted once, later rounds get no duplicate setup',()=>{const {context,run}=env();context.move=require('../data/program.json').templates['strength-a'].deposits[0].exercises[0];assert.equal(run('makeExerciseSlide(move,{label:"A",rounds:3},1).dataset.setupSeconds'),'15');assert.equal(run('makeExerciseSlide(move,{label:"A",rounds:3},2).dataset.setupSeconds'),'0');});
test('per-side sequence includes switch and prescribed rest; no automatic completion',()=>{const {context,run}=env();context.move=require('../data/program.json').templates['strength-a'].deposits[0].exercises[0];run('slides=[makeExerciseSlide(move,{label:"A",rounds:3},1),makeExerciseSlide(move,{label:"A",rounds:3},2)];currentIndex=0;workoutMode=true;isPaused=true;startCurrentTimer(true)');assert.equal(run('activeTimerPhase'),'setup');for(const phase of ['left','switch','right','rest']){run('finishCurrentTimerPhase()');assert.equal(run('activeTimerPhase'),phase);}assert.equal(run('getActiveSlideDurationMs()'),90000);assert.equal(run('completedSets.size'),0);});
test('preview uses 18-second slideshow; workout uses real time; finish stops',()=>{const {context,run}=env();context.move=require('../data/program.json').templates.minimum.ignition;run('slides=[makeIgnitionSlide(move),makeIgnitionSlide(move)];currentIndex=0;workoutMode=false;resetActiveTimerPhase()');assert.equal(run('slideTotalMs'),18000);run('workoutMode=true;resetActiveTimerPhase()');assert.equal(run('slideTotalMs'),420000);run('slides[0].dataset.sessionEnd="true";isPaused=false;startCurrentTimer(true)');assert.equal(run('isPaused'),true);});

test('preview clock displays prescribed movement time, not slide dwell countdown',()=>{
 const {context,run}=env();context.move=require('../data/program.json').templates.minimum.ignition;
 run('slides=[makeIgnitionSlide(move),makeIgnitionSlide(move)];currentIndex=0;workoutMode=false;isPaused=true;startCurrentTimer(true)');
 assert.equal(run('slideTotalMs'),18000);
 assert.equal(run('activeCountdownOutput.textContent'),'7:00');
 assert.equal(run('activeCountdownLabel.textContent'),'PREVIEW · MOVEMENT TIME');
 run('slideRemainingMs=9000;updateTimerVisual()');
 assert.equal(run('activeCountdownOutput.textContent'),'7:00');
 run('workoutMode=true;startCurrentTimer(true)');
 assert.equal(run('activeCountdownLabel.textContent'),'WORK');
 assert.equal(run('activeCountdownOutput.textContent'),'7:00');
 run('slideRemainingMs=410000;updateTimerVisual()');
 assert.equal(run('activeCountdownOutput.textContent'),'6:50');
});
test('unilateral preview clock shows the prescribed duration of one side',()=>{
 const {context,run}=env();context.move=require('../data/program.json').templates['strength-a'].deposits[0].exercises[0];
 run('slides=[makeExerciseSlide(move,{label:"A",rounds:3},1),makeExerciseSlide(move,{label:"A",rounds:3},2)];currentIndex=0;workoutMode=false;isPaused=true;startCurrentTimer(true)');
 assert.equal(run('activeCountdownOutput.textContent'),'0:15');
 assert.equal(run('activeCountdownLabel.textContent'),'PREVIEW · MOVEMENT TIME');
});
