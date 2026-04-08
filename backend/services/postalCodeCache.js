const PSWWorker = require("../models/PSWWorker");

/*
  Postal-Code Pre-Matching Cache

  Builds an in-memory map:  FSA (first 3 chars of postal code) → [PSW workers]

  Canadian postal codes follow the pattern "A1A 1A1".
  The first 3 characters (FSA = Forward Sortation Area) define a geographic zone.
  Workers sharing the same FSA are almost always within ~15 km of each other.

  This avoids running a $near geospatial query on every match request.
*/

// FSA → [PSWWorker documents]
let fsaMap = new Map();

// full postalCode → [PSWWorker documents]
let postalMap = new Map();

// timestamp of last rebuild
let lastBuilt = null;

/**
 * Normalize a postal code to uppercase, no spaces.
 */
function normalize(postalCode) {
  if (!postalCode) return null;
  return postalCode.replace(/\s+/g, "").toUpperCase();
}

/**
 * Extract FSA (first 3 chars) from a postal code.
 */
function getFSA(postalCode) {
  const norm = normalize(postalCode);
  if (!norm || norm.length < 3) return null;
  return norm.substring(0, 3);
}

/**
 * Build (or rebuild) the cache from the database.
 * Call once on server startup and whenever PSW records change.
 */
async function buildCache() {
  const psws = await PSWWorker.find().lean();

  const newFsaMap = new Map();
  const newPostalMap = new Map();

  for (const psw of psws) {
    const raw = psw.homeAddress?.postalCode;
    const norm = normalize(raw);
    const fsa = getFSA(raw);

    if (fsa) {
      if (!newFsaMap.has(fsa)) newFsaMap.set(fsa, []);
      newFsaMap.get(fsa).push(psw);
    }

    if (norm) {
      if (!newPostalMap.has(norm)) newPostalMap.set(norm, []);
      newPostalMap.get(norm).push(psw);
    }
  }

  fsaMap = newFsaMap;
  postalMap = newPostalMap;
  lastBuilt = new Date();

  console.log(
    `[PostalCodeCache] Built — ${psws.length} workers across ${newFsaMap.size} FSAs`
  );
}

/**
 * Look up PSWs by postal code.
 *
 * Strategy:
 *  1. Exact postal code match  → highest relevance
 *  2. Same FSA match           → very close geographically
 *  3. Fallback returns []      → caller should use geo query
 *
 * Returns { psws: [...], source: "exact" | "fsa" | "none" }
 */
function lookup(postalCode) {
  const norm = normalize(postalCode);
  const fsa = getFSA(postalCode);

  // exact postal code
  if (norm && postalMap.has(norm)) {
    return { psws: postalMap.get(norm), source: "exact" };
  }

  // same FSA
  if (fsa && fsaMap.has(fsa)) {
    return { psws: fsaMap.get(fsa), source: "fsa" };
  }

  return { psws: [], source: "none" };
}

/**
 * Get cache stats (for debugging / admin endpoints).
 */
function getStats() {
  return {
    totalFSAs: fsaMap.size,
    totalPostalCodes: postalMap.size,
    lastBuilt,
    fsaSummary: Array.from(fsaMap.entries()).map(([fsa, workers]) => ({
      fsa,
      workerCount: workers.length
    }))
  };
}

module.exports = {
  buildCache,
  lookup,
  getFSA,
  normalize,
  getStats
};
