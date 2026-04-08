const Booking = require("../models/Booking");

/*
Check if a PSW has any overlapping booking
*/
async function hasScheduleConflict(pswId, startTime, endTime) {

  const conflict = await Booking.findOne({
    pswWorker: pswId,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  });

  return !!conflict;
}


/*
Return only PSWs that are actually free
*/
async function filterAvailablePSWs(psws, startTime, endTime) {

  const available = [];

  for (const psw of psws) {

    const conflict = await hasScheduleConflict(
      psw._id,
      startTime,
      endTime
    );

    if (!conflict) {
      available.push(psw);
    }

  }

  return available;
}


module.exports = {
  hasScheduleConflict,
  filterAvailablePSWs
};