import {
  ARMOR_PEN_RATING_PER_PERCENT,
  CRIT_CHANCE_RATING_PER_PERCENT,
  FERVOR_RATING_PER_PERCENT,
  ratingToPercent
} from "./damageFormulas";

function pct(fraction, digits = 2) {
  const n = Number(fraction);
  if (!Number.isFinite(n)) {
    return "—";
  }
  return `${(n * 100).toFixed(digits)}%`;
}

function num(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "—";
  }
  if (Number.isInteger(n)) {
    return String(n);
  }
  return n.toFixed(digits);
}

/**
 * Static formula copy + optional live breakdown for the Attributes explain modal.
 * @type {Record<string, { title: string, summary: string, formula: string, notes?: string[], buildLive?: (attrs: object) => string[] }>}
 */
const ATTRIBUTE_FORMULA_DOCS = {
  vitality: {
    title: "Vitality",
    summary: "Primary attribute from class base (L25) plus gear and adornments.",
    formula: "Vitality = class base + gear + adornments",
    notes: ["Arsenal contributes only 40% of the weapon/shield stats."],
    buildLive: (attrs) => {
      const b = attrs?._breakdown;
      return [
        `Base: ${num(b?.base?.vitality, 0)}`,
        `Gear: ${num(b?.gear?.vitality, 0)}`,
        `Total: ${num(attrs?.vitality, 0)}`
      ];
    }
  },
  strength: {
    title: "Strength",
    summary: "Primary attribute. On Warrior it feeds Critical Bonus (with Faith).",
    formula: "Strength = class base + gear + adornments",
    buildLive: (attrs) => {
      const b = attrs?._breakdown;
      return [
        `Base: ${num(b?.base?.strength, 0)}`,
        `Gear: ${num(b?.gear?.strength, 0)}`,
        `Total: ${num(attrs?.strength, 0)}`
      ];
    }
  },
  dexterity: {
    title: "Dexterity",
    summary: "Primary attribute. Adds Critical Chance at +0.1% per point.",
    formula: "Dexterity = class base + gear + adornments",
    buildLive: (attrs) => {
      const b = attrs?._breakdown;
      return [
        `Base: ${num(b?.base?.dexterity, 0)}`,
        `Gear: ${num(b?.gear?.dexterity, 0)}`,
        `Total: ${num(attrs?.dexterity, 0)}`,
        `Crit contribution: ${pct((Number(attrs?.dexterity) || 0) * 0.001)}`
      ];
    }
  },
  faith: {
    title: "Faith",
    summary: "Primary attribute. Feeds Critical Bonus (with Strength).",
    formula: "Faith = class base + gear + adornments",
    buildLive: (attrs) => {
      const b = attrs?._breakdown;
      return [
        `Base: ${num(b?.base?.faith, 0)}`,
        `Gear: ${num(b?.gear?.faith, 0)}`,
        `Total: ${num(attrs?.faith, 0)}`
      ];
    }
  },
  intellect: {
    title: "Intellect",
    summary: "Primary attribute. Adds Critical Chance at +0.1% per point.",
    formula: "Intellect = class base + gear + adornments",
    buildLive: (attrs) => {
      const b = attrs?._breakdown;
      return [
        `Base: ${num(b?.base?.intellect, 0)}`,
        `Gear: ${num(b?.gear?.intellect, 0)}`,
        `Total: ${num(attrs?.intellect, 0)}`,
        `Crit contribution: ${pct((Number(attrs?.intellect) || 0) * 0.001)}`
      ];
    }
  },
  criticalChance: {
    title: "Critical chance",
    summary:
      "Mix of fixed base, Dex/Int, Critical rating from gear, and flat ★3+ upgrade bonuses (e.g. Worldsplitter).",
    formula: "Crit % = 0.2% + 0.1%×(Dex+Int) + CriticalRating÷19 + flat weapon ★3+ bonus",
    notes: [
      "Every 19 Critical rating ≈ +1% chance.",
      "Negative Critical penalty from the same Cursed Eye does not stack across rings.",
      "Arsenal: base stats at 40%; the ★3+ passive counts at full value."
    ],
    buildLive: (attrs) => {
      const raw = attrs?._raw ?? {};
      const dex = Number(raw.dexterity) || 0;
      const intellect = Number(raw.intellect) || 0;
      const rating = Number(raw.critRating) || 0;
      const fromAttrs = (dex + intellect) * 0.001;
      const fromRating = ratingToPercent(rating, CRIT_CHANCE_RATING_PER_PERCENT);
      const flat = Number(attrs?._breakdown?.weaponUpgrades?.criticalChance) || 0;
      const base = 0.002;
      return [
        `Base: ${pct(base)}`,
        `Dex+Int (${dex}+${intellect}): ${pct(fromAttrs)}`,
        `Critical rating ${num(rating, 0)} ÷ 19: ${pct(fromRating)}`,
        flat ? `Upgrade ★3+ flat: ${pct(flat)}` : "Upgrade ★3+ flat: 0%",
        `Total: ${pct(attrs?.criticalChance)}`
      ];
    }
  },
  criticalBonus: {
    title: "Critical Bonus",
    summary: "Starts at 150% and scales with Strength + Faith on a soft-cap curve (not linear at high stacks).",
    formula: "Bonus = 150% + 5.76% × S ÷ (S + 205.4),  where S = Strength + Faith",
    notes: ["At low stacks ≈ +0.02 pp per Str/Faith point; then it softens."],
    buildLive: (attrs) => {
      const raw = attrs?._raw ?? {};
      const s = (Number(raw.strength) || 0) + (Number(raw.faith) || 0);
      const add = (0.0576 * s) / (s + 205.4);
      return [
        `S = Str+Faith = ${num(s, 0)}`,
        `Soft-cap add: ${pct(add)}`,
        `Total: ${pct(attrs?.criticalBonus, 1)}`
      ];
    }
  },
  armorPenetration: {
    title: "Armor penetration",
    summary: "Linear conversion of Armor Penetration rating from gear (plus ★3+ upgrade % if any).",
    formula: `AP % = ArmorPenRating ÷ ${ARMOR_PEN_RATING_PER_PERCENT.toFixed(4)} ÷ 100  (K = 35÷4.6)`,
    notes: [
      "Calibrated with Beefury +35 rating → 4.6%.",
      "The game may show 1 decimal rounded up (e.g. 23.53% → 23.6%)."
    ],
    buildLive: (attrs) => {
      const rating = Number(attrs?._raw?.armorPenRating) || 0;
      const fromRating = ratingToPercent(rating, ARMOR_PEN_RATING_PER_PERCENT);
      const flat = Number(attrs?._breakdown?.weaponUpgrades?.armorPenetration) || 0;
      return [
        `Armor Pen rating: ${num(rating, 0)}`,
        `From conversion: ${pct(fromRating)}`,
        flat ? `Upgrade ★3+ flat: ${pct(flat)}` : null,
        `Total (internal): ${pct(attrs?.armorPenetration)}`
      ].filter(Boolean);
    }
  },
  magicPenetration: {
    title: "Magic penetration",
    summary: "Same linear scale as Armor Penetration, applied to Magic Penetration rating.",
    formula: `MP % = MagicPenRating ÷ ${ARMOR_PEN_RATING_PER_PERCENT.toFixed(4)} ÷ 100`,
    buildLive: (attrs) => {
      const rating = Number(attrs?._raw?.magicPenRating) || 0;
      const fromRating = ratingToPercent(rating, ARMOR_PEN_RATING_PER_PERCENT);
      const flat = Number(attrs?._breakdown?.weaponUpgrades?.magicPenetration) || 0;
      return [
        `Magic Pen rating: ${num(rating, 0)}`,
        `From conversion: ${pct(fromRating)}`,
        flat ? `Upgrade ★3+ flat: ${pct(flat)}` : null,
        `Total: ${pct(attrs?.magicPenetration)}`
      ].filter(Boolean);
    }
  },
  fervor: {
    title: "Fervor",
    summary: "Linear conversion of Fervor rating. Uses the same K as Critical Chance (19).",
    formula: `Fervor % = FervorRating ÷ ${FERVOR_RATING_PER_PERCENT} ÷ 100`,
    notes: ["Every 19 Fervor rating ≈ +1%."],
    buildLive: (attrs) => {
      const rating = Number(attrs?._raw?.fervorRating) || 0;
      const fromRating = ratingToPercent(rating, FERVOR_RATING_PER_PERCENT);
      const flat = Number(attrs?._breakdown?.weaponUpgrades?.fervor) || 0;
      return [
        `Fervor rating: ${num(rating, 0)}`,
        `From conversion: ${pct(fromRating)}`,
        flat ? `Upgrade ★3+ flat: ${pct(flat)}` : null,
        `Total: ${pct(attrs?.fervor)}`
      ].filter(Boolean);
    }
  },
  block: {
    title: "Block",
    summary: "Fixed chance from equipped weapon/shield (no rating). Arsenal does not count.",
    formula: "Block = max(0, 50% if main-hand weapon, 60% if off-hand shield)",
    notes: ["With weapon + shield, the higher value wins (60%)."],
    buildLive: (attrs) => [`Total: ${pct(attrs?.block, 0)}`]
  },
  dodgeChance: {
    title: "Dodge chance",
    summary: "From class base (naked L25). Gear does not add dodge on this sheet yet.",
    formula: "Dodge = class base (+ gear Dodge Chance, if any)",
    buildLive: (attrs) => [`Total: ${pct(attrs?.dodgeChance)}`]
  },
  magicMastery: {
    title: "Magic mastery",
    summary: "Magic mastery from gear/adornments plus ★3+ upgrade % when applicable.",
    formula: "Magic Mastery = gear sum (+ ★3+ bonus in percentage points)",
    buildLive: (attrs) => [`Total: ${num(attrs?.magicMastery)}`]
  },
  physicalMastery: {
    title: "Physical mastery",
    summary: "Physical mastery from gear/adornments plus ★3+ upgrade % when applicable.",
    formula: "Physical Mastery = gear sum (+ ★3+ bonus in percentage points)",
    buildLive: (attrs) => [`Total: ${num(attrs?.physicalMastery)}`]
  },
  armor: {
    title: "Armor",
    summary: "Direct sum of Armor from equipment (arsenal shield also at 40%).",
    formula: "Armor = Σ gear Armor (arsenal × 0.4)",
    buildLive: (attrs) => [`Total: ${num(attrs?.armor, 0)}`]
  },
  maximumHealth: {
    title: "Maximum health",
    summary: "Three HP per Vitality, plus flat Max Health from gear if present.",
    formula: "HP = MaxHealthFlat + Vitality × 3",
    buildLive: (attrs) => {
      const vit = Number(attrs?.vitality) || 0;
      return [`Vitality ${vit} × 3 = ${vit * 3}`, `Total: ${num(attrs?.maximumHealth, 0)}`];
    }
  },
  healthRegen: {
    title: "Health regen",
    summary: "Soft-cap curve on total Vitality (not linear with ΔVit at high stacks).",
    formula: "Regen = 0.301 + 5.047 × Vit ÷ (Vit + 202)",
    notes: ["Calibrated: naked 1.1 @38 Vit · Beefury 1.6 @70 · build 2.6 @169."],
    buildLive: (attrs) => {
      const vit = Number(attrs?._raw?.vitality ?? attrs?.vitality) || 0;
      return [`Vitality: ${num(vit, 0)}`, `Total: ${num(attrs?.healthRegen)}`];
    }
  }
};

export function getAttributeFormulaDoc(key) {
  return ATTRIBUTE_FORMULA_DOCS[key] ?? null;
}
