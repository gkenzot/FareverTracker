import { useMemo, useState } from "react";
import {
  formatDamageProfileLabel,
  formatDamageProfileSource
} from "./buildDamageStats";
import {
  buildAverageDamageCurve,
  buildSecondaryIsolationCurves,
  calculateBuildDamage,
  rankGearSecondaryChoices,
  sampleEnemyDefenseRange
} from "./damageFormulas";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 280;
const PAD = { top: 28, right: 24, bottom: 40, left: 56 };
const BUILD_COLORS = ["#7dffa8", "#8fb7ff", "#f0c674", "#ff9b7d", "#c4a7ff"];

function niceStep(span, count = 5) {
  const raw = Math.abs(span) / Math.max(1, count - 1);
  if (!Number.isFinite(raw) || raw === 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  if (residual >= 5) {
    return 5 * magnitude;
  }
  if (residual >= 2) {
    return 2 * magnitude;
  }
  return magnitude;
}

/** Axis ticks on clean steps only — never force raw min/max onto the axis. */
function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0];
  }

  let lo = min;
  let hi = max;
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }

  const step = niceStep(hi - lo, count);
  const start = Math.ceil(lo / step - 1e-12) * step;
  const end = Math.floor(hi / step + 1e-12) * step;
  const ticks = [];

  for (let value = start; value <= end + step * 1e-9; value += step) {
    ticks.push(Number((value).toPrecision(12)));
  }

  return ticks.length ? ticks : [Number((Math.round(lo / step) * step).toPrecision(12))];
}

function niceDomain(min, max, count = 5, { includeZero = false, clampMin0 = false } = {}) {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : 1;

  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }

  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }

  const step = niceStep(hi - lo, count);
  let niceMin = Math.floor(lo / step - 1e-12) * step;
  let niceMax = Math.ceil(hi / step + 1e-12) * step;

  if (clampMin0) {
    niceMin = Math.max(0, niceMin);
  }
  if (includeZero) {
    niceMin = Math.min(niceMin, 0);
    niceMax = Math.max(niceMax, 0);
  }
  if (niceMin === niceMax) {
    niceMax = niceMin + step;
  }

  return [Number(niceMin.toPrecision(12)), Number(niceMax.toPrecision(12))];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatAxisNumber(value) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 10000) {
    return `${Math.round(rounded / 1000)}k`;
  }
  return String(rounded);
}

/** Percent labels without decimals (axis, tooltips, cards). */
function formatPercent(value) {
  const pct = Math.round((Number(value) || 0) * 100);
  const signed = pct > 0 ? "+" : "";
  return `${signed}${pct}%`;
}

function linePath(points) {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

function yDomainFromSeries(series, xMin, xMax, { includeZero = false, isPercent = false } = {}) {
  const values = series.flatMap((item) =>
    item.points
      .filter((point) => point.x >= xMin - 1e-9 && point.x <= xMax + 1e-9)
      .map((point) => point.y)
  );

  if (!values.length) {
    return isPercent ? niceDomain(-0.05, 0.05, 5, { includeZero: true }) : niceDomain(0, 1, 5, { clampMin0: true });
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (includeZero || isPercent) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  const pad = isPercent ? Math.max(0.01, (max - min) * 0.12) : (max - min) * 0.08 || 1;
  const rawMin = isPercent ? min - pad : Math.max(0, min - pad);
  const rawMax = max + pad;

  if (isPercent) {
    return niceDomain(rawMin, rawMax, 5, { includeZero: true });
  }
  return niceDomain(rawMin, rawMax, 5, { clampMin0: true });
}


function clipSeriesToXDomain(points, xMin, xMax) {
  if (!points?.length) {
    return [];
  }

  const clipped = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const prev = points[index - 1];
    const inside = point.x >= xMin - 1e-9 && point.x <= xMax + 1e-9;
    const prevInside = prev ? prev.x >= xMin - 1e-9 && prev.x <= xMax + 1e-9 : false;

    if (prev && prevInside !== inside) {
      const edge = point.x < xMin || prev.x < xMin ? xMin : xMax;
      const span = point.x - prev.x;
      const t = span === 0 ? 0 : (edge - prev.x) / span;
      clipped.push({
        x: edge,
        y: prev.y + (point.y - prev.y) * t
      });
    }

    if (inside) {
      clipped.push(point);
    }
  }

  return clipped;
}

function ChartFrame({
  title,
  subtitle,
  xLabel,
  yLabel,
  xDomain,
  xDomainWide = null,
  yDomain = null,
  series,
  markers,
  guides = [],
  yIsPercent = false,
  hoverLabel,
  toolbarLeft = null
}) {
  const [hover, setHover] = useState(null);
  const [zoomed, setZoomed] = useState(true);
  const canZoom = Array.isArray(xDomainWide) && xDomainWide.length === 2;
  const clipId = useMemo(
    () => `chart-clip-${title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
    [title]
  );

  const rawXDomain = zoomed || !canZoom ? xDomain : xDomainWide;
  const rawXMin = rawXDomain[0];
  const rawXMax = rawXDomain[1];
  const [xMin, xMax] = useMemo(
    () => niceDomain(rawXMin, rawXMax, 6, { clampMin0: true }),
    [rawXMin, rawXMax]
  );

  const visibleSeries = useMemo(
    () =>
      series.map((item) => ({
        ...item,
        points: clipSeriesToXDomain(item.points, xMin, xMax)
      })),
    [series, xMin, xMax]
  );

  const activeYDomain = useMemo(() => {
    if (zoomed && Array.isArray(yDomain) && yDomain.length === 2) {
      return yIsPercent
        ? niceDomain(yDomain[0], yDomain[1], 5, { includeZero: true })
        : niceDomain(yDomain[0], yDomain[1], 5, { clampMin0: true });
    }
    return yDomainFromSeries(visibleSeries, xMin, xMax, {
      includeZero: yIsPercent,
      isPercent: yIsPercent
    });
  }, [zoomed, yDomain, visibleSeries, xMin, xMax, yIsPercent]);

  const [yMin, yMax] = activeYDomain;
  const plotWidth = CHART_WIDTH - PAD.left - PAD.right;
  const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  const xTicks = niceTicks(xMin, xMax, 6);
  const yTicks = niceTicks(yMin, yMax, 5);

  const scaleX = (value) => PAD.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
  const scaleY = (value) => PAD.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;

  const mappedSeries = visibleSeries.map((item) => ({
    ...item,
    points: item.points.map((point) => ({
      ...point,
      x: scaleX(point.x),
      y: scaleY(point.y)
    }))
  }));

  const mappedMarkers = markers
    .filter((marker) => marker.x >= xMin - 1e-9 && marker.x <= xMax + 1e-9)
    .map((marker) => ({
      ...marker,
      cx: scaleX(marker.x),
      cy: clamp(scaleY(marker.y), PAD.top, PAD.top + plotHeight)
    }));

  function handleMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const dataX = clamp(xMin + ratio * (xMax - xMin), xMin, xMax);
    const sourcePoints = visibleSeries[0]?.points ?? [];
    const nearest = sourcePoints.reduce(
      (best, point) => (Math.abs(point.x - dataX) < Math.abs(best.x - dataX) ? point : best),
      sourcePoints[0]
    );

    if (!nearest) {
      setHover(null);
      return;
    }

    setHover({
      x: nearest.x,
      cx: scaleX(nearest.x),
      values: visibleSeries.map((item) => {
        const match =
          item.points.find((point) => point.x === nearest.x) ??
          item.points.reduce((best, point) =>
            Math.abs(point.x - nearest.x) < Math.abs(best.x - nearest.x) ? point : best
          );
        return {
          key: item.key,
          label: item.label,
          color: item.color,
          value: match?.y ?? 0
        };
      })
    });
  }

  return (
    <article className="build-chart-card">
      <div className="build-chart-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="build-chart-toolbar">
          {toolbarLeft}
          {canZoom ? (
            <button
              type="button"
              className={`build-chart-zoom ${zoomed ? "is-zoomed" : ""}`}
              onClick={() => setZoomed((current) => !current)}
              title={zoomed ? "Zoom out" : "Zoom in"}
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
              aria-pressed={zoomed}
            >
              {zoomed ? "Zoom out" : "Zoom in"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="build-chart-frame">
        <div className="build-chart-legend build-chart-legend--overlay" aria-hidden="true">
          {series.map((item) => (
            <span key={item.key} style={{ "--swatch": item.color, color: item.color }}>
              {item.label}
            </span>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={title}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>

          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotWidth}
            height={plotHeight}
            className="build-chart-plot"
          />

          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={scaleX(tick)}
                x2={scaleX(tick)}
                y1={PAD.top}
                y2={PAD.top + plotHeight}
                className="build-chart-grid"
              />
              <text x={scaleX(tick)} y={PAD.top + plotHeight + 18} textAnchor="middle" className="build-chart-tick">
                {formatAxisNumber(tick)}
              </text>
            </g>
          ))}

          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotWidth}
                y1={scaleY(tick)}
                y2={scaleY(tick)}
                className="build-chart-grid"
              />
              <text x={PAD.left - 8} y={scaleY(tick) + 4} textAnchor="end" className="build-chart-tick">
                {yIsPercent ? formatPercent(tick) : formatAxisNumber(tick)}
              </text>
            </g>
          ))}

          <g clipPath={`url(#${clipId})`}>
            {guides
              .filter((guide) => guide.x >= xMin - 1e-9 && guide.x <= xMax + 1e-9)
              .map((guide) => (
                <g key={guide.key}>
                  <line
                    x1={scaleX(guide.x)}
                    x2={scaleX(guide.x)}
                    y1={PAD.top}
                    y2={PAD.top + plotHeight}
                    className="build-chart-guide"
                    stroke={guide.color}
                  />
                  <text
                    x={scaleX(guide.x) + 6}
                    y={PAD.top + 14}
                    className="build-chart-guide-label"
                    fill={guide.color}
                  >
                    {guide.label}
                  </text>
                </g>
              ))}

            {yMin < 0 && yMax > 0 ? (
              <line
                x1={PAD.left}
                x2={PAD.left + plotWidth}
                y1={scaleY(0)}
                y2={scaleY(0)}
                className="build-chart-zero"
              />
            ) : null}

            {mappedSeries.map((item) => (
              <path
                key={item.key}
                d={linePath(item.points)}
                fill="none"
                stroke={item.color}
                strokeWidth="1.4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {hover ? (
              <line
                x1={hover.cx}
                x2={hover.cx}
                y1={PAD.top}
                y2={PAD.top + plotHeight}
                className="build-chart-hover-line"
              />
            ) : null}

            {mappedMarkers.map((marker) => (
              <g key={marker.key}>
                <line
                  x1={marker.cx}
                  x2={marker.cx}
                  y1={PAD.top}
                  y2={PAD.top + plotHeight}
                  className="build-chart-marker-line"
                  stroke={marker.color}
                />
                <circle
                  cx={marker.cx}
                  cy={marker.cy}
                  r="5.5"
                  fill="#0b1220"
                  stroke={marker.color}
                  strokeWidth="1.8"
                />
                <circle cx={marker.cx} cy={marker.cy} r="2.5" fill={marker.color} />
                <text
                  x={marker.cx}
                  y={marker.cy - 12}
                  textAnchor="middle"
                  className="build-chart-marker-label"
                  fill={marker.color}
                >
                  {marker.shortLabel}
                </text>
              </g>
            ))}
          </g>

          <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 2} textAnchor="middle" className="build-chart-axis-label">
            {xLabel}
          </text>
          <text
            x={14}
            y={CHART_HEIGHT / 2}
            textAnchor="middle"
            className="build-chart-axis-label"
            transform={`rotate(-90 14 ${CHART_HEIGHT / 2})`}
          >
            {yLabel}
          </text>
        </svg>

        {hover ? (
          <div className="build-chart-tooltip" style={{ left: `${(hover.cx / CHART_WIDTH) * 100}%` }}>
            <strong>{hoverLabel?.(hover.x) ?? `Armor ${Math.round(hover.x)}`}</strong>
            {hover.values.map((value) => (
              <span key={value.key} style={{ color: value.color }}>
                {value.label}: {yIsPercent ? formatPercent(value.value) : value.value.toFixed(2)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}


function gainVsBaseline(build, baseline, enemyDefense) {
  const result = calculateBuildDamage({ ...build, enemyDefense });
  const base = calculateBuildDamage({ ...baseline, enemyDefense });
  return base.averageDamage > 0 ? result.averageDamage / base.averageDamage - 1 : 0;
}

export function BuildCharts({ builds = [], bossDefense = null }) {
  const entries = useMemo(
    () =>
      builds.map((entry, index) => {
        const stats = entry?.stats ?? entry;
        const label = entry?.label ?? String.fromCharCode(65 + index);
        const colorIndex = Number.isFinite(entry?.colorIndex) ? entry.colorIndex : index;
        return {
          key: `build-${label}-${index}`,
          label: `Build ${label}`,
          shortLabel: String(label),
          color: BUILD_COLORS[colorIndex % BUILD_COLORS.length],
          stats
        };
      }),
    [builds]
  );

  const activeBossDefense = Number.isFinite(Number(bossDefense))
    ? Number(bossDefense)
    : Number(entries[0]?.stats?.enemyDefense) || 0;

  const wideRange = useMemo(() => {
    const defenses = [
      ...entries.map((entry) => Number(entry.stats.enemyDefense) || 0),
      activeBossDefense
    ].filter((value) => Number.isFinite(value) && value >= 0);
    const maxFocus = defenses.length ? Math.max(...defenses) : 1500;
    const maxDefense = Math.max(2300, Math.ceil((maxFocus + 400) / 50) * 50);
    return { min: 0, max: maxDefense, step: 50 };
  }, [entries, activeBossDefense]);

  const focusRange = useMemo(() => {
    const defenses = [
      ...entries.map((entry) => Number(entry.stats.enemyDefense) || 0),
      activeBossDefense
    ].filter((value) => Number.isFinite(value) && value >= 0);

    const focusValues = defenses.length ? defenses : [1500];
    const minFocus = Math.min(...focusValues);
    const maxFocus = Math.max(...focusValues);
    const focusSpan = Math.max(0, maxFocus - minFocus);
    const pad = Math.max(250, focusSpan * 0.75, maxFocus * 0.2);
    const min = Math.max(0, Math.floor((minFocus - pad) / 50) * 50);
    const max = Math.min(wideRange.max, Math.ceil((maxFocus + pad) / 50) * 50);

    return { min, max: Math.max(min + 300, max), step: 25 };
  }, [entries, activeBossDefense, wideRange.max]);

  const curves = useMemo(
    () => entries.map((entry) => ({ ...entry, curve: buildAverageDamageCurve(entry.stats, wideRange) })),
    [entries, wideRange]
  );

  const baseline = entries[0]?.stats;

  const gainCurves = useMemo(() => {
    if (!baseline || entries.length < 2) {
      return [];
    }
    const defenses = sampleEnemyDefenseRange(wideRange);
    return entries.slice(1).map((entry) => ({
      ...entry,
      points: defenses.map((enemyDefense) => ({
        x: enemyDefense,
        y: gainVsBaseline(entry.stats, baseline, enemyDefense)
      }))
    }));
  }, [entries, baseline, wideRange]);

  const points = useMemo(
    () =>
      entries.map((entry) => {
        const enemyDefense = Number(entry.stats.enemyDefense) || 0;
        return {
          ...entry,
          enemyDefense,
          averageDamage: calculateBuildDamage(entry.stats).averageDamage,
          gainVsA: baseline ? gainVsBaseline(entry.stats, baseline, enemyDefense) : 0
        };
      }),
    [entries, baseline]
  );

  const damageDomainY = useMemo(() => {
    const series = curves.map((entry) => ({
      points: entry.curve.map((point) => ({ x: point.enemyDefense, y: point.averageDamage }))
    }));
    return yDomainFromSeries(series, focusRange.min, focusRange.max);
  }, [curves, focusRange]);

  const gainDomainY = useMemo(() => {
    const series = gainCurves.map((entry) => ({ points: entry.points }));
    return yDomainFromSeries(series, focusRange.min, focusRange.max, {
      includeZero: true,
      isPercent: true
    });
  }, [gainCurves, focusRange]);

  const guides =
    activeBossDefense > 0
      ? [
          {
            key: "boss",
            x: activeBossDefense,
            label: `Boss ${Math.round(activeBossDefense)}`,
            color: "#6f7f9f"
          }
        ]
      : [];

  const baselineLabel = entries[0]?.shortLabel ?? "A";
  const xDomainZoom = [focusRange.min, focusRange.max];
  const xDomainWide = [wideRange.min, wideRange.max];

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="build-charts" aria-label="Build comparison charts">
      <ChartFrame
        title="Average damage vs enemy armor"
        subtitle="Curvas das builds selecionadas. Os pontos marcam a Enemy Defense de cada uma."
        xLabel="Enemy Defense"
        yLabel="Average Damage"
        xDomain={xDomainZoom}
        xDomainWide={xDomainWide}
        yDomain={damageDomainY}
        guides={guides}
        series={curves.map((entry) => ({
          key: entry.key,
          label: entry.label,
          color: entry.color,
          points: entry.curve.map((point) => ({ x: point.enemyDefense, y: point.averageDamage }))
        }))}
        markers={points.map((point) => ({
          key: `point-${point.key}`,
          label: `${point.shortLabel} @ ${Math.round(point.enemyDefense)} → ${point.averageDamage.toFixed(2)}`,
          shortLabel: point.shortLabel,
          color: point.color,
          x: point.enemyDefense,
          y: point.averageDamage
        }))}
      />

      {gainCurves.length > 0 ? (
        <ChartFrame
          title={`Average damage gain vs Build ${baselineLabel}`}
          subtitle={`Positivo = essa build vence a Build ${baselineLabel} naquele armor.`}
          xLabel="Enemy Defense"
          yLabel={`Gain vs ${baselineLabel}`}
          xDomain={xDomainZoom}
          xDomainWide={xDomainWide}
          yDomain={gainDomainY}
          yIsPercent
          guides={guides}
          series={gainCurves.map((entry) => ({
            key: `gain-${entry.key}`,
            label: `${entry.shortLabel} vs ${baselineLabel}`,
            color: entry.color,
            points: entry.points
          }))}
          markers={points.slice(1).map((point) => ({
            key: `gain-point-${point.key}`,
            label: `${point.shortLabel} @ ${Math.round(point.enemyDefense)} → ${formatPercent(point.gainVsA)}`,
            shortLabel: point.shortLabel,
            color: point.color,
            x: point.enemyDefense,
            y: point.gainVsA
          }))}
        />
      ) : null}

      <div className="build-chart-point-cards">
        {points.map((point) => (
          <article key={point.key} className="build-chart-point-card" style={{ "--accent": point.color }}>
            <span>Ponto {point.label}</span>
            <strong>
              Armor {Math.round(point.enemyDefense)} → {point.averageDamage.toFixed(2)} dmg
            </strong>
            <small>
              {point.shortLabel === baselineLabel
                ? "Baseline"
                : `Gain vs ${baselineLabel} ${formatPercent(point.gainVsA)}`}{" "}
              · AP {(Number(point.stats.armorPenetration ?? point.stats.armorPen) * 100).toFixed(1)}%
              · MP {(Number(point.stats.magicPenetration) * 100).toFixed(1)}% · Fervor{" "}
              {(point.stats.fervor * 100).toFixed(2)}%
              {point.stats.damageProfile
                ? ` · ${formatDamageProfileLabel(point.stats.damageProfile)}`
                : ""}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Rank which secondary on gear tends to give more damage for this build. */
function GearSecondaryPriorityRank({ build = null, bossDefense = null }) {
  const stats = build?.stats ?? build;
  const label = build?.label ?? "A";

  const rank = useMemo(() => {
    if (!stats) {
      return null;
    }
    return rankGearSecondaryChoices(stats, { enemyDefense: bossDefense });
  }, [stats, bossDefense]);

  if (!rank?.entries?.length) {
    return null;
  }

  const top = rank.entries[0];

  return (
    <section className="gear-priority-rank" aria-label="O que priorizar no gear">
      <div className="gear-priority-rank-head">
        <h3>O que priorizar no gear</h3>
        <p>
          Build {label}: se duas peças forem parecidas,{" "}
          <strong style={{ color: top.color }}>{top.label}</strong> costuma dar mais dano agora.
        </p>
      </div>
      <ol className="gear-priority-rank-list">
        {rank.entries.map((entry, index) => {
          const gainPct = Math.round(entry.gain * 1000) / 10;
          const signed = gainPct > 0 ? "+" : "";
          return (
            <li key={entry.key} style={{ "--accent": entry.color }}>
              <span className="gear-priority-rank-place">{index + 1}º</span>
              <div className="gear-priority-rank-body">
                <strong>{entry.label}</strong>
                <small>
                  {signed}
                  {gainPct}% dano
                  {entry.deltaDamage !== 0
                    ? ` · ${entry.deltaDamage > 0 ? "+" : ""}${entry.deltaDamage.toFixed(2)}`
                    : ""}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="gear-priority-rank-note">
        Compara a mesma quantidade de secondary no item. Physical do kit aproveita Armor Pen; Magic
        aproveita Magic Pen. Para decidir uma peça específica, use Damage compare.
      </p>
    </section>
  );
}

/** Secondary isolation chart (Fer / AP / MP / Crit) for Damage analysis. */
export function SecondaryAnalysisCharts({ build = null, bossDefense = null }) {
  const [equalizeSecondaries, setEqualizeSecondaries] = useState(false);

  const stats = build?.stats ?? build;
  const label = build?.label ?? "A";
  const activeBossDefense = Number.isFinite(Number(bossDefense))
    ? Number(bossDefense)
    : Number(stats?.enemyDefense) || 0;

  const wideRange = useMemo(() => {
    const maxDefense = Math.max(2300, Math.ceil((activeBossDefense + 400) / 50) * 50);
    return { min: 0, max: maxDefense, step: 50 };
  }, [activeBossDefense]);

  const focusRange = useMemo(() => {
    const focus = activeBossDefense || 1500;
    const pad = Math.max(250, focus * 0.2);
    const min = Math.max(0, Math.floor((focus - pad) / 50) * 50);
    const max = Math.min(wideRange.max, Math.ceil((focus + pad) / 50) * 50);
    return { min, max: Math.max(min + 300, max), step: 25 };
  }, [activeBossDefense, wideRange.max]);

  const secondaryCurves = useMemo(() => {
    if (!stats) {
      return [];
    }
    return buildSecondaryIsolationCurves(stats, wideRange, { equalize: equalizeSecondaries });
  }, [stats, wideRange, equalizeSecondaries]);

  const secondaryEqualShare = secondaryCurves[0]?.equalShare ?? null;
  const secondaryEqualTotal =
    secondaryEqualShare != null ? secondaryEqualShare * 4 : null;

  const secondaryPoints = useMemo(
    () =>
      secondaryCurves.map((choice) => {
        const enemyDefense = activeBossDefense;
        const averageDamage = calculateBuildDamage({
          ...choice.stats,
          enemyDefense
        }).averageDamage;
        return {
          ...choice,
          enemyDefense,
          averageDamage
        };
      }),
    [secondaryCurves, activeBossDefense]
  );

  const rankedSecondaryPoints = useMemo(
    () => [...secondaryPoints].sort((left, right) => right.averageDamage - left.averageDamage),
    [secondaryPoints]
  );

  const secondaryDomainY = useMemo(() => {
    const series = secondaryCurves.map((entry) => ({
      points: entry.curve.map((point) => ({ x: point.enemyDefense, y: point.averageDamage }))
    }));
    return yDomainFromSeries(series, focusRange.min, focusRange.max);
  }, [secondaryCurves, focusRange]);

  const guides =
    activeBossDefense > 0
      ? [
          {
            key: "boss",
            x: activeBossDefense,
            label: `Boss ${Math.round(activeBossDefense)}`,
            color: "#6f7f9f"
          }
        ]
      : [];

  const profile = stats?.damageProfile ?? stats?._meta?.damageProfile ?? null;
  const profileLabel = formatDamageProfileLabel(profile);
  const profileSource = formatDamageProfileSource(profile);

  if (!stats || secondaryCurves.length === 0) {
    return null;
  }

  return (
    <section className="build-charts" aria-label="Damage analysis charts">
      <GearSecondaryPriorityRank build={build} bossDefense={activeBossDefense} />
      <p className="build-lab-column-note">
        Dano vivo: Physical usa Armor Pen, Magic usa Magic Pen; o Average Damage junta pelos shares do
        kit
        {profile ? ` (${profileLabel} · ${profileSource})` : ""}. As linhas abaixo isolam cada
        secondary (AP = hipotético 100% Physical, MP = 100% Magic).
      </p>
      <ChartFrame
        title="Fervor vs Armor Pen vs Magic Pen vs Crit"
        subtitle={
          equalizeSecondaries && secondaryEqualShare != null
            ? `Build ${label}: Fer+AP+MP+Crit equalizados. Total ${Math.round(secondaryEqualTotal * 100)}% · share ${Math.round(secondaryEqualShare * 100)}% cada.`
            : `Isola cada secondary real da Build ${label} (os outros zeram).`
        }
        xLabel="Enemy Defense"
        yLabel="Average Damage"
        xDomain={[focusRange.min, focusRange.max]}
        xDomainWide={[wideRange.min, wideRange.max]}
        yDomain={secondaryDomainY}
        guides={guides}
        toolbarLeft={
          <button
            type="button"
            className={`build-chart-zoom ${equalizeSecondaries ? "is-zoomed" : ""}`}
            aria-pressed={equalizeSecondaries}
            onClick={() => setEqualizeSecondaries((current) => !current)}
            title="Soma Fer+AP+MP+Crit, divide por 4 e aplica o mesmo valor em cada linha"
          >
            Equalizar
          </button>
        }
        series={secondaryCurves.map((entry) => ({
          key: `secondary-${entry.key}`,
          label: entry.label,
          color: entry.color,
          points: entry.curve.map((point) => ({
            x: point.enemyDefense,
            y: point.averageDamage
          }))
        }))}
        markers={secondaryPoints.map((point) => ({
          key: `secondary-point-${point.key}`,
          label: `${point.shortLabel} @ ${Math.round(point.enemyDefense)} → ${point.averageDamage.toFixed(2)}`,
          shortLabel: point.shortLabel,
          color: point.color,
          x: point.enemyDefense,
          y: point.averageDamage
        }))}
      />

      <div className="build-chart-point-cards build-chart-point-cards--analysis">
        {rankedSecondaryPoints.map((point) => (
          <article
            key={`secondary-card-${point.key}`}
            className="build-chart-point-card build-chart-point-card--inline"
            style={{ "--accent": point.color }}
          >
            <span>
              {point.label}
              {point.key === "armorPen" ? " · Physical" : null}
              {point.key === "magicPen" ? " · Magic" : null}
            </span>
            <strong>{point.averageDamage.toFixed(2)} dmg</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
