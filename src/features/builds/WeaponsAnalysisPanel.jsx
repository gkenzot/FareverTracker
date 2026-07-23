import { useMemo, useState } from "react";
import {
  DEFAULT_KIT_ASSUMPTIONS,
  KIT_ASSUMPTION_FIELDS,
  KIT_ASSUMPTION_TOGGLES,
  analyzeWeaponKit,
  normalizeKitAssumptions
} from "./weaponKitAnalysis";

function formatPercent(share) {
  if (!Number.isFinite(share)) {
    return "—";
  }
  return `${(share * 100).toFixed(1)}%`;
}

function formatDamage(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(1);
}

function formatCoeff(hits) {
  if (!hits?.length) {
    return "—";
  }
  return hits
    .map((hit) => `${hit.coeffPercent}% ${hit.attr} ${hit.type}`)
    .join(" + ");
}

function ShareBars({ title, rows, emptyLabel, showValue = false, valueSuffix = "" }) {
  if (!rows?.length) {
    return (
      <div className="weapon-analysis-card">
        <h3>{title}</h3>
        <p className="state">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="weapon-analysis-card">
      <h3>{title}</h3>
      <ul className="weapon-analysis-shares">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="weapon-analysis-share-head">
              <strong>{row.key}</strong>
              <span>
                {showValue ? `${formatDamage(row.value)}${valueSuffix}` : null}
                {showValue ? " · " : null}
                {formatPercent(row.share)}
              </span>
            </div>
            <div className="weapon-analysis-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(2, row.share * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeaponSummaryCard({ title, weapon, emptyText }) {
  if (!weapon) {
    return (
      <div className="weapon-analysis-card">
        <h3>{title}</h3>
        <p className="state">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="weapon-analysis-card">
      <h3>{title}</h3>
      <p className="weapon-analysis-weapon-name">
        {weapon.name}
        {weapon.subcategory ? <span> · {weapon.subcategory}</span> : null}
      </p>
      <dl className="weapon-analysis-dl">
        <div>
          <dt>Weapon Damage</dt>
          <dd>{weapon.weaponDamageAvg != null ? weapon.weaponDamageAvg : "—"}</dd>
        </div>
        <div>
          <dt>Affinity</dt>
          <dd>
            {weapon.affinity || "—"}
            {weapon.bucket ? ` · bucket ${weapon.bucket}` : ""}
          </dd>
        </div>
        <div>
          <dt>Base scaling</dt>
          <dd>
            {weapon.scalingAttr && weapon.scalingPercent != null
              ? `${weapon.scalingPercent}% ${weapon.scalingAttr}`
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function AssumptionsCard({ assumptions, onChange }) {
  const [useRecommended, setUseRecommended] = useState(true);
  const values = normalizeKitAssumptions(
    useRecommended ? DEFAULT_KIT_ASSUMPTIONS : assumptions
  );

  function enableRecommended() {
    setUseRecommended(true);
    onChange({ ...DEFAULT_KIT_ASSUMPTIONS });
  }

  function disableRecommended(nextValues = values) {
    setUseRecommended(false);
    onChange({ ...nextValues });
  }

  function updateField(key, raw, kind) {
    if (useRecommended) {
      return;
    }
    if (kind === "percent") {
      onChange({ ...values, [key]: (Number(raw) || 0) / 100 });
      return;
    }
    onChange({ ...values, [key]: Number(raw) || 0 });
  }

  function setToggle(key, checked) {
    if (useRecommended) {
      disableRecommended({ ...DEFAULT_KIT_ASSUMPTIONS, [key]: checked });
      return;
    }
    onChange({ ...values, [key]: checked });
  }

  return (
    <div
      className={`weapon-analysis-card weapon-analysis-card--wide${useRecommended ? " is-collapsed" : ""}`}
    >
      <div className="weapon-analysis-assumptions-head">
        <h3>Assumptions (uptime / procs)</h3>
        <label className="weapon-analysis-check weapon-analysis-check--recommended">
          <input
            type="checkbox"
            checked={useRecommended}
            onChange={(event) => {
              if (event.target.checked) {
                enableRecommended();
              } else {
                disableRecommended(values);
              }
            }}
          />
          <span>Usar recomendados</span>
        </label>
      </div>
      {useRecommended ? (
        <p className="weapon-analysis-note weapon-analysis-note--collapsed">
          Valores típicos ativos. Desmarque para ajustar uptimes e taxas.
        </p>
      ) : (
        <>
          <p className="weapon-analysis-note">
            Condicionais (poisoned, Chaincast…) escalam com uptime. Passivas/DoTs/conduits usam as
            taxas abaixo quando não têm CD.
          </p>
          <div className="weapon-analysis-assumptions-toggles">
            {KIT_ASSUMPTION_TOGGLES.map((toggle) => (
              <label key={toggle.key} className="weapon-analysis-check">
                <input
                  type="checkbox"
                  checked={Boolean(values[toggle.key])}
                  onChange={(event) => setToggle(toggle.key, event.target.checked)}
                />
                <span>{toggle.label}</span>
              </label>
            ))}
          </div>
          <div className="weapon-analysis-assumptions-grid">
            {KIT_ASSUMPTION_FIELDS.map((field) => {
              const display =
                field.kind === "percent"
                  ? Number(((values[field.key] || 0) * 100).toFixed(1))
                  : values[field.key];
              return (
                <label key={field.key} className="weapon-analysis-assumption">
                  <span>
                    {field.label}
                    {field.kind === "percent" ? " (%)" : ""}
                  </span>
                  <input
                    type="number"
                    step={field.step ?? (field.kind === "percent" ? 5 : 0.5)}
                    min={field.min ?? 0}
                    max={field.kind === "percent" ? 100 : undefined}
                    value={display}
                    onChange={(event) => updateField(field.key, event.target.value, field.kind)}
                  />
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function sourceTone(source) {
  if (source === "class") return "is-class";
  if (source === "talent") return "is-talent";
  if (source === "arsenal") return "is-arsenal";
  return "is-main";
}

export function WeaponsAnalysisPanel({
  skills = [],
  equipment,
  arsenal,
  itemsById,
  attributes = null,
  className = "",
  classSkills = null,
  talents = null,
  assumptions,
  onChangeAssumptions,
  buildLabel = "A",
  kitModifierEnabled = true
}) {
  const analysis = useMemo(
    () =>
      analyzeWeaponKit({
        equipment,
        arsenal,
        skills,
        itemsById,
        attributes,
        className,
        classSkills,
        talents,
        assumptions
      }),
    [
      equipment,
      arsenal,
      skills,
      itemsById,
      attributes,
      className,
      classSkills,
      talents,
      assumptions
    ]
  );

  const hasWeapons = Boolean(analysis.mainHand || analysis.arsenalWeapon);
  const hasClassOrTalents = analysis.entries.some(
    (entry) => entry.source === "class" || entry.source === "talent"
  );
  const modifierPct =
    analysis.effectiveModifier != null
      ? (analysis.effectiveModifier * 100).toFixed(2)
      : null;

  return (
    <section className="weapon-analysis-panel" aria-label="Weapons analysis">
      <p className="build-skills-intro">
        Build <strong>{buildLabel}</strong>: main-hand + arsenal skills + class skills{" "}
        <em>ativas</em> (máx. 4) + talents. Passivas (arma/classe) ficam de fora do /min. O share
        Physical vs Magic daqui alimenta o Damage: Physical → Armor Pen, Magic → Magic Pen, depois
        junta no Average Damage. Crit/extra condicionais entram com uptime.
      </p>

      <AssumptionsCard assumptions={assumptions} onChange={onChangeAssumptions} />

      {!hasWeapons && !hasClassOrTalents ? (
        <p className="state">
          Equipe armas, selecione picks no Arsenal, ou use class skills/talents com tooltip de dano.
        </p>
      ) : (
        <>
          <div className="weapon-analysis-grid">
            <div className="weapon-analysis-card">
              <h3>Throughput do kit</h3>
              <dl className="weapon-analysis-dl">
                <div>
                  <dt>Base /min</dt>
                  <dd>
                    {analysis.throughput.totalDamagePerMin > 0
                      ? formatDamage(analysis.throughput.totalDamagePerMin)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>via WD</dt>
                  <dd>
                    {analysis.throughput.totalWeaponDamagePerMin > 0
                      ? formatDamage(analysis.throughput.totalWeaponDamagePerMin)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>via attrs</dt>
                  <dd>
                    {analysis.throughput.totalAttrDamagePerMin > 0
                      ? formatDamage(analysis.throughput.totalAttrDamagePerMin)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>modifier efetivo</dt>
                  <dd>
                    {modifierPct != null ? `${modifierPct}%` : "—"}
                    {kitModifierEnabled && modifierPct != null ? (
                      <span className="weapon-analysis-pill">usado no Damage</span>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="weapon-analysis-card">
              <h3>Bonuses de talents</h3>
              {analysis.talentEffects.length === 0 ? (
                <p className="state">Nenhum talent com efeito parseável e pontos investidos.</p>
              ) : (
                <dl className="weapon-analysis-dl">
                  <div>
                    <dt>Crit chance</dt>
                    <dd>
                      {analysis.bonuses.critChanceFlat > 0
                        ? `+${(analysis.bonuses.critChanceFlat * 100).toFixed(1)}%`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Crit bonus</dt>
                    <dd>
                      {analysis.bonuses.critBonusFlat > 0
                        ? `+${(analysis.bonuses.critBonusFlat * 100).toFixed(1)} pp`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Extra dmg</dt>
                    <dd>
                      {analysis.bonuses.extraDamageFlat > 0
                        ? `+${(analysis.bonuses.extraDamageFlat * 100).toFixed(1)}%`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              )}
              {analysis.bonuses.conditionals.length > 0 ? (
                <ul className="weapon-analysis-notes">
                  {analysis.bonuses.conditionals.map((item) => (
                    <li key={`${item.sourceName}-${item.label}`}>
                      {item.sourceName}: {item.label} · uptime {(item.uptime * 100).toFixed(0)}%
                      {item.critChanceFlat
                        ? ` → +${(item.critChanceFlat * 100).toFixed(1)}% crit`
                        : ""}
                      {item.extraDamageFlat
                        ? ` → +${(item.extraDamageFlat * 100).toFixed(1)}% dmg`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {analysis.bonuses.notes.length > 0 ? (
                <ul className="weapon-analysis-notes">
                  {analysis.bonuses.notes.slice(0, 4).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="weapon-analysis-grid">
            <WeaponSummaryCard
              title="Main-hand"
              weapon={analysis.mainHand}
              emptyText="Nenhuma arma no slot main-hand."
            />
            <WeaponSummaryCard
              title="Arsenal"
              weapon={analysis.arsenalWeapon}
              emptyText="Nenhuma arma no slot arsenal."
            />
          </div>

          <div className="weapon-analysis-grid weapon-analysis-grid--shares">
            <ShareBars
              title="Dano base /min · Physical vs Magic"
              rows={analysis.throughput.damageByBucket}
              emptyLabel="Sem skills com throughput ativo."
              showValue
              valueSuffix="/min"
            />
            <ShareBars
              title="Dano base /min · por atributo"
              rows={analysis.throughput.damageByAttribute}
              emptyLabel="Sem contribuição de atributo no throughput."
              showValue
              valueSuffix="/min"
            />
            <ShareBars
              title="Composição · tipos (coeffs)"
              rows={analysis.composition.byType}
              emptyLabel="Nenhum hit parseado no kit."
            />
            <ShareBars
              title="Composição · atributos (coeffs)"
              rows={analysis.composition.byAttribute}
              emptyLabel="Nenhum atributo parseado no kit."
            />
          </div>

          <div className="weapon-analysis-section">
            <h3>
              Skills do kit ({analysis.parseableCount}/{analysis.entries.length} parseáveis ·{" "}
              {analysis.throughput.entries.length} no /min)
            </h3>
            {analysis.entries.length === 0 ? (
              <p className="state">Nenhuma skill/talent parseável encontrada neste loadout.</p>
            ) : (
              <div className="weapon-analysis-table-wrap">
                <table className="weapon-analysis-table">
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>Fonte</th>
                      <th>Hits</th>
                      <th>Base/cast</th>
                      <th>Rate</th>
                      <th>Base/min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.entries.map((entry) => (
                      <tr
                        key={`${entry.source}-${entry.id}`}
                        className={`${entry.includedInThroughput ? "" : "is-muted"} ${sourceTone(entry.source)}`}
                      >
                        <td>
                          <strong>{entry.name}</strong>
                          <span className="weapon-analysis-kind">
                            {entry.kind}
                            {entry.runeName ? ` · ${entry.runeName}` : ""}
                            {entry.talentPoints != null ? ` · ${entry.talentPoints} pts` : ""}
                          </span>
                        </td>
                        <td>{entry.sourceLabel}</td>
                        <td>{formatCoeff(entry.hits)}</td>
                        <td>{entry.parseable ? formatDamage(entry.basePerCast) : "—"}</td>
                        <td>
                          {entry.includedInThroughput
                            ? entry.rateNote ||
                              (entry.cooldown != null ? `${entry.cooldown}s` : "—")
                            : entry.rateMode && entry.rateMode !== "cooldown"
                              ? "off"
                              : entry.cooldown != null
                                ? `${entry.cooldown}s`
                                : "—"}
                        </td>
                        <td>
                          {entry.includedInThroughput ? formatDamage(entry.damagePerMin) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {analysis.unparsed.length > 0 ? (
            <p className="weapon-analysis-note">
              Sem tooltip de dano parseável:{" "}
              {analysis.unparsed.map((entry) => entry.name).join(", ")}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
