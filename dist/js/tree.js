export function createTree(ctx) {
  const { state, elements } = ctx;
  const { beginQuickViewRecipe, clamp, closeResults, craftingUsageCount, createEntityPlaceholder, createIcon, findEnemyByName, hasCraftingUsages, itemKey, normalizeCode, recipeChildren, recipesUsing, renderItemDetails, renderMaterials, renderSelectedCard, showItemDetails, showMonsterDetails, showShopDetails, switchModule } = ctx.deps;
  const { constants = {} } = ctx;
  const { TREE_ORIENTATION = null } = constants;


function selectItem(item, options = {}) {
  const nextCode = itemKey(item);
  const currentCode = itemKey(state.ui.selected);
  if (nextCode && nextCode !== currentCode) beginQuickViewRecipe(item);
  state.ui.selected = item;
  state.nestedExpanded.clear();
  elements.search.value = item.name;
  elements.treeTitle.textContent = item.name;
  closeResults();
  if (options.updateHash !== false) {
    const reference = item?.id || item?.rawCode || '';
    history.replaceState(null, '', reference ? `#${encodeURIComponent(reference)}` : location.pathname);
  }
  renderSelectedCard(item); renderTree(item); renderMaterials(item); renderItemDetails(item);
}
function createCollapseToggle({ hasChildren, getChildList, labels, noChildrenTitle, noChildrenAriaLabel }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'node-control node-control-toggle';
  button.disabled = !hasChildren;

  const applyLabel = (expanded) => {
    button.textContent = hasChildren ? (expanded ? '−' : '+') : '•';
    if (hasChildren) {
      const { title, ariaLabel } = labels(expanded);
      button.title = title;
      if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
    } else {
      button.title = noChildrenTitle;
      if (noChildrenAriaLabel) button.setAttribute('aria-label', noChildrenAriaLabel);
    }
  };
  applyLabel(true); // Children render expanded by default.

  if (hasChildren) {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const childList = getChildList();
      if (!childList) return;
      childList.classList.toggle('collapsed');
      applyLabel(!childList.classList.contains('collapsed'));
    });
  }
  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  return button;
}
function renderEntityTree(entityType, entity, children, options = {}) {
  // Source trees are visually inverted; renderBranch receives that fact explicitly.
  elements.stage.replaceChildren();
  const composite = document.createElement('div');
  composite.className = 'tree-composite entity-tree-composite';
  const tree = document.createElement('ul');
  tree.className = `recipe-tree entity-root-tree${entityType === 'enemy' ? ' enemy-drop-tree' : entityType === 'shop' ? ' shop-inventory-tree' : ''}`;
  const rootLi = document.createElement('li');
  const rootCard = document.createElement('div');
  rootCard.className = 'node-card root entity-root-card';
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'node-main';
  main.append(createEntityPlaceholder(entityType, 'node-placeholder'));
  const name = document.createElement('span');
  name.className = 'node-name';
  name.textContent = entity?.name || options.name || 'Unknown';
  main.append(name);
  const meta = document.createElement('span');
  meta.className = 'node-meta';
  meta.textContent = options.meta || (entityType === 'enemy' ? 'Enemy drops' : 'Shop inventory');
  main.append(meta);
  main.addEventListener('click', (event) => {
    event.stopPropagation();
    if (entityType === 'enemy') showMonsterDetails(entity?.name || options.name);
    else if (entityType === 'shop') showShopDetails(entity.name);
  });
  main.addEventListener('pointerdown', (event) => event.stopPropagation());
  rootCard.append(main);
  rootLi.append(rootCard);
  const controls = document.createElement('div');
  controls.className = 'node-controls';

  let childList = null;
  const toggleButton = createCollapseToggle({
    hasChildren: Boolean(children.length),
    getChildList: () => childList,
    labels: (expanded) => ({
      title: `${expanded ? 'Collapse' : 'Expand'} ${entityType === 'enemy' ? 'drops' : 'inventory'}`,
    }),
    noChildrenTitle: 'No entries to collapse',
  });

  const rootButton = document.createElement('button');
  rootButton.type = 'button';
  rootButton.className = 'node-control node-control-root';
  rootButton.textContent = '↗';
  rootButton.title = 'Already the center of the tree';
  rootButton.setAttribute('aria-label', 'Already the center of the tree');
  rootButton.disabled = true;

  controls.append(toggleButton, rootButton);
  rootCard.append(controls);

  if (children.length) {
    childList = document.createElement('ul');
    children.forEach((item) => childList.append(renderBranch(item, {
        edgeQuantity: 1,
        totalQuantity: 1,
        path: new Set(),
        isRoot: false,
        orientation: TREE_ORIENTATION.FLIPPED_SOURCE,
        showContinuation: true,
        showRecipeChildren: false,
      })));
    rootLi.append(childList);
  }
  rootButton.addEventListener('pointerdown', (event) => event.stopPropagation());
  tree.append(rootLi);
  composite.append(tree);
  elements.stage.append(composite);
  requestAnimationFrame(fitTree);
}
function showEnemyTree(monsterName) {
  const name = String(monsterName || '').trim();
  const enemy = findEnemyByName(name);
  if (!enemy) return;
  const drops = enemy.drops?.length
    ? enemy.drops.map((drop) => state.indexes.byName.get(String(drop.itemName || '').trim().toLocaleLowerCase())).filter(Boolean)
    : state.data.items.filter((item) => (item.monsterDrops || []).some((drop) => String(drop.monsterName || '').trim().toLocaleLowerCase() === name.toLocaleLowerCase()));
  const unique = new Map();
  drops.forEach((item) => unique.set(normalizeCode(item.rawCode), item));
  const items = [...unique.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  elements.treeTitle.textContent = `${enemy.name} — Drops`;
  renderEntityTree('enemy', enemy, items, { meta: `${items.length} recorded drop${items.length === 1 ? '' : 's'}` });
}
function showShopTree(shopName) {
  const name = String(shopName || '').trim();
  const shop = state.indexes.shopsByName.get(name);
  if (!shop) return;
  const items = (shop.purchasableItems || []).slice();
  const unique = new Map();
  items.forEach((item) => unique.set(normalizeCode(item.rawCode), item));
  const inventory = [...unique.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  elements.treeTitle.textContent = `${name} — Inventory`;
  renderEntityTree('shop', shop, inventory, { meta: `${inventory.length} purchasable item${inventory.length === 1 ? '' : 's'}` });
}
function renderTree(item) {
  // Normal trees run from the selected item down into recipe ingredients.
  elements.stage.replaceChildren();
  const composite = document.createElement('div'); composite.className = 'tree-composite';
  const usages = recipesUsing(item);
  if (usages.length) {
    const label = document.createElement('p'); label.className = 'usage-label'; label.textContent = 'Crafts into';
    const usageTree = document.createElement('ul');
    usageTree.className = 'recipe-tree usage-tree';
    usageTree.setAttribute('aria-label', `Items crafted using ${item.name}`);
    usageTree.append(renderUsageAnchor(item));
    composite.append(label, usageTree);
  }
  const tree = document.createElement('ul');
  tree.className = `recipe-tree ingredient-tree${usages.length ? ' has-usages' : ''}`;
  tree.append(renderBranch(item, {
    edgeQuantity: 1,
    totalQuantity: 1,
    path: new Set(),
    isRoot: true,
    orientation: TREE_ORIENTATION.NORMAL,
    showContinuation: true,
  }));
  composite.append(tree); elements.stage.append(composite);
  requestAnimationFrame(fitTree);
}
function createNodeMain(item, fallbackName = 'Unknown item') {
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'node-main';
  main.append(createIcon(item, 'node-placeholder'));

  const name = document.createElement('span');
  name.className = 'node-name';
  name.textContent = item.name || fallbackName;
  const meta = document.createElement('span');
  meta.className = 'node-meta';
  main.append(name, meta);

  main.addEventListener('click', (event) => {
    event.stopPropagation();
    showItemDetails(item);
  });
  main.addEventListener('pointerdown', (event) => event.stopPropagation());
  return { main, meta };
}
function createNodeControls(item, listItem, children) {
  const controls = document.createElement('div');
  controls.className = 'node-controls';

  const toggleButton = createCollapseToggle({
    hasChildren: Boolean(children.length),
    getChildList: () => listItem.querySelector(':scope > ul'),
    labels: (expanded) => ({
      title: `${expanded ? 'Collapse' : 'Expand'} this recipe branch`,
      ariaLabel: `${expanded ? 'Collapse' : 'Expand'} ${item.name || 'branch'}`,
    }),
    noChildrenTitle: 'No branch to collapse',
    noChildrenAriaLabel: `No recipe branch for ${item.name || 'item'}`,
  });

  const rootButton = document.createElement('button');
  rootButton.type = 'button';
  rootButton.className = 'node-control node-control-root';
  rootButton.textContent = '↗';
  rootButton.title = `Make ${item.name || 'item'} the center of the tree`;
  rootButton.setAttribute('aria-label', `Make ${item.name || 'item'} the center of the tree`);

  rootButton.addEventListener('click', (event) => {
    event.stopPropagation();
    switchModule('recipes');
    selectItem(item);
    scrollTreeIntoViewOnMobile();
  });
  rootButton.addEventListener('pointerdown', (event) => event.stopPropagation());

  controls.append(toggleButton, rootButton);
  return controls;
}
function createContinuation(item, orientation) {
  const count = craftingUsageCount(item);
  const continuation = document.createElement('button');
  continuation.type = 'button';
  continuation.className = `node-continuation${orientation === TREE_ORIENTATION.FLIPPED_SOURCE ? ' entity-continuation' : ''}`;
  continuation.title = `${count} further craft${count === 1 ? '' : 's'} use ${item.name || 'this item'}`;
  continuation.setAttribute('aria-label', `${count} further craft${count === 1 ? '' : 's'} use ${item.name || 'this item'}`);
  continuation.innerHTML = '<span class="continuation-arrow" aria-hidden="true">↑</span><span class="continuation-dots" aria-hidden="true">•••</span>';
  continuation.addEventListener('click', (event) => {
    event.stopPropagation();
    showItemDetails(item);
  });
  continuation.addEventListener('pointerdown', (event) => event.stopPropagation());
  return continuation;
}
function renderUsageAnchor(item) {
  const listItem = document.createElement('li');
  const children = recipesUsing(item);
  if (children.length) {
    const childList = document.createElement('ul');
    children.forEach(({ item: product, quantity }) => {
      childList.append(renderUsageBranch(product, quantity));
    });
    listItem.append(childList);
  }
  return listItem;
}
function renderUsageBranch(item, edgeQuantity) {
  const listItem = document.createElement('li');
  const card = document.createElement('div');
  card.className = 'node-card';
  card.dataset.rawCode = normalizeCode(item.rawCode);

  const { main, meta } = createNodeMain(item, 'Unknown crafted item');
  meta.textContent = item.quality || 'Crafted item';
  card.append(main);

  if (edgeQuantity > 1) {
    const quantity = document.createElement('span');
    quantity.className = 'quantity-badge';
    quantity.textContent = `×${edgeQuantity}`;
    card.append(quantity);
  }

  card.append(createNodeControls(item, listItem, []));
  listItem.append(card);

  // Usage nodes are the "Crafts into" side of the tree.
  if (hasCraftingUsages(item)) {
    const continuation = createContinuation(item, TREE_ORIENTATION.NORMAL);
    continuation.classList.add('usage-continuation');
    listItem.append(continuation);
  }

  return listItem;
}
function renderBranch(item, context = {}) {
  // Keep tree orientation/context explicit: DOM order differs for flipped source trees.
  const {
    edgeQuantity = 1,
    totalQuantity = 1,
    path = new Set(),
    isRoot = false,
    orientation = TREE_ORIENTATION.NORMAL,
    showContinuation = false,
    showRecipeChildren = true,
  } = context;
  const listItem = document.createElement('li');
  const code = normalizeCode(item.rawCode);
  // `path` is branch-local, so shared ingredients can repeat while real cycles stop.
  const circular = path.has(code);
  const children = circular || !showRecipeChildren ? [] : recipeChildren(item);
  const card = document.createElement('div');
  card.className = `node-card${children.length ? ' craftable' : ''}${isRoot ? ' root' : ''}${circular ? ' cycle' : ''}`;
  card.dataset.rawCode = normalizeCode(item.rawCode);

  const { main, meta } = createNodeMain(item, 'Unknown ingredient');
  meta.textContent = circular ? 'Circular reference' : children.length
    ? `${children.length} ingredient${children.length === 1 ? '' : 's'}${totalQuantity > edgeQuantity ? ` · ${totalQuantity} total` : ''}`
    : `${item.quality || 'Base material'}${totalQuantity > 1 ? ` · ${totalQuantity} total` : ''}`;
  card.append(main);

  if (!isRoot && edgeQuantity > 1) {
    const quantity = document.createElement('span');
    quantity.className = 'quantity-badge';
    quantity.textContent = `×${edgeQuantity}`;
    card.append(quantity);
  }

  card.append(createNodeControls(item, listItem, children));

  const continuation = showContinuation && hasCraftingUsages(item)
    ? createContinuation(item, orientation)
    : null;

  // The marker is placed according to the tree's declared orientation.
  // This is deliberately centralized so normal and flipped trees cannot drift
  // apart again when the renderer is changed.
  if (continuation && orientation === TREE_ORIENTATION.NORMAL) {
    listItem.append(continuation);
  }

  listItem.append(card);

  if (continuation && orientation === TREE_ORIENTATION.FLIPPED_SOURCE) {
    listItem.append(continuation);
  }

  if (children.length) {
    const childList = document.createElement('ul');
    const nextPath = new Set(path);
    nextPath.add(code);
    children.forEach(({ item: ingredient, quantity }) => {
      childList.append(renderBranch(ingredient, {
        edgeQuantity: quantity,
        totalQuantity: totalQuantity * quantity,
        path: nextPath,
        isRoot: false,
        orientation,
        // Normal item trees only show the marker on the central item.
        // Flipped source trees show it on every visible item branch.
        showContinuation: orientation === TREE_ORIENTATION.FLIPPED_SOURCE,
      }));
    });
    listItem.append(childList);
  }
  return listItem;
}
function fitTree() {
  if (!elements.stage.firstElementChild) return;
  const availableWidth = elements.viewport.clientWidth - 60;
  const availableHeight = elements.viewport.clientHeight - 80;
  const treeWidth = elements.stage.scrollWidth;
  const treeHeight = elements.stage.scrollHeight;
  state.viewport.scale = clamp(Math.min(1, availableWidth / treeWidth, availableHeight / treeHeight), .2, 1.35);
  state.viewport.x = Math.max(30, (elements.viewport.clientWidth - treeWidth * state.viewport.scale) / 2);
  state.viewport.y = 34; applyTransform();
}
function zoomAt(factor, centerX = elements.viewport.clientWidth / 2, centerY = elements.viewport.clientHeight / 2) {
  const previous = state.viewport.scale;
  const next = clamp(previous * factor, .2, 1.8);
  const stageX = (centerX - state.viewport.x) / previous;
  const stageY = (centerY - state.viewport.y) / previous;
  state.viewport.scale = next; state.viewport.x = centerX - stageX * next; state.viewport.y = centerY - stageY * next; applyTransform();
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
  state.viewport.drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: state.viewport.x, originY: state.viewport.y, moved: false };
}
function moveDrag(event) {
  if (!state.viewport.drag || state.viewport.drag.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - state.viewport.drag.startX;
  const deltaY = event.clientY - state.viewport.drag.startY;
  if (!state.viewport.drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
  if (!state.viewport.drag.moved) {
    state.viewport.drag.moved = true; elements.viewport.classList.add('dragging');
  }
  state.viewport.x = state.viewport.drag.originX + deltaX;
  state.viewport.y = state.viewport.drag.originY + deltaY; applyTransform();
}
function stopDrag(event) {
  if (!state.viewport.drag || state.viewport.drag.pointerId !== event.pointerId) return;
  state.viewport.drag = null; elements.viewport.classList.remove('dragging');
}
function applyTransform() {
  elements.stage.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
  elements.zoomValue.value = `${Math.round(state.viewport.scale * 100)}%`;
  elements.zoomValue.textContent = `${Math.round(state.viewport.scale * 100)}%`;
}
function scrollTreeIntoViewOnMobile() {
  if (elements.treePanel && window.matchMedia('(max-width: 880px)').matches) {
    elements.treePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

  return { fitTree, handleWheel, moveDrag, scrollTreeIntoViewOnMobile, selectItem, showEnemyTree, showShopTree, startDrag, stopDrag, zoomAt };
}
