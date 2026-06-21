import { useEffect, useMemo, useState, useCallback } from "react";
import { CollectionTable } from "../../components/CollectionTable";
import { DatabaseToolbar } from "../../components/DatabaseToolbar";
import { PageShell } from "../../components/PageShell";
import { useCollectionData } from "../../shared/hooks/useCollectionData";
import { useLocalSet } from "../../shared/hooks/useLocalSet";
import { useWeaponStatus } from "../../shared/hooks/useWeaponStatus";
import {
  DEFAULT_COLUMN_ORDER_KEYS,
  DEFAULT_HIDDEN_COLUMN_KEYS,
  DEFAULT_VIEW_STATES
} from "../../shared/constants/defaultPreferences";
import { prepareCollectionItems } from "../../shared/utils/characterClass";
import { getPrepareOptions } from "../../shared/utils/collectionSettings";
import { PROGRESS_CHANGE_EVENT, readJsonStorage, writeJsonStorage } from "../../shared/utils/storage";
import { getCharacterStorageKey } from "../../shared/constants/storageKeys";
import { catalogRarityToWeaponStatus } from "../../shared/constants/weaponStatus";
import { createCollectionColumns } from "./collectionColumns";
import { filterValues, getVisiblePropertyFields } from "./collectionFields";
import { filterItems, sortItems } from "./collectionFilters";
import { createMissingItems } from "./collectionModes";

function getHiddenColumnsStorageKey(collectionKey, missingMode) {
  const mode = missingMode ? "missing" : "collection";
  return `farever-check:hidden-columns-${mode}-${collectionKey}`;
}

function getColumnOrderStorageKey(collectionKey, missingMode) {
  const mode = missingMode ? "missing" : "collection";
  return `farever-check:column-order-${mode}-${collectionKey}`;
}

function readHiddenColumnKeys(collectionKey, missingMode) {
  const value = readJsonStorage(
    getHiddenColumnsStorageKey(collectionKey, missingMode),
    DEFAULT_HIDDEN_COLUMN_KEYS[collectionKey] ?? []
  );
  return Array.isArray(value) ? value : [];
}

function readColumnOrderKeys(collectionKey, missingMode) {
  const mode = missingMode ? "missing" : "collection";
  const value = readJsonStorage(
    getColumnOrderStorageKey(collectionKey, missingMode),
    DEFAULT_COLUMN_ORDER_KEYS[`${mode}:${collectionKey}`] ?? []
  );
  return Array.isArray(value) ? value : [];
}

function normalizeColumnOrder(columns, storedOrder) {
  const columnByKey = new Map(columns.map((column) => [column.key, column]));
  const orderedColumns = storedOrder
    .filter((key) => columnByKey.has(key))
    .map((key) => columnByKey.get(key));
  const orderedKeySet = new Set(orderedColumns.map((column) => column.key));
  const newColumns = columns.filter((column) => !orderedKeySet.has(column.key));

  return [...orderedColumns, ...newColumns];
}

function getDefaultSortConfig(missingMode) {
  return missingMode ? { key: "missingCount", direction: "desc" } : { key: "name", direction: "asc" };
}

function getDefaultViewState({ activeCharacter, collectionKey, missingMode }) {
  const mode = missingMode ? "missing" : activeCharacter?.id ? "character" : "account";

  return (
    DEFAULT_VIEW_STATES[`${mode}:${collectionKey}`] ?? {
      query: "",
      columnFilters: {},
      sortConfig: getDefaultSortConfig(missingMode)
    }
  );
}

function getViewStateStorageKey({ activeCharacter, collectionKey, missingMode }) {
  const mode = missingMode ? "missing" : activeCharacter?.id ?? "account";
  const version = missingMode ? "v2-" : "";
  return `farever-check:view-state-${version}${mode}-${collectionKey}`;
}

function normalizeColumnFilters(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, values]) => typeof key === "string" && Array.isArray(values))
      .map(([key, values]) => [key, values.map((item) => String(item)).filter(Boolean)])
      .filter(([, values]) => values.length > 0)
  );
}

function normalizeSortConfig(value, missingMode, fallbackSortConfig = getDefaultSortConfig(missingMode)) {
  const fallback = fallbackSortConfig;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  return {
    key: typeof value.key === "string" && value.key ? value.key : fallback.key,
    direction: value.direction === "desc" ? "desc" : "asc"
  };
}

function readViewState(storageKey, missingMode, defaultViewState) {
  const value = readJsonStorage(storageKey, defaultViewState);

  return {
    query: typeof value.query === "string" ? value.query : defaultViewState.query,
    columnFilters: normalizeColumnFilters(value.columnFilters ?? defaultViewState.columnFilters),
    sortConfig: normalizeSortConfig(value.sortConfig ?? defaultViewState.sortConfig, missingMode, defaultViewState.sortConfig)
  };
}

export function CollectionPage({
  config,
  dashboardStats,
  navigation,
  pageTitle,
  progressStorageKey,
  activeCharacter,
  characters = [],
  missingMode = false,
  dashboardSettings,
  hiddenCharacterMenus = [],
  isDashboardSettingsPage = false,
  onOpenHome,
  onOpenDashboardSettings,
  onToggleCharacterMenu
}) {
  const { items, meta, loading, error } = useCollectionData(config.dataPath, config.collectionKey);
  const [collected, toggleCollected] = useLocalSet(progressStorageKey ?? config.storageKey);
  const weaponStatusStorageKey =
    config.showWeaponStatus && config.weaponStatusStorageKey && activeCharacter?.id && !missingMode
      ? getCharacterStorageKey(config.weaponStatusStorageKey, activeCharacter.id)
      : null;
  const [, getWeaponStatus, setWeaponStatus] = useWeaponStatus(weaponStatusStorageKey);
  const viewStateStorageKey = getViewStateStorageKey({
    activeCharacter,
    collectionKey: config.key,
    missingMode
  });
  const defaultViewState = useMemo(
    () => getDefaultViewState({ activeCharacter, collectionKey: config.key, missingMode }),
    [activeCharacter, config.key, missingMode]
  );
  const [viewState, setViewState] = useState(() => readViewState(viewStateStorageKey, missingMode, defaultViewState));
  const [hiddenColumnsByCollection, setHiddenColumnsByCollection] = useState({});
  const [columnOrderByCollection, setColumnOrderByCollection] = useState({});
  const [progressToken, setProgressToken] = useState(0);
  const { query, columnFilters, sortConfig } = viewState;

  useEffect(() => {
    setViewState(readViewState(viewStateStorageKey, missingMode, defaultViewState));
  }, [defaultViewState, viewStateStorageKey, missingMode]);

  useEffect(() => {
    function refreshProgress() {
      setProgressToken((current) => current + 1);
    }

    window.addEventListener("storage", refreshProgress);
    window.addEventListener(PROGRESS_CHANGE_EVENT, refreshProgress);

    return () => {
      window.removeEventListener("storage", refreshProgress);
      window.removeEventListener(PROGRESS_CHANGE_EVENT, refreshProgress);
    };
  }, []);

  const preparedItems = useMemo(
    () =>
      missingMode
        ? createMissingItems(items, config, dashboardSettings, characters)
        : prepareCollectionItems(items, getPrepareOptions(config, dashboardSettings, activeCharacter)),
    [activeCharacter, characters, config, dashboardSettings, items, missingMode, progressToken]
  );
  const propertyFields = useMemo(() => {
    return getVisiblePropertyFields(config, meta?.propertyFields ?? []);
  }, [config, meta?.propertyFields]);

  const handleToggleCollected = useCallback(
    (item) => {
      const isCollected = collected.has(item.id);
      toggleCollected(item.id);

      if (!isCollected && weaponStatusStorageKey) {
        const defaultRarity = catalogRarityToWeaponStatus(item);

        if (defaultRarity) {
          setWeaponStatus(item.id, defaultRarity);
        }
      }
    },
    [collected, setWeaponStatus, toggleCollected, weaponStatusStorageKey]
  );

  const columns = useMemo(
    () =>
      createCollectionColumns({
        collected,
        onToggleCollected: handleToggleCollected,
        statusMode: missingMode ? "missing" : "collected",
        propertyFields,
        showItemLevel: config.showItemLevel,
        showSpeed: config.showSpeed ?? true,
        showAvailability: config.showAvailability ?? false,
        showWeaponStatus: Boolean(weaponStatusStorageKey),
        getWeaponStatus,
        onWeaponStatusChange: setWeaponStatus
      }),
    [
      collected,
      config.showAvailability,
      config.showItemLevel,
      config.showSpeed,
      getWeaponStatus,
      missingMode,
      propertyFields,
      setWeaponStatus,
      handleToggleCollected,
      weaponStatusStorageKey
    ]
  );
  const columnOrderStorageKey = getColumnOrderStorageKey(config.key, missingMode);
  const columnOrderKeys = columnOrderByCollection[columnOrderStorageKey] ?? readColumnOrderKeys(config.key, missingMode);
  const orderedColumns = useMemo(() => normalizeColumnOrder(columns, columnOrderKeys), [columns, columnOrderKeys]);
  const hiddenColumnsStorageKey = getHiddenColumnsStorageKey(config.key, missingMode);
  const hiddenColumnKeys = hiddenColumnsByCollection[hiddenColumnsStorageKey] ?? readHiddenColumnKeys(config.key, missingMode);
  const normalizedHiddenColumnKeys = useMemo(() => {
    const columnKeys = new Set(orderedColumns.map((column) => column.key));
    const validHiddenKeys = hiddenColumnKeys.filter((key) => columnKeys.has(key));

    return validHiddenKeys.length >= orderedColumns.length ? [] : validHiddenKeys;
  }, [orderedColumns, hiddenColumnKeys]);
  const hiddenColumnSet = useMemo(() => new Set(normalizedHiddenColumnKeys), [normalizedHiddenColumnKeys]);
  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => !hiddenColumnSet.has(column.key)),
    [orderedColumns, hiddenColumnSet]
  );

  const filterOptions = useMemo(() => {
    return Object.fromEntries(
      visibleColumns
        .filter((column) => column.filterable)
        .map((column) => {
          const values = [
            ...new Set(preparedItems.flatMap((item) => filterValues(column.getFilterValue?.(item) ?? "")))
          ].sort((valueA, valueB) => valueA.localeCompare(valueB));

          return [column.key, values];
        })
    );
  }, [preparedItems, visibleColumns]);

  const effectiveColumnFilters = useMemo(() => {
    const nextColumnFilters = { ...columnFilters };

    if (missingMode && !Object.hasOwn(nextColumnFilters, "missingCount")) {
      nextColumnFilters.missingCount = (filterOptions.missingCount ?? []).filter((value) => Number(value) > 0);
    }

    return nextColumnFilters;
  }, [columnFilters, filterOptions.missingCount, missingMode]);

  const visibleItems = useMemo(() => {
    const filtered = filterItems(preparedItems, { query, columnFilters: effectiveColumnFilters, columns });
    const visibleFiltered = missingMode && effectiveColumnFilters.missingCount?.length === 0 ? [] : filtered;
    return sortItems(visibleFiltered, sortConfig, visibleColumns);
  }, [preparedItems, effectiveColumnFilters, columns, missingMode, query, sortConfig, visibleColumns]);

  function updateViewState(updater) {
    setViewState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      writeJsonStorage(viewStateStorageKey, next);
      return next;
    });
  }

  function updateQuery(nextQuery) {
    updateViewState((current) => ({
      ...current,
      query: nextQuery
    }));
  }

  function updateSort(key, direction = "asc") {
    updateViewState((current) => ({
      ...current,
      sortConfig: { key, direction }
    }));
  }

  function updateColumnFilter(key, value) {
    updateViewState((current) => {
      const nextColumnFilters = { ...current.columnFilters };
      const nextValues = Array.isArray(value) ? value : [value].filter(Boolean);

      if (nextValues.length === 0) {
        delete nextColumnFilters[key];
      } else {
        nextColumnFilters[key] = nextValues;
      }

      return {
        ...current,
        columnFilters: nextColumnFilters
      };
    });
  }

  function persistHiddenColumnKeys(nextHiddenKeys) {
    writeJsonStorage(hiddenColumnsStorageKey, nextHiddenKeys);
    setHiddenColumnsByCollection((current) => ({
      ...current,
      [hiddenColumnsStorageKey]: nextHiddenKeys
    }));
  }

  function reorderColumn(sourceKey, targetKey) {
    if (sourceKey === targetKey) {
      return;
    }

    const sourceIndex = orderedColumns.findIndex((column) => column.key === sourceKey);
    const targetIndex = orderedColumns.findIndex((column) => column.key === targetKey);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextColumns = [...orderedColumns];
    const [movedColumn] = nextColumns.splice(sourceIndex, 1);
    nextColumns.splice(targetIndex, 0, movedColumn);

    const nextOrderKeys = nextColumns.map((column) => column.key);
    writeJsonStorage(columnOrderStorageKey, nextOrderKeys);
    setColumnOrderByCollection((current) => ({
      ...current,
      [columnOrderStorageKey]: nextOrderKeys
    }));
  }

  function toggleColumnVisibility(key) {
    const nextHiddenSet = new Set(normalizedHiddenColumnKeys);

    if (nextHiddenSet.has(key)) {
      nextHiddenSet.delete(key);
    } else if (visibleColumns.length > 1) {
      nextHiddenSet.add(key);
      updateColumnFilter(key, []);

      if (sortConfig.key === key) {
        updateSort("name", "asc");
      }
    }

    persistHiddenColumnKeys([...nextHiddenSet]);
  }

  function showAllColumns() {
    persistHiddenColumnKeys([]);
  }

  return (
    <PageShell
      title={pageTitle ?? config.title}
      stat={{
        current: dashboardStats.current,
        total: dashboardStats.total,
        collections: dashboardStats.collections,
        accountCollections: dashboardStats.accountCollections,
        characterCollections: dashboardStats.characterCollections,
        loading: dashboardStats.loading,
        error: dashboardStats.error
      }}
      navigation={navigation}
      hiddenCharacterMenus={hiddenCharacterMenus}
      isDashboardSettingsPage={isDashboardSettingsPage}
      onOpenHome={onOpenHome}
      onOpenDashboardSettings={onOpenDashboardSettings}
      onToggleCharacterMenu={onToggleCharacterMenu}
      syncInfo={meta ? `Source: MetaForge · updated ${new Date(meta.importedAt).toLocaleString("en-US")}` : ""}
    >
      <DatabaseToolbar
        query={query}
        onQueryChange={updateQuery}
        columns={orderedColumns}
        hiddenColumnKeys={normalizedHiddenColumnKeys}
        onToggleColumn={toggleColumnVisibility}
        onReorderColumn={reorderColumn}
        onShowAllColumns={showAllColumns}
        menuResetKey={config.key}
      />

      {loading ? <p className="state">Loading {config.loadingLabel}...</p> : null}
      {error ? <p className="state error">{error}</p> : null}

      {!loading && !error ? (
        <CollectionTable
          columns={visibleColumns}
          items={visibleItems}
          getRowKey={(item) => item.id}
          getRowClassName={(item) => {
            if (missingMode) {
              return (item.missingCount ?? 0) === 0 ? "is-collected" : "";
            }

            return collected.has(item.id) ? "is-collected" : "";
          }}
          sortConfig={sortConfig}
          onSort={updateSort}
          columnFilters={effectiveColumnFilters}
          filterOptions={filterOptions}
          onFilterChange={updateColumnFilter}
          emptyMessage="No items found with the current filters."
        />
      ) : null}
    </PageShell>
  );
}
