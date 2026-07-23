import { useEffect, useMemo } from "react";
import { assetPath } from "../../shared/utils/assets";
import { ARSENAL_MAX_PICKS } from "./buildSlots";
import {
  filterWeaponKit,
  getWeaponSubcategory,
  resolveWeaponMeta
} from "./weaponKitHelpers";

function getSkillIconSrc(skill) {
  if (skill?.iconPath) {
    return assetPath(skill.iconPath.replace(/^\//, ""));
  }
  if (skill?.iconFilename) {
    return assetPath(`images/skills/${skill.iconFilename}`);
  }
  return skill?.iconUrl || "";
}

function SkillIcon({ skill }) {
  const src = getSkillIconSrc(skill);
  if (!src) {
    return <div className="build-skill-icon build-skill-icon--empty" />;
  }
  return (
    <img
      className="build-skill-icon"
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(event) => {
        if (skill.iconUrl && event.currentTarget.src !== skill.iconUrl) {
          event.currentTarget.src = skill.iconUrl;
          return;
        }
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

function ArsenalSkillCard({ skill, selected, disabled, onToggle }) {
  return (
    <button
      type="button"
      className={`build-arsenal-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
      aria-pressed={selected}
      disabled={disabled && !selected}
      onClick={() => onToggle(skill.id)}
    >
      <SkillIcon skill={skill} />
      <div className="build-arsenal-card-body">
        <strong>{skill.name}</strong>
        <span className="build-skill-kind">{skill.kind}</span>
        {skill.description ? <p>{skill.description}</p> : null}
        {skill.cooldown != null ? <small>CD {skill.cooldown}s</small> : null}
      </div>
    </button>
  );
}

export function ArsenalPanel({
  skills = [],
  className = "",
  equipment,
  itemsById,
  arsenal,
  onChangeArsenal
}) {
  const arsenalSlot = equipment?.arsenal;
  const arsenalItem = arsenalSlot?.itemId ? itemsById?.get?.(arsenalSlot.itemId) : null;
  const subcategory = getWeaponSubcategory(arsenalItem);
  const selectedIds = arsenal?.selectedIds ?? [];
  const pickCount = selectedIds.length;
  const slotsFull = pickCount >= ARSENAL_MAX_PICKS;

  const weaponMeta = useMemo(() => resolveWeaponMeta(arsenalItem), [arsenalItem]);

  const weaponSkills = useMemo(() => {
    if (!weaponMeta) {
      return [];
    }
    return filterWeaponKit(skills, "Weapon Skill", weaponMeta);
  }, [skills, weaponMeta]);

  const weaponPassives = useMemo(() => {
    if (!weaponMeta) {
      return [];
    }
    return filterWeaponKit(skills, "Weapon Passive", weaponMeta);
  }, [skills, weaponMeta]);

  const kitOptions = useMemo(
    () => [...weaponSkills, ...weaponPassives],
    [weaponSkills, weaponPassives]
  );

  const kitById = useMemo(() => {
    const map = new Map();
    for (const skill of kitOptions) {
      map.set(skill.id, skill);
    }
    return map;
  }, [kitOptions]);

  const hasWeaponSkillsInCatalog = useMemo(
    () => skills.some((skill) => skill.kind === "Weapon Skill" || skill.kind === "Weapon Passive"),
    [skills]
  );

  useEffect(() => {
    if (!arsenalItem) {
      return;
    }
    const validIds = selectedIds.filter((id) => kitById.has(id));
    const changed =
      validIds.length !== selectedIds.length ||
      validIds.some((id, index) => id !== selectedIds[index]);
    if (changed) {
      onChangeArsenal({ selectedIds: validIds.slice(0, ARSENAL_MAX_PICKS) });
    }
  }, [arsenalItem, kitById, selectedIds, onChangeArsenal]);

  function togglePick(skillId) {
    const current = selectedIds.filter(Boolean);
    if (current.includes(skillId)) {
      onChangeArsenal({
        selectedIds: current.filter((id) => id !== skillId)
      });
      return;
    }
    if (current.length >= ARSENAL_MAX_PICKS) {
      return;
    }
    onChangeArsenal({
      selectedIds: [...current, skillId]
    });
  }

  if (!className) {
    return <p className="state">Selecione um personagem com classe.</p>;
  }

  if (!arsenalItem) {
    return (
      <section className="build-arsenal-panel" aria-label="Arsenal">
        <p className="state">
          Equipe uma arma no slot <strong>Arsenal</strong> na aba Build para escolher as skills.
        </p>
      </section>
    );
  }

  return (
    <section className="build-arsenal-panel" aria-label="Arsenal">
      <p className="build-skills-intro">
        Arsenal: <strong>{arsenalItem.name}</strong>
        {subcategory ? <> · {subcategory}</> : null}. {pickCount}/{ARSENAL_MAX_PICKS} slots — skills e
        passiva compartilham os mesmos espaços.
      </p>

      {!hasWeaponSkillsInCatalog ? (
        <p className="state">Catálogo de weapon skills ainda não carregou — atualize a página.</p>
      ) : kitOptions.length === 0 ? (
        <p className="state">
          Nenhuma skill/passiva encontrada para {arsenalItem.name}
          {subcategory ? ` (${subcategory})` : ""}.
        </p>
      ) : (
        <div className="build-arsenal-grid" role="list">
          {kitOptions.map((skill) => {
            const selected = selectedIds.includes(skill.id);
            return (
              <ArsenalSkillCard
                key={skill.id}
                skill={skill}
                selected={selected}
                disabled={!selected && slotsFull}
                onToggle={togglePick}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
