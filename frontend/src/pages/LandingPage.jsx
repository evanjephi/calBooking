import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <h1>Welcome to PremierPSW — Your Trusted Personal Support Marketplace</h1>
          <p>
            Connecting families and health institutions with dedicated,
            qualified Personal Support Workers (PSWs) in your community.
          </p>
          <div className="landing-hero-buttons">
            <Link to="/find-psw" className="btn btn-primary btn-lg">Find a PSW</Link>
            <Link to="/register/psw" className="btn btn-outline btn-lg">Register as PSW</Link>
          </div>
        </div>
      </section>

      {/* Why Choose PSW */}
      <section className="landing-section">
        <h2 className="landing-section-title">Why Choose PSW?</h2>
        <p className="landing-section-subtitle">
          Find trusted, qualified Personal Support Workers who are ready to support your loved
          ones, your institution, or help you grow your practice.
        </p>
        <div className="landing-cards">
          <div className="landing-card">
            <div className="landing-card-img" style={{ background: "linear-gradient(135deg, var(--teal-light), var(--teal))" }}>
              <span style={{ fontSize: 48 }}>👨‍👩‍👧</span>
            </div>
            <h3>For Families</h3>
            <p>
              Find trusted PSWs who are vetted, qualified,
              and ready to support your loved ones. Book…
            </p>
            <Link to="/resources/clients" className="landing-card-link">Read More →</Link>
          </div>
          <div className="landing-card">
            <div className="landing-card-img" style={{ background: "linear-gradient(135deg, #e8f4f8, #4a90d9)" }}>
              <span style={{ fontSize: 48 }}>🏥</span>
            </div>
            <h3>For Healthcare Institution</h3>
            <p>
              Access a network of qualified, vetted PSWs
              ready to fill shifts and support your team….
            </p>
            <Link to="/resources/clients" className="landing-card-link">Read More →</Link>
          </div>
          <div className="landing-card">
            <div className="landing-card-img" style={{ background: "linear-gradient(135deg, #e8f0e8, var(--teal))" }}>
              <span style={{ fontSize: 48 }}>👩‍⚕️</span>
            </div>
            <h3>For Personal Support Workers</h3>
            <p>
              Join a community of dedicated PSWs offering
              personalized care. Manage your bookings…
            </p>
            <Link to="/register/psw" className="landing-card-link">Read More →</Link>
          </div>
        </div>
      </section>

      {/* How PSW Works */}
      <section className="landing-section landing-section-alt">
        <h2 className="landing-section-title">How PSW Works</h2>
        <p className="landing-section-subtitle">
          Easily connect, book, and provide trusted
          personal care services in just a few simple steps.
        </p>
        <div className="landing-cards">
          <div className="landing-card">
            <div className="landing-card-img" style={{ background: "linear-gradient(135deg, #f0f4f0, #c8d8c8)" }}>
              <span style={{ fontSize: 48 }}>🔍</span>
            </div>
            <h3>Find the Perfect PSW</h3>
            <p>
              Browse our map to find available PSWs in
              your area.
            </p>
          </div>
          <div className="landing-card">
            <div className="landing-card-img" style={{ background: "linear-gradient(135deg, #f0f0f8, #c8c8d8)" }}>
              <span style={{ fontSize: 48 }}>📋</span>
            </div>
            <h3>Book and Pay</h3>
            <p>
              Select a PSW, choose your preferred time,
              and pay securely online.
            </p>
          </div>
          <div className="landing-card">
            <div className="landing-card-img" style={{ background: "linear-gradient(135deg, #f8f0f0, #d8c8c8)" }}>
              <span style={{ fontSize: 48 }}>💚</span>
            </div>
            <h3>Enjoy Quality Care</h3>
            <p>
              Experience compassionate, reliable support
              that makes a difference.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
