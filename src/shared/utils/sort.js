export function compareValues(valueA, valueB, fallbackA = "", fallbackB = "", direction = "asc") {
  const multiplier = direction === "asc" ? 1 : -1;

  if (typeof valueA === "number" && typeof valueB === "number") {
    return (valueA - valueB || String(fallbackA).localeCompare(String(fallbackB))) * multiplier;
  }

  return (
    String(valueA ?? "").localeCompare(String(valueB ?? "")) ||
    String(fallbackA).localeCompare(String(fallbackB))
  ) * multiplier;
}
