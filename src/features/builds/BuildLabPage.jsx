import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { fetchJsonData } from "../../shared/utils/dataCache";
import { aggregateBuildAttributes } from "./aggregateBuildAttributes";
import { BuildAttributesPanel } from "./BuildAttributesPanel";
import {
  AttributeComparative,
  BuildCharts,
  CompareBuildToggles,
  EnemyDefensePicker,
  SecondaryAnalysisCharts,
  SkillParamsEditor
} from "./BuildCharts";
import { buildDamageStatsForSet, formatDamageProfileLabel, formatDamageProfileSource } from "./buildDamageStats";
import { ClassSkillsPanel, TalentsPanel } from "./ClassSkillsPanel";
import { ArsenalPanel } from "./ArsenalPanel";
import { EquipmentPaperDoll } from "./EquipmentPaperDoll";
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
  bossArmorAtLevel
} from "./enemyDefensePresets";
import { useCharacterBuild, useOwnedGearCatalog } from "./useCharacterBuild";
import { analyzeWeaponKit, DEFAULT_KIT_ASSUMPTIONS } from "./weaponKitAnalysis";
import { WeaponsAnalysisPanel } from "./WeaponsAnalysisPanel";

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
  const [skillParams, setSkillParams] = useState({ modifier: DEFAULT_BUILD.modifier });
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
        const payload = await fetchJsonData("data/augments.json");
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
        const payload = await fetchJsonData("data/skills.json");
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

            <BuildSetSwitcher
              sets={sets}
              activeIndex={safeIndex}
              onSelect={setActiveIndex}
              onAdd={handleAddSet}
              onRemove={handleRemoveSet}
            />

            {panel === "equipment" && activeSet ? (
              <EquipmentPaperDoll
                character={activeCharacter}
                equipment={activeSet.equipment}
                catalogs={catalogs}
                ownedIds={ownedIds}
                itemsById={itemsById}
                augments={augments}
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
