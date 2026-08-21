import { readFileSync } from "node:fs";

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

for (const file of ["mounts", "gliders", "weapons", "armor", "jewellery", "recipes", "companions"]) {
  const payload = JSON.parse(readFileSync(`public/data/${file}.json`, "utf8"));
  const items = payload[file] || [];
  const texts = new Map();
  for (const item of items) {
    for (const source of item.sources || []) {
      const text = source.text || "";
      if (/^Boss /i.test(text) || /drop from/i.test(text)) {
        texts.set(text, (texts.get(text) || 0) + 1);
      }
    }
  }
  if (texts.size === 0) {
    continue;
  }
  console.log(`\n${file}`);
  for (const [text, count] of [...texts.entries()].sort()) {
    const match = text.match(/^Boss\s+(.+?)(?:\s·\s|$)/i);
    const boss = match?.[1];
    const dungeon = boss ? BOSS_DUNGEONS[boss] : null;
    console.log(dungeon ? "DUNG" : "    ", String(count).padStart(3), text, dungeon ? `=> ${dungeon}` : "");
  }
}
