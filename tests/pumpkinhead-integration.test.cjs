const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/orna-catalogs.json'),'utf8'));
function segment(begin,end){
  const a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);
  assert(a>=0&&b>a,'Missing source section '+begin);
  return html.slice(a,b);
}
assert.match(html,/const KEY='ornaRaidLab_v02'/);
assert.match(html,/\\$\\{bossLootMarkup\\(boss\\)\\}/);
new Function(segment('<script>','</script>').replace(/^<script>/,''));

const patches=new Function(segment('const FEED_PATCHES=[','const AUTO_SKILL_CATALOG=')+';return FEED_PATCHES;')();
const current=Math.max(...patches.map(p=>p.revision));
assert.equal(Number(html.match(/const DATA_FEED_REVISION=(\\d+)/)?.[1]),current);
const bossBase=patches.find(p=>p.kind==='boss'&&p.id==='b_pumpkinhead'&&p.revision===24).value;
const boss={id:'b_pumpkinhead',name:'Pumpkinhead',tier:8,...JSON.parse(JSON.stringify(bossBase))};
for(const p of patches.filter(p=>p.kind==='boss'&&p.id==='b_pumpkinhead'&&p.revision>24))
  Object.assign(boss,JSON.parse(JSON.stringify(p.value)));
const correction=patches.find(p=>p.kind==='bossMoveCorrection'&&p.id==='b_pumpkinhead'&&p.revision===34);
const blast=boss.skills.find(s=>s.name==='Blast III');
assert(blast&&correction);
Object.assign(blast,{element:correction.value.element,m1:correction.value.m1,...correction.value.fields});
assert.equal(boss.statusImmunities.length,20);
assert.equal(boss.skills.length,12);
assert.equal(boss.drops.length,11);
assert.equal(boss.minions[0].name,'Pumpkin Spider');
assert.equal(blast.element,'Non-elemental');
assert.equal(blast.m1,2);

const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const loot=new Function('esc',segment('function bossLootMarkup(','function updateRaidBossProfile(')+';return bossLootMarkup;')(esc);
const markup=loot(boss);
assert.match(markup,/Drops \\(11\\)/);
assert.match(markup,/Hallowed Witch&#39;s Hat|Hallowed Witch's Hat/);
assert.match(markup,/Pumpkin Spider/);
assert.match(markup,/The Hallowed/);
assert.equal(loot({}),'');

const norm=x=>String(x||'').trim().toLowerCase().replace(/\\s+/g,' ');
const effects=new Function('ornaCatalogs','abilityKey','parsedCauses','normalizedEffect','codexEffectLabel',
  segment('function bossStatusEffects(','function immunityGear(')+';return bossStatusEffects;')(
  null,x=>norm(x).replace(/[^a-z0-9]+/g,''),()=>[],norm,x=>String(x||'')
);
const found=effects(boss);
assert(found.some(e=>e.code==='MAG d'&&e.skills.some(s=>s.name==='Blast III'&&s.chance==='10%')));
assert(found.some(e=>e.code==='ATT d'&&e.skills.some(s=>s.name==='Blast III'&&s.chance==='10%')));
assert(!found.some(e=>e.label==='Wrong'));
assert.match(html,/skill\\.url\\?/);

const catalogBlast=catalog.abilities.find(x=>x.id==='blast-iii');
assert(catalogBlast);
assert.equal(catalogBlast.element,'Non-elemental');
assert.equal(catalogBlast.m1,2);
assert.equal(catalogBlast.mana,120);
assert.equal(catalogBlast.warmup,1);
assert.equal(catalogBlast.turns,2);
assert.equal(catalogBlast.statusEffects.length,2);
const model=new Function('publishedSpellM1','M1_SOURCE',
  segment('function catalogSpellModel(','function targetDefenseForSpell(')+';return catalogSpellModel;')(
  name=>name==='Bolt'?1:null,'Community table'
);
assert.equal(model(catalogBlast).m1,2);
assert.match(model(catalogBlast).m1Source,/In-game Orna Codex/);
assert.equal(model({name:'Bolt'}).m1,1);
assert.match(html,/m1:model\\.m1\\?\\?''/);
console.log('PASS: Pumpkinhead drops, minion, verified status effects, Blast III catalog and legacy M1');
