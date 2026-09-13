export function createData(ctx) {
  const { state } = ctx;
  const { isPlayerFacing, normalizeCode, normalizeText } = ctx.deps;



function adaptDatabase(raw) {
  validateDataSchema(raw);
  return {
    ...raw,
    items: raw.items.map(adaptItem),
    enemies: raw.enemies.map(adaptEnemy),
  };
}

function adaptItem(raw) {
  const item = { ...raw };
  item.rawCode = raw?.rawCode == null ? '' : String(raw.rawCode);
  item.id = raw?.id == null || String(raw.id).trim() === '' ? (normalizeCode(item.rawCode) || normalizeText(raw?.name)) : String(raw.id).trim();
  item.name = raw?.name == null ? '' : String(raw.name);
  item.recipe = Array.isArray(raw?.recipe)
    ? raw.recipe.map((ingredient) => ({
        ...ingredient,
        rawCode: ingredient?.rawCode == null ? '' : String(ingredient.rawCode),
        name: ingredient?.name == null ? '' : String(ingredient.name),
        quantity: Math.max(1, Number(ingredient?.quantity) || 1),
      }))
    : [];
  return item;
}

function adaptEnemy(raw) {
  return {
    ...raw,
    rawCode: raw?.rawCode == null ? '' : String(raw.rawCode),
    name: raw?.name == null ? '' : String(raw.name),
  };
}

function validateDataSchema(data) {
  if (!data || typeof data !== 'object') throw new Error('Crafting data is not a JSON object.');
  if (Number(data.schemaVersion) !== 2) {
    throw new Error(`Unsupported crafting data schema version: ${data.schemaVersion ?? 'missing'}`);
  }
  if (!Array.isArray(data.items) || !Array.isArray(data.enemies)) {
    throw new Error('Crafting data is missing the required items or enemies arrays.');
  }

  const assertUnique = (records, field, label) => {
    const seen = new Set();
    for (const record of records) {
      const value = String(record?.[field] ?? '').trim();
      if (!value) continue;
      if (seen.has(value)) throw new Error(`Duplicate ${label} "${value}" in crafting data.`);
      seen.add(value);
    }
  };

  assertUnique(data.items, 'id', 'item id');
  assertUnique(data.items, 'rawCode', 'item raw code');
  assertUnique(data.enemies, 'rawCode', 'enemy raw code');
}

function validateCanonicalIdentity(items) {
  const ids = new Set();
  const codes = new Set();
  for (const item of items) {
    const id = String(item?.id || '').trim();
    if (!id) throw new Error(`Item "${item?.name || item?.rawCode || 'unknown'}" has no canonical id.`);
    if (ids.has(id)) throw new Error(`Duplicate canonical item id "${id}" after data adaptation.`);
    ids.add(id);
    const code = normalizeCode(item?.rawCode);
    if (code) {
      if (codes.has(code)) throw new Error(`Duplicate normalized item raw code "${code}" after data adaptation.`);
      codes.add(code);
    }
  }
}
function buildIndexes() {
  state.indexes.byId = new Map(
    state.data.items
      .map((item) => [String(item.id || ''), item])
      .filter(([id]) => id)
  );
  state.indexes.byCode = new Map(
    state.data.items
      .map((item) => [normalizeCode(item.rawCode), item])
      .filter(([code]) => code)
  );
  state.indexes.byName = buildNameIndex(state.data.items);
  state.indexes.enemiesByCode = new Map(
    state.data.enemies
      .map((enemy) => [normalizeCode(enemy.rawCode), enemy])
      .filter(([code]) => code)
  );
  state.indexes.enemiesByName = buildNameIndex(state.data.enemies);
  validateCanonicalIdentity(state.data.items);
  state.indexes.shopsByName = buildShopIndex(state.data.items);
  state.indexes.playerFacing = state.data.items.filter(isPlayerFacing);
  state.cache.parsedStats = new WeakMap();
  state.cache.abilities = new WeakMap();
  state.cache.statCatalog = null;

  state.data.craftedItems = state.data.items
    .filter((item) => item.recipe?.length && isPlayerFacing(item))
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));

  state.indexes.searchEntries = buildSearchEntries();
}
function buildSearchEntries() {
  const toItemEntries = (items) => items
    .filter((item) => String(item?.name || '').trim())
    .map((item) => ({ type: 'item', entity: item, name: item.name }));
  const enemies = state.data.enemies
    .filter((enemy) => String(enemy?.name || '').trim())
    .map((enemy) => ({ type: 'enemy', entity: enemy, name: enemy.name }));
  const shops = [...state.indexes.shopsByName.values()]
    .filter((shop) => shop.purchasableItems?.length)
    .map((shop) => ({ type: 'shop', entity: shop, name: shop.name }));
  const playerItems = state.indexes.playerFacing;
  const allItems = state.data.items;

  // Everything is the player-facing union of items, enemies and usable shops.
  // Everything + technical deliberately exposes the raw item export as well.
  const dedupe = (entries) => {
    const seen = new Set();
    return entries.filter((entry) => {
      const key = `${entry.type}:${normalizeText(entry.name)}`;
      if (!entry.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    crafting: toItemEntries(state.data.craftedItems),
    items: toItemEntries(playerItems),
    enemies,
    shops,
    everything: dedupe([
      ...toItemEntries(playerItems),
      ...enemies,
      ...shops,
    ]),
    'everything-technical': dedupe([
      ...toItemEntries(allItems),
      ...enemies,
      ...shops,
    ]),
  };
}
function buildNameIndex(items) {
  const index = new Map();
  for (const item of items || []) {
    const name = String(item.name || '').trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (!index.has(key)) index.set(key, item);
  }
  return index;
}
function getShopPurchaseSignals(item) {
  if (!item) return null;

  const name = String(item.name || '').trim();
  const rawCode = String(item.rawCode || '').trim();
  const rawName = String(item.rawName || '').trim();
  const purchaseTooltip = String(item.purchaseTooltip || '').trim();
  const tooltip = String(item.rawFields?.utip || '').trim();
  const classType = String(item.rawFields?.icla || '').trim().toLocaleLowerCase();
  const price = Number(item.rawFields?.igol);

  const technicalName =
    /\(Item\)$/i.test(name) ||
    /\(Quest\)$/i.test(name) ||
    /\(Info\)$/i.test(name) ||
    /\(Teleport\)$/i.test(name) ||
    /^Return\s*\(/i.test(name);

  const unresolved = !name || (name === rawCode && !rawName);
  const explicitPurchase =
    /^Purchase(?:\s|$)/i.test(purchaseTooltip) ||
    /^Purchase(?:\s|$)/i.test(tooltip);
  const hasPositivePrice = Number.isFinite(price) && price > 0;
  const purchasableClass = classType === 'purchasable';
  const campaignClass = classType === 'campaign';
  const hasPlayerData = Boolean(
    item.quality ||
    item.description ||
    item.iconFile ||
    item.recipe?.length ||
    item.scriptStats && Object.keys(item.scriptStats).length ||
    item.scriptBehaviors?.length ||
    item.requiredLevel != null ||
    item.slot
  );

  return {
    name,
    unresolved,
    technicalName,
    explicitPurchase,
    hasPositivePrice,
    purchasableClass,
    campaignClass,
    hasPlayerData,
    classType,
  };
}
function isTechnicalShopRecord(item) {
  const signals = getShopPurchaseSignals(item);
  if (!signals || signals.unresolved) return true;

  // These are shop UI/navigation/quest records, not inventory goods. Their
  // shop links are still retained in the raw source-backed index.
  if (signals.technicalName) return true;
  if (signals.campaignClass) return true;

  return false;
}
function isShopMapItem(item) {
  if (!item || !Array.isArray(item.shops) || !item.shops.length) return false;

  const signals = getShopPurchaseSignals(item);
  if (!signals || signals.unresolved || isTechnicalShopRecord(item)) return false;

  // Do not require the generated tooltip to contain the word "Purchase".
  // Some genuine shop goods (for example Catalytic Soul) have a price and a
  // normal item definition but a plain item-name tooltip.
  if (signals.hasPositivePrice) return true;
  if (signals.explicitPurchase) return true;
  if (signals.purchasableClass) return true;

  // A source-backed, player-facing item with meaningful item data is a useful
  // fallback for free/zero-cost goods whose export does not preserve the
  // purchase tooltip/class marker.
  if (!signals.campaignClass && signals.hasPlayerData) return true;

  return false;
}
function isActualShopPurchase(item) {
  // Keep this semantic helper for filters outside the shop map, but make its
  // classification source-aware instead of depending on one tooltip prefix.
  return isShopMapItem(item);
}
function buildShopIndex(items = []) {
  const index = new Map();

  for (const item of items) {
    for (const shop of item.shops || []) {
      const name = String(shop.shopName || '').trim();
      if (!name) continue;

      if (!index.has(name)) {
        index.set(name, {
          name,
          items: [],
          purchasableItems: [],
          itemCodes: new Set(),
          purchasableCodes: new Set(),
          categories: new Set(),
        });
      }

      const entry = index.get(name);
      const code = normalizeCode(item.rawCode);
      if (code && !entry.itemCodes.has(code)) {
        entry.itemCodes.add(code);
        entry.items.push(item);
      }

      if (isShopMapItem(item) && code && !entry.purchasableCodes.has(code)) {
        entry.purchasableCodes.add(code);
        entry.purchasableItems.push(item);
      }

      if (shop.categoryName && isShopMapItem(item)) {
        entry.categories.add(String(shop.categoryName));
      }
    }
  }

  for (const entry of index.values()) {
    entry.items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    entry.purchasableItems.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    entry.categories = [...entry.categories].sort((a, b) => a.localeCompare(b));
    delete entry.itemCodes;
    delete entry.purchasableCodes;
  }

  return index;
}
function resolveItemReference(reference) {
  if (reference == null) return null;
  if (typeof reference === 'object') {
    if (reference.id != null) {
      const byId = state.indexes.byId.get(String(reference.id));
      if (byId) return byId;
    }
    if (reference.rawCode != null) {
      const byCode = state.indexes.byCode.get(normalizeCode(reference.rawCode));
      if (byCode) return byCode;
    }
    if (reference.name != null) return findItemByName(reference.name);
    return null;
  }
  const value = String(reference).trim();
  if (!value) return null;
  return state.indexes.byId.get(value)
    || state.indexes.byCode.get(normalizeCode(value))
    || findItemByName(value);
}
function findItemByName(name) {
  const key = String(name || '').trim().toLocaleLowerCase();
  return key ? state.indexes.byName.get(key) || null : null;
}
function findEnemyByName(name) {
  const key = String(name || '').trim().toLocaleLowerCase();
  return key ? (state.indexes.enemiesByName.get(key) || null) : null;
}

  return { adaptDatabase, buildIndexes, findEnemyByName, findItemByName, isActualShopPurchase, resolveItemReference, validateDataSchema };
}
