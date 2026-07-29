import { useLayoutEffect, useRef, useState } from "react";
import { GearItemHoverTooltip } from "./GearItemHoverTooltip";
import { assetPath } from "../shared/utils/assets";

/** Base icon size at 100%; default view uses 150%. */
const ICON_BASE_SIZE = 56;
const ICON_DEFAULT_ZOOM = 1.5;
const ICON_GAP = 10;

function resolveShowGearTooltip(showGearTooltip, item) {
  if (showGearTooltip === true) {
    return true;
  }
  if (typeof showGearTooltip === "function") {
    return Boolean(showGearTooltip(item));
  }
  return false;
}

export function CollectionIconGrid({
  items,
  getRowKey,
  isCollected,
  onToggleCollected,
  showGearTooltip = false,
  emptyMessage
}) {
  const gridRef = useRef(null);
  const preferredSize = Math.round(ICON_BASE_SIZE * ICON_DEFAULT_ZOOM);
  const [layout, setLayout] = useState({ columns: 1, size: preferredSize });
  const [tooltip, setTooltip] = useState(null);

  useLayoutEffect(() => {
    const node = gridRef.current;
    if (!node) {
      return undefined;
    }

    function updateLayout() {
      const width = node.clientWidth;
      if (width <= 0) {
        return;
      }

      const columns = Math.max(1, Math.floor((width + ICON_GAP) / (preferredSize + ICON_GAP)));
      const size = Math.max(preferredSize, (width - (columns - 1) * ICON_GAP) / columns);
      setLayout({ columns, size: Math.floor(size) });
    }

    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    observer.observe(node);
    return () => observer.disconnect();
  }, [preferredSize]);

  if (items.length === 0) {
    return (
      <section className="database-panel">
        <p className="empty-table-cell">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="database-panel">
      <div
        ref={gridRef}
        className="collection-icon-grid"
        style={{
          "--icon-size": `${layout.size}px`,
          "--icon-columns": layout.columns,
          "--icon-gap": `${ICON_GAP}px`
        }}
      >
        {items.map((item) => {
          const collected = Boolean(isCollected?.(item));
          const canToggle = typeof onToggleCollected === "function";
          const enableTooltip = resolveShowGearTooltip(showGearTooltip, item);

          return (
            <button
              key={getRowKey(item)}
              type="button"
              className={`collection-icon-tile ${collected ? "is-collected" : ""}`}
              title={enableTooltip ? undefined : item.name}
              aria-label={item.name}
              aria-pressed={collected}
              onClick={() => {
                if (canToggle) {
                  onToggleCollected(item);
                }
              }}
              onMouseEnter={
                enableTooltip
                  ? (event) => setTooltip({ item, x: event.clientX, y: event.clientY })
                  : undefined
              }
              onMouseMove={
                enableTooltip
                  ? (event) => setTooltip({ item, x: event.clientX, y: event.clientY })
                  : undefined
              }
              onMouseLeave={enableTooltip ? () => setTooltip(null) : undefined}
            >
              {item.iconPath ? (
                <img src={assetPath(item.iconPath)} alt="" loading="lazy" />
              ) : (
                <span className="collection-icon-tile-empty" />
              )}
            </button>
          );
        })}
      </div>

      {tooltip?.item ? (
        <GearItemHoverTooltip item={tooltip.item} x={tooltip.x} y={tooltip.y} />
      ) : null}
    </section>
  );
}
