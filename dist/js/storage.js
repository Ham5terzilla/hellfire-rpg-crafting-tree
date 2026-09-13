export function createStorage(ctx) {
  const { state, itemBrowserHistory } = ctx;
  const { normalizeItemBrowserQuery, renderItemBrowser, renderItemBrowserStatFilters, resolveItemReference, syncItemBrowserControls } = ctx.deps;


function serializeItemBrowserQuery() {
  const f=state.ui.itemBrowser;
  return JSON.stringify({mainStat:f.mainStat||'strength',query:f.query,searchMode:f.searchMode,instantSearch:f.instantSearch!==false,category:f.category,quality:f.quality,slot:f.slot,classNames:f.classNames,levelMin:f.levelMin,levelMax:f.levelMax,obtainedBy:f.obtainedBy,relations:f.relations,statGroups:f.statGroups,sort:f.sort,sortDirection:f.sortDirection,view:f.view,selectedCode:f.selectedCode});
}
function updateItemBrowserUrlState(historyMode = 'replace') {
  const params = new URLSearchParams(location.search);
  const query = serializeItemBrowserQuery();
  params.set('itemQuery', query);
  ['mainStat','itemSearch','itemCategory','itemQuality','itemSlot','itemClass','craftedFrom','craftsInto','usedIn','itemLevelMin','itemLevelMax','craftable','droppable','purchasable','dropSource','shopSource','dropCountMin','dropCountMax','shopCountMin','shopCountMax','itemStatGroups','itemSort','itemSelected','statMode','statCount','itemStats'].forEach(k=>params.delete(k));
  const url=`${location.pathname}${params.toString()?`?${params.toString()}`:''}${location.hash}`;
  if (itemBrowserHistory.restoring) { try { history.replaceState({itemBrowser:true,query},'',url); } catch {} return; }
  if (historyMode === 'push' && query !== itemBrowserHistory.lastCommitted) {
    try { history.pushState({itemBrowser:true,query},'',url); } catch {}
  } else {
    try { history.replaceState({itemBrowser:true,query},'',url); } catch {}
  }
  itemBrowserHistory.lastCommitted = query;
}
function restoreItemBrowserUrlState() {
  const params = new URLSearchParams(location.search);
  const raw = params.get('itemQuery');
  if (raw) {
    try {
      const q=normalizeItemBrowserQuery(JSON.parse(raw));
      Object.assign(state.ui.itemBrowser, q);
    } catch { /* ignore malformed shared state */ }
  } else if ([...params.keys()].some((key) => key.startsWith('item') || ['mainStat','craftable','droppable','purchasable','craftedFrom','craftsInto','usedIn','dropSource','dropCountMin','dropCountMax','shopSource','shopCountMin','shopCountMax'].includes(key))) {
    // Backward compatibility with the previous Item Browser URL format.
    state.ui.itemBrowser.mainStat=params.get('mainStat')||'strength';
    state.ui.itemBrowser.query=params.get('itemSearch')||'';
    state.ui.itemBrowser.category=params.get('itemCategory')||'';
    state.ui.itemBrowser.quality=params.get('itemQuality')||'';
    state.ui.itemBrowser.slot=params.get('itemSlot')||'';
    state.ui.itemBrowser.classNames=(params.get('itemClass')||'').split(',').filter(Boolean);
    state.ui.itemBrowser.levelMin=params.get('itemLevelMin')||''; state.ui.itemBrowser.levelMax=params.get('itemLevelMax')||'';
    state.ui.itemBrowser.obtainedBy=[params.get('craftable')==='1'?'craft': '',params.get('droppable')==='1'?'drop':'',params.get('purchasable')==='1'?'shop':''].filter(Boolean);
    state.ui.itemBrowser.relations={craftedFrom:params.get('craftedFrom')||'',craftsInto:params.get('craftsInto')||'',usedIn:params.get('usedIn')==='1',dropsFrom:params.get('dropSource')||'',dropCountMin:params.get('dropCountMin')||'',dropCountMax:params.get('dropCountMax')||'',soldBy:params.get('shopSource')||'',shopCountMin:params.get('shopCountMin')||'',shopCountMax:params.get('shopCountMax')||''};
    const legacy=params.get('itemStatGroups'); if(legacy){try{state.ui.itemBrowser.statGroups=JSON.parse(legacy)||[]}catch{}}
    state.ui.itemBrowser.sort=params.get('itemSort')||'relevance'; state.ui.itemBrowser.selectedCode=params.get('itemSelected')||'';
  } else {
    loadSavedItemBrowserQuery();
  }
  Object.assign(state.ui.itemBrowser, normalizeItemBrowserQuery(state.ui.itemBrowser));
  const selected = resolveItemReference(state.ui.itemBrowser.selectedCode);
  if (selected) state.ui.itemBrowser.selectedCode = String(selected.id);
  syncItemBrowserControls();
}
function restoreItemBrowserHistoryState() {
  itemBrowserHistory.restoring = true;
  try { restoreItemBrowserUrlState(); renderItemBrowserStatFilters(state.indexes.playerFacing); renderItemBrowser(); } finally { itemBrowserHistory.restoring = false; itemBrowserHistory.lastCommitted = serializeItemBrowserQuery(); }
}
function loadSavedItemBrowserQuery(){
  try {
    const raw = get('hellfire.itemBrowserQuery');
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state.ui.itemBrowser, normalizeItemBrowserQuery(saved));
  } catch {}
}
function saveItemBrowserQuery(){try{set('hellfire.itemBrowserQuery',JSON.stringify(state.ui.itemBrowser));}catch{} }
function copyItemBrowserLink(){updateItemBrowserUrlState();navigator.clipboard?.writeText(location.href).then(()=>{const b=document.querySelector('#item-browser-copy-link');if(b){const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,900)}}).catch(()=>{});}
function saveSummarySettings() {
  try {
    set('hellfire-summary-settings', JSON.stringify({
      sort: state.summarySort,
      sync: state.summarySyncNested,
      deprioritizeCompleted: state.summaryDeprioritizeCompleted,
      dimCompleted: state.summaryDimCompleted,
    }));
  } catch {}
}
function get(key) {
  try { return localStorage.getItem(String(key)); } catch { return null; }
}
function set(key, value) {
  try { localStorage.setItem(String(key), String(value)); return true; } catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(String(key)); return true; } catch { return false; }
}
function getNumber(key, fallback = null) {
  const raw = get(key);
  if (raw == null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function loadSummarySettings() {
  try {
    const raw = JSON.parse(get('hellfire-summary-settings') || '{}');
    if (raw?.sort) {
      const oldMode = raw.sort.mode;
      const migratedMode = oldMode === 'quantity-rarity' ? 'quantity' : 'rarity';
      const quantityOrder = raw.sort.quantityOrder
        || (oldMode === 'quantity-rarity' ? raw.sort.primary : raw.sort.secondary)
        || 'desc';
      const rarityOrder = raw.sort.rarityOrder
        || (oldMode === 'quantity-rarity' ? raw.sort.secondary : raw.sort.primary)
        || 'desc';
      state.summarySort = { ...state.summarySort, mode: migratedMode, quantityOrder, rarityOrder };
    }
    state.summarySyncNested = Boolean(raw?.sync);
    state.summaryDeprioritizeCompleted = Boolean(raw?.deprioritizeCompleted);
    state.summaryDimCompleted = Boolean(raw?.dimCompleted);
  } catch {}
}

  return { copyItemBrowserLink, get, getNumber, loadItemBrowserQuery: loadSavedItemBrowserQuery, loadSummarySettings, remove, restoreItemBrowserHistoryState, restoreItemBrowserUrlState, saveItemBrowserQuery, saveSummarySettings, serializeItemBrowserQuery, set, updateItemBrowserUrlState };
}
