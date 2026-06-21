import { useEffect, useState } from "react";
import { normalizeWeaponStatus, readWeaponStatusRecord } from "../constants/weaponStatus";
import { dispatchProgressChange, PROGRESS_CHANGE_EVENT, readJsonStorage, writeJsonStorage } from "../utils/storage";

function readStatusMap(storageKey) {
  if (!storageKey) {
    return {};
  }

  return readWeaponStatusRecord(readJsonStorage(storageKey, {}));
}

export function useWeaponStatus(storageKey) {
  const [state, setState] = useState(() => ({
    storageKey,
    values: readStatusMap(storageKey),
    shouldPersist: false
  }));
  const values = state.storageKey === storageKey ? state.values : readStatusMap(storageKey);

  useEffect(() => {
    if (state.storageKey !== storageKey) {
      setState({
        storageKey,
        values: readStatusMap(storageKey),
        shouldPersist: false
      });
    }
  }, [state.storageKey, storageKey]);

  useEffect(() => {
    function refreshStatus() {
      if (!storageKey) {
        return;
      }

      setState((current) => {
        if (current.storageKey !== storageKey) {
          return current;
        }

        return {
          storageKey,
          values: readStatusMap(storageKey),
          shouldPersist: false
        };
      });
    }

    window.addEventListener("storage", refreshStatus);
    window.addEventListener(PROGRESS_CHANGE_EVENT, refreshStatus);

    return () => {
      window.removeEventListener("storage", refreshStatus);
      window.removeEventListener(PROGRESS_CHANGE_EVENT, refreshStatus);
    };
  }, [storageKey]);

  useEffect(() => {
    if (state.storageKey === storageKey && state.shouldPersist && storageKey) {
      const saved = writeJsonStorage(storageKey, state.values);
      if (saved) {
        dispatchProgressChange();
      }
    }
  }, [state, storageKey]);

  function setStatus(itemId, nextRarity) {
    if (!storageKey) {
      return;
    }

    setState((current) => {
      const currentValues = current.storageKey === storageKey ? current.values : readStatusMap(storageKey);
      const nextValues = { ...currentValues };
      const normalizedRarity = normalizeWeaponStatus(nextRarity);

      if (!normalizedRarity) {
        delete nextValues[itemId];
      } else {
        nextValues[itemId] = normalizedRarity;
      }

      return { storageKey, values: nextValues, shouldPersist: true };
    });
  }

  function getStatus(itemId) {
    return values[itemId] ?? "";
  }

  return [values, getStatus, setStatus];
}
