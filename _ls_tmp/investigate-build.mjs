import fs from "fs";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom"
});

try {
  const { scaleItemStats } = await server.ssrLoadModule("/src/features/builds/gearStatScaling.js");
  const {
    getAugmentDisplayName,
    isDemonSigilAugment,
    augmentMatchesAdornmentField
  } = await server.ssrLoadModule("/src/features/builds/buildSlots.js");
  const { aggregateEquipmentStatTotals, aggregateBuildAttributes } = await server.ssrLoadModule(
    "/src/features/builds/aggregateBuildAttributes.js"
  );

  const augments = JSON.parse(fs.readFileSync("./public/data/augments.json", "utf8")).augments;
  const armor = JSON.parse(fs.readFileSync("./public/data/armor.json", "utf8")).armor;
  const jewellery = JSON.parse(fs.readFileSync("./public/data/jewellery.json", "utf8")).jewellery;
  const weapons = JSON.parse(fs.readFileSync("./public/data/weapons.json", "utf8")).weapons;
  const backup = JSON.parse(fs.readFileSync("./FareverTracker.json", "utf8"));

  const itemsById = new Map();
  for (const list of [weapons, armor, jewellery]) {
    for (const it of list) itemsById.set(it.id, it);
  }

  const sigils = augments.filter((a) => isDemonSigilAugment(a) || String(a.name || "").includes("Sigil"));
  console.log(
    "sigils",
    sigils.map((a) => ({
      id: a.id,
      name: a.name,
      display: getAugmentDisplayName(a),
      stats: a.stats,
      matchesSigilField: augmentMatchesAdornmentField(a, "sigil")
    }))
  );

  const stored = "Sigil of Bet'Hatesht (Infused Wound)";
  const hit = augments.find(
    (a) => getAugmentDisplayName(a) === stored || a.name === stored || a.id === stored
  );
  console.log(
    "stored sigil resolve",
    hit
      ? { id: hit.id, name: hit.name, display: getAugmentDisplayName(hit), stats: hit.stats }
      : "NOT FOUND"
  );
  const loose = augments.filter(
    (a) =>
      String(a.name || "").includes("Bet") ||
      String(getAugmentDisplayName(a)).includes("Bet") ||
      String(a.name || "").includes("Hatesht") ||
      String(a.name || "").includes("Wound")
  );
  console.log(
    "loose sigil matches",
    loose.map((a) => ({ id: a.id, name: a.name, display: getAugmentDisplayName(a), stats: a.stats }))
  );

  const head = armor.find((i) => i.id === "Head_RDemon_Fig_Craft");
  console.log("HEAD raw stats", head.stats);
  console.log(
    "HEAD scaled",
    scaleItemStats(head, { level: 25, rarity: "Rare", upgradeLevel: 0, characterClassName: "Warrior" })
  );

  const ring = jewellery.find((i) => i.id === "Finger_Z3RCraft_Fer");
  console.log("RING raw", ring.stats);
  console.log(
    "RING scaled",
    scaleItemStats(ring, { level: 25, rarity: "Rare", upgradeLevel: 0, characterClassName: "Warrior" })
  );
  const eye = augments.find((a) => String(a.name || "").includes("Fanatism"));
  console.log("EYE", eye && { id: eye.id, name: eye.name, stats: eye.stats });

  const eyes = augments.filter((a) => String(a.name || "").includes("Cursed Eye"));
  console.log(
    "all cursed eyes",
    eyes.map((a) => ({ name: a.name, stats: a.stats }))
  );

  const char = backup.characters.find((c) => c.name === "Kek");
  const eq = structuredClone(backup.characterBuildsById[char.id].sets[0].equipment);
  eq.arsenal = { itemId: "", usedLevel: null, usedRarity: null, usedUpgradeLevel: 0, adornments: {} };

  // What if cursed eyes ignored?
  const eqNoEyes = structuredClone(eq);
  eqNoEyes.ring1.adornments.stone = "";
  eqNoEyes.ring2.adornments.stone = "";

  // What if sigil id stored differently - try matching by display contains
  const eqSigilFix = structuredClone(eq);
  const wound = augments.find(
    (a) => String(getAugmentDisplayName(a)).includes("Infused Wound") || String(a.name || "").includes("Infused Wound")
  );
  if (wound) {
    eqSigilFix.head.adornments.sigil = getAugmentDisplayName(wound);
    console.log("sigil fix candidate", getAugmentDisplayName(wound), wound.stats);
  }

  const scenarios = {
    noArsenal: eq,
    noArsenalNoEyes: eqNoEyes,
    noArsenalSigilFix: eqSigilFix
  };

  for (const [name, equipment] of Object.entries(scenarios)) {
    const attrs = aggregateBuildAttributes(equipment, itemsById, augments, "Warrior");
    const gear = aggregateEquipmentStatTotals(equipment, itemsById, augments, "Warrior");
    console.log(name, {
      vit: attrs.vitality,
      str: attrs.strength,
      faith: attrs.faith,
      crit: +(attrs.criticalChance * 100).toFixed(2),
      bonus: +(attrs.criticalBonus * 100).toFixed(2),
      ap: +(attrs.armorPenetration * 100).toFixed(2),
      mp: +(attrs.magicPenetration * 100).toFixed(2),
      fer: +(attrs.fervor * 100).toFixed(2),
      armor: attrs.armor,
      hp: attrs.maximumHealth,
      regen: attrs.healthRegen,
      ratings: {
        crit: gear.Critical || 0,
        ap: gear["Armor Penetration"] || 0,
        mp: gear["Magic Penetration"] || 0,
        fer: gear.Fervor || 0
      }
    });
  }

  console.log("GAME", {
    vit: 169,
    str: 103,
    faith: 66,
    crit: 11.5,
    bonus: 152.6,
    ap: 23.6,
    mp: 14.1,
    fer: 8.9,
    armor: 2178,
    hp: 507,
    regen: 2.6
  });

  // Reverse-engineer needed ratings from game %
  const baseCrit = 0.058;
  console.log("needed crit rating @19", +((0.115 - baseCrit) * 19).toFixed(2));
  console.log("needed AP rating @35/4.6", +((0.236 * 35) / 4.6).toFixed(2));
  console.log("needed MP rating", +((0.141 * 35) / 4.6).toFixed(2));
  console.log("needed fervor @15", +(0.089 * 15).toFixed(2));
  console.log("crit bonus implies str+faith @0.0002", +((1.526 - 1.5) / 0.0002).toFixed(2));
  console.log("crit bonus implies str+faith @0.000154", +((1.526 - 1.5) / 0.000154).toFixed(2));
} finally {
  await server.close();
}
