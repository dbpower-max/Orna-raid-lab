const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const generator=fs.readFileSync(path.join(__dirname,'../scripts/build-orna-catalogs.mjs'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/orna-catalogs.json'),'utf8'));
function between(src,beg,end){
  const i=src.indexOf(beg),j=src.indexOf(end,i+beg.length);
  assert(i>=0&&j>i,'Missing '+beg);
  return src.slice(i,j);
}
const classify=new Function(between(generator,'function codexDamageStat(', '\nfunction spellRecord(')+'return codexDamageStat')();

const counts={ATT:0,MAG:0,HYBRID:0,COMPOSITE:0,NONE:0};
for(const ability of catalog.abilities){
  const inferred=classify({spell_type:ability.type.toLowerCase()},ability.notes||'',{pmax:ability.pmax});
  assert.equal(ability.stat,inferred,'Generator and bundled catalog disagree for '+ability.id);
  counts[inferred]++;
}
assert.deepEqual(counts,{ATT:244,MAG:308,HYBRID:26,COMPOSITE:13,NONE:414});
const expected=[
 ['earthstrike','ATT'],['darkstrike','ATT'],['arcane-strikes','ATT'],
 ['catastrophe','ATT'],['worlds-end','ATT'],['poisonstrike','ATT'],
 ['faith','MAG'],['nightmare','MAG'],['quake-ii','MAG'],
 ['magic-sword','MAG'],['magic-strikes','MAG'],['arcana-ii','HYBRID'],
 ['arcanus','HYBRID'],['beaststrike','COMPOSITE'],['verse','COMPOSITE']
];
for(const [id,type] of expected){
  assert.equal(catalog.abilities.find(x=>x.id===id)?.stat,type,'Codex category/description mismatch '+id);
}
assert.equal(classify({spell_type:'skill'},'Attack the enemy',{pmax:0}),'NONE');
assert.equal(classify({spell_type:'spell'},'Spell with magic damage',{pmax:1200}),'MAG');
assert.equal(classify({spell_type:'skill'},'Arcane elemental sword hit',{pmax:1200}),'ATT',
  'Elemental damage must not imply magical stat');

// Exercise the exact Raid Analyzer model, not a separate reimplementation.
const model=between(html,'function isDamageAbility(', 'function unavailableIncomingReason(');
const runtime=new Function('ornacatalog',`
  const n=v=>Number(v)||0;
  const normalizeElement=e=>String(e||'');
  const targetDefenseForSpell=s=>s.stat==='ATT'?'DEF':'RES';
  const publishedSpellM1=()=>null,M1_SOURCE='community';
  const abilityKey=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const ornaCatalogs=ornacatalog;
  const effectiveAbilityElement=x=>x.element||'';
  const factionElement=()=>null,bossAffinity=()=> 'normal',affinityMultiplier=()=>1;
  ${model}
  return {modeledSpell,damageRange,unavailableOutgoingReason};
`)({abilities:catalog.abilities});
const boss={def:200,res:1500},stats={att:1200,mag:2000};
const skill={name:'Earthstrike',catalogId:'earthstrike',autoClassManaged:true,
  stat:'MAG',pmin:1100,pmax:1100,hits:1,m1:1,powerModel:'codexTotal'};
const physical=runtime.modeledSpell(skill);
assert.equal(physical.stat,'ATT');
assert.equal(skill.stat,'MAG','Old browser state must not be modified by calculation');
const estimate=runtime.damageRange(physical,stats,boss);
assert(estimate&&estimate.min>0,'Confirmed Skill still estimates against DEF');
const manual=runtime.modeledSpell({...skill,autoClassManaged:false});
assert.equal(manual.stat,'MAG','Manual spell overrides must be respected');

const arcana=runtime.modeledSpell({name:'Arcana II',catalogId:'arcana-ii',
  autoClassManaged:true,stat:'ATT',pmin:1300,pmax:1300,hits:1,m1:1,
  powerModel:'codexTotal'});
assert.equal(arcana.stat,'HYBRID');
assert.equal(runtime.damageRange(arcana,stats,boss),null);
assert.match(runtime.unavailableOutgoingReason(arcana,boss),/higher ATT or MAG/);

const beast=runtime.modeledSpell({name:'Beaststrike',catalogId:'beaststrike',
  autoClassManaged:true,stat:'MAG',pmin:1100,pmax:1100,hits:1,m1:1,
  powerModel:'codexTotal'});
assert.equal(beast.stat,'COMPOSITE');
assert.equal(runtime.damageRange(beast,stats,boss),null);
assert.match(runtime.unavailableOutgoingReason(beast,boss),/composite damage not modeled/);
assert.match(html,/value="HYBRID"/);
assert.match(html,/value="COMPOSITE"/);

console.log('PASS: 1,005 Codex abilities consistent with generator; all special cases and conservative model behavior verified');
