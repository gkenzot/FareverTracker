import { useEffect, useMemo, useRef, useState } from "react";
import { GearItemHoverTooltip } from "../../components/GearItemHoverTooltip";
import { CatalogViewToggle } from "../../components/CatalogViewToggle";
import { OwnedOnlyButton, nextOwnedFilterMode } from "../../components/OwnedOnlyButton";
import { PageShell } from "../../components/PageShell";
import { collectionSupportsGearTooltip } from "../../shared/utils/gearTooltip";
import { useCollectionData } from "../../shared/hooks/useCollectionData";
import { assetPath } from "../../shared/utils/assets";
import { sourceText } from "../../shared/utils/collection";
import { fetchJsonData } from "../../shared/utils/dataCache";
import {
  TRADE_CATEGORIES,
  TRADE_DRAG_MIME,
  createTradeEntry,
  inferTradeSlotKey,
  isConfigurableTradeCollection,
  tradeEntryKey,
  tradeEntryToSlotValue
} from "./tradeConstants";
import { formatStatLine, getTradeEntryCardModel } from "./tradeEntryDisplay";
import { TradeItemConfigPanel } from "./TradeItemConfigPanel";
import { readTradeLists, writeTradeLists } from "./tradeStorage";
import { shouldHideTradeCatalogItem } from "./tradeCatalogFilters";
import { useTradeOwnedIds } from "./useTradeOwnedIds";

function readDragPayload(event) {
  try {
    const raw = event.dataTransfer.getData(TRADE_DRAG_MIME) || event.dataTransfer.getData("text/plain");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDragPayload(event, payload, effectAllowed = "copy") {
  const raw = JSON.stringify(payload);
  event.dataTransfer.setData(TRADE_DRAG_MIME, raw);
  event.dataTransfer.setData("text/plain", raw);
  event.dataTransfer.effectAllowed = effectAllowed;
}

function rarityClass(rarity) {
  return `rarity-${String(rarity ?? "common").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function getCatalogEmptyMessage({ ownedFilter, query }) {
  const normalizedQuery = query.trim();

  if (ownedFilter === "owned" && normalizedQuery) {
    return "No owned items match your search.";
  }

  if (ownedFilter === "owned") {
    return "No owned items in this category. Click the filter again to show missing or all.";
  }

  if (ownedFilter === "missing" && normalizedQuery) {
    return "No missing items match your search.";
  }

  if (ownedFilter === "missing") {
    return "No missing items in this category. Click the filter again to show all.";
  }

  if (normalizedQuery) {
    return "No items match your search.";
  }

  return "No items found.";
}

function useIconTooltip(item, collectionKey) {
  const [tooltip, setTooltip] = useState(null);
  const enableTooltip = collectionSupportsGearTooltip(collectionKey);

  const hoverProps = enableTooltip
    ? {
        onMouseEnter: (event) => setTooltip({ x: event.clientX, y: event.clientY }),
        onMouseMove: (event) => setTooltip({ x: event.clientX, y: event.clientY }),
        onMouseLeave: () => setTooltip(null)
      }
    : {};

  const tooltipNode =
    enableTooltip && tooltip ? <GearItemHoverTooltip item={item} x={tooltip.x} y={tooltip.y} /> : null;

  return { hoverProps, tooltipNode, enableTooltip };
}

function TradePanelItem({
  entry,
  dropTarget,
  isSelected,
  item,
  augments,
  characterClassName,
  onSelect,
  onRemove,
  onEntryDragStart,
  onEntryDragEnd
}) {
  const [tooltip, setTooltip] = useState(null);
  const configurable = isConfigurableTradeCollection(entry.collectionKey);
  const showTooltip = configurable && item;

  const hoverProps = showTooltip
    ? {
        onMouseEnter: (event) => setTooltip({ x: event.clientX, y: event.clientY }),
        onMouseMove: (event) => setTooltip({ x: event.clientX, y: event.clientY }),
        onMouseLeave: () => setTooltip(null)
      }
    : {};

  const slotValue = tradeEntryToSlotValue(entry);
  const slotKey = item ? inferTradeSlotKey(item, entry.collectionKey) : "";
  const card = getTradeEntryCardModel(entry, item, augments, characterClassName);

  return (
    <>
      <div
        className={`trade-panel-item ${isSelected ? "is-selected" : ""} ${configurable ? "is-configurable" : ""}`}
        draggable
        onDragStart={(event) => {
          setTooltip(null);
          writeDragPayload(
            event,
            {
              collectionKey: entry.collectionKey,
              itemId: entry.itemId,
              sourceList: dropTarget,
              entryKey: entry.key
            },
            "move"
          );
          onEntryDragStart?.(dropTarget, entry);
        }}
        onDragEnd={onEntryDragEnd}
        {...hoverProps}
      >
        <button
          type="button"
          className="trade-panel-item-main"
          onClick={() => onSelect?.(dropTarget, entry)}
          disabled={!configurable}
          title={showTooltip ? undefined : entry.name}
        >
          <div className={`trade-panel-icon ${rarityClass(entry.usedRarity || entry.rarity)}`}>
            {entry.iconPath ? <img src={assetPath(entry.iconPath)} alt="" draggable={false} /> : <span>?</span>}
          </div>
          <div className="trade-panel-item-text">
            <strong className="trade-panel-item-name" title={entry.name}>
              {entry.name}
            </strong>

            <div className="trade-panel-item-body">
              <div className="trade-panel-item-main-col">
                {card.metaLines.length > 0 ? (
                  <div className="trade-panel-item-chips">
                    {card.metaLines.map((line) => (
                      <span key={`${line.label}-${line.value}`} className="trade-panel-chip">
                        <small>{line.label}</small>
                        {line.value}
                      </span>
                    ))}
                  </div>
                ) : null}

                {card.weaponDamage || card.stats.length > 0 ? (
                  <div className="trade-panel-item-stats">
                    {card.weaponDamage ? <p>{card.weaponDamage}</p> : null}
                    {card.stats.length > 0 ? (
                      <ul>
                        {card.stats.map((stat) => (
                          <li key={`${stat.label}-${stat.value}-${stat.unit || ""}`}>{formatStatLine(stat)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {card.adornments.length > 0 || card.upgradeBonus ? (
                <div className="trade-panel-item-extras">
                  {card.upgradeBonus ? (
                    <div className="trade-panel-item-block is-upgrade">
                      <strong>{card.upgradeBonus.label}</strong>
                      {card.upgradeBonus.description ? <p>{card.upgradeBonus.description}</p> : null}
                      {card.upgradeBonus.stats.length > 0 ? (
                        <ul>
                          {card.upgradeBonus.stats.map((stat) => (
                            <li key={`${stat.label}-${stat.value}`}>{formatStatLine(stat)}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {card.adornments.map((block) => (
                    <div key={block.key} className="trade-panel-item-block">
                      <strong>
                        {block.label}: {block.name}
                      </strong>
                      {block.description ? <p>{block.description}</p> : null}
                      {block.stats.length > 0 ? (
                        <ul>
                          {block.stats.map((stat) => (
                            <li key={`${block.key}-${stat.label}-${stat.value}`}>{formatStatLine(stat)}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </button>
        <button
          type="button"
          className="trade-panel-remove"
          onClick={() => onRemove(dropTarget, entry.key)}
          aria-label={`Remove ${entry.name}`}
        >
          ×
        </button>
      </div>
      {showTooltip && tooltip ? (
        <GearItemHoverTooltip
          item={item}
          x={tooltip.x}
          y={tooltip.y}
          usedLevel={entry.usedLevel}
          usedRarity={entry.usedRarity}
          usedUpgradeLevel={entry.usedUpgradeLevel}
          adornments={entry.adornments}
          augments={augments}
          slotKey={slotKey}
          characterClassName={characterClassName}
          slotValue={slotValue}
        />
      ) : null}
    </>
  );
}

function TradeDropPanel({
  title,
  items,
  dropTarget,
  isActive,
  selectedEntryKey,
  preferMove = false,
  itemsByKey,
  augments = [],
  characterClassName = "",
  onDrop,
  onRemove,
  onSelect,
  onDragOver,
  onDragLeave,
  onEntryDragStart,
  onEntryDragEnd
}) {
  return (
    <section
      className={`trade-panel ${isActive ? "is-drop-target" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = preferMove ? "move" : "copy";
        onDragOver(dropTarget);
      }}
      onDragLeave={() => onDragLeave(dropTarget)}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(dropTarget, readDragPayload(event));
        onDragLeave(dropTarget);
      }}
    >
      <header className="trade-panel-header">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </header>

      <div className="trade-panel-list">
        {items.length === 0 ? (
          <p className="trade-panel-empty">Drag items here</p>
        ) : (
          items.map((entry) => (
            <TradePanelItem
              key={entry.key}
              entry={entry}
              dropTarget={dropTarget}
              isSelected={selectedEntryKey === entry.key}
              item={itemsByKey?.get(entry.key) ?? null}
              augments={augments}
              characterClassName={characterClassName}
              onSelect={onSelect}
              onRemove={onRemove}
              onEntryDragStart={onEntryDragStart}
              onEntryDragEnd={onEntryDragEnd}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TradeCatalogIconItem({ item, collectionKey, isOwned, onDragStart, onDragEnd }) {
  const { hoverProps, tooltipNode } = useIconTooltip(item, collectionKey);

  return (
    <>
      <button
        type="button"
        className={`trade-catalog-icon-tile ${rarityClass(item.rarity ?? item.properties?.rarity)} ${isOwned ? "" : "is-not-owned"}`}
        draggable
        title={collectionSupportsGearTooltip(collectionKey) ? undefined : item.name}
        onDragStart={(event) => {
          writeDragPayload(event, { collectionKey, itemId: item.id });
          onDragStart?.();
        }}
        onDragEnd={onDragEnd}
        {...hoverProps}
      >
        {item.iconPath ? <img src={assetPath(item.iconPath)} alt="" draggable={false} /> : <span>?</span>}
      </button>
      {tooltipNode}
    </>
  );
}

function TradeCatalogListItem({ item, collectionKey, isOwned, onDragStart, onDragEnd }) {
  const { hoverProps, tooltipNode } = useIconTooltip(item, collectionKey);
  const howToGet = sourceText(item);

  return (
    <div
      className={`trade-catalog-list-row ${isOwned ? "" : "is-not-owned"}`}
      draggable
      onDragStart={(event) => {
        writeDragPayload(event, { collectionKey, itemId: item.id });
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
    >
      <div className={`trade-catalog-list-icon ${rarityClass(item.rarity ?? item.properties?.rarity)}`} {...hoverProps}>
        {item.iconPath ? <img src={assetPath(item.iconPath)} alt="" draggable={false} /> : <span>?</span>}
      </div>
      <div className="trade-catalog-list-text">
        <strong title={item.name}>{item.name}</strong>
        <small title={howToGet}>{howToGet}</small>
      </div>
      <span className={`trade-catalog-list-rarity ${rarityClass(item.rarity ?? item.properties?.rarity)}`}>
        {item.rarity ?? item.properties?.rarity ?? "—"}
      </span>
      {tooltipNode}
    </div>
  );
}

export function TradePage({
  characters = [],
  activeCharacterId = "",
  dashboardStats,
  navigation,
  hiddenCharacterMenus = [],
  isDashboardSettingsPage = false,
  onOpenHome,
  onOpenDashboardSettings,
  onToggleCharacterMenu
}) {
  const [tradeLists, setTradeLists] = useState(readTradeLists);
  const [activeCategory, setActiveCategory] = useState(TRADE_CATEGORIES[0].key);
  const [query, setQuery] = useState("");
  const [iconView, setIconView] = useState(false);
  const [ownedFilter, setOwnedFilter] = useState("all");
  const [activeDropTarget, setActiveDropTarget] = useState("");
  const [editing, setEditing] = useState(null);
  const [augments, setAugments] = useState([]);
  const [draggingFromList, setDraggingFromList] = useState(false);
  const skipNextSelectRef = useRef(false);

  const resolvedCharacterId = activeCharacterId || characters[0]?.id || "";
  const activeCharacter = characters.find((character) => character.id === resolvedCharacterId) ?? characters[0] ?? null;
  const characterClassName = activeCharacter?.className ?? "";
  const { ownedByCategory } = useTradeOwnedIds(resolvedCharacterId);

  const category = TRADE_CATEGORIES.find((entry) => entry.key === activeCategory) ?? TRADE_CATEGORIES[0];
  const { items, loading, error } = useCollectionData(category.dataPath, category.collectionKey);
  const armorData = useCollectionData("data/armor.json", "armor");
  const weaponsData = useCollectionData("data/weapons.json", "weapons");
  const jewelleryData = useCollectionData("data/jewellery.json", "jewellery");
  const ownedIds = ownedByCategory[category.key] ?? new Set();

  useEffect(() => {
    writeTradeLists(tradeLists);
  }, [tradeLists]);

  useEffect(() => {
    let cancelled = false;

    fetchJsonData("data/augments.json")
      .then((payload) => {
        if (!cancelled) {
          setAugments(Array.isArray(payload.augments) ? payload.augments : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAugments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const gearItemsByKey = useMemo(() => {
    const map = new Map();
    for (const item of armorData.items) {
      map.set(tradeEntryKey("armor", item.id), item);
    }
    for (const item of weaponsData.items) {
      map.set(tradeEntryKey("weapons", item.id), item);
    }
    for (const item of jewelleryData.items) {
      map.set(tradeEntryKey("jewellery", item.id), item);
    }
    return map;
  }, [armorData.items, jewelleryData.items, weaponsData.items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let nextItems = [...items];

    nextItems = nextItems.filter((item) => !shouldHideTradeCatalogItem(item, category.key));

    if (ownedFilter === "owned") {
      nextItems = nextItems.filter((item) => ownedIds.has(item.id));
    } else if (ownedFilter === "missing") {
      nextItems = nextItems.filter((item) => !ownedIds.has(item.id));
    }

    if (normalizedQuery) {
      nextItems = nextItems.filter((item) => {
        const haystack = `${item.name ?? ""} ${item.id ?? ""}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    nextItems.sort((left, right) => String(left.name).localeCompare(String(right.name)));
    return nextItems;
  }, [category.key, items, ownedFilter, ownedIds, query]);

  const itemsByKey = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      map.set(tradeEntryKey(category.collectionKey, item.id), item);
    }
    return map;
  }, [category.collectionKey, items]);

  const editingEntry =
    editing && tradeLists[editing.listKey]
      ? tradeLists[editing.listKey].find((entry) => entry.key === editing.entryKey) ?? null
      : null;
  const editingItem = editingEntry ? gearItemsByKey.get(editingEntry.key) ?? null : null;
  const editingListLabel = editing?.listKey === "buy" ? "Want to Buy" : editing?.listKey === "sell" ? "Want to Sell" : "";

  function addToList(listKey, payload) {
    if (!payload?.collectionKey || !payload?.itemId) {
      return;
    }

    const entryKey = tradeEntryKey(payload.collectionKey, payload.itemId);
    let item = payload.collectionKey === category.collectionKey ? itemsByKey.get(entryKey) : null;

    if (!item && payload.collectionKey === category.collectionKey) {
      item = items.find((candidate) => candidate.id === payload.itemId);
    }

    if (!item) {
      item = gearItemsByKey.get(entryKey) ?? null;
    }

    if (!item) {
      return;
    }

    const nextEntry = createTradeEntry(item, payload.collectionKey);

    setTradeLists((current) => {
      if (current[listKey].some((entry) => entry.key === nextEntry.key)) {
        return current;
      }

      return {
        ...current,
        [listKey]: [...current[listKey], nextEntry]
      };
    });

    if (isConfigurableTradeCollection(payload.collectionKey)) {
      setEditing({ listKey, entryKey: nextEntry.key });
    }
  }

  function moveBetweenLists(targetList, payload) {
    const sourceList = payload.sourceList;
    const entryKey = payload.entryKey || tradeEntryKey(payload.collectionKey, payload.itemId);

    if (!sourceList || sourceList === targetList || (sourceList !== "buy" && sourceList !== "sell")) {
      return false;
    }

    setTradeLists((current) => {
      const sourceEntry = current[sourceList].find((entry) => entry.key === entryKey);
      if (!sourceEntry) {
        return current;
      }

      if (current[targetList].some((entry) => entry.key === entryKey)) {
        return {
          ...current,
          [sourceList]: current[sourceList].filter((entry) => entry.key !== entryKey)
        };
      }

      return {
        ...current,
        [sourceList]: current[sourceList].filter((entry) => entry.key !== entryKey),
        [targetList]: [...current[targetList], sourceEntry]
      };
    });

    setEditing((current) => {
      if (!current) {
        return current;
      }
      if (current.listKey === sourceList && current.entryKey === entryKey) {
        return { listKey: targetList, entryKey };
      }
      return current;
    });

    return true;
  }

  function removeFromList(listKey, entryKey) {
    setTradeLists((current) => ({
      ...current,
      [listKey]: current[listKey].filter((entry) => entry.key !== entryKey)
    }));
    setEditing((current) =>
      current?.listKey === listKey && current?.entryKey === entryKey ? null : current
    );
  }

  function updateTradeEntry(listKey, entryKey, nextEntry) {
    setTradeLists((current) => ({
      ...current,
      [listKey]: current[listKey].map((entry) => (entry.key === entryKey ? nextEntry : entry))
    }));
  }

  function handlePanelDrop(listKey, payload) {
    if (!payload) {
      return;
    }

    if (payload.sourceList) {
      moveBetweenLists(listKey, payload);
      return;
    }

    addToList(listKey, payload);
  }

  function handleCatalogDrop(payload) {
    if (!payload?.sourceList || !payload?.entryKey) {
      return;
    }

    removeFromList(payload.sourceList, payload.entryKey);
  }

  function handleSelectEntry(listKey, entry) {
    if (skipNextSelectRef.current) {
      skipNextSelectRef.current = false;
      return;
    }

    if (!isConfigurableTradeCollection(entry.collectionKey)) {
      return;
    }

    setEditing((current) =>
      current?.listKey === listKey && current?.entryKey === entry.key
        ? null
        : { listKey, entryKey: entry.key }
    );
  }

  const catalogProps = {
    collectionKey: category.collectionKey,
    onDragStart: () => setActiveDropTarget(""),
    onDragEnd: () => setActiveDropTarget("")
  };
  const hasActiveFilters = ownedFilter !== "all" || query.trim().length > 0;
  const emptyCatalogMessage = getCatalogEmptyMessage({ ownedFilter, query });
  const catalogDropActive = activeDropTarget === "catalog" && draggingFromList;

  return (
    <PageShell
      title="Trade"
      stat={dashboardStats}
      navigation={navigation}
      hiddenCharacterMenus={hiddenCharacterMenus}
      isDashboardSettingsPage={isDashboardSettingsPage}
      onOpenHome={onOpenHome}
      onOpenDashboardSettings={onOpenDashboardSettings}
      onToggleCharacterMenu={onToggleCharacterMenu}
    >
      <section className="trade-page">
        <div className="trade-panels">
          <TradeDropPanel
            title="Want to Buy"
            items={tradeLists.buy}
            dropTarget="buy"
            isActive={activeDropTarget === "buy"}
            selectedEntryKey={editing?.listKey === "buy" ? editing.entryKey : ""}
            preferMove={draggingFromList}
            itemsByKey={gearItemsByKey}
            augments={augments}
            characterClassName={characterClassName}
            onDrop={handlePanelDrop}
            onRemove={removeFromList}
            onSelect={handleSelectEntry}
            onDragOver={setActiveDropTarget}
            onDragLeave={(target) => setActiveDropTarget((current) => (current === target ? "" : current))}
            onEntryDragStart={() => {
              skipNextSelectRef.current = true;
              setDraggingFromList(true);
              setActiveDropTarget("");
            }}
            onEntryDragEnd={() => {
              setDraggingFromList(false);
              setActiveDropTarget("");
            }}
          />
          <TradeDropPanel
            title="Want to Sell"
            items={tradeLists.sell}
            dropTarget="sell"
            isActive={activeDropTarget === "sell"}
            selectedEntryKey={editing?.listKey === "sell" ? editing.entryKey : ""}
            preferMove={draggingFromList}
            itemsByKey={gearItemsByKey}
            augments={augments}
            characterClassName={characterClassName}
            onDrop={handlePanelDrop}
            onRemove={removeFromList}
            onSelect={handleSelectEntry}
            onDragOver={setActiveDropTarget}
            onDragLeave={(target) => setActiveDropTarget((current) => (current === target ? "" : current))}
            onEntryDragStart={() => {
              skipNextSelectRef.current = true;
              setDraggingFromList(true);
              setActiveDropTarget("");
            }}
            onEntryDragEnd={() => {
              setDraggingFromList(false);
              setActiveDropTarget("");
            }}
          />
        </div>

        {editingEntry && editingItem ? (
          <TradeItemConfigPanel
            entry={editingEntry}
            item={editingItem}
            listLabel={editingListLabel}
            augmentOptions={augments}
            characterClassName={characterClassName}
            onChange={(nextEntry) => updateTradeEntry(editing.listKey, editing.entryKey, nextEntry)}
            onClose={() => setEditing(null)}
          />
        ) : editingEntry && !editingItem ? (
          <p className="state">Loading item details...</p>
        ) : null}

        <section
          className={`trade-catalog ${catalogDropActive ? "is-drop-remove" : ""}`}
          onDragOver={(event) => {
            if (!draggingFromList) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setActiveDropTarget("catalog");
          }}
          onDragLeave={() => setActiveDropTarget((current) => (current === "catalog" ? "" : current))}
          onDrop={(event) => {
            if (!draggingFromList) {
              return;
            }
            event.preventDefault();
            handleCatalogDrop(readDragPayload(event));
            setDraggingFromList(false);
            setActiveDropTarget("");
          }}
        >
          {catalogDropActive ? <div className="trade-catalog-remove-hint">Drop here to remove</div> : null}
          <div className="trade-catalog-header">
            <div className="trade-catalog-tabs">
              {TRADE_CATEGORIES.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={entry.key === activeCategory ? "active" : ""}
                  onClick={() => setActiveCategory(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="trade-catalog-view-actions">
              <OwnedOnlyButton
                mode={ownedFilter}
                onCycle={() => setOwnedFilter((current) => nextOwnedFilterMode(current))}
              />
              <CatalogViewToggle iconView={iconView} onToggle={() => setIconView((current) => !current)} />
            </div>
          </div>

          <div className="trade-catalog-toolbar">
            <input
              type="search"
              placeholder="Search items..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {hasActiveFilters ? (
            <div className="trade-catalog-active-filters">
              {ownedFilter === "owned" ? <span className="trade-catalog-filter-chip">Owned only</span> : null}
              {ownedFilter === "missing" ? <span className="trade-catalog-filter-chip">Missing only</span> : null}
              {query.trim() ? <span className="trade-catalog-filter-chip">Search: {query.trim()}</span> : null}
              <button
                type="button"
                className="trade-catalog-clear-filters"
                onClick={() => {
                  setOwnedFilter("all");
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}

          {loading ? <p className="state">Loading {category.label.toLowerCase()}...</p> : null}
          {error ? <p className="state error">{error}</p> : null}

          {!loading && !error ? (
            iconView ? (
              <div className="trade-catalog-icon-grid">
                {filteredItems.length === 0 ? (
                  <p className="trade-catalog-empty">{emptyCatalogMessage}</p>
                ) : (
                  filteredItems.map((item) => (
                    <TradeCatalogIconItem
                      key={item.id}
                      item={item}
                      isOwned={ownedIds.has(item.id)}
                      {...catalogProps}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="trade-catalog-list">
                {filteredItems.length === 0 ? (
                  <p className="trade-catalog-empty">{emptyCatalogMessage}</p>
                ) : (
                  filteredItems.map((item) => (
                    <TradeCatalogListItem
                      key={item.id}
                      item={item}
                      isOwned={ownedIds.has(item.id)}
                      {...catalogProps}
                    />
                  ))
                )}
              </div>
            )
          ) : null}
        </section>
      </section>
    </PageShell>
  );
}
