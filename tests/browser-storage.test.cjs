const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const start=html.indexOf('let browserSaveWarningShown=false;');
const end=html.indexOf('function gearBy(',start);
assert(start>=0&&end>start,'Expected browser-safe save implementation');
const snippet=html.slice(start,end);

let storageWorks=true,stored=null,alerts=0;
const status={textContent:'',setAttribute(name,value){this[name]=value}};
const state={character:{level:175},gear:[{id:'synthetic-test-gear'}]};
const context={
  KEY:'ornaRaidLab_v02',state,
  localStorage:{setItem(key,value){if(!storageWorks)throw Error('QuotaExceededError');stored={key,value}}},
  alert(){alerts++},console:{error(){}},
  $(){return status}
};
vm.createContext(context);
vm.runInContext(snippet,context);

assert.equal(context.save(),true);
assert.equal(stored.key,'ornaRaidLab_v02');
assert.deepEqual(JSON.parse(stored.value),state);
storageWorks=false;
assert.equal(context.save(),false,'Quota failure should not throw');
assert.equal(context.save(),false,'Further failed saves should not throw');
assert.equal(alerts,1,'Alert at most once until a successful save');
assert.match(status.textContent,/UNSAVED/);
assert.equal(stored.value,JSON.stringify(state),'Previously saved browser data stays unchanged on failure');
storageWorks=true;
assert.equal(context.save(),true,'Successful retry must recover');
assert.match(status.textContent,/Saved in this browser/);
storageWorks=false;
assert.equal(context.save(),false);
assert.equal(alerts,2,'A new failure after recovery needs another warning');
assert.deepEqual(state.gear,[{id:'synthetic-test-gear'}],'In-memory data must remain exportable');
console.log('PASS: browser save, quota failure warning, non-throwing retries, recovery, and data preservation');
