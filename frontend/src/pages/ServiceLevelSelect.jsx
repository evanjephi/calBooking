// frontend/src/pages/ServiceLevelSelect.jsx
import { useNavigate } from "react-router-dom";

const SERVICE_LEVELS = [
  {
    value: "home_helper",
    icon: "🏠",
    label: "Help Around the House",
    rate: 24.25,
    description:
      "Light housekeeping, meal preparation, companionship, and everyday living assistance.",
    examples: "Cooking, cleaning, laundry, grocery shopping, friendly company",
    popular: false,
  },
  {
    value: "care_services",
    icon: "💛",
    label: "Personal Care",
    rate: 26.19,
    description:
      "Hands-on personal care including hygiene help, mobility support, and medication reminders.",
    examples: "Bathing, dressing, walking support, medication reminders",
    popular: true,
  },
  {
    value: "specialized_care",
    icon: "⭐",
    label: "Specialized Care",
    rate: 27.84,
    description:
      "Advanced care for complex needs such as dementia, palliative support, or post-surgery recovery.",
    examples: "Dementia care, palliative support, post-surgery help",
    popular: false,
  },
];

export default function ServiceLevelSelect() {
  const navigate = useNavigate();

  function handleSelect(level) {
    navigate("/booking/location", { state: { serviceLevel: level.value, label: level.label, rate: level.rate } });
  }

  return (
    <>
      <div className="hero">
        <h1>What kind of help do you need?</h1>
        <p>Choose the type of care that best fits your needs. You can always change this later.</p>
      </div>

      <div className="page">
        <div className="three-col">
          {SERVICE_LEVELS.map((level) => (
            <div
              key={level.value}
              className={`service-card ${level.popular ? "service-card-popular" : ""}`}
              onClick={() => handleSelect(level)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(level); } }}
            >
              {level.popular && <div className="ribbon">Most Popular</div>}
              <div className="service-card-icon">{level.icon}</div>
              <h3>{level.label}</h3>
              <p>{level.description}</p>
              <p className="service-card-examples">{level.examples}</p>
              <div className="rate">CA${level.rate.toFixed(2)}</div>
              <div className="rate-unit">per hour</div>
              <button className="btn btn-teal btn-block" onClick={(e) => { e.stopPropagation(); handleSelect(level); }}>
                Choose This
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
