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
    </div>
  );
}
