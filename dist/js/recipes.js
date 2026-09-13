export function createRecipes(ctx) {
  const { state, elements } = ctx;
  const { cleanGameText, createIcon, isPlayerFacing, itemKey, loadSummarySettings, normalizeCode, normalizeText, resolveItemReference, saveSummarySettings, showItemDetails } = ctx.deps;


function getOwnedQuantity(item) {
  const code = itemKey(item);
  return Math.max(0, Number(state.craftOwned.get(code)) || 0);
}
function setOwnedQuantity(item, quantity) {
  writeOwnedQuantity(item, quantity);
  renderMaterials(state.ui.selected);
}
function writeOwnedQuantity(item, quantity) {
  const code = itemKey(item);
  if (!code) return;
  const next = Math.max(0, Math.floor(Number(quantity) || 0));
  if (next === 0) state.craftOwned.delete(code);
  else state.craftOwned.set(code, next);
}
function getNestedEntityQuantity(key) {
  return Math.max(0, Math.floor(Number(state.nestedOwned.get(String(key))) || 0));
}
function writeNestedEntityQuantity(key, quantity) {
  const next = Math.max(0, Math.floor(Number(quantity) || 0));
  const normalized = String(key || '');
  if (!normalized) return;
  if (next === 0) state.nestedOwned.delete(normalized);
  else state.nestedOwned.set(normalized, next);
}
function buildNestedEntities(root) {
  const entities = [];
  function visit(item, required, key, depth, ancestorCodes, parentKey = null, perParent = 1) {
    if (!item) return;
    const code = itemKey(item);
    const cycle = !code || ancestorCodes.has(code);
    const entity = { item, required: Math.max(1, Math.floor(Number(required) || 1)), key, depth, parentKey, perParent, cycle, children: [] };
    entities.push(entity);
    if (cycle || !item.recipe?.length) return;
    const nextCodes = new Set(ancestorCodes); nextCodes.add(code);
    recipeChildren(item).forEach(({ item: child, quantity }, index) => {
      const childKey = `${key}/${index}`;
      const edge = Math.max(1, Math.floor(Number(quantity) || 1));
      const childEntity = visit(child, entity.required * edge, childKey, depth + 1, nextCodes, key, edge);
      if (childEntity) entity.children.push(childEntity);
    });
    return entity;
  }
  recipeChildren(root).forEach(({ item, quantity }, index) => visit(item, quantity, String(index), 0, new Set(), null, 1));
  return entities;
}
function cascadeNestedEntityQuantity(item, key, units) {
  const amount = Math.max(0, Math.floor(Number(units) || 0));
  writeNestedEntityQuantity(key, amount);
  if (!item?.recipe?.length) return;
  const code = itemKey(item);
  const walk = (node, parentKey, multiplier, pathCodes) => {
    const nodeCode = itemKey(node);
    if (!nodeCode || pathCodes.has(nodeCode) || !node.recipe?.length) return;
    const nextCodes = new Set(pathCodes); nextCodes.add(nodeCode);
    recipeChildren(node).forEach(({ item: child, quantity }, index) => {
      const childKey = `${parentKey}/${index}`;
      const childAmount = amount * multiplier * Math.max(1, Math.floor(Number(quantity) || 1));
      writeNestedEntityQuantity(childKey, childAmount);
      walk(child, childKey, multiplier * Math.max(1, Math.floor(Number(quantity) || 1)), nextCodes);
    });
  };
  walk(item, key, 1, new Set([code]));
}
function reconcileNestedEntityAncestors(root, changedKey) {
  const entities = buildNestedEntities(root);
  const byKey = new Map(entities.map((entity) => [entity.key, entity]));
  let current = byKey.get(String(changedKey || ''));

  // Reconcile only the strict parent chain of the occurrence that changed.
  // Sibling occurrences are independent entities and must never be recalculated
  // merely because another occurrence of the same item was edited.
  while (current?.parentKey != null) {
    const parent = byKey.get(current.parentKey);
    if (!parent || parent.cycle || !parent.children.length) break;

    let craftable = Infinity;
    for (const child of parent.children) {
      const childOwned = getNestedEntityQuantity(child.key);
      craftable = Math.min(craftable, Math.floor(childOwned / Math.max(1, child.perParent)));
    }
    const next = Number.isFinite(craftable)
      ? Math.max(0, Math.min(parent.required, craftable))
      : 0;
    writeNestedEntityQuantity(parent.key, next);
    current = parent;
  }
  return byKey;
}
function setNestedEntityQuantity(item, key, required, quantity) {
  const maxRequired = Math.max(1, Math.floor(Number(required) || 1));
  const next = Math.max(0, Math.min(maxRequired, Math.floor(Number(quantity) || 0)));
  const isCraftable = Boolean(item?.recipe?.length);

  // A direct edit of a craftable occurrence is an explicit statement that this
  // particular parent occurrence exists in the requested amount. Propagate it
  // down its own path, but do not immediately run the reverse solver over the
  // same node: that would allow an incomplete sibling occurrence to snap the
  // just-entered parent back to zero. Leaf edits, on the other hand, derive
  // their strict ancestors from the available child quantities.
  if (isCraftable) {
    cascadeNestedEntityQuantity(item, key, next);
  } else {
    writeNestedEntityQuantity(key, next);
    if (state.ui.selected) reconcileNestedEntityAncestors(state.ui.selected, key);
  }
  renderMaterials(state.ui.selected);
}
function clearOwnedQuantities() {
  state.craftOwned.clear();
  state.nestedOwned.clear();
}
function beginQuickViewRecipe(item) {
  // Quick-view ownership is temporary and scoped to the currently selected recipe.
  // Switching recipes always starts from 0 and does not become persistent planner data.
  clearOwnedQuantities();
}
function resetAllOwnedQuantities() {
  clearOwnedQuantities();
  state.nestedExpanded = new Set();
  renderMaterials(state.ui.selected);
}
function createOwnedControl(item, required, compact = false, options = {}) {
  const wrap = document.createElement('div');
  wrap.className = `owned-control${compact ? ' compact' : ''}`;
  const maxRequired = Math.max(1, Math.floor(Number(required) || 1));
  const readQuantity = typeof options.getQuantity === 'function' ? options.getQuantity : () => getOwnedQuantity(item);
  const writeQuantity = typeof options.setQuantity === 'function' ? options.setQuantity : (value) => setOwnedQuantity(item, value);
  const owned = Math.min(readQuantity(), maxRequired);
  const readOnly = Boolean(options.readOnly);
  const displayQuantity = Number.isFinite(Number(options.displayQuantity))
    ? Math.max(0, Math.floor(Number(options.displayQuantity)))
    : owned;
  const displayTotal = Number.isFinite(Number(options.displayTotal))
    ? Math.max(1, Math.floor(Number(options.displayTotal)))
    : maxRequired;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'owned-check';
  checkbox.checked = displayQuantity >= displayTotal;
  checkbox.disabled = readOnly;
  checkbox.title = readOnly
    ? `Progress: ${displayQuantity} / ${displayTotal}`
    : (checkbox.checked ? 'Mark as not owned' : 'Mark as done');
  if (!readOnly) {
    checkbox.addEventListener('click', (event) => event.stopPropagation());
    checkbox.addEventListener('change', () => {
      writeQuantity(checkbox.checked ? maxRequired : 0);
    });
  }
  wrap.append(checkbox);

  const controls = document.createElement('span');
  controls.className = 'owned-quantity-controls';

  // Every view uses the same 0/required input model, including items that need
  // only one unit. This keeps the control predictable and guarantees 1/1 is visible.
  const value = document.createElement('input');
  value.type = 'number';
  value.className = 'owned-value';
  value.min = '0';
  value.max = String(displayTotal);
  value.step = '1';
  value.inputMode = 'numeric';
  value.value = String(displayQuantity);
  value.readOnly = readOnly;
  value.title = readOnly
    ? `Progress: ${displayQuantity} / ${displayTotal}.`
    : `Enter a number or use the mouse wheel. Current: ${owned} / ${maxRequired}.`;
  value.setAttribute('aria-label', `${readOnly ? 'Progress' : 'Owned'} quantity of ${item?.name || 'item'}, maximum ${displayTotal}`);
  if (!readOnly) {
    value.addEventListener('click', (event) => event.stopPropagation());
    value.addEventListener('change', (event) => {
      event.stopPropagation();
      const parsed = Number(value.value);
      const current = readQuantity();
      writeQuantity(Number.isFinite(parsed)
        ? Math.min(maxRequired, Math.max(0, Math.floor(parsed)))
        : current);
    });
    value.addEventListener('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = Math.min(readQuantity(), maxRequired);
      const delta = event.deltaY < 0 ? 1 : -1;
      writeQuantity(Math.min(maxRequired, Math.max(0, current + delta)));
    }, { passive: false });
  }
  controls.append(value);

  const requiredLabel = document.createElement('span');
  requiredLabel.className = 'owned-required';
  requiredLabel.textContent = `/ ${displayTotal}`;
  requiredLabel.title = `Required total: ${displayTotal}`;
  controls.append(requiredLabel);

  wrap.append(controls);
  return wrap;
}
function rarityRank(item) {
  const value = normalizeText(item?.quality || item?.rarity || '');
  // Hellfire RPG rarity progression, from lowest to highest.
  const ranks = new Map([
    ['junk', 0],
    ['basic', 1],
    ['magical', 2],
    ['rare', 3],
    ['epic', 4],
    ['legendary', 5],
    ['mythical', 6],
    ['mythic', 6],
    ['artifact', 7],
  ]);

  if (!value) return 0;
  if (ranks.has(value)) return ranks.get(value);

  for (const [name, rank] of ranks) {
    if (value.includes(name)) return rank;
  }
  return 0;
}
function summaryEntryCompleted(entry) {
  const total = state.summarySyncNested ? Number(entry.requiredTotal || 0) : Number(entry.quantity || 0);
  const acquired = state.summarySyncNested ? Number(entry.acquired || 0) : Number(getOwnedQuantity(entry.item) || 0);
  return total > 0 && acquired >= total;
}
function compareSummaryEntries(left, right) {
  if (state.summaryDeprioritizeCompleted) {
    const leftDone = summaryEntryCompleted(left);
    const rightDone = summaryEntryCompleted(right);
    if (leftDone !== rightDone) return leftDone ? 1 : -1;
  }

  // The selected criterion is always the primary sort. The other criterion is
  // only a tie-breaker. Quantity means the required amount for this recipe,
  // not the amount already collected. This keeps sorting stable in sync mode.
  const primaryKey = state.summarySort.mode === 'quantity' ? 'quantity' : 'rarity';
  const secondaryKey = primaryKey === 'quantity' ? 'rarity' : 'quantity';
  const direction = (key) => key === 'quantity' ? state.summarySort.quantityOrder : state.summarySort.rarityOrder;
  const value = (entry, key) => {
    if (key === 'quantity') return state.summarySyncNested ? Number(entry.requiredTotal || 0) : Number(entry.quantity || 0);
    return rarityRank(entry.item);
  };

  for (const key of [primaryKey, secondaryKey]) {
    const a = value(left, key);
    const b = value(right, key);
    if (a !== b) return direction(key) === 'asc' ? a - b : b - a;
  }
  return String(left.item.name || '').localeCompare(String(right.item.name || ''));
}
function bindSummarySettings() {
  loadSummarySettings();
  if (elements.summarySortMode) elements.summarySortMode.value = state.summarySort.mode;
  if (elements.summaryQuantityOrder) elements.summaryQuantityOrder.value = state.summarySort.quantityOrder;
  if (elements.summaryRarityOrder) elements.summaryRarityOrder.value = state.summarySort.rarityOrder;
  if (elements.summarySyncNested) elements.summarySyncNested.checked = state.summarySyncNested;
  if (elements.summaryDeprioritizeCompleted) elements.summaryDeprioritizeCompleted.checked = state.summaryDeprioritizeCompleted;
  if (elements.summaryDimCompleted) elements.summaryDimCompleted.checked = state.summaryDimCompleted;

  elements.summarySettingsToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = !elements.summarySettingsPanel.hidden;
    elements.summarySettingsPanel.hidden = open;
    elements.summarySettingsToggle.setAttribute('aria-expanded', String(!open));
  });
  // Every summary-setting control follows the same pattern: read its value/checked
  // state into `state`, persist, then re-render. Declare the mapping once instead
  // of repeating the same three-line handler six times.
  const settingBindings = [
    { element: elements.summarySortMode, apply: () => { state.summarySort.mode = elements.summarySortMode.value === 'quantity' ? 'quantity' : 'rarity'; } },
    { element: elements.summaryQuantityOrder, apply: () => { state.summarySort.quantityOrder = elements.summaryQuantityOrder.value; } },
    { element: elements.summaryRarityOrder, apply: () => { state.summarySort.rarityOrder = elements.summaryRarityOrder.value; } },
    { element: elements.summarySyncNested, apply: () => { state.summarySyncNested = elements.summarySyncNested.checked; } },
    { element: elements.summaryDeprioritizeCompleted, apply: () => { state.summaryDeprioritizeCompleted = elements.summaryDeprioritizeCompleted.checked; } },
    { element: elements.summaryDimCompleted, apply: () => { state.summaryDimCompleted = elements.summaryDimCompleted.checked; } },
  ];
  settingBindings.forEach(({ element, apply }) => {
    element?.addEventListener('change', () => {
      apply();
      saveSummarySettings();
      renderMaterials(state.ui.selected);
    });
  });

  elements.summaryResetOwned?.addEventListener('click', () => resetAllOwnedQuantities());
}
function renderMaterials(item) {
  const source = state.summarySyncNested ? collectSyncedBaseMaterials(item) : collectBaseMaterials(item);
  const rows = [...source.values()].sort(compareSummaryEntries);
  elements.materialsList.replaceChildren();
  elements.nestedCraftingList.replaceChildren();

  const total = rows.reduce((sum,e) => sum + (state.summarySyncNested ? e.requiredTotal : e.quantity), 0);
  elements.materialTotal.textContent = `${rows.length} types · ${total} total`;

  rows.forEach(({item: material, quantity, requiredTotal, acquired}) => {
    const row = document.createElement('button');
    row.type='button'; row.className='material-row';
    if (state.summaryDimCompleted && summaryEntryCompleted({ item: material, quantity, requiredTotal, acquired })) row.classList.add('completed-material');
    row.title=`Show details for ${material.name || 'item'}`;
    row.append(createIcon(material,'material-placeholder'));

    const name=document.createElement('div'); name.className='material-name'; name.textContent=material.name;
    const kind=document.createElement('span'); kind.className='material-kind';
    kind.textContent=material.quality || 'Base material'; name.append(kind);
    const control = state.summarySyncNested
      ? createOwnedControl(material, Math.max(1, requiredTotal || quantity), false, {
          readOnly: true,
          displayQuantity: Math.max(0, Math.min(acquired || 0, requiredTotal || quantity)),
          displayTotal: Math.max(1, requiredTotal || quantity),
        })
      : createOwnedControl(material, quantity);
    if (state.summarySyncNested) control.classList.add('sync-display');
    row.append(name, control);
    row.addEventListener('click',()=>showItemDetails(material));
    elements.materialsList.append(row);
  });

  renderNestedCrafting(item);
  applySummaryTab();
}
function collectSyncedBaseMaterials(root) {
  // Sync mode is derived from the Nested Crafting occurrence tree itself.
  // Every occurrence has its own path key, so equal item codes in different
  // branches never share progress. A parent's owned amount implies the same
  // proportional amount of every descendant; an explicitly owned child can
  // only increase that effective amount, never erase progress inherited from
  // its parent. Base Materials then aggregates the effective leaf quantities
  // of all occurrences with the same item code.
  const totals = new Map();

  function visit(item, required, key, inheritedUnits, ancestorCodes) {
    if (!item) return;
    const ownUnits = getNestedEntityQuantity(key);
    const effectiveUnits = Math.max(ownUnits, Math.max(0, Number(inheritedUnits) || 0));
    const cappedUnits = Math.min(Math.max(1, Math.floor(Number(required) || 1)), Math.floor(effectiveUnits));
    const code = itemKey(item);
    if (!code || ancestorCodes.has(code)) return;

    if (!item.recipe?.length) {
      const existing = totals.get(code) || {
        item,
        quantity: 0,
        requiredTotal: 0,
        acquired: 0,
      };
      existing.requiredTotal += Math.max(1, Math.floor(Number(required) || 1));
      existing.acquired += cappedUnits;
      totals.set(code, existing);
      return;
    }

    const nextAncestors = new Set(ancestorCodes);
    nextAncestors.add(code);
    recipeChildren(item).forEach(({ item: child, quantity }, index) => {
      const edge = Math.max(1, Math.floor(Number(quantity) || 1));
      const childRequired = Math.max(1, Math.floor(Number(required) || 1)) * edge;
      const childInherited = cappedUnits * edge;
      visit(child, childRequired, `${key}/${index}`, childInherited, nextAncestors);
    });
  }

  recipeChildren(root).forEach(({ item, quantity }, index) => {
    const required = Math.max(1, Math.floor(Number(quantity) || 1));
    visit(item, required, String(index), 0, new Set());
  });

  for (const entry of totals.values()) {
    entry.acquired = Math.max(0, Math.min(entry.requiredTotal, entry.acquired));
    entry.quantity = entry.acquired;
  }
  return totals;
}
function renderNestedCrafting(root) {
  const container = elements.nestedCraftingList;
  if (!root?.recipe?.length) {
    const note = document.createElement('div'); note.className = 'empty-note';
    note.textContent = 'This item has no crafting requirements.'; container.append(note); return;
  }
  const tree = document.createElement('div'); tree.className = 'nested-tree';
  recipeChildren(root).forEach(({ item, quantity }, index) => {
    tree.append(createNestedCraftRow(item, quantity, 0, [String(index)], new Set()));
  });
  container.append(tree);
}
function createNestedCraftRow(item, required, depth, path, ancestorPath) {
  const row = document.createElement('div'); row.className = 'nested-row';
  row.style.setProperty('--nested-depth', depth);
  const branchKey = path.join('/');
  const requiredAmount = Math.max(1, Math.floor(Number(required) || 1));
  const nestedOwned = getNestedEntityQuantity(branchKey);
  if (state.summaryDimCompleted && nestedOwned >= requiredAmount) row.classList.add('completed-material');
  const code = itemKey(item);
  const hasRecipe = Boolean(item.recipe?.length);
  const cycle = ancestorPath.has(code);
  const expanded = hasRecipe && !cycle && state.nestedExpanded.has(branchKey);

  const children = document.createElement('div'); children.className = 'nested-children';
  children.hidden = !expanded;
  const line = document.createElement('div'); line.className = 'nested-line';

  const expand = document.createElement('button');
  expand.type = 'button'; expand.className = 'nested-expand';
  expand.textContent = hasRecipe && !cycle ? (expanded ? '−' : '+') : '·';
  expand.disabled = !hasRecipe || cycle;
  expand.setAttribute('aria-expanded', String(expanded));
  expand.setAttribute('aria-label', hasRecipe && !cycle ? `${expanded ? 'Collapse' : 'Expand'} ${item.name}` : 'No sub-recipe');
  line.append(expand);

  const itemButton = document.createElement('button');
  itemButton.type = 'button'; itemButton.className = 'nested-item';
  itemButton.title = `Show details for ${item.name || 'item'}`;
  itemButton.append(createIcon(item, 'nested-placeholder'));

  const copy = document.createElement('span'); copy.className = 'nested-copy';
  const name = document.createElement('strong'); name.textContent = item.name || 'Unknown item';
  const meta = document.createElement('small');
  meta.textContent = required > 1 ? `Required ×${required}` : (hasRecipe ? 'Craftable' : 'Base material');
  copy.append(name, meta); itemButton.append(copy);

  // Checkbox is deliberately placed immediately before the item/icon.
  const ownedControl = createOwnedControl(item, requiredAmount, true, {
    getQuantity: () => getNestedEntityQuantity(branchKey),
    setQuantity: (value) => setNestedEntityQuantity(item, branchKey, requiredAmount, value),
  });
  const quantityControls = ownedControl.querySelector('.owned-quantity-controls');
  if (quantityControls) quantityControls.classList.add('nested-quantity');
  // Keep the complete ownership control inside the item card. This prevents
  // the quantity field from creating a dead grid area outside the card and
  // guarantees the checkbox, value and required amount share the card background.
  itemButton.prepend(ownedControl);
  line.append(itemButton);
  row.append(line, children);

  itemButton.addEventListener('click', (event) => { event.stopPropagation(); showItemDetails(item); });

  if (hasRecipe && !cycle) {
    const populate = () => {
      if (children.childElementCount) return;
      const nextAncestorPath = new Set(ancestorPath); nextAncestorPath.add(code);
      // Child quantities are multiplied by the number of this item required by the parent.
      recipeChildren(item).forEach(({ item: child, quantity }, index) => {
        const totalRequired = required * quantity;
        children.append(createNestedCraftRow(child, totalRequired, depth + 1, [...path, String(index)], nextAncestorPath));
      });
    };
    if (expanded) populate();
    expand.addEventListener('click', (event) => {
      event.stopPropagation();
      if (children.hidden) {
        populate();
        state.nestedExpanded.add(branchKey);
      } else {
        state.nestedExpanded.delete(branchKey);
      }
      children.hidden = !children.hidden;
      expand.textContent = children.hidden ? '+' : '−';
      expand.setAttribute('aria-expanded', String(!children.hidden));
      expand.setAttribute('aria-label', `${children.hidden ? 'Expand' : 'Collapse'} ${item.name}`);
    });
  }
  return row;
}
function applySummaryTab() {
  const nested=state.summaryTab==='nested';
  if (elements.materialsList) elements.materialsList.hidden=nested;
  if (elements.nestedCraftingList) elements.nestedCraftingList.hidden=!nested;
  if (elements.summaryTitle) elements.summaryTitle.textContent=nested?'Nested crafting':'Base materials';
  if (elements.summaryTabMaterials) {
    elements.summaryTabMaterials.classList.toggle('active',!nested);
    elements.summaryTabMaterials.setAttribute('aria-selected',String(!nested));
  }
  if (elements.summaryTabNested) {
    elements.summaryTabNested.classList.toggle('active',nested);
    elements.summaryTabNested.setAttribute('aria-selected',String(nested));
  }
}
function collectBaseMaterials(root) {
  const totals = new Map();
  const visit = (item, multiplier, path) => {
    const code = itemKey(item);
    if (path.has(code) || !item.recipe?.length) {
      const existing = totals.get(code) || { item, quantity: 0 };
      existing.quantity += multiplier; totals.set(code, existing); return;
    }
    const nextPath = new Set(path);
    nextPath.add(code);
    recipeChildren(item).forEach(({ item: ingredient, quantity }) => visit(ingredient, multiplier * quantity, nextPath));
  };
  visit(root, 1, new Set()); return totals;
}
function recipeStats(root) {
  const materials = collectBaseMaterials(root);
  const walk = (item, path) => {
    const code = itemKey(item);
    if (path.has(code) || !item.recipe?.length) return { depth: 1, nodes: 1 };
    const nextPath = new Set(path);
    nextPath.add(code);
    const childStats = recipeChildren(item).map(({ item: ingredient }) => walk(ingredient, nextPath));
    return { depth: 1 + Math.max(...childStats.map((entry) => entry.depth)), nodes: 1 + childStats.reduce((sum, entry) => sum + entry.nodes, 0) };
  };
  return { ...walk(root, new Set()), baseTypes: materials.size };
}
function recipeChildren(item) {
  return (item.recipe || []).map((ingredient) => ({
    item: resolveItemReference(ingredient) || { rawCode: ingredient.rawCode, name: ingredient.name || 'Unknown ingredient', recipe: [] },
    quantity: Math.max(1, Number(ingredient.quantity) || 1),
  }));
}
function buildUsedByIndex() {
  // This is a player-facing usage index; technical/internal products are excluded.
  const buckets = new Map();
  state.data.items.forEach((product) => {
    if (!product.recipe?.length || !isPlayerFacing(product)) return;
    product.recipe.forEach((ingredient) => {
      const ingredientItem = resolveItemReference(ingredient);
      const ingredientCode = itemKey(ingredientItem || ingredient);
      const productCode = itemKey(product);
      if (!ingredientCode || !productCode) return;
      if (!buckets.has(ingredientCode)) buckets.set(ingredientCode, new Map());
      const products = buckets.get(ingredientCode);
      const existing = products.get(productCode) || { item: product, quantity: 0 };
      existing.quantity += Math.max(1, Number(ingredient.quantity) || 1);
      products.set(productCode, existing);
    });
  });
  const index = new Map([...buckets].map(([code, products]) => [
    code,
    [...products.values()].sort((left, right) => left.item.name.localeCompare(right.item.name)),
  ]));
  state.indexes.usedBy = index;
  return index;
}
function hasCraftingUsages(item) {
  const code = itemKey(item);
  return Boolean(code && state.indexes.usedBy instanceof Map && state.indexes.usedBy.has(code));
}
function craftingUsageCount(item) {
  const code = itemKey(item);
  if (!code || !(state.indexes.usedBy instanceof Map)) return 0;
  const entries = state.indexes.usedBy.get(code);
  return Array.isArray(entries) ? entries.length : 0;
}
function recipesUsing(item) {
  return state.indexes.usedBy.get(itemKey(item)) || [];
}
function isOreItem(item) {
  if (!item) return false;
  const text = [
    item.name,
    item.description,
    item.plainExtendedTooltip,
    item.rawExtendedTooltip
  ].filter(Boolean).join(' ').toLowerCase();

  // Only infer world-mining status from explicit ore/mining terminology.
  // Do not infer hard-coded stats such as tool level, HP, yield or drop rate.
  const name = String(item.name || '').trim();
  return /\bore\b/i.test(name) ||
         /\b(?:mine|mining|ore vein|ore veins|vein)\b/i.test(text);
}
function findProspectForOre(item) {
  if (!item || !state.data.items) return null;

  const oreName = String(item.name || '').trim();
  if (!oreName) return null;

  const normalized = oreName
    .replace(/\s+ore$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const candidates = state.data.items.filter(candidate => {
    const name = String(candidate.name || '').trim();
    if (!/^Prospect for .+ Veins$/i.test(name)) return false;
    const match = name.match(/^Prospect for (.+) Veins$/i);
    if (!match) return false;
    return match[1].trim().toLowerCase() === normalized.toLowerCase();
  });

  return candidates[0] || null;
}
function findOreForProspect(item) {
  if (!item || !state.data.items) return null;

  const name = cleanGameText(item.name || '').trim();
  const match = name.match(/^Prospect for (.+?) Veins?$/i);
  if (!match) return null;

  const baseName = match[1].trim();
  const wanted = `${baseName} Ore`.replace(/\s+/g, ' ').trim().toLowerCase();

  return state.data.items.find(candidate => {
    const candidateName = cleanGameText(candidate.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return candidateName === wanted;
  }) || null;
}
function getWorldMiningSource(item) {
  if (!isOreItem(item)) return null;
  return {
    type: 'world-mining',
    label: 'World Mining',
    description: 'Mine from an ore vein in the world.',
    prospect: findProspectForOre(item)
  };
}

  return { applySummaryTab, beginQuickViewRecipe, bindSummarySettings, buildUsedByIndex, craftingUsageCount, findOreForProspect, getWorldMiningSource, hasCraftingUsages, recipeChildren, recipeStats, recipesUsing, renderMaterials };
}
