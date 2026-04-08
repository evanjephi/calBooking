import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-left">
          <Link to="/" className="footer-brand">
            <div className="nav-brand-icon">✦</div>
            <span>PremierPSW</span>
          </Link>
          <div className="footer-social">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="X">𝕏</a>
            <a href="#" aria-label="YouTube">▶</a>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} Your marketplace. All rights reserved.</p>
        </div>
        <div className="footer-right">
          <Link to="/about">About</Link>
          <Link to="/contact">Contact Us</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </div>
    </footer>
  );
}
