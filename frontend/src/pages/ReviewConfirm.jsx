// frontend/src/pages/ReviewConfirm.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBookingRequest, confirmRequest, finalizeBooking, getServiceLevels } from "../api/api";

export default function ReviewConfirm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [serviceLevelLabels, setServiceLevelLabels] = useState({});

  useEffect(() => {
    Promise.all([
      getBookingRequest(id),
      getServiceLevels()
    ]).then(([reqData, levelsData]) => {
      setRequest(reqData);
      const labels = {};
      for (const l of levelsData) {
        labels[l.key] = `${l.label} — CA$${l.clientRate.toFixed(2)}/hr`;
      }
      setServiceLevelLabels(labels);
    })
      .then(setRequest)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleConfirmAndFinalize() {
    setSubmitting(true);
    setError(null);
    try {
      // Step 1: Confirm the request
      await confirmRequest(id);
      // Step 2: Finalize — creates booking + slots
      const result = await finalizeBooking(id);
      navigate(`/book/${id}/success`, { state: result });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page"><p className="center-text">Loading summary…</p></div>;
  if (!request) return <div className="page"><div className="error-banner">Booking request not found.</div></div>;

  const loc = request.location || {};
  const addr = request.serviceAddress || {};
  const contact = request.contact || {};
  const psw = request.selectedPSW || {};

  const durationLabels = {
    "1 hour": "1 hour",
    "2-3 hours": "2–3 hours",
    "4-6 hours": "4–6 hours",
    "more than 6 hours": "6+ hours",
  };

  return (
    <div className="page">
      <div className="step-indicator">Step 4 of 5</div>
      <h1>Review & Confirm</h1>
      <p>Please review your booking details before confirming.</p>

      <div className="card mt-20">
        <h2>Location</h2>
        <div className="summary-row">
          <span className="summary-label">City</span>
          <span className="summary-value">{loc.city}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Postal Code</span>
          <span className="summary-value">{loc.postalCode}</span>
        </div>
      </div>

      {addr.street && (
        <div className="card">
          <h2>Service Address</h2>
          <div className="summary-row">
            <span className="summary-label">Street</span>
            <span className="summary-value">{addr.street}</span>
          </div>
          {addr.unit && (
            <div className="summary-row">
              <span className="summary-label">Unit / Apt</span>
              <span className="summary-value">{addr.unit}</span>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>Schedule</h2>
        <div className="summary-row">
          <span className="summary-label">Booking Type</span>
          <span className="summary-value" style={{ textTransform: "capitalize" }}>
            {request.bookingType === "one-time" ? "One-time visit" : "Recurring care"}
          </span>
        </div>
        {request.serviceLevel && (
          <div className="summary-row">
            <span className="summary-label">Service Level</span>
            <span className="summary-value">{serviceLevelLabels[request.serviceLevel] || request.serviceLevel}</span>
          </div>
        )}
        {request.bookingType === "one-time" && request.specificDate && (
          <div className="summary-row">
            <span className="summary-label">Date</span>
            <span className="summary-value">{new Date(request.specificDate).toLocaleDateString()}</span>
          </div>
        )}
        {request.bookingType !== "one-time" && (
          <div className="summary-row">
            <span className="summary-label">Days per Week</span>
            <span className="summary-value">{request.daysPerWeek}</span>
          </div>
        )}
        {request.preferredDays && request.preferredDays.length > 0 && (
          <div className="summary-row">
            <span className="summary-label">Preferred Days</span>
            <span className="summary-value">{request.preferredDays.join(", ")}</span>
          </div>
        )}
        <div className="summary-row">
          <span className="summary-label">Time of Day</span>
          <span className="summary-value" style={{ textTransform: "capitalize" }}>{request.timeOfDay}</span>
        </div>
        {request.preferredStartHour != null && (
          <div className="summary-row">
            <span className="summary-label">Start Time</span>
            <span className="summary-value">
              {request.preferredStartHour === 0 ? "12:00 AM"
                : request.preferredStartHour < 12 ? `${request.preferredStartHour}:00 AM`
                : request.preferredStartHour === 12 ? "12:00 PM"
                : `${request.preferredStartHour - 12}:00 PM`}
            </span>
          </div>
        )}
        <div className="summary-row">
          <span className="summary-label">Visit Duration</span>
          <span className="summary-value">{durationLabels[request.visitDuration] || request.visitDuration}</span>
        </div>
        {request.bookingType !== "one-time" && (
          <div className="summary-row">
            <span className="summary-label">Length of Care</span>
            <span className="summary-value">{request.lengthOfCareWeeks} week{request.lengthOfCareWeeks !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Caregiver</h2>
        {request.slotAssignments && request.slotAssignments.length > 1 ? (
          <>
            <div className="summary-row">
              <span className="summary-label">Booking Type</span>
              <span className="summary-value">Split — {request.slotAssignments.length} caregivers</span>
            </div>
            {request.slotAssignments.map((a, i) => (
              <div key={i} className="summary-row">
                <span className="summary-label">{a.pswName}</span>
                <span className="summary-value">{a.slots?.length || 0} date{(a.slots?.length || 0) !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="summary-row">
            <span className="summary-label">Selected PSW</span>
            <span className="summary-value">{psw.name || "—"}</span>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Contact</h2>
        {contact.email && (
          <div className="summary-row">
            <span className="summary-label">Email</span>
            <span className="summary-value">{contact.email}</span>
          </div>
        )}
        {contact.phone && (
          <div className="summary-row">
            <span className="summary-label">Phone</span>
            <span className="summary-value">{contact.phone}</span>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="flex-row mt-20">
        <button className="btn btn-secondary" onClick={() => navigate(`/book/${id}/contact`)}>
          ← Back
        </button>
        <button className="btn btn-primary" disabled={submitting} onClick={handleConfirmAndFinalize}>
          {submitting ? "Finalizing…" : "Confirm Booking ✓"}
        </button>
      </div>
    </div>
  );
}