const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const begin=html.indexOf('function prepareDatabaseImport(');
const end=html.indexOf('function registerModelTools(',begin);
assert(begin>=0&&end>begin,'Expected transactional import handler');
const implementation=html.slice(begin,end);
const revision=Number(html.match(/const DATA_FEED_REVISION=(\d+);/)?.[1]);
assert(Number.isSafeInteger(revision));

const alerts=[];
let storageAvailable=true;
class MockFileReader{
  readAsText(file){
    if(file.unreadable){this.onerror();return}
    this.result=file.text;
    this.onload();
  }
}
const runtime=new Function('FileReader','alert','console','n','DATA_FEED_REVISION',
  'applyFeedUpdates','storageAvailable',`
    let state={character:{core:{}},gear:[{id:'original'}],spells:[],gearLoadouts:[],spellLoadouts:[],bosses:[]};
    let renderCount=0,successfulSaves=0;
    const renderAll=()=>{
      renderCount++;
      if(!storageAvailable())return false;
      successfulSaves++;
      return true;
    };
    ${implementation}
    return {importDB,prepareDatabaseImport,getState:()=>state,
      counts:()=>({renderCount,successfulSaves})};
  `
)(MockFileReader,message=>alerts.push(message),{error(){}},x=>Number(x)||0,revision,
  x=>x,()=>storageAvailable);

const valid={
  character:{level:150,core:{hp:500,mag:300}},meta:{feedRevision:revision},
  gear:[{id:'gear1'}],spells:[{id:'spell1'}],
  gearLoadouts:[{id:'load1',slots:{Weapon:'gear1'}}],
  spellLoadouts:[{id:'spellload1',spellIds:['spell1']}],
  bosses:[{id:'dracon',skills:[]}]
};
const send=data=>runtime.importDB({target:{files:[{text:JSON.stringify(data)}]}});
const original=runtime.getState();
send(valid);
assert.equal(runtime.getState().gear[0].id,'gear1');
assert.match(alerts.at(-1),/imported and saved successfully/);
const previous=runtime.getState();
assert.notStrictEqual(previous,original,'Success must switch active state');

send({...valid,gear:[{id:'same'},{id:'same'}]});
assert.strictEqual(runtime.getState(),previous,'Duplicate ID must not change state');
assert.match(alerts.at(-1),/Duplicate gear ID/);

send({...valid,gearLoadouts:[{id:'x',slots:null}]});
assert.strictEqual(runtime.getState(),previous,'Invalid loadout must not change state');
assert.match(alerts.at(-1),/Invalid gear loadout slots/);

send({...valid,meta:{feedRevision:revision+1}});
assert.strictEqual(runtime.getState(),previous,'Future-version import must be rejected');
assert.match(alerts.at(-1),/newer Raid Lab version/);

send({...valid,spellLoadouts:[{id:'sl',spellIds:null}]});
assert.strictEqual(runtime.getState(),previous);

runtime.importDB({target:{files:[{text:'not-json'}]}});
assert.strictEqual(runtime.getState(),previous,'Invalid JSON must preserve database');

storageAvailable=false;
send({...valid,gear:[{id:'not-saved'}]});
assert.strictEqual(runtime.getState(),previous,'Failed write must restore original state');
assert.match(alerts.at(-1),/Browser storage could not save/);
storageAvailable=true;

runtime.importDB({target:{files:[{unreadable:true}]}});
assert.strictEqual(runtime.getState(),previous,'Unreadable file must preserve original state');
assert.match(alerts.at(-1),/Unable to read/);

assert(runtime.counts().successfulSaves>=1);
assert.match(html,/function renderAll\(\)\{[^\n]*return save\(\)\}/,
  'Rendering must report browser save success to transactional import');
console.log('PASS: valid import, duplicate IDs, invalid schema/JSON, future version, failed save rollback and read error');
