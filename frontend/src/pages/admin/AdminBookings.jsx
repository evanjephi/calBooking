import { useState, useEffect, useMemo } from "react";
import {
  getAdminBookings, deleteAdminBooking, updateAdminBooking,
  getAdminBookingRequests, deleteAdminBookingRequest,
  getServiceLevels
} from "../../api/api";

// Populated dynamically from API
let SERVICE_LEVEL_LABELS = {};

function formatAddress(addr) {
  if (!addr) return "—";
  const parts = [addr.street, addr.unit, addr.city, addr.postalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

// ── Main Component with Parent Tabs ──
export default function AdminBookings() {
  const [parentTab, setParentTab] = useState("bookings");

  useEffect(() => {
    getServiceLevels().then(levels => {
      const labels = {};
      for (const l of levels) labels[l.key] = l.label;
      SERVICE_LEVEL_LABELS = labels;
    }).catch(() => {});
  }, []);

  return (
    <div>
      <div className="admin-header">
        <h1>Bookings</h1>
      </div>

      <div className="admin-parent-tabs">
        <button
          className={`admin-parent-tab${parentTab === "bookings" ? " active" : ""}`}
          onClick={() => setParentTab("bookings")}
        >
          Client Bookings
        </button>
        <button
          className={`admin-parent-tab${parentTab === "psw" ? " active" : ""}`}
          onClick={() => setParentTab("psw")}
        >
          PSW Received
        </button>
        <button
          className={`admin-parent-tab${parentTab === "requests" ? " active" : ""}`}
          onClick={() => setParentTab("requests")}
        >
          Booking Requests
        </button>
      </div>

      {parentTab === "bookings" && <ClientBookingsTab />}
      {parentTab === "psw" && <PSWBookingsTab />}
      {parentTab === "requests" && <BookingRequestsTab />}
    </div>
  );
}

// ── Tab 1: Client Bookings ──
function ClientBookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getAdminBookings(filter || undefined)
      .then(setBookings)
      .catch((e) => setError(e.message));
  }, [filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.toLowerCase();
    return bookings.filter(b =>
      (b.clientName || "").toLowerCase().includes(q) ||
      (b.pswName || "").toLowerCase().includes(q) ||
      (b._id || "").toLowerCase().includes(q) ||
      (b.serviceLevel || "").toLowerCase().includes(q)
    );
  }, [bookings, search]);

  async function handleDelete(id) {
    if (!confirm("Delete this booking?")) return;
    try {
      await deleteAdminBooking(id);
      setBookings((prev) => prev.filter((b) => b._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleStatusChange(id, status) {
    try {
      const updated = await updateAdminBooking(id, { status });
      setBookings((prev) => prev.map((b) => (b._id === id ? { ...b, ...updated } : b)));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-filters">
          {["", "confirmed", "pending", "cancelled"].map((s) => (
            <button
              key={s}
              className={`btn ${filter === s ? "btn-teal" : "btn-secondary"}`}
              onClick={() => setFilter(s)}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        <input
          className="admin-search-input"
          type="text"
          placeholder="Search by client, PSW, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Client</th>
              <th>PSW</th>
              <th>Service</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <BookingRow
                key={b._id}
                booking={b}
                expanded={expanded === b._id}
                onToggle={() => setExpanded(expanded === b._id ? null : b._id)}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="center-text">No bookings found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BookingRow({ booking: b, expanded, onToggle, onStatusChange, onDelete }) {
  const date = b.startTime
    ? new Date(b.startTime).toLocaleDateString()
    : b.bookingDate
      ? new Date(b.bookingDate).toLocaleDateString()
      : "—";

  return (
    <>
      <tr className={expanded ? "row-expanded" : ""}>
        <td><code>{b._id.slice(-6)}</code></td>
        <td><strong>{b.clientName || "—"}</strong></td>
        <td>{b.pswName || "—"}</td>
        <td>{SERVICE_LEVEL_LABELS[b.serviceLevel] || b.serviceType || "—"}</td>
        <td>{date}</td>
        <td>
          <select
            className="form-input"
            value={b.status || ""}
            onChange={(e) => onStatusChange(b._id, e.target.value)}
            style={{ width: "auto", padding: "4px 8px", fontSize: 13 }}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </td>
        <td className="admin-table-actions">
          <button onClick={onToggle} className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>
            {expanded ? "Hide" : "Details"}
          </button>
          <button onClick={() => onDelete(b._id)} className="btn btn-outline-danger" style={{ fontSize: 12, padding: "4px 10px" }}>Delete</button>
        </td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={7}>
            <div className="booking-detail-panel">
              <div className="booking-detail-grid">
                <div><strong>Booking ID:</strong> {b._id}</div>
                <div><strong>Client Email:</strong> {b.clientEmail || "—"}</div>
                <div><strong>Service Type:</strong> {b.serviceType || "—"}</div>
                <div><strong>Service Level:</strong> {SERVICE_LEVEL_LABELS[b.serviceLevel] || "—"}</div>
                <div><strong>Start:</strong> {b.startTime ? new Date(b.startTime).toLocaleString() : "—"}</div>
                <div><strong>End:</strong> {b.endTime ? new Date(b.endTime).toLocaleString() : "—"}</div>
                <div><strong>Duration:</strong> {b.visitDuration || (b.totalHours ? `${b.totalHours}h` : "—")}</div>
                <div><strong>Recurring:</strong> {b.recurring ? `Yes (${b.recurringInterval || "weekly"})` : "No"}</div>
                {b.recurring && <div><strong>Days/Week:</strong> {b.daysPerWeek || "—"}</div>}
                {b.recurring && <div><strong>Preferred Days:</strong> {(b.preferredDays || []).join(", ") || "—"}</div>}
                {b.recurring && <div><strong>Care Length:</strong> {b.lengthOfCareWeeks ? `${b.lengthOfCareWeeks} weeks` : "—"}</div>}
                {b.recurring && <div><strong>Total Slots:</strong> {b.totalSlots || "—"}</div>}
                <div><strong>Address:</strong> {formatAddress(b.serviceAddress)}</div>
                <div><strong>Hourly Rate:</strong> {b.hourlyRate ? `$${b.hourlyRate.toFixed(2)}` : "—"}</div>
                <div><strong>Total Hours:</strong> {b.totalHours || "—"}</div>
                <div><strong>Total Amount:</strong> {b.totalAmount ? `$${b.totalAmount.toFixed(2)}` : "—"}</div>
                <div><strong>Created:</strong> {new Date(b.createdAt).toLocaleString()}</div>
                {b.cancelledAt && <div><strong>Cancelled:</strong> {new Date(b.cancelledAt).toLocaleString()}</div>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Tab 2: PSW Received Bookings (grouped by PSW) ──
function PSWBookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedPSW, setExpandedPSW] = useState(null);

  useEffect(() => {
    getAdminBookings()
      .then(setBookings)
      .catch((e) => setError(e.message));
  }, []);

  const grouped = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      const pswId = b.pswWorker?._id || "unassigned";
      if (!map[pswId]) {
        map[pswId] = {
          pswId,
          pswName: b.pswName || "Unassigned",
          bookings: [],
          confirmed: 0,
          pending: 0,
          cancelled: 0,
          totalRevenue: 0
        };
      }
      map[pswId].bookings.push(b);
      if (b.status === "confirmed") map[pswId].confirmed++;
      else if (b.status === "pending") map[pswId].pending++;
      else if (b.status === "cancelled") map[pswId].cancelled++;
      if (b.totalAmount) map[pswId].totalRevenue += b.totalAmount;
    });
    return Object.values(map).sort((a, c) => c.bookings.length - a.bookings.length);
  }, [bookings]);

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.filter(g =>
      g.pswName.toLowerCase().includes(q) ||
      g.bookings.some(b => (b.clientName || "").toLowerCase().includes(q))
    );
  }, [grouped, search]);

  if (error) return <div className="error-banner">{error}</div>;

  return (
    <>
      <div className="admin-toolbar">
        <div style={{ fontSize: 14, color: "var(--muted)" }}>
          {grouped.length} PSW workers with bookings
        </div>
        <input
          className="admin-search-input"
          type="text"
          placeholder="Search by PSW or client name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>PSW Worker</th>
              <th>Total</th>
              <th>Confirmed</th>
              <th>Pending</th>
              <th>Cancelled</th>
              <th>Revenue</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <PSWGroupRow
                key={g.pswId}
                group={g}
                expanded={expandedPSW === g.pswId}
                onToggle={() => setExpandedPSW(expandedPSW === g.pswId ? null : g.pswId)}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="center-text">No PSW bookings found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PSWGroupRow({ group: g, expanded, onToggle }) {
  return (
    <>
      <tr className={expanded ? "row-expanded" : ""} style={{ cursor: "pointer" }} onClick={onToggle}>
        <td><strong>{g.pswName}</strong></td>
        <td>{g.bookings.length}</td>
        <td><span className="badge badge-green">{g.confirmed}</span></td>
        <td><span className="badge badge-yellow">{g.pending}</span></td>
        <td><span className="badge badge-red">{g.cancelled}</span></td>
        <td>{g.totalRevenue > 0 ? `$${g.totalRevenue.toFixed(2)}` : "—"}</td>
        <td>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>
            {expanded ? "▲" : "▼"}
          </button>
        </td>
      </tr>
      {expanded && g.bookings.map(b => (
        <tr key={b._id} className="detail-row psw-sub-row">
          <td style={{ paddingLeft: 32 }}>{b.clientName || "—"}</td>
          <td>{SERVICE_LEVEL_LABELS[b.serviceLevel] || b.serviceType || "—"}</td>
          <td>{b.startTime ? new Date(b.startTime).toLocaleDateString() : b.bookingDate ? new Date(b.bookingDate).toLocaleDateString() : "—"}</td>
          <td>{b.visitDuration || (b.totalHours ? `${b.totalHours}h` : "—")}</td>
          <td>
            <span className={`badge ${b.status === "confirmed" ? "badge-green" : b.status === "cancelled" ? "badge-red" : "badge-yellow"}`}>
              {b.status}
            </span>
          </td>
          <td>{b.totalAmount ? `$${b.totalAmount.toFixed(2)}` : "—"}</td>
          <td></td>
        </tr>
      ))}
    </>
  );
}

// ── Tab 3: Booking Requests Pipeline ──
function BookingRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getAdminBookingRequests(filter || undefined)
      .then(setRequests)
      .catch((e) => setError(e.message));
  }, [filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter(r =>
      (r.clientName || "").toLowerCase().includes(q) ||
      (r.selectedPSWName || "").toLowerCase().includes(q) ||
      (r._id || "").toLowerCase().includes(q) ||
      (r.serviceAddress?.city || "").toLowerCase().includes(q)
    );
  }, [requests, search]);

  async function handleDelete(id) {
    if (!confirm("Delete this booking request?")) return;
    try {
      await deleteAdminBookingRequest(id);
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-filters">
          {["", "pending", "confirmed", "booked", "cancelled"].map((s) => (
            <button
              key={s}
              className={`btn ${filter === s ? "btn-teal" : "btn-secondary"}`}
              onClick={() => setFilter(s)}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        <input
          className="admin-search-input"
          type="text"
          placeholder="Search by client, PSW, or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Client</th>
              <th>Type</th>
              <th>Location</th>
              <th>Matched</th>
              <th>Selected PSW</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <RequestRow
                key={r._id}
                request={r}
                expanded={expanded === r._id}
                onToggle={() => setExpanded(expanded === r._id ? null : r._id)}
                onDelete={handleDelete}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="center-text">No booking requests found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RequestRow({ request: r, expanded, onToggle, onDelete }) {
  const statusCls = {
    pending: "badge-yellow",
    confirmed: "badge-green",
    booked: "badge-teal",
    cancelled: "badge-red"
  };

  return (
    <>
      <tr className={expanded ? "row-expanded" : ""}>
        <td><code>{r._id.slice(-6)}</code></td>
        <td><strong>{r.clientName || "—"}</strong></td>
        <td>{r.bookingType || "—"}</td>
        <td>{r.serviceAddress?.city || r.location?.city || "—"}</td>
        <td>{r.matchedCount || 0} PSWs</td>
        <td>{r.selectedPSWName || "—"}</td>
        <td>
          <span className={`badge ${statusCls[r.status] || "badge-yellow"}`}>
            {r.status}
          </span>
        </td>
        <td className="admin-table-actions">
          <button onClick={onToggle} className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>
            {expanded ? "Hide" : "Details"}
          </button>
          <button onClick={() => onDelete(r._id)} className="btn btn-outline-danger" style={{ fontSize: 12, padding: "4px 10px" }}>Delete</button>
        </td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={8}>
            <div className="booking-detail-panel">
              <div className="booking-detail-grid">
                <div><strong>Request ID:</strong> {r._id}</div>
                <div><strong>Client Email:</strong> {r.clientEmail || "—"}</div>
                <div><strong>Booking Type:</strong> {r.bookingType || "—"}</div>
                <div><strong>Service Level:</strong> {SERVICE_LEVEL_LABELS[r.serviceLevel] || "—"}</div>
                <div><strong>Days/Week:</strong> {r.daysPerWeek || "—"}</div>
                <div><strong>Time of Day:</strong> {r.timeOfDay || "—"}</div>
                <div><strong>Visit Duration:</strong> {r.visitDuration || "—"}</div>
                <div><strong>Care Length:</strong> {r.lengthOfCareWeeks ? `${r.lengthOfCareWeeks} weeks` : "—"}</div>
                <div><strong>Preferred Days:</strong> {(r.preferredDays || []).join(", ") || "—"}</div>
                {r.preferredStartHour != null && <div><strong>Preferred Hour:</strong> {r.preferredStartHour}:00</div>}
                {r.specificDate && <div><strong>Specific Date:</strong> {new Date(r.specificDate).toLocaleDateString()}</div>}
                <div><strong>Address:</strong> {formatAddress(r.serviceAddress) || formatAddress(r.location) || "—"}</div>
                <div><strong>Contact Email:</strong> {r.contact?.email || "—"}</div>
                <div><strong>Contact Phone:</strong> {r.contact?.phone || "—"}</div>
                <div><strong>Source:</strong> {r.source || "api"}</div>
                <div><strong>Matched PSWs:</strong> {r.matchedCount || 0}</div>
                <div><strong>Created:</strong> {new Date(r.createdAt).toLocaleString()}</div>
                {r.bookingId && <div><strong>Linked Booking:</strong> <code>{String(r.bookingId).slice(-6)}</code></div>}
              </div>
              {r.slotAssignments?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Slot Assignments:</strong>
                  <div className="slot-assignments-list">
                    {r.slotAssignments.map((sa, i) => (
                      <div key={i} className="slot-assignment-item">
                        <span className="badge badge-teal">{sa.pswName || "PSW"}</span>
                        <span> — {sa.slots?.length || 0} slots</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
