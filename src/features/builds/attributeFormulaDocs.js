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
    summary: "Atributo primário somado da base da classe (L25) com o gear e adereços.",
    formula: "Vitality = base da classe + gear + adereços",
    notes: ["Arsenal contribui só com 40% dos stats da arma/escudo."],
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
    summary: "Atributo primário. No Warrior entra no Critical Bonus (junto com Faith).",
    formula: "Strength = base da classe + gear + adereços",
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
    summary: "Atributo primário. Soma Critical Chance à razão de +0,1% por ponto.",
    formula: "Dexterity = base da classe + gear + adereços",
    buildLive: (attrs) => {
      const b = attrs?._breakdown;
      return [
        `Base: ${num(b?.base?.dexterity, 0)}`,
        `Gear: ${num(b?.gear?.dexterity, 0)}`,
        `Total: ${num(attrs?.dexterity, 0)}`,
        `Contribuição ao crit: ${pct((Number(attrs?.dexterity) || 0) * 0.001)}`
      ];
    }
  },
  faith: {
    title: "Faith",
    summary: "Atributo primário. Entra no Critical Bonus (junto com Strength).",
    formula: "Faith = base da classe + gear + adereços",
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
    summary: "Atributo primário. Soma Critical Chance à razão de +0,1% por ponto.",
    formula: "Intellect = base da classe + gear + adereços",
    buildLive: (attrs) => {
      const b = attrs?._breakdown;
      return [
        `Base: ${num(b?.base?.intellect, 0)}`,
        `Gear: ${num(b?.gear?.intellect, 0)}`,
        `Total: ${num(attrs?.intellect, 0)}`,
        `Contribuição ao crit: ${pct((Number(attrs?.intellect) || 0) * 0.001)}`
      ];
    }
  },
  criticalChance: {
    title: "Critical chance",
    summary: "Mistura base fixa, Dex/Int, rating Critical do gear e bônus flat de upgrade ★3+ (ex.: Worldsplitter).",
    formula:
      "Crit % = 0,2% + 0,1%×(Dex+Int) + CriticalRating÷19 + bônus flat de arma ★3+",
    notes: [
      "Cada 19 de Critical rating ≈ +1% de chance.",
      "Penalidade de Critical negativa do mesmo Cursed Eye não empilha entre anéis.",
      "Arsenal: stats base a 40%; o passivo ★3+ conta cheio."
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
    summary: "Começa em 150% e sobe com Strength + Faith em curva soft-cap (não é linear em stacks altos).",
    formula: "Bonus = 150% + 5,76% × S ÷ (S + 205,4),  onde S = Strength + Faith",
    notes: ["Em stacks baixos aproxima +0,02 pp por ponto de Str/Faith; depois abranda."],
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
    summary: "Conversão linear do rating Armor Penetration do gear (e bônus % de upgrade ★3+ se houver).",
    formula: `AP % = ArmorPenRating ÷ ${ARMOR_PEN_RATING_PER_PERCENT.toFixed(4)} ÷ 100  (K = 35÷4,6)`,
    notes: [
      "Calibrado com Beefury +35 rating → 4,6%.",
      "O jogo pode mostrar 1 casa com arredondamento para cima (ex.: 23,53% → 23,6%)."
    ],
    buildLive: (attrs) => {
      const rating = Number(attrs?._raw?.armorPenRating) || 0;
      const fromRating = ratingToPercent(rating, ARMOR_PEN_RATING_PER_PERCENT);
      const flat = Number(attrs?._breakdown?.weaponUpgrades?.armorPenetration) || 0;
      return [
        `Armor Pen rating: ${num(rating, 0)}`,
        `Da conversão: ${pct(fromRating)}`,
        flat ? `Upgrade ★3+ flat: ${pct(flat)}` : null,
        `Total (interno): ${pct(attrs?.armorPenetration)}`
      ].filter(Boolean);
    }
  },
  magicPenetration: {
    title: "Magic penetration",
    summary: "Mesma escala linear do Armor Penetration, aplicada ao rating Magic Penetration.",
    formula: `MP % = MagicPenRating ÷ ${ARMOR_PEN_RATING_PER_PERCENT.toFixed(4)} ÷ 100`,
    buildLive: (attrs) => {
      const rating = Number(attrs?._raw?.magicPenRating) || 0;
      const fromRating = ratingToPercent(rating, ARMOR_PEN_RATING_PER_PERCENT);
      const flat = Number(attrs?._breakdown?.weaponUpgrades?.magicPenetration) || 0;
      return [
        `Magic Pen rating: ${num(rating, 0)}`,
        `Da conversão: ${pct(fromRating)}`,
        flat ? `Upgrade ★3+ flat: ${pct(flat)}` : null,
        `Total: ${pct(attrs?.magicPenetration)}`
      ].filter(Boolean);
    }
  },
  fervor: {
    title: "Fervor",
    summary: "Conversão linear do rating Fervor. Usa o mesmo K do Critical Chance (19).",
    formula: `Fervor % = FervorRating ÷ ${FERVOR_RATING_PER_PERCENT} ÷ 100`,
    notes: ["Cada 19 de Fervor rating ≈ +1%."],
    buildLive: (attrs) => {
      const rating = Number(attrs?._raw?.fervorRating) || 0;
      const fromRating = ratingToPercent(rating, FERVOR_RATING_PER_PERCENT);
      const flat = Number(attrs?._breakdown?.weaponUpgrades?.fervor) || 0;
      return [
        `Fervor rating: ${num(rating, 0)}`,
        `Da conversão: ${pct(fromRating)}`,
        flat ? `Upgrade ★3+ flat: ${pct(flat)}` : null,
        `Total: ${pct(attrs?.fervor)}`
      ].filter(Boolean);
    }
  },
  block: {
    title: "Block",
    summary: "Chance fixa por arma/escudo equipados (não usa rating). Arsenal não conta.",
    formula: "Block = max(0, 50% se main-hand arma, 60% se off-hand escudo)",
    notes: ["Com arma + escudo fica o maior valor (60%)."],
    buildLive: (attrs) => [`Total: ${pct(attrs?.block, 0)}`]
  },
  dodgeChance: {
    title: "Dodge chance",
    summary: "Vem da base da classe (L25 nu). Gear ainda não adiciona dodge nesta ficha.",
    formula: "Dodge = base da classe (+ gear Dodge Chance, se houver)",
    buildLive: (attrs) => [`Total: ${pct(attrs?.dodgeChance)}`]
  },
  magicMastery: {
    title: "Magic mastery",
    summary: "Valor de mastery mágica somado do gear/adereços e bônus % de upgrade ★3+ quando aplicável.",
    formula: "Magic Mastery = soma do gear (+ bônus ★3+ em pontos percentuais)",
    buildLive: (attrs) => [`Total: ${num(attrs?.magicMastery)}`]
  },
  physicalMastery: {
    title: "Physical mastery",
    summary: "Valor de mastery física somado do gear/adereços e bônus % de upgrade ★3+ quando aplicável.",
    formula: "Physical Mastery = soma do gear (+ bônus ★3+ em pontos percentuais)",
    buildLive: (attrs) => [`Total: ${num(attrs?.physicalMastery)}`]
  },
  armor: {
    title: "Armor",
    summary: "Soma direta de Armor do equipamento (escudo no arsenal também a 40%).",
    formula: "Armor = Σ Armor do gear (arsenal × 0,4)",
    buildLive: (attrs) => [`Total: ${num(attrs?.armor, 0)}`]
  },
  maximumHealth: {
    title: "Maximum health",
    summary: "Três pontos de vida por Vitality, mais Max Health flat do gear se existir.",
    formula: "HP = MaxHealthFlat + Vitality × 3",
    buildLive: (attrs) => {
      const vit = Number(attrs?.vitality) || 0;
      return [`Vitality ${vit} × 3 = ${vit * 3}`, `Total: ${num(attrs?.maximumHealth, 0)}`];
    }
  },
  healthRegen: {
    title: "Health regen",
    summary: "Curva soft-cap em cima da Vitality total (não é linear com ΔVit em stacks altos).",
    formula: "Regen = 0,301 + 5,047 × Vit ÷ (Vit + 202)",
    notes: ["Calibrado: nu 1,1 @38 Vit · Beefury 1,6 @70 · build 2,6 @169."],
    buildLive: (attrs) => {
      const vit = Number(attrs?._raw?.vitality ?? attrs?.vitality) || 0;
      return [`Vitality: ${num(vit, 0)}`, `Total: ${num(attrs?.healthRegen)}`];
    }
  }
};

export function getAttributeFormulaDoc(key) {
  return ATTRIBUTE_FORMULA_DOCS[key] ?? null;
}
