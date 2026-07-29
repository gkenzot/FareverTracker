import {
  EQUIPMENT_SLOTS,
  WEAPON_RARITY_OPTIONS,
  createEmptyAdornments,
  getAdornmentFieldsForSlot,
  getDefaultUsedLevel,
  getDefaultUsedRarity,
  isOffHandOnlyWeapon,
  itemFitsSlot
} from "../builds/buildSlots";

export const TRADE_DRAG_MIME = "application/x-farever-trade-item";

export const TRADE_CATEGORIES = [
  { key: "mounts", label: "Mounts", dataPath: "data/mounts.json", collectionKey: "mounts" },
  { key: "gliders", label: "Gliders", dataPath: "data/gliders.json", collectionKey: "gliders" },
  { key: "armor", label: "Armor", dataPath: "data/armor.json", collectionKey: "armor" },
  { key: "weapons", label: "Weapons", dataPath: "data/weapons.json", collectionKey: "weapons" },
  { key: "jewellery", label: "Jewellery", dataPath: "data/jewellery.json", collectionKey: "jewellery" }
];

export const TRADE_CONFIGURABLE_COLLECTIONS = new Set(["armor", "weapons", "jewellery"]);

export function tradeEntryKey(collectionKey, itemId) {
  return `${collectionKey}:${itemId}`;
}

export function isConfigurableTradeCollection(collectionKey) {
  return TRADE_CONFIGURABLE_COLLECTIONS.has(collectionKey);
}

/** Best equipment slot for trade adornments / weapon controls. */
export function inferTradeSlotKey(item, collectionKey) {
  if (!item || !isConfigurableTradeCollection(collectionKey)) {
    return "";
  }

  if (collectionKey === "weapons") {
    return isOffHandOnlyWeapon(item) ? "secondaryWeapon" : "weapon";
  }

  const slot = EQUIPMENT_SLOTS.find(
    (entry) =>
      entry.collectionKey === collectionKey &&
      entry.key !== "ring2" &&
      entry.key !== "arsenal" &&
      itemFitsSlot(item, entry.key)
  );

  return slot?.key ?? "";
}

export function createTradeEntry(item, collectionKey) {
  const configurable = isConfigurableTradeCollection(collectionKey);
  const isWeapon = collectionKey === "weapons";

  return {
    key: tradeEntryKey(collectionKey, item.id),
    collectionKey,
    itemId: item.id,
    name: item.name,
    iconPath: item.iconPath ?? null,
    rarity: item.rarity ?? item.properties?.rarity ?? "—",
    usedLevel: configurable ? getDefaultUsedLevel(item) : null,
    usedRarity: isWeapon ? getDefaultUsedRarity(item) : null,
    usedUpgradeLevel: 0,
    adornments: configurable ? createEmptyAdornments() : createEmptyAdornments()
  };
}

export function normalizeTradeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const collectionKey = String(entry.collectionKey ?? "");
  const itemId = String(entry.itemId ?? "");
  if (!collectionKey || !itemId) {
    return null;
  }

  const configurable = isConfigurableTradeCollection(collectionKey);
  const usedRarityRaw = String(entry.usedRarity ?? "").trim();
  const matchedRarity = WEAPON_RARITY_OPTIONS.find(
    (option) => option.toLowerCase() === usedRarityRaw.toLowerCase()
  );

  return {
    key: entry.key || tradeEntryKey(collectionKey, itemId),
    collectionKey,
    itemId,
    name: entry.name ?? itemId,
    iconPath: entry.iconPath ?? null,
    rarity: entry.rarity ?? "—",
    usedLevel: configurable && entry.usedLevel != null && entry.usedLevel !== "" ? Number(entry.usedLevel) : null,
    usedRarity: collectionKey === "weapons" && matchedRarity ? matchedRarity : null,
    usedUpgradeLevel: Number(entry.usedUpgradeLevel) > 0 ? Math.floor(Number(entry.usedUpgradeLevel)) : 0,
    adornments: {
      ...createEmptyAdornments(),
      ...(entry.adornments && typeof entry.adornments === "object" ? entry.adornments : {})
    }
  };
}

export function formatTradeEntrySummary(entry, item = null) {
  return getTradeEntryDetailLines(entry, item)
    .map((line) => (line.value ? `${line.label}: ${line.value}` : line.label))
    .join(" · ");
}

/** Structured Buy/Sell card details (level, rarity, upgrade, adornments). */
export function getTradeEntryDetailLines(entry, item = null) {
  if (!entry) {
    return [];
  }

  if (!isConfigurableTradeCollection(entry.collectionKey)) {
    return [];
  }

  const lines = [];
  const rarity = entry.usedRarity || entry.rarity || "—";

  if (entry.usedLevel != null && Number.isFinite(Number(entry.usedLevel))) {
    lines.push({ label: "Level", value: String(entry.usedLevel) });
  }

  lines.push({ label: "Rarity", value: String(rarity) });

  if (entry.collectionKey === "weapons") {
    const upgrade = Number(entry.usedUpgradeLevel) || 0;
    if (upgrade > 0) {
      lines.push({ label: "Upgrade", value: `★${upgrade}` });
    }
  }

  const adornments = {
    ...createEmptyAdornments(),
    ...(entry.adornments && typeof entry.adornments === "object" ? entry.adornments : {})
  };

  const slotKey = item ? inferTradeSlotKey(item, entry.collectionKey) : "";
  const fields = slotKey
    ? getAdornmentFieldsForSlot(slotKey)
    : getAdornmentFieldsForCollection(entry.collectionKey);

  const seen = new Set();
  for (const field of fields) {
    if (seen.has(field.key)) {
      continue;
    }
    seen.add(field.key);
    const value = String(adornments[field.key] ?? "").trim();
    if (!value) {
      continue;
    }
    lines.push({
      label: field.label,
      value
    });
  }

  // If slot is unknown, still surface any configured adornments.
  if (!slotKey) {
    for (const [key, raw] of Object.entries(adornments)) {
      if (!raw || seen.has(key)) {
        continue;
      }
      seen.add(key);
      lines.push({
        label: adornmentLabelForKey(key),
        value: String(raw)
      });
    }
  }

  return lines;
}

function getAdornmentFieldsForCollection(collectionKey) {
  if (collectionKey === "weapons") {
    return getAdornmentFieldsForSlot("weapon");
  }
  if (collectionKey === "jewellery") {
    return getAdornmentFieldsForSlot("ring1");
  }
  return [];
}

function adornmentLabelForKey(key) {
  const labels = {
    stone: "Stone",
    cursed: "Corrupted Gift",
    enchantmentWeapon: "Weapon Enchantment",
    enchantmentHands: "Magic Formula",
    enchantmentFeet: "Magic Formula",
    sigil: "Demon Sigil",
    plate: "Plate",
    embroidery: "Embroidery"
  };
  return labels[key] || key;
}

export function tradeEntryToSlotValue(entry) {
  return {
    itemId: entry?.itemId ?? "",
    usedLevel: entry?.usedLevel ?? null,
    usedRarity: entry?.usedRarity ?? null,
    usedUpgradeLevel: entry?.usedUpgradeLevel ?? 0,
    adornments: {
      ...createEmptyAdornments(),
      ...(entry?.adornments && typeof entry.adornments === "object" ? entry.adornments : {})
    }
  };
}
