import { COLUMN_TIER_GATES, getTalentTree } from "./talentTrees.js";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ");
}

function stubId(className, name) {
  return `talent-stub:${String(className).toLowerCase()}:${normalizeName(name).replace(/[^a-z0-9]+/g, "-")}`;
}

/**
 * Resolve tree nodes against the skills catalog.
 * @returns {{
 *   classKey: string,
 *   root: object,
 *   branches: object[][][],
 *   byId: Map<string, object>
 * } | null}
 */
export function resolveTalentTree(className, skills = []) {
  const tree = getTalentTree(className);
  if (!tree) {
    return null;
  }

  const byName = new Map();
  for (const skill of skills) {
    if (skill?.kind !== "Talent") continue;
    const key = normalizeName(skill.name);
    if (!byName.has(key)) {
      byName.set(key, skill);
    }
  }

  function resolveNode(def, meta) {
    const catalog = byName.get(normalizeName(def.name));
    const id = catalog?.id || stubId(className, def.name);
    return {
      id,
      name: def.name,
      maxRank: Math.max(1, Number(def.maxRank) || 1),
      description: catalog?.description || def.description || "",
      iconPath: catalog?.iconPath,
      iconFilename: catalog?.iconFilename,
      iconUrl: catalog?.iconUrl,
      isStub: !catalog,
      ...meta
    };
  }

  const byId = new Map();
  const root = resolveNode(tree.root, { role: "root", branch: -1, tier: 0, slot: 0 });
  byId.set(root.id, root);

  const branches = tree.branches.map((tiers, branch) =>
    tiers.map((nodes, tierIndex) => {
      const tier = tierIndex + 1;
      return nodes.map((def, slot) => {
        const node = resolveNode(def, { role: "branch", branch, tier, slot });
        byId.set(node.id, node);
        return node;
      });
    })
  );

  return { classKey: className, root, branches, byId };
}

export function getPoints(pointsById, talentId) {
  return Math.max(0, Math.floor(Number(pointsById?.[talentId]) || 0));
}

export function getColumnPoints(resolved, pointsById, branchIndex) {
  if (!resolved?.branches?.[branchIndex]) {
    return 0;
  }
  let total = 0;
  for (const tierNodes of resolved.branches[branchIndex]) {
    for (const node of tierNodes) {
      total += getPoints(pointsById, node.id);
    }
  }
  return total;
}

/**
 * Column points from tiers strictly below `tier` (same branch).
 * Tier gates only care about investment already in earlier phases.
 */
export function getColumnPointsBeforeTier(resolved, pointsById, branchIndex, tier) {
  if (!resolved?.branches?.[branchIndex]) {
    return 0;
  }
  let total = 0;
  for (const tierNodes of resolved.branches[branchIndex]) {
    for (const node of tierNodes) {
      if (node.tier < tier) {
        total += getPoints(pointsById, node.id);
      }
    }
  }
  return total;
}

export function meetsTierGate(resolved, pointsById, node) {
  if (!node || node.role === "root") {
    return true;
  }
  const required = COLUMN_TIER_GATES[node.tier] ?? 0;
  // Only points in earlier tiers unlock the next phase — any talent in that tier is then free.
  return getColumnPointsBeforeTier(resolved, pointsById, node.branch, node.tier) >= required;
}

export function isRootUnlocked(resolved, pointsById) {
  if (!resolved?.root) {
    return false;
  }
  return getPoints(pointsById, resolved.root.id) >= 1;
}

/**
 * Whether this node can receive +1 point (ignores global budget).
 * Rules: root first, then only the column tier point gate (no “talent above” requirement).
 */
export function canIncreaseTalent(resolved, pointsById, talentId) {
  const node = resolved?.byId?.get(talentId);
  if (!node) {
    return false;
  }
  const points = getPoints(pointsById, talentId);
  if (points >= node.maxRank) {
    return false;
  }
  if (node.role === "root") {
    return true;
  }
  if (!isRootUnlocked(resolved, pointsById)) {
    return false;
  }
  return meetsTierGate(resolved, pointsById, node);
}

function wouldStillUnlock(resolved, nextPoints, child) {
  if (child.role === "root" || child.tier <= 1) {
    return true;
  }
  if (!isRootUnlocked(resolved, nextPoints)) {
    return false;
  }
  return meetsTierGate(resolved, nextPoints, child);
}

/**
 * Whether −1 / clear is allowed (won't drop column points below a higher tier's gate).
 */
export function canDecreaseTalent(resolved, pointsById, talentId, toZero = false) {
  const node = resolved?.byId?.get(talentId);
  if (!node) {
    return false;
  }
  const current = getPoints(pointsById, talentId);
  if (current <= 0) {
    return false;
  }

  const nextPoints = { ...pointsById };
  const nextValue = toZero ? 0 : current - 1;
  if (nextValue <= 0) {
    delete nextPoints[talentId];
  } else {
    nextPoints[talentId] = nextValue;
  }

  for (const other of resolved.byId.values()) {
    if (other.id === talentId) continue;
    if (getPoints(nextPoints, other.id) <= 0) continue;
    if (!wouldStillUnlock(resolved, nextPoints, other)) {
      return false;
    }
  }

  return true;
}

export function describeUnlockBlock(resolved, pointsById, talentId) {
  const node = resolved?.byId?.get(talentId);
  if (!node) {
    return "Talent desconhecido.";
  }
  if (node.role !== "root" && !isRootUnlocked(resolved, pointsById)) {
    return `Precisa de 1 ponto em ${resolved.root.name} (root).`;
  }
  if (node.role !== "root") {
    const required = COLUMN_TIER_GATES[node.tier] ?? 0;
    const have = getColumnPointsBeforeTier(resolved, pointsById, node.branch, node.tier);
    if (have < required) {
      return `Coluna precisa de ${required} pts nos tiers anteriores (tem ${have}).`;
    }
  }
  return "";
}
