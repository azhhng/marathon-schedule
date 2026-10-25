const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
function loadProgram(saved = {}) {
  const elements = {}, events = {}, writes = [];
  const context = {
    Intl, Date, JSON, Number, Math, Set, Object, Array, String, setTimeout, clearTimeout,
    localStorage: {getItem: () => JSON.stringify(saved), setItem: (...args) => writes.push(args)},
    document: {
      getElementById: id => elements[id] ??= {value:'', innerHTML:'', style:{}, close(){}, showModal(){}},
      querySelectorAll: () => [],
      addEventListener: (type, fn) => (events[type] ??= []).push(fn)
    },
    location: {hash:'#overview'}, window:{addEventListener(){}, scrollTo(){}}
  };
  vm.createContext(context);
  vm.runInContext(read('docs/fueling.js') + '\n' + read('docs/app.js') + `
    this.api = {weeks, phases, dateFor, addDays, runwalk, chartKmMax, dayList, weekNote,
      weekVolume, weekBadge, strengthFor, sessionExtras, recoveryOptions, plan, overview,
      fueling, fuelState, calculateFuel, fuelPackResult, getLogs:()=>logs,
      selectWeek(n){selected=n}};`, context);
  return {...context.api, elements, events, writes};
}

test('all 51 Monday–Sunday weeks and five phases lead to the supplied race date', () => {
  const m = loadProgram();
  assert.equal(m.weeks.length, 51);
  m.weeks.forEach((w, i) => {
    assert.equal(w.start, m.addDays('2026-10-26', i*7));
    assert.equal(new Date(w.start+'T12:00:00Z').getUTCDay(), 1);
    assert.equal(m.phases.filter(p=>i>=p.start&&i<=p.end).length, 1);
    const days = w.runs.map(r=>r.day);
    assert.equal(new Set(days).size, days.length);
    assert(days.every(d=>d>=0&&d<=6));
  });
  assert.equal(m.dateFor(m.weeks[50],m.weeks[50].runs.at(-1)), '2027-10-17');
});

test('run/walk totals, continuous bridge, and 3 → 4 → 5 frequency are consistent', () => {
  const m=loadProgram();
  assert.equal(m.weeks[0].runs[0].minutes,30);
  assert.equal(m.weeks[0].minutes,90);
  assert.equal(m.runwalk[9].r,15);
  for(const [index,minutes] of [[10,20],[11,25],[12,30]])
    assert(m.weeks[index].runs[0].detail.includes(minutes+' min'));
  for(let i=0;i<14;i++)assert.equal(m.weeks[i].runs.length,3);
  for(let i=14;i<35;i++)assert.equal(m.weeks[i].runs.length,4);
  for(let i=35;i<50;i++)assert.equal(m.weeks[i].runs.length,5);
  assert.equal(m.weeks[35].start,'2027-06-28');
  assert(m.weeks[35].recovery);
  assert(m.weekNote(m.weeks[14]).includes('four-run'));
  assert(m.weekNote(m.weeks[35]).includes('five-run'));
});

test('weekly distances add up; peak is 70 km with a provisional 35 km Sunday', () => {
  const m=loadProgram();
  for(const w of m.weeks.filter(w=>w.total!==null))
    assert(Math.abs(w.total-w.runs.reduce((s,r)=>s+r.km,0))<1e-8);
  assert.equal(m.weeks[31].total,38);
  assert.equal(m.weeks[32].total,40);
  assert.equal(Math.max(...m.weeks.map(w=>w.trainingKm||0)),70);
  const peak=m.weeks[47];
  assert.equal(peak.start,'2027-09-20');
  assert.equal(peak.runs.map(r=>r.km).join(','),'9,14,8,4,35');
  assert.equal(peak.runs.map(r=>r.day).join(','),'1,2,3,5,6');
  assert.equal(m.dateFor(peak,peak.runs.at(-1)),'2027-09-26');
  assert(peak.runs.at(-1).detail.includes('4 hours 23 minutes'));
  assert(m.weekNote(peak).includes('not a compulsory test'));
  assert.equal(m.chartKmMax,70);
});

test('checkpoint sessions replace Sunday runs and retain their correct dates', () => {
  const m=loadProgram();
  for(const [i,date,km] of [[27,'2027-05-09',10],[36,'2027-07-11',21.1]]){
    const w=m.weeks[i],run=w.runs.at(-1);
    assert.equal(m.dateFor(w,run),date);
    assert.equal(run.km,km);
    assert.equal(w.runs.filter(r=>r.day===6).length,1);
    assert(w.checkpoint);
  }
});

test('three optional pace practices occur only in cutbacks and inside Wednesday distance', () => {
  const m=loadProgram(),paceWeeks=m.weeks.filter(w=>w.pace);
  assert.equal(paceWeeks.length,3);
  for(const w of paceWeeks){
    assert(w.recovery);
    assert.equal(w.runs.filter(r=>r.optionalPace).length,1);
    const r=w.runs.find(r=>r.optionalPace);
    assert.equal(r.day,2);
    assert(r.detail.includes('otherwise run the whole distance easy'));
    assert(!m.strengthFor(w,r));
  }
});

test('taper and every race-week summary separate 9 km training from the marathon', () => {
  const m=loadProgram(),race=m.weeks[50];
  assert.equal(m.weeks[48].trainingKm,46);
  assert.equal(m.weeks[49].trainingKm,33);
  assert.equal(race.trainingKm,9);
  assert.equal(race.raceKm,42.195);
  assert.equal(race.total,51.195);
  assert.equal(race.runs.map(r=>r.day).join(','),'1,2,4,6');
  assert.equal(race.runs.filter(r=>r.race).length,1);
  assert.equal(m.weekVolume(race),'9 km training + marathon');
  assert.equal(m.weekBadge(race),'Race week');
  m.selectWeek(50);
  const html=m.plan();
  assert(html.includes('9 km training + marathon'));
  assert(html.includes('9 km training + 42.195 km marathon'));
  assert(!html.includes('51.2 km'));
  assert(m.overview().includes('km before race'));
  assert(m.weekNote(race).includes('No pace practice or strength sessions'));
});

test('strength is phased in after easy runs, reduced during taper, absent on rest/long/race days', () => {
  const m=loadProgram(),count=i=>m.weeks[i].runs.filter(r=>m.strengthFor(m.weeks[i],r)).length;
  assert.equal(count(0),0);
  assert.equal(count(1),1);
  assert.equal(count(2),1);
  assert.equal(count(3),2);
  assert.equal(count(47),2);
  assert.equal(count(48),1);
  assert.equal(count(49),1);
  assert.equal(count(50),0);
  for(const w of m.weeks)for(const r of w.runs)
    if(m.strengthFor(w,r))assert([1,3].includes(r.day));
  assert(!m.recoveryOptions(m.weeks[20]).includes('10–15 min'));
  assert(m.recoveryOptions(m.weeks[20]).includes('Everyday walking counts'));
  const html=m.dayList(m.weeks[3]);
  assert(html.includes('Optional strength'));
  assert(html.includes('Chair squat'));
  assert(!m.dayList(m.weeks[50]).includes('Optional strength'));
});

test('warm-up and distance accounting are explicit; rehearsals open fueling without adding runs', () => {
  const m=loadProgram();
  assert(m.sessionExtras(m.weeks[0],m.weeks[0].runs[0]).includes('already includes'));
  assert(m.sessionExtras(m.weeks[20],m.weeks[20].runs[0]).includes('kilometre target covers the main run/walk section'));
  assert.equal(m.sessionExtras(m.weeks[50],m.weeks[50].runs.at(-1)),'');
  const rehearsal=m.weeks[45];
  assert(m.sessionExtras(rehearsal,rehearsal.runs.at(-1)).includes('data-action="fuel-long"'));
  assert.equal(rehearsal.runs.length,5);
});

test('all weekly views render without modifying existing run logs', () => {
  const saved={'2026-10-27':{title:'Easy run / walk',distance:'2.1',duration:'30',effort:'Comfortable',notes:'Existing entry'}};
  const m=loadProgram(saved);
  for(const w of m.weeks){m.selectWeek(w.index);assert(m.plan().includes('Training plan')||m.plan().includes('training plan'));assert(m.overview().includes('Your week, one step at a time'));}
  assert.equal(JSON.stringify(m.getLogs()),JSON.stringify(saved));
  assert.equal(m.writes.length,0);
});

test('fueling calculator counts drink carbs once and supports all three run contexts', () => {
  const m=loadProgram();
  const a=m.calculateFuel({minutes:120,target:30,portion:26,drink:0});
  assert.equal(a.total,60);assert.equal(a.portions,3);assert.equal(a.packed,78);
  const b=m.calculateFuel({minutes:300,target:60,portion:25,drink:30});
  assert.equal(b.total,300);assert.equal(b.drinkTotal,150);assert.equal(b.portions,6);assert.equal(b.packed,300);
  assert.equal(m.calculateFuel({minutes:120,target:30,portion:26,drink:60}).portions,0);
  for(const mode of ['short','long','race']){m.fuelState.mode=mode;assert(m.fueling().includes('Sources & serving assumptions'));}
  m.fuelState.mode='short';assert(m.fueling().includes('No mid-run carbs'));
  m.fuelState.mode='long';assert(m.fueling().includes('Weekend long run'));
});

test('all browser assets are content-versioned and local preview mirror matches the website', () => {
  const html=read('docs/index.html');
  for(const name of ['app.js','fueling.js','style.css']){
    const digest=crypto.createHash('sha256').update(read('docs/'+name)).digest('hex').slice(0,12);
    assert(html.includes(name+'?v='+digest),name+' cache version is stale');
  }
  if(fs.existsSync(path.join(root,'toronto-2027/dist')))
    for(const name of ['index.html','app.js','fueling.js','style.css'])
      assert.equal(read('docs/'+name),read('toronto-2027/dist/'+name),name+' mirror differs');
});
