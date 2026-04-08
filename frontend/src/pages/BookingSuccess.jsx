// frontend/src/pages/BookingSuccess.jsx
import { useLocation, useNavigate } from "react-router-dom";

export default function BookingSuccess() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const bookingId = state?.bookingId || state?.summary?.bookingId;
  const pswName = state?.summary?.pswName;
  const totalSlots = state?.summary?.totalSlots;
  const startDate = state?.summary?.startDate;

  return (
    <div className="page success-page">
      <div className="success-icon">✓</div>
      <h1>You're All Set!</h1>
      <p style={{ fontSize: 17, marginBottom: 24 }}>
        Your caregiver booking has been confirmed.
        {pswName && <> <strong>{pswName}</strong> will be there for you.</>}
      </p>

      <div className="card" style={{ textAlign: "left", maxWidth: 420, margin: "0 auto 24px" }}>
        {pswName && (
          <div className="summary-row">
            <span className="summary-label">Your Caregiver</span>
            <span className="summary-value">{pswName}</span>
          </div>
        )}
        {totalSlots && (
          <div className="summary-row">
            <span className="summary-label">Visits Scheduled</span>
            <span className="summary-value">{totalSlots} session{totalSlots !== 1 ? "s" : ""}</span>
          </div>
        )}
        {startDate && (
          <div className="summary-row">
            <span className="summary-label">First Visit</span>
            <span className="summary-value">
              {new Date(startDate).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
        )}
        {bookingId && (
          <div className="summary-row">
            <span className="summary-label">Confirmation #</span>
            <span className="summary-value" style={{ fontSize: 13, fontFamily: "monospace" }}>{bookingId}</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 24 }}>
        You can view and manage your bookings anytime from your dashboard.
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => navigate("/my-bookings")}>
          View My Bookings
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/find-psw")}>
          Book Another Caregiver
        </button>
      </div>
    </div>
  );
}