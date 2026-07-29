import { useEffect, useState } from "react";

export function ColumnSettingsModal({
  open,
  onClose,
  columns,
  hiddenColumnKeys,
  onToggleColumn,
  onReorderColumn,
  onShowAllColumns
}) {
  const [draggedColumnKey, setDraggedColumnKey] = useState("");
  const hiddenSet = new Set(hiddenColumnKeys);
  const visibleCount = columns.filter((column) => !hiddenSet.has(column.key)).length;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="build-attr-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="build-attr-modal column-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="build-attr-modal-head">
          <h3 id="column-settings-title">Columns</h3>
          <button type="button" className="build-lab-ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

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
                className={`column-selector-option ${draggedColumnKey === column.key ? "is-dragging" : ""}`}
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
      </div>
    </div>
  );
}
