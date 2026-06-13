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

export function readDashboardSettings() {
  const value = readJsonStorage(DASHBOARD_SETTINGS_STORAGE_KEY, {});
  const storedSettings = isPlainObject(value) ? value : {};
  return mergeDashboardSettings(DEFAULT_DASHBOARD_SETTINGS, storedSettings);
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
