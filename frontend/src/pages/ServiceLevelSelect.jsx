// frontend/src/pages/ServiceLevelSelect.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getServiceLevels } from "../api/api";

export default function ServiceLevelSelect() {
  const navigate = useNavigate();
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServiceLevels()
      .then(setLevels)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(level) {
    navigate("/booking/location", { state: { serviceLevel: level.key, label: level.label, rate: level.clientRate } });
  }

  if (loading) return <p className="center-text">Loading…</p>;

  return (
    <>
      <div className="hero">
        <h1>What kind of help do you need?</h1>
        <p>Choose the type of care that best fits your needs. You can always change this later.</p>
      </div>

      <div className="page">
        <div className="three-col">
          {levels.map((level) => (
            <div
              key={level.key}
              className={`service-card ${level.popular ? "service-card-popular" : ""}`}
              onClick={() => handleSelect(level)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(level); } }}
            >
              {level.popular && <div className="ribbon">Most Popular</div>}
              <div className="service-card-icon">{level.icon || "🏠"}</div>
              <h3>{level.label}</h3>
              <p>{level.description}</p>
              {level.examples && <p className="service-card-examples">{level.examples}</p>}
              <div className="rate">CA${level.clientRate.toFixed(2)}</div>
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
