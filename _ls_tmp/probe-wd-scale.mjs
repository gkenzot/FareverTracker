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

function findEntry(payload) {
  for (const node of payload.nodes ?? []) {
    const decoded = !Array.isArray(node?.data) ? node?.data : materialize(node.data, 0);
    if (decoded?.entry) return decoded.entry;
  }
  return null;
}

function collectWeaponDamage(value, path = "", out = []) {
  if (!value || typeof value !== "object") return out;
  if (Object.prototype.hasOwnProperty.call(value, "avg") && Object.prototype.hasOwnProperty.call(value, "min")) {
    out.push({ path, value });
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectWeaponDamage(entry, `${path}[${index}]`, out));
  } else {
    for (const [key, child] of Object.entries(value)) {
      if (key === "weapon_damage") {
        out.push({ path: `${path}.${key}`, value: child });
      }
      collectWeaponDamage(child, `${path}.${key}`, out);
    }
  }
  return out;
}

for (const slug of [
  "beefury-blessed-blade-of-the-farseeker",
  "worldsplitter",
  "glory"
]) {
  const entry = findEntry(
    await (
      await fetch(`https://metaforge.app/farever/database/weapons/${slug}/__data.json`)
    ).json()
  );
  console.log("\n===", slug);
  console.log("top weapon_damage", entry.weapon_damage);
  console.log("level/ilevel/rarity", entry.level, entry.ilevel, entry.rarity);

  const ut = entry.upgrade_table;
  console.log("upgrade_table", Array.isArray(ut) ? `len ${ut.length}` : typeof ut);
  if (Array.isArray(ut) && ut.length) {
    console.log(
      "upgrade samples",
      ut.slice(0, 4).map((row) => ({
        keys: Object.keys(row),
        tier: row.tier,
        level: row.level,
        ilevel: row.ilevel,
        weapon_damage: row.weapon_damage
      }))
    );
  }

  const found = collectWeaponDamage(entry).filter((row) => row.path.includes("weapon_damage") || row.path === "");
  const uniqueAvgs = [...new Set(found.map((row) => JSON.stringify(row.value)))];
  console.log("weapon_damage occurrences", found.length, "unique", uniqueAvgs.length);
  console.log(uniqueAvgs.slice(0, 5));
}
