const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
function slice(begin,end){
  const i=html.indexOf(begin),j=html.indexOf(end,i+begin.length);
  assert(i>=0&&j>i,'Expected code segment: '+begin);
  return html.slice(i,j);
}
const sourceStarter=slice('const starter=','const FEED_PATCHES=');
const sourcePatches=slice('const FEED_PATCHES=','const AUTO_SKILL_CATALOG=');
const migration=slice('function mergeBossFeedPatch(','let ornaCatalogs=');
const currentRevision=Number(html.match(/const DATA_FEED_REVISION=(\d+);/)?.[1]);
assert(currentRevision>=31,'Raid corrections require feed revision 31 or later');
const scenario=new Function(`
  const DATA_FEED_REVISION=${currentRevision};
  ${sourceStarter}
  ${sourcePatches}
  const CORE_KEYS=['hp','mana','att','mag','def','res','dex'];
  const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  let k=0;const uid=kind=>kind+'_test_'+(++k);
  const blankStats=()=>({hp:0,mana:0,att:0,mag:0,def:0,res:0,dex:0,ward:0});
  const initializeCoreHistory=()=>{},updateCoreForLevel=()=>{};
  const M1_SOURCE='test';const publishedSpellM1=()=>null;
  ${migration}
  return {starter,FEED_PATCHES,applyFeedUpdates};
`)();
const {starter,FEED_PATCHES,applyFeedUpdates}=scenario;
const find=(db,id,name)=>db.bosses.find(b=>b.id===id)?.skills.find(s=>s.name===name);
const expectations=[
 ['b_first_horseman','Earthstrike','ATT','https://playorna.com/codex/spells/earthstrike/'],
 ['b_first_horseman','Darkstrike','ATT','https://playorna.com/codex/spells/darkstrike/'],
 ['b_first_horseman',"World's End",'ATT','https://playorna.com/codex/spells/worlds-end/'],
 ['b_fey_gazer','Arcane Strikes','ATT','https://playorna.com/codex/spells/arcane-strikes/'],
 ['b_last_titan','Catastrophe','ATT','https://playorna.com/codex/spells/catastrophe/'],
 ['b_apollyon','Arcana II','HYBRID','https://playorna.com/codex/spells/arcana-ii/']
];
const corrections=FEED_PATCHES.filter(p=>p.revision===31&&p.kind==='bossMoveCorrection');
assert.equal(corrections.length,expectations.length);
for(const [id,name,type,url] of expectations){
 const patch=corrections.find(p=>p.id===id&&p.value.name===name);
 assert(patch,'Expected targeted correction '+id+'/'+name);
 assert.equal(patch.value.type,type);
 assert.equal(patch.value.url,url,'Record verified public Codex page');
 assert(patch.value.evidence,'Source/evidence required');
}

const fresh=applyFeedUpdates(starter());
assert.equal(fresh.meta.feedRevision,currentRevision);
for(const [id,name,type] of expectations)assert.equal(find(fresh,id,name)?.type,type);
assert.equal(find(fresh,'b_last_titan','Catastrophe').m1,null,'Unverified M1 must be suppressed');
assert.equal(find(fresh,'b_last_titan','Catastrophe').element,'','Non-Codex Arcane element must be removed');
assert.equal(find(fresh,'b_first_horseman','Faith').type,'MAG');
assert.equal(find(fresh,'b_first_horseman','Quake II').type,'MAG');
assert.equal(find(fresh,'b_fey_gazer','Fey Frost III').type,'MAG');
assert.equal(find(fresh,'b_last_titan','Quake').type,'MAG');
const snapshot=JSON.stringify(fresh);
applyFeedUpdates(fresh);
assert.equal(JSON.stringify(fresh),snapshot,'Completed migration must be idempotent');

const clone=x=>JSON.parse(JSON.stringify(x));
const old=clone(fresh);
old.meta.feedRevision=30;
for(const [id,name]of expectations)find(old,id,name).type='MAG';
const catastrophe=find(old,'b_last_titan','Catastrophe');
catastrophe.m1=2;catastrophe.element='Arcane';
applyFeedUpdates(old);
for(const [id,name,type] of expectations)assert.equal(find(old,id,name).type,type);
assert.equal(find(old,'b_last_titan','Catastrophe').m1,null);
assert.equal(find(old,'b_last_titan','Catastrophe').element,'');
assert.equal(old.meta.feedRevision,currentRevision);
const oneReload=JSON.stringify(old);applyFeedUpdates(old);assert.equal(JSON.stringify(old),oneReload);

const manual=clone(old);
manual.meta.feedRevision=30;
find(manual,'b_first_horseman','Earthstrike').type='UNKNOWN';
find(manual,'b_first_horseman','Darkstrike').type='MAG';
const move=find(manual,'b_last_titan','Catastrophe');
move.type='MAG';move.m1=3;move.element='Dark';
applyFeedUpdates(manual);
assert.equal(find(manual,'b_first_horseman','Earthstrike').type,'UNKNOWN',
  'Manual attack class must be respected');
assert.equal(find(manual,'b_first_horseman','Darkstrike').type,'ATT');
assert.equal(move.type,'ATT');
assert.equal(move.m1,3,'Manually edited coefficient must remain');
assert.equal(move.element,'Dark','Manually edited element must remain');
assert.equal(manual.meta.feedRevision,currentRevision);

const m1Start=html.indexOf('function unavailableIncomingReason(');
const m1End=html.indexOf('function outgoingElementNote(',m1Start);
assert(m1Start>=0&&m1End>m1Start);
const calculate=new Function('move','boss','stats',`
  const n=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
  const normalizeElement=x=>String(x||'');
  const loadoutElementProtections=()=>[];
  const factionElement=()=>null;
  const incomingElementNote=()=>'-';
  ${html.slice(m1Start,m1End)}
  return {outcome:incomingRange(move,stats,boss,{},{}),
    reason:unavailableIncomingReason(move,boss)};
`);
const boss={att:800,mag:1000},stats={def:100,res:1000};
const physical=calculate({name:'Darkstrike',type:'ATT',m1:1,pmin:1000,pmax:1000,
  hits:1,element:'Dark'},boss,stats);
const magic=calculate({name:'Faith',type:'MAG',m1:1,pmin:1000,pmax:1000,
  hits:1,element:'Holy'},boss,stats);
assert(physical.outcome.min>magic.outcome.min,
  'Physical move must use boss ATT against player DEF (not MAG/RES)');
const hybrid=calculate({name:'Arcana II',type:'HYBRID',m1:null,pmin:1300,pmax:1300,
  hits:1,element:'Arcane'},boss,stats);
assert.equal(hybrid.outcome,null,'Uncalibrated hybrid must not make a numeric prediction');
assert.match(hybrid.reason,/Uses higher ATT or MAG/);
const noCoefficient=calculate(find(fresh,'b_last_titan','Catastrophe'),
  {att:572,mag:488},stats);
assert.equal(noCoefficient.outcome,null,'No invented Titan Catastrophe damage estimate');

console.log('PASS: six Codex-backed raid action corrections, original data preservation, migration idempotence, ATT/DEF behavior and hybrid uncertainty');
