import fs from "fs";

const labPath = "src/features/builds/BuildLabPage.jsx";
const chartsPath = "src/features/builds/BuildCharts.jsx";

let lab = fs.readFileSync(labPath, "utf8");
let charts = fs.readFileSync(chartsPath, "utf8");

const startMarker = "const DEFAULT_SKILL_PARAMS = {";
const endMarker = "function BuildSetSwitcher({";
const start = lab.indexOf(startMarker);
const end = lab.indexOf(endMarker);
if (start < 0 || end < 0) {
  throw new Error(`markers not found start=${start} end=${end}`);
}

const movedBlock = lab.slice(start, end).trimEnd() + "\n\n";

// Remove moved block from BuildLabPage, keep BuildSetSwitcher
lab = lab.slice(0, start) + lab.slice(end);

// Update BuildLabPage imports
lab = lab.replace(
  'import { BuildCharts, SecondaryAnalysisCharts } from "./BuildCharts";\nimport { buildDamageStatsForSet, formatDamageProfileLabel, formatDamageProfileSource } from "./buildDamageStats";',
  `import {
  AttributeComparative,
  BuildCharts,
  CompareBuildToggles,
  EnemyDefensePicker,
  SecondaryAnalysisCharts,
  SkillParamsEditor
} from "./BuildCharts";
import { buildDamageStatsForSet, formatDamageProfileSource } from "./buildDamageStats";`
);

lab = lab.replace(
  'import { EquipmentPaperDoll } from "./EquipmentLoadout";',
  'import { EquipmentPaperDoll } from "./EquipmentPaperDoll";'
);

lab = lab.replace(
  'import {\n  BOSS_LEVEL_MAX,\n  BOSS_LEVEL_MIN,\n  DEFAULT_BOSS_LEVEL,\n  bossArmorAtLevel,\n  bossNamesAtLevel\n} from "./enemyDefensePresets";',
  'import {\n  BOSS_LEVEL_MAX,\n  BOSS_LEVEL_MIN,\n  DEFAULT_BOSS_LEVEL,\n  bossArmorAtLevel\n} from "./enemyDefensePresets";'
);

lab = lab.replace(
  'import { DEFAULT_BUILD, DEFENSE_MODIFIER, calculateBuildDamage } from "./damageFormulas";',
  'import { DEFENSE_MODIFIER, calculateBuildDamage } from "./damageFormulas";'
);

if (!lab.includes('fetchJsonData')) {
  lab = lab.replace(
    'import { PageShell } from "../../components/PageShell";',
    'import { PageShell } from "../../components/PageShell";\nimport { fetchJsonData } from "../../shared/utils/dataCache";'
  );
}

lab = lab.replace(
  /async function loadAugments\(\) \{[\s\S]*?\n    \}\n\n    async function loadSkills\(\) \{[\s\S]*?\n    \}/,
  `async function loadAugments() {
      try {
        const payload = await fetchJsonData("data/augments.json");
        if (!cancelled) {
          setAugments(Array.isArray(payload.augments) ? payload.augments : []);
        }
      } catch {
        if (!cancelled) {
          setAugments([]);
        }
      }
    }

    async function loadSkills() {
      try {
        const payload = await fetchJsonData("data/skills.json");
        if (!cancelled) {
          setSkillsCatalog(Array.isArray(payload.skills) ? payload.skills : []);
          setTalentPointBudget(Number(payload.talentPointsAtLevel25) || TALENT_POINTS_AT_LEVEL_25);
        }
      } catch {
        if (!cancelled) {
          setSkillsCatalog([]);
        }
      }
    }`
);

// DEFAULT_SKILL_PARAMS was removed but skillParams state still uses it - need DEFAULT_BUILD.modifier
if (!lab.includes("DEFAULT_SKILL_PARAMS") && lab.includes("useState(DEFAULT_SKILL_PARAMS)")) {
  // already handled if block removed incorrectly
}
lab = lab.replace(
  "const [skillParams, setSkillParams] = useState(DEFAULT_SKILL_PARAMS);",
  "const [skillParams, setSkillParams] = useState({ modifier: 0.7875 });"
);

// Patch BuildCharts imports + append moved components as exports
if (!charts.includes("SkillParamsEditor")) {
  charts = charts.replace(
    `import {
  formatDamageProfileLabel,
  formatDamageProfileSource
} from "./buildDamageStats";
import {
  buildAverageDamageCurve,
  buildSecondaryIsolationCurves,
  calculateBuildDamage,
  rankGearSecondaryChoices,
  sampleEnemyDefenseRange
} from "./damageFormulas";`,
    `import {
  formatDamageProfileLabel,
  formatDamageProfileSource
} from "./buildDamageStats";
import {
  buildAverageDamageCurve,
  buildSecondaryIsolationCurves,
  calculateBuildDamage,
  DEFAULT_BUILD,
  rankGearSecondaryChoices,
  sampleEnemyDefenseRange
} from "./damageFormulas";
import {
  BOSS_LEVEL_MAX,
  BOSS_LEVEL_MIN,
  DEFAULT_BOSS_LEVEL,
  bossArmorAtLevel,
  bossNamesAtLevel
} from "./enemyDefensePresets";`
  );

  const exportified = movedBlock
    .replace("const DEFAULT_SKILL_PARAMS = {", "const DEFAULT_SKILL_PARAMS = {")
    .replace("function MultiStatRow(", "function MultiStatRow(")
    .replace("function SkillParamsEditor(", "export function SkillParamsEditor(")
    .replace("function EnemyDefensePicker(", "export function EnemyDefensePicker(")
    .replace("function AttributeComparative(", "export function AttributeComparative(")
    .replace("function CompareBuildToggles(", "export function CompareBuildToggles(");

  charts = charts.trimEnd() + "\n\n" + exportified;
}

fs.writeFileSync(labPath, lab);
fs.writeFileSync(chartsPath, charts);
console.log("moved components; lab length", lab.length, "charts", charts.length);
console.log("has SkillParamsEditor in charts", charts.includes("export function SkillParamsEditor"));
console.log("has BuildSetSwitcher in lab", lab.includes("function BuildSetSwitcher"));
console.log("DEFAULT_SKILL_PARAMS in charts", charts.includes("DEFAULT_SKILL_PARAMS"));
