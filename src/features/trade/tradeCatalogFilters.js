function getItemRarity(item) {
  return String(item?.rarity ?? item?.properties?.rarity ?? "").trim();
}

export function isCommonTradeItem(item) {
  return getItemRarity(item).toLowerCase() === "common";
}

export function isUncommonTradeItem(item) {
  return getItemRarity(item).toLowerCase() === "uncommon";
}

export function isPaidShopTradeItem(item) {
  return (item?.sources ?? []).some((source) => {
    const kind = String(source?.kind ?? "").toLowerCase();
    if (kind === "in_game_store") {
      return true;
    }

    return /premium item/i.test(String(source?.text ?? ""));
  });
}

export function isNotInGameTradeItem(item) {
  if (item?.inGame === false) {
    return true;
  }

  return (item?.sources ?? []).some((source) => String(source?.kind ?? "").toLowerCase() === "upcoming");
}

export function shouldHideTradeArmorItem(item) {
  return isCommonTradeItem(item) || isUncommonTradeItem(item) || isPaidShopTradeItem(item);
}

export function shouldHideTradeCatalogItem(item, categoryKey) {
  if (isNotInGameTradeItem(item)) {
    return true;
  }

  if (categoryKey === "armor") {
    return shouldHideTradeArmorItem(item);
  }

  return false;
}
