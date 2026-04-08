import { Link } from "react-router-dom";

export default function PSWApplicationSuccess() {
  return (
    <div className="page" style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h1>Application Submitted!</h1>
      <p style={{ marginTop: 12, color: "var(--muted)", lineHeight: 1.6 }}>
        Thank you for submitting your PSW application. Our team will review your
        documents and get back to you shortly.
      </p>
      <p style={{ marginTop: 8, color: "var(--muted)" }}>
        You can check your application status at any time.
      </p>
      <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
        <Link to="/psw/apply" className="btn btn-primary">Check Status</Link>
        <Link to="/" className="btn btn-outline">Back to Home</Link>
      </div>
    </div>
  );
}
