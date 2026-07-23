import fs from "fs";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom"
});

try {
  const { scaleItemStats } = await server.ssrLoadModule("/src/features/builds/gearStatScaling.js");
  const { aggregateEquipmentStatTotals } = await server.ssrLoadModule(
    "/src/features/builds/aggregateBuildAttributes.js"
  );
  const { EQUIPMENT_SLOTS, isCraftedItem } = await server.ssrLoadModule("/src/features/builds/buildSlots.js");

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
  const eq = structuredClone(backup.characterBuildsById[char.id].sets[0].equipment);
  // exclude arsenal
  eq.arsenal = { itemId: "", usedLevel: null, usedRarity: null, usedUpgradeLevel: 0, adornments: {} };

  console.log("=== static vs scaled for each slot ===");
  for (const slot of EQUIPMENT_SLOTS) {
    const v = eq[slot.key];
    if (!v?.itemId) continue;
    const item = itemsById.get(v.itemId);
    const scaled = scaleItemStats(item, {
      level: v.usedLevel,
      rarity: v.usedRarity || "Rare",
      upgradeLevel: v.usedUpgradeLevel || 0,
      characterClassName: "Warrior"
    });
    const staticStats = item.stats || [];
    const scaledMap = Object.fromEntries(scaled.map((s) => [s.label, s.value]));
    const staticMap = Object.fromEntries(staticStats.map((s) => [s.label, s.value]));
    const labels = new Set([...Object.keys(scaledMap), ...Object.keys(staticMap)]);
    const diffs = [];
    for (const label of labels) {
      const a = staticMap[label] ?? 0;
      const b = scaledMap[label] ?? 0;
      if (a !== b) diffs.push(`${label}: static ${a} vs scaled ${b}`);
    }
    console.log(
      slot.key,
      item.name,
      "crafted?",
      isCraftedItem(item),
      diffs.length ? diffs.join(" | ") : "static==scaled (or no static)"
    );
  }

  // Sum if we prefer static stats when present for crafted items only
  function preferStaticStats(item, level, rarity, upgradeLevel) {
    if (isCraftedItem(item) && Array.isArray(item.stats) && item.stats.length) {
      return item.stats;
    }
    return scaleItemStats(item, { level, rarity, upgradeLevel, characterClassName: "Warrior" });
  }

  const totals = Object.create(null);
  for (const slot of EQUIPMENT_SLOTS) {
    const v = eq[slot.key];
    if (!v?.itemId) continue;
    const item = itemsById.get(v.itemId);
    for (const stat of preferStaticStats(item, v.usedLevel, v.usedRarity || "Rare", v.usedUpgradeLevel || 0)) {
      totals[stat.label] = (totals[stat.label] || 0) + Number(stat.value || 0);
    }
    // adornments same as aggregate - skip for now, use full aggregate then subtract head fervor
  }

  const fullGear = aggregateEquipmentStatTotals(eq, itemsById, augments, "Warrior");
  console.log("\ncurrent gear totals (no arsenal)", {
    Vit: fullGear.Vitality,
    Str: fullGear.Strength,
    Faith: fullGear.Faith,
    Crit: fullGear.Critical,
    AP: fullGear["Armor Penetration"],
    MP: fullGear["Magic Penetration"],
    Fer: fullGear.Fervor,
    Armor: fullGear.Armor
  });

  // If head used static only: remove +30 fervor
  console.log("if head static (no +30 fer): fervor", fullGear.Fervor - 30);

  // Gap to game primaries (base 38/34/28)
  console.log("game gear primaries", { vit: 169 - 38, str: 103 - 34, faith: 66 - 28 });
  console.log("app gear primaries", {
    vit: fullGear.Vitality,
    str: fullGear.Strength,
    faith: fullGear.Faith
  });
  console.log("missing", {
    vit: 169 - 38 - fullGear.Vitality,
    str: 103 - 34 - fullGear.Strength,
    faith: 66 - 28 - fullGear.Faith
  });

  // Crit: needed rating for 11.5%
  console.log("needed crit rating", (11.5 - 5.8) * 19);
  console.log("have crit rating", fullGear.Critical);
  console.log("missing crit rating", (11.5 - 5.8) * 19 - fullGear.Critical);

  // Rating targets
  console.log("needed AP rating", (23.6 * 35) / 4.6);
  console.log("needed MP rating", (14.1 * 35) / 4.6);
  console.log("needed fer rating", 8.9 * 15);
} finally {
  await server.close();
}
