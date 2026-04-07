// One-time script: backfill profilePhoto, gender, bio for existing PSW workers
require("dotenv").config();
const mongoose = require("mongoose");
const PSWWorker = require("./models/PSWWorker");
const db = require("./config/db");

const BIOS = [
  "Compassionate and experienced caregiver dedicated to providing personalized support. Skilled in daily living assistance, mobility support, and companionship care.",
  "Certified PSW with extensive experience in home care and senior support. Committed to maintaining client dignity and independence.",
  "Caring professional specializing in elderly care and chronic condition management. Strong communication skills and a patient-focused approach.",
  "Experienced personal support worker passionate about improving quality of life. Expertise in medication reminders, meal prep, and personal hygiene assistance.",
  "Dedicated caregiver with a warm, patient demeanor. Specializes in dementia care, post-surgery recovery, and daily living support.",
  "Highly skilled PSW offering reliable, respectful in-home care. Focused on building trust and promoting client well-being.",
  "Friendly and dependable support worker experienced in palliative care, light housekeeping, and emotional support for clients and families.",
  "Professional caregiver with years of hands-on experience. Adept at adapting care plans to meet evolving client needs.",
];

async function run() {
  await db();

  const workers = await PSWWorker.find({});
  console.log(`Found ${workers.length} PSW workers to update.`);

  let updated = 0;
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    const gender = i % 2 === 0 ? "Female" : "Male";
    const bio = BIOS[i % BIOS.length];
    const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(w.firstName + "+" + w.lastName)}&size=256&background=5f8d7e&color=fff&bold=true`;

    // Also clean up any empty strings in serviceLevels
    const cleanLevels = (w.serviceLevels || []).filter((l) => l && l.length > 0);

    await PSWWorker.updateOne(
      { _id: w._id },
      { $set: { profilePhoto: photoUrl, gender, bio, serviceLevels: cleanLevels } }
    );
    updated++;
    console.log(`  ✓ ${w.firstName} ${w.lastName} — ${gender}`);
  }

  console.log(`\nUpdated ${updated} of ${workers.length} PSW workers.`);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
