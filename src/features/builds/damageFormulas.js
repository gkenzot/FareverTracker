/** Constants and conversions from Farever Calculator.ods (Aragon, 12-May-2026). */

export const DEFENSE_MODIFIER = 2285;

/** Armor/Magic pen (ficha Beefury +35 rating → 4.6%). every ≈7.6087 rating = 1% */
export const ARMOR_PEN_RATING_PER_PERCENT = 35 / 4.6;

/** Fervor (Kek: 169 rating → 8.9%): every 19 rating = 1% — same K as crit chance */
export const FERVOR_RATING_PER_PERCENT = 19;

/** Crit chance (ficha Light Practice +57 Critical → +3%): every 19 rating = 1% */
export const CRIT_CHANCE_RATING_PER_PERCENT = 19;

export const DEFAULT_BUILD = {
  weaponDamage: 36,
  modifier: 0.7875,
  attribute1: 34,
  attribute2: 0,
  fervor: 0.058,
  mastery: 0,
  criticalChance: 0.134,
  criticalBonus: 1.52,
  extraDamage1: 0.25,
  extraDamage2: 0,
  armorPen: 0.105,
  enemyDefense: 1500,
  defenseModifier: DEFENSE_MODIFIER
};

export const DEFAULT_BUILD_B = {
  ...DEFAULT_BUILD,
  fervor: 0.083,
  criticalChance: 0,
  criticalBonus: 1.507,
  armorPen: 0.045
};

export function ratingToPercent(rating, ratingPerPercent) {
  const value = Number(rating) || 0;
  const per = Number(ratingPerPercent) || 1;
  return value / (per * 100);
}

export function percentToRating(percent, ratingPerPercent) {
  const value = Number(percent) || 0;
  const per = Number(ratingPerPercent) || 1;
  return value * per * 100;
}

/**
 * Same secondary budget on an item (~equal rating), ranked by Average Damage gain
 * on the live build (Physical→AP / Magic→MP split kept intact).
 */
export const GEAR_SECONDARY_RATING_BUDGET = 38;

export const GEAR_SECONDARY_CHOICES = [
  {
    key: "fervor",
    label: "Fervor",
    shortLabel: "Fer",
    color: "#7dffa8",
    ratingPerPercent: FERVOR_RATING_PER_PERCENT,
    apply(build, deltaPercent) {
      return { ...build, fervor: (Number(build.fervor) || 0) + deltaPercent };
    }
  },
  {
    key: "armorPen",
    label: "Armor Penetration",
    shortLabel: "AP",
    color: "#8fb7ff",
    ratingPerPercent: ARMOR_PEN_RATING_PER_PERCENT,
    apply(build, deltaPercent) {
      const next = (Number(build.armorPenetration ?? build.armorPen) || 0) + deltaPercent;
      return {
        ...build,
        armorPenetration: next,
        armorPen: (Number(build.armorPen) || 0) + deltaPercent
      };
    }
  },
  {
    key: "magicPen",
    label: "Magic Penetration",
    shortLabel: "MP",
    color: "#c4a7ff",
    ratingPerPercent: ARMOR_PEN_RATING_PER_PERCENT,
    apply(build, deltaPercent) {
      return {
        ...build,
        magicPenetration: (Number(build.magicPenetration) || 0) + deltaPercent
      };
    }
  },
  {
    key: "crit",
    label: "Critical Chance",
    shortLabel: "Crit",
    color: "#f0c674",
    ratingPerPercent: CRIT_CHANCE_RATING_PER_PERCENT,
    apply(build, deltaPercent) {
      return {
        ...build,
        criticalChance: (Number(build.criticalChance) || 0) + deltaPercent
      };
    }
  }
];

/**
 * Rank which secondary on gear tends to give more damage for this build/boss.
 * Uses the same rating budget on each option (player language: "mesma quantidade no item").
 */
export function rankGearSecondaryChoices(
  build,
  { ratingBudget = GEAR_SECONDARY_RATING_BUDGET, enemyDefense = null } = {}
) {
  if (!build) {
    return { baseline: 0, ratingBudget, entries: [] };
  }

  const baseStats = {
    ...build,
    enemyDefense:
      enemyDefense != null && Number.isFinite(Number(enemyDefense))
        ? Number(enemyDefense)
        : Number(build.enemyDefense) || 0
  };
  const baseline = calculateBuildDamage(baseStats).averageDamage;
  const budget = Math.max(1, Number(ratingBudget) || GEAR_SECONDARY_RATING_BUDGET);

  const entries = GEAR_SECONDARY_CHOICES.map((choice) => {
    const deltaPercent = ratingToPercent(budget, choice.ratingPerPercent);
    const bumped = choice.apply(baseStats, deltaPercent);
    const averageDamage = calculateBuildDamage(bumped).averageDamage;
    const deltaDamage = averageDamage - baseline;
    const gain = baseline > 0 ? averageDamage / baseline - 1 : 0;
    return {
      key: choice.key,
      label: choice.label,
      shortLabel: choice.shortLabel,
      color: choice.color,
      deltaPercent,
      averageDamage,
      deltaDamage,
      gain
    };
  }).sort((left, right) => right.deltaDamage - left.deltaDamage);

  return { baseline, ratingBudget: budget, entries };
}

/**
 * Single-bucket PvE hit (one pen + one mastery).
 * Critical Bonus is a full multiplier (e.g. 1.52 for 152%), not 1 + bonus.
 */
export function calculateSingleBucketDamage(build) {
  const weaponDamage = Number(build.weaponDamage) || 0;
  const modifier = Number(build.modifier) || 0;
  const attribute1 = Number(build.attribute1) || 0;
  const attribute2 = Number(build.attribute2) || 0;
  const fervor = Number(build.fervor) || 0;
  const mastery = Number(build.mastery) || 0;
  const criticalChance = Number(build.criticalChance) || 0;
  const criticalBonus = Number(build.criticalBonus) || 0;
  const extraDamage1 = Number(build.extraDamage1) || 0;
  const extraDamage2 = Number(build.extraDamage2) || 0;
  const armorPen = Number(build.armorPen) || 0;
  const enemyDefense = Number(build.enemyDefense) || 0;
  const defenseModifier = Number(build.defenseModifier) || DEFENSE_MODIFIER;

  const base = weaponDamage + modifier * attribute1 + modifier * attribute2;
  const mitigation = 1 / (1 + (enemyDefense * (1 - armorPen)) / defenseModifier);
  const shared =
    base * (1 + fervor) * (1 + mastery) * (1 + extraDamage1) * (1 + extraDamage2) * mitigation;

  const normalHit = shared;
  const criticalHit = shared * criticalBonus;
  const averageDamage = normalHit * (1 - criticalChance) + criticalHit * criticalChance;

  return {
    base,
    mitigation,
    normalHit,
    criticalHit,
    averageDamage
  };
}

function resolveDamageProfile(build) {
  return build?.damageProfile ?? build?._meta?.damageProfile ?? null;
}

/**
 * PvE hit damage from Build Compare sheet.
 * When a Physical/Magic profile is present: Physical uses Armor Pen (+ Phys mastery),
 * Magic uses Magic Pen (+ Magic mastery); results are weighted by kit shares.
 */
export function calculateBuildDamage(build) {
  const profile = resolveDamageProfile(build);
  const physicalShare = Number(profile?.physicalShare);
  const magicShare = Number(profile?.magicShare);
  const canSplit =
    profile &&
    Number.isFinite(physicalShare) &&
    Number.isFinite(magicShare) &&
    physicalShare + magicShare > 0;

  if (!canSplit) {
    return calculateSingleBucketDamage(build);
  }

  const armorPen = Number(build.armorPenetration ?? build.armorPen) || 0;
  const magicPen = Number(build.magicPenetration) || 0;
  const physicalMastery =
    build.physicalMastery != null ? Number(build.physicalMastery) || 0 : Number(build.mastery) || 0;
  const magicMastery =
    build.magicMastery != null ? Number(build.magicMastery) || 0 : Number(build.mastery) || 0;

  const physical =
    physicalShare > 0
      ? calculateSingleBucketDamage({
          ...build,
          armorPen,
          mastery: physicalMastery
        })
      : {
          base: 0,
          mitigation: 0,
          normalHit: 0,
          criticalHit: 0,
          averageDamage: 0
        };

  const magic =
    magicShare > 0
      ? calculateSingleBucketDamage({
          ...build,
          armorPen: magicPen,
          mastery: magicMastery
        })
      : {
          base: 0,
          mitigation: 0,
          normalHit: 0,
          criticalHit: 0,
          averageDamage: 0
        };

  const blend = (key) => physicalShare * (physical[key] || 0) + magicShare * (magic[key] || 0);
  const base = physicalShare > 0 ? physical.base : magic.base;

  return {
    base,
    mitigation: blend("mitigation"),
    normalHit: blend("normalHit"),
    criticalHit: blend("criticalHit"),
    averageDamage: blend("averageDamage"),
    byBucket: {
      physicalShare,
      magicShare,
      physical,
      magic,
      armorPen,
      magicPen
    }
  };
}

export function compareBuilds(buildA, buildB) {
  const resultA = calculateBuildDamage(buildA);
  const resultB = calculateBuildDamage(buildB);
  const gainA = resultB.averageDamage > 0 ? resultA.averageDamage / resultB.averageDamage - 1 : 0;
  const gainB = resultA.averageDamage > 0 ? resultB.averageDamage / resultA.averageDamage - 1 : 0;

  return { resultA, resultB, gainA, gainB };
}

/** Armor damage reduction: armor / (armor + 2285) */
export function armorDamageReduction(armor, defenseModifier = DEFENSE_MODIFIER) {
  const value = Number(armor) || 0;
  const mod = Number(defenseModifier) || DEFENSE_MODIFIER;
  return value / (value + mod);
}

export function sampleEnemyDefenseRange({ min = 0, max = 2300, step = 50 } = {}) {
  const points = [];
  const start = Math.max(0, Number(min) || 0);
  const end = Math.max(start, Number(max) || 2300);
  const size = Math.max(1, Number(step) || 50);

  for (let defense = start; defense <= end + 1e-9; defense += size) {
    points.push(Math.round(defense));
  }

  if (points[points.length - 1] !== Math.round(end)) {
    points.push(Math.round(end));
  }

  return points;
}

/** Average damage for a build across enemy armor values (Build Compare curves). */
export function buildAverageDamageCurve(build, rangeOptions) {
  return sampleEnemyDefenseRange(rangeOptions).map((enemyDefense) => ({
    enemyDefense,
    averageDamage: calculateBuildDamage({ ...build, enemyDefense }).averageDamage
  }));
}

export function buildGainCurve(buildA, buildB, rangeOptions) {
  return sampleEnemyDefenseRange(rangeOptions).map((enemyDefense) => {
    const resultA = calculateBuildDamage({ ...buildA, enemyDefense });
    const resultB = calculateBuildDamage({ ...buildB, enemyDefense });
    const gainA = resultB.averageDamage > 0 ? resultA.averageDamage / resultB.averageDamage - 1 : 0;

    return {
      enemyDefense,
      averageA: resultA.averageDamage,
      averageB: resultB.averageDamage,
      gainA
    };
  });
}

/** First armor where Build A stops beating Build B (gain crosses below 0), if any. */
export function findGainCrossover(buildA, buildB, rangeOptions) {
  const curve = buildGainCurve(buildA, buildB, { ...rangeOptions, step: rangeOptions?.step ?? 10 });

  for (let index = 1; index < curve.length; index += 1) {
    const prev = curve[index - 1];
    const next = curve[index];
    if (prev.gainA === 0) {
      return { enemyDefense: prev.enemyDefense, gainA: 0 };
    }
    if ((prev.gainA > 0 && next.gainA <= 0) || (prev.gainA < 0 && next.gainA >= 0)) {
      const span = next.gainA - prev.gainA;
      const t = span === 0 ? 0 : -prev.gainA / span;
      const enemyDefense = prev.enemyDefense + (next.enemyDefense - prev.enemyDefense) * t;
      return { enemyDefense, gainA: 0 };
    }
  }

  return null;
}

/**
 * ODS-style secondary chart using the build's Fer / AP / MP / Crit.
 * Each line isolates one secondary (others zeroed) on top of the build's base damage.
 *
 * When equalize=true: (fervor+AP+MP+crit)/4 is applied to each isolated secondary,
 * so the chart compares efficiency at the same share instead of raw contribution.
 */
export const SECONDARY_INVESTMENT_COLORS = {
  fervor: "#7dffa8",
  armorPen: "#8fb7ff",
  magicPen: "#c4a7ff",
  crit: "#f0c674"
};

export function resolveSecondaryIsolationValues(baseBuild, { equalize = false } = {}) {
  const base = baseBuild ?? DEFAULT_BUILD;
  const fervor = Number(base.fervor) || 0;
  const armorPenetration = Number(base.armorPenetration ?? base.armorPen) || 0;
  const magicPenetration = Number(base.magicPenetration ?? 0) || 0;
  const criticalChance = Number(base.criticalChance) || 0;

  if (!equalize) {
    return { fervor, armorPenetration, magicPenetration, criticalChance, equalShare: null };
  }

  const equalShare = (fervor + armorPenetration + magicPenetration + criticalChance) / 4;
  return {
    fervor: equalShare,
    armorPenetration: equalShare,
    magicPenetration: equalShare,
    criticalChance: equalShare,
    equalShare
  };
}

export function buildSecondaryIsolationChoices(baseBuild, { equalize = false } = {}) {
  const base = baseBuild ?? DEFAULT_BUILD;
  const values = resolveSecondaryIsolationValues(base, { equalize });
  const profile = resolveDamageProfile(base);

  // Isolation lines force a single secondary; clear split profile so each line
  // exercises that secondary alone (AP line = all Physical, MP line = all Magic).
  const stripped = {
    ...base,
    fervor: 0,
    armorPen: 0,
    armorPenetration: 0,
    magicPenetration: 0,
    criticalChance: 0,
    damageProfile: null,
    _meta: {
      ...(base._meta || {}),
      damageProfile: null
    }
  };

  function makeChoice(key, label, shortLabel, patch, forcedProfile) {
    return {
      key,
      label,
      shortLabel,
      color: SECONDARY_INVESTMENT_COLORS[key],
      equalShare: values.equalShare,
      activeForProfile:
        !profile ||
        profile.mode === "Mixed" ||
        (key === "armorPen" && profile.mode === "Physical") ||
        (key === "magicPen" && profile.mode === "Magic") ||
        key === "fervor" ||
        key === "crit",
      stats: {
        ...stripped,
        ...patch,
        damageProfile: forcedProfile,
        _meta: {
          ...(stripped._meta || {}),
          damageProfile: forcedProfile
        },
        criticalBonus: Number(base.criticalBonus) || DEFAULT_BUILD.criticalBonus
      }
    };
  }

  const physicalOnly = { physicalShare: 1, magicShare: 0, mode: "Physical", activePen: "armor", source: "isolation" };
  const magicOnly = { physicalShare: 0, magicShare: 1, mode: "Magic", activePen: "magic", source: "isolation" };

  return [
    makeChoice("fervor", "Fervor", "Fer", { fervor: values.fervor }, profile),
    makeChoice(
      "armorPen",
      "Armor Penetration",
      "AP",
      { armorPen: values.armorPenetration, armorPenetration: values.armorPenetration },
      physicalOnly
    ),
    makeChoice(
      "magicPen",
      "Magic Penetration",
      "MP",
      { armorPen: values.magicPenetration, magicPenetration: values.magicPenetration },
      magicOnly
    ),
    makeChoice("crit", "Crit Chance", "Crit", { criticalChance: values.criticalChance }, profile)
  ];
}

/** Average-damage curves isolating each secondary from the build. */
export function buildSecondaryIsolationCurves(baseBuild, rangeOptions, options = {}) {
  return buildSecondaryIsolationChoices(baseBuild, options).map((choice) => ({
    ...choice,
    curve: buildAverageDamageCurve(choice.stats, rangeOptions)
  }));
}
