// frontend/src/pages/BookingLocation.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createBookingRequest } from "../api/api";
import { useAuth } from "../context/AuthContext";

const SERVICE_LEVEL_INFO = {
  home_helper: { label: "Help Around the House", rate: 24.25 },
  care_services: { label: "Personal Care", rate: 26.19 },
  specialized_care: { label: "Specialized Care", rate: 27.84 },
};

export default function BookingLocation() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();

  const serviceLevel = state?.serviceLevel || "home_helper";
  const slInfo = SERVICE_LEVEL_INFO[serviceLevel];

  // Pre-fill from user profile
  const hasProfileAddress = !!(user?.address?.street && user?.address?.postalCode);
  const [useProfileAddress, setUseProfileAddress] = useState(hasProfileAddress);

  const [form, setForm] = useState({
    city: user?.address?.city || "",
    street: user?.address?.street || "",
    postalCode: user?.address?.postalCode || "",
    startingDate: "",
    genderPreference: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function switchToManualAddress() {
    setUseProfileAddress(false);
  }

  function switchToProfileAddress() {
    setUseProfileAddress(true);
    setForm((prev) => ({
      ...prev,
      street: user?.address?.street || "",
      city: user?.address?.city || "",
      postalCode: user?.address?.postalCode || "",
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const street = useProfileAddress ? (user?.address?.street || "") : form.street;
    const city = useProfileAddress ? (user?.address?.city || "") : form.city;
    const postalCode = useProfileAddress ? (user?.address?.postalCode || "") : form.postalCode;

    try {
      const payload = {
        street,
        city,
        postalCode,
        bookingType: "recurring",
        serviceLevel,
        timeOfDay: "daytime",
        visitDuration: "2-3 hours",
        daysPerWeek: 3,
        lengthOfCareWeeks: 4,
      };
      if (form.startingDate) payload.specificDate = form.startingDate;
      if (form.genderPreference) payload.genderPreference = form.genderPreference;

      const data = await createBookingRequest(payload);
      navigate(`/book/${data._id}/results`);
    } catch (err) {
      setError(err.errors || err.message);
    } finally {
      setLoading(false);
    }
  }

  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  return (
    <div className="page">
      <div className="step-indicator">Step 2 of 4</div>

      {/* Service banner */}
      <div className="service-banner">
        <div className="service-banner-info">
          <div className="service-banner-icon">✦</div>
          <div>
            <h4>{slInfo.label}</h4>
            <p className="rate">CA${slInfo.rate.toFixed(2)}/hr</p>
          </div>
        </div>
        <button className="btn-change" onClick={() => navigate("/find-psw")}>Change</button>
      </div>

      <h1>Where do you need care?</h1>
      <p style={{ marginBottom: 28 }}>We'll find available caregivers near this address.</p>

      <form onSubmit={handleSubmit}>
        <div className="card">
          {/* Profile address shortcut */}
          {hasProfileAddress && useProfileAddress && (
            <div className="address-prefill">
              <div className="address-prefill-icon">📍</div>
              <div className="address-prefill-info">
                <p className="address-prefill-label">Your address on file</p>
                <p className="address-prefill-value">
                  {user.address.street}
                  {user.address.unit ? `, ${user.address.unit}` : ""}
                  {user.address.city ? `, ${user.address.city}` : ""}
                  {" "}{user.address.postalCode}
                </p>
              </div>
              <button type="button" className="btn-change" onClick={switchToManualAddress}>
                Use a different address
              </button>
            </div>
          )}

          {/* Manual address fields (shown when no profile address or user opts out) */}
          {(!hasProfileAddress || !useProfileAddress) && (
            <div className="form-grid">
              {hasProfileAddress && (
                <div style={{ gridColumn: "1 / -1", marginBottom: 8 }}>
                  <button type="button" className="btn-change" onClick={switchToProfileAddress}>
                    ← Use my address on file
                  </button>
                </div>
              )}
              <div className="form-group">
                <label>Street Address</label>
                <input className="form-input" type="text" required value={form.street}
                  onChange={(e) => update("street", e.target.value)} placeholder="e.g. 123 Main Street" />
              </div>
              <div className="form-group">
                <label>City</label>
                <input className="form-input" type="text" required value={form.city}
                  onChange={(e) => update("city", e.target.value)} placeholder="e.g. Toronto" />
              </div>
              <div className="form-group">
                <label>Postal Code</label>
                <input className="form-input" type="text" required value={form.postalCode}
                  onChange={(e) => update("postalCode", e.target.value)} placeholder="e.g. M5V 2T6" />
              </div>
            </div>
          )}

          <div className="form-grid" style={{ marginTop: hasProfileAddress && useProfileAddress ? 16 : 0 }}>
            <div className="form-group">
              <label>When would you like to start?</label>
              <input className="form-input" type="date" value={form.startingDate}
                min={minDate}
                onChange={(e) => update("startingDate", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Caregiver gender preference</label>
              <select className="form-input" value={form.genderPreference} onChange={(e) => update("genderPreference", e.target.value)}>
                <option value="">No preference</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-banner mt-16">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}

        <button type="submit" className="btn btn-primary mt-24" disabled={loading}
          style={{ padding: "14px 24px", fontSize: 16 }}>
          {loading ? "Finding caregivers…" : "Find Caregivers Near Me"}
        </button>
      </form>
    </div>
  );
}