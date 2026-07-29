/**
 * In-game style weapon upgrade slots:
 * empty = gray circle + medium white border
 * filled = white fill + purple border + 4-pointed star (inward square corners)
 */
export function WeaponUpgradePips({ value = 0, max = 0, onChange, disabled = false }) {
  const safeMax = Math.max(0, Number(max) || 0);
  const safeValue = Math.min(Math.max(0, Number(value) || 0), safeMax);

  if (safeMax <= 0) {
    return null;
  }

  return (
    <div className="weapon-upgrade-field" role="group" aria-label="Weapon upgrade">
      <span className="eq-item-config-field-head">
        Upgrade
        <strong>
          ★{safeValue} / {safeMax}
        </strong>
      </span>
      <div className="weapon-upgrade-pips">
        {Array.from({ length: safeMax }, (_, index) => {
          const level = index + 1;
          const filled = level <= safeValue;

          return (
            <button
              key={level}
              type="button"
              className={`weapon-upgrade-pip ${filled ? "is-filled" : ""}`}
              disabled={disabled}
              aria-label={`Upgrade level ${level}`}
              aria-pressed={filled}
              title={
                filled
                  ? `Set upgrade to ${level === safeValue ? level - 1 : level}`
                  : `Set upgrade to ${level}`
              }
              onClick={() => {
                if (disabled || typeof onChange !== "function") {
                  return;
                }
                onChange(level === safeValue ? level - 1 : level);
              }}
            >
              {filled ? (
                <svg className="weapon-upgrade-pip-star" viewBox="0 0 24 24" aria-hidden="true">
                  {/* Full-size 4-pointed star; tips reach/overwrite the circle edge */}
                  <path
                    d="M12 0.4 L14.8 8.6 L23.6 12 L14.8 15.4 L12 23.6 L9.2 15.4 L0.4 12 L9.2 8.6 Z"
                    fill="#f8fafc"
                    stroke="#8b3fd9"
                    strokeWidth="1.4"
                    strokeLinejoin="miter"
                  />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
