import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function DatabaseToolbar({
  query,
  onQueryChange,
  columns,
  hiddenColumnKeys,
  onToggleColumn,
  onReorderColumn,
  onShowAllColumns,
  menuResetKey
}) {
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState("");
  const columnButtonRef = useRef(null);
  const columnMenuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const hiddenSet = new Set(hiddenColumnKeys);
  const visibleCount = columns.filter((column) => !hiddenSet.has(column.key)).length;

  useEffect(() => {
    setIsColumnMenuOpen(false);
  }, [menuResetKey]);

  useLayoutEffect(() => {
    if (!isColumnMenuOpen || !columnButtonRef.current) {
      return;
    }

    const rect = columnButtonRef.current.getBoundingClientRect();
    const width = 240;
    const margin = 8;
    const left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.right - width));

    setMenuPosition({
      top: rect.bottom + margin,
      left
    });
  }, [isColumnMenuOpen]);

  useEffect(() => {
    if (!isColumnMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target;

      if (columnButtonRef.current?.contains(target) || columnMenuRef.current?.contains(target)) {
        return;
      }

      setIsColumnMenuOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsColumnMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isColumnMenuOpen]);

  return (
    <section className="toolbar">
      <input
        type="search"
        placeholder="Search by name or ID..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />

      <div className="column-selector">
        <button ref={columnButtonRef} type="button" onClick={() => setIsColumnMenuOpen((current) => !current)}>
          Columns
        </button>

        {isColumnMenuOpen && menuPosition
          ? createPortal(
              <div
                ref={columnMenuRef}
                className="column-selector-menu"
                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
              >
                <div className="column-selector-header">
                  <strong>Visible columns</strong>
                  <button type="button" onClick={onShowAllColumns}>
                    Show all
                  </button>
                </div>

                <div className="column-selector-list">
                  {columns.map((column) => {
                    const isVisible = !hiddenSet.has(column.key);
                    const isLastVisible = isVisible && visibleCount === 1;

                    return (
                      <div
                        key={column.key}
                        className={`column-selector-option ${
                          draggedColumnKey === column.key ? "is-dragging" : ""
                        }`}
                        onDragOver={(event) => {
                          if (!onReorderColumn || draggedColumnKey === column.key) {
                            return;
                          }

                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceKey = draggedColumnKey || event.dataTransfer.getData("text/plain");
                          onReorderColumn?.(sourceKey, column.key);
                          setDraggedColumnKey("");
                        }}
                      >
                        <span
                          className="column-drag-handle"
                          draggable
                          title="Drag to reorder"
                          onDragStart={(event) => {
                            setDraggedColumnKey(column.key);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", column.key);
                          }}
                          onDragEnd={() => setDraggedColumnKey("")}
                        >
                          ::
                        </span>
                        <label>
                          <input
                            type="checkbox"
                            checked={isVisible}
                            disabled={isLastVisible}
                            onChange={() => onToggleColumn(column.key)}
                          />
                          <span title={column.label}>{column.label}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    </section>
  );
}
