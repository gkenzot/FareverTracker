/**
 * Secondary-attribute investigation using known in-game measurements
 * + Kek Build A from FareverTracker.json.
 *
 * Run: node --input-type=module _ls_tmp/investigate-secondary-attrs.mjs
 */
import fs from "fs";
import { createServer } from "vite";

const GAME = {
  kekFull: {
    vit: 169,
    str: 103,
    dex: 28,
    faith: 66,
    int: 28,
    critChance: 0.115,
    critBonus: 1.526,
    armorPen: 0.236,
    magicPen: 0.141,
    fervor: 0.089,
    regen: 2.6,
    armor: 2178,
    hp: 507,
    block: 0.6
  }
};

/** Known isolated measurements from prior session. */
const SERIES = {
  A_critChance: [
    { id: "A0", label: "naked", critRating: 0, dex: 28, int: 28, flat: 0, game: 0.058 },
    { id: "A1", label: "Light Practice +57 Crit", critRating: 57, dex: 28, int: 28, flat: 0, game: 0.088 },
    {
      id: "A_kek",
      label: "Kek full (incl WS +3%)",
      critRating: null, // fill from app
      dex: 28,
      int: 28,
      flat: 0.03,
      game: 0.115
    }
  ],
  B_critBonus: [
    { id: "B0", label: "naked", str: 34, faith: 28, game: 1.5 }, // assumed 150% baseline
    {
      id: "B1",
      label: "Light Practice +17 Str (faith base)",
      str: 34 + 17,
      faith: 28,
      game: 1.516
    },
    { id: "B_kek", label: "Kek full", str: 103, faith: 66, game: 1.526 }
  ],
  C_pen: [
    { id: "C0", label: "naked", rating: 0, game: 0 },
    { id: "C1", label: "Beefury +35 AP", rating: 35, game: 0.046 },
    { id: "C_kek_ap", label: "Kek AP", rating: null, game: 0.236 },
    { id: "C_kek_mp", label: "Kek MP", rating: null, game: 0.141 }
  ],
  E_regen: [
    { id: "E0", label: "naked", vit: 38, game: 1.1 },
    { id: "E1", label: "Beefury +32 Vit", vit: 38 + 32, game: 1.1 + 0.5 },
    { id: "E_kek", label: "Kek Vit 169", vit: 169, game: 2.6 }
  ]
};

function linearRatingToPercent(rating, kPerPercent) {
  return rating / (kPerPercent * 100);
}

function softCap(rating, k, cap = 1) {
  return (cap * rating) / (rating + k);
}

function fitLinearK(points) {
  // gamePercent = rating / (K * 100)  =>  K = rating / (gamePercent * 100)
  const ks = points
    .filter((p) => p.rating > 0 && p.game > 0)
    .map((p) => p.rating / (p.game * 100));
  if (!ks.length) return null;
  const mean = ks.reduce((a, b) => a + b, 0) / ks.length;
  return { k: mean, samples: ks };
}

function fitSoftCapK(points, { base = 0, cap = 1 } = {}) {
  // game = base + cap * r / (r + K)  =>  K = r * (cap / (game-base) - 1)
  let best = null;
  for (let k = 1; k <= 5000; k += 1) {
    let err = 0;
    let n = 0;
    for (const p of points) {
      if (p.rating <= 0) continue;
      const pred = base + softCap(p.rating, k, cap);
      err += (pred - p.game) ** 2;
      n += 1;
    }
    if (!n) continue;
    const mse = err / n;
    if (!best || mse < best.mse) best = { k, mse };
  }
  return best;
}

function r2(points, predict) {
  const ys = points.map((p) => p.game);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    ssTot += (p.game - mean) ** 2;
    ssRes += (p.game - predict(p)) ** 2;
  }
  return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom"
});

try {
  const { aggregateBuildAttributes, aggregateEquipmentStatTotals } = await server.ssrLoadModule(
    "/src/features/builds/aggregateBuildAttributes.js"
  );
  const { EQUIPMENT_SLOTS } = await server.ssrLoadModule("/src/features/builds/buildSlots.js");

  const backup = JSON.parse(fs.readFileSync("./FareverTracker.json", "utf8"));
  const weapons = JSON.parse(fs.readFileSync("./public/data/weapons.json", "utf8")).weapons;
  const armor = JSON.parse(fs.readFileSync("./public/data/armor.json", "utf8")).armor;
  const jewellery = JSON.parse(fs.readFileSync("./public/data/jewellery.json", "utf8")).jewellery;
  const augments = JSON.parse(fs.readFileSync("./public/data/augments.json", "utf8")).augments;
  const itemsById = new Map();
  for (const list of [weapons, armor, jewellery]) {
    for (const it of list) itemsById.set(it.id, it);
  }

  const char = backup.characters.find((c) => c.name === "Kek");
  const eq = backup.characterBuildsById[char.id].sets[0].equipment;
  const attrs = aggregateBuildAttributes(eq, itemsById, augments, "Warrior");
  const gear = aggregateEquipmentStatTotals(eq, itemsById, augments, "Warrior");

  console.log("=== COLLECTED SERIES (from session + Kek) ===");
  console.log(JSON.stringify(SERIES, null, 2));

  console.log("\n=== RECONCILE RATINGS (Kek Build A) ===");
  console.log("gear ratings", {
    Critical: gear.Critical || 0,
    AP: gear["Armor Penetration"] || 0,
    MP: gear["Magic Penetration"] || 0,
    Fervor: gear.Fervor || 0
  });

  const perSlot = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const v = eq[slot.key];
    if (!v?.itemId) continue;
    const t = aggregateEquipmentStatTotals({ [slot.key]: v }, itemsById, augments, "Warrior");
    const fer = t.Fervor || 0;
    const crit = t.Critical || 0;
    const ap = t["Armor Penetration"] || 0;
    const mp = t["Magic Penetration"] || 0;
    if (fer || crit || ap || mp) {
      const item = itemsById.get(v.itemId);
      perSlot.push({
        slot: slot.key,
        name: item?.name,
        Critical: crit,
        AP: ap,
        MP: mp,
        Fervor: fer
      });
    }
  }
  console.log("per-slot ratings");
  console.table(perSlot);

  const ferRating = gear.Fervor || 0;
  const neededFerRatingLinear15 = GAME.kekFull.fervor * 15 * 100; // wrong - ratingToPercent is r/(k*100)
  // percent = rating / (K * 100) => rating = percent * K * 100
  const ferRatingForGameAt15 = GAME.kekFull.fervor * 15 * 100;
  console.log("fervor analysis", {
    appRating: ferRating,
    appPercent: attrs.fervor,
    gamePercent: GAME.kekFull.fervor,
    ratingIfK15ForGame: ferRatingForGameAt15,
    impliedKFromAppRating: ferRating / (GAME.kekFull.fervor * 100),
    overRatingVsGameAtK15: ferRating - ferRatingForGameAt15
  });

  // Fill Kek ratings into series
  SERIES.A_critChance.find((p) => p.id === "A_kek").critRating = gear.Critical || 0;
  SERIES.C_pen.find((p) => p.id === "C_kek_ap").rating = gear["Armor Penetration"] || 0;
  SERIES.C_pen.find((p) => p.id === "C_kek_mp").rating = gear["Magic Penetration"] || 0;

  console.log("\n=== FIT CURVES ===");

  // Crit chance from rating only (subtract base+dex+int+flat)
  const critBase = (p) => 0.002 + 0.001 * (p.dex + p.int) + (p.flat || 0);
  const critFromRating = SERIES.A_critChance
    .filter((p) => p.critRating != null)
    .map((p) => ({
      rating: p.critRating,
      game: Math.max(0, p.game - critBase(p)),
      id: p.id
    }));
  console.log("crit chance from rating only", critFromRating);
  console.log("crit linear K", fitLinearK(critFromRating));
  console.log(
    "crit soft-cap",
    fitSoftCapK(critFromRating, { base: 0, cap: 1 }),
    "R2 linear19",
    r2(critFromRating, (p) => linearRatingToPercent(p.rating, 19)),
    "R2 soft",
    (() => {
      const fit = fitSoftCapK(critFromRating, { base: 0, cap: 1 });
      return fit ? r2(critFromRating, (p) => softCap(p.rating, fit.k, 1)) : null;
    })()
  );

  // Crit bonus: bonus = 1.5 + s * (str+faith)
  for (const mode of ["both", "str", "faith", "bothAboveBase"]) {
    const pts = SERIES.B_critBonus.map((p) => {
      let x;
      if (mode === "both") x = p.str + p.faith;
      else if (mode === "str") x = p.str;
      else if (mode === "faith") x = p.faith;
      else x = p.str + p.faith - 34 - 28;
      return { x, y: p.game - 1.5, id: p.id };
    }).filter((p) => p.x !== 0 || p.id === "B0");
    const usable = pts.filter((p) => p.x > 0);
    const s = usable.reduce((a, p) => a + p.y / p.x, 0) / usable.length;
    const preds = SERIES.B_critBonus.map((p) => {
      let x;
      if (mode === "both") x = p.str + p.faith;
      else if (mode === "str") x = p.str;
      else if (mode === "faith") x = p.faith;
      else x = Math.max(0, p.str + p.faith - 62);
      return { id: p.id, game: p.game, pred: 1.5 + s * x, err: 1.5 + s * x - p.game };
    });
    console.log("crit bonus mode", mode, "s", s, preds);
  }

  // AP
  const apPts = [
    { rating: 35, game: 0.046 },
    { rating: gear["Armor Penetration"] || 0, game: 0.236 }
  ];
  console.log("AP linear K", fitLinearK(apPts));
  console.log("AP soft-cap", fitSoftCapK(apPts));
  console.log("AP K=35/4.6", 35 / 4.6, "pred kek", linearRatingToPercent(apPts[1].rating, 35 / 4.6));

  const mpPts = [{ rating: gear["Magic Penetration"] || 0, game: 0.141 }];
  console.log("MP implied K", mpPts[0].rating / (mpPts[0].game * 100));

  // Fervor: try linear K from kek if we trust rating; also soft-cap
  const ferPts = [
    { rating: 39, game: null }, // D1 unknown until user measures — skip
    { rating: ferRating, game: GAME.kekFull.fervor }
  ].filter((p) => p.game != null);
  console.log("Fer linear implied K (kek only)", ferRating / (GAME.kekFull.fervor * 100));
  console.log("Fer soft-cap from kek alone insufficient");

  // Test: if overcount is exactly 2*9 eye fervor wrongly applied somehow already counted...
  const ferWithoutEyes = ferRating - 18;
  console.log("Fer without eye +9x2", {
    rating: ferWithoutEyes,
    pctAt15: linearRatingToPercent(ferWithoutEyes, 15),
    impliedK: ferWithoutEyes / (GAME.kekFull.fervor * 100)
  });

  // Regen fits
  const regenPts = SERIES.E_regen;
  console.log("\nregen points", regenPts);
  // linear on delta vit
  const e1 = regenPts[1];
  const slope = (e1.game - regenPts[0].game) / (e1.vit - regenPts[0].vit);
  console.log("regen slope from E0-E1", slope, "pred E_kek", regenPts[0].game + slope * (169 - 38));
  // linear on absolute vit
  const slopeAbs = (e1.game - regenPts[0].game) / (e1.vit - regenPts[0].vit);
  // soft: regen = a + b * vit/(vit+K)
  let bestRegen = null;
  for (let k = 1; k <= 2000; k++) {
    // fit a,b via least squares on soft feature x=vit/(vit+k)
    const xs = regenPts.map((p) => p.vit / (p.vit + k));
    const ys = regenPts.map((p) => p.game);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    const b = den ? num / den : 0;
    const a = my - b * mx;
    let mse = 0;
    for (let i = 0; i < n; i++) mse += (a + b * xs[i] - ys[i]) ** 2;
    mse /= n;
    if (!bestRegen || mse < bestRegen.mse) bestRegen = { k, a, b, mse };
  }
  console.log("regen soft-cap best", bestRegen, "preds", regenPts.map((p) => ({
    id: p.id,
    game: p.game,
    pred: bestRegen.a + bestRegen.b * (p.vit / (p.vit + bestRegen.k))
  })));

  // Alternative: regen = base + c * ln(vit) etc skip

  // Siagarta-style: percent = rating * scale / 100? or rating * scale as percent points
  console.log("\nSiagarta-style probes", {
    critRating42_times_0_1_as_pp: 42 * 0.1,
    fer169_times_0_05_as_pp: 169 * 0.05,
    fer169_div_20: 169 / 20
  });

  console.log("\n=== APP vs GAME KEK ===");
  console.log({
    crit: [attrs.criticalChance, GAME.kekFull.critChance],
    bonus: [attrs.criticalBonus, GAME.kekFull.critBonus],
    ap: [attrs.armorPenetration, GAME.kekFull.armorPen],
    mp: [attrs.magicPenetration, GAME.kekFull.magicPen],
    fer: [attrs.fervor, GAME.kekFull.fervor],
    regen: [attrs.healthRegen, GAME.kekFull.regen]
  });
} finally {
  await server.close();
}
