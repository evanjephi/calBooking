require('dotenv').config();
const mongoose = require('mongoose');
const PSW = require('./models/PSWWorker');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await PSW.updateMany(
    { $or: [{ serviceLevels: { $exists: false } }, { serviceLevels: { $size: 0 } }] },
    { $set: { serviceLevels: ['home_helper', 'care_services', 'specialized_care'] } }
  );
  console.log(`Updated ${result.modifiedCount} of ${result.matchedCount} PSW workers`);
  await mongoose.disconnect();
  process.exit(0);
})();
