// frontend/src/pages/MyBookings.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getBookings, cancelBooking } from "../api/api";

const SERVICE_LEVEL_LABELS = {
  home_helper: "Home Helper",
  care_services: "Care Services",
  specialized_care: "Specialized Care",
};

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(d) {
  return new Date(d).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    getBookings()
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Re-fetch when tab/page becomes visible (e.g. after chat creates a booking)
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        getBookings().then(setBookings).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // Listen for custom event from chat assistant
    function handleBookingCreated() {
      getBookings().then(setBookings).catch(() => {});
    }
    window.addEventListener("booking-created", handleBookingCreated);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("booking-created", handleBookingCreated);
    };
  }, []);

  async function handleCancel(id) {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(id);
    try {
      await cancelBooking(id);
      setBookings((prev) =>
        prev.map((b) => (b._id === id ? { ...b, status: "cancelled" } : b))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(null);
    }
  }

  if (loading)
    return (
      <div className="page">
        <p className="center-text">Loading bookings…</p>
      </div>
    );

  // Group bookings by PSW
  const pswGroups = {};
  for (const b of bookings) {
    const pswId = b.pswWorker?._id || b.pswWorker || "unknown";
    if (!pswGroups[pswId]) {
      const psw = b.pswWorker || {};
      pswGroups[pswId] = {
        psw,
        pswName: psw.firstName ? `${psw.firstName} ${psw.lastName}` : "TBD",
        pswInitials: psw.firstName ? `${psw.firstName[0]}${psw.lastName?.[0] || ""}` : "?",
        photoUrl: psw.profilePhoto || (psw.firstName
          ? `https://ui-avatars.com/api/?name=${encodeURIComponent(psw.firstName + "+" + psw.lastName)}&size=80&background=5f8d7e&color=fff`
          : null),
        bookings: [],
      };
    }
    pswGroups[pswId].bookings.push(b);
  }

  // Sort bookings within each group by startTime
  for (const g of Object.values(pswGroups)) {
    g.bookings.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  const groupEntries = Object.entries(pswGroups);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>My Bookings</h1>
        <Link to="/" className="btn btn-primary" style={{ width: "auto", padding: "8px 16px", fontSize: 14 }}>
          + New Booking
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {bookings.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 18, color: "var(--text-h)", marginBottom: 8 }}>No bookings yet</p>
          <p>Start by booking a caregiver — we'll match you with qualified PSWs in your area.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16, width: "auto", display: "inline-flex" }}>
            Book a Caregiver
          </Link>
        </div>
      ) : (
        groupEntries.map(([pswId, group]) => {
          const recurring = group.bookings.filter((b) => b.recurring);
          const oneTime = group.bookings.filter((b) => !b.recurring);

          return (
            <div key={pswId} className="card" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
              {/* PSW Header */}
              <div style={{
                display: "flex", gap: 12, alignItems: "center", padding: "16px 20px",
                background: "rgba(95, 141, 126, 0.06)", borderBottom: "1px solid var(--border)",
              }}>
                {group.photoUrl ? (
                  <img src={group.photoUrl} alt={group.pswName}
                    style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div className="psw-avatar">{group.pswInitials}</div>
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-h)" }}>{group.pswName}</div>
                  <div style={{ fontSize: 14, color: "var(--text)" }}>
                    {group.bookings.length} booking{group.bookings.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div style={{ padding: "12px 20px 16px" }}>
                {/* Recurring bookings section */}
                {recurring.length > 0 && (
                  <div style={{ marginBottom: oneTime.length > 0 ? 16 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span className="booking-type-badge recurring">🔄 Recurring</span>
                      <span style={{ fontSize: 14, color: "var(--text)" }}>
                        {formatDate(recurring[0].startTime)} → {formatDate(recurring[recurring.length - 1].endTime)}
                      </span>
                    </div>
                    {recurring.map((b) => (
                      <BookingRow key={b._id} booking={b} onCancel={handleCancel} cancelling={cancelling} />
                    ))}
                  </div>
                )}

                {/* One-time bookings section */}
                {oneTime.length > 0 && (
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <span className="booking-type-badge onetime">📅 One-Time</span>
                    </div>
                    {oneTime.map((b) => (
                      <BookingRow key={b._id} booking={b} onCancel={handleCancel} cancelling={cancelling} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function BookingRow({ booking, onCancel, cancelling }) {
  const b = booking;
  const start = new Date(b.startTime);
  const end = new Date(b.endTime);
  const isPast = b.status === "cancelled" || end < new Date();

  // For recurring bookings, compute per-visit end time
  const perVisitHours = b.visitDuration
    ? ({ "1 hour": 1, "2-3 hours": 2, "4-6 hours": 5, "more than 6 hours": 8 }[b.visitDuration] || null)
    : (b.totalSlots && b.totalHours ? Math.round(b.totalHours / b.totalSlots * 10) / 10 : null);
  const visitEnd = perVisitHours
    ? new Date(start.getTime() + perVisitHours * 3600000)
    : end;

  const statusColors = {
    confirmed: { bg: "var(--green-bg)", color: "var(--green)" },
    pending: { bg: "var(--yellow-bg)", color: "var(--yellow)" },
    cancelled: { bg: "var(--red-bg)", color: "var(--red)" },
  };
  const sc = statusColors[b.status] || statusColors.pending;
  const levelLabel = SERVICE_LEVEL_LABELS[b.serviceLevel] || b.serviceLevel || "";

  return (
    <div className="booking-row" style={{ opacity: isPast ? 0.6 : 1 }}>
      <div className="booking-row-main">
        <div className="booking-row-left">
          <span style={{ fontWeight: 600, color: "var(--text-h)", fontSize: 14 }}>
            {formatDate(start)}{b.recurring && <> → {formatDate(end)}</>}
          </span>
          <span style={{ color: "var(--text)", fontSize: 14 }}>
            {formatTime(start)} – {formatTime(visitEnd)}
          </span>
          {levelLabel && (
            <span style={{ fontSize: 14, color: "var(--teal)" }}>{levelLabel}</span>
          )}
          {b.recurring && (
            <span style={{ fontSize: 14, color: "var(--text)" }}>
              {b.preferredDays?.length > 0
                ? `${b.preferredDays.length} day${b.preferredDays.length !== 1 ? "s" : ""}/wk — ${b.preferredDays.map(d => d.substring(0, 3)).join(", ")}`
                : b.daysPerWeek ? `${b.daysPerWeek} day${b.daysPerWeek !== 1 ? "s" : ""}/wk` : null}
              {b.totalSlots ? ` · ${b.totalSlots} visits` : ""}
              {b.totalHours != null ? ` · ${b.totalHours} hrs` : ""}
            </span>
          )}
        </div>
        <div className="booking-row-right">
          <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 11 }}>
            {b.status}
          </span>
          {!isPast && b.status !== "cancelled" && (
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: 14, width: "auto", color: "var(--red)" }}
              disabled={cancelling === b._id}
              onClick={() => onCancel(b._id)}
            >
              {cancelling === b._id ? "…" : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
