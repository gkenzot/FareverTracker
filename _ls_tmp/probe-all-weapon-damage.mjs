const weapons = JSON.parse(
  await (await import("node:fs/promises")).readFile("./public/data/weapons.json", "utf8")
).weapons;

const re =
  /weapon_damage:\{min:(\d+(?:\.\d+)?),max:(\d+(?:\.\d+)?),avg:([\d.]+),affinity:"([^"]+)",skill_id:"([^"]*)",scaling_attr:"([^"]*)",scaling_ratio:([\d.]+)\}/;

async function fetchDamage(slug) {
  const res = await fetch(`https://metaforge.app/farever/database/weapons/${slug}`, {
    headers: { "User-Agent": "Mozilla/5.0 FareverCheck" }
  });
  if (!res.ok) {
    return { status: res.status };
  }
  const html = await res.text();
  const m = html.match(re);
  if (!m) {
    // try looser
    const loose = html.match(/weapon_damage:\{[^}]+\}/);
    return { status: res.status, raw: loose?.[0] ?? null };
  }
  return {
    status: res.status,
    min: Number(m[1]),
    max: Number(m[2]),
    avg: Number(m[3]),
    affinity: m[4],
    skill_id: m[5],
    scaling_attr: m[6],
    scaling_ratio: Number(m[7])
  };
}

const results = [];
for (const item of weapons) {
  const dmg = await fetchDamage(item.slug);
  results.push({ id: item.id, name: item.name, slug: item.slug, level: item.itemLevel ?? item.properties?.level, ...dmg });
  console.log(item.slug, dmg.avg ?? dmg.raw ?? dmg.status);
}

console.log("\nsummary");
console.log(
  results
    .map((r) => `${r.id}\tlvl${r.level}\tavg=${r.avg ?? "?"}\t${r.min ?? ""}-${r.max ?? ""}`)
    .join("\n")
);
await (await import("node:fs/promises")).writeFile(
  "_ls_tmp/weapon-damage-probe.json",
  JSON.stringify(results, null, 2)
);
