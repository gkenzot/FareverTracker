import { readFile } from "node:fs/promises";

function materialize(pool, index, seen = new Map()) {
  if (typeof index !== "number") return index;
  const value = pool[index];
  if (value === null || typeof value !== "object") return value;
  if (seen.has(index)) return seen.get(index);
  if (Array.isArray(value)) {
    const array = [];
    seen.set(index, array);
    for (const itemIndex of value) {
      array.push(typeof itemIndex === "number" ? materialize(pool, itemIndex, seen) : itemIndex);
    }
    return array;
  }
  const object = {};
  seen.set(index, object);
  for (const [key, itemIndex] of Object.entries(value)) {
    object[key] = typeof itemIndex === "number" ? materialize(pool, itemIndex, seen) : itemIndex;
  }
  return object;
}

function decodeNodeData(node) {
  if (!Array.isArray(node?.data)) return node?.data ?? null;
  return materialize(node.data, 0);
}

function findEntryData(payload) {
  for (const node of payload.nodes ?? []) {
    const decoded = decodeNodeData(node);
    if (decoded?.entry) return decoded.entry;
  }
  return null;
}

async function fetchMetaforgePayload(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 FareverCheck",
      RSC: "1",
      "Next-Url": url.replace("https://metaforge.app", "")
    }
  });
  const text = await response.text();
  // Try parse as flight
  const lines = text.split("\n");
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const body = line.slice(colon + 1);
    if (!body.includes("weapon_damage") && !body.includes("entry")) continue;
    try {
      const json = JSON.parse(body);
      const entry = findEntryData(json) ?? json?.entry ?? null;
      if (entry?.weapon_damage || entry?.name) return entry;
    } catch {
      // continue
    }
  }

  // Fallback HTML scrape of embedded object
  const htmlRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 FareverCheck" } });
  const html = await htmlRes.text();
  const m = html.match(/weapon_damage:(\{[^}]+\})/);
  if (m) {
    // convert JS object literal-ish to JSON
    const lit = m[1]
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"')
      .replace(/,(\s*[}\]])/g, "$1");
    try {
      return { weapon_damage: JSON.parse(lit) };
    } catch (e) {
      return { raw: m[1], error: String(e) };
    }
  }
  return null;
}

const weapons = JSON.parse(await readFile("./public/data/weapons.json", "utf8")).weapons;
const samples = ["worldsplitter", "beefury-blessed-blade-of-the-farseeker", "martyr-of-enripit", "rough-shield", "judgement"];
for (const slug of samples) {
  const item = weapons.find((w) => w.slug === slug);
  const entry = await fetchMetaforgePayload(`https://metaforge.app/farever/database/weapons/${slug}`);
  console.log("\n===", slug, item?.id);
  console.log(JSON.stringify(entry?.weapon_damage ?? entry, null, 2)?.slice(0, 600));
}
