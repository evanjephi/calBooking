import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getTransactions } from "../api/api";

const SERVICE_LABELS = {
  home_helper: "Home Helper",
  care_services: "Care Services",
  specialized_care: "Specialized Care"
};

export default function AccountTransactions() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const isPSW = user?.role === "psw";
  const pageTitle = isPSW ? "My Earnings" : "Billing & Transactions";

  useEffect(() => {
    (async () => {
      try {
        const result = await getTransactions();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="center-text">Loading…</p>;
  if (error) return <div className="account-page"><div className="msg-error">{error}</div></div>;

  const filtered = statusFilter === "all"
    ? data.transactions
    : data.transactions.filter(t => t.status === statusFilter);

  return (
    <div className="account-page">
      <h1>{pageTitle}</h1>

      <div className="txn-summary-cards">
        <div className="txn-card">
          <span className="txn-card-label">Total Bookings</span>
          <span className="txn-card-value">{data.summary.totalBookings}</span>
        </div>
        <div className="txn-card">
          <span className="txn-card-label">Total Hours</span>
          <span className="txn-card-value">{data.summary.totalHours}</span>
        </div>
        <div className="txn-card">
          <span className="txn-card-label">{isPSW ? "Total Earned" : "Total Billed"}</span>
          <span className="txn-card-value">${data.summary.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div className="txn-filter">
        <label>Filter by status:</label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">No transactions found.</p>
      ) : (
        <div className="txn-table-wrap">
          <table className="txn-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>{isPSW ? "Client" : "Caregiver"}</th>
                <th>Service Level</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t._id} className={`txn-status-${t.status}`}>
                  <td>{new Date(t.date).toLocaleDateString()}</td>
                  <td>{isPSW ? (t.clientName || "—") : (t.pswName || "—")}</td>
                  <td>{SERVICE_LABELS[t.serviceLevel] || t.serviceLevel || "—"}</td>
                  <td>{t.totalHours != null ? t.totalHours : "—"}</td>
                  <td>{t.hourlyRate != null ? `$${t.hourlyRate.toFixed(2)}/hr` : "—"}</td>
                  <td>{t.totalAmount != null ? `$${t.totalAmount.toFixed(2)}` : "—"}</td>
                  <td><span className={`status-badge status-${t.status}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
