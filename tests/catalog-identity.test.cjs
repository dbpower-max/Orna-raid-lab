const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const start=html.indexOf('function spellFromCatalog(');
const end=html.indexOf('function mergeBossFeedPatch(',start);
assert(start>=0&&end>start,'Automatic class spell logic not found');
const region=html.slice(start,end);

function runScenario(initialSpells=[]){
  const run=new Function('initial',`
    const DEFAULT_CLASS_IDS=[],AUTO_SKILL_CATALOG={},M1_SOURCE='test';
    const n=(v,d=0)=>Number(v)||d;
    const abilityKey=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
    const publishedSpellM1=()=>null,catalogSpellModel=()=>({m1:null});
    const characterTier=()=>7;
    let uidCount=0;const uid=()=>String(++uidCount);
    let state,ornaCatalogs;
    ${region}
    ornaCatalogs={abilities:[
      {id:'haste',name:'Haste',type:'Buff',stat:'NONE'},
      {id:'haste-2',name:'Haste+',type:'Buff',stat:'NONE'},
      {id:'poisonstrike',name:'Poisonstrike',type:'Skill',stat:'ATT',pmin:1100,pmax:1100},
      {id:'poisonstrike-2',name:'Poisonstrike',type:'Skill',stat:'ATT',pmin:1100,pmax:1100},
      {id:'multifrost',name:'Multi-frost',type:'Spell',stat:'MAG',pmin:700,pmax:1200}
    ],classes:[
      {id:'one',name:'First class',skillIds:['haste','poisonstrike','multifrost']},
      {id:'two',name:'Second class',skillIds:['haste-2','poisonstrike-2']}
    ]};
    state={character:{level:180,unlockedClassIds:['one','two']},spells:JSON.parse(initial)};
    syncAutomaticSpells();
    const first=JSON.stringify(state.spells);
    syncAutomaticSpells();
    return {spells:state.spells,stable:JSON.stringify(state.spells)===first};
  `);
  return run(JSON.stringify(initialSpells));
}

const fresh=runScenario();
assert.equal(fresh.spells.length,5);
assert.equal(new Set(fresh.spells.map(s=>s.catalogId)).size,5);
assert.equal(fresh.spells.find(s=>s.catalogId==='haste').name,'Haste');
assert.equal(fresh.spells.find(s=>s.catalogId==='haste-2').name,'Haste+');
assert.equal(fresh.spells.filter(s=>s.name==='Poisonstrike').length,2);
assert(fresh.stable,'Repeating class synchronization must be idempotent');

const existing=runScenario([{id:'manual',name:'Multi-frost',stat:'MAG',tier:6}]);
assert.equal(existing.spells.length,5);
assert.equal(existing.spells.find(s=>s.id==='manual').catalogId,'multifrost',
  'Unambiguous legacy name may be matched to its catalog record');
assert(existing.stable);

const ambiguous=runScenario([{id:'manual-haste',name:'Haste',stat:'NONE'}]);
assert.equal(ambiguous.spells.length,6,
  'Ambiguous unlinked name must not silently be assigned to Haste or Haste+');
assert.equal(ambiguous.spells.find(s=>s.id==='manual-haste').catalogId,undefined);
console.log('PASS: catalog ID is stable identity; Haste/Haste+, duplicate Poisonstrike, and safe legacy matching');
