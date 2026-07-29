import { STORAGE_KEYS } from "../../shared/constants/storageKeys";
import { readJsonStorage, writeJsonStorage } from "../../shared/utils/storage";
import { normalizeTradeEntry } from "./tradeConstants";

const EMPTY_TRADE_LISTS = {
  buy: [],
  sell: []
};

function normalizeTradeList(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list.map(normalizeTradeEntry).filter(Boolean);
}

export function readTradeLists() {
  const stored = readJsonStorage(STORAGE_KEYS.tradeLists, EMPTY_TRADE_LISTS) ?? EMPTY_TRADE_LISTS;
  return {
    buy: normalizeTradeList(stored.buy),
    sell: normalizeTradeList(stored.sell)
  };
}

export function writeTradeLists(lists) {
  writeJsonStorage(STORAGE_KEYS.tradeLists, {
    buy: normalizeTradeList(lists?.buy),
    sell: normalizeTradeList(lists?.sell)
  });
}
