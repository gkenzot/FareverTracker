import fs from "fs";

const xml = fs.readFileSync("_ls_tmp/ods/content.xml", "utf8");
// Find sheet/table names
const tables = [...xml.matchAll(/<table:table table:name="([^"]+)"/g)].map((m) => m[1]);
console.log("tables", tables);

// Get a window of text paragraphs in order with indices near boss names
const paras = [...xml.matchAll(/<text:p[^>]*>([^<]*)<\/text:p>/g)].map((m, i) => ({ i, t: m[1] }));
const bossIdx = paras.filter((p) => /Level \d+ (Crab|Lady|Ratsar|Skunk|Farmhand|Coyote|Crabgantua)/i.test(p.t));
for (const b of bossIdx) {
  const window = paras.slice(Math.max(0, b.i - 2), b.i + 8).map((p) => p.t);
  console.log("---", b.t);
  console.log(window.join(" | "));
}
