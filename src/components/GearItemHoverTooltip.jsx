import { createPortal } from "react-dom";
import { assetPath } from "../shared/utils/assets";
import { sortGearStatsForDisplay } from "../features/builds/aggregateBuildAttributes";
import {
  findAugmentByName,
  getAdornmentFieldsForSlot,
  getAugmentDisplayName,
  getDefaultUsedLevel,
  getDefaultUsedRarity,
  getItemCatalogRarity,
  isFixedCraftLevelItem,
  isTwoHandedWeapon,
  isWeaponEquipmentSlot,
  resolveSlotAdornments,
  resolveUsedLevel,
  resolveUsedRarity,
  resolveUsedUpgradeLevel
} from "../features/builds/buildSlots";
import { scaleItemStats } from "../features/builds/gearStatScaling";
import {
  parseWeaponUpgradeBonusSheetEffects,
  resolveWeaponUpgradeBonus,
  WEAPON_UPGRADE_BONUS_MIN_LEVEL
} from "../features/builds/weaponUpgradeBonuses";

function formatStatLine(stat) {
  const value = Number(stat?.value);
  if (!Number.isFinite(value)) {
    return String(stat?.label ?? "");
  }
  const signed = value > 0 ? `+${value}` : String(value);
  if (stat?.unit === "%") {
    return `${signed}% ${stat.label}`;
  }
  return `${signed} ${stat.label}`;
}

function rarityClass(rarity) {
  return `rarity-${String(rarity ?? "common").toLowerCase()}`;
}

function getMetaRows(item, { usedLevel, usedUpgradeLevel, slotKey, showWeaponControls }) {
  const rows = [];
  const type = item.properties?.subcategory ?? item.properties?.type ?? item.family;
  if (type) {
    rows.push({ label: "Type", value: String(type) });
  }
  if (usedLevel != null && usedLevel !== "") {
    rows.push({ label: showWeaponControls ? "Weapon level" : "Level", value: String(usedLevel) });
  }
  if (showWeaponControls && usedUpgradeLevel != null && Number(usedUpgradeLevel) > 0) {
    rows.push({ label: "Upgrade", value: `★${usedUpgradeLevel}` });
  }

  const weaponDamage = item.weaponDamage;
  if (weaponDamage && Number.isFinite(Number(weaponDamage.avg))) {
    const avg = Number(weaponDamage.avg);
    const min = Number(weaponDamage.min);
    const max = Number(weaponDamage.max);
    const hasRange = Number.isFinite(min) && Number.isFinite(max);
    const value = hasRange
      ? `${min}–${max}${weaponDamage.affinity ? ` · ${weaponDamage.affinity}` : ""}`
      : `${avg}${weaponDamage.affinity ? ` · ${weaponDamage.affinity}` : ""}`;
    rows.push({ label: "Weapon Damage", value });
  }

  if (isTwoHandedWeapon(item)) {
    rows.push({ label: "Hands", value: "Two-handed" });
  }

  return rows;
}

function getWeaponUpgradeBonusBlock(item, { rarity = "Rare", upgradeLevel = 0 } = {}) {
  const bonus = resolveWeaponUpgradeBonus(item, { rarity, upgradeLevel });
  if (!bonus?.active) {
    return null;
  }

  const sheetEffects = parseWeaponUpgradeBonusSheetEffects(bonus.text);
  const stats = Object.entries(sheetEffects).map(([key, fraction]) => ({
    label:
      key === "criticalChance"
        ? "Critical Chance"
        : key === "armorPenetration"
          ? "Armor Penetration"
          : key === "magicPenetration"
            ? "Magic Penetration"
            : key === "magicMastery"
              ? "Magic Mastery"
              : key === "physicalMastery"
                ? "Physical Mastery"
                : key === "fervor"
                  ? "Fervor"
                  : key,
    value: Math.round((Number(fraction) || 0) * 1000) / 10,
    unit: "%"
  }));

  return {
    key: "upgradeBonus",
    fieldLabel: `★${WEAPON_UPGRADE_BONUS_MIN_LEVEL}+`,
    name: "Upgrade Bonus",
    stats,
    description: stats.length ? "" : bonus.text
  };
}

function getSelectedAdornmentBlocks(slotKey, adornments, augments = []) {
  const resolved = resolveSlotAdornments(slotKey, adornments);
  const blocks = [];

  for (const field of getAdornmentFieldsForSlot(slotKey)) {
    const rawName = resolved[field.key];
    if (!rawName) {
      continue;
    }
    const augment = findAugmentByName(augments, rawName, field.key);
    blocks.push({
      key: field.key,
      fieldLabel: field.label,
      name: augment ? getAugmentDisplayName(augment) : rawName,
      stats: Array.isArray(augment?.stats) ? augment.stats : [],
      description: augment?.description || ""
    });
  }

  return blocks;
}

/**
 * Hover card for gear.
 * Pass trade/build config (level, rarity, upgrade, adornments) to show the configured item.
 */
export function GearItemHoverTooltip({
  item,
  x,
  y,
  usedLevel = null,
  usedRarity = null,
  usedUpgradeLevel = null,
  adornments = null,
  augments = [],
  slotKey = "",
  characterClassName = "",
  slotValue = null
}) {
  if (!item) {
    return null;
  }

  const crafted = isFixedCraftLevelItem(item);
  const showWeaponControls = (isWeaponEquipmentSlot(slotKey) || Boolean(item.weaponDamage)) && !crafted;
  const resolvedSlotValue = slotValue ?? {
    usedLevel,
    usedRarity,
    usedUpgradeLevel,
    adornments
  };
  const effectiveLevel =
    usedLevel != null
      ? usedLevel
      : slotValue
        ? resolveUsedLevel(slotValue, item)
        : getDefaultUsedLevel(item);
  const catalogRarity = getItemCatalogRarity(item);
  const lockedRarity = getDefaultUsedRarity(item) || catalogRarity || "Rare";
  const effectiveRarity = showWeaponControls
    ? usedRarity || resolveUsedRarity(resolvedSlotValue, item) || lockedRarity
    : lockedRarity;
  const effectiveUpgrade = showWeaponControls
    ? usedUpgradeLevel != null
      ? usedUpgradeLevel
      : resolveUsedUpgradeLevel(resolvedSlotValue, effectiveRarity)
    : 0;

  const stats = sortGearStatsForDisplay(
    scaleItemStats(item, {
      level: effectiveLevel,
      rarity: effectiveRarity,
      upgradeLevel: effectiveUpgrade,
      characterClassName
    }),
    characterClassName
  );

  const adornmentBlocks = slotKey
    ? getSelectedAdornmentBlocks(slotKey, adornments ?? resolvedSlotValue.adornments, augments)
    : [];
  const upgradeBonusBlock = showWeaponControls
    ? getWeaponUpgradeBonusBlock(item, { rarity: effectiveRarity, upgradeLevel: effectiveUpgrade })
    : null;
  const extraBlocks = upgradeBonusBlock ? [upgradeBonusBlock, ...adornmentBlocks] : adornmentBlocks;
  const metaRows = getMetaRows(item, {
    usedLevel: effectiveLevel,
    usedUpgradeLevel: effectiveUpgrade,
    slotKey,
    showWeaponControls
  });

  const left = Math.min(x + 14, window.innerWidth - 300);
  const top = Math.min(y + 14, window.innerHeight - 40);

  return createPortal(
    <div className="item-hover-tooltip" style={{ left, top }} role="tooltip">
      <div className="item-hover-tooltip-head">
        {item.iconPath ? <img src={assetPath(item.iconPath)} alt="" /> : null}
        <div>
          <strong>{item.name}</strong>
          <span className={rarityClass(effectiveRarity)}>
            {effectiveRarity}
            {showWeaponControls && effectiveUpgrade > 0 ? ` · ★${effectiveUpgrade}` : ""}
          </span>
        </div>
      </div>

      {stats.length > 0 ? (
        <ul className="item-hover-tooltip-stats">
          {stats.map((stat) => (
            <li key={`${stat.label}-${stat.value}`}>{formatStatLine(stat)}</li>
          ))}
        </ul>
      ) : null}

      {extraBlocks.length > 0 ? (
        <div className="eq-adornment-stat-blocks is-tooltip">
          {extraBlocks.map((block) => (
            <div key={block.key} className="eq-adornment-stat-block">
              <strong>
                {block.fieldLabel ? `${block.fieldLabel} · ` : ""}
                {block.name}
              </strong>
              {block.stats.length > 0 ? (
                <ul>
                  {block.stats.map((stat) => (
                    <li key={`${block.key}-${stat.label}-${stat.value}-${stat.unit || ""}`}>
                      {formatStatLine(stat)}
                    </li>
                  ))}
                </ul>
              ) : block.description ? (
                <p>{block.description}</p>
              ) : (
                <p>No stats mapped for this adornment.</p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {metaRows.length > 0 ? (
        <dl>
          {metaRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>,
    document.body
  );
}
