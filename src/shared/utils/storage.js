export const PROGRESS_CHANGE_EVENT = "farever-check:progress-change";
export const DASHBOARD_SETTINGS_CHANGE_EVENT = "farever-check:dashboard-settings-change";

export function readJsonStorage(storageKey, fallbackValue) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return value ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeJsonStorage(storageKey, value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Unable to write ${storageKey} to localStorage.`, error);
    return false;
  }
}

export function normalizeStoredIds(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

export function readStoredIds(storageKey) {
  return normalizeStoredIds(readJsonStorage(storageKey, []));
}

export function readStoredIdSet(storageKey) {
  return new Set(readStoredIds(storageKey));
}

export function writeStoredIds(storageKey, ids) {
  return writeJsonStorage(storageKey, normalizeStoredIds(ids));
}

export function writeTextStorage(storageKey, value) {
  try {
    localStorage.setItem(storageKey, value);
    return true;
  } catch (error) {
    console.warn(`Unable to write ${storageKey} to localStorage.`, error);
    return false;
  }
}

export function removeStorageKey(storageKey) {
  try {
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    console.warn(`Unable to remove ${storageKey} from localStorage.`, error);
    return false;
  }
}

export function getDataUrl(path, reloadToken = null) {
  const url = new URL(`${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`, window.location.origin);

  if (reloadToken !== null) {
    url.searchParams.set("v", String(reloadToken));
  }

  return url;
}

export function dispatchProgressChange() {
  window.dispatchEvent(new CustomEvent(PROGRESS_CHANGE_EVENT));
}

export function dispatchDashboardSettingsChange() {
  window.dispatchEvent(new CustomEvent(DASHBOARD_SETTINGS_CHANGE_EVENT));
}
