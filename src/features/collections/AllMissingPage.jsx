import { useEffect, useMemo, useState } from "react";
import { CollectionTable } from "../../components/CollectionTable";
import { DatabaseToolbar } from "../../components/DatabaseToolbar";
import { PageShell } from "../../components/PageShell";
import { fetchJsonData } from "../../shared/utils/dataCache";
import { PROGRESS_CHANGE_EVENT } from "../../shared/utils/storage";
import { createCollectionColumns } from "./collectionColumns";
import { filterItems, sortItems } from "./collectionFilters";
import { createMissingItems } from "./collectionModes";

const defaultViewState = {
  query: "",
  columnFilters: {},
  sortConfig: { key: "missingCount", direction: "desc" }
};

function normalizeColumnOrder(columns, storedOrder) {
  const columnByKey = new Map(columns.map((column) => [column.key, column]));
  const orderedColumns = storedOrder.filter((key) => columnByKey.has(key)).map((key) => columnByKey.get(key));
  const orderedKeySet = new Set(orderedColumns.map((column) => column.key));
  return [...orderedColumns, ...columns.filter((column) => !orderedKeySet.has(column.key))];
}

function createAllMissingColumns() {
  const missingColumns = createCollectionColumns({
    collected: new Set(),
    onToggleCollected: () => {},
    statusMode: "missing",
    propertyFields: [],
    showItemLevel: true,
    showSpeed: false
  });
  const collectionColumn = {
    key: "collection",
    label: "Collection",
    sortable: true,
    filterable: true,
    widthClassName: "type-col",
    getFilterValue: (item) => item.collectionLabel,
    getSortValue: (item) => item.collectionLabel,
    render: (item) => <span title={item.collectionLabel}>{item.collectionLabel}</span>
  };

  return [missingColumns[0], collectionColumn, ...missingColumns.slice(1)];
}

function useMissingCollectionData(configs, collectionKeys) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    Promise.all(
      collectionKeys.map(async (key) => {
        const config = configs[key];
        const payload = await fetchJsonData(config.dataPath);

        return {
          key,
          config,
          items: payload[config.collectionKey] ?? [],
          importedAt: payload.importedAt
        };
      })
    )
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData);
        }
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
  }, [collectionKeys, configs]);

  return { data, loading, error };
}

export function AllMissingPage({
  configs,
  collectionKeys,
  dashboardStats,
  navigation,
  characters = [],
  dashboardSettings,
  hiddenCharacterMenus = [],
  isDashboardSettingsPage = false,
  onOpenHome,
  onOpenDashboardSettings,
  onToggleCharacterMenu
}) {
  const { data, loading, error } = useMissingCollectionData(configs, collectionKeys);
  const [viewState, setViewState] = useState(defaultViewState);
  const [columnOrderKeys, setColumnOrderKeys] = useState([]);
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState([]);
  const [progressToken, setProgressToken] = useState(0);
  const { query, columnFilters, sortConfig } = viewState;

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
      data.flatMap(({ key, config, items }) =>
        createMissingItems(items, config, dashboardSettings, characters).map((item) => ({
          ...item,
          rowKey: `${key}:${item.id}`,
          collectionKey: key,
          collectionLabel: config.tabLabel
        }))
      ),
    [characters, dashboardSettings, data, progressToken]
  );
  const columns = useMemo(createAllMissingColumns, []);
  const orderedColumns = useMemo(() => normalizeColumnOrder(columns, columnOrderKeys), [columns, columnOrderKeys]);
  const hiddenColumnSet = useMemo(() => new Set(hiddenColumnKeys), [hiddenColumnKeys]);
  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => !hiddenColumnSet.has(column.key)),
    [hiddenColumnSet, orderedColumns]
  );
  const filterOptions = useMemo(() => {
    return Object.fromEntries(
      visibleColumns
        .filter((column) => column.filterable)
        .map((column) => {
          const values = [
            ...new Set(preparedItems.flatMap((item) => column.getFilterValue?.(item) ?? ""))
          ].sort((valueA, valueB) => String(valueA).localeCompare(String(valueB)));

          return [column.key, values.map(String)];
        })
    );
  }, [preparedItems, visibleColumns]);
  const effectiveColumnFilters = useMemo(() => {
    const nextColumnFilters = { ...columnFilters };

    if (!Object.hasOwn(nextColumnFilters, "missingCount")) {
      nextColumnFilters.missingCount = (filterOptions.missingCount ?? []).filter((value) => Number(value) > 0);
    }

    return nextColumnFilters;
  }, [columnFilters, filterOptions.missingCount]);
  const visibleItems = useMemo(() => {
    const filtered = filterItems(preparedItems, { query, columnFilters: effectiveColumnFilters, columns });
    const visibleFiltered = effectiveColumnFilters.missingCount?.length === 0 ? [] : filtered;
    return sortItems(visibleFiltered, sortConfig, visibleColumns);
  }, [columns, effectiveColumnFilters, preparedItems, query, sortConfig, visibleColumns]);
  const syncInfo = useMemo(() => {
    const importedDates = data.map((entry) => entry.importedAt).filter(Boolean);
    const latestImport = importedDates.sort().at(-1);
    return latestImport ? `Source: MetaForge · updated ${new Date(latestImport).toLocaleString("en-US")}` : "";
  }, [data]);

  function updateViewState(updater) {
    setViewState((current) => (typeof updater === "function" ? updater(current) : updater));
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

  function toggleColumnVisibility(key) {
    setHiddenColumnKeys((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }

      if (visibleColumns.length <= 1) {
        return current;
      }

      updateColumnFilter(key, []);
      return [...current, key];
    });
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
    setColumnOrderKeys(nextColumns.map((column) => column.key));
  }

  return (
    <PageShell
      title="Missing"
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
      syncInfo={syncInfo}
    >
      <DatabaseToolbar
        query={query}
        onQueryChange={(nextQuery) => updateViewState((current) => ({ ...current, query: nextQuery }))}
        columns={orderedColumns}
        hiddenColumnKeys={hiddenColumnKeys}
        onToggleColumn={toggleColumnVisibility}
        onReorderColumn={reorderColumn}
        onShowAllColumns={() => setHiddenColumnKeys([])}
        menuResetKey="missing"
      />

      {loading ? <p className="state">Loading missing items...</p> : null}
      {error ? <p className="state error">{error}</p> : null}

      {!loading && !error ? (
        <CollectionTable
          columns={visibleColumns}
          items={visibleItems}
          getRowKey={(item) => item.rowKey}
          getRowClassName={(item) => ((item.missingCount ?? 0) === 0 ? "is-collected" : "")}
          sortConfig={sortConfig}
          onSort={(key, direction = "asc") =>
            updateViewState((current) => ({ ...current, sortConfig: { key, direction } }))
          }
          columnFilters={effectiveColumnFilters}
          filterOptions={filterOptions}
          onFilterChange={updateColumnFilter}
          emptyMessage="No missing items found with the current filters."
        />
      ) : null}
    </PageShell>
  );
}
