import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PublicNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef(null);

  const isActive = (path) => location.pathname.startsWith(path) ? "active" : "";
  const initials = user
    ? `${(user.firstName || user.email)?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "";

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Close on route change
  useEffect(() => { setMenuOpen(false); setMobileNavOpen(false); }, [location.pathname]);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">
        <div className="nav-brand-icon">✦</div>
        PremierPSW
      </Link>

      {/* Hamburger button — visible on mobile only */}
      <button
        className={`hamburger${mobileNavOpen ? " open" : ""}`}
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
        aria-label="Toggle navigation menu"
      >
        <span /><span /><span />
      </button>

      {/* Desktop nav links */}
      <div className="nav-links">
        <Link to="/resources/clients" className={isActive("/resources/clients")}>Resources for clients</Link>
        <Link to="/resources/providers" className={isActive("/resources/providers")}>Resources for service providers</Link>
        <Link to="/about" className={isActive("/about")}>About Us</Link>
        <Link to="/contact" className={isActive("/contact")}>Contact Us</Link>
        {user && user.role !== "psw" && <Link to="/find-psw" className={isActive("/find-psw")}>Find PSW</Link>}
        {user && user.role === "psw" && <Link to="/dashboard" className={isActive("/dashboard")}>Dashboard</Link>}
        {user && user.role !== "psw" && <Link to="/bookings" className={isActive("/bookings")}>My Bookings</Link>}
        {user && user.role === "psw" && <Link to="/psw/apply" className={isActive("/psw/apply")}>My Profile</Link>}
      </div>

      {/* Desktop auth actions */}
      <div className="nav-actions">
        {user ? (
          <div className="nav-avatar-menu" ref={menuRef}>
            <div
              className="nav-avatar"
              title={user.firstName || user.email}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {initials || "?"}
            </div>
            {menuOpen && (
              <div className="nav-dropdown">
                <div className="nav-dropdown-header">
                  <span className="nav-dropdown-name">{user.firstName} {user.lastName}</span>
                  <span className="nav-dropdown-email">{user.email}</span>
                </div>
                <div className="nav-dropdown-divider" />
                <Link to="/account" className="nav-dropdown-item">My Account</Link>
                {user.role === "psw" && (
                  <Link to="/account/documents" className="nav-dropdown-item">My Documents</Link>
                )}
                <Link to="/account/transactions" className="nav-dropdown-item">
                  {user.role === "psw" ? "My Earnings" : "Billing & Transactions"}
                </Link>
                {user.role === "admin" && (
                  <Link to="/admin" className="nav-dropdown-item">Admin Panel</Link>
                )}
                <div className="nav-dropdown-divider" />
                <button className="nav-dropdown-signout" onClick={logout}>Sign Out</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link to="/register" className="nav-link-action">Sign up</Link>
            <Link to="/login" className="nav-link-action">Log in</Link>
          </>
        )}
      </div>

      {/* Mobile overlay nav */}
      {mobileNavOpen && <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <div className={`mobile-nav${mobileNavOpen ? " mobile-nav--open" : ""}`}>
        <div className="mobile-nav-links">
          <Link to="/resources/clients" className={isActive("/resources/clients")}>Resources for clients</Link>
          <Link to="/resources/providers" className={isActive("/resources/providers")}>Resources for service providers</Link>
          <Link to="/about" className={isActive("/about")}>About Us</Link>
          <Link to="/contact" className={isActive("/contact")}>Contact Us</Link>
          {user && user.role !== "psw" && <Link to="/find-psw" className={isActive("/find-psw")}>Find PSW</Link>}
          {user && user.role === "psw" && <Link to="/dashboard" className={isActive("/dashboard")}>Dashboard</Link>}
          {user && user.role !== "psw" && <Link to="/bookings" className={isActive("/bookings")}>My Bookings</Link>}
          {user && user.role === "psw" && <Link to="/psw/apply" className={isActive("/psw/apply")}>My Profile</Link>}
        </div>
        <div className="mobile-nav-divider" />
        {user ? (
          <div className="mobile-nav-account">
            <div className="mobile-nav-user">
              <div className="nav-avatar">{initials || "?"}</div>
              <div>
                <div className="mobile-nav-name">{user.firstName} {user.lastName}</div>
                <div className="mobile-nav-email">{user.email}</div>
              </div>
            </div>
            <Link to="/account" className="mobile-nav-item">My Account</Link>
            {user.role === "psw" && <Link to="/account/documents" className="mobile-nav-item">My Documents</Link>}
            <Link to="/account/transactions" className="mobile-nav-item">
              {user.role === "psw" ? "My Earnings" : "Billing & Transactions"}
            </Link>
            {user.role === "admin" && <Link to="/admin" className="mobile-nav-item">Admin Panel</Link>}
            <button className="mobile-nav-signout" onClick={logout}>Sign Out</button>
          </div>
        ) : (
          <div className="mobile-nav-auth">
            <Link to="/register" className="btn btn-primary mobile-nav-btn">Sign up</Link>
            <Link to="/login" className="btn btn-outline mobile-nav-btn">Log in</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
