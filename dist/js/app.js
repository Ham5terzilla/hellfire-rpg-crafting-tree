import { createData } from './data.js';
import { createModel } from './model.js';
import { createStats } from './stats.js';
import { createRecipes } from './recipes.js';
import { createItems } from './items.js';
import { createSearch } from './search.js';
import { createTree } from './tree.js';
import { createStorage } from './storage.js';

const state = {
  data: { items: [], craftedItems: [], enemies: [] },
  indexes: { byId:new Map(), byCode:new Map(), byName:new Map(), usedBy:new Map(), enemiesByCode:new Map(), enemiesByName:new Map(), shopsByName:new Map(), playerFacing:[], searchEntries:{crafting:[],items:[],enemies:[],shops:[],everything:[], 'everything-technical':[]} },
  cache: { parsedStats:new WeakMap(), abilities:new WeakMap(), statCatalog:null, dynamicStatNames:null },
  ui: { selected:null, searchResults:[], activeResult:-1, activeModule:'recipes', itemBrowser:null },
  craftOwned:new Map(), nestedOwned:new Map(), summaryTab:'materials', nestedExpanded:new Set(), summarySort:{mode:'rarity',quantityOrder:'desc',rarityOrder:'desc'}, summarySyncNested:false, summaryDeprioritizeCompleted:false, summaryDimCompleted:false,
  viewport:{scale:1,x:32,y:32,drag:null},
};

const elements = {
  picker: document.querySelector('#picker'), search: document.querySelector('#item-search'), searchMode: document.querySelector('#search-mode'),
  results: document.querySelector('#search-results'), dataNote: document.querySelector('#database-source'), wearableItemsCount: document.querySelector('#wearable-items-count'), craftableItemsCount: document.querySelector('#craftable-items-count'),
  selectedCard: document.querySelector('#selected-card'), metrics: document.querySelector('#metrics'),
  materialTotal: document.querySelector('#material-total'), materialsList: document.querySelector('#materials-list'),
  nestedCraftingList: document.querySelector('#nested-crafting-list'),
  summaryTitle: document.querySelector('#summary-title'),
  summaryTabMaterials: document.querySelector('#summary-tab-materials'),
  summaryTabNested: document.querySelector('#summary-tab-nested'),
  summarySettingsToggle: document.querySelector('#summary-settings-toggle'),
  summarySettingsPanel: document.querySelector('#summary-settings-panel'),
  summarySortMode: document.querySelector('#summary-sort-mode'),
  summaryQuantityOrder: document.querySelector('#summary-quantity-order'),
  summaryRarityOrder: document.querySelector('#summary-rarity-order'),
  summarySyncNested: document.querySelector('#summary-sync-nested'),
  summaryResetOwned: document.querySelector('#summary-reset-owned'),
  summaryDeprioritizeCompleted: document.querySelector('#summary-deprioritize-completed'),
  summaryDimCompleted: document.querySelector('#summary-dim-completed'),
  treeTitle: document.querySelector('#tree-title'), treePanel: document.querySelector('.tree-panel'), viewport: document.querySelector('#tree-viewport'),
  stage: document.querySelector('#tree-stage'), loading: document.querySelector('#loading-state'),
  zoomValue: document.querySelector('#zoom-value'), zoomIn: document.querySelector('#zoom-in'),
  zoomOut: document.querySelector('#zoom-out'), fit: document.querySelector('#fit-tree'),
  gestureHint: document.querySelector('#gesture-hint'),
  itemDetails: document.querySelector('#item-details'),
  inspector: document.querySelector('.inspector'),
  inspectorResizer: document.querySelector('#inspector-resizer'),
  detailsResizer: document.querySelector('#details-resizer'),
  toggleRecipeMap: document.querySelector('#toggle-recipe-map'),
  layoutSelect: document.querySelector('#layout-select'),
  recipeWorkspace: document.querySelector('#recipe-browser-workspace'),
  itemBrowserWorkspace: document.querySelector('#item-browser-workspace'),
  appNavButtons: [...document.querySelectorAll('.app-nav-button')],
  itemBrowserSearch: document.querySelector('#item-browser-search'),
  itemBrowserFullClear: document.querySelector('#item-browser-full-clear'),
  itemBrowserCategory: document.querySelector('#item-browser-category'),
  itemBrowserQuality: document.querySelector('#item-browser-quality'),
  itemBrowserSlot: document.querySelector('#item-browser-slot'),
  itemBrowserMainStat: document.querySelector('#item-browser-main-stat'),
  itemBrowserLevelMin: document.querySelector('#item-browser-level-min'),
  itemBrowserLevelMax: document.querySelector('#item-browser-level-max'),
  itemBrowserClassList: document.querySelector('#item-browser-class-list'),
  itemBrowserAddStatGroup: document.querySelector('#item-browser-add-stat-group'),
  itemBrowserStatList: document.querySelector('#item-browser-stat-list'),
  itemBrowserSort: document.querySelector('#item-browser-sort'),
  itemBrowserSortDirection: document.querySelector('#item-browser-sort-direction'),
  itemBrowserResults: document.querySelector('#item-browser-results'),
  itemBrowserCount: document.querySelector('#item-browser-count'),
  itemBrowserDetails: document.querySelector('#item-browser-details'),
  itemBrowserSummary: document.querySelector('#item-browser-summary'),
  itemBrowserSearchMode: document.querySelector('#item-browser-search-mode'), itemBrowserInstant: document.querySelector('#item-browser-instant'), itemBrowserExecute: document.querySelector('#item-browser-execute'), itemBrowserView: document.querySelector('#item-browser-view'),
  itemBrowserSave: document.querySelector('#item-browser-save'), itemBrowserCopyLink: document.querySelector('#item-browser-copy-link'),
  itemBrowserBackToTop: document.querySelector('#item-browser-back-to-top'),
};

const constants = {
  DEFAULT_ITEM_CODE:'i09b',
  TREE_ORIENTATION:Object.freeze({NORMAL:'normal',FLIPPED_SOURCE:'flipped-source'}),
  PSEUDO_STAT_DEFS:[
    {name:'Total to Agility',key:'total-agi'}, {name:'Total to Strength',key:'total-str'},
    {name:'Total to Intelligence',key:'total-int'}, {name:'Total to All Stats',key:'total-all'},
    {name:'Total Sum of All Stats',key:'total-sum'},
  ],
  MAIN_STAT_NAMES:Object.freeze({strength:'Strength',agility:'Agility',intelligence:'Intelligence'}),
  META_STAT_DEFS:[
    {name:'Number of defensive stats',key:'defensive-count',kind:'meta',numeric:true},
    {name:'Number of offensive stats',key:'offensive-count',kind:'meta',numeric:true},
    {name:'Number of passive abilities',key:'passive-count',kind:'meta',numeric:true},
    {name:'Number of active abilities',key:'active-count',kind:'meta',numeric:true},
    {name:'Has passive ability',key:'has-passive',kind:'meta',numeric:false},
    {name:'Has active ability',key:'has-active',kind:'meta',numeric:false},
    {name:'Has aura',key:'has-aura',kind:'meta',numeric:false},
  ],
};
const itemBrowserHistory={restoring:false,lastCommitted:'',queryTimer:null};
let dataModule;
let modelModule;
let statsModule;
let recipesModule;
let itemsModule;
let searchModule;
let treeModule;
let storageModule;

const dataDeps = {
  isPlayerFacing: (...args) => modelModule.isPlayerFacing(...args),
  normalizeCode: (...args) => modelModule.normalizeCode(...args),
  normalizeText: (...args) => modelModule.normalizeText(...args),
};

const statsDeps = {
  extractTooltipSection: (...args) => modelModule.extractTooltipSection(...args),
  formatNumber: (...args) => modelModule.formatNumber(...args),
  isPlayerFacing: (...args) => modelModule.isPlayerFacing(...args),
  normalizeText: (...args) => modelModule.normalizeText(...args),
};

const recipesDeps = {
  cleanGameText: (...args) => modelModule.cleanGameText(...args),
  createIcon: (...args) => itemsModule.createIcon(...args),
  isPlayerFacing: (...args) => modelModule.isPlayerFacing(...args),
  itemKey: (...args) => modelModule.itemKey(...args),
  loadSummarySettings: (...args) => storageModule.loadSummarySettings(...args),
  normalizeCode: (...args) => modelModule.normalizeCode(...args),
  normalizeText: (...args) => modelModule.normalizeText(...args),
  resolveItemReference: (...args) => dataModule.resolveItemReference(...args),
  saveSummarySettings: (...args) => storageModule.saveSummarySettings(...args),
  showItemDetails: (...args) => itemsModule.showItemDetails(...args),
};

const itemsDeps = {
  cleanGameText: (...args) => modelModule.cleanGameText(...args),
  escapeHtml: (...args) => modelModule.escapeHtml(...args),
  extractTooltipSection: (...args) => modelModule.extractTooltipSection(...args),
  tooltipSectionsExcept: (...args) => modelModule.tooltipSectionsExcept(...args),
  extractActiveAbilities: (...args) => statsModule.extractActiveAbilities(...args),
  findEnemyByName: (...args) => dataModule.findEnemyByName(...args),
  findItemByName: (...args) => dataModule.findItemByName(...args),
  resolveItemReference: (...args) => dataModule.resolveItemReference(...args),
  findOreForProspect: (...args) => recipesModule.findOreForProspect(...args),
  formatNumber: (...args) => modelModule.formatNumber(...args),
  formatStatKey: (...args) => statsModule.formatStatKey(...args),
  formatStatValue: (...args) => statsModule.formatStatValue(...args),
  getWorldMiningSource: (...args) => recipesModule.getWorldMiningSource(...args),
  normalizeCode: (...args) => modelModule.normalizeCode(...args),
  recipeStats: (...args) => recipesModule.recipeStats(...args),
  recipesUsing: (...args) => recipesModule.recipesUsing(...args),
  scrollTreeIntoViewOnMobile: (...args) => treeModule.scrollTreeIntoViewOnMobile(...args),
  selectItem: (...args) => treeModule.selectItem(...args),
  showEnemyTree: (...args) => treeModule.showEnemyTree(...args),
  showShopTree: (...args) => treeModule.showShopTree(...args),
  switchModule,
};

const searchDeps = {
  escapeHtml: (...args) => modelModule.escapeHtml(...args),
  classifySimpleStat: (...args) => statsModule.classifySimpleStat(...args),
  copyItemBrowserLink: (...args) => storageModule.copyItemBrowserLink(...args),
  createIcon: (...args) => itemsModule.createIcon(...args),
  evaluateStatGroup: (...args) => statsModule.evaluateStatGroup(...args),
  extractAbilities: (...args) => statsModule.extractAbilities(...args),
  extractShopNames: (...args) => itemsModule.extractShopNames(...args),
  formatNumber: (...args) => modelModule.formatNumber(...args),
  getItemCategory: (...args) => modelModule.getItemCategory(...args),
  getMetaStatValue: (...args) => statsModule.getMetaStatValue(...args),
  getPseudoStatValues: (...args) => statsModule.getPseudoStatValues(...args),
  getStatCatalog: (...args) => statsModule.getStatCatalog(...args),
  getStatInfo: (...args) => statsModule.getStatInfo(...args),
  getStatPresenceAndValue: (...args) => statsModule.getStatPresenceAndValue(...args),
  isActualShopPurchase: (...args) => dataModule.isActualShopPurchase(...args),
  isWearableItem: (...args) => modelModule.isWearableItem(...args),
  itemKey: (...args) => modelModule.itemKey(...args),
  itemSummary: (...args) => modelModule.itemSummary(...args),
  normalizeText: (...args) => modelModule.normalizeText(...args),
  parseItemStats: (...args) => statsModule.parseItemStats(...args),
  renderItemDetails: (...args) => itemsModule.renderItemDetails(...args),
  restoreItemBrowserUrlState: (...args) => storageModule.restoreItemBrowserUrlState(...args),
  saveItemBrowserQuery: (...args) => storageModule.saveItemBrowserQuery(...args),
  selectItem: (...args) => treeModule.selectItem(...args),
  serializeItemBrowserQuery: (...args) => storageModule.serializeItemBrowserQuery(...args),
  showMonsterDetails: (...args) => itemsModule.showMonsterDetails(...args),
  showShopDetails: (...args) => itemsModule.showShopDetails(...args),
  updateItemBrowserUrlState: (...args) => storageModule.updateItemBrowserUrlState(...args),
  resolveItemReference: (...args) => dataModule.resolveItemReference(...args),
};

const storageDeps = {
  resolveItemReference: (...args) => dataModule.resolveItemReference(...args),
  normalizeItemBrowserQuery: (...args) => searchModule.normalizeItemBrowserQuery(...args),
  renderItemBrowser: (...args) => searchModule.renderItemBrowser(...args),
  renderItemBrowserStatFilters: (...args) => searchModule.renderItemBrowserStatFilters(...args),
  syncItemBrowserControls: (...args) => searchModule.syncItemBrowserControls(...args),
};

const treeDeps = {
  beginQuickViewRecipe: (...args) => recipesModule.beginQuickViewRecipe(...args),
  clamp: (...args) => modelModule.clamp(...args),
  closeResults: (...args) => searchModule.closeResults(...args),
  craftingUsageCount: (...args) => recipesModule.craftingUsageCount(...args),
  createEntityPlaceholder: (...args) => itemsModule.createEntityPlaceholder(...args),
  createIcon: (...args) => itemsModule.createIcon(...args),
  findEnemyByName: (...args) => dataModule.findEnemyByName(...args),
  hasCraftingUsages: (...args) => recipesModule.hasCraftingUsages(...args),
  itemKey: (...args) => modelModule.itemKey(...args),
  normalizeCode: (...args) => modelModule.normalizeCode(...args),
  recipeChildren: (...args) => recipesModule.recipeChildren(...args),
  recipesUsing: (...args) => recipesModule.recipesUsing(...args),
  renderItemDetails: (...args) => itemsModule.renderItemDetails(...args),
  renderMaterials: (...args) => recipesModule.renderMaterials(...args),
  renderSelectedCard: (...args) => itemsModule.renderSelectedCard(...args),
  showItemDetails: (...args) => itemsModule.showItemDetails(...args),
  showMonsterDetails: (...args) => itemsModule.showMonsterDetails(...args),
  showShopDetails: (...args) => itemsModule.showShopDetails(...args),
  switchModule,
};

const applySummaryTab = (...args) => recipesModule.applySummaryTab(...args);
const bindItemBrowserInteractions = (...args) => searchModule.bindItemBrowserInteractions(...args);
const bindSummarySettings = (...args) => recipesModule.bindSummarySettings(...args);
const adaptDatabase = (...args) => dataModule.adaptDatabase(...args);
const buildIndexes = (...args) => dataModule.buildIndexes(...args);
const cleanMapName = (...args) => modelModule.cleanMapName(...args);
const closeResults = (...args) => searchModule.closeResults(...args);
const fitTree = (...args) => treeModule.fitTree(...args);
const handleSearchKeys = (...args) => searchModule.handleSearchKeys(...args);
const handleWheel = (...args) => treeModule.handleWheel(...args);
const initializeItemBrowser = (...args) => searchModule.initializeItemBrowser(...args);
const isPlayerFacing = (...args) => modelModule.isPlayerFacing(...args);
const isWearableItem = (...args) => modelModule.isWearableItem(...args);
const itemKey = (...args) => modelModule.itemKey(...args);
const moveDrag = (...args) => treeModule.moveDrag(...args);
const normalizeCode = (...args) => modelModule.normalizeCode(...args);
const normalizeText = (...args) => modelModule.normalizeText(...args);
const recipeStats = (...args) => recipesModule.recipeStats(...args);
const renderItemBrowser = (...args) => searchModule.renderItemBrowser(...args);
const restoreItemBrowserHistoryState = (...args) => storageModule.restoreItemBrowserHistoryState(...args);
const selectItem = (...args) => treeModule.selectItem(...args);
const showItemDetails = (...args) => itemsModule.showItemDetails(...args);
const startDrag = (...args) => treeModule.startDrag(...args);
const stopDrag = (...args) => treeModule.stopDrag(...args);
const updateSearch = (...args) => searchModule.updateSearch(...args);
const validateDataSchema = (...args) => dataModule.validateDataSchema(...args);
const zoomAt = (...args) => treeModule.zoomAt(...args);

function decodeHashReference(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

async function boot() {
  // JSON stays external: the UI can evolve independently of the source dataset.
  bindInteractions();
  try {
    const response = await fetch('data/items.json');
    if (!response.ok) throw new Error(`Map data returned ${response.status}`);
    const data = await response.json();
    const database = adaptDatabase(data);
    state.data.items = database.items;
    state.data.enemies = database.enemies;
    buildIndexes();
    recipesModule.buildUsedByIndex();
    initializeItemBrowser();
    registerWebMcpTool();
    updateDatabaseHeader(database);
    elements.loading.hidden = true;

    const requestedReference = decodeHashReference(location.hash);
    const requested = dataModule.resolveItemReference(requestedReference);
    const initial = requested?.recipe?.length && isPlayerFacing(requested)
      ? requested : state.indexes.byCode.get(constants.DEFAULT_ITEM_CODE) || state.data.craftedItems[0];
    if (!initial) throw new Error('No crafted items were found in the map export.');
    selectItem(initial, { updateHash: !requested });
  } catch (error) {
    console.error(error);
    showError('The crafting data could not be loaded. Make sure data/items.json is available with the site.');
  }
}

function bindInteractions() {
  elements.appNavButtons.forEach((button) => {
    button.addEventListener('click', () => switchModule(button.dataset.module || 'recipes'));
  });

  bindItemBrowserInteractions();
  const itemBrowserScroller = document.querySelector('.item-browser-list-panel');
  elements.itemBrowserBackToTop?.addEventListener('click', () => {
    itemBrowserScroller?.scrollTo({ top: 0, behavior: 'smooth' });
  });
  if (elements.selectedCard) {
    elements.selectedCard.setAttribute('role', 'button');
    elements.selectedCard.setAttribute('tabindex', '0');
    elements.selectedCard.setAttribute('aria-label', 'Open selected item details');
    elements.selectedCard.addEventListener('click', () => {
      if (state.ui.selected) showItemDetails(state.ui.selected);
    });
    elements.selectedCard.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (state.ui.selected) showItemDetails(state.ui.selected);
      }
    });
  }

  if (elements.summaryTabMaterials && elements.summaryTabNested) {
    elements.summaryTabMaterials.addEventListener('click', () => {
      state.summaryTab = 'materials';
      applySummaryTab();
    });
    elements.summaryTabNested.addEventListener('click', () => {
      state.summaryTab = 'nested';
      applySummaryTab();
    });
  }
  bindSummarySettings();
  bindPanelResizers();
  bindRecipeMapToggle();
  bindWorkspaceLayout();
  elements.searchMode.addEventListener('change', () => {
    closeResults();
    elements.search.value = '';
    updateSearch('');
    elements.search.focus();
  });
  elements.search.addEventListener('focus', () => updateSearch(elements.search.value));
  elements.search.addEventListener('input', () => updateSearch(elements.search.value));
  elements.search.addEventListener('keydown', handleSearchKeys);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== elements.search && document.activeElement !== elements.itemBrowserSearch) {
      event.preventDefault();
      const target = state.ui.activeModule === 'items' ? elements.itemBrowserSearch : elements.search;
      target?.focus();
      target?.select();
    }
    if (event.key === 'Escape') closeResults();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!elements.picker.contains(event.target)) closeResults();
  });
  window.addEventListener('hashchange', () => {
    const item = dataModule.resolveItemReference(decodeHashReference(location.hash));
    if (item?.recipe?.length && itemKey(item) !== itemKey(state.ui.selected)) selectItem(item, { updateHash: false });
  });
  window.addEventListener('popstate', () => {
    if (state.ui.activeModule === 'items') restoreItemBrowserHistoryState();
  });
  elements.zoomIn.addEventListener('click', () => zoomAt(1.18));
  elements.zoomOut.addEventListener('click', () => zoomAt(1 / 1.18));
  elements.fit.addEventListener('click', fitTree);
  elements.viewport.addEventListener('wheel', handleWheel, { passive: false });
  elements.viewport.addEventListener('pointerdown', startDrag);
  elements.viewport.addEventListener('pointermove', moveDrag);
  elements.viewport.addEventListener('pointerup', stopDrag);
  elements.viewport.addEventListener('pointercancel', stopDrag);
  elements.viewport.addEventListener('dragstart', (event) => event.preventDefault());
}

function switchModule(moduleName) {
  const next = moduleName === 'items' ? 'items' : 'recipes';
  state.ui.activeModule = next;
  closeResults();
  const isItems = next === 'items';

  elements.recipeWorkspace.hidden = isItems;
  elements.recipeWorkspace.style.display = isItems ? 'none' : '';
  elements.itemBrowserWorkspace.hidden = !isItems;
  elements.itemBrowserWorkspace.style.display = isItems ? 'grid' : 'none';
  document.body.dataset.module = next;
  if (elements.picker) elements.picker.hidden = isItems;
  if (elements.layoutSelect) elements.layoutSelect.closest('.layout-control')?.toggleAttribute('hidden', isItems);
  if (elements.toggleRecipeMap) elements.toggleRecipeMap.hidden = isItems;

  elements.appNavButtons.forEach((button) => {
    const active = button.dataset.module === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (isItems) {
    renderItemBrowser();
    requestAnimationFrame(() => elements.itemBrowserSearch?.focus());
  }
}

function bindPanelResizers() {
  const workspace = elements.inspector?.parentElement;
  if (!workspace) return;

  const isDesktop = () => window.matchMedia('(min-width: 981px)').matches;
  const LAYOUT = Object.freeze({ minSide: 280, minMap: 180, gutter: 16, maxSide: 700 });

  function getPanels() {
    return {
      inspector: elements.inspector,
      details: document.querySelector('.details-panel'),
      map: elements.treePanel,
    };
  }

  function getWidths() {
    const panels = getPanels();
    return {
      inspector: panels.inspector?.getBoundingClientRect().width || 0,
      details: panels.details?.getBoundingClientRect().width || 0,
    };
  }

  function applyWidths(inspectorWidth, detailsWidth) {
    if (!isDesktop()) return;
    const hidden = workspace.classList.contains('recipe-map-hidden');
    const total = workspace.getBoundingClientRect().width || window.innerWidth;
    let left = Math.round(Number(inspectorWidth));
    let right = Math.round(Number(detailsWidth));

    if (!Number.isFinite(left) || !Number.isFinite(right)) return;

    if (hidden) {
      const available = Math.max(LAYOUT.minSide * 2, total - 8);
      left = Math.max(LAYOUT.minSide, Math.min(available - LAYOUT.minSide, left));
      right = Math.max(LAYOUT.minSide, available - left);
    } else {
      const maxSideTotal = Math.max(LAYOUT.minSide * 2, total - LAYOUT.minMap - LAYOUT.gutter);
      left = Math.max(LAYOUT.minSide, Math.min(LAYOUT.maxSide, left));
      right = Math.max(LAYOUT.minSide, Math.min(LAYOUT.maxSide, right));
      if (left + right > maxSideTotal) {
        const excess = left + right - maxSideTotal;
        if (left >= right) left -= excess;
        else right -= excess;
        left = Math.max(LAYOUT.minSide, left);
        right = Math.max(LAYOUT.minSide, right);
      }
    }

    workspace.style.setProperty('--inspector-width', `${left}px`);
    workspace.style.setProperty('--details-width', `${right}px`);
  }

  function bindResizer(handle, panelKey) {
    if (!handle) return;
    handle.setAttribute('aria-valuemin', String(LAYOUT.minSide));
    handle.setAttribute('aria-valuemax', String(LAYOUT.maxSide));

    let pointerId = null;
    let startX = 0;
    let startWidth = 0;
    let boundarySign = 1;

    const getPanel = () => panelKey === 'inspector' ? elements.inspector : document.querySelector('.details-panel');

    const stopResize = () => {
      document.body.classList.remove('resizing-panels');
      if (pointerId !== null) handle.releasePointerCapture?.(pointerId);
      pointerId = null;
    };

    handle.addEventListener('pointerdown', (event) => {
      if (!isDesktop()) return;
      const panel = getPanel();
      if (!panel) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      startX = event.clientX;
      startWidth = rect.width;
      const handleCenter = handle.getBoundingClientRect().left + handle.getBoundingClientRect().width / 2;
      const panelCenter = rect.left + rect.width / 2;
      // Right boundary: drag right to grow. Left boundary: drag left to grow.
      boundarySign = handleCenter >= panelCenter ? 1 : -1;
      pointerId = event.pointerId;
      handle.setPointerCapture?.(pointerId);
      document.body.classList.add('resizing-panels');
    });

    handle.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return;
      const delta = event.clientX - startX;
      const next = startWidth + delta * boundarySign;
      const widths = getWidths();
      applyWidths(panelKey === 'inspector' ? next : widths.inspector,
                  panelKey === 'details' ? next : widths.details);
    });

    handle.addEventListener('pointerup', (event) => {
      if (pointerId !== event.pointerId) return;
      const widths = getWidths();
      const value = panelKey === 'inspector' ? widths.inspector : widths.details;
      storageModule.set(panelKey === 'inspector' ? 'hellfire-inspector-width' : 'hellfire-details-width', Math.round(value));
      stopResize();
      requestAnimationFrame(() => { if (!workspace.classList.contains('recipe-map-hidden')) fitTree(); });
    });
    handle.addEventListener('pointercancel', stopResize);

    handle.addEventListener('keydown', (event) => {
      if (!isDesktop() || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const widths = getWidths();
      const current = panelKey === 'inspector' ? widths.inspector : widths.details;
      const delta = (event.key === 'ArrowRight' ? 20 : -20) * boundarySign;
      applyWidths(panelKey === 'inspector' ? current + delta : widths.inspector,
                  panelKey === 'details' ? current + delta : widths.details);
      const updated = getWidths();
      storageModule.set(panelKey === 'inspector' ? 'hellfire-inspector-width' : 'hellfire-details-width', Math.round(panelKey === 'inspector' ? updated.inspector : updated.details));
      requestAnimationFrame(() => { if (!workspace.classList.contains('recipe-map-hidden')) fitTree(); });
    });
  }

  const savedLeft = storageModule.getNumber('hellfire-inspector-width');
  const savedRight = storageModule.getNumber('hellfire-details-width');
  if (savedLeft !== null) workspace.style.setProperty('--inspector-width', `${Math.round(savedLeft)}px`);
  if (savedRight !== null) workspace.style.setProperty('--details-width', `${Math.round(savedRight)}px`);

  bindResizer(elements.inspectorResizer, 'inspector');
  bindResizer(elements.detailsResizer, 'details');

  if (window.ResizeObserver && elements.viewport) {
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!workspace.classList.contains('recipe-map-hidden')) fitTree();
      });
    });
    observer.observe(workspace);
    observer.observe(elements.viewport);
  }
}

function applyWorkspaceLayout(layout) {
  const workspace = elements.inspector?.parentElement;
  if (!workspace) return;
  const layouts = {
    'summary-map-details': ['inspector','inspector-resizer','tree','details-resizer','details'],
    'map-summary-details': ['tree','inspector-resizer','inspector','details-resizer','details'],
    'summary-details-map': ['inspector','inspector-resizer','details','details-resizer','tree'],
    'details-summary-map': ['details','details-resizer','inspector','inspector-resizer','tree'],
    'map-details-summary': ['tree','details-resizer','details','inspector-resizer','inspector'],
    'details-map-summary': ['details','details-resizer','tree','inspector-resizer','inspector'],
  };
  const order = layouts[layout] || layouts['summary-map-details'];
  const nodes = {
    inspector: elements.inspector,
    'inspector-resizer': elements.inspectorResizer,
    tree: elements.treePanel,
    'details-resizer': elements.detailsResizer,
    details: document.querySelector('.details-panel'),
  };
  order.forEach((key, index) => {
    if (nodes[key]) nodes[key].style.order = String(index + 1);
  });
  workspace.dataset.layout = layout;
  if (elements.layoutSelect && elements.layoutSelect.value !== layout) elements.layoutSelect.value = layout;
  storageModule.set('hellfire-workspace-layout', layout);

  const hidden = workspace.classList.contains('recipe-map-hidden');
  if (hidden) {
    const visible = order.filter(key => key === 'inspector' || key === 'details');
    visible.forEach((key, index) => { if (nodes[key]) nodes[key].style.order = String(index * 2 + 1); });
    if (elements.inspectorResizer) {
      elements.inspectorResizer.style.order = '2';
      elements.inspectorResizer.style.display = 'block';
    }
    if (elements.detailsResizer) elements.detailsResizer.style.display = 'none';
  } else {
    if (elements.inspectorResizer) elements.inspectorResizer.style.display = 'block';
    if (elements.detailsResizer) elements.detailsResizer.style.display = '';
  }
  requestAnimationFrame(() => {
    if (!hidden) fitTree();
  });
}

function bindWorkspaceLayout() {
  if (!elements.layoutSelect) return;
  let layout = 'summary-map-details';
  layout = storageModule.get('hellfire-workspace-layout') || layout;
  applyWorkspaceLayout(layout);
  elements.layoutSelect.addEventListener('change', () => applyWorkspaceLayout(elements.layoutSelect.value));
}

function bindRecipeMapToggle() {
  const button = elements.toggleRecipeMap;
  const workspace = elements.inspector?.parentElement;
  if (!button || !workspace) return;
  const storageKey = 'hellfire-recipe-map-hidden';

  const apply = (hidden) => {
    workspace.classList.toggle('recipe-map-hidden', hidden);
    button.textContent = hidden ? 'Show map' : 'Hide map';
    button.setAttribute('aria-pressed', String(hidden));
    button.setAttribute('aria-label', hidden ? 'Show recipe map' : 'Hide recipe map');
    button.title = hidden ? 'Show recipe map' : 'Hide recipe map';
    if (elements.treePanel) elements.treePanel.setAttribute('aria-hidden', String(hidden));

    if (hidden) {
      // In the two-panel mode the map disappears completely. The remaining
      // panels fill the workspace, while the single middle divider controls
      // their ratio.
      const total = workspace.getBoundingClientRect().width || window.innerWidth;
      const available = Math.max(560, total - 8);
      const currentLeft = elements.inspector?.getBoundingClientRect().width || 0;
      const left = Math.max(280, Math.min(available - 280, Math.round(currentLeft)));
      const right = Math.max(280, Math.round(available - left));
      workspace.style.setProperty('--inspector-width', `${left}px`);
      workspace.style.setProperty('--details-width', `${right}px`);
    } else {
      const left = storageModule.getNumber('hellfire-inspector-width');
      const right = storageModule.getNumber('hellfire-details-width');
      if (left !== null) workspace.style.setProperty('--inspector-width', `${Math.round(left)}px`);
      else workspace.style.removeProperty('--inspector-width');
      if (right !== null) workspace.style.setProperty('--details-width', `${Math.round(right)}px`);
      else workspace.style.removeProperty('--details-width');
    }
    requestAnimationFrame(() => {
      const layout = workspace.dataset.layout || elements.layoutSelect?.value || 'summary-map-details';
      applyWorkspaceLayout(layout);
      if (!hidden) fitTree();
    });
  };

  let hidden = false;
  hidden = storageModule.get(storageKey) === '1';
  apply(hidden);
  button.addEventListener('click', () => {
    hidden = !hidden;
    apply(hidden);
    storageModule.set(storageKey, hidden ? '1' : '0');
  });
}

function updateDatabaseHeader(data = state.data) {
  const playerItems = state.indexes.playerFacing;
  const wearableCount = playerItems.filter(isWearableItem).length;
  const craftableCount = state.data.craftedItems.length;
  if (elements.wearableItemsCount) elements.wearableItemsCount.textContent = String(wearableCount);
  if (elements.craftableItemsCount) elements.craftableItemsCount.textContent = String(craftableCount);
  if (elements.dataNote) elements.dataNote.textContent = cleanMapName(data.sourceMap);
}

function showError(message) {
  elements.loading.hidden = false; elements.loading.replaceChildren();
  const error = document.createElement('div'); error.className = 'error-state'; error.textContent = message;
  elements.loading.append(error); if (elements.dataNote) elements.dataNote.textContent = 'Hellfire RPG'; elements.gestureHint.hidden = true;
}

function registerWebMcpTool() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  try {
    void Promise.resolve(context.registerTool({
      name: 'select_crafted_item',
      title: 'Select crafted item',
      description: 'Select a Hellfire RPG crafted item and display its complete recursive ingredient and upgrade trees.',
      inputSchema: {
        type: 'object',
        properties: { itemName: { type: 'string', description: 'The crafted item name to select.' } },
        required: ['itemName'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const requestedName = normalizeText(input?.itemName);
        if (!requestedName) throw new Error('itemName is required.');
        const exact = state.data.craftedItems.find((item) => normalizeText(item.name) === requestedName);
        const matches = exact ? [exact] : state.data.craftedItems.filter((item) => normalizeText(item.name).includes(requestedName));
        if (matches.length !== 1) {
          throw new Error(matches.length ? `More than one crafted item matches "${input.itemName}".` : `No crafted item matches "${input.itemName}".`);
        }
        selectItem(matches[0]);
        const stats = recipeStats(matches[0]);
        return { item: matches[0].name, layers: stats.depth, treeItems: stats.nodes, baseMaterialTypes: stats.baseTypes };
      },
    })).catch((error) => console.warn('WebMCP registration failed:', error));
  } catch (error) {
    console.warn('WebMCP registration failed:', error);
  }
}

modelModule = createModel({});
dataModule = createData({ state, deps: dataDeps });
statsModule = createStats({ state, constants, deps: statsDeps });
storageModule = createStorage({ state, itemBrowserHistory, deps: storageDeps });
recipesModule = createRecipes({ state, elements, deps: recipesDeps });
treeModule = createTree({ state, elements, constants, deps: treeDeps });
itemsModule = createItems({ state, elements, deps: itemsDeps });
searchModule = createSearch({ state, elements, itemBrowserHistory, constants, deps: searchDeps });
state.ui.itemBrowser = searchModule.createDefaultItemBrowserQuery();
boot();
