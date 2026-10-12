/* Pure planning rules. No network or private data is stored by this module. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const duration = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const dayName = date => new Intl.DateTimeFormat('en-US', {weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
  function seconds(plan) {
    const movement = e => (e.timeSeconds || 0)+(e.setupSeconds || 0)+(e.restSeconds || 0)+(e.sideMode === 'per-side' ? e.switchSeconds || 0 : 0);
    return (plan.ignition ? movement(plan.ignition) : 0)+plan.deposits.reduce((n,b)=>n+b.exercises.reduce((s,e)=>s+b.rounds*(movement(e)-(e.setupSeconds||0))+(e.setupSeconds||0),0),0);
  }
  function canProgress(exposures) {
    return exposures.length >= 2 && exposures.slice(-2).every(e => e.confirmed === true && e.allSetsAtTop === true && e.pain === false && Number.isFinite(e.rir) && e.rir >= 2 && Number.isFinite(e.load) && e.unit === 'lb' && typeof e.setup === 'string') && exposures.at(-1).load === exposures.at(-2).load && exposures.at(-1).setup === exposures.at(-2).setup;
  }
  function generate(program, date, feedback = {}, rotation = {}) {
    const day = dayName(date);
    let key = program.weeklySchedule[day];
    let note = 'Baseline plan. Tell your coach what you actually completed.';
    // Reports must apply to the target date. Missing facts remain unknown.
    const f = feedback.targetDate === date ? feedback : {};
    const hardClass = f.bjjClassToday === true && (f.classIntensity === 'hard' || (Number.isFinite(f.classRpe) && f.classRpe >= 7));
    const classUnknownIntensity = f.bjjClassToday === true && !f.classIntensity && !Number.isFinite(f.classRpe);
    if (f.pain === true || f.energy === 'low' || (Number.isFinite(f.availableMinutes) && f.availableMinutes <= 10)) {
      key = 'minimum'; note = f.pain === true ? 'Keep only comfortable movement; stop anything painful. Tell your coach where and what hurts.' : 'Short session selected. Resume the normal week when recovered; no catch-up double.';
    } else if (hardClass || classUnknownIntensity || f.mode === 'class-day') {
      key = 'class-day'; note = 'Class is the physical priority. Easy movement is optional; omit extra power, boxing and heavy lifting.';
    } else if (f.mode === 'minimum') { key = 'minimum'; note = 'Ten-minute minimum selected.'; }
    if (key === 'boxing' && Number(f.hardCombatSessions7d) >= 2) { key = 'endurance-b'; note = 'Hard combat sessions already supplied intensity. Steady endurance replaces boxing.'; }
    const plan = clone(program.templates[key]);
    // Two-week rotations replace slots, not anchors or entire sessions.
    const phase = Math.floor((new Date(`${date}T12:00:00Z`) - new Date(`${program.effectiveDate}T12:00:00Z`))/86400000/14) % 2;
    if (phase === 1) {
      for (const b of plan.deposits) for (const e of b.exercises) {
        const next = {'EX-DOPA-0267':'EX-DOPA-0261','EX-FUNC-028':'EX-T013','EX-G020':'EX-FUNC-002'}[e.id];
        if (next && rotation[next]) {
          const replacement = rotation[next];
          e.id = next; e.name = replacement.name; e.media = replacement.media; e.equipment = replacement.equipment;
          if (next === 'EX-FUNC-002') {
            e.reps='TIMED'; e.timeSeconds=40; e.time=duration(40); e.home=e.prescription='40 sec double-kettlebell front-rack carry; light enough to walk tall.';
            delete e.sideMode; delete e.sideCount; delete e.sideSeconds; delete e.sideTime; delete e.switchSeconds;
          } else if (next === 'EX-DOPA-0261') { e.home=e.prescription='3 crisp sweep-single entries/side, light band; controlled reset.'; }
          else { e.home=e.prescription='6 controlled half-kneeling cable chops/side; no trunk collapse.'; e.cue='Rotate under control; keep pelvis steady.'; }
        }
        if (e.id === 'BOX-001') {e.home=e.prescription='2 min at RPE 6–7: jab-cross → slip → angle exit. Rest 1 min.';e.cue='Return to stance after every combination.';}
      }
    }
    const strength = key.startsWith('strength-');
    if (strength && (f.hardClassPrevious24h === true || f.soreness === 'high' || f.energy === 'medium' || (f.bjjClassToday === true && !hardClass))) {
      plan.deposits=plan.deposits.filter(b=>b.role!=='power');
      for (const b of plan.deposits) if(b.role==='strength') b.rounds=Math.max(1,b.rounds-1);
      note='Reduced strength volume today; no power finisher. Keep 3–4 good reps in reserve.';
      for (const b of plan.deposits) { b.effort='Leave 3–4 good reps in reserve. Use less load if needed.'; for(const e of b.exercises) { e.home=e.home.replaceAll('2–3','3–4');e.prescription=e.home; } }
    }
    if (Number.isFinite(f.availableMinutes) && seconds(plan)>f.availableMinutes*60 && key!=='minimum') {
      // Trim optional skill/accessory work first, then one round of strength.
      plan.deposits=plan.deposits.filter(b=>!['skill','accessory'].includes(b.role));
      for(const b of plan.deposits) if(b.role==='strength') b.rounds=Math.min(b.rounds,2);
      if(seconds(plan)>f.availableMinutes*60) return generate(program,date,{...f,mode:'minimum',bjjClassToday:false,pain:false},rotation);
      note='Short version: main work kept; accessories omitted.';
    }
    for (const b of plan.deposits) for (const e of b.exercises) {
      if (Array.isArray(f.struggledExerciseIds) && f.struggledExerciseIds.includes(e.id)) {
        e.home += ' Repeat at the low end of the rep range; reduce load or leverage enough to keep 3 good reps.';
        e.prescription=e.home;
        e.cue='Repeat the movement with clean form; no progression this exposure.';
      }
      const history=f.confirmedExposures?.[e.id];
      if (Array.isArray(history) && history.length) {
        const last=history.at(-1);
        if(last.confirmed===true && Number.isFinite(last.load) && last.unit==='lb' && last.setup) {
          e.lastConfirmedLoadLb=last.load;
          e.home+=` Last confirmed load: ${last.load} lb (${last.setup}).`;
          e.prescription=e.home;
        }
        e.progressionEligible=canProgress(history) && !f.struggledExerciseIds?.includes(e.id) && f.pain!==true && !f.hardClassPrevious24h && !f.bjjClassToday && f.energy!=='medium' && f.energy!=='low' && f.soreness!=='high';
      }
    }
    plan.deposits.forEach((b,i)=>{b.label=String.fromCharCode(65+i);});
    const total=seconds(plan);
    Object.assign(plan,{schemaVersion:4,date,generatedAt:new Date().toISOString(),planId:`F4-${date}-${key}`,programVersion:program.version,totalSeconds:total,
      additionalTitle:'TODAY’S NEXT BLOCKS',emphasis:note,
      levels:{floor:'10:00 · 7 min walk + 3 min mobility',standard:`${duration(total)} · includes setup + rest`,bonus:'Optional brisk walk; dummy lab separate'},
      weekSummary:'Mon strength A · Tue endurance · Wed strength B · Thu endurance · Fri strength C · Sat boxing · Sun recovery',
      martialSupplement:{id:'DUMMY-LAB',name:'DUMMY LAB · SINGLE-LEG STUDY',reps:'3 SLOW/SIDE',timeSeconds:420,time:'7:00',setupSeconds:0,restSeconds:0,timerMode:'exercise',category:'martial',countsAsWorkout:false,home:program.dummyLab.dailySteps[day],away:'Visualize the same positions and write one question.',cue:'One question: where do posture or connection change? Pause and inspect.',text:'7 min slow technical study. Record one discovery. Not conditioning.'}});
    if (typeof f.dummyTheme==='string' && f.dummyTheme.trim()) {
      plan.martialSupplement.name='DUMMY LAB · '+f.dummyTheme.trim().slice(0,70).toUpperCase();
      plan.martialSupplement.home='7 min slow rehearsal of one familiar sequence from this theme. Pause at the difficult position; record one discovery.';
      if(typeof f.dummyQuestion==='string') plan.martialSupplement.cue=f.dummyQuestion.slice(0,180);
    }
    return plan;
  }
  const api = {generate,seconds,canProgress,dayName};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.FighterEngine=api;
})(typeof window!=='undefined' ? window : globalThis);
