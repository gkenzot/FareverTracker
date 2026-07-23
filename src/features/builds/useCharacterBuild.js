import { useEffect, useMemo, useState } from "react";
import { getCharacterStorageKey } from "../../shared/constants/storageKeys";
import { PROGRESS_CHANGE_EVENT, readJsonStorage, writeJsonStorage } from "../../shared/utils/storage";
import { collectionConfigs } from "../collections/collectionConfigs";
import {
  addCharacterBuildSet,
  createEmptyCharacterBuild,
  normalizeCharacterBuild,
  removeCharacterBuildSet
} from "./buildSlots";

export function getCharacterBuildStorageKey(characterId) {
  return getCharacterStorageKey("farever-check:character-build", characterId);
}

export function readCharacterBuild(characterId) {
  if (!characterId) {
    return createEmptyCharacterBuild();
  }

  return normalizeCharacterBuild(readJsonStorage(getCharacterBuildStorageKey(characterId), null));
}

export function writeCharacterBuild(characterId, build) {
  if (!characterId) {
    return false;
  }

  return writeJsonStorage(getCharacterBuildStorageKey(characterId), normalizeCharacterBuild(build));
}

export function useCharacterBuild(characterId) {
  const [build, setBuild] = useState(() => readCharacterBuild(characterId));

  useEffect(() => {
    setBuild(readCharacterBuild(characterId));
  }, [characterId]);

  useEffect(() => {
    if (!characterId) {
      return;
    }

    writeCharacterBuild(characterId, build);
  }, [build, characterId]);

  function persist(next) {
    const normalized = normalizeCharacterBuild(next);
    if (characterId) {
      writeCharacterBuild(characterId, normalized);
    }
    return normalized;
  }

  function updateSet(setIndex, updater) {
    setBuild((current) => {
      const normalized = normalizeCharacterBuild(current);
      const previous = normalized.sets[setIndex];
      if (!previous) {
        return normalized;
      }
      const nextSet = typeof updater === "function" ? updater(previous) : updater;
      const sets = normalized.sets.map((set, index) => (index === setIndex ? nextSet : set));
      return persist({ ...normalized, sets });
    });
  }

  function addSet() {
    setBuild((current) => persist(addCharacterBuildSet(current, 0)));
  }

  function removeSet(setIndex) {
    setBuild((current) => persist(removeCharacterBuildSet(current, setIndex)));
  }

  function resetBuild() {
    setBuild(persist(createEmptyCharacterBuild()));
  }

  return {
    build,
    setBuild,
    updateSet,
    addSet,
    removeSet,
    resetBuild
  };
}

const GEAR_COLLECTION_KEYS = ["weapons", "armor", "jewellery"];

export function useOwnedGearCatalog(characterId) {
  const [catalogs, setCatalogs] = useState({
    weapons: [],
    armor: [],
    jewellery: []
  });
  const [ownedIds, setOwnedIds] = useState({
    weapons: new Set(),
    armor: new Set(),
    jewellery: new Set()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ownedVersion, setOwnedVersion] = useState(0);

  useEffect(() => {
    function refreshOwned() {
      setOwnedVersion((current) => current + 1);
    }

    window.addEventListener("storage", refreshOwned);
    window.addEventListener(PROGRESS_CHANGE_EVENT, refreshOwned);

    return () => {
      window.removeEventListener("storage", refreshOwned);
      window.removeEventListener(PROGRESS_CHANGE_EVENT, refreshOwned);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      setLoading(true);
      setError("");

      try {
        const entries = await Promise.all(
          GEAR_COLLECTION_KEYS.map(async (key) => {
            const config = collectionConfigs[key];
            const response = await fetch(`${import.meta.env.BASE_URL}${config.dataPath}`);
            if (!response.ok) {
              throw new Error(`Failed to load ${config.dataPath}`);
            }
            const payload = await response.json();
            return [key, payload[config.collectionKey] ?? []];
          })
        );

        if (!cancelled) {
          setCatalogs(Object.fromEntries(entries));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Failed to load gear catalogs.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCatalogs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!characterId) {
      setOwnedIds({
        weapons: new Set(),
        armor: new Set(),
        jewellery: new Set()
      });
      return;
    }

    const next = {};
    for (const key of GEAR_COLLECTION_KEYS) {
      const config = collectionConfigs[key];
      const storageKey = getCharacterStorageKey(config.storageKey, characterId);
      const ids = readJsonStorage(storageKey, []);
      next[key] = new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
    }
    setOwnedIds(next);
  }, [characterId, ownedVersion]);

  const itemsById = useMemo(() => {
    const map = new Map();
    for (const key of GEAR_COLLECTION_KEYS) {
      for (const item of catalogs[key] ?? []) {
        map.set(item.id, { ...item, collectionKey: key });
      }
    }
    return map;
  }, [catalogs]);

  return {
    catalogs,
    ownedIds,
    itemsById,
    loading,
    error
  };
}
