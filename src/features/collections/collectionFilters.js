import { compareValues } from "../../shared/utils/sort";

function normalizeFilterValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return String(value ?? "");
}

function normalizeSearchValue(value) {
  return Array.isArray(value) ? value.join(" ").toLowerCase() : String(value ?? "").toLowerCase();
}

function getColumnValue(column, item) {
  return normalizeFilterValue(column?.getFilterValue ? column.getFilterValue(item) : item[column?.key]);
}

export function filterItems(items, { query, columnFilters, columns }) {
  const normalizedQuery = query.trim().toLowerCase();
  const columnByKey = new Map(columns.map((column) => [column.key, column]));
  const activeFilters = Object.entries(columnFilters).filter(([, value]) => Array.isArray(value) && value.length > 0);

  return items.filter((item) => {
    const propertyValues = Object.values(item.properties ?? {}).map(normalizeSearchValue);
    const matchesQuery =
      !normalizedQuery ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery) ||
      propertyValues.some((value) => value.includes(normalizedQuery));
    const matchesColumnFilters = activeFilters.every(([key, values]) => {
      const column = columnByKey.get(key);
      const columnValue = getColumnValue(column, item);
      return (
        !column ||
        values.some((value) => (Array.isArray(columnValue) ? columnValue.includes(value) : columnValue === value))
      );
    });

    return matchesQuery && matchesColumnFilters;
  });
}

export function sortItems(items, sortConfig, columns) {
  const column = columns.find((itemColumn) => itemColumn.key === sortConfig.key);

  return [...items].sort((itemA, itemB) => {
    const getValue = (item) => {
      const value = column?.getSortValue ? column.getSortValue(item) : getColumnValue(column, item);
      return Array.isArray(value) ? value.join(", ") : value;
    };

    return compareValues(getValue(itemA), getValue(itemB), itemA.name, itemB.name, sortConfig.direction);
  });
}
