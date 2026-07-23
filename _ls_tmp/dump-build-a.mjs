import fs from "fs";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom"
});

try {
  const { aggregateBuildAttributes } = await server.ssrLoadModule(
    "/src/features/builds/aggregateBuildAttributes.js"
  );

  const backup = JSON.parse(fs.readFileSync("./FareverTracker 2.json", "utf8"));
  const weapons = JSON.parse(fs.readFileSync("./public/data/weapons.json", "utf8"));
  const armor = JSON.parse(fs.readFileSync("./public/data/armor.json", "utf8"));
  const jewellery = JSON.parse(fs.readFileSync("./public/data/jewellery.json", "utf8"));
  const augments = JSON.parse(fs.readFileSync("./public/data/augments.json", "utf8"));

  const itemsById = new Map();
  for (const list of [weapons.weapons, armor.armor, jewellery.jewellery]) {
    for (const it of list || []) {
      itemsById.set(it.id, it);
    }
  }
  const augmentList = augments.augments || augments;

  const charName = process.argv[2] || "Kek";
  const setIndex = Number(process.argv[3] || 0);
  const char = backup.characters.find((c) => c.name === charName);
  if (!char) {
    throw new Error(`Character not found: ${charName}`);
  }

  const set = backup.characterBuildsById[char.id].sets[setIndex];
  const className = char.className || char.class;
  const attrs = aggregateBuildAttributes(set.equipment, itemsById, augmentList, className);
  const { _raw, _breakdown, ...rest } = attrs;

  const gear = Object.entries(set.equipment || {})
    .filter(([, v]) => v?.itemId)
    .map(([slot, v]) => {
      const item = itemsById.get(v.itemId);
      return {
        slot,
        name: item?.name || v.itemId,
        id: v.itemId,
        level: v.usedLevel,
        rarity: v.usedRarity,
        upgrade: v.usedUpgradeLevel,
        adornments: Object.fromEntries(Object.entries(v.adornments || {}).filter(([, id]) => id))
      };
    });

  console.log(
    JSON.stringify(
      {
        character: char.name,
        class: className,
        build: set.label || String.fromCharCode(65 + setIndex),
        gear,
        attributes: rest,
        breakdown: _breakdown,
        raw: _raw
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
