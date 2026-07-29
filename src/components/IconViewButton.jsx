export function IconViewButton({ enabled, onToggle }) {
  return (
    <button
      className={`page-settings-button page-icon-view-button ${enabled ? "active" : ""}`}
      type="button"
      onClick={onToggle}
      title={enabled ? "Show table view" : "Show icon view"}
      aria-label={enabled ? "Show table view" : "Show icon view"}
      aria-pressed={enabled}
    />
  );
}
