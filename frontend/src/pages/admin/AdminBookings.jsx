import { useState, useEffect } from "react";
import { getAdminBookings, deleteAdminBooking, updateAdminBooking } from "../../api/api";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    getAdminBookings(filter || undefined)
      .then(setBookings)
      .catch((e) => setError(e.message));
  }, [filter]);

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
      setBookings((prev) => prev.map((b) => (b._id === id ? updated : b)));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Bookings</h1>
      </div>

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

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Client</th>
              <th>PSW</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b._id}>
                <td><code>{b._id.slice(-6)}</code></td>
                <td>{b.clientName || b.clientId || "—"}</td>
                <td>{b.pswName || b.pswId || "—"}</td>
                <td>{b.date ? new Date(b.date).toLocaleDateString() : "—"}</td>
                <td>
                  <select
                    className="form-input"
                    value={b.status || ""}
                    onChange={(e) => handleStatusChange(b._id, e.target.value)}
                    style={{ width: "auto", padding: "4px 8px", fontSize: 13 }}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="admin-table-actions">
                  <button onClick={() => handleDelete(b._id)} className="btn btn-outline-danger">Delete</button>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={6} className="center-text">No bookings found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
