import { useEffect, useState } from "react";
import { dispatchProgressChange, readStoredIdSet, writeStoredIds } from "../utils/storage";

export function useLocalSet(storageKey) {
  const [state, setState] = useState(() => ({
    storageKey,
    values: readStoredIdSet(storageKey),
    shouldPersist: false
  }));
  const values = state.storageKey === storageKey ? state.values : readStoredIdSet(storageKey);

  useEffect(() => {
    if (state.storageKey !== storageKey) {
      setState({
        storageKey,
        values: readStoredIdSet(storageKey),
        shouldPersist: false
      });
    }
  }, [state.storageKey, storageKey]);

  useEffect(() => {
    if (state.storageKey === storageKey && state.shouldPersist) {
      const saved = writeStoredIds(storageKey, [...state.values]);
      if (saved) {
        dispatchProgressChange();
      }
    }
  }, [state, storageKey]);

  function toggle(value) {
    setState((current) => {
      const currentValues = current.storageKey === storageKey ? current.values : readStoredIdSet(storageKey);
      const next = new Set(currentValues);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return { storageKey, values: next, shouldPersist: true };
    });
  }

  function replace(nextValues) {
    setState({ storageKey, values: new Set(nextValues), shouldPersist: true });
  }

  return [values, toggle, replace];
}
