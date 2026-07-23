/**
 * Catalog itemLevel = max obtainable level for classification/sorting:
 * - merchant / Valley shop → 20
 * - dungeon / drop / cache / other loot → 25
 * - pure crafts → keep fixed craft level
 * - pure starter kit → keep
 */
export const MAX_DROP_CATALOG_LEVEL = 25;
export const SHOP_CATALOG_LEVEL = 20;

const VALLEY_LEVEL_20_SHOP_WEAPONS = new Set([
  "Radiance",
  "Judgement",
  "Judgment",
  "Credence",
  "Glory",
  "Dominion",
  "Apprentice's Grimoire",
  "Light Practice Sword",
  "Practice Daggers",
  "Training Buckler",
  "Initiate's Scepter"
]);

function sourcesOf(item) {
  return Array.isArray(item?.sources) ? item.sources : [];
}

export function isCraftedGear(item) {
  if (!item) return false;
  const sources = sourcesOf(item);
  if (sources.some((source) => String(source?.kind ?? "").toLowerCase() === "craft")) {
    return true;
  }
  if (/Craft/i.test(String(item.id ?? ""))) {
    return true;
  }
  const text = sources.map((source) => String(source?.text ?? "")).join(" ");
  return /\bcraft(?:ed|ing)?\b/i.test(text);
}

export function isMerchantShopGear(item) {
  if (!item) return false;
  if (VALLEY_LEVEL_20_SHOP_WEAPONS.has(item.name)) {
    return true;
  }
  return sourcesOf(item).some((source) => {
    const kind = String(source?.kind ?? "").toLowerCase();
    if (kind === "shop") {
      return true;
    }
    return /valley merchant|wandering merchant/i.test(String(source?.text ?? ""));
  });
}

export function isPureStarterGear(item) {
  const sources = sourcesOf(item);
  if (sources.length === 0) {
    return false;
  }
  return sources.every((source) => {
    const kind = String(source?.kind ?? "").toLowerCase();
    return kind === "starter" || /starter equipment|^starter$/i.test(String(source?.text ?? ""));
  });
}

/** Pure craft (not also a merchant shop item) keeps its catalog level. */
export function isFixedCraftGear(item) {
  return isCraftedGear(item) && !isMerchantShopGear(item);
}

export function resolveMaxObtainableCatalogLevel(item) {
  if (!item) {
    return null;
  }

  const current = item.itemLevel ?? item.properties?.level ?? null;
  const currentNumber = Number(current);

  // Premium / appearance with no level — leave alone unless shop/loot.
  if (current == null || current === "") {
    if (isFixedCraftGear(item)) {
      return null;
    }
    if (isMerchantShopGear(item) || isPureStarterGear(item)) {
      return SHOP_CATALOG_LEVEL;
    }
    const sources = sourcesOf(item);
    if (
      sources.some((source) =>
        ["drop", "chest", "container", "instance"].includes(String(source?.kind ?? "").toLowerCase())
      )
    ) {
      return MAX_DROP_CATALOG_LEVEL;
    }
    return null;
  }

  if (isFixedCraftGear(item)) {
    return Number.isFinite(currentNumber) ? currentNumber : null;
  }

  // Starter kit pieces are also sold as Rare L20 in the Valley merchant.
  if (isMerchantShopGear(item) || isPureStarterGear(item)) {
    return SHOP_CATALOG_LEVEL;
  }

  return MAX_DROP_CATALOG_LEVEL;
}

export function withCatalogMaxLevel(item) {
  const nextLevel = resolveMaxObtainableCatalogLevel(item);
  if (nextLevel == null || Number(item.itemLevel) === Number(nextLevel)) {
    return item;
  }

  return {
    ...item,
    itemLevel: nextLevel,
    properties: {
      ...item.properties,
      level: nextLevel
    }
  };
}
