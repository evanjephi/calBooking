import { useState, useEffect } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: "📊", end: true },
  { to: "/admin/posts", label: "Posts", icon: "📝" },
  { to: "/admin/pages", label: "Pages", icon: "📄" },
  { to: "/admin/clients", label: "Clients", icon: "👥" },
  { to: "/admin/psws", label: "PSW Workers", icon: "🏥" },
  { to: "/admin/bookings", label: "Bookings", icon: "📅" },
  { to: "/admin/service-levels", label: "Service Levels", icon: "💰" },
  { to: "/admin/users", label: "Users", icon: "👤" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="admin-layout">
      {/* Mobile topbar */}
      <div className="admin-topbar">
        <button
          className={`hamburger${sidebarOpen ? " open" : ""}`}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle admin menu"
        >
          <span /><span /><span />
        </button>
        <Link to="/admin" className="admin-topbar-brand">Admin Panel</Link>
      </div>

      {/* Backdrop for mobile */}
      {sidebarOpen && <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`admin-sidebar${sidebarOpen ? " admin-sidebar--open" : ""}`}>
        <Link to="/admin" className="admin-sidebar-brand">
          <div className="nav-brand-icon">✦</div>
          <span>Admin Panel</span>
        </Link>
        <nav className="admin-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-item${isActive ? " active" : ""}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-nav-item">← Back to Site</Link>
          <div className="admin-sidebar-user">
            <span>{user?.firstName || user?.email}</span>
            <button onClick={logout} className="btn-link">Sign Out</button>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
