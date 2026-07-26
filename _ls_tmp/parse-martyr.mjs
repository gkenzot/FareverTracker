import fs from "fs";

const html = fs.readFileSync("./_ls_tmp/martyr-fdb.html", "utf8");
const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
if (m) {
  const data = JSON.parse(m[1]);
  fs.writeFileSync("./_ls_tmp/martyr-fdb-next.json", JSON.stringify(data, null, 2));
  console.log("pageProps keys", Object.keys(data.props?.pageProps || {}));
  const item = data.props?.pageProps?.item || data.props?.pageProps?.data;
  console.log("item keys", item && Object.keys(item));
  if (item) {
    fs.writeFileSync("./_ls_tmp/martyr-item.json", JSON.stringify(item, null, 2));
  }
} else {
  // try RSC payload
  const idx = html.indexOf('"GS_Nova"');
  console.log("GS_Nova idx", idx);
  console.log(html.slice(Math.max(0, idx - 200), idx + 2000));
}

const mf = fs.readFileSync("./_ls_tmp/martyr-mf.html", "utf8");
const dataScripts = [...mf.matchAll(/data-sveltekit-fetched[^>]*>(\{.*?\})<\/script>/gs)];
console.log("sveltekit fetched", dataScripts.length);
for (const [i, d] of dataScripts.entries()) {
  const body = d[1];
  if (body.includes("Martyr") || body.includes("GS_Nova") || body.includes("upgrade")) {
    console.log("match script", i, "len", body.length);
    fs.writeFileSync(`./_ls_tmp/martyr-mf-data-${i}.json`, body);
  }
}
// also look for Vitality +23 etc near upgrade
const vit = mf.indexOf("Vitality");
console.log("vit sample", mf.slice(vit - 100, vit + 400));
