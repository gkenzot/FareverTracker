import { useMemo, useState } from "react";
import { assetPath } from "../../shared/utils/assets";
import {
  CLASS_SKILL_MAX_ACTIVE,
  isClassSignatureSkill,
  isLevel30Skill,
  listClassSkillSlotRows,
  resolveActiveClassSkillIds,
  resolveToggleableClassSkillIds,
  skillMatchesClass
} from "./classSkillLoadout";
import {
  canDecreaseTalent,
  canIncreaseTalent,
  getColumnPointsBeforeTier,
  getPoints,
  resolveTalentTree
} from "./talentTreeLogic";
import { COLUMN_TIER_GATES } from "./talentTrees";

function getSkillIconSrc(skill, kind = "skill") {
  const folder = kind === "rune" ? "runes" : "skills";
  if (skill?.iconPath) {
    return assetPath(skill.iconPath.replace(/^\//, ""));
  }
  if (skill?.iconFilename) {
    return assetPath(`images/${folder}/${skill.iconFilename}`);
  }
  return skill?.iconUrl || "";
}

function SkillIcon({ skill, kind = "skill" }) {
  const localPath = getSkillIconSrc(skill, kind);
  const src = localPath || "";
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

function TalentHoverTooltip({ tooltip, pointsById }) {
  if (!tooltip?.node) {
    return null;
  }

  const { node, x, y } = tooltip;
  const points = getPoints(pointsById, node.id);
  const iconSrc = getSkillIconSrc(node);
  const left = Math.min(x + 14, window.innerWidth - 300);
  const top = Math.min(y + 14, window.innerHeight - 40);

  return (
    <div className="item-hover-tooltip" style={{ left, top }} role="tooltip">
      <div className="item-hover-tooltip-head">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            onError={(event) => {
              if (node.iconUrl && event.currentTarget.src !== node.iconUrl) {
                event.currentTarget.src = node.iconUrl;
                return;
              }
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div>
          <strong>{node.name}</strong>
          <span>
            {points}/{node.maxRank}
          </span>
        </div>
      </div>
      {node.description ? <p className="item-hover-tooltip-desc">{node.description}</p> : null}
    </div>
  );
}

export function ClassSkillsPanel({
  skills = [],
  className = "",
  classSkills,
  onChangeRune,
  onToggleActiveSkill
}) {
  const rows = useMemo(() => {
    const slotRows = listClassSkillSlotRows(skills, className);
    const passives = (skills || [])
      .filter((skill) => skill.kind === "Passive")
      .filter((skill) => skillMatchesClass(skill, className))
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));
    const prayers = (skills || [])
      .filter((skill) => skill.kind === "Prayer")
      .filter((skill) => skillMatchesClass(skill, className))
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));
    return { slotRows, passives, prayers };
  }, [skills, className]);

  const runesBySkillId = classSkills?.runesBySkillId ?? {};
  const activeSkillIds = useMemo(
    () => resolveActiveClassSkillIds(classSkills, skills, className),
    [classSkills, skills, className]
  );
  const toggleableIds = useMemo(
    () => resolveToggleableClassSkillIds(classSkills, skills, className),
    [classSkills, skills, className]
  );
  const activeCount = toggleableIds.length;
  const slotsFull = activeCount >= CLASS_SKILL_MAX_ACTIVE;

  if (!className) {
    return <p className="state">Select a character with a class.</p>;
  }

  if (rows.slotRows.length === 0 && rows.passives.length === 0 && rows.prayers.length === 0) {
    return <p className="state">No class skills found for {className}.</p>;
  }

  return (
    <section className="build-skills-panel" aria-label="Class skills">
      <p className="build-skills-intro">
        Class skills for <strong>{className}</strong>. Signature is always active. Up to{" "}
        <strong>
          {activeCount}/{CLASS_SKILL_MAX_ACTIVE}
        </strong>{" "}
        Actives (sorted by unlock; default = first 4). Passives and Prayers are separate. Level 30
        locked (EA).
      </p>

      <div className="build-skills-list">
        {rows.slotRows.map((skill) => {
          const locked = isLevel30Skill(skill);
          const isSignature = isClassSignatureSkill(skill);
          const active = isSignature || activeSkillIds.includes(skill.id);
          const selected = runesBySkillId[skill.id] || "";
          const hasRunes = skill.runes?.length > 0;
          const toggleDisabled = locked || isSignature || (!active && slotsFull);

          return (
            <article
              key={skill.id}
              className={`build-skill-card ${active ? "" : "is-inactive-skill"} ${locked ? "is-locked-skill" : ""}`}
            >
              <SkillIcon skill={skill} />
              <div className="build-skill-card-body">
                <div className="build-skill-card-header">
                  <h3>{skill.name}</h3>
                  {isSignature ? (
                    <span className="build-skill-kind" title="Signature always active">
                      {skill.kind}
                    </span>
                  ) : (
                    <label
                      className={`build-skill-kind-toggle ${toggleDisabled && !active ? "is-disabled" : ""}`}
                      title={
                        locked
                          ? "Level 30 · unavailable"
                          : active
                            ? "Disable skill"
                            : slotsFull
                              ? "4 Active limit"
                              : "Enable skill"
                      }
                    >
                      <span className="build-skill-kind">{skill.kind}</span>
                      <input
                        type="checkbox"
                        checked={active}
                        disabled={toggleDisabled && !active}
                        aria-label={
                          locked
                            ? `${skill.name} locked (level 30)`
                            : `${active ? "Disable" : "Enable"} ${skill.name}`
                        }
                        onChange={() => onToggleActiveSkill?.(skill.id)}
                      />
                    </label>
                  )}
                </div>
                {skill.description ? <p>{skill.description}</p> : null}
                <div className="build-skill-card-meta">
                  {skill.cooldown != null ? <small>CD {skill.cooldown}s</small> : null}
                  {locked ? <small className="build-skill-lock">Level 30 · unavailable</small> : null}
                  {isSignature ? <small>Always active</small> : null}
                </div>
                {hasRunes ? (
                  <div
                    className="build-skill-runes"
                    role="listbox"
                    aria-label={`Runes for ${skill.name}`}
                  >
                    {skill.runes.map((rune) => {
                      const isSelected = selected === rune.id;
                      return (
                        <button
                          key={rune.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`build-rune-card ${isSelected ? "is-active" : ""}`}
                          title={rune.description || rune.name}
                          disabled={locked || !active}
                          onClick={() => onChangeRune(skill.id, isSelected ? "" : rune.id)}
                        >
                          <SkillIcon kind="rune" skill={rune} />
                          <div className="build-rune-card-body">
                            <strong>{rune.name}</strong>
                            {rune.rankLabel ? <span>{rune.rankLabel}</span> : null}
                            {rune.description ? <p>{rune.description}</p> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <small className="build-skill-no-rune">No runes</small>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {rows.prayers.length > 0 ? (
        <div className="build-skills-passives">
          <h3>Prayers</h3>
          <p className="build-skills-intro">Rosary system · don't use the 4 bar slots.</p>
          <div className="build-skills-list">
            {rows.prayers.map((skill) => (
              <article key={skill.id} className="build-skill-card build-skill-card--passive">
                <SkillIcon skill={skill} />
                <div className="build-skill-card-body">
                  <div className="build-skill-card-header">
                    <h3>{skill.name}</h3>
                    <span className="build-skill-kind">{skill.kind}</span>
                  </div>
                  {skill.description ? <p>{skill.description}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {rows.passives.length > 0 ? (
        <div className="build-skills-passives">
          <h3>Class passives</h3>
          <p className="build-skills-intro">Always active · don't use the 4 slots · don't affect kit /min.</p>
          <div className="build-skills-list">
            {rows.passives.map((skill) => (
              <article key={skill.id} className="build-skill-card build-skill-card--passive">
                <SkillIcon skill={skill} />
                <div className="build-skill-card-body">
                  <div className="build-skill-card-header">
                    <h3>{skill.name}</h3>
                    <span className="build-skill-kind">{skill.kind}</span>
                  </div>
                  {skill.description ? <p>{skill.description}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TalentNodeCard({
  node,
  pointsById,
  remaining,
  resolved,
  onChangeTalentPoints,
  onHoverStart,
  onHoverMove,
  onHoverEnd
}) {
  const points = getPoints(pointsById, node.id);
  const canPlus =
    remaining > 0 && canIncreaseTalent(resolved, pointsById, node.id);
  const canMinus = canDecreaseTalent(resolved, pointsById, node.id, false);
  const unlocked =
    node.role === "root" ||
    canIncreaseTalent(resolved, pointsById, node.id) ||
    points > 0;

  function addPoint() {
    if (!canPlus) return;
    onChangeTalentPoints(node.id, points + 1);
  }

  function removePoint() {
    if (!canMinus) return;
    onChangeTalentPoints(node.id, points - 1);
  }

  return (
    <button
      type="button"
      className={[
        "build-talent-node",
        points > 0 ? "is-active" : "",
        !unlocked && points <= 0 ? "is-locked" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={!canPlus && !canMinus}
      onClick={() => addPoint()}
      onContextMenu={(event) => {
        event.preventDefault();
        removePoint();
      }}
      onMouseEnter={(event) => onHoverStart?.(node, event)}
      onMouseMove={(event) => onHoverMove?.(event)}
      onMouseLeave={() => onHoverEnd?.()}
    >
      <SkillIcon skill={node} />
      <span className="build-talent-node-name">{node.name}</span>
      <span className="build-talent-node-rank">
        {points}/{node.maxRank}
      </span>
    </button>
  );
}

export function TalentsPanel({
  skills = [],
  className = "",
  talents,
  pointBudget = 17,
  onChangeTalentPoints
}) {
  const resolved = useMemo(() => resolveTalentTree(className, skills), [skills, className]);
  const pointsById = talents?.pointsById ?? {};
  const spent = Object.values(pointsById).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const remaining = pointBudget - spent;
  const [tooltip, setTooltip] = useState(null);

  function showTalentTooltip(node, event) {
    setTooltip({
      node,
      x: event.clientX,
      y: event.clientY
    });
  }

  function moveTalentTooltip(event) {
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

  function hideTalentTooltip() {
    setTooltip(null);
  }

  if (!className) {
    return <p className="state">Select a character with a class.</p>;
  }

  if (!resolved) {
    return <p className="state">Talent tree not mapped yet for {className}.</p>;
  }

  return (
    <section className="build-talents-panel" aria-label="Talents">
      <div className="build-talents-header">
        <p>
          <strong>{className}</strong> talent tree. Click to spend, right-click to refund.
        </p>
        <div className={`build-talents-budget ${remaining < 0 ? "is-over" : ""}`}>
          <strong>
            {spent}/{pointBudget}
          </strong>
          <span>{remaining} left</span>
        </div>
      </div>

      <div className="build-talent-tree">
        <div className="build-talent-root">
          <span className="build-talent-tier-label">Tier 0</span>
          <TalentNodeCard
            node={resolved.root}
            pointsById={pointsById}
            remaining={remaining}
            resolved={resolved}
            onChangeTalentPoints={onChangeTalentPoints}
            onHoverStart={showTalentTooltip}
            onHoverMove={moveTalentTooltip}
            onHoverEnd={hideTalentTooltip}
          />
        </div>

        <div className="build-talent-branches">
          {resolved.branches.map((tiers, branchIndex) => {
            return (
              <div key={branchIndex} className="build-talent-branch">
                {tiers.map((nodes, tierIndex) => {
                  const tier = tierIndex + 1;
                  const gate = COLUMN_TIER_GATES[tier] ?? 0;
                  const priorPts = getColumnPointsBeforeTier(
                    resolved,
                    pointsById,
                    branchIndex,
                    tier
                  );
                  return (
                    <div key={tier} className="build-talent-tier">
                      <div className="build-talent-tier-meta">
                        <span className="build-talent-tier-label">Tier {tier}</span>
                        <span
                          className={`build-talent-tier-gate ${
                            priorPts >= gate ? "is-met" : ""
                          }`}
                        >
                          {priorPts}/{gate}
                        </span>
                      </div>
                      <div
                        className="build-talent-tier-nodes"
                        style={{ "--talent-cols": nodes.length }}
                      >
                        {nodes.map((node) => (
                          <TalentNodeCard
                            key={node.id}
                            node={node}
                            pointsById={pointsById}
                            remaining={remaining}
                            resolved={resolved}
                            onChangeTalentPoints={onChangeTalentPoints}
                            onHoverStart={showTalentTooltip}
                            onHoverMove={moveTalentTooltip}
                            onHoverEnd={hideTalentTooltip}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <TalentHoverTooltip tooltip={tooltip} pointsById={pointsById} />
    </section>
  );
}
