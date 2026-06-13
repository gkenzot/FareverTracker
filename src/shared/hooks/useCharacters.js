import { useEffect, useState } from "react";
import { getCharacterStorageKey, STORAGE_KEYS } from "../constants/storageKeys";
import { readJsonStorage, removeStorageKey, writeJsonStorage, writeTextStorage } from "../utils/storage";

export const CHARACTER_CLASSES = ["Warrior", "Mage", "Priest", "Rogue"];
export { getCharacterStorageKey };

function readCharacters() {
  const characters = readJsonStorage(STORAGE_KEYS.characters, []);
  return Array.isArray(characters) ? characters : [];
}

function createCharacterId(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
}

function normalizeCharacterClass(className) {
  return CHARACTER_CLASSES.find((characterClass) => characterClass.toLowerCase() === className.trim().toLowerCase()) ?? "";
}

export function useCharacters() {
  const [characters, setCharacters] = useState(readCharacters);
  const [activeCharacterId, setActiveCharacterId] = useState(() => localStorage.getItem(STORAGE_KEYS.activeCharacter) ?? "");

  useEffect(() => {
    if (characters.length === 0) {
      setActiveCharacterId("");
      return;
    }

    if (!characters.some((character) => character.id === activeCharacterId)) {
      setActiveCharacterId(characters[0].id);
    }
  }, [activeCharacterId, characters]);

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.characters, characters);
  }, [characters]);

  useEffect(() => {
    if (activeCharacterId) {
      writeTextStorage(STORAGE_KEYS.activeCharacter, activeCharacterId);
    } else {
      removeStorageKey(STORAGE_KEYS.activeCharacter);
    }
  }, [activeCharacterId]);

  function createCharacter(name, className) {
    const trimmedName = name.trim();
    const normalizedClass = normalizeCharacterClass(className);

    if (!trimmedName || !normalizedClass) {
      return null;
    }

    const character = {
      id: createCharacterId(trimmedName),
      name: trimmedName,
      className: normalizedClass
    };

    setCharacters((current) => [...current, character]);
    setActiveCharacterId(character.id);

    return character;
  }

  function updateCharacterClass(characterId, className) {
    const normalizedClass = normalizeCharacterClass(className);

    if (!normalizedClass) {
      return false;
    }

    setCharacters((current) =>
      current.map((character) =>
        character.id === characterId ? { ...character, className: normalizedClass } : character
      )
    );

    return true;
  }

  function deleteCharacter(characterId) {
    setCharacters((current) => current.filter((character) => character.id !== characterId));
  }

  function replaceCharacters(nextCharacters, nextActiveCharacterId = "") {
    writeJsonStorage(STORAGE_KEYS.characters, nextCharacters);
    if (nextActiveCharacterId) {
      writeTextStorage(STORAGE_KEYS.activeCharacter, nextActiveCharacterId);
    } else {
      removeStorageKey(STORAGE_KEYS.activeCharacter);
    }

    setCharacters(nextCharacters);
    setActiveCharacterId(nextActiveCharacterId);
  }

  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? null;

  return {
    characters,
    activeCharacter,
    activeCharacterId: activeCharacter?.id ?? "",
    setActiveCharacterId,
    createCharacter,
    updateCharacterClass,
    deleteCharacter,
    replaceCharacters
  };
}
