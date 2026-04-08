const PSWWorker = require("../models/PSWWorker");
const postalCodeCache = require("./postalCodeCache");

const MIN_CACHE_RESULTS = 3;

/**
 * Find available PSWs — postal-code cache first, geo fallback second.
 * If the cache returns fewer than MIN_CACHE_RESULTS, fall back to
 * the geo query and merge the two sets (deduplicated).
 */
async function findAvailablePSWs(coordinates, postalCode) {

  let cachedPSWs = [];

  // 1. Try postal-code pre-match (instant in-memory lookup)
  if (postalCode) {
    const { psws, source } = postalCodeCache.lookup(postalCode);

    if (psws.length > 0) {
      console.log(
        `[Availability] Postal cache hit (${source}): ${psws.length} workers for ${postalCode}`
      );

      // If we got enough results, return them directly
      if (psws.length >= MIN_CACHE_RESULTS) {
        return psws;
      }

      // Otherwise keep them but also run geo query
      cachedPSWs = psws;
      console.log(
        `[Availability] Cache returned only ${psws.length} workers (< ${MIN_CACHE_RESULTS}), supplementing with geo query`
      );
    }
  }

  // 2. Geo query (fallback or supplement)
  if (!coordinates || coordinates.length < 2) {
    return cachedPSWs;
  }

  console.log("[Availability] Running $near geo query");

  const geoPSWs = await PSWWorker.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: coordinates
        },
        $maxDistance: 15000
      }
    }
  });

  // Merge and deduplicate (geo results + cache results)
  if (cachedPSWs.length === 0) {
    return geoPSWs;
  }

  const seenIds = new Set(geoPSWs.map(p => p._id.toString()));
  const merged = [...geoPSWs];
  for (const cp of cachedPSWs) {
    const id = (cp._id || cp.id)?.toString();
    if (id && !seenIds.has(id)) {
      merged.push(cp);
    }
  }

  console.log(`[Availability] Merged: ${merged.length} unique workers (${geoPSWs.length} geo + ${cachedPSWs.length} cache)`);
  return merged;
}

module.exports = { findAvailablePSWs };