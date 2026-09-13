export function createItems(ctx) {
  const { state, elements } = ctx;
  const { cleanGameText, escapeHtml, extractTooltipSection, tooltipSectionsExcept, extractActiveAbilities, findEnemyByName, findItemByName, findOreForProspect, resolveItemReference, formatNumber, formatStatKey, formatStatValue, getWorldMiningSource, normalizeCode, recipeStats, recipesUsing, scrollTreeIntoViewOnMobile, selectItem, showEnemyTree, showShopTree, switchModule } = ctx.deps;


function extractShopNames(item) {
  const shops = Array.isArray(item?.shops) ? item.shops : [];
  return shops.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (!entry || typeof entry !== 'object') return [];
    return [entry.name, entry.shopName, entry.shop, entry.vendor].filter(Boolean).map(String);
  });
}
function showShopDetails(shopName, target = elements.itemDetails) {
  if (!shopName || !target) return;

  document.querySelectorAll('.node-card.details-selected').forEach((node) => {
    node.classList.remove('details-selected');
  });

  const name = String(shopName).trim();
  const shop = state.indexes.shopsByName.get(name);
  const items = (shop?.purchasableItems || []).slice();

  const categoryGroups = new Map();
  for (const item of items) {
    const itemShops = (item.shops || []).filter(
      (entry) => String(entry.shopName || '').trim() === name
    );
    const categories = itemShops.map((entry) => String(entry.categoryName || '').trim()).filter(Boolean);
    const keys = categories.length ? categories : ['Uncategorized'];

    for (const category of keys) {
      if (!categoryGroups.has(category)) categoryGroups.set(category, []);
      if (!categoryGroups.get(category).some((candidate) =>
        normalizeCode(candidate.rawCode) === normalizeCode(item.rawCode)
      )) {
        categoryGroups.get(category).push(item);
      }
    }
  }

  const groups = [...categoryGroups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, categoryItems]) => [
      category,
      categoryItems.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    ]);

  const categoryCount = groups.length;

  target.innerHTML = `
    <div class="shop-detail-header">
      <div class="shop-detail-icon details-placeholder" data-entity-placeholder="S" aria-hidden="true">S</div>
      <div class="details-item-heading">
        <p class="eyebrow">Shop / NPC</p>
        <h3>${escapeHtml(name)}</h3>
        <div class="details-tags">
          <span class="tag">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
          <span class="tag">${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}</span>
        </div>
        <button type="button" class="details-tree-button" data-action="shop-tree">Show inventory tree</button>
      </div>
    </div>

    <section class="details-section">
      <h4>Inventory</h4>
      ${groups.length ? groups.map(([category, categoryItems]) => `
        <div class="shop-category">
          <div class="shop-category-heading">
            <strong>${escapeHtml(category)}</strong>
            <span>${categoryItems.length}</span>
          </div>
          <div class="entity-list shop-inventory-list">
            ${categoryItems.map((item) => {
              const price = Number(item.rawFields?.igol);
              const purchase = String(item.purchaseTooltip || '').trim();
              const priceLabel = Number.isFinite(price) ? `${price.toLocaleString()} Gold` : 'Price not recorded';
              const sub = purchase && purchase !== `Purchase ${item.name}`
                ? purchase
                : (item.requiredLevel != null ? `Required level ${item.requiredLevel}` : priceLabel);
              return `
                <button type="button" class="entity-row shop-inventory-row" data-raw-code="${escapeHtml(normalizeCode(item.rawCode))}">
                  ${createIconMarkup(item, 'entity-row-icon')}
                  <span class="entity-row-copy">
                    <strong>${escapeHtml(item.name || item.rawCode || 'Unknown item')}</strong>
                    <small>${escapeHtml(sub)}</small>
                  </span>
                  <span class="shop-price">${escapeHtml(priceLabel)}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `).join('') : '<div class="details-empty">No purchasable inventory was recorded for this shop.</div>'}
    </section>
  `;

  bindItemIconFallbacks(target);

  target.querySelector('[data-action="shop-tree"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    showShopTree(name);
    scrollTreeIntoViewOnMobile();
  });

  target.querySelectorAll('.shop-inventory-row[data-raw-code]').forEach((row) => {
    row.addEventListener('click', (event) => {
      event.stopPropagation();
      const item = state.indexes.byCode.get(normalizeCode(row.dataset.rawCode));
      if (item) showItemDetails(item, target);
    });
  });
}
function showMonsterDetails(monsterName, target = elements.itemDetails) {
  if (!monsterName || !target) return;

  document.querySelectorAll('.node-card.details-selected').forEach((node) => node.classList.remove('details-selected'));

  const enemy = findEnemyByName(monsterName);
  const drops = enemy?.drops?.length
    ? enemy.drops.map((drop) => ({
        item: findItemByName(drop.itemName),
        itemName: drop.itemName,
        chance: drop.chancePerThousand,
        difficulty: drop.difficultyRequirement
      }))
    : state.data.items.flatMap((item) => (item.monsterDrops || [])
        .filter((drop) => String(drop.monsterName || '').trim().toLocaleLowerCase() === String(monsterName).trim().toLocaleLowerCase())
        .map((drop) => ({item, itemName:item.name, chance:drop.chancePerThousand, difficulty:drop.difficultyRequirement})));

  const unique = new Map();
  for (const drop of drops) {
    const key = normalizeCode(drop.item?.rawCode) || `name:${String(drop.itemName || '').toLocaleLowerCase()}`;
    if (!unique.has(key)) unique.set(key, drop);
  }
  const rows = [...unique.values()].sort((a, b) =>
    String(a.item?.name || a.itemName || '').localeCompare(String(b.item?.name || b.itemName || ''))
  );

  target.innerHTML=`
    <div class="enemy-detail-header">
      <div class="enemy-detail-icon details-placeholder" data-entity-placeholder="E" aria-hidden="true">E</div>
      <div class="details-item-heading">
        <p class="eyebrow">Enemy</p>
        <h3>${escapeHtml(enemy?.name||monsterName)}</h3>
        <div class="details-tags">
          ${enemy?.level!=null?`<span class="tag">Level ${formatNumber(enemy.level)}</span>`:''}
          ${enemy?.armor!=null?`<span class="tag">Armor ${formatNumber(enemy.armor)}</span>`:''}
          ${enemy?.movementSpeed!=null?`<span class="tag">Move ${formatNumber(enemy.movementSpeed)}</span>`:''}
        </div>
        <button type="button" class="details-tree-button" data-action="enemy-tree">Show drops tree</button>
      </div>
    </div>
    <section class="details-section">
      <h4>Characteristics</h4>
      ${enemy?`
      <div class="enemy-stat-grid">
        <div class="enemy-stat"><span>Health</span><strong>${formatNumber(enemy.maximumHealth)}</strong></div>
        <div class="enemy-stat"><span>Mana</span><strong>${formatNumber(enemy.maximumMana)}</strong></div>
        <div class="enemy-stat"><span>Armor</span><strong>${formatNumber(enemy.armor)}</strong></div>
        <div class="enemy-stat"><span>Movement speed</span><strong>${formatNumber(enemy.movementSpeed)}</strong></div>
        <div class="enemy-stat"><span>Damage</span><strong>${formatRange(enemy.minimumDamage, enemy.maximumDamage)}</strong></div>
        <div class="enemy-stat"><span>Attack cooldown</span><strong>${enemy.attackCooldown==null?'—':`${formatNumber(enemy.attackCooldown)} s`}</strong></div>
        <div class="enemy-stat"><span>Gold</span><strong>${formatRange(enemy.minimumGold, enemy.maximumGold)}</strong></div>
        <div class="enemy-stat"><span>Respawn</span><strong>${enemy.respawnSeconds==null?'—':`${formatNumber(enemy.respawnSeconds)} s`}</strong></div>
      </div>`:'<div class="details-empty">No dedicated enemy record was found in this export.</div>'}
    </section>
    ${enemy ? `
    <section class="details-section enemy-reward-section">
      <h4>Experience</h4>
      <div class="enemy-reward-card">
        <div class="enemy-reward-main">
          <span class="enemy-reward-label">Experience</span>
          <strong>${formatRange(enemy.minimumExperience, enemy.maximumExperience)} XP</strong>
        </div>
        <div class="enemy-reward-sub">
          <span>Maximum level from experience</span>
          <strong>${formatNumber(enemy.maximumLevelFromExperience)}</strong>
        </div>
      </div>
    </section>` : ''}
    <section class="details-section">
      <h4>Drops <span class="section-count">${rows.length}</span></h4>
      ${rows.length?`<div class="entity-list enemy-drop-list">${rows.map(({item,itemName,chance,difficulty})=>item?`
        <button type="button" class="entity-row enemy-drop-row" data-raw-code="${escapeHtml(normalizeCode(item.rawCode))}">
          ${createIconMarkup(item,'entity-row-icon')}
          <span class="entity-row-copy"><strong>${escapeHtml(item.name)}</strong><small>${formatDropChance(chance)}${difficulty==null?'':` · difficulty ${escapeHtml(difficulty)}`}</small></span>
        </button>`:`
        <div class="entity-row enemy-drop-row unresolved">
          <span class="details-placeholder entity-row-icon">I</span>
          <span class="entity-row-copy"><strong>${escapeHtml(itemName||'Unknown item')}</strong><small>${formatDropChance(chance)}</small></span>
        </div>`).join('')}</div>`:'<div class="details-empty">No recorded drops.</div>'}
    </section>`;

  bindItemIconFallbacks(target);

  target.querySelector('[data-action="enemy-tree"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    showEnemyTree(enemy?.name || monsterName);
    scrollTreeIntoViewOnMobile();
  });

  target.querySelectorAll('.enemy-drop-row[data-raw-code]').forEach(row=>{
    row.addEventListener('click',e=>{
      e.stopPropagation();
      const item=state.indexes.byCode.get(normalizeCode(row.dataset.rawCode));
      if(item) showItemDetails(item, target);
    });
  });
}
function bindItemIconFallbacks(container) {
  if (!container) return;
  container.querySelectorAll('img[data-item-placeholder]').forEach((image) => {
    const replaceWithPlaceholder = () => {
      const placeholder = document.createElement('span');
      placeholder.className = `details-placeholder ${image.className}`.trim();
      placeholder.dataset.entityPlaceholder = image.dataset.itemPlaceholder || 'I';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = image.dataset.itemPlaceholder || 'I';
      image.replaceWith(placeholder);
    };

    image.addEventListener('error', replaceWithPlaceholder, { once: true });
    if (image.complete && image.naturalWidth === 0) replaceWithPlaceholder();
  });
}
function createIconMarkup(item,className=''){
  const classes = `details-placeholder ${escapeHtml(className)}`.trim();
  if (!item?.iconFile) {
    return `<span class="${classes}" data-entity-placeholder="I" aria-hidden="true">I</span>`;
  }
  return `<img src="${escapeHtml(item.iconFile)}" alt="" class="${escapeHtml(className)}" loading="lazy" data-item-placeholder="I">`;
}
function renderItemDetails(item, target = elements.itemDetails) {
  if (!target) return;
  target.replaceChildren();

  const header = document.createElement('div');
  header.className = 'details-item-header';
  header.append(createIcon(item, 'details-icon'));

  const heading = document.createElement('div');
  heading.className = 'details-item-heading';

  const title = document.createElement('h3');
  title.textContent = item.name || 'Unknown item';
  heading.append(title);

  const meta = document.createElement('div');
  meta.className = 'details-tags';
  [
    item.quality,
    item.slot,
    item.requiredLevel != null ? `Level ${item.requiredLevel}` : null,
    item.allowedClasses?.length ? item.allowedClasses.join(', ') : null,
  ].filter(Boolean).forEach((value) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = value;
    meta.append(tag);
  });
  heading.append(meta);

  const treeButton = document.createElement('button');
  treeButton.type = 'button';
  treeButton.className = 'details-tree-button';
  treeButton.textContent = 'Show in tree';
  treeButton.title = `Show the crafting tree for ${item.name || 'this item'}`;
  treeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    switchModule('recipes');
    selectItem(item);
    scrollTreeIntoViewOnMobile();
  });
  heading.append(treeButton);

  header.append(heading);
  target.append(header);

  const tooltip = String(item.plainExtendedTooltip || '').trim();
  const paragraphs = tooltip.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const firstParagraph = paragraphs[0] || String(item.description || '').trim();

  if (firstParagraph) {
    const section = detailSection('Description');
    const text = document.createElement('p');
    text.className = 'details-description';
    text.textContent = firstParagraph;
    section.append(text);
    target.append(section);
  }

  const provides = extractTooltipSection(tooltip, 'Provides:');
  if (provides.length) {
    const section = detailSection('Characteristics');
    const list = document.createElement('ul');
    list.className = 'details-stat-list';
    provides.forEach((line) => {
      const li = document.createElement('li');
      li.textContent = line.replace(/^\s+/, '');
      list.append(li);
    });
    section.append(list);
    target.append(section);
  }

  const effects = tooltipSectionsExcept(tooltip, new Set(['Provides:', 'Recipe:', 'Quality:', 'Slot:', 'Type:', 'Required Level:', 'Available Classes:', 'Recipe ID:']));
  if (effects.length) {
    const section = detailSection('Additional details');
    const pre = document.createElement('div');
    pre.className = 'details-text';
    pre.textContent = effects.join('\n');
    section.append(pre);
    target.append(section);
  }

  if (item.recipe?.length) {
    const section = detailSection('Recipe');
    const list = document.createElement('div');
    list.className = 'entity-list details-recipe-list';

    item.recipe.forEach((ingredient) => {
      const ingredientItem = resolveItemReference(ingredient);

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'entity-row recipe-entity-row';
      row.dataset.entityType = 'item';
      row.dataset.rawCode = normalizeCode(ingredient.rawCode);

      if (ingredientItem) {
        row.append(createIcon(ingredientItem, 'entity-row-icon'));
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'details-placeholder entity-row-icon';
        placeholder.textContent = 'I';
        row.append(placeholder);
      }

      const copy = document.createElement('span');
      copy.className = 'entity-row-copy';

      const name = document.createElement('strong');
      name.textContent = ingredientItem?.name || ingredient.name || ingredient.rawCode || 'Unknown ingredient';
      copy.append(name);

      const meta = document.createElement('small');
      const quantity = Number(ingredient.quantity);
      meta.textContent = Number.isFinite(quantity) && quantity > 1
        ? `Quantity ×${quantity}`
        : 'Required ingredient';
      copy.append(meta);

      row.append(copy);

      row.addEventListener('click', (event) => {
        event.stopPropagation();
        if (ingredientItem) showItemDetails(ingredientItem, target);
      });

      list.append(row);
    });

    section.append(list);
    target.append(section);
  }

  const miningSource = getWorldMiningSource(item);
  if (miningSource) {
    const section = detailSection('Sources');
    const list = document.createElement('div');
    list.className = 'entity-list details-source-list';

    const miningRow = document.createElement('div');
    miningRow.className = 'entity-row world-mining-row';

    const icon = createEntityPlaceholder('unknown', 'entity-row-icon');
    miningRow.append(icon);

    const copy = document.createElement('span');
    copy.className = 'entity-row-copy';

    const name = document.createElement('strong');
    name.textContent = cleanGameText(miningSource.label);
    copy.append(name);

    const description = document.createElement('small');
    description.textContent = cleanGameText(miningSource.description);
    copy.append(description);

    miningRow.append(copy);
    list.append(miningRow);

    if (miningSource.prospect) {
      const prospectRow = document.createElement('button');
      prospectRow.type = 'button';
      prospectRow.className = 'entity-row prospect-entity-row';
      prospectRow.append(createIcon(miningSource.prospect, 'entity-row-icon'));

      const prospectCopy = document.createElement('span');
      prospectCopy.className = 'entity-row-copy';

      const prospectName = document.createElement('strong');
      prospectName.textContent = cleanGameText(miningSource.prospect.name);
      prospectCopy.append(prospectName);

      const prospectDescription = document.createElement('small');
      prospectDescription.textContent = cleanGameText('Shows regions where this ore can be found.');
      prospectCopy.append(prospectDescription);

      prospectRow.append(prospectCopy);
      prospectRow.addEventListener('click', (event) => {
        event.stopPropagation();
        showItemDetails(miningSource.prospect, target);
      });
      list.append(prospectRow);
    }

    section.append(list);
    target.append(section);
  }

  const relatedOre = findOreForProspect(item);
  if (relatedOre) {
    const section = detailSection('Related');
    const list = document.createElement('div');
    list.className = 'entity-list details-related-list';

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'entity-row related-entity-row';
    row.append(createIcon(relatedOre, 'entity-row-icon'));

    const copy = document.createElement('span');
    copy.className = 'entity-row-copy';

    const name = document.createElement('strong');
    name.textContent = cleanGameText(relatedOre.name || relatedOre.rawCode || 'Unknown item');
    copy.append(name);

    const description = document.createElement('small');
    description.textContent = 'Ore associated with this prospect.';
    copy.append(description);

    row.append(copy);
    row.addEventListener('click', (event) => {
      event.stopPropagation();
      showItemDetails(relatedOre, target);
    });

    list.append(row);
    section.append(list);
    target.append(section);
  }

  const usages = recipesUsing(item);
  if (usages.length) {
    const section = detailSection('Used in');
    const list = document.createElement('div');
    list.className = 'entity-list details-usage-list';

    usages.forEach(({ item: product, quantity }) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'entity-row usage-entity-row';
      row.append(createIcon(product, 'entity-row-icon'));

      const copy = document.createElement('span');
      copy.className = 'entity-row-copy';

      const name = document.createElement('strong');
      name.textContent = cleanGameText(product.name || product.rawCode || 'Unknown item');
      copy.append(name);

      const meta = document.createElement('small');
      meta.textContent = cleanGameText(`Quantity ×${quantity}`);
      copy.append(meta);

      row.append(copy);
      row.addEventListener('click', (event) => {
        event.stopPropagation();
        showItemDetails(product, target);
      });

      list.append(row);
    });

    section.append(list);
    target.append(section);
  }

  if (item.scriptStats && Object.keys(item.scriptStats).length) {
    const section = detailSection('Script stats');
    const list = document.createElement('ul');
    list.className = 'details-stat-list';
    Object.entries(item.scriptStats).forEach(([key, value]) => {
      const li = document.createElement('li');
      li.textContent = `${formatStatKey(key)}: ${formatStatValue(key, value)}`;
      list.append(li);
    });
    section.append(list);
    target.append(section);
  }

  const activeAbilities = extractActiveAbilities(item);
  if (activeAbilities.length) {
    const section = detailSection('Active abilities');
    const list = document.createElement('div');
    list.className = 'details-ability-list';

    activeAbilities.forEach((block) => {
      const card = document.createElement('article');
      card.className = 'details-ability';
      const name = document.createElement('strong');
      name.textContent = cleanGameText(block[0]);
      card.append(name);
      if (block.length > 1) {
        const body = document.createElement('div');
        body.className = 'details-ability-lines';
        block.slice(1).forEach((line) => {
          const row = document.createElement('div');
          row.textContent = cleanGameText(line);
          body.append(row);
        });
        card.append(body);
      }
      list.append(card);
    });
    section.append(list);
    target.append(section);
  }

  // Do not expose arbitrary script behaviors as if they were player-facing
  // abilities. They are implementation details unless the record explicitly
  // identifies an active ability (handled above).

  if (item.monsterDrops?.length || item.shops?.length) {
    const section = detailSection('Sources');
    const list = document.createElement('div');
    list.className = 'entity-list details-source-list';

    item.monsterDrops?.forEach((drop) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'entity-row monster-entity-row';
      row.dataset.entityType = 'monster';
      row.dataset.monsterName = drop.monsterName || '';

      const icon = document.createElement('span');
      icon.className = 'details-placeholder entity-row-icon monster-row-icon';
      icon.textContent = 'E';
      row.append(icon);

      const copy = document.createElement('span');
      copy.className = 'entity-row-copy';

      const name = document.createElement('strong');
      name.textContent = drop.monsterName || 'Unknown monster';
      copy.append(name);

      const chance = Number(drop.chancePerThousand);
      const meta = document.createElement('small');
      meta.textContent = Number.isFinite(chance)
        ? `${(chance / 10).toFixed(chance % 10 ? 1 : 0)}% drop`
        : 'Drop chance unknown';
      if (drop.difficultyRequirement != null) {
        meta.textContent += ` · difficulty ${drop.difficultyRequirement}`;
      }
      copy.append(meta);

      row.append(copy);
      row.addEventListener('click', (event) => {
        event.stopPropagation();
        showMonsterDetails(drop.monsterName, target);
      });

      list.append(row);
    });

    item.shops?.forEach((shop) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'entity-row shop-entity-row';
      row.dataset.entityType = 'shop';
      row.dataset.shopName = shop.shopName || '';

      const icon = document.createElement('span');
      icon.className = 'details-placeholder entity-row-icon shop-row-icon';
      icon.textContent = 'S';
      row.append(icon);

      const copy = document.createElement('span');
      copy.className = 'entity-row-copy';

      const name = document.createElement('strong');
      name.textContent = shop.shopName || 'Unknown shop';
      copy.append(name);

      const meta = document.createElement('small');
      meta.textContent = shop.categoryName ? `Category · ${shop.categoryName}` : 'Shop source';
      copy.append(meta);

      row.append(copy);
      row.addEventListener('click', (event) => {
        event.stopPropagation();
        showShopDetails(shop.shopName, target);
      });
      list.append(row);
    });

    section.append(list);
    target.append(section);
  }

  bindItemIconFallbacks(target);
}
function detailSection(title, action) {
  const section=document.createElement('section'); section.className='details-section';
  const head=document.createElement('div'); head.className='details-section-heading';
  const heading=document.createElement('h4'); heading.textContent=title; head.append(heading);
  if(action){const btn=document.createElement('button');btn.type='button';btn.className='details-section-action';btn.textContent=action.label;btn.title=action.title||action.label;btn.addEventListener('click',e=>{e.stopPropagation();action.run();});head.append(btn);}
  section.append(head); return section;
}

function getEntityPlaceholder(entityType) {
  switch (String(entityType || '').toLowerCase()) {
    case 'item':
      return 'I';
    case 'enemy':
    case 'monster':
      return 'E';
    case 'shop':
    case 'npc':
      return 'S';
    default:
      return '?';
  }
}
function createEntityPlaceholder(entityType, className = '') {
  const placeholder = document.createElement('span');
  placeholder.className = `details-placeholder ${className}`.trim();
  placeholder.dataset.entityPlaceholder = getEntityPlaceholder(entityType);
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.textContent = getEntityPlaceholder(entityType);
  return placeholder;
}
function createIcon(item, placeholderClass) {
  const placeholder = () => createEntityPlaceholder('item', placeholderClass);

  if (item?.iconFile) {
    const image = document.createElement('img');
    image.src = item.iconFile;
    image.alt = '';
    image.loading = 'lazy';
    image.draggable = false;
    image.className = placeholderClass || '';

    image.addEventListener('error', () => {
      if (image.isConnected) image.replaceWith(placeholder());
    }, { once: true });

    // Covers cached 404s / already-completed failed images.
    if (image.complete && image.naturalWidth === 0) {
      queueMicrotask(() => {
        if (image.isConnected) image.replaceWith(placeholder());
      });
    }

    return image;
  }

  return placeholder();
}
function metric(value, label) {
  const box = document.createElement('div'); box.className = 'metric';
  const number = document.createElement('strong'); number.textContent = value;
  const caption = document.createElement('span'); caption.textContent = label;
  box.append(number, caption); return box;
}

function formatRange(minimum, maximum) {
  if (minimum == null && maximum == null) return '—';
  return `${formatNumber(minimum)}–${formatNumber(maximum)}`;
}
function formatDropChance(chancePerThousand) {
  const chance = Number(chancePerThousand);
  return Number.isFinite(chance)
    ? `${chance / 10}% drop`
    : 'Drop chance unknown';
}
function showItemDetails(item, target = elements.itemDetails) {
  if (!item || !target) return;

  // Highlight the item that is currently being inspected.
  document.querySelectorAll('.node-card.details-selected').forEach((node) => {
    node.classList.remove('details-selected');
  });
  document.querySelectorAll('.node-card').forEach((node) => {
    if (node.dataset.rawCode === normalizeCode(item.rawCode)) {
      node.classList.add('details-selected');
    }
  });

  renderItemDetails(item, target);
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

  return { createEntityPlaceholder, createIcon, extractShopNames, renderItemDetails, renderSelectedCard, showItemDetails, showMonsterDetails, showShopDetails };
}
