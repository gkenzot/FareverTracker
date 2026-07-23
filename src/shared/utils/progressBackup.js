import { CHARACTER_CLASSES } from "../hooks/useCharacters";
import { getCharacterStorageKey } from "../constants/storageKeys";
import {
  dispatchProgressChange,
  normalizeStoredIds,
  readJsonStorage,
  removeStorageKey,
  readStoredIds,
  writeJsonStorage,
  writeStoredIds
} from "./storage";
import { readWeaponStatusRecord } from "../constants/weaponStatus";
import {
  getCharacterBuildStorageKey,
  readCharacterBuild,
  writeCharacterBuild
} from "../../features/builds/useCharacterBuild";

export const PROGRESS_BACKUP_TYPE = "farever-check-full-progress";
export const PROGRESS_BACKUP_FILENAME = "FareverTracker.json";

function createImportedCharacterId(className) {
  return `imported-${className.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalizeImportedSettings(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeImportedCharacters(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((character) => character?.id && character?.className)
    .map((character) => ({
      id: String(character.id),
      name: String(character.name || character.className),
      className: String(character.className)
    }));
}

function legacyCharactersFromBackup(characterCollections) {
  return CHARACTER_CLASSES.filter((className) => characterCollections[className]).map((className) => ({
    id: createImportedCharacterId(className),
    name: className,
    className
  }));
}

function mergeCharacters(existingCharacters, importedCharacters) {
  const nextCharactersById = new Map(existingCharacters.map((character) => [character.id, character]));

  for (const character of importedCharacters) {
    nextCharactersById.set(character.id, {
      ...nextCharactersById.get(character.id),
      ...character
    });
  }

  return [...nextCharactersById.values()];
}

function buildLegacyCharacterCollections(configs, order, characters) {
  const characterCollections = {};

  for (const key of order) {
    const config = configs[key];

    if (config.scope !== "character") {
      continue;
    }

    for (const character of characters) {
      if (!character.className) {
        continue;
      }

      characterCollections[character.className] ??= {};
      characterCollections[character.className][key] = readStoredIds(getCharacterStorageKey(config.storageKey, character.id));
    }
  }

  return characterCollections;
}

function buildCharacterCollectionsById(configs, order, characters) {
  const characterCollectionsById = {};

  for (const character of characters) {
    if (!character.id || !character.className) {
      continue;
    }

    const collections = {};

    for (const key of order) {
      const config = configs[key];

      if (config.scope === "character") {
        collections[key] = readStoredIds(getCharacterStorageKey(config.storageKey, character.id));
      }
    }

    characterCollectionsById[character.id] = {
      id: character.id,
      name: character.name,
      className: character.className,
      collections
    };
  }

  return characterCollectionsById;
}

function buildCharacterWeaponStatusById(configs, order, characters) {
  const characterWeaponStatusById = {};

  for (const character of characters) {
    if (!character.id) {
      continue;
    }

    for (const key of order) {
      const config = configs[key];

      if (!config.weaponStatusStorageKey) {
        continue;
      }

      characterWeaponStatusById[character.id] ??= {};
      characterWeaponStatusById[character.id][key] = readWeaponStatusRecord(
        readJsonStorage(getCharacterStorageKey(config.weaponStatusStorageKey, character.id), {})
      );
    }
  }

  return characterWeaponStatusById;
}

function buildCharacterBuildsById(characters) {
  const characterBuildsById = {};

  for (const character of characters) {
    if (!character.id) {
      continue;
    }

    characterBuildsById[character.id] = readCharacterBuild(character.id);
  }

  return characterBuildsById;
}

export function createProgressBackup({ configs, order, characters, dashboardSettings }) {
  const accountCollections = {};

  for (const key of order) {
    const config = configs[key];

    if (config.scope === "account") {
      accountCollections[key] = readStoredIds(config.storageKey);
    }
  }

  return {
    type: PROGRESS_BACKUP_TYPE,
    version: 5,
    exportedAt: new Date().toISOString(),
    dashboardSettings,
    characters,
    accountCollections,
    characterCollectionsById: buildCharacterCollectionsById(configs, order, characters),
    characterWeaponStatusById: buildCharacterWeaponStatusById(configs, order, characters),
    characterBuildsById: buildCharacterBuildsById(characters),
    // Kept for older backups/importers. v3 import uses characterCollectionsById.
    characterCollections: buildLegacyCharacterCollections(configs, order, characters)
  };
}

export function downloadProgressBackup(payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = PROGRESS_BACKUP_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}

export function clearCharacterProgress({ configs, order, characterId }) {
  for (const key of order) {
    const config = configs[key];

    if (config.scope === "character") {
      removeStorageKey(getCharacterStorageKey(config.storageKey, characterId));

      if (config.weaponStatusStorageKey) {
        removeStorageKey(getCharacterStorageKey(config.weaponStatusStorageKey, characterId));
      }
    }
  }

  removeStorageKey(getCharacterBuildStorageKey(characterId));
  dispatchProgressChange();
}

export function importProgressBackup({
  payload,
  configs,
  order,
  existingCharacters,
  activeCharacterId,
  replaceCharacters,
  replaceDashboardSettings
}) {
  if (payload?.type !== PROGRESS_BACKUP_TYPE) {
    throw new Error("File is not a full Farever progress backup.");
  }

  const accountCollections = payload.accountCollections ?? {};
  const legacyCharacterCollections = payload.characterCollections ?? {};
  const characterCollectionsById = payload.characterCollectionsById ?? {};
  const characterWeaponStatusById = payload.characterWeaponStatusById ?? {};
  const characterBuildsById = payload.characterBuildsById ?? {};
  const importedDashboardSettings = normalizeImportedSettings(payload.dashboardSettings);
  const hasDashboardSettings = Object.hasOwn(payload, "dashboardSettings");
  const importedCharacters = normalizeImportedCharacters(payload.characters);
  const nextCharacters = mergeCharacters(
    existingCharacters,
    importedCharacters.length > 0 ? importedCharacters : legacyCharactersFromBackup(legacyCharacterCollections)
  );

  for (const key of order) {
    const config = configs[key];

    if (config.scope === "account") {
      if (Object.hasOwn(accountCollections, key)) {
        writeStoredIds(config.storageKey, accountCollections[key]);
      }

      continue;
    }

    for (const character of nextCharacters) {
      const v3Progress = characterCollectionsById[character.id]?.collections?.[key];
      const legacyProgress = legacyCharacterCollections[character.className]?.[key];
      const progress = v3Progress ?? legacyProgress;

      if (progress !== undefined) {
        writeStoredIds(getCharacterStorageKey(config.storageKey, character.id), normalizeStoredIds(progress));
      }

      if (config.weaponStatusStorageKey && characterWeaponStatusById[character.id]?.[key]) {
        writeJsonStorage(
          getCharacterStorageKey(config.weaponStatusStorageKey, character.id),
          readWeaponStatusRecord(characterWeaponStatusById[character.id][key])
        );
      }
    }
  }

  for (const character of nextCharacters) {
    if (characterBuildsById[character.id]) {
      writeCharacterBuild(character.id, characterBuildsById[character.id]);
    }
  }

  if (hasDashboardSettings) {
    replaceDashboardSettings(importedDashboardSettings);
  }

  replaceCharacters(nextCharacters, activeCharacterId || nextCharacters[0]?.id || "");
  dispatchProgressChange();

  return {
    accountCount: Object.keys(accountCollections).length,
    characterCount:
      Object.keys(characterCollectionsById).length || Object.keys(legacyCharacterCollections).length,
    settingsImported: hasDashboardSettings
  };
}

export function summarizeProgressBackup(payload) {
  return {
    accountCount: Object.keys(payload.accountCollections ?? {}).length,
    characterCount:
      Object.keys(payload.characterCollectionsById ?? {}).length || Object.keys(payload.characterCollections ?? {}).length,
    settingsExported: Boolean(payload.dashboardSettings)
  };
}
