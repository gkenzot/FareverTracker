import fs from "fs";

const xml = fs.readFileSync("_ls_tmp/ods/content.xml", "utf8");
const rows = xml.split(/<table:table-row[\s>]/).slice(1);
const out = [];

for (const row of rows) {
  const cells = [];
  const cellMatches = row.matchAll(/<table:table-cell([^>]*)>([\s\S]*?)<\/table:table-cell>/g);
  for (const m of cellMatches) {
    const attrs = m[1];
    const body = m[2];
    const texts = [...body.matchAll(/<text:p[^>]*>([^<]*)<\/text:p>/g)].map((t) => t[1].trim()).filter(Boolean);
    const valueMatch = attrs.match(/office:value="([^"]+)"/);
    const repeatMatch = attrs.match(/table:number-columns-repeated="(\d+)"/);
    const content = texts.join(" ") || (valueMatch ? valueMatch[1] : "");
    const repeat = repeatMatch ? Number(repeatMatch[1]) : 1;
    if (!content && repeat > 10) continue;
    for (let i = 0; i < Math.min(repeat, 5); i++) {
      cells.push(content);
    }
  }
  const joined = cells.filter(Boolean).join(" | ");
  if (/lady|crab|bee|boss|1500|swarm|kobold|demon|manfish|glory|armor/i.test(joined)) {
    out.push(joined);
  }
}

console.log(out.join("\n"));
console.log("TOTAL", out.length);
