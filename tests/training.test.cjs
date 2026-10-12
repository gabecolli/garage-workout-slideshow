const {test}=require('node:test');const assert=require('node:assert/strict');
const engine=require('../training-engine');const p=require('../data/program.json');const rotation=require('../data/rotation-exercises.json');
const make=(f={},date='2026-10-12')=>engine.generate(p,date,{targetDate:date,...f},rotation);
test('seven distinct days, planned duration includes all work and rest but no dummy',()=>{
 const kinds=[];for(let i=12;i<19;i++){let w=make({},`2026-10-${i}`);kinds.push(w.templateId);assert.equal(w.totalSeconds,engine.seconds(w));assert.equal(w.martialSupplement.countsAsWorkout,false);}
 assert.deepEqual(kinds,['strength-a','endurance-a','strength-b','endurance-b','strength-c','boxing','recovery']);
});
test('minimum is exactly 10 minutes; class has no power or lifting',()=>{assert.equal(make({mode:'minimum'}).totalSeconds,600);let w=make({bjjClassToday:true,classRpe:8});assert.equal(w.templateId,'class-day');assert(!w.deposits.some(b=>b.role==='strength'||b.role==='power'));});
test('unknown class intensity is conservative; silence is baseline without progression',()=>{assert.equal(make({bjjClassToday:true}).templateId,'class-day');assert.equal(make().templateId,'strength-a');assert.equal(engine.canProgress([]),false);});
test('yesterday hard class reduces sets and removes explosive work',()=>{const w=make({hardClassPrevious24h:true});assert(!w.deposits.some(b=>b.role==='power'));assert(w.deposits.filter(b=>b.role==='strength').every(b=>b.rounds===2));});
test('dummy lab alone does not reduce physical load',()=>{assert.equal(make({dummyMinutes:30,dummyTheme:'knee-cut'}).totalSeconds,make().totalSeconds);assert.match(make({dummyTheme:'knee-cut'}).martialSupplement.name,/KNEE-CUT/);});
test('boxing replaced if two hard combat sessions already reported',()=>{assert.equal(make({hardCombatSessions7d:2},'2026-10-17').templateId,'endurance-b');});
test('stale feedback and invalid zeros do not alter a future day',()=>{assert.equal(engine.generate(p,'2026-10-12',{targetDate:'2026-10-11',pain:true},rotation).templateId,'strength-a');});
test('pain and low readiness override power, even if full time available',()=>{for(const f of [{pain:true},{energy:'low'}])assert.equal(make(f).templateId,'minimum');});
test('time constraint cannot leave an oversized workout',()=>{for(const mins of [10,15,20,30])assert(make({availableMinutes:mins}).totalSeconds<=mins*60);});
test('rotation preserves strength anchors and changes only intended accessory/power slots',()=>{
 const a=make({},'2026-10-12'),b=make({},'2026-10-26');const ids=w=>w.deposits.filter(b=>b.role==='strength').flatMap(b=>b.exercises.map(e=>e.id));assert.deepEqual(ids(a),ids(b));assert.equal(b.deposits[0].exercises[0].id,'EX-DOPA-0261');});
test('progression needs two confirmed comparable pain-free exposures',()=>{
 const good={confirmed:true,allSetsAtTop:true,pain:false,rir:3,load:50,unit:'lb',setup:'total'};
 assert.equal(engine.canProgress([good,good]),true);
 for(const delta of [{confirmed:false},{pain:true},{load:51},{setup:'per hand'},{rir:0},{allSetsAtTop:false}])assert.equal(engine.canProgress([good,{...good,...delta}]),false);
});
test('struggle feedback keeps movement but reduces demand and blocks progression',()=>{const w=make({struggledExerciseIds:['EX-H001']});const squat=w.deposits.flatMap(b=>b.exercises).find(e=>e.id==='EX-H001');assert.match(squat.home,/reduce load/);});
