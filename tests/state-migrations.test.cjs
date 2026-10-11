const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

// Run the ACTUAL browser migration code in isolation; never load personal browser data.
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const start=(text,needle)=>{const i=text.indexOf(needle);assert(i>=0,`Missing source anchor: ${needle}`);return i};
const starter=html.slice(start(html,'const starter='),start(html,'const FEED_PATCHES='));
const patches=html.slice(start(html,'const FEED_PATCHES='),start(html,'const AUTO_SKILL_CATALOG='));
const migration=html.slice(start(html,'function mergeBossFeedPatch('),start(html,'let ornaCatalogs='));
const revision=Number(html.match(/const DATA_FEED_REVISION=(\d+);/)?.[1]);
assert(Number.isSafeInteger(revision)&&revision>=30,'Feed revision must not fall below patch 30');

function model(currentRevision=revision,maximumPatchRevision=Infinity){
  const migrationCode=maximumPatchRevision===Infinity?migration:
    migration.replace('FEED_PATCHES.filter(p=>p.revision>applied)',
      `FEED_PATCHES.filter(p=>p.revision>applied&&p.revision<=${maximumPatchRevision})`);
  return new Function(`
    const DATA_FEED_REVISION=${currentRevision};
    ${starter}
    ${patches}
    const CORE_KEYS=['hp','mana','att','mag','def','res','dex'];
    const n=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
    let counter=0;const uid=p=>p+'_test_'+(++counter);
    const blankStats=()=>({hp:0,mana:0,att:0,mag:0,def:0,res:0,dex:0,ward:0});
    const initializeCoreHistory=()=>{};const updateCoreForLevel=()=>{};
    const M1_SOURCE='test';const publishedSpellM1=()=>null;
    ${migrationCode}
    return {starter,FEED_PATCHES,applyFeedUpdates};
  `)();
}
const live=model(),old=model(26,26),clone=x=>JSON.parse(JSON.stringify(x));
const get=(db,id)=>db.bosses.find(b=>b.id===id);
assert.equal(revision,Math.max(...live.FEED_PATCHES.map(p=>p.revision)),
  'Version constant must match latest feed patch');

// New browser storage: complete canonical migration once, with stable second load.
{
  const db=live.applyFeedUpdates(live.starter());
  assert.equal(db.meta.feedRevision,revision);
  assert.equal(db.bosses.length,13);
  assert.equal(get(db,'b_achlys').att,712);
  assert.equal(get(db,'b_achlys').res,515);
  assert.equal(get(db,'b_last_titan').att,572);
  assert.equal(get(db,'b_last_titan').mag,488);
  assert.equal(get(db,'b_last_titan').res,359);
  assert.equal(get(db,'b_first_horseman').mag,null);
  const once=JSON.stringify(db);live.applyFeedUpdates(db);
  assert.equal(JSON.stringify(db),once);
}

// Existing revision-26 storage, before the later boss updates:
// untouched defaults upgrade; edited values, explicit nulls, and custom notes remain.
{
  const db=clone(old.applyFeedUpdates(old.starter()));
  assert.equal(get(db,'b_last_titan').att,575);
  assert.equal(get(db,'b_last_titan').mag,490);
  assert.equal(get(db,'b_last_titan').res,360);
  get(db,'b_achlys').att=999;
  get(db,'b_achlys').mag=null;
  get(db,'b_achlys').notes='Personal calibration note';
  get(db,'b_last_titan').res=444;
  db.bosses.push({id:'b_first_horseman',name:'First Horseman',mag:777,def:null,notes:'Personal notes'});
  db.gear.push({id:'private-gear',slot:'Weapon',name:'My test item',adornments:[]});
  const gearBefore=JSON.stringify(db.gear);
  live.applyFeedUpdates(db);
  assert.equal(db.meta.feedRevision,revision);
  assert.equal(get(db,'b_achlys').att,999);
  assert.equal(get(db,'b_achlys').mag,null);
  assert.equal(get(db,'b_achlys').res,515);
  assert.equal(get(db,'b_achlys').notes,'Personal calibration note');
  assert.equal(get(db,'b_last_titan').att,572);
  assert.equal(get(db,'b_last_titan').mag,488);
  assert.equal(get(db,'b_last_titan').res,444);
  assert.equal(get(db,'b_first_horseman').mag,777);
  assert.equal(get(db,'b_first_horseman').def,null);
  assert.equal(get(db,'b_first_horseman').notes,'Personal notes');
  assert.equal(get(db,'b_first_horseman').hp,1120500);
  assert.equal(JSON.stringify(db.gear),gearBefore);
  const once=JSON.stringify(db);
  live.applyFeedUpdates(db);live.applyFeedUpdates(db);
  assert.equal(JSON.stringify(db),once,'Repeated reload must not reapply boss patches');
  get(db,'b_first_horseman').mag=899;
  live.applyFeedUpdates(db);
  assert.equal(get(db,'b_first_horseman').mag,899,'Post-upgrade edits must persist');
}

// Previously affected users whose revision remained 26 despite having
// already received patches 27-30: no replay may discard their edits.
{
  const db=live.applyFeedUpdates(live.starter());
  db.meta.feedRevision=26;
  get(db,'b_achlys').att=999;
  get(db,'b_first_horseman').mag=777;
  live.applyFeedUpdates(db);
  assert.equal(get(db,'b_achlys').att,999);
  assert.equal(get(db,'b_first_horseman').mag,777);
}

// Already-migrated and future-version databases cannot be downgraded or changed.
{
  const db=live.applyFeedUpdates(live.starter());
  get(db,'b_last_titan').att=881;
  live.applyFeedUpdates(db);
  assert.equal(get(db,'b_last_titan').att,881);
  db.meta.feedRevision=revision+1;
  live.applyFeedUpdates(db);
  assert.equal(db.meta.feedRevision,revision+1);
}
console.log('PASS: migration revision, first use, v26 upgrade, user overrides, multiple reloads, and future-version safety');
