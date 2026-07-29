export function DatabaseToolbar({ query, onQueryChange }) {
  return (
    <section className="toolbar">
      <input
        type="search"
        placeholder="Search by name or ID..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </section>
  );
}
