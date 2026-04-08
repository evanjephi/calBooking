const PSWWorker = require("../models/PSWWorker");
const { isPSWAvailable } = require("./schedulingService");
const postalCodeCache = require("./postalCodeCache");

async function matchPSWs(request) {

  // 1. find nearby workers — postal-code cache first, geo fallback
  let psws = [];
  const postalCode = request.location?.postalCode;

  if (postalCode) {
    const { psws: cached, source } = postalCodeCache.lookup(postalCode);
    if (cached.length > 0) {
      console.log(`[matchingService] Postal cache hit (${source}): ${cached.length} workers`);
      psws = cached;
    }
  }

  if (psws.length === 0) {
    psws = await PSWWorker.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: request.location.coordinates
          },
          $maxDistance: 15000
        }
      }
    });
  }

  // 2. filter by preference availability
  const filtered = psws.filter(psw => {
    return psw.availabilityPreferences?.[request.timeOfDay];
  });

  // 3. check actual booking conflicts
  const available = [];

  for (const psw of filtered) {

    const free = await isPSWAvailable(
      psw._id,
      request.startTime,
      request.endTime
    );

    if (free) {
      available.push(psw);
    }

  }

  // 4. rank workers
  const ranked = available.map(psw => {

    const score =
      (psw.rating * 5) +
      (psw.yearsExperience * 2);

    return {
      psw,
      score
    };

  });

  ranked.sort((a,b)=> b.score - a.score);

  return ranked.map(r => r.psw);
}

module.exports = { matchPSWs };