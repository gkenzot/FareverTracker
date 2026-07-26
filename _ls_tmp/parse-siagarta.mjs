import fs from "fs";

const html = fs.readFileSync("./_ls_tmp/martyr-siagarta.html", "utf8");
console.log("len", html.length);
console.log("title", (html.match(/<title>([^<]+)/) || [])[1]);

// Try to find sveltekit / next data
const scripts = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)];
console.log("json scripts", scripts.length);
for (const [i, s] of scripts.entries()) {
  if (s[1].includes("GS_Nova") || s[1].includes("Martyr") || s[1].includes("upgrade")) {
    fs.writeFileSync(`./_ls_tmp/martyr-sia-${i}.json`, s[1]);
    console.log("saved", i, s[1].length);
  }
}

// Look for self.__next_f or similar
const idx = html.indexOf("GS_Nova");
console.log("GS_Nova idx", idx);
if (idx >= 0) console.log(html.slice(idx - 100, idx + 2500));

const vit = html.indexOf("Vitality");
console.log("vit", vit, html.slice(vit - 50, vit + 300));

// search upgrade related strings
for (const term of ["UpgradeBonus", "upgradeBonus", "starBonus", "WeaponUpgrade", "CritChance", "PhysicalMastery", "cooldown"]) {
  const i = html.indexOf(term);
  console.log(term, i);
}
