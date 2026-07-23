export const STORAGE_KEYS = {
  activeCharacter: "farever-check:active-character",
  characters: "farever-check:characters",
  dashboardSettings: "farever-check:dashboard-settings",
  hiddenCharacterMenus: "farever-check:hidden-character-menus",
  buildLab: "farever-check:build-lab"
};

export function getCharacterStorageKey(storageKey, characterId) {
  return `${storageKey}:${characterId}`;
}
