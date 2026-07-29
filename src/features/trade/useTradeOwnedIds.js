import { useEffect, useMemo, useState } from "react";
import { collectionConfigs } from "../collections/collectionConfigs";
import { getCharacterStorageKey } from "../../shared/constants/storageKeys";
import { PROGRESS_CHANGE_EVENT, readStoredIdSet } from "../../shared/utils/storage";
import { TRADE_CATEGORIES } from "./tradeConstants";

function readOwnedIdsForCategory(categoryKey, characterId) {
  const config = collectionConfigs[categoryKey];
  if (!config) {
    return new Set();
  }

  if (config.scope === "account") {
    return readStoredIdSet(config.storageKey);
  }

  if (!characterId) {
    return new Set();
  }

  return readStoredIdSet(getCharacterStorageKey(config.storageKey, characterId));
}

export function useTradeOwnedIds(characterId) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    function refresh() {
      setVersion((current) => current + 1);
    }

    window.addEventListener("storage", refresh);
    window.addEventListener(PROGRESS_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PROGRESS_CHANGE_EVENT, refresh);
    };
  }, []);

  const ownedByCategory = useMemo(
    () =>
      Object.fromEntries(
        TRADE_CATEGORIES.map((category) => [
          category.key,
          readOwnedIdsForCategory(category.key, characterId)
        ])
      ),
    [characterId, version]
  );

  return { ownedByCategory };
}
