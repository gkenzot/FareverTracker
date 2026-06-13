import { getDataUrl } from "./storage";

const dataCache = new Map();

export function fetchJsonData(path, reloadToken = null) {
  const cacheKey = `${path}:${reloadToken ?? "current"}`;

  if (!dataCache.has(cacheKey)) {
    const request = fetch(getDataUrl(path, reloadToken))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`File not found: ${path}`);
        }

        return response.json();
      })
      .catch((error) => {
        dataCache.delete(cacheKey);
        throw error;
      });

    dataCache.set(cacheKey, request);
  }

  return dataCache.get(cacheKey);
}
