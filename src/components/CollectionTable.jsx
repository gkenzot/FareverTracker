import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function HeaderMenu({
  column,
  sortConfig,
  filterValue,
  filterOptions,
  isOpen,
  onToggle,
  onClose,
  onSort,
  onFilterChange
}) {
  const isActive = sortConfig.key === column.key;
  const selectedValues = Array.isArray(filterValue) ? filterValue : [];
  const hasFilter = selectedValues.length > 0;
  const canShowFilters = column.filterable && filterOptions.length <= 15;
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const width = 220;
    const margin = 8;
    const left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.right - width));

    setMenuPosition({
      top: rect.bottom + margin,
      left
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target;

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className="column-header">
      <span title={column.label}>{column.label}</span>
      <button
        ref={buttonRef}
        className={`column-menu-button ${isActive || hasFilter ? "is-active" : ""}`}
        type="button"
        onClick={onToggle}
        aria-label={`${column.label} options`}
      >
        {hasFilter ? "*" : "v"}
      </button>
      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              className="column-menu"
              style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
            >
              {column.sortable ? (
                <>
                  <button type="button" onClick={() => onSort(column.key, "asc")}>
                    Sort A-Z
                  </button>
                  <button type="button" onClick={() => onSort(column.key, "desc")}>
                    Sort Z-A
                  </button>
                </>
              ) : null}
              {canShowFilters ? (
                <>
                  <button type="button" onClick={() => onFilterChange(column.key, filterOptions)}>
                    All
                  </button>
                  <button type="button" onClick={() => onFilterChange(column.key, [])}>
                    None
                  </button>
                  <div className="column-filter-options">
                    {filterOptions.map((option) => (
                      <label key={option} className="column-filter-option" title={option}>
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(option)}
                          onChange={() => {
                            const nextValues = selectedValues.includes(option)
                              ? selectedValues.filter((value) => value !== option)
                              : [...selectedValues, option];
                            onFilterChange(column.key, nextValues);
                          }}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function CollectionTable({
  columns,
  items,
  getRowKey,
  getRowClassName,
  sortConfig,
  onSort,
  columnFilters,
  filterOptions,
  onFilterChange,
  emptyMessage
}) {
  const [openMenu, setOpenMenu] = useState(null);

  function updateSort(columnKey, direction) {
    onSort(columnKey, direction);
    setOpenMenu(null);
  }

  function updateFilter(columnKey, value) {
    onFilterChange(columnKey, value);
  }

  return (
    <section className="database-panel">
      <table className="collection-table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} className={column.widthClassName} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>
                <HeaderMenu
                  column={column}
                  sortConfig={sortConfig}
                  filterValue={columnFilters[column.key] ?? []}
                  filterOptions={filterOptions[column.key] ?? []}
                  isOpen={openMenu === column.key}
                  onToggle={() => setOpenMenu((current) => (current === column.key ? null : column.key))}
                  onClose={() => setOpenMenu(null)}
                  onSort={updateSort}
                  onFilterChange={updateFilter}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((item) => (
              <tr key={getRowKey(item)} className={getRowClassName?.(item) ?? ""}>
                {columns.map((column) => (
                  <td key={column.key} className={column.cellClassName}>
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="empty-table-cell" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
