const ServiceLevel = require("../models/ServiceLevel");

// Hardcoded fallback rates (used only if DB has no service levels)
const FALLBACK_RATES = {
  home_helper: 18.51,
  care_services: 19.99,
  specialized_care: 21.25
};

// Default service level data for seeding
const DEFAULT_SERVICE_LEVELS = [
  {
    key: "home_helper",
    label: "Help Around the House",
    description: "Light housekeeping, meal preparation, companionship, and everyday living assistance.",
    clientRate: 24.25,
    pswRate: 18.51,
    icon: "🏠",
    examples: "Cooking, cleaning, laundry, grocery shopping, friendly company",
    popular: false,
    sortOrder: 1
  },
  {
    key: "care_services",
    label: "Personal Care",
    description: "Hands-on personal care including hygiene help, mobility support, and medication reminders.",
    clientRate: 26.19,
    pswRate: 19.99,
    icon: "💛",
    examples: "Bathing, dressing, walking support, medication reminders",
    popular: true,
    sortOrder: 2
  },
  {
    key: "specialized_care",
    label: "Specialized Care",
    description: "Advanced care for complex needs such as dementia, palliative support, or post-surgery recovery.",
    clientRate: 27.84,
    pswRate: 21.25,
    icon: "⭐",
    examples: "Dementia care, palliative support, post-surgery help",
    popular: false,
    sortOrder: 3
  }
];

/**
 * Seed default service levels into DB if none exist.
 */
async function seedServiceLevels() {
  const count = await ServiceLevel.countDocuments();
  if (count === 0) {
    await ServiceLevel.insertMany(DEFAULT_SERVICE_LEVELS);
    console.log("Seeded default service levels");
  }
}

/**
 * Get PSW pay rates from DB (keyed by service level key).
 * Falls back to FALLBACK_RATES if DB is empty.
 */
async function getServiceRates() {
  const levels = await ServiceLevel.find({ active: true }).lean();
  if (levels.length === 0) return { ...FALLBACK_RATES };
  const rates = {};
  for (const l of levels) rates[l.key] = l.pswRate;
  return rates;
}

/**
 * Get client-facing rates from DB.
 * Falls back to hardcoded if DB is empty.
 */
async function getClientRates() {
  const levels = await ServiceLevel.find({ active: true }).lean();
  if (levels.length === 0) return { home_helper: 24.25, care_services: 26.19, specialized_care: 27.84 };
  const rates = {};
  for (const l of levels) rates[l.key] = l.clientRate;
  return rates;
}

/**
 * Get the rate for a single service level by key (PSW rate — used for billing).
 */
async function getRateForLevel(key) {
  if (!key) return null;
  const level = await ServiceLevel.findOne({ key, active: true }).lean();
  if (level) return level.pswRate;
  return FALLBACK_RATES[key] || null;
}

// Legacy static export for existing consumers that import SERVICE_RATES
// New code should use getServiceRates() or getRateForLevel()
const SERVICE_RATES = FALLBACK_RATES;

module.exports = {
  SERVICE_RATES,
  FALLBACK_RATES,
  DEFAULT_SERVICE_LEVELS,
  seedServiceLevels,
  getServiceRates,
  getClientRates,
  getRateForLevel
};
