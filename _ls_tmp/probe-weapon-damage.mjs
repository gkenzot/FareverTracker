const url =
  "https://metaforge.app/farever/database/weapons/beefury-blessed-blade-of-the-farseeker";
const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
const html = await res.text();

const re = /weapon_damage:\{min:(\d+),max:(\d+),avg:([\d.]+),affinity:"([^"]+)",skill_id:"([^"]+)",scaling_attr:"([^"]+)",scaling_ratio:([\d.]+)\}/g;
const matches = [...html.matchAll(re)];
console.log("matches", matches.length);
if (matches[0]) {
  console.log({
    min: +matches[0][1],
    max: +matches[0][2],
    avg: +matches[0][3],
    affinity: matches[0][4],
    skill_id: matches[0][5],
    scaling_attr: matches[0][6],
    scaling_ratio: +matches[0][7]
  });
}

// Does avg change across upgrade tiers on the same page?
const unique = [...new Set(matches.map((m) => m[0]))];
console.log("unique weapon_damage blobs", unique.length);
console.log(unique.slice(0, 5));

// Check a few other weapon pages for variety
const slugs = [
  "worldsplitter",
  "glory-sword",
  "swarming-sword",
  "apprentices-grimoire"
];
for (const slug of slugs) {
  const page = await fetch(`https://metaforge.app/farever/database/weapons/${slug}`, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const body = await page.text();
  const m = body.match(
    /weapon_damage:\{min:(\d+),max:(\d+),avg:([\d.]+),affinity:"([^"]+)",skill_id:"([^"]*)",scaling_attr:"([^"]*)",scaling_ratio:([\d.]+)\}/
  );
  console.log(slug, page.status, m ? { min: +m[1], max: +m[2], avg: +m[3], affinity: m[4], scaling_attr: m[6], scaling_ratio: +m[7] } : "none");
}
