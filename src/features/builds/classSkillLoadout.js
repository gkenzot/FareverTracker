/** Class skill loadout helpers shared by Class Skills panel and kit analysis. */

/** Max toggleable Active skills on the class bar (Signature is always on, separate). */
export const CLASS_SKILL_MAX_ACTIVE = 4;

/** EA cap: level 30 skills exist in data but cannot be unlocked yet. */
const LEVEL_30_SKILL_IDS = new Set([
  "Warrior_BurstOfAnger",
  "Mage_Overload",
  "Priest_Miracle",
  "Rogue_Darkness"
]);

/** Signature skills that stay always equipped (not counted in CLASS_SKILL_MAX_ACTIVE). */
export const CLASS_SIGNATURE_SKILL_IDS = new Set([
  "Warrior_Rage_Strike",
  "Mage_RayOfSpark",
  "Priest_Sig_DivineIntervention",
  "Rogue_Sig_Finisher"
]);

/** Kinds that appear on the class skill bar (Prayers are a separate Rosary system). */
const CLASS_SKILL_SLOT_KINDS = new Set(["Active", "Signature"]);

/**
 * Unlock level for class bar skills (progression tables).
 * Missing ids fall back to 99 (unknown) or 30 when locked.
 */
const CLASS_SKILL_UNLOCK_LEVEL = {
  // Warrior
  Warrior_Rage_Strike: 1,
  Warrior_Charge: 3,
  Warrior_IgnorePain: 5,
  Warrior_BattleShout: 10,
  Warrior_SurgingForce: 15,
  Warrior_Berserk: 20,
  Warrior_BurstOfAnger: 30,
  // Mage
  Mage_RayOfSpark: 1,
  Mage_Blink: 3,
  Mage_ShieldOfSpark: 5,
  Mage_MysticEmpowerment: 10,
  Mage_StaticNova: 15,
  Mage_ChronoReset: 20,
  Mage_Overload: 30,
  // Priest
  Priest_Sig_DivineIntervention: 1,
  Priest_FaithfulWinds: 3,
  Priest_RadiantVerdict: 5,
  Priest_BlessingOfFervor: 10,
  Priest_Crusader: 15,
  Priest_BeaconOfHope: 20,
  Priest_Miracle: 30,
  // Rogue
  Rogue_Sig_Finisher: 1,
  Rogue_Shadowstep: 3,
  Rogue_SmokeBomb: 5,
  Rogue_DeathMark: 10,
  Rogue_KnivesTempest: 15,
  Rogue_UrgeToKill: 20,
  Rogue_Darkness: 30
};

export function isLevel30Skill(skill) {
  if (!skill) {
    return false;
  }
  if (LEVEL_30_SKILL_IDS.has(skill.id)) {
    return true;
  }
  return getClassSkillUnlockLevel(skill) >= 30;
}

export function isClassSignatureSkill(skill) {
  if (!skill) {
    return false;
  }
  if (skill.kind === "Signature") {
    return true;
  }
  return CLASS_SIGNATURE_SKILL_IDS.has(skill.id);
}

function getClassSkillUnlockLevel(skill) {
  if (!skill) {
    return 99;
  }
  if (CLASS_SKILL_UNLOCK_LEVEL[skill.id] != null) {
    return CLASS_SKILL_UNLOCK_LEVEL[skill.id];
  }
  if (LEVEL_30_SKILL_IDS.has(skill.id)) {
    return 30;
  }
  return 99;
}

function isClassSkillSlotCandidate(skill) {
  if (!skill || !CLASS_SKILL_SLOT_KINDS.has(skill.kind)) {
    return false;
  }
  // MetaForge sometimes ships status/move variants of the same Active.
  if (/_(Status|MoveSpeed)$/i.test(String(skill.id || ""))) {
    return false;
  }
  return true;
}

export function skillMatchesClass(skill, className) {
  if (!className) {
    return false;
  }
  const wanted = String(className).trim().toLowerCase();
  return (skill.classes || []).some((value) => String(value).trim().toLowerCase() === wanted);
}

function compareClassSkillsByUnlock(left, right) {
  // Signature first, then Actives by unlock level.
  const leftSig = Number(isClassSignatureSkill(left));
  const rightSig = Number(isClassSignatureSkill(right));
  if (leftSig !== rightSig) {
    return rightSig - leftSig;
  }
  const levelDelta = getClassSkillUnlockLevel(left) - getClassSkillUnlockLevel(right);
  if (levelDelta !== 0) {
    return levelDelta;
  }
  return String(left.name).localeCompare(String(right.name));
}

export function listClassSkillSlotRows(skills, className) {
  return (skills || [])
    .filter((skill) => isClassSkillSlotCandidate(skill))
    .filter((skill) => skillMatchesClass(skill, className))
    .sort(compareClassSkillsByUnlock);
}

function getClassSignatureSkill(skills, className) {
  return (
    listClassSkillSlotRows(skills, className).find((skill) => isClassSignatureSkill(skill)) ?? null
  );
}

/** First N unlockable Actives (Signature is always separate / always on). */
function defaultActiveClassSkillIds(skills, className, limit = CLASS_SKILL_MAX_ACTIVE) {
  return listClassSkillSlotRows(skills, className)
    .filter((skill) => skill.kind === "Active" && !isLevel30Skill(skill))
    .slice(0, Math.max(0, limit))
    .map((skill) => skill.id);
}

function normalizeToggleableIds(ids, skills, className) {
  const signature = getClassSignatureSkill(skills, className);
  const signatureId = signature?.id ?? "";
  const validActiveIds = new Set(
    listClassSkillSlotRows(skills, className)
      .filter((skill) => skill.kind === "Active" && !isLevel30Skill(skill))
      .map((skill) => skill.id)
  );
  const next = [];
  for (const skillId of ids || []) {
    if (!skillId || skillId === signatureId || !validActiveIds.has(skillId)) {
      continue;
    }
    if (!next.includes(skillId)) {
      next.push(skillId);
    }
    if (next.length >= CLASS_SKILL_MAX_ACTIVE) {
      break;
    }
  }
  return next;
}

/**
 * Toggleable Active ids only (no Signature).
 * Untouched loadouts use the first 4 unlockable Actives.
 */
export function resolveToggleableClassSkillIds(classSkills, skills, className) {
  if (classSkills?.activeSkillsTouched) {
    return normalizeToggleableIds(classSkills.activeSkillIds, skills, className);
  }
  if (Array.isArray(classSkills?.activeSkillIds) && classSkills.activeSkillIds.length > 0) {
    return normalizeToggleableIds(classSkills.activeSkillIds, skills, className);
  }
  return defaultActiveClassSkillIds(skills, className);
}

/** Full kit set: Signature (always) + up to 4 Actives. */
export function resolveActiveClassSkillIds(classSkills, skills, className) {
  const signature = getClassSignatureSkill(skills, className);
  const actives = resolveToggleableClassSkillIds(classSkills, skills, className);
  const ids = [];
  if (signature?.id) {
    ids.push(signature.id);
  }
  for (const skillId of actives) {
    if (!ids.includes(skillId)) {
      ids.push(skillId);
    }
  }
  return ids;
}
