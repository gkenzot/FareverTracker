import { DEFAULT_DASHBOARD_SETTINGS } from "../constants/defaultPreferences";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { readJsonStorage, readStoredIds } from "./storage";

const USER_PREFERENCE_KEY_PREFIXES = [
  "farever-check:hidden-columns-",
  "farever-check:column-order-",
  "farever-check:view-state-"
];

function hasArrayItems(storageKey) {
  return readStoredIds(storageKey).length > 0;
}

function isDefaultDashboardSettings(value) {
  return JSON.stringify(value) === JSON.stringify(DEFAULT_DASHBOARD_SETTINGS);
}

function hasStoredCharacters() {
  const characters = readJsonStorage(STORAGE_KEYS.characters, []);
  return Array.isArray(characters) && characters.length > 0;
}

function hasStoredDashboardSettings() {
  const rawValue = localStorage.getItem(STORAGE_KEYS.dashboardSettings);

  if (!rawValue) {
    return false;
  }

  try {
    const value = JSON.parse(rawValue);
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && !isDefaultDashboardSettings(value));
  } catch {
    return false;
  }
}

function hasStoredUserPreferences() {
  for (const key of Object.keys(localStorage)) {
    if (USER_PREFERENCE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      return true;
    }
  }

  return false;
}

function hasStoredProgress(configs, order) {
  const progressPrefixes = order.map((key) => `${configs[key].storageKey}:`);

  for (const key of order) {
    if (hasArrayItems(configs[key].storageKey)) {
      return true;
    }
  }

  for (const key of Object.keys(localStorage)) {
    if (progressPrefixes.some((prefix) => key.startsWith(prefix)) && hasArrayItems(key)) {
      return true;
    }
  }

  return false;
}

export function hasStoredAppState(configs, order) {
  return (
    hasStoredCharacters() ||
    hasStoredProgress(configs, order) ||
    hasStoredDashboardSettings() ||
    hasStoredUserPreferences()
  );
}
