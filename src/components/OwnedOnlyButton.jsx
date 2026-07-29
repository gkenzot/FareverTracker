const MODE_META = {
  all: {
    title: "Showing all. Click to show owned only.",
    label: "Show owned only",
    pressed: false
  },
  owned: {
    title: "Showing owned only. Click to show missing only.",
    label: "Showing owned only",
    pressed: true
  },
  missing: {
    title: "Showing missing only. Click to show all.",
    label: "Showing missing only",
    pressed: true
  }
};

export function OwnedOnlyButton({ mode = "all", onCycle }) {
  const meta = MODE_META[mode] ?? MODE_META.all;

  return (
    <button
      className={`page-settings-button page-owned-only-button mode-${mode} ${meta.pressed ? "active" : ""}`}
      type="button"
      onClick={onCycle}
      title={meta.title}
      aria-label={meta.label}
      aria-pressed={meta.pressed}
    />
  );
}

export function nextOwnedFilterMode(mode) {
  if (mode === "all") {
    return "owned";
  }
  if (mode === "owned") {
    return "missing";
  }
  return "all";
}
