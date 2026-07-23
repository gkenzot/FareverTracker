/**
 * Download skill + rune icons referenced by public/data/skills.json
 * Usage: node scripts/download-skill-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SKILLS_JSON = path.join(ROOT, "public", "data", "skills.json");
const SKILL_DIR = path.join(ROOT, "public", "images", "skills");
const RUNE_DIR = path.join(ROOT, "public", "images", "runes");
const ICON_BASE = "https://static.metaforge.app/farever/icons";

async function downloadFile(url, dest) {
  if (fs.existsSync(dest)) {
    return "exists";
  }

  const response = await fetch(url);
  if (!response.ok) {
    // Some MetaForge icons are published as .webp even when the DB lists .png
    if (url.endsWith(".png")) {
      const webpUrl = url.replace(/\.png$/i, ".webp");
      const webpDest = dest.replace(/\.png$/i, ".webp");
      const webpResponse = await fetch(webpUrl);
      if (webpResponse.ok) {
        fs.writeFileSync(webpDest, Buffer.from(await webpResponse.arrayBuffer()));
        return { status: "downloaded-webp", filename: path.basename(webpDest) };
      }
    }
    return `fail:${response.status}`;
  }

  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return "downloaded";
}

function iconUrl(filename) {
  return `${ICON_BASE}/${filename}`;
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(SKILLS_JSON, "utf8"));
  fs.mkdirSync(SKILL_DIR, { recursive: true });
  fs.mkdirSync(RUNE_DIR, { recursive: true });

  const skillFiles = new Map();
  const runeFiles = new Map();

  for (const skill of payload.skills || []) {
    if (skill.iconFilename) {
      skillFiles.set(skill.iconFilename, skill);
    }
    for (const rune of skill.runes || []) {
      if (rune.iconFilename) {
        runeFiles.set(rune.iconFilename, rune);
      }
    }
  }

  let skillStats = { downloaded: 0, exists: 0, failed: 0, renamed: {} };
  for (const filename of skillFiles.keys()) {
    const dest = path.join(SKILL_DIR, filename);
    const result = await downloadFile(iconUrl(filename), dest);
    if (result === "downloaded") skillStats.downloaded += 1;
    else if (result === "exists") skillStats.exists += 1;
    else if (typeof result === "object" && result.status === "downloaded-webp") {
      skillStats.downloaded += 1;
      skillStats.renamed[filename] = result.filename;
    } else {
      skillStats.failed += 1;
      console.warn(`skill icon fail ${filename}`, result);
    }
  }

  let runeStats = { downloaded: 0, exists: 0, failed: 0, renamed: {} };
  for (const filename of runeFiles.keys()) {
    const dest = path.join(RUNE_DIR, filename);
    const result = await downloadFile(iconUrl(filename), dest);
    if (result === "downloaded") runeStats.downloaded += 1;
    else if (result === "exists") runeStats.exists += 1;
    else if (typeof result === "object" && result.status === "downloaded-webp") {
      runeStats.downloaded += 1;
      runeStats.renamed[filename] = result.filename;
    } else {
      runeStats.failed += 1;
      console.warn(`rune icon fail ${filename}`, result);
    }
  }

  // Patch JSON paths to local files (and webp renames when needed).
  for (const skill of payload.skills || []) {
    let skillFile = skill.iconFilename || "";
    if (skillStats.renamed[skillFile]) {
      skillFile = skillStats.renamed[skillFile];
      skill.iconFilename = skillFile;
    }
    skill.iconPath = skillFile ? `/images/skills/${skillFile}` : null;
    skill.iconUrl = skillFile ? iconUrl(skillFile) : null;

    for (const rune of skill.runes || []) {
      let runeFile = rune.iconFilename || "";
      if (runeStats.renamed[runeFile]) {
        runeFile = runeStats.renamed[runeFile];
        rune.iconFilename = runeFile;
      }
      rune.iconPath = runeFile ? `/images/runes/${runeFile}` : null;
      rune.iconUrl = runeFile ? iconUrl(runeFile) : null;
    }
  }

  fs.writeFileSync(SKILLS_JSON, `${JSON.stringify(payload, null, 2)}\n`);

  console.log("Skills icons:", skillStats);
  console.log("Rune icons:", runeStats);
  console.log(`Updated ${SKILLS_JSON}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
