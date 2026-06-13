import { useEffect, useState } from "react";
import { fetchJsonData } from "../utils/dataCache";

export function useCollectionData(path, collectionKey) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    fetchJsonData(path, reloadToken)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setItems(payload[collectionKey] ?? []);
        setMeta(payload);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [collectionKey, path, reloadToken]);

  return {
    items,
    meta,
    loading,
    error,
    reload: () => setReloadToken((current) => current + 1)
  };
}
