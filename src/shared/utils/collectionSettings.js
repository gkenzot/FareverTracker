import { STORAGE_KEYS } from "../constants/storageKeys";
import { DEFAULT_DASHBOARD_SETTINGS } from "../constants/defaultPreferences";
import { readJsonStorage } from "./storage";

export const DASHBOARD_SETTINGS_STORAGE_KEY = STORAGE_KEYS.dashboardSettings;

const DEFAULT_GLOBAL_SETTINGS = {
  accountShowCollectible: true,
  accountShowNotInGame: false,
  characterFilterByVocation: true
};

function uniqueValues(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function mergeExcludedPropertyValues(...sources) {
  const merged = {};

  for (const source of sources) {
    for (const [key, values] of Object.entries(source ?? {})) {
      merged[key] = uniqueValues([...(merged[key] ?? []), ...(Array.isArray(values) ? values : [])]);
    }
  }

  return merged;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mergeDashboardSettings(defaultSettings, storedSettings) {
  const mergedSettings = { ...defaultSettings, ...storedSettings };

  for (const key of Object.keys(mergedSettings)) {
    const defaultValue = defaultSettings[key];
    const storedValue = storedSettings[key];

    if (!isPlainObject(defaultValue) || !isPlainObject(storedValue)) {
      continue;
    }

    mergedSettings[key] = {
      ...defaultValue,
      ...storedValue,
      excludedPropertyValues: {
        ...(defaultValue.excludedPropertyValues ?? {}),
        ...(storedValue.excludedPropertyValues ?? {})
      }
    };
  }

  return mergedSettings;
}

/** Older builds hid recipes without pickup rarity, which also hid newly imported recipes. */
function migrateRecipePickupRarityExclusion(settings) {
  const recipes = settings?.recipes;
  const excludedPickupRarities = recipes?.excludedPropertyValues?.pickup_rarity;

  if (!Array.isArray(excludedPickupRarities) || !excludedPickupRarities.includes("-")) {
    return settings;
  }

  const nextPickupRarities = excludedPickupRarities.filter((value) => value !== "-");
  const nextExcludedPropertyValues = { ...(recipes.excludedPropertyValues ?? {}) };

  if (nextPickupRarities.length > 0) {
    nextExcludedPropertyValues.pickup_rarity = nextPickupRarities;
  } else {
    delete nextExcludedPropertyValues.pickup_rarity;
  }

  return {
    ...settings,
    recipes: {
      ...recipes,
      excludedPropertyValues: nextExcludedPropertyValues
    }
  };
}

/** Older builds hid Demon variants and all Rabbits, which also hid newly added companions. */
function migrateCompanionExclusions(settings) {
  const companions = settings?.companions;
  const excludedPropertyValues = companions?.excludedPropertyValues;

  if (!excludedPropertyValues) {
    return settings;
  }

  const nextExcludedPropertyValues = { ...excludedPropertyValues };
  let changed = false;

  if (Array.isArray(nextExcludedPropertyValues.variant) && nextExcludedPropertyValues.variant.includes("Demon")) {
    const nextVariants = nextExcludedPropertyValues.variant.filter((value) => value !== "Demon");
    if (nextVariants.length > 0) {
      nextExcludedPropertyValues.variant = nextVariants;
    } else {
      delete nextExcludedPropertyValues.variant;
    }
    changed = true;
  }

  if (Array.isArray(nextExcludedPropertyValues.species) && nextExcludedPropertyValues.species.includes("Rabbit")) {
    const nextSpecies = nextExcludedPropertyValues.species.filter((value) => value !== "Rabbit");
    if (nextSpecies.length > 0) {
      nextExcludedPropertyValues.species = nextSpecies;
    } else {
      delete nextExcludedPropertyValues.species;
    }
    changed = true;
  }

  if (!changed) {
    return settings;
  }

  return {
    ...settings,
    companions: {
      ...companions,
      excludedPropertyValues: nextExcludedPropertyValues
    }
  };
}

export function readDashboardSettings() {
  const value = readJsonStorage(DASHBOARD_SETTINGS_STORAGE_KEY, {});
  const storedSettings = isPlainObject(value) ? value : {};
  return migrateCompanionExclusions(
    migrateRecipePickupRarityExclusion(mergeDashboardSettings(DEFAULT_DASHBOARD_SETTINGS, storedSettings))
  );
}

export function getCollectionSettings(settings, collectionKey) {
  const collectionSettings = settings?.[collectionKey];
  return collectionSettings && typeof collectionSettings === "object" ? collectionSettings : {};
}

export function getGlobalSettings(settings) {
  const globalSettings = settings?.global;
  const normalizedSettings = globalSettings && typeof globalSettings === "object" ? globalSettings : {};

  return {
    ...DEFAULT_GLOBAL_SETTINGS,
    ...normalizedSettings,
    accountShowNotInGame:
      normalizedSettings.accountShowNotInGame ?? !Boolean(normalizedSettings.accountHideUnavailable ?? true)
  };
}

export function getPrepareOptions(config, settings, character = null, options = {}) {
  const { applyCollectionExclusions = true } = options;
  const globalSettings = getGlobalSettings(settings);
  const collectionSettings = getCollectionSettings(settings, config.key);
  const excludedSourceKinds = uniqueValues([
    ...(config.excludedSourceKinds ?? []),
    ...(applyCollectionExclusions ? collectionSettings.excludedSourceKinds ?? [] : [])
  ]);
  const accountVisibility =
    config.scope === "account"
      ? {
          showCollectible: globalSettings.accountShowCollectible,
          showNotInGame: globalSettings.accountShowNotInGame
        }
      : null;

  return {
    className: character?.className,
    restrictByCharacterClass: config.restrictByCharacterClass && globalSettings.characterFilterByVocation,
    excludedRarities: config.excludedRarities,
    excludedPropertyValues: mergeExcludedPropertyValues(
      config.excludedPropertyValues,
      applyCollectionExclusions ? collectionSettings.excludedPropertyValues : undefined
    ),
    excludedSourceKinds,
    accountVisibility,
    dedupeBy: config.dedupeBy
  };
}
