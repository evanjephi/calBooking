import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAdminStats } from "../../api/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!stats) return <p className="center-text">Loading…</p>;

  const cards = [
    { label: "Posts", count: stats.posts, to: "/admin/posts", icon: "📝" },
    { label: "Pages", count: stats.pages, to: "/admin/pages", icon: "📄" },
    { label: "Clients", count: stats.clients, to: "/admin/clients", icon: "👥" },
    { label: "PSW Workers", count: stats.psws, to: "/admin/psws", icon: "🏥" },
    { label: "Bookings", count: stats.bookings, to: "/admin/bookings", icon: "📅" },
    { label: "Users", count: stats.users, to: "/admin/users", icon: "👤" },
  ];

  return (
    <div>
      <h1>Dashboard</h1>
      <p style={{ marginBottom: 24 }}>Welcome to the PremierPSW admin panel.</p>

      <div className="admin-stats-grid">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="admin-stat-card">
            <span className="admin-stat-icon">{c.icon}</span>
            <span className="admin-stat-count">{c.count}</span>
            <span className="admin-stat-label">{c.label}</span>
          </Link>
        ))}
      </div>

      {/* Booking Overview */}
      <div className="dashboard-section">
        <h2>Booking Overview</h2>
        <div className="dashboard-metrics">
          <div className="metric-card">
            <span className="metric-value">{stats.pendingBookings}</span>
            <span className="metric-label">Pending</span>
          </div>
          <div className="metric-card metric-green">
            <span className="metric-value">{stats.confirmedBookings}</span>
            <span className="metric-label">Confirmed</span>
          </div>
          <div className="metric-card metric-red">
            <span className="metric-value">{stats.cancelledBookings}</span>
            <span className="metric-label">Cancelled</span>
          </div>
          <div className="metric-card metric-teal">
            <span className="metric-value">{stats.bookingsThisWeek}</span>
            <span className="metric-label">This Week</span>
          </div>
          <div className="metric-card metric-teal">
            <span className="metric-value">{stats.bookingsThisMonth}</span>
            <span className="metric-label">This Month</span>
          </div>
          <div className="metric-card metric-green">
            <span className="metric-value">${(stats.totalRevenue || 0).toFixed(2)}</span>
            <span className="metric-label">Total Revenue</span>
          </div>
        </div>
      </div>

      {/* Booking Requests Pipeline */}
      <div className="dashboard-section">
        <h2>Request Pipeline</h2>
        <div className="dashboard-metrics">
          <div className="metric-card">
            <span className="metric-value">{stats.bookingRequests}</span>
            <span className="metric-label">Total Requests</span>
          </div>
          <div className="metric-card metric-yellow">
            <span className="metric-value">{stats.pendingRequests}</span>
            <span className="metric-label">Pending Requests</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {stats.recentBookings?.length > 0 && (
        <div className="dashboard-section">
          <h2>Recent Bookings</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>PSW</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBookings.map((b) => (
                  <tr key={b._id}>
                    <td><strong>{b.client}</strong></td>
                    <td>{b.psw}</td>
                    <td>{b.date ? new Date(b.date).toLocaleDateString() : "—"}</td>
                    <td>
                      <span className={`badge ${b.status === "confirmed" ? "badge-green" : b.status === "cancelled" ? "badge-red" : "badge-yellow"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
