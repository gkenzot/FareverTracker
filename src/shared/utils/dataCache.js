import { getDataUrl } from "./storage";

const dataCache = new Map();

/** Bump when public/data catalogs change so SPA clients refetch. */
export const DATA_CATALOG_REVISION = 8;

export function fetchJsonData(path, reloadToken = null) {
  const revision = reloadToken ?? DATA_CATALOG_REVISION;
  const cacheKey = `${path}:${revision}`;

  if (!dataCache.has(cacheKey)) {
    const request = fetch(getDataUrl(path, revision))
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
