const GEAR_STAT_COLLECTIONS = new Set(["armor", "weapons", "jewellery"]);

export function collectionSupportsGearTooltip(collectionKey) {
  return GEAR_STAT_COLLECTIONS.has(collectionKey);
}
