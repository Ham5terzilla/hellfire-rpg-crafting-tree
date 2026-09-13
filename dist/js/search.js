export function createSearch(ctx) {
  const { state, elements, itemBrowserHistory } = ctx;
  const { escapeHtml, classifySimpleStat, copyItemBrowserLink, createIcon, evaluateStatGroup, extractAbilities, extractShopNames, formatNumber, getItemCategory, getMetaStatValue, getPseudoStatValues, getStatCatalog, getStatInfo, getStatPresenceAndValue, isActualShopPurchase, isWearableItem, itemKey, itemSummary, normalizeText, parseItemStats, renderItemDetails, resolveItemReference, restoreItemBrowserUrlState, saveItemBrowserQuery, selectItem, serializeItemBrowserQuery, showMonsterDetails, showShopDetails, updateItemBrowserUrlState } = ctx.deps;
  const { constants = {} } = ctx;
  const { PSEUDO_STAT_DEFS, META_STAT_DEFS } = constants;
  const ITEM_BROWSER_DEFAULTS = Object.freeze({
    mainStat:'strength', query:'', searchMode:'full', instantSearch:true, category:'', quality:'', slot:'', classNames:[], levelMin:'', levelMax:'', obtainedBy:[],
    relations:{craftedFrom:'',craftsInto:'',usedIn:false,dropsFrom:'',dropCountMin:'',dropCountMax:'',soldBy:'',shopCountMin:'',shopCountMax:''}, statGroups:[], sort:'match', sortDirection:'desc', view:'detailed', selectedCode:'', whyCode:''
  });


function createDefaultItemBrowserQuery() {
  return {
    ...ITEM_BROWSER_DEFAULTS,
    classNames: [],
    obtainedBy: [],
    relations: { ...ITEM_BROWSER_DEFAULTS.relations },
    statGroups: [],
  };
}
function populateSelect(select, values, placeholder) {
  if (!select) return;
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.append(first);
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}
function populateDatalist(list, values) {
  if (!list) return;
  list.replaceChildren();
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    list.append(option);
  });
}
function textIncludes(haystack, needle) {
  const query = normalizeText(needle);
  return !query || normalizeText(haystack).includes(query);
}
function renderItemBrowserClassFilters(classes) {
  const container = elements.itemBrowserClassList;
  if (!container) return;
  container.replaceChildren();
  classes.forEach((className) => {
    const label = document.createElement('label');
    label.className = 'item-browser-class-chip';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.value = className; input.title = `Filter to items available to the ${className} class.`;
    input.checked = state.ui.itemBrowser.classNames.includes(className);
    input.addEventListener('change', () => {
      state.ui.itemBrowser.classNames = [...container.querySelectorAll('input:checked')].map((node) => node.value);
      commitItemBrowserQuery();
    });
    const text = document.createElement('span'); text.textContent = className;
    label.append(input, text); container.append(label);
  });
}
function renderItemBrowserStatFilters(items){
  const container=elements.itemBrowserStatList;if(!container)return;container.replaceChildren();const catalog=getStatCatalog(items);
  const labels={and:'AND — all',not:'NOT — none',count:'COUNT — how many',if:'IF — when present',weight:'WEIGHT — weighted sum'};const help={and:'Every listed condition must match. Presence-only stats require existence; numeric stats can use a value.',not:'None of the listed conditions may match.',count:'Count how many listed conditions match and constrain that count.',if:'If the stat exists, it must satisfy the condition. If absent, the item passes.',weight:'Numeric stats contribute value × weight. Presence-only stats contribute 1 when present and 0 when absent. The weighted sum is checked against the threshold.'};
  state.ui.itemBrowser.statGroups.forEach((group,gi)=>{const card=document.createElement('section');card.className=`item-browser-stat-group item-browser-stat-group-${group.type}`;const head=document.createElement('div');head.className='item-browser-stat-group-heading';const type=document.createElement('select');type.className='item-browser-stat-group-type';type.title='Choose the logic for this stat group.';Object.entries(labels).forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;o.selected=group.type===v;type.append(o);});type.addEventListener('change',()=>{group.type=type.value;commitItemBrowserQuery(true);});const title=document.createElement('div');title.className='item-browser-stat-group-title';title.textContent=labels[group.type];title.title=help[group.type];const remove=document.createElement('button');remove.type='button';remove.className='item-browser-remove-group';remove.textContent='×';remove.title='Remove this entire stat group';remove.setAttribute('aria-label',remove.title);remove.addEventListener('click',()=>{state.ui.itemBrowser.statGroups.splice(gi,1);commitItemBrowserQuery(true);});head.append(type,title,remove);card.append(head);
    if(group.type==='count'){const range=document.createElement('div');range.className='item-browser-stat-group-range';const label=document.createElement('span');label.textContent='Matched conditions';const min=document.createElement('input');min.type='number';min.min='0';min.step='1';min.placeholder='Min';min.value=group.min??'';min.title='Minimum number of conditions that must match.';const dash=document.createElement('b');dash.textContent='–';const max=document.createElement('input');max.type='number';max.min='0';max.step='1';max.placeholder='Max';max.value=group.max??'';max.title='Maximum number of conditions that may match.';const sync=()=>{group.min=min.value;group.max=max.value;commitItemBrowserQuery(false)};min.addEventListener('input',sync);max.addEventListener('input',sync);range.append(label,min,dash,max);card.append(range);}
    if(group.type==='weight'){const range=document.createElement('div');range.className='item-browser-weight-controls';const label=document.createElement('span');label.textContent='Weighted sum threshold';label.title='Minimum is the activation threshold. Maximum is optional.';const min=document.createElement('input');min.type='number';min.step='any';min.placeholder='Minimum';min.value=group.minSum??'';min.title='Minimum weighted sum required for an item to match.';const max=document.createElement('input');max.type='number';max.step='any';max.placeholder='Maximum (optional)';max.value=group.maxSum??'';max.title='Optional maximum weighted sum.';const sync=()=>{group.minSum=min.value;group.maxSum=max.value;commitItemBrowserQuery(false)};min.addEventListener('input',sync);max.addEventListener('input',sync);range.append(label,min,max);card.append(range);const hint=document.createElement('p');hint.className='item-browser-stat-group-hint';hint.textContent='Numeric → actual value × weight. Presence-only → 1 if present, 0 if absent.';card.append(hint);}
    const list=document.createElement('div');list.className='item-browser-stat-filter-list';group.filters=Array.isArray(group.filters)&&group.filters.length?group.filters:[{name:'',operator:'gte',value:'',min:'',max:'',weight:1}];group.filters.forEach((filter,fi)=>{const row=document.createElement('div');row.className='item-browser-stat-row';const picker=document.createElement('div');picker.className='item-browser-stat-picker';const input=document.createElement('input');input.type='search';input.autocomplete='off';input.placeholder='Search stat…';input.value=filter.name||'';input.title='Search stats. Ranking: pseudo-stats → simple stats → passives → actives.';const menu=document.createElement('div');menu.className='item-browser-stat-menu';menu.hidden=true;let highlighted=-1;const options=()=>{const q=normalizeText(input.value);return catalog.filter(s=>!q||normalizeText(s.name).includes(q));};const renderMenu=()=>{menu.replaceChildren();const opts=options();let last='';const groupNames={pseudo:'Pseudo-stats',general:'General / universal',defensive:'Defensive',offensive:'Offensive',passive:'Passive abilities',active:'Active abilities',meta:'Meta-stats'};opts.forEach((st,i)=>{const section=st.group||st.kind;if(section!==last){const h=document.createElement('div');h.className='item-browser-stat-menu-group';h.textContent=groupNames[section]||section;menu.append(h);last=section;}const b=document.createElement('button');b.type='button';b.className='item-browser-stat-option';b.textContent=st.name;const m=document.createElement('small');m.textContent=st.numeric?'numeric':'presence';b.append(m);b.addEventListener('mousedown',e=>{e.preventDefault();selectOption(st);});menu.append(b);});menu.hidden=!opts.length;input.setAttribute('aria-expanded',String(!menu.hidden));};const selectOption=st=>{filter.name=st.name;filter.statKind=st.kind;filter.numeric=st.numeric;input.value=st.name;menu.hidden=true;input.setAttribute('aria-expanded','false');renderItemBrowserStatFilters(items);commitItemBrowserQuery(true);};input.addEventListener('input',renderMenu);input.addEventListener('focus',renderMenu);input.addEventListener('keydown',e=>{const opts=[...menu.querySelectorAll('.item-browser-stat-option')];if(e.key==='ArrowDown'){e.preventDefault();highlighted=Math.min(highlighted+1,opts.length-1);opts.forEach((o,i)=>o.classList.toggle('highlighted',i===highlighted));}else if(e.key==='ArrowUp'){e.preventDefault();highlighted=Math.max(0,highlighted-1);opts.forEach((o,i)=>o.classList.toggle('highlighted',i===highlighted));}else if(e.key==='Enter'&&highlighted>=0){e.preventDefault();opts[highlighted]?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));}else if(e.key==='Escape'){menu.hidden=true;input.setAttribute('aria-expanded','false');}});input.addEventListener('blur',()=>setTimeout(()=>{menu.hidden=true;input.setAttribute('aria-expanded','false');},0));picker.append(input,menu);row.append(picker);
      const info=getStatInfo(items,filter.name);if(group.type==='weight'){const min=document.createElement('input');min.type='number';min.step='any';min.placeholder=info.numeric?'Min value':'Presence';min.value=info.numeric?(filter.min??''):'';min.disabled=Boolean(filter.name&&!info.numeric);min.title=info.numeric?'Optional minimum numeric value.':'Presence-only: value is automatically 1/0.';const max=document.createElement('input');max.type='number';max.step='any';max.placeholder='Max value';max.value=info.numeric?(filter.max??''):'';max.disabled=Boolean(filter.name&&!info.numeric);max.title='Optional maximum numeric value.';const weight=document.createElement('input');weight.type='number';weight.step='any';weight.placeholder='Weight';weight.value=filter.weight??1;weight.title='Multiplier. Presence-only stats are 1 when present and 0 when absent.';min.addEventListener('input',()=>{filter.min=min.value;commitItemBrowserQuery(false)});max.addEventListener('input',()=>{filter.max=max.value;commitItemBrowserQuery(false)});weight.addEventListener('input',()=>{filter.weight=weight.value;commitItemBrowserQuery(false)});row.append(min,max,weight);}else if(info.exists&&!info.numeric){const presence=document.createElement('span');presence.className='item-browser-stat-presence';presence.textContent='Presence';presence.title='Checks only whether this stat exists on the item.';row.append(presence);}else{const op=document.createElement('select');op.title='Numeric comparison.';[['gte','≥'],['lte','≤'],['eq','='],['gt','>'],['lt','<']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;o.selected=(filter.operator||'gte')===v;op.append(o);});op.addEventListener('change',()=>{filter.operator=op.value;commitItemBrowserQuery(false)});const value=document.createElement('input');value.type='number';value.step='any';value.placeholder='Value';value.value=filter.value??'';value.title='Target numeric value.';value.addEventListener('input',()=>{filter.value=value.value;commitItemBrowserQuery(false)});const max=document.createElement('input');max.type='number';max.step='any';max.placeholder='Max';max.value=filter.max??'';max.title='Optional upper bound.';max.addEventListener('input',()=>{filter.max=max.value;commitItemBrowserQuery(false)});row.append(op,value,max);}const del=document.createElement('button');del.type='button';del.className='item-browser-remove-filter';del.textContent='×';del.title='Remove this stat condition';del.addEventListener('click',()=>{group.filters.splice(fi,1);commitItemBrowserQuery(true)});row.append(del);list.append(row);});card.append(list);const add=document.createElement('button');add.type='button';add.className='item-browser-add-filter';add.textContent='+ Add stat condition';add.title=group.type==='weight'?'Add another stat to the weighted sum.':'Add another condition to this group.';add.addEventListener('click',()=>{group.filters.push({name:'',operator:'gte',value:'',min:'',max:'',weight:1});commitItemBrowserQuery(true)});card.append(add);container.append(card);});
}
function bindItemBrowserInteractions() {
  const f = state.ui.itemBrowser;
  const set = (key, value) => { f[key] = value; commitItemBrowserQuery(); };
  const inputBindings = [
    [elements.itemBrowserMainStat, (v) => set('mainStat', v)],
    [elements.itemBrowserLevelMin, (v) => set('levelMin', v)],
    [elements.itemBrowserLevelMax, (v) => set('levelMax', v)],
  ];
  inputBindings.forEach(([el, fn]) => {
    const apply = () => fn(el.value);
    el?.addEventListener('input', apply);
    el?.addEventListener('change', apply);
  });
  elements.itemBrowserSearch?.addEventListener('input', () => {
    f.query = elements.itemBrowserSearch.value;
    commitItemBrowserQuery(true, false, 'replace');
    clearTimeout(itemBrowserHistory.queryTimer);
    itemBrowserHistory.queryTimer = setTimeout(() => commitItemBrowserQuery(false, false, 'push'), 450);
  });
  elements.itemBrowserSearch?.addEventListener('blur', () => {
    clearTimeout(itemBrowserHistory.queryTimer);
    commitItemBrowserQuery(false, false, 'push');
  });
  elements.itemBrowserSearch?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && state.ui.itemBrowser.instantSearch === false) { event.preventDefault(); executeItemBrowserSearch(); }
  });
  elements.itemBrowserExecute?.addEventListener('click', executeItemBrowserSearch);
  elements.itemBrowserInstant?.addEventListener('change', () => {
    f.instantSearch = elements.itemBrowserInstant.checked;
    if (f.instantSearch) executeItemBrowserSearch();
    else { syncItemBrowserControls(); updateItemBrowserUrlState(); }
  });
  [
    [elements.itemBrowserCategory, 'category'], [elements.itemBrowserQuality, 'quality'],
    [elements.itemBrowserSlot, 'slot'],
  ].forEach(([el, key]) => el?.addEventListener('change', () => set(key, el.value)));

    elements.itemBrowserFullClear?.addEventListener('click', fullClearItemBrowser);
  elements.itemBrowserSort?.addEventListener('change', () => { f.sort = elements.itemBrowserSort.value; f.sortDirection = defaultSortDirection(f.sort); commitItemBrowserQuery(); });
  elements.itemBrowserSortDirection?.addEventListener('change', () => { f.sortDirection = elements.itemBrowserSortDirection.value; commitItemBrowserQuery(); });

  elements.itemBrowserAddStatGroup?.addEventListener('click', () => {
    f.statGroups.push({ type: 'and', filters: [{ name: '', operator: 'gte', value: '', max: '' }] });
    renderItemBrowserStatFilters(state.indexes.playerFacing);
    commitItemBrowserQuery(false, true, 'push');
  });

  document.querySelectorAll('[data-item-obtained]').forEach((el) => el.addEventListener('change', () => {
    f.obtainedBy = [...document.querySelectorAll('[data-item-obtained]:checked')].map((x) => x.value);
    commitItemBrowserQuery();
  }));
  document.querySelectorAll('[data-item-relation]').forEach((el) => {
    const key = el.dataset.itemRelation;
    const event = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(event, () => { f.relations[key] = el.type === 'checkbox' ? el.checked : el.value; commitItemBrowserQuery(); });
  });
  document.querySelector('#item-browser-search-mode')?.addEventListener('change', () => set('searchMode', document.querySelector('#item-browser-search-mode').value));
  document.querySelector('#item-browser-view')?.addEventListener('change', () => set('view', document.querySelector('#item-browser-view').value));
  document.querySelector('#item-browser-save')?.addEventListener('click', saveItemBrowserQuery);
  document.querySelector('#item-browser-copy-link')?.addEventListener('click', copyItemBrowserLink);
}
function commitItemBrowserQuery(renderStats = true, force = false, historyMode = 'push') {
  syncItemBrowserControls();
  if (!state.ui.itemBrowser.instantSearch && !force) return;
  updateItemBrowserUrlState(historyMode);
  if (renderStats) renderItemBrowserStatFilters(state.indexes.playerFacing);
  renderItemBrowser();
}
function executeItemBrowserSearch(historyMode = 'push') {
  updateItemBrowserUrlState(historyMode);
  renderItemBrowserStatFilters(state.indexes.playerFacing);
  renderItemBrowser();
}
function fullClearItemBrowser() {
  clearTimeout(itemBrowserHistory.queryTimer);
  const defaults = createDefaultItemBrowserQuery();
  Object.assign(state.ui.itemBrowser, defaults);
  syncItemBrowserControls();
  renderItemBrowserStatFilters(state.indexes.playerFacing);
  executeItemBrowserSearch('push');
}
function ensureItemBrowserSortOption(sort) {
  const select = elements.itemBrowserSort;
  if(!select || !String(sort||'').startsWith('stat:')) return;
  const key = String(sort).slice(5);
  const exists = [...select.options].some(option => option.value === sort);
  if(exists) return;
  const info = getStatInfo(state.indexes.playerFacing,key);
  if(!info.exists) return;
  const option=document.createElement('option');
  option.value=sort;
  option.textContent=info.name || key;
  select.append(option);
}
function syncItemBrowserControls() {
  const f = state.ui.itemBrowser;
  if (elements.itemBrowserMainStat) elements.itemBrowserMainStat.value = f.mainStat || 'strength';
  if (elements.itemBrowserSearch) elements.itemBrowserSearch.value = f.query;
  if (elements.itemBrowserCategory) elements.itemBrowserCategory.value = f.category;
  if (elements.itemBrowserQuality) elements.itemBrowserQuality.value = f.quality;
  if (elements.itemBrowserSlot) elements.itemBrowserSlot.value = f.slot;
  if (elements.itemBrowserLevelMin) elements.itemBrowserLevelMin.value = f.levelMin;
  if (elements.itemBrowserLevelMax) elements.itemBrowserLevelMax.value = f.levelMax;
  ensureItemBrowserSortOption(f.sort);
  if (elements.itemBrowserSort) elements.itemBrowserSort.value = f.sort;
  if (elements.itemBrowserSortDirection) { elements.itemBrowserSortDirection.innerHTML = sortDirectionOptions(f.sort); elements.itemBrowserSortDirection.value = f.sortDirection || defaultSortDirection(f.sort); }
  document.querySelector('#item-browser-search-mode')?.setAttribute('value', f.searchMode);
  if (document.querySelector('#item-browser-search-mode')) document.querySelector('#item-browser-search-mode').value = f.searchMode;
  if (elements.itemBrowserInstant) elements.itemBrowserInstant.checked = f.instantSearch !== false;
  if (document.querySelector('#item-browser-view')) document.querySelector('#item-browser-view').value = f.view;
  document.querySelectorAll('[data-item-obtained]').forEach((el) => { el.checked = f.obtainedBy.includes(el.value); });
  document.querySelectorAll('[data-item-relation]').forEach((el) => { const v=f.relations[el.dataset.itemRelation]; if (el.type==='checkbox') el.checked=Boolean(v); else el.value=v || ''; });
  elements.itemBrowserClassList?.querySelectorAll('input').forEach((input) => { input.checked = f.classNames.includes(input.value); });
}
function applyItemBrowserHints() {
  const hints = {
    '#item-browser-search': 'Search player-facing items by name, description, tooltip, item type or raw code. Full search also applies the advanced filters below.',
    '#item-browser-search-mode': 'Quick search uses only the text query. Full search combines the text query with facets, relations and stat groups.',
    '#item-browser-category': 'Limit results to an item category.',
    '#item-browser-quality': 'Limit results to a specific item quality.',
    '#item-browser-slot': 'Limit results to wearable equipment slots: Weapon, Armor, Boots, Wings, Essence or Accessory.',
    '#item-browser-level-min': 'Minimum required level. Leave blank for no lower bound.',
    '#item-browser-level-max': 'Maximum required level. Leave blank for no upper bound.',
    '#item-browser-sort': 'Choose how matching items are ordered.',
    '#item-browser-view': 'Choose the amount of information shown in each result row.',
    '#item-browser-save': 'Save the current Item Browser query in local browser storage.',
    '#item-browser-copy-link': 'Copy a URL containing the complete current Item Browser query.',
    '#item-browser-full-clear': 'Reset the entire Item Browser query and return every control to its default state.',
    '#item-browser-add-stat-group': 'Add an advanced stat group. Groups are combined with AND.',
  };
  Object.entries(hints).forEach(([selector, title]) => document.querySelector(selector)?.setAttribute('title', title));
  document.querySelectorAll('[data-item-obtained]').forEach((el) => el.title = `Require the item to be obtainable by ${el.value === 'craft' ? 'crafting' : el.value === 'drop' ? 'monster drop' : 'shop purchase'}.`);
}
function initializeItemBrowser() {
  const items = state.indexes.playerFacing;
  const uniqueValues = (values) => [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  populateSelect(elements.itemBrowserCategory, uniqueValues(items.map(getItemCategory)), 'All categories');
  populateSelect(elements.itemBrowserQuality, uniqueValues(items.map(i=>i.quality)), 'All qualities');
  populateSelect(elements.itemBrowserSlot, uniqueValues(items.filter(isWearableItem).map(i=>i.slot)), 'All wearable slots');
  renderItemBrowserClassFilters(uniqueValues(items.flatMap(i=>Array.isArray(i.allowedClasses)?i.allowedClasses:[])));
  applyItemBrowserHints();
  populateDatalist(document.querySelector('#item-browser-item-options'), uniqueValues(items.map(i=>i.name)));
  populateDatalist(document.querySelector('#item-browser-enemy-options'), uniqueValues(state.data.enemies.map(e=>e.name)));
  populateDatalist(document.querySelector('#item-browser-shop-options'), uniqueValues(items.flatMap(extractShopNames)));
  restoreItemBrowserUrlState();
  itemBrowserHistory.lastCommitted = serializeItemBrowserQuery();
  renderItemBrowserStatFilters(items);
  renderItemBrowser();
  const selected = resolveItemReference(state.ui.itemBrowser.selectedCode);
  if (selected) renderItemDetails(selected, elements.itemBrowserDetails);
}
function normalizeItemBrowserQuery(raw = {}) {
  const defaults = createDefaultItemBrowserQuery();
  const source = raw && typeof raw === 'object' ? raw : {};
  const query = { ...defaults, ...source };
  query.mainStat = ['strength', 'agility', 'intelligence'].includes(query.mainStat) ? query.mainStat : defaults.mainStat;
  query.searchMode = query.searchMode === 'quick' ? 'quick' : 'full';
  query.instantSearch = query.instantSearch !== false;
  query.classNames = Array.isArray(query.classNames) ? query.classNames.filter(Boolean).map(String) : [];
  query.obtainedBy = Array.isArray(query.obtainedBy) ? query.obtainedBy.filter((v) => ['craft', 'drop', 'shop'].includes(v)) : [];
  query.relations = { ...defaults.relations, ...(source.relations && typeof source.relations === 'object' ? source.relations : {}) };
  query.relations.usedIn = Boolean(query.relations.usedIn);
  query.statGroups = Array.isArray(query.statGroups) ? query.statGroups : [];
  query.statGroups = query.statGroups.map((group) => ({
    type: ['and', 'not', 'count', 'if', 'weight'].includes(group?.type) ? group.type : 'and',
    filters: Array.isArray(group?.filters) ? group.filters.map((filter) => ({
      name: typeof filter?.name === 'string' ? filter.name : '',
      operator: ['gte', 'lte', 'eq', 'gt', 'lt'].includes(filter?.operator) ? filter.operator : 'gte',
      value: filter?.value ?? '',
      min: filter?.min ?? '',
      max: filter?.max ?? '',
      weight: filter?.weight ?? 1,
    })) : [],
    min: group?.min ?? '',
    max: group?.max ?? '',
    minSum: group?.minSum ?? group?.min ?? '',
    maxSum: group?.maxSum ?? group?.max ?? '',
  }));
  const legacySort = String(query.sort || '');
  if (legacySort === 'relevance') { query.sort = 'match'; query.sortDirection = 'desc'; }
  else if (legacySort === 'name-asc') { query.sort = 'name'; query.sortDirection = 'asc'; }
  else if (legacySort === 'name-desc') { query.sort = 'name'; query.sortDirection = 'desc'; }
  else if (legacySort === 'level-asc') { query.sort = 'level'; query.sortDirection = 'asc'; }
  else if (legacySort === 'level-desc') { query.sort = 'level'; query.sortDirection = 'desc'; }
  else if (legacySort === 'quality-desc') { query.sort = 'quality'; query.sortDirection = 'desc'; }
  else if (legacySort === 'slot-asc') { query.sort = 'slot'; query.sortDirection = 'asc'; }
  const baseSorts = ['match','name','level','quality','category','slot','recipe-count','usage-count','drop-sources','shop-count'];
  query.sort = (baseSorts.includes(query.sort) || String(query.sort).startsWith('stat:')) ? query.sort : defaults.sort;
  query.sortDirection = ['asc','desc'].includes(query.sortDirection) ? query.sortDirection : defaultSortDirection(query.sort);
  query.view = ['compact', 'detailed', 'summary', 'full', 'superwide'].includes(query.view) ? query.view : defaults.view;
  if (query.view === 'summary') query.view = 'compact';
  if (query.view === 'full' || query.view === 'superwide') query.view = 'detailed';
  query.selectedCode = typeof query.selectedCode === 'string' ? query.selectedCode : '';
  query.whyCode = typeof query.whyCode === 'string' ? query.whyCode : '';
  return query;
}
function getItemBrowserMatchEvaluation(item) {
  const f = state.ui.itemBrowser;
  const query = normalizeText(f.query);
  const searchText = [item.name, item.rawName, item.description, item.plainExtendedTooltip, item.slot, item.rawCode]
    .filter(Boolean)
    .join(' ');

  if (query && !textIncludes(searchText, query)) return { matched: false, score: 0, reasons: [] };
  if (f.searchMode === 'quick') {
    const raw = String(item.name || '').toLowerCase();
    return { matched: true, score: query && raw.startsWith(String(f.query || '').toLowerCase()) ? 100 : 0, reasons: query ? ['Quick search: text matched.'] : [] };
  }

  const reasons = [];
  const fail = (reason) => ({ matched: false, score: 0, reasons: [...reasons, reason] });

  if (f.category && getItemCategory(item) !== f.category) return fail(`Category: expected ${f.category}.`);
  if (f.category) reasons.push(`Category: ${f.category}.`);
  if (f.quality && String(item.quality || '') !== f.quality) return fail(`Quality: expected ${f.quality}.`);
  if (f.quality) reasons.push(`Quality: ${f.quality}.`);
  if (f.slot && String(item.slot || '') !== f.slot) return fail(`Wearable slot: expected ${f.slot}.`);
  if (f.slot) reasons.push(`Wearable slot: ${f.slot}.`);
  if (!rangeMatch(item.requiredLevel ?? 0, f.levelMin, f.levelMax)) return fail(`Required level: outside ${f.levelMin || 'any'}–${f.levelMax || 'any'}.`);
  if (f.levelMin || f.levelMax) reasons.push(`Required level: ${f.levelMin || 'any'}–${f.levelMax || 'any'}.`);

  const classes = new Set(Array.isArray(item.allowedClasses) ? item.allowedClasses : []);
  if (f.classNames.length && !f.classNames.some((name) => classes.has(name))) return fail(`Classes: none of ${f.classNames.join(', ')} are allowed.`);
  if (f.classNames.length) reasons.push(`Allowed class: ${f.classNames.join(' / ')}.`);

  const hasRecipe = Array.isArray(item.recipe) && item.recipe.length > 0;
  const usedBy = state.indexes.usedBy.get(itemKey(item)) || [];
  const drops = extractDropNames(item);
  const shops = extractShopNames(item).filter(() => isActualShopPurchase(item));

  if (f.obtainedBy.length && !f.obtainedBy.some((kind) => kind === 'craft' ? hasRecipe : kind === 'drop' ? drops.length > 0 : shops.length > 0)) {
    return fail(`Obtained by: item has none of ${f.obtainedBy.join(', ')}.`);
  }
  if (f.obtainedBy.length) reasons.push(`Obtained by: ${f.obtainedBy.join(' + ')}.`);

  const r = f.relations;
  if (r.usedIn && !usedBy.length) return fail('Used in recipes: no recorded recipe usage.');
  if (r.usedIn) reasons.push(`Used in recipes: ${usedBy.length} recipe${usedBy.length === 1 ? '' : 's'}.`);
  if (r.craftedFrom && !item.recipe?.some((part) => textIncludes(part?.item?.name || part?.name || '', r.craftedFrom))) return fail(`Crafted from: recipe does not contain “${r.craftedFrom}”.`);
  if (r.craftedFrom) reasons.push(`Crafted from: recipe contains “${r.craftedFrom}”.`);
  if (r.craftsInto && !usedBy.some((entry) => textIncludes(entry?.item?.name || entry?.name || '', r.craftsInto))) return fail(`Crafts into: no target matches “${r.craftsInto}”.`);
  if (r.craftsInto) reasons.push(`Crafts into: target matches “${r.craftsInto}”.`);
  if (r.dropsFrom && !drops.some((name) => textIncludes(name, r.dropsFrom))) return fail(`Drops from: no source matches “${r.dropsFrom}”.`);
  if (r.dropsFrom) reasons.push(`Drops from: source matches “${r.dropsFrom}”.`);
  if (!rangeMatch(drops.length, r.dropCountMin, r.dropCountMax)) return fail(`Drop sources: ${drops.length} is outside the requested range.`);
  if (r.dropCountMin || r.dropCountMax) reasons.push(`Drop sources: ${drops.length}.`);
  if (r.soldBy && !shops.some((name) => textIncludes(name, r.soldBy))) return fail(`Sold by: no shop matches “${r.soldBy}”.`);
  if (r.soldBy) reasons.push(`Sold by: shop matches “${r.soldBy}”.`);
  if (!rangeMatch(shops.length, r.shopCountMin, r.shopCountMax)) return fail(`Shops: ${shops.length} is outside the requested range.`);
  if (r.shopCountMin || r.shopCountMax) reasons.push(`Shops: ${shops.length}.`);

  let score = 0;
  for (const group of f.statGroups) {
    const evaluation = evaluateStatGroup(item, group);
    if (!evaluation.matched) return fail(`${group.type.toUpperCase()}: ${evaluation.reason || 'group failed.'}`);
    score += evaluation.score || 0;
    if (evaluation.reason) reasons.push(`${group.type.toUpperCase()}: ${evaluation.reason}`);
    if (evaluation.details?.length) reasons.push(...evaluation.details.map((detail) => `${group.type.toUpperCase()}: ${detail}`));
  }

  if (query) reasons.unshift(`Text: “${f.query}” matched the searchable item text.`);
  return { matched: true, score, reasons };
}
function defaultSortDirection(sort) {
  return getItemBrowserSortType(sort) === 'text' ? 'asc' : 'desc';
}
function getItemBrowserSortType(sort) {
  if (sort === 'name' || sort === 'category' || sort === 'slot') return 'text';
  if (sort === 'match' || sort === 'level' || sort === 'quality' || sort === 'recipe-count' || sort === 'usage-count' || sort === 'drop-sources' || sort === 'shop-count') return 'numeric';
  if (sort.startsWith('stat:')) {
    const info = getStatInfo(state.indexes.playerFacing, sort.slice(5));
    return info.numeric ? 'numeric' : 'presence';
  }
  return 'presence';
}
function sortDirectionOptions(sort) {
  const type = getItemBrowserSortType(sort);
  if (type === 'text') return '<option value="asc">A → Z</option><option value="desc">Z → A</option>';
  if (type === 'numeric') return '<option value="desc">High → low</option><option value="asc">Low → high</option>';
  return '<option value="desc">Present → absent</option><option value="asc">Absent → present</option>';
}
function getItemBrowserSortValue(entry, sort) {
  const item = entry.item;
  if (sort === 'match') return entry.score;
  if (sort === 'name') return String(item.name || '');
  if (sort === 'level') return Number.isFinite(Number(item.requiredLevel)) ? Number(item.requiredLevel) : null;
  if (sort === 'quality') return ({ Normal:0, Common:1, Uncommon:2, Rare:3, Epic:4, Legendary:5, Mythic:6, Mythical:6 }[item.quality] ?? -1);
  if (sort === 'category') return getItemCategory(item);
  if (sort === 'slot') return String(item.slot || '');
  if (sort === 'recipe-count') return Array.isArray(item.recipe) ? item.recipe.length : 0;
  if (sort === 'usage-count') return (state.indexes.usedBy.get(itemKey(item)) || []).length;
  if (sort === 'drop-sources') return extractDropNames(item).length;
  if (sort === 'shop-count') return extractShopNames(item).filter(() => isActualShopPurchase(item)).length;
  if (sort.startsWith('stat:')) {
    const name = sort.slice(5);
    const info = getStatInfo(state.indexes.playerFacing, name);
    const value = getStatPresenceAndValue(item, name);
    if (!value.present) return null;
    return info.numeric ? value.value : 1;
  }
  return null;
}
function compareNullable(a, b, direction, text = false) {
  const aMissing = a == null || (text && String(a) === '');
  const bMissing = b == null || (text && String(b) === '');
  if (aMissing || bMissing) {
    if (aMissing && bMissing) return 0;
    return aMissing ? 1 : -1; // missing values always last
  }
  const cmp = text ? String(a).localeCompare(String(b)) : Number(a) - Number(b);
  return direction === 'asc' ? cmp : -cmp;
}
function getItemBrowserMatches() {
  const f = state.ui.itemBrowser;
  const matches = state.indexes.playerFacing
    .map((item) => ({ item, ...getItemBrowserMatchEvaluation(item) }))
    .filter((entry) => entry.matched);
  const direction = f.sortDirection || defaultSortDirection(f.sort);
  const textSort = ['name','category','slot'].includes(f.sort);
  matches.sort((a, b) => {
    let primary;
    if (getItemBrowserSortType(f.sort) === 'presence') {
      const statName = f.sort.slice(5);
      const av = f.sort.startsWith('stat:') && getStatPresenceAndValue(a.item, statName).present ? 1 : 0;
      const bv = f.sort.startsWith('stat:') && getStatPresenceAndValue(b.item, statName).present ? 1 : 0;
      primary = direction === 'desc' ? bv - av : av - bv;
    } else {
      primary = compareNullable(getItemBrowserSortValue(a, f.sort), getItemBrowserSortValue(b, f.sort), direction, textSort);
    }
    return primary || String(a.item.name || '').localeCompare(String(b.item.name || ''));
  });
  return matches;
}
function getSearchableResultStats(item) {
  const stats = [];
  const seen = new Set();
  const push = (entry) => {
    const key = normalizeText(entry.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    stats.push(entry);
  };
  parseItemStats(item).forEach(st => {
    if (!st.name) return;
    const info = getStatInfo(state.indexes.playerFacing, st.name);
    push({
      name: st.name,
      value: st.numeric && Number.isFinite(st.value) ? st.value : 1,
      numeric: Boolean(st.numeric),
      percent: Boolean(st.percent),
      kind: 'stat',
      group: info.group || classifySimpleStat(st.name),
      subtype: st.numeric ? (st.dynamic ? 'dynamic' : 'simple') : 'presence',
      dynamic: Boolean(st.dynamic && info.dynamic),
      sortKey: info.canonicalName || st.name,
    });
  });
  PSEUDO_STAT_DEFS.forEach(def => {
    const value = getPseudoStatValues(item)[def.key];
    if (Number.isFinite(value) && value !== 0) push({name:def.name,value,numeric:true,percent:false,kind:'pseudo',group:'attributes',subtype:'simple'});
  });
  META_STAT_DEFS.forEach(def => {
    const value = getMetaStatValue(item, def.key);
    if (def.numeric || value > 0) push({name:def.name,value,numeric:def.numeric,percent:false,kind:'meta',group:'meta',subtype:def.numeric?'simple':'presence'});
  });
  return stats;
}
function resultStatGroups(stats) {
  const labels = {
    attributes:'Attributes',
    general:'General',
    defensive:'Defensive',
    offensive:'Offensive',
    passive:'Passive abilities',
    active:'Active abilities',
    meta:'Meta',
  };
  const order = ['attributes','general','defensive','offensive','passive','active','meta'];
  const groups = new Map();
  stats.forEach(stat => {
    const key = labels[stat.group] ? stat.group : 'general';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(stat);
  });
  return order.filter(key => groups.has(key)).map(key => ({key,label:labels[key],stats:groups.get(key)}));
}
function createResultStatButton(stat, item) {
  const button = document.createElement('button');
  button.type = 'button';
  const statSortKey = normalizeText(stat.sortKey || stat.name);
  const activeSortKey = state.ui.itemBrowser.sort.startsWith('stat:') ? state.ui.itemBrowser.sort.slice(5) : '';
  const isSorted = activeSortKey === statSortKey;
  button.className = `item-browser-result-stat${stat.matched ? ' matched' : ''}${stat.numeric ? ' numeric' : ' presence'}${isSorted ? ' sorted' : ''}`;
  button.dataset.sortKey = statSortKey;
  button.title = stat.numeric ? `Sort results by ${stat.name}.` : `Sort results by whether ${stat.name} is present.`;
  const displayName = stat.dynamic && String(stat.name).includes('#') ? String(stat.name).replace('#', formatNumber(stat.value)) : stat.name;
  const value = stat.numeric && !stat.dynamic ? `: ${formatNumber(stat.value)}${stat.percent ? '%' : ''}` : '';
  button.textContent = `${displayName}${value}`;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const key = stat.sortKey || stat.name;
    const info = getStatInfo(state.indexes.playerFacing, key);
    if (!info.exists) return;
    const normalized = normalizeText(key);
    if (state.ui.itemBrowser.sort === `stat:${normalized}`) {
      state.ui.itemBrowser.sortDirection = state.ui.itemBrowser.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      state.ui.itemBrowser.sort = `stat:${normalized}`;
      state.ui.itemBrowser.sortDirection = 'desc';
    }
    ensureItemBrowserSortOption(state.ui.itemBrowser.sort);
    syncItemBrowserControls();
    updateItemBrowserUrlState('push');
    renderItemBrowser();
  });
  return button;
}
function getDetailedResultStats(item, activeStatNames) {
  const raw = getSearchableResultStats(item).filter(st => st.kind === 'stat').map(st => {
    if(st.dynamic && st.sortKey && st.sortKey !== st.name) return {...st,name:st.sortKey};
    return st;
  });
  const searched = [];
  const seen = new Set(raw.map(st => normalizeText(st.name)));
  const pushSearched = (stat) => {
    const key = normalizeText(stat.name);
    if (!key || seen.has(key) || !activeStatNames.has(key)) return;
    seen.add(key);
    searched.push(stat);
  };
  PSEUDO_STAT_DEFS.forEach(def => {
    const key = normalizeText(def.name);
    if (!activeStatNames.has(key)) return;
    const value = getPseudoStatValues(item)[def.key];
    pushSearched({name:def.name,value,numeric:true,percent:false,kind:'pseudo',group:'attributes',subtype:'simple'});
  });
  META_STAT_DEFS.forEach(def => {
    const key = normalizeText(def.name);
    if (!activeStatNames.has(key)) return;
    const value = getMetaStatValue(item, def.key);
    pushSearched({name:def.name,value:def.numeric ? value : value > 0 ? 1 : 0,numeric:def.numeric,percent:false,kind:'meta',group:'meta',subtype:def.numeric?'simple':'presence'});
  });
  return [...raw, ...searched];
}
function renderResultStatGroups(item, activeStatNames) {
  const wrapper = document.createElement('div');
  wrapper.className = 'item-browser-result-stat-groups';
  const stats = getDetailedResultStats(item, activeStatNames).map(st => ({...st, matched: activeStatNames.has(normalizeText(st.sortKey || st.name)), sortKey:st.sortKey || st.name}));
  resultStatGroups(stats).forEach(group => {
    const section = document.createElement('section');
    section.className = 'item-browser-result-stat-group';
    const heading = document.createElement('h4');
    heading.textContent = group.label;
    section.append(heading);
    const list = document.createElement('div');
    list.className = 'item-browser-result-stat-lines';
    group.stats.forEach(stat => {
      const line = document.createElement('div');
      line.className = `item-browser-result-stat-line${stat.matched ? ' matched' : ''}`;
      line.append(createResultStatButton(stat, item));
      list.append(line);
    });
    section.append(list);
    wrapper.append(section);
  });
  return wrapper;
}
function renderResultAbilityGroups(item) {
  const abilities = extractAbilities(item);
  if (!abilities.length) return null;
  const wrapper = document.createElement('section');
  wrapper.className = 'item-browser-result-ability-groups';
  const heading = document.createElement('h4');
  heading.textContent = 'Abilities';
  wrapper.append(heading);
  const list = document.createElement('div');
  list.className = 'item-browser-result-ability-lines';
  abilities.forEach(ability => {
    const line = document.createElement('div');
    line.className = `item-browser-result-ability-line ${ability.type}`;
    const type = document.createElement('span'); type.className = 'item-browser-result-ability-type'; type.textContent = ability.type === 'active' ? 'Active' : 'Passive';
    const name = document.createElement('button'); name.type='button'; name.className='item-browser-result-ability-name'; name.textContent=ability.name; name.title=`Sort results by presence of ${ability.name}.`;
    name.addEventListener('click', event => {
      event.stopPropagation();
      const normalized = normalizeText(ability.name);
      const same = state.ui.itemBrowser.sort === `stat:${normalized}`;
      state.ui.itemBrowser.sort = `stat:${normalized}`;
      state.ui.itemBrowser.sortDirection = same ? (state.ui.itemBrowser.sortDirection === 'desc' ? 'asc' : 'desc') : 'desc';
      ensureItemBrowserSortOption(state.ui.itemBrowser.sort);
      syncItemBrowserControls(); updateItemBrowserUrlState('push'); renderItemBrowser();
    });
    line.append(type,name);
    if (ability.lines?.length) {
      const details = document.createElement('div'); details.className='item-browser-result-ability-details';
      ability.lines.forEach(text => { const p=document.createElement('div'); p.textContent=text; details.append(p); });
      line.append(details);
    }
    list.append(line);
  });
  wrapper.append(list);
  return wrapper;
}
function renderItemBrowserDebug(item, reasons, score) {
  const box = document.createElement('section');
  box.className = 'item-browser-match-debug';
  const heading = document.createElement('div'); heading.className='item-browser-match-debug-heading';
  const title=document.createElement('strong'); title.textContent='Matched filters';
  const scoreEl=document.createElement('span'); scoreEl.textContent=`Score ${formatNumber(score)}`;
  heading.append(title,scoreEl); box.append(heading);
  const list=document.createElement('div'); list.className='item-browser-match-debug-list';
  reasons.forEach((reason,index)=>{const line=document.createElement('div');line.className='item-browser-match-debug-line';const n=document.createElement('span');n.textContent=`${index+1}.`;const text=document.createElement('span');text.textContent=reason;line.append(n,text);list.append(line);});
  if (!reasons.length) { const empty=document.createElement('div'); empty.className='item-browser-match-debug-empty'; empty.textContent='No explicit filter conditions; the item matched the current search context.'; list.append(empty); }
  box.append(list);
  return box;
}
function renderItemBrowser() {
  document.querySelector('.item-browser-filter-deck')?.classList.toggle('quick-hidden', state.ui.itemBrowser.searchMode === 'quick');
  const container=elements.itemBrowserResults; if(!container)return;
  const matches=getItemBrowserMatches(); const f=state.ui.itemBrowser;
  if(elements.itemBrowserCount)elements.itemBrowserCount.textContent=`${matches.length} result${matches.length===1?'':'s'}`;
  container.className=`item-browser-results item-browser-view-${f.view}`; container.replaceChildren();
  renderItemBrowserSummary();
  if(!matches.length){const e=document.createElement('div');e.className='item-browser-empty';e.innerHTML='<strong>No matching items</strong><span>Try removing a condition or switching to Quick Search.</span>';container.append(e);return;}
  const activeStatNames = new Set(f.statGroups.flatMap(g => (g.filters || []).map(x => normalizeText(x.name)).filter(Boolean)));
  matches.forEach(({item,score,reasons})=>{
    const row=document.createElement('article'); row.className=`item-browser-result-row${itemKey(item)===f.selectedCode?' selected':''}`; row.dataset.code=itemKey(item);
    const main=document.createElement('div'); main.className='item-browser-result-main'; main.setAttribute('role','option'); main.setAttribute('tabindex','0'); main.setAttribute('aria-selected',String(itemKey(item)===f.selectedCode));
    main.append(createIcon(item,'item-browser-icon'));
    const copy=document.createElement('span'); copy.className='item-browser-copy';
    const title=document.createElement('strong'); title.textContent=item.name||'Unnamed item';
    const subtitle=document.createElement('small'); subtitle.textContent=itemSummary(item);
    const tags=document.createElement('span'); tags.className='item-browser-result-tags';
    [getItemCategory(item),item.quality,item.slot,item.requiredLevel?`Lv ${item.requiredLevel}`:''].filter(Boolean).forEach(t=>{const x=document.createElement('span');x.textContent=t;tags.append(x)});
    const statStrip=document.createElement('span'); statStrip.className='item-browser-result-stats';
    const summaryStats=getSearchableResultStats(item).slice(0,3).map(st=>({...st,matched:activeStatNames.has(normalizeText(st.name)),sortKey:st.name}));
    summaryStats.forEach(st=>statStrip.append(createResultStatButton(st,item)));
    const abilities=extractAbilities(item); if(abilities.length){const x=document.createElement('span');x.className='item-browser-result-ability-badge';x.textContent=`${abilities.length} ability${abilities.length===1?'':'ies'}`;x.title=abilities.map(a=>`${a.type}: ${a.name}`).join('\n');statStrip.append(x)}
    copy.append(title,subtitle,tags,statStrip); main.append(copy);
    const side=document.createElement('span'); side.className='item-browser-result-side'; const scoreEl=document.createElement('b'); scoreEl.textContent=`Match ${formatNumber(score)}`; scoreEl.title='Match score from the active query.'; side.append(scoreEl);
    const counts=[]; if(item.recipe?.length)counts.push(`Craft ×${item.recipe.length}`); const used=state.indexes.usedBy.get(itemKey(item))||[]; if(used.length)counts.push(`Used ×${used.length}`); const drops=extractDropNames(item); if(drops.length)counts.push(`Drop ×${drops.length}`); const shops=extractShopNames(item).filter(()=>isActualShopPurchase(item)); if(shops.length)counts.push(`Shop ×${shops.length}`); const rel=document.createElement('small'); rel.textContent=counts.join(' · ')||'No recorded relations'; side.append(rel); main.append(side);
    main.addEventListener('click',(event)=>{ if(event.target.closest('.item-browser-result-stat')) return; selectItemBrowserItem(item); }); main.addEventListener('keydown',(event)=>{ if((event.key==='Enter'||event.key===' ')&&!event.target.closest('.item-browser-result-stat')){ event.preventDefault(); selectItemBrowserItem(item); } }); row.append(main);
    if(f.view==='detailed') {
      row.append(renderResultStatGroups(item,activeStatNames));
      const abilityGroups = renderResultAbilityGroups(item);
      if (abilityGroups) row.append(abilityGroups);
    }
    if(f.whyCode===itemKey(item)) row.append(renderItemBrowserDebug(item,reasons,score));
    const whyBtn=document.createElement('button'); whyBtn.type='button'; whyBtn.className='item-browser-why-button'; whyBtn.textContent=f.whyCode===itemKey(item)?'Hide matched filters':'Matched filters'; whyBtn.title='Open the detailed search-evaluation debug information for this item.'; whyBtn.addEventListener('click',e=>{e.stopPropagation();f.whyCode=f.whyCode===itemKey(item)?'':itemKey(item);renderItemBrowser();}); row.append(whyBtn);
    container.append(row);
  });
}
function renderItemBrowserSummary(){
  const box=document.querySelector('#item-browser-summary'); if(!box)return; box.replaceChildren(); const f=state.ui.itemBrowser; const chips=[];
  const add=(label,clear)=>{const b=document.createElement('button');b.type='button';b.className='item-browser-query-chip';b.innerHTML=`<span>${escapeHtml(label)}</span><b>×</b>`;b.addEventListener('click',clear);chips.push(b)};
  if(f.query)add(`“${f.query}”`,()=>{f.query='';commitItemBrowserQuery()}); if(f.category)add(f.category,()=>{f.category='';commitItemBrowserQuery()}); if(f.quality)add(f.quality,()=>{f.quality='';commitItemBrowserQuery()}); if(f.slot)add(f.slot,()=>{f.slot='';commitItemBrowserQuery()});
  f.classNames.forEach(c=>add(c,()=>{f.classNames=f.classNames.filter(x=>x!==c);commitItemBrowserQuery()})); f.obtainedBy.forEach(c=>add(`Obtained: ${c}`,()=>{f.obtainedBy=f.obtainedBy.filter(x=>x!==c);commitItemBrowserQuery()}));
  const r=f.relations; [['Crafted from',r.craftedFrom,'craftedFrom'],['Crafts into',r.craftsInto,'craftsInto'],['Drops from',r.dropsFrom,'dropsFrom'],['Sold by',r.soldBy,'soldBy']].forEach(([l,v,k])=>{if(v)add(`${l}: ${v}`,()=>{r[k]='';commitItemBrowserQuery()})});
  f.statGroups.forEach((g,i)=>{const n=(g.filters||[]).filter(x=>x.name).length;if(n)add(`${g.type.toUpperCase()} ×${n}`,()=>{f.statGroups.splice(i,1);commitItemBrowserQuery()})});
  box.append(...chips); if(!chips.length){const p=document.createElement('span');p.className='item-browser-summary-empty';p.textContent='No filters — showing all player-facing items.';box.append(p)}
}
function selectItemBrowserItem(item){if(!item)return;state.ui.itemBrowser.selectedCode=itemKey(item);renderItemBrowser();renderItemDetails(item,elements.itemBrowserDetails);updateItemBrowserUrlState();}
function extractDropNames(item) {
  const drops = Array.isArray(item?.monsterDrops) ? item.monsterDrops : [];
  return drops.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (!entry || typeof entry !== 'object') return [];
    return [entry.name, entry.enemyName, entry.enemy, entry.monster].filter(Boolean).map(String);
  });
}
function rangeMatch(value, minRaw, maxRaw) {
  const valueNum = Number(value);
  if (!Number.isFinite(valueNum)) return minRaw === '' && maxRaw === '';
  const min = minRaw === '' ? null : Number(minRaw);
  const max = maxRaw === '' ? null : Number(maxRaw);
  return (min === null || (Number.isFinite(min) && valueNum >= min)) && (max === null || (Number.isFinite(max) && valueNum <= max));
}
function getSearchMode() {
  return elements.searchMode?.value || 'crafting';
}
function getSearchEntries() {
  return state.indexes.searchEntries[getSearchMode()] || state.indexes.searchEntries.crafting;
}
function searchEntryScore(entry, needle) {
  return searchScore({ name: entry.name }, needle);
}
function updateSearch(query) {
  const needle = normalizeText(query);
  state.ui.searchResults = getSearchEntries()
    .map((entry) => ({ entry, score: searchEntryScore(entry, needle) }))
    .filter((result) => result.score < 99)
    .sort((left, right) => left.score - right.score || left.entry.name.localeCompare(right.entry.name))
    .slice(0, 12)
    .map((result) => result.entry);
  state.ui.activeResult = state.ui.searchResults.length ? 0 : -1;
  renderSearchResults();
  elements.results.hidden = false;
  elements.search.setAttribute('aria-expanded', 'true');
}
function renderSearchResults() {
  elements.results.replaceChildren();
  if (!state.ui.searchResults.length) {
    const empty = document.createElement('div');
    empty.className = 'no-results';
    empty.textContent = `No ${searchModeLabel(getSearchMode()).toLocaleLowerCase()} match that search.`;
    elements.results.append(empty);
    return;
  }

  state.ui.searchResults.forEach((entry, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `search-result${index === state.ui.activeResult ? ' active' : ''}`;
    button.id = `search-option-${index}`;
    button.role = 'option';
    button.setAttribute('aria-selected', String(index === state.ui.activeResult));
    button.append(createSearchResultIcon(entry));

    const copy = document.createElement('span');
    copy.className = 'result-copy';
    const name = document.createElement('strong');
    name.textContent = entry.name;
    const meta = document.createElement('small');
    meta.textContent = searchEntrySummary(entry);
    copy.append(name, meta);

    const count = document.createElement('span');
    count.className = 'result-count';
    count.textContent = searchEntryCount(entry);
    button.append(copy, count);
    button.addEventListener('pointerdown', (event) => event.preventDefault());
    button.addEventListener('click', () => selectSearchEntry(entry));
    elements.results.append(button);
  });
  elements.search.setAttribute('aria-activedescendant', `search-option-${state.ui.activeResult}`);
}
function searchModeLabel(mode) {
  switch (mode) {
    case 'enemies': return 'Enemies';
    case 'shops': return 'Shops';
    case 'items': return 'Items';
    case 'everything': return 'Everything';
    case 'everything-technical': return 'Everything + technical';
    default: return 'Crafts';
  }
}
function createSearchResultIcon(entry) {
  if (entry.type === 'item') return createIcon(entry.entity, 'result-placeholder');
  const placeholder = document.createElement('span');
  placeholder.className = 'result-placeholder';
  placeholder.dataset.entityPlaceholder = entry.type === 'enemy' ? 'E' : 'S';
  placeholder.textContent = entry.type === 'enemy' ? 'E' : 'S';
  placeholder.setAttribute('aria-hidden', 'true');
  return placeholder;
}
function searchEntrySummary(entry) {
  if (entry.type === 'enemy') {
    return entry.entity.level != null ? `Level ${entry.entity.level}` : 'Enemy';
  }
  if (entry.type === 'shop') {
    const count = Array.isArray(entry.entity.items) ? entry.entity.items.length : 0;
    return `${count} inventory item${count === 1 ? '' : 's'}`;
  }
  return itemSummary(entry.entity);
}
function searchEntryCount(entry) {
  if (entry.type === 'enemy') {
    const count = Array.isArray(entry.entity.drops) ? entry.entity.drops.length : 0;
    return `${count} drop${count === 1 ? '' : 's'}`;
  }
  if (entry.type === 'shop') {
    return 'Shop';
  }
  return entry.entity.recipe?.length
    ? `${entry.entity.recipe.length} part${entry.entity.recipe.length === 1 ? '' : 's'}`
    : 'Item';
}
function selectSearchEntry(entry) {
  if (entry.type === 'enemy') {
    elements.search.value = entry.name;
    closeResults();
    showMonsterDetails(entry.name);
    return;
  }
  if (entry.type === 'shop') {
    elements.search.value = entry.name;
    closeResults();
    showShopDetails(entry.name);
    return;
  }
  selectItem(entry.entity);
}
function handleSearchKeys(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (elements.results.hidden) updateSearch(elements.search.value);
    if (!state.ui.searchResults.length) return;
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    state.ui.activeResult = (state.ui.activeResult + direction + state.ui.searchResults.length) % state.ui.searchResults.length;
    renderSearchResults();
    document.querySelector(`#search-option-${state.ui.activeResult}`)?.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter' && state.ui.activeResult >= 0) {
    event.preventDefault(); selectSearchEntry(state.ui.searchResults[state.ui.activeResult]);
  } else if (event.key === 'Escape') closeResults();
}
function closeResults() {
  elements.results.hidden = true;
  elements.search.setAttribute('aria-expanded', 'false');
  elements.search.removeAttribute('aria-activedescendant');
}
function searchScore(item, needle) {
  if (!needle) return 10;
  const name = normalizeText(item.name);
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  if (name.split(' ').some((word) => word.startsWith(needle))) return 2;
  return name.includes(needle) ? 3 : 99;
}

  return { bindItemBrowserInteractions, closeResults, createDefaultItemBrowserQuery, getItemBrowserMatchEvaluation, handleSearchKeys, initializeItemBrowser, normalizeItemBrowserQuery, renderItemBrowser, renderItemBrowserStatFilters, syncItemBrowserControls, updateSearch };
}
