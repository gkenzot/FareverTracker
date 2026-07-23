import fs from "fs";
import path from "path";
function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const allSrc = walk("src");
const srcText = Object.fromEntries(allSrc.map((f) => [f, fs.readFileSync(f, "utf8")]));
const builds = allSrc.filter((f) => f.includes(`${path.sep}builds`));
const findings = [];
for (const file of builds) {
  const text = srcText[file];
  const exports = new Set();
  let m;
  const re = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g;
  while ((m = re.exec(text))) exports.add(m[1]);
  for (const name of exports) {
    const word = new RegExp(`\\b${name}\\b`, "g");
    let external = 0;
    let internal = 0;
    for (const [f, t] of Object.entries(srcText)) {
      const count = (t.match(word) || []).length;
      if (f === file) internal += count;
      else external += count;
    }
    if (external === 0) findings.push({ file: file.split(path.sep).join("/"), name, internal });
  }
}
findings.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
console.log("UNUSED EXPORTS:", findings.length);
for (const f of findings) console.log(`${f.file} :: ${f.name} (int ${f.internal})`);
