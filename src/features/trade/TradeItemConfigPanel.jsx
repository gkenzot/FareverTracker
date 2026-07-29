import {
  WEAPON_RARITY_OPTIONS,
  MAX_DROP_ITEM_LEVEL,
  augmentMatchesAdornmentField,
  augmentMatchesCharacterClass,
  findAugmentByName,
  getAdornmentFieldsForSlot,
  getAugmentDisplayName,
  getDefaultUsedLevel,
  getDefaultUsedRarity,
  getItemCatalogRarity,
  getMaxWeaponUpgrades,
  getSlotDefinition,
  isFixedCraftLevelItem,
  isTwoHandedWeapon,
  isWeaponEquipmentSlot,
  resolveSlotAdornments,
  resolveUsedLevel,
  resolveUsedRarity,
  resolveUsedUpgradeLevel
} from "../builds/buildSlots";
import { scaleItemStats } from "../builds/gearStatScaling";
import { sortGearStatsForDisplay } from "../builds/aggregateBuildAttributes";
import {
  parseWeaponUpgradeBonusSheetEffects,
  resolveWeaponUpgradeBonus,
  WEAPON_UPGRADE_BONUS_MIN_LEVEL
} from "../builds/weaponUpgradeBonuses";
import { assetPath } from "../../shared/utils/assets";
import { inferTradeSlotKey, tradeEntryToSlotValue } from "./tradeConstants";
import { WeaponUpgradePips } from "../../components/WeaponUpgradePips";

function rarityClass(rarity) {
  return `rarity-${String(rarity ?? "common").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

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

function AdornmentStatBlocks({ blocks }) {
  if (!blocks.length) {
    return null;
  }

  return (
    <div className="eq-adornment-stat-blocks">
      {blocks.map((block) => (
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
  );
}

export function TradeItemConfigPanel({
  entry,
  item,
  listLabel = "",
  augmentOptions = [],
  characterClassName = "",
  onChange,
  onClose
}) {
  if (!entry || !item) {
    return null;
  }

  const slotKey = inferTradeSlotKey(item, entry.collectionKey);
  const slot = getSlotDefinition(slotKey);
  const value = tradeEntryToSlotValue(entry);
  const adornmentFields = getAdornmentFieldsForSlot(slotKey);
  const adornments = resolveSlotAdornments(slotKey, value.adornments);
  const crafted = isFixedCraftLevelItem(item);
  const isWeapon = isWeaponEquipmentSlot(slotKey) || entry.collectionKey === "weapons";
  const showRarity = isWeapon && !crafted;
  const showUpgrades = isWeapon && !crafted;
  const defaultLevel = getDefaultUsedLevel(item);
  const catalogRarity = getItemCatalogRarity(item);
  const lockedRarity = getDefaultUsedRarity(item);
  const usedRarity = showRarity ? resolveUsedRarity(value, item) : lockedRarity;
  const maxUpgrades = getMaxWeaponUpgrades(usedRarity);
  const usedUpgradeLevel = resolveUsedUpgradeLevel(value, usedRarity);
  const effectiveLevel = resolveUsedLevel(value, item);
  const liveStats = sortGearStatsForDisplay(
    scaleItemStats(item, {
      level: effectiveLevel,
      rarity: showRarity ? usedRarity : lockedRarity,
      upgradeLevel: showUpgrades ? usedUpgradeLevel : 0,
      characterClassName
    }),
    characterClassName
  );
  const adornmentStatBlocks = getSelectedAdornmentBlocks(slotKey, adornments, augmentOptions);
  const upgradeBonusBlock = showUpgrades
    ? getWeaponUpgradeBonusBlock(item, { rarity: usedRarity, upgradeLevel: usedUpgradeLevel })
    : null;
  const extraStatBlocks = upgradeBonusBlock ? [upgradeBonusBlock, ...adornmentStatBlocks] : adornmentStatBlocks;
  const weaponDamageMin = Number(item?.weaponDamage?.min);
  const weaponDamageMax = Number(item?.weaponDamage?.max);
  const weaponDamageLine =
    Number.isFinite(weaponDamageMin) && Number.isFinite(weaponDamageMax)
      ? `Weapon Damage ${weaponDamageMin}–${weaponDamageMax}${
          item.weaponDamage?.affinity ? ` · ${item.weaponDamage.affinity}` : ""
        }`
      : null;

  function patchEntry(partial) {
    onChange({
      ...entry,
      ...partial
    });
  }

  return (
    <section className="eq-item-config trade-item-config" aria-label="Configure trade item">
      <div className="eq-bag-header">
        <div className="eq-bag-title-row">
          <h3>
            Configure{listLabel ? ` · ${listLabel}` : ""}
            {slot?.label ? ` · ${slot.label}` : ""}
          </h3>
          <div className="eq-item-config-header-actions">
            <button type="button" className="build-lab-ghost-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="eq-item-config-body">
        <div className="eq-item-config-identity">
          {item.iconPath ? <img src={assetPath(item.iconPath)} alt="" /> : null}
          <div>
            <strong>{item.name}</strong>
            <span>
              <span className={rarityClass(showRarity ? usedRarity : catalogRarity || lockedRarity)}>
                {showRarity ? usedRarity : catalogRarity || lockedRarity || "Unknown"}
              </span>
              {showUpgrades && usedUpgradeLevel > 0 ? ` · ★${usedUpgradeLevel}` : ""}
              {isTwoHandedWeapon(item) ? " · 2H" : ""}
            </span>
          </div>
        </div>

        {liveStats.length > 0 || weaponDamageLine ? (
          <ul className="eq-item-config-stats">
            {weaponDamageLine ? <li key="weapon-damage">{weaponDamageLine}</li> : null}
            {liveStats.map((stat) => (
              <li key={`${stat.label}-${stat.value}`}>{formatStatLine(stat)}</li>
            ))}
          </ul>
        ) : null}

        <AdornmentStatBlocks blocks={extraStatBlocks} />

        <div className="eq-item-config-fields">
          <label className="eq-item-config-slider-field">
            <span className="eq-item-config-field-head">
              Item level
              <strong>{effectiveLevel ?? defaultLevel}</strong>
            </span>
            <input
              type="range"
              min="1"
              max={MAX_DROP_ITEM_LEVEL}
              step="1"
              value={Math.min(effectiveLevel ?? defaultLevel, MAX_DROP_ITEM_LEVEL)}
              disabled={crafted}
              aria-label="Item level"
              onChange={(event) => patchEntry({ usedLevel: Number(event.target.value) })}
            />
          </label>

          {showRarity ? (
            <div className="eq-item-config-rarity-field" role="group" aria-label="Rarity">
              <span className="eq-item-config-field-head">
                Rarity
                <strong className={rarityClass(usedRarity)}>{usedRarity}</strong>
              </span>
              <div className="eq-rarity-buttons">
                {WEAPON_RARITY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`eq-rarity-button ${rarityClass(option)} ${
                      usedRarity === option ? "is-active" : ""
                    }`}
                    aria-pressed={usedRarity === option}
                    onClick={() =>
                      patchEntry({
                        usedRarity: option,
                        usedUpgradeLevel: Math.min(usedUpgradeLevel, getMaxWeaponUpgrades(option))
                      })
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showUpgrades ? (
            <WeaponUpgradePips
              value={usedUpgradeLevel}
              max={maxUpgrades}
              onChange={(upgradeLevel) => patchEntry({ usedUpgradeLevel: upgradeLevel })}
            />
          ) : null}

          {adornmentFields.map((field) => {
            const options = augmentOptions
              .filter((augment) => augmentMatchesAdornmentField(augment, field.key))
              .filter((augment) =>
                field.key === "sigil" ? augmentMatchesCharacterClass(augment, characterClassName) : true
              )
              .map((augment) => ({
                id: augment.id || augment.slug || getAugmentDisplayName(augment),
                label: getAugmentDisplayName(augment)
              }))
              .filter((option) => option.label)
              .sort((left, right) => left.label.localeCompare(right.label));
            const current = adornments[field.key] ?? "";
            const knownOption = !current || options.some((option) => option.label === current);

            return (
              <label key={field.key}>
                <span>{field.label}</span>
                <select
                  value={current}
                  aria-label={field.label}
                  onChange={(event) =>
                    patchEntry({
                      adornments: {
                        ...adornments,
                        [field.key]: event.target.value
                      }
                    })
                  }
                >
                  <option value="">None</option>
                  {!knownOption ? <option value={current}>{current}</option> : null}
                  {options.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small>
                  {field.key === "sigil"
                    ? characterClassName
                      ? `3 options for ${characterClassName}`
                      : "Select from catalog"
                    : field.key === "cursed"
                      ? "±20 Rare / ±40 Epic conversions"
                      : field.key === "enchantmentWeapon"
                        ? "Weapon magic formula"
                        : "Select from catalog"}
                </small>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}
