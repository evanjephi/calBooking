import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPSWBookings, respondToBooking, getPSWApplication } from "../api/api";

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

export default function PSWDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [responding, setResponding] = useState(null);
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    Promise.all([
      getPSWBookings().catch(() => []),
      getPSWApplication().catch(() => ({ hasApplication: false }))
    ]).then(([bks, app]) => {
      setBookings(bks);
      if (app.hasApplication) setApplication(app.application);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleRespond(id, status) {
    const action = status === "confirmed" ? "accept" : "reject";
    if (!window.confirm(`Are you sure you want to ${action} this booking?`)) return;
    setResponding(id);
    try {
      const updated = await respondToBooking(id, status);
      setBookings(prev => prev.map(b => b._id === id ? updated : b));
    } catch (err) {
      setError(err.message);
    } finally {
      setResponding(null);
    }
  }

  if (loading) return <div className="page"><p className="center-text">Loading dashboard…</p></div>;

  const now = new Date();
  const pending = bookings.filter(b => b.status === "pending");
  const upcoming = bookings.filter(b => b.status === "confirmed" && new Date(b.startTime) >= now);
  const past = bookings.filter(b => b.status === "confirmed" && new Date(b.endTime) < now);
  const cancelled = bookings.filter(b => b.status === "cancelled");

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayCount = upcoming.filter(b => {
    const s = new Date(b.startTime);
    return s >= todayStart && s <= todayEnd;
  }).length;

  const statusLabel = application?.applicationStatus || "";
  const statusCls = { pending: "badge-warning", approved: "badge-success", rejected: "badge-danger" }[statusLabel] || "badge-muted";

  return (
    <div className="page psw-dashboard">
      {/* Header */}
      <div className="psw-dash-header">
        <div>
          <h1>Welcome, {user?.firstName || "Provider"}</h1>
          <p className="psw-dash-subtitle">Your PSW Dashboard</p>
        </div>
        {application && (
          <div className="psw-dash-status">
            <span className={`app-badge ${statusCls}`}>
              {statusLabel === "approved" ? "Active" : statusLabel === "pending" ? "Under Review" : "Not Approved"}
            </span>
            <Link to="/psw/apply" className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }}>View Profile</Link>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Stats Cards */}
      <div className="psw-stats-grid">
        <div className="psw-stat-card">
          <div className="psw-stat-number">{bookings.length}</div>
          <div className="psw-stat-label">Total Bookings</div>
        </div>
        <div className="psw-stat-card">
          <div className="psw-stat-number">{todayCount}</div>
          <div className="psw-stat-label">Today</div>
        </div>
        <div className="psw-stat-card psw-stat-highlight">
          <div className="psw-stat-number">{pending.length}</div>
          <div className="psw-stat-label">Pending Requests</div>
        </div>
        <div className="psw-stat-card">
          <div className="psw-stat-number">{upcoming.length}</div>
          <div className="psw-stat-label">Upcoming</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="psw-tabs">
        {[
          { key: "pending", label: "Incoming Requests", count: pending.length },
          { key: "upcoming", label: "Upcoming", count: upcoming.length },
          { key: "past", label: "Past", count: past.length },
          { key: "cancelled", label: "Cancelled", count: cancelled.length },
        ].map(t => (
          <button
            key={t.key}
            className={`psw-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count > 0 && <span className="psw-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="psw-tab-content">
        {tab === "pending" && (
          pending.length === 0 ? (
            <div className="psw-empty">
              <p>No pending booking requests.</p>
            </div>
          ) : (
            pending.map(b => (
              <BookingCard
                key={b._id}
                booking={b}
                showActions
                onRespond={handleRespond}
                responding={responding}
              />
            ))
          )
        )}

        {tab === "upcoming" && (
          upcoming.length === 0 ? (
            <div className="psw-empty"><p>No upcoming bookings.</p></div>
          ) : (
            upcoming.sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).map(b => (
              <BookingCard key={b._id} booking={b} />
            ))
          )
        )}

        {tab === "past" && (
          past.length === 0 ? (
            <div className="psw-empty"><p>No past bookings.</p></div>
          ) : (
            past.map(b => <BookingCard key={b._id} booking={b} />)
          )
        )}

        {tab === "cancelled" && (
          cancelled.length === 0 ? (
            <div className="psw-empty"><p>No cancelled bookings.</p></div>
          ) : (
            cancelled.map(b => <BookingCard key={b._id} booking={b} />)
          )
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking, showActions, onRespond, responding }) {
  const b = booking;
  const client = b.userId || {};
  const start = new Date(b.startTime);
  const end = new Date(b.endTime);
  const levelLabel = SERVICE_LEVEL_LABELS[b.serviceLevel] || b.serviceLevel || "";

  // For recurring bookings, compute per-visit duration from visitDuration or totalHours/totalSlots
  const perVisitHours = b.visitDuration
    ? ({ "1 hour": 1, "2-3 hours": 2, "4-6 hours": 5, "more than 6 hours": 8 }[b.visitDuration] || null)
    : (b.totalSlots && b.totalHours ? Math.round(b.totalHours / b.totalSlots * 10) / 10 : null);

  // Per-visit end time (start + per-visit hours)
  const visitEnd = perVisitHours
    ? new Date(start.getTime() + perVisitHours * 3600000)
    : end;

  const statusColors = {
    confirmed: { bg: "var(--green-bg, #d4edda)", color: "var(--green, #155724)" },
    pending: { bg: "var(--yellow-bg, #fef3cd)", color: "var(--yellow, #856404)" },
    cancelled: { bg: "var(--red-bg, #f8d7da)", color: "var(--red, #721c24)" },
  };
  const sc = statusColors[b.status] || statusColors.pending;

  const clientName = client.firstName
    ? `${client.firstName} ${client.lastName}`
    : b.client || "Unknown Client";
  const clientInitials = client.firstName
    ? `${client.firstName[0]}${client.lastName?.[0] || ""}`.toUpperCase()
    : "?";

  return (
    <div className="psw-booking-card">
      <div className="psw-booking-top">
        <div className="psw-booking-client">
          <div className="psw-booking-avatar">{clientInitials}</div>
          <div>
            <div className="psw-booking-name">{clientName}</div>
            {client.email && <div className="psw-booking-meta">{client.email}</div>}
            {client.phone && <div className="psw-booking-meta">{client.phone}</div>}
          </div>
        </div>
        <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 12 }}>
          {b.status}
        </span>
      </div>

      <div className="psw-booking-details">
        <div className="psw-booking-detail">
          <span className="psw-booking-detail-label">Start Date</span>
          <span>{formatDate(start)}</span>
        </div>
        {b.recurring && (
          <div className="psw-booking-detail">
            <span className="psw-booking-detail-label">End Date</span>
            <span>{formatDate(end)}</span>
          </div>
        )}
        <div className="psw-booking-detail">
          <span className="psw-booking-detail-label">Time</span>
          <span>{formatTime(start)} – {formatTime(visitEnd)}</span>
        </div>
        {levelLabel && (
          <div className="psw-booking-detail">
            <span className="psw-booking-detail-label">Service</span>
            <span>{levelLabel}</span>
          </div>
        )}
        {b.recurring && (
          <div className="psw-booking-detail">
            <span className="psw-booking-detail-label">Type</span>
            <span>🔄 Recurring ({b.recurringInterval})</span>
          </div>
        )}
        {b.recurring && (b.preferredDays?.length > 0 || b.daysPerWeek) && (
          <div className="psw-booking-detail">
            <span className="psw-booking-detail-label">Days / Week</span>
            <span>
              {b.preferredDays?.length > 0
                ? <>{b.preferredDays.length} day{b.preferredDays.length !== 1 ? "s" : ""} — {b.preferredDays.map(d => d.substring(0, 3)).join(", ")}</>
                : <>{b.daysPerWeek} day{b.daysPerWeek !== 1 ? "s" : ""}</>
              }
            </span>
          </div>
        )}
        {b.recurring && b.lengthOfCareWeeks && (
          <div className="psw-booking-detail">
            <span className="psw-booking-detail-label">Duration</span>
            <span>{b.lengthOfCareWeeks} week{b.lengthOfCareWeeks !== 1 ? "s" : ""}</span>
          </div>
        )}
        {b.totalSlots && (
          <div className="psw-booking-detail">
            <span className="psw-booking-detail-label">Total Visits</span>
            <span>{b.totalSlots} visit{b.totalSlots !== 1 ? "s" : ""}</span>
          </div>
        )}
        {b.totalHours != null && (
          <div className="psw-booking-detail">
            <span className="psw-booking-detail-label">Total Hours</span>
            <span>{b.totalHours} hr{b.totalHours !== 1 ? "s" : ""}</span>
          </div>
        )}
        {b.visitDuration && (
          <div className="psw-booking-detail">
            <span className="psw-booking-detail-label">Per Visit</span>
            <span>{b.visitDuration}</span>
          </div>
        )}
        {(b.serviceAddress?.street || b.serviceAddress?.city) && (
          <div className="psw-booking-detail" style={{ gridColumn: "1 / -1" }}>
            <span className="psw-booking-detail-label">Address</span>
            <span>
              {[b.serviceAddress.street, b.serviceAddress.unit, b.serviceAddress.city, b.serviceAddress.postalCode]
                .filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>

      {showActions && b.status === "pending" && (
        <div className="psw-booking-actions">
          <button
            className="btn btn-primary"
            disabled={responding === b._id}
            onClick={() => onRespond(b._id, "confirmed")}
          >
            {responding === b._id ? "…" : "Accept Booking"}
          </button>
          <button
            className="btn btn-outline-danger"
            disabled={responding === b._id}
            onClick={() => onRespond(b._id, "cancelled")}
          >
            {responding === b._id ? "…" : "Reject"}
          </button>
        </div>
      )}
    </div>
  );
}
