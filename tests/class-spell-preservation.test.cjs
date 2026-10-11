const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
function section(begin,end){
  const a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);
  assert(a>=0&&b>a,'Missing expected source section '+begin);
  return html.slice(a,b);
}
const synchronizer=section('function spellFromCatalog(','// Preserve local boss edits');
const run=new Function('scenario',`
  const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const abilityKey=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  let id=0;const uid=()=>String(++id);
  const DEFAULT_CLASS_IDS=[],AUTO_SKILL_CATALOG={},M1_SOURCE='community';
  const catalogSpellModel=()=>({m1:null,m1Source:'',powerModel:'codexTotal'});
  const characterTier=()=>7;
  let state,ornaCatalogs;
  ${synchronizer}
  const ability={id:'frost',name:'Frost',tier:2,type:'Spell',element:'Water',
    mana:10,turns:1,hits:1,pmin:1000,pmax:1000,stat:'MAG',notes:'Ice hit',image:''};
  ornaCatalogs={abilities:[ability],classes:[{id:'frostclass',name:'Frost Mage',skillIds:['frost']}]};
  state={character:{level:180,unlockedClassIds:['frostclass']},spells:[],spellLoadouts:[]};
  syncAutomaticSpells();
  const original=state.spells[0];
  if(scenario==='edited')original.notes='Personal note';
  if(scenario==='equipped')state.spellLoadouts.push({id:'sl',spellIds:[original.id]});
  if(scenario==='manual-coefficient'){original.m1=3;original.m1Source='Manual'}
  if(scenario==='unknown')ornaCatalogs.abilities=[];
  state.character.unlockedClassIds=[];
  syncAutomaticSpells();
  return {state,original};
`);

let result=run('unused');
assert.equal(result.state.spells.length,0,'Untouched unused auto entries can be removed');
result=run('edited');
assert.equal(result.state.spells.length,1);
assert.equal(result.state.spells[0].notes,'Personal note');
assert.equal(result.state.spells[0].autoClassManaged,false);
result=run('equipped');
assert.equal(result.state.spells.length,1,'Equipped spell cannot disappear from its loadout');
assert.equal(result.state.spells[0].autoClassManaged,false);
result=run('manual-coefficient');
assert.equal(result.state.spells.length,1);
assert.equal(result.state.spells[0].m1,3);
result=run('unknown');
assert.equal(result.state.spells.length,1,'Unrecognized catalog ID cannot cause deletion');

// Explicitly editing an automatic class spell must detach it from automatic management.
const submitSource=section("$('#spellForm').addEventListener('submit',e=>{","\n\nconst SLOT_AREA=");
const prior={id:'saved',name:'Frost',tier:2,type:'Spell',element:'Water',mana:10,
  turns:1,hits:1,pmin:1000,pmax:1000,m1:null,stat:'MAG',
  notes:'Ice hit',source:'Automatic class unlock',autoClassManaged:true,autoBaseline:false,
  classUnlocked:true,classSourceIds:['frostclass'],classSourceNames:['Frost Mage'],catalogId:'frost'};
const inputs={};
for(const [key,value] of Object.entries(prior))inputs['#s_'+key]={value:String(value??'')};
inputs['#s_target']={value:'AUTO'};
inputs['#s_notes']={value:'Edited in form'};
inputs['#spellDialog']={close(){}};
let submit=null;
inputs['#spellForm']={addEventListener(name,fn){if(name==='submit')submit=fn}};
const state={spells:[{...prior}]};
new Function('$','spellBy','uid','selectedSpellCatalog','publishedSpellM1','M1_SOURCE',
  'n','spellImageTemp','state','renderAll',submitSource)(
  key=>inputs[key]||{value:''},
  id=>state.spells.find(x=>x.id===id),
  ()=> 'newid',null,()=>null,'community',
  v=>Number(v)||0,'',state,()=>{}
);
assert.equal(typeof submit,'function');
submit({preventDefault(){}});
assert.equal(state.spells[0].notes,'Edited in form');
assert.equal(state.spells[0].autoClassManaged,false);
assert.equal(state.spells[0].autoBaseline,false);
assert.equal(state.spells[0].id,'saved');
console.log('PASS: retain edited/equipped/manual class spells, discard untouched entries, preserve form edits');
