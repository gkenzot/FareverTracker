import { useEffect, useState } from "react";
import { getCharacterStorageKey } from "./useCharacters";
import { prepareCollectionItems } from "../utils/characterClass";
import { getPrepareOptions } from "../utils/collectionSettings";
import { fetchJsonData } from "../utils/dataCache";
import { DASHBOARD_SETTINGS_CHANGE_EVENT, PROGRESS_CHANGE_EVENT, readStoredIdSet } from "../utils/storage";

function countCollected(items, storageKey) {
  const storedIds = readStoredIdSet(storageKey);
  return items.filter((item) => storedIds.has(item.id)).length;
}

export function useCollectionStats(configs, order, characters = [], dashboardSettings = {}) {
  const [stats, setStats] = useState({
    current: 0,
    total: 0,
    collections: [],
    accountCollections: [],
    characterCollections: [],
    loading: true,
    error: ""
  });
  const [reloadToken, setReloadToken] = useState(0);
  const [progressToken, setProgressToken] = useState(0);

  useEffect(() => {
    function refreshProgress() {
      setProgressToken((current) => current + 1);
    }

    window.addEventListener("storage", refreshProgress);
    window.addEventListener(PROGRESS_CHANGE_EVENT, refreshProgress);
    window.addEventListener(DASHBOARD_SETTINGS_CHANGE_EVENT, refreshProgress);

    return () => {
      window.removeEventListener("storage", refreshProgress);
      window.removeEventListener(PROGRESS_CHANGE_EVENT, refreshProgress);
      window.removeEventListener(DASHBOARD_SETTINGS_CHANGE_EVENT, refreshProgress);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setStats((current) => ({ ...current, loading: true, error: "" }));

    Promise.all(
      order.map(async (key) => {
        const config = configs[key];
        const payload = await fetchJsonData(config.dataPath, reloadToken);
        const items = payload[config.collectionKey] ?? [];

        if (config.scope === "character") {
          return characters.map((character) => {
            const characterItems = prepareCollectionItems(items, getPrepareOptions(config, dashboardSettings, character));

            return {
              key: `${key}:${character.id}`,
              collectionKey: key,
              label: `${character.name} · ${config.tabLabel}`,
              collectionLabel: config.tabLabel,
              scope: "character",
              characterId: character.id,
              characterName: character.name,
              characterClass: character.className,
              total: characterItems.length,
              current: countCollected(characterItems, getCharacterStorageKey(config.storageKey, character.id))
            };
          });
        }

        const accountItems = prepareCollectionItems(items, getPrepareOptions(config, dashboardSettings));

        return [
          {
            key,
            collectionKey: key,
            label: config.tabLabel,
            collectionLabel: config.tabLabel,
            scope: "account",
            total: accountItems.length,
            current: countCollected(accountItems, config.storageKey)
          }
        ];
      })
    )
      .then((collectionStatsGroups) => {
        if (cancelled) {
          return;
        }

        const collectionStats = collectionStatsGroups.flat();
        const collections = collectionStats.map((stat) => ({
          ...stat,
          percent: stat.total > 0 ? Math.round((stat.current / stat.total) * 100) : 0
        }));
        const accountCollections = collections.filter((stat) => stat.scope === "account");
        const characterCollections = characters.map((character) => ({
          id: character.id,
          name: character.name,
          className: character.className,
          collections: collections.filter((stat) => stat.characterId === character.id)
        }));

        setStats({
          current: collectionStats.reduce((sum, stat) => sum + stat.current, 0),
          total: collectionStats.reduce((sum, stat) => sum + stat.total, 0),
          collections,
          accountCollections,
          characterCollections,
          loading: false,
          error: ""
        });
      })
      .catch((statsError) => {
        if (!cancelled) {
          setStats((current) => ({ ...current, loading: false, error: statsError.message }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [characters, configs, dashboardSettings, order, progressToken, reloadToken]);

  return {
    ...stats,
    reload: () => setReloadToken((current) => current + 1)
  };
}
