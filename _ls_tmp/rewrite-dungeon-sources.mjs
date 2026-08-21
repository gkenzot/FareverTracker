import { readFileSync, writeFileSync } from "node:fs";

const BOSS_DUNGEONS = {
  "Munster Chuck": "Cheese Station",
  Reblochonk: "Cheese Station",
  "King Ratsar": "Ratsar's Lair",
  Golcano: "Ruins of Gorgon's Hollow",
  "Lady Bee": "Lady Bee's Palace",
  Gatsbee: "Lady Bee's Palace",
  "Queen Honeyzabeth": "Honeyzabeth's Hivetrunk",
  Crabgantua: "Crabgantua's Gorge",
  Nepsilon: "Abyss of New Atlaan",
  "Sponge Blob": "Lost City of Mayda",
  "High Inquisitor Chakram": "Chakram's Chapel",
  "Robin Hoof": "Crimson Barracks"
};

function rewrite(text) {
  const match = String(text).match(/^Boss\s+(.+?)(?:\s·\s([\d.]+%))?$/i);
  if (!match) {
    return text;
  }
  const dungeon = BOSS_DUNGEONS[match[1].trim()];
  if (!dungeon) {
    return text;
  }
  return match[2] ? `Dungeon ${dungeon} · ${match[2]}` : `Dungeon ${dungeon}`;
}

let total = 0;
for (const file of ["mounts", "gliders", "weapons", "armor", "jewellery", "recipes", "companions"]) {
  const path = `public/data/${file}.json`;
  const payload = JSON.parse(readFileSync(path, "utf8"));
  const items = payload[file] || [];
  let changed = 0;
  for (const item of items) {
    for (const source of item.sources || []) {
      const next = rewrite(source.text || "");
      if (next !== source.text) {
        source.text = next;
        changed += 1;
      }
    }
  }
  if (changed > 0) {
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  }
  console.log(file, changed);
  total += changed;
}
console.log("total", total);
