import fs from "fs";

async function fetchClass(cls) {
  const html = await (await fetch(`https://www.fareverdb.com/talents/${cls}`)).text();
  fs.writeFileSync(`_talent_${cls}.html`, html);
  // extract markdown-like structure from fetched readable isn't available; parse titles near 0/
  const matches = [...html.matchAll(/0\/(\d)/g)];
  console.log(cls, "0/N count", matches.length, "unique", [...new Set(matches.map((m) => m[1]))]);

  // Try next.js flight data chunks containing talent names
  const chunkUrls = [...html.matchAll(/\/_next\/static\/chunks\/[^"]+\.js/g)].map((m) => m[0]);
  console.log(cls, "chunks", chunkUrls.length);
  return { html, chunkUrls };
}

const warrior = await fetchClass("warrior");
// Find buildId or static data path
const m = warrior.html.match(/\/_next\/static\/[^"]+/g);
console.log("static samples", [...new Set(m || [])].slice(0, 20));

// Search for JSON-looking talent arrays in script
for (const term of ["Seasoned Soldier", "maxRank", "tierGate", "column", "Bloodletting", '"ranks"']) {
  const idx = warrior.html.indexOf(term);
  console.log(term, idx);
}

const mage = await (await fetch("https://www.fareverdb.com/talents/mage")).text();
fs.writeFileSync("_talent_mage.html", mage);
const priest = await (await fetch("https://www.fareverdb.com/talents/priest")).text();
fs.writeFileSync("_talent_priest.html", priest);
const rogue = await (await fetch("https://www.fareverdb.com/talents/rogue")).text();
fs.writeFileSync("_talent_rogue.html", rogue);

// Use WebFetch-style: ask readable via scraping headings from raw - extract talent names with 0/1 or 0/2 nearby
function extractRanks(html) {
  // Pattern from RSC: often name then later 0/1
  const names = [];
  const re = />([A-Z][^<]{2,40})<\/(?:h\d|span|div|p|button)>/g;
  let match;
  while ((match = re.exec(html))) {
    const name = match[1].trim();
    if (/^[A-Z]/.test(name) && name.length < 40 && !/Branch|Tier|Root|Level|Share|Import|Feedback|points/i.test(name)) {
      names.push(name);
    }
  }
  return [...new Set(names)].slice(0, 80);
}
console.log("warrior names sample", extractRanks(warrior.html).slice(0, 40));
