import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPSW() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    street: "",
    unit: "",
    city: "",
    postalCode: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        role: "psw",
      };
      if (form.phone) payload.phone = form.phone;
      if (form.street || form.city || form.postalCode) {
        payload.address = {
          street: form.street,
          unit: form.unit,
          city: form.city,
          postalCode: form.postalCode,
        };
      }
      await register(payload);
      navigate("/psw/apply");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1>Register as a PSW</h1>
      <p className="form-subtitle">Create your account to begin the PSW application process.</p>
      <form onSubmit={handleSubmit} className="gap-12 mt-20">
        <div className="flex-row">
          <div className="form-group">
            <label>First Name *</label>
            <input className="form-input" type="text" required value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)} />
          </div>
          <div className="form-group">
            <label>Last Name *</label>
            <input className="form-input" type="text" required value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Email *</label>
          <input className="form-input" type="email" required value={form.email}
            onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="form-group">
          <label>Password *</label>
          <input className="form-input" type="password" required minLength={6} value={form.password}
            onChange={(e) => update("password", e.target.value)} />
        </div>
        <div className="form-group">
          <label>Phone Number *</label>
          <input className="form-input" type="tel" required value={form.phone}
            onChange={(e) => update("phone", e.target.value)} placeholder="e.g. 416-555-1234" />
        </div>

        <fieldset style={{ marginTop: 4 }}>
          <legend>Home Address *</legend>
          <div className="form-group">
            <label>Street Address</label>
            <input className="form-input" type="text" required value={form.street}
              onChange={(e) => update("street", e.target.value)} placeholder="e.g. 123 Main Street" />
          </div>
          <div className="form-group">
            <label>Unit / Apt</label>
            <input className="form-input" type="text" value={form.unit}
              onChange={(e) => update("unit", e.target.value)} placeholder="e.g. Unit 4B" />
          </div>
          <div className="flex-row">
            <div className="form-group">
              <label>City</label>
              <input className="form-input" type="text" required value={form.city}
                onChange={(e) => update("city", e.target.value)} placeholder="e.g. Toronto" />
            </div>
            <div className="form-group">
              <label>Postal Code</label>
              <input className="form-input" type="text" required value={form.postalCode}
                onChange={(e) => update("postalCode", e.target.value)} placeholder="e.g. M5V 2T6" />
            </div>
          </div>
        </fieldset>

        {error && <div className="error-banner">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Creating Account…" : "Continue to Application"}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: "center" }}>
        Already have an account? <Link to="/login">Sign In</Link>
      </p>
      <p style={{ textAlign: "center", fontSize: 14, color: "var(--muted)" }}>
        Looking to find a PSW instead? <Link to="/register">Register as a client</Link>
      </p>
    </div>
  );
}
