export const OWNED_WEAPON_RARITIES = ["Uncommon", "Rare", "Epic", "Legendary"];

export function normalizeWeaponStatus(value) {
  return OWNED_WEAPON_RARITIES.includes(value) ? value : "";
}

export function readWeaponStatusRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([itemId, rarity]) => typeof itemId === "string" && normalizeWeaponStatus(rarity))
      .map(([itemId, rarity]) => [itemId, normalizeWeaponStatus(rarity)])
  );
}

export function getCatalogWeaponRarity(item) {
  return item.rarity || item.properties?.rarity || "";
}

export function catalogRarityToWeaponStatus(item) {
  return normalizeWeaponStatus(getCatalogWeaponRarity(item));
}
