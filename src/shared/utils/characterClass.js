import { getPrimarySource } from "./collection";

/** MetaForge sometimes labels vocations with in-game names (Fighter) instead of UI names (Warrior). */
const CLASS_ALIASES = {
  warrior: ["warrior", "fighter"],
  rogue: ["rogue", "assassin"],
  mage: ["mage", "wizard"],
  priest: ["priest", "cleric"]
};

function normalizeClassLabel(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  for (const [canonical, aliases] of Object.entries(CLASS_ALIASES)) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }

  return normalized;
}

function itemClassLabels(item) {
  const classes = item.properties?.classes;

  if (Array.isArray(classes)) {
    return classes.map(normalizeClassLabel);
  }

  if (classes === undefined || classes === null || classes === "") {
    return [];
  }

  return [normalizeClassLabel(classes)];
}

export function itemMatchesCharacterClass(item, className) {
  if (!className) {
    return true;
  }

  const target = normalizeClassLabel(className);
  return itemClassLabels(item).includes(target);
}

export function filterItemsByCharacterClass(items, className) {
  if (!className) {
    return items;
  }

  return items.filter((item) => itemMatchesCharacterClass(item, className));
}

function normalizeExcludedValue(value) {
  return String(value ?? "-").toLowerCase();
}

export function getCollectionAttributeValue(item, key) {
  if (key === "itemLevel") {
    const value = item.itemLevel ?? item.properties?.level ?? item.properties?.ilevel;

    return value === undefined || value === null ? "-" : value;
  }

  return item.properties?.[key] ?? item[key] ?? "-";
}

function getItemPropertyValue(item, key) {
  return getCollectionAttributeValue(item, key);
}

function itemMatchesExcludedPropertyValue(item, excludedPropertyValues) {
  return Object.entries(excludedPropertyValues).some(([key, excludedValues]) => {
    const excludedValueSet = new Set(excludedValues.map(normalizeExcludedValue));
    const itemValue = getItemPropertyValue(item, key);
    const itemValues = Array.isArray(itemValue) ? itemValue : [itemValue];

    return itemValues.some((value) => excludedValueSet.has(normalizeExcludedValue(value)));
  });
}

function itemMatchesExcludedSourceKind(item, excludedSourceKinds) {
  const excludedSourceKindSet = new Set(excludedSourceKinds.map(normalizeExcludedValue));

  return excludedSourceKindSet.has(normalizeExcludedValue(getPrimarySource(item)));
}

function isNotInGame(item) {
  return (item.sources ?? []).some((source) => normalizeExcludedValue(source.kind) === "upcoming");
}

function itemMatchesAccountVisibility(item, accountVisibility) {
  if (!accountVisibility) {
    return true;
  }

  const upcoming = isNotInGame(item);
  const collectible = !upcoming;
  const { showCollectible, showNotInGame } = accountVisibility;

  if (!showCollectible && !showNotInGame) {
    return true;
  }

  return (showCollectible && collectible) || (showNotInGame && upcoming);
}

export function filterCharacterCollectionItems(
  items,
  {
    className,
    restrictByCharacterClass,
    excludedRarities = [],
    excludedPropertyValues = {},
    excludedSourceKinds = [],
    accountVisibility = null
  }
) {
  const excludedRaritySet = new Set(excludedRarities.map((rarity) => String(rarity).toLowerCase()));

  return items.filter((item) => {
    const rarity = String(item.properties?.rarity ?? item.rarity ?? "").toLowerCase();
    const matchesRarity = !excludedRaritySet.has(rarity);
    const matchesClass = !restrictByCharacterClass || itemMatchesCharacterClass(item, className);
    const matchesExcludedProperties = itemMatchesExcludedPropertyValue(item, excludedPropertyValues);
    const matchesExcludedSource = itemMatchesExcludedSourceKind(item, excludedSourceKinds);
    const matchesAccountVisibility = itemMatchesAccountVisibility(item, accountVisibility);

    return (
      matchesRarity &&
      matchesClass &&
      !matchesExcludedProperties &&
      !matchesExcludedSource &&
      matchesAccountVisibility
    );
  });
}

function getDedupeValue(item, key) {
  return key.split(".").reduce((value, pathPart) => value?.[pathPart], item);
}

export function prepareCollectionItems(
  items,
  {
    className,
    restrictByCharacterClass,
    excludedRarities = [],
    excludedPropertyValues = {},
    excludedSourceKinds = [],
    accountVisibility = null,
    dedupeBy
  }
) {
  const filteredItems = filterCharacterCollectionItems(items, {
    className,
    restrictByCharacterClass,
    excludedRarities,
    excludedPropertyValues,
    excludedSourceKinds,
    accountVisibility
  });

  if (!dedupeBy) {
    return filteredItems;
  }

  const seen = new Set();

  return filteredItems.filter((item) => {
    const dedupeValue = getDedupeValue(item, dedupeBy) ?? item.id;

    if (seen.has(dedupeValue)) {
      return false;
    }

    seen.add(dedupeValue);
    return true;
  });
}
