export function filterValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  return [String(value ?? "")].filter(Boolean);
}

export function getVisiblePropertyFields(config, propertyFields) {
  const excludedPropertyKeys = new Set(config.excludedPropertyKeys ?? []);

  if (config.showItemLevel) {
    excludedPropertyKeys.add("level");
    excludedPropertyKeys.add("ilevel");
  }

  return propertyFields.filter((field) => !excludedPropertyKeys.has(field.key));
}

export function countValues(items, getValue) {
  const counts = new Map();

  for (const item of items) {
    for (const value of filterValues(getValue(item))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return counts;
}

export function sortedCountedValues(counts, compareValues) {
  return [...counts.keys()].sort(compareValues).map((value) => ({
    value,
    count: counts.get(value) ?? 0
  }));
}
