export function createModel() {
  const PLAYER_ITEM_ALLOWLIST = new Set([
    'Aeternalis Crystal (Arcane Mage Tier 4)',
    'Arrow of the Void (Ranger Tier 4)',
    "Belanor's Fractured Sword of Fury (Berserker Tier 4)",
    'Crown of the Blood King (Vampyr Tier 4)',
    'Emblem of Agdar (Werewolf Tier 4)',
    'Orb of Creation (Angel Tier 4)',
    'Skull of Fath (Warlock Tier 4)',
  ]);



function getItemCategory(item) {
  if (isWearableItem(item)) return 'Equipment';
  const text = [item.slot, item.description, item.plainExtendedTooltip, item.rawExtendedTooltip].filter(Boolean).join(' ').toLowerCase();
  if (/\btool\b|tool type:/i.test(text)) return 'Tool';
  if (/\b(?:event )?cosmetic\b/i.test(text)) return 'Cosmetic';
  if (/\b(?:consumable|food|potion)\b/i.test(text)) return 'Consumable';
  if (/\bmaterial\b/i.test(text)) return 'Material';
  return 'Other';
}
function isWearableItem(item) {
  const slot = String(item?.slot || '').trim();
  return ['Weapon', 'Armor', 'Boots', 'Wings', 'Essence', 'Accessory'].includes(slot);
}
function isPlayerFacing(item) {
  // Current source data does not expose a dedicated visibility flag, so this remains
  // a deliberately isolated heuristic that can be replaced if the schema changes.
  const name = String(item.name || '');
  return (!name.includes('(') && !name.includes(')')) || PLAYER_ITEM_ALLOWLIST.has(name);
}
function itemSummary(item) {
  return [item.quality, item.slot, item.requiredLevel ? `Level ${item.requiredLevel}` : null].filter(Boolean).join(' · ') || 'Crafted item';
}
function itemKey(item) {
  const id = String(item?.id ?? '').trim();
  if (id) return id;
  const code = normalizeCode(item?.rawCode);
  if (code) return code;
  return normalizeText(item?.name);
}
function normalizeText(value) { return String(value ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function normalizeCode(value) { return String(value || '').trim().toLowerCase(); }
function cleanMapName(value) { return String(value || 'Hellfire RPG').replace(/\.w3x$/i, ''); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function cleanGameText(value) {
  if (value == null) return '';

  return String(value)
    // Warcraft III color escape: |cffRRGGBB ... |r
    .replace(/\|cff[0-9a-fA-F]{6}/g, '')
    .replace(/\|r/g, '')
    // Other common Warcraft III inline control sequences.
    .replace(/\|c[0-9a-fA-F]{8}/g, '')
    .replace(/\|n/g, '\n')
    .replace(/\|t/g, '')
    .replace(/\|h/g, '')
    .replace(/\|H[^|]*\|h/g, '')
    .replace(/\|[a-zA-Z]/g, '');
}

  function tooltipSectionsExcept(tooltip, excludedHeadings) {
    const lines = String(tooltip || '').split('\n');
    const result = [];
    let currentHeading = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^[A-Za-z][A-Za-z ]*:$/.test(line)) {
        currentHeading = line;
        continue;
      }
      if (!currentHeading || !excludedHeadings.has(currentHeading)) {
        result.push(rawLine);
      }
    }
    return result;
  }

  return { clamp, cleanGameText, cleanMapName, escapeHtml, extractTooltipSection, formatNumber, getItemCategory, isPlayerFacing, isWearableItem, itemKey, itemSummary, normalizeCode, normalizeText, tooltipSectionsExcept };
}

function extractTooltipSection(tooltip, heading) {
  const lines = String(tooltip || '').split('\n');
  const index = lines.findIndex((line) => line.trim() === heading);
  if (index < 0) return [];
  const result = [];
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) break;
    if (/^[A-Za-z][A-Za-z ]*:$/.test(line.trim())) break;
    result.push(line);
  }
  return result;
}function formatNumber(value) {
  return value == null
    ? '—'
    : Number.isFinite(Number(value))
      ? Number(value).toLocaleString()
      : String(value);
}
