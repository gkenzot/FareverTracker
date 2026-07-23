/** Shared weapon-kit matching used by Arsenal and Weapons analysis. */

export function getWeaponSubcategory(item) {
  if (!item) {
    return "";
  }
  return (
    item.properties?.subcategory ||
    item.properties?.type ||
    item.family ||
    item.subcategory ||
    ""
  );
}

function skillMatchesItem(skill, { itemId, itemName }) {
  const granted = skill.grantedByItems || [];
  return granted.some((entry) => {
    if (itemId != null && entry.itemId != null && String(entry.itemId) === String(itemId)) {
      return true;
    }
    if (itemName && entry.itemName && String(entry.itemName) === String(itemName)) {
      return true;
    }
    return false;
  });
}

function skillMatchesSubcategory(skill, subcategory) {
  if (!subcategory) {
    return false;
  }
  const subs = skill.weaponSubcategories || [];
  if (subs.some((value) => String(value) === String(subcategory))) {
    return true;
  }
  return (skill.grantedByItems || []).some(
    (entry) => entry.subcategory && String(entry.subcategory) === String(subcategory)
  );
}

/** Icon / id prefixes used by MetaForge for each weapon family. */
const SUBCATEGORY_PREFIXES = {
  Axe: ["Axe_"],
  Book: ["Book_"],
  Bow: ["Bow_"],
  Crescent: ["Crescent_"],
  Daggers: ["Daggers_"],
  DualAxes: ["DA_", "DualAxes_"],
  DualMaces: ["DM_", "DualMaces_"],
  DualSwords: ["DS_", "DualSwords_"],
  Fists: ["Fists_"],
  GreatAxe: ["GA_", "GreatAxe_"],
  GreatMace: ["GM_", "GreatMace_"],
  GreatSword: ["GS_", "GreatSword_"],
  Halos: ["Halos_"],
  Mace: ["Mace_"],
  Scepter: ["Scepter_"],
  Shield: ["Shield_"],
  Spear: ["Spear_"],
  Staff: ["Staff_"],
  Sword: ["Sword_"],
  Thrown: ["Thrown_"]
};

function skillMatchesFamilyPrefix(skill, subcategory) {
  const prefixes = SUBCATEGORY_PREFIXES[subcategory] || [];
  if (!prefixes.length) {
    return false;
  }
  const haystacks = [skill.id, skill.iconFilename, skill.slug].filter(Boolean).map(String);
  return prefixes.some((prefix) =>
    haystacks.some((value) => value.startsWith(prefix) || value.includes(`_${prefix}`))
  );
}

export function resolveWeaponMeta(item) {
  if (!item) {
    return null;
  }
  return {
    subcategory: getWeaponSubcategory(item),
    itemId: item.metaforgeId ?? null,
    itemName: item.name
  };
}

export function filterWeaponKit(skills, kind, weaponMeta) {
  if (!weaponMeta) {
    return [];
  }
  const base = (skills || []).filter((skill) => skill.kind === kind);

  const byItem = base.filter((skill) => skillMatchesItem(skill, weaponMeta));
  if (byItem.length > 0) {
    return byItem.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }

  const bySub = base.filter((skill) => skillMatchesSubcategory(skill, weaponMeta.subcategory));
  if (bySub.length > 0) {
    return bySub.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }

  return base
    .filter((skill) => skillMatchesFamilyPrefix(skill, weaponMeta.subcategory))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

export function listWeaponKitSkills(skills, weaponMeta) {
  return [
    ...filterWeaponKit(skills, "Weapon Skill", weaponMeta),
    ...filterWeaponKit(skills, "Weapon Passive", weaponMeta)
  ];
}
