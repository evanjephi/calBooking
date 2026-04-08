const BookingRequest = require("../models/BookingRequest");
const { matchPSWs } = require("../services/matchingService");

exports.checkAvailability = async (req, res) => {

  try {

    const request = await BookingRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // find matching PSWs
    const matches = await matchPSWs(request);

    // store summary data in request
    request.availabilityCount = matches.length;

    request.matchedPSWs = matches
      .slice(0, 5)
      .map(worker => worker._id);

    await request.save();

    return res.json({
      availabilityCount: matches.length,
      topMatches: matches.slice(0, 5)
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      message: "Error checking availability"
    });

  }

};