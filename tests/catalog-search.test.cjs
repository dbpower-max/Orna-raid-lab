const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
const from=html.indexOf('function searchKey('),to=html.indexOf('function catalogArt(',from);
assert(from>=0&&to>from,'Catalog search implementation must exist');
const search=new Function(html.slice(from,to)+'return {searchKey,cachedCatalogSearch,catalogMatches};')();
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/orna-catalogs.json')));

function reference(rows,query,kind){
  const terms=search.searchKey(query).split(' ').filter(Boolean);
  if(!terms.length)return[];
  return rows.map(row=>{
    const hay=kind==='gear'?
      [row.name,row.slot,row.rarity,row.useableBy,row.weaponType,row.element,row.abilityName,row.notes]:
      [row.name,row.type,row.element,row.targets,row.learnedBy?.join(' '),row.gearSources?.join(' '),row.notes];
    const all=search.searchKey(hay.join(' '));
    if(!terms.every(term=>all.includes(term)))return null;
    const name=search.searchKey(row.name),q=search.searchKey(query);
    const rank=name===q?0:name.startsWith(q)?1:name.includes(q)?2:3;
    return {row,rank};
  }).filter(Boolean).sort((a,b)=>a.rank-b.rank||a.row.tier-b.row.tier||a.row.name.localeCompare(b.row.name))
    .slice(0,30).map(x=>x.row.id);
}
const queries=['frost','multi frost','FROST','blade','defense','fire','legendary','Arch',
  'Bite','parry','two handed','critical','resistance','chained','ice','holy',
  'ward','level','Magic','ele','mage','poisonstrike','quick',''];
for(const [rows,kind] of [[catalog.gear,'gear'],[catalog.abilities,'spell']]){
  for(const query of queries){
    const expected=reference(rows,query,kind);
    const first=search.catalogMatches(rows,query,kind).map(x=>x.id);
    const repeat=search.catalogMatches(rows,query,kind).map(x=>x.id);
    assert.deepEqual(first,expected,`Search results changed for ${kind} / "${query}"`);
    assert.deepEqual(repeat,expected,'Cached repeated search must match first search');
  }
}
const row=catalog.gear.find(x=>x.name);
const first=search.cachedCatalogSearch(row,'gear');
const second=search.cachedCatalogSearch(row,'gear');
assert.strictEqual(first,second,'Cache must reuse normalized fields for the same record');
const different=search.cachedCatalogSearch(row,'spell');
assert.notStrictEqual(different,first,'Search-kind differences must not reuse wrong fields');
console.log('PASS: 48 catalog queries preserve old results, caching stable across repeats and categories');
