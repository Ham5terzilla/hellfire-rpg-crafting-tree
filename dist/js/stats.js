export function createStats(ctx) {
  const { state } = ctx;
  const { extractTooltipSection, formatNumber, isPlayerFacing, normalizeText } = ctx.deps;
  const { constants = {} } = ctx;
  const { PSEUDO_STAT_DEFS, MAIN_STAT_NAMES, META_STAT_DEFS } = constants;


function rawStatValue(item, name) { return parseItemStats(item).filter(s => normalizeText(s.name) === normalizeText(name) && s.numeric && Number.isFinite(s.value)).reduce((sum, s) => sum + Number(s.value), 0); }
function getPseudoStatValues(item, mainStat = state.ui.itemBrowser.mainStat || 'strength') {
  const agi=rawStatValue(item,'Agility'), str=rawStatValue(item,'Strength'), int=rawStatValue(item,'Intelligence'), all=rawStatValue(item,'All Stats'), main=rawStatValue(item,'Main Stat');
  const totals={agility:agi+all,strength:str+all,intelligence:int+all};
  if(mainStat==='agility') totals.agility+=main; else if(mainStat==='intelligence') totals.intelligence+=main; else totals.strength+=main;
  return {'total-agi':totals.agility,'total-str':totals.strength,'total-int':totals.intelligence,'total-all':Math.min(totals.agility,totals.strength,totals.intelligence),'total-sum':totals.agility+totals.strength+totals.intelligence};
}
function getPseudoStatDefinition(name) { const k=normalizeText(name||''); return PSEUDO_STAT_DEFS.find(s=>normalizeText(s.name)===k)||null; }
function isActiveAbilityMarker(line) { return /^\s*\[active\]\s+/i.test(String(line||'')) || /^\s*(?:active ability|ability)\s*:/i.test(String(line||'')); }
function isPassiveAbilityMarker(line) { return /^\s*\[passive\]\s+/i.test(String(line||'')) || /^\s*passive ability\s*:/i.test(String(line||'')); }
function isAbilityMarker(line) { return isActiveAbilityMarker(line)||isPassiveAbilityMarker(line); }
function extractAbilities(item) {
  if (!item) return [];
  const cached = state.cache.abilities.get(item);
  if (cached) return cached;
  const lines=String(item?.plainExtendedTooltip||'').split(/\r?\n/).map(x=>x.trim()), abilities=[];
  for(let i=0;i<lines.length;i++){ const marker=lines[i]; if(!isAbilityMarker(marker)) continue; const active=isActiveAbilityMarker(marker); const name=marker.replace(/^\[(?:active|passive)\]\s*/i,'').replace(/^(?:active ability|passive ability|ability)\s*:\s*/i,'').trim(); const block=[]; for(let j=i+1;j<lines.length;j++){const line=lines[j];if(!line||isAbilityMarker(line)||/^provides\s*:/i.test(line))break;block.push(line);if(/^cooldown\s*:/i.test(line))break;} abilities.push({type:active?'active':'passive',name:name||marker,lines:block}); i+=block.length; }
  if(Array.isArray(item?.scriptBehaviors)) item.scriptBehaviors.forEach(entry=>{const text=typeof entry==='string'?entry.trim():String(entry?.name||entry?.description||'').trim();if(/^\[active\]/i.test(text))abilities.push({type:'active',name:text.replace(/^\[active\]\s*/i,'').trim(),lines:[]});else if(/^\[passive\]/i.test(text))abilities.push({type:'passive',name:text.replace(/^\[passive\]\s*/i,'').trim(),lines:[]});});
  const seen=new Set();
  const result = abilities.filter(a=>{const k=`${a.type}|${normalizeText(a.name)}`;if(seen.has(k))return false;seen.add(k);return true;});
  state.cache.abilities.set(item, result);
  return result;
}
function extractActiveAbilities(item){return extractAbilities(item).filter(a=>a.type==='active').map(a=>[`[Active] ${a.name}`,...a.lines]);}
function getNonAbilityProvidesLines(item){ const lines=extractTooltipSection(String(item?.plainExtendedTooltip||''),'Provides:'), abilities=extractAbilities(item), blocked=new Set(abilities.flatMap(a=>[a.name,...a.lines]).map(x=>normalizeText(x))); return lines.filter(line=>!blocked.has(normalizeText(String(line).trim()))&&!isAbilityMarker(line)); }
function canonicalizeDynamicStat(line){
  const text=String(line||'').replace(/^[-•]\s*/,'').trim();
  if(!text || /^[+\-]?\d+(?:\.\d+)?\s*%?\s+\S/.test(text)) return null;
  const matches=[...text.matchAll(/\d+(?:\.\d+)?/g)];
  if(matches.length!==1) return null;
  const match=matches[0], value=Number(match[0]);
  if(!Number.isFinite(value)) return null;
  const name=`${text.slice(0,match.index)}#${text.slice(match.index+match[0].length)}`.replace(/\s+/g,' ').trim();
  return {name,value,unit:'number',numeric:true,pseudo:false,originalName:text};
}
function parseItemStats(item){
  if (!item) return [];
  const cached = state.cache.parsedStats.get(item);
  if (cached) return cached;
  const lines=[...getNonAbilityProvidesLines(item)];
  if(Array.isArray(item?.scriptStats)) lines.push(...item.scriptStats.map(e=>typeof e==='string'?e:JSON.stringify(e)).filter(x=>!isAbilityMarker(x)));
  const result = lines.map(line=>{
    const dynamic=canonicalizeDynamicStat(line);
    if(dynamic)return {...dynamic,dynamic:true};
    const text=String(line).trim();
    const m=text.match(/^([+\-]?\d+(?:\.\d+)?)\s*(%)?\s+(.+)$/);
    if(m)return{name:m[3].trim(),value:Number(m[1]),percent:Boolean(m[2]),numeric:true,pseudo:false};
    return{name:text.replace(/^[-•]\s*/,'').trim(),value:null,percent:false,numeric:false,pseudo:false};
  }).filter(x=>x.name);
  state.cache.parsedStats.set(item, result);
  return result;
}
function classifySimpleStat(name) {
  const n = normalizeText(name);
  // Attribute stats have their own group. They are not "general" just because
  // they are universal; the dedicated Attributes section keeps the readout
  // consistent with the pseudo-stat model.
  if (/^(?:strength|agility|intelligence|all stats|main stat)$/.test(n)) return 'attributes';

  // Defensive means the stat primarily improves survival, mitigation or
  // resistance. Keep "damage taken" here even though it contains "damage".
  const defensive = [
    /\barmor\b/, /\bdefen[cs]e\b/, /\bdamage taken\b/, /\bdamage reduction\b/,
    /\bspell damage reduction\b/, /\bmagic(?:al)? resistance\b/, /\bresistance\b/,
    /\bresist\b/, /\bevasion\b/, /\bblock(?: chance)?\b/, /\bdodge\b/,
    /\bhealth\b/, /\bhp\b/, /\blife\b/, /\bshield\b/, /\bbarrier\b/,
    /\bhealth regeneration\b/, /\blife regeneration\b/, /\bhealing\b/, /\bheal(?:s|ing)?\b/,
    /\btenacity\b/, /\bslow resistance\b/, /\bstatus resistance\b/,
    /\bcrowd control resistance\b/, /\bcc resistance\b/, /\bimmunity\b/
  ];
  if (defensive.some(re => re.test(n))) return 'defensive';

  // Offensive means the stat directly improves damage output, attack cadence
  // or offensive penetration. Movement/range/resource stats stay general.
  const offensive = [
    /\bdamage\b/, /\battack speed\b/, /\bcritical(?: strike)?\b/, /\bcrit(?:ical)?\b/,
    /\blife steal\b/, /\blifesteal\b/, /\bspell power\b/, /\bability power\b/,
    /\battack power\b/, /\bcast speed\b/, /\bhaste\b/, /\bpenetration\b/,
    /\barmor penetration\b/, /\bmagic penetration\b/, /\baccuracy\b/,
    /\blethality\b/, /\bspell damage\b/, /\bability damage\b/, /\bdamage dealt\b/,
    /\bphysical damage\b/, /\bmagical damage\b/, /\battack range\b/
  ];
  if (offensive.some(re => re.test(n))) return 'offensive';

  // General / utility covers movement, resources, cooldowns and other stats
  // that are useful but are not intrinsically offensive or defensive.
  return 'general';
}
function getStatCatalog(items){
  if (items === state.indexes.playerFacing && state.cache.statCatalog) return state.cache.statCatalog;
  const map=new Map();
  const add=(name,data)=>{const k=normalizeText(name);if(k&&!map.has(k))map.set(k,{name,...data});};
  PSEUDO_STAT_DEFS.forEach(st=>add(st.name,{kind:'pseudo',numeric:true,pseudoKey:st.key,group:'pseudo',subtype:'simple'}));
  META_STAT_DEFS.forEach(st=>add(st.name,{kind:'meta',numeric:st.numeric,metaKey:st.key,group:'meta',subtype:st.numeric?'simple':'presence'}));
  const dynamicValues=new Map();
  items.forEach(item=>parseItemStats(item).forEach(st=>{
    if(st.dynamic){
      if(!dynamicValues.has(st.name)) dynamicValues.set(st.name,new Set());
      dynamicValues.get(st.name).add(st.value);
    }
  }));
  const validatedDynamicNames=new Set([...dynamicValues.entries()].filter(([,values])=>values.size>=2).map(([name])=>name));
  if(items===state.indexes.playerFacing) state.cache.dynamicStatNames=validatedDynamicNames;
  items.forEach(item=>{
    parseItemStats(item).forEach(st=>{
      const dynamicValid=st.dynamic && validatedDynamicNames.has(st.name);
      const displayName=dynamicValid ? st.name : (st.originalName || st.name);
      add(displayName,{kind:'simple',numeric:dynamicValid || (!st.dynamic && st.numeric),group:(dynamicValid || (!st.dynamic && st.numeric))?classifySimpleStat(displayName):'general',subtype:dynamicValid?'dynamic':((!st.dynamic && st.numeric)?'simple':'presence'),dynamic:dynamicValid,canonicalName:dynamicValid?st.name:null});
    });
    extractAbilities(item).forEach(a=>add(a.name,{kind:a.type,numeric:false,group:a.type,subtype:'presence'}));
  });
  const kindRank={pseudo:0,simple:1,passive:2,active:3,meta:4};
  const groupRank={pseudo:0,general:0,defensive:1,offensive:2,passive:0,active:0,meta:0};
  const subtypeRank={simple:0,dynamic:1,presence:2};
  const result = [...map.values()].sort((a,b)=>
    (kindRank[a.kind]-kindRank[b.kind])||
    ((groupRank[a.group]??0)-(groupRank[b.group]??0))||
    ((subtypeRank[a.subtype]??0)-(subtypeRank[b.subtype]??0))||
    a.name.localeCompare(b.name)
  );
  if (items === state.indexes.playerFacing) state.cache.statCatalog = result;
  return result;
}
function getMetaStatValue(item,key){
  const stats=parseItemStats(item);
  const abilities=extractAbilities(item);
  if(key==='defensive-count') return new Set(stats.filter(s=>classifySimpleStat(s.name)==='defensive').map(s=>normalizeText(s.name))).size;
  if(key==='offensive-count') return new Set(stats.filter(s=>classifySimpleStat(s.name)==='offensive').map(s=>normalizeText(s.name))).size;
  if(key==='passive-count') return abilities.filter(a=>a.type==='passive').length;
  if(key==='active-count') return abilities.filter(a=>a.type==='active').length;
  if(key==='has-passive') return abilities.some(a=>a.type==='passive')?1:0;
  if(key==='has-active') return abilities.some(a=>a.type==='active')?1:0;
  if(key==='has-aura'){
    if(!isPlayerFacing(item)) return 0;
    // Aura is a gameplay property only when it is explicitly present in the
    // item's Provides: section. Names/descriptions and ability labels are not
    // enough: cosmetic items such as "Aura of the Fallen One" must remain 0.
    const provides = extractTooltipSection(String(item?.plainExtendedTooltip || ''), 'Provides:');
    return provides.some(line => /\baura\b/i.test(String(line))) ? 1 : 0;
  }
  return 0;
}
function getMetaStatDefinition(name){const k=normalizeText(name||'');return META_STAT_DEFS.find(s=>normalizeText(s.name)===k)||null;}
function getStatInfo(items,name){const k=normalizeText(name||'');if(!k)return{exists:false,numeric:false,kind:'unknown'};const pseudo=getPseudoStatDefinition(name);if(pseudo)return{exists:true,numeric:true,kind:'pseudo',pseudoKey:pseudo.key};const meta=getMetaStatDefinition(name);if(meta)return{exists:true,numeric:meta.numeric,kind:'meta',metaKey:meta.key};const found=getStatCatalog(items).find(s=>normalizeText(s.name)===k);return found?{...found,exists:true}:{exists:false,numeric:false,kind:'unknown'};}
function getStatPresenceAndValue(item,name){
  const pseudo=getPseudoStatDefinition(name);
  if(pseudo){const value=getPseudoStatValues(item)[pseudo.key];return{present:Number.isFinite(value),value:Number.isFinite(value)?value:0};}
  const meta=getMetaStatDefinition(name);
  if(meta){const value=getMetaStatValue(item,meta.key);return{present:meta.numeric?Number.isFinite(value):value===1,value:Number.isFinite(value)?value:0};}
  const k=normalizeText(name||'');
  const info=getStatInfo(state.indexes.playerFacing,name);
  const canonical=info?.canonicalName;
  const stats=parseItemStats(item).filter(st=>normalizeText(st.name)===(canonical||k));
  const numeric=stats.filter(st=>st.numeric&&Number.isFinite(st.value));
  if(numeric.length)return{present:true,value:Math.max(...numeric.map(st=>st.value))};
  if(extractAbilities(item).some(a=>normalizeText(a.name)===k))return{present:true,value:1};
  return{present:stats.length>0,value:stats.length?1:0};
}
function statFilterMatches(item,filter){if(!filter?.name)return false;const stat=getStatPresenceAndValue(item,filter.name);if(!stat.present)return false;const info=getStatInfo(state.indexes.playerFacing,filter.name);if(!info.numeric)return true;const min=filter.min===''||filter.min==null?null:Number(filter.min),max=filter.max===''||filter.max==null?null:Number(filter.max),target=filter.value===''||filter.value==null?null:Number(filter.value),op=filter.operator||'gte';if(min!=null&&stat.value<min)return false;if(max!=null&&stat.value>max)return false;if(target==null||!Number.isFinite(target))return true;if(op==='gte')return stat.value>=target;if(op==='lte')return stat.value<=target;if(op==='eq')return stat.value===target;if(op==='gt')return stat.value>target;if(op==='lt')return stat.value<target;return true;}
function weightedStatResult(item,group){const filters=(group.filters||[]).filter(f=>f.name);let score=0;const reasons=[];for(const filter of filters){const info=getStatInfo(state.indexes.playerFacing,filter.name);const stat=getStatPresenceAndValue(item,filter.name);const min=filter.min===''||filter.min==null?null:Number(filter.min),max=filter.max===''||filter.max==null?null:Number(filter.max);if(info.numeric){if(min!=null&&stat.value<min)return{matched:false,score:0,reason:`${filter.name}: value is below minimum`};if(max!=null&&stat.value>max)return{matched:false,score:0,reason:`${filter.name}: value is above maximum`};}const w=Number(filter.weight);const weight=Number.isFinite(w)?w:0;const contribution=stat.value*weight;score+=contribution;reasons.push(`${filter.name}: ${stat.value} × ${weight} = ${formatNumber(contribution)}`);}const minSum=group.minSum===''||group.minSum==null?null:Number(group.minSum),maxSum=group.maxSum===''||group.maxSum==null?null:Number(group.maxSum);return{matched:(minSum==null||score>=minSum)&&(maxSum==null||score<=maxSum),score,reason:`Weighted sum ${formatNumber(score)}${minSum!=null?` ≥ ${minSum}`:''}${maxSum!=null?` ≤ ${maxSum}`:''}`,contributions:reasons};}
function evaluateStatGroup(item,group){
  const filters=(group.filters||[]).filter(f=>f.name);
  if(!filters.length)return{matched:true,score:0,reason:'',details:[]};
  if(group.type==='weight'){
    const e=weightedStatResult(item,group);
    return {...e,details:e.contributions||[]};
  }
  const details=[];
  const matches=filters.map(f=>{const m=statFilterMatches(item,f);const s=getStatPresenceAndValue(item,f.name);details.push(`${f.name}: ${s.present?(s.value===1&&!getStatInfo(state.indexes.playerFacing,f.name).numeric?'present':formatNumber(s.value)):'absent'} — ${m?'passed':'failed'}`);return m;});
  if(group.type==='not'){const matched=matches.some(Boolean);return{matched:!matched,score:0,reason:matched?'At least one forbidden condition matched.':'No forbidden condition matched.',details};}
  if(group.type==='if'){const ok=filters.every((f,i)=>!getStatPresenceAndValue(item,f.name).present||matches[i]);return{matched:ok,score:0,reason:ok?'Every present optional stat satisfies its range.':'A present optional stat failed its range.',details};}
  if(group.type==='count'){const count=matches.filter(Boolean).length,min=group.min===''||group.min==null?0:Number(group.min),max=group.max===''||group.max==null?Infinity:Number(group.max);const ok=count>=min&&count<=max;return{matched:ok,score:0,reason:`COUNT matched ${count} of ${filters.length}; required ${min}${Number.isFinite(max)?`–${max}`:'+'}.`,details};}
  const ok=matches.every(Boolean);return{matched:ok,score:0,reason:ok?'Every condition matched.':'At least one condition failed.',details};
}
function formatStatKey(key) {
  return String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
}
function formatStatValue(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const percentKeys = new Set(['damagedone', 'damagetaken', 'spellhealing', 'spelldamage', 'attacklifesteal']);
  return percentKeys.has(String(key).toLowerCase()) ? `${Math.round(number * 100)}%` : String(value);
}

  return { classifySimpleStat, evaluateStatGroup, extractAbilities, extractActiveAbilities, formatStatKey, formatStatValue, getMetaStatValue, getPseudoStatValues, getStatCatalog, getStatInfo, getStatPresenceAndValue, parseItemStats };
}
