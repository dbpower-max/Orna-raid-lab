const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const begin=html.indexOf('function loadoutSignature(');
const end=html.indexOf('function loadoutNeedsMeasurement(',begin);
assert(begin>=0&&end>begin,'Snapshot signature functions not found');
const actual=html.slice(begin,end);

function fixture(){
  const state={
    character:{level:160,className:'Spellweaver',specialization:'Beastmaster',
      beastMode:false,core:{hp:120,mana:100,att:100,mag:300,def:100,res:100,dex:100}},
    gear:[{
      id:'staff',name:'Legendary Staff',slot:'Weapon',tier:7,level:5,
      qualityPct:160,qualityPctKnown:true,qualityLabelOverride:'Legendary',
      catalogId:'staff-codex',catalogCorrection:true,isBoss:false,
      base:{mag:100},observedByLevel:{5:{mag:200}},adornments:[],element:'Fire'
    }],
    combatSnapshots:[]
  };
  const catalog={id:'staff-codex',base:{mag:100},isBoss:false};
  const setup=new Function('state','catalog',`
    const SLOTS=['Weapon','Off-hand','Head','Torso','Legs','Accessory 1','Accessory 2','Amity'];
    const CORE_KEYS=['hp','mana','att','mag','def','res','dex'];
    const n=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
    const gearBy=id=>state.gear.find(x=>x.id===id);
    const catalogGearFor=item=>item.catalogId==='staff-codex'?catalog:null;
    ${actual}
    return {loadoutSignature,measuredSnapshotForLoadout};
  `);
  return {state,catalog,...setup(state,catalog),load:{id:'gear-loadout',slots:{Weapon:'staff'}}};
}
const t=fixture(),signature=t.loadoutSignature(t.load);
assert(signature.startsWith('[2,'),'Versioned signature prevents legacy snapshot trust');
const screenshot={
  id:'historic1',gearLoadoutId:t.load.id,gearSignature:signature,
  level:160,className:'Spellweaver',specialization:'Beastmaster',
  stats:{hp:120,mana:100,att:100,def:100,mag:900,res:100,dex:100,ward:110}
};
t.state.combatSnapshots.push(screenshot);
assert.strictEqual(t.measuredSnapshotForLoadout(t.load),screenshot,'Matching status reading overrides estimates');
function changed(change,restore,name){
  const before=t.loadoutSignature(t.load);
  change();
  assert.notEqual(t.loadoutSignature(t.load),before,name+' should invalidate signature');
  assert.equal(t.measuredSnapshotForLoadout(t.load),null,name+' must not reuse old measurement');
  restore();
  assert.strictEqual(t.measuredSnapshotForLoadout(t.load),screenshot,name+' should restore matching measurement');
}
const item=t.state.gear[0];
changed(()=>item.base.mag=150,()=>item.base.mag=100,'manual base stat');
changed(()=>item.observedByLevel[5].mag=270,()=>item.observedByLevel[5].mag=200,'reviewed screenshot stat');
changed(()=>item.catalogCorrection=false,()=>item.catalogCorrection=true,'catalog correction');
changed(()=>item.qualityPct=170,()=>item.qualityPct=160,'item quality percent');
changed(()=>item.qualityLabelOverride='Ornate',()=>item.qualityLabelOverride='Legendary','quality label');
changed(()=>item.adornments.push({stats:{mag:70}}),()=>item.adornments.pop(),'adornment stats');
changed(()=>item.level=6,()=>item.level=5,'item level');
changed(()=>t.catalog.base.mag=200,()=>t.catalog.base.mag=100,'catalog stats');
changed(()=>t.catalog.isBoss=true,()=>t.catalog.isBoss=false,'catalog boss scaling');
changed(()=>t.load.slots.Head='staff',()=>delete t.load.slots.Head,'equipped slot');

t.state.gear.push({id:'unrelated',name:'Hat',slot:'Head',level:1,base:{def:10}});
assert.strictEqual(t.measuredSnapshotForLoadout(t.load),screenshot,
  'Changes to unequipped inventory must not invalidate readings');
t.state.character.beastMode=true;
assert.strictEqual(t.measuredSnapshotForLoadout(t.load),screenshot,
  'Beast Mode toggles after loadout measurement; snapshot remains available');
t.state.character.beastMode=false;

const legacy=JSON.stringify(
  ['Weapon','Off-hand','Head','Torso','Legs','Accessory 1','Accessory 2','Amity'].map(slot=>{
    const a=t.state.gear.find(x=>x.id===t.load.slots?.[slot]);
    return a?[slot,a.id,a.level,a.qualityPct,a.observedLevel,a.observedStats,
      a.adornments,a.element,a.attackElement,a.resistElements]:[slot,''];
  })
);
t.state.combatSnapshots=[{...screenshot,id:'legacy',gearSignature:legacy}];
assert.equal(t.measuredSnapshotForLoadout(t.load),null,
  'Legacy snapshots lacking newer gear input fingerprints are historical only');
assert.equal(t.state.combatSnapshots[0].gearSignature,legacy,
  'Historical snapshot must never be altered by invalidation');
t.state.combatSnapshots.push(screenshot);
assert.strictEqual(t.measuredSnapshotForLoadout(t.load),screenshot,
  'Newly confirmed snapshot should take precedence without deleting history');

// Check the real characterTotals path: stale equipped snapshots fall back to
// stored unequipped core + current gear; no new unequipped reading is demanded.
const from=html.indexOf('function characterTotals(');
const to=html.indexOf('const BEAST_STATS=',from);
const formula=html.slice(from,to);
const simulate=new Function('data','snapshotFor',`
  let state=data;
  const n=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
  const blankStats=()=>({hp:0,mana:0,att:0,def:0,mag:0,res:0,dex:0,ward:0});
  const measuredUnequippedSnapshot=()=>null;
  const measuredSnapshotForLoadout=snapshotFor;
  const gearTotals=()=>({stats:{hp:0,mana:0,att:0,def:0,mag:data.gear[0].base.mag,
    res:0,dex:0,ward:0},wardFactors:[1]});
  const applyBeastMode=(stats)=>({...stats});
  ${formula}
  return characterTotals({id:'gear-loadout'});
`);
t.state.combatSnapshots=[{...screenshot,id:'legacy',gearSignature:legacy}];
t.state.gear[0].base.mag=175;
const calculated=simulate(t.state,()=>t.measuredSnapshotForLoadout(t.load));
assert.equal(calculated.mag,475,'Stale screenshot must not override updated baseline + equipment');
assert.equal(t.state.combatSnapshots[0].id,'legacy','Historical measurement should remain intact');
console.log('PASS: snapshot signature tracks gear/catalog edits; historical records retained; current stats recalculate from baseline');
