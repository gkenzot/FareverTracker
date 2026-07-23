import fs from "fs";

const path = "src/features/builds/aggregateBuildAttributes.js";
let text = fs.readFileSync(path, "utf8");

text = text.replace(
  /import \{[\s\S]*?\} from "\.\/buildSlots";/,
  `import {
  EQUIPMENT_SLOTS,
  findAugmentByName,
  getAdornmentFieldsForSlot,
  getAugmentDisplayName,
  getDefaultUsedRarity,
  isWeaponEquipmentSlot,
  isOffHandOnlyWeapon,
  resolveSlotAdornments,
  resolveUsedLevel,
  resolveUsedRarity,
  resolveUsedUpgradeLevel
} from "./buildSlots";`
);

text = text.replace(
  /function normalizeLookup\(value\) \{[\s\S]*?\nfunction resolveEquippedItemStats/,
  "function resolveEquippedItemStats"
);

fs.writeFileSync(path, text);
console.log({
  hasLocalFind: /function findAugmentByName/.test(text),
  hasImport: text.includes("findAugmentByName"),
  hasNormalize: text.includes("normalizeLookup")
});
