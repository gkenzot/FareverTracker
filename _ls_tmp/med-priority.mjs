import fs from "fs";
import path from "path";

function read(p) {
  return fs.readFileSync(p, "utf8");
}
function write(p, t) {
  fs.writeFileSync(p, t);
}

// --- weaponKitAnalysis: unexport internal parsers / attributeStatKey / resolveEffectiveSkillModifier
{
  const p = "src/features/builds/weaponKitAnalysis.js";
  let t = read(p);
  t = t.replace("export function attributeStatKey", "function attributeStatKey");
  t = t.replace("export function parseDamageCadence", "function parseDamageCadence");
  t = t.replace("export function parseTalentEffects", "function parseTalentEffects");
  t = t.replace("export function resolveEffectiveSkillModifier", "function resolveEffectiveSkillModifier");
  // parseSkillDamageHits may already be unexported
  t = t.replace("export function parseSkillDamageHits", "function parseSkillDamageHits");
  write(p, t);
  console.log("weaponKitAnalysis unexports ok");
}

// --- gearStatScaling: unexport internals
{
  const p = "src/features/builds/gearStatScaling.js";
  let t = read(p);
  t = t.replace("export const STAT_CONSTANTS", "const STAT_CONSTANTS");
  t = t.replace("export const ATTR_LABELS", "const ATTR_LABELS");
  t = t.replace("export function computeItemLevel", "function computeItemLevel");
  t = t.replace("export function computeGearStats", "function computeGearStats");
  t = t.replace("export const ARSENAL_STAT_FACTOR", "const ARSENAL_STAT_FACTOR");
  write(p, t);
  console.log("gearStatScaling unexports ok");
}

// --- buildDamageStats: unexport helpers
{
  const p = "src/features/builds/buildDamageStats.js";
  let t = read(p);
  for (const name of [
    "resolveAttribute2FromBuild",
    "resolveDamageProfile",
    "resolvePenetrationForProfile",
    "resolveMasteryForProfile",
    "resolveMainHandWeaponDamage",
    "buildDamageStatsFromAttributes"
  ]) {
    t = t.replace(`export function ${name}`, `function ${name}`);
  }
  write(p, t);
  console.log("buildDamageStats unexports ok");
}

// --- aggregateBuildAttributes: unexport internals
{
  const p = "src/features/builds/aggregateBuildAttributes.js";
  let t = read(p);
  t = t.replace("export function aggregateEquipmentStatTotals", "function aggregateEquipmentStatTotals");
  t = t.replace("export function deriveBuildAttributes", "function deriveBuildAttributes");
  write(p, t);
  console.log("aggregate unexports ok");
}

// --- damageFormulas: unexport internals + rename resolveDamageProfile + armorPen read
{
  const p = "src/features/builds/damageFormulas.js";
  let t = read(p);
  t = t.replace("export const GEAR_SECONDARY_RATING_BUDGET", "const GEAR_SECONDARY_RATING_BUDGET");
  t = t.replace("export const GEAR_SECONDARY_CHOICES", "const GEAR_SECONDARY_CHOICES");
  t = t.replace("export function calculateSingleBucketDamage", "function calculateSingleBucketDamage");
  t = t.replace("export const SECONDARY_INVESTMENT_COLORS", "const SECONDARY_INVESTMENT_COLORS");
  t = t.replace("export function resolveSecondaryIsolationValues", "function resolveSecondaryIsolationValues");
  t = t.replace("export function buildSecondaryIsolationChoices", "function buildSecondaryIsolationChoices");
  t = t.replace(
    "function resolveDamageProfile(build) {",
    "function resolveBuildAttachedDamageProfile(build) {"
  );
  t = t.replace(
    "const profile = resolveDamageProfile(build);",
    "const profile = resolveBuildAttachedDamageProfile(build);"
  );
  t = t.replace(
    "  const armorPen = Number(build.armorPen) || 0;\n  const enemyDefense = Number(build.enemyDefense) || 0;",
    "  const armorPen = Number(build.armorPenetration ?? build.armorPen) || 0;\n  const enemyDefense = Number(build.enemyDefense) || 0;"
  );
  write(p, t);
  console.log("damageFormulas ok");
}

// --- attributeFormulaDocs / characterBaseStats / enemyDefense / weaponUpgrade
{
  let t = read("src/features/builds/attributeFormulaDocs.js");
  t = t.replace("export const ATTRIBUTE_FORMULA_DOCS", "const ATTRIBUTE_FORMULA_DOCS");
  write("src/features/builds/attributeFormulaDocs.js", t);

  t = read("src/features/builds/characterBaseStats.js");
  t = t.replace("export const FIXED_CHARACTER_LEVEL", "const FIXED_CHARACTER_LEVEL");
  t = t.replace("export function getCharacterBaseStats", "function getCharacterBaseStats");
  write("src/features/builds/characterBaseStats.js", t);

  t = read("src/features/builds/enemyDefensePresets.js");
  t = t.replace("export const BOSS_ARMOR_PER_LEVEL", "const BOSS_ARMOR_PER_LEVEL");
  t = t.replace("export const BOSS_NAMES_BY_LEVEL", "const BOSS_NAMES_BY_LEVEL");
  write("src/features/builds/enemyDefensePresets.js", t);

  t = read("src/features/builds/weaponUpgradeBonuses.js");
  t = t.replace("export function getWeaponUpgradeBonusTable", "function getWeaponUpgradeBonusTable");
  write("src/features/builds/weaponUpgradeBonuses.js", t);

  t = read("src/features/builds/classSkillLoadout.js");
  t = t.replace("export const CLASS_SKILL_SLOT_KINDS", "const CLASS_SKILL_SLOT_KINDS");
  t = t.replace("export const CLASS_SKILL_UNLOCK_LEVEL", "const CLASS_SKILL_UNLOCK_LEVEL");
  t = t.replace("export const LEVEL_30_SKILL_IDS", "const LEVEL_30_SKILL_IDS");
  t = t.replace("export function compareClassSkillsByUnlock", "function compareClassSkillsByUnlock");
  t = t.replace("export function defaultActiveClassSkillIds", "function defaultActiveClassSkillIds");
  t = t.replace("export function getClassSignatureSkill", "function getClassSignatureSkill");
  t = t.replace("export function getClassSkillUnlockLevel", "function getClassSkillUnlockLevel");
  t = t.replace("export function isClassSkillSlotCandidate", "function isClassSkillSlotCandidate");
  write("src/features/builds/classSkillLoadout.js", t);

  // talentTrees TALENT_TREES - keep export if getTalentTree needs it internally only
  t = read("src/features/builds/talentTrees.js");
  t = t.replace("export const TALENT_TREES", "const TALENT_TREES");
  write("src/features/builds/talentTrees.js", t);

  // talentTreeLogic - unexport isRootUnlocked, meetsTierGate if only internal
  t = read("src/features/builds/talentTreeLogic.js");
  t = t.replace("export function meetsTierGate", "function meetsTierGate");
  t = t.replace("export function isRootUnlocked", "function isRootUnlocked");
  t = t.replace('from "./talentTrees.js"', 'from "./talentTrees"');
  write("src/features/builds/talentTreeLogic.js", t);

  t = read("src/features/builds/ClassSkillsPanel.jsx");
  t = t.replace('from "./talentTreeLogic.js"', 'from "./talentTreeLogic"');
  t = t.replace('from "./talentTrees.js"', 'from "./talentTrees"');
  write("src/features/builds/ClassSkillsPanel.jsx", t);

  console.log("misc unexports + .js imports ok");
}

// --- useCharacterBuild: fetchJsonData
{
  const p = "src/features/builds/useCharacterBuild.js";
  let t = read(p);
  if (!t.includes("fetchJsonData")) {
    t = t.replace(
      'import { PROGRESS_CHANGE_EVENT, readJsonStorage, writeJsonStorage } from "../../shared/utils/storage";',
      'import { fetchJsonData } from "../../shared/utils/dataCache";\nimport { PROGRESS_CHANGE_EVENT, readJsonStorage, writeJsonStorage } from "../../shared/utils/storage";'
    );
    t = t.replace(
      `const entries = await Promise.all(
          GEAR_COLLECTION_KEYS.map(async (key) => {
            const config = collectionConfigs[key];
            const response = await fetch(\`\${import.meta.env.BASE_URL}\${config.dataPath}\`);
            if (!response.ok) {
              throw new Error(\`Failed to load \${config.dataPath}\`);
            }
            const payload = await response.json();
            return [key, payload[config.collectionKey] ?? []];
          })
        );`,
      `const entries = await Promise.all(
          GEAR_COLLECTION_KEYS.map(async (key) => {
            const config = collectionConfigs[key];
            const payload = await fetchJsonData(config.dataPath);
            return [key, payload[config.collectionKey] ?? []];
          })
        );`
    );
    write(p, t);
  }
  console.log("useCharacterBuild fetchJsonData ok");
}

console.log("batch done");
