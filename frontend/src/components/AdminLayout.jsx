import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: "📊", end: true },
  { to: "/admin/posts", label: "Posts", icon: "📝" },
  { to: "/admin/pages", label: "Pages", icon: "📄" },
  { to: "/admin/clients", label: "Clients", icon: "👥" },
  { to: "/admin/psws", label: "PSW Workers", icon: "🏥" },
  { to: "/admin/bookings", label: "Bookings", icon: "📅" },
  { to: "/admin/users", label: "Users", icon: "👤" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
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
