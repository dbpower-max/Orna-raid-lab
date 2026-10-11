/* Equipment screenshot parsing and reviewed inventory operations. No network or storage. */
(function(root){
'use strict';
const keys=['hp','mana','att','mag','def','res','dex','ward'];
const bonusFields=[
  {key:'xp',label:'XP %',pattern:'(?:EXP|XP|Experience)\\s*(?:Bonus|Gain|Increase)'},
  {key:'orns',label:'Orns %',pattern:'Orns?\\s*(?:Bonus|Gain|Increase)'},
  {key:'gold',label:'Gold %',pattern:'Gold\\s*(?:Bonus|Gain|Increase)'},
  {key:'luck',label:'Luck %',pattern:'Luck'},
  {key:'foresight',label:'Foresight',pattern:'Foresight',percent:false},
  {key:'crit',label:'Crit %',pattern:'(?:Crit(?!ical\\s+Chain)|Critical Hit Chance)(?!\\s+Damage)'},
  {key:'critDamage',label:'Crit dmg %',pattern:'Crit(?:ical)?\\s+Damage'},
  {key:'critChain',label:'Crit chain %',pattern:'Crit(?:ical)?\\s+Chain'},
  {key:'viewDistance',label:'View %',pattern:'View\\s+Distance'},
  {key:'hpRegen',label:'HP regen %',pattern:'HP\\s+Regen(?:eration)?'},
  {key:'manaRegen',label:'Mana regen %',pattern:'Mana\\s+Regen(?:eration)?'},
  {key:'wardRegen',label:'Ward regen %',pattern:'Ward\\s+Regen(?:eration)?'},
  {key:'followerAct',label:'Follower act %',pattern:'Follower\\s+(?:Act|Action)(?:ion)?'},
  {key:'followerStats',label:'Follower stats %',pattern:'Follower\\s+Stats'},
  {key:'statusProtection',label:'Status protect %',pattern:'Status\\s+Protection'},
  {key:'factionDamage',label:'Faction dmg %',pattern:'Faction\\s+Element\\s+Damage'},
  ...['Holy','Dark','Fire','Water','Lightning','Earthen','Dragon','Arcane','Physical'].map(x=>({key:x.toLowerCase()+'Damage',label:x+' dmg %',pattern:x+'\\s+Damage'}))
];
const numberPattern='([+\\-−–]?\\s*\\d[\\d,]*(?:\\.\\d+)?)';
function bonusRegex(f,global=false){return new RegExp('\\b'+f.pattern+'\\s*:?\\s*'+numberPattern+'\\s*%?',global?'gi':'i')}
function parseBonuses(raw){const out={};for(const f of bonusFields){const m=String(raw).match(bonusRegex(f));if(m)out[f.key]=Number(m[1].replace(/[ ,]/g,'').replace(/[−–]/g,'-'))}return out}
function cleanDetails(raw){let text=String(raw);for(const f of bonusFields)text=text.replace(bonusRegex(f,true),'');text=text.replace(/\b(?:HP|Mana|Att(?:ack)?|Mag(?:ic)?|Def(?:ense)?|Res(?:istance)?|Dex(?:terity)?|Ward)\s*:?\s*[+\-−–]?\s*\d[\d,]*(?:\.\d+)?\s*%?/gi,'').replace(/\b(?:FIRE|WATER|LIGHTNING|EARTHEN|HOLY|DARK|DRAGON|ARCANE|PHYSICAL)\b/g,'');return text.split('\n').map(l=>l.replace(/^[^A-Za-z]+/,'').trim()).filter(l=>/[A-Za-z]{3}/.test(l)).join('\n')}
const qualityPattern=/\b(Broken|Poor|Superior|Famed|Legendary|Ornate)\b/i;
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const baseName=s=>normalize(String(s||'').replace(qualityPattern,'').replace(/\s*#\d+$/,''));
function distance(a,b){let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next}return prev[b.length]}
function cleanName(line){return line.replace(/[★☆✦]/g,' ').replace(/\([^)]*\)/g,'').replace(/\s+[x*“”"'sS]*\d{1,2}\s*$/,'').replace(/^[^A-Za-z]+/,'').trim()}
function catalogMatch(line,rows){
  if(/\b(?:Att(?:ack)?|Mag(?:ic)?|Dex(?:terity)?|Def(?:ense)?|Res(?:istance)?|Mana|HP|Ward|Ability|Level|Bonus|Damage|Regen|Foresight|Crit)\s*[:\d]/i.test(line)||line.length>100)return null;
  const clean=cleanName(line),key=baseName(clean);if(key.length<4)return null;
  const exact=rows.filter(r=>key.includes(normalize(r.name))&&key.length-normalize(r.name).length<=16).sort((a,b)=>b.name.length-a.name.length)[0];
  if(exact)return{row:exact,fuzzy:false};
  let best=null,score=.83;
  for(const row of rows){const k=normalize(row.name);if(Math.abs(k.length-key.length)>Math.max(3,k.length*.18))continue;const s=1-distance(key,k)/Math.max(key.length,k.length);if(s>score){best=row;score=s}}
  return best?{row:best,fuzzy:true}:null;
}
function parseStats(raw){const result={};const aliases={hp:'HP',mana:'Mana',att:'Att(?:ack)?',mag:'Mag(?:ic)?',def:'Def(?:ense)?',res:'Res(?:istance)?',dex:'Dex(?:terity)?',ward:'Ward'};for(const [key,label]of Object.entries(aliases)){const m=raw.match(new RegExp('\\b'+label+'\\s*:?\\s*([+\\-−–]?\\s*\\d[\\d,]*(?:\\.\\d+)?)','i'));if(m)result[key]=Number(m[1].replace(/[ ,]/g,'').replace(/[−–]/g,'-'))}return result}
function parse(raw,rows,ocrLines=[]){
  const geometry=ocrLines.filter(l=>String(l.text||'').trim()),lines=geometry.length?geometry.map(l=>String(l.text).trim()):String(raw).split(/\r?\n/).map(s=>s.trim()).filter(Boolean),blocks=[];let current=null;
  for(let i=0;i<lines.length;i++){
    const startLine=i;let line=lines[i];if(/^(Broken|Poor|Superior|Famed|Legendary|Ornate)$/i.test(line)&&lines[i+1])line+=' '+lines[++i];let match=catalogMatch(line,rows);if(!match&&lines[i+1]&&!/:|\d/.test(line+' '+lines[i+1])){const joined=catalogMatch(line+' '+lines[i+1],rows);if(joined&&!joined.fuzzy){line+=' '+lines[++i];match=joined}}
    // Preserve unknown item headers followed by stats/level for manual catalogue selection.
    const unknown=(!current||Object.keys(parseStats(current.lines.join('\n'))).length>0)&&!match&&/[A-Za-z]{3}/.test(line)&&!/:|\b(?:handed|damage|bonus|ability|level|critical)\b/i.test(line)&&line.length<80&&/^.{0,8}(?:Level\b|(?:HP|Mana|Att|Mag|Def|Res|Dex|Ward)\s*:)/i.test(lines[i+1]||'');
    if(match||unknown){current={header:line,match,lines:[line],startLine,endLine:i};blocks.push(current)}else if(current){current.lines.push(line);current.endLine=i}
  }
  return blocks.map((b,index)=>{
    const raw=b.lines.join('\n'),row=b.match?.row,q=b.header.match(qualityPattern),level=raw.match(/\bLevel\s*:?\s*(\d{1,2})\b/i),hasLevel=/\blevel/i.test(raw),quantity=b.header.match(/\((\d+)\)/),element=raw.match(/\b(FIRE|WATER|LIGHTNING|EARTHEN|HOLY|DARK|DRAGON|ARCANE|PHYSICAL)\b/);
    const quality=q?q[1][0].toUpperCase()+q[1].slice(1).toLowerCase():'Regular';
    const warnings=[];if(!row)warnings.push('Choose the item from the catalogue.');if(b.match?.fuzzy)warnings.push('Approximate name match: check the item.');if(!level)warnings.push(hasLevel?'Level was unreadable: enter it.':'No level label read; level 1 is proposed. Check the screenshot.');
    const segment=geometry.slice(b.startLine,b.endLine+1),words=segment.flatMap(l=>l.words||[]).filter(w=>/[A-Za-z]{2}/.test(w.text||'')||/^[+\-−]?\d[\d,.]*%?$/.test((w.text||'').trim())),confidences=(words.length?words:segment).map(w=>w.confidence).filter(v=>typeof v==='number'&&Number.isFinite(v));
    return {index,startLine:b.startLine,endLine:b.endLine,ocrConfidence:confidences.length?Math.min(...confidences):null,catalogId:row?.id||'',name:row?.name||cleanName(b.header).replace(qualityPattern,'').trim(),quality,level:level?Number(level[1]):hasLevel?'':1,element:element?element[1][0]+element[1].slice(1).toLowerCase():'',stats:parseStats(raw),bonuses:parseBonuses(raw),quantity:quantity?Number(quantity[1]):null,raw,warnings,details:cleanDetails(b.lines.slice(1).filter(l=>/\b(?:Ability|Crit|Foresight|Bonus|Regen|Distance|Follower|Damage|handed|Immun|Protection)\b/i.test(l)).join('\n')),reviewed:false};
  });
}
function candidates(draft,inventory){return inventory.filter(g=>{const same=draft.catalogId&&g.catalogId===draft.catalogId||baseName(g.name)===baseName(draft.name);const q=g.qualityLabelOverride||qualityFromPct(g.qualityPct);return same&&(q==='Standard'?'Regular':q)===draft.quality})}
function qualityFromPct(p){return p<70?'Broken':p<90?'Poor':p<=100?'Regular':p<120?'Superior':p<140?'Famed':p<170?'Legendary':'Ornate'}
function plan(draft,inventory){const matches=candidates(draft,inventory);return{action:matches.length?'update':'add',targetId:matches.length===1?matches[0].id:'',matches}}
function validate(drafts,inventory,catalog){const errors=[],targets=new Set();drafts.forEach((d,i)=>{if(d.action==='skip')return;const prefix=`Item ${i+1}: `;if(!d.reviewed)errors.push(prefix+'confirm review.');if(!catalog.some(r=>r.id===d.catalogId))errors.push(prefix+'choose a catalogue item.');if(!Number.isInteger(Number(d.level))||Number(d.level)<1||Number(d.level)>13)errors.push(prefix+'enter a level from 1 to 13.');if(!String(d.name).trim())errors.push(prefix+'enter a name.');if(!Object.keys(d.stats).length&&Object.values(catalog.find(r=>r.id===d.catalogId)?.base||{}).some(v=>Number(v)!==0))errors.push(prefix+'enter at least one displayed stat.');if(Object.entries(d.stats).some(([k,v])=>!keys.includes(k)||typeof v!=='number'||!Number.isFinite(v)))errors.push(prefix+'correct the stat values.');if(Object.entries(d.bonuses||{}).some(([k,v])=>!bonusFields.some(f=>f.key===k)||typeof v!=='number'||!Number.isFinite(v)))errors.push(prefix+'correct the bonus values.');if(d.action==='update'){if(!d.targetId||!candidates(d,inventory).some(g=>g.id===d.targetId))errors.push(prefix+'choose which owned copy to update.');if(targets.has(d.targetId))errors.push(prefix+'another row updates that same copy; skip one or select a different copy.');targets.add(d.targetId)}else if(d.action!=='add')errors.push(prefix+'choose Add, Update, or Skip.');});return errors}
function reviewFlags(d,inventory,catalog,extra={}){
  if(d.action==='skip')return[];
  const row=catalog.find(r=>r.id===d.catalogId),flags=[];
  if(d.ocrConfidence===null||d.ocrConfidence===undefined)flags.push('Text confidence unavailable.');
  else if(d.ocrConfidence<70)flags.push('Unclear text.');
  if(d.warnings?.some(x=>x.startsWith('Approximate')))flags.push('Check name match.');
  if(!row)flags.push('Select catalogue item.');
  if(!d.level)flags.push('Enter unreadable level.');
  if(row&&keys.some(k=>Number(row.base?.[k])!==0&&row.base?.[k]!==undefined&&d.stats[k]===undefined))flags.push('Some stats were not read.');
  if(extra.statMismatch)flags.push('Stats outside predicted range.');
  if(d.action==='update'&&(!d.targetId||!candidates(d,inventory).some(g=>g.id===d.targetId)))flags.push('Choose owned copy.');
  if(extra.duplicateTarget)flags.push('Another row updates this copy.');
  const errors=validate([{...d,reviewed:true}],inventory,catalog);if(errors.length&&!flags.length)flags.push('Check missing or invalid values.');
  return [...new Set(flags)];
}
function approve(drafts,mode,flagsFor){return drafts.map(d=>({...d,reviewed:d.action!=='skip'&&(mode==='all'||mode==='unflagged'&&!flagsFor(d).length)}))}
function cropRegions(drafts,ocrLines,width,height){
  const lines=ocrLines.filter(l=>String(l.text||'').trim());
  if(drafts.length<2)return drafts.map(()=>null);
  return drafts.map((d,i)=>{
    const first=lines[d.startLine]?.bbox,last=lines[d.endLine]?.bbox;
    if(!first||!last)return null;
    const previous=i?lines[drafts[i-1].endLine]?.bbox:null,next=lines[drafts[i+1]?.startLine]?.bbox;
    const top=Math.max(0,Math.floor(previous?(previous.y1+first.y0)/2:first.y0-18));
    const bottom=Math.min(height,Math.ceil(next?(last.y1+next.y0)/2:last.y1+18));
    if(!Number.isFinite(top)||!Number.isFinite(bottom)||bottom<=top)return null;
    return{x:0,y:top,width,height:bottom-top};
  });
}
function mergeObserved(item,draft){const next=structuredClone(item);next.level=Number(draft.level);next.name=draft.name.trim();next.qualityLabelOverride=draft.quality||item.qualityLabelOverride;
const priorLabel=String(item.qualityLabelOverride||'').trim().toLowerCase();
const newLabel=String(draft.quality||'').trim().toLowerCase();
// A screenshot supplies a quality label, not an exact quality percentage.
// Keep a previously verified percentage unless the label actually conflicts.
next.qualityPctKnown=!!item.qualityPctKnown&&(!priorLabel||!newLabel||priorLabel===newLabel);next.observedByLevel={...(next.observedByLevel||{})};const prior=next.observedByLevel[next.level]||(Number(next.observedLevel)===next.level?next.observedStats:{});next.observedByLevel[next.level]={...(prior||{}),...draft.stats};if(draft.element){next.element=draft.element;if(next.slot==='Weapon')next.attackElement=draft.element;else next.resistElements=[draft.element]}next.observedBonusesByLevel={...(next.observedBonusesByLevel||{}),[next.level]:{...(next.observedBonusesByLevel?.[next.level]||{}),...(draft.bonuses||{})}};next.screenshotDetails=draft.details;next.screenshotImport={file:draft.fileName||'',reviewedAt:new Date().toISOString(),raw:draft.raw};return next}
const api={cropRegions,reviewFlags,approve,bonusFields,parseBonuses,cleanDetails,parse,parseStats,candidates,plan,validate,mergeObserved,normalize};root.OrnaGearImport=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
