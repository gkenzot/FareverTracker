const MISSING_PAGE_PREFIX = "missing:";

export function isMissingCollectionPage(pageKey) {
  return pageKey.startsWith(MISSING_PAGE_PREFIX);
}

export function getMissingPageKey(collectionKey) {
  return `${MISSING_PAGE_PREFIX}${collectionKey}`;
}

export function getCollectionKeyFromPage(pageKey) {
  return isMissingCollectionPage(pageKey) ? pageKey.slice(MISSING_PAGE_PREFIX.length) : pageKey;
}

export function getCollectionKeysByScope(configs, order, scope) {
  return order.filter((key) => configs[key]?.scope === scope);
}

export function getAccountCollectionKeys(configs, order) {
  return getCollectionKeysByScope(configs, order, "account");
}

export function getCharacterCollectionKeys(configs, order) {
  return getCollectionKeysByScope(configs, order, "character");
}

export function getMissingCollectionKeys(configs, order) {
  return getCharacterCollectionKeys(configs, order).filter((key) => configs[key].supportsMissing !== false);
}

export function getCollectionPageTitle({ activeConfig, activeCharacter, isCharacterCollection, isMissingPage }) {
  if (isMissingPage) {
    return `Missing · ${activeConfig?.title}`;
  }

  if (isCharacterCollection && activeCharacter) {
    return `${activeCharacter.name} · ${activeConfig.title}`;
  }

  return activeConfig?.title;
}
