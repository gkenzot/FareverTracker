export const STORAGE_KEYS = {
  activeCharacter: "farever-check:active-character",
  characters: "farever-check:characters",
  dashboardSettings: "farever-check:dashboard-settings",
  hiddenCharacterMenus: "farever-check:hidden-character-menus"
};

export function getCharacterStorageKey(storageKey, characterId) {
  return `${storageKey}:${characterId}`;
}
