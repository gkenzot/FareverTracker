import { useMemo, useState } from "react";
import { assetPath } from "../../shared/utils/assets";
import { filterItemsByCharacterClass } from "../../shared/utils/characterClass";
import {
  EQUIPMENT_LAYOUT,
  EQUIPMENT_SLOTS,
  WEAPON_RARITY_OPTIONS,
  createEmptyAdornments,
  createEmptyEquipmentSlot,
  getAdornmentFieldsForSlot,
  getAugmentDisplayName,
  findAugmentByName,
  getDefaultUsedLevel,
  getDefaultUsedRarity,
  getItemCatalogRarity,
  getItemIconLevel,
  getMaxWeaponUpgrades,
  MAX_DROP_ITEM_LEVEL,
  clampItemLevel,
  getSlotDefinition,
  augmentMatchesAdornmentField,
  augmentMatchesCharacterClass,
  isFixedCraftLevelItem,
  isOffHandOnlyWeapon,
  isShopPurchasableItem,
  isTwoHandedWeapon,
  isWeaponEquipmentSlot,
  itemAllowsDuplicateEquip,
  itemFitsSlot,
  resolveSlotAdornments,
  resolveUsedLevel,
  resolveUsedRarity,
  resolveUsedUpgradeLevel,
  slotsAllowDuplicateItem
} from "./buildSlots";
import { applyArsenalStatFactor, scaleItemStats } from "./gearStatScaling";
import { sortGearStatsForDisplay } from "./aggregateBuildAttributes";
import {
  parseWeaponUpgradeBonusSheetEffects,
  resolveWeaponUpgradeBonus,
  WEAPON_UPGRADE_BONUS_MIN_LEVEL
} from "./weaponUpgradeBonuses";

const DRAG_MIME = "application/x-farever-gear";

const RARE_AND_UP = new Set(["rare", "epic", "legendary"]);

function sortItems(items) {
  return [...items].sort((left, right) => {
    const levelDelta = (right.itemLevel ?? 0) - (left.itemLevel ?? 0);
    if (levelDelta !== 0) {
      return levelDelta;
    }
    return String(left.name).localeCompare(String(right.name));
  });
}

function rarityClass(rarity) {
  return `rarity-${String(rarity ?? "common").toLowerCase()}`;
}

function getItemRarity(item) {
  return getItemCatalogRarity(item);
}

function isRareOrAbove(item) {
  return RARE_AND_UP.has(getItemRarity(item).toLowerCase());
}

function readDragPayload(event) {
  try {
    const raw = event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData("text/plain");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDragPayload(event, payload) {
  const raw = JSON.stringify(payload);
  event.dataTransfer.setData(DRAG_MIME, raw);
  event.dataTransfer.setData("text/plain", raw);
  event.dataTransfer.effectAllowed = "move";
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

function resolveItemStats(item, { characterClassName, usedLevel, usedRarity, usedUpgradeLevel, slotValue, slotKey } = {}) {
  const level = slotValue
    ? resolveUsedLevel(slotValue, item)
    : usedLevel ?? getDefaultUsedLevel(item);
  const allowRarityOverride = !slotKey || isWeaponEquipmentSlot(slotKey);
  const rarity = allowRarityOverride
    ? usedRarity || resolveUsedRarity(slotValue, item) || "Rare"
    : getDefaultUsedRarity(item) || "Rare";
  const allowUpgrades = !slotKey || isWeaponEquipmentSlot(slotKey);
  const upgradeLevel = allowUpgrades
    ? usedUpgradeLevel ?? resolveUsedUpgradeLevel(slotValue, rarity)
    : 0;

  const stats = scaleItemStats(item, {
    level,
    rarity,
    upgradeLevel,
    characterClassName
  });

  return sortGearStatsForDisplay(
    slotKey === "arsenal" ? applyArsenalStatFactor(stats) : stats,
    characterClassName
  );
}

function getTooltipMetaRows(item, extras = {}) {
  if (!item) {
    return [];
  }

  const rows = [];
  const type = item.properties?.subcategory ?? item.properties?.type ?? item.family;
  const level = item.itemLevel ?? item.properties?.level;

  if (type) {
    rows.push({ label: "Type", value: String(type) });
  }
  if (level != null && level !== "") {
    rows.push({ label: "Level", value: String(level) });
  }
  const weaponDamage = item.weaponDamage;
  if (weaponDamage && Number.isFinite(Number(weaponDamage.avg))) {
    const avg = Number(weaponDamage.avg);
    const min = Number(weaponDamage.min);
    const max = Number(weaponDamage.max);
    const range =
      Number.isFinite(min) && Number.isFinite(max) ? ` (${min}–${max})` : "";
    rows.push({
      label: "Weapon Damage",
      value: `${avg}${range}${weaponDamage.affinity ? ` · ${weaponDamage.affinity}` : ""}`
    });
  }
  if (isTwoHandedWeapon(item)) {
    rows.push({ label: "Hands", value: "Two-handed" });
  }
  if (extras.usedLevel != null) {
    rows.push({ label: "Used level", value: String(extras.usedLevel) });
  }
  if (
    extras.usedUpgradeLevel != null &&
    Number(extras.usedUpgradeLevel) > 0 &&
    isWeaponEquipmentSlot(extras.slotKey)
  ) {
    rows.push({ label: "Upgrades", value: `+${extras.usedUpgradeLevel}` });
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

function AdornmentStatBlocks({ blocks, className = "" }) {
  if (!blocks.length) {
    return null;
  }

  return (
    <div className={`eq-adornment-stat-blocks ${className}`.trim()}>
      {blocks.map((block) => (
        <div
          key={block.key}
          className="eq-adornment-stat-block"
        >
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
            <p>Sem stats mapeados para este adereço.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ItemHoverTooltip({ tooltip }) {
  if (!tooltip?.item) {
    return null;
  }

  const { item, x, y, extras = {} } = tooltip;
  const itemStats = resolveItemStats(item, {
    characterClassName: extras.characterClassName,
    usedLevel: extras.usedLevel,
    usedRarity: extras.usedRarity,
    usedUpgradeLevel: extras.usedUpgradeLevel,
    slotValue: extras.slotValue,
    slotKey: extras.slotKey
  });
  const metaRows = getTooltipMetaRows(item, extras);
  const displayRarity = extras.usedRarity || getItemRarity(item) || "Unknown";
  const adornmentBlocks = getSelectedAdornmentBlocks(
    extras.slotKey ?? "",
    extras.adornments,
    extras.augments
  );
  const upgradeBonusBlock =
    isWeaponEquipmentSlot(extras.slotKey) && !isFixedCraftLevelItem(item)
      ? getWeaponUpgradeBonusBlock(item, {
          rarity: extras.usedRarity || getDefaultUsedRarity(item),
          upgradeLevel: extras.usedUpgradeLevel ?? 0
        })
      : null;
  const extraStatBlocks = upgradeBonusBlock ? [upgradeBonusBlock, ...adornmentBlocks] : adornmentBlocks;

  const left = Math.min(x + 14, window.innerWidth - 300);
  const top = Math.min(y + 14, window.innerHeight - 40);

  return (
    <div className="item-hover-tooltip" style={{ left, top }} role="tooltip">
      <div className="item-hover-tooltip-head">
        {item.iconPath ? <img src={assetPath(item.iconPath)} alt="" /> : null}
        <div>
          <strong>{item.name}</strong>
          <span className={rarityClass(displayRarity)}>{displayRarity}</span>
        </div>
      </div>

      {itemStats.length > 0 ? (
        <ul className="item-hover-tooltip-stats">
          {itemStats.map((stat) => (
            <li key={`${stat.label}-${stat.value}`}>{formatStatLine(stat)}</li>
          ))}
        </ul>
      ) : null}

      <AdornmentStatBlocks blocks={extraStatBlocks} className="is-tooltip" />

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
    </div>
  );
}

function GearIcon({
  item,
  level,
  rarity,
  draggable = false,
  onDragStart,
  onDragEnd,
  dimmed = false,
  notOwned = false,
  onHoverStart,
  onHoverMove,
  onHoverEnd
}) {
  if (!item) {
    return null;
  }

  const twoHanded = isTwoHandedWeapon(item);
  const borderRarity = rarity || getItemCatalogRarity(item);

  return (
    <button
      type="button"
      className={`gear-icon ${rarityClass(borderRarity)} ${dimmed ? "is-dimmed" : ""} ${notOwned ? "is-not-owned" : ""} ${twoHanded ? "is-two-handed" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={(event) => onHoverStart?.(item, event)}
      onMouseMove={(event) => onHoverMove?.(event)}
      onMouseLeave={() => onHoverEnd?.()}
    >
      {item.iconPath ? <img src={assetPath(item.iconPath)} alt="" draggable={false} /> : <span>?</span>}
      {twoHanded ? <span className="gear-icon-2h">2H</span> : null}
      {level != null ? <em>{level}</em> : null}
    </button>
  );
}

function EquipmentSlot({
  slotKey,
  value,
  item,
  missingOwned,
  isDropTarget,
  isSelected = false,
  isGhost = false,
  ghostHint = "",
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  onContextMenu,
  onDragStartItem,
  onDragEndItem,
  onHoverStart,
  onHoverMove,
  onHoverEnd
}) {
  const slot = getSlotDefinition(slotKey);
  const displayRarity = item
    ? isWeaponEquipmentSlot(slotKey)
      ? resolveUsedRarity(value, item)
      : getDefaultUsedRarity(item)
    : null;

  return (
    <div
      className={`eq-slot ${item ? "has-item" : ""} ${missingOwned ? "is-missing" : ""} ${isDropTarget ? "is-drop" : ""} ${isGhost ? "is-ghost" : ""} ${isSelected ? "is-selected" : ""}`}
      onDragOver={isGhost ? undefined : onDragOver}
      onDragLeave={isGhost ? undefined : onDragLeave}
      onDrop={isGhost ? undefined : onDrop}
    >
      <button
        type="button"
        className={`eq-slot-hit ${displayRarity ? rarityClass(displayRarity) : ""}`}
        title={
          isGhost
            ? ghostHint
            : item
              ? "Botão direito para desequipar"
              : `${slot?.label} · clique para filtrar inventário`
        }
        onClick={onClick}
        onContextMenu={(event) => {
          if (!item || isGhost) {
            return;
          }
          event.preventDefault();
          onContextMenu?.(event);
        }}
        draggable={Boolean(item) && !isGhost}
        onDragStart={(event) => {
          if (!item || isGhost) {
            return;
          }
          onDragStartItem(event);
        }}
        onDragEnd={onDragEndItem}
        onMouseEnter={(event) => {
          if (item) {
            onHoverStart?.(item, event, {
              usedLevel: resolveUsedLevel(value, item),
              usedRarity: displayRarity,
              usedUpgradeLevel: isWeaponEquipmentSlot(slotKey)
                ? resolveUsedUpgradeLevel(value, displayRarity)
                : 0,
              slotValue: value,
              adornments: value?.adornments,
              slotKey,
              owned: !missingOwned
            });
          }
        }}
        onMouseMove={(event) => {
          if (item) {
            onHoverMove?.(event);
          }
        }}
        onMouseLeave={() => onHoverEnd?.()}
      >
        {item?.iconPath ? (
          <img src={assetPath(item.iconPath)} alt="" draggable={false} />
        ) : (
          <span className="eq-slot-empty">{slot?.shortLabel ?? "?"}</span>
        )}
        {item && resolveUsedLevel(value, item) != null ? (
          <em className="eq-slot-level">{resolveUsedLevel(value, item)}</em>
        ) : null}
        {item &&
        isWeaponEquipmentSlot(slotKey) &&
        resolveUsedUpgradeLevel(value, displayRarity) > 0 ? (
          <em className="eq-slot-upgrade">+{resolveUsedUpgradeLevel(value, displayRarity)}</em>
        ) : null}
        {isGhost ? <span className="eq-slot-ghost-badge">2H</span> : null}
      </button>
    </div>
  );
}

function ItemConfigCard({
  slotKey,
  item,
  value,
  note,
  augmentOptions = [],
  characterClassName = "",
  onChangeLevel,
  onChangeRarity,
  onChangeUpgradeLevel,
  onChangeAdornment,
  onClose
}) {
  const slot = getSlotDefinition(slotKey);
  const adornmentFields = getAdornmentFieldsForSlot(slotKey);
  const adornments = resolveSlotAdornments(slotKey, value.adornments);
  const crafted = isFixedCraftLevelItem(item);
  const isWeaponSlot = isWeaponEquipmentSlot(slotKey);
  const showRarity = isWeaponSlot && !crafted;
  const showUpgrades = isWeaponSlot && !crafted;
  const defaultLevel = getDefaultUsedLevel(item);
  const catalogRarity = getItemCatalogRarity(item);
  const lockedRarity = getDefaultUsedRarity(item);
  const usedRarity = showRarity ? resolveUsedRarity(value, item) : lockedRarity;
  const maxUpgrades = getMaxWeaponUpgrades(usedRarity);
  const usedUpgradeLevel = resolveUsedUpgradeLevel(value, usedRarity);
  const effectiveLevel = resolveUsedLevel(value, item);
  const liveStats = resolveItemStats(item, {
    usedLevel: effectiveLevel,
    usedRarity,
    usedUpgradeLevel: showUpgrades ? usedUpgradeLevel : 0,
    slotValue: value,
    characterClassName,
    slotKey
  });
  const adornmentStatBlocks = getSelectedAdornmentBlocks(slotKey, adornments, augmentOptions);
  const levelScales = Boolean(item?.statsScale) || (Array.isArray(item?.stats) && item.stats.length > 0) || Boolean(item?.statsByClass);
  const shopDefault = isShopPurchasableItem(item);
  const upgradeBonusBlock = showUpgrades
    ? getWeaponUpgradeBonusBlock(item, { rarity: usedRarity, upgradeLevel: usedUpgradeLevel })
    : null;
  const extraStatBlocks = upgradeBonusBlock ? [upgradeBonusBlock, ...adornmentStatBlocks] : adornmentStatBlocks;

  return (
    <section className="eq-item-config" aria-label="Configurar item do Build">
      <div className="eq-bag-header">
        <div className="eq-bag-title-row">
          <h3>Item · {slot?.label ?? "Slot"}</h3>
          <div className="eq-item-config-header-actions">
            <button type="button" className="build-lab-ghost-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <p>
          {isWeaponSlot
            ? "Ajuste level, rarity e level up desta arma."
            : adornmentFields.length > 0
              ? "Ajuste o level e os adereços deste slot."
              : "Ajuste o level usado deste equipamento."}
        </p>
      </div>

      <div className="eq-item-config-body">
        <div className="eq-item-config-identity">
          {item?.iconPath ? <img src={assetPath(item.iconPath)} alt="" /> : null}
          <div>
            <strong>{item?.name ?? "Item"}</strong>
            <span>
              <span className={rarityClass(showRarity ? usedRarity : catalogRarity || lockedRarity)}>
                {showRarity ? usedRarity : catalogRarity || lockedRarity || "Unknown"}
              </span>
              {showUpgrades && usedUpgradeLevel > 0 ? ` · +${usedUpgradeLevel}` : ""}
              {isTwoHandedWeapon(item) ? " · 2H" : ""}
            </span>
          </div>
        </div>

        {note ? <p className="eq-level-note">{note}</p> : null}

        {liveStats.length > 0 ? (
          <ul className="eq-item-config-stats">
            {liveStats.map((stat) => (
              <li key={`${stat.label}-${stat.value}`}>{formatStatLine(stat)}</li>
            ))}
          </ul>
        ) : null}

        <AdornmentStatBlocks blocks={extraStatBlocks} />

        <div className="eq-item-config-fields">
          <label className="eq-item-config-slider-field">
            <span className="eq-item-config-field-head">
              Used level
              <strong>{effectiveLevel ?? defaultLevel}</strong>
            </span>
            <input
              type="range"
              min="1"
              max={MAX_DROP_ITEM_LEVEL}
              step="1"
              value={Math.min(effectiveLevel ?? defaultLevel, MAX_DROP_ITEM_LEVEL)}
              disabled={crafted}
              aria-label="Used level"
              onChange={(event) => onChangeLevel(event.target.value)}
            />
            <small>
              {crafted
                ? "Item craftado: level fixo"
                : shopDefault
                  ? `Default loja/starter: ${defaultLevel}`
                  : `Default drop/max: ${defaultLevel}`}
              {!crafted && levelScales ? " · attrs escalam com level" : ""}
              {!crafted && !levelScales ? " · attrs sem escala no DB" : ""}
            </small>
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
                    onClick={() => onChangeRarity(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <small>Default do catálogo: {catalogRarity || "Rare"}</small>
            </div>
          ) : null}

          {showUpgrades ? (
            <label className="eq-item-config-slider-field">
              <span className="eq-item-config-field-head">
                Level up
                <strong>
                  +{usedUpgradeLevel} / {maxUpgrades}
                </strong>
              </span>
              <input
                type="range"
                min="0"
                max={maxUpgrades}
                step="1"
                value={Math.min(usedUpgradeLevel, maxUpgrades)}
                aria-label="Level up"
                onChange={(event) => onChangeUpgradeLevel(Number(event.target.value))}
              />
              <small>Max por raridade: Rare 3 · Epic 4 · Legendary 5</small>
            </label>
          ) : null}

          {adornmentFields.map((field) => {
            const options = augmentOptions
              .filter((augment) => augmentMatchesAdornmentField(augment, field.key))
              .filter((augment) =>
                field.key === "sigil"
                  ? augmentMatchesCharacterClass(augment, characterClassName)
                  : true
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
                  onChange={(event) => onChangeAdornment(field.key, event.target.value)}
                >
                  <option value="">Nenhum</option>
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
                      ? `3 opções de ${characterClassName}`
                      : "Selecione do catálogo"
                    : "Selecione do catálogo"}
                </small>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function EquipmentPaperDoll({
  character,
  equipment,
  catalogs,
  ownedIds,
  itemsById,
  augments = [],
  onChangeSlot,
  onReplaceEquipment
}) {
  const [bagFilter, setBagFilter] = useState("all");
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [rareAndUpOnly, setRareAndUpOnly] = useState(false);
  const [slotFilter, setSlotFilter] = useState("");
  const [dropSlot, setDropSlot] = useState("");
  const [editingSlot, setEditingSlot] = useState("");
  const [dragging, setDragging] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const slotByKey = useMemo(
    () => Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.key, slot])),
    []
  );

  const equippedIds = useMemo(() => {
    const counts = new Map();
    for (const [slotKey, slot] of Object.entries(equipment)) {
      if (!slot?.itemId) {
        continue;
      }
      const list = counts.get(slot.itemId) ?? [];
      list.push(slotKey);
      counts.set(slot.itemId, list);
    }

    const fullyEquipped = new Set();
    for (const [itemId, slotKeys] of counts.entries()) {
      const item = itemsById.get(itemId);
      if (itemAllowsDuplicateEquip(item)) {
        const onBothRings = slotKeys.includes("ring1") && slotKeys.includes("ring2");
        if (onBothRings) {
          fullyEquipped.add(itemId);
        }
        continue;
      }

      const inArsenal = slotKeys.includes("arsenal");
      const inMainOrOff = slotKeys.includes("weapon") || slotKeys.includes("secondaryWeapon");
      if (inArsenal || inMainOrOff) {
        // Arsenal can share the same weapon/shield id with Main or Off Hand.
        if (inArsenal && inMainOrOff) {
          fullyEquipped.add(itemId);
        }
        const otherSlots = slotKeys.filter(
          (key) => key !== "arsenal" && key !== "weapon" && key !== "secondaryWeapon"
        );
        if (otherSlots.length) {
          fullyEquipped.add(itemId);
        }
        continue;
      }

      fullyEquipped.add(itemId);
    }
    return fullyEquipped;
  }, [equipment, itemsById]);

  function clearDuplicateOccupancy(nextEquipment, targetSlotKey, itemId, item, ignoreSlotKeys = []) {
    const ignored = new Set(ignoreSlotKeys);
    for (const [key, value] of Object.entries(nextEquipment)) {
      if (key === targetSlotKey || ignored.has(key) || value?.itemId !== itemId) {
        continue;
      }
      if (slotsAllowDuplicateItem(key, targetSlotKey, item)) {
        continue;
      }
      nextEquipment[key] = createEmptyEquipmentSlot();
    }
  }

  const mainHandValue = equipment.weapon ?? createEmptyEquipmentSlot();
  const mainHandItem = mainHandValue.itemId ? itemsById.get(mainHandValue.itemId) : null;
  const mainHandIsTwoHanded = isTwoHandedWeapon(mainHandItem);

  const slotFilterDef = slotFilter ? slotByKey[slotFilter] : null;

  const bagItems = useMemo(() => {
    const collections = slotFilterDef
      ? [slotFilterDef.collectionKey]
      : bagFilter === "all"
        ? ["weapons", "armor", "jewellery"]
        : bagFilter === "weapons"
          ? ["weapons"]
          : bagFilter === "armor"
            ? ["armor"]
            : ["jewellery"];

    const items = [];
    for (const collectionKey of collections) {
      const catalog = catalogs[collectionKey] ?? [];
      const owned = ownedIds[collectionKey] ?? new Set();
      const filtered =
        collectionKey === "jewellery"
          ? catalog
          : filterItemsByCharacterClass(catalog, character?.className);

      for (const item of filtered) {
        const withCollection = { ...item, collectionKey };
        if (slotFilter && !itemFitsSlot(withCollection, slotFilter)) {
          continue;
        }

        const isOwned = owned.has(item.id);
        if (ownedOnly && !isOwned) {
          continue;
        }
        if (rareAndUpOnly && !isRareOrAbove(item)) {
          continue;
        }
        items.push({ ...withCollection, isOwned });
      }
    }

    return sortItems(items);
  }, [bagFilter, catalogs, ownedIds, character?.className, ownedOnly, rareAndUpOnly, slotFilter, slotFilterDef]);

  function selectSlot(slotKey, { openEditor = false } = {}) {
    setSlotFilter(slotKey);
    if (openEditor) {
      setEditingSlot(slotKey);
    }
  }

  function clearSlotFilter() {
    setSlotFilter("");
  }

  function showItemTooltip(item, event, extras = {}) {
    setTooltip({
      item,
      extras: {
        ...extras,
        characterClassName: character?.className,
        augments
      },
      x: event.clientX,
      y: event.clientY
    });
  }

  function moveItemTooltip(event) {
    setTooltip((current) =>
      current
        ? {
            ...current,
            x: event.clientX,
            y: event.clientY
          }
        : null
    );
  }

  function hideItemTooltip() {
    setTooltip(null);
  }

  function clearSlot(slotKey) {
    onChangeSlot(slotKey, createEmptyEquipmentSlot());
  }

  function beginDrag(payload) {
    setDragging(payload);
  }

  function endDrag() {
    setDragging(null);
    setDropSlot("");
  }

  function canDropOnSlot(slotKey, payload = dragging) {
    if (!payload?.itemId) {
      return false;
    }

    if (slotKey === "secondaryWeapon" && isTwoHandedWeapon(mainHandItem)) {
      return false;
    }

    const item = itemsById.get(payload.itemId);
    if (!item) {
      return false;
    }

    return itemFitsSlot({ ...item, collectionKey: item.collectionKey }, slotKey);
  }

  function finalizeEquipment(nextEquipment) {
    const next = { ...nextEquipment };
    const mainItem = next.weapon?.itemId ? itemsById.get(next.weapon.itemId) : null;
    const offItem = next.secondaryWeapon?.itemId ? itemsById.get(next.secondaryWeapon.itemId) : null;

    if (isTwoHandedWeapon(mainItem)) {
      next.secondaryWeapon = createEmptyEquipmentSlot();
    } else if (offItem && !isOffHandOnlyWeapon(offItem)) {
      // Off Hand only accepts shields.
      next.secondaryWeapon = createEmptyEquipmentSlot();
    }

    return next;
  }

  function makeEquippedSlot(itemId, usedLevel, usedRarity, usedUpgradeLevel = 0, slotKey = "") {
    const item = itemsById.get(itemId);
    const allowWeaponExtras = !slotKey || isWeaponEquipmentSlot(slotKey);
    const rarity = allowWeaponExtras
      ? usedRarity ?? (item ? getDefaultUsedRarity(item) : null)
      : item
        ? getDefaultUsedRarity(item)
        : null;
    return {
      itemId,
      usedLevel: usedLevel ?? getDefaultUsedLevel(item),
      usedRarity: rarity,
      usedUpgradeLevel: allowWeaponExtras
        ? resolveUsedUpgradeLevel({ usedUpgradeLevel }, rarity)
        : 0,
      adornments: createEmptyAdornments()
    };
  }

  function handleSlotDrop(slotKey, event) {
    event.preventDefault();
    const payload = readDragPayload(event) || dragging;
    endDrag();

    if (!payload?.itemId) {
      return;
    }

    if (payload.source === "slot" && payload.slotKey === slotKey) {
      return;
    }

    if (slotKey === "secondaryWeapon" && isTwoHandedWeapon(mainHandItem)) {
      return;
    }

    const item = itemsById.get(payload.itemId);
    if (!item || !itemFitsSlot({ ...item, collectionKey: item.collectionKey }, slotKey)) {
      return;
    }

    const target = equipment[slotKey] ?? createEmptyEquipmentSlot();
    const nextEquipment = { ...equipment };

    if (payload.source === "slot" && payload.slotKey) {
      const movingFrom = payload.slotKey;
      const targetItem = target.itemId ? itemsById.get(target.itemId) : null;
      const canSwap =
        !target.itemId ||
        (targetItem && itemFitsSlot({ ...targetItem, collectionKey: targetItem.collectionKey }, movingFrom));

      nextEquipment[slotKey] = {
        itemId: payload.itemId,
        usedLevel: payload.usedLevel ?? getDefaultUsedLevel(item),
        usedRarity: isWeaponEquipmentSlot(slotKey)
          ? payload.usedRarity ?? getDefaultUsedRarity(item)
          : getDefaultUsedRarity(item),
        usedUpgradeLevel: isWeaponEquipmentSlot(slotKey)
          ? resolveUsedUpgradeLevel(
              { usedUpgradeLevel: payload.usedUpgradeLevel },
              payload.usedRarity ?? getDefaultUsedRarity(item)
            )
          : 0,
        adornments: payload.adornments ?? createEmptyAdornments()
      };

      if (canSwap && target.itemId) {
        nextEquipment[movingFrom] = { ...target };
      } else {
        nextEquipment[movingFrom] = createEmptyEquipmentSlot();
      }

      clearDuplicateOccupancy(nextEquipment, slotKey, payload.itemId, item, [movingFrom]);

      onReplaceEquipment(finalizeEquipment(nextEquipment));
      return;
    }

    clearDuplicateOccupancy(nextEquipment, slotKey, payload.itemId, item);

    nextEquipment[slotKey] = makeEquippedSlot(
      payload.itemId,
      payload.usedLevel,
      payload.usedRarity,
      payload.usedUpgradeLevel,
      slotKey
    );
    onReplaceEquipment(finalizeEquipment(nextEquipment));
  }

  function handleBagDrop(event) {
    event.preventDefault();
    const payload = readDragPayload(event) || dragging;
    endDrag();
    if (payload?.source === "slot" && payload.slotKey) {
      clearSlot(payload.slotKey);
      if (editingSlot === payload.slotKey) {
        setEditingSlot("");
      }
    }
  }

  function renderSlotColumn(slotKeys) {
    return (
      <div className="eq-slot-column">
        {slotKeys.map((slotKey) => {
          const isOffHandGhost = slotKey === "secondaryWeapon" && mainHandIsTwoHanded;
          const value = isOffHandGhost
            ? mainHandValue
            : (equipment[slotKey] ?? createEmptyEquipmentSlot());
          const item = isOffHandGhost
            ? mainHandItem
            : value.itemId
              ? itemsById.get(value.itemId)
              : null;
          const owned = ownedIds[slotByKey[slotKey].collectionKey] ?? new Set();
          const missingOwned = Boolean(value.itemId && item && !owned.has(value.itemId));

          return (
            <EquipmentSlot
              key={slotKey}
              slotKey={slotKey}
              value={value}
              item={item}
              missingOwned={missingOwned}
              isDropTarget={!isOffHandGhost && dropSlot === slotKey}
              isSelected={!isOffHandGhost && slotFilter === slotKey}
              isGhost={isOffHandGhost}
              ghostHint={
                mainHandIsTwoHanded
                  ? `${mainHandItem?.name ?? "Two-handed"} também ocupa o Off Hand. Altere na Main Hand.`
                  : "Off Hand: apenas escudos (com arma 1H na Main Hand)."
              }
              onDragOver={(event) => {
                if (!canDropOnSlot(slotKey)) {
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropSlot(slotKey);
              }}
              onDragLeave={() => setDropSlot((current) => (current === slotKey ? "" : current))}
              onDrop={(event) => handleSlotDrop(slotKey, event)}
              onClick={() => {
                if (isOffHandGhost) {
                  selectSlot("weapon", { openEditor: true });
                  return;
                }
                selectSlot(slotKey, { openEditor: Boolean(value.itemId) });
              }}
              onContextMenu={() => {
                if (isOffHandGhost) {
                  return;
                }
                hideItemTooltip();
                clearSlot(slotKey);
                if (editingSlot === slotKey) {
                  setEditingSlot("");
                }
              }}
              onDragStartItem={(event) => {
                hideItemTooltip();
                const payload = {
                  source: "slot",
                  slotKey,
                  itemId: value.itemId,
                  usedLevel: value.usedLevel,
                  usedRarity: value.usedRarity,
                  usedUpgradeLevel: value.usedUpgradeLevel,
                  adornments: value.adornments
                };
                writeDragPayload(event, payload);
                beginDrag(payload);
              }}
              onDragEndItem={endDrag}
              onHoverStart={showItemTooltip}
              onHoverMove={moveItemTooltip}
              onHoverEnd={hideItemTooltip}
            />
          );
        })}
      </div>
    );
  }

  const editingValue = editingSlot ? equipment[editingSlot] : null;
  const editingItem = editingValue?.itemId ? itemsById.get(editingValue.itemId) : null;

  return (
    <section className="eq-screen">
      <section className="eq-build-panel">
        <div className="eq-bag-header">
          <h3>Build</h3>
        </div>

        <div className="eq-paper-doll">
          {renderSlotColumn(EQUIPMENT_LAYOUT.left)}
          {renderSlotColumn(EQUIPMENT_LAYOUT.right)}
          <div className="eq-weapon-column">
            <span className="eq-weapon-title">Weapons</span>
            {renderSlotColumn(EQUIPMENT_LAYOUT.weapons)}
          </div>
        </div>
      </section>

      <section className="eq-bag" onDragOver={(event) => event.preventDefault()} onDrop={handleBagDrop}>
        <div className="eq-bag-header">
          <div className="eq-bag-title-row">
            <h3>Inventário{ownedOnly ? " (owned)" : ""}</h3>
            <div className="eq-bag-toggles">
              <button
                type="button"
                className={`eq-owned-toggle ${ownedOnly ? "is-on" : ""}`}
                aria-pressed={ownedOnly}
                onClick={() => setOwnedOnly((current) => !current)}
                title={ownedOnly ? "Mostrando só owned. Clique para ver todos." : "Mostrando todos. Clique para filtrar owned."}
              >
                Owned {ownedOnly ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                className={`eq-owned-toggle eq-rarity-toggle ${rareAndUpOnly ? "is-on" : ""}`}
                aria-pressed={rareAndUpOnly}
                onClick={() => setRareAndUpOnly((current) => !current)}
                title={
                  rareAndUpOnly
                    ? "Mostrando Rare+. Clique para ver todas as raridades."
                    : "Clique para mostrar só Rare (azul) ou superior."
                }
              >
                Rare+ {rareAndUpOnly ? "ON" : "OFF"}
              </button>
            </div>
          </div>
          <p>
            Arraste o ícone para o slot do Build. Clique no equipado para configurar. Solte aqui para
            desequipar.
          </p>
        </div>
        <div className="eq-bag-filters">
          {[
            ["all", "Todos"],
            ["weapons", "Armas"],
            ["armor", "Roupa"],
            ["jewellery", "Jewellery"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={!slotFilter && bagFilter === key ? "active" : ""}
              onClick={() => {
                clearSlotFilter();
                setBagFilter(key);
              }}
            >
              {label}
            </button>
          ))}
          {slotFilterDef ? (
            <button type="button" className="eq-slot-filter-chip active" onClick={clearSlotFilter}>
              {slotFilterDef.label} ✕
            </button>
          ) : null}
        </div>
        <div className="eq-bag-scroll">
          <div className="eq-bag-grid">
            {bagItems.length === 0 ? (
              <p className="build-equipment-empty">
                {slotFilterDef
                  ? `Nenhum item para ${slotFilterDef.label}.`
                  : ownedOnly
                    ? "Nenhum item owned nesta categoria."
                    : "Nenhum item nesta categoria."}
              </p>
            ) : (
              bagItems.map((item) => (
                <GearIcon
                  key={item.id}
                  item={item}
                  level={getItemIconLevel(item)}
                  draggable
                  dimmed={equippedIds.has(item.id)}
                  notOwned={!item.isOwned}
                  onHoverStart={(hoveredItem, event) =>
                    showItemTooltip(hoveredItem, event, {
                      owned: item.isOwned,
                      usedLevel: getDefaultUsedLevel(hoveredItem),
                      usedRarity: getDefaultUsedRarity(hoveredItem),
                      usedUpgradeLevel: 0
                    })
                  }
                  onHoverMove={moveItemTooltip}
                  onHoverEnd={hideItemTooltip}
                  onDragStart={(event) => {
                    hideItemTooltip();
                    const payload = {
                      source: "inventory",
                      itemId: item.id,
                      usedLevel: getDefaultUsedLevel(item),
                      usedRarity: getDefaultUsedRarity(item),
                      usedUpgradeLevel: 0
                    };
                    writeDragPayload(event, payload);
                    beginDrag(payload);
                  }}
                  onDragEnd={endDrag}
                />
              ))
            )}
          </div>
        </div>
      </section>

      {editingSlot && editingItem ? (
        <ItemConfigCard
          slotKey={editingSlot}
          item={editingItem}
          value={editingValue}
          augmentOptions={augments}
          characterClassName={character?.className}
          note={
            editingSlot === "weapon" && isTwoHandedWeapon(editingItem)
              ? "Arma de duas mãos: também ocupa o Off Hand. Faça alterações pela Main Hand."
              : ""
          }
          onClose={() => setEditingSlot("")}
          onChangeLevel={(raw) => {
            if (isFixedCraftLevelItem(editingItem)) {
              onChangeSlot(editingSlot, {
                ...editingValue,
                usedLevel: getDefaultUsedLevel(editingItem)
              });
              return;
            }
            if (raw === "") {
              onChangeSlot(editingSlot, { ...editingValue, usedLevel: getDefaultUsedLevel(editingItem) });
              return;
            }
            const number = Number(raw);
            if (Number.isFinite(number)) {
              onChangeSlot(editingSlot, {
                ...editingValue,
                usedLevel: clampItemLevel(number)
              });
            }
          }}
          onChangeRarity={(rarity) => {
            if (!isWeaponEquipmentSlot(editingSlot)) {
              return;
            }
            const nextRarity = rarity || getDefaultUsedRarity(editingItem);
            onChangeSlot(editingSlot, {
              ...editingValue,
              usedRarity: nextRarity,
              usedUpgradeLevel: resolveUsedUpgradeLevel(editingValue, nextRarity)
            });
          }}
          onChangeUpgradeLevel={(upgradeLevel) => {
            if (!isWeaponEquipmentSlot(editingSlot)) {
              return;
            }
            const rarity = resolveUsedRarity(editingValue, editingItem);
            onChangeSlot(editingSlot, {
              ...editingValue,
              usedUpgradeLevel: resolveUsedUpgradeLevel({ usedUpgradeLevel: upgradeLevel }, rarity)
            });
          }}
          onChangeAdornment={(key, text) => {
            onChangeSlot(editingSlot, {
              ...editingValue,
              adornments: {
                ...(editingValue.adornments ?? createEmptyAdornments()),
                [key]: text
              }
            });
          }}
        />
      ) : null}

      <ItemHoverTooltip tooltip={tooltip} />
    </section>
  );
}
