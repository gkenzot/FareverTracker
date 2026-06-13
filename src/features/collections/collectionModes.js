import { getCharacterStorageKey } from "../../shared/hooks/useCharacters";
import { prepareCollectionItems } from "../../shared/utils/characterClass";
import { getPrepareOptions } from "../../shared/utils/collectionSettings";
import { readStoredIdSet } from "../../shared/utils/storage";

export function createMissingItems(items, config, dashboardSettings, characters) {
  const itemsById = new Map();

  for (const character of characters) {
    const characterItems = prepareCollectionItems(items, getPrepareOptions(config, dashboardSettings, character));
    const collectedIds = readStoredIdSet(getCharacterStorageKey(config.storageKey, character.id));

    for (const item of characterItems) {
      const current = itemsById.get(item.id) ?? {
        ...item,
        characterCount: 0,
        missingCount: 0,
        missingCharacterNames: []
      };

      current.characterCount += 1;
      if (!collectedIds.has(item.id)) {
        current.missingCount += 1;
        current.missingCharacterNames.push(character.name);
      }

      itemsById.set(item.id, current);
    }
  }

  return [...itemsById.values()];
}
