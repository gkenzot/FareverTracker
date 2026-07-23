import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { aggregateBuildAttributes } from "./aggregateBuildAttributes";
import { BuildAttributesPanel } from "./BuildAttributesPanel";
import { BuildCharts, SecondaryAnalysisCharts } from "./BuildCharts";
import { buildDamageStatsForSet, formatDamageProfileLabel, formatDamageProfileSource } from "./buildDamageStats";
import { ClassSkillsPanel, TalentsPanel } from "./ClassSkillsPanel";
import { ArsenalPanel } from "./ArsenalPanel";
import { EquipmentPaperDoll } from "./EquipmentLoadout";
import {
  CLASS_SKILL_MAX_ACTIVE,
  isClassSignatureSkill,
  isLevel30Skill,
  resolveToggleableClassSkillIds
} from "./classSkillLoadout";
import {
  MAX_BUILD_SETS,
  TALENT_POINTS_AT_LEVEL_25,
  promoteCharacterBuildLevels
} from "./buildSlots";
import { DEFAULT_BUILD, DEFENSE_MODIFIER, calculateBuildDamage } from "./damageFormulas";
import {
  BOSS_LEVEL_MAX,
  BOSS_LEVEL_MIN,
  DEFAULT_BOSS_LEVEL,
  bossArmorAtLevel,
  bossNamesAtLevel
} from "./enemyDefensePresets";
import { useCharacterBuild, useOwnedGearCatalog } from "./useCharacterBuild";
import { analyzeWeaponKit, DEFAULT_KIT_ASSUMPTIONS } from "./weaponKitAnalysis";
import { WeaponsAnalysisPanel } from "./WeaponsAnalysisPanel";

const DEFAULT_SKILL_PARAMS = {
  modifier: DEFAULT_BUILD.modifier
};

const SKILL_INPUT_FIELDS = [{ key: "modifier", label: "Skill modifier (coeficiente)", kind: "percent" }];

function formatDamage(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const pct = Math.round(value * 100);
  const signed = pct > 0 ? "+" : "";
  return `${signed}${pct}%`;
}

function formatPlainPercent(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

function toSkillDisplayValue(key, value) {
  const number = Number(value) || 0;
  return Number((number * 100).toFixed(4));
}

function fromSkillDisplayValue(key, raw) {
  const number = Number(raw);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return number / 100;
}

function MultiStatRow({ label, values, format = formatDamage, emphasize = false }) {
  const numbers = values.map((value) => Number(value));
  const best = Math.max(...numbers.filter((value) => Number.isFinite(value)));

  return (
    <div
      className={`build-lab-stat build-lab-stat--multi ${emphasize ? "build-lab-stat--emphasize" : ""}`}
      style={{ "--build-cols": values.length }}
    >
      <span>{label}</span>
      {values.map((value, index) => {
        const number = numbers[index];
        const isBest =
          Number.isFinite(number) && number === best && numbers.filter((n) => n === best).length === 1;
        return (
          <strong key={index} className={isBest ? "is-better" : ""}>
            {format(value, index)}
          </strong>
        );
      })}
    </div>
  );
}

function SkillParamsEditor({
  skillParams,
  onChange,
  kitModifier = null,
  useKitModifier = true,
  onToggleKitModifier
}) {
  const kitPercent =
    kitModifier != null && Number.isFinite(kitModifier) ? Number((kitModifier * 100).toFixed(4)) : null;
  const hasKit = kitPercent != null;
  const recommendedPercent = hasKit
    ? kitPercent
    : toSkillDisplayValue("modifier", DEFAULT_SKILL_PARAMS.modifier);
  const collapsed = Boolean(useKitModifier);

  function setRecommended(checked) {
    onToggleKitModifier?.(checked);
    if (checked && !hasKit) {
      onChange("modifier", DEFAULT_SKILL_PARAMS.modifier);
    }
  }

  return (
    <section className={`build-lab-column${collapsed ? " is-collapsed" : ""}`}>
      <div className="build-lab-column-header">
        <h2>Skill</h2>
        <label className="weapon-analysis-check weapon-analysis-check--recommended">
          <input
            type="checkbox"
            checked={useKitModifier}
            onChange={(event) => setRecommended(event.target.checked)}
          />
          <span>Usar recomendados</span>
        </label>
      </div>
      {collapsed ? (
        <p className="build-lab-column-note build-lab-column-note--collapsed">
          {hasKit
            ? `Modifier do kit ativo · ${recommendedPercent}%`
            : `Modifier padrão · ${recommendedPercent}%`}
          . Desmarque para ajustar.
        </p>
      ) : (
        <>
          <p className="build-lab-column-note">
            Coeficiente da skill simulada. Com kit parseável, o recomendado usa o modifier do Weapons
            analysis. Physical → Armor Pen, Magic → Magic Pen. Weapon Damage vem da main-hand.
          </p>
          <div className="build-lab-fields">
            {hasKit ? (
              <p className="build-lab-column-note build-lab-column-note--hint">
                Kit sugere {kitPercent}% — marque Usar recomendados para aplicar.
              </p>
            ) : null}
            {SKILL_INPUT_FIELDS.map((field) => {
              const displayValue = toSkillDisplayValue(field.key, skillParams[field.key]);
              return (
                <label className="build-lab-field" key={field.key}>
                  <span>
                    {field.label}
                    {field.kind === "percent" ? " (%)" : ""}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={displayValue}
                    onChange={(event) =>
                      onChange(field.key, fromSkillDisplayValue(field.key, event.target.value))
                    }
                  />
                </label>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function EnemyDefensePicker({
  bossLevel,
  enemyDefense,
  customMode,
  useRecommended = true,
  onToggleRecommended,
  onBossLevelChange,
  onToggleCustom,
  onCustomDefense
}) {
  const names = bossNamesAtLevel(bossLevel);
  const estimated = bossArmorAtLevel(bossLevel);
  const recommendedArmor = bossArmorAtLevel(DEFAULT_BOSS_LEVEL);
  const collapsed = Boolean(useRecommended);

  return (
    <section
      className={`build-lab-enemy${collapsed ? " is-collapsed" : ""}`}
      aria-label="Boss level"
    >
      <div className="build-lab-column-header">
        <h2>Boss level</h2>
        <label className="weapon-analysis-check weapon-analysis-check--recommended">
          <input
            type="checkbox"
            checked={useRecommended}
            onChange={(event) => onToggleRecommended?.(event.target.checked)}
          />
          <span>Usar recomendados</span>
        </label>
      </div>
      {collapsed ? (
        <p className="build-lab-column-note build-lab-column-note--collapsed">
          Boss level {DEFAULT_BOSS_LEVEL} · Armor {recommendedArmor}. Desmarque para ajustar.
        </p>
      ) : (
        <>
          <div className="build-lab-boss-tools">
            <p className="build-lab-column-note">Armadura do boss (Calculator): level × 75</p>
            <button
              type="button"
              className={`build-lab-boss-chip ${customMode ? "active" : ""}`}
              onClick={onToggleCustom}
              aria-pressed={customMode}
            >
              Custom
            </button>
          </div>

          {customMode ? (
            <label className="build-lab-field build-lab-field--inline">
              <span>Custom defense</span>
              <input
                type="number"
                step="1"
                min="0"
                value={enemyDefense}
                onChange={(event) => onCustomDefense(Number(event.target.value) || 0)}
              />
            </label>
          ) : (
            <div className="build-lab-boss-level">
              <div className="build-lab-boss-level-head">
                <span>
                  Level <strong>{bossLevel}</strong>
                </span>
                <span>
                  Armor <strong>{estimated}</strong>
                </span>
              </div>
              <input
                type="range"
                className="build-lab-boss-slider"
                min={BOSS_LEVEL_MIN}
                max={BOSS_LEVEL_MAX}
                step={1}
                value={bossLevel}
                onChange={(event) => onBossLevelChange(Number(event.target.value))}
                aria-label="Boss level"
              />
              {names.length > 0 ? (
                <p className="build-lab-enemy-current">
                  Encontros anotados nesse level: {names.join(", ")}
                </p>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AttributeComparative({ builds, damageResults, baselineLabel }) {
  return (
    <section className="build-lab-results" aria-label="Attribute comparative">
      <div className="build-lab-column-header">
        <h2>Attribute comparative</h2>
      </div>
      <p className="build-lab-column-note">
        Average Damage = (share Physical × dano com Armor Pen) + (share Magic × dano com Magic Pen),
        conforme o kit de cada build.
      </p>
      <div className="build-lab-stat build-lab-stat--header build-lab-stat--multi" style={{ "--build-cols": builds.length }}>
        <span>Stat</span>
        {builds.map((entry) => (
          <strong key={entry.key}>Build {entry.label}</strong>
        ))}
      </div>
      <MultiStatRow
        label="Normal Hit"
        values={damageResults.map((entry) => entry.result.normalHit)}
      />
      <MultiStatRow
        label="Critical Hit"
        values={damageResults.map((entry) => entry.result.criticalHit)}
      />
      <MultiStatRow
        label="Average Damage"
        values={damageResults.map((entry) => entry.result.averageDamage)}
        emphasize
      />
      <MultiStatRow
        label="Avg · Physical (AP)"
        values={damageResults.map((entry) => entry.result.byBucket?.physical?.averageDamage)}
        format={(value, index) => {
          const share = builds[index]?.stats?.damageProfile?.physicalShare;
          const shown = formatDamage(value);
          if (!Number.isFinite(share) || share <= 0) {
            return "—";
          }
          return `${shown} · ${Math.round(share * 100)}% kit`;
        }}
      />
      <MultiStatRow
        label="Avg · Magic (MP)"
        values={damageResults.map((entry) => entry.result.byBucket?.magic?.averageDamage)}
        format={(value, index) => {
          const share = builds[index]?.stats?.damageProfile?.magicShare;
          const shown = formatDamage(value);
          if (!Number.isFinite(share) || share <= 0) {
            return "—";
          }
          return `${shown} · ${Math.round(share * 100)}% kit`;
        }}
      />
      {builds.length > 1 ? (
        <MultiStatRow
          label={`Gain vs Build ${baselineLabel}`}
          values={damageResults.map((entry, index) => (index === 0 ? 0 : entry.gainVsBaseline))}
          format={formatPercent}
          emphasize
        />
      ) : null}
      <MultiStatRow
        label="Weapon Damage"
        values={builds.map((entry) => entry.stats.weaponDamage)}
        format={(value, index) => {
          const name = builds[index]?.stats?._meta?.weaponName;
          const shown = formatDamage(value);
          return name ? `${shown} · ${name}` : shown;
        }}
      />
      <MultiStatRow
        label="Attr 1 (class)"
        values={builds.map((entry) => entry.stats.attribute1)}
        format={(value, index) => {
          const meta = builds[index]?.stats?._meta;
          const label = meta?.attribute1Label ? `${meta.attribute1Label} ` : "";
          return `${label}${formatDamage(value)}`;
        }}
      />
      <MultiStatRow
        label="Attr 2 (set)"
        values={builds.map((entry) => entry.stats.attribute2)}
        format={(value, index) => {
          const meta = builds[index]?.stats?._meta;
          const label = meta?.attribute2Label ? `${meta.attribute2Label} ` : "";
          return `${label}${formatDamage(value)}`;
        }}
      />
      <MultiStatRow
        label="Fervor"
        values={builds.map((entry) => entry.stats.fervor)}
        format={formatPlainPercent}
      />
      <MultiStatRow
        label="Mastery"
        values={builds.map((entry) => entry.stats.mastery)}
        format={formatPlainPercent}
      />
      <MultiStatRow
        label="Crit chance"
        values={builds.map((entry) => entry.stats.criticalChance)}
        format={formatPlainPercent}
      />
      <MultiStatRow
        label="Crit bonus"
        values={builds.map((entry) => entry.stats.criticalBonus)}
        format={(value) => (Number.isFinite(value) ? `${Math.round(value * 100)}%` : "—")}
      />
      <MultiStatRow
        label="Armor Pen (Physical)"
        values={builds.map((entry) => entry.stats.armorPenetration)}
        format={formatPlainPercent}
      />
      <MultiStatRow
        label="Magic Pen (Magic)"
        values={builds.map((entry) => entry.stats.magicPenetration)}
        format={formatPlainPercent}
      />
      <MultiStatRow
        label="Damage type → Pen"
        values={builds.map((entry) => entry.stats.damageProfile ?? entry.stats._meta?.damageProfile)}
        format={(profile) => formatDamageProfileLabel(profile)}
      />
    </section>
  );
}

function CompareBuildToggles({ sets, selectedKeys, onToggle }) {
  if (sets.length < 2) {
    return null;
  }

  return (
    <section className="build-lab-compare-toggles" aria-label="Builds no comparativo">
      <div className="build-lab-column-header">
        <h2>Comparar</h2>
      </div>
      <div className="build-lab-compare-chips">
        {sets.map((set, index) => {
          const key = set.id ?? set.label ?? String(index);
          const selected = selectedKeys.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`build-lab-boss-chip ${selected ? "active" : ""}`}
              aria-pressed={selected}
              onClick={() => onToggle(key)}
              title={selected ? `Remover Build ${set.label} do comparativo` : `Incluir Build ${set.label}`}
            >
              Build {set.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BuildSetSwitcher({ sets, activeIndex, onSelect, onAdd, onRemove }) {
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState(null);
  const pendingSet =
    pendingRemoveIndex != null ? sets[pendingRemoveIndex] : null;
  const pendingLabel =
    pendingSet?.label ??
    (pendingRemoveIndex != null ? String.fromCharCode(65 + pendingRemoveIndex) : "");

  function requestRemove(index) {
    setPendingRemoveIndex(index);
  }

  function cancelRemove() {
    setPendingRemoveIndex(null);
  }

  function confirmRemove() {
    if (pendingRemoveIndex == null) {
      return;
    }
    const index = pendingRemoveIndex;
    setPendingRemoveIndex(null);
    onRemove(index);
  }

  return (
    <>
      <div className="build-set-switch">
        {sets.map((set, index) => (
          <div key={set.id ?? index} className={`build-set-tab ${activeIndex === index ? "active" : ""}`}>
            <button type="button" className="build-set-tab-main" onClick={() => onSelect(index)}>
              Build {set.label ?? String.fromCharCode(65 + index)}
            </button>
            {index > 0 ? (
              <button
                type="button"
                className="build-set-tab-remove"
                aria-label={`Remove Build ${set.label}`}
                title="Remover build"
                onClick={(event) => {
                  event.stopPropagation();
                  requestRemove(index);
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {sets.length < MAX_BUILD_SETS ? (
          <button type="button" className="build-set-add" onClick={onAdd} title="Adicionar build">
            +
          </button>
        ) : null}
      </div>

      {pendingSet ? (
        <div className="build-attr-modal-backdrop" role="presentation" onClick={cancelRemove}>
          <div
            className="build-attr-modal build-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="build-remove-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="build-attr-modal-head">
              <h3 id="build-remove-title">Remover Build {pendingLabel}?</h3>
            </div>
            <p className="build-attr-modal-summary">
              Tem certeza? Essa build e o equipamento dela serão removidos. Essa ação não pode ser
              desfeita.
            </p>
            <div className="build-confirm-actions">
              <button type="button" className="build-lab-ghost-button" onClick={cancelRemove}>
                Cancelar
              </button>
              <button type="button" className="build-confirm-danger" onClick={confirmRemove}>
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function BuildLabPage({
  characters = [],
  activeCharacterId = "",
  setActiveCharacterId,
  dashboardStats,
  navigation,
  hiddenCharacterMenus = [],
  isDashboardSettingsPage = false,
  onOpenHome,
  onOpenDashboardSettings,
  onToggleCharacterMenu,
  onOpenCharacters
}) {
  const [panel, setPanel] = useState("equipment");
  const [activeIndex, setActiveIndex] = useState(0);
  const [skillParams, setSkillParams] = useState(DEFAULT_SKILL_PARAMS);
  const [useKitModifier, setUseKitModifier] = useState(true);
  const [kitAssumptions, setKitAssumptions] = useState(DEFAULT_KIT_ASSUMPTIONS);
  const [bossLevel, setBossLevel] = useState(DEFAULT_BOSS_LEVEL);
  const [useRecommendedBoss, setUseRecommendedBoss] = useState(true);
  const [customEnemyMode, setCustomEnemyMode] = useState(false);
  const [enemyDefense, setEnemyDefense] = useState(() => bossArmorAtLevel(DEFAULT_BOSS_LEVEL));
  const [compareSelectedKeys, setCompareSelectedKeys] = useState(() => new Set());
  const previousCompareSetKeysRef = useRef([]);

  const activeCharacter =
    characters.find((character) => character.id === activeCharacterId) ?? characters[0] ?? null;
  const characterId = activeCharacter?.id ?? "";
  const { build, setBuild, updateSet, addSet, removeSet } = useCharacterBuild(characterId);
  const { catalogs, ownedIds, itemsById, loading, error } = useOwnedGearCatalog(characterId);
  const [augments, setAugments] = useState([]);
  const [skillsCatalog, setSkillsCatalog] = useState([]);
  const [talentPointBudget, setTalentPointBudget] = useState(TALENT_POINTS_AT_LEVEL_25);

  const sets = build.sets ?? [];
  const safeIndex = Math.min(activeIndex, Math.max(0, sets.length - 1));
  const activeSet = sets[safeIndex] ?? sets[0];

  useEffect(() => {
    if (activeIndex >= sets.length) {
      setActiveIndex(Math.max(0, sets.length - 1));
    }
  }, [activeIndex, sets.length]);

  useEffect(() => {
    const nextKeys = sets.map((set, index) => set.id ?? set.label ?? String(index));
    const previousKeySet = new Set(previousCompareSetKeysRef.current);

    setCompareSelectedKeys((current) => {
      const next = new Set();

      if (current.size === 0) {
        for (const key of nextKeys) {
          next.add(key);
        }
      } else {
        for (const key of nextKeys) {
          const isNew = !previousKeySet.has(key);
          if (current.has(key) || isNew) {
            next.add(key);
          }
        }
        if (next.size === 0) {
          for (const key of nextKeys) {
            next.add(key);
          }
        }
      }

      if (next.size === current.size && [...next].every((key) => current.has(key))) {
        return current;
      }
      return next;
    });

    previousCompareSetKeysRef.current = nextKeys;
  }, [sets]);

  useEffect(() => {
    if (loading || itemsById.size === 0) {
      return;
    }
    setBuild((current) => {
      const next = promoteCharacterBuildLevels(current, itemsById);
      return next === current ? current : next;
    });
  }, [loading, itemsById, setBuild]);

  useEffect(() => {
    let cancelled = false;

    async function loadAugments() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/augments.json`);
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (!cancelled) {
          setAugments(Array.isArray(payload.augments) ? payload.augments : []);
        }
      } catch {
        if (!cancelled) {
          setAugments([]);
        }
      }
    }

    async function loadSkills() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/skills.json`, {
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (!cancelled) {
          setSkillsCatalog(Array.isArray(payload.skills) ? payload.skills : []);
          setTalentPointBudget(Number(payload.talentPointsAtLevel25) || TALENT_POINTS_AT_LEVEL_25);
        }
      } catch {
        if (!cancelled) {
          setSkillsCatalog([]);
        }
      }
    }

    loadAugments();
    loadSkills();
    return () => {
      cancelled = true;
    };
  }, []);

  const className = activeCharacter?.className ?? "";

  const damageOverrides = useMemo(
    () => ({
      ...skillParams,
      enemyDefense,
      defenseModifier: DEFENSE_MODIFIER
    }),
    [skillParams, enemyDefense]
  );

  const damageBuilds = useMemo(
    () =>
      sets.map((set, index) => {
        const attributes = aggregateBuildAttributes(
          set?.equipment,
          itemsById,
          augments,
          className
        );
        const kit = analyzeWeaponKit({
          equipment: set?.equipment,
          arsenal: set?.arsenal,
          skills: skillsCatalog,
          itemsById,
          attributes,
          className,
          classSkills: set?.classSkills,
          talents: set?.talents,
          assumptions: kitAssumptions
        });
        const modifier =
          useKitModifier && kit.effectiveModifier != null
            ? kit.effectiveModifier
            : Number(skillParams.modifier) || 0;
        const { stats } = buildDamageStatsForSet(set, className, itemsById, augments, {
          ...damageOverrides,
          modifier,
          kit
        });
        const criticalChance =
          (Number(stats.criticalChance) || 0) + (Number(kit.bonuses?.critChanceFlat) || 0);
        const criticalBonus =
          (Number(stats.criticalBonus) || 0) + (Number(kit.bonuses?.critBonusFlat) || 0);
        const extraDamage1 =
          (Number(stats.extraDamage1) || 0) + (Number(kit.bonuses?.extraDamageFlat) || 0);
        return {
          label: set.label,
          id: set.id,
          key: set.id ?? set.label ?? String(index),
          colorIndex: index,
          stats: {
            ...stats,
            criticalChance,
            criticalBonus,
            extraDamage1
          },
          kit
        };
      }),
    [
      sets,
      className,
      itemsById,
      augments,
      damageOverrides,
      skillsCatalog,
      useKitModifier,
      skillParams.modifier,
      kitAssumptions
    ]
  );

  const comparedBuilds = useMemo(
    () => damageBuilds.filter((entry) => compareSelectedKeys.has(entry.key)),
    [damageBuilds, compareSelectedKeys]
  );

  const damageResults = useMemo(
    () =>
      comparedBuilds.map((entry) => {
        const result = calculateBuildDamage(entry.stats);
        const baseline = calculateBuildDamage(comparedBuilds[0]?.stats ?? entry.stats);
        const gainVsBaseline =
          baseline.averageDamage > 0 ? result.averageDamage / baseline.averageDamage - 1 : 0;
        return { result, gainVsBaseline };
      }),
    [comparedBuilds]
  );

  const compareBaselineLabel = comparedBuilds[0]?.label ?? "A";

  const analysisBuild = damageBuilds[safeIndex] ?? null;
  const activeKitModifier = analysisBuild?.kit?.effectiveModifier ?? null;

  const activeAttributes = useMemo(
    () => aggregateBuildAttributes(activeSet?.equipment, itemsById, augments, className),
    [activeSet?.equipment, itemsById, augments, className]
  );

  const ownedCounts = useMemo(
    () => ({
      weapons: ownedIds.weapons?.size ?? 0,
      armor: ownedIds.armor?.size ?? 0,
      jewellery: ownedIds.jewellery?.size ?? 0
    }),
    [ownedIds]
  );

  function updateEquipment(setIndex, slotKey, nextSlot) {
    updateSet(setIndex, (current) => ({
      ...current,
      equipment: {
        ...current.equipment,
        [slotKey]: nextSlot
      }
    }));
  }

  function replaceEquipment(setIndex, nextEquipment) {
    updateSet(setIndex, (current) => ({
      ...current,
      equipment: nextEquipment
    }));
  }

  function updateSkillParam(key, value) {
    setSkillParams((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleBossLevelChange(level) {
    const nextLevel = Math.min(BOSS_LEVEL_MAX, Math.max(BOSS_LEVEL_MIN, Number(level) || 1));
    setUseRecommendedBoss(false);
    setCustomEnemyMode(false);
    setBossLevel(nextLevel);
    setEnemyDefense(bossArmorAtLevel(nextLevel));
  }

  function handleToggleCustom() {
    setUseRecommendedBoss(false);
    setCustomEnemyMode((current) => {
      const next = !current;
      if (!next) {
        setEnemyDefense(bossArmorAtLevel(bossLevel));
      }
      return next;
    });
  }

  function handleCustomDefense(value) {
    setUseRecommendedBoss(false);
    setCustomEnemyMode(true);
    setEnemyDefense(value);
  }

  function handleToggleRecommendedBoss(checked) {
    setUseRecommendedBoss(checked);
    if (checked) {
      setCustomEnemyMode(false);
      setBossLevel(DEFAULT_BOSS_LEVEL);
      setEnemyDefense(bossArmorAtLevel(DEFAULT_BOSS_LEVEL));
    }
  }

  function handleToggleCompareBuild(key) {
    setCompareSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        if (next.size <= 1) {
          return current;
        }
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function updateSkillRune(setIndex, skillId, runeId) {
    updateSet(setIndex, (current) => {
      const runesBySkillId = { ...(current.classSkills?.runesBySkillId ?? {}) };
      if (!runeId) {
        delete runesBySkillId[skillId];
      } else {
        runesBySkillId[skillId] = runeId;
      }
      return {
        ...current,
        classSkills: {
          runesBySkillId,
          activeSkillIds: current.classSkills?.activeSkillIds ?? [],
          activeSkillsTouched: current.classSkills?.activeSkillsTouched ?? false
        }
      };
    });
  }

  function toggleActiveClassSkill(setIndex, skillId) {
    updateSet(setIndex, (current) => {
      const skill = skillsCatalog.find((entry) => entry.id === skillId);
      if (!skill || isClassSignatureSkill(skill) || isLevel30Skill(skill) || skill.kind !== "Active") {
        return current;
      }
      const activeSkillIds = [
        ...resolveToggleableClassSkillIds(current.classSkills, skillsCatalog, className)
      ];
      const index = activeSkillIds.indexOf(skillId);
      if (index >= 0) {
        activeSkillIds.splice(index, 1);
      } else if (activeSkillIds.length < CLASS_SKILL_MAX_ACTIVE) {
        activeSkillIds.push(skillId);
      } else {
        return current;
      }
      return {
        ...current,
        classSkills: {
          runesBySkillId: current.classSkills?.runesBySkillId ?? {},
          activeSkillIds,
          activeSkillsTouched: true
        }
      };
    });
  }

  function updateTalentPoints(setIndex, talentId, points) {
    updateSet(setIndex, (current) => {
      const pointsById = { ...(current.talents?.pointsById ?? {}) };
      if (!points) {
        delete pointsById[talentId];
      } else {
        pointsById[talentId] = points;
      }
      return {
        ...current,
        talents: { pointsById }
      };
    });
  }

  function updateArsenal(setIndex, nextArsenal) {
    updateSet(setIndex, (current) => ({
      ...current,
      arsenal: {
        selectedIds: Array.isArray(nextArsenal?.selectedIds) ? nextArsenal.selectedIds : []
      }
    }));
  }

  function handleAddSet() {
    addSet();
    setActiveIndex(sets.length);
  }

  function handleRemoveSet(index) {
    removeSet(index);
    setActiveIndex((current) => {
      if (index < current) {
        return current - 1;
      }
      if (index === current) {
        return Math.max(0, current - 1);
      }
      return current;
    });
  }

  return (
    <PageShell
      title="Build"
      stat={{
        current: dashboardStats.current,
        total: dashboardStats.total,
        collections: dashboardStats.collections,
        accountCollections: dashboardStats.accountCollections,
        characterCollections: dashboardStats.characterCollections,
        loading: dashboardStats.loading,
        error: dashboardStats.error
      }}
      navigation={navigation}
      hiddenCharacterMenus={hiddenCharacterMenus}
      isDashboardSettingsPage={isDashboardSettingsPage}
      onOpenHome={onOpenHome}
      onOpenDashboardSettings={onOpenDashboardSettings}
      onToggleCharacterMenu={onToggleCharacterMenu}
    >
      <section className="build-lab-page">
        <section className="build-character-bar">
          <label>
            <span>Character</span>
            <select
              value={characterId}
              onChange={(event) => setActiveCharacterId?.(event.target.value)}
              disabled={characters.length === 0}
            >
              {characters.length === 0 ? <option value="">No characters</option> : null}
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name} · {character.className ?? "No class"}
                </option>
              ))}
            </select>
          </label>
          <div className="build-owned-counts">
            <span>Owned weapons: {ownedCounts.weapons}</span>
            <span>Owned armor: {ownedCounts.armor}</span>
            <span>Owned jewellery: {ownedCounts.jewellery}</span>
          </div>
          {characters.length === 0 ? (
            <button type="button" className="build-lab-ghost-button" onClick={onOpenCharacters}>
              Create character
            </button>
          ) : null}
        </section>

        {!characterId ? (
          <section className="build-lab-empty">
            <p>Crie um personagem para montar o set e comparar builds.</p>
          </section>
        ) : (
          <>
            <div className="build-lab-tabs" role="tablist" aria-label="Build panels">
              <button
                type="button"
                role="tab"
                aria-selected={panel === "equipment"}
                className={panel === "equipment" ? "active" : ""}
                onClick={() => setPanel("equipment")}
              >
                Build
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === "attributes"}
                className={panel === "attributes" ? "active" : ""}
                onClick={() => setPanel("attributes")}
              >
                Attributes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === "class-skills"}
                className={panel === "class-skills" ? "active" : ""}
                onClick={() => setPanel("class-skills")}
              >
                Class skills
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === "talents"}
                className={panel === "talents" ? "active" : ""}
                onClick={() => setPanel("talents")}
              >
                Talents
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === "arsenal"}
                className={panel === "arsenal" ? "active" : ""}
                onClick={() => setPanel("arsenal")}
              >
                Arsenal
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === "weapons"}
                className={panel === "weapons" ? "active" : ""}
                onClick={() => setPanel("weapons")}
              >
                Weapons analysis
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === "analysis"}
                className={panel === "analysis" ? "active" : ""}
                onClick={() => setPanel("analysis")}
              >
                Damage analysis
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panel === "damage"}
                className={panel === "damage" ? "active" : ""}
                onClick={() => setPanel("damage")}
              >
                Damage compare
              </button>
            </div>

            {loading ? <p className="state">Loading gear catalogs…</p> : null}
            {error ? <p className="state error">{error}</p> : null}

            {panel === "equipment" ||
            panel === "attributes" ||
            panel === "class-skills" ||
            panel === "talents" ||
            panel === "arsenal" ||
            panel === "weapons" ||
            panel === "analysis" ||
            panel === "damage" ? (
              <BuildSetSwitcher
                sets={sets}
                activeIndex={safeIndex}
                onSelect={setActiveIndex}
                onAdd={handleAddSet}
                onRemove={handleRemoveSet}
              />
            ) : null}

            {panel === "equipment" && activeSet ? (
              <EquipmentPaperDoll
                character={activeCharacter}
                equipment={activeSet.equipment}
                catalogs={catalogs}
                ownedIds={ownedIds}
                itemsById={itemsById}
                onChangeSlot={(slotKey, nextSlot) => updateEquipment(safeIndex, slotKey, nextSlot)}
                onReplaceEquipment={(nextEquipment) => replaceEquipment(safeIndex, nextEquipment)}
              />
            ) : null}

            {panel === "attributes" ? (
              <BuildAttributesPanel
                attributes={activeAttributes}
                buildLabel={activeSet?.label ?? "A"}
              />
            ) : null}

            {panel === "class-skills" ? (
              <ClassSkillsPanel
                skills={skillsCatalog}
                className={className}
                classSkills={activeSet?.classSkills}
                onChangeRune={(skillId, runeId) => updateSkillRune(safeIndex, skillId, runeId)}
                onToggleActiveSkill={(skillId) => toggleActiveClassSkill(safeIndex, skillId)}
              />
            ) : null}

            {panel === "talents" ? (
              <TalentsPanel
                skills={skillsCatalog}
                className={className}
                talents={activeSet?.talents}
                pointBudget={talentPointBudget}
                onChangeTalentPoints={(talentId, points) =>
                  updateTalentPoints(safeIndex, talentId, points)
                }
              />
            ) : null}

            {panel === "arsenal" ? (
              <ArsenalPanel
                skills={skillsCatalog}
                className={className}
                equipment={activeSet?.equipment}
                itemsById={itemsById}
                arsenal={activeSet?.arsenal}
                onChangeArsenal={(next) => updateArsenal(safeIndex, next)}
              />
            ) : null}

            {panel === "weapons" ? (
              <WeaponsAnalysisPanel
                skills={skillsCatalog}
                equipment={activeSet?.equipment}
                arsenal={activeSet?.arsenal}
                itemsById={itemsById}
                attributes={activeAttributes}
                className={className}
                classSkills={activeSet?.classSkills}
                talents={activeSet?.talents}
                assumptions={kitAssumptions}
                onChangeAssumptions={setKitAssumptions}
                buildLabel={activeSet?.label ?? "A"}
                kitModifierEnabled={useKitModifier}
              />
            ) : null}

            {panel === "analysis" ? (
              <>
                <div className="build-lab-grid">
                  <SkillParamsEditor
                    skillParams={skillParams}
                    onChange={updateSkillParam}
                    kitModifier={activeKitModifier}
                    useKitModifier={useKitModifier}
                    onToggleKitModifier={setUseKitModifier}
                  />
                  <EnemyDefensePicker
                    bossLevel={bossLevel}
                    enemyDefense={enemyDefense}
                    customMode={customEnemyMode}
                    useRecommended={useRecommendedBoss}
                    onToggleRecommended={handleToggleRecommendedBoss}
                    onBossLevelChange={handleBossLevelChange}
                    onToggleCustom={handleToggleCustom}
                    onCustomDefense={handleCustomDefense}
                  />
                </div>

                {analysisBuild ? (
                  <SecondaryAnalysisCharts build={analysisBuild} bossDefense={enemyDefense} />
                ) : (
                  <p className="state">Selecione uma build para analisar.</p>
                )}
              </>
            ) : null}

            {panel === "damage" ? (
              <>
                <CompareBuildToggles
                  sets={sets}
                  selectedKeys={compareSelectedKeys}
                  onToggle={handleToggleCompareBuild}
                />

                <EnemyDefensePicker
                  bossLevel={bossLevel}
                  enemyDefense={enemyDefense}
                  customMode={customEnemyMode}
                  useRecommended={useRecommendedBoss}
                  onToggleRecommended={handleToggleRecommendedBoss}
                  onBossLevelChange={handleBossLevelChange}
                  onToggleCustom={handleToggleCustom}
                  onCustomDefense={handleCustomDefense}
                />

                <p className="build-lab-column-note">
                  {useKitModifier && activeKitModifier != null
                    ? `Skill modifier do kit (build ativa): ${Math.round(activeKitModifier * 100)}% — cada build usa o seu. Desative em Damage analysis para manual.`
                    : `Skill modifier manual ${Math.round(Number(skillParams.modifier) * 100)}% — edite em Damage analysis.`}{" "}
                  Penetração: Physical → Armor Pen, Magic → Magic Pen (pesos do Weapons analysis).
                  {analysisBuild?.stats?.damageProfile
                    ? ` Ativa: ${formatDamageProfileLabel(analysisBuild.stats.damageProfile)} (${formatDamageProfileSource(analysisBuild.stats.damageProfile)}).`
                    : ""}
                </p>

                {comparedBuilds.length === 0 ? (
                  <p className="state">Selecione ao menos uma build para comparar.</p>
                ) : (
                  <>
                    <AttributeComparative
                      builds={comparedBuilds}
                      damageResults={damageResults}
                      baselineLabel={compareBaselineLabel}
                    />

                    <BuildCharts builds={comparedBuilds} bossDefense={enemyDefense} />
                  </>
                )}
              </>
            ) : null}
          </>
        )}
      </section>
    </PageShell>
  );
}
