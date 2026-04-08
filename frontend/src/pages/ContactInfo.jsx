// frontend/src/pages/ContactInfo.jsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { saveContact } from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function ContactInfo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ email: user?.email || "", phone: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email && !form.phone) {
      setError("Please provide at least an email or phone number.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await saveContact(id, form);
      navigate(`/book/${id}/review`);
    } catch (err) {
      setError(err.errors || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="step-indicator">Step 3 of 5</div>
      <h1>Contact Information</h1>
      <p>How should the caregiver reach you?</p>

      <form onSubmit={handleSubmit} className="gap-12 mt-20">
        <fieldset>
          <legend>Your Details</legend>
          <div className="form-group">
            <label>Email</label>
            <input className="form-input" type="email" value={form.email}
              onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="form-input" type="tel" value={form.phone}
              onChange={(e) => update("phone", e.target.value)} placeholder="(416) 555-0123" />
          </div>
          <p style={{ fontSize: 13, color: "var(--text)", marginTop: 8 }}>
            At least one of email or phone is required.
          </p>
        </fieldset>

        {error && (
          <div className="error-banner">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}

        <div className="flex-row">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/book/${id}/select`)}>
            ← Back
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Continue →"}
          </button>
        </div>
      </form>
    </div>
  );
}