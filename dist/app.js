const PLAYER_ITEM_ALLOWLIST = new Set([
  'Aeternalis Crystal (Arcane Mage Tier 4)',
  'Arrow of the Void (Ranger Tier 4)',
  "Belanor's Fractured Sword of Fury (Berserker Tier 4)",
  'Crown of the Blood King (Vampyr Tier 4)',
  'Emblem of Agdar (Werewolf Tier 4)',
  'Orb of Creation (Angel Tier 4)',
  'Skull of Fath (Warlock Tier 4)',
]);

const state = {
  allItems: [], craftedItems: [], byCode: new Map(), selected: null,
  searchResults: [], activeResult: -1, scale: 1, x: 32, y: 32, drag: null,
  ignoreClickUntil: 0,
};

const elements = {
  picker: document.querySelector('#picker'), search: document.querySelector('#item-search'),
  results: document.querySelector('#search-results'), dataNote: document.querySelector('#data-note'),
  selectedCard: document.querySelector('#selected-card'), metrics: document.querySelector('#metrics'),
  materialTotal: document.querySelector('#material-total'), materialsList: document.querySelector('#materials-list'),
  treeTitle: document.querySelector('#tree-title'), viewport: document.querySelector('#tree-viewport'),
  stage: document.querySelector('#tree-stage'), loading: document.querySelector('#loading-state'),
  zoomValue: document.querySelector('#zoom-value'), zoomIn: document.querySelector('#zoom-in'),
  zoomOut: document.querySelector('#zoom-out'), fit: document.querySelector('#fit-tree'),
  gestureHint: document.querySelector('#gesture-hint'),
};

boot();

async function boot() {
  bindInteractions();
  try {
    const response = await fetch('data/items.json');
    if (!response.ok) throw new Error(`Map data returned ${response.status}`);
    const data = await response.json();
    state.allItems = Array.isArray(data.items) ? data.items : [];
    state.byCode = new Map(state.allItems.map((item) => [normalizeCode(item.rawCode), item]));
    state.craftedItems = state.allItems
      .filter((item) => item.recipe?.length && isPlayerFacing(item))
      .sort((left, right) => left.name.localeCompare(right.name));
    registerWebMcpTool();
    elements.dataNote.textContent = `${state.craftedItems.length} crafted items · ${cleanMapName(data.sourceMap)}`;
    elements.loading.hidden = true;

    const requestedCode = normalizeCode(location.hash.slice(1));
    const requested = state.byCode.get(requestedCode);
    const initial = requested?.recipe?.length && isPlayerFacing(requested)
      ? requested : state.craftedItems.find((item) => item.name === 'Injustice Smasher') || state.craftedItems[0];
    if (!initial) throw new Error('No crafted items were found in the map export.');
    selectItem(initial, { updateHash: !requestedCode });
  } catch (error) {
    console.error(error);
    showError('The crafting data could not be loaded. Make sure data/items.json is available with the site.');
  }
}

function bindInteractions() {
  elements.search.addEventListener('focus', () => updateSearch(elements.search.value));
  elements.search.addEventListener('input', () => updateSearch(elements.search.value));
  elements.search.addEventListener('keydown', handleSearchKeys);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== elements.search) {
      event.preventDefault(); elements.search.focus(); elements.search.select();
    }
    if (event.key === 'Escape') closeResults();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!elements.picker.contains(event.target)) closeResults();
  });
  window.addEventListener('hashchange', () => {
    const item = state.byCode.get(normalizeCode(location.hash.slice(1)));
    if (item?.recipe?.length && item.rawCode !== state.selected?.rawCode) selectItem(item, { updateHash: false });
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

function updateSearch(query) {
  const needle = normalizeText(query);
  state.searchResults = state.craftedItems
    .map((item) => ({ item, score: searchScore(item, needle) }))
    .filter((entry) => entry.score < 99)
    .sort((left, right) => left.score - right.score || left.item.name.localeCompare(right.item.name))
    .slice(0, 12).map((entry) => entry.item);
  state.activeResult = state.searchResults.length ? 0 : -1;
  renderSearchResults();
  elements.results.hidden = false;
  elements.search.setAttribute('aria-expanded', 'true');
}

function renderSearchResults() {
  elements.results.replaceChildren();
  if (!state.searchResults.length) {
    const empty = document.createElement('div');
    empty.className = 'no-results'; empty.textContent = 'No crafted items match that search.';
    elements.results.append(empty); return;
  }
  state.searchResults.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `search-result${index === state.activeResult ? ' active' : ''}`;
    button.id = `search-option-${index}`; button.role = 'option';
    button.setAttribute('aria-selected', String(index === state.activeResult));
    button.append(createIcon(item, 'result-placeholder'));
    const copy = document.createElement('span'); copy.className = 'result-copy';
    const name = document.createElement('strong'); name.textContent = item.name;
    const meta = document.createElement('small'); meta.textContent = itemSummary(item);
    copy.append(name, meta);
    const count = document.createElement('span'); count.className = 'result-count';
    count.textContent = `${item.recipe.length} part${item.recipe.length === 1 ? '' : 's'}`;
    button.append(copy, count);
    button.addEventListener('pointerdown', (event) => event.preventDefault());
    button.addEventListener('click', () => selectItem(item));
    elements.results.append(button);
  });
  elements.search.setAttribute('aria-activedescendant', `search-option-${state.activeResult}`);
}

function handleSearchKeys(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (elements.results.hidden) updateSearch(elements.search.value);
    if (!state.searchResults.length) return;
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    state.activeResult = (state.activeResult + direction + state.searchResults.length) % state.searchResults.length;
    renderSearchResults();
    document.querySelector(`#search-option-${state.activeResult}`)?.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter' && state.activeResult >= 0) {
    event.preventDefault(); selectItem(state.searchResults[state.activeResult]);
  } else if (event.key === 'Escape') closeResults();
}

function closeResults() {
  elements.results.hidden = true;
  elements.search.setAttribute('aria-expanded', 'false');
  elements.search.removeAttribute('aria-activedescendant');
}

function selectItem(item, options = {}) {
  state.selected = item;
  elements.search.value = item.name;
  elements.treeTitle.textContent = item.name;
  closeResults();
  if (options.updateHash !== false) history.replaceState(null, '', `#${item.rawCode}`);
  renderSelectedCard(item); renderTree(item); renderMaterials(item);
}

function renderSelectedCard(item) {
  elements.selectedCard.replaceChildren();
  elements.selectedCard.append(createIcon(item, 'selected-placeholder'));
  const copy = document.createElement('div'); copy.className = 'selected-copy';
  const title = document.createElement('h2'); title.textContent = item.name;
  const meta = document.createElement('div'); meta.className = 'item-meta';
  [item.quality, item.slot, item.requiredLevel ? `Level ${item.requiredLevel}` : null].filter(Boolean).forEach((label) => {
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = label; meta.append(tag);
  });
  copy.append(title, meta); elements.selectedCard.append(copy);
  const stats = recipeStats(item);
  elements.metrics.replaceChildren(metric(stats.depth, 'Layers'), metric(stats.nodes, 'Tree items'), metric(stats.baseTypes, 'Base types'));
}

function renderTree(item) {
  elements.stage.replaceChildren();
  const tree = document.createElement('ul'); tree.className = 'recipe-tree';
  tree.append(renderBranch(item, 1, 1, new Set(), true));
  elements.stage.append(tree);
  requestAnimationFrame(fitTree);
}

function renderBranch(item, edgeQuantity, totalQuantity, path, isRoot = false) {
  const listItem = document.createElement('li');
  const code = normalizeCode(item.rawCode);
  const circular = path.has(code);
  const children = circular ? [] : recipeChildren(item);
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `node-card${children.length ? ' craftable' : ''}${isRoot ? ' root' : ''}${circular ? ' cycle' : ''}`;
  card.disabled = !children.length;
  card.append(createIcon(item, 'node-placeholder'));

  if (!isRoot && edgeQuantity > 1) {
    const quantity = document.createElement('span');
    quantity.className = 'quantity-badge'; quantity.textContent = `×${edgeQuantity}`;
    card.append(quantity);
  }
  const name = document.createElement('span'); name.className = 'node-name';
  name.textContent = item.name || 'Unknown ingredient';
  const meta = document.createElement('span'); meta.className = 'node-meta';
  meta.textContent = circular ? 'Circular reference' : children.length
    ? `${children.length} ingredient${children.length === 1 ? '' : 's'}${totalQuantity > edgeQuantity ? ` · ${totalQuantity} total` : ''}`
    : `${item.quality || 'Base material'}${totalQuantity > 1 ? ` · ${totalQuantity} total` : ''}`;
  card.append(name, meta);

  if (children.length) {
    card.setAttribute('aria-expanded', 'true'); card.title = 'Collapse this recipe branch';
    const mark = document.createElement('span'); mark.className = 'collapse-mark';
    mark.textContent = '−'; mark.setAttribute('aria-hidden', 'true'); card.append(mark);
  }
  listItem.append(card);

  if (children.length) {
    const childList = document.createElement('ul');
    const nextPath = new Set(path); nextPath.add(code);
    children.forEach(({ item: ingredient, quantity }) => {
      childList.append(renderBranch(ingredient, quantity, totalQuantity * quantity, nextPath));
    });
    listItem.append(childList);
    card.addEventListener('click', (event) => {
      if (performance.now() < state.ignoreClickUntil) {
        event.preventDefault(); event.stopPropagation(); return;
      }
      event.stopPropagation(); childList.classList.toggle('collapsed');
      const expanded = !childList.classList.contains('collapsed');
      card.setAttribute('aria-expanded', String(expanded));
      card.title = expanded ? 'Collapse this recipe branch' : 'Expand this recipe branch';
      card.querySelector('.collapse-mark').textContent = expanded ? '−' : '+';
    });
  }
  return listItem;
}

function renderMaterials(item) {
  const rows = [...collectBaseMaterials(item).values()]
    .sort((left, right) => right.quantity - left.quantity || left.item.name.localeCompare(right.item.name));
  elements.materialsList.replaceChildren();
  const total = rows.reduce((sum, entry) => sum + entry.quantity, 0);
  elements.materialTotal.textContent = `${rows.length} types · ${total} total`;
  rows.forEach(({ item: material, quantity }) => {
    const row = document.createElement('div'); row.className = 'material-row';
    row.append(createIcon(material, 'material-placeholder'));
    const name = document.createElement('div'); name.className = 'material-name'; name.textContent = material.name;
    const kind = document.createElement('span'); kind.className = 'material-kind';
    kind.textContent = material.quality || 'Base material'; name.append(kind);
    const count = document.createElement('span'); count.className = 'material-qty'; count.textContent = `×${quantity}`;
    row.append(name, count); elements.materialsList.append(row);
  });
}

function collectBaseMaterials(root) {
  const totals = new Map();
  const visit = (item, multiplier, path) => {
    const code = normalizeCode(item.rawCode) || normalizeText(item.name);
    if (path.has(code) || !item.recipe?.length) {
      const existing = totals.get(code) || { item, quantity: 0 };
      existing.quantity += multiplier; totals.set(code, existing); return;
    }
    const nextPath = new Set(path); nextPath.add(code);
    recipeChildren(item).forEach(({ item: ingredient, quantity }) => visit(ingredient, multiplier * quantity, nextPath));
  };
  visit(root, 1, new Set()); return totals;
}

function recipeStats(root) {
  const materials = collectBaseMaterials(root);
  const walk = (item, path) => {
    const code = normalizeCode(item.rawCode) || normalizeText(item.name);
    if (path.has(code) || !item.recipe?.length) return { depth: 1, nodes: 1 };
    const nextPath = new Set(path); nextPath.add(code);
    const childStats = recipeChildren(item).map(({ item: ingredient }) => walk(ingredient, nextPath));
    return { depth: 1 + Math.max(...childStats.map((entry) => entry.depth)), nodes: 1 + childStats.reduce((sum, entry) => sum + entry.nodes, 0) };
  };
  return { ...walk(root, new Set()), baseTypes: materials.size };
}

function recipeChildren(item) {
  return (item.recipe || []).map((ingredient) => ({
    item: state.byCode.get(normalizeCode(ingredient.rawCode)) || { rawCode: ingredient.rawCode, name: ingredient.name || 'Unknown ingredient', recipe: [] },
    quantity: Math.max(1, Number(ingredient.quantity) || 1),
  }));
}

function createIcon(item, placeholderClass) {
  if (item.iconFile) {
    const image = document.createElement('img'); image.src = item.iconFile; image.alt = ''; image.loading = 'lazy';
    image.draggable = false;
    image.addEventListener('error', () => image.replaceWith(createPlaceholder(item, placeholderClass)), { once: true });
    return image;
  }
  return createPlaceholder(item, placeholderClass);
}

function createPlaceholder(item, className) {
  const placeholder = document.createElement('span'); placeholder.className = className;
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.textContent = String(item.name || '?').trim().charAt(0).toUpperCase() || '?'; return placeholder;
}

function metric(value, label) {
  const box = document.createElement('div'); box.className = 'metric';
  const number = document.createElement('strong'); number.textContent = value;
  const caption = document.createElement('span'); caption.textContent = label;
  box.append(number, caption); return box;
}

function fitTree() {
  if (!elements.stage.firstElementChild) return;
  const availableWidth = elements.viewport.clientWidth - 60;
  const availableHeight = elements.viewport.clientHeight - 80;
  const treeWidth = elements.stage.scrollWidth;
  const treeHeight = elements.stage.scrollHeight;
  state.scale = clamp(Math.min(1, availableWidth / treeWidth, availableHeight / treeHeight), .2, 1.35);
  state.x = Math.max(30, (elements.viewport.clientWidth - treeWidth * state.scale) / 2);
  state.y = 34; applyTransform();
}

function zoomAt(factor, centerX = elements.viewport.clientWidth / 2, centerY = elements.viewport.clientHeight / 2) {
  const previous = state.scale;
  const next = clamp(previous * factor, .2, 1.8);
  const stageX = (centerX - state.x) / previous;
  const stageY = (centerY - state.y) / previous;
  state.scale = next; state.x = centerX - stageX * next; state.y = centerY - stageY * next; applyTransform();
}

function handleWheel(event) {
  event.preventDefault();
  const bounds = elements.viewport.getBoundingClientRect();
  zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - bounds.left, event.clientY - bounds.top);
}

function startDrag(event) {
  if (event.button !== 0 || event.target.closest('.view-controls')) return;
  event.preventDefault();
  elements.viewport.setPointerCapture(event.pointerId);
  state.drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: state.x, originY: state.y, moved: false };
}

function moveDrag(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - state.drag.startX;
  const deltaY = event.clientY - state.drag.startY;
  if (!state.drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
  if (!state.drag.moved) {
    state.drag.moved = true; elements.viewport.classList.add('dragging');
  }
  state.x = state.drag.originX + deltaX;
  state.y = state.drag.originY + deltaY; applyTransform();
}

function stopDrag(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  if (state.drag.moved) state.ignoreClickUntil = performance.now() + 180;
  state.drag = null; elements.viewport.classList.remove('dragging');
}

function applyTransform() {
  elements.stage.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  elements.zoomValue.value = `${Math.round(state.scale * 100)}%`;
  elements.zoomValue.textContent = `${Math.round(state.scale * 100)}%`;
}

function searchScore(item, needle) {
  if (!needle) return 10;
  const name = normalizeText(item.name);
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  if (name.split(' ').some((word) => word.startsWith(needle))) return 2;
  return name.includes(needle) ? 3 : 99;
}

function itemSummary(item) {
  return [item.quality, item.slot, item.requiredLevel ? `Level ${item.requiredLevel}` : null].filter(Boolean).join(' · ') || 'Crafted item';
}

function isPlayerFacing(item) {
  const name = String(item.name || '');
  return (!name.includes('(') && !name.includes(')')) || PLAYER_ITEM_ALLOWLIST.has(name);
}

function cleanMapName(value) { return String(value || 'Hellfire RPG').replace(/\.w3x$/i, ''); }
function normalizeText(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function normalizeCode(value) { return String(value || '').trim().toLowerCase(); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

function showError(message) {
  elements.loading.hidden = false; elements.loading.replaceChildren();
  const error = document.createElement('div'); error.className = 'error-state'; error.textContent = message;
  elements.loading.append(error); elements.dataNote.textContent = 'Map data unavailable'; elements.gestureHint.hidden = true;
}

function registerWebMcpTool() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  try {
    void Promise.resolve(context.registerTool({
      name: 'select_crafted_item',
      title: 'Select crafted item',
      description: 'Select a Hellfire RPG crafted item and display its complete recursive ingredient tree.',
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
        const exact = state.craftedItems.find((item) => normalizeText(item.name) === requestedName);
        const matches = exact ? [exact] : state.craftedItems.filter((item) => normalizeText(item.name).includes(requestedName));
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
