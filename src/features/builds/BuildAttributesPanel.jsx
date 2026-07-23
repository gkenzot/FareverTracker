import { useEffect, useId, useState } from "react";
import { BUILD_ATTRIBUTE_ROWS } from "./aggregateBuildAttributes";
import { getAttributeFormulaDoc } from "./attributeFormulaDocs";

const PRIMARY_KEYS = new Set(["vitality", "strength", "dexterity", "faith", "intellect"]);

function formatAttributeValue(value, format) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }

  if (format === "percent") {
    return `${(number * 100).toFixed(2)}%`;
  }

  if (format === "multiplier") {
    return `${(number * 100).toFixed(1)}%`;
  }

  if (Number.isInteger(number)) {
    return String(number);
  }

  return number.toFixed(2);
}

function primaryHint(breakdown, key) {
  const base = Number(breakdown?.base?.[key]) || 0;
  const gear = Number(breakdown?.gear?.[key]) || 0;
  if (!base && !gear) {
    return "";
  }
  return `base ${base} + gear ${gear}`;
}

function AttributeExplainModal({ attributeKey, attributes, onClose }) {
  const titleId = useId();
  const doc = getAttributeFormulaDoc(attributeKey);
  const row = BUILD_ATTRIBUTE_ROWS.find((entry) => entry.key === attributeKey);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!doc) {
    return null;
  }

  const live = typeof doc.buildLive === "function" ? doc.buildLive(attributes ?? {}) : [];

  return (
    <div className="build-attr-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="build-attr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="build-attr-modal-head">
          <div>
            <h3 id={titleId}>{doc.title}</h3>
            {row ? (
              <p className="build-attr-modal-value">
                Valor atual: <strong>{formatAttributeValue(attributes?.[attributeKey], row.format)}</strong>
              </p>
            ) : null}
          </div>
          <button type="button" className="build-lab-ghost-button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <p className="build-attr-modal-summary">{doc.summary}</p>

        <div className="build-attr-modal-block">
          <h4>Fórmula</h4>
          <code>{doc.formula}</code>
        </div>

        {live.length > 0 ? (
          <div className="build-attr-modal-block">
            <h4>Nesta build</h4>
            <ul>
              {live.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {doc.notes?.length ? (
          <div className="build-attr-modal-block">
            <h4>Notas</h4>
            <ul>
              {doc.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AttributeRow({ label, value, format, hint, onExplain }) {
  return (
    <div className="build-lab-stat build-lab-stat--single">
      <span>
        <button type="button" className="build-attr-name-button" onClick={onExplain}>
          {label}
        </button>
        {hint ? <small className="build-attr-hint">{hint}</small> : null}
      </span>
      <strong>{formatAttributeValue(value, format)}</strong>
    </div>
  );
}

export function BuildAttributesPanel({ attributes, buildLabel = "A" }) {
  const [explainKey, setExplainKey] = useState("");

  return (
    <section className="build-lab-results build-attributes-panel" aria-label="Build attributes">
      <div className="build-lab-stat build-lab-stat--header build-lab-stat--single">
        <span>Attribute</span>
        <strong>Build {buildLabel}</strong>
      </div>
      {BUILD_ATTRIBUTE_ROWS.map((row) => (
        <AttributeRow
          key={row.key}
          label={row.label}
          value={attributes?.[row.key]}
          format={row.format}
          hint={PRIMARY_KEYS.has(row.key) ? primaryHint(attributes?._breakdown, row.key) : ""}
          onExplain={() => setExplainKey(row.key)}
        />
      ))}
      <p className="build-attributes-note">
        Clique no nome do atributo para ver a fórmula. Base L25 + gear + adereços; Arsenal a 40%;
        aditivos de skill ignorados.
      </p>

      {explainKey ? (
        <AttributeExplainModal
          attributeKey={explainKey}
          attributes={attributes}
          onClose={() => setExplainKey("")}
        />
      ) : null}
    </section>
  );
}
