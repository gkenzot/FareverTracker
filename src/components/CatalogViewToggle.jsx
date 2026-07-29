export function CatalogViewToggle({ iconView, onToggle }) {
  return (
    <button
      className={`page-settings-button ${iconView ? "page-icon-view-button" : "page-list-view-button"} active`}
      type="button"
      onClick={onToggle}
      title={iconView ? "Icon view active. Switch to list view." : "List view active. Switch to icon view."}
      aria-label={iconView ? "Switch to list view" : "Switch to icon view"}
      aria-pressed={iconView}
    />
  );
}
